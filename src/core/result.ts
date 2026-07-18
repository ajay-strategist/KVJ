/**
 * KVJ Analytics — Result & centralized error contract
 * Layer: Core. Used by Services (business layer) and the API layer.
 * See docs/18-architecture-specification.md — Error Handling & §5 API Layer,
 * and docs/11-technical-debt.md (no central error handler existed before).
 *
 * Services return AppError (never throw raw), and the API layer serialises errors
 * into the standard envelope: { ok:false, error:{ code, message, details?, traceId } }.
 * Stack traces are never exposed to users (Prompt 11 security requirement).
 */

/** Stable, machine-readable error codes (extend as modules grow). */
export enum ErrorCode {
  VALIDATION = 'VALIDATION',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTEGRATION = 'INTEGRATION', // Google/Supabase/PowerBI failure
  BUSINESS_RULE = 'BUSINESS_RULE', // a domain rule was violated
  INTERNAL = 'INTERNAL',
}

/** Severity for logging/monitoring (Prompt 11 logging levels). */
export type Severity = 'info' | 'warning' | 'error' | 'critical';

export interface AppErrorShape {
  code: ErrorCode;
  message: string; // user-friendly
  details?: unknown; // field errors, context — never a stack trace to the client
  severity: Severity;
  module?: string;
  traceId?: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly severity: Severity;
  readonly module?: string;
  readonly traceId?: string;

  constructor(shape: AppErrorShape) {
    super(shape.message);
    this.name = 'AppError';
    this.code = shape.code;
    this.details = shape.details;
    this.severity = shape.severity ?? 'error';
    this.module = shape.module;
    this.traceId = shape.traceId;
  }

  toEnvelope() {
    return {
      ok: false as const,
      error: {
        code: this.code,
        message: this.message,
        details: this.details ?? undefined,
        traceId: this.traceId,
      },
    };
  }

  static validation(message: string, details?: unknown) {
    return new AppError({ code: ErrorCode.VALIDATION, message, details, severity: 'warning' });
  }
  static forbidden(message = 'You do not have permission to perform this action.') {
    return new AppError({ code: ErrorCode.FORBIDDEN, message, severity: 'warning' });
  }
  static notFound(message = 'The requested resource was not found.') {
    return new AppError({ code: ErrorCode.NOT_FOUND, message, severity: 'warning' });
  }
  static businessRule(message: string, details?: unknown) {
    return new AppError({ code: ErrorCode.BUSINESS_RULE, message, details, severity: 'warning' });
  }
  static internal(message = 'Something went wrong. Please try again.') {
    return new AppError({ code: ErrorCode.INTERNAL, message, severity: 'error' });
  }
}

/** Discriminated result — services can return this instead of throwing where preferred. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export const Ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const Err = <T = never>(error: AppError): Result<T> => ({ ok: false, error });
