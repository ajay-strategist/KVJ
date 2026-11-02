import React, { memo, useState, useMemo } from 'react';
import { Card, SectionHeader, Badge } from '../../../../shared/ui/components';
import { useCommunication } from '../../../../modules/communication/hooks/useCommunication';
import { useAuth } from '../../../../modules/auth/AuthProvider';

export const AnnouncementWidget = memo(function AnnouncementWidget() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // UIUX-REQ-003: User-scoped storage key
  const storageKey = useMemo(() => {
    return user?.id ? `flwdsk_dismissed_announcements_${user.id}` : 'flwdsk_dismissed_announcements_guest';
  }, [user?.id]);

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const activeKey = user?.id ? `flwdsk_dismissed_announcements_${user.id}` : 'flwdsk_dismissed_announcements_guest';
      const saved = localStorage.getItem(activeKey) || localStorage.getItem('kvj_dismissed_announcements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Real announcements from the communication module.
  const { announcements, loading } = useCommunication();

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (e) { void e; }
      return next;
    });
  };

  // UIUX-REQ-003: Newest first, filtering out dismissed items AND expired notices (expires_at < NOW())
  const now = Date.now();
  const visibleAnnouncements = announcements
    .filter((a) => {
      if (dismissedIds.includes(a.id)) return false;
      if (a.expiresAt) {
        const expTime = new Date(a.expiresAt).getTime();
        if (!isNaN(expTime) && expTime < now) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.scheduledAt ?? a.createdAt).getTime();
      const tb = new Date(b.scheduledAt ?? b.createdAt).getTime();
      return tb - ta;
    });

  const targetLabel: Record<string, string> = {
    organization: 'Organization',
    department: 'Department',
    project: 'Project',
    training: 'Training',
  };

  return (
    <Card>
      <SectionHeader title="Announcements & Notices" />
      {visibleAnnouncements.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 2px' }}>
          {loading ? 'Loading announcements…' : 'No announcements.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleAnnouncements.map((a) => {
            const isExpanded = expandedId === a.id;
            const isHigh = a.priority === 'high';
            const tone = isHigh ? 'danger' : 'neutral';
            const when = new Date(a.scheduledAt ?? a.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const content = a.content ?? '';

            return (
              <div
                key={a.id}
                style={{
                  borderLeft: `4px solid ${isHigh ? 'var(--status-danger)' : 'var(--brand)'}`,
                  background: 'var(--bg-sunken)',
                  padding: '12px 14px',
                  borderRadius: '0 8px 8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative',
                  transition: 'all 160ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isHigh && <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>📌 Pinned</span>}
                    <Badge tone={tone}>{targetLabel[a.targetType] ?? a.targetType}</Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{when}</span>
                    <button
                      type="button"
                      onClick={() => handleDismiss(a.id)}
                      aria-label="Dismiss notice"
                      title="Dismiss notice"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontSize: 14,
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 120ms ease',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', paddingRight: 20 }}>{a.title}</div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {isExpanded || content.length <= 95 ? content : `${content.slice(0, 95)}...`}
                </div>

                {content.length > 95 && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      marginTop: 2,
                    }}
                  >
                    {isExpanded ? 'Read Less ▲' : 'Read More ▼'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
});

export default AnnouncementWidget;

