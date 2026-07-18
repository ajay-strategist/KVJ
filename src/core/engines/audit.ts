import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { Actor, UUID } from '../types';

export interface AuditLogEntry {
  id: UUID;
  actorId: UUID;
  actorRole: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'assign' | 'workflow_transition' | 'auth' | 'config';
  entityType: string;
  entityId: UUID;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface IAuditEngine {
  log(
    actor: Actor,
    action: AuditLogEntry['action'],
    entityType: string,
    entityId: UUID,
    opts?: {
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      reason?: string;
      ipAddress?: string;
    }
  ): Promise<Result<AuditLogEntry>>;
  getLogs(filters?: {
    actorId?: UUID;
    entityType?: string;
    entityId?: UUID;
    action?: AuditLogEntry['action'];
  }): Promise<AuditLogEntry[]>;
}

export const AUDIT_ENGINE_TOKEN = createToken<IAuditEngine>('AuditEngine');

export class AuditEngine implements IAuditEngine {
  private logs: AuditLogEntry[] = [];

  private uuid(): UUID {
    return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID;
  }

  async log(
    actor: Actor,
    action: AuditLogEntry['action'],
    entityType: string,
    entityId: UUID,
    opts?: {
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      reason?: string;
      ipAddress?: string;
    }
  ): Promise<Result<AuditLogEntry>> {
    const entry: AuditLogEntry = {
      id: this.uuid(),
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      oldValues: opts?.oldValues,
      newValues: opts?.newValues,
      reason: opts?.reason,
      ipAddress: opts?.ipAddress ?? '127.0.0.1',
      timestamp: new Date().toISOString(),
    };
    this.logs.push(entry);
    console.log(`[Audit Log] ${action.toUpperCase()} on ${entityType} (${entityId}) by ${actor.role} (${actor.id})`);
    return Ok(entry);
  }

  async getLogs(filters?: {
    actorId?: UUID;
    entityType?: string;
    entityId?: UUID;
    action?: AuditLogEntry['action'];
  }): Promise<AuditLogEntry[]> {
    let result = [...this.logs];
    if (filters) {
      if (filters.actorId) result = result.filter((l) => l.actorId === filters.actorId);
      if (filters.entityType) result = result.filter((l) => l.entityType === filters.entityType);
      if (filters.entityId) result = result.filter((l) => l.entityId === filters.entityId);
      if (filters.action) result = result.filter((l) => l.action === filters.action);
    }
    return result;
  }
}
