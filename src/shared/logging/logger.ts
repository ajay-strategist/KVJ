/**
 * KVJ Analytics — Central logger (Prompt 11 logging framework)
 * Layer: Shared. Single entry point for application logging so modules never
 * call console.* directly. In Phase 2 this forwards to an external provider
 * (Sentry/Datadog/etc.) — swap the sink here, nothing else changes.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  meta?: unknown;
  at: string;
}

type Sink = (entry: LogEntry) => void;

// Default sink: console in dev, silent for debug/info in production.
const isDev = (import.meta as { env?: Record<string, unknown> }).env?.DEV ?? true;
const consoleSink: Sink = (e) => {
  if (!isDev && (e.level === 'debug' || e.level === 'info')) return;
  const line = `[${e.context ?? 'app'}] ${e.message}`;
  // eslint-disable-next-line no-console
  if (e.level === 'error') console.error(line, e.meta ?? '');
  // eslint-disable-next-line no-console
  else if (e.level === 'warn') console.warn(line, e.meta ?? '');
  // eslint-disable-next-line no-console
  else console.log(line, e.meta ?? '');
};

let sink: Sink = consoleSink;
/** Replace the log sink (e.g. wire an external provider in Phase 2). */
export function setLogSink(next: Sink) { sink = next; }

function emit(level: LogLevel, message: string, context?: string, meta?: unknown) {
  sink({ level, message, context, meta, at: new Date().toISOString() });
}

export const logger = {
  debug: (msg: string, context?: string, meta?: unknown) => emit('debug', msg, context, meta),
  info: (msg: string, context?: string, meta?: unknown) => emit('info', msg, context, meta),
  warn: (msg: string, context?: string, meta?: unknown) => emit('warn', msg, context, meta),
  error: (msg: string, context?: string, meta?: unknown) => emit('error', msg, context, meta),
};
