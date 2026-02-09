/**
 * HubSpot Activity Logger
 * Sprint 26 - T26.7
 * 
 * Logs YardFlow activities to HubSpot contact timeline.
 */

import type { HubSpotClient } from './HubSpotClient';
import type { HubSpotEngagement } from '../types/hubspot';

/**
 * Activity types supported for logging
 */
export type ActivityType = 
  | 'email_sent'
  | 'email_opened'
  | 'email_clicked'
  | 'call_logged'
  | 'meeting_scheduled'
  | 'note_added'
  | 'dm_copied'
  | 'sequence_started'
  | 'sequence_completed'
  | 'task_completed';

/**
 * Activity log entry
 */
export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  contactId: string;
  prospectId?: string;
  timestamp: string;
  user?: string;
  subject?: string;
  body?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Queued activity for batch processing
 */
interface QueuedActivity extends ActivityLogEntry {
  queuedAt: number;
  retries: number;
  lastError?: string;
}

/**
 * Activity log result
 */
export interface ActivityLogResult {
  success: boolean;
  engagementId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Batch result
 */
export interface BatchLogResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ activityId: string; error: string }>;
}

/**
 * Logger configuration
 */
interface ActivityLoggerConfig {
  /** Max retries for failed logs */
  maxRetries?: number;
  /** Batch size for flush */
  batchSize?: number;
  /** Storage key for queue */
  storageKey?: string;
  /** Enable deduplication */
  deduplicate?: boolean;
  /** Deduplication window (ms) */
  dedupeWindow?: number;
}

const DEFAULT_CONFIG: Required<ActivityLoggerConfig> = {
  maxRetries: 3,
  batchSize: 50,
  storageKey: 'yardflow_hubspot_activity_queue',
  deduplicate: true,
  dedupeWindow: 60000, // 1 minute
};

/**
 * Create HubSpot Activity Logger
 */
