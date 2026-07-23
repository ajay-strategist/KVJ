import { AppShell } from '../../../shared/layout/AppShell';
import { WorkspaceShell, type WorkspaceRole } from '../../../shared/workspace/WorkspaceShell';
import { DashboardGrid } from '../../../shared/dashboard/dashboard';
import { PageHeader, Card, SectionHeader, StatCard, QuickActionCard, Badge, Timeline, ActivityCard, Button } from '../../../shared/ui/components';
import { useAuth } from '../../../modules/auth/AuthProvider';
import { ROLES } from '../../../shared/permissions/roles';
import { mock } from '../../../shared/mock/factories';
import { LineChart } from '../../widgets/demo-widgets';
import { useAttendance } from '../../../modules/attendance/hooks/useAttendance';
import type { AttendanceRecord, WorkSessionType } from '../../../modules/attendance/attendance.repository';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useState, useEffect, useCallback, memo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Form, SelectField, TextField, useForm } from '../../../shared/forms/form';

function Greeting() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return <PageHeader title={`Good ${part}, ${user?.fullName?.split(' ')[0] ?? 'there'}`} subtitle={new Date().toDateString()} />;
}

const statusMap = {
  present: { label: 'Present', tone: 'success' as const },
  on_break: { label: 'On Break', tone: 'warning' as const },
  clocked_out: { label: 'Clocked Out', tone: 'neutral' as const },
  absent: { label: 'Absent', tone: 'danger' as const },
};

function ConditionalAttendanceFields() {
  const { values } = useForm();
  
  if (values.classification === 'Training') {
    return (
      <SelectField
        name="location"
        label="Select Training Batch"
        options={[
          { value: 'Christ 3BBA Data Analytics B1', label: 'Christ 3BBA Data Analytics B1' },
          { value: 'SB College MBA Batch 1', label: 'SB College MBA Batch 1' },
          { value: 'Vimala College Batch 2', label: 'Vimala College Batch 2' },
        ]}
      />
    );
  }

  if (values.classification === 'Marketing') {
    return (
      <TextField
        name="organisationsVisited"
        label="Organisations Visited"
        placeholder="e.g. Christ College, Rajagiri College"
      />
    );
  }

  return null;
}

const resolveLocationName = (locStr: string) => {
  if (locStr.includes('9.98') || locStr.includes('Office') || locStr.includes('Detecting')) {
    return 'KVJ Kochi HQ Workspace';
  }
  return locStr;
};

interface AttendancePanelProps {
  record: AttendanceRecord | null;
  loading: boolean;
  clockIn: (workType: WorkSessionType) => Promise<any>;
  clockOut: () => Promise<any>;
  startBreak: (reason?: string) => Promise<any>;
  endBreak: () => Promise<any>;
  onActivityLog?: (title: string, tone?: 'success' | 'progress' | 'info' | 'neutral') => void;
}

