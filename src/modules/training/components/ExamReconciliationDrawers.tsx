import React, { useState } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button, Badge } from '../../../shared/ui/components';
import type { StudentRecord } from '../types/batch-management.types';

export interface ExamReconciliationDrawersProps {
  isOpen: boolean;
  onClose: () => void;
  reconciliationReport: Record<string, any>;
  students: StudentRecord[];
  batchStudentIds: Set<string>;
  activeBatch: any;
  onResolveDiscrepancy: (resolution: any) => Promise<void>;
  toast: (opts: { variant: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

export const ExamReconciliationDrawers: React.FC<ExamReconciliationDrawersProps> = ({
  isOpen,
  onClose,
  reconciliationReport,
  students,
  batchStudentIds,
  activeBatch,
  onResolveDiscrepancy,
  toast,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [resolvingDiscrepancy, setResolvingDiscrepancy] = useState<any | null>(null);
  const [resolutionAction, setResolutionAction] = useState<string>('');
  const [resolutionReason, setResolutionReason] = useState<string>('');
  const [overrideScore, setOverrideScore] = useState<number | ''>('');
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string>('');
  const [resolutionConfirmState, setResolutionConfirmState] = useState(false);
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  if (!isOpen) return null;

  // Summary counts
  const summary = {
    matched: 0,
    attemptOnly: 0,
    legacyOnly: 0,
    conflict: 0,
    ambiguousZero: 0,
    confirmedZero: 0,
    duplicate: 0,
    total: 0,
  };

  Object.values(reconciliationReport).forEach((rep: any) => {
    summary.total++;
    if (rep.testStatus === 'MATCHED') summary.matched++;
    else if (rep.testStatus === 'ATTEMPT_ONLY') summary.attemptOnly++;
    else if (rep.testStatus === 'LEGACY_ONLY') summary.legacyOnly++;
    else if (rep.testStatus === 'CONFLICT') summary.conflict++;
    else if (rep.testStatus === 'AMBIGUOUS_ZERO') summary.ambiguousZero++;
    else if (rep.testStatus === 'CONFIRMED_ZERO_ATTEMPT') summary.confirmedZero++;
    else if (rep.testStatus === 'DUPLICATE_ATTEMPT') summary.duplicate++;

    if (rep.retestStatus === 'MATCHED') summary.matched++;
    else if (rep.retestStatus === 'ATTEMPT_ONLY') summary.attemptOnly++;
    else if (rep.retestStatus === 'LEGACY_ONLY') summary.legacyOnly++;
    else if (rep.retestStatus === 'CONFLICT') summary.conflict++;
    else if (rep.retestStatus === 'AMBIGUOUS_ZERO') summary.ambiguousZero++;
    else if (rep.retestStatus === 'CONFIRMED_ZERO_ATTEMPT') summary.confirmedZero++;
    else if (rep.retestStatus === 'DUPLICATE_ATTEMPT') summary.duplicate++;
  });

  const enrolled = students.filter((s) => batchStudentIds.has(s.id));
  const filteredList = enrolled.filter((s) => {
    const rep = reconciliationReport[s.id];
    if (!rep) return false;
    if (selectedFilter === 'ALL') return true;
    return rep.testStatus === selectedFilter || rep.retestStatus === selectedFilter;
  });

  return (
    <>
      <Drawer
        open={true}
        onClose={onClose}
        title="🔍 Final Exam Attempts Reconciliation"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', padding: '0 4px' }}>
          {/* Summary Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {[
              { label: 'Matched', count: summary.matched, color: 'var(--status-success)', bg: 'rgba(16, 185, 129, 0.1)' },
              { label: 'Conflict', count: summary.conflict, color: 'var(--status-danger)', bg: 'rgba(239, 68, 68, 0.1)' },
              { label: 'Duplicate', count: summary.duplicate, color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
              { label: 'Attempt Only', count: summary.attemptOnly, color: 'var(--brand)', bg: 'rgba(59, 130, 246, 0.1)' },
              { label: 'Total', count: summary.total, color: 'var(--text-primary)', bg: 'var(--bg-sunken)' },
            ].map((card) => (
              <div
                key={card.label}
                onClick={() => setSelectedFilter(card.label === 'Total' ? 'ALL' : card.label.toUpperCase().replace(' ', '_'))}
                style={{
                  background: card.bg,
                  borderRadius: 8,
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{card.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{card.count}</div>
              </div>
            ))}
          </div>

          {/* Student Discrepancy Table */}
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '1.5px solid var(--border)' }}>
                  <th style={{ padding: 10 }}>Student</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Test Status</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Legacy Mark</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Attempt Mark</th>
                  <th style={{ padding: 10, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((s) => {
                  const rep = reconciliationReport[s.id];
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 700 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.phone}</div>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <Badge tone={rep?.testStatus === 'MATCHED' ? 'success' : rep?.testStatus === 'CONFLICT' ? 'danger' : 'warning'}>
                          {rep?.testStatus || 'MATCHED'}
                        </Badge>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 600 }}>
                        {s.finalExam || 0}
                      </td>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 600 }}>
                        {rep?.testAttemptScore !== undefined ? rep.testAttemptScore : '—'}
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        {rep?.testStatus && rep.testStatus !== 'MATCHED' ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setResolvingDiscrepancy({
                                studentId: s.id,
                                studentName: s.name,
                                category: rep.testStatus,
                                attemptType: 'Initial',
                                legacyScore: s.finalExam || 0,
                                attemptScore: rep.testAttemptScore,
                              });
                            }}
                            style={{ fontSize: 11, padding: '3px 8px' }}
                          >
                            Resolve
                          </Button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--status-success)' }}>✓ OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      No matching student reconciliation records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Drawer>

