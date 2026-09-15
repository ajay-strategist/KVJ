import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../theme/theme';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<'in' | 'out'>('out');
  const [activeSession, setActiveSession] = useState<any>(null);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [batchesCount, setBatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Fetch today's attendance punch status
      const { data: attData } = await supabase
        .from('flwdsk_employee_attendance')
        .select('*')
        .eq('employee_id', user.id)
        .eq('work_date', todayStr)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (attData && attData.clock_in && !attData.clock_out) {
        setAttendanceStatus('in');
      } else {
        setAttendanceStatus('out');
      }

      // 2. Fetch running task work session
      const { data: sessionData } = await supabase
        .from('flwdsk_task_work_sessions')
        .select('*')
        .eq('employee_id', user.id)
        .is('end_time', null)
        .is('deleted_at', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveSession(sessionData || null);

      // 3. Fetch active/pending tasks
      const { data: tasksData } = await supabase
        .from('flwdsk_tasks')
        .select('id, title, status')
        .eq('assignee_id', user.id)
        .is('deleted_at', null);

      if (tasksData) {
        setPendingTasksCount(tasksData.filter((t) => t.status !== 'done' && t.status !== 'completed').length);
      }

      // 4. Fetch assigned training batches
      const { data: batchData } = await supabase
        .from('flwdsk_training_batches')
        .select('id')
        .or(`lead_trainer_id.eq.${user.id},assistant_trainer_id.eq.${user.id}`)
        .is('deleted_at', null);

      if (batchData) {
        setBatchesCount(batchData.length);
      }
    } catch (e) {
      console.warn('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      {/* Header Profile Greeting */}
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.greetingText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.fullName || 'Colleague'}</Text>
          <Text style={styles.userRole}>{user?.designation || 'Staff Member'}</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(user?.firstName?.[0] || 'U').toUpperCase()}
            {(user?.lastName?.[0] || '').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Attendance Punch Status Banner */}
      <View style={[styles.statusCard, attendanceStatus === 'in' ? styles.statusIn : styles.statusOut]}>
        <View style={styles.statusInfo}>
          <Text style={styles.statusLabel}>Today's Attendance Status</Text>
          <Text style={styles.statusValue}>
            {attendanceStatus === 'in' ? '🟢 Clocked In (Active Shift)' : '⚪ Currently Clocked Out'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.punchActionBtn}
          onPress={() => navigation.navigate('Attendance')}
        >
          <Text style={styles.punchActionText}>
            {attendanceStatus === 'in' ? 'Punch Out' : 'Punch In'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Running Task Indicator */}
      {activeSession ? (
        <View style={styles.runningTaskCard}>
          <View style={styles.runningBadge}>
            <Text style={styles.runningBadgeText}>⚡ Task Timer Running</Text>
          </View>
          <Text style={styles.runningTaskTitle}>{activeSession.work_title}</Text>
          <Text style={styles.runningTaskTime}>
            Started at: {new Date(activeSession.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <TouchableOpacity
            style={styles.manageTaskBtn}
            onPress={() => navigation.navigate('Tasks')}
          >
            <Text style={styles.manageTaskBtnText}>Pause or Update Worklog ⏱️</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Quick Metrics Grid */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.metricCard} onPress={() => navigation.navigate('Tasks')}>
          <Text style={styles.metricIcon}>📋</Text>
          <Text style={styles.metricValue}>{pendingTasksCount}</Text>
          <Text style={styles.metricLabel}>Pending Tasks</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.metricCard} onPress={() => navigation.navigate('Training')}>
          <Text style={styles.metricIcon}>🎓</Text>
          <Text style={styles.metricValue}>{batchesCount}</Text>
          <Text style={styles.metricLabel}>Training Batches</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.metricCard} onPress={() => navigation.navigate('Attendance')}>
          <Text style={styles.metricIcon}>⏱️</Text>
          <Text style={styles.metricValue}>{attendanceStatus === 'in' ? 'Active' : 'Off'}</Text>
          <Text style={styles.metricLabel}>Shift Clock</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.metricCard} onPress={() => navigation.navigate('Leave')}>
          <Text style={styles.metricIcon}>🏖️</Text>
          <Text style={styles.metricValue}>Apply</Text>
          <Text style={styles.metricLabel}>Leave Request</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Navigation */}
      <Text style={styles.sectionHeading}>Quick Field Actions</Text>
      <View style={styles.actionsList}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('Attendance')}
        >
          <View style={styles.actionIconBg}><Text style={styles.actionEmoji}>📍</Text></View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionItemTitle}>GPS Attendance Punch</Text>
            <Text style={styles.actionItemSub}>Clock in/out with automatic GPS location</Text>
          </View>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('Tasks')}
        >
          <View style={styles.actionIconBg}><Text style={styles.actionEmoji}>⏱️</Text></View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionItemTitle}>Task Time Tracker</Text>
            <Text style={styles.actionItemSub}>Start/pause daily tasks with work update notes</Text>
          </View>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => navigation.navigate('Training')}
        >
          <View style={styles.actionIconBg}><Text style={styles.actionEmoji}>🎓</Text></View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionItemTitle}>Classroom Student Rollcall</Text>
            <Text style={styles.actionItemSub}>Mark batch attendance & file daily delivery topics</Text>
          </View>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  greetingText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  userName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  userRole: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  statusCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
  },
  statusIn: {
    backgroundColor: '#064e3b33',
    borderColor: theme.colors.success,
  },
  statusOut: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statusValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  punchActionBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  punchActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  runningTaskCard: {
    backgroundColor: '#312e8144',
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  runningBadge: {
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 6,
  },
  runningBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  runningTaskTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  runningTaskTime: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  manageTaskBtn: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  manageTaskBtnText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: theme.spacing.lg,
  },
  metricCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeading: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  actionsList: {
    gap: 8,
  },
  actionItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionTextCol: {
    flex: 1,
  },
  actionItemTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actionItemSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  arrowText: {
    color: theme.colors.textMuted,
    fontSize: 20,
    marginLeft: 8,
  },
});
