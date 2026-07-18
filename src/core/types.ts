/**
 * KVJ Analytics — Core shared types
 * Layer: Core (below every module). Depended upon by all Services & Repositories.
 * See docs/18-architecture-specification.md §6 (Database Standard) and §4 (Repository Layer).
 *
 * These types encode the platform-wide entity contract: UUID keys, audit fields,
 * soft delete, and a standard query/pagination shape used by every repository.
 */

/** A v4 UUID string. All primary keys are UUIDs (Prompt 4 / Prompt 12 DB standard). */
export type UUID = string;

/** ISO-8601 timestamp string (stored as timestamptz in Supabase). */
export type ISODateString = string;

/** The actor performing an action — used for created_by/updated_by and audit. */
export interface Actor {
  id: UUID;
  role: string;
  name?: string;
}

/**
 * Audit + soft-delete fields present on EVERY entity.
 * Repositories populate these automatically; modules never set them by hand.
 */
export interface AuditFields {
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: UUID | null;
  updatedBy: UUID | null;
  deletedAt: ISODateString | null;
  deletedBy: UUID | null;
}

/** Base shape every persisted entity extends. */
export interface Entity extends AuditFields {
  id: UUID;
  status: string;
}

/** Sort direction for queries. */
export type SortDir = 'asc' | 'desc';

/** A single filter clause. Operators map cleanly onto SQL/Supabase. */
export interface FilterClause {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike' | 'isNull' | 'notNull';
  value?: unknown;
}

/** Standard query specification honoured by every repository (filter/sort/search/paginate). */
export interface QuerySpec {
  filters?: FilterClause[];
  search?: { term: string; fields: string[] };
  sort?: { field: string; dir: SortDir }[];
  page?: number; // 1-based
  pageSize?: number; // default from config
  includeDeleted?: boolean; // default false — soft-deleted rows excluded
}

/** A page of results plus pagination metadata. */
export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Helper to build an empty page. */
export function emptyPage<T>(page = 1, pageSize = 20): Page<T> {
  return { data: [], page, pageSize, total: 0, totalPages: 0 };
}

/** A geographic point (attendance clock-in, client visits). */
export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
}

/** Inclusive date range used across attendance, leave, reports. */
export interface DateRange {
  from: ISODateString;
  to: ISODateString;
}
