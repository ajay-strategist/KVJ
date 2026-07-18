import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { Actor, UUID } from '../types';

export interface ActivityLog {
  id: UUID;
  module: string; // 'employee' | 'attendance' | 'leave' | 'student' | 'project' | 'expense' | 'training'
  entityId: UUID;
  actor: Actor;
  actionType: string; // 'create' | 'update' | 'delete' | 'clock_in' | 'clock_out' | 'approve' | 'reject' | 'submit'
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface IActivityEngine {
  log(
    module: string,
    entityId: UUID,
    actor: Actor,
    actionType: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<Result<ActivityLog>>;
  getTimelineForEntity(entityId: UUID): Promise<ActivityLog[]>;
  getTimelineForModule(module: string): Promise<ActivityLog[]>;
  getUnifiedTimeline(limit?: number): Promise<ActivityLog[]>;
}

export const ACTIVITY_ENGINE_TOKEN = createToken<IActivityEngine>('ActivityEngine');

export class ActivityEngine implements IActivityEngine {
  private logs: ActivityLog[] = [];

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async log(
    module: string,
    entityId: UUID,
    actor: Actor,
    actionType: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<Result<ActivityLog>> {
    const item: ActivityLog = {
      id: this.uuid(),
      module,
      entityId,
      actor,
      actionType,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(item); // Newest first
    return Ok(item);
  }

  async getTimelineForEntity(entityId: UUID): Promise<ActivityLog[]> {
    return this.logs.filter((l) => l.entityId === entityId);
  }

  async getTimelineForModule(module: string): Promise<ActivityLog[]> {
    return this.logs.filter((l) => l.module === module);
  }

  async getUnifiedTimeline(limit = 50): Promise<ActivityLog[]> {
    return this.logs.slice(0, limit);
  }
}
