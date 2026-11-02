import React, { useState } from 'react';
import { useTraining } from '../../training/hooks/useTraining';
import { cleanBatchCode } from '../../training/utils/batch-formatter';
import { SearchableBatchSelect } from '../../../shared/components/SearchableBatchSelect';
import { supabase } from '../../../shared/integration/supabase';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';

function batchDisplayName(b?: {
  college?: string; program?: string; academicYear?: string;
  batchNo?: string; trainingName?: string; code?: string;
} | null): string {
  if (!b) return 'Training Batch';
  const cleaned = cleanBatchCode(b.code, b.batchNo);
  if (cleaned) return cleaned;
  const parts = [b.college, b.program, b.academicYear, b.batchNo].filter(Boolean);
  if (parts.length) return parts.join(' - ');
  return b.trainingName || 'Training Batch';
}

export interface SplitSessionInput {
  id: string;
  classification: string;
  location: string;
  organisationsVisited: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export interface SubmitAttendanceDrawerFormProps {
  onClose: () => void;
  currentEmployee: any;
  user: any;
  toast: any;
}

export function SubmitAttendanceDrawerForm({
  onClose,
  currentEmployee,
  user,
  toast,
}: SubmitAttendanceDrawerFormProps) {
  const [date, setDate] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const { batches } = useTraining({ fetchStudents: false, fetchCourses: false, fetchEnrollments: false });
  const [sessions, setSessions] = useState<SplitSessionInput[]>([
    {
      id: 'sess-1',
      classification: 'Training',
      location: '',
      organisationsVisited: '',
      startTime: '08:35 AM',
      endTime: '10:35 AM',
      notes: '',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const addSession = () => {
    setSessions((prev) => [
      ...prev,
      {
        id: `sess-${Date.now()}-${prev.length + 1}`,
        classification: 'Office',
        location: '',
        organisationsVisited: '',
        startTime: '11:00 AM',
        endTime: '02:30 PM',
        notes: '',
      },
    ]);
  };

  const removeSession = (id: string) => {
    if (sessions.length === 1) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSession = (id: string, patch: Partial<SplitSessionInput>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const targetEmpId = currentEmployee?.id || user?.id || '';
      let recordId = String(Date.now());

      try {
        const { data } = await supabase
          .from('flwdsk_attendance')
          .select('id')
          .eq('employee_id', targetEmpId)
          .eq('work_date', date)
          .limit(1);
        if (data && data[0]) {
          recordId = data[0].id;
        }
      } catch (err) {
        console.warn('Could not find existing attendance record id:', err);
      }

      // Format multi-session payload for the approval parser
      const sessionParts = sessions.map((s) => {
        let locText = 'Office Work';
        if (s.classification === 'Training') {
          const bObj = batches.find((b) => b.code === s.location || b.id === s.location);
          locText = bObj ? batchDisplayName(bObj) : s.location || 'Training Session';
        } else if (s.classification === 'Marketing') {
          locText = s.organisationsVisited || 'Marketing Visit';
        } else if (s.classification === 'Work From Home') {
          locText = 'Remote / WFH';
        }

        const tag = `[${s.classification}: ${locText}${s.notes ? ` - ${s.notes}` : ''}]`;
        return `${s.startTime} - ${s.endTime} ${tag}`;
      });

      const proposedVal = `${date} (${sessionParts.join(', ')})`;
      const reasonVal = `Split Session Claim (${sessions.length} sessions). Date: ${date}`;

      const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
      await attService.requestCorrection(
        recordId,
        'attendance_claim',
        proposedVal,
        reasonVal,
        { id: targetEmpId, role: 'Employee' }
      );

      toast({
        variant: 'success',
        title: 'Attendance Claim Submitted',
        message: `Split-session claim (${sessions.length} session(s)) for ${date} sent to Approvals Queue for review.`,
      });
      onClose();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Submission Failed', message: err.message || 'Could not submit claim.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>
          Attendance Date <span style={{ color: 'var(--status-danger)' }}>*</span>
        </label>
        <input
          type="date"
          required
          className="kvj-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
            Work Sessions ({sessions.length})
          </span>
          <button
            type="button"
            onClick={addSession}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--brand)',
              background: 'var(--brand-muted)',
              color: 'var(--brand)',
              cursor: 'pointer',
            }}
          >
            + Add Split Session
          </button>
        </div>

        {sessions.map((sess, idx) => (
          <div
            key={sess.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              background: 'var(--bg-sunken)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>
                Session #{idx + 1}
              </span>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSession(sess.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--status-danger)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✕ Remove
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Start Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 08:35 AM"
                  className="kvj-input"
                  value={sess.startTime}
                  onChange={(e) => updateSession(sess.id, { startTime: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>End Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10:35 AM"
                  className="kvj-input"
                  value={sess.endTime}
                  onChange={(e) => updateSession(sess.id, { endTime: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Session Type</label>
              <select
                className="kvj-select"
                value={sess.classification}
                onChange={(e) => updateSession(sess.id, { classification: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                <option value="Training">Training Batch Session</option>
                <option value="Office">Office Work</option>
                <option value="Work From Home">Work From Home / Remote</option>
                <option value="Marketing">Marketing Visit</option>
              </select>
            </div>

            {sess.classification === 'Training' && (
              <div>
                <SearchableBatchSelect
                  label="Training Batch"
                  batches={batches as any}
                  value={sess.location}
                  onChange={(id, b) => {
                    const code = b ? (b.code || id) : id;
                    updateSession(sess.id, { location: code });
                  }}
                  placeholder="Select Training Batch..."
                />
              </div>
            )}

            {sess.classification === 'Marketing' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Organisations Visited</label>
                <input
                  type="text"
                  placeholder="e.g. Christ College"
                  className="kvj-input"
                  value={sess.organisationsVisited}
                  onChange={(e) => updateSession(sess.id, { organisationsVisited: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notes / Reason</label>
              <input
                type="text"
                placeholder="Optional notes..."
                className="kvj-input"
                value={sess.notes}
                onChange={(e) => updateSession(sess.id, { notes: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-panel)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--brand)',
            color: '#fff',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Submitting...' : 'Submit Claim'}
        </button>
      </div>
    </form>
  );
}

export default SubmitAttendanceDrawerForm;

