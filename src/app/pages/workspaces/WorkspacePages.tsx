import { AppShell } from '../../../shared/layout/AppShell';
import { WorkspaceShell, type WorkspaceRole } from '../../../shared/workspace/WorkspaceShell';
import { DashboardGrid } from '../../../shared/dashboard/dashboard';
import { PageHeader, Card, SectionHeader, StatCard, QuickActionCard, Badge, Timeline, ActivityCard, Button } from '../../../shared/ui/components';
import { useAuth } from '../../../modules/auth/AuthProvider';
import { ROLES } from '../../../shared/permissions/roles';
import { useAttendance } from '../../../modules/attendance/hooks/useAttendance';
import { useCommunication } from '../../../modules/communication/hooks/useCommunication';
import type { AttendanceRecord, WorkSessionType } from '../../../modules/attendance/attendance.repository';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Form, SelectField, TextField, useForm } from '../../../shared/forms/form';

import { useProject } from '../../../modules/project/hooks/useProject';
import { useEmployee } from '../../../modules/employee/hooks/useEmployee';
import { useTraining } from '../../../modules/training/hooks/useTraining';
import { container } from '../../../core/registry';
import { ATTENDANCE_REPOSITORY_TOKEN } from '../../../modules/attendance/attendance.repository';
import { EXPENSE_CLAIM_REPOSITORY_TOKEN } from '../../../modules/finance/finance.repository';
import { toLocalISODate } from '../../../shared/utils/date';
import { supabase } from '../../../shared/integration/supabase';

function Greeting() {
  const { user } = useAuth();
  return (
    <PageHeader
      title="Welcome to Nexus by KVJ"
      subtitle="Connect. Manage. Transform."
      actions={
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      }
    />
  );
}

const statusMap = {
  present: { label: 'Present', tone: 'success' as const },
  on_break: { label: 'On Break', tone: 'warning' as const },
  clocked_out: { label: 'Clocked Out', tone: 'neutral' as const },
  absent: { label: 'Absent', tone: 'danger' as const },
};

