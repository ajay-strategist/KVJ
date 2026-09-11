import React, { useState } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import { localDateTimeToUtcIso } from '../../../shared/utils/date';

export interface ForceClockOutModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  record: any | null;
}

export function ForceClockOutModal({ open, onClose, onSuccess, record }: ForceClockOutModalProps) {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { confirm } = useDialog();

  const [clockOutTime, setClockOutTime] = useState<string>('17:30');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!open || !record) return null;

  const workDate = record.work_date || record.workDate || new Date().toISOString().slice(0, 10);
  const employeeName = record.employee_name || record.employeeName || 'Employee';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await confirm({
      title: 'Confirm Force Clock Out?',
      message: `Force close attendance session for ${employeeName} on ${workDate} at ${clockOutTime}?`,
    });
    if (!ok) return;

    setLoading(true);
    try {
      const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
      const outTimeIso = localDateTimeToUtcIso(workDate, clockOutTime || '17:30');

      const res = await attService.forceClockOutSession(
        record.id,
        outTimeIso,
        notes.trim() || 'Admin force clock out',
        { id: user!.id, role: user!.role }
      );

      if (res.ok) {
        toast({
          variant: 'success',
          title: 'Session Force Closed',
          message: `Session for ${employeeName} has been closed at ${clockOutTime}.`,
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast({ variant: 'error', title: 'Action Failed', message: res.error.message });
      }
    } catch (err: any) {
      console.error('Error force clocking out session:', err);
      toast({ variant: 'error', title: 'Error', message: err?.message || 'Could not close session.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Force Clock Out Session">
      <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'var(--status-danger-bg, #fef2f2)',
            border: '1px solid var(--status-danger, #ef4444)',
            fontSize: 12,
            color: 'var(--status-danger-text, #991b1b)',
          }}
        >
          ⚠️ This action will terminate the employee's running attendance session and finalize net hours.
        </div>

        <div>
          <label className="kvj-label">Employee</label>
          <input type="text" disabled className="kvj-input" value={employeeName} style={{ width: '100%' }} />
        </div>

        <div>
          <label className="kvj-label">Target Work Date</label>
          <input type="date" disabled className="kvj-input" value={workDate} style={{ width: '100%' }} />
        </div>

        <div>
          <label className="kvj-label">
            Clock Out Time <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <input
            type="time"
            required
            className="kvj-input"
            value={clockOutTime}
            onChange={(e) => setClockOutTime(e.target.value)}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Defaults to standard shift end time (05:30 PM).
          </div>
        </div>

        <div>
          <label className="kvj-label">Supervisor / Admin Remarks</label>
          <textarea
            rows={3}
            className="kvj-input"
            placeholder="Reason for force closing session..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={loading}>
            {loading ? 'Closing...' : '🔴 Confirm Force Clock Out'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
export default ForceClockOutModal;
