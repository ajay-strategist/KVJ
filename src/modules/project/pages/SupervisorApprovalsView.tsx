import { useState, useMemo } from 'react';
import { Card, Badge, Button } from '../../../shared/ui/components';
import { useAuth } from '../../auth/AuthProvider';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { formatDisplayDate } from '../../../shared/utils/date';
import { useEmployee } from '../../employee/hooks/useEmployee';

export interface SupervisorApprovalsProps {
  projectData?: any;
  commonFilters?: {
    searchQuery?: string;
    selectedProjectId?: string;
    selectedEmployeeId?: string;
    selectedStatus?: string;
    selectedClient?: string;
    selectedDate?: string;
  };
}

export function SupervisorApprovalsView({ projectData, commonFilters }: SupervisorApprovalsProps) {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { prompt, confirm } = useDialog();
  const { employees = [] } = useEmployee() || {};

  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const {
    projects = [],
    tasks = [],
    approveTaskAssignment,
    approveTaskSubmission,
    requestRework,
    refresh,
  } = projectData || {};

  // Filter tasks where current user is Supervisor (or Admin/CEO/Manager) and requires supervisor action
  const pendingApprovalTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      const proj = projects.find((p: any) => p.id === t.projectId);
      const isSupervisor = (proj && proj.supervisorId === user?.id) || t.supervisorId === user?.id || isMgmt;

      if (!isSupervisor) return false;

      // Pending assignment/start approval OR Pending completion review
      const isPendingStart = t.approvalStatus === 'pending_assignment_approval' || t.status === 'Pending Approval' || t.status === 'pending_approval';
      const isPendingReview = t.approvalStatus === 'pending_task_approval' || t.status === 'Under Review' || t.status === 'review';

      if (!isPendingStart && !isPendingReview) return false;

      // Common filters application
      if (commonFilters?.selectedProjectId && commonFilters.selectedProjectId !== 'all' && t.projectId !== commonFilters.selectedProjectId) {
        return false;
      }
      if (commonFilters?.selectedEmployeeId && commonFilters.selectedEmployeeId !== 'all') {
        const empMatch = t.assigneeId === commonFilters.selectedEmployeeId || t.assignedByEmployeeId === commonFilters.selectedEmployeeId;
        if (!empMatch) return false;
      }
      if (commonFilters?.searchQuery) {
        const q = commonFilters.searchQuery.toLowerCase();
        const tTitle = (t.title || t.name || '').toLowerCase();
        const pCode = (proj?.code || '').toLowerCase();
        const pTitle = (proj?.title || '').toLowerCase();
        if (!tTitle.includes(q) && !pCode.includes(q) && !pTitle.includes(q)) return false;
      }

      return true;
    });
  }, [tasks, projects, user, isMgmt, commonFilters]);

  // Bulk Approve Handler for Supervisor
  const handleBulkApprove = async () => {
    if (pendingApprovalTasks.length === 0) return;
    const ok = await confirm({
      title: 'Bulk Approve Supervisor Queue',
      message: `Are you sure you want to approve all ${pendingApprovalTasks.length} pending task approvals?`,
      confirmLabel: 'Approve All',
      cancelLabel: 'Cancel',
    });

    if (!ok) return;

    let count = 0;
    for (const t of pendingApprovalTasks) {
      try {
        if (t.approvalStatus === 'pending_assignment_approval' || t.status === 'Pending Approval' || t.status === 'pending_approval') {
          if (approveTaskAssignment) await approveTaskAssignment(t.id);
          count++;
        } else if (t.approvalStatus === 'pending_task_approval' || t.status === 'Under Review' || t.status === 'review') {
          if (approveTaskSubmission) await approveTaskSubmission(t.id);
          count++;
        }
      } catch (err) {
        console.error('Failed to approve task', t.id, err);
      }
    }

    toast(`Successfully approved ${count} task requests.`, 'success');
    if (refresh) refresh();
  };

  const handleApproveStart = async (taskId: string, taskTitle: string) => {
    try {
      if (approveTaskAssignment) {
        const res = await approveTaskAssignment(taskId);
        if (res?.ok !== false) {
          toast(`Approved task start for "${taskTitle}".`, 'success');
          if (refresh) refresh();
        } else {
          toast(res.error || 'Failed to approve task start.', 'error');
        }
      }
    } catch (e: any) {
      toast(e.message || 'Error approving task start.', 'error');
    }
  };

  const handleApproveCompletion = async (taskId: string, taskTitle: string) => {
    try {
      if (approveTaskSubmission) {
        const res = await approveTaskSubmission(taskId);
        if (res?.ok !== false) {
          toast(`Approved task completion for "${taskTitle}".`, 'success');
          if (refresh) refresh();
        } else {
          toast(res.error || 'Failed to approve task completion.', 'error');
        }
      }
    } catch (e: any) {
      toast(e.message || 'Error approving task completion.', 'error');
    }
  };

  const handleRequestRework = async (taskId: string, taskTitle: string) => {
    const notes = await prompt({
      title: `Send Back for Rework: ${taskTitle}`,
      message: 'Please provide specific feedback/notes on what needs rework:',
      placeholder: 'e.g. Please recalculate column totals and update client documentation...',
      confirmLabel: 'Send for Rework',
      cancelLabel: 'Cancel',
    });

    if (!notes || !notes.trim()) {
      toast('Rework notes are required when requesting rework.', 'warning');
      return;
    }

    try {
      if (requestRework) {
        const res = await requestRework(taskId, notes.trim());
        if (res?.ok !== false) {
          toast(`Sent "${taskTitle}" back for rework with supervisor feedback.`, 'info');
          if (refresh) refresh();
        } else {
          toast(res.error || 'Failed to send for rework.', 'error');
        }
      }
    } catch (e: any) {
      toast(e.message || 'Error sending task for rework.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header & Bulk Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚡ Supervisor Approval Queue</span>
            <Badge variant="primary" style={{ fontSize: 12 }}>
              {pendingApprovalTasks.length} Pending
            </Badge>
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Review task start permissions and evaluate completed task submissions for your supervised projects.
          </p>
        </div>

        {pendingApprovalTasks.length > 0 && (
          <Button variant="primary" size="md" onClick={handleBulkApprove} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
            ⚡ Bulk Approve All ({pendingApprovalTasks.length})
          </Button>
        )}
      </div>

      {/* List of Pending Items */}
      {pendingApprovalTasks.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center', background: 'var(--bg-surface)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>All Supervisor Approvals Cleared!</h4>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            There are currently no task start requests or pending completion reviews requiring your approval.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {pendingApprovalTasks.map((t: any) => {
            const proj = projects.find((p: any) => p.id === t.projectId);
            const assignee = employees.find((e: any) => e.id === t.assigneeId);
            const assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : (t.assignee || 'Unassigned');
            const isStartApproval = t.approvalStatus === 'pending_assignment_approval' || t.status === 'Pending Approval' || t.status === 'pending_approval';

            return (
              <Card key={t.id} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', borderLeft: isStartApproval ? '4px solid #f59e0b' : '4px solid #3b82f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {proj ? `${proj.code} · ${proj.title}` : 'Project Task'}
                    </span>
                    <h4 style={{ margin: '4px 0 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {t.title || t.name}
                    </h4>
                  </div>
                  <Badge variant={isStartApproval ? 'warning' : 'primary'} style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    {isStartApproval ? '⏳ Start Approval' : '🔍 Completion Review'}
                  </Badge>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-sunken)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <div><strong>👤 Assignee:</strong> {assigneeName}</div>
                  <div><strong>📅 Due Date:</strong> {t.dueDate ? formatDisplayDate(t.dueDate) : 'N/A'}</div>
                  {t.proposedHours ? <div><strong>⏱️ Estimated Hours:</strong> {t.proposedHours}h</div> : null}
                  {t.description && <div><strong>📝 Description:</strong> {t.description}</div>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {isStartApproval ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveStart(t.id, t.title || t.name)}
                      style={{ flex: 1, fontWeight: 600 }}
                    >
                      ✅ Approve Start
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApproveCompletion(t.id, t.title || t.name)}
                        style={{ flex: 1, fontWeight: 600, background: '#10b981', borderColor: '#10b981' }}
                      >
                        ✅ Approve Completion
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRequestRework(t.id, t.title || t.name)}
                        style={{ flex: 1, fontWeight: 600, color: '#ef4444', borderColor: '#fca5a5' }}
                      >
                        🔄 Request Rework
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
