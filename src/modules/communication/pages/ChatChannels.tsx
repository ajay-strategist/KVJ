import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AppShell } from '../../../shared/layout/AppShell';
import { Button, Avatar, Badge, SearchInput } from '../../../shared/ui/components';
import Drawer from '../../../shared/ui/Drawer';
import { Form, TextField, SelectField } from '../../../shared/forms/form';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { useDialog } from '../../../shared/feedback/DialogProvider';
import { supabase } from '../../../shared/integration/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useCommunication } from '../hooks/useCommunication';
import { useEmployee } from '../../employee/hooks/useEmployee';
import type { UUID } from '../../../core/types';
import { container } from '../../../core/registry';
import { CHAT_CHANNEL_REPOSITORY_TOKEN, type ChannelType } from '../communication.repository';

export type ChannelCategory = 'announcement' | 'department' | 'dm' | 'starred' | 'archived';
export type LeftPanelState = 'expanded' | 'slim' | 'hidden';

const CATEGORY_LABELS: Record<ChannelCategory, { label: string; icon: string }> = {
  announcement: { label: 'Announcements', icon: '📢' },
  department: { label: 'Departments', icon: '🏢' },
  starred: { label: 'Starred Chats', icon: '⭐' },
  archived: { label: 'Archived Chats', icon: '📁' },
  dm: { label: 'Direct Messages', icon: '👤' },
};

