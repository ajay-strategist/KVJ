import React, { useState } from 'react';
import { Card, Button, Badge } from '../../../shared/ui/components';
import type { StudentRecord, EligibilityFilter, SortableCol } from '../types/batch-management.types';

export interface StudentsTabProps {
  students: StudentRecord[];
  selectedBatchId: string;
  batchStudentIds: Set<string>;
  activeBatch: any;
  considerAttendance: boolean;
  attendanceThreshold: number;
  eligibilityCriteria: Array<{ assessment: SortableCol; threshold: number }>;
  courseMaxMarks: number;
  coursePassPct: number;
  isExecutive: boolean;
  onAssignVoucher: (studentId: string, val: string) => void;
  onNotifyVoucher: (studentName: string, voucherId: string) => void;
  onRemoveStudent: (studentId: string) => void;
  onBatchRemoveStudents: (studentIds: string[]) => void;
  onDedupeStudents: () => void;
  onSaveEligibilityConfig: (considerAttendance: boolean, threshold: number, criteria: any) => void;
  onSetConsiderAttendance: (val: boolean) => void;
  onSetAttendanceThreshold: (val: number) => void;
  onSetCourseMaxMarks: (val: number) => void;
  onSetCoursePassPct: (val: number) => void;
  onAddEligCriterion: () => void;
  onUpdateEligCriterion: (idx: number, field: 'assessment' | 'threshold', val: any) => void;
  onRemoveEligCriterion: (idx: number) => void;
  assessmentLabelMap: Record<string, string>;
  onOpenUploadModal: () => void;
  onOpenAddStudentModal: () => void;
  onOpenUploadVoucherModal: () => void;
  onDownloadVoucherTemplate: () => void;
  onDownloadPDF: () => void;
  onOpenDailyReport: () => void;
  onOpenBulkEmail: () => void;
  canViewDailyReport: boolean;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
  selectedBatchId,
  batchStudentIds,
  activeBatch,
  considerAttendance,
  attendanceThreshold,
  eligibilityCriteria,
  courseMaxMarks,
  coursePassPct,
  isExecutive,
  onAssignVoucher,
  onNotifyVoucher,
  onRemoveStudent,
  onBatchRemoveStudents,
  onDedupeStudents,
  onSaveEligibilityConfig,
  onSetConsiderAttendance,
  onSetAttendanceThreshold,
  onSetCourseMaxMarks,
  onSetCoursePassPct,
  onAddEligCriterion,
  onUpdateEligCriterion,
  onRemoveEligCriterion,
  assessmentLabelMap,
  onOpenUploadModal,
  onOpenAddStudentModal,
  onOpenUploadVoucherModal,
  onDownloadVoucherTemplate,
  onDownloadPDF,
  onOpenDailyReport,
  onOpenBulkEmail,
  canViewDailyReport,
}) => {
  const [matrixEligFilter, setMatrixEligFilter] = useState<EligibilityFilter>('all');
  const [selectedMatrixIds, setSelectedMatrixIds] = useState<Set<string>>(new Set());
  const [showEligibilityPanel, setShowEligibilityPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [matrixSortLevels, setMatrixSortLevels] = useState<Array<{ col: SortableCol; dir: 'asc' | 'desc' }>>([]);
  const [activeChecklistStudentId, setActiveChecklistStudentId] = useState<string | null>(null);
  const [confirmRemoveStudentId, setConfirmRemoveStudentId] = useState<string | null>(null);
  const [batchRemovingMatrix, setBatchRemovingMatrix] = useState(false);

  const isStudentEligible = (s: StudentRecord) => {
    if (considerAttendance && s.attendancePct < attendanceThreshold) return false;
    for (const crit of eligibilityCriteria) {
      const mark = (s[crit.assessment] as number) || 0;
      if (mark < crit.threshold) return false;
    }
    return true;
  };

  const filtered = students.filter((s) => {
    if (selectedBatchId && !batchStudentIds.has(s.id)) return false;
    if (matrixEligFilter === 'all') return true;
    const elig = isStudentEligible(s);
    return matrixEligFilter === 'eligible' ? elig : !elig;
  });

  const sorted = matrixSortLevels.length > 0
    ? [...filtered].sort((a, b) => {
        for (const lvl of matrixSortLevels) {
          const valA = (a[lvl.col] as number) || 0;
          const valB = (b[lvl.col] as number) || 0;
          if (valA !== valB) return lvl.dir === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
      })
    : filtered;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMatrixIds(new Set(sorted.map((s) => s.id)));
    } else {
      setSelectedMatrixIds(new Set());
    }
  };

  const handleBatchDelete = async () => {
    if (selectedMatrixIds.size === 0) return;
    setBatchRemovingMatrix(true);
    try {
      await onBatchRemoveStudents(Array.from(selectedMatrixIds));
      setSelectedMatrixIds(new Set());
    } finally {
      setBatchRemovingMatrix(false);
    }
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* ─── Toolbar: Filter + Sort Button + Eligibility Config ─── */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Left: Filter & Actions */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>🔍 Filter:</span>
              <select
                className="kvj-input"
                value={matrixEligFilter}
                onChange={(e) => setMatrixEligFilter(e.target.value as EligibilityFilter)}
                style={{ fontSize: 12, padding: '4px 8px', minWidth: 130, fontWeight: 600 }}
              >
                <option value="all">All Students</option>
                <option value="eligible">✅ Eligible Only</option>
                <option value="not-eligible">❌ Not Eligible Only</option>
              </select>
            </div>

            {isExecutive && (
              <button
                type="button"
                onClick={onDedupeStudents}
                title="Find and remove duplicate students"
                style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                  background: 'transparent', color: 'var(--status-danger)',
                  border: '1px solid var(--status-danger)',
                }}
              >
                🧹 Remove Duplicates
              </button>
            )}

            {isExecutive && selectedMatrixIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={batchRemovingMatrix}
                style={{
                  fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700,
                  cursor: batchRemovingMatrix ? 'not-allowed' : 'pointer',
                  background: 'var(--status-danger)', color: '#fff',
                  border: '1px solid var(--status-danger)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: batchRemovingMatrix ? 0.7 : 1,
                }}
              >
                {batchRemovingMatrix ? `⏳ Removing ${selectedMatrixIds.size}…` : `🗑️ Delete Selected (${selectedMatrixIds.size})`}
              </button>
            )}
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setShowEligibilityPanel((p) => !p);
                if (showSortPanel) setShowSortPanel(false);
              }}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                border: showEligibilityPanel ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                background: showEligibilityPanel ? 'var(--brand)' : 'var(--bg-surface)',
                color: showEligibilityPanel ? '#fff' : 'var(--text-primary)',
                transition: 'all 150ms',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ⚙️ Eligibility Criteria {showEligibilityPanel ? '▲' : '▼'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowSortPanel((p) => !p);
                if (showEligibilityPanel) setShowEligibilityPanel(false);
              }}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
                border: matrixSortLevels.length > 0 ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                background: matrixSortLevels.length > 0 ? 'var(--brand)' : 'var(--bg-surface)',
                color: matrixSortLevels.length > 0 ? '#fff' : 'var(--text-primary)',
                transition: 'all 150ms',
              }}
            >
              ⇅ Sort Columns {matrixSortLevels.length > 0 ? `(${matrixSortLevels.length})` : ''} {showSortPanel ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* ─── Eligibility Panel (collapsible) ─── */}
        {showEligibilityPanel && (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 10, border: '1px solid var(--brand)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>⚙️ Final Exam Eligibility Criteria (Customizable per batch)</strong>
              <button
                type="button"
                onClick={onAddEligCriterion}
                disabled={eligibilityCriteria.length >= 3}
                style={{ fontSize: 12, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--brand)', background: 'var(--brand)', color: '#fff', cursor: eligibilityCriteria.length >= 3 ? 'not-allowed' : 'pointer', opacity: eligibilityCriteria.length >= 3 ? 0.5 : 1 }}
              >
                ➕ Add Assessment
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {/* Attendance threshold */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={considerAttendance}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onSetConsiderAttendance(checked);
                      onSaveEligibilityConfig(checked, attendanceThreshold, eligibilityCriteria);
                    }}
                  />
                  📊 Attendance
                </label>
                {considerAttendance && (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                    <input
                      type="number"
                      className="kvj-input"
                      value={attendanceThreshold}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onSetAttendanceThreshold(val);
                        onSaveEligibilityConfig(considerAttendance, val, eligibilityCriteria);
                      }}
                      min={0}
                      max={100}
                      style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                  </>
                )}
                {!considerAttendance && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontStyle: 'italic' }}>(Not Considered)</span>
                )}
              </div>

              {/* Course Max Marks & Pass % */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🎓 Max Marks</span>
                <input
                  type="number"
                  className="kvj-input"
                  value={courseMaxMarks}
                  onChange={(e) => onSetCourseMaxMarks(Number(e.target.value))}
                  min={1}
                  style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>Pass %</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                <input
                  type="number"
                  className="kvj-input"
                  value={coursePassPct}
                  onChange={(e) => onSetCoursePassPct(Number(e.target.value))}
                  min={0}
                  max={100}
                  style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 'auto' }}>
                  Pass: {Math.round((courseMaxMarks * coursePassPct) / 100)}m
                </span>
              </div>

              {/* Assessment criteria */}
              {eligibilityCriteria.map((crit, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', flex: '1 1 270px' }}>
                  <select
                    className="kvj-input"
                    value={crit.assessment}
                    onChange={(e) => onUpdateEligCriterion(idx, 'assessment', e.target.value as SortableCol)}
                    style={{ fontSize: 12, padding: '3px 6px', fontWeight: 600 }}
                  >
                    {(['ass1', 'ass2', 'ass3'] as SortableCol[]).map((a) => (
                      <option key={a} value={a} disabled={eligibilityCriteria.some((c, i) => i !== idx && c.assessment === a)}>
                        {assessmentLabelMap[a] || a}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>≥</span>
                  <input
                    type="number"
                    className="kvj-input"
                    value={crit.threshold}
                    onChange={(e) => onUpdateEligCriterion(idx, 'threshold', Number(e.target.value))}
                    min={0}
                    max={100}
                    style={{ fontSize: 12, padding: '3px 6px', width: 55, textAlign: 'center', fontWeight: 700, borderRadius: 5 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>marks</span>
                  <button
                    type="button"
                    onClick={() => onRemoveEligCriterion(idx)}
                    style={{ fontSize: 13, padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--status-danger)', marginLeft: 'auto' }}
                  >🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Student Performance Matrix Table ─── */}
      <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
          <thead>
            <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '1.5px solid var(--border)' }}>
              {isExecutive && (
                <th style={{ padding: '12px 10px', width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={sorted.length > 0 && selectedMatrixIds.size === sorted.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    style={{ cursor: 'pointer', width: 15, height: 15 }}
                  />
                </th>
              )}
              <th style={{ padding: 12, textAlign: 'center', minWidth: 65 }}>Photo</th>
              <th style={{ padding: 12, position: 'sticky', left: 0, background: 'var(--bg-sunken)', zIndex: 10, minWidth: 160, textAlign: 'left' }}>Student Name</th>
              <th style={{ padding: 12, textAlign: 'left', minWidth: 120 }}>Phone</th>
              <th style={{ padding: 12, textAlign: 'left', minWidth: 160 }}>Email</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 80 }}>Attendance</th>
              <th style={{ padding: 12, textAlign: 'left', minWidth: 130 }}>Exam Eligibility</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Ass 1</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Ass 2</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Ass 3</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 80 }}>Final Exam</th>
              <th style={{ padding: 12, textAlign: 'center', minWidth: 155 }}>Final Result</th>
              <th style={{ padding: 12, minWidth: 240, textAlign: 'left' }}>Voucher ID Management</th>
              {isExecutive && <th style={{ padding: 12, textAlign: 'center', minWidth: 70 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const eligible = isStudentEligible(s);
              const hasTakenExam = (s.finalExam || 0) > 0 || (s.retestScore || 0) > 0;
              const examScore = Math.max(s.finalExam || 0, s.retestScore || 0);
              const requiredPassScore = Math.round((courseMaxMarks * coursePassPct) / 100);
              const isCoursePassed = hasTakenExam && examScore >= requiredPassScore;
              const isCourseFailed = hasTakenExam && examScore < requiredPassScore;
              const isShowChecklist = activeChecklistStudentId === s.id;

              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: selectedMatrixIds.has(s.id) ? 'rgba(99,102,241,0.08)' : undefined }}>
                  {isExecutive && (
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedMatrixIds.has(s.id)}
                        onChange={() => {
                          setSelectedMatrixIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                            return next;
                          });
                        }}
                        style={{ cursor: 'pointer', width: 15, height: 15 }}
                      />
                    </td>
                  )}

                  {/* Photo */}
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 20 }}>👤</span>
                    )}
                  </td>

                  {/* Student Name */}
                  <td style={{ padding: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                    {s.name}
                  </td>

                  {/* Phone */}
                  <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                    {s.phone}
                  </td>

                  {/* Email */}
                  <td style={{ padding: 12, color: 'var(--text-secondary)' }}>
                    {s.email || '—'}
                  </td>

                  {/* Attendance */}
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <Badge tone={s.attendancePct >= attendanceThreshold ? 'success' : 'danger'}>
                      {s.attendancePct}%
                    </Badge>
                  </td>

                  {/* Eligibility */}
                  <td style={{ padding: 12 }}>
                    <Badge tone={eligible ? 'success' : 'danger'}>
                      {eligible ? '✅ Eligible' : '❌ Not Eligible'}
                    </Badge>
                  </td>

                  {/* Ass 1, 2, 3 */}
                  <td style={{ padding: 12, textAlign: 'center' }}>{s.ass1 || 0}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{s.ass2 || 0}</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{s.ass3 || 0}</td>

                  {/* Final Exam */}
                  <td style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>
                    {s.finalExam || 0}
                  </td>

                  {/* Result */}
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <Badge tone={isCoursePassed ? 'success' : isCourseFailed ? 'danger' : 'warning'}>
                      {isCoursePassed ? 'Passed' : isCourseFailed ? 'Failed' : 'Not Attended'}
                    </Badge>
                  </td>

                  {/* Voucher ID Management (Unlocked for all students) */}
                  <td style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        className="kvj-input"
                        style={{ padding: '4px 8px', fontSize: 12, width: 140 }}
                        value={s.voucherId || ''}
                        onChange={(e) => onAssignVoucher(s.id, e.target.value)}
                        placeholder="Assign Voucher ID"
                      />
                      <Button
                        size="sm"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                        onClick={() => onNotifyVoucher(s.name, s.voucherId)}
                      >
                        Notify
                      </Button>
                    </div>
                  </td>

                  {/* Action */}
                  {isExecutive && (
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {confirmRemoveStudentId === s.id ? (
                        <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          <Button size="sm" variant="danger" onClick={() => onRemoveStudent(s.id)} style={{ fontSize: 11, padding: '2px 6px' }}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setConfirmRemoveStudentId(null)} style={{ fontSize: 11, padding: '2px 6px' }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmRemoveStudentId(s.id)}
                          style={{ fontSize: 11, padding: '3px 6px' }}
                        >
                          🗑️
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={isExecutive ? 14 : 13} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No students found matching current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
