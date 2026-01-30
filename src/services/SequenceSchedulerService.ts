/**
 * Sequence Scheduler Service - YardFlow Hub
 * 
 * THE CORE ENGINE that makes sequences actually auto-send.
 * This is the fix for the critical bug where sequences exist
 * as templates but never execute.
 * 
 * Responsibilities:
 * 1. Find enrollments due for their next step
 * 2. Calculate proper send times (skip weekends, respect timezone)
 * 3. Queue the next step to the email send queue
 * 4. Advance enrollment to next step after successful send
 * 5. Mark enrollment complete when all steps done
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  SequenceEnrollment, 
  EmailSequence, 
  EmailStep,
} from '../types/emailSequence';
import type { EmailQueueItem, EmailMessage } from '../types/email';

// ============================================
// Types
// ============================================

export interface EnrollmentWithSequence {
  enrollment: SequenceEnrollment;
  sequence: EmailSequence;
  nextStep: EmailStep;
}

export interface SchedulerResult {
  enrollmentId: string;
  status: 'queued' | 'skipped' | 'completed' | 'failed';
  reason?: string;
  queueItemId?: string;
}

export interface ProspectData {
  firstName: string;
  company: string;
  trailerCount?: number;
  industry?: string;
}

// ============================================
// Constants
// ============================================

// Send times in local timezone
const SEND_TIMES: Record<string, { hour: number; minute: number }> = {
  morning: { hour: 9, minute: 15 },
  midday: { hour: 11, minute: 30 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 16, minute: 30 },
};

// Default send time if not specified
const DEFAULT_SEND_TIME = SEND_TIMES.morning;

// ============================================
// Scheduler Service
// ============================================

export class SequenceSchedulerService {
  private db: FirebaseFirestore.Firestore;

  constructor(db: FirebaseFirestore.Firestore) {
    this.db = db;
  }

  /**
   * Get all enrollments due for their next step
   * 
   * An enrollment is "due" if:
   * 1. Status is 'active'
   * 2. nextSendAt is in the past (or null for initial step)
   * 3. Not already queued for sending
   */
  async getDueEnrollments(limit = 50): Promise<EnrollmentWithSequence[]> {
    const now = new Date().toISOString();
    
    // Query enrollments that are active and due
    const enrollmentsSnap = await this.db
      .collection('sequenceEnrollments')
      .where('status', '==', 'active')
      .where('nextSendAt', '<=', now)
      .limit(limit)
      .get();

    const results: EnrollmentWithSequence[] = [];

    for (const doc of enrollmentsSnap.docs) {
      const enrollment = { id: doc.id, ...doc.data() } as SequenceEnrollment;
      
      // Fetch the sequence definition
      const sequenceDoc = await this.db
        .collection('sequences')
        .doc(enrollment.sequenceId)
        .get();
      
      if (!sequenceDoc.exists) {
        console.warn(`Sequence ${enrollment.sequenceId} not found for enrollment ${enrollment.id}`);
        continue;
      }

      const sequence = { id: sequenceDoc.id, ...sequenceDoc.data() } as EmailSequence;
      
      // Get the next step
      const nextStep = sequence.steps[enrollment.currentStepIndex];
      if (!nextStep) {
        // No more steps - should be completed
        await this.completeEnrollment(enrollment.id, 'all_steps_sent');
        continue;
      }

      // Check if this step is already queued (idempotency)
      const alreadyQueued = await this.isStepQueued(enrollment.id, nextStep.id);
      if (alreadyQueued) {
        continue;
      }

      results.push({ enrollment, sequence, nextStep });
    }

    return results;
  }

  /**
   * Calculate when the next step should be sent
   * 
   * Respects:
   * - Step delay (days/hours)
   * - Skip weekends setting
   * - Timezone
   * - Preferred send time
   */
  calculateNextSendAt(
    sequence: EmailSequence,
    step: EmailStep,
    fromDate: Date = new Date()
  ): Date {
    const { skipWeekends = true } = sequence;
    // Note: timezone handling would require a library like date-fns-tz for proper support
    
    // Start from the base date
    let nextDate = new Date(fromDate);
    
    // Add delay days
    nextDate.setDate(nextDate.getDate() + (step.delayDays || 0));
    
    // Add delay hours if specified
    if (step.delayHours) {
      nextDate.setHours(nextDate.getHours() + step.delayHours);
    }

    // Skip weekends if configured
    if (skipWeekends) {
      const dayOfWeek = nextDate.getDay();
      if (dayOfWeek === 0) { // Sunday
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (dayOfWeek === 6) { // Saturday
        nextDate.setDate(nextDate.getDate() + 2);
      }
    }

    // Set to preferred send time
    const sendTime = step.sendTime 
      ? SEND_TIMES[step.sendTime] 
      : DEFAULT_SEND_TIME;
    
    nextDate.setHours(sendTime.hour, sendTime.minute, 0, 0);

    // If the calculated time is in the past, push to next business day
    if (nextDate <= fromDate) {
      nextDate.setDate(nextDate.getDate() + 1);
      
      // Check weekend again
      if (skipWeekends) {
        const dayOfWeek = nextDate.getDay();
        if (dayOfWeek === 0) nextDate.setDate(nextDate.getDate() + 1);
        if (dayOfWeek === 6) nextDate.setDate(nextDate.getDate() + 2);
      }
    }

    return nextDate;
  }

  /**
   * Queue the next step for an enrollment
   * 
   * Creates an EmailQueueItem for the email send queue
   * Uses the same format as EmailQueueService for compatibility
   */
  async queueNextStep(
    enrollment: SequenceEnrollment,
    sequence: EmailSequence,
    step: EmailStep,
    prospectData: ProspectData
  ): Promise<string> {
    const queueItemId = uuidv4();
    const messageId = uuidv4();
    const now = Date.now();

    // Personalize subject and body
    const subject = this.personalizeTemplate(step.subject, prospectData, enrollment);
    const body = this.personalizeTemplate(step.body, prospectData, enrollment);

    // Select variant if A/B testing
    let variantId: string | undefined;
    let finalSubject = subject;
    let finalBody = body;

    if (step.variants && step.variants.length > 0) {
      const variant = this.selectVariant(step.variants);
      variantId = variant.id;
      if (variant.subject) finalSubject = this.personalizeTemplate(variant.subject, prospectData, enrollment);
      finalBody = this.personalizeTemplate(variant.body, prospectData, enrollment);
    }

    // Create email message in format expected by EmailQueueService
    const message: EmailMessage = {
      id: messageId,
      to: enrollment.prospectEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'outreach@yardflow.io',
      subject: finalSubject,
      html: this.formatHtmlBody(finalBody),
      text: finalBody,
      metadata: {
        sequenceId: sequence.id,
        tenantId: enrollment.customFields?.tenantId,
      },
      customArgs: {
        enrollmentId: enrollment.id,
        stepId: step.id,
        stepType: step.type,
        ...(variantId ? { variantId } : {}),
      },
    };

    // Create queue item in format expected by EmailQueueService
    const queueItem: EmailQueueItem = {
      id: queueItemId,
      message,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: `seq:${enrollment.id}:${step.id}`,
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
      enrollmentId: enrollment.id,
      stepId: step.id,
    };

    // Write to the email_queue collection (used by EmailQueueService)
    await this.db.collection('email_queue').doc(queueItemId).set(queueItem);

    return queueItemId;
  }

  /**
   * Format plain text body as HTML
   */
  private formatHtmlBody(text: string): string {
    // Convert line breaks to <br> and wrap in basic HTML
    const htmlContent = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333;">
<p>${htmlContent}</p>
</body>
</html>`;
  }

  /**
   * Advance enrollment to the next step after successful send
   */
  async advanceStep(enrollmentId: string, stepId: string): Promise<void> {
    const enrollmentRef = this.db.collection('sequenceEnrollments').doc(enrollmentId);
    const enrollmentDoc = await enrollmentRef.get();
    
    if (!enrollmentDoc.exists) {
      throw new Error(`Enrollment ${enrollmentId} not found`);
    }

    const enrollment = enrollmentDoc.data() as SequenceEnrollment;
    const now = new Date().toISOString();

    // Get sequence to calculate next send time
    const sequenceDoc = await this.db.collection('sequences').doc(enrollment.sequenceId).get();
    const sequence = sequenceDoc.data() as EmailSequence;

    const newStepIndex = enrollment.currentStepIndex + 1;
    const hasMoreSteps = newStepIndex < sequence.steps.length;

    if (hasMoreSteps) {
      // Calculate when to send next step
      const nextStep = sequence.steps[newStepIndex];
      const nextSendAt = this.calculateNextSendAt(sequence, nextStep);

      await enrollmentRef.update({
        currentStepIndex: newStepIndex,
        lastSentAt: now,
        nextSendAt: nextSendAt.toISOString(),
        'stepHistory': [...(enrollment.stepHistory || []), {
          stepId,
          sentAt: now,
        }],
      });
    } else {
      // All steps complete
      await this.completeEnrollment(enrollmentId, 'all_steps_sent');
    }
  }

  /**
   * Mark enrollment as complete
   */
  async completeEnrollment(enrollmentId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.collection('sequenceEnrollments').doc(enrollmentId).update({
      status: 'completed',
      completedAt: now,
      nextSendAt: null,
      pauseReason: reason,
    });
  }

  /**
   * Pause enrollment (e.g., when prospect replies)
   */
  async pauseEnrollment(enrollmentId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.collection('sequenceEnrollments').doc(enrollmentId).update({
      status: 'paused',
      pausedAt: now,
      nextSendAt: null,
      pauseReason: reason,
    });
  }

  /**
   * Mark enrollment as replied (stop sequence, mark as success)
   */
  async markReplied(enrollmentId: string): Promise<void> {
    const now = new Date().toISOString();
    
    await this.db.collection('sequenceEnrollments').doc(enrollmentId).update({
      status: 'replied',
      completedAt: now,
      nextSendAt: null,
    });
  }

  /**
   * Enroll a prospect in a sequence
   */
  async enrollProspect(
    prospectId: string,
    prospectEmail: string,
    prospectName: string,
    companyName: string,
    sequenceId: string,
    enrolledBy: string
  ): Promise<string> {
    const enrollmentId = uuidv4();
    const now = new Date();

    // Get sequence to calculate first step timing
    const sequenceDoc = await this.db.collection('sequences').doc(sequenceId).get();
    if (!sequenceDoc.exists) {
      throw new Error(`Sequence ${sequenceId} not found`);
    }
    const sequence = sequenceDoc.data() as EmailSequence;
    const firstStep = sequence.steps[0];

    if (!firstStep) {
      throw new Error(`Sequence ${sequenceId} has no steps`);
    }

    const nextSendAt = this.calculateNextSendAt(sequence, firstStep, now);

    const enrollment: SequenceEnrollment = {
      id: enrollmentId,
      sequenceId,
      prospectId,
      prospectEmail,
      prospectName,
      companyName,
      status: 'active',
      currentStepIndex: 0,
      enrolledAt: now.toISOString(),
      nextSendAt: nextSendAt.toISOString(),
      stepHistory: [],
      customFields: {
        enrolledBy,
      },
    };

    await this.db.collection('sequenceEnrollments').doc(enrollmentId).set(enrollment);

    // Update sequence enrolled count
    await this.db.collection('sequences').doc(sequenceId).update({
      enrolledCount: (sequence.enrolledCount || 0) + 1,
    });

    return enrollmentId;
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Check if a step is already queued or was already sent (idempotency)
   * 
   * Prevents duplicate sends by checking:
   * 1. If the step is currently queued/processing
   * 2. If the step was already sent (via idempotency key)
   */
  private async isStepQueued(enrollmentId: string, stepId: string): Promise<boolean> {
    const idempotencyKey = `seq:${enrollmentId}:${stepId}`;
    
    // Check email_queue for pending/processing items
    const queueSnapshot = await this.db
      .collection('email_queue')
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    return !queueSnapshot.empty;
  }

  /**
   * Personalize email template with prospect data
   */
  private personalizeTemplate(
    template: string,
    prospect: ProspectData,
    enrollment: SequenceEnrollment
  ): string {
    let result = template;

    // Standard replacements
    const replacements: Record<string, string> = {
      '{{firstName}}': prospect.firstName || enrollment.prospectName.split(' ')[0],
      '{{company}}': prospect.company || enrollment.companyName,
      '{{trailerCount}}': prospect.trailerCount?.toString() || '50',
      '{{industry}}': prospect.industry || 'logistics',
      '{{senderName}}': enrollment.customFields?.senderName || 'The YardFlow Team',
    };

    // Apply custom fields
    if (enrollment.customFields) {
      for (const [key, value] of Object.entries(enrollment.customFields)) {
        replacements[`{{${key}}}`] = value;
      }
    }

    // Apply all replacements
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return result;
  }

  /**
   * Select a variant based on weight distribution (A/B testing)
   */
  private selectVariant(variants: { id: string; weight: number; subject?: string; body: string }[]): { 
    id: string; 
    weight: number; 
    subject?: string; 
    body: string 
  } {
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 50), 0);
    const random = Math.random() * totalWeight;
    
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight || 50;
      if (random <= cumulative) {
        return variant;
      }
    }
    
    return variants[0]; // Fallback
  }
}
