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
import { Form, SelectField, TextField } from '../../../shared/forms/form';

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

interface AttendancePanelProps {
  record: AttendanceRecord | null;
  loading: boolean;
  clockIn: (workType: WorkSessionType) => Promise<any>;
  clockOut: () => Promise<any>;
  startBreak: (reason?: string) => Promise<any>;
  endBreak: () => Promise<any>;
}

export const AttendancePanel = memo(function AttendancePanel({
  record,
  loading,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
}: AttendancePanelProps) {
  const { confirm } = useDialog();
  const { toast } = useNotifications();
  const [clockInOpen, setClockInOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);

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

  const handleClockInSubmit = useCallback(async (values: Record<string, unknown>) => {
    const mode = values.mode as string;
    const batch = values.batch as string;
    const type = mode === 'Training' ? `Training: ${batch}` : 'Office';
    const res = await clockIn(type as any);
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked In', message: `Clocked in for ${type} (${locationStr})` });
      setClockInOpen(false);
    } else {
      toast({ variant: 'error', title: 'Clock In Failed', message: res.error });
    }
  }, [clockIn, toast, locationStr]);

  const handleClockOut = useCallback(async () => {
    const ok = await confirm({ title: 'Clock Out?', message: 'Are you sure you want to end your work day?' });
    if (!ok) return;
    const res = await clockOut();
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked Out', message: 'You have successfully clocked out.' });
    } else {
      toast({ variant: 'error', title: 'Clock Out Failed', message: res.error });
    }
  }, [confirm, clockOut, toast]);

  const handleStartBreakSubmit = useCallback(async (values: Record<string, unknown>) => {
    const reason = values.reason as string;
    const res = await startBreak(reason);
    if (res.ok) {
      toast({ variant: 'info', title: 'On Break', message: reason ? `Reason: ${reason}` : 'Enjoy your break.' });
      setBreakOpen(false);
    } else {
      toast({ variant: 'error', title: 'Break Failed', message: res.error });
    }
  }, [startBreak, toast]);

  const handleEndBreak = useCallback(async () => {
    const res = await endBreak();
    if (res.ok) {
      toast({ variant: 'success', title: 'Back to Work', message: 'Work session resumed.' });
    } else {
      toast({ variant: 'error', title: 'End Break Failed', message: res.error });
    }
  }, [endBreak, toast]);

  const sampleBatches = [
    { value: 'Christ 3BBA Data Analytics B1', label: 'Christ 3BBA Data Analytics B1' },
    { value: 'SB College MBA Batch 1', label: 'SB College MBA Batch 1' },
    { value: 'MIM 1MBA 2026-27 B1', label: 'MIM 1MBA 2026-27 B1' },
  ];

  return (
    <>
      <Card>
        <SectionHeader title="Attendance Control Panel — Office / Training" />
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
                📍 {locationStr}
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
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {currentStatus === 'clocked_out' && (
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
      <Drawer open={clockInOpen} onClose={() => setClockInOpen(false)} title="Clock In to Work Session">
        <Form initial={{ mode: 'Office', batch: 'Christ 3BBA Data Analytics B1' }} onSubmit={handleClockInSubmit}>
          <SelectField
            name="mode"
            label="Attendance Location Mode"
            options={[
              { value: 'Office', label: 'Office Work' },
              { value: 'Training', label: 'Training Batch Session' },
            ]}
          />
          <SelectField name="batch" label="Select Training Batch (If Training)" options={sampleBatches} />
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-xs)', fontSize: '12px' }}>
            📍 Captured Location: {locationStr}
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setClockInOpen(false)}>Cancel</Button>
            <Button type="submit">Clock In Now</Button>
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

export const TaskWidget = memo(function TaskWidget({
  tasks,
  setTasks,
  onTaskStart,
}: {
  tasks: Array<{ id: string; title: string; project: string; due: string; priority: string; active: boolean; secondsToday: number }>;
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  onTaskStart: (taskTitle: string) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const toggleTaskTimer = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextActive = !t.active;
          if (nextActive) onTaskStart(t.title);
          return { ...t, active: nextActive };
        }
        return { ...t, active: false };
      })
    );
  };

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
      {tasks.map((t, idx) => (
        <div
          key={t.id}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={() => setDraggedIndex(null)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 10px',
            borderBottom: '1px solid var(--border)',
            background: draggedIndex === idx ? 'var(--bg-hover)' : 'transparent',
            borderRadius: 'var(--radius-xs)',
            cursor: 'grab',
            transition: 'background 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: 'var(--text-muted)', cursor: 'grab' }}>⣿</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {t.project} · Due: {t.due} · Logged Today: <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{formatSec(t.secondsToday)}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge tone={t.priority === 'Critical' ? 'danger' : t.priority === 'High' ? 'warning' : 'neutral'}>{t.priority}</Badge>
            <Button
              variant={t.active ? 'secondary' : 'primary'}
              onClick={() => toggleTaskTimer(t.id)}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {t.active ? '⏸ Pause' : '▶ Start'}
            </Button>
          </div>
        </div>
      ))}
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
      <SectionHeader title="Timeline" />
      <Timeline entries={entries} />
    </Card>
  );
});

