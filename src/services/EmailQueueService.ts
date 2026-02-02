import { randomUUID } from 'crypto';
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import type { EmailMessage, EmailQueueItem } from '../types/email';
import type { IEmailSender } from './IEmailSender';
import { EmailComplianceService } from './EmailComplianceService';
import { EmailTrackingService } from './EmailTrackingService';
import { EmailWarmupService } from './EmailWarmupService';
import { SequenceSchedulerService } from './SequenceSchedulerService';

const QUEUE_COLLECTION = 'email_queue';
const DEAD_LETTER_COLLECTION = 'email_dead_letter';
const MAX_RETRIES = 3;

/**
 * Exponential backoff delays in milliseconds
 * Sprint 2: T2.2 - Exponential Backoff Retry Logic
 * 
 * Attempt 1: 1 minute
 * Attempt 2: 5 minutes
 * Attempt 3: 30 minutes
 * After 3 attempts, move to dead letter queue
 */
const RETRY_DELAYS_MS = [
  1 * 60 * 1000,    // 1 minute
  5 * 60 * 1000,    // 5 minutes  
  30 * 60 * 1000,   // 30 minutes
];

function currentMs(): number {
  return Date.now();
}

/**
 * Calculate retry delay using exponential backoff
 * @param attemptNumber - The current attempt number (1-based)
 * @returns Delay in milliseconds
 */
