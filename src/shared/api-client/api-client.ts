/**
 * KVJ Analytics — Centralized API Client (Prompt 4 §5 API Layer)
 * Layer: Shared. NO component calls fetch/axios directly — everything goes here.
 * Backend-agnostic: a Supabase adapter can implement the same surface in Phase 2.
 *
 * Responsibilities: auth injection, request/response interceptors, retry with
 * backoff (idempotent GETs), cancellation, timeout, logging hooks, and error
 * normalization into AppError (docs/18 §5). Built on fetch (no dependency).
 */

import { AppError, ErrorCode } from '../../core/result';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number; // GET only
  skipAuth?: boolean;
}

export interface RequestContext {
  url: string;
  options: Required<Pick<RequestOptions, 'method'>> & RequestOptions;
}

type RequestInterceptor = (ctx: RequestContext) => void | Promise<void>;
type ResponseInterceptor = (res: Response, ctx: RequestContext) => void | Promise<void>;
type Logger = (entry: { level: 'info' | 'error'; message: string; meta?: unknown }) => void;

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => string | null; // auth injection (custom now, Supabase later)
  defaultTimeoutMs?: number;
  logger?: Logger;
}

export class ApiClient {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(private config: ApiClientConfig) {}

  useRequestInterceptor(fn: RequestInterceptor) { this.requestInterceptors.push(fn); }
  useResponseInterceptor(fn: ResponseInterceptor) { this.responseInterceptors.push(fn); }

  get<T>(path: string, opts?: RequestOptions) { return this.request<T>(path, { ...opts, method: 'GET' }); }
  post<T>(path: string, body?: unknown, opts?: RequestOptions) { return this.request<T>(path, { ...opts, method: 'POST', body }); }
  put<T>(path: string, body?: unknown, opts?: RequestOptions) { return this.request<T>(path, { ...opts, method: 'PUT', body }); }
  patch<T>(path: string, body?: unknown, opts?: RequestOptions) { return this.request<T>(path, { ...opts, method: 'PATCH', body }); }
  delete<T>(path: string, opts?: RequestOptions) { return this.request<T>(path, { ...opts, method: 'DELETE' }); }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(path.startsWith('http') ? path : `${this.config.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const method = opts.method ?? 'GET';
    const url = this.buildUrl(path, opts.query);
    const ctx: RequestContext = { url, options: { ...opts, method } };

    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
    if (!opts.skipAuth) {
      const token = this.config.getToken?.();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    for (const fn of this.requestInterceptors) await fn(ctx);

    const maxRetries = method === 'GET' ? (opts.retries ?? 2) : 0;
    const timeoutMs = opts.timeoutMs ?? this.config.defaultTimeoutMs ?? 15000;

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const signal = opts.signal ?? controller.signal;
      try {
        this.config.logger?.({ level: 'info', message: `${method} ${url}`, meta: { attempt } });
        const res = await fetch(url, {
          method,
          headers,
          credentials: 'include',
          body: opts.body != null ? JSON.stringify(opts.body) : undefined,
          signal,
        });
        clearTimeout(timer);
        for (const fn of this.responseInterceptors) await fn(res, ctx);

        if (!res.ok) throw await this.toAppError(res);
        if (res.status === 204) return undefined as T;

        const json = await res.json().catch(() => undefined);
        // Unwrap standard envelope { ok, data } if present.
        return (json && typeof json === 'object' && 'ok' in json ? json.data : json) as T;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (err instanceof AppError && err.code !== ErrorCode.INTEGRATION) throw err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 250 * 2 ** attempt)); // backoff
          continue;
        }
      }
    }
    this.config.logger?.({ level: 'error', message: `Request failed: ${method} ${url}`, meta: lastError });
    if (lastError instanceof AppError) throw lastError;
    throw new AppError({ code: ErrorCode.INTEGRATION, message: 'Network request failed.', severity: 'error' });
  }

  private async toAppError(res: Response): Promise<AppError> {
    const body = await res.json().catch(() => ({}));
    const message = body?.error?.message ?? body?.message ?? res.statusText;
    const map: Record<number, ErrorCode> = {
      400: ErrorCode.VALIDATION, 401: ErrorCode.UNAUTHENTICATED, 403: ErrorCode.FORBIDDEN,
      404: ErrorCode.NOT_FOUND, 409: ErrorCode.CONFLICT, 429: ErrorCode.RATE_LIMITED,
    };
    return new AppError({
      code: map[res.status] ?? ErrorCode.INTERNAL,
      message: message || 'Request failed.',
      details: body?.error?.details,
      severity: res.status >= 500 ? 'error' : 'warning',
      traceId: body?.error?.traceId,
    });
  }
}
