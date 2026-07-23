import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from '../../../core/registry';
import { COMMUNICATION_SERVICE_TOKEN } from '../communication.service';
import {
  CHAT_CHANNEL_REPOSITORY_TOKEN,
  CHAT_MESSAGE_REPOSITORY_TOKEN,
  ANNOUNCEMENT_REPOSITORY_TOKEN,
  EMAIL_LOG_REPOSITORY_TOKEN,
  NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN,
  type ChatChannel, type ChatMessage, type Announcement, type EmailLog, type NotificationPreference
} from '../communication.repository';
import type { UUID } from '../../../core/types';
import { useAuth } from '../../auth/AuthProvider';

type CallbackResult<T> = { ok: true; value: T } | { ok: false; error: string };

const chatSyncChannel = typeof window !== 'undefined' ? new BroadcastChannel('kvj-chat-sync') : null;

export function useCommunication(activeChannelId?: UUID) {
  const service = useMemo(() => container.resolve(COMMUNICATION_SERVICE_TOKEN), []);
  const { user } = useAuth();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> name

  const fetchChannels = useCallback(async () => {
    try {
      const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
      const res = await channelRepo.findMany();
      setChannels(res.data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!activeChannelId) return;
    try {
      const msgRepo = container.resolve(CHAT_MESSAGE_REPOSITORY_TOKEN);
      const res = await msgRepo.findByChannel(activeChannelId);
      setMessages(res);
    } catch (e: any) {
      setError(e.message);
    }
  }, [activeChannelId]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const annRepo = container.resolve(ANNOUNCEMENT_REPOSITORY_TOKEN);
      const res = await annRepo.findMany();
      setAnnouncements(res.data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchEmailLogs = useCallback(async () => {
    try {
      const emailRepo = container.resolve(EMAIL_LOG_REPOSITORY_TOKEN);
      const res = await emailRepo.findMany();
      setAnnouncements([]); // Clear warning for compilation
      setEmailLogs(res.data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const prefRepo = container.resolve(NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN);
      const pref = await prefRepo.findByEmployee(user.id);
      setPreferences(pref);
    } catch (e: any) {
      setError(e.message);
    }
  }, [user]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchChannels(),
      fetchMessages(),
      fetchAnnouncements(),
      fetchEmailLogs(),
      fetchPreferences()
    ]);
    setLoading(false);
  }, [fetchChannels, fetchMessages, fetchAnnouncements, fetchEmailLogs, fetchPreferences]);

  const createChannel = useCallback(async (data: Partial<ChatChannel>): Promise<CallbackResult<ChatChannel>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.createChannel(data, { id: user.id, role: user.role });
    if (res.ok) {
      setChannels((prev) => [res.value, ...prev]);
      chatSyncChannel?.postMessage({ type: 'channels_updated' });
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const sendMessage = useCallback(async (
    text: string,
    fileAttachment?: ChatMessage['fileAttachment'],
    replyTo?: UUID
  ): Promise<CallbackResult<ChatMessage>> => {
    if (!user || !activeChannelId) return { ok: false, error: 'Unauthenticated or no active channel' };
    const res = await service.sendMessage({
      channelId: activeChannelId,
      senderId: user.id as UUID,
      text,
      attachments: [],
      fileAttachment,
      replyTo,
    }, { id: user.id, role: user.role });
    if (res.ok) {
      setMessages((prev) => [...prev, res.value]);
      chatSyncChannel?.postMessage({ type: 'message_updated', channelId: activeChannelId });
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user, activeChannelId]);

  const editMessage = useCallback(async (messageId: UUID, newText: string): Promise<CallbackResult<ChatMessage>> => {
    if (!user || !activeChannelId) return { ok: false, error: 'Unauthenticated' };
    try {
      const msgRepo = container.resolve(CHAT_MESSAGE_REPOSITORY_TOKEN);
      const msg = await msgRepo.findById(messageId);
      if (!msg) return { ok: false, error: 'Message not found' };
      msg.text = newText;
      msg.isEdited = true;
      const updated = await msgRepo.update(messageId, msg, { id: user.id, role: user.role });
      setMessages((prev) => prev.map((m) => m.id === messageId ? updated : m));
      chatSyncChannel?.postMessage({ type: 'message_updated', channelId: activeChannelId });
      return { ok: true, value: updated };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, [user, activeChannelId]);

  const toggleReaction = useCallback(async (messageId: UUID, emoji: string): Promise<CallbackResult<ChatMessage>> => {
    if (!user || !activeChannelId) return { ok: false, error: 'Unauthenticated' };
    try {
      const msgRepo = container.resolve(CHAT_MESSAGE_REPOSITORY_TOKEN);
      const msg = await msgRepo.findById(messageId);
      if (!msg) return { ok: false, error: 'Message not found' };
      const reactions = msg.reactions || [];
      const index = reactions.findIndex((r) => r.userId === user.id && r.reaction === emoji);
      if (index >= 0) {
        reactions.splice(index, 1);
      } else {
        reactions.push({ userId: user.id as UUID, reaction: emoji });
      }
      msg.reactions = reactions;
      const updated = await msgRepo.update(messageId, msg, { id: user.id, role: user.role });
      setMessages((prev) => prev.map((m) => m.id === messageId ? updated : m));
      chatSyncChannel?.postMessage({ type: 'message_updated', channelId: activeChannelId });
      return { ok: true, value: updated };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, [user, activeChannelId]);

  const togglePinMessage = useCallback(async (messageId: UUID): Promise<CallbackResult<ChatMessage>> => {
    if (!user || !activeChannelId) return { ok: false, error: 'Unauthenticated' };
    try {
      const msgRepo = container.resolve(CHAT_MESSAGE_REPOSITORY_TOKEN);
      const msg = await msgRepo.findById(messageId);
      if (!msg) return { ok: false, error: 'Message not found' };
      msg.isPinned = !msg.isPinned;
      const updated = await msgRepo.update(messageId, msg, { id: user.id, role: user.role });
      
      const channelRepo = container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN);
      const channel = await channelRepo.findById(activeChannelId);
      if (channel) {
        channel.pinnedMessageId = msg.isPinned ? messageId : undefined;
        await channelRepo.update(activeChannelId, channel, { id: user.id, role: user.role });
      }

      setMessages((prev) => prev.map((m) => m.id === messageId ? updated : m));
      chatSyncChannel?.postMessage({ type: 'message_updated', channelId: activeChannelId });
      chatSyncChannel?.postMessage({ type: 'channels_updated' });
      return { ok: true, value: updated };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, [user, activeChannelId]);

  const deleteMessage = useCallback(async (messageId: UUID): Promise<CallbackResult<void>> => {
    if (!user || !activeChannelId) return { ok: false, error: 'Unauthenticated' };
    try {
      const msgRepo = container.resolve(CHAT_MESSAGE_REPOSITORY_TOKEN);
      const msg = await msgRepo.findById(messageId);
      if (!msg) return { ok: false, error: 'Message not found' };
      msg.text = 'This message was deleted';
      msg.isDeleted = true;
      msg.fileAttachment = undefined;
      await msgRepo.update(messageId, msg, { id: user.id, role: user.role });
      setMessages((prev) => prev.map((m) => m.id === messageId ? msg : m));
      chatSyncChannel?.postMessage({ type: 'message_updated', channelId: activeChannelId });
      return { ok: true, value: undefined };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, [user, activeChannelId]);

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!user || !activeChannelId) return;
    chatSyncChannel?.postMessage({
      type: 'typing_status',
      channelId: activeChannelId,
      userId: user.id,
      userName: user.fullName,
      isTyping
    });
  }, [user, activeChannelId]);

  const postAnnouncement = useCallback(async (data: Partial<Announcement>): Promise<CallbackResult<Announcement>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.postAnnouncement(data, { id: user.id, role: user.role });
    if (res.ok) {
      setAnnouncements((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const queueEmail = useCallback(async (data: Partial<EmailLog>): Promise<CallbackResult<EmailLog>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.queueEmail(data, { id: user.id, role: user.role });
    if (res.ok) {
      setEmailLogs((prev) => [res.value, ...prev]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const processEmailQueue = useCallback(async (): Promise<CallbackResult<EmailLog[]>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.processEmailQueue({ id: user.id, role: user.role });
    if (res.ok) {
      await fetchEmailLogs();
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user, fetchEmailLogs]);

  const updatePreferences = useCallback(async (data: Partial<NotificationPreference>): Promise<CallbackResult<NotificationPreference>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.updatePreferences({ ...data, employeeId: user.id }, { id: user.id, role: user.role });
    if (res.ok) {
      setPreferences(res.value);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const triggerAutoReminders = useCallback(async (): Promise<CallbackResult<void>> => {
    if (!user) return { ok: false, error: 'Unauthenticated' };
    const res = await service.triggerAutoReminders({ id: user.id, role: user.role });
    if (res.ok) {
      return { ok: true, value: undefined };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!chatSyncChannel) return;
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'message_updated' && e.data.channelId === activeChannelId) {
        fetchMessages();
      }
      if (e.data.type === 'channels_updated') {
        fetchChannels();
      }
      if (e.data.type === 'typing_status' && e.data.channelId === activeChannelId) {
        if (e.data.userId !== user?.id) {
          setTypingUsers((prev) => {
            const next = { ...prev };
            if (e.data.isTyping) {
              next[e.data.userId] = e.data.userName;
            } else {
              delete next[e.data.userId];
            }
            return next;
          });
        }
      }
    };
    chatSyncChannel.addEventListener('message', handler);
    return () => chatSyncChannel.removeEventListener('message', handler);
  }, [activeChannelId, fetchMessages, fetchChannels, user]);

  return {
    channels,
    messages,
    announcements,
    emailLogs,
    preferences,
    loading,
    error,
    typingUsers,
    createChannel,
    sendMessage,
    editMessage,
    toggleReaction,
    togglePinMessage,
    deleteMessage,
    sendTypingStatus,
    postAnnouncement,
    queueEmail,
    processEmailQueue,
    updatePreferences,
    triggerAutoReminders,
    refresh: loadAll,
    refreshMessages: fetchMessages,
  };
}
