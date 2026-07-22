/**
 * KVJ Analytics — Final Exam & Voucher Management Module (Phase 2 Upgrade)
 * Spec Section 12:
 *  - Voucher assignment UI: assign / revoke exam vouchers per student
 *  - Retest eligibility: students below threshold get retest flag automatically
 *  - Final Marks entry: trainer enters marks; highest mark logic applied
 *  - Bulk Voucher Upload & assignment
 *  - Email automation: send voucher via email button
 */

import { useState, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, Badge, ProgressBar, SectionHeader, SearchInput } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';

export interface ExamRecord {
  id: string;
  studentName: string;
  phone: string;
  email: string;
  college: string;
  batch: string;
  attendancePct: number;
  voucherCode?: string;
  voucherStatus: 'Unassigned' | 'Assigned' | 'Redeemed' | 'Expired';
  originalScore?: number;
  retestScore?: number;
  finalScore?: number;
  isRetestEligible?: boolean;
  retestStatus?: 'None' | 'Pending' | 'Completed';
  certificateEligible: boolean;
}

const SAMPLE_EXAM_RECORDS: ExamRecord[] = [
  { id: 'e1', studentName: 'Albin Joseph', phone: '+91 98765 43210', email: 'albin.joseph@student.edu', college: 'Christ University', batch: 'Christ BCOM B1', attendancePct: 88, voucherCode: 'VOUCH-CHRIST-101', voucherStatus: 'Assigned', originalScore: 84, finalScore: 84, certificateEligible: true },
  { id: 'e2', studentName: 'Merlin K Thomas', phone: '+91 94455 66778', email: 'merlin.t@student.edu', college: 'Christ University', batch: 'Christ BCOM B1', attendancePct: 82, voucherCode: '', voucherStatus: 'Unassigned', originalScore: 48, finalScore: 48, isRetestEligible: true, retestStatus: 'Pending', certificateEligible: false },
  { id: 'e3', studentName: 'Devanand P', phone: '+91 88990 11223', email: 'devanand.p@student.edu', college: 'SB College', batch: 'SB MBA B1', attendancePct: 94, voucherCode: 'VOUCH-SB-202', voucherStatus: 'Redeemed', originalScore: 62, retestScore: 88, finalScore: 88, isRetestEligible: true, retestStatus: 'Completed', certificateEligible: true },
  { id: 'e4', studentName: 'Riya Rose', phone: '+91 77889 90011', email: 'riya.rose@student.edu', college: 'Vimala College', batch: 'Vimala Excel B1', attendancePct: 76, voucherCode: '', voucherStatus: 'Unassigned', originalScore: 42, finalScore: 42, isRetestEligible: true, retestStatus: 'Pending', certificateEligible: false },
];