export const AttendancePanel = memo(function AttendancePanel({
  record,
  loading,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  onActivityLog,
}: AttendancePanelProps) {
  const { confirm } = useDialog();
  const { toast } = useNotifications();
  const [clockInOpen, setClockInOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Office');
  const [selectedBatch, setSelectedBatch] = useState('Christ 3BBA Data Analytics B1');

  // GPS & Location state
  const [locationStr, setLocationStr] = useState<string>('Detecting location...');

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStr(`${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`);
        },
        () => { setLocationStr('Office / GPS Active'); },
        { timeout: 5000 }
      );
    } else {
      setLocationStr('Office / GPS N/A');
    }
  }, []);

  const currentStatus = (record?.status ?? 'clocked_out') as keyof typeof statusMap;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (currentStatus === 'present' || currentStatus === 'on_break') {
      const timer = setInterval(() => { setNow(Date.now()); }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStatus]);

  const formatDuration = (ms: number) => {
    if (ms <= 0 || isNaN(ms)) return '00h 00m 00s';
    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / 60000) % 60;
    const hr = Math.floor(ms / 3600000);
    return `${String(hr).padStart(2, '0')}h ${String(min).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  };

  const currentWorkType = record?.sessions && record.sessions.length > 0
    ? record.sessions[record.sessions.length - 1].workType
    : '--';

  const clockInTimeStr = record?.firstClockIn
    ? new Date(record.firstClockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    : '--';

  const completedBreakMs = (record?.breaks ?? []).reduce((sum: number, b: any) => {
    if (b.endTime) return sum + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime());
    return sum;
  }, 0);

  const completedSessionMs = (record?.sessions ?? []).reduce((sum: number, s: any) => {
    if (s.clockOut) return sum + (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime());
    return sum;
  }, 0);

  const activeSession = record?.sessions?.find((s: any) => !s.clockOut);
  const activeSessionMs = activeSession ? (now - new Date(activeSession.clockIn).getTime()) : 0;

  const activeBreak = record?.breaks?.find((b: any) => !b.endTime);
  const activeBreakMs = activeBreak ? (now - new Date(activeBreak.startTime).getTime()) : 0;

  const totalWorkMs = completedSessionMs + activeSessionMs - completedBreakMs - activeBreakMs;
  const totalBreakMs = completedBreakMs + activeBreakMs;

  const handleCustomClockInSubmit = useCallback(async () => {
    const type = selectedMode === 'Training' ? `Training: ${selectedBatch}` : 'Office';
    const res = await clockIn(type as any);
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked In', message: `Clocked in for ${type} (${locationStr})` });
      if (onActivityLog) onActivityLog(`Clocked in for ${type} (${locationStr})`, 'success');
      setClockInOpen(false);
    } else {
      toast({ variant: 'error', title: 'Clock In Failed', message: res.error });
    }
  }, [clockIn, selectedMode, selectedBatch, toast, locationStr, onActivityLog]);

  const handleClockOut = useCallback(async () => {
    const ok = await confirm({ title: 'Clock Out?', message: 'Are you sure you want to end your work day?' });
    if (!ok) return;
    const res = await clockOut();
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked Out', message: 'You have successfully clocked out.' });
      if (onActivityLog) onActivityLog('Clocked out work session', 'neutral');
    } else {
      toast({ variant: 'error', title: 'Clock Out Failed', message: res.error });
    }
  }, [confirm, clockOut, toast, onActivityLog]);

  const handleStartBreakSubmit = useCallback(async (values: Record<string, unknown>) => {
    const reason = values.reason as string;
    const res = await startBreak(reason);
    if (res.ok) {
      toast({ variant: 'info', title: 'On Break', message: reason ? `Reason: ${reason}` : 'Enjoy your break.' });
      if (onActivityLog) onActivityLog(`Started break: ${reason || 'Break'}`, 'info');
      setBreakOpen(false);
    } else {
      toast({ variant: 'error', title: 'Break Failed', message: res.error });
    }
  }, [startBreak, toast, onActivityLog]);

  const handleEndBreak = useCallback(async () => {
    const res = await endBreak();
    if (res.ok) {
      toast({ variant: 'success', title: 'Back to Work', message: 'Work session resumed.' });
      if (onActivityLog) onActivityLog('Resumed work session after break', 'progress');
    } else {
      toast({ variant: 'error', title: 'End Break Failed', message: res.error });
    }
  }, [endBreak, toast, onActivityLog]);

  const sampleBatches = [
    { value: 'Christ 3BBA Data Analytics B1', label: 'Christ 3BBA Data Analytics B1' },
    { value: 'SB College MBA Batch 1', label: 'SB College MBA Batch 1' },
    { value: 'MIM 1MBA 2026-27 B1', label: 'MIM 1MBA 2026-27 B1' },
  ];

  return (
    <>
      <Card style={{ border: '2px solid var(--brand)', boxShadow: 'var(--e2)', marginBottom: 20 }}>
        <SectionHeader title="⏱️ Attendance Control Panel — Office / Training" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Current Status</div>
              <div style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: currentStatus === 'present' ? 'var(--status-success)' : currentStatus === 'on_break' ? 'var(--status-warning)' : 'var(--text-muted)'
                }} />
                {currentStatus === 'present' ? 'Working' : currentStatus === 'on_break' ? 'On Break' : 'Not Working'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>GPS Location</div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px', color: 'var(--brand)' }}>
                📍 {resolveLocationName(locationStr)}
              </div>
            </div>
            {currentStatus !== 'clocked_out' && (
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Work Type</div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>
                  {currentWorkType}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Clock In Time</div>
              <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>
                {clockInTimeStr}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Duration Today</div>
              <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(totalWorkMs)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Break Duration</div>
              <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', fontVariantNumeric: 'tabular-nums', color: currentStatus === 'on_break' ? 'var(--status-warning)' : undefined }}>
                {formatDuration(totalBreakMs)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {currentStatus === 'clocked_out' && (
              <>
                <button
                  type="button"
                  className="kvj-btn"
                  disabled={loading}
                  onClick={() => setClockInOpen(true)}
                  style={{
                    background: 'var(--status-success)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    boxShadow: 'var(--e1)',
                  }}
                >
                  Clock In (Office / Training)
                </button>

                <button
                  type="button"
                  className="kvj-btn"
                  onClick={() => setClaimOpen(true)}
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--brand)',
                    border: '1px solid var(--brand)',
                    padding: '10px 20px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  📋 Submit Attendance
                </button>
              </>
            )}

            {currentStatus === 'present' && (
              <>
                <button
                  type="button"
                  className="kvj-btn"
                  disabled={loading}
                  onClick={() => setBreakOpen(true)}
                  style={{
                    background: 'var(--status-warning)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    boxShadow: 'var(--e1)',
                  }}
                >
                  Start Break
                </button>
                <button
                  type="button"
                  className="kvj-btn"
                  disabled={loading}
                  onClick={handleClockOut}
                  style={{
                    background: 'var(--status-danger-bg)',
                    color: 'var(--status-danger)',
                    border: '1px solid var(--status-danger)',
                    padding: '10px 20px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  Clock Out
                </button>
              </>
            )}

            {currentStatus === 'on_break' && (
              <>
                <button
                  type="button"
                  className="kvj-btn"
                  disabled={loading}
                  onClick={handleEndBreak}
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    boxShadow: 'var(--e1)',
                  }}
                >
                  End Break (Resume)
                </button>
                <button
                  type="button"
                  className="kvj-btn"
                  disabled={loading}
                  onClick={handleClockOut}
                  style={{
                    background: 'var(--status-danger-bg)',
                    color: 'var(--status-danger)',
                    border: '1px solid var(--status-danger)',
                    padding: '10px 20px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  Clock Out
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Clock In Drawer */}
      <Drawer
        open={clockInOpen}
        onClose={() => setClockInOpen(false)}
        title="Attendance Clock In"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: -10, marginBottom: 6 }}>
            Verify your attendance details before clocking in.
          </p>

          {/* Group 1: Attendance Mode selectable cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Attendance Location Mode</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { value: 'Office', label: 'Office', icon: '🏢' },
                { value: 'Training', label: 'Training', icon: '👨‍🏫' },
                { value: 'Remote', label: 'Remote', icon: '🏠' },
                { value: 'Travel', label: 'Travel', icon: '🚗' },
              ].map((m) => {
                const active = selectedMode === m.value;
                return (
                  <div
                    key={m.value}
                    onClick={() => setSelectedMode(m.value)}
                    style={{
                      border: active ? '2px solid var(--brand)' : '1px solid var(--border)',
                      background: active ? 'var(--bg-sunken)' : 'var(--bg-surface)',
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontWeight: 600,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <span>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group 2: Training Batch Selector */}
          {selectedMode === 'Training' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Select Training Batch</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                {[
                  { id: 'b1', name: 'Christ 3BBA Data Analytics B1', college: 'Christ College', course: 'Data Analytics', time: '10:00 AM - 01:00 PM', students: 48, trainer: 'Linto George' },
                  { id: 'b2', name: 'SB College MBA Batch 1', college: 'SB College', course: 'Advanced Excel', time: '02:00 PM - 05:00 PM', students: 35, trainer: 'Unassigned' },
                  { id: 'b3', name: 'MIM 1MBA 2026-27 B1', college: 'MIM Campus', course: 'Power BI', time: '09:00 AM - 12:00 PM', students: 42, trainer: 'Linto George' }
                ].map((b) => {
                  const active = selectedBatch === b.name;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBatch(b.name)}
                      style={{
                        border: active ? '2px solid var(--brand)' : '1px solid var(--border)',
                        background: active ? 'var(--bg-sunken)' : 'var(--bg-surface)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{b.name}</span>
                        <Badge tone={active ? 'success' : 'neutral'}>{b.course}</Badge>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>🏫 {b.college}</span>
                        <span>👥 {b.students} Students</span>
                        <span>🕒 {b.time}</span>
                        <span>👤 {b.trainer}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Group 3: GPS Verification Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>GPS Verification</span>
            <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🟢 GPS Status: Verified
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>High Accuracy (3m)</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>📍 Location: {resolveLocationName(locationStr)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Coordinates: {locationStr}</div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${locationStr}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--brand)', textDecoration: 'underline', display: 'inline-block', marginTop: 6 }}
              >
                View on Google Maps ↗
              </a>
            </div>
          </div>

          {/* Group 4: Pre-Clock In Summary Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Clock In Summary</span>
            <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>Attendance Type: <strong>{selectedMode}</strong></div>
                <div>GPS Status: <strong style={{ color: 'var(--status-success)' }}>Verified</strong></div>
                <div style={{ gridColumn: 'span 2' }}>Selected Batch: <strong>{selectedMode === 'Training' ? selectedBatch : 'N/A - Office Work'}</strong></div>
                <div>Current Time: <strong>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
                <div>Trainer: <strong>Linto George</strong></div>
              </div>
            </div>
          </div>

          {/* Action Buttons inside Drawer Body */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Button
              variant="secondary"
              onClick={() => setClockInOpen(false)}
              style={{ flex: 1, padding: '10px 0' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomClockInSubmit}
              style={{ flex: 2, padding: '10px 0', background: 'var(--status-success)', color: '#fff', border: 'none', fontWeight: '600' }}
            >
              Confirm Clock In
            </Button>
          </div>
        </div>
      </Drawer>

      {/* Submit / Claim Attendance Drawer */}
      <Drawer open={claimOpen} onClose={() => setClaimOpen(false)} title="Submit / Claim Attendance Request">
        <Form
          initial={{
            date: new Date().toISOString().slice(0, 10),
            classification: 'Office',
            location: 'Christ 3BBA Data Analytics B1',
            organisationsVisited: '',
            startTime: '08:30 AM',
            endTime: '05:00 PM',
            notes: '',
          }}
          onSubmit={(values) => {
            const locText = values.classification === 'Training' 
              ? values.location 
              : values.classification === 'Marketing' 
              ? `Marketing: ${values.organisationsVisited}` 
              : 'Office Work';
            toast({
              variant: 'success',
              title: 'Attendance Request Submitted',
              message: `Attendance claim for ${values.date} (${values.startTime} - ${values.endTime}) sent to Manager/Admin review.`,
            });
            if (onActivityLog) {
              onActivityLog(`Submitted attendance claim for ${values.date} (${locText})`, 'success');
            }
            setClaimOpen(false);
          }}
        >
          <TextField name="date" label="Attendance Date" placeholder="YYYY-MM-DD" />
          <SelectField
            name="classification"
            label="Attendance Type"
            options={[
              { value: 'Office', label: 'Office Work' },
              { value: 'Training', label: 'Training Batch Session' },
              { value: 'Marketing', label: 'Marketing Visit' },
            ]}
          />
          <ConditionalAttendanceFields />
          <TextField name="startTime" label="Start Time" placeholder="08:30 AM" />
          <TextField name="endTime" label="End Time" placeholder="05:00 PM" />
          <TextField name="notes" label="Reason / Notes (Optional)" placeholder="Emergency, system delay, or missed clock-in..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setClaimOpen(false)}>Cancel</Button>
            <Button type="submit">Submit for Review</Button>
          </div>
        </Form>
      </Drawer>

      {/* Start Break Drawer */}
      <Drawer open={breakOpen} onClose={() => setBreakOpen(false)} title="Start Break Session">
        <Form initial={{ reason: '' }} onSubmit={handleStartBreakSubmit}>
          <TextField name="reason" label="Reason for Break (Optional)" placeholder="Coffee, lunch, etc." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setBreakOpen(false)}>Cancel</Button>
            <Button type="submit">Start Break</Button>
          </div>
        </Form>
      </Drawer>
    </>
  );
});

export interface TaskItem {
  id: string;
  title: string;
  project: string;
  due: string;
  priority: string;
  active: boolean;
  underReview?: boolean;
  secondsToday: number;
}

export const TaskWidget = memo(function TaskWidget({
  tasks,
  setTasks,
  onToggleTask,
  onSubmitReview,
}: {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  onToggleTask: (id: string, taskTitle: string, currentActive: boolean) => void;
  onSubmitReview: (id: string, taskTitle: string) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks((prev) =>
        prev.map((t) => (t.active ? { ...t, secondsToday: t.secondsToday + 1 } : t))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [setTasks]);

  const formatSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIdx) return;
    const updated = [...tasks];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIdx, 0, moved);
    setDraggedIndex(targetIdx);
    setTasks(updated);
  };

  return (
    <Card>
      <SectionHeader title="Today's Tasks (Drag & Drop Reorder)" />
      <style>{`
        .task-card-hover {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .task-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tasks.map((t, idx) => (
          <div
            key={t.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={() => setDraggedIndex(null)}
            className="task-card-hover"
            style={{
              padding: 16,
              border: '1px solid var(--border)',
              background: draggedIndex === idx ? 'var(--bg-hover)' : 'var(--bg-surface)',
              borderRadius: 10,
              cursor: 'grab',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: 'var(--e1)',
            }}
          >
            {/* Task Details Header — No blue progress bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, color: 'var(--text-muted)', cursor: 'grab' }}>⣿</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📁 Project: <strong style={{ color: 'var(--text-primary)' }}>{t.project}</strong></span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• 📅 Due: <strong style={{ color: 'var(--brand)' }}>{t.due}</strong></span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• ⏳ Time Left: <strong style={{ color: 'var(--status-warning)' }}>{t.id === '1' ? '2 hrs left' : t.id === '2' ? '1 day left' : '3 days left'}</strong></span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge tone={t.priority === 'Critical' ? 'danger' : t.priority === 'High' ? 'warning' : 'neutral'}>{t.priority}</Badge>
                {t.underReview && <Badge tone="info">Under Review</Badge>}
              </div>
            </div>

            {/* Display "Hours " instead of Total Hours Worked & progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                ⏱ Hours: {formatSec(t.secondsToday)}
              </span>

              {/* Action Buttons: Single Toggle Button (Start / Pause) & Submit */}
              <div style={{ display: 'flex', gap: 8 }}>
                {!t.underReview && (
                  <>
                    <Button
                      variant={t.active ? 'secondary' : 'primary'}
                      onClick={() => onToggleTask(t.id, t.title, t.active)}
                      style={{ padding: '4px 14px', fontSize: 12, minWidth: 80 }}
                    >
                      {t.active ? '⏸ Pause' : '▶ Start'}
                    </Button>

                    <Button
                      onClick={() => onSubmitReview(t.id, t.title)}
                      style={{ padding: '4px 14px', fontSize: 12, background: 'var(--status-success)', color: 'white' }}
                    >
                      📩 Submit
                    </Button>
                  </>
                )}

                {t.underReview && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-success)' }}>
                    ✓ Submitted for Manager Approval
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});

export const UpcomingEventsWidget = memo(function UpcomingEventsWidget() {
  const [selectedDay, setSelectedDay] = useState<number>(0);

  const upcoming7Days = [
    { day: 'Day 1 (Today)', events: [{ id: 'e1', time: '10:00 AM', title: 'Power BI Session - Christ 3BBA', type: 'Training' }] },
    { day: 'Day 2 (Tomorrow)', events: [{ id: 'e2', time: '11:30 AM', title: 'Monthly Expense Approval Deadline', type: 'Finance' }] },
    { day: 'Day 3 (Thu)', events: [{ id: 'e3', time: '02:00 PM', title: 'Rajagiri College Marketing Presentation', type: 'Marketing' }] },
    { day: 'Day 4 (Fri)', events: [{ id: 'e4', time: '09:30 AM', title: 'Client Requirement Sync - Apex Analytics', type: 'Projects' }] },
    { day: 'Day 5 (Sat)', events: [{ id: 'e5', time: '04:00 PM', title: 'Weekly Sprint & Progress Standup', type: 'Office' }] },
    { day: 'Day 6 (Sun)', events: [{ id: 'e6', time: 'Off Day', title: 'Sunday Weekly Rest', type: 'Holiday' }] },
    { day: 'Day 7 (Mon)', events: [{ id: 'e7', time: '10:00 AM', title: 'New Training Batch Orientation (Vimala College)', type: 'Training' }] },
  ];

  return (
    <Card>
      <SectionHeader title="Upcoming Events & Tasks (7-Day View)" />
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
        {upcoming7Days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelectedDay(i)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: selectedDay === i ? '1px solid var(--brand)' : '1px solid var(--border)',
              background: selectedDay === i ? 'var(--brand)' : 'var(--bg-sunken)',
              color: selectedDay === i ? 'white' : 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {d.day}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {upcoming7Days[selectedDay].events.map((e) => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🕒 {e.time}</div>
            </div>
            <Badge tone={e.type === 'Training' ? 'info' : e.type === 'Finance' ? 'warning' : e.type === 'Marketing' ? 'progress' : 'success'}>{e.type}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
});

export const TimelineWidget = memo(function TimelineWidget({
  entries,
}: {
  entries: Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral' }>;
}) {
  return (
    <Card>
      <SectionHeader title="Daily Activity Timeline (Clock In → Clock Out)" />
      <Timeline entries={entries} />
    </Card>
  );
});

export const AnnouncementWidget = memo(function AnnouncementWidget() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const announcements = [
    {
      id: 'a1',
      title: 'Q3 Training Calendar & Batch Schedule Release',
      category: 'Schedule',
      priority: 'High',
      pinned: true,
      content: 'The Training Calendar for Q3 has been finalized and uploaded. Please review your assigned batches under Batches -> Training Calendar. Any conflict or leave adjustments must be submitted to the college coordinator at least 48 hours prior.',
      date: 'Today'
    },
    {
      id: 'a2',
      title: 'System Maintenance Window: Sunday',
      category: 'IT Support',
      priority: 'Normal',
      pinned: false,
      content: 'The primary database server will undergo scheduled security patching and maintenance on Sunday, July 26th between 02:00 AM and 05:00 AM. Access to the Attendance and Trainer scheduling portals will be temporarily offline during this period.',
      date: 'Yesterday'
    }
  ];

  return (
    <Card>
      <SectionHeader title="Announcements & Notices" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {announcements.map((a) => {
          const isExpanded = expandedId === a.id;
          const tone = a.priority === 'High' ? 'danger' : 'neutral';
          
          return (
            <div
              key={a.id}
              style={{
                borderLeft: `4px solid ${a.priority === 'High' ? 'var(--status-danger)' : 'var(--brand)'}`,
                background: 'var(--bg-sunken)',
                padding: '12px 14px',
                borderRadius: '0 8px 8px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {a.pinned && <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>📌 Pinned</span>}
                  <Badge tone={tone}>{a.category}</Badge>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.date}</span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</div>
              
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {isExpanded ? a.content : `${a.content.slice(0, 95)}...`}
              </div>

              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0,
                  marginTop: 2,
                }}
              >
                {isExpanded ? 'Read Less ▲' : 'Read More ▼'}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
});

/** Resized Stat Pill matching exact height (64px) & style of QuickActionCard */
function ResizedStatPill({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; icon?: string }) {
  const colorMap = {
    success: 'var(--status-success)',
    warning: 'var(--status-warning)',
    info: 'var(--status-info)',
    danger: 'var(--status-danger)',
    neutral: 'var(--brand)',
  };
  return (
    <div className="kvj-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', height: 66 }}>
      {icon && <span className={`kvj-badge kvj-badge--${tone}`} style={{ width: 32, height: 32, borderRadius: 10, justifyContent: 'center', padding: 0, flexShrink: 0, fontSize: 16 }}>{icon}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
    </div>
  );
}

/** Resized QuickAction matching exact height (66px) */
function ResizedQuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="kvj-card kvj-card--hover" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-primary)', height: 66, width: '100%' }}>
      <span className="kvj-badge kvj-badge--progress" style={{ width: 32, height: 32, borderRadius: 10, justifyContent: 'center', padding: 0, flexShrink: 0, fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
    </button>
  );
}

/** My Day — default employee workspace. */
export function MyDayPage() {
  const { record, loading, clockIn, clockOut, startBreak, endBreak } = useAttendance();
  const { toast, addNotification } = useNotifications();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral' }>>([]);

  const handleActivityLog = (title: string, tone: 'success' | 'progress' | 'info' | 'neutral' = 'info') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTimelineEntries((prev) => [
      ...prev,
      { id: String(Date.now()), title, time: timeStr, tone },
    ]);
  };

  const handleToggleTask = (id: string, taskTitle: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: nextActive } : { ...t, active: false }))
    );
    handleActivityLog(`${nextActive ? 'Started' : 'Paused'} Task: ${taskTitle}`, nextActive ? 'progress' : 'neutral');
  };

  const handleSubmitReview = (id: string, taskTitle: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: false, underReview: true } : t))
    );
    toast({
      variant: 'success',
      title: 'Routed to Manager Review',
      message: `Task '${taskTitle}' submitted for Manager completion approval.`,
    });
    addNotification({
      title: 'Task Submitted for Review',
      message: `'${taskTitle}' routed to Manager for completion approval.`,
      category: 'task',
      priority: 'high',
    });
    handleActivityLog(`Submitted for Manager Review: ${taskTitle}`, 'success');
  };

  useEffect(() => {
    if (!loading) {
      setIsInitialLoad(false);
    }
  }, [loading]);

  if (isInitialLoad && loading) {
    return (
      <AppShell>
        <PageHeader title="Loading Workspace..." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Greeting />

      {/* Quick Actions + Resized Metrics. auto-fit so the six cards WRAP to a
          new line on narrower widths instead of overflowing and clipping the
          right-most card (previously a rigid repeat(6, 1fr) that could not
          shrink below its content width). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <ResizedQuickAction icon="✓" label="Add Task" />
        <ResizedQuickAction icon="₹" label="Submit Expense" />
        <ResizedQuickAction icon="🗓" label="Request Leave" />
        <ResizedStatPill label="Tasks Due" value="3" tone="warning" icon="◧" />
        <ResizedStatPill label="Hours this Month" value="168 hrs" tone="info" icon="⌛" />
        <ResizedStatPill label="Attendance %" value="96.2%" tone="success" icon="📈" />
      </div>

      <AttendancePanel
        record={record}
        loading={loading}
        clockIn={clockIn}
        clockOut={clockOut}
        startBreak={startBreak}
        endBreak={endBreak}
        onActivityLog={handleActivityLog}
      />

      {/* Main Layout:
          LEFT column: Today's Tasks + Upcoming Events (width auto matching left column)
          RIGHT column: Announcements Dashboard + Daily Activity Timeline (flowing down on right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TaskWidget
            tasks={tasks}
            setTasks={setTasks}
            onToggleTask={handleToggleTask}
            onSubmitReview={handleSubmitReview}
          />

          <UpcomingEventsWidget />
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AnnouncementWidget />
          <TimelineWidget entries={timelineEntries} />
        </div>
      </div>
    </AppShell>
  );
}

/** Supervisor / Manager / CEO demo workspaces (same shell, different widgets). */
export function RoleWorkspacePage({ role }: { role: Exclude<WorkspaceRole, 'employee'> }) {
  const [projects] = useState(() => mock.projects(5));
  const [attendanceTrend] = useState(() => mock.series(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']));
  const [teamActivity] = useState(() => mock.activity(5));

  const title = { supervisor: 'Supervisor Workspace', manager: 'Manager Workspace', ceo: 'CEO Workspace' }[role];
  return (
    <AppShell>
      <WorkspaceShell role={role} regions={{
        greeting: <PageHeader title={title} subtitle="Demo workspace · mock data" />,
        stats: <>
          <StatCard label="Team present" value="18/22" tone="success" icon="●" />
          <StatCard label="Utilization" value="82%" icon="◔" />
          <StatCard label="Pending approvals" value="7" tone="warning" icon="⚑" />
          <StatCard label="At-risk projects" value="2" tone="danger" icon="▲" />
        </>,
        primary: <>
          <Card><SectionHeader title="Projects" />{projects.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.client} · {p.progress}%</div></div>
              <Badge tone={p.health === 'On Track' ? 'success' : p.health === 'Needs Attention' ? 'warning' : 'danger'}>{p.health}</Badge>
            </div>
          ))}</Card>
          <Card><SectionHeader title="Attendance trend" /><LineChart data={attendanceTrend} /></Card>
        </>,
        side: <>
          <Card><SectionHeader title="Team activity" />{teamActivity.map((a) => <ActivityCard key={a.id} actor={a.actor} action={a.action} time={a.time} />)}</Card>
        </>,
      }} />
    </AppShell>
  );
}

/** Configurable dashboard demo (widget registry + role-based grid). */
export function DashboardPage() {
  const { user } = useAuth();
  const workspace = user ? ROLES[user.role].workspace : 'employee';
  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle="Configurable widgets · powered by the dashboard registry" />
      <DashboardGrid role={workspace} />
    </AppShell>
  );
}
