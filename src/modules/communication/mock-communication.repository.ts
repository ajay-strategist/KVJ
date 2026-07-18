import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type {
  ChatChannel, IChatChannelRepository,
  ChatMessage, IChatMessageRepository,
  Announcement, IAnnouncementRepository,
  EmailLog, IEmailLogRepository,
  NotificationPreference, INotificationPreferenceRepository
} from './communication.repository';

export class MockChatChannelRepository extends MemoryRepository<ChatChannel> implements IChatChannelRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, []); }
}

export class MockChatMessageRepository extends MemoryRepository<ChatMessage> implements IChatMessageRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 100 }, []); }

  async findByChannel(channelId: UUID): Promise<ChatMessage[]> {
    return [...this.store.values()].filter((m) => m.channelId === channelId && !m.deletedAt);
  }
}

export class MockAnnouncementRepository extends MemoryRepository<Announcement> implements IAnnouncementRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 20 }, []); }
}

export class MockEmailLogRepository extends MemoryRepository<EmailLog> implements IEmailLogRepository {
  constructor() { super({ defaultStatus: 'pending', pageSize: 50 }, []); }

  async findPending(): Promise<EmailLog[]> {
    return [...this.store.values()].filter((l) => l.status === 'pending' && !l.deletedAt);
  }
}

export class MockNotificationPreferenceRepository extends MemoryRepository<NotificationPreference> implements INotificationPreferenceRepository {
  constructor() { super({ defaultStatus: 'active', pageSize: 50 }, []); }

  async findByEmployee(employeeId: UUID): Promise<NotificationPreference | null> {
    return [...this.store.values()].find((p) => p.employeeId === employeeId && !p.deletedAt) ?? null;
  }
}
