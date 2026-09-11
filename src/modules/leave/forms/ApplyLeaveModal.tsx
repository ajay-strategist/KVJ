import React, { useState } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useLeave } from '../hooks/useLeave';
import { googleIntegration } from '../../../shared/integration/google';

export type LeaveShiftType = 'Full Day' | 'Morning Half Day' | 'Afternoon Half Day';

export interface ApplyLeaveModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Calculates net working days between start and end date, strictly
 * excluding Saturdays (6) and Sundays (0) to enforce KVJ's No-Sandwich Policy.
 */
export function calculateWorkingDays(startDate: string, endDate: string, shift: LeaveShiftType): number {
  if (shift === 'Morning Half Day' || shift === 'Afternoon Half Day') {
    return 0.5;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function ApplyLeaveModal({ open, onClose, onSuccess }: ApplyLeaveModalProps) {
  const { user } = useAuth();
  const { applyLeave } = useLeave();
  const { toast } = useNotifications();
  const { confirm } = useDialog();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [leaveType, setLeaveType] = useState<'Casual Leave' | 'Medical Leave'>('Casual Leave');
  const [shift, setShift] = useState<LeaveShiftType>('Full Day');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reason, setReason] = useState<string>('');
  const [medCertFile, setMedCertFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!open) return null;

  const isHalfDay = shift !== 'Full Day';
  const effectiveEndDate = isHalfDay ? startDate : endDate;
  const calculatedDays = calculateWorkingDays(startDate, effectiveEndDate, shift);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate) {
      toast({ variant: 'error', title: 'Start Date Required', message: 'Please select a leave start date.' });
      return;
    }

    if (!isHalfDay && effectiveEndDate < startDate) {
      toast({ variant: 'error', title: 'Invalid Date Range', message: 'End date cannot be earlier than start date.' });
      return;
    }

    if (!reason.trim()) {
      toast({ variant: 'error', title: 'Reason Required', message: 'Please provide a reason for the leave application.' });
      return;
    }

    const ok = await confirm({
      title: 'Submit Leave Application?',
      message: `Apply for ${calculatedDays} day(s) of ${leaveType} (${shift})?`,
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      let certUrl: string | undefined = undefined;

      if (medCertFile) {
        try {
          const base64Content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              resolve(res.includes(',') ? res.split(',')[1] : res);
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(medCertFile);
          });

          const driveRes = await googleIntegration.uploadMedicalCertificateWithMetadata({
            date: startDate,
            employeeName: user?.fullName || 'Employee',
            leaveType,
            startDate,
            endDate: effectiveEndDate,
            originalFileName: medCertFile.name,
            mimeType: medCertFile.type || 'application/pdf',
            base64Content,
            uploadedBy: user?.fullName || 'Employee',
          });
          if (driveRes && driveRes.googleDriveViewUrl) {
            certUrl = driveRes.googleDriveViewUrl;
          }
        } catch (uploadErr) {
          console.warn('Medical certificate upload warning:', uploadErr);
        }
      }

      const halfDayShift = shift === 'Morning Half Day' ? 'Morning' : shift === 'Afternoon Half Day' ? 'Evening' : undefined;

      const res = await applyLeave(
        leaveType,
        startDate,
        effectiveEndDate,
        reason.trim(),
        isHalfDay,
        certUrl,
        halfDayShift
      );

      if (res.ok) {
        toast({
          variant: 'success',
          title: 'Leave Application Submitted',
          message: medCertFile
            ? `Your ${leaveType} for ${calculatedDays} day(s) was submitted with medical certificate attached.`
            : `Your ${leaveType} for ${calculatedDays} day(s) was submitted successfully.`,
        });
        // Reset form
        setLeaveType('Casual Leave');
        setShift('Full Day');
        setStartDate(todayStr);
        setEndDate(todayStr);
        setReason('');
        setMedCertFile(null);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({ variant: 'error', title: 'Submission Failed', message: res.error });
      }
    } catch (err: any) {
      console.error('Leave application error:', err);
      toast({ variant: 'error', title: 'Application Error', message: err?.message || 'Failed to submit leave.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Apply for Leave">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Leave Type */}
        <div>
          <label className="kvj-label">
            Leave Type <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <select
            className="kvj-select"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as any)}
            style={{ width: '100%' }}
          >
            <option value="Casual Leave">Casual Leave (CL)</option>
            <option value="Medical Leave">Medical Leave (ML)</option>
          </select>
        </div>

        {/* Shift / Duration Selector */}
        <div>
          <label className="kvj-label">
            Duration / Shift <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(['Full Day', 'Morning Half Day', 'Afternoon Half Day'] as LeaveShiftType[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setShift(s)}
                style={{
                  padding: '10px 6px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: shift === s ? '2px solid var(--primary-600, #2563eb)' : '1px solid var(--border)',
                  background: shift === s ? 'var(--primary-50, #eff6ff)' : 'var(--bg-surface)',
                  color: shift === s ? 'var(--primary-700, #1d4ed8)' : 'var(--text-secondary)',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {s === 'Full Day' ? '☀️ Full Day' : s === 'Morning Half Day' ? '🌅 Morning' : '🌇 Afternoon'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {shift === 'Morning Half Day' && 'Morning Half Day: Self-cancellation cutoff before 10:30 AM.'}
            {shift === 'Afternoon Half Day' && 'Afternoon Half Day: Self-cancellation cutoff before 03:00 PM.'}
            {shift === 'Full Day' && 'Full Day: Deducts 1.0 day per working day.'}
          </div>
        </div>

        {/* Date Selection */}
        {isHalfDay ? (
          <div>
            <label className="kvj-label">
              Leave Date <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <input
              type="date"
              className="kvj-input"
              required
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setEndDate(e.target.value);
              }}
              style={{ width: '100%' }}
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="kvj-label">
                Start Date <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <input
                type="date"
                className="kvj-input"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="kvj-label">
                End Date <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <input
                type="date"
                className="kvj-input"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}

        {/* Live Calculation Badge (No Sandwich Rule Indicator) */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--bg-sunken, #f8fafc)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Total Leave Deduction:
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: calculatedDays > 0 ? 'var(--primary-600, #2563eb)' : 'var(--text-muted)',
            }}
          >
            {calculatedDays} Working Day{calculatedDays === 1 ? '' : 's'}
          </span>
        </div>
        {!isHalfDay && calculatedDays > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10 }}>
            ℹ️ Saturdays and Sundays are excluded from deduction (No Sandwich Policy).
          </div>
        )}

        {/* Medical Certificate (Conditional for Medical Leave only) */}
        {leaveType === 'Medical Leave' && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'var(--bg-sunken, #f8fafc)',
              border: '1px dashed var(--border)',
            }}
          >
            <label className="kvj-label">Medical Certificate</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setMedCertFile(e.target.files?.[0] || null)}
              className="kvj-input"
              style={{ width: '100%', fontSize: 12 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Optional upfront; you can also upload the doctor certificate after returning to office.
            </div>
          </div>
        )}

        {/* Reason for Leave */}
        <div>
          <label className="kvj-label">
            Reason for Leave <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <textarea
            required
            rows={3}
            className="kvj-input"
            placeholder="Brief reason for your supervisor's review..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || calculatedDays === 0}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
export default ApplyLeaveModal;
