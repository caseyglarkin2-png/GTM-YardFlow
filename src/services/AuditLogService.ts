/**
 * Audit Log Service - YardFlow Hub
 * 
 * Sprint 3 T3.6: Provides audit logging for cron executions and system events.
 * 
 * Features:
 * - Structured log entries with context
 * - Support for different log levels (info, warn, error)
 * - Automatic metadata enrichment
 * - Firestore-based persistent storage
 * - Query capabilities for debugging
 */

// ============================================
// Types
// ============================================

export type AuditLogLevel = 'info' | 'warn' | 'error' | 'debug';

export type AuditLogCategory = 
  | 'cron'
  | 'sequence'
  | 'email'
  | 'webhook'
  | 'auth'
  | 'sync'
  | 'system';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: AuditLogLevel;
  category: AuditLogCategory;
  action: string;
  message: string;
  
  // Context
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  
  // Entity references
  enrollmentId?: string;
  sequenceId?: string;
  prospectId?: string;
  emailId?: string;
  
  // Execution details
  duration?: number;
  success?: boolean;
  errorMessage?: string;
  errorStack?: string;
  
  // Custom metadata
  metadata?: Record<string, unknown>;
  
  // TTL for automatic cleanup (default: 90 days)
  expiresAt: number;
}

export interface CronExecutionLog {
  cronName: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  success: boolean;
  
  // Stats
  itemsProcessed?: number;
  itemsSucceeded?: number;
  itemsFailed?: number;
  
  // Error info
  errorMessage?: string;
  errorStack?: string;
  
  // Custom results
  results?: Record<string, unknown>;
}

export interface AuditLogQuery {
  category?: AuditLogCategory;
  level?: AuditLogLevel;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  enrollmentId?: string;
  sequenceId?: string;
  limit?: number;
}

// ============================================
// Audit Log Service
// ============================================

export class AuditLogService {
  private db: FirebaseFirestore.Firestore | null;
  private readonly collectionName = 'audit_logs';
  private readonly cronCollectionName = 'cron_executions';
  private readonly defaultTTLDays = 90;
  
