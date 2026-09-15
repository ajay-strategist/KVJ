import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../theme/theme';

export const TrainingBatchesScreen: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [topicsCovered, setTopicsCovered] = useState('');
  const [deliveryHours, setDeliveryHours] = useState('2.0');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const loadBatches = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('flwdsk_training_batches')
        .select('*')
        .or(`lead_trainer_id.eq.${user.id},assistant_trainer_id.eq.${user.id}`)
        .is('deleted_at', null)
        .order('start_date', { ascending: false });

      setBatches(data || []);
    } catch (e) {
      console.warn('Batches load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchStudents = async (batch: any) => {
    setSelectedBatch(batch);
    setLoading(true);
    try {
      const { data: enrollments } = await supabase
        .from('flwdsk_enrollments')
        .select('student_id, flwdsk_student_records(*)')
        .eq('batch_id', batch.id)
        .is('deleted_at', null);

      if (enrollments) {
        const studentList = enrollments.map((row: any) => ({
          id: row.flwdsk_student_records?.id || row.student_id,
          name: `${row.flwdsk_student_records?.first_name || ''} ${row.flwdsk_student_records?.last_name || ''}`.trim() || 'Student',
          email: row.flwdsk_student_records?.email,
          phone: row.flwdsk_student_records?.phone,
        }));
        setStudents(studentList);

        // Default all to present
        const initMap: Record<string, boolean> = {};
        studentList.forEach((s: any) => {
          initMap[s.id] = true;
        });
        setAttendanceMap(initMap);
      }
    } catch (e) {
      console.warn('Students load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [user]);

  const toggleStudent = (id: string) => {
    setAttendanceMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmitDailyReport = async () => {
    if (!topicsCovered.trim()) {
      Alert.alert('Required', 'Please enter topics covered today.');
      return;
    }

    setSubmitting(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const presentCount = Object.values(attendanceMap).filter(Boolean).length;
      const totalCount = students.length;

      // 1. Record daily training delivery log
      await supabase
        .from('flwdsk_training_daily_reports')
        .insert({
          batch_id: selectedBatch.id,
          trainer_id: user?.id,
          report_date: todayStr,
          topics_covered: topicsCovered.trim(),
          hours_delivered: parseFloat(deliveryHours) || 2.0,
          total_students: totalCount,
          present_students: presentCount,
          status: 'submitted',
        });

      setReportModalOpen(false);
      setTopicsCovered('');
      Alert.alert('Report Submitted', `Classroom attendance and daily topics saved for ${selectedBatch.name}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit daily report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedBatch) {
    const presentCount = Object.values(attendanceMap).filter(Boolean).length;
    const pct = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

    return (
      <View style={styles.container}>
        {/* Batch Detail Header */}
        <View style={styles.batchHeaderCard}>
          <TouchableOpacity onPress={() => setSelectedBatch(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹ Back to Batches</Text>
          </TouchableOpacity>
          <Text style={styles.batchTitle}>{selectedBatch.name}</Text>
          <Text style={styles.batchSub}>
            {selectedBatch.college || 'Training Program'} • {students.length} Students Enrolled
          </Text>

          {/* Present ratio chip */}
          <View style={styles.rollcallRatio}>
            <Text style={styles.rollcallRatioText}>
              Present: {presentCount}/{students.length} ({pct}%)
            </Text>
            <TouchableOpacity
              style={styles.fileReportBtn}
              onPress={() => setReportModalOpen(true)}
            >
              <Text style={styles.fileReportBtnText}>📝 Submit Daily Log</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Student Roster */}
        <FlatList
          data={students}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const isPresent = attendanceMap[item.id] !== false;
            return (
              <TouchableOpacity
                style={[styles.studentCard, isPresent ? styles.studentCardPresent : styles.studentCardAbsent]}
                onPress={() => toggleStudent(item.id)}
              >
                <View style={styles.studentInfo}>
                  <Text style={styles.studentIndex}>{index + 1}.</Text>
                  <View>
                    <Text style={styles.studentName}>{item.name}</Text>
                    {item.email ? <Text style={styles.studentSub}>{item.email}</Text> : null}
                  </View>
                </View>

                <View style={[styles.badgePill, isPresent ? styles.badgePresent : styles.badgeAbsent]}>
                  <Text style={styles.badgePillText}>
                    {isPresent ? '✓ Present' : '✕ Absent'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Submit Daily Report Modal */}
        <Modal visible={reportModalOpen} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>File Daily Training Delivery</Text>
              <Text style={styles.modalSub}>{selectedBatch.name}</Text>

              <Text style={styles.fieldLabel}>Topics Covered in Classroom</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Loops & conditional branches in Python; Lab assignments 1 to 4..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={4}
                value={topicsCovered}
                onChangeText={setTopicsCovered}
              />

              <Text style={styles.fieldLabel}>Delivery Hours (Classroom)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 45 }]}
                keyboardType="decimal-pad"
                placeholder="2.0"
                placeholderTextColor={theme.colors.textMuted}
                value={deliveryHours}
                onChangeText={setDeliveryHours}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setReportModalOpen(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSubmitDailyReport}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.pageTitle}>Training Batches</Text>
        <Text style={styles.pageSubtitle}>Classroom rollcall & topic reporting</Text>
      </View>

      <FlatList
        data={batches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🎓</Text>
              <Text style={styles.emptyTitle}>No Training Batches</Text>
              <Text style={styles.emptySub}>You are currently not assigned to any active batches.</Text>
            </View>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.batchCard}
            onPress={() => loadBatchStudents(item)}
          >
            <View style={styles.batchCardHeader}>
              <Text style={styles.batchCardTitle}>{item.name}</Text>
              <Text style={styles.arrowIcon}>›</Text>
            </View>
            <Text style={styles.batchCardCollege}>{item.college || 'College Program'}</Text>
            <View style={styles.batchMetaRow}>
              <Text style={styles.batchMetaText}>
                Dates: {item.start_date?.slice(0, 10) || 'Active'}
              </Text>
              <Text style={styles.actionChip}>Open Rollcall ➔</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topHeader: {
    padding: theme.spacing.md,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  pageSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  batchCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  batchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchCardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  arrowIcon: {
    color: theme.colors.textMuted,
    fontSize: 22,
    marginLeft: 8,
  },
  batchCardCollege: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  batchMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  batchMetaText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  actionChip: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  batchHeaderCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginBottom: 6,
  },
  backBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  batchTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  batchSub: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  rollcallRatio: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  rollcallRatioText: {
    color: theme.colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  fileReportBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  fileReportBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  studentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  studentCardPresent: {
    borderColor: '#10b98144',
  },
  studentCardAbsent: {
    borderColor: '#ef444444',
    opacity: 0.6,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentIndex: {
    color: theme.colors.textMuted,
    fontSize: 12,
    width: 26,
    fontWeight: '600',
  },
  studentName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  studentSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  badgePresent: {
    backgroundColor: theme.colors.successBg,
  },
  badgeAbsent: {
    backgroundColor: theme.colors.dangerBg,
  },
  badgePillText: {
    color: '#fff',
    fontSize: 11,
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
  },
  modalSub: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    color: theme.colors.text,
    fontSize: 13,
    minHeight: 80,
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
