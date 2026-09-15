import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { theme } from '../theme/theme';

export const AttendanceScreen: React.FC = () => {
  const { user } = useAuth();
  const [workType, setWorkType] = useState<'Office' | 'Remote' | 'Client College'>('Office');
  const [notes, setNotes] = useState('');
  const [locationStatus, setLocationStatus] = useState<string>('Detecting GPS...');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePunch, setActivePunch] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const fetchTodayAttendance = async () => {
    if (!user) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('flwdsk_employee_attendance')
        .select('*')
        .eq('employee_id', user.id)
        .eq('work_date', todayStr)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (data && data.clock_in && !data.clock_out) {
        setActivePunch(data);
        if (data.work_type) {
          setWorkType(data.work_type === 'remote' ? 'Remote' : (data.work_type === 'client_site' ? 'Client College' : 'Office'));
        }
      } else {
        setActivePunch(null);
      }

      // Also load attendance sessions if any
      const { data: sessData } = await supabase
        .from('flwdsk_work_sessions')
        .select('*')
        .eq('employee_id', user.id)
        .eq('work_date', todayStr)
        .is('deleted_at', null)
        .order('clock_in', { ascending: false });

      if (sessData) {
        setSessions(sessData);
      }
    } catch (e) {
      console.warn('Attendance load error:', e);
    }
  };

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('GPS permission denied (defaulting to remote)');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setLocationStatus(`GPS: ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
    } catch (e) {
      setLocationStatus('Could not retrieve GPS coordinates');
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
    requestLocation();
  }, [user]);

  const handleClockIn = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const dbWorkType = workType === 'Remote' ? 'remote' : (workType === 'Client College' ? 'client_site' : 'office');

      // 1. Create or update flwdsk_employee_attendance
      const { error: attError } = await supabase
        .from('flwdsk_employee_attendance')
        .upsert({
          employee_id: user.id,
          work_date: todayStr,
          clock_in: now.toISOString(),
          work_type: dbWorkType,
          status: 'present',
          clock_in_location: coords ? `${coords.lat},${coords.lng}` : null,
          notes: notes || `Mobile Clock-In (${workType})`,
        }, { onConflict: 'employee_id,work_date' });

      if (attError) throw attError;

      // 2. Open work session
      await supabase
        .from('flwdsk_work_sessions')
        .insert({
          employee_id: user.id,
          work_date: todayStr,
          clock_in: now.toISOString(),
          work_type: dbWorkType,
          clock_in_location: coords ? `${coords.lat},${coords.lng}` : null,
        });

      Alert.alert('Clock-In Successful', `You are clocked in for ${workType} shift.`);
      await fetchTodayAttendance();
    } catch (e: any) {
      Alert.alert('Punch Failed', e.message || 'Could not record clock-in.');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // 1. Update flwdsk_employee_attendance
      const { error: attError } = await supabase
        .from('flwdsk_employee_attendance')
        .update({
          clock_out: now.toISOString(),
          clock_out_location: coords ? `${coords.lat},${coords.lng}` : null,
        })
        .eq('employee_id', user.id)
        .eq('work_date', todayStr);

      if (attError) throw attError;

      // 2. Close active work session
      const { data: openSess } = await supabase
        .from('flwdsk_work_sessions')
        .select('*')
        .eq('employee_id', user.id)
        .eq('work_date', todayStr)
        .is('clock_out', null)
        .limit(1)
        .maybeSingle();

      if (openSess) {
        const inTime = new Date(openSess.clock_in).getTime();
        const durationMin = Math.max(0, Math.round((now.getTime() - inTime) / 60000));

        await supabase
          .from('flwdsk_work_sessions')
          .update({
            clock_out: now.toISOString(),
            duration_minutes: durationMin,
            clock_out_location: coords ? `${coords.lat},${coords.lng}` : null,
          })
          .eq('id', openSess.id);
      }

      Alert.alert('Clock-Out Successful', 'Your shift has ended and work hours are saved.');
      await fetchTodayAttendance();
    } catch (e: any) {
      Alert.alert('Punch Failed', e.message || 'Could not record clock-out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>GPS Smart Punch</Text>
      <Text style={styles.pageSubtitle}>Shift clock-in & GPS field tracking</Text>

      {/* GPS Location Bar */}
      <View style={styles.locationBar}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.locationText} numberOfLines={1}>{locationStatus}</Text>
        <TouchableOpacity onPress={requestLocation} style={styles.refreshLocBtn}>
          <Text style={styles.refreshLocText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Punch Action Card */}
      <View style={styles.punchCard}>
        <Text style={styles.cardHeaderTitle}>
          {activePunch ? 'Shift In Progress' : 'Start Your Work Day'}
        </Text>

        {!activePunch ? (
          <>
            <Text style={styles.fieldLabel}>Select Work Location Type</Text>
            <View style={styles.workTypeRow}>
              {(['Office', 'Remote', 'Client College'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typePill, workType === type && styles.typePillActive]}
                  onPress={() => setWorkType(type)}
                >
                  <Text style={[styles.typePillText, workType === type && styles.typePillTextActive]}>
                    {type === 'Office' ? '🏢 ' : (type === 'Remote' ? '🏠 ' : '🎓 ')}{type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Shift Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="E.g., St. Teresa batch delivery / Lab setup..."
              placeholderTextColor={theme.colors.textMuted}
              value={notes}
              onChangeText={setNotes}
            />
          </>
        ) : (
          <View style={styles.activePunchDetails}>
            <Text style={styles.activePunchTime}>
              Clocked in at:{' '}
              {new Date(activePunch.clock_in).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            <Text style={styles.activePunchType}>
              Shift Type: {activePunch.work_type?.toUpperCase() || 'OFFICE'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.punchBtn,
            activePunch ? styles.punchBtnOut : styles.punchBtnIn,
            loading && { opacity: 0.7 },
          ]}
          onPress={activePunch ? handleClockOut : handleClockIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.punchBtnText}>
              {activePunch ? '🛑 Clock Out & End Shift' : '🟢 Punch Clock In'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Today's Punch History */}
      {sessions.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Today's Work Intervals</Text>
          {sessions.map((s, idx) => (
            <View key={s.id || idx} style={styles.sessionItem}>
              <View>
                <Text style={styles.sessionType}>{s.work_type || 'Office'}</Text>
                <Text style={styles.sessionTimes}>
                  {new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {s.clock_out
                    ? new Date(s.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Running...'}
                </Text>
              </View>
              <Text style={styles.sessionDuration}>
                {s.duration_minutes != null ? `${s.duration_minutes} mins` : 'Active'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
  locationBar: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  refreshLocBtn: {
    backgroundColor: theme.colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 6,
  },
  refreshLocText: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: '600',
  },
  punchCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  workTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  typePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  typePillActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryLight,
  },
  typePillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    color: theme.colors.text,
    fontSize: 13,
    marginBottom: theme.spacing.lg,
  },
  activePunchDetails: {
    backgroundColor: theme.colors.surfaceSubtle,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  activePunchTime: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  activePunchType: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  punchBtn: {
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  punchBtnIn: {
    backgroundColor: theme.colors.success,
  },
  punchBtnOut: {
    backgroundColor: theme.colors.danger,
  },
  punchBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  historySection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sessionType: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sessionTimes: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionDuration: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
    fontSize: 13,
  },
});