  // In-memory buffer for batch writes
  private buffer: AuditLogEntry[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private readonly bufferSize = 50;
  private readonly flushIntervalMs = 5000;

  constructor(db?: FirebaseFirestore.Firestore) {
    this.db = db || null;
  }

  /**
   * Log an audit event
   */
  async log(
    level: AuditLogLevel,
    category: AuditLogCategory,
    action: string,
    message: string,
    context?: Partial<Omit<AuditLogEntry, 'id' | 'timestamp' | 'level' | 'category' | 'action' | 'message' | 'expiresAt'>>
  ): Promise<string> {
    const now = new Date();
    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: now.toISOString(),
      level,
      category,
      action,
      message,
      expiresAt: now.getTime() + this.defaultTTLDays * 24 * 60 * 60 * 1000,
      ...context,
    };

    // Add to buffer
    this.buffer.push(entry);

    // Console log for immediate visibility
    this.consoleLog(entry);

    // Schedule flush if needed
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.flushIntervalMs);
    }

    return entry.id;
  }

  /**
   * Convenience methods for different log levels
   */
  async info(category: AuditLogCategory, action: string, message: string, context?: Parameters<AuditLogService['log']>[4]): Promise<string> {
    return this.log('info', category, action, message, context);
  }

  async warn(category: AuditLogCategory, action: string, message: string, context?: Parameters<AuditLogService['log']>[4]): Promise<string> {
    return this.log('warn', category, action, message, context);
  }

  async error(category: AuditLogCategory, action: string, message: string, context?: Parameters<AuditLogService['log']>[4]): Promise<string> {
    return this.log('error', category, action, message, context);
  }

  async debug(category: AuditLogCategory, action: string, message: string, context?: Parameters<AuditLogService['log']>[4]): Promise<string> {
    return this.log('debug', category, action, message, context);
  }

  /**
   * Log cron execution start
   */
  startCronExecution(cronName: string): CronExecutionContext {
    const executionId = this.generateId();
    const startedAt = new Date().toISOString();

    this.info('cron', 'execution_start', `Starting cron: ${cronName}`, {
      metadata: { cronName, executionId },
    });

    return new CronExecutionContext(this, executionId, cronName, startedAt);
  }

  /**
   * Complete a cron execution
   */
  async completeCronExecution(log: CronExecutionLog): Promise<void> {
    const level = log.success ? 'info' : 'error';
    const message = log.success 
      ? `Cron ${log.cronName} completed successfully in ${log.duration}ms`
      : `Cron ${log.cronName} failed: ${log.errorMessage}`;

    await this.log(level, 'cron', 'execution_complete', message, {
      duration: log.duration,
      success: log.success,
      errorMessage: log.errorMessage,
      errorStack: log.errorStack,
      metadata: {
        cronName: log.cronName,
        itemsProcessed: log.itemsProcessed,
        itemsSucceeded: log.itemsSucceeded,
        itemsFailed: log.itemsFailed,
        results: log.results,
      },
    });

    // Store detailed cron execution record
    if (this.db) {
      const docId = `${log.cronName}_${Date.now()}`;
      await this.db.collection(this.cronCollectionName).doc(docId).set({
        ...log,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      });
    }
  }

  /**
   * Log sequence-related events
   */
  async logSequenceEvent(
    action: 'enroll' | 'step_sent' | 'step_failed' | 'pause' | 'resume' | 'complete' | 'reply',
    enrollmentId: string,
    sequenceId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.info('sequence', action, message, {
      enrollmentId,
      sequenceId,
      metadata,
    });
  }

  /**
   * Log email-related events
   */
  async logEmailEvent(
    action: 'send' | 'deliver' | 'open' | 'click' | 'bounce' | 'spam' | 'unsubscribe',
    emailId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.info('email', action, message, {
      emailId,
      metadata,
    });
  }

  /**
   * Log webhook events
   */
  async logWebhookEvent(
    action: 'received' | 'processed' | 'failed',
    source: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const level = action === 'failed' ? 'error' : 'info';
    return this.log(level, 'webhook', action, message, {
      metadata: { source, ...metadata },
    });
  }

  /**
   * Query audit logs
   */
  async query(options: AuditLogQuery): Promise<AuditLogEntry[]> {
    if (!this.db) {
      return [];
    }

    let query: FirebaseFirestore.Query = this.db.collection(this.collectionName);

    if (options.category) {
      query = query.where('category', '==', options.category);
    }
    if (options.level) {
      query = query.where('level', '==', options.level);
    }
    if (options.action) {
      query = query.where('action', '==', options.action);
    }
    if (options.enrollmentId) {
      query = query.where('enrollmentId', '==', options.enrollmentId);
    }
    if (options.sequenceId) {
      query = query.where('sequenceId', '==', options.sequenceId);
    }
    if (options.startDate) {
      query = query.where('timestamp', '>=', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.where('timestamp', '<=', options.endDate.toISOString());
    }

    query = query.orderBy('timestamp', 'desc');
    query = query.limit(options.limit || 100);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as AuditLogEntry);
  }

  /**
   * Get recent cron executions
   */
  async getRecentCronExecutions(cronName?: string, limit = 10): Promise<CronExecutionLog[]> {
    if (!this.db) {
      return [];
    }

    let query: FirebaseFirestore.Query = this.db.collection(this.cronCollectionName);
    
    if (cronName) {
      query = query.where('cronName', '==', cronName);
    }
    
    query = query.orderBy('createdAt', 'desc').limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as CronExecutionLog);
  }

  /**
   * Flush buffered logs to Firestore
   */
  async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.buffer.length === 0 || !this.db) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      const batch = this.db.batch();
      
      for (const entry of entries) {
        const ref = this.db.collection(this.collectionName).doc(entry.id);
        batch.set(ref, entry);
      }

      await batch.commit();
    } catch (error) {
      console.error('[AuditLog] Failed to flush logs:', error);
      // Re-add failed entries to buffer
      this.buffer.unshift(...entries);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}_${random}`;
  }

  /**
   * Console log for immediate visibility
   */
  private consoleLog(entry: AuditLogEntry): void {
    const prefix = `[${entry.category.toUpperCase()}:${entry.action}]`;
    const msg = entry.message;

    switch (entry.level) {
      case 'error':
        console.error(prefix, msg, entry.errorMessage || '');
        break;
      case 'warn':
        console.warn(prefix, msg);
        break;
      case 'debug':
        console.debug(prefix, msg);
        break;
      default:
        console.log(prefix, msg);
    }
  }
}

/**
 * Context object for tracking cron execution
 */
export class CronExecutionContext {
  private startTime: number;
  private itemsProcessed = 0;
  private itemsSucceeded = 0;
  private itemsFailed = 0;
  private results: Record<string, unknown> = {};

  constructor(
    private auditLog: AuditLogService,
    public readonly executionId: string,
    private cronName: string,
    private startedAt: string
  ) {
    this.startTime = Date.now();
  }

  /**
   * Record a processed item
   */
  recordItem(success: boolean): void {
    this.itemsProcessed++;
    if (success) {
      this.itemsSucceeded++;
    } else {
      this.itemsFailed++;
    }
  }

  /**
   * Add result data
   */
  addResult(key: string, value: unknown): void {
    this.results[key] = value;
  }

  /**
   * Mark execution as complete
   */
  async complete(additionalResults?: Record<string, unknown>): Promise<void> {
    const completedAt = new Date().toISOString();
    const duration = Date.now() - this.startTime;

    await this.auditLog.completeCronExecution({
      cronName: this.cronName,
      startedAt: this.startedAt,
      completedAt,
      duration,
      success: true,
      itemsProcessed: this.itemsProcessed,
      itemsSucceeded: this.itemsSucceeded,
      itemsFailed: this.itemsFailed,
      results: { ...this.results, ...additionalResults },
    });
  }

  /**
   * Mark execution as failed
   */
  async fail(error: Error | string): Promise<void> {
    const completedAt = new Date().toISOString();
    const duration = Date.now() - this.startTime;

    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    await this.auditLog.completeCronExecution({
      cronName: this.cronName,
      startedAt: this.startedAt,
      completedAt,
      duration,
      success: false,
      itemsProcessed: this.itemsProcessed,
      itemsSucceeded: this.itemsSucceeded,
      itemsFailed: this.itemsFailed,
      errorMessage,
      errorStack,
      results: this.results,
    });
  }
}

// Singleton instance
let auditLogInstance: AuditLogService | null = null;

export function getAuditLogService(db?: FirebaseFirestore.Firestore): AuditLogService {
  if (!auditLogInstance) {
    auditLogInstance = new AuditLogService(db);
  }
  return auditLogInstance;
}

// Convenience exports for direct use
export async function logAudit(
  level: AuditLogLevel,
  category: AuditLogCategory,
  action: string,
  message: string,
  context?: Parameters<AuditLogService['log']>[4]
): Promise<string> {
  return getAuditLogService().log(level, category, action, message, context);
}

export function startCronAudit(cronName: string): CronExecutionContext {
  return getAuditLogService().startCronExecution(cronName);
}