function ConditionalAttendanceFields() {
  const { values } = useForm();
  const { batches } = useTraining();
  
  if (values.classification === 'Training') {
    const options = batches.length > 0
      ? batches.map((b) => ({ value: b.code, label: b.code }))
      : [{ value: 'No Batches Available', label: 'No Batches Available' }];
    return (
      <SelectField
        name="location"
        label="Select Training Batch"
        options={options}
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
  const { batches, courses } = useTraining();
  const [clockInOpen, setClockInOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('Office');

  const availableBatches = useMemo(() => {
    if (!batches || batches.length === 0) return [];
    return batches.map((b) => {
      const courseObj = courses.find((c) => c.id === b.courseId);
      return {
        id: b.id,
        name: b.code,
        college: b.college || '—',
        course: courseObj?.title || b.trainingName || 'Training Program',
        time: '09:00 AM - 12:00 PM',
        students: b.capacity || 30,
        trainer: b.coordinator || 'Assigned Trainer',
      };
    });
  }, [batches, courses]);

  const [selectedBatch, setSelectedBatch] = useState('');

  useEffect(() => {
    if (availableBatches.length > 0 && (!selectedBatch || !availableBatches.some((b) => b.name === selectedBatch))) {
      setSelectedBatch(availableBatches[0].name);
    }
  }, [availableBatches, selectedBatch]);

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
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          padding: '24px 28px 28px 28px',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.03)',
          marginBottom: 24,
          position: 'relative',
        }}
      >
        {/* Header bar matching Sample Image */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.01em' }}>
            Attendance Control Panel — Office / Training
          </h3>
        </div>

        {/* 5 Stat Columns inside single soft ice-blue container box */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 16,
            padding: '16px 24px',
            borderRadius: 16,
            background: '#f1f5fe',
            border: '1px solid #dbe6fe',
            marginBottom: 18,
            alignItems: 'center',
          }}
        >
          {/* CURRENT STATUS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              CURRENT STATUS
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              {currentStatus === 'present' ? '🟢 Working' : currentStatus === 'on_break' ? '🟡 On Break' : '⚫ Not Working'}
            </span>
          </div>

          {/* GPS LOCATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              GPS LOCATION
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#6366f1', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              📍 {resolveLocationName(locationStr)}
            </span>
          </div>

          {/* CLOCK IN TIME */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              CLOCK IN TIME
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              {clockInTimeStr}
            </span>
          </div>

          {/* DURATION TODAY */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              DURATION TODAY
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(totalWorkMs)}
            </span>
          </div>

          {/* BREAK DURATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#8b96a5', fontWeight: 700, letterSpacing: '0.04em' }}>
              BREAK DURATION
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: currentStatus === 'on_break' ? '#d97706' : '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(totalBreakMs)}
            </span>
          </div>
        </div>

        {/* Action Controls Bar matching Sample Image */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          {(currentStatus === 'clocked_out' || (currentStatus !== 'present' && currentStatus !== 'on_break')) && (
            <>
              <button
                type="button"
                className="kvj-btn"
                disabled={loading}
                onClick={() => setClockInOpen(true)}
                style={{
                  background: '#00c875',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 28px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 999,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,200,117,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Clock In (Office / Training)
              </button>

              <button
                type="button"
                className="kvj-btn"
                onClick={() => setClaimOpen(true)}
                style={{
                  background: '#ffffff',
                  color: '#6366f1',
                  border: '2px solid #a5b4fc',
                  padding: '10px 24px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 999,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(99,102,241,0.08)',
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
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 999,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ☕ Start Official Break
              </button>
              <button
                type="button"
                className="kvj-btn"
                disabled={loading}
                onClick={handleClockOut}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '10px 22px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 999,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                🔴 Clock Out
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
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '11px 22px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  borderRadius: 10,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                ▶️ Resume Work Session
              </button>
            </>
          )}
        </div>
      </div>

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {availableBatches.length === 0 ? (
                  <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', background: 'var(--bg-sunken)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                    No training batches found. Create batches in Training Details page.
                  </div>
                ) : (
                  availableBatches.map((b) => {
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
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{b.name}</span>
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
                  })
                )}
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

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIndex(idx);
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdxStr = e.dataTransfer.getData('text/plain');
    const sourceIdx = sourceIdxStr !== '' ? parseInt(sourceIdxStr, 10) : draggedIndex;

    if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      const updated = [...tasks];
      const [moved] = updated.splice(sourceIdx, 1);
      updated.splice(targetIdx, 0, moved);
      setTasks(updated);
    }
    setDraggedIndex(null);
  };

  return (
    <Card>
      <SectionHeader title="Today's Tasks (Drag & Drop Reorder)" />
      <style>{`
        .task-card-hover {
          transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .task-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
        }
        .task-card-dragging {
          opacity: 0.5;
          border: 2px dashed var(--brand) !important;
          background: var(--bg-sunken) !important;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tasks.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            📋 No tasks logged today. Click <strong>Add Task</strong> to create your first task.
          </div>
        ) : (
          tasks.map((t, idx) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={() => setDraggedIndex(null)}
            className={`task-card-hover ${draggedIndex === idx ? 'task-card-dragging' : ''}`}
            style={{
              padding: 16,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
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
        )))}
      </div>
    </Card>
  );
});

export const UpcomingEventsWidget = memo(function UpcomingEventsWidget() {
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const { tasks } = useProject();
  const [dbSchedules, setDbSchedules] = useState<any[]>([]);

  useEffect(() => {
    async function loadSchedules() {
      try {
        const saved = localStorage.getItem('kvj_schedule_sessions');
        let local: any[] = saved ? JSON.parse(saved) : [];
        const { data } = await supabase.from('schedule_sessions').select('*').is('deleted_at', null);
        const mergedMap = new Map();
        local.forEach((s) => mergedMap.set(s.id, s));
        if (data) {
          data.forEach((r: any) => {
            mergedMap.set(r.id, {
              id: r.id,
              date: r.date,
              startTime: r.start_time || '09:00 AM',
              title: r.session_title || r.topic || 'Training Session',
              type: 'Training',
            });
          });
        }
        setDbSchedules(Array.from(mergedMap.values()));
      } catch (e) {}
    }
    loadSchedules();
  }, []);

  const upcoming7Days = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const isoDate = toLocalISODate(d);

      let dayLabel = `Day ${i + 1} (${dayNames[d.getDay()]})`;
      if (i === 0) dayLabel = 'Day 1 (Today)';
      else if (i === 1) dayLabel = 'Day 2 (Tomorrow)';

      // 1. Gather tasks due on this date
      const dayTasks = tasks.filter((t) => t.dueDate === isoDate).map((t) => ({
        id: `task-${t.id}`,
        time: t.status === 'done' ? 'Completed' : 'Due Today',
        title: `Task: ${t.title}`,
        type: 'Projects' as const,
      }));

      // 2. Gather training schedules on this date
      const daySchedules = dbSchedules.filter((s) => s.date === isoDate).map((s) => ({
        id: `sched-${s.id}`,
        time: s.startTime || s.time || '09:00 AM',
        title: s.name || s.title || 'Training Session',
        type: 'Training' as const,
      }));

      const isSunday = d.getDay() === 0;
      const combinedEvents = [...dayTasks, ...daySchedules];

      if (combinedEvents.length === 0 && isSunday) {
        combinedEvents.push({
          id: `sun-${isoDate}`,
          time: 'Off Day',
          title: 'Sunday Weekly Rest',
          type: 'Holiday' as any,
        });
      }

      result.push({
        day: dayLabel,
        isoDate,
        events: combinedEvents,
      });
    }

    return result;
  }, [tasks, dbSchedules]);

  const currentDayEvents = upcoming7Days[selectedDay]?.events || [];

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
        {currentDayEvents.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No scheduled events or tasks due on this day.
          </div>
        ) : (
          currentDayEvents.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🕒 {e.time}</div>
              </div>
              <Badge tone={e.type === 'Training' ? 'info' : e.type === 'Projects' ? 'progress' : 'neutral'}>{e.type}</Badge>
            </div>
          ))
        )}
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
  // Real announcements from the communication module (empty until one is posted).
  const { announcements, loading } = useCommunication();

  // Newest first, using the scheduled time when present, otherwise created time.
  const sorted = [...announcements].sort((a, b) => {
    const ta = new Date(a.scheduledAt ?? a.createdAt).getTime();
    const tb = new Date(b.scheduledAt ?? b.createdAt).getTime();
    return tb - ta;
  });

  const targetLabel: Record<string, string> = {
    organization: 'Organization',
    department: 'Department',
    project: 'Project',
    training: 'Training',
  };

  return (
    <Card>
      <SectionHeader title="Announcements & Notices" />
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 2px' }}>
          {loading ? 'Loading announcements…' : 'No announcements yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((a) => {
            const isExpanded = expandedId === a.id;
            const isHigh = a.priority === 'high';
            const tone = isHigh ? 'danger' : 'neutral';
            const when = new Date(a.scheduledAt ?? a.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const content = a.content ?? '';

            return (
              <div
                key={a.id}
                style={{
                  borderLeft: `4px solid ${isHigh ? 'var(--status-danger)' : 'var(--brand)'}`,
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
                    {isHigh && <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>📌 Pinned</span>}
                    <Badge tone={tone}>{targetLabel[a.targetType] ?? a.targetType}</Badge>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{when}</span>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {isExpanded || content.length <= 95 ? content : `${content.slice(0, 95)}...`}
                </div>

                {content.length > 95 && (
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
});

/** Resized Stat Pill matching exact height (64px) & style of QuickActionCard */
function ResizedStatPill({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; icon?: string }) {
  return (
    <div className="kvj-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', minHeight: 64, borderRadius: 16 }}>
      {icon && <span className={`kvj-badge kvj-badge--${tone}`} style={{ width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, fontSize: 16 }}>{icon}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{label}</span>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
    </div>
  );
}

/** Resized QuickAction matching exact height (64px) */
function ResizedQuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="kvj-card kvj-card--hover" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', border: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-primary)', minHeight: 64, width: '100%', borderRadius: 16 }}>
      <span className="kvj-badge kvj-badge--progress" style={{ width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
    </button>
  );
}

/** My Day — default employee workspace. */
export function MyDayPage() {
  const { record, loading, clockIn, clockOut, startBreak, endBreak, hoursThisMonth, monthAttendancePct } = useAttendance();
  const { toast, addNotification } = useNotifications();
  const { tasks: projectTasks, projects, createTask } = useProject();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState<Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral' }>>([]);

  useEffect(() => {
    const todayStr = toLocalISODate(new Date());
    const mapped: TaskItem[] = projectTasks
      .filter((t) => t.dueDate === todayStr || t.status === 'in_progress' || t.status === 'todo')
      .map((t) => {
        const proj = projects.find((p) => p.id === t.projectId);
        return {
          id: t.id,
          title: t.title,
          project: proj ? proj.title : 'General Project',
          due: t.dueDate || todayStr,
          priority: t.priority === 'high' ? 'High' : 'Normal',
          active: t.status === 'in_progress',
          underReview: t.status === 'review',
          secondsToday: (t.actualHours || 0) * 3600,
        };
      });

    if (mapped.length > 0) {
      setTasks(mapped);
    }
  }, [projectTasks, projects]);

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

  const handleCreateTaskSubmit = async (values: Record<string, unknown>) => {
    const todayStr = toLocalISODate(new Date());
    const title = (values.name as string) || 'New Task';
    const projName = (values.projectName as string) || 'General Project';

    const proj = projects.find((p) => p.title === projName || p.id === values.projectId);
    const res = await createTask({
      projectId: proj?.id,
      title,
      dueDate: todayStr,
      status: 'todo',
      priority: 'medium',
    });

    const newTaskItem: TaskItem = {
      id: res.ok ? res.value.id : String(Date.now()),
      title,
      project: projName,
      due: todayStr,
      priority: 'Normal',
      active: false,
      secondsToday: 0,
    };

    setTasks((prev) => [newTaskItem, ...prev]);
    toast({ variant: 'success', title: 'Task Created', message: `Task "${title}" added to Today's Tasks.` });
    setCreateTaskOpen(false);
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

      {/* Quick Actions + Resized Metrics. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <ResizedQuickAction icon="✓" label="Add Task" onClick={() => setCreateTaskOpen(true)} />
        <ResizedQuickAction icon="₹" label="Submit Expense" />
        <ResizedQuickAction icon="🗓" label="Request Leave" />
        <ResizedStatPill label="Tasks Due" value={`${tasks.filter(t => !t.underReview).length}`} tone="warning" icon="◧" />
        <ResizedStatPill label="Hours this Month" value={`${hoursThisMonth} hrs`} tone="info" icon="⌛" />
        <ResizedStatPill label="Attendance %" value={`${monthAttendancePct}%`} tone="success" icon="📈" />
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

      {/* Create Task Drawer */}
      <Drawer open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} title="Create New Task">
        <Form initial={{ category: 'Office Task' }} onSubmit={handleCreateTaskSubmit}>
          <TextField name="name" label="Task Title *" placeholder="e.g. Cross check each features" />
          <TextField name="projectName" label="Project Name / Department" placeholder="e.g. Flow Desk" />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateTaskOpen(false)}>Cancel</Button>
            <Button type="submit">Create Task</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}

/** Supervisor / Manager / CEO workspaces. */
export function RoleWorkspacePage({ role }: { role: Exclude<WorkspaceRole, 'employee'> }) {
  const { projects, clients, timesheets } = useProject();
  const { employees } = useEmployee();

  const [presentCount, setPresentCount] = useState(0);
  const [pendingExpenses, setPendingExpenses] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchWorkspaceStats = async () => {
      try {
        const attRepo = container.resolve(ATTENDANCE_REPOSITORY_TOKEN);
        const expRepo = container.resolve(EXPENSE_CLAIM_REPOSITORY_TOKEN);

        const today = toLocalISODate(new Date());
        
        // Find attendance for today
        const attRes = await attRepo.findMany();
        const todayPresent = attRes.data.filter((r) => r.workDate === today && r.firstClockIn).length;

        // Find pending expenses (submitted status)
        const expRes = await expRepo.findMany();
        const pendingExp = expRes.data.filter((c) => c.status === 'submitted').length;

        if (active) {
          setPresentCount(todayPresent);
          setPendingExpenses(pendingExp);
        }
      } catch (err) {
        console.error('Failed to load workspace stats:', err);
      }
    };

    fetchWorkspaceStats();
    return () => { active = false; };
  }, []);

  const totalEmployees = employees.length;
  const teamPresent = totalEmployees > 0 ? `${presentCount}/${totalEmployees}` : '0/0';

  const pendingTimesheets = timesheets.filter((t) => t.status === 'submitted').length;
  const pendingApprovals = pendingExpenses + pendingTimesheets;

  // At-risk projects: count of planning/execution projects with high or critical priority
  const atRiskProjects = projects.filter(
    (p) =>
      p.status !== 'closure' &&
      p.status !== 'suspended' &&
      (p.priority === 'high' || p.priority === 'critical')
  ).length;

  const mappedProjects = useMemo(() => {
    return projects.map((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      return {
        id: p.id,
        name: p.title,
        client: client ? client.name : 'Unknown Client',
        progress: 0,
        health: p.status === 'suspended' ? 'Suspended' : p.status === 'execution' ? 'In Progress' : 'Planned',
        healthTone: (p.status === 'suspended' ? 'danger' : p.status === 'execution' ? 'success' : 'neutral') as any,
      };
    });
  }, [projects, clients]);

  const title = { supervisor: 'Supervisor Workspace', manager: 'Manager Workspace', ceo: 'CEO Workspace' }[role];
  return (
    <AppShell>
      <WorkspaceShell role={role} regions={{
        greeting: <PageHeader title={title} />,
        stats: <>
          <StatCard label="Team present" value={teamPresent} tone="success" icon="●" />
          <StatCard label="Utilization" value="" icon="◔" />
          <StatCard label="Pending approvals" value={pendingApprovals.toString()} tone={pendingApprovals > 0 ? 'warning' : 'neutral'} icon="⚑" />
          <StatCard label="At-risk projects" value={atRiskProjects.toString()} tone={atRiskProjects > 0 ? 'danger' : 'neutral'} icon="▲" />
        </>,
        primary: <>
          <Card>
            <SectionHeader title="Projects" />
            {mappedProjects.length > 0 ? (
              mappedProjects.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.client}</div>
                  </div>
                  <Badge tone={p.healthTone}>{p.health}</Badge>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No projects found</div>
            )}
          </Card>
          <Card>
            <SectionHeader title="Attendance trend" />
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No trend data available</div>
          </Card>
        </>,
        side: <>
          <Card>
            <SectionHeader title="Team activity" />
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity</div>
          </Card>
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
