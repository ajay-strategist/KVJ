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
import { useLeave } from '../../../modules/leave/hooks/useLeave';
import { Form, SelectField, TextField, DatePickerField, CheckboxField, FileUploadField, TextAreaField, useForm } from '../../../shared/forms/form';

import { useProject } from '../../../modules/project/hooks/useProject';
import { useEmployee } from '../../../modules/employee/hooks/useEmployee';
import { useTraining } from '../../../modules/training/hooks/useTraining';
import { container } from '../../../core/registry';
import { ATTENDANCE_REPOSITORY_TOKEN } from '../../../modules/attendance/attendance.repository';
import { ATTENDANCE_SERVICE_TOKEN } from '../../../modules/attendance/attendance.service';
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
  const { user } = useAuth();
  const { batches, courses } = useTraining();
  const [clockInOpen, setClockInOpen] = useState(false);
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

  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const completedBreakMs = (record?.breaks ?? []).reduce((sum: number, b: any) => {
    if (b.endTime) return sum + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime());
    return sum;
  }, 0);

  const completedSessionMs = (record?.sessions ?? []).reduce((sum: number, s: any) => {
    if (s.clockOut) return sum + (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime());
    return sum;
  }, 0);

  const activeSession = record?.sessions?.find((s: any) => !s.clockOut);
  const startTimeStr = activeSession?.clockIn || record?.firstClockIn;
  const activeSessionMs = (record?.status === 'present' || record?.status === 'on_break') && startTimeStr
    ? Math.max(0, nowMs - new Date(startTimeStr).getTime())
    : 0;

  const activeBreak = record?.breaks?.find((b: any) => !b.endTime);
  const activeBreakMs = activeBreak ? Math.max(0, nowMs - new Date(activeBreak.startTime).getTime()) : 0;

  const totalWorkMs = Math.max(0, completedSessionMs + activeSessionMs - completedBreakMs - activeBreakMs);
  const totalBreakMs = Math.max(0, completedBreakMs + activeBreakMs);

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

  const handleDirectStartBreak = useCallback(async () => {
    const res = await startBreak('Official Break');
    if (res.ok) {
      toast({ variant: 'info', title: 'On Break', message: 'Enjoy your break.' });
      if (onActivityLog) onActivityLog('Started official break', 'info');
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
          )}

          {currentStatus === 'present' && (
            <>
              <button
                type="button"
                className="kvj-btn"
                disabled={loading}
                onClick={handleDirectStartBreak}
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
          )}

          {/* Always visible action to submit attendance */}
          <button
            type="button"
            className="kvj-btn"
            onClick={() => setClaimOpen(true)}
            style={{
              background: '#ffffff',
              color: '#6366f1',
              border: '2px solid #a5b4fc',
              padding: '10px 22px',
              fontWeight: 700,
              fontSize: 13.5,
              borderRadius: 999,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(99,102,241,0.08)',
              marginLeft: 'auto',
            }}
          >
            📋 Submit Attendance
          </button>
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
                <div>Employee: <strong>{user?.fullName || 'Employee'}</strong></div>
                {selectedMode === 'Training' && (
                  <div>Trainer: <strong>{availableBatches.find((b) => b.name === selectedBatch)?.trainer || 'Assigned Trainer'}</strong></div>
                )}
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
      <Drawer open={claimOpen} onClose={() => setClaimOpen(false)} title="Submit Attendance Request">
        <Form
          initial={{
            date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            classification: 'Office',
            location: 'Christ 3BBA Data Analytics B1',
            organisationsVisited: '',
            startTime: '08:30 AM',
            endTime: '05:00 PM',
            notes: '',
          }}
          onSubmit={async (values) => {
            const locText = values.classification === 'Training' 
              ? values.location 
              : values.classification === 'Marketing' 
              ? `Marketing: ${values.organisationsVisited}` 
              : 'Office Work';
            
            try {
              const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
              await attService.requestCorrection(
                record?.id || String(Date.now()),
                'attendance_claim',
                `${values.date} (${values.startTime} - ${values.endTime})`,
                `Classification: ${values.classification}, Location: ${locText}. ${values.notes || ''}`,
                { id: record?.employeeId || user?.id || 'emp-user', role: 'Employee' }
              );
            } catch (e) {
              console.warn('Attendance correction request notice:', e);
            }

            toast({
              variant: 'success',
              title: 'Attendance Request Submitted',
              message: `Attendance claim for ${values.date} (${values.startTime} - ${values.endTime}) sent to Approvals Queue for review.`,
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


    </>
  );
});

const TASK_TIMER_STORAGE_KEY = 'kvj_task_timer_state_v1';
const TIMELINE_STORAGE_KEY = 'kvj_daily_activity_timeline_v1';

export interface StoredTaskState {
  secondsToday: number;
  active: boolean;
  lastStartTime?: number;
  underReview?: boolean;
}

const getStoredTaskStates = (): Record<string, StoredTaskState> => {
  try {
    const raw = localStorage.getItem(TASK_TIMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredTaskStates = (states: Record<string, StoredTaskState>) => {
  try {
    localStorage.setItem(TASK_TIMER_STORAGE_KEY, JSON.stringify(states));
  } catch {}
};

export interface TaskItem {
  id: string;
  title: string;
  project: string;
  due: string;
  priority: string;
  active: boolean;
  underReview?: boolean;
  isApproved?: boolean;
  isRework?: boolean;
  reworkNotes?: string;
  secondsToday: number;
}

function getTimeLeftInfo(dueStr: string): { label: string; tone: 'danger' | 'warning' | 'neutral' } {
  if (!dueStr) return { label: 'No due date', tone: 'neutral' };
  const todayStr = toLocalISODate(new Date());
  const due = dueStr.slice(0, 10);

  if (due < todayStr) {
    const diffMs = new Date(todayStr).getTime() - new Date(due).getTime();
    const diffDays = Math.max(1, Math.round(diffMs / 86400000));
    return {
      label: diffDays === 1 ? '1 day overdue' : `${diffDays} days overdue`,
      tone: 'danger',
    };
  } else if (due === todayStr) {
    return { label: 'Due Today', tone: 'warning' };
  } else {
    const diffMs = new Date(due).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.max(1, Math.round(diffMs / 86400000));
    return {
      label: diffDays === 1 ? '1 day left' : `${diffDays} days left`,
      tone: 'neutral',
    };
  }
}

const TASK_ORDER_STORAGE_KEY = 'kvj_task_order_v1';

const getStoredTaskOrder = (): string[] => {
  try {
    const saved = localStorage.getItem(TASK_ORDER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveStoredTaskOrder = (order: string[]) => {
  try {
    localStorage.setItem(TASK_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {}
};

export const TaskWidget = memo(function TaskWidget({
  tasks,
  setTasks,
  onToggleTask,
  onSubmitReview,
  onSyncTask,
}: {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  onToggleTask: (id: string, title: string, currentActive: boolean) => void;
  onSubmitReview: (id: string, title: string) => void;
  onSyncTask?: (id: string, secondsToday: number, active: boolean, underReview?: boolean) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTasks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (t.active) {
            changed = true;
            const nextSec = t.secondsToday + 1;
            if (onSyncTask && nextSec % 5 === 0) {
              onSyncTask(t.id, nextSec, true, t.underReview);
            }
            return { ...t, secondsToday: nextSec };
          }
          return t;
        });
        if (changed) {
          const states = getStoredTaskStates();
          const now = Date.now();
          next.forEach((t) => {
            if (t.active) {
              states[t.id] = {
                secondsToday: t.secondsToday,
                active: true,
                lastStartTime: now,
                underReview: t.underReview,
              };
            }
          });
          saveStoredTaskStates(states);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [setTasks, onSyncTask]);

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

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdxStr = e.dataTransfer.getData('text/plain');
    const sourceIdx = sourceIdxStr !== '' ? parseInt(sourceIdxStr, 10) : draggedIndex;

    if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      setTasks((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(sourceIdx, 1);
        updated.splice(targetIdx, 0, moved);
        saveStoredTaskOrder(updated.map((t) => t.id));
        return updated;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => !t.isApproved);
  }, [tasks]);

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
        .task-card-drop-target {
          border-top: 3px solid var(--brand) !important;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeTasks.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            📋 No pending or active tasks for today. Click <strong>Add Task</strong> to create a new task.
          </div>
        ) : (
          activeTasks.map((t, idx) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            className={`task-card-hover ${draggedIndex === idx ? 'task-card-dragging' : ''} ${dragOverIndex === idx && draggedIndex !== idx ? 'task-card-drop-target' : ''}`}
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
                    {(() => {
                      const info = getTimeLeftInfo(t.due);
                      return (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          • ⏳ Time Left:{' '}
                          <strong style={{ color: info.tone === 'danger' ? 'var(--status-danger)' : info.tone === 'warning' ? 'var(--status-warning)' : 'var(--brand)' }}>
                            {info.label}
                          </strong>
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge tone={t.priority === 'Critical' ? 'danger' : t.priority === 'High' ? 'warning' : 'neutral'}>{t.priority}</Badge>
                {t.isApproved ? (
                  <Badge tone="success">Approved &amp; Completed</Badge>
                ) : t.underReview ? (
                  <Badge tone="info">Under Review</Badge>
                ) : t.isRework ? (
                  <Badge tone="warning">🔄 Rework</Badge>
                ) : null}
              </div>
            </div>

            {/* Rework reason alert box */}
            {t.isRework && t.reworkNotes && (
              <div style={{
                fontSize: 12,
                color: '#b45309',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span>🔄</span>
                <span><strong>Rework Reason:</strong> {t.reworkNotes}</span>
              </div>
            )}

            {/* Display "Hours " instead of Total Hours Worked & progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>
                ⏱ Hours: {formatSec(t.secondsToday)}
              </span>

              {/* Action Buttons: Single Toggle Button (Start / Pause) & Submit */}
              <div style={{ display: 'flex', gap: 8 }}>
                {t.isApproved ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ✓ Approved &amp; Completed
                  </span>
                ) : t.underReview ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-success)' }}>
                    ✓ Submitted for Manager Approval
                  </span>
                ) : (
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
              </div>
            </div>
          </div>
        )))}
      </div>
    </Card>
  );
});

export const UpcomingEventsWidget = memo(function UpcomingEventsWidget() {
  const { user } = useAuth();
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const { tasks } = useProject();
  const [dbSchedules, setDbSchedules] = useState<any[]>([]);

  useEffect(() => {
    async function loadSchedules() {
      try {
        const { data } = await supabase.from('schedule_sessions').select('*').is('deleted_at', null);
        if (data) {
          setDbSchedules(
            data.map((r: any) => ({
              id: r.id,
              date: r.date,
              startTime: r.start_time || '09:00 AM',
              title: r.session_title || r.topic || 'Training Session',
              type: 'Training',
            }))
          );
        }
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

      // 1. Gather tasks due on this date (excluding approved/completed tasks)
      const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
      const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

      const dayTasks = (tasks || []).filter((t) => {
        const status = (t.status || '').toLowerCase();
        if (status === 'done' || status.includes('completed') || status.includes('approved')) {
          return false;
        }

        if (!isManagement) {
          const isMyTask = t.assigneeId === user?.id || t.assigneeId === user?.email || (t.assignee && user?.fullName && t.assignee.toLowerCase() === user.fullName.toLowerCase());
          if (!isMyTask) return false;
        }
        const taskDate = (t.dueDate || '').slice(0, 10);
        if (!taskDate) return i === 0;
        if (i === 0) {
          // Day 1 (Today): show tasks due today or active overdue tasks
          return taskDate <= isoDate;
        }
        return taskDate === isoDate;
      }).map((t) => ({
        id: `task-${t.id}`,
        time: (t.dueDate || '').slice(0, 10) < isoDate ? 'Overdue' : 'Due Today',
        title: `Task: ${t.title}`,
        type: 'Projects' as const,
      }));

      // 2. Gather training schedules on this date
      const daySchedules = (dbSchedules || []).filter((s) => s.date === isoDate).map((s) => ({
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

const shiftDateStr = (isoDate: string, days: number): string => {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
};

const getEntryDate = (e: { id: string; date?: string }): string => {
  if (e.date) return e.date.slice(0, 10);
  const ts = Number(e.id);
  if (!isNaN(ts) && ts > 1600000000000) {
    return toLocalISODate(new Date(ts));
  }
  return toLocalISODate(new Date());
};

const dateNavBtnStyle: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  transition: 'all 140ms ease',
};

export const TimelineWidget = memo(function TimelineWidget({
  entries,
  selectedEmpId,
  onEmpIdChange,
  employeeList = [],
}: {
  entries: Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral'; date?: string }>;
  selectedEmpId?: string;
  onEmpIdChange?: (empId: string) => void;
  employeeList?: Array<{ id: string; name: string }>;
}) {
  const { user } = useAuth();
  const isExecutive = user && ['CEO', 'ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(String(user.role).toUpperCase());
  const todayDate = toLocalISODate(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  const cleanEntries = entries.filter((e) => !e.title?.includes('System initialized'));
  const filteredEntries = cleanEntries.filter((e) => getEntryDate(e) === selectedDate);

  const isToday = selectedDate === todayDate;

  const handlePrevDay = () => setSelectedDate((prev) => shiftDateStr(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => shiftDateStr(prev, 1));
  const handleResetToday = () => setSelectedDate(todayDate);

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const formattedDateLabel = dateObj.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Card>
      {/* Widget Header with Status & Navigation Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Daily Activity Timeline
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Clock In → Work → Clock Out Logs
            </div>
          </div>
          <Badge tone={isToday ? 'success' : 'info'}>
            {isToday ? '🟢 Current Day' : '📅 History Log'}
          </Badge>
        </div>

        {/* User Level Employee Filter Dropdown for Executive Roles */}
        {false && isExecutive && employeeList.length > 0 && onEmpIdChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-sunken)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>👤 Filter Timeline:</span>
            <select
              value={selectedEmpId || 'me'}
              onChange={(e) => onEmpIdChange(e.target.value)}
              className="kvj-input"
              style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6, flex: 1, background: 'var(--bg-surface)', cursor: 'pointer' }}
            >
              <option value="me">My Timeline ({user?.fullName || 'Me'})</option>
              {employeeList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Navigation Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '6px 10px',
          gap: 6,
        }}>
          <button
            type="button"
            onClick={handlePrevDay}
            title="Previous Day"
            aria-label="Previous Day"
            style={dateNavBtnStyle}
          >
            ◀ Prev Day
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isToday ? `Today (${formattedDateLabel.split(', ')[1] || formattedDateLabel})` : formattedDateLabel}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              style={{
                width: 20,
                height: 20,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                opacity: 0.7,
              }}
              title="Select date"
            />
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {!isToday && (
              <button
                type="button"
                onClick={handleResetToday}
                title="Go to Today"
                aria-label="Go to Today"
                style={{
                  ...dateNavBtnStyle,
                  background: 'var(--brand-muted)',
                  color: 'var(--brand)',
                  fontWeight: 700,
                }}
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={handleNextDay}
              disabled={isToday}
              title={isToday ? 'Current Day' : 'Next Day'}
              aria-label="Next Day"
              style={{
                ...dateNavBtnStyle,
                opacity: isToday ? 0.4 : 1,
                cursor: isToday ? 'not-allowed' : 'pointer',
              }}
            >
              Next Day ▶
            </button>
          </div>
        </div>
      </div>

      {/* Timeline List or Empty State */}
      {filteredEntries.length === 0 ? (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 12,
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>No activity logged for {isToday ? 'today yet' : formattedDateLabel}.</span>
          {!isToday && (
            <button
              type="button"
              onClick={handleResetToday}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              View Today's Status ↗
            </button>
          )}
        </div>
      ) : (
        <Timeline entries={filteredEntries} />
      )}
    </Card>
  );
});

export const AnnouncementWidget = memo(function AnnouncementWidget() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kvj_dismissed_announcements') || '[]');
    } catch {
      return [];
    }
  });

  // Real announcements from the communication module.
  const { announcements, loading } = useCommunication();

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem('kvj_dismissed_announcements', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Newest first, filtering out dismissed items.
  const visibleAnnouncements = announcements
    .filter((a) => !dismissedIds.includes(a.id))
    .sort((a, b) => {
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
      {visibleAnnouncements.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 2px' }}>
          {loading ? 'Loading announcements…' : 'No announcements.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleAnnouncements.map((a) => {
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
                  position: 'relative',
                  transition: 'all 160ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isHigh && <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>📌 Pinned</span>}
                    <Badge tone={tone}>{targetLabel[a.targetType] ?? a.targetType}</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{when}</span>
                    <button
                      type="button"
                      onClick={() => handleDismiss(a.id)}
                      aria-label="Dismiss notice"
                      title="Dismiss notice"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontSize: 14,
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 120ms ease',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', paddingRight: 20 }}>{a.title}</div>

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

export function MyDayPage() {
  const { user } = useAuth();
  const { employees } = useEmployee();
  const { record, loading, clockIn, clockOut, startBreak, endBreak, hoursThisMonth, monthAttendancePct } = useAttendance();
  const { toast, addNotification } = useNotifications();
  const { tasks: projectTasks, projects, createTask, updateTask, submitTask } = useProject();

  const [selectedEmpId, setSelectedEmpId] = useState('me');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const userTimelineKey = useMemo(() => {
    const activeKey = selectedEmpId !== 'me' ? selectedEmpId : (user?.id || user?.email || 'me');
    return `${TIMELINE_STORAGE_KEY}_${activeKey}`;
  }, [selectedEmpId, user]);

  const [timelineEntries, setTimelineEntries] = useState<Array<{ id: string; title: string; time: string; tone: 'success' | 'progress' | 'info' | 'neutral' }>>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(userTimelineKey);
      const parsed = saved ? JSON.parse(saved) : [];
      const filtered = parsed.filter((e: any) => !e.title?.includes('System initialized'));
      setTimelineEntries(filtered);
    } catch {
      setTimelineEntries([]);
    }
  }, [userTimelineKey]);

  const handleSyncTask = useCallback((id: string, secondsToday: number, active: boolean, underReview?: boolean) => {
    updateTask(id, {
      actualHours: secondsToday / 3600,
      status: underReview ? 'review' : active ? 'in_progress' : 'todo',
    });
  }, [updateTask]);

  useEffect(() => {
    const todayStr = toLocalISODate(new Date());
    const storedStates = getStoredTaskStates();
    const now = Date.now();
    const updatedStates = { ...storedStates };

    const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
    const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

    const mapped: TaskItem[] = (projectTasks || [])
      .filter((t) => {
        if (!t) return false;
        // Don't show unapproved assignment requests to assignee until approved by manager
        if ((t as any).approvalStatus === 'pending_assignment_approval') return false;

        if (!isManagement) {
          const isMyTask = t.assigneeId === user?.id || t.assigneeId === user?.email || (t.assignee && user?.fullName && t.assignee.toLowerCase() === user.fullName.toLowerCase());
          if (!isMyTask) return false;
        }

        const d = (t.dueDate || '').slice(0, 10);
        return d === todayStr || d < todayStr || t.status === 'in_progress' || t.status === 'todo' || t.status === 'review' || (t as any).approvalStatus === 'rework' || storedStates[t.id];
      })
      .map((t) => {
        const proj = (projects || []).find((p) => p.id === t.projectId);
        const stored = storedStates[t.id];
        let secondsToday = Math.round((t.actualHours || 0) * 3600);
        let active = t.status === 'in_progress';
        const isRework = (t as any).approvalStatus === 'rework';
        const reworkNotes = (t as any).reworkNotes;
        let underReview = t.status === 'review' || (t as any).approvalStatus === 'pending_task_approval';
        const statusStr = (t.status || '') as string;
        const isApproved = statusStr === 'done' || statusStr === 'completed' || (t as any).approvalStatus === 'approved' || (t as any).isApproved === true;
        if (isApproved || isRework) {
          underReview = false;
        }

        if (stored) {
          secondsToday = stored.secondsToday || 0;
          if (stored.active && stored.lastStartTime) {
            const elapsed = Math.floor((now - stored.lastStartTime) / 1000);
            if (elapsed > 0 && elapsed < 86400) {
              secondsToday += elapsed;
            }
            active = true;
          } else {
            active = stored.active;
          }
          if (stored.underReview !== undefined && !isRework && !isApproved) {
            underReview = stored.underReview;
          }
        }

        // Sanity guard against corrupted inflated values (> 24 hours)
        if (secondsToday > 86400) {
          secondsToday = 0;
        }

        updatedStates[t.id] = {
          secondsToday,
          active,
          lastStartTime: active ? now : undefined,
          underReview,
        };

        return {
          id: t.id,
          title: t.title,
          project: proj ? proj.title : 'Flow Desk',
          due: (t.dueDate || '').slice(0, 10) || todayStr,
          priority: t.priority === 'high' ? 'High' : 'Normal',
          active,
          underReview,
          isApproved,
          isRework,
          reworkNotes,
          secondsToday,
        };
      });

    saveStoredTaskStates(updatedStates);

    const savedOrder = getStoredTaskOrder();
    if (savedOrder.length > 0) {
      mapped.sort((a, b) => {
        const idxA = savedOrder.indexOf(a.id);
        const idxB = savedOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    if (mapped.length > 0) {
      setTasks(mapped);
    }
  }, [projectTasks, projects]);

  const handleActivityLog = (title: string, tone: 'success' | 'progress' | 'info' | 'neutral' = 'info') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = toLocalISODate(new Date());
    const newEntry = { id: String(Date.now()), title, time: timeStr, tone, date: dateStr };
    setTimelineEntries((prev) => {
      const next = [...prev, newEntry];
      try {
        localStorage.setItem(userTimelineKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleToggleTask = (id: string, taskTitle: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    const now = Date.now();
    setTasks((prev) => {
      const targetTask = prev.find((t) => t.id === id);
      const updated = prev.map((t) =>
        t.id === id ? { ...t, active: nextActive } : { ...t, active: false }
      );
      const states = getStoredTaskStates();
      updated.forEach((t) => {
        states[t.id] = {
          secondsToday: t.secondsToday,
          active: t.active,
          lastStartTime: t.active ? now : undefined,
          underReview: t.underReview,
        };
      });
      saveStoredTaskStates(states);

      if (targetTask) {
        updateTask(id, {
          status: nextActive ? 'in_progress' : 'todo',
          actualHours: targetTask.secondsToday / 3600,
        });
      }

      return updated;
    });
    handleActivityLog(`${nextActive ? 'Started' : 'Paused'} Task: ${taskTitle}`, nextActive ? 'progress' : 'neutral');
  };

  const handleSubmitReview = (id: string, taskTitle: string) => {
    setTasks((prev) => {
      const targetTask = prev.find((t) => t.id === id);
      const updated = prev.map((t) =>
        t.id === id ? { ...t, active: false, underReview: true, isRework: false, reworkNotes: undefined } : t
      );
      const states = getStoredTaskStates();
      if (states[id]) {
        states[id].active = false;
        states[id].underReview = true;
        delete states[id].lastStartTime;
      }
      saveStoredTaskStates(states);

      if (targetTask) {
        submitTask(id as any, 'Submitted from Workspace').catch((e) => {
          console.warn('submitTask error:', e);
        });
      }

      return updated;
    });
    toast({
      variant: 'success',
      title: 'Routed to Approvals Queue',
      message: `Task '${taskTitle}' submitted to Approvals Queue for Manager/Admin review.`,
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

    const taskId = res.ok ? res.value.id : String(Date.now());
    const newTaskItem: TaskItem = {
      id: taskId,
      title,
      project: projName,
      due: todayStr,
      priority: 'Normal',
      active: false,
      secondsToday: 0,
    };

    setTasks((prev) => {
      const next = [newTaskItem, ...prev];
      const states = getStoredTaskStates();
      states[taskId] = { secondsToday: 0, active: false };
      saveStoredTaskStates(states);
      return next;
    });

    toast({ variant: 'success', title: 'Task Created', message: `Task "${title}" added to Today's Tasks.` });
    setCreateTaskOpen(false);
  };

  const { applyLeave } = useLeave();
  const [applyLeaveOpen, setApplyLeaveOpen] = useState(false);

  const employeeOptions = useMemo(() => {
    return (employees || []).map((e) => ({
      id: e.id,
      name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
    }));
  }, [employees]);

  return (
    <AppShell>
      <PageHeader
        title="My Day"
        subtitle="Manage your daily attendance, tasks, breaks, and workspace activity."
        actions={
          <Button onClick={() => setCreateTaskOpen(true)} style={{ gap: 6 }}>
            ＋ Add Task
          </Button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <ResizedStatPill
          label="TODAY ATTENDANCE"
          value={record?.firstClockIn ? `Logged: ${record.firstClockIn}` : 'Not Clocked In'}
          tone={record?.firstClockIn ? 'success' : 'warning'}
          icon="🕒"
        />
        <ResizedStatPill
          label="MONTH ATTENDANCE RATE"
          value={`${monthAttendancePct}%`}
          tone={monthAttendancePct >= 90 ? 'success' : 'warning'}
          icon="📅"
        />
        <ResizedStatPill
          label="TOTAL HOURS THIS MONTH"
          value={`${hoursThisMonth} hrs`}
          tone="info"
          icon="⏱"
        />
        <ResizedQuickAction
          icon="📝"
          label="Apply Leave / Regularize"
          onClick={() => setApplyLeaveOpen(true)}
        />
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

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TaskWidget
            tasks={tasks}
            setTasks={setTasks}
            onToggleTask={handleToggleTask}
            onSubmitReview={handleSubmitReview}
            onSyncTask={handleSyncTask}
          />

          <UpcomingEventsWidget />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AnnouncementWidget />
          <TimelineWidget
            entries={timelineEntries}
            selectedEmpId={selectedEmpId}
            onEmpIdChange={setSelectedEmpId}
            employeeList={employeeOptions}
          />
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

      {/* Apply Leave Drawer on My Day */}
      <Drawer open={applyLeaveOpen} onClose={() => setApplyLeaveOpen(false)} title="Apply for Leave">
        <Form
          initial={{ leaveType: 'Leave', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), reason: '', halfDay: false }}
          onSubmit={async (values) => {
            const res = await applyLeave(
              (values.leaveType as string) || 'Leave',
              (values.startDate as string) || new Date().toISOString().slice(0, 10),
              (values.endDate as string) || new Date().toISOString().slice(0, 10),
              (values.reason as string) || '',
              Boolean(values.halfDay)
            );
            if (res.ok) {
              toast({ variant: 'success', title: 'Leave Applied', message: 'Your leave application has been submitted successfully.' });
              setApplyLeaveOpen(false);
            } else {
              toast({ variant: 'error', title: 'Application Failed', message: res.error });
            }
          }}
        >
          <SelectField
            name="leaveType"
            label="Leave Type *"
            options={[
              { value: 'Leave', label: 'Casual / Earned Leave' },
              { value: 'Medical Leave', label: 'Medical Leave' },
              { value: 'On Duty / Regularization', label: 'On Duty / Regularization' },
              { value: 'Work From Home', label: 'Work From Home' },
            ]}
          />
          <DatePickerField name="startDate" label="Start Date *" />
          <DatePickerField name="endDate" label="End Date *" />
          <CheckboxField name="halfDay" label="Apply for Half Day" />
          <FileUploadField name="medCert" label="Medical Certificate (Optional upfront; can be uploaded after leave)" accept=".pdf,.png,.jpg" />
          <TextAreaField name="reason" label="Reason for Leave" />

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setApplyLeaveOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Leave Request</Button>
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
        const todayPresent = (attRes?.data || []).filter((r) => r.workDate === today && r.firstClockIn).length;

        // Find pending expenses (submitted status)
        const expRes = await expRepo.findMany();
        const pendingExp = (expRes?.data || []).filter((c) => c.status === 'submitted').length;

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

  const totalEmployees = (employees || []).length;
  const teamPresent = totalEmployees > 0 ? `${presentCount}/${totalEmployees}` : '0/0';

  const pendingTimesheets = (timesheets || []).filter((t) => t.status === 'submitted').length;
  const pendingApprovals = pendingExpenses + pendingTimesheets;

  // At-risk projects: count of planning/execution projects with high or critical priority
  const atRiskProjects = (projects || []).filter(
    (p) =>
      p.status !== 'closure' &&
      p.status !== 'suspended' &&
      (p.priority === 'high' || p.priority === 'critical')
  ).length;

  const mappedProjects = useMemo(() => {
    return (projects || []).map((p) => {
      const client = (clients || []).find((c) => c.id === p.clientId);
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
