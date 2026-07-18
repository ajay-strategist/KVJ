import { container, createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { UUID } from '../types';

export type NotificationChannel = 'email' | 'in_app' | 'push' | 'sms' | 'whatsapp';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationPayload {
  recipientId: UUID;
  title: string;
  body: string;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  templateId?: string;
  templateData?: Record<string, string>;
  actionUrl?: string;
}

export interface QueuedNotification {
  id: UUID;
  payload: NotificationPayload;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  attempts: number;
  lastAttempt?: string;
  scheduledFor?: string;
  error?: string;
}

export interface INotificationEngine {
  send(payload: NotificationPayload): Promise<Result<QueuedNotification>>;
  schedule(payload: NotificationPayload, executeAt: string): Promise<Result<QueuedNotification>>;
  processQueue(): Promise<void>;
  getPending(): QueuedNotification[];
}

export const NOTIFICATION_ENGINE_TOKEN = createToken<INotificationEngine>('NotificationEngine');

export class NotificationEngine implements INotificationEngine {
  private queue: QueuedNotification[] = [];

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async send(payload: NotificationPayload): Promise<Result<QueuedNotification>> {
    const item: QueuedNotification = {
      id: this.uuid(),
      payload,
      status: 'queued',
      attempts: 0,
    };
    this.queue.push(item);
    
    // Process immediately in background
    this.processItem(item);

    return Ok(item);
  }

  async schedule(payload: NotificationPayload, executeAt: string): Promise<Result<QueuedNotification>> {
    const item: QueuedNotification = {
      id: this.uuid(),
      payload,
      status: 'queued',
      attempts: 0,
      scheduledFor: executeAt,
    };
    this.queue.push(item);
    return Ok(item);
  }

  getPending(): QueuedNotification[] {
    return this.queue.filter((n) => n.status === 'queued' || n.status === 'failed');
  }

  async processQueue(): Promise<void> {
    const now = new Date();
    const items = this.queue.filter((n) => {
      if (n.status !== 'queued' && n.status !== 'failed') return false;
      if (n.scheduledFor && new Date(n.scheduledFor) > now) return false;
      return true;
    });

    for (const item of items) {
      await this.processItem(item);
    }
  }

  private async processItem(item: QueuedNotification): Promise<void> {
    item.status = 'sending';
    item.attempts++;
    item.lastAttempt = new Date().toISOString();

    try {
      // Channel dispatch routing simulation
      for (const channel of item.payload.channels) {
        console.log(
          `[Notification Engine] [${channel.toUpperCase()}] Priority: ${item.payload.priority ?? 'normal'} -> Recipient: ${item.payload.recipientId}`
        );
        console.log(`Title: ${item.payload.title}`);
        console.log(`Body: ${item.payload.body}`);
      }

      item.status = 'sent';
    } catch (e: any) {
      item.status = item.attempts >= 3 ? 'failed' : 'queued';
      item.error = e.message;
      console.error(`[Notification Engine] Failed dispatching item ${item.id}:`, e);
    }
  }
}
