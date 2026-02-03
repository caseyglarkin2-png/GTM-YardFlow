/**
 * Structured Logger for API Endpoints
 * 
 * Provides JSON-formatted logging for production log aggregation.
 * Supports log levels: error, warn, info, debug
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogContext {
  endpoint?: string;
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  endpoint?: string;
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  durationMs?: number;
  message: string;
  error?: string;
  stack?: string;
  context?: Record<string, unknown>;
}

// Sensitive field patterns to redact from logs
const SENSITIVE_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /apikey/i,
  /api_key/i,
  /credential/i,
  /private/i,
];

/**
 * Check if a key contains sensitive data
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Sanitize an object by redacting sensitive fields
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Check if we're in production mode
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if debug logging is enabled
 */
function isDebugEnabled(): boolean {
  return process.env.LOG_LEVEL === 'debug' || !isProduction();
}

/**
 * Get the minimum log level threshold
 */
function getLogLevelThreshold(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === 'error' || level === 'warn' || level === 'info' || level === 'debug') {
    return level;
  }
  return isProduction() ? 'info' : 'debug';
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Check if a log level should be output based on current threshold
 */
function shouldLog(level: LogLevel): boolean {
  const threshold = getLogLevelThreshold();
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[threshold];
}

/**
 * Format a log entry as JSON string
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Create a log entry object
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context?.endpoint) entry.endpoint = context.endpoint;
  if (context?.userId) entry.userId = context.userId;
  if (context?.requestId) entry.requestId = context.requestId;
    
  if (context?.path) entry.path = context.path;
  if (context?.method) entry.method = context.method;
  if (context?.durationMs !== undefined) entry.durationMs = context.durationMs;

  // Add sanitized additional context
  const { endpoint, userId, requestId, ...additionalContext } = context || {};
  if (Object.keys(additionalContext).length > 0) {
    entry.context = sanitizeObject(additionalContext);
  }

  // Add error details if present
  if (error) {
    entry.error = error.message;
    if (!isProduction() || level === 'error') {
      entry.stack = error.stack;
    }
  }

  return entry;
}

/**
 * Output a log entry to the appropriate console method
 */
function output(level: LogLevel, entry: LogEntry): void {
  const formatted = formatLogEntry(entry);
  
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
  }
}

/**
 * Logger class for structured logging with context
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Set the user ID in the logger context
   */
  withUser(userId: string): Logger {
    return this.child({ userId });
  }

  /**
   * Set the request ID in the logger context
   */
  withRequestId(requestId: string): Logger {
    return this.child({ requestId });
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, additionalContext?: Record<string, unknown>): void {
    if (!shouldLog('error')) return;
    const entry = createLogEntry('error', message, { ...this.context, ...additionalContext }, error);
    output('error', entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, additionalContext?: Record<string, unknown>): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, { ...this.context, ...additionalContext });
    output('warn', entry);
  }

  /**
   * Log an info message
   */
  info(message: string, additionalContext?: Record<string, unknown>): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, { ...this.context, ...additionalContext });
    output('info', entry);
  }

  /**
   * Log a debug message
   */
  debug(message: string, additionalContext?: Record<string, unknown>): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, { ...this.context, ...additionalContext });
    output('debug', entry);
  }
}

/**
 * Create a logger instance for an API endpoint
 */
export function createLogger(endpoint: string): Logger {
  return new Logger({ endpoint });
}

/**
 * Request metadata for structured logging
 */
export interface RequestLogData {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
}

/**
 * Response metadata for structured logging
 */
export interface ResponseLogData {
  status: number;
  durationMs: number;
  contentLength?: number;
  error?: string;
}

/**
 * Log incoming API request
 */
export function logRequest(
  logger: Logger,
  request: RequestLogData,
  requestId: string
): void {
  const sanitizedHeaders = request.headers 
    ? sanitizeObject(request.headers as Record<string, unknown>) as Record<string, string>
    : undefined;
    
  logger.withRequestId(requestId).info('Request received', {
    method: request.method,
    path: request.path,
    query: request.query,
    headers: sanitizedHeaders,
    userAgent: request.userAgent,
    ip: request.ip,
    contentLength: request.contentLength,
  });
}

/**
 * Log API response
 */
export function logResponse(
  logger: Logger,
  response: ResponseLogData,
  requestId: string
): void {
  const level = response.status >= 500 ? 'error' 
              : response.status >= 400 ? 'warn' 
              : 'info';
  
  const childLogger = logger.withRequestId(requestId);
  
  if (level === 'error') {
    childLogger.error('Request failed', undefined, {
      status: response.status,
      durationMs: response.durationMs,
      error: response.error,
    });
  } else if (level === 'warn') {
    childLogger.warn('Request error', {
      status: response.status,
      durationMs: response.durationMs,
      error: response.error,
    });
  } else {
    childLogger.info('Request completed', {
      status: response.status,
      durationMs: response.durationMs,
      contentLength: response.contentLength,
    });
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a request logger that tracks timing automatically
 */
export function createRequestLogger(endpoint: string): {
  logger: Logger;
  requestId: string;
  startTime: number;
  logStart: (request: RequestLogData) => void;
  logEnd: (status: number, error?: string) => void;
} {
  const logger = createLogger(endpoint);
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  return {
    logger,
    requestId,
    startTime,
    logStart: (request: RequestLogData) => {
      logRequest(logger, request, requestId);
    },
    logEnd: (status: number, error?: string) => {
      logResponse(logger, {
        status,
        durationMs: Date.now() - startTime,
        error,
      }, requestId);
    },
  };
}

/**
 * Default logger instance (for quick usage)
 */
export const logger = new Logger();

export default logger;