function getRetryDelay(attemptNumber: number): number {
  const index = Math.min(attemptNumber - 1, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

export class EmailQueueService {
  private readonly sequenceScheduler: SequenceSchedulerService;

  constructor(
    private readonly db: Firestore,
    private readonly sender: IEmailSender,
    private readonly compliance: EmailComplianceService,
    private readonly warmup: EmailWarmupService,
    private readonly tracking: EmailTrackingService,
    private readonly workerId: string = 'worker'
  ) {
    this.sequenceScheduler = new SequenceSchedulerService(db);
  }

  async enqueue(message: EmailMessage, options: { userId?: string; idempotencyKey?: string; scheduledAt?: number } = {}): Promise<EmailQueueItem> {
    const idempotencyKey = options.idempotencyKey;
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }

    const status = options.scheduledAt && options.scheduledAt > currentMs() ? 'scheduled' : 'pending';
    const enriched = this.withComplianceAndTracking(message);
    const item: EmailQueueItem = {
      id: message.id || randomUUID(),
      message: enriched,
      status,
      attempts: 0,
      maxAttempts: MAX_RETRIES,
      idempotencyKey,
      scheduledAt: options.scheduledAt ?? currentMs(),
      createdAt: currentMs(),
      updatedAt: currentMs(),
      tenantId: message.metadata?.tenantId,
      userId: options.userId || message.metadata?.userId,
    };

    await this.db.collection(QUEUE_COLLECTION).doc(item.id).set(item);
    return item;
  }

  async enqueueBatch(messages: EmailMessage[], options: { userId?: string; idempotencyKeyFn?: (message: EmailMessage) => string | undefined; scheduledAt?: number } = {}): Promise<EmailQueueItem[]> {
    const results: EmailQueueItem[] = [];
    for (const msg of messages) {
      const key = options.idempotencyKeyFn?.(msg);
      results.push(await this.enqueue(msg, { userId: options.userId, idempotencyKey: key, scheduledAt: options.scheduledAt }));
    }
    return results;
  }

  async scheduleEmail(message: EmailMessage, scheduledAt: number, options?: { userId?: string; idempotencyKey?: string }): Promise<EmailQueueItem> {
    return this.enqueue(message, { ...options, scheduledAt });
  }

  async processNext(): Promise<EmailQueueItem | null> {
    const snapshot = await this.db.collection(QUEUE_COLLECTION)
      .where('status', 'in', ['pending', 'scheduled'])
      .orderBy('scheduledAt', 'asc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const locked = await this.db.runTransaction(async tx => this.lockForProcessing(tx, doc.id));
    if (!locked) return null;

    return this.sendAndMark(locked.itemRef, locked.item);
  }

  async processBatch(limit = 10): Promise<EmailQueueItem[]> {
    const processed: EmailQueueItem[] = [];
    for (let i = 0; i < limit; i++) {
      const item = await this.processNext();
      if (!item) break;
      processed.push(item);
    }
    return processed;
  }

  async cancelPendingByEmailId(emailId: string): Promise<number> {
    const snap = await this.db.collection(QUEUE_COLLECTION)
      .where('message.id', '==', emailId)
      .where('status', 'in', ['pending', 'scheduled'])
      .get();
    let canceled = 0;
    const batch = this.db.batch();
    snap.docs.forEach(d => {
      canceled++;
      batch.update(d.ref, { status: 'canceled', updatedAt: currentMs() });
    });
    if (canceled > 0) {
      await batch.commit();
    }
    return canceled;
  }

  private withComplianceAndTracking(message: EmailMessage): EmailMessage {
    const compliant = this.compliance.injectComplianceElements(message);
    if (this.compliance.respectDoNotTrack(message)) {
      return compliant;
    }
    return this.tracking.injectTracking(compliant);
  }

  private async findByIdempotencyKey(key: string): Promise<EmailQueueItem | null> {
    const snap = await this.db.collection(QUEUE_COLLECTION)
      .where('idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as EmailQueueItem;
  }

  private async lockForProcessing(tx: Transaction, docId: string): Promise<{ itemRef: DocumentReference; item: EmailQueueItem } | null> {
    const ref = this.db.collection(QUEUE_COLLECTION).doc(docId);
    const fresh = await tx.get(ref);
    if (!fresh.exists) return null;
    const data = fresh.data() as EmailQueueItem;
    const due = (data.scheduledAt ?? 0) <= currentMs();
    if (!due) return null;
    if (data.status !== 'pending' && data.status !== 'scheduled') return null;
    const lockedItem: EmailQueueItem = {
      ...data,
      status: 'processing',
      lockedAt: currentMs(),
      lockedBy: this.workerId,
      updatedAt: currentMs(),
    };
    tx.update(ref, { status: 'processing', lockedAt: lockedItem.lockedAt, lockedBy: lockedItem.lockedBy, updatedAt: lockedItem.updatedAt });
    return { itemRef: ref, item: lockedItem };
  }

  private async sendAndMark(ref: DocumentReference, item: EmailQueueItem): Promise<EmailQueueItem> {
    const warmup = await this.warmup.canSend(item.tenantId, 1);
    if (!warmup.allowed) {
      await ref.update({ status: 'scheduled', scheduledAt: currentMs() + 60 * 60 * 1000, lastError: warmup.reason, updatedAt: currentMs() });
      return { ...item, status: 'scheduled' };
    }

    try {
      await this.sender.sendEmail(item.message);
      await this.warmup.recordSend(item.tenantId, 1);
      await ref.update({ status: 'sent', updatedAt: currentMs(), attempts: item.attempts });
      
      // Advance sequence if this is a sequence email
      if (item.enrollmentId && item.stepId) {
        try {
          await this.sequenceScheduler.advanceStep(item.enrollmentId, item.stepId);
        } catch (err) {
          // Log but don't fail - email was sent successfully
          console.error('Failed to advance sequence step:', err);
        }
      }
      
      return { ...item, status: 'sent' };
    } catch (err) {
      await this.handleFailure(ref, item, err as Error);
      return { ...item, status: 'failed', lastError: (err as Error).message };
    }
  }

  private async handleFailure(ref: DocumentReference, item: EmailQueueItem, err: Error): Promise<void> {
    const attempts = item.attempts + 1;
    const updates = { attempts, lastError: err.message, updatedAt: currentMs() } as Record<string, unknown>;
    
    if (attempts >= item.maxAttempts) {
      await this.moveToDeadLetter(ref, { ...item, attempts, status: 'dead-letter', lastError: err.message });
      return;
    }
    
    // Use exponential backoff: 1min, 5min, 30min
    const retryDelay = getRetryDelay(attempts);
    updates.status = 'pending';
    updates.scheduledAt = currentMs() + retryDelay;
    updates.nextRetryAt = currentMs() + retryDelay;
    
    await ref.update(updates);
  }

  private async moveToDeadLetter(ref: DocumentReference, item: EmailQueueItem): Promise<void> {
    const deadRef = this.db.collection(DEAD_LETTER_COLLECTION).doc(item.id);
    await this.db.runTransaction(async tx => {
      tx.delete(ref);
      tx.set(deadRef, { ...item, movedAt: currentMs() });
    });
  }
}
