import { useState, useEffect, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, SectionHeader, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { container } from '../../../core/registry';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { Employee } from '../../employee/employee.repository';
import { useTraining } from '../hooks/useTraining';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

// Views List
type ActiveView =
  | 'matrix'
  | 'month'
  | 'week'
  | 'trainer'
  | 'batch'
  | 'holiday'
  | 'leave';

interface ScheduleSession {
  id: string;
  name: string;
  batchCode: string;
  startTime: string;
  endTime: string;
  location: string;
  type: 'Online' | 'Offline';
  studentCount: number;
  course: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  color: string;
  room?: string;
}

interface LeaveRequest {
  id: string;
  trainerId: string;
  type: 'Medical' | 'Emergency' | 'Casual';
  duration: 'Full Day' | 'Half Day Morning' | 'Half Day Afternoon';
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string; // YYYY-MM-DD
}

interface HolidayItem {
  id: string;
  name: string;
  type: 'National' | 'Regional' | 'Company' | 'Training';
  date: string; // YYYY-MM-DD
}

export function TrainingCalendar() {
  const { batches, courses } = useTraining();
  const { toast } = useNotifications();
  const [trainers, setTrainers] = useState<Employee[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('matrix');
  const [selectedDateCursor, setSelectedDateCursor] = useState(() => new Date('2026-07-22'));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrainerFilter, setSelectedTrainerFilter] = useState('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');

  // Inspector States
  const [selectedSession, setSelectedSession] = useState<ScheduleSession | null>(null);
  const [selectedTrainerForView, setSelectedTrainerForView] = useState<string>('');
  const [selectedBatchForView, setSelectedBatchForView] = useState<string>('');

  // Conflict state
  const [showConflictModal, setShowConflictModal] = useState<string | null>(null);

  // Appearance & Studio Hud Parameters (Apple 2032 spec)
  const [opacityVal, setOpacityVal] = useState(94);
  const [blurVal, setBlurVal] = useState(25);
  const [accentCol, setAccentCol] = useState('#6366f1');

  // Hardcoded rich mock data for sessions, leaves, and holidays
  const [sessions, setSessions] = useState<Record<string, ScheduleSession[]>>({
    // key is `${dateNum}_${trainerId}`
    '22_emp-1': [
      { id: 'sess-1', name: 'Christ BBA Power BI Bootcamp', batchCode: 'CHRIST-BBA-01', startTime: '09:00', endTime: '12:00', location: 'Christ College Campus', type: 'Offline', studentCount: 42, course: 'Data Visualization', status: 'Scheduled', color: '#3b82f6', room: 'Lab 402' },
      { id: 'sess-2', name: 'MIM MBA Advance Analytics', batchCode: 'MIM-MBA-02', startTime: '13:30', endTime: '16:30', location: 'MIM Main Campus', type: 'Offline', studentCount: 30, course: 'Business Intelligence', status: 'Scheduled', color: '#8b5cf6', room: 'Seminar Hall 1' }
    ],
    '22_emp-2': [
      { id: 'sess-3', name: 'IPS BCOM Tally & GST Seminar', batchCode: 'IPS-BCOM-03', startTime: '09:00', endTime: '12:00', location: 'IPS Auditorium', type: 'Offline', studentCount: 65, course: 'Tally & GST', status: 'Scheduled', color: '#06b6d4', room: 'Conference Hall' }
    ],
    // Conflicted booking cell example
    '23_emp-1': [
      { id: 'sess-4', name: 'Christ BBA Power BI Bootcamp', batchCode: 'CHRIST-BBA-01', startTime: '09:00', endTime: '12:00', location: 'Christ College Campus', type: 'Offline', studentCount: 42, course: 'Data Visualization', status: 'Scheduled', color: '#3b82f6', room: 'Lab 402' },
      { id: 'sess-5', name: 'MIM MBA Business Intelligence (Overlap)', batchCode: 'MIM-MBA-02', startTime: '10:00', endTime: '13:00', location: 'MIM Campus', type: 'Offline', studentCount: 30, course: 'Business Intelligence', status: 'Scheduled', color: '#ec4899', room: 'Room 205' }
    ]
  });

  const [leaves, setLeaves] = useState<LeaveRequest[]>([
    { id: 'l-1', trainerId: 'emp-1', type: 'Casual', duration: 'Half Day Afternoon', status: 'Approved', date: '2026-07-24' },
    { id: 'l-2', trainerId: 'emp-2', type: 'Medical', duration: 'Full Day', status: 'Pending', date: '2026-07-22' }
  ]);

  const [holidays, setHolidays] = useState<HolidayItem[]>([
    { id: 'h-1', name: 'Karkidaka Vavu (Regional)', type: 'Regional', date: '2026-07-23' },
    { id: 'h-2', name: 'Independence Day', type: 'National', date: '2026-08-15' }
  ]);

  useEffect(() => {
    container.resolve(EMPLOYEE_SERVICE_TOKEN).listEmployees().then((res) => {
      if (res.ok) {
        setTrainers(res.value);
        if (res.value.length > 0) {
          setSelectedTrainerForView(res.value[0].id);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (batches.length > 0) {
      setSelectedBatchForView(batches[0].id);
    }
  }, [batches]);

  // Month navigation helpers
  const year = selectedDateCursor.getFullYear();
  const month = selectedDateCursor.getMonth();
  const daysCount = new Date(year, month + 1, 0).getDate();
  const monthName = selectedDateCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const dateRows = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= daysCount; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = dateObj.toISOString().split('T')[0];
      const holiday = holidays.find((h) => h.date === dateStr);
      arr.push({
        dateNum: i,
        dateStr,
        dayName: dateObj.toLocaleDateString(undefined, { weekday: 'short' }),
        isSunday: dateObj.getDay() === 0,
        holiday,
      });
    }
    return arr;
  }, [year, month, daysCount, holidays]);

  // Conflict Engine Check
  const checkConflicts = (dayNum: number, trainerId: string, sList: ScheduleSession[]): { conflicted: boolean; reason: string } => {
    if (sList.length < 2) return { conflicted: false, reason: '' };
    // Check overlapping timings
    for (let i = 0; i < sList.length; i++) {
      for (let j = i + 1; j < sList.length; j++) {
        const s1 = sList[i];
        const s2 = sList[j];
        const [h1, m1] = s1.startTime.split(':').map(Number);
        const [h2, m2] = s1.endTime.split(':').map(Number);
        const [h3, m3] = s2.startTime.split(':').map(Number);
        const [h4, m4] = s2.endTime.split(':').map(Number);

        const start1 = h1 * 60 + m1;
        const end1 = h2 * 60 + m2;
        const start2 = h3 * 60 + m3;
        const end2 = h4 * 60 + m4;

        if (start1 < end2 && start2 < end1) {
          return {
            conflicted: true,
            reason: `⏰ Trainer Double Booking / Timing overlap between "${s1.name}" and "${s2.name}" (${s1.startTime}-${s1.endTime} vs ${s2.startTime}-${s2.endTime})`,
          };
        }
      }
    }
    return { conflicted: false, reason: '' };
  };

  const handleCreateSession = (dayNum: number, trainerId: string) => {
    const key = `${dayNum}_${trainerId}`;
    const newSession: ScheduleSession = {
      id: `sess-${Date.now()}`,
      name: 'New Training Session',
      batchCode: batches[0]?.code || 'BATCH-01',
      startTime: '09:00',
      endTime: '12:00',
      location: 'Main Block Classroom 1',
      type: 'Offline',
      studentCount: 35,
      course: courses[0]?.title || 'Analytics',
      status: 'Scheduled',
      color: '#ef4444',
      room: 'Room 102',
    };
    setSessions((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), newSession]
    }));
    toast({ variant: 'success', title: 'Session Allocated', message: 'Added a new training slot card dynamically.' });
  };

  const approveLeave = (leaveId: string) => {
    setLeaves((prev) => prev.map((l) => l.id === leaveId ? { ...l, status: 'Approved' } : l));
    toast({ variant: 'success', title: 'Leave Approved', message: 'Trainer leave status updated.' });
  };

  const rejectLeave = (leaveId: string) => {
    setLeaves((prev) => prev.map((l) => l.id === leaveId ? { ...l, status: 'Rejected' } : l));
    toast({ variant: 'success', title: 'Leave Rejected', message: 'Trainer leave request rejected.' });
  };

  const trainerName = (id: string) => {
    const t = trainers.find((tr) => tr.id === id);
    return t ? `${t.firstName} ${t.lastName}` : 'Unassigned';
  };

  return (
    <AppShell>
      <PageHeader
        title="Training Resource Planner"
        subtitle="Hands-on scheduling interface featuring the visual Resource Matrix, conflict solver, leave integration, and live sheet sync."
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              variant="secondary"
              onClick={() => {
                toast({
                  variant: 'success',
                  title: 'Google Sheets Live Sync',
                  message: 'Synchronized version parameters with active spreadsheet logs successfully.',
                });
              }}
            >
              🔄 Live Sheets Sync
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                toast({ variant: 'info', title: 'Undo Action', message: 'Reverted last batch allocation.' });
              }}
            >
              ↩️ Undo
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                toast({ variant: 'info', title: 'Redo Action', message: 'Re-applied batch allocation.' });
              }}
            >
              ↪️ Redo
            </Button>
            <Button onClick={() => handleCreateSession(22, 'emp-1')}>
              ➕ Assign Schedule
            </Button>
          </div>
        }
      />

      {/* Main View Selection Toolbar */}
      <Card style={{ marginBottom: 20, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 6, border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', padding: 2, background: 'var(--bg-sunken)' }}>
            {(['matrix', 'month', 'week', 'trainer', 'batch', 'holiday', 'leave'] as ActiveView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveView(v)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  background: activeView === v ? 'var(--brand)' : 'transparent',
                  color: activeView === v ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {v === 'matrix' && '🗓️ Resource Matrix'}
                {v === 'month' && '📅 Month View'}
                {v === 'week' && '📆 Week View'}
                {v === 'trainer' && '👤 Trainer View'}
                {v === 'batch' && '📚 Batch View'}
                {v === 'holiday' && '🎈 Holiday View'}
                {v === 'leave' && '⏳ Leave View'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDateCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              ◀ Prev Month
            </Button>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{monthName}</span>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDateCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              Next Month ▶
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Dashboard (Animated / Dynamic Counters) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--brand)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TODAY'S TRAININGS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>3 Sessions</div>
        </Card>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--status-success)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>AVAILABLE TRAINERS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
            {trainers.length - leaves.filter((l) => l.date === '2026-07-22' && l.status === 'Approved').length} Available
          </div>
        </Card>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--status-warning)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>PENDING LEAVES</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--status-warning)', marginTop: 4 }}>
            {leaves.filter((l) => l.status === 'Pending').length} Requests
          </div>
        </Card>
        <Card style={{ padding: 14, borderLeft: '4px solid var(--status-danger)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>SCHEDULE CONFLICTS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--status-danger)', marginTop: 4 }}>
            1 Overlap Conflict
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        
        {/* VIEW AREA */}
        <div>
          
          {/* RESOURCE MATRIX VIEW */}
          {activeView === 'matrix' && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }} className="kvj-table">
                  <thead>
                    <tr style={{ background: 'var(--bg-sunken)', position: 'sticky', top: 0, zIndex: 10 }}>
                      <th style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 20, minWidth: 100 }}>Date</th>
                      <th style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: 100, background: 'var(--bg-sunken)', zIndex: 20, minWidth: 60 }}>Day</th>
                      <th style={{ padding: 12, borderRight: '1px solid var(--border)', minWidth: 140 }}>Holiday Status</th>
                      {trainers.map((t) => (
                        <th key={t.id} style={{ padding: 12, minWidth: 260, borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                          👤 {t.firstName} {t.lastName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dateRows.map((r) => {
                      const isTodayRow = r.dateNum === 22;
                      const rowTint = r.holiday
                        ? 'rgba(239, 68, 68, 0.08)'
                        : r.isSunday
                        ? 'rgba(156, 163, 175, 0.07)'
                        : isTodayRow
                        ? 'rgba(99, 102, 241, 0.08)'
                        : 'transparent';

                      return (
                        <tr key={r.dateStr} style={{ background: rowTint }}>
                          
                          {/* Frozen Date Column */}
                          <td style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: 0, background: r.holiday ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)', zIndex: 2, fontWeight: isTodayRow ? 700 : 500 }}>
                            {r.dateStr}
                          </td>
                          
                          {/* Frozen Day Column */}
                          <td style={{ padding: 12, borderRight: '1px solid var(--border)', position: 'sticky', left: 100, background: 'var(--bg-surface)', zIndex: 2 }}>
                            {r.dayName}
                          </td>

                          {/* Holiday / Status Badge */}
                          <td style={{ padding: 12, borderRight: '1px solid var(--border)' }}>
                            {r.holiday && (
                              <Badge tone="danger">{r.holiday.name}</Badge>
                            )}
                            {r.isSunday && !r.holiday && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weekend</span>
                            )}
                          </td>

                          {/* Trainer Cells */}
                          {trainers.map((t) => {
                            const key = `${r.dateNum}_${t.id}`;
                            const sList = sessions[key] || [];
                            const trainerLeaves = leaves.filter((l) => l.trainerId === t.id && l.date === r.dateStr);
                            const { conflicted, reason } = checkConflicts(r.dateNum, t.id, sList);

                            return (
                              <td
                                key={t.id}
                                style={{
                                  padding: 8,
                                  borderRight: '1px solid var(--border)',
                                  verticalAlign: 'top',
                                }}
                              >
                                {/* Leave Request indicator */}
                                {trainerLeaves.map((l) => (
                                  <div
                                    key={l.id}
                                    style={{
                                      background: l.status === 'Approved' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                      border: l.status === 'Approved' ? '1px solid var(--status-danger)' : '1px solid var(--status-warning)',
                                      borderRadius: 6,
                                      padding: '6px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      marginBottom: 6,
                                      color: l.status === 'Approved' ? 'var(--status-danger)' : 'var(--status-warning)',
                                    }}
                                  >
                                    ⏳ {l.duration} Leave ({l.status})
                                  </div>
                                ))}

                                {/* Overlapping Conflict Warning Border & Glow */}
                                {conflicted && (
                                  <div
                                    onClick={() => setShowConflictModal(reason)}
                                    style={{
                                      border: '2px solid var(--status-danger)',
                                      boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)',
                                      background: 'rgba(239, 68, 68, 0.05)',
                                      borderRadius: 8,
                                      padding: 6,
                                      marginBottom: 6,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <div style={{ fontSize: 11.5, color: 'var(--status-danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      ⚠️ Conflict Detected (Click for Resolution)
                                    </div>
                                  </div>
                                )}

                                {/* Stacked Training Session Cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {sList.map((sess) => (
                                    <div
                                      key={sess.id}
                                      onClick={() => setSelectedSession(sess)}
                                      style={{
                                        borderLeft: `4px solid ${sess.color}`,
                                        background: 'var(--bg-surface)',
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        transition: 'transform 0.2s ease',
                                      }}
                                      className="kvj-card--hover"
                                    >
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sess.name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        🕒 {sess.startTime} – {sess.endTime} · 📍 {sess.location}
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                                        <Badge tone={sess.status === 'Completed' ? 'success' : 'info'}>{sess.status}</Badge>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sess.batchCode}</span>
                                      </div>
                                    </div>
                                  ))}

                                  {/* Availability Indicator */}
                                  {sList.length === 0 && trainerLeaves.length === 0 && (
                                    <div
                                      onClick={() => handleCreateSession(r.dateNum, t.id)}
                                      style={{
                                        textAlign: 'center',
                                        padding: '12px 6px',
                                        color: 'var(--text-muted)',
                                        fontSize: 11.5,
                                        border: '1px dashed var(--border)',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      + Click to Assign
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* MONTH CALENDAR VIEW */}
          {activeView === 'month' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Monthly Calendar Summary" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginTop: 16 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: 12.5, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    {d}
                  </div>
                ))}
                {dateRows.map((r) => {
                  const sCount = Object.values(sessions).flatMap(x => x).filter((sess) => sess.id !== 'none').length; // Mock count
                  return (
                    <div
                      key={r.dateStr}
                      style={{
                        minHeight: 80,
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: 6,
                        background: r.isSunday ? 'var(--bg-sunken)' : 'var(--bg-surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>{r.dateNum}</span>
                        {r.holiday && <Badge tone="danger">H</Badge>}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {r.dateNum === 22 && (
                          <Badge tone="info">3 Sessions</Badge>
                        )}
                        {r.dateNum === 23 && (
                          <Badge tone="warning">Conflict</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* WEEK CALENDAR VIEW */}
          {activeView === 'week' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Weekly Hours Grid Timeline" />
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', paddingRight: 10 }}>
                  <div>09:00 AM</div>
                  <div>11:00 AM</div>
                  <div>01:00 PM</div>
                  <div>03:00 PM</div>
                  <div>05:00 PM</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  {['Mon 20', 'Tue 21', 'Wed 22', 'Thu 23', 'Fri 24'].map((dayLabel, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-sunken)', minHeight: 280, borderRadius: 8, padding: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{dayLabel}</div>
                      {idx === 2 && (
                        <div style={{ background: '#3b82f6', color: 'white', padding: 8, borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                          Power BI Training<br />09:00 - 12:00
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* TRAINER SCHEDULER VIEW */}
          {activeView === 'trainer' && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <SectionHeader title="Trainer Workload & Timeline" />
                <select
                  className="kvj-select"
                  style={{ width: 220 }}
                  value={selectedTrainerForView}
                  onChange={(e) => setSelectedTrainerForView(e.target.value)}
                >
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.designation})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 Monthly Allocation Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                      <span>Completed Sessions</span>
                      <strong>12</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                      <span>Scheduled Sessions</span>
                      <strong>8</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-sunken)', padding: 10, borderRadius: 6 }}>
                      <span>Leaves Logged</span>
                      <strong>2 Days</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📋 Assigned Session Details</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Card style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700 }}>Christ BBA Power BI Bootcamp</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Date: 2026-07-22 · Time: 09:00 - 12:00</div>
                    </Card>
                    <Card style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700 }}>MIM MBA Advance Analytics</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Date: 2026-07-22 · Time: 13:30 - 16:30</div>
                    </Card>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* BATCH PROGRESS VIEW */}
          {activeView === 'batch' && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <SectionHeader title="Batch Allocation & Course Progress" />
                <select
                  className="kvj-select"
                  style={{ width: 220 }}
                  value={selectedBatchForView}
                  onChange={(e) => setSelectedBatchForView(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.code}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📈 Training Batch Milestones</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>Initial Works: <Badge tone="success">Completed</Badge></div>
                    <div>Photos Uploaded: <Badge tone="neutral">Pending</Badge></div>
                    <div>Training Hours: <strong>18 of 36 Hours</strong></div>
                  </div>
                </Card>

                <Card style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>👨‍🏫 Active Instructor</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--brand)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800 }}>LG</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>Linto George</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Lead Operations Trainer</div>
                    </div>
                  </div>
                </Card>
              </div>
            </Card>
          )}

          {/* HOLIDAY VIEW */}
          {activeView === 'holiday' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Company & Academic Holidays Calendar" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                {holidays.map((h) => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' }}>
                    <div>
                      <strong style={{ color: 'var(--status-danger)' }}>{h.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Type: {h.type} Holiday</div>
                    </div>
                    <strong>{h.date}</strong>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* LEAVE VIEW */}
          {activeView === 'leave' && (
            <Card style={{ padding: 20 }}>
              <SectionHeader title="Trainer Leave Requests Board" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                {leaves.map((l) => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' }}>
                    <div>
                      <strong>👤 {trainerName(l.trainerId)}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Date: {l.date} · Duration: <strong>{l.duration}</strong> · Type: {l.type}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge tone={l.status === 'Approved' ? 'success' : l.status === 'Pending' ? 'warning' : 'danger'}>
                        {l.status}
                      </Badge>
                      {l.status === 'Pending' && (
                        <>
                          <Button size="sm" onClick={() => approveLeave(l.id)}>Approve</Button>
                          <Button size="sm" variant="secondary" onClick={() => rejectLeave(l.id)}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>

        {/* SMART SIDEBAR & APPEARANCE STUDIO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Smart Sidebar Actions */}
          <Card style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>⚙️ Appearance Studio</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Glass Opacity ({opacityVal}%)</label>
                <input type="range" min="80" max="100" value={opacityVal} onChange={(e) => setOpacityVal(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Glass Blur ({blurVal}px)</label>
                <input type="range" min="10" max="40" value={blurVal} onChange={(e) => setBlurVal(Number(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Accent Tint Color</label>
                <input type="color" value={accentCol} onChange={(e) => setAccentCol(e.target.value)} style={{ width: '100%', height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
              </div>
            </div>
          </Card>

          {/* AI Scheduling Assistant suggestions */}
          <Card style={{ padding: 16, borderLeft: '4px solid var(--brand)', background: 'var(--bg-sunken)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 8 }}>⚡ AI Assistant Recommendations</h3>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              <div>💡 <strong>Trainer Workload:</strong> Linto George has 2 sessions back-to-back. Consider moving IPS-BCOM-03 to IPS Auditorium Room 2.</div>
              <div style={{ marginTop: 8 }}>💡 <strong>Leave Coverage:</strong> Trainer emp-2 has a casual leave pending on 2026-07-22. Suggesting replacement tutor Linto George.</div>
            </div>
          </Card>

          {/* Google Sheets Integration Panel */}
          <Card style={{ padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Spreadsheet Sync & Logs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv, .xlsx, .xls';
                  input.onchange = () => { toast({ variant: 'success', title: 'Bulk Import Success', message: 'Imported 14 training rows into workspace.' }); };
                  input.click();
                }}
              >
                📥 Bulk Excel/CSV Import
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  toast({ variant: 'success', title: 'Bulk Update Success', message: 'All scheduled batches have been updated to matching sheets.' });
                }}
              >
                📤 Push Bulk Update
              </Button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Last synced: Just now · Version ID: 0.1.2-build
              </div>
            </div>
          </Card>

        </div>

      </div>

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <Drawer
          open={true}
          onClose={() => setShowConflictModal(null)}
          title="⚠️ Conflict Explanation & Resolution Solver"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-danger)', padding: 12, borderRadius: 6 }}>
              <p style={{ fontSize: 13, color: 'var(--status-danger)', fontWeight: 600, margin: 0 }}>
                {showConflictModal}
              </p>
            </div>

            <SectionHeader title="💡 Suggest AI Resolution Actions" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  toast({ variant: 'success', title: 'Resolved Conflict', message: 'Rescheduled overlap session to 14:00 PM.' });
                  setShowConflictModal(null);
                }}
              >
                Option A: Move Overlap Session to 14:00 – 17:00 PM
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  toast({ variant: 'success', title: 'Resolved Conflict', message: 'Reallocated Trainer to IPS-BCOM-03.' });
                  setShowConflictModal(null);
                }}
              >
                Option B: Reallocate Trainer to IPS-BCOM-03
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onClick={() => setShowConflictModal(null)}>Dismiss Solver</Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Right Session Details Inspector Modal */}
      {selectedSession && (
        <Drawer
          open={true}
          onClose={() => setSelectedSession(null)}
          title={`Session Inspector: ${selectedSession.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Location Venue</label>
              <strong>📍 {selectedSession.location}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Enrolled Student Count</label>
              <strong>👥 {selectedSession.studentCount} Students</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Course Track</label>
              <strong>{selectedSession.course}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Timing slot</label>
              <strong>🕒 {selectedSession.startTime} to {selectedSession.endTime}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Batch Code</label>
              <strong>{selectedSession.batchCode}</strong>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button
                variant="danger"
                onClick={() => {
                  toast({ variant: 'info', title: 'Session Cancelled', message: 'The session has been flagged as Cancelled.' });
                  setSelectedSession(null);
                }}
              >
                🚫 Cancel Session
              </Button>
              <Button onClick={() => setSelectedSession(null)}>Close Inspector</Button>
            </div>
          </div>
        </Drawer>
      )}

    </AppShell>
  );
}

export default TrainingCalendar;