export const AnnouncementWidget = memo(function AnnouncementWidget() {
  return (
    <Card style={{ borderLeft: '4px solid var(--accent)' }}>
      <SectionHeader title="Announcements Board" />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        📢 <strong>Company Notice:</strong> Training Calendar updated for Q3. Please review your assigned batches under Batches ➔ Training Calendar.
      </div>
    </Card>
  );
});

/** My Day — default employee workspace. */
export function MyDayPage() {
  const { record, loading, clockIn, clockOut, startBreak, endBreak } = useAttendance();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [tasks, setTasks] = useState([
    { id: '1', title: 'Prepare Power BI Syllabus', project: 'Christ College Training', due: 'Today', priority: 'High', active: false, secondsToday: 5400 },
    { id: '2', title: 'Review Voucher Inventory Excel', project: 'Voucher Portal', due: 'Today', priority: 'Critical', active: false, secondsToday: 3600 },
    { id: '3', title: 'Submit Travel Expense Claim', project: 'Internal Operations', due: 'Tomorrow', priority: 'Normal', active: false, secondsToday: 0 },
  ]);

  const [timelineEntries, setTimelineEntries] = useState<Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral' }>>([
    { id: '1', title: 'Clocked in (Office)', time: '08:30 AM', tone: 'success' },
    { id: '2', title: 'Power BI Session Started', time: '10:00 AM', tone: 'progress' },
    { id: '3', title: 'Assessment Review', time: '02:00 PM', tone: 'info' },
  ]);

  const handleTaskStart = (taskTitle: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTimelineEntries((prev) => [
      { id: String(Date.now()), title: `Started: ${taskTitle}`, time: timeStr, tone: 'progress' },
      ...prev,
    ]);
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

      {/* Single Row: Quick Actions on Left, Metrics on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <QuickActionCard icon="✓" label="Add Task" />
          <QuickActionCard icon="₹" label="Submit Expense" />
          <QuickActionCard icon="🗓" label="Request Leave" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Tasks Due" value="3" tone="warning" icon="◧" />
          <StatCard label="Hours of this Month" value="168 hrs" tone="info" icon="⌛" />
          <StatCard label="Attendance %" value="96.2%" tone="success" icon="📈" />
        </div>
      </div>

      <AttendancePanel
        record={record}
        loading={loading}
        clockIn={clockIn}
        clockOut={clockOut}
        startBreak={startBreak}
        endBreak={endBreak}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginTop: 16 }}>
        {/* Left Column: Timeline */}
        <div>
          <TimelineWidget entries={timelineEntries} />
        </div>

        {/* Right Column: Announcements (top) + Task List (bottom) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AnnouncementWidget />
          <TaskWidget tasks={tasks} setTasks={setTasks} onTaskStart={handleTaskStart} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <UpcomingEventsWidget />
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