/** Format ISO date into relative time string e.g. 10:42 AM or 2m ago */
function formatRelativeTime(dateStr?: string | Date): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatChannels() {
  const { user } = useAuth();
  const { toast } = useNotifications();
  const { confirm } = useDialog();
  const { employees, loading: employeesLoading } = useEmployee();

  // Active channel
  const [activeChannelId, setActiveChannelId] = useState<string>('');

  // ── Collapsible Panel States & Focus Mode ────────────────────────
  const [leftPanelState, setLeftPanelState] = useState<LeftPanelState>(() => {
    try {
      const saved = localStorage.getItem('kvj_chat_left_panel_state_v2');
      if (saved === 'expanded' || saved === 'slim') return saved;
      const old = localStorage.getItem('kvj_chat_left_panel_open');
      return old !== null && !JSON.parse(old) ? 'slim' : 'expanded';
    } catch {
      return 'expanded';
    }
  });

  const [showRightPanel, setShowRightPanel] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kvj_chat_right_panel_open_v2');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const prevPanelStateRef = useRef<{ left: LeftPanelState; right: boolean }>({
    left: 'expanded',
    right: true,
  });

  const [activeCategory, setActiveCategory] = useState<ChannelCategory>('department');

  // Toggle Left Panel Mode (Expanded ↔ Slim Rail)
  const toggleLeftPanelMode = () => {
    setLeftPanelState((prev) => {
      const next: LeftPanelState = prev === 'expanded' ? 'slim' : 'expanded';
      try { localStorage.setItem('kvj_chat_left_panel_state_v2', next); } catch {}
      return next;
    });
  };

  const forceExpandLeftPanel = () => {
    setLeftPanelState('expanded');
    try { localStorage.setItem('kvj_chat_left_panel_state_v2', 'expanded'); } catch {}
  };

  const toggleRightPanel = () => {
    setShowRightPanel((prev) => {
      const next = !prev;
      try { localStorage.setItem('kvj_chat_right_panel_open_v2', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev;
      if (next) {
        // Entering Focus Mode: save current states and collapse both
        prevPanelStateRef.current = { left: leftPanelState, right: showRightPanel };
        setLeftPanelState('hidden');
        setShowRightPanel(false);
        toast({ variant: 'info', title: 'Focus Mode Active', message: 'Side panels collapsed for distraction-free view.' });
      } else {
        // Leaving Focus Mode: restore previous states
        setLeftPanelState(prevPanelStateRef.current.left);
        setShowRightPanel(prevPanelStateRef.current.right);
      }
      return next;
    });
  };

  // ── Input Composer State ─────────────────────────────────────────
  const [text, setText] = useState('');
  const [composerAttachment, setComposerAttachment] = useState<{ name: string; type: 'image' | 'pdf' | 'file'; url: string; size: string } | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; senderName: string; text: string } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [channelSearch, setChannelSearch] = useState('');

  // Dropdown / Popover States
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [activeMessageActionId, setActiveMessageActionId] = useState<string | null>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef<any>(null);

  // Drawers & Modals
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createDmOpen, setCreateDmOpen] = useState(false);
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  // Smart Scroll Management State
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesBelowCount, setNewMessagesBelowCount] = useState(0);
  const [lastSeenMsgId, setLastSeenMsgId] = useState<string | null>(null);

  // Layout refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);

  // ── Hooks Data Layer ─────────────────────────────────────────────
  const {
    channels: repoChannels,
    messages: repoMessages,
    typingUsers,
    unreadCounts,
    markChannelAsRead,
    sendMessage: hookSendMessage,
    editMessage: hookEditMessage,
    deleteMessage: hookDeleteMessage,
    toggleReaction: hookToggleReaction,
    togglePinMessage: hookTogglePinMessage,
    sendTypingStatus,
    createChannel: hookCreateChannel,
    refresh,
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

      let dmParticipant = null;
      let otherName = '';
      if (c.type === 'direct' && c.name?.startsWith('DM:')) {
        const cleaned = c.name.replace(/^DM:\s*/i, '');
        const parts = cleaned.split(/\s*<->\s*/);
        const otherUserId = parts.find((p) => p.trim() !== user?.id)?.trim();
        dmParticipant = employees.find((e) => e.id === otherUserId || `${e.firstName} ${e.lastName}` === otherUserId) || null;
        otherName = otherUserId || '';
      }

      const unreadCount = unreadCounts[c.id] || 0;

      return {
        id: c.id,
        name: dmParticipant ? `${dmParticipant.firstName} ${dmParticipant.lastName}` : (otherName || c.name || 'Direct Message'),
        category,
        description: c.department || c.type || '',
        unreadCount,
        membersCount: c.members?.length || 2,
        isMuted: c.isMuted,
        isStarred: c.isStarred,
        isArchived: c.isArchived,
        type: c.type,
        pinnedMessageId: c.pinnedMessageId,
        dmParticipant,
        updatedAt: c.updatedAt,
      };
    });
  }, [repoChannels, employees, user, unreadCounts]);

  // Set initial active channel & mark read on change
  useEffect(() => {
    if (mappedChannels.length > 0 && !activeChannelId) {
      setActiveChannelId(mappedChannels[0].id);
    }
  }, [mappedChannels, activeChannelId]);

  useEffect(() => {
    if (activeChannelId) {
      markChannelAsRead(activeChannelId);
    }
  }, [activeChannelId, markChannelAsRead]);

  const activeChannel = useMemo(
    () => mappedChannels.find((c) => c.id === activeChannelId) ?? mappedChannels[0] ?? {
      id: 'c-general',
      name: 'General',
      category: 'department' as ChannelCategory,
      description: 'Default department chat',
      unreadCount: 0,
      membersCount: 5,
      isMuted: false,
      isStarred: false,
      isArchived: false,
      type: 'department',
      pinnedMessageId: undefined,
      dmParticipant: null,
      updatedAt: undefined,
    },
    [mappedChannels, activeChannelId]
  );

  // Map messages and enrich with sender profiles
  const currentMessages = useMemo(() => {
    const list = repoMessages.map((m) => {
      const sender = employees.find((e) => e.id === m.senderId);
      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'System Admin';

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
        senderDepartment: sender?.departmentId || '—',
        text: m.text,
        createdAt: m.createdAt ? formatRelativeTime(m.createdAt) : '',
        rawDate: m.createdAt,
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

  // Total unread notifications across all background channels
  const totalUnreadCount = useMemo(() => {
    return Object.entries(unreadCounts).reduce((acc, [cId, count]) => {
      if (cId !== activeChannelId) return acc + count;
      return acc;
    }, 0);
  }, [unreadCounts, activeChannelId]);

  // ── Smart Scroll Position Management ──────────────────────────────
  const handleScrollMessages = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    setIsNearBottom(atBottom);
    if (atBottom) {
      setNewMessagesBelowCount(0);
    }
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setNewMessagesBelowCount(0);
  };

  // When new messages arrive: auto-scroll if near bottom, else show floating pill
  useEffect(() => {
    if (currentMessages.length === 0) return;
    const latestMsg = currentMessages[currentMessages.length - 1];
    if (latestMsg.id !== lastSeenMsgId) {
      setLastSeenMsgId(latestMsg.id);
      if (isNearBottom || latestMsg.senderId === user?.id) {
        scrollToBottom(true);
      } else {
        setNewMessagesBelowCount((prev) => prev + 1);
      }
    }
  }, [currentMessages, isNearBottom, lastSeenMsgId, user?.id]);

  // ── Composer Input Handlers ────────────────────────────────────────
  const handleComposerChange = (val: string) => {
    setText(val);
    sendTypingStatus(val.length > 0);

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

  // Voice recording simulation
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
        name: `Audio_Memo_${new Date().toLocaleTimeString().replace(/ /g, '')}.mp3`,
        type: 'file',
        url: '#',
        size: `${Math.round(recordDuration * 12.8)} KB`,
      });
      toast({ variant: 'success', title: 'Voice Note Attached', message: 'Audio memo attached successfully.' });
    }
  };

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
      scrollToBottom(true);
    } else {
      toast({ variant: 'error', title: 'Send Failed', message: res.error });
    }
  };

  // ── Channel Management Actions ────────────────────────────────────
  const handleToggleStarChannel = async (cId: string) => {
    if (!user?.id) return;
    const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
    const target = await channelRepo.findById(cId as UUID);
    if (target) {
      target.isStarred = !target.isStarred;
      await channelRepo.update(cId as UUID, target, { id: user.id, role: user.role });
      toast({ variant: 'success', title: target.isStarred ? 'Channel Starred' : 'Channel Unstarred' });
    }
  };

  const handleToggleArchiveChannel = async (cId: string) => {
    if (!user?.id) return;
    const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
    const target = await channelRepo.findById(cId as UUID);
    if (target) {
      target.isArchived = !target.isArchived;
      await channelRepo.update(cId as UUID, target, { id: user.id, role: user.role });
      toast({ variant: 'success', title: target.isArchived ? 'Channel Archived' : 'Channel Unarchived' });
    }
  };

  const handleDeleteChannel = async (cId: string) => {
    if (!user?.id) return;
    const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
    const target = await channelRepo.findById(cId as UUID);
    if (!target) return;

    const isFullControl = ['ADMIN', 'CEO', 'MANAGER'].includes((user.role || '').toUpperCase());
    if (target.createdBy && target.createdBy !== user.id && !isFullControl) {
      toast({ variant: 'error', title: 'Not Allowed', message: 'Only the creator or an admin can delete this chat.' });
      return;
    }

    const chatName = mappedChannels.find((c) => c.id === cId)?.name || 'this chat';
    const ok = await confirm({
      title: 'Delete Chat',
      message: `Delete "${chatName}" and ALL its messages? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'delete',
    });
    if (!ok) return;

    try {
      const ts = new Date().toISOString();
      const { error: msgErr } = await supabase
        .from('flwdsk_chat_messages')
        .update({ deleted_at: ts, deleted_by: user.id })
        .eq('channel_id', cId)
        .is('deleted_at', null);
      if (msgErr) throw msgErr;

      await channelRepo.softDelete(cId as UUID, { id: user.id, role: user.role });

      toast({ variant: 'success', title: 'Chat Deleted', message: `"${chatName}" and its messages were removed.` });
      if (activeChannelId === cId) setActiveChannelId('');
      await refresh();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Delete Failed', message: e?.message || 'Could not delete the chat.' });
    }
  };

  const handleCreateChannelSubmit = async (values: Record<string, unknown>) => {
    const cat = (values.category as ChannelType) || 'department';
    const memberSet = new Set<string>([user?.id as string, ...newChannelMembers]);
    const res = await hookCreateChannel({
      name: values.name as string,
      type: cat,
      department: values.description as string,
      members: Array.from(memberSet).filter(Boolean) as UUID[],
    });

    if (res.ok) {
      setActiveChannelId(res.value.id);
      setNewChannelMembers([]);
      toast({ variant: 'success', title: 'Channel Created', message: `#${res.value.name} is ready.` });
      setCreateChannelOpen(false);
    } else {
      toast({ variant: 'error', title: 'Creation Failed', message: res.error });
    }
  };

  const handleStartDirectMessage = async (targetEmployeeId: string) => {
    const existing = mappedChannels.find(
      (c) => c.type === 'direct' && c.name?.includes(targetEmployeeId) && c.name?.includes(user?.id || '')
    );
    if (existing) {
      setActiveChannelId(existing.id);
      setCreateDmOpen(false);
      return;
    }

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

  // Group channels by category
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

  const filteredEmployeesForMention = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return employees.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q));
  }, [employees, mentionQuery]);

  const pinnedMessage = useMemo(() => {
    if (!activeChannel.pinnedMessageId) return null;
    return currentMessages.find((m) => m.id === activeChannel.pinnedMessageId);
  }, [currentMessages, activeChannel.pinnedMessageId]);

  // Compute CSS grid columns dynamically based on collapse states
  const gridColumns = useMemo(() => {
    let leftWidth = '0px';
    if (leftPanelState === 'expanded') leftWidth = '300px';
    else if (leftPanelState === 'slim') leftWidth = '68px';

    const rightWidth = showRightPanel ? '320px' : '0px';
    return `${leftWidth} 1fr ${rightWidth}`.trim();
  }, [leftPanelState, showRightPanel]);

  return (
    <AppShell>
      {/* CSS Animations & Custom Styles for Modern Chat UI */}
      <style>{`
        .kvj-chat-grid {
          display: grid;
          gap: 16px;
          height: calc(100vh - 180px);
          min-height: 620px;
          font-family: var(--font-ui);
          transition: grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .kvj-chat-panel {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--e1);
          transition: all 0.25s ease;
        }
        .kvj-msg-row {
          position: relative;
          display: flex;
          gap: 12px;
          align-items: flex-start;
          transition: background 0.15s ease;
          border-radius: 12px;
          padding: 4px 8px;
        }
        .kvj-msg-actions-toolbar {
          position: absolute;
          top: -16px;
          right: 12px;
          background: var(--bg-surface, #ffffff);
          border: 1px solid var(--border);
          border-radius: 20px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 3px 6px;
          opacity: 0;
          visibility: hidden;
          transform: translateY(4px);
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 50;
        }
        .kvj-msg-row:hover .kvj-msg-actions-toolbar,
        .kvj-msg-row:focus-within .kvj-msg-actions-toolbar {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .kvj-action-btn {
          background: none;
          border: none;
          padding: 4px 6px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .kvj-action-btn:hover {
          background: var(--bg-sunken);
          color: var(--brand);
        }
        .kvj-typing-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--brand);
          display: inline-block;
          animation: kvjDotBlink 1.2s infinite ease-in-out both;
        }
        .kvj-typing-dot:nth-child(1) { animation-delay: 0s; }
        .kvj-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .kvj-typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes kvjDotBlink {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* ── Main Chat Outer Grid Layout ── */}
      <div className="kvj-chat-grid" style={{ gridTemplateColumns: gridColumns }}>

        {/* ── 1. Left Sidebar (Collapsible: Expanded | Slim Rail | Hidden) ── */}
        {leftPanelState !== 'hidden' && (
          <div className="kvj-chat-panel">
            {/* Expanded State Header */}
            {leftPanelState === 'expanded' ? (
              <div style={{ padding: 14, borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <Button style={{ flex: 1 }} size="sm" onClick={() => setCreateChannelOpen(true)}>
                    💬 Create Group
                  </Button>
                  <Button style={{ flex: 1 }} size="sm" variant="secondary" onClick={() => setCreateDmOpen(true)}>
                    👤 New Chat
                  </Button>
                </div>
                <SearchInput value={channelSearch} onChange={setChannelSearch} placeholder="Jump to channel or colleague..." />
              </div>
            ) : (
              /* Slim Rail Mode Header */
              <div style={{ padding: '12px 6px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setCreateChannelOpen(true)}
                  title="Create Group"
                  style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--brand)', color: 'white', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}
                >
                  💬
                </button>
                <button
                  type="button"
                  onClick={() => setCreateDmOpen(true)}
                  title="New Direct Message"
                  style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', cursor: 'pointer', fontSize: 16, display: 'grid', placeItems: 'center' }}
                >
                  👤
                </button>
              </div>
            )}

            {/* Channels & DMs List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: leftPanelState === 'expanded' ? '12px 8px' : '10px 4px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(Object.keys(CATEGORY_LABELS) as ChannelCategory[]).map((catKey) => {
                const list = filteredChannelsGrouped[catKey];
                const meta = CATEGORY_LABELS[catKey];
                const isCatActive = activeCategory === catKey;

                if (leftPanelState === 'slim') {
                  return (
                    <div key={catKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div title={meta.label} style={{ fontSize: 14, opacity: 0.6, cursor: 'pointer' }} onClick={() => setActiveCategory(catKey)}>
                        {meta.icon}
                      </div>
                      {list.map((c) => {
                        const active = c.id === activeChannelId;
                        return (
                          <div key={c.id} style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setActiveChannelId(c.id)}
                              title={`${c.name} (${c.unreadCount} unread)`}
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 12,
                                border: active ? '2px solid var(--brand)' : '1px solid var(--border)',
                                background: active ? 'var(--brand-muted)' : 'var(--bg-surface)',
                                cursor: 'pointer',
                                display: 'grid',
                                placeItems: 'center',
                                position: 'relative',
                              }}
                            >
                              {c.type === 'direct' ? (
                                <Avatar name={c.name} src={c.dmParticipant?.avatarUrl} size={28} />
                              ) : (
                                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand)' }}>#</span>
                              )}
                            </button>

                            {/* Slim Rail Unread Dot */}
                            {c.unreadCount > 0 && (
                              <span style={{
                                position: 'absolute',
                                top: -2,
                                right: -2,
                                minWidth: 16,
                                height: 16,
                                borderRadius: 8,
                                background: 'var(--status-danger, #ef4444)',
                                color: 'white',
                                fontSize: 10,
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 4px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                              }}>
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Expanded View Category & Items
                return (
                  <div key={catKey}>
                    <button
                      type="button"
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                        {list.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 8px', fontStyle: 'italic' }}>
                            No channels in this category
                          </div>
                        ) : (
                          list.map((c) => {
                            const active = c.id === activeChannelId;
                            return (
                              <button
                                key={c.id}
                                type="button"
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
                                  fontWeight: active || c.unreadCount > 0 ? 700 : 500,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease',
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', flex: 1 }}>
                                  {c.type === 'direct' ? (
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                      <Avatar name={c.name} src={c.dmParticipant?.avatarUrl} size={26} />
                                      <span style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: c.dmParticipant?.status === 'active' ? '#22c55e' : '#94a3b8',
                                        border: '1.5px solid var(--bg-surface)',
                                      }} />
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 15, fontWeight: 800, color: active ? 'var(--brand)' : 'var(--text-muted)' }}>#</span>
                                  )}
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    <div>{c.name}</div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {c.isMuted && <span style={{ fontSize: 11, opacity: 0.6 }}>🔇</span>}
                                  {c.unreadCount > 0 && (
                                    <span style={{
                                      minWidth: 18,
                                      height: 18,
                                      borderRadius: 9,
                                      background: 'var(--brand)',
                                      color: 'white',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '0 5px',
                                    }}>
                                      {c.unreadCount}
                                    </span>
                                  )}
                                </div>
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
        )}

        {/* ── 2. Center Main Conversation Area ── */}
        <div className="kvj-chat-panel" style={{ position: 'relative' }}>
          
          {/* Conversation Header */}
          <div style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Left Panel Collapse Toggle Button */}
              <button
                type="button"
                onClick={toggleLeftPanelMode}
                title={leftPanelState === 'expanded' ? "Switch to Slim Rail" : "Expand Channels Sidebar"}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  padding: '5px 9px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {leftPanelState === 'expanded' ? '◀ Slim View' : '▶ Expand Channels'}
              </button>

              {/* Focus Mode Button */}
              <button
                type="button"
                onClick={toggleFocusMode}
                title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode (Distraction Free)'}
                style={{
                  background: isFocusMode ? 'var(--brand)' : 'var(--bg-surface)',
                  color: isFocusMode ? 'white' : 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  padding: '5px 9px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isFocusMode ? '👁️ Exit Focus' : '🔍 Focus'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
                {activeChannel.type === 'direct' ? (
                  <Avatar name={activeChannel.name} src={activeChannel.dmParticipant?.avatarUrl} size={32} />
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)' }}>#</span>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {activeChannel.name}
                    </h3>
                    {activeChannel.type === 'announcement' && <Badge tone="warning">Announcements</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {activeChannel.description || 'Collaboration channel'} · {activeChannel.membersCount} members
                  </div>
                </div>
              </div>
            </div>

            {/* Header Right Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Notification Centre Bell */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                  title="Chat Notifications"
                  style={{
                    background: showNotificationCenter ? 'var(--brand-muted)' : 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 15,
                    display: 'grid',
                    placeItems: 'center',
                    position: 'relative',
                  }}
                >
                  🔔
                  {totalUnreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      background: 'var(--status-danger, #ef4444)',
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                    }}>
                      {totalUnreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Centre Popover Dropdown */}
                {showNotificationCenter && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 320,
                    background: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    zIndex: 99999,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Notifications ({totalUnreadCount})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          mappedChannels.forEach((c) => markChannelAsRead(c.id));
                          setShowNotificationCenter(false);
                        }}
                        style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 700, color: 'var(--brand)', cursor: 'pointer' }}
                      >
                        Mark all as read
                      </button>
                    </div>

                    <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mappedChannels.filter((c) => c.unreadCount > 0).length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                          No unread notifications 🎉
                        </div>
                      ) : (
                        mappedChannels.filter((c) => c.unreadCount > 0).map((c) => (
                          <div
                            key={c.id}
                            onClick={() => { setActiveChannelId(c.id); setShowNotificationCenter(false); }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'var(--bg-sunken)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div style={{ overflow: 'hidden' }}>
                              <strong style={{ display: 'block', fontSize: 12 }}>#{c.name}</strong>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.unreadCount} unread message{c.unreadCount > 1 ? 's' : ''}</span>
                            </div>
                            <Button size="xs" variant="ghost" onClick={(ev) => { ev.stopPropagation(); markChannelAsRead(c.id); }}>
                              Clear
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Search Messages Input */}
              <div style={{ width: 160 }}>
                <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Find message..." />
              </div>

              <button
                type="button"
                onClick={() => handleToggleStarChannel(activeChannel.id)}
                title="Star Channel"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                {activeChannel.isStarred ? '⭐' : '☆'}
              </button>
              <button
                type="button"
                onClick={() => handleToggleArchiveChannel(activeChannel.id)}
                title="Archive Channel"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                📥
              </button>
              <button
                type="button"
                onClick={() => handleDeleteChannel(activeChannel.id)}
                title="Delete Chat"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                🗑️
              </button>

              {/* Room Details Toggle */}
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleRightPanel}
              >
                {showRightPanel ? 'Hide Details ◀' : 'Details ▶'}
              </Button>
            </div>
          </div>

          {/* Fallback Banner when Left Panel is Hidden */}
          {leftPanelState === 'hidden' && (
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
              <span>📁 Channels sidebar is currently hidden (Full Screen Mode).</span>
              <Button size="xs" onClick={forceExpandLeftPanel}>
                ▶ Restore Channels Sidebar
              </Button>
            </div>
          )}

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
              <span>📌 <strong>Pinned</strong>: {pinnedMessage.senderName}: "{pinnedMessage.text.slice(0, 75)}..."</span>
              <button
                type="button"
                onClick={() => hookTogglePinMessage(pinnedMessage.id as UUID)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'var(--brand)' }}
              >
                Unpin
              </button>
            </div>
          )}

          {/* Messages Feed Area */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScrollMessages}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {currentMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
                <strong style={{ display: 'block', fontSize: 15, color: 'var(--text-secondary)' }}>Welcome to #{activeChannel.name}!</strong>
                <span style={{ fontSize: 12 }}>No messages in this conversation yet. Send a message to start.</span>
              </div>
            ) : (
              currentMessages.map((msg, index) => {
                const isMe = msg.senderId === user?.id;
                const isActionsOpen = activeMessageActionId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className="kvj-msg-row"
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                    }}
                  >
                    {!isMe && <Avatar name={msg.senderName} src={msg.senderAvatar} size={36} />}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {/* Name + Time Header */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{msg.senderName}</span>
                        <span style={{ fontSize: 10, opacity: 0.7 }}>{msg.senderRole}</span>
                        <span>{msg.createdAt}</span>
                        {msg.isPinned && <span>📌</span>}
                        {msg.isEdited && <span style={{ fontStyle: 'italic' }}>(edited)</span>}
                      </div>

                      {/* Reply Parent Preview */}
                      {msg.replyToMessage && (
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'var(--bg-sunken)',
                          borderLeft: '3px solid var(--brand)',
                          fontSize: 12,
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

                      {/* Bubble Container */}
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isMe ? 'linear-gradient(135deg, var(--brand), #4f46e5)' : 'var(--bg-sunken)',
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
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-md)',
                            background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}>
                            <span style={{ fontSize: 22 }}>
                              {msg.fileAttachment.type === 'image' ? '🖼️' : '📄'}
                            </span>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.fileAttachment.name}
                              </div>
                              <div style={{ fontSize: 11, opacity: 0.8 }}>{msg.fileAttachment.size}</div>
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

                      {/* Reactions Status List */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => hookToggleReaction(msg.id as UUID, emoji)}
                              style={{
                                fontSize: 11,
                                padding: '2px 6px',
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
                        </div>
                      )}

                      {/* ── Modern Floating Message Action Toolbar (On Hover) ── */}
                      <div className="kvj-msg-actions-toolbar">
                        {['👍', '❤️', '🎉'].map((em) => (
                          <button
                            key={em}
                            type="button"
                            className="kvj-action-btn"
                            title={`React ${em}`}
                            onClick={() => hookToggleReaction(msg.id as UUID, em)}
                          >
                            {em}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="kvj-action-btn"
                          title="Reply in thread"
                          onClick={() => setReplyToMessage({ id: msg.id, senderName: msg.senderName, text: msg.text })}
                        >
                          ↩
                        </button>
                        <button
                          type="button"
                          className="kvj-action-btn"
                          title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                          onClick={() => hookTogglePinMessage(msg.id as UUID)}
                        >
                          📌
                        </button>

                        {/* More Menu Dropdown Toggle */}
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className="kvj-action-btn"
                            title="More actions"
                            onClick={() => setActiveMessageActionId(isActionsOpen ? null : msg.id)}
                          >
                            ⋯
                          </button>

                          {isActionsOpen && (
                            <div style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 4px)',
                              right: 0,
                              background: 'var(--bg-surface, #ffffff)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                              padding: 4,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              minWidth: 120,
                              zIndex: 99999,
                            }}>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.text);
                                  toast({ variant: 'success', title: 'Text Copied' });
                                  setActiveMessageActionId(null);
                                }}
                                style={{ padding: '6px 10px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                              >
                                📋 Copy Text
                              </button>

                              {isMe && !msg.isDeleted && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(msg.id);
                                      setText(msg.text);
                                      setActiveMessageActionId(null);
                                    }}
                                    style={{ padding: '6px 10px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      hookDeleteMessage(msg.id as UUID);
                                      setActiveMessageActionId(null);
                                    }}
                                    style={{ padding: '6px 10px', fontSize: 12, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, color: 'var(--status-danger)' }}
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Live Typing Indicator Banner */}
            {Object.keys(typingUsers).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 8, marginTop: 4 }}>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  <span className="kvj-typing-dot" />
                  <span className="kvj-typing-dot" />
                  <span className="kvj-typing-dot" />
                </span>
                <span>{Object.values(typingUsers).join(', ')} is typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating ↓ New Messages Scroll Button */}
          {newMessagesBelowCount > 0 && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              style={{
                position: 'absolute',
                bottom: 80,
                right: 24,
                background: 'var(--brand)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 20,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                zIndex: 90,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ↓ {newMessagesBelowCount} New Message{newMessagesBelowCount > 1 ? 's' : ''}
            </button>
          )}

          {/* Composer Reply Banner */}
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
                type="button"
                onClick={() => setReplyToMessage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Composer Attachment Banner */}
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
                type="button"
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
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1s infinite' }} />
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
              bottom: 65,
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
                  type="button"
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
              bottom: 65,
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
                  type="button"
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
              bottom: 65,
              left: 10,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--e3)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 100,
              width: 190,
            }}>
              {[
                { label: '🖼️ Image File', type: 'image', name: 'Dashboard_Screen.png', size: '1.4 MB' },
                { label: '📄 PDF Document', type: 'pdf', name: 'Training_Syllabus.pdf', size: '380 KB' },
                { label: '📊 Excel Sheet', type: 'file', name: 'Q3_Payroll_Records.xlsx', size: '2.1 MB' },
                { label: '🗂️ Zip Archive', type: 'file', name: 'Assets_Bundle.zip', size: '12.4 MB' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
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
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-sunken)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}>
            <button
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              title="Attach File"
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
                fontSize: 17,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              📎
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add Emoji"
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
                fontSize: 17,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              😀
            </button>

            <button
              type="button"
              onClick={isRecording ? () => stopRecording(false) : startRecording}
              title="Record Voice Note"
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                border: isRecording ? '1px solid #d32f2f' : '1px solid var(--border)',
                background: isRecording ? '#ffebeb' : 'var(--bg-surface)',
                cursor: 'pointer',
                fontSize: 17,
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
              placeholder={editingMessageId ? 'Edit your message...' : `Message #${activeChannel.name}...`}
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

        {/* ── 3. Right Panel (Room Specifications & Pin List) ── */}
        {showRightPanel && (
          <div className="kvj-chat-panel">
            <div style={{ padding: 14, borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken)' }}>
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
                    <div style={{ fontSize: 12, color: 'var(--brand)', marginTop: 2 }}>
                      {activeChannel.dmParticipant.departmentId || '—'}
                    </div>
                  </div>
                  <Badge tone={activeChannel.dmParticipant.status === 'active' ? 'success' : 'neutral'}>
                    {activeChannel.dmParticipant.status}
                  </Badge>

                  <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, textAlign: 'left' }}>
                    <div>📧 <strong>Email:</strong> {activeChannel.dmParticipant.email}</div>
                    <div>📞 <strong>Phone:</strong> {activeChannel.dmParticipant.phone || '—'}</div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pm.createdAt}</span>
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

      {/* ── Drawers & Modals ── */}
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

          <div style={{ marginTop: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Add Members ({newChannelMembers.length} selected)
            </label>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 6 }}>
              {employees.filter((e) => e.id !== user?.id).map((e) => {
                const checked = newChannelMembers.includes(e.id);
                return (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 6 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(ev) => setNewChannelMembers((prev) => ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id))}
                    />
                    <span style={{ fontSize: 13 }}>{e.firstName} {e.lastName}<span style={{ color: 'var(--text-muted)' }}> · {e.designation}</span></span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => { setCreateChannelOpen(false); setNewChannelMembers([]); }}>Cancel</Button>
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
                type="button"
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
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.designation} · {emp.departmentId || '—'}</span>
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
