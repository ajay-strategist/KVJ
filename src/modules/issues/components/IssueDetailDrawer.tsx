/**
 * KVJ Analytics — Issue Detail & Resolution Drawer
 */

import { useState } from 'react';
import { Drawer } from '../../../shared/ui/Drawer';
import { Button, Badge, Avatar } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import type { IssueTicket, IssueStatus } from '../types/issue.types';

interface IssueDetailDrawerProps {
  issue: IssueTicket | null;
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: IssueStatus, resolutionNotes?: string) => Promise<void> | void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function IssueDetailDrawer({ issue, open, onClose, onUpdateStatus }: IssueDetailDrawerProps) {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const [selectedStatus, setSelectedStatus] = useState<IssueStatus>(issue?.status || 'open');
  const [resolutionNotes, setResolutionNotes] = useState(issue?.resolutionNotes || '');
  const [saving, setSaving] = useState(false);

  // Sync state if active issue changes
  const [prevId, setPrevId] = useState(issue?.id);
  if (issue && issue.id !== prevId) {
    setPrevId(issue.id);
    setSelectedStatus(issue.status);
    setResolutionNotes(issue.resolutionNotes || '');
  }

  if (!issue) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateStatus(issue.id, selectedStatus, resolutionNotes.trim() || undefined);
      toast({
        variant: 'success',
        title: 'Ticket Updated',
        message: `Issue ${issue.id} has been marked as ${selectedStatus.replace('_', ' ').toUpperCase()}.`,
      });
      onClose();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        message: err.message || 'Unable to update status.',
      });
    } finally {
      setSaving(false);
    }
  };

  const getPriorityTone = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'brand';
      default: return 'neutral';
    }
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'success';
      case 'in_progress':
      case 'under_review':
        return 'progress';
      case 'open':
      default:
        return 'danger';
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Ticket #${issue.id}`}
      size="md"
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {isMgmt && (
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save Updates
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Badge tone={getStatusTone(issue.status)} size="sm">
            {issue.status.replace('_', ' ').toUpperCase()}
          </Badge>
          <Badge tone={getPriorityTone(issue.priority)} size="sm">
            {issue.priority.toUpperCase()} PRIORITY
          </Badge>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>•</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {issue.category}
          </span>
          {issue.module && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{issue.module}</span>
            </>
          )}
        </div>

        {/* Issue Title */}
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
          {issue.title}
        </h2>

        {/* Submitter Info Card */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-sunken)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={issue.reportedBy.name} src={issue.reportedBy.avatarUrl} size={32} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                {issue.reportedBy.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {issue.reportedBy.role} • {issue.reportedBy.email}
              </div>
            </div>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
            Reported {timeAgo(issue.createdAt)}
          </span>
        </div>

        {/* Detailed Problem Description */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Issue Description
          </label>
          <div style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border)',
            fontSize: 13,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {issue.description}
          </div>
        </div>

        {/* Resolution Remarks Section */}
        {issue.resolutionNotes && !isMgmt && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              Resolution Notes
            </label>
            <div style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: 13,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}>
              {issue.resolutionNotes}
              {issue.assignedTo && (
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 8, fontWeight: 600 }}>
                  Resolved by {issue.assignedTo.name} ({issue.assignedTo.role})
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin/Manager Resolution Controls */}
        {isMgmt && (
          <div style={{
            marginTop: 6,
            padding: '14px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            background: 'rgba(59, 130, 246, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)' }}>
              🛠️ Desk Resolution Controls (Admin / Manager)
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Update Ticket Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as IssueStatus)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-sunken)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="open">Open (Unassigned / Pending Action)</option>
                <option value="in_progress">In Progress (Being Addressed)</option>
                <option value="under_review">Under Review (Testing / Verification)</option>
                <option value="resolved">Resolved (Completed)</option>
                <option value="closed">Closed (Archived)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Resolution Remarks & Action Taken
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                placeholder="Detail the fix applied, ticket outcome, or instructions for the reporter..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-sunken)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
