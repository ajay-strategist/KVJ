import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, SectionHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useLeave } from '../../leave/hooks/useLeave';
import { container } from '../../../core/registry';
import { ATTENDANCE_SERVICE_TOKEN } from '../attendance.service';
import { EMPLOYEE_SERVICE_TOKEN } from '../../employee/employee.service';
import type { LeaveRecord } from '../../leave/leave.repository';
import type { Employee } from '../../employee/employee.repository';
import Drawer from '../../../shared/ui/Drawer';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';

export function ApprovalsQueue() {
  const { user } = useAuth();
  const { pendingApprovals, approveLeave, rejectLeave, refreshPending } = useLeave();
  const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
  const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
  const { confirm } = useDialog();
  const { toast } = useNotifications();

  const [corrections, setCorrections] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);
  const [selectedCorrection, setSelectedCorrection] = useState<any | null>(null);
  const [notes, setNotes] = useState('');

  const fetchCorrectionsAndEmployees = useCallback(async () => {
    const cRes = await attService.listPendingCorrections();
    if (cRes.ok) setCorrections(cRes.value);

    const eRes = await empService.listEmployees();
    if (eRes.ok) {
      const map: Record<string, Employee> = {};
      eRes.value.forEach((e) => (map[e.id] = e));
      setEmployees(map);
    }
  }, [attService, empService]);

  useEffect(() => {
    fetchCorrectionsAndEmployees();
  }, [fetchCorrectionsAndEmployees, pendingApprovals]);

  const empName = (empId: string) => {
    const emp = employees[empId];
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee';
  };

  const handleApproveLeave = async () => {
    if (!selectedLeave) return;
    const ok = await confirm({ title: 'Approve Request?', message: 'Are you sure you want to approve this leave?' });
    if (!ok) return;

    const res = await approveLeave(selectedLeave.id, notes);
    if (res.ok) {
      toast({ variant: 'success', title: 'Leave Approved' });
      setSelectedLeave(null);
      setNotes('');
      refreshPending();
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const handleRejectLeave = async () => {
    if (!selectedLeave) return;
    const ok = await confirm({ title: 'Reject Request?', message: 'Are you sure you want to reject this leave?' });
    if (!ok) return;

    const res = await rejectLeave(selectedLeave.id, notes);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Leave Rejected' });
      setSelectedLeave(null);
      setNotes('');
      refreshPending();
    } else {
      toast({ variant: 'error', title: 'Rejection Failed', message: res.error });
    }
  };

  const handleApproveCorrection = async () => {
    if (!selectedCorrection) return;
    const ok = await confirm({ title: 'Approve Correction?', message: 'This will modify the employee\'s attendance record.' });
    if (!ok) return;

    const res = await attService.approveCorrection(selectedCorrection.id, { id: user!.id, role: user!.role }, notes);
    if (res.ok) {
      toast({ variant: 'success', title: 'Correction Approved' });
      setSelectedCorrection(null);
      setNotes('');
      fetchCorrectionsAndEmployees();
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error.message });
    }
  };

  /** Inline Accept/Reject straight from the queue row (no drawer needed). */
  const handleDecideLeave = async (rec: LeaveRecord, decision: 'accept' | 'reject') => {
    const accept = decision === 'accept';
    const ok = await confirm({
      title: accept ? 'Accept Request?' : 'Reject Request?',
      message: `Are you sure you want to ${accept ? 'accept' : 'reject'} this leave request?`,
    });
    if (!ok) return;

    const res = accept ? await approveLeave(rec.id) : await rejectLeave(rec.id);
    if (res.ok) {
      toast({
        variant: accept ? 'success' : 'warning',
        title: accept ? 'Leave Accepted' : 'Leave Rejected',
      });
      refreshPending();
    } else {
      toast({ variant: 'error', title: 'Action Failed', message: res.error });
    }
  };

  /** Inline Accept/Reject for a missed-clock-in (attendance correction) request. */
  const handleDecideCorrection = async (rec: any, decision: 'accept' | 'reject') => {
    const accept = decision === 'accept';
    const ok = await confirm({
      title: accept ? 'Accept Correction?' : 'Reject Correction?',
      message: accept
        ? "This will back-fill the employee's attendance record."
        : 'Are you sure you want to reject this correction request?',
    });
    if (!ok) return;

    if (!accept) {
      setCorrections((prev) => prev.filter((c) => c.id !== rec.id));
      toast({ variant: 'warning', title: 'Correction Rejected' });
      return;
    }

    const res = await attService.approveCorrection(rec.id, { id: user!.id, role: user!.role });
    if (res.ok) {
      toast({ variant: 'success', title: 'Correction Accepted' });
      setCorrections((prev) => prev.filter((c) => c.id !== rec.id));
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error.message });
    }
  };

  const leaveColumns: Column<LeaveRecord>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => empName(r.employeeId),
    },
    {
      key: 'type',
      header: 'Leave Type',
      accessor: (r) => r.leaveType,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => `${r.startDate} to ${r.endDate}`,
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (r) => r.reason,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => (
        <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => handleDecideLeave(r, 'accept')}>Accept</Button>
          <Button size="sm" variant="danger" onClick={() => handleDecideLeave(r, 'reject')}>Reject</Button>
        </div>
      ),
    },
  ];

  const correctionColumns: Column<any>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => empName(r.requestedBy),
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (r) => r.requestedDate,
    },
    {
      key: 'field',
      header: 'Field',
      accessor: (r) => r.fieldToCorrect === 'firstClockIn' ? 'First Clock In' : 'Last Clock Out',
    },
    {
      key: 'proposed',
      header: 'Proposed Time',
      accessor: (r) => r.proposedValue,
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (r) => r.reason,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => (
        <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => handleDecideCorrection(r, 'accept')}>Accept</Button>
          <Button size="sm" variant="danger" onClick={() => handleDecideCorrection(r, 'reject')}>Reject</Button>
        </div>
      ),
    },
  ];

  const tabs = [
    {
      id: 'leaves',
      label: `Leave Applications (${pendingApprovals.length})`,
      content: (
        <DataTable
          columns={leaveColumns}
          rows={pendingApprovals}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedLeave(r)}
        />
      ),
    },
    {
      id: 'corrections',
      label: `Attendance Corrections (${corrections.length})`,
      content: (
        <DataTable
          columns={correctionColumns}
          rows={corrections}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedCorrection(r)}
        />
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader title="Pending Approvals Queue" subtitle="Approve or reject leaves and attendance logs" />
      <Tabs items={tabs} />

      {/* Leave Details Drawer */}
      <Drawer open={!!selectedLeave} onClose={() => setSelectedLeave(null)} title="Leave Details Review">
        {selectedLeave && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Applicant</span>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{empName(selectedLeave.employeeId)}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Leave Type</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLeave.leaveType}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Duration</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedLeave.startDate} to {selectedLeave.endDate}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reason</span>
                <div style={{ fontSize: 13, background: 'var(--bg-sunken)', padding: 10, borderRadius: 8, marginTop: 4 }}>
                  {selectedLeave.reason}
                </div>
              </div>
              {selectedLeave.medicalCertUrl && (
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Medical Certificate</span>
                  <div style={{ fontSize: 13, color: 'var(--brand)', textDecoration: 'underline', marginTop: 4 }}>
                    📎 {selectedLeave.medicalCertUrl}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="kvj-label">Approver Comments</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes to candidate..."
                className="kvj-textarea"
                style={{ width: '100%', minHeight: 72 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="danger" onClick={handleRejectLeave}>Reject Request</Button>
              <Button onClick={handleApproveLeave}>Approve Request</Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Correction Details Drawer */}
      <Drawer open={!!selectedCorrection} onClose={() => setSelectedCorrection(null)} title="Correction Request Review">
        {selectedCorrection && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Employee</span>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{empName(selectedCorrection.requestedBy)}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Work Date</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedCorrection.requestedDate}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Field to Correct</span>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {selectedCorrection.fieldToCorrect === 'firstClockIn' ? 'First Clock In' : 'Last Clock Out'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Proposed Time</span>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>{selectedCorrection.proposedValue}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reason for claim</span>
                <div style={{ fontSize: 13, background: 'var(--bg-sunken)', padding: 10, borderRadius: 8, marginTop: 4 }}>
                  {selectedCorrection.reason}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="kvj-label">Approver Comments</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes to employee..."
                className="kvj-textarea"
                style={{ width: '100%', minHeight: 72 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="danger" onClick={() => setSelectedCorrection(null)}>Reject</Button>
              <Button onClick={handleApproveCorrection}>Approve & Update</Button>
            </div>
          </div>
        )}
      </Drawer>
    </AppShell>
  );
}
export default ApprovalsQueue;
