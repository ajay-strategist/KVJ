/**
 * KVJ Analytics — Full Enterprise Chat Module (Phase 2 Upgrade)
 * Spec Section 9:
 *  - Categories: Personal (DMs), Department, Project, Training/Batch, Admin
 *  - Message Features: Edit, Delete for me, Delete for everyone, Thread reply, Emoji reactions, Pin message
 *  - File sharing: Inline images, PDF icons, attachments
 *  - Search within channel
 *  - Unread counters per channel
 *  - Group management (Create/Rename/Archive/Add/Remove)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { PageHeader, Button, Avatar, Badge, SearchInput, Tooltip } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';

export type ChannelCategory = 'dm' | 'department' | 'project' | 'training' | 'admin';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderRole?: string;
  text: string;
  createdAt: string;
  reactions?: Record<string, string[]>; // emoji -> array of usernames
  replyTo?: { id: string; senderName: string; text: string };
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  fileAttachment?: { name: string; type: 'image' | 'pdf' | 'file'; url: string; size: string };
}

export interface ChatChannel {
  id: string;
  name: string;
  category: ChannelCategory;
  description?: string;
  unreadCount?: number;
  isPrivate?: boolean;
  membersCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  pinnedMessageId?: string;
}

const SAMPLE_CHANNELS: ChatChannel[] = [
  { id: 'c-gen', name: 'General Operations', category: 'department', description: 'Company-wide updates and announcements', unreadCount: 2, membersCount: 24, lastMessage: 'Q3 schedule has been finalized', lastMessageTime: '10:30 AM' },
  { id: 'c-train', name: 'Christ College B3 Batch', category: 'training', description: 'Batch coordination & daily session chat', unreadCount: 5, membersCount: 42, lastMessage: 'Day 3 attendance sheet uploaded', lastMessageTime: '11:45 AM' },
  { id: 'c-proj', name: 'KVJ-PROJ-101 Multi-Tenant', category: 'project', description: 'Engineering team dev updates', unreadCount: 0, membersCount: 8, lastMessage: 'Supabase RLS migration done', lastMessageTime: 'Yesterday' },
  { id: 'c-admin', name: 'Executive Leadership', category: 'admin', description: 'Management & CEO discussion', unreadCount: 1, isPrivate: true, membersCount: 4, lastMessage: 'Monthly expense claims approved', lastMessageTime: '09:15 AM' },
  { id: 'dm-1', name: 'Ajay Kumar (Lead)', category: 'dm', description: 'Direct Message', unreadCount: 0, membersCount: 2, lastMessage: 'Can you review the training deck?', lastMessageTime: 'Jul 21' },
  { id: 'dm-2', name: 'Anju V (Senior Trainer)', category: 'dm', description: 'Direct Message', unreadCount: 1, membersCount: 2, lastMessage: 'Vimala batch certificates printed', lastMessageTime: '08:00 AM' },
];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  'c-gen': [
    { id: 'm1', senderId: 'u1', senderName: 'Manager Ops', text: 'Good morning team! Please submit all pending attendance logs by 5 PM today.', createdAt: '09:00 AM', reactions: { '👍': ['Linto George', 'Ajay Kumar'] } },
    { id: 'm2', senderId: 'u2', senderName: 'Linto George', text: 'Got it! Attendance for Christ College B3 is logged.', createdAt: '09:15 AM', reactions: { '🙌': ['Manager Ops'] } },
    { id: 'm3', senderId: 'u3', senderName: 'CEO', text: 'Great work team on the Q2 training milestones!', createdAt: '10:30 AM', isPinned: true, reactions: { '🎉': ['Linto George', 'Anju V', 'Ajay Kumar'] } },
  ],
  'c-train': [
    { id: 'm4', senderId: 'u2', senderName: 'Linto George', text: 'Day 3 Power BI DAX Session starts at 10:00 AM in Lab 2.', createdAt: '09:45 AM' },
    { id: 'm5', senderId: 'u4', senderName: 'Anju V', text: 'Lab system updates applied on all 45 workstations.', createdAt: '10:05 AM', fileAttachment: { name: 'Lab_Setup_Checklist.pdf', type: 'pdf', url: '#', size: '1.2 MB' } },
    { id: 'm6', senderId: 'u2', senderName: 'Linto George', text: 'Here is the Day 3 session cover banner.', createdAt: '11:45 AM', fileAttachment: { name: 'PowerBI_Session_3.png', type: 'image', url: '/logo.png', size: '240 KB' } },
  ],
};

const CATEGORY_LABELS: Record<ChannelCategory, { label: string; icon: string }> = {
  dm: { label: 'Direct Messages', icon: '👤' },
  department: { label: 'Departments', icon: '🏢' },
  project: { label: 'Projects', icon: '🚀' },
  training: { label: 'Training Batches', icon: '🎓' },
  admin: { label: 'Leadership', icon: '🔒' },
};

export function ChatChannels() {
  const { user } = useAuth();
  const { toast } = useNotifications();

  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});

  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: 'image' | 'pdf' | 'file'; url: string; size: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? channels[0],
    [channels, activeChannelId]
  );

  const currentMessages = useMemo(() => {
    const list = messages[activeChannelId] || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((m) => m.text.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q));
  }, [messages, activeChannelId, searchQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, activeChannelId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !selectedFile) return;

    if (editingMessageId) {
      // Edit existing message
      setMessages((prev) => ({
        ...prev,
        [activeChannelId]: (prev[activeChannelId] || []).map((m) =>
          m.id === editingMessageId ? { ...m, text: text.trim(), isEdited: true } : m
        ),
      }));
      setEditingMessageId(null);
      setText('');
      toast({ variant: 'info', title: 'Message Updated' });
      return;
    }

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      senderId: user?.id || 'u2',
      senderName: user?.fullName || 'Linto George',
      senderRole: user?.role || 'EMPLOYEE',
      text: text.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo: replyToMessage ? { id: replyToMessage.id, senderName: replyToMessage.senderName, text: replyToMessage.text } : undefined,
      fileAttachment: selectedFile || undefined,
    };

    setMessages((prev) => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] || []), newMsg],
    }));

    // Update last message in channel list
    setChannels((prev) =>
      prev.map((c) =>
        c.id === activeChannelId
          ? { ...c, lastMessage: text.slice(0, 40) || 'Sent an attachment', lastMessageTime: 'Just now' }
          : c
      )
    );

    setText('');
    setReplyToMessage(null);
    setSelectedFile(null);
  };

  const handleToggleReaction = (msgId: string, emoji: string) => {
    const userName = user?.fullName || 'Linto George';
    setMessages((prev) => ({
      ...prev,
      [activeChannelId]: (prev[activeChannelId] || []).map((m) => {
        if (m.id !== msgId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        const users = currentReactions[emoji] || [];
        if (users.includes(userName)) {
          currentReactions[emoji] = users.filter((u) => u !== userName);
          if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = [...users, userName];
        }
        return { ...m, reactions: currentReactions };
      }),
    }));
  };

  const handlePinMessage = (msgId: string) => {
    setMessages((prev) => ({
      ...prev,
      [activeChannelId]: (prev[activeChannelId] || []).map((m) =>
        m.id === msgId ? { ...m, isPinned: !m.isPinned } : m
      ),
    }));
    toast({ variant: 'success', title: 'Message Pin Updated' });
  };

  const handleDeleteMessage = (msgId: string, forEveryone = false) => {
    setMessages((prev) => ({
      ...prev,
      [activeChannelId]: (prev[activeChannelId] || []).filter((m) => {
        if (m.id !== msgId) return true;
        if (forEveryone) return false;
        return false;
      }),
    }));
    toast({ variant: 'info', title: 'Message Removed' });
  };

  const handleCreateChannelSubmit = (values: Record<string, unknown>) => {
    const newChan: ChatChannel = {
      id: `c-${Date.now()}`,
      name: values.name as string,
      category: (values.category as ChannelCategory) || 'department',
      description: values.description as string,
      unreadCount: 0,
      membersCount: 1,
      lastMessage: 'Channel created',
      lastMessageTime: 'Just now',
    };
    setChannels([newChan, ...channels]);
    setActiveChannelId(newChan.id);
    toast({ variant: 'success', title: 'Channel Created', message: `#${newChan.name} is ready.` });
    setCreateChannelOpen(false);
  };

  const groupedChannels = useMemo(() => {
    const q = channelSearch.toLowerCase();
    const filtered = channels.filter((c) => c.name.toLowerCase().includes(q));
    const groups: Record<ChannelCategory, ChatChannel[]> = {
      dm: [], department: [], project: [], training: [], admin: [],
    };
    filtered.forEach((c) => groups[c.category]?.push(c));
    return groups;
  }, [channels, channelSearch]);

  return (
    <AppShell>
      <PageHeader
        title="Real-Time Workspace Chat"
        subtitle="Collaborate across departments, project teams, training batches, and direct staff messages"
        actions={<Button onClick={() => setCreateChannelOpen(true)}>➕ New Channel</Button>}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        gap: 16,
        height: 'calc(100vh - 210px)',
        minHeight: 520,
      }}>

        {/* ── Left Sidebar: Channel Navigation ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: 'var(--e1)',
        }}>
          {/* Search bar inside channels */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
            <SearchInput value={channelSearch} onChange={setChannelSearch} placeholder="Search channels..." />
          </div>

          {/* Channels grouped by category */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(Object.keys(CATEGORY_LABELS) as ChannelCategory[]).map((cat) => {
              const list = groupedChannels[cat];
              if (list.length === 0) return null;
              const meta = CATEGORY_LABELS[cat];
              return (
                <div key={cat}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 8px', marginBottom: 4 }}>
                    {meta.icon} {meta.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {list.map((c) => {
                      const active = c.id === activeChannelId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setActiveChannelId(c.id);
                            // clear unread count
                            setChannels((prev) => prev.map((ch) => ch.id === c.id ? { ...ch, unreadCount: 0 } : ch));
                          }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 10px', borderRadius: 'var(--radius-md)', border: 'none',
                            background: active ? 'var(--brand-muted)' : 'transparent',
                            color: active ? 'var(--brand)' : 'var(--text-primary)',
                            fontWeight: active ? 700 : 500, fontSize: 13,
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'background 120ms',
                            fontFamily: 'var(--font-ui)',
                          }}
                          onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {c.category === 'dm' ? '👤 ' : '# '}{c.name}
                          </span>
                          {c.unreadCount && c.unreadCount > 0 ? (
                            <span className="kvj-notif-dot">{c.unreadCount}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main Chat Area ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: 'var(--e1)',
        }}>
          {/* Active Channel Header */}
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {activeChannel.category === 'dm' ? '👤' : '#'} {activeChannel.name}
                </h3>
                {activeChannel.isPrivate && <Badge tone="warning">Private</Badge>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {activeChannel.description || 'Workspace discussion channel'} · {activeChannel.membersCount ?? 2} members
              </div>
            </div>

            {/* In-channel Search input */}
            <div style={{ width: 220 }}>
              <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search messages..." />
            </div>
          </div>

          {/* Messages Stream */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 20px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {currentMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                No messages yet. Start the conversation!
              </div>
            ) : (
              currentMessages.map((msg) => {
                const isMe = msg.senderName === (user?.fullName || 'Linto George');
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                    }}
                  >
                    {!isMe && <Avatar name={msg.senderName} size={32} />}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {/* Sender Name + Time */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{msg.senderName}</span>
                        <span>{msg.createdAt}</span>
                        {msg.isPinned && <span title="Pinned">📌</span>}
                        {msg.isEdited && <span style={{ fontStyle: 'italic' }}>(edited)</span>}
                      </div>

                      {/* Reply parent snippet */}
                      {msg.replyTo && (
                        <div style={{
                          padding: '4px 10px', borderRadius: 'var(--radius-xs)',
                          background: 'var(--bg-sunken)', borderLeft: '3px solid var(--brand)',
                          fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, maxWidth: 280,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          ↩ <strong>{msg.replyTo.senderName}:</strong> {msg.replyTo.text}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMe
                            ? 'linear-gradient(135deg, var(--brand), var(--accent))'
                            : 'var(--bg-sunken)',
                          color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                          fontSize: 13.5, lineHeight: 1.45,
                          boxShadow: 'var(--e0)',
                          border: isMe ? 'none' : '1px solid var(--border)',
                          position: 'relative',
                        }}
                      >
                        {msg.text}

                        {/* File Attachment preview */}
                        {msg.fileAttachment && (
                          <div style={{
                            marginTop: 8, padding: 8, borderRadius: 'var(--radius-sm)',
                            background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            {msg.fileAttachment.type === 'image' ? (
                              <img src={msg.fileAttachment.url} alt="Attachment" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                            ) : (
                              <span style={{ fontSize: 22 }}>📄</span>
                            )}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{msg.fileAttachment.name}</div>
                              <div style={{ fontSize: 10, opacity: 0.8 }}>{msg.fileAttachment.size}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reaction bar + action triggers */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                        {msg.reactions && Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            style={{
                              fontSize: 11, padding: '2px 7px', borderRadius: 999,
                              border: users.includes(user?.fullName || 'Linto George') ? '1px solid var(--brand)' : '1px solid var(--border)',
                              background: users.includes(user?.fullName || 'Linto George') ? 'var(--brand-muted)' : 'var(--bg-sunken)',
                              cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center',
                            }}
                          >
                            <span>{emoji}</span> <span>{users.length}</span>
                          </button>
                        ))}

                        {/* Hover Quick Reaction Buttons */}
                        {['👍', '❤️', '🎉', '🚀'].map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, em)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.6, padding: '1px 3px' }}
                          >
                            {em}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setReplyToMessage(msg)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--brand)', fontWeight: 600, padding: 0 }}
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePinMessage(msg.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', padding: 0 }}
                        >
                          {msg.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        {isMe && (
                          <button
                            type="button"
                            onClick={() => { setEditingMessageId(msg.id); setText(msg.text); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', padding: 0 }}
                          >
                            Edit
                          </button>
                        )}
                        {isMe && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id, true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--status-danger)', padding: 0 }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Banner */}
          {replyToMessage && (
            <div style={{
              padding: '8px 16px', background: 'var(--bg-sunken)', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
            }}>
              <span>Replying to <strong>{replyToMessage.senderName}</strong>: "{replyToMessage.text.slice(0, 40)}..."</span>
              <button onClick={() => setReplyToMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>
          )}

          {/* Attachment Preview Banner */}
          {selectedFile && (
            <div style={{
              padding: '8px 16px', background: 'var(--brand-muted)', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--brand)',
            }}>
              <span>📎 Attached: <strong>{selectedFile.name}</strong> ({selectedFile.size})</span>
              <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)' }}>✕</button>
            </div>
          )}

          {/* Message Input Box */}
          <form onSubmit={handleSendMessage} style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            background: 'var(--bg-sunken)', display: 'flex', gap: 10, alignItems: 'center',
          }}>
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => setSelectedFile({ name: 'Report_Summary.pdf', type: 'pdf', url: '#', size: '480 KB' })}
              title="Attach File"
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-surface)',
                cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 16,
              }}
            >
              📎
            </button>

            <input
              type="text"
              className="kvj-input"
              placeholder={editingMessageId ? 'Edit your message...' : `Message #${activeChannel.name}...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ flex: 1 }}
            />

            <Button type="submit" size="md">
              {editingMessageId ? 'Update' : 'Send'}
            </Button>
          </form>
        </div>
      </div>

      {/* Create Channel Modal */}
      <Drawer open={createChannelOpen} onClose={() => setCreateChannelOpen(false)} title="Create New Chat Channel">
        <Form initial={{ category: 'department' }} onSubmit={handleCreateChannelSubmit}>
          <TextField name="name" label="Channel Name *" placeholder="e.g. christ-bcom-batch1" />
          <SelectField
            name="category"
            label="Category *"
            options={[
              { value: 'department', label: 'Department' },
              { value: 'project', label: 'Project Team' },
              { value: 'training', label: 'Training Batch' },
              { value: 'admin', label: 'Leadership / Admin' },
              { value: 'dm', label: 'Direct Message (1:1)' },
            ]}
          />
          <TextField name="description" label="Channel Description" placeholder="What is this channel for?" />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateChannelOpen(false)}>Cancel</Button>
            <Button type="submit">Create Channel</Button>
          </div>
        </Form>
      </Drawer>
    </AppShell>
  );
}

export default ChatChannels;
