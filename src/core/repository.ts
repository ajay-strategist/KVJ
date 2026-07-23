/**
 * KVJ Analytics — Repository contract + in-memory base (Phase 1 mock backing)
 * Layer: Repository. Data access only — NO business logic (Prompt 4 §4).
 *
 * Phase 1: modules use MemoryRepository (dummy data) so the whole UI/UX can be
 * built with no real database. Phase 2: a SupabaseRepository implementing the same
 * IRepository<T> is registered in its place — business logic and UI stay unchanged.
 */

import type { Actor, Entity, Page, QuerySpec, UUID } from './types';
import { AppError } from './result';

/** The datastore-agnostic contract every entity repository implements. */
export interface IRepository<T extends Entity, TCreate = Partial<T>, TUpdate = Partial<T>> {
  create(data: TCreate, actor: Actor): Promise<T>;
  findById(id: UUID, opts?: { includeDeleted?: boolean }): Promise<T | null>;
  findMany(query?: QuerySpec): Promise<Page<T>>;
  update(id: UUID, patch: TUpdate, actor: Actor): Promise<T>;
  softDelete(id: UUID, actor: Actor): Promise<void>;
  restore(id: UUID, actor: Actor): Promise<T>;
}

const now = () => new Date().toISOString();
const uuid = (): UUID =>
  (globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })) as UUID;

/**
 * Generic in-memory repository. Applies the universal entity contract
 * (UUID, audit fields, soft delete) and supports filter/search/sort/paginate
 * so mock behaviour matches what Supabase will do in Phase 2.
 */
export class MemoryRepository<T extends Entity> implements IRepository<T> {
  protected store = new Map<UUID, T>();
  /** localStorage key — unique per repository class so mock data survives refresh. */
  private readonly persistKey = `kvj.repo.${this.constructor.name}`;

  constructor(
    protected defaults: { defaultStatus: string; pageSize: number },
    seed: T[] = [],
  ) {
    const persisted = this.load();
    if (persisted && persisted.length > 0) {
      // Restore persisted data (user-created records survive refresh)
      persisted.forEach((e) => this.store.set(e.id, e));
    } else if (seed.length > 0) {
      // First-time initialization from seed data
      seed.forEach((e) => this.store.set(e.id, e));
      this.persist();
    }
    // If both persisted and seed are empty, start with an empty store — clean slate
  }

  private load(): T[] | null {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.persistKey) : null;
      return raw ? (JSON.parse(raw) as T[]) : null;
    } catch {
      return null;
    }
  }

  protected persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.persistKey, JSON.stringify([...this.store.values()]));
      }
    } catch {
      /* storage full / unavailable — mock layer degrades to in-memory only */
    }
  }

  async create(data: Partial<T>, actor: Actor): Promise<T> {
    const id = (data.id as UUID) ?? uuid();
    const ts = now();
    const entity = {
      ...(data as object),
      id,
      status: (data.status as string) ?? this.defaults.defaultStatus,
      createdAt: ts,
      updatedAt: ts,
      createdBy: actor.id,
      updatedBy: actor.id,
      deletedAt: null,
      deletedBy: null,
    } as T;
    this.store.set(id, entity);
    this.persist();
    return entity;
  }

  async findById(id: UUID, opts?: { includeDeleted?: boolean }): Promise<T | null> {
    const e = this.store.get(id);
    if (!e) return null;
    if (e.deletedAt && !opts?.includeDeleted) return null;
    return e;
  }

  async update(id: UUID, patch: Partial<T>, actor: Actor): Promise<T> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt) throw AppError.notFound();
    const updated = { ...existing, ...patch, id, updatedAt: now(), updatedBy: actor.id } as T;
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async softDelete(id: UUID, actor: Actor): Promise<void> {
    const existing = this.store.get(id);
    if (!existing || existing.deletedAt) throw AppError.notFound();
    this.store.set(id, { ...existing, deletedAt: now(), deletedBy: actor.id, updatedAt: now() });
    this.persist();
  }

  async restore(id: UUID, actor: Actor): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) throw AppError.notFound();
    const restored = { ...existing, deletedAt: null, deletedBy: null, updatedAt: now(), updatedBy: actor.id };
    this.store.set(id, restored);
    this.persist();
    return restored;
  }

  async findMany(query: QuerySpec = {}): Promise<Page<T>> {
    let rows = [...this.store.values()];
    if (!query.includeDeleted) rows = rows.filter((r) => !r.deletedAt);

    // filters
    for (const f of query.filters ?? []) {
      rows = rows.filter((r) => this.matches((r as Record<string, unknown>)[f.field], f.op, f.value));
    }
    // search
    if (query.search?.term) {
      const term = query.search.term.toLowerCase();
      rows = rows.filter((r) =>
        query.search!.fields.some((field) =>
          String((r as Record<string, unknown>)[field] ?? '').toLowerCase().includes(term),
        ),
      );
    }
    // sort
    for (const s of [...(query.sort ?? [])].reverse()) {
      rows.sort((a, b) => {
        const av = (a as Record<string, unknown>)[s.field] as never;
        const bv = (b as Record<string, unknown>)[s.field] as never;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return s.dir === 'desc' ? -cmp : cmp;
      });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? this.defaults.pageSize;
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return {
      data: rows.slice(start, start + pageSize),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  }

  private matches(val: unknown, op: string, target: unknown): boolean {
    switch (op) {
      case 'eq': return val === target;
      case 'neq': return val !== target;
      case 'gt': return (val as never) > (target as never);
      case 'gte': return (val as never) >= (target as never);
      case 'lt': return (val as never) < (target as never);
      case 'lte': return (val as never) <= (target as never);
      case 'in': return Array.isArray(target) && target.includes(val);
      case 'like':
      case 'ilike': return String(val ?? '').toLowerCase().includes(String(target ?? '').toLowerCase());
      case 'isNull': return val == null;
      case 'notNull': return val != null;
      default: return true;
    }
  }
}
