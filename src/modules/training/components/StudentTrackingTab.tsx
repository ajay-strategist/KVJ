import { useState } from 'react';
import { Card, SectionHeader, Button, Badge } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

export interface StudentRecord {
  id: string;
  registerNo: string; // Phone number as register no
  name: string;
  batch: string;
  mockTestMark: number;
  finalExamMark: number;
  status: 'Passed' | 'Failed' | 'Not Attended';
  isEligible: boolean;
  voucherCode?: string;
}

export function StudentTrackingTab() {
  const { toast } = useNotifications();
  const [statusFilter, setStatusFilter] = useState<'all' | 'Not Attended' | 'Failed' | 'Passed'>('Not Attended');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [voucherOpen, setVoucherOpen] = useState(false);

  // Sample student roster matching requirements
  const [students, setStudents] = useState<StudentRecord[]>([
    { id: 'st1', registerNo: '9847012345', name: 'Rahul Varma', batch: 'Christ 3BBA Data Analytics B1', mockTestMark: 88, finalExamMark: 92, status: 'Passed', isEligible: true, voucherCode: 'VOUCHER-9847' },
    { id: 'st2', registerNo: '9847054321', name: 'Ananya Nair', batch: 'Christ 3BBA Data Analytics B1', mockTestMark: 76, finalExamMark: 0, status: 'Not Attended', isEligible: false },
    { id: 'st3', registerNo: '9847099999', name: 'Arjun Menon', batch: 'Christ 3BBA Data Analytics B1', mockTestMark: 65, finalExamMark: 72, status: 'Failed', isEligible: false },
    { id: 'st4', registerNo: '9847011111', name: 'Sneha Joseph', batch: 'Christ 3BBA Data Analytics B1', mockTestMark: 90, finalExamMark: 86, status: 'Passed', isEligible: true },
    { id: 'st5', registerNo: '9847022222', name: 'Deepak Kumar', batch: 'Christ 3BBA Data Analytics B1', mockTestMark: 0, finalExamMark: 0, status: 'Not Attended', isEligible: false },
  ]);

  const PASS_MARK = 84; // 84% pass threshold

  const filteredStudents = students.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const toggleSelect = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleUnallocateVoucher = (registerNo: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.registerNo === registerNo ? { ...s, voucherCode: undefined } : s))
    );
    toast({ variant: 'info', title: 'Voucher Unallocated', message: `Voucher for student ${registerNo} released back to inventory.` });
  };

  const availableVouchers = 15;
  const issuedVouchers = students.filter((s) => s.voucherCode).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Controls & Status Filters */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Exam Status Filter:</span>
            {[
              { id: 'Not Attended', label: 'Not Attended (Default)' },
              { id: 'Failed', label: 'Failed (<84%)' },
              { id: 'Passed', label: 'Passed (≥84%)' },
              { id: 'all', label: 'Show All Students' },
            ].map((f) => (
              <Button
                key={f.id}
                variant={statusFilter === f.id ? 'primary' : 'secondary'}
                onClick={() => setStatusFilter(f.id as any)}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              variant="secondary"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx, .csv';
                input.onchange = () => {
                  toast({ variant: 'success', title: 'Vouchers Mapped', message: 'Imported returned voucher Excel file mapped by Register No.' });
                };
                input.click();
              }}
            >
              📥 Upload Voucher Excel
            </Button>
            <Button variant="primary" disabled={selectedStudents.length === 0} onClick={() => setVoucherOpen(true)}>
              🎟️ Issue Voucher to Selected ({selectedStudents.length})
            </Button>
          </div>
        </div>
      </Card>

      {/* Inventory & Pass Mark Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card>
          <SectionHeader title="Voucher Inventory Balance" />
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)' }}>{availableVouchers - issuedVouchers} Available</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total: {availableVouchers} | Allocated: {issuedVouchers}</div>
        </Card>
        <Card>
          <SectionHeader title="Pass Mark Criteria" />
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--status-success)' }}>{PASS_MARK}% Benchmark</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Fixed pass percentage for exam eligibility</div>
        </Card>
      </div>

      {/* Main Students Roster Table */}
      <Card>
        <SectionHeader title={`Student Progress & Assessment Marks (${filteredStudents.length} Students)`} />
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 8 }}><input type="checkbox" onChange={(e) => {
                  if (e.target.checked) setSelectedStudents(filteredStudents.map((s) => s.id));
                  else setSelectedStudents([]);
                }} /></th>
                <th style={{ padding: 8 }}>Register No. (Phone)</th>
                <th style={{ padding: 8 }}>Student Name</th>
                <th style={{ padding: 8 }}>Batch</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Mock Test</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Final Exam</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Exam Status</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Voucher ID</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}><input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{s.registerNo}</td>
                  <td style={{ padding: 8 }}>{s.name}</td>
                  <td style={{ padding: 8, color: 'var(--text-muted)' }}>{s.batch}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{s.mockTestMark}%</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>{s.finalExamMark}%</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <Badge tone={s.status === 'Passed' ? 'success' : s.status === 'Failed' ? 'danger' : 'warning'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td style={{ padding: 8, textAlign: 'center', fontWeight: 600, color: 'var(--brand)' }}>
                    {s.voucherCode || '—'}
                  </td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    {s.voucherCode && (
                      <Button size="sm" variant="danger" onClick={() => handleUnallocateVoucher(s.registerNo)}>
                        Unallocate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Voucher Issue Drawer */}
      <Drawer open={voucherOpen} onClose={() => setVoucherOpen(false)} title="Issue Vouchers to Eligible Students">
        <div style={{ fontSize: 13, marginBottom: 16 }}>
          You have selected <strong>{selectedStudents.length}</strong> student(s) to assign vouchers.
        </div>
        <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setVoucherOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            setStudents((prev) =>
              prev.map((s) => (selectedStudents.includes(s.id) ? { ...s, voucherCode: `VOUCHER-${s.registerNo.slice(-4)}` } : s))
            );
            toast({ variant: 'success', title: 'Vouchers Issued', message: `Issued vouchers to ${selectedStudents.length} student(s).` });
            setVoucherOpen(false);
            setSelectedStudents([]);
          }}>
            Confirm & Issue Vouchers
          </Button>
        </div>
      </Drawer>
    </div>
  );
}

export default StudentTrackingTab;
