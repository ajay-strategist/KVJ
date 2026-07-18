import { supabase } from './supabase';
import type { IRepository } from '../../core/repository';
import type { Actor, Entity, Page, QuerySpec, UUID } from '../../core/types';
import { AppError } from '../../core/result';

export class SupabaseRepository<T extends Entity> implements IRepository<T> {
  constructor(protected tableName: string) {}

  async create(data: Partial<T>, actor: Actor): Promise<T> {
    const ts = new Date().toISOString();
    const payload = {
      ...data,
      createdAt: ts,
      updatedAt: ts,
      createdBy: actor.id,
      updatedBy: actor.id,
      deletedAt: null,
      deletedBy: null,
    };

    const { data: inserted, error } = await supabase
      .from(this.tableName)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error(`Supabase create error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
    return inserted as T;
  }

  async findById(id: UUID, opts?: { includeDeleted?: boolean }): Promise<T | null> {
    let query = supabase.from(this.tableName).select().eq('id', id);
    if (!opts?.includeDeleted) {
      query = query.is('deletedAt', null);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error(`Supabase findById error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
    return data as T | null;
  }

  async update(id: UUID, patch: Partial<T>, actor: Actor): Promise<T> {
    const ts = new Date().toISOString();
    const payload = {
      ...patch,
      updatedAt: ts,
      updatedBy: actor.id,
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Supabase update error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
    return data as T;
  }

  async softDelete(id: UUID, actor: Actor): Promise<void> {
    const ts = new Date().toISOString();
    const { error } = await supabase
      .from(this.tableName)
      .update({
        deletedAt: ts,
        deletedBy: actor.id,
        updatedAt: ts,
      })
      .eq('id', id);

    if (error) {
      console.error(`Supabase softDelete error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
  }

  async restore(id: UUID, actor: Actor): Promise<T> {
    const ts = new Date().toISOString();
    const { data, error } = await supabase
      .from(this.tableName)
      .update({
        deletedAt: null,
        deletedBy: null,
        updatedAt: ts,
        updatedBy: actor.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Supabase restore error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
    return data as T;
  }

  async findMany(query: QuerySpec = {}): Promise<Page<T>> {
    let select = supabase.from(this.tableName).select('*', { count: 'exact' });

    if (!query.includeDeleted) {
      select = select.is('deletedAt', null);
    }

    for (const f of query.filters ?? []) {
      if (f.op === 'eq') select = select.eq(f.field, f.value);
      else if (f.op === 'neq') select = select.neq(f.field, f.value);
      else if (f.op === 'gt') select = select.gt(f.field, f.value);
      else if (f.op === 'gte') select = select.gte(f.field, f.value);
      else if (f.op === 'lt') select = select.lt(f.field, f.value);
      else if (f.op === 'lte') select = select.lte(f.field, f.value);
      else if (f.op === 'like') select = select.like(f.field, `%${f.value}%`);
      else if (f.op === 'ilike') select = select.ilike(f.field, `%${f.value}%`);
      else if (f.op === 'isNull') select = select.is(f.field, null);
      else if (f.op === 'notNull') select = select.not(f.field, 'is', null);
    }

    for (const s of query.sort ?? []) {
      select = select.order(s.field, { ascending: s.dir === 'asc' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const fromRange = (page - 1) * pageSize;
    const toRange = fromRange + pageSize - 1;

    const { data, count, error } = await select.range(fromRange, toRange);

    if (error) {
      console.error(`Supabase findMany error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }

    const total = count ?? 0;
    return {
      data: (data ?? []) as T[],
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  }
}
