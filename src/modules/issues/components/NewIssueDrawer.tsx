/**
 * KVJ Analytics — New Issue Drawer Component
 */

import { useState } from 'react';
import { Drawer } from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { CreateIssueInput, IssueCategory, IssuePriority } from '../types/issue.types';

interface NewIssueDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateIssueInput) => Promise<void> | void;
}

const CATEGORIES: IssueCategory[] = [
  'Software & System Bug',
  'Attendance & Biometrics',
  'Leave & Holidays',
  'Expenses & Travel',
  'Training & Batches',
  'Projects & Tasks',
  'Hardware & Facility',
  'General Support',
];

const MODULE_OPTIONS = [
  'General / Cross-Platform',
  'Attendance Log & Biometrics',
  'Leave Board & Approvals',
  'Training & Batches',
  'Projects & Timesheets',
  'Expenses & Travel',
  'Communication & Chat',
  'Executive Analytics',
  'Settings & Security',
];

const PRIORITIES: { key: IssuePriority; label: string; desc: string; color: string; bg: string; border: string }[] = [
  { key: 'low', label: 'Low', desc: 'Cosmetic or minor suggestion', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' },
  { key: 'medium', label: 'Medium', desc: 'Normal operational issue', color: '#0284c7', bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.25)' },
  { key: 'high', label: 'High', desc: 'Directly impedes regular work', color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.25)' },
  { key: 'urgent', label: 'Urgent', desc: 'Critical blocker / outage', color: '#dc2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.3)' },
];

export function NewIssueDrawer({ open, onClose, onSubmit }: NewIssueDrawerProps) {
  const { toast } = useNotifications();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IssueCategory>('Software & System Bug');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [module, setModule] = useState('General / Cross-Platform');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'error', title: 'Title Required', message: 'Please provide a clear title for this issue.' });
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      toast({ variant: 'error', title: 'Description too short', message: 'Please describe the problem with at least 10 characters.' });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title,
        category,
        priority,
        module,
        description,
      });

      toast({
        variant: 'success',
        title: 'Issue Raised Successfully',
        message: 'Your ticket has been logged and assigned to the support desk.',
      });

      // Reset
      setTitle('');
      setDescription('');
      setCategory('Software & System Bug');
      setPriority('medium');
      setModule('General / Cross-Platform');
      onClose();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Failed to Submit',
        message: err.message || 'An unexpected error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Raise a Support Issue"
      size="md"
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            Submit Ticket
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ background: 'var(--brand-muted)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 2 }}>
            💡 Fast Track Support
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Report bugs, attendance/leave corrections, hardware faults, or general requests. Our operations team reviews all incoming tickets within business hours.
          </div>
        </div>

        {/* Issue Title */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Issue Summary / Title <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Biometric punch not reflected on April 12th"
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            required
          />
        </div>

        {/* Category & Module */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Category <span style={{ color: 'var(--status-danger)' }}>*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IssueCategory)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-sunken)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Affected Module
            </label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-sunken)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              {MODULE_OPTIONS.map((mod) => (
                <option key={mod} value={mod}>
                  {mod}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority Selector */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Severity & Urgency
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {PRIORITIES.map((p) => {
              const isSelected = priority === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriority(p.key)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? `2px solid ${p.color}` : '1px solid var(--border)',
                    background: isSelected ? p.bg : 'var(--bg-sunken)',
                    color: isSelected ? p.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 160ms',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize' }}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Detailed Description <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Please detail what happened, steps to reproduce, or specific action needed..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.5,
            }}
            required
          />
        </div>

        {/* Attachment mock notice */}
        <div style={{
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          textAlign: 'center',
          background: 'var(--bg-sunken)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            📎 Attach Screenshots or Logs (Optional)
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Drag and drop images or PDFs up to 10MB
          </div>
        </div>
      </form>
    </Drawer>
  );
}
