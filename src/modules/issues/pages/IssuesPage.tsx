/**
 * KVJ Analytics — Issues & Helpdesk Workspace Page
 */

import { useState, useMemo } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Card, Button, Badge, Avatar } from '../../../shared/ui/components';
import { useIssues } from '../hooks/useIssues';
import { useAuth } from '../../auth/AuthProvider';
import { NewIssueDrawer } from '../components/NewIssueDrawer';
import { IssueDetailDrawer } from '../components/IssueDetailDrawer';
import type { IssueTicket, IssueStatus, IssueCategory } from '../types/issue.types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function IssuesPage() {
  const { user } = useAuth();
  const userRole = (user?.role || 'EMPLOYEE').toUpperCase();
  const isMgmt = ['ADMIN', 'CEO', 'MANAGER'].includes(userRole);

  const { issues, stats, createIssue, updateStatus } = useIssues();

  const [newDrawerOpen, setNewDrawerOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueTicket | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'my'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      // Tab filter
      if (activeTab === 'open' && i.status !== 'open') return false;
      if (activeTab === 'in_progress' && i.status !== 'in_progress' && i.status !== 'under_review') return false;
      if (activeTab === 'resolved' && i.status !== 'resolved' && i.status !== 'closed') return false;
      if (activeTab === 'my') {
        const isAuthor =
          (user?.id && i.reportedBy.id === user.id) ||
          (user?.email && i.reportedBy.email.toLowerCase() === user.email.toLowerCase()) ||
          (user?.fullName && i.reportedBy.name.toLowerCase() === user.fullName.toLowerCase());
        if (!isAuthor) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && i.category !== selectedCategory) return false;

      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          i.id.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.reportedBy.name.toLowerCase().includes(q) ||
          (i.module && i.module.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [issues, activeTab, selectedCategory, searchQuery, user]);

  const handleOpenDetail = (issue: IssueTicket) => {
    setSelectedIssue(issue);
    setDetailDrawerOpen(true);
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
    <AppShell>
      <PageHeader
        title="Raise Issue & Support Desk"
        subtitle="Report operational bottlenecks, application bugs, or facilities tickets and track resolutions"
        actions={
          <Button
            variant="primary"
            onClick={() => setNewDrawerOpen(true)}
            leftIcon={
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            Raise New Issue
          </Button>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Metric Stat Cards Strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {/* Total Tickets */}
          <Card padding="compact">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Tickets
              </span>
              <span style={{ fontSize: 18 }}>📋</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
              {stats.total}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Across all categories
            </div>
          </Card>

          {/* Open Tickets */}
          <Card padding="compact">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-danger)', textTransform: 'uppercase' }}>
                Open / Unresolved
              </span>
              <span style={{ fontSize: 18 }}>⚠️</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--status-danger)', marginTop: 8 }}>
              {stats.open}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Pending team review
            </div>
          </Card>

          {/* In Progress */}
          <Card padding="compact">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase' }}>
                In Progress
              </span>
              <span style={{ fontSize: 18 }}>⚙️</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand)', marginTop: 8 }}>
              {stats.inProgress}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Actively being addressed
            </div>
          </Card>

          {/* Resolved */}
          <Card padding="compact">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-success)', textTransform: 'uppercase' }}>
                Resolved
              </span>
              <span style={{ fontSize: 18 }}>✅</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--status-success)', marginTop: 8 }}>
              {stats.resolved}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Successfully closed
            </div>
          </Card>
        </div>

        {/* ── Filters & Search Control Bar ── */}
        <Card padding="compact">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Tab strip */}
            <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
              {[
                { key: 'all', label: `All Tickets (${stats.total})` },
                { key: 'open', label: `Open (${stats.open})` },
                { key: 'in_progress', label: `In Progress (${stats.inProgress})` },
                { key: 'resolved', label: `Resolved (${stats.resolved})` },
                { key: 'my', label: 'My Submissions' },
              ].map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key as any)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: isActive ? 'var(--brand)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      fontSize: 12.5,
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 160ms',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Search and Category Filter Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 380 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ticket ID, summary, or reporter..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: 12.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: 12.5,
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Tickets Data Table ── */}
        <Card padding="compact">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: 100 }}>ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Issue & Category</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: 110 }}>Priority</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: 130 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Reported By</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, width: 110 }}>Age</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right', width: 120 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        No issues found matching criteria
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 4 }}>
                        {searchQuery ? 'Try clearing your search filters.' : 'Click "Raise New Issue" to log a new ticket.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((issue) => (
                    <tr
                      key={issue.id}
                      onClick={() => handleOpenDetail(issue)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 120ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 800, color: 'var(--brand)', fontFamily: 'monospace' }}>
                        {issue.id}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {issue.title}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {issue.category}
                          </span>
                          {issue.module && (
                            <>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>•</span>
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{issue.module}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Badge tone={getPriorityTone(issue.priority)} size="sm">
                          {issue.priority.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Badge tone={getStatusTone(issue.status)} size="sm">
                          {issue.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={issue.reportedBy.name} src={issue.reportedBy.avatarUrl} size={24} />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {issue.reportedBy.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {issue.reportedBy.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {timeAgo(issue.createdAt)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(issue);
                          }}
                        >
                          {isMgmt ? 'Resolve' : 'Details'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* New Issue Drawer */}
      <NewIssueDrawer
        open={newDrawerOpen}
        onClose={() => setNewDrawerOpen(false)}
        onSubmit={async (input) => {
          await createIssue(input);
        }}
      />

      {/* Issue Detail & Resolution Drawer */}
      <IssueDetailDrawer
        issue={selectedIssue}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedIssue(null);
        }}
        onUpdateStatus={async (id, status, notes) => {
          await updateStatus(id, status, notes);
          if (selectedIssue && selectedIssue.id === id) {
            setSelectedIssue((prev) => prev ? { ...prev, status, resolutionNotes: notes || prev.resolutionNotes } : null);
          }
        }}
      />
    </AppShell>
  );
}
