import { env } from '../config/env.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /apiKey/i,
  /privateKey/i,
  /credential/i,
  /sessionId/i,
  /db_password/i,
];

/**
 * Deeply sanitizes an object or value, replacing sensitive keys with '[REDACTED]'
 */
export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH_REACHED]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact bearer tokens or authorization patterns in plain strings
    if (/bearer\s+[a-zA-Z0-9._~+/-]+=*/i.test(data)) {
      return data.replace(/bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: env.NODE_ENV === 'production' ? undefined : data.stack,
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = sanitizeLogData(value, depth + 1);
    }
  }

  return clean;
}

export interface LogContext {
  requestId?: string;
  service?: string;
  [key: string]: unknown;
}

export class SafeLogger {
  private currentPriority: number;

  constructor(private serviceName = 'opspilot-api') {
    this.currentPriority = LOG_LEVEL_PRIORITY[env.LOG_LEVEL] ?? LOG_LEVEL_PRIORITY.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return (LOG_LEVEL_PRIORITY[level] ?? 30) >= this.currentPriority;
  }

  private write(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
    context?: LogContext,
  ): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const cleanMeta = meta ? sanitizeLogData(meta) : undefined;
    const cleanContext = context ? (sanitizeLogData(context) as LogContext) : undefined;

    const payload = {
      timestamp,
      level,
      service: context?.service || this.serviceName,
      requestId: context?.requestId,
      message,
      ...(cleanMeta && typeof cleanMeta === 'object' ? { meta: cleanMeta } : {}),
      ...(cleanContext && typeof cleanContext === 'object' ? { context: cleanContext } : {}),
    };

    const serialized = JSON.stringify(payload);

    if (level === 'error' || level === 'fatal') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  public trace(message: string, meta?: Record<string, unknown>, context?: LogContext): void {
    this.write('trace', message, meta, context);
  }

  public debug(message: string, meta?: Record<string, unknown>, context?: LogContext): void {
    this.write('debug', message, meta, context);
  }

  public info(message: string, meta?: Record<string, unknown>, context?: LogContext): void {
    this.write('info', message, meta, context);
  }

  public warn(message: string, meta?: Record<string, unknown>, context?: LogContext): void {
    this.write('warn', message, meta, context);
  }

  public error(message: string, meta?: Record<string, unknown>, context?: LogContext): void {
    this.write('error', message, meta, context);
  }

  public fatal(message: string, meta?: Record<string, unknown>, context?: LogContext): void {
    this.write('fatal', message, meta, context);
  }

  public child(context: LogContext): SafeLoggerChild {
    return new SafeLoggerChild(this, context);
  }
}

export class SafeLoggerChild {
  constructor(
    private parent: SafeLogger,
    private context: LogContext,
  ) {}

  public trace(message: string, meta?: Record<string, unknown>): void {
    this.parent.trace(message, meta, this.context);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.parent.debug(message, meta, this.context);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.parent.info(message, meta, this.context);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.parent.warn(message, meta, this.context);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    this.parent.error(message, meta, this.context);
  }

  public fatal(message: string, meta?: Record<string, unknown>): void {
    this.parent.fatal(message, meta, this.context);
  }
}

export const logger = new SafeLogger();
