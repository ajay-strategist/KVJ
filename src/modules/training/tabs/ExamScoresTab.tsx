import React, { useRef } from 'react';
import { Card, Button, Badge } from '../../../shared/ui/components';
import type { StudentRecord } from '../types/batch-management.types';

export interface ExamScoresTabProps {
  mode: 'final-exam' | 'retest';
  students: StudentRecord[];
  selectedBatchId: string;
  batchStudentIds: Set<string>;
  activeCourse: any;
  activeBatch: any;
  selectedAttemptTypes: Record<string, string>;
  onSetSelectedAttemptTypes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onUpdateStudent: (student: StudentRecord) => void;
  onSaveStudentToDb: (student: StudentRecord) => void;
  onRemoveStudent: (studentId: string) => void;
  onAddStudent: () => void;
  onOpenReconciliation: () => void;
  onUploadMarks: (file: File) => void;
  onSaveRetestPaymentLedger: (studentId: string, status: 'Paid' | 'Pending') => Promise<void>;
  toast: (opts: { variant: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
  isExecutive: boolean;
}

export const ExamScoresTab: React.FC<ExamScoresTabProps> = ({
  mode,
  students,
  selectedBatchId,
  batchStudentIds,
  activeCourse,
  activeBatch,
  selectedAttemptTypes,
  onSetSelectedAttemptTypes,
  onUpdateStudent,
  onSaveStudentToDb,
  onRemoveStudent,
  onAddStudent,
  onOpenReconciliation,
  onUploadMarks,
  onSaveRetestPaymentLedger,
  toast,
  isExecutive,
}) => {
  const examMarkFileRef = useRef<HTMLInputElement>(null);

  if (mode === 'retest') {
    return (
      <Card style={{ padding: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>🔄 Retest Candidate Management</strong>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Manage retest candidates, payment status, marks, and vouchers. Retest marks entry is unlocked.
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '1.5px solid var(--border)' }}>
                <th style={{ padding: 12, minWidth: 130 }}>Phone Number</th>
                <th style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 10, minWidth: 160 }}>
                  Student Name
                </th>
                <th style={{ padding: 12, minWidth: 200 }}>Payment Status</th>
                <th style={{ padding: 12, textAlign: 'center', minWidth: 140 }}>Retest Mark (Unlocked)</th>
                <th style={{ padding: 12, minWidth: 180 }}>New Retest Voucher ID</th>
                <th style={{ padding: 12, textAlign: 'center', minWidth: 140 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.filter((s) => !selectedBatchId || batchStudentIds.has(s.id)).map((s) => {
                const pStatus = s.retestPaymentStatus === 'Paid' ? 'Paid' : 'Pending';
                const collectedAmt = s.retestCollectedAmount !== undefined ? s.retestCollectedAmount : 0;
                const retestVouch = s.retestVoucherId || s.voucherId || `VOUCH-RETEST-${s.id.replace('s-', '10')}`;

                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* 1. Phone Number */}
                    <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                      {s.phone}
                    </td>

                    {/* 2. Student Name */}
                    <td style={{ padding: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                      {s.photo} {s.name}
                    </td>

                    {/* 3. Payment Status & Fee Reference (Informational - does not block mark entry) */}
                    <td style={{ padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <select
                          value={pStatus}
                          onChange={async (e) => {
                            const nextP = e.target.value as 'Paid' | 'Pending';
                            const updated = { ...s, retestPaymentStatus: nextP };
                            onUpdateStudent(updated);
                            await onSaveRetestPaymentLedger(s.id, nextP);
                            onSaveStudentToDb(updated);
                          }}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '3px 6px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-surface)',
                            color: pStatus === 'Paid' ? 'var(--status-success)' : 'var(--status-warning)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="Paid">Verified</option>
                          <option value="Pending">Pending Verification</option>
                        </select>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }} title="External Fee reference">₹</span>
                          <input
                            type="number"
                            className="kvj-input"
                            value={collectedAmt}
                            onChange={(e) => {
                              const amt = Number(e.target.value);
                              onUpdateStudent({ ...s, retestCollectedAmount: amt });
                            }}
                            onBlur={async () => {
                              const latest = students.find((st) => st.id === s.id);
                              if (latest) {
                                const resolvedStatus = latest.retestPaymentStatus === 'Paid' ? 'Paid' : 'Pending';
                                await onSaveRetestPaymentLedger(latest.id, resolvedStatus);
                                onSaveStudentToDb(latest);
                              }
                            }}
                            placeholder="Fee Ref"
                            title="External Payment Fee Amount Reference"
                            style={{ fontSize: 12, padding: '3px 6px', width: 70, fontWeight: 700 }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 4. Retest Mark - UNLOCKED! */}
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <input
                        type="number"
                        className="kvj-input"
                        value={s.retestScore || ''}
                        onChange={(e) => {
                          const markVal = e.target.value === '' ? 0 : Number(e.target.value);
                          onSetSelectedAttemptTypes((prev) => ({ ...prev, [s.id]: 'Retest' }));
                          onUpdateStudent({
                            ...s,
                            retestScore: markVal,
                            examAttemptCount: 2,
                          });
                        }}
                        onBlur={() => onSaveStudentToDb(s)}
                        placeholder="Mark"
                        style={{ fontSize: 12, padding: '3px 6px', width: 65, textAlign: 'center', fontWeight: 700 }}
                      />
                    </td>

                    {/* 5. New Retest Voucher ID */}
                    <td style={{ padding: 12 }}>
                      <input
                        type="text"
                        className="kvj-input"
                        value={retestVouch}
                        onChange={(e) => {
                          const vCode = e.target.value;
                          onUpdateStudent({ ...s, retestVoucherId: vCode });
                        }}
                        onBlur={() => onSaveStudentToDb(s)}
                        placeholder="Retest Voucher"
                        style={{ fontSize: 12, padding: '3px 6px', width: '100%', minWidth: 150 }}
                      />
                    </td>

                    {/* 6. Action */}
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onSaveStudentToDb(s)}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                      >
                        💾 Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  // mode === 'final-exam'
  const batchFiltered = students.filter((s) => !selectedBatchId || batchStudentIds.has(s.id));
  const attended = batchFiltered.filter((s) => (s.finalExam || 0) > 0);
  const initialGroup = attended.filter((s) => !((s.examAttemptCount && s.examAttemptCount > 1) || s.retestApproved));
  const retestGroup = attended.filter((s) => (s.examAttemptCount && s.examAttemptCount > 1) || s.retestApproved);

  const renderRow = (s: StudentRecord) => {
    const examDateVal = s.examDate || '2026-07-25';
    const collegeVal = s.college || 'Christ University';
    const courseVal = activeCourse?.title || activeBatch?.trainingName || s.course || 'Course';
    const isRetestAttempt = (s.examAttemptCount && s.examAttemptCount > 1) || (s.retestScore && s.retestScore > 0) || s.retestApproved || (s.finalExam > 0 && s.finalExam < 60);
    const hasPassed = s.finalExam >= 60;
    const firstVoucher = s.voucherId || `VOUCH-CHRIST-${s.id.replace('s-', '10')}`;

    return (
      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
        {/* 1. Date */}
        <td style={{ padding: 12 }}>
          <input
            type="date"
            className="kvj-input"
            value={examDateVal}
            onChange={(e) => {
              const newD = e.target.value;
              const updated = { ...s, examDate: newD };
              onUpdateStudent(updated);
              onSaveStudentToDb(updated);
            }}
            style={{ fontSize: 12, padding: '3px 6px', width: 125 }}
          />
        </td>

        {/* 2. College */}
        <td style={{ padding: 12 }}>
          <input
            type="text"
            className="kvj-input"
            value={collegeVal}
            onChange={(e) => {
              const val = e.target.value;
              onUpdateStudent({ ...s, college: val });
            }}
            onBlur={() => onSaveStudentToDb(s)}
            style={{ fontSize: 12, padding: '3px 6px', width: 140, fontWeight: 600 }}
          />
        </td>

        {/* 3. Phone */}
        <td style={{ padding: 12 }}>
          <input
            type="text"
            className="kvj-input"
            value={s.phone}
            onChange={(e) => onUpdateStudent({ ...s, phone: e.target.value })}
            onBlur={() => onSaveStudentToDb(s)}
            placeholder="+91 98765 00000"
            style={{ fontSize: 12, padding: '3px 6px', width: 120 }}
          />
        </td>

        {/* 4. Student Name */}
        <td style={{ padding: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
          {s.photo} {s.name}
        </td>

        {/* 5. Course */}
        <td style={{ padding: 12, color: 'var(--text-secondary)' }}>
          {courseVal}
        </td>

        {/* 6. Exam Mark */}
        <td style={{ padding: 12, textAlign: 'center' }}>
          <input
            type="number"
            className="kvj-input"
            value={s.finalExam || ''}
            onChange={(e) => {
              const markVal = e.target.value === '' ? 0 : Number(e.target.value);
              onUpdateStudent({ ...s, finalExam: markVal });
            }}
            onBlur={() => onSaveStudentToDb(s)}
            placeholder="Score"
            style={{ fontSize: 12, padding: '3px 6px', width: 60, textAlign: 'center', fontWeight: 700 }}
          />
        </td>

        {/* 7. Test / Retest */}
        <td style={{ padding: 12, textAlign: 'center' }}>
          <Badge tone={isRetestAttempt ? 'warning' : 'success'}>
            {isRetestAttempt ? 'Retest' : 'Initial Test'}
          </Badge>
        </td>

        {/* 8. Voucher ID */}
        <td style={{ padding: 12 }}>
          <input
            type="text"
            className="kvj-input"
            value={firstVoucher}
            onChange={(e) => onUpdateStudent({ ...s, voucherId: e.target.value })}
            onBlur={() => onSaveStudentToDb(s)}
            style={{ fontSize: 12, padding: '3px 6px', width: '100%', minWidth: 150 }}
          />
        </td>

        {/* 9. Action */}
        <td style={{ padding: 12, textAlign: 'center' }}>
          {isExecutive && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRemoveStudent(s.id)}
              style={{ fontSize: 11, padding: '3px 6px' }}
            >
              🗑️
            </Button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <Card style={{ padding: 18, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>🎓 Final Exam Management Registry</strong>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Track exam dates, scores, course details, attempt status, and voucher codes.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={examMarkFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadMarks(f);
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => examMarkFileRef.current?.click()} style={{ fontSize: 12 }}>
            📤 Upload Exam Marks
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpenReconciliation}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            🔍 Reconcile Attempts
          </Button>
          <Button size="sm" onClick={onAddStudent} style={{ fontSize: 12 }}>
            ➕ Add Student
          </Button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
          <thead>
            <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '1.5px solid var(--border)' }}>
              <th style={{ padding: 12, minWidth: 135 }}>Date</th>
              <th style={{ padding: 12, minWidth: 150 }}>College</th>
              <th style={{ padding: 12, minWidth: 130 }}>Phone Number</th>
              <th style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 10, minWidth: 160 }}>
                Student Name
              </th>
              <th style={{ padding: 12, minWidth: 160 }}>Course</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 120 }}>Exam Mark</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 165 }}>Test / Retest</th>
              <th style={{ padding: 12, minWidth: 200 }}>Voucher ID</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 80 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {initialGroup.map(renderRow)}
            {retestGroup.length > 0 && (
              <tr>
                <td colSpan={9} style={{ background: 'var(--bg-sunken)', padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  🔄 Retest Candidates ({retestGroup.length})
                </td>
              </tr>
            )}
            {retestGroup.map(renderRow)}
            {attended.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No exam records found for this batch. Click "➕ Add Student" or "📤 Upload Exam Marks" to add records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
