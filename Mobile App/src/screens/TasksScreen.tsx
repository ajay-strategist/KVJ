import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../theme/theme';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  project_id?: string;
  actual_hours?: number;
  estimated_hours?: number;
  priority?: string;
}

export const TasksScreen: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'todo' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pause work note modal
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseTargetTaskId, setPauseTargetTaskId] = useState<string | null>(null);
  const [workNote, setWorkNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadTasksAndSessions = async () => {
    if (!user) return;
    try {
      // 1. Fetch assigned tasks
      const { data: tData } = await supabase
        .from('flwdsk_tasks')
        .select('*')
        .eq('assignee_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (tData) {
        setTasks(tData);
      }

      // 2. Fetch running task session
      const { data: sessData } = await supabase
        .from('flwdsk_task_work_sessions')
        .select('*')
        .eq('employee_id', user.id)
        .is('end_time', null)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      setActiveSession(sessData || null);
    } catch (e) {
      console.warn('Error loading tasks:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasksAndSessions();
  }, [user]);

  const handleStartTask = async (task: Task) => {
    if (!user) return;
    if (activeSession && activeSession.task_id === task.id) {
      Alert.alert('Already Running', 'This task timer is currently active.');
      return;
    }

    setActionLoading(true);
    try {
      const now = new Date();

      // 1. Pause any other running task session for this employee
      if (activeSession) {
        const startMs = new Date(activeSession.start_time).getTime();
        const durationMin = Math.max(0, Math.round((now.getTime() - startMs) / 60000));
        await supabase
          .from('flwdsk_task_work_sessions')
          .update({
            end_time: now.toISOString(),
            duration_minutes: durationMin,
            status: 'paused',
          })
          .eq('id', activeSession.id);
      }

      // 2. Update task status to in_progress
      await supabase
        .from('flwdsk_tasks')
        .update({ status: 'in_progress' })
        .eq('id', task.id);

      // 3. Create fresh running session
      await supabase
        .from('flwdsk_task_work_sessions')
        .insert({
          task_id: task.id,
          project_id: task.project_id,
          employee_id: user.id,
          work_title: task.title,
          start_time: now.toISOString(),
          status: 'running',
        });

      await loadTasksAndSessions();
      Alert.alert('Timer Started', `Task "${task.title}" is now running.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start task.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPauseModal = (taskId: string) => {
    setPauseTargetTaskId(taskId);
    setWorkNote('');
    setPauseModalOpen(true);
  };

  const handleConfirmPause = async () => {
    if (!user || !pauseTargetTaskId) return;
    const note = workNote.trim();
    if (!note) {
      Alert.alert('Work Update Required', 'Please describe what you completed before pausing.');
      return;
    }

    setActionLoading(true);
    try {
      const now = new Date();

      // 1. Close open session
      const { data: openSess } = await supabase
        .from('flwdsk_task_work_sessions')
        .select('*')
        .eq('employee_id', user.id)
        .eq('task_id', pauseTargetTaskId)
        .is('end_time', null)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (openSess) {
        const startMs = new Date(openSess.start_time).getTime();
        const durationMin = Math.max(0, Math.round((now.getTime() - startMs) / 60000));
        await supabase
          .from('flwdsk_task_work_sessions')
          .update({
            end_time: now.toISOString(),
            duration_minutes: durationMin,
            status: 'paused',
            notes: note,
          })
          .eq('id', openSess.id);
      }

      // 2. Update task description and status to todo
      await supabase
        .from('flwdsk_tasks')
        .update({
          description: note,
          status: 'todo',
        })
        .eq('id', pauseTargetTaskId);

      setPauseModalOpen(false);
      await loadTasksAndSessions();
      Alert.alert('Task Paused', 'Progress saved to worklog.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not pause task.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'in_progress') return t.status === 'in_progress';
    if (filter === 'todo') return t.status === 'todo';
    if (filter === 'completed') return t.status === 'done' || t.status === 'completed';
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top Filter Tabs */}
      <View style={styles.tabBar}>
        {(['all', 'in_progress', 'todo', 'completed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, filter === tab && styles.tabItemActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
              {tab === 'all' ? 'All' : (tab === 'in_progress' ? 'Running' : (tab === 'todo' ? 'To Do' : 'Done'))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasksAndSessions(); }} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No tasks found</Text>
              <Text style={styles.emptySub}>You have no assigned tasks in this category.</Text>
            </View>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
          )
        }
        renderItem={({ item }) => {
          const isRunning = activeSession && activeSession.task_id === item.id;
          return (
            <View style={[styles.taskCard, isRunning && styles.taskCardRunning]}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskTitle} numberOfLines={2}>{item.title}</Text>
                <View style={[styles.statusBadge, isRunning ? styles.statusBadgeRunning : styles.statusBadgeDefault]}>
                  <Text style={styles.statusBadgeText}>
                    {isRunning ? 'RUNNING' : (item.status || 'To Do').toUpperCase()}
                  </Text>
                </View>
              </View>

              {item.description ? (
                <Text style={styles.taskDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}

              <View style={styles.taskFooter}>
                <Text style={styles.hoursText}>
                  Logged: {item.actual_hours ? `${item.actual_hours}h` : '0h'}
                </Text>

                <View style={styles.btnRow}>
                  {isRunning ? (
                    <TouchableOpacity
                      style={styles.pauseBtn}
                      onPress={() => handleOpenPauseModal(item.id)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.pauseBtnText}>⏸️ Pause</Text>
                    </TouchableOpacity>
                  ) : item.status !== 'done' && item.status !== 'completed' ? (
                    <TouchableOpacity
                      style={styles.startBtn}
                      onPress={() => handleStartTask(item)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.startBtnText}>▶️ Start Timer</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.completedCheck}>✓ Completed</Text>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Mandatory Work Progress Modal */}
      <Modal visible={pauseModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Work Progress Update</Text>
            <Text style={styles.modalSub}>
              Please describe what you accomplished before pausing this task session.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Completed module test cases, prepared student guidelines..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={4}
              value={workNote}
              onChangeText={setWorkNote}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPauseModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleConfirmPause}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save & Pause</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  tabItemActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  taskCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  taskCardRunning: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: '#312e8133',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  taskTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeDefault: {
    backgroundColor: theme.colors.surfaceSubtle,
  },
  statusBadgeRunning: {
    backgroundColor: theme.colors.primary,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  taskDesc: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  hoursText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  btnRow: {
    flexDirection: 'row',
  },
  startBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pauseBtn: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  pauseBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  completedCheck: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSub: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.md,
  },
  modalInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    color: theme.colors.text,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
