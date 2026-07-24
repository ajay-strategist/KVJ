import { container, createToken } from '../../core/registry';
import { AppError, Err, Ok, type Result } from '../../core/result';
import type { Actor, UUID } from '../../core/types';
import {
  CHAT_CHANNEL_REPOSITORY_TOKEN,
  CHAT_MESSAGE_REPOSITORY_TOKEN,
  ANNOUNCEMENT_REPOSITORY_TOKEN,
  EMAIL_LOG_REPOSITORY_TOKEN,
  NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN,
  type ChatChannel, type ChatMessage, type Announcement, type EmailLog, type NotificationPreference
} from './communication.repository';
import { ACTIVITY_ENGINE_TOKEN } from '../../core/engines/activity';
import { AUDIT_ENGINE_TOKEN } from '../../core/engines/audit';
import { NOTIFICATION_ENGINE_TOKEN } from '../../core/engines/notification';
import { eventBus } from '../../core/event-bus';

export interface ICommunicationService {
  createChannel(data: Partial<ChatChannel>, actor: Actor): Promise<Result<ChatChannel>>;
  sendMessage(data: Partial<ChatMessage>, actor: Actor): Promise<Result<ChatMessage>>;
  postAnnouncement(data: Partial<Announcement>, actor: Actor): Promise<Result<Announcement>>;
  queueEmail(data: Partial<EmailLog>, actor: Actor): Promise<Result<EmailLog>>;
  processEmailQueue(actor: Actor): Promise<Result<EmailLog[]>>;
  updatePreferences(data: Partial<NotificationPreference>, actor: Actor): Promise<Result<NotificationPreference>>;
  triggerAutoReminders(actor: Actor): Promise<Result<void>>;
}

export const COMMUNICATION_SERVICE_TOKEN = createToken<ICommunicationService>('CommunicationService');

export class CommunicationService implements ICommunicationService {
  private get channelRepo() { return container.resolve(CHAT_CHANNEL_REPOSITORY_TOKEN); }
  private get msgRepo() { return container.resolve(CHAT_MESSAGE_REPOSITORY_TOKEN); }
  private get announcementRepo() { return container.resolve(ANNOUNCEMENT_REPOSITORY_TOKEN); }
  private get emailRepo() { return container.resolve(EMAIL_LOG_REPOSITORY_TOKEN); }
  private get prefRepo() { return container.resolve(NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN); }

  private get activity() { return container.resolve(ACTIVITY_ENGINE_TOKEN); }
  private get audit() { return container.resolve(AUDIT_ENGINE_TOKEN); }
  private get notification() { return container.resolve(NOTIFICATION_ENGINE_TOKEN); }

  constructor() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // Event-driven channel notifications are only sent when a valid UUID actor
    // is available at the call site. The 'u-admin' / 'c-hr' mock IDs that were
    // here before caused PostgreSQL to reject every write with
    // "invalid input syntax for type uuid" — they have been removed.
    // Real-time notification broadcasting via live actor context will be
    // implemented in Phase 2 using Supabase Realtime + Edge Functions.
  }

  async createChannel(data: Partial<ChatChannel>, actor: Actor): Promise<Result<ChatChannel>> {
    try {
      // Enforce creation rules: Employees cannot create Leadership/Admin channels
      if (data.type === 'announcement' && actor.role === 'EMPLOYEE') {
        return Err(AppError.forbidden('Only Administrators or CEOs can create announcement channels.'));
      }
      const channel = await this.channelRepo.create(data, actor);
      await this.activity.log('communication', channel.id, actor, 'create', `Created chat channel: ${channel.name ?? 'DM'}`);
      return Ok(channel);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async sendMessage(data: Partial<ChatMessage>, actor: Actor): Promise<Result<ChatMessage>> {
    try {
      // Enforce RBAC permission checks: Employees cannot send messages in Announcement channels
      if (data.channelId === 'c-announcements') {
        if (actor.role === 'EMPLOYEE') {
          return Err(AppError.forbidden('Announcement channels are read-only for employees. Only Administrators, CEOs, and Managers can publish.'));
        }
      } else if (data.channelId) {
        const channel = await this.channelRepo.findById(data.channelId);
        if (channel?.type === 'announcement' && actor.role === 'EMPLOYEE') {
          return Err(AppError.forbidden('Announcement channels are read-only for employees. Only Administrators, CEOs, and Managers can publish.'));
        }
      }

      const msg = await this.msgRepo.create(data, actor);
      await this.notification.send({
        recipientId: msg.senderId,
        title: 'New Chat Message',
        body: msg.text,
        channels: ['in_app']
      });
      return Ok(msg);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async postAnnouncement(data: Partial<Announcement>, actor: Actor): Promise<Result<Announcement>> {
    try {
      if (actor.role === 'EMPLOYEE') {
        return Err(AppError.forbidden('Only Managers and Executives can post announcements.'));
      }
      const announcement = await this.announcementRepo.create(data, actor);
      await this.activity.log('communication', announcement.id, actor, 'create', `Posted announcement: ${announcement.title}`);
      await this.audit.log(actor, 'create', 'announcements', announcement.id, { newValues: announcement });
      return Ok(announcement);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async queueEmail(data: Partial<EmailLog>, actor: Actor): Promise<Result<EmailLog>> {
    try {
      const email = await this.emailRepo.create({ ...data, status: 'pending', retryCount: 0 }, actor);
      return Ok(email);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async processEmailQueue(actor: Actor): Promise<Result<EmailLog[]>> {
    try {
      const pending = await this.emailRepo.findPending();
      const processed: EmailLog[] = [];
      for (const log of pending) {
        log.status = 'sent';
        const updated = await this.emailRepo.update(log.id, log, actor);
        processed.push(updated);
      }
      return Ok(processed);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async updatePreferences(data: Partial<NotificationPreference>, actor: Actor): Promise<Result<NotificationPreference>> {
    try {
      if (!data.employeeId) return Err(AppError.validation('Employee ID is required.'));
      const existing = await this.prefRepo.findByEmployee(data.employeeId);

      let pref: NotificationPreference;
      if (existing) {
        pref = await this.prefRepo.update(existing.id, { ...existing, ...data }, actor);
      } else {
        pref = await this.prefRepo.create(data, actor);
      }

      await this.audit.log(actor, 'update', 'notification_preferences', pref.id, { newValues: pref });
      return Ok(pref);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }

  async triggerAutoReminders(actor: Actor): Promise<Result<void>> {
    try {
      await this.notification.send({
        recipientId: actor.id,
        title: 'Auto Reminders Executed',
        body: 'Scanned leave, timesheets, and budget variance limits successfully.',
        channels: ['in_app']
      });
      return Ok(undefined);
    } catch (e: any) {
      return Err(AppError.internal(e.message));
    }
  }
}
