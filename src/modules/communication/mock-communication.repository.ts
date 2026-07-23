import { MemoryRepository } from '../../core/repository';
import type { UUID } from '../../core/types';
import type {
  ChatChannel, IChatChannelRepository,
  ChatMessage, IChatMessageRepository,
  Announcement, IAnnouncementRepository,
  EmailLog, IEmailLogRepository,
  NotificationPreference, INotificationPreferenceRepository
} from './communication.repository';

const DEFAULT_CHANNELS: ChatChannel[] = [
  {
    id: 'c-announcements' as UUID,
    name: 'Announcements',
    type: 'announcement',
    department: 'Executive Management',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'u-admin',
    updatedBy: 'u-admin',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'c-general' as UUID,
    name: 'General',
    type: 'department',
    department: 'All',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'u-admin',
    updatedBy: 'u-admin',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'c-hr' as UUID,
    name: 'HR & Operations',
    type: 'department',
    department: 'HR',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'u-admin',
    updatedBy: 'u-admin',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'c-finance' as UUID,
    name: 'Finance & Billing',
    type: 'department',
    department: 'Finance',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'u-admin',
    updatedBy: 'u-admin',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'c-training' as UUID,
    name: 'Training & Analytics',
    type: 'department',
    department: 'Training',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'u-admin',
    updatedBy: 'u-admin',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'c-it' as UUID,
    name: 'IT Support',
    type: 'department',
    department: 'IT',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'u-admin',
    updatedBy: 'u-admin',
    deletedAt: null,
    deletedBy: null,
  },
];

export class MockChatChannelRepository extends MemoryRepository<ChatChannel> implements IChatChannelRepository {
  constructor() {
    super({ defaultStatus: 'active', pageSize: 100 }, DEFAULT_CHANNELS);
  }
}

export class MockChatMessageRepository extends MemoryRepository<ChatMessage> implements IChatMessageRepository {
  constructor() {
    super({ defaultStatus: 'active', pageSize: 500 }, []);
  }

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
