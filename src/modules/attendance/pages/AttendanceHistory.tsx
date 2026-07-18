import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, SectionHeader, StatCard, Button } from '../../../shared/ui/components';
import { CalendarGrid, type CalendarEvent } from '../../../shared/ui/CalendarGrid';
import { useAuth } from '../../auth/AuthProvider';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, TimePickerField } from '../../../shared/forms/form';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import type { AttendanceRecord } from '../attendance.repository';

export function AttendanceHistory() {
  const { user } = useAuth();
  const service = container.resolve(ATTENDANCE_SERVICE_TOKEN);
  const { confirm } = useDialog();
  const { toast } = useNotifications();

  const [date] = useState(new Date());
  const [year] = useState(date.getFullYear());
  const [month] = useState(date.getMonth() + 1); // 1-12
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDayRecord, setSelectedDayRecord] = useState<AttendanceRecord | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [correctOpen, setCorrectOpen] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = `${year}-${String(month).padStart(2, '0')}-31`;
    const res = await service.getHistory(user.id, { from, to });
    if (res.ok) {
      setRecords(res.value);
    }
    setLoading(false);
  }, [service, user, year, month]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDayClick = (dateStr: string) => {
    const rec = records.find((r) => r.workDate === dateStr) || null;
    setSelectedDateStr(dateStr);
    setSelectedDayRecord(rec);
  };

  const handleCorrectionSubmit = async (values: Record<string, unknown>) => {
    if (!selectedDayRecord) return;
    const ok = await confirm({
      title: 'Submit Correction?',
      message: 'This correction request will be sent to your manager for approval.',
    });
    if (!ok) return;

    const time = values.proposedTime as string;
    const reason = values.reason as string;
    const field = values.field as string;

    const res = await service.requestCorrection(
      selectedDayRecord.id,
      field,
      time,
      reason,
      { id: user!.id, role: user!.role }
    );

    if (res.ok) {
      toast({ variant: 'success', title: 'Correction Requested', message: 'Your request was successfully submitted.' });
      setCorrectOpen(false);
      setSelectedDayRecord(null);
      setSelectedDateStr(null);
    } else {
      toast({ variant: 'error', title: 'Request Failed', message: res.error.message });
    }
  };

  const events: CalendarEvent[] = records.map((r) => {
    const toneFor = {
      present: 'success' as const,
      on_break: 'warning' as const,
      clocked_out: 'neutral' as const,
      absent: 'danger' as const,
    };
    return {
      date: r.workDate,
      tone: toneFor[r.status],
      label: r.status === 'present' ? 'Present' : r.status === 'on_break' ? 'On Break' : 'Clocked Out',
      tooltip: `Clock-In: ${r.firstClockIn ? new Date(r.firstClockIn).toLocaleTimeString() : 'N/A'}\nWorking: ${r.totalWorkingMinutes} mins`,
    };
  });

  const presentDays = records.filter((r) => r.totalWorkingMinutes > 0).length;
  const avgHours = presentDays > 0 ? (records.reduce((acc, r) => acc + r.totalWorkingMinutes, 0) / presentDays / 60).toFixed(1) : '0';

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Attendance Logs" subtitle="Loading history..." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="My Attendance" subtitle="View history, work sessions, and request logs" />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }} className="kvj-workspace-grid">
        <Card>
          <CalendarGrid year={year} month={month} events={events} onDayClick={handleDayClick} />
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <StatCard label="Days Clocked In" value={`${presentDays} / ${records.length || 0}`} tone="success" icon="✓" />
          <StatCard label="Average Hours" value={`${avgHours} hrs`} icon="◷" />
          <Card>
            <SectionHeader title="Logs Tip" />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
              Click on any active calendar day tile to view detail logs, work session breakdowns, geolocations, and break records, or to submit attendance correction claims.
            </p>
          </Card>
        </div>
      </div>

      {/* Details Drawer */}
      <Drawer open={!!selectedDateStr} onClose={() => setSelectedDateStr(null)} title={`Logs for ${selectedDateStr}`}>
        {selectedDayRecord ? (
          <div>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</span>
              <div style={{ marginTop: 4 }}>
                <span className={`kvj-badge kvj-badge--${selectedDayRecord.status === 'present' ? 'success' : 'neutral'}`}>{selectedDayRecord.status}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>First Clock In</span>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                  {selectedDayRecord.firstClockIn ? new Date(selectedDayRecord.firstClockIn).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last Clock Out</span>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                  {selectedDayRecord.lastClockOut ? new Date(selectedDayRecord.lastClockOut).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net Working Duration</span>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
                  {selectedDayRecord.totalWorkingMinutes} minutes
                </div>
              </div>
            </div>

            {/* Sessions */}
            <div style={{ marginBottom: 20 }}>
              <SectionHeader title="Sessions Details" />
              {selectedDayRecord.sessions && selectedDayRecord.sessions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDayRecord.sessions.map((s, idx) => (
                    <div key={s.id} style={{ padding: 10, background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>Session #{idx + 1} ({s.workType})</div>
                      <div style={{ marginTop: 4 }}>In: {new Date(s.clockIn).toLocaleTimeString()}</div>
                      {s.clockOut && <div style={{ marginTop: 2 }}>Out: {new Date(s.clockOut).toLocaleTimeString()}</div>}
                      {s.clockInGeo && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Location: {s.clockInGeo.latitude.toFixed(4)}, {s.clockInGeo.longitude.toFixed(4)} (accuracy {s.clockInGeo.accuracy?.toFixed(1)}m)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No sessions logged.</div>
              )}
            </div>

            <Button variant="secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setCorrectOpen(true)}>
              Request Attendance Correction
            </Button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No attendance records logged for this day.</p>
          </div>
        )}
      </Drawer>

      {/* Corrections Drawer */}
      <Drawer open={correctOpen} onClose={() => setCorrectOpen(false)} title="Attendance Correction Claim">
        {selectedDayRecord && (
          <Form initial={{ field: 'firstClockIn', proposedTime: '', reason: '' }} onSubmit={handleCorrectionSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="kvj-label">Field to Correct</label>
              <select name="field" className="kvj-select">
                <option value="firstClockIn">First Clock In Time</option>
                <option value="lastClockOut">Last Clock Out Time</option>
              </select>
            </div>
            <TimePickerField name="proposedTime" label="Proposed Correct Time" />
            <TextField name="reason" label="Reason for Correction" placeholder="Forgot to punch, device issue..." />
            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" type="button" onClick={() => setCorrectOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Request</Button>
            </div>
          </Form>
        )}
      </Drawer>
    </AppShell>
  );
}
export default AttendanceHistory;
