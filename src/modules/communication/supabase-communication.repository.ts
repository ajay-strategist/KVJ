import { SupabaseRepository, toCamelCaseObject } from '../../shared/integration/supabase-repository';
import type { UUID } from '../../core/types';
import { supabase } from '../../shared/integration/supabase';
import type {
  ChatChannel, IChatChannelRepository,
  ChatMessage, IChatMessageRepository,
  Announcement, IAnnouncementRepository,
  EmailLog, IEmailLogRepository,
  NotificationPreference, INotificationPreferenceRepository
} from './communication.repository';

export class SupabaseChatChannelRepository extends SupabaseRepository<ChatChannel> implements IChatChannelRepository {
  constructor() { super('chat_channels'); }
}

export class SupabaseChatMessageRepository extends SupabaseRepository<ChatMessage> implements IChatMessageRepository {
  constructor() { super('chat_messages'); }

  async findByChannel(channelId: UUID): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toCamelCaseObject(row) as ChatMessage);
  }
}

export class SupabaseAnnouncementRepository extends SupabaseRepository<Announcement> implements IAnnouncementRepository {
  constructor() { super('announcements'); }
}

export class SupabaseEmailLogRepository extends SupabaseRepository<EmailLog> implements IEmailLogRepository {
  constructor() { super('email_logs'); }

  async findPending(): Promise<EmailLog[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('status', 'pending')
      .is('deleted_at', null);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => toCamelCaseObject(row) as EmailLog);
  }
}

export class SupabaseNotificationPreferenceRepository extends SupabaseRepository<NotificationPreference> implements INotificationPreferenceRepository {
  constructor() { super('notification_preferences'); }

  async findByEmployee(employeeId: UUID): Promise<NotificationPreference | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq('user_id', employeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? (toCamelCaseObject(data) as NotificationPreference) : null;
  }
}

