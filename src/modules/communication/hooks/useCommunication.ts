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
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user]);

  const sendMessage = useCallback(async (text: string): Promise<CallbackResult<ChatMessage>> => {
    if (!user || !activeChannelId) return { ok: false, error: 'Unauthenticated or no active channel' };
    const res = await service.sendMessage({
      channelId: activeChannelId,
      senderId: user.id,
      text,
      attachments: []
    }, { id: user.id, role: user.role });
    if (res.ok) {
      setMessages((prev) => [...prev, res.value]);
      return { ok: true, value: res.value };
    }
    return { ok: false, error: res.error.message };
  }, [service, user, activeChannelId]);

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

  return {
    channels,
    messages,
    announcements,
    emailLogs,
    preferences,
    loading,
    error,
    createChannel,
    sendMessage,
    postAnnouncement,
    queueEmail,
    processEmailQueue,
    updatePreferences,
    triggerAutoReminders,
    refresh: loadAll,
    refreshMessages: fetchMessages,
  };
}
