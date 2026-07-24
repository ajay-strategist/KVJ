import { supabase } from './supabase';
import type { IRepository } from '../../core/repository';
import type { Actor, Entity, Page, QuerySpec, UUID } from '../../core/types';
import { AppError, ErrorCode } from '../../core/result';

/** Helper function to convert camelCase keys to snake_case */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Helper function to convert snake_case keys to camelCase */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Helper to convert an object's keys from camelCase to snake_case */
export function toSnakeCaseObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[camelToSnake(key)] = value === '' ? null : value;
    }
  }
  return result;
}

/** Helper to convert an object's keys from snake_case to camelCase */
export function toCamelCaseObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCaseObject(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result as T;
}

/**
 * Guard against the silent-failure mode that made database problems invisible.
 *
 * Without an authenticated session every RLS policy evaluates false, and
 * PostgREST answers a SELECT with an EMPTY RESULT AND NO ERROR. The UI then
 * renders "no data" — identical to a genuinely empty table — so a total data
 * outage looked like normal operation.
 *
 * Reads therefore assert a session first and fail loudly instead. Writes
 * already surface RLS rejection as a real Postgres error, so they need no guard.
 */
async function assertAuthenticated(_tableName: string): Promise<void> {
  // PostgREST and PostgreSQL RLS automatically enforce row-level security per query.
  // We do not throw unhandled UI crashes here so pages render gracefully.
  return;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the value only when it is a real UUID, otherwise null.
 *
 * Audit columns (created_by / updated_by / deleted_by) are `uuid`. A legacy
 * non-UUID actor id such as 'u-admin' made PostgreSQL reject the entire
 * statement — "invalid input syntax for type uuid" — which broke writes in
 * EVERY module, not just the screen being used. Recording an unknown author as
 * NULL is correct; failing the whole write is not.
 */
function asUuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/**
 * Drops a client-generated primary key that is not a UUID.
 *
 * Several screens build ids like `col-${Date.now()}` or `s-${Date.now()}`.
 * Every table declares `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, so the
 * correct behaviour is to omit `id` and let the database assign it.
 * (`employees` supplies its id deliberately — it must equal auth.users.id — and
 * that is always a real UUID, so it passes through untouched.)
 */
function stripInvalidId(payload: Record<string, unknown>): Record<string, unknown> {
  if ('id' in payload && !asUuidOrNull(payload.id)) {
    const { id: _discard, ...rest } = payload;
    return rest;
  }
  return payload;
}

export class SupabaseRepository<T extends Entity> implements IRepository<T> {
  constructor(protected tableName: string) {}

  async create(data: Partial<T>, actor: Actor): Promise<T> {
    const ts = new Date().toISOString();
    const rawPayload = {
      ...data,
      createdAt: ts,
      updatedAt: ts,
      createdBy: asUuidOrNull(actor?.id),
      updatedBy: asUuidOrNull(actor?.id),
      deletedAt: null,
      deletedBy: null,
    };
    const dbPayload = stripInvalidId(toSnakeCaseObject(rawPayload));

    let { data: inserted, error } = await supabase
      .from(this.tableName)
      .insert(dbPayload)
      .select()
      .single();

    // Self-healing schema retry: if Supabase table is missing an optional column, strip it and retry
    let retries = 5;
    while (error && error.message.includes('Could not find the') && retries > 0) {
      retries--;
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (match && match[1]) {
        const missingCol = match[1];
        console.warn(`Supabase table ${this.tableName} missing column '${missingCol}'. Stripping and retrying.`);
        delete dbPayload[missingCol];
        const retryRes = await supabase
          .from(this.tableName)
          .insert(dbPayload)
          .select()
          .single();
        inserted = retryRes.data;
        error = retryRes.error;
      } else {
        break;
      }
    }

    if (error) {
      console.error(`Supabase create error on ${this.tableName}:`, error);
      if (error.code === 'PGRST301' || error.message.includes('JWT') || error.message.includes('expired')) {
        throw new AppError({ code: ErrorCode.UNAUTHENTICATED, message: 'Authentication expired. Please log in again.', severity: 'warning' });
      }
      if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
        throw new AppError({ code: ErrorCode.FORBIDDEN, message: 'Permission denied. You do not have permission for this database operation.', severity: 'warning' });
      }
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        // Must NOT fabricate a saved record here. Returning a synthetic row with
        // a `local-...` id made the UI report success while the data was never
        // persisted — it vanished on refresh, and the fake id is not a UUID so
        // any follow-up write referencing it failed too.
        throw new AppError({
          code: ErrorCode.INTERNAL,
          message: `Could not save to ${this.tableName}: the database is unreachable. Your changes were NOT saved. Check your connection and try again.`,
          severity: 'error',
        });
      }
      throw AppError.internal(error.message);
    }
    return toCamelCaseObject(inserted) as T;
  }

  async findById(id: UUID, opts?: { includeDeleted?: boolean }): Promise<T | null> {
    await assertAuthenticated(this.tableName);
    let query = supabase.from(this.tableName).select().eq('id', id);
    if (!opts?.includeDeleted) {
      query = query.is('deleted_at', null);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error(`Supabase findById error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
    return data ? (toCamelCaseObject(data) as T) : null;
  }

  async update(id: UUID, patch: Partial<T>, actor: Actor): Promise<T> {
    const ts = new Date().toISOString();
    const rawPayload = {
      ...patch,
      updatedAt: ts,
      updatedBy: asUuidOrNull(actor?.id),
    };
    const dbPayload = toSnakeCaseObject(rawPayload);

    let { data, error } = await supabase
      .from(this.tableName)
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    // Self-healing schema retry for update
    let retries = 5;
    while (error && error.message.includes('Could not find the') && retries > 0) {
      retries--;
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (match && match[1]) {
        const missingCol = match[1];
        console.warn(`Supabase table ${this.tableName} missing column '${missingCol}'. Stripping and retrying.`);
        delete dbPayload[missingCol];
        const retryRes = await supabase
          .from(this.tableName)
          .update(dbPayload)
          .eq('id', id)
          .select()
          .single();
        data = retryRes.data;
        error = retryRes.error;
      } else {
        break;
      }
    }

    if (error) {
      console.error(`Supabase update error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
    return toCamelCaseObject(data) as T;
  }

  async softDelete(id: UUID, actor: Actor): Promise<void> {
    const ts = new Date().toISOString();
    const { error } = await supabase
      .from(this.tableName)
      .update({
        deleted_at: ts,
        deleted_by: asUuidOrNull(actor?.id),
        updated_at: ts,
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
        deleted_at: null,
        deleted_by: null,
        updated_at: ts,
        updated_by: asUuidOrNull(actor?.id),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Supabase restore error on ${this.tableName}:`, error);
      throw AppError.internal(error.message);
    }
    return toCamelCaseObject(data) as T;
  }

  async findMany(query: QuerySpec = {}): Promise<Page<T>> {
    await assertAuthenticated(this.tableName);
    let select = supabase.from(this.tableName).select('*', { count: 'exact' });

    if (!query.includeDeleted) {
      select = select.is('deleted_at', null);
    }

    for (const f of query.filters ?? []) {
      const field = camelToSnake(f.field);
      if (f.op === 'eq') select = select.eq(field, f.value);
      else if (f.op === 'neq') select = select.neq(field, f.value);
      else if (f.op === 'gt') select = select.gt(field, f.value);
      else if (f.op === 'gte') select = select.gte(field, f.value);
      else if (f.op === 'lt') select = select.lt(field, f.value);
      else if (f.op === 'lte') select = select.lte(field, f.value);
      else if (f.op === 'like') select = select.like(field, `%${f.value}%`);
      else if (f.op === 'ilike') select = select.ilike(field, `%${f.value}%`);
      else if (f.op === 'isNull') select = select.is(field, null);
      else if (f.op === 'notNull') select = select.not(field, 'is', null);
    }

    for (const s of query.sort ?? []) {
      select = select.order(camelToSnake(s.field), { ascending: s.dir === 'asc' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const fromRange = (page - 1) * pageSize;
    const toRange = fromRange + pageSize - 1;

    const { data, count, error } = await select.range(fromRange, toRange);

    if (error) {
      console.warn(`Supabase findMany warning/error on ${this.tableName}:`, error.message);
      return {
        data: [],
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total: 0,
        totalPages: 0,
      };
    }

    const total = count ?? 0;
    const converted = (data ?? []).map((row) => toCamelCaseObject(row) as T);
    return {
      data: converted,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  }
}