export function createActivityLogger(
  client: HubSpotClient,
  config: ActivityLoggerConfig = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let queue: QueuedActivity[] = [];
  const loggedActivities: Map<string, number> = new Map(); // deduplication

  // Load queue from storage
  function loadQueue(): void {
    try {
      const stored = localStorage.getItem(cfg.storageKey);
      if (stored) {
        queue = JSON.parse(stored);
      }
    } catch {
      queue = [];
    }
  }

  // Save queue to storage
  function saveQueue(): void {
    try {
      localStorage.setItem(cfg.storageKey, JSON.stringify(queue));
    } catch {
      // Storage full or unavailable
    }
  }

  // Generate deduplication key
  function getDedupeKey(activity: ActivityLogEntry): string {
    return `${activity.type}:${activity.contactId}:${activity.timestamp}`;
  }

  // Check if activity is duplicate
  function isDuplicate(activity: ActivityLogEntry): boolean {
    if (!cfg.deduplicate) return false;
    
    const key = getDedupeKey(activity);
    const lastLogged = loggedActivities.get(key);
    
    if (lastLogged && Date.now() - lastLogged < cfg.dedupeWindow) {
      return true;
    }
    
    return false;
  }

  // Mark activity as logged (for deduplication)
  function markLogged(activity: ActivityLogEntry): void {
    const key = getDedupeKey(activity);
    loggedActivities.set(key, Date.now());
    
    // Clean old entries
    const cutoff = Date.now() - cfg.dedupeWindow;
    for (const [k, v] of loggedActivities) {
      if (v < cutoff) {
        loggedActivities.delete(k);
      }
    }
  }

  // Map activity type to HubSpot engagement type
  function mapToEngagementType(type: ActivityType): 'NOTE' | 'EMAIL' | 'CALL' | 'MEETING' | 'TASK' {
    switch (type) {
      case 'email_sent':
      case 'email_opened':
      case 'email_clicked':
        return 'EMAIL';
      case 'call_logged':
        return 'CALL';
      case 'meeting_scheduled':
        return 'MEETING';
      case 'task_completed':
        return 'TASK';
      case 'note_added':
      case 'dm_copied':
      case 'sequence_started':
      case 'sequence_completed':
      default:
        return 'NOTE';
    }
  }

  // Format activity body for HubSpot
  function formatActivityBody(activity: ActivityLogEntry): string {
    const parts: string[] = [];
    
    // Add type header
    const typeLabels: Record<ActivityType, string> = {
      email_sent: '📧 Email Sent',
      email_opened: '👁️ Email Opened',
      email_clicked: '🖱️ Email Link Clicked',
      call_logged: '📞 Call Logged',
      meeting_scheduled: '📅 Meeting Scheduled',
      note_added: '📝 Note Added',
      dm_copied: '💬 DM Copied',
      sequence_started: '▶️ Sequence Started',
      sequence_completed: '✅ Sequence Completed',
      task_completed: '☑️ Task Completed',
    };
    
    parts.push(`**${typeLabels[activity.type] || activity.type}**`);
    parts.push('');
    
    if (activity.user) {
      parts.push(`User: ${activity.user}`);
    }
    
    if (activity.subject) {
      parts.push(`Subject: ${activity.subject}`);
    }
    
    if (activity.body) {
      parts.push('');
      parts.push(activity.body);
    }
    
    if (activity.outcome) {
      parts.push('');
      parts.push(`Outcome: ${activity.outcome}`);
    }
    
    if (activity.metadata) {
      parts.push('');
      parts.push('---');
      parts.push(`Source: FreightRoll | ${new Date(activity.timestamp).toLocaleString()}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Log a single activity immediately
   */
  async function logActivity(activity: ActivityLogEntry): Promise<ActivityLogResult> {
    // Check for duplicate
    if (isDuplicate(activity)) {
      return {
        success: true,
        skipped: true,
        reason: 'Duplicate activity within deduplication window',
      };
    }

    try {
      const engagementType = mapToEngagementType(activity.type);
      let engagement: HubSpotEngagement;

      switch (engagementType) {
        case 'EMAIL':
          engagement = await client.logEmail(activity.contactId, {
            subject: activity.subject || `FreightRoll: ${activity.type}`,
            body: activity.body || formatActivityBody(activity),
          });
          break;

        case 'TASK':
          engagement = await client.createTask(activity.contactId, {
            subject: activity.subject || `FreightRoll: ${activity.type}`,
            body: formatActivityBody(activity),
            priority: 'MEDIUM',
          });
          break;

        case 'NOTE':
        default:
          engagement = await client.createNote(
            activity.contactId,
            formatActivityBody(activity)
          );
          break;
      }

      markLogged(activity);

      return {
        success: true,
        engagementId: engagement.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log activity',
      };
    }
  }

  /**
   * Queue an activity for batch processing
   */
  function queueActivity(activity: ActivityLogEntry): void {
    // Check for duplicate
    if (isDuplicate(activity)) {
      return;
    }

    // Remove existing duplicate in queue
    queue = queue.filter(q => getDedupeKey(q) !== getDedupeKey(activity));

    queue.push({
      ...activity,
      queuedAt: Date.now(),
      retries: 0,
    });

    saveQueue();
  }

  /**
   * Queue multiple activities
   */
  function queueActivities(activities: ActivityLogEntry[]): void {
    for (const activity of activities) {
      queueActivity(activity);
    }
  }

  /**
   * Flush queue - process all queued activities
   */
  async function flushQueue(): Promise<BatchLogResult> {
    loadQueue();

    const result: BatchLogResult = {
      total: queue.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    const processed: string[] = [];
    const retry: QueuedActivity[] = [];

    // Process in batches
    for (let i = 0; i < queue.length; i += cfg.batchSize) {
      const batch = queue.slice(i, i + cfg.batchSize);

      const batchResults = await Promise.all(
        batch.map(async (activity) => {
          const logResult = await logActivity(activity);
          return { activity, logResult };
        })
      );

      for (const { activity, logResult } of batchResults) {
        if (logResult.success) {
          if (logResult.skipped) {
            result.skipped++;
          } else {
            result.successful++;
          }
          processed.push(activity.id);
        } else {
          activity.retries++;
          activity.lastError = logResult.error;

          if (activity.retries >= cfg.maxRetries) {
            result.failed++;
            result.errors.push({
              activityId: activity.id,
              error: logResult.error || 'Max retries exceeded',
            });
          } else {
            retry.push(activity);
          }
        }
      }
    }

    // Update queue with retries only
    queue = retry;
    saveQueue();

    return result;
  }

  /**
   * Get queue status
   */
  function getQueueStatus(): {
    queueLength: number;
    oldestItem: string | null;
    failedItems: number;
  } {
    loadQueue();

    const failedItems = queue.filter(q => q.retries >= cfg.maxRetries).length;
    const oldestItem = queue.length > 0 
      ? new Date(queue[0].queuedAt).toISOString()
      : null;

    return {
      queueLength: queue.length,
      oldestItem,
      failedItems,
    };
  }

  /**
   * Clear the queue
   */
  function clearQueue(): void {
    queue = [];
    saveQueue();
  }

  // Convenience methods for common activity types

  /**
   * Log email sent
   */
  async function logEmailSent(
    contactId: string,
    subject: string,
    body: string,
    user?: string
  ): Promise<ActivityLogResult> {
    return logActivity({
      id: `email-${Date.now()}`,
      type: 'email_sent',
      contactId,
      timestamp: new Date().toISOString(),
      subject,
      body,
      user,
    });
  }

  /**
   * Log call
   */
  async function logCall(
    contactId: string,
    outcome: string,
    notes?: string,
    user?: string
  ): Promise<ActivityLogResult> {
    return logActivity({
      id: `call-${Date.now()}`,
      type: 'call_logged',
      contactId,
      timestamp: new Date().toISOString(),
      outcome,
      body: notes,
      user,
    });
  }

  /**
   * Log note
   */
  async function logNote(
    contactId: string,
    note: string,
    user?: string
  ): Promise<ActivityLogResult> {
    return logActivity({
      id: `note-${Date.now()}`,
      type: 'note_added',
      contactId,
      timestamp: new Date().toISOString(),
      body: note,
      user,
    });
  }

  /**
   * Log DM copied
   */
  async function logDmCopied(
    contactId: string,
    platform: string,
    message: string,
    user?: string
  ): Promise<ActivityLogResult> {
    return logActivity({
      id: `dm-${Date.now()}`,
      type: 'dm_copied',
      contactId,
      timestamp: new Date().toISOString(),
      subject: `DM copied for ${platform}`,
      body: message,
      user,
      metadata: { platform },
    });
  }

  /**
   * Log sequence event
   */
  async function logSequenceEvent(
    contactId: string,
    event: 'started' | 'completed',
    sequenceName: string,
    user?: string
  ): Promise<ActivityLogResult> {
    return logActivity({
      id: `sequence-${Date.now()}`,
      type: event === 'started' ? 'sequence_started' : 'sequence_completed',
      contactId,
      timestamp: new Date().toISOString(),
      subject: `Sequence: ${sequenceName}`,
      body: `Email sequence "${sequenceName}" ${event}`,
      user,
      metadata: { sequenceName },
    });
  }

  // Initialize
  loadQueue();

  return {
    logActivity,
    queueActivity,
    queueActivities,
    flushQueue,
    getQueueStatus,
    clearQueue,
    // Convenience methods
    logEmailSent,
    logCall,
    logNote,
    logDmCopied,
    logSequenceEvent,
    // For testing
    _getQueue: () => [...queue],
    _getLoggedActivities: () => new Map(loggedActivities),
  };
}

export type ActivityLogger = ReturnType<typeof createActivityLogger>;
