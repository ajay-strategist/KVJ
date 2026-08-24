import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, SectionHeader, Button } from '../../../shared/ui/components';
import { DataTable, type Column } from '../../../shared/ui/DataTable';
import { Tabs } from '../../../shared/ui/Tabs';
import { useLeave } from '../../leave/hooks/useLeave';
import { useProject } from '../../project/hooks/useProject';
import { useMemo } from 'react';
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
  const { tasks, projects, approveTaskSubmission, requestRework, approveTaskAssignment, refresh: refreshProjects } = useProject();
  const [reworkTask, setReworkTask] = useState<any | null>(null);
  const [reworkNotes, setReworkNotes] = useState('');
  const attService = container.resolve(ATTENDANCE_SERVICE_TOKEN);
  const empService = container.resolve(EMPLOYEE_SERVICE_TOKEN);
  const { confirm } = useDialog();
  const { toast } = useNotifications();

  const [corrections, setCorrections] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  
  const [selectedLeave, setSelectedLeave] = useState<LeaveRecord | null>(null);
  const [selectedCorrection, setSelectedCorrection] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  
  const userRole = user?.role || 'EMPLOYEE';
  const canApprove = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole.toUpperCase());

  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pending_task_approval' | 'pending_assignment_approval'>('all');

  const filteredTaskApprovals = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    return safeTasks.filter((t) => {
      if (!t || t.deletedAt) return false;
      const isPendingTask = t.approvalStatus === 'pending_task_approval' || t.status === 'review';
      const isPendingAssign = t.approvalStatus === 'pending_assignment_approval';
      if (!isPendingTask && !isPendingAssign) return false;
      if (taskStatusFilter === 'pending_task_approval') {
        return isPendingTask;
      }
      if (taskStatusFilter === 'pending_assignment_approval') {
        return isPendingAssign;
      }
      return true;
    });
  }, [tasks, taskStatusFilter]);

  const fetchCorrectionsAndEmployees = useCallback(async () => {
    try {
      const cRes = await attService.listPendingCorrections();
      if (cRes.ok && Array.isArray(cRes.value)) setCorrections(cRes.value);

      const eRes = await empService.listEmployees();
      if (eRes.ok && Array.isArray(eRes.value)) {
        const map: Record<string, Employee> = {};
        eRes.value.forEach((e) => { if (e && e.id) map[e.id] = e; });
        setEmployees(map);
      }
    } catch (e) {
      console.warn('ApprovalsQueue fetch error:', e);
    }
  }, [attService, empService]);

  useEffect(() => {
    fetchCorrectionsAndEmployees();
  }, [fetchCorrectionsAndEmployees, pendingApprovals]);

  const empName = (empId: string) => {
    const emp = employees[empId];
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee';
  };

  const [selectedLeaveIds, setSelectedLeaveIds] = useState<string[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const handleBatchApproveLeave = async () => {
    if (selectedLeaveIds.length === 0) return;
    const ok = await confirm({
      title: 'Batch Approve Leave Requests?',
      message: `Are you sure you want to approve ${selectedLeaveIds.length} selected leave requests?`,
    });
    if (!ok) return;

    setBatchProcessing(true);
    let successCount = 0;
    for (const id of selectedLeaveIds) {
      const res = await approveLeave(id, 'Batch approved');
      if (res.ok) successCount++;
    }
    setBatchProcessing(false);
    setSelectedLeaveIds([]);
    toast({
      variant: 'success',
      title: 'Batch Approval Complete',
      message: `${successCount} leave request(s) approved successfully.`,
    });
    refreshPending();
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

  const handleRejectCorrection = async () => {
    if (!selectedCorrection) return;
    const ok = await confirm({ title: 'Reject Correction?', message: 'Are you sure you want to reject this correction request?' });
    if (!ok) return;

    const res = await attService.rejectCorrection(selectedCorrection.id, { id: user!.id, role: user!.role }, notes);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Correction Rejected' });
      setSelectedCorrection(null);
      setNotes('');
      fetchCorrectionsAndEmployees();
    } else {
      toast({ variant: 'error', title: 'Rejection Failed', message: res.error.message });
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

    const actor = { id: user?.id || 'emp-admin', role: user?.role || 'ADMIN' };
    const res = accept
      ? await attService.approveCorrection(rec.id, actor)
      : await attService.rejectCorrection(rec.id, actor);

    if (res.ok) {
      toast({
        variant: accept ? 'success' : 'warning',
        title: accept ? 'Correction Accepted' : 'Correction Rejected',
      });
      fetchCorrectionsAndEmployees();
    } else {
      toast({ variant: 'error', title: 'Action Failed', message: res.error.message });
    }
  };

  
  const handleApproveAssignmentInline = async (task: any) => {
    const proj = projects.find((p) => p.id === task.projectId);
    const projTitle = proj ? proj.title : 'Office Task';
    const ok = await confirm({
      title: 'Approve Assignment?',
      message: `Confirm assigning task "${projTitle}: ${task.title}"?`,
    });
    if (!ok) return;

    const res = await approveTaskAssignment(task.id);
    if (res.ok) {
      toast({ variant: 'success', title: 'Assignment Approved' });
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const handleApproveTaskInline = async (task: any) => {
    const proj = projects.find((p) => p.id === task.projectId);
    const projTitle = proj ? proj.title : 'Office Task';
    const ok = await confirm({
      title: 'Approve Task Completion?',
      message: `Approve completed work for task "${projTitle}: ${task.title}"?`,
    });
    if (!ok) return;

    const res = await approveTaskSubmission(task.id);
    if (res.ok) {
      toast({ variant: 'success', title: 'Task Approved' });
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Approval Failed', message: res.error });
    }
  };

  const handleReworkTaskInline = (task: any) => {
    setReworkTask(task);
    setReworkNotes('');
  };

  const submitRework = async () => {
    if (!reworkTask || !reworkNotes.trim()) return;
    const res = await requestRework(reworkTask.id, reworkNotes);
    if (res.ok) {
      toast({ variant: 'warning', title: 'Rework Requested', message: 'Task sent back for rework.' });
      setReworkTask(null);
      setReworkNotes('');
      refreshProjects();
    } else {
      toast({ variant: 'error', title: 'Rework Failed', message: res.error });
    }
  };

  const taskApprovalColumns: Column<any>[] = [
    {
      key: 'task',
      header: 'Task Name',
      accessor: (r) => r.title,
      render: (r) => {
        const proj = projects.find((p) => p.id === r.projectId);
        const projTitle = proj ? proj.title : 'Office Task';
        return (
          <span>
            <strong>{projTitle}</strong>: {r.title}
          </span>
        );
      },
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (r) => {
        const emp = Object.values(employees).find(e => e.id === r.assigneeId);
        return emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';
      }
    },
    {
      key: 'type',
      header: 'Approval Type',
      render: (r) => {
        if (r.approvalStatus === 'pending_assignment_approval') {
          return <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>Assignment Approval</span>;
        }
        return <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>Task Completion</span>;
      }
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      render: (r) => {
        if (r.approvalStatus === 'pending_assignment_approval') {
          const emp = Object.values(employees).find(e => e.id === r.assignedByEmployeeId);
          return emp ? `${emp.firstName} ${emp.lastName}` : 'System / Employee';
        }
        const emp = Object.values(employees).find(e => e.id === r.submittedBy || e.id === r.assigneeId);
        return emp ? `${emp.firstName} ${emp.lastName}` : 'Assignee';
      }
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => {
        if (!canApprove) {
          return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Approval Rights Required (Admin/CEO/Manager)</span>;
        }
        if (r.approvalStatus === 'pending_assignment_approval') {
          const creator = Object.values(employees).find(emp => emp.id === r.assignedByEmployeeId);
          const creatorRole = ((creator as any)?.role || '').toUpperCase();
          const needsCeoOnly = creatorRole === 'ADMIN' || creatorRole === 'MANAGER';

          if (needsCeoOnly) {
            if (userRole.toUpperCase() === 'CEO') {
              return (
                <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => handleApproveAssignmentInline(r)}>Approve Assignment (CEO)</Button>
                </div>
              );
            } else {
              return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>CEO Approval Required</span>;
            }
          }

          return (
            <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={() => handleApproveAssignmentInline(r)}>Approve Assignment</Button>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => handleApproveTaskInline(r)}>Approve Task</Button>
            <Button size="sm" variant="danger" onClick={() => handleReworkTaskInline(r)}>Rework</Button>
          </div>
        );
      }
    }
  ];

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
      render: (r) => {
        if (!canApprove) {
          return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Approval Rights Required</span>;
        }
        return (
          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => handleDecideLeave(r, 'accept')}>Accept</Button>
            <Button size="sm" variant="danger" onClick={() => handleDecideLeave(r, 'reject')}>Reject</Button>
          </div>
        );
      },
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
      accessor: (r) => {
        if (r.fieldToCorrect === 'firstClockIn') return 'First Clock In';
        if (r.fieldToCorrect === 'lastClockOut') return 'Last Clock Out';
        if (r.fieldToCorrect === 'attendance_claim') return 'Attendance Claim';
        return r.fieldToCorrect;
      },
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
      render: (r) => {
        if (!canApprove) {
          return <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Approval Rights Required</span>;
        }
        return (
          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => handleDecideCorrection(r, 'accept')}>Accept</Button>
            <Button size="sm" variant="danger" onClick={() => handleDecideCorrection(r, 'reject')}>Reject</Button>
          </div>
        );
      },
    },
  ];

  const tabs = [
    {
      id: 'tasks',
      label: `Task Approvals (${filteredTaskApprovals.length})`,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, alignSelf: 'flex-end' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>🔍 Filter Status:</span>
            <select
              className="kvj-select"
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value as any)}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 200 }}
            >
              <option value="all">👥 All Approvals</option>
              <option value="pending_task_approval">📝 Task Completion Approvals</option>
              <option value="pending_assignment_approval">📌 Assignment Approvals</option>
            </select>
          </div>
          <DataTable
            columns={taskApprovalColumns}
            rows={filteredTaskApprovals}
            rowKey={(r) => r.id}
          />
        </div>
      ),
    },
    {
      id: 'leaves',
      label: `Leave Applications (${pendingApprovals.length})`,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedLeaveIds.length > 0 && canApprove && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'var(--brand-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--brand)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>
                {selectedLeaveIds.length} leave request(s) selected
              </span>
              <Button size="sm" onClick={handleBatchApproveLeave} disabled={batchProcessing}>
                {batchProcessing ? '⏳ Approving...' : `✓ Batch Approve Selected (${selectedLeaveIds.length})`}
              </Button>
            </div>
          )}
          <DataTable
            columns={leaveColumns}
            rows={pendingApprovals}
            rowKey={(r) => r.id}
            selectable={canApprove}
            onSelectionChange={setSelectedLeaveIds}
            onRowClick={(r) => setSelectedLeave(r)}
          />
        </div>
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
      <PageHeader title="Pending Approvals Queue" subtitle="Approve or reject leaves, attendance logs, and project tasks" />
      {!canApprove && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 8, fontSize: 12.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔒</span>
          <span><strong>Approving Rights Notice:</strong> Only <strong>Admin</strong>, <strong>CEO</strong>, and <strong>Manager</strong> roles have approval rights. You are viewing queue items in read-only mode.</span>
        </div>
      )}
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
                  <div style={{ marginTop: 4 }}>
                    {selectedLeave.medicalCertUrl.includes('http') ? (
                      <a
                        href={selectedLeave.medicalCertUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        📎 View Attached Certificate
                      </a>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        📎 {selectedLeave.medicalCertUrl}
                      </span>
                    )}
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


      {/* Task Rework Notes Drawer */}
      <Drawer open={!!reworkTask} onClose={() => setReworkTask(null)} title="Request Task Rework">
        {reworkTask && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                <strong>{projects.find((p) => p.id === reworkTask.projectId)?.title || 'Office Task'}</strong>: {reworkTask.title}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Enter notes and instructions for rework:</span>
            </div>
            <div style={{ marginBottom: 20 }}>
              <textarea
                value={reworkNotes}
                onChange={(e) => setReworkNotes(e.target.value)}
                placeholder="Type instructions here (e.g., please verify column values)..."
                className="kvj-textarea"
                style={{ width: '100%', minHeight: 100 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setReworkTask(null)}>Cancel</Button>
              <Button variant="danger" onClick={submitRework} disabled={!reworkNotes.trim()}>Send back for Rework</Button>
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
                  {selectedCorrection.fieldToCorrect === 'firstClockIn'
                    ? 'First Clock In'
                    : selectedCorrection.fieldToCorrect === 'lastClockOut'
                    ? 'Last Clock Out'
                    : selectedCorrection.fieldToCorrect === 'attendance_claim'
                    ? 'Attendance Claim'
                    : selectedCorrection.fieldToCorrect}
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
              <Button variant="danger" onClick={handleRejectCorrection}>Reject</Button>
              <Button onClick={handleApproveCorrection}>Approve & Update</Button>
            </div>
          </div>
        )}
      </Drawer>
    </AppShell>
  );
}
export default ApprovalsQueue;
