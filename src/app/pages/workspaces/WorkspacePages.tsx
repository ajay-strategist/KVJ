import { AppShell } from '../../../shared/layout/AppShell';
import { WorkspaceShell, type WorkspaceRole } from '../../../shared/workspace/WorkspaceShell';
import { DashboardGrid } from '../../../shared/dashboard/dashboard';
import { PageHeader, Card, SectionHeader, StatCard, QuickActionCard, Badge, Timeline, ActivityCard, Button } from '../../../shared/ui/components';
import { useAuth } from '../../../modules/auth/AuthProvider';
import { ROLES } from '../../../shared/permissions/roles';
import { mock } from '../../../shared/mock/factories';
import { BarChart, LineChart } from '../../widgets/demo-widgets';
import { useAttendance } from '../../../modules/attendance/hooks/useAttendance';
import type { AttendanceRecord, WorkSessionType } from '../../../modules/attendance/attendance.repository';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Form, SelectField, TextField } from '../../../shared/forms/form';
import { businessRules } from '../../../config/business-rules';

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

/** My Day — default employee workspace. */
interface AttendanceStatsProps {
  record: AttendanceRecord | null;
}

export const AttendanceStats = memo(function AttendanceStats({ record }: AttendanceStatsProps) {
  const currentStatus = (record?.status ?? 'clocked_out') as keyof typeof statusMap;
  const statusInfo = statusMap[currentStatus];

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (currentStatus === 'present' || currentStatus === 'on_break') {
      const timer = setInterval(() => {
        setNow(Date.now());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentStatus]);

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
  const activeHours = (Math.max(0, totalWorkMs) / 3600000).toFixed(1);

  return (
    <>
      <StatCard label="Attendance Status" value={statusInfo.label} tone={statusInfo.tone} icon="●" />
      <StatCard label="Hours Worked Today" value={`${activeHours} hrs`} icon="◷" />
    </>
  );
});

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

  const currentStatus = (record?.status ?? 'clocked_out') as keyof typeof statusMap;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (currentStatus === 'present' || currentStatus === 'on_break') {
      const timer = setInterval(() => {
        setNow(Date.now());
      }, 1000);
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

  const handleClockInSubmit = useCallback(async (values: Record<string, unknown>) => {
    const type = values.workType as any;
    const res = await clockIn(type);
    if (res.ok) {
      toast({ variant: 'success', title: 'Clocked In', message: `You clocked in for ${type}` });
      setClockInOpen(false);
    } else {
      toast({ variant: 'error', title: 'Clock In Failed', message: res.error });
    }
  }, [clockIn, toast]);

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

  const workTypes = useMemo(() => businessRules.attendance.workTypes.map((t) => ({ value: t, label: t })), []);

  return (
    <>
      <Card>
        <SectionHeader title="Attendance Control Panel" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Compact status card */}
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
              <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                {formatDuration(totalWorkMs)}
              </div>
            </div>
            {(totalBreakMs > 0 || currentStatus === 'on_break') && (
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>Break Duration</div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '4px', fontVariantNumeric: 'tabular-nums', color: 'var(--status-warning)' }}>
                  {formatDuration(totalBreakMs)}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
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
                  transition: 'all 120ms var(--ease-standard)',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#047857'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--e2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--status-success)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--e1)'; }}
              >
                Clock In
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
                    transition: 'all 120ms var(--ease-standard)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#d97706'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--e2)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--status-warning)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--e1)'; }}
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
                    transition: 'all 120ms var(--ease-standard)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--status-danger)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--e2)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--status-danger-bg)'; e.currentTarget.style.color = 'var(--status-danger)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
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
                    transition: 'all 120ms var(--ease-standard)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--brand-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--e2)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--e1)'; }}
                >
                  Break Out (Resume Work)
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
                    transition: 'all 120ms var(--ease-standard)',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--status-danger)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--e2)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--status-danger-bg)'; e.currentTarget.style.color = 'var(--status-danger)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  Clock Out
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Clock In Drawer */}
      <Drawer open={clockInOpen} onClose={() => setClockInOpen(false)} title="Clock In to Work Day">
        <Form initial={{ workType: 'Office' }} onSubmit={handleClockInSubmit}>
          <SelectField name="workType" label="Work Session Type" options={workTypes} />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setClockInOpen(false)}>Cancel</Button>
            <Button type="submit">Clock In</Button>
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

export const TaskWidget = memo(function TaskWidget() {
  const [tasks] = useState(() => mock.tasks(4));
  return (
    <Card>
      <SectionHeader title="Today's tasks" />
      {tasks.map((t) => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.project} · due {t.due}</div>
          </div>
          <Badge tone={t.priority === 'Critical' ? 'danger' : t.priority === 'High' ? 'warning' : 'neutral'}>{t.priority}</Badge>
        </div>
      ))}
    </Card>
  );
});

export const TrainingWidget = memo(function TrainingWidget() {
  const [trainingHoursData] = useState(() => mock.series(['W1', 'W2', 'W3', 'W4', 'W5', 'W6']));
  return (
    <Card>
      <SectionHeader title="Training hours" />
      <BarChart data={trainingHoursData} />
    </Card>
  );
});

export const TimelineWidget = memo(function TimelineWidget() {
  return (
    <Card>
      <SectionHeader title="Timeline" />
      <Timeline entries={[
        { id: '1', title: 'Clocked in', time: '09:32', tone: 'success' },
        { id: '2', title: 'Power BI session', time: '10:00', tone: 'progress' },
        { id: '3', title: 'Assessment review', time: '14:00', tone: 'info' },
      ]} />
    </Card>
  );
});

export const AnnouncementWidget = memo(function AnnouncementWidget() {
  return (
    <Card>
      <SectionHeader title="Announcements" />
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Quarterly town-hall on Friday at 4 PM.</div>
    </Card>
  );
});

/** My Day — default employee workspace. */
export function MyDayPage() {
  const { record, loading, clockIn, clockOut, startBreak, endBreak } = useAttendance();

  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
      <WorkspaceShell role="employee" regions={{
        greeting: <Greeting />,
        quickActions: <>
          <QuickActionCard icon="✓" label="Add Task" />
          <QuickActionCard icon="₹" label="Submit Expense" />
          <QuickActionCard icon="🗓" label="Request Leave" />
        </>,
        stats: <>
          <AttendanceStats record={record} />
          <StatCard label="Tasks due" value="3" tone="warning" icon="◧" />
          <StatCard label="Approvals" value="1" tone="info" icon="⚑" />
        </>,
        primary: <>
          <AttendancePanel
            record={record}
            loading={loading}
            clockIn={clockIn}
            clockOut={clockOut}
            startBreak={startBreak}
            endBreak={endBreak}
          />
          <TaskWidget />
          <TrainingWidget />
        </>,
        side: <>
          <TimelineWidget />
          <AnnouncementWidget />
        </>,
      }} />
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
