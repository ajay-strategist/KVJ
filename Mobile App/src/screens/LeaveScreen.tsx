import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../theme/theme';

export const LeaveScreen: React.FC = () => {
  const { user } = useAuth();
  const [leaveType, setLeaveType] = useState<'casual' | 'medical' | 'lop'>('casual');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<'full' | 'first_half' | 'second_half'>('full');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);

  const loadLeaveData = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('flwdsk_leave_requests')
        .select('*')
        .eq('employee_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      setLeaveHistory(data || []);
    } catch (e) {
      console.warn('Error loading leaves:', e);
    }
  };

  useEffect(() => {
    loadLeaveData();
  }, [user]);

  const handleApplyLeave = async () => {
    if (!user) return;
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for your leave application.');
      return;
    }

    setLoading(true);
    try {
      const daysCount = startDate === endDate && shift !== 'full' ? 0.5 : 1.0;

      const { error } = await supabase
        .from('flwdsk_leave_requests')
        .insert({
          employee_id: user.id,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          days_count: daysCount,
          reason: reason.trim(),
          status: 'pending',
        });

      if (error) throw error;

      Alert.alert('Application Submitted', 'Your leave request has been sent for manager review.');
      setReason('');
      await loadLeaveData();
    } catch (e: any) {
      Alert.alert('Submission Error', e.message || 'Could not file leave.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Leave Management</Text>
      <Text style={styles.pageSubtitle}>Apply for time-off and track approval status</Text>

      {/* Apply Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Apply for Leave</Text>

        <Text style={styles.fieldLabel}>Leave Category</Text>
        <View style={styles.pillRow}>
          {(['casual', 'medical', 'lop'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.pill, leaveType === type && styles.pillActive]}
              onPress={() => setLeaveType(type)}
            >
              <Text style={[styles.pillText, leaveType === type && styles.pillTextActive]}>
                {type === 'casual' ? '🌴 Casual' : (type === 'medical' ? '🏥 Medical' : '💼 Loss of Pay')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Shift Duration</Text>
        <View style={styles.pillRow}>
          {([
            { key: 'full', label: 'Full Day' },
            { key: 'first_half', label: '1st Half' },
            { key: 'second_half', label: '2nd Half' },
          ] as const).map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.pill, shift === s.key && styles.pillActive]}
              onPress={() => setShift(s.key)}
            >
              <Text style={[styles.pillText, shift === s.key && styles.pillTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dateRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Reason for Leave</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          multiline
          placeholder="Brief explanation for manager review..."
          placeholderTextColor={theme.colors.textMuted}
          value={reason}
          onChangeText={setReason}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={handleApplyLeave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Leave Application</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Leave Request History */}
      <Text style={styles.sectionHeading}>My Recent Requests</Text>
      {leaveHistory.length === 0 ? (
        <Text style={styles.emptyText}>No previous leave applications logged.</Text>
      ) : (
        leaveHistory.map((req) => (
          <View key={req.id} style={styles.historyCard}>
            <View style={styles.historyTop}>
              <Text style={styles.historyType}>
                {req.leave_type?.toUpperCase()} LEAVE ({req.days_count || 1} day)
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  req.status === 'approved'
                    ? styles.statusApproved
                    : req.status === 'rejected'
                    ? styles.statusRejected
                    : styles.statusPending,
                ]}
              >
                <Text style={styles.statusText}>{(req.status || 'Pending').toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.historyDates}>
              📅 {req.start_date} {req.end_date !== req.start_date ? `to ${req.end_date}` : ''}
            </Text>
            {req.reason ? <Text style={styles.historyReason}>"{req.reason}"</Text> : null}
          </View>
        ))
      )}
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
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  pageSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryLight,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    color: theme.colors.text,
    fontSize: 13,
    marginBottom: theme.spacing.md,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  historyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyType: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusApproved: {
    backgroundColor: theme.colors.successBg,
  },
  statusPending: {
    backgroundColor: theme.colors.warningBg,
  },
  statusRejected: {
    backgroundColor: theme.colors.dangerBg,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  historyDates: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  historyReason: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
