import type { IRepository } from '../../core/repository';
import type { Entity, UUID } from '../../core/types';
import { createToken } from '../../core/registry';

export type ChannelType = 'direct' | 'team' | 'project' | 'department' | 'training' | 'announcement';

export interface ChatChannel extends Entity {
  name?: string;
  type: ChannelType;
  projectId?: UUID;
  trainingId?: UUID;
  department?: string;
  isMuted?: boolean;
  isArchived?: boolean;
  isStarred?: boolean;
  pinnedMessageId?: UUID;
  members?: UUID[];
}

export interface Reaction {
  userId: UUID;
  reaction: string;
}

export interface ChatMessage extends Entity {
  channelId: UUID;
  senderId: UUID;
  text: string;
  attachments?: string[];
  replyTo?: UUID;
  reactions?: Reaction[];
  readBy?: UUID[];
  isEdited?: boolean;
  isDeleted?: boolean;
  isPinned?: boolean;
  fileAttachment?: { name: string; type: 'image' | 'pdf' | 'file'; url: string; size: string };
  replyToMessage?: { id: string; senderName: string; text: string };
}

export interface Announcement extends Entity {
  title: string;
  content: string;
  targetType: 'organization' | 'department' | 'project' | 'training';
  targetId?: string;
  priority: 'normal' | 'high';
  scheduledAt?: string;
  expiresAt?: string;
}

export interface EmailLog extends Entity {
  recipient: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  scheduledAt?: string;
  retryCount?: number;
  errorMessage?: string;
}

export interface NotificationPreference extends Entity {
  employeeId: UUID;
  mutedChannels?: string[];
  digestMode?: boolean;
}

export interface IChatChannelRepository extends IRepository<ChatChannel> {}
export interface IChatMessageRepository extends IRepository<ChatMessage> {
  findByChannel(channelId: UUID): Promise<ChatMessage[]>;
}
export interface IAnnouncementRepository extends IRepository<Announcement> {}
export interface IEmailLogRepository extends IRepository<EmailLog> {
  findPending(): Promise<EmailLog[]>;
}
export interface INotificationPreferenceRepository extends IRepository<NotificationPreference> {
  findByEmployee(employeeId: UUID): Promise<NotificationPreference | null>;
}

export const CHAT_CHANNEL_REPOSITORY_TOKEN = createToken<IChatChannelRepository>('ChatChannelRepository');
export const CHAT_MESSAGE_REPOSITORY_TOKEN = createToken<IChatMessageRepository>('ChatMessageRepository');
export const ANNOUNCEMENT_REPOSITORY_TOKEN = createToken<IAnnouncementRepository>('AnnouncementRepository');
export const EMAIL_LOG_REPOSITORY_TOKEN = createToken<IEmailLogRepository>('EmailLogRepository');
export const NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN = createToken<INotificationPreferenceRepository>('NotificationPreferenceRepository');