export function FinalExamModule() {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const [records, setRecords] = useState<ExamRecord[]>(SAMPLE_EXAM_RECORDS);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterVoucher, setFilterVoucher] = useState('all');

  const [marksDrawerOpen, setMarksDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExamRecord | null>(null);

  const [bulkVoucherOpen, setBulkVoucherOpen] = useState(false);

  const isManagement = ['ADMIN', 'CEO', 'MANAGER'].includes(user?.role || '');

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (q && !`${r.studentName} ${r.email} ${r.college} ${r.voucherCode}`.toLowerCase().includes(q)) return false;
      if (filterBatch !== 'all' && r.batch !== filterBatch) return false;
      if (filterVoucher !== 'all' && r.voucherStatus !== filterVoucher) return false;
      return true;
    });
  }, [records, search, filterBatch, filterVoucher]);

  const handleAssignVoucher = (id: string) => {
    const code = `VOUCH-${Math.floor(100000 + Math.random() * 900000)}`;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, voucherCode: code, voucherStatus: 'Assigned' } : r
      )
    );
    toast({ variant: 'success', title: 'Voucher Assigned', message: `Assigned voucher code ${code}.` });
  };

  const handleRevokeVoucher = (id: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, voucherCode: '', voucherStatus: 'Unassigned' } : r
      )
    );
    toast({ variant: 'info', title: 'Voucher Revoked' });
  };

  const handleSendVoucherEmail = (r: ExamRecord) => {
    toast({
      variant: 'success',
      title: 'Voucher Email Dispatched',
      message: `Sent voucher code ${r.voucherCode} to ${r.email}.`,
    });
  };

  const handleUpdateMarks = (values: Record<string, unknown>) => {
    if (!selectedRecord) return;
    const orig = Number(values.originalScore || selectedRecord.originalScore || 0);
    const retest = values.retestScore ? Number(values.retestScore) : selectedRecord.retestScore;

    // Highest mark logic (spec rule)
    const finalScore = retest !== undefined ? Math.max(orig, retest) : orig;
    const isRetestEligible = finalScore < 50;
    const certEligible = finalScore >= 50 && selectedRecord.attendancePct >= 80;

    setRecords((prev) =>
      prev.map((r) =>
        r.id === selectedRecord.id
          ? {
              ...r,
              originalScore: orig,
              retestScore: retest,
              finalScore,
              isRetestEligible,
              retestStatus: retest !== undefined ? 'Completed' : r.retestStatus,
              certificateEligible: certEligible,
            }
          : r
      )
    );

    toast({ variant: 'success', title: 'Exam Marks Updated', message: `Final Score: ${finalScore}% (Highest Mark Applied)` });
    setMarksDrawerOpen(false);
  };

  const handleBulkVoucherSubmit = (values: Record<string, unknown>) => {
    const prefix = (values.prefix as string) || 'VOUCH-BATCH';
    setRecords((prev) =>
      prev.map((r, i) =>
        !r.voucherCode
          ? {
              ...r,
              voucherCode: `${prefix}-${100 + i}`,
              voucherStatus: 'Assigned',
            }
          : r
      )
    );
    toast({ variant: 'success', title: 'Bulk Vouchers Assigned', message: 'Vouchers generated for all unassigned students.' });
    setBulkVoucherOpen(false);
  };

  const assignedCount = records.filter((r) => r.voucherStatus === 'Assigned' || r.voucherStatus === 'Redeemed').length;
  const retestCount = records.filter((r) => r.isRetestEligible).length;

  return (
    <AppShell>
      <PageHeader
        title="Final Exam & Voucher Management"
        subtitle="Manage student exam vouchers, retest eligibility, final score highest-mark logic, and certificate readiness"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setBulkVoucherOpen(true)}>⚡ Bulk Assign Vouchers</Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
        <Card style={{ borderLeft: '4px solid var(--brand)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Vouchers Assigned</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>{assignedCount} / {records.length}</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-warning)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Retest Eligible Students</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-warning)', marginTop: 4 }}>⚠️ {retestCount} Students</div>
        </Card>

        <Card style={{ borderLeft: '4px solid var(--status-success)', padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Certificate Eligible</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--status-success)', marginTop: 4 }}>
            🎓 {records.filter((r) => r.certificateEligible).length} Eligible
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: '12px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search student name, email, voucher..." style={{ minWidth: 240 }} />
          <select
            className="kvj-select"
            value={filterVoucher}
            onChange={(e) => setFilterVoucher(e.target.value)}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 160 }}
          >
            <option value="all">All Voucher Status</option>
            <option value="Assigned">Assigned</option>
            <option value="Unassigned">Unassigned</option>
            <option value="Redeemed">Redeemed</option>
          </select>
        </div>
      </Card>

      {/* Exam Table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table className="kvj-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Batch</th>
                <th>Attendance</th>
                <th>Voucher Code</th>
                <th>Exam Scores</th>
                <th>Retest Status</th>
                <th>Cert Eligible</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.studentName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.email}</div>
                  </td>
                  <td>{r.batch}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: r.attendancePct >= 80 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                      {r.attendancePct}%
                    </span>
                  </td>
                  <td>
                    {r.voucherCode ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand)', fontSize: 12 }}>
                          {r.voucherCode}
                        </span>
                        <Badge tone={r.voucherStatus === 'Redeemed' ? 'success' : 'info'}>{r.voucherStatus}</Badge>
                      </div>
                    ) : (
                      <Badge tone="warning">Unassigned</Badge>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, fontSize: 14, color: (r.finalScore ?? 0) >= 50 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                      Final: {r.finalScore ?? '—'}%
                    </div>
                    {r.retestScore !== undefined && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Orig: {r.originalScore}% | Retest: {r.retestScore}% (Highest Used)
                      </div>
                    )}
                  </td>
                  <td>
                    {r.isRetestEligible ? (
                      <Badge tone="warning">Retest Eligible</Badge>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={r.certificateEligible ? 'success' : 'neutral'}>
                      {r.certificateEligible ? 'Eligible' : 'Ineligible'}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {/* Enter Marks */}
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => { setSelectedRecord(r); setMarksDrawerOpen(true); }}
                      >
                        📝 Marks
                      </Button>

                      {/* Voucher Assign/Revoke */}
                      {!r.voucherCode ? (
                        <Button size="xs" onClick={() => handleAssignVoucher(r.id)}>Assign Voucher</Button>
                      ) : (
                        <>
                          <Button size="xs" variant="secondary" onClick={() => handleSendVoucherEmail(r)}>✉️ Email</Button>
                          <Button size="xs" variant="danger" onClick={() => handleRevokeVoucher(r.id)}>Revoke</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Enter Marks Drawer */}
      <Drawer open={marksDrawerOpen} onClose={() => setMarksDrawerOpen(false)} title={`Enter Marks: ${selectedRecord?.studentName ?? ''}`}>
        <Form
          initial={{
            originalScore: String(selectedRecord?.originalScore ?? ''),
            retestScore: String(selectedRecord?.retestScore ?? ''),
          }}
          onSubmit={handleUpdateMarks}
        >
          <TextField name="originalScore" label="Original Exam Score (%) *" placeholder="e.g. 48" />
          <TextField name="retestScore" label="Retest Score (%) (If retest taken)" placeholder="e.g. 88" />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -6 }}>
            Note: System automatically selects the highest score between original and retest as final score.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setMarksDrawerOpen(false)}>Cancel</Button>
            <Button type="submit">Save Marks</Button>
          </div>
        </Form>
      </Drawer>

      {/* Bulk Voucher Drawer */}
      <Drawer open={bulkVoucherOpen} onClose={() => setBulkVoucherOpen(false)} title="Bulk Assign Exam Vouchers">
        <Form initial={{ prefix: 'VOUCH-CHRIST-2026' }} onSubmit={handleBulkVoucherSubmit}>
          <TextField name="prefix" label="Voucher Batch Code Prefix *" placeholder="e.g. VOUCH-CHRIST-2026" />
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            This will auto-generate unique voucher codes for all students currently without an assigned voucher.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setBulkVoucherOpen(false)}>Cancel</Button>
            <Button type="submit">Generate & Assign Vouchers</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}

export default FinalExamModule;