      {/* Resolution Sub-Modal */}
      {resolvingDiscrepancy && (
        <Drawer
          open={true}
          onClose={() => setResolvingDiscrepancy(null)}
          title="🛠️ Resolve Exam Attempt Discrepancy"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 4 }}>
            <div style={{ background: 'var(--bg-sunken)', borderRadius: 8, padding: 12, fontSize: 12, border: '1px solid var(--border)' }}>
              <div><strong>Student:</strong> {resolvingDiscrepancy.studentName}</div>
              <div><strong>Category:</strong> {resolvingDiscrepancy.category}</div>
              <div><strong>Attempt Type:</strong> {resolvingDiscrepancy.attemptType}</div>
              <div><strong>Legacy Score:</strong> {resolvingDiscrepancy.legacyScore}</div>
              <div><strong>Attempt Score:</strong> {resolvingDiscrepancy.attemptScore ?? 'N/A'}</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Resolution Action *</label>
              <select
                className="kvj-select"
                value={resolutionAction}
                onChange={(e) => setResolutionAction(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
              >
                <option value="">-- Choose Resolution Action --</option>
                <option value="USE_ATTEMPT">Use Attempt Score</option>
                <option value="USE_LEGACY">Keep Legacy Score</option>
                <option value="OVERRIDE">Manual Override Score</option>
              </select>
            </div>

            {resolutionAction === 'OVERRIDE' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Override Score *</label>
                <input
                  type="number"
                  className="kvj-input"
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(Number(e.target.value))}
                  placeholder="e.g. 75"
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Audit Reason *</label>
              <textarea
                className="kvj-input"
                rows={3}
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                placeholder="Explain the audit reason for this reconciliation resolution..."
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setResolvingDiscrepancy(null)}>Cancel</Button>
              <Button
                disabled={!resolutionAction || !resolutionReason.trim() || isSubmittingResolution}
                onClick={async () => {
                  setIsSubmittingResolution(true);
                  try {
                    await onResolveDiscrepancy({
                      ...resolvingDiscrepancy,
                      action: resolutionAction,
                      reason: resolutionReason,
                      overrideScore: resolutionAction === 'OVERRIDE' ? overrideScore : undefined,
                    });
                    toast({ variant: 'success', title: 'Discrepancy Resolved', message: 'Reconciliation decision recorded.' });
                    setResolvingDiscrepancy(null);
                  } catch (e: any) {
                    toast({ variant: 'error', title: 'Resolution Failed', message: e?.message || 'Could not resolve discrepancy.' });
                  } finally {
                    setIsSubmittingResolution(false);
                  }
                }}
              >
                {isSubmittingResolution ? 'Saving…' : 'Confirm Resolution'}
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
};
