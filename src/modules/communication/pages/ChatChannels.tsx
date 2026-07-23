import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { Button, Avatar, Badge, SearchInput } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useAuth } from '../../auth/AuthProvider';
import { useCommunication } from '../hooks/useCommunication';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';
import { container } from '../../../core/registry';
import { CHAT_CHANNEL_REPOSITORY_TOKEN, type ChannelType } from '../communication.repository';

export type ChannelCategory = 'announcement' | 'department' | 'dm' | 'starred' | 'archived';

const CATEGORY_LABELS: Record<ChannelCategory, { label: string; icon: string }> = {
  announcement: { label: 'Announcements', icon: '📢' },
  department: { label: 'Departments', icon: '🏢' },
  starred: { label: 'Starred Chats', icon: '⭐' },
  archived: { label: 'Archived Chats', icon: '📁' },
  dm: { label: 'Direct Messages', icon: '👤' },
};

export function ChatChannels() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { employees, loading: employeesLoading } = useEmployee();

  // Active channel and layout state
  const [activeChannelId, setActiveChannelId] = useState<string>('c-general');
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<ChannelCategory>('department');

  // Input composer state
  const [text, setText] = useState('');
  const [composerAttachment, setComposerAttachment] = useState<{ name: string; type: 'image' | 'pdf' | 'file'; url: string; size: string } | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; senderName: string; text: string } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Search filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [channelSearch, setChannelSearch] = useState('');

  // Dropdown states
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Voice recording simulation
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef<any>(null);

  // Modal states
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createDmOpen, setCreateDmOpen] = useState(false);

  // Layout refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);

  // Hooks data layer
  const {
    channels: repoChannels,
    messages: repoMessages,
    typingUsers,
    sendMessage: hookSendMessage,
    editMessage: hookEditMessage,
    deleteMessage: hookDeleteMessage,
    toggleReaction: hookToggleReaction,
    togglePinMessage: hookTogglePinMessage,
    sendTypingStatus,
    createChannel: hookCreateChannel,
  } = useCommunication(activeChannelId ? (activeChannelId as UUID) : undefined);

  // Map database channels to local view model contract
  const mappedChannels = useMemo(() => {
    return repoChannels.map((c) => {
      let category: ChannelCategory = 'department';
      if (c.type === 'announcement') category = 'announcement';
      else if (c.type === 'department') category = 'department';
      else if (c.type === 'direct' || c.type === 'team') category = 'dm';

      if (c.isStarred) category = 'starred';
      if (c.isArchived) category = 'archived';

      // Find direct message recipient details
      let dmParticipant = null;
      if (c.type === 'direct' && c.name?.startsWith('DM:')) {
        const parts = c.name.split(' <-> ');
        const otherUserId = parts.find((p) => p !== user?.id && p !== 'DM:')?.replace('DM:', '').trim();
        dmParticipant = employees.find((e) => e.id === otherUserId) || null;
      }

      return {
        id: c.id,
        name: dmParticipant ? `${dmParticipant.firstName} ${dmParticipant.lastName}` : (c.name || 'Direct Message'),
        category,
        description: c.department || c.type || '',
        unreadCount: 0,
        membersCount: c.members?.length || 5,
        isMuted: c.isMuted,
        isStarred: c.isStarred,
        isArchived: c.isArchived,
        type: c.type,
        pinnedMessageId: c.pinnedMessageId,
        dmParticipant,
      };
    });
  }, [repoChannels, employees, user]);

  // Set initial active channel
  useEffect(() => {
    if (mappedChannels.length > 0 && !activeChannelId) {
      setActiveChannelId(mappedChannels[0].id);
    }
  }, [mappedChannels, activeChannelId]);

  const activeChannel = useMemo(
    () => mappedChannels.find((c) => c.id === activeChannelId) ?? mappedChannels[0] ?? {
      id: 'c-general',
      name: 'General',
      category: 'department' as ChannelCategory,
      description: 'Default department chat',
      membersCount: 5,
      isMuted: false,
      isStarred: false,
      isArchived: false,
      type: 'department',
      pinnedMessageId: undefined,
      dmParticipant: null,
    },
    [mappedChannels, activeChannelId]
  );

  // Map messages and enrich with sender profiles
  const currentMessages = useMemo(() => {
    const list = repoMessages.map((m) => {
      const sender = employees.find((e) => e.id === m.senderId);
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'System Admin';

      // Group reactions by emoji key
      const reactionsGrouped: Record<string, string[]> = {};
      m.reactions?.forEach((r) => {
        const reactingUser = employees.find((e) => e.id === r.userId);
        const rName = reactingUser ? `${reactingUser.firstName} ${reactingUser.lastName}` : 'System Admin';
        if (!reactionsGrouped[r.reaction]) reactionsGrouped[r.reaction] = [];
        reactionsGrouped[r.reaction].push(rName);
      });

      return {
        id: m.id,
        senderId: m.senderId,
        senderName,
        senderAvatar: sender?.avatarUrl,
        senderRole: sender?.designation || 'System Bot',
        senderDepartment: sender?.departmentId || 'Operations',
        text: m.text,
        createdAt: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        reactions: reactionsGrouped,
        isPinned: m.isPinned,
        isEdited: m.isEdited,
        isDeleted: m.isDeleted,
        fileAttachment: m.fileAttachment,
        replyToMessage: m.replyToMessage || (m.replyTo ? { id: m.replyTo, senderName: 'Message', text: 'Thread Reply' } : undefined),
      };
    });

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((m) => m.text.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q));
  }, [repoMessages, employees, searchQuery]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, activeChannelId]);

  // Send typing notifications to the BroadcastChannel when user is actively writing
  const handleComposerChange = (val: string) => {
    setText(val);
    sendTypingStatus(val.length > 0);

    // Mentions autocomplete trigger
    const words = val.split(' ');
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionQuery(lastWord.slice(1));
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (empName: string) => {
    const words = text.split(' ');
    words[words.length - 1] = `@${empName} `;
    setText(words.join(' '));
    setShowMentions(false);
    composerInputRef.current?.focus();
  };

  // Recording timer simulation
  const startRecording = () => {
    setIsRecording(true);
    setRecordDuration(0);
    recordTimerRef.current = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = (shouldAttach: boolean) => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    if (shouldAttach) {
      setComposerAttachment({
        name: `Audio_Note_${new Date().toLocaleTimeString().replace(/ /g, '')}.mp3`,
        type: 'file',
        url: '#',
        size: `${Math.round((recordDuration * 12.8))} KB`,
      });
      toast({ variant: 'success', title: 'Voice Note Ready', message: 'Audio memo attached successfully.' });
    }
  };

  // Composer submit
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !composerAttachment) return;

    if (editingMessageId) {
      const res = await hookEditMessage(editingMessageId as UUID, text.trim());
      if (res.ok) {
        setEditingMessageId(null);
        setText('');
        toast({ variant: 'success', title: 'Message Updated' });
      } else {
        toast({ variant: 'error', title: 'Update Failed', message: res.error });
      }
      return;
    }

    const fileToUpload = composerAttachment || undefined;
    const replyToId = replyToMessage ? (replyToMessage.id as UUID) : undefined;

    const res = await hookSendMessage(text.trim(), fileToUpload, replyToId);
    if (res.ok) {
      setText('');
      setComposerAttachment(null);
      setReplyToMessage(null);
      sendTypingStatus(false);
    } else {
      toast({ variant: 'error', title: 'Send Failed', message: res.error });
    }
  };

  // Star, Pin, Archive channel triggers
  const handleToggleStarChannel = async (cId: string) => {
    const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
    const target = await channelRepo.findById(cId as UUID);
    if (target) {
      target.isStarred = !target.isStarred;
      await channelRepo.update(cId as UUID, target, { id: user?.id || 'u-admin', role: user?.role || 'ADMIN' });
      toast({ variant: 'success', title: target.isStarred ? 'Channel Starred' : 'Channel Unstarred' });
    }
  };

  const handleToggleArchiveChannel = async (cId: string) => {
    const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
    const target = await channelRepo.findById(cId as UUID);
    if (target) {
      target.isArchived = !target.isArchived;
      await channelRepo.update(cId as UUID, target, { id: user?.id || 'u-admin', role: user?.role || 'ADMIN' });
      toast({ variant: 'success', title: target.isArchived ? 'Channel Archived' : 'Channel Unarchived' });
    }
  };

  const handleToggleMuteChannel = async (cId: string) => {
    const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
    const target = await channelRepo.findById(cId as UUID);
    if (target) {
      target.isMuted = !target.isMuted;
      await channelRepo.update(cId as UUID, target, { id: user?.id || 'u-admin', role: user?.role || 'ADMIN' });
      toast({ variant: 'success', title: target.isMuted ? 'Channel Muted' : 'Channel Unmuted' });
    }
  };

  // Group creation handler
  const handleCreateChannelSubmit = async (values: Record<string, unknown>) => {
    const cat = (values.category as ChannelType) || 'department';
    const res = await hookCreateChannel({
      name: values.name as string,
      type: cat,
      department: values.description as string,
      members: [user?.id as UUID],
    });

    if (res.ok) {
      setActiveChannelId(res.value.id);
      toast({ variant: 'success', title: 'Channel Created', message: `#${res.value.name} is ready.` });
      setCreateChannelOpen(false);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  // Dynamic DM Channel Creator
  const handleStartDirectMessage = async (targetEmployeeId: string) => {
    // Check if channel already exists
    const existing = mappedChannels.find(
      (c) => c.type === 'direct' && c.name?.includes(targetEmployeeId) && c.name?.includes(user?.id || '')
    );
    if (existing) {
      setActiveChannelId(existing.id);
      setCreateDmOpen(false);
      return;
    }

    // Create a new direct channel
    const res = await hookCreateChannel({
      name: `DM: ${user?.id} <-> ${targetEmployeeId}`,
      type: 'direct',
      members: [user?.id as UUID, targetEmployeeId as UUID],
    });

    if (res.ok) {
      setActiveChannelId(res.value.id);
      setCreateDmOpen(false);
      toast({ variant: 'success', title: 'Direct Message Started' });
    } else {
      toast({ variant: 'error', title: 'DM Initialization Failed', message: res.error });
    }
  };

  // Filter channels grouped by categories
  const filteredChannelsGrouped = useMemo(() => {
    const q = channelSearch.toLowerCase();
    const filtered = mappedChannels.filter((c) => c.name.toLowerCase().includes(q));

    const groups: Record<ChannelCategory, typeof mappedChannels> = {
      announcement: [], department: [], dm: [], starred: [], archived: [],
    };
    filtered.forEach((c) => {
      if (c.isStarred) groups.starred.push(c);
      else if (c.isArchived) groups.archived.push(c);
      else groups[c.category]?.push(c);
    });
    return groups;
  }, [mappedChannels, channelSearch]);

  // Autocomplete list of employees for mentions
  const filteredEmployeesForMention = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return employees.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q));
  }, [employees, mentionQuery]);

  // Pinned message item in Active Channel
  const pinnedMessage = useMemo(() => {
    if (!activeChannel.pinnedMessageId) return null;
    return currentMessages.find((m) => m.id === activeChannel.pinnedMessageId);
  }, [currentMessages, activeChannel.pinnedMessageId]);

  return (
    <AppShell>
      {/* ── Slack/Teams Workspace Outer Grid Layout ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr' + (showRightPanel ? ' 320px' : ''),
        gap: 16,
        height: 'calc(100vh - 180px)',
        minHeight: 600,
        fontFamily: 'var(--font-ui)',
      }}>

        {/* ── Left Sidebar (Channel Navigation) ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--e1)',
        }}>
          {/* Header Actions */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Button style={{ flex: 1 }} size="sm" onClick={() => setCreateChannelOpen(true)}>
                💬 Create Group
              </Button>
              <Button style={{ flex: 1 }} size="sm" variant="secondary" onClick={() => setCreateDmOpen(true)}>
                👤 New Chat
              </Button>
            </div>
            <SearchInput value={channelSearch} onChange={setChannelSearch} placeholder="Jump to channel/chat..." />
          </div>

          {/* Categories / Channel Accordions */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(Object.keys(CATEGORY_LABELS) as ChannelCategory[]).map((catKey) => {
              const list = filteredChannelsGrouped[catKey];
              const meta = CATEGORY_LABELS[catKey];
              const isCatActive = activeCategory === catKey;

              return (
                <div key={catKey}>
                  <button
                    onClick={() => setActiveCategory(isCatActive ? 'department' : catKey)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '4px 8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{meta.icon} {meta.label} ({list.length})</span>
                    <span>{isCatActive ? '▼' : '▶'}</span>
                  </button>

                  {isCatActive && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, paddingLeft: 6 }}>
                      {list.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 8px', fontStyle: 'italic' }}>
                          No channels in this list
                        </div>
                      ) : (
                        list.map((c) => {
                          const active = c.id === activeChannelId;
                          return (
                            <button
                              key={c.id}
                              onClick={() => setActiveChannelId(c.id)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: active ? 'var(--brand-muted)' : 'transparent',
                                color: active ? 'var(--brand)' : 'var(--text-primary)',
                                fontWeight: active ? 700 : 500,
                                fontSize: 13,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {c.type === 'direct' ? (
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-success)' }} />
                                ) : (
                                  <span>#</span>
                                )}
                                {c.name}
                              </span>
                              {c.isMuted && <span style={{ fontSize: 11, opacity: 0.6 }}>🔇</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Center Chat Panel (Feed & Input Composer) ── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--e1)',
          position: 'relative',
        }}>
          {/* Header Panel */}
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {activeChannel.type === 'direct' ? '👤' : '#'} {activeChannel.name}
                </h3>
                {activeChannel.type === 'announcement' && <Badge tone="warning">Announcements Only</Badge>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {activeChannel.description || 'Enterprise collaboration room'} · {activeChannel.membersCount} members
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 180 }}>
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Find messages..." />
              </div>
              <button
                onClick={() => handleToggleStarChannel(activeChannel.id)}
                title="Star Channel"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                {activeChannel.isStarred ? '⭐' : '☆'}
              </button>
              <button
                onClick={() => handleToggleArchiveChannel(activeChannel.id)}
                title="Archive Channel"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                📥
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRightPanel(!showRightPanel)}
              >
                {showRightPanel ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>
          </div>

          {/* Pinned Message Alert Bar */}
          {pinnedMessage && (
            <div style={{
              padding: '8px 16px',
              background: 'var(--brand-muted)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--brand)',
            }}>
              <span>📌 **Pinned Message**: {pinnedMessage.senderName}: "{pinnedMessage.text.slice(0, 75)}..."</span>
              <button
                onClick={() => hookTogglePinMessage(pinnedMessage.id as UUID)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--brand)' }}
              >
                Unpin
              </button>
            </div>
          )}

          {/* Messages Feed Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            {currentMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
                <strong style={{ display: 'block', fontSize: 15, color: 'var(--text-secondary)' }}>Welcome to #{activeChannel.name}!</strong>
                <span style={{ fontSize: 12 }}>No messages in this conversation. Start the chat below.</span>
              </div>
            ) : (
              currentMessages.map((msg) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div
                    key={msg.id}
                    className="group"
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      alignItems: 'flex-start',
                    }}
                  >
                    {!isMe && <Avatar name={msg.senderName} src={msg.senderAvatar} size={36} />}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {/* Name + Time */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{msg.senderName}</span>
                        <span style={{ fontSize: 9, opacity: 0.7 }}>{msg.senderRole}</span>
                        <span>{msg.createdAt}</span>
                        {msg.isPinned && <span>📌</span>}
                        {msg.isEdited && <span style={{ fontStyle: 'italic' }}>(edited)</span>}
                      </div>

                      {/* Parent reply preview bubble */}
                      {msg.replyToMessage && (
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'var(--bg-sunken)',
                          borderLeft: '3px solid var(--brand)',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginBottom: 4,
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          ↩ **{msg.replyToMessage.senderName}**: {msg.replyToMessage.text}
                        </div>
                      )}

                      {/* Bubble */}
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMe ? 'linear-gradient(135deg, var(--brand), var(--accent, var(--brand)))' : 'var(--bg-sunken)',
                        color: isMe ? '#FFFFFF' : 'var(--text-primary)',
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        border: isMe ? 'none' : '1px solid var(--border)',
                        position: 'relative',
                        boxShadow: 'var(--e0)',
                      }}>
                        {msg.isDeleted ? (
                          <span style={{ fontStyle: 'italic', opacity: 0.7 }}>This message was deleted.</span>
                        ) : (
                          msg.text
                        )}

                        {/* File Attachment Card */}
                        {msg.fileAttachment && (
                          <div style={{
                            marginTop: 10,
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}>
                            <span style={{ fontSize: 24 }}>
                              {msg.fileAttachment.type === 'image' ? '🖼️' : '📄'}
                            </span>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.fileAttachment.name}
                              </div>
                              <div style={{ fontSize: 10, opacity: 0.8 }}>{msg.fileAttachment.size}</div>
                            </div>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => toast({ variant: 'info', title: 'Downloading file', message: msg.fileAttachment?.name })}
                            >
                              Download
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Reaction status / Actions menu */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                        {msg.reactions && Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => hookToggleReaction(msg.id as UUID, emoji)}
                            style={{
                              fontSize: 11,
                              padding: '2px 7px',
                              borderRadius: 999,
                              border: users.includes(user?.fullName || '') ? '1px solid var(--brand)' : '1px solid var(--border)',
                              background: users.includes(user?.fullName || '') ? 'var(--brand-muted)' : 'var(--bg-sunken)',
                              cursor: 'pointer',
                              display: 'flex',
                              gap: 4,
                              alignItems: 'center',
                            }}
                          >
                            <span>{emoji}</span> <span>{users.length}</span>
                          </button>
                        ))}

                        {/* Hover Quick Shortcuts */}
                        <div style={{ display: 'flex', gap: 6, opacity: 0.8 }}>
                          {['👍', '❤️', '🎉', '🚀'].map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => hookToggleReaction(msg.id as UUID, em)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '1px 3px' }}
                            >
                              {em}
                            </button>
                          ))}
                        </div>

                        {/* Text Actions */}
                        <button
                          type="button"
                          onClick={() => setReplyToMessage({ id: msg.id, senderName: msg.senderName, text: msg.text })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => hookTogglePinMessage(msg.id as UUID)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
                        >
                          {msg.isPinned ? 'Unpin' : 'Pin'}
                        </button>
                        {isMe && !msg.isDeleted && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setEditingMessageId(msg.id); setText(msg.text); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => hookDeleteMessage(msg.id as UUID)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--status-danger)' }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {isMe && <span style={{ fontSize: 11, color: 'var(--brand)', marginLeft: 4 }}>✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing indicators */}
            {Object.keys(typingUsers).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 12 }}>
                <span className="kvj-typing-dots" style={{ display: 'inline-flex', gap: 2 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s infinite 0s' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s infinite 0.2s' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s infinite 0.4s' }} />
                </span>
                <span>{Object.values(typingUsers).join(', ')} is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer Banners (Replies & Attachments) */}
          {replyToMessage && (
            <div style={{
              padding: '8px 16px',
              background: 'var(--bg-sunken)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
            }}>
              <span>Replying to **{replyToMessage.senderName}**: "{replyToMessage.text.slice(0, 45)}..."</span>
              <button
                onClick={() => setReplyToMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {composerAttachment && (
            <div style={{
              padding: '8px 16px',
              background: 'var(--brand-muted)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--brand)',
            }}>
              <span>📎 Attached: **{composerAttachment.name}** ({composerAttachment.size})</span>
              <button
                onClick={() => setComposerAttachment(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Voice recording Banner */}
          {isRecording && (
            <div style={{
              padding: '10px 16px',
              background: 'var(--status-danger-muted, #ffebeb)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--status-danger, #d32f2f)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="kvj-recording-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1s infinite' }} />
                <span>Recording Audio Memo... <strong>{Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button size="xs" variant="secondary" onClick={() => stopRecording(false)}>Cancel</Button>
                <Button size="xs" onClick={() => stopRecording(true)}>✅ Done</Button>
              </div>
            </div>
          )}

          {/* Mentions Dropdown Autocomplete */}
          {showMentions && (
            <div style={{
              position: 'absolute',
              bottom: 60,
              left: 60,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--e3)',
              maxHeight: 180,
              overflowY: 'auto',
              zIndex: 100,
              width: 220,
            }}>
              {filteredEmployeesForMention.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleSelectMention(`${emp.firstName}${emp.lastName}`)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  @{emp.firstName} {emp.lastName}
                </button>
              ))}
            </div>
          )}

          {/* Emoji Picker Popup */}
          {showEmojiPicker && (
            <div style={{
              position: 'absolute',
              bottom: 60,
              left: 10,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--e3)',
              padding: 10,
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
              zIndex: 100,
            }}>
              {['😀', '😂', '🔥', '👍', '🎉', '🚀', '❤️', '👀', '👏', '😮'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setText((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                    composerInputRef.current?.focus();
                  }}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4 }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Attachment Menu Popup */}
          {showAttachmentMenu && (
            <div style={{
              position: 'absolute',
              bottom: 60,
              left: 10,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--e3)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 100,
              width: 180,
            }}>
              {[
                { label: '🖼️ Image File', type: 'image', name: 'Dashboard_Screen.png', size: '1.4 MB' },
                { label: '📄 PDF Document', type: 'pdf', name: 'Training_Syllabus.pdf', size: '380 KB' },
                { label: '📊 Excel Sheet', type: 'file', name: 'Q3_Payroll_Records.xlsx', size: '2.1 MB' },
                { label: '🗂️ Zip Archive', type: 'file', name: 'Assets_Bundle.zip', size: '12.4 MB' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setComposerAttachment({ name: item.name, type: item.type as any, url: '#', size: item.size });
                    setShowAttachmentMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Composer Input Box */}
          <form onSubmit={handleSendMessage} style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}>
            {/* Attachment clip */}
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              title="Attach File"
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
                fontSize: 18,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              📎
            </button>

            {/* Emoji Trigger */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add Emoji"
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
                fontSize: 18,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              😀
            </button>

            {/* Voice Memo Recording */}
            <button
              type="button"
              onClick={isRecording ? () => stopRecording(false) : startRecording}
              title="Record Voice Note"
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                border: isRecording ? '1px solid #d32f2f' : '1px solid var(--border)',
                background: isRecording ? '#ffebeb' : 'var(--bg-surface)',
                cursor: 'pointer',
                fontSize: 18,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              🎙️
            </button>

            <input
              ref={composerInputRef}
              type="text"
              className="kvj-input"
              placeholder={editingMessageId ? 'Edit your message...' : `Message ${activeChannel.name}...`}
              value={text}
              onChange={(e) => handleComposerChange(e.target.value)}
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />

            <Button type="submit" size="md">
              {editingMessageId ? 'Save' : 'Send'}
            </Button>
          </form>
        </div>

        {/* ── Right Panel (Profile Details & Pin List) ── */}
        {showRightPanel && (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: 'var(--e1)',
          }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                Room Specifications
              </h4>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Profile card if active DM channel */}
              {activeChannel.dmParticipant ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
                  <Avatar name={`${activeChannel.dmParticipant.firstName} ${activeChannel.dmParticipant.lastName}`} src={activeChannel.dmParticipant.avatarUrl} size={80} />
                  <div>
                    <h5 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                      {activeChannel.dmParticipant.firstName} {activeChannel.dmParticipant.lastName}
                    </h5>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {activeChannel.dmParticipant.designation}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--brand)', marginTop: 2 }}>
                      {activeChannel.dmParticipant.departmentId || 'Operations'} Department
                    </div>
                  </div>
                  <Badge tone={activeChannel.dmParticipant.status === 'active' ? 'success' : 'neutral'}>
                    {activeChannel.dmParticipant.status}
                  </Badge>

                  <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, textAlign: 'left' }}>
                    <div>📧 <strong>Email:</strong> {activeChannel.dmParticipant.email}</div>
                    <div>📞 <strong>Phone:</strong> {activeChannel.dmParticipant.phone || '+91 9988776655'}</div>
                    <div>📅 <strong>Joined:</strong> {activeChannel.dmParticipant.dateOfJoining}</div>
                  </div>
                </div>
              ) : (
                <div>
                  <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    #{activeChannel.name}
                  </h5>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    {activeChannel.description}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Badge tone="neutral">{activeChannel.type}</Badge>
                    <Badge tone="success">{activeChannel.membersCount} members</Badge>
                  </div>
                </div>
              )}

              {/* Pin list panel */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)' }}>
                  📌 Pinned Messages ({currentMessages.filter((m) => m.isPinned).length})
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {currentMessages.filter((m) => m.isPinned).map((pm) => (
                    <div
                      key={pm.id}
                      style={{
                        padding: 10,
                        background: 'var(--bg-sunken)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong>{pm.senderName}</strong>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pm.createdAt}</span>
                      </div>
                      <div>{pm.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Group Creation Drawer */}
      <Drawer open={createChannelOpen} onClose={() => setCreateChannelOpen(false)} title="Create New Collaboration Channel">
        <Form initial={{ category: 'department' }} onSubmit={handleCreateChannelSubmit}>
          <TextField name="name" label="Channel Name *" placeholder="e.g. sales-team-updates" />
          <SelectField
            name="category"
            label="Category Type *"
            options={[
              { value: 'department', label: 'Department Room' },
              { value: 'announcement', label: 'Announcement Room (Restricted)' },
              { value: 'team', label: 'General Project/Team Room' },
            ]}
          />
          <TextField name="description" label="Room Purpose / Description" placeholder="Explain what is discussed here..." />
          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setCreateChannelOpen(false)}>Cancel</Button>
            <Button type="submit">Create Channel</Button>
          </div>
        </Form>
      </Drawer>

      {/* Start Direct Message Drawer */}
      <Drawer open={createDmOpen} onClose={() => setCreateDmOpen(false)} title="Select Colleague to Message">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
          {employeesLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Retrieving colleagues list...</div>
          ) : (
            employees.filter((e) => e.id !== user?.id).map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleStartDirectMessage(emp.id)}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
              >
                <Avatar name={`${emp.firstName} ${emp.lastName}`} src={emp.avatarUrl} size={36} />
                <div>
                  <strong style={{ display: 'block', fontSize: 13 }}>{emp.firstName} {emp.lastName}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.designation} · {emp.departmentId || 'Operations'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </Drawer>
    </AppShell>
  );
}

export default ChatChannels;
