import React, { useState, useMemo } from 'react';
import { Drawer } from '../../../shared/ui/Drawer';
import { Button, Badge } from '../../../shared/ui/components';
import { formatDisplayDate, formatDateTime } from '../../../shared/utils/date';
import { getSessionNotesMap } from '../hooks/useTaskSessions';

export interface TaskWorklogUpdatesDrawerProps {
  open: boolean;
  onClose: () => void;
  task: any | null;
  projectName?: string;
  assigneeName?: string;
  supervisorName?: string;
  workSessions?: any[];
  canApprove?: boolean;
  onApprove?: (task: any) => Promise<void> | void;
  onRequestRework?: (task: any, reworkNotes: string) => Promise<void> | void;
}

export function TaskWorklogUpdatesDrawer({
  open,
  onClose,
  task,
  projectName,
  assigneeName,
  supervisorName,
  workSessions = [],
  canApprove = false,
  onApprove,
  onRequestRework,
}: TaskWorklogUpdatesDrawerProps) {
  const [reworkMode, setReworkMode] = useState(false);
  const [reworkInput, setReworkInput] = useState('');
  const [submittingRework, setSubmittingRework] = useState(false);
  const [approving, setApproving] = useState(false);

  // Filter and sort sessions for this task
  const relevantSessions = useMemo(() => {
    if (!task) return [];
    const taskId = task.id;
    const sessionNotesMap = getSessionNotesMap();

    const filtered = (workSessions || []).filter(
      (s: any) => s.taskId === taskId || s.task_id === taskId
    );

    // Sort descending by startTime (newest first)
    filtered.sort((a: any, b: any) => {
      const tA = new Date(a.startTime || a.start_time || 0).getTime();
      const tB = new Date(b.startTime || b.start_time || 0).getTime();
      return tB - tA;
    });

    return filtered.map((s: any) => {
      const directNote = (s.notes && s.notes.trim()) || sessionNotesMap[s.id] || (s as any).description || '';
      return {
        ...s,
        resolvedNote: directNote,
      };
    });
  }, [task, workSessions]);

  // Find latest update note
  const latestUpdate = useMemo(() => {
    if (!task) return '';
    const withNote = relevantSessions.find((s) => Boolean(s.resolvedNote));
    return withNote?.resolvedNote || task.description || '';
  }, [task, relevantSessions]);

  const tOnly = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '—';
    }
  };

  const fmtDur = (m?: number, startTime?: string, endTime?: string) => {
    let mins = m;
    if ((mins == null || mins > 1440) && startTime && endTime) {
      try {
        const sDate = new Date(startTime);
        const eDate = new Date(endTime);
        if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
          mins = Math.max(0, Math.round((eDate.getTime() - sDate.getTime()) / 60000));
        }
      } catch {}
    }
    if (mins == null) return '—';
    const h = Math.floor(mins / 60);
    const mm = mins % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };

  const dOnly = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '—';
    }
  };

  if (!task) return null;

  const resolvedProjTitle = projectName || task.projectName || (task.projectId ? 'Project Task' : 'Office Task');
  const resolvedAssignee = assigneeName || task.assignee || 'Unassigned';
  const resolvedSupervisor = supervisorName || task.supervisor || '—';
  const totalHrs = task.actualHours || task.totalHoursWorked || 0;
  const proposedHrs = task.proposedHours || task.estimatedHours || 0;

  const handleApprove = async () => {
    if (!onApprove) return;
    setApproving(true);
    try {
      await onApprove(task);
      onClose();
    } finally {
      setApproving(false);
    }
  };

  const handleSendRework = async () => {
    if (!onRequestRework || !reworkInput.trim()) return;
    setSubmittingRework(true);
    try {
      await onRequestRework(task, reworkInput.trim());
      setReworkMode(false);
      setReworkInput('');
      onClose();
    } finally {
      setSubmittingRework(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Task Review & Assignee Work Updates"
      size="xl"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Top Summary Card */}
        <div
          style={{
            padding: 16,
            borderRadius: 'var(--radius-md, 12px)',
            background: 'var(--bg-sunken, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand, #3b82f6)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📁 {resolvedProjTitle}
              </span>
              <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {task.title || task.name}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Badge tone={task.status === 'review' || task.status === 'Under Review' ? 'info' : task.status === 'done' || task.status === 'Completed' ? 'success' : 'neutral'}>
                {task.status || (task.approvalStatus === 'pending_task_approval' ? 'Under Review' : 'Active')}
              </Badge>
              {task.approvalStatus === 'rework' && (
                <Badge tone="danger">🔄 Rework</Badge>
              )}
            </div>
          </div>

          {/* Grid Information */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '10px 16px',
              paddingTop: 10,
              borderTop: '1px solid var(--border, #e2e8f0)',
              fontSize: 12.5,
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Assignee</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{resolvedAssignee}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Supervisor</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{resolvedSupervisor}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Duration / Hours</span>
              <span style={{ fontWeight: 700, color: 'var(--brand)' }}>
                ⏱ {Number(totalHrs).toFixed(1)}h
              </span>
              {proposedHrs > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> / {proposedHrs}h</span>}
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Submitted At</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {formatDateTime(task.submittedAt || task.updatedAt || task.createdAt)}
              </span>
            </div>
          </div>

          {/* Rework Note Alert (if any) */}
          {task.reworkNotes && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--status-danger, #ef4444)',
                fontSize: 12.5,
              }}
            >
              <strong>🔄 Previous Rework Instructions:</strong> {task.reworkNotes}
            </div>
          )}
        </div>

        {/* Highlight: Latest Update Shared by Assignee */}
        <div
          style={{
            padding: 16,
            borderRadius: 'var(--radius-md, 12px)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>💬</span> Latest Update from Assignee
            </span>
            {relevantSessions.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                {relevantSessions.length} total work session{relevantSessions.length > 1 ? 's' : ''} recorded
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, background: 'var(--bg-surface, #ffffff)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
            {latestUpdate ? latestUpdate : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No work update text entered yet.</span>}
          </div>
        </div>

        {/* Worklog History Table — Matches Task Work Log View */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📋</span> Task Work Log &amp; Progress Updates ({relevantSessions.length})
            </h4>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Collected during timer pauses, breaks &amp; work sessions
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken, #f8fafc)', color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700 }}>Start</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700 }}>End</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700 }}>Duration</th>
                  <th style={{ padding: '8px 14px', fontWeight: 700 }}>Update</th>
                  <th style={{ padding: '8px 10px', fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {relevantSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No worklog sessions recorded yet for this task.
                    </td>
                  </tr>
                ) : (
                  relevantSessions.map((s, idx) => {
                    const hasNote = Boolean(s.resolvedNote && s.resolvedNote.trim());
                    return (
                      <tr
                        key={s.id || idx}
                        style={{
                          borderBottom: idx === relevantSessions.length - 1 ? 'none' : '1px solid var(--border)',
                          backgroundColor: idx === 0 ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {dOnly(s.startTime || s.start_time)}
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {tOnly(s.startTime || s.start_time)}
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {tOnly(s.endTime || s.end_time)}
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {s.status === 'running' ? 'Running…' : fmtDur(s.durationMinutes || s.duration_minutes, s.startTime || s.start_time, s.endTime || s.end_time)}
                        </td>
                        <td style={{ padding: '9px 14px', color: hasNote ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: hasNote ? 500 : 400 }}>
                          {hasNote ? (
                            <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--bg-sunken, #f1f5f9)', borderRadius: 4, border: '1px solid var(--border)' }}>
                              {s.resolvedNote}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                          <Badge tone={s.status === 'running' ? 'success' : s.status === 'paused' ? 'warning' : 'neutral'}>
                            {s.status === 'running' ? 'Running' : s.status === 'paused' ? 'Paused' : 'Completed'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Description / Instructions if available */}
        {task.description && (
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Original Task Description
            </span>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-sunken)', padding: '10px 12px', borderRadius: 8, marginTop: 4 }}>
              {task.description}
            </div>
          </div>
        )}

        {/* Checklist if available */}
        {Array.isArray(task.checklist) && task.checklist.length > 0 && (
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Task Checklist ({task.checklist.filter((c: any) => c.done).length}/{task.checklist.length} Completed)
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {task.checklist.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span>{item.done ? '✅' : '⬜'}</span>
                  <span style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {item.item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supervisor Action Section */}
        {canApprove && (
          <div
            style={{
              marginTop: 10,
              padding: 16,
              borderRadius: 'var(--radius-md, 12px)',
              background: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Supervisor Evaluation &amp; Decision
            </div>

            {reworkMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-danger)' }}>
                  Explain what needs rework and instructions for the assignee:
                </label>
                <textarea
                  className="kvj-textarea"
                  rows={3}
                  value={reworkInput}
                  onChange={(e) => setReworkInput(e.target.value)}
                  placeholder="e.g. Please double check the BI register replacement and verify column mappings..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="secondary" size="sm" onClick={() => setReworkMode(false)} disabled={submittingRework}>
                    Back
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleSendRework} disabled={submittingRework || !reworkInput.trim()}>
                    {submittingRework ? 'Sending…' : '🔄 Confirm & Send Back for Rework'}
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                {onRequestRework && (
                  <Button variant="danger" onClick={() => setReworkMode(true)}>
                    🔄 Request Rework
                  </Button>
                )}
                {onApprove && (
                  <Button variant="evaluate" onClick={handleApprove} disabled={approving}>
                    {approving ? 'Evaluating…' : '✓ Evaluate & Approve Completion'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default TaskWorklogUpdatesDrawer;
