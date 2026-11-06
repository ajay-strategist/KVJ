import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/AuthProvider';
import { supabase } from '../integration/supabase';
import { todayISO } from '../utils/date';
import { isRelievedEmployee } from '../../modules/employee/employee.repository';

export interface IdleEmployeeNotice {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  idleMinutes: number;
  clockInTime?: string;
}

/**
 * High-fidelity Web Audio notification chime (Teams/Slack style).
 * Ascending notes (D5 -> A5 -> D6) with warm decay.
 */
export function playTeamsIdleChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const notes = [
      { freq: 587.33, start: 0, dur: 0.12, gain: 0.14 },    // D5
      { freq: 880.0, start: 0.09, dur: 0.12, gain: 0.16 },   // A5
      { freq: 1174.66, start: 0.18, dur: 0.38, gain: 0.18 }, // D6
    ];

    notes.forEach(({ freq, start, dur, gain: maxGain }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.linearRampToValueAtTime(maxGain, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  } catch (e) {
    console.debug('Idle chime audio notice:', e);
  }
}

export function IdleEmployeeAlertPopup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeAlerts, setActiveAlerts] = useState<IdleEmployeeNotice[]>([]);
  const alertedIdsRef = useRef<Set<string>>(new Set());
  const soundPlayedMapRef = useRef<Map<string, number>>(new Map());

  // Only run for Admin, CEO, and Manager roles
  const isAdminOrManager = Boolean(
    user && (user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'MANAGER')
  );

  const checkIdleEmployees = useCallback(async () => {
    if (!isAdminOrManager) return;

    try {
      const todayStr = todayISO();

      // 1. Fetch active employees
      const { data: empsData } = await supabase
        .from('flwdsk_employees')
        .select('id, employee_id, first_name, last_name, designation, status, email')
        .is('deleted_at', null);

      if (!empsData || empsData.length === 0) return;

      const activeEmps = empsData.filter((e) => !isRelievedEmployee(e.status));

      // 2. Fetch today's attendance records
      const { data: attData } = await supabase
        .from('flwdsk_attendance_records')
        .select('*')
        .eq('work_date', todayStr)
        .is('deleted_at', null);

      let finalAttData = attData || [];
      if (!finalAttData.length) {
        const { data: altAttData } = await supabase
          .from('flwdsk_attendance')
          .select('*')
          .eq('work_date', todayStr)
          .is('deleted_at', null);
        if (altAttData) finalAttData = altAttData;
      }

      if (!finalAttData.length) return;

      // 3. Fetch open work sessions & break records in flwdsk_work_sessions & flwdsk_break_records
      const attIds = finalAttData.map((r: any) => r.id).filter(Boolean);
      let openWorkSessions: any[] = [];
      let todayBreaks: any[] = [];
      if (attIds.length > 0) {
        const { data: wsData } = await supabase
          .from('flwdsk_work_sessions')
          .select('id, attendance_record_id, clock_in, clock_out, work_type')
          .in('attendance_record_id', attIds)
          .is('deleted_at', null);

        if (wsData && wsData.length > 0) {
          openWorkSessions = wsData.filter((ws: any) => !ws.clock_out);
          const wsIds = wsData.map((ws: any) => ws.id);
          const wsToAttMap = new Map(wsData.map((w: any) => [w.id, w.attendance_record_id]));
          const attToEmpMap = new Map(finalAttData.map((a: any) => [a.id, a.employee_id]));

          if (wsIds.length > 0) {
            const { data: bData } = await supabase
              .from('flwdsk_break_records')
              .select('*')
              .in('work_session_id', wsIds)
              .is('deleted_at', null);
            if (bData && bData.length > 0) {
              bData.forEach((b: any) => {
                const attId = wsToAttMap.get(b.work_session_id);
                const empId = attId ? attToEmpMap.get(attId) : undefined;
                todayBreaks.push({ ...b, employee_id: empId });
              });
            }
          }
        }

        // Also extract embedded breaks from finalAttData
        finalAttData.forEach((r: any) => {
          if (Array.isArray(r.breaks) && r.breaks.length > 0) {
            r.breaks.forEach((b: any) => {
              todayBreaks.push({
                ...b,
                employee_id: r.employee_id,
                start_time: b.startTime || b.start_time,
                end_time: b.endTime || b.end_time,
              });
            });
          }
        });
      }

      // 4. Fetch today's training calendar sessions
      const { data: calSessions } = await supabase
        .from('flwdsk_calendar_sessions')
        .select('*')
        .eq('date', todayStr)
        .is('deleted_at', null);

      // 5. Fetch running task sessions
      const { data: runningTaskSessions } = await supabase
        .from('flwdsk_task_work_sessions')
        .select('*')
        .eq('status', 'running')
        .is('end_time', null)
        .is('deleted_at', null);

      // 6. Fetch today's finished task sessions (to measure idle start after task end)
      const { data: todayTaskSessions } = await supabase
        .from('flwdsk_task_work_sessions')
        .select('employee_id, end_time, created_at')
        .gte('created_at', `${todayStr}T00:00:00.000Z`)
        .is('deleted_at', null);

      // 7. Fetch approved leaves today
      const { data: leaveToday } = await supabase
        .from('flwdsk_leave_records')
        .select('employee_id')
        .lte('start_date', todayStr)
        .gte('end_date', todayStr)
        .eq('status', 'approved')
        .is('deleted_at', null);

      const onLeaveEmpIds = new Set((leaveToday || []).map((l: any) => l.employee_id));

      // Local timers (if running on this machine)
      const runningTimerTaskIds = new Set<string>();
      try {
        const rawTimers = localStorage.getItem('kvj_task_timers');
        if (rawTimers) {
          const parsed = JSON.parse(rawTimers);
          for (const [id, s] of Object.entries<any>(parsed)) {
            if (s?.isRunning) runningTimerTaskIds.add(id);
          }
        }
      } catch {}

      const now = Date.now();
      const detectedIdle: IdleEmployeeNotice[] = [];

      for (const emp of activeEmps) {
        if (onLeaveEmpIds.has(emp.id)) continue;

        const empId = emp.id;
        const empEmail = emp.email?.toLowerCase();
        const empFullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim().toLowerCase();

        // Match attendance record
        const att = finalAttData.find(
          (r: any) =>
            r.employee_id === empId ||
            (r.employee_email && empEmail && r.employee_email.toLowerCase() === empEmail)
        );

        if (!att || att.status !== 'present') continue;

        // Check if employee is currently on break (either by status or open break record)
        const empBreaks = todayBreaks.filter((b: any) => b.employee_id === empId);
        const hasOpenBreak = empBreaks.some((b: any) => !b.end_time && !b.endTime);
        if (hasOpenBreak || att.status === 'on_break') {
          continue; // Currently on break, NOT idle!
        }

        // Check if employee is in training session:
        // A. Work session with Training work_type
        const matchingAttIds = new Set(
          finalAttData
            .filter(
              (r: any) =>
                r.employee_id === empId ||
                (r.employee_email && empEmail && r.employee_email.toLowerCase() === empEmail)
            )
            .map((r: any) => r.id)
        );
        const activeWs = openWorkSessions.find((ws: any) => matchingAttIds.has(ws.attendance_record_id));
        if (activeWs?.work_type && String(activeWs.work_type).toLowerCase().includes('training')) {
          continue; // Conducting training, NOT idle!
        }

        // B. Embedded sessions
        if (Array.isArray(att.sessions)) {
          const activeSess = att.sessions.find((s: any) => !s.clockOut && !s.clock_out);
          const sessToCheck = activeSess || att.sessions[att.sessions.length - 1];
          if (sessToCheck?.workType && String(sessToCheck.workType).toLowerCase().includes('training')) {
            continue; // Conducting training, NOT idle!
          }
        }
        if (att.work_type && String(att.work_type).toLowerCase().includes('training')) {
          continue;
        }

        // C. Today's calendar session
        const hasCalSession = (calSessions || []).some(
          (cs: any) =>
            cs.trainer_id === empId ||
            (emp.first_name && cs.trainer_name && cs.trainer_name.toLowerCase().includes(emp.first_name.toLowerCase()))
        );
        if (hasCalSession) {
          continue; // Conducting scheduled training, NOT idle!
        }

        // Check if employee has a running task session
        const hasRunningTaskSession = (runningTaskSessions || []).some((s: any) => {
          return (
            s.employee_id === empId ||
            (s.employee_id && empEmail && s.employee_id.toLowerCase() === empEmail) ||
            (s.employee_name && empFullName && s.employee_name.toLowerCase() === empFullName)
          );
        });
        if (hasRunningTaskSession) continue;

        // Calculate idle duration based on active work session clock-in time
        const activeEmbeddedSession = Array.isArray(att.sessions)
          ? att.sessions.find((s: any) => !s.clockOut && !s.clock_out)
          : null;

        const clockInIso =
          activeWs?.clock_in ||
          activeWs?.clockIn ||
          activeEmbeddedSession?.clockIn ||
          activeEmbeddedSession?.clock_in ||
          att.first_clock_in ||
          (att as any).firstClockIn;

        if (!clockInIso) continue;

        let idleStartMs = new Date(clockInIso).getTime();

        // If there was a previous session clocked out today and no activeWs, prevent idle time before re-clocking in
        if (att.last_clock_out || (att as any).lastClockOut) {
          const lastOutMs = new Date(att.last_clock_out || (att as any).lastClockOut).getTime();
          if (!isNaN(lastOutMs) && lastOutMs > idleStartMs) {
            idleStartMs = lastOutMs;
          }
        }

        const finishedEmpSessions = (todayTaskSessions || []).filter(
          (s: any) => s.employee_id === empId && s.end_time
        );
        finishedEmpSessions.forEach((s: any) => {
          const endMs = new Date(s.end_time).getTime();
          if (!isNaN(endMs) && endMs > idleStartMs) {
            idleStartMs = endMs;
          }
        });

        // Cross-check finished breaks: If employee was on break, idle time begins AFTER the break ended!
        empBreaks.forEach((b: any) => {
          const endVal = b.end_time || b.endTime;
          if (endVal) {
            const breakEndMs = new Date(endVal).getTime();
            if (!isNaN(breakEndMs) && breakEndMs > idleStartMs) {
              idleStartMs = breakEndMs;
            }
          }
        });

        // Also check if attendance record was updated after taking a break
        if (att && (att.total_break_minutes > 0 || att.totalBreakMinutes > 0)) {
          const attUpdatedMs = new Date(att.updated_at || (att as any).updatedAt || '').getTime();
          if (!isNaN(attUpdatedMs) && attUpdatedMs > idleStartMs) {
            idleStartMs = attUpdatedMs;
          }
        }

        const idleMinutes = Math.max(0, Math.floor((now - idleStartMs) / (1000 * 60)));

        // Must be idle >= 15 mins
        if (idleMinutes >= 15) {
          // Check if admin recently dismissed this employee's alert
          const dismissKey = `flwdsk_admin_dismissed_idle_${empId}`;
          const lastDismissed = localStorage.getItem(dismissKey);
          if (lastDismissed) {
            const dismissMs = Number(lastDismissed);
            // Snooze dismissal for 30 minutes
            if (!isNaN(dismissMs) && now - dismissMs < 30 * 60 * 1000) {
              continue;
            }
          }

          detectedIdle.push({
            id: empId,
            name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee',
            employeeCode: emp.employee_id || 'EMP',
            designation: emp.designation || 'Team Member',
            idleMinutes,
            clockInTime: clockInIso,
          });
        }
      }

      // Check if there are newly detected idle employees to chime for
      let shouldPlaySound = false;
      const soundThrottleMs = 15 * 60 * 1000; // 15 mins per employee chime

      detectedIdle.forEach((notice) => {
        const lastChimed = soundPlayedMapRef.current.get(notice.id) || 0;
        if (now - lastChimed > soundThrottleMs) {
          shouldPlaySound = true;
          soundPlayedMapRef.current.set(notice.id, now);
        }
      });

      if (shouldPlaySound && detectedIdle.length > 0) {
        playTeamsIdleChime();
      }

      setActiveAlerts(detectedIdle);
    } catch (err) {
      console.warn('Error checking idle employees:', err);
    }
  }, [isAdminOrManager]);

  useEffect(() => {
    if (!isAdminOrManager) return;
    checkIdleEmployees();
    const interval = setInterval(checkIdleEmployees, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [isAdminOrManager, checkIdleEmployees]);

  const handleDismiss = (empId: string) => {
    const now = Date.now();
    localStorage.setItem(`flwdsk_admin_dismissed_idle_${empId}`, String(now));
    setActiveAlerts((prev) => prev.filter((a) => a.id !== empId));
  };

  const handleDismissAll = () => {
    const now = Date.now();
    activeAlerts.forEach((a) => {
      localStorage.setItem(`flwdsk_admin_dismissed_idle_${a.id}`, String(now));
    });
    setActiveAlerts([]);
  };

  const handleViewStatus = (empId: string) => {
    handleDismiss(empId);
    navigate('/app/employees/status');
  };

  if (!isAdminOrManager || activeAlerts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 24,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 390,
        width: 'calc(100vw - 40px)',
        pointerEvents: 'none',
        fontFamily: 'inherit',
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes teamsSlideIn {
          0% {
            opacity: 0;
            transform: translateX(60px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .teams-idle-card {
          animation: teamsSlideIn 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {activeAlerts.slice(0, 3).map((notice) => {
        const initials = notice.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'EM';

        const formattedIdle =
          notice.idleMinutes >= 60
            ? `${Math.floor(notice.idleMinutes / 60)}h ${notice.idleMinutes % 60}m`
            : `${notice.idleMinutes}m`;

        return (
          <div
            key={notice.id}
            className="teams-idle-card"
            style={{
              pointerEvents: 'auto',
              background: 'var(--bg-panel, #ffffff)',
              color: 'var(--text-primary, #1e293b)',
              border: '1px solid var(--border, #e2e8f0)',
              borderLeft: '5px solid #f59e0b',
              borderRadius: 14,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.06)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxSizing: 'border-box',
            }}
          >
            {/* Top Bar: App Tag, Time, Close Icon */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: '#fef3c7',
                    color: '#b45309',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ⚠️
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#b45309',
                  }}
                >
                  Teamz • Idle Alert
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 11 }}>
                  15m+ Idle
                </span>
                <button
                  type="button"
                  onClick={() => handleDismiss(notice.id)}
                  aria-label="Dismiss idle notification"
                  title="Dismiss notification"
                  style={{
                    border: 'none',
                    background: 'rgba(0, 0, 0, 0.05)',
                    color: 'var(--text-secondary, #64748b)',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                    transition: 'all 140ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Middle Bar: Avatar & Content */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {initials}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    border: '2px solid #ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                  title="Idle status"
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--text-primary, #0f172a)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {notice.name}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--text-muted, #94a3b8)',
                      marginLeft: 6,
                    }}
                  >
                    ({notice.employeeCode})
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary, #475569)',
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>No active task in progress</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '1px 6px',
                      background: '#fef3c7',
                      color: '#b45309',
                      borderRadius: 4,
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    ⏱️ {formattedIdle} idle
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions: View Status & Dismiss */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 2,
                paddingTop: 8,
                borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              }}
            >
              <button
                type="button"
                onClick={() => handleDismiss(notice.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary, #64748b)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '5px 10px',
                  borderRadius: 6,
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={() => handleViewStatus(notice.id)}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '5px 12px',
                  borderRadius: 6,
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                View Status →
              </button>
            </div>
          </div>
        );
      })}

      {activeAlerts.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={handleDismissAll}
            style={{
              background: 'var(--bg-panel, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              color: 'var(--text-secondary, #64748b)',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 12px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            Dismiss All ({activeAlerts.length})
          </button>
        </div>
      )}
    </div>
  );
}
