import React, { useState, useEffect, useMemo } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import { BATCH_REPOSITORY_TOKEN } from '../../training/training.repository';

export type WorkSessionType = 'Office' | 'Remote' | 'Training';

export interface CorrectionSessionBlock {
  id: string;
  workType: WorkSessionType;
  batchId?: string;
  batchName?: string;
  startTime: string; // "09:30"
  endTime: string;   // "17:30"
  notes?: string;
}

export interface AttendanceCorrectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultRecordId?: string;
}

export function AttendanceCorrectionModal({
  open,
  onClose,
  onSuccess,
  defaultRecordId,
}: AttendanceCorrectionModalProps) {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { confirm } = useDialog();

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthPrefix = todayStr.slice(0, 7); // e.g., "2026-09"

  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [attendanceDate, setAttendanceDate] = useState<string>(todayStr);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Batches from training module
  const [batches, setBatches] = useState<Array<{ id: string; name: string; code?: string }>>([]);

  // Single Session Mode state
  const [singleType, setSingleType] = useState<WorkSessionType>('Office');
  const [singleBatchId, setSingleBatchId] = useState<string>('');
  const [singleStartTime, setSingleStartTime] = useState<string>('09:30');
  const [singleEndTime, setSingleEndTime] = useState<string>('17:30');

  // Multiple Sessions Mode state
  const [sessions, setSessions] = useState<CorrectionSessionBlock[]>([
    {
      id: 'session-1',
      workType: 'Office',
      startTime: '09:30',
      endTime: '13:30',
      notes: '',
    },
    {
      id: 'session-2',
      workType: 'Training',
      startTime: '13:30',
      endTime: '17:30',
      notes: '',
    },
  ]);

  // Load active batches when modal opens
  useEffect(() => {
    if (!open) return;
    let active = true;

    const loadBatches = async () => {
      try {
        const batchRepo = container.resolve(BATCH_REPOSITORY_TOKEN);
        const res = await batchRepo.findMany({ pageSize: 200 });
        if (active && res && Array.isArray(res.data)) {
          setBatches(
            res.data.map((b: any) => ({
              id: b.id,
              name: b.name || b.batchCode || 'Batch',
              code: b.batchCode || b.code || '',
            }))
          );
        }
      } catch (err) {
        console.warn('Failed to load batches for attendance correction:', err);
      }
    };

    loadBatches();
    return () => {
      active = false;
    };
  }, [open]);

  // Reset form to clean state on open (clean manual entry as agreed)
  useEffect(() => {
    if (open) {
      setAttendanceDate(todayStr);
      setReason('');
      setMode('single');
      setSingleType('Office');
      setSingleBatchId('');
      setSingleStartTime('09:30');
      setSingleEndTime('17:30');
      setSessions([
        {
          id: `s-${Date.now()}-1`,
          workType: 'Office',
          startTime: '09:30',
          endTime: '13:30',
          notes: '',
        },
        {
          id: `s-${Date.now()}-2`,
          workType: 'Training',
          startTime: '13:30',
          endTime: '17:30',
          notes: '',
        },
      ]);
    }
  }, [open, todayStr]);

  if (!open) return null;

  // Payroll month validation check
  const isDateInCurrentPayrollMonth = attendanceDate.startsWith(currentMonthPrefix);

  // Time overlap validation logic
  const overlapError = useMemo(() => {
    if (mode === 'single') {
      if (singleStartTime >= singleEndTime) {
        return 'End Time must be after Start Time.';
      }
      return null;
    }

    // Multiple sessions validation
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s.startTime || !s.endTime) {
        return `Session #${i + 1} has missing Start or End Time.`;
      }
      if (s.startTime >= s.endTime) {
        return `Session #${i + 1} End Time (${s.endTime}) must be after Start Time (${s.startTime}).`;
      }
      if (i > 0) {
        const prev = sessions[i - 1];
        if (s.startTime < prev.endTime) {
          return `Time Conflict: Session #${i + 1} starts at ${s.startTime}, before Session #${i} ends at ${prev.endTime}.`;
        }
      }
    }
    return null;
  }, [mode, singleStartTime, singleEndTime, sessions]);

  // Auto-chaining start time when adding next session
  const handleAddSession = () => {
    const lastSession = sessions[sessions.length - 1];
    const nextStart = lastSession ? lastSession.endTime : '09:30';

    // Calculate a default 2-hour window from nextStart
    const [h, m] = nextStart.split(':').map(Number);
    const endH = Math.min(23, h + 2);
    const nextEnd = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    setSessions((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}-${prev.length + 1}`,
        workType: 'Training',
        startTime: nextStart,
        endTime: nextEnd,
        notes: '',
      },
    ]);
  };

  const handleRemoveSession = (id: string) => {
    if (sessions.length <= 1) {
      toast({ variant: 'warning', title: 'Cannot Remove', message: 'At least one session is required in a day.' });
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSession = (id: string, updates: Partial<CorrectionSessionBlock>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDateInCurrentPayrollMonth) {
      toast({
        variant: 'error',
        title: 'Payroll Window Restriction',
        message: 'Attendance corrections can only be submitted for dates within the current payroll month.',
      });
      return;
    }

    if (overlapError) {
      toast({ variant: 'error', title: 'Validation Error', message: overlapError });
      return;
    }

    // Verify batch selection if training
    if (mode === 'single' && singleType === 'Training' && !singleBatchId) {
      toast({ variant: 'error', title: 'Batch Required', message: 'Please select the Training Batch for this session.' });
      return;
    }

    if (mode === 'multiple') {
      const missingBatch = sessions.some((s) => s.workType === 'Training' && !s.batchId);
      if (missingBatch) {
        toast({ variant: 'error', title: 'Batch Required', message: 'Please select a batch for all Training sessions.' });
        return;
      }
    }

    const ok = await confirm({
      title: 'Submit Attendance Correction?',
      message: `Submit full-day attendance correction for ${attendanceDate} to your manager for review?`,
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);

      // Build parsed representation accepted by attendance.service.ts
      let proposedString = '';
      if (mode === 'single') {
        const batchObj = batches.find((b) => b.id === singleBatchId);
        const tag = singleType === 'Training' ? `Training: ${batchObj?.name || 'Batch'}` : singleType;
        proposedString = `${singleStartTime} - ${singleEndTime} [${tag}]`;
      } else {
        const parts = sessions.map((s) => {
          const batchObj = batches.find((b) => b.id === s.batchId);
          const tag = s.workType === 'Training' ? `Training: ${batchObj?.name || 'Batch'}` : s.workType;
          return `${s.startTime} - ${s.endTime} [${tag}${s.notes ? ` - ${s.notes}` : ''}]`;
        });
        proposedString = parts.join(', ');
      }

      const recId = defaultRecordId || `att-${Date.now()}`;
      const reasonVal = reason.trim() || `Full-day correction claim (${mode === 'single' ? '1 session' : `${sessions.length} sessions`})`;

      const res = await attService.requestCorrection(
        recId,
        'attendance_claim',
        proposedString,
        reasonVal,
        { id: user!.id, role: user!.role }
      );

      if (res.ok) {
        toast({
          variant: 'success',
          title: 'Correction Claim Submitted',
          message: `Attendance claim for ${attendanceDate} submitted to Approvals Queue for Manager/CEO review.`,
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({ variant: 'error', title: 'Submission Failed', message: res.error.message });
      }
    } catch (err: any) {
      console.error('Error submitting attendance correction:', err);
      toast({ variant: 'error', title: 'Submission Error', message: err?.message || 'Failed to submit correction.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Attendance Correction Claim">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Desktop Audit Banner Notice */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--primary-50, #eff6ff)',
            border: '1px solid var(--primary-200, #bfdbfe)',
            fontSize: 12,
            color: 'var(--primary-800, #1e40af)',
            fontWeight: 600,
          }}
        >
          💻 Attendance corrections are submitted to the CEO / Manager Approvals Queue for the current payroll month.
        </div>

        {/* Target Attendance Date */}
        <div>
          <label className="kvj-label">
            Attendance Date <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <input
            type="date"
            required
            className="kvj-input"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            style={{ width: '100%' }}
          />
          {!isDateInCurrentPayrollMonth && (
            <div style={{ fontSize: 11, color: 'var(--status-danger, #dc2626)', marginTop: 4 }}>
              ⚠️ Corrections are restricted to the current payroll month ({currentMonthPrefix}).
            </div>
          )}
        </div>

        {/* Mode Selector */}
        <div>
          <label className="kvj-label">Correction Mode</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode('single')}
              style={{
                padding: '10px 8px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: mode === 'single' ? '2px solid var(--primary-600, #2563eb)' : '1px solid var(--border)',
                background: mode === 'single' ? 'var(--primary-50, #eff6ff)' : 'var(--bg-surface)',
                color: mode === 'single' ? 'var(--primary-700, #1d4ed8)' : 'var(--text-secondary)',
                textAlign: 'center',
              }}
            >
              ☀️ Single Session (Standard Day)
            </button>
            <button
              type="button"
              onClick={() => setMode('multiple')}
              style={{
                padding: '10px 8px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: mode === 'multiple' ? '2px solid var(--primary-600, #2563eb)' : '1px solid var(--border)',
                background: mode === 'multiple' ? 'var(--primary-50, #eff6ff)' : 'var(--bg-surface)',
                color: mode === 'multiple' ? 'var(--primary-700, #1d4ed8)' : 'var(--text-secondary)',
                textAlign: 'center',
              }}
            >
              🔄 Multiple Sessions (Split Day)
            </button>
          </div>
        </div>

        {/* MODE A: Single Session */}
        {mode === 'single' && (
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: 'var(--bg-sunken, #f8fafc)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div>
              <label className="kvj-label">Work Type</label>
              <select
                className="kvj-select"
                value={singleType}
                onChange={(e) => setSingleType(e.target.value as WorkSessionType)}
                style={{ width: '100%' }}
              >
                <option value="Office">🏢 Office</option>
                <option value="Remote">💻 Remote</option>
                <option value="Training">🎓 Training (College Batch)</option>
              </select>
            </div>

            {/* Dynamic Batch Selector if Training */}
            {singleType === 'Training' && (
              <div>
                <label className="kvj-label">
                  College / Training Batch <span style={{ color: 'var(--status-danger)' }}>*</span>
                </label>
                <select
                  className="kvj-select"
                  value={singleBatchId}
                  onChange={(e) => setSingleBatchId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="">Select College Batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.code ? `(${b.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="kvj-label">Start Time</label>
                <input
                  type="time"
                  required
                  className="kvj-input"
                  value={singleStartTime}
                  onChange={(e) => setSingleStartTime(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="kvj-label">End Time</label>
                <input
                  type="time"
                  required
                  className="kvj-input"
                  value={singleEndTime}
                  onChange={(e) => setSingleEndTime(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* MODE B: Multiple Sessions */}
        {mode === 'multiple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--bg-sunken, #f8fafc)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-700, #1d4ed8)' }}>
                    Session #{idx + 1}
                  </span>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSession(s.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--status-danger, #dc2626)',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="kvj-label">Work Type</label>
                    <select
                      className="kvj-select"
                      value={s.workType}
                      onChange={(e) => handleUpdateSession(s.id, { workType: e.target.value as WorkSessionType })}
                      style={{ width: '100%' }}
                    >
                      <option value="Office">Office</option>
                      <option value="Remote">Remote</option>
                      <option value="Training">Training</option>
                    </select>
                  </div>

                  {s.workType === 'Training' ? (
                    <div>
                      <label className="kvj-label">Batch *</label>
                      <select
                        className="kvj-select"
                        value={s.batchId || ''}
                        onChange={(e) => handleUpdateSession(s.id, { batchId: e.target.value })}
                        style={{ width: '100%' }}
                        required
                      >
                        <option value="">Select Batch...</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="kvj-label">Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Prep work"
                        className="kvj-input"
                        value={s.notes || ''}
                        onChange={(e) => handleUpdateSession(s.id, { notes: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="kvj-label">Start Time</label>
                    <input
                      type="time"
                      required
                      className="kvj-input"
                      value={s.startTime}
                      onChange={(e) => handleUpdateSession(s.id, { startTime: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="kvj-label">End Time</label>
                    <input
                      type="time"
                      required
                      className="kvj-input"
                      value={s.endTime}
                      onChange={(e) => handleUpdateSession(s.id, { endTime: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              onClick={handleAddSession}
              style={{ justifyContent: 'center', width: '100%' }}
            >
              ➕ Add Another Session (Auto-Chained)
            </Button>
          </div>
        )}

        {/* Overlap Collision Alert Guard */}
        {overlapError && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--status-danger-bg, #fef2f2)',
              border: '1.5px solid var(--status-danger, #ef4444)',
              color: 'var(--status-danger-text, #991b1b)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ⚠️ {overlapError}
          </div>
        )}

        {/* Reason for Correction (Optional as agreed, no required star, no optional tag) */}
        <div>
          <label className="kvj-label">Reason for Correction</label>
          <textarea
            rows={2}
            className="kvj-input"
            placeholder="Describe missed punches, outdoor duty, or session transitions..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !!overlapError || !isDateInCurrentPayrollMonth}>
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
export default AttendanceCorrectionModal;
