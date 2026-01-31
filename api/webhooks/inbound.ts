import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { 
  OutOfOfficeDetector, 
  type OOODetectionResult,
  type OOOScheduleAction 
} from '../../src/services/OutOfOfficeDetector';
import { 
  SequenceStateMachine, 
  type TransitionTrigger 
} from '../../src/services/SequenceStateMachine';

const db = getAdminDb();
const oooDetector = new OutOfOfficeDetector();
const stateMachine = new SequenceStateMachine();

const INBOUND_COLLECTION = 'email_replies';
const EMAIL_EVENTS_COLLECTION = 'email_events';

/**
 * Reply Classification
 */
type ReplyType = 'human_reply' | 'out_of_office' | 'unsubscribe' | 'bounce';

interface ClassifiedReply {
  type: ReplyType;
  oooDetection?: OOODetectionResult;
  oooAction?: OOOScheduleAction;
  shouldPauseSequence: boolean;
  pauseTrigger?: TransitionTrigger;
  resumeAt?: Date;
}

/**
 * SendGrid Inbound Parse Webhook
 * 
 * Receives inbound emails via SendGrid Inbound Parse:
 * - Detects replies to our outreach emails
 * - Links reply to original outreach
 * - Pauses sequence enrollment if applicable
 * 
 * Configure in SendGrid:
 * 1. Set up domain authentication for receiving
 * 2. Add MX record for your receiving subdomain
 * 3. Configure Inbound Parse to POST to this endpoint
 * 
 * @see https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // SendGrid Inbound Parse sends multipart/form-data
    const {
      from,
      to,
      subject,
      text,
      html,
      headers: headersRaw,
      envelope: envelopeRaw,
    } = req.body;

    // Parse envelope for actual sender/recipient
    let envelope: { from: string; to: string[] } | undefined;
    try {
      envelope = typeof envelopeRaw === 'string' ? JSON.parse(envelopeRaw) : envelopeRaw;
    } catch {
      // Ignore parse errors
    }

    // Extract the original email ID from subject or headers
    const originalEmailId = extractOriginalEmailId(subject, headersRaw);
    const senderEmail = extractEmail(from);
    
    if (!senderEmail) {
      res.status(400).json({ error: 'Could not extract sender email' });
      return;
    }

    // Classify the reply (human, OOO, unsubscribe, etc.)
    const classification = classifyReply(subject || '', text || '');

    // Store the reply with classification
    const replyDoc = {
      id: `reply_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      from: senderEmail,
      fromFull: from,
      to: to,
      subject: subject || '(no subject)',
      textBody: text || '',
      htmlBody: html || '',
      receivedAt: Date.now(),
      
      // Link to original outreach
      originalEmailId,
      linkedToOutreach: !!originalEmailId,
      
      // Classification
      replyType: classification.type,
      isOOO: classification.type === 'out_of_office',
      oooConfidence: classification.oooDetection?.confidence,
      oooReturnDate: classification.resumeAt?.toISOString(),
      
      // Processing status
      processed: false,
      sequencePaused: false,
      
      envelope,
    };

    await db.collection(INBOUND_COLLECTION).doc(replyDoc.id).set(replyDoc);

    // Handle based on classification
    if (originalEmailId) {
      await handleReplyToOutreach(
        originalEmailId, 
        senderEmail, 
        replyDoc.id, 
        classification
      );
    } else {
      // Try fuzzy matching
      await tryFuzzyMatchAndPause(senderEmail, replyDoc.id, classification);
    }

    res.status(200).json({ 
      success: true, 
      replyId: replyDoc.id,
      classification: classification.type,
      isOOO: classification.type === 'out_of_office',
      resumeAt: classification.resumeAt?.toISOString(),
      linkedToOriginal: !!originalEmailId,
    });
  } catch (error) {
    console.error('[Inbound Webhook] Error processing reply:', error);
    res.status(500).json({ error: 'Failed to process inbound email' });
  }
}

/**
 * Classify the inbound reply
 * 
 * Determines if the reply is:
 * - A human reply (triggers sequence pause/stop)
 * - An out-of-office auto-reply (triggers temporary pause with resume date)
 * - An unsubscribe request (triggers unsubscribe)
 */
function classifyReply(subject: string, body: string): ClassifiedReply {
  // Check for OOO first
  const oooDetection = oooDetector.detect(subject, body);
  
  if (oooDetection.isOOO) {
    const oooAction = oooDetector.getScheduleAction(oooDetection);
    return {
      type: 'out_of_office',
      oooDetection,
      oooAction,
      shouldPauseSequence: true,
      pauseTrigger: 'ooo_detected',
      resumeAt: oooAction.resumeAt,
    };
  }

  // Check for unsubscribe request
  if (oooDetector.isUnsubscribeRequest(`${subject}\n${body}`)) {
    return {
      type: 'unsubscribe',
      shouldPauseSequence: true,
      pauseTrigger: 'user_cancel',
    };
  }

  // Default: human reply
  return {
    type: 'human_reply',
    shouldPauseSequence: true,
    pauseTrigger: 'reply_detected',
  };
}

/**
 * Extract original email ID from reply subject or headers
 * 
 * We inject a tracking ID in outbound emails via:
 * - X-Outreach-ID header
 * - Hidden footer tag
 */
function extractOriginalEmailId(subject?: string, headersRaw?: string): string | undefined {
  // Try to find in headers first (most reliable)
  if (headersRaw) {
    const headers = typeof headersRaw === 'string' ? headersRaw : '';
    
    // Look for In-Reply-To or References header containing our message ID
    const messageIdMatch = headers.match(/In-Reply-To:\s*<([^>]+)>/i) ||
                          headers.match(/References:.*<([^>]+)>/i);
    if (messageIdMatch?.[1]) {
      // Our message IDs are formatted as: emailId@domain
      const emailId = messageIdMatch[1].split('@')[0];
      if (emailId && emailId.length > 10) {
        return emailId;
      }
    }

    // Look for our custom header
    const outreachIdMatch = headers.match(/X-Outreach-ID:\s*(\S+)/i);
    if (outreachIdMatch?.[1]) {
      return outreachIdMatch[1];
    }
  }

  // Try to find tracking ID in subject (Re: [TRACK-xxxx] Original Subject)
  if (subject) {
    const trackMatch = subject.match(/\[TRACK-([a-zA-Z0-9]+)\]/);
    if (trackMatch?.[1]) {
      return trackMatch[1];
    }
  }

  return undefined;
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
function extractEmail(fromField?: string): string | undefined {
  if (!fromField) return undefined;
  
  const emailMatch = fromField.match(/<([^>]+)>/) || fromField.match(/([^\s<>]+@[^\s<>]+)/);
  return emailMatch?.[1]?.toLowerCase();
}

/**
 * Handle reply to a known outreach email
 * - Record reply event
 * - Pause/stop active sequence enrollment based on classification
 */
async function handleReplyToOutreach(
  emailId: string, 
  senderEmail: string, 
  replyId: string,
  classification: ClassifiedReply
): Promise<void> {
  // Record the reply event with classification details
  await db.collection(EMAIL_EVENTS_COLLECTION).doc(`reply:${replyId}`).set({
    emailId,
    type: classification.type,
    email: senderEmail,
    replyId,
    timestamp: Date.now(),
    receivedAt: Date.now(),
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
    isOOO: classification.type === 'out_of_office',
    oooConfidence: classification.oooDetection?.confidence,
    resumeAt: classification.resumeAt?.toISOString(),
  });

  // Handle based on classification type
  if (classification.shouldPauseSequence && classification.pauseTrigger) {
    await handleSequenceAction(
      emailId, 
      senderEmail, 
      classification.pauseTrigger,
      classification.resumeAt,
      classification.type
    );
  }

  // Update the reply doc
  await db.collection(INBOUND_COLLECTION).doc(replyId).update({
    processed: true,
    linkedToOutreach: true,
    originalEmailId: emailId,
    sequencePaused: classification.shouldPauseSequence,
  });
}

/**
 * Try to find recent outreach to this sender and handle
 */
async function tryFuzzyMatchAndPause(
  senderEmail: string, 
  replyId: string,
  classification: ClassifiedReply
): Promise<void> {
  // Look for any recent email queue items to this address
  const recentEmails = await db.collection('email_queue')
    .where('message.to', '==', senderEmail)
    .where('status', '==', 'sent')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();

  if (!recentEmails.empty) {
    const emailDoc = recentEmails.docs[0];
    const emailData = emailDoc.data();
    
    await handleReplyToOutreach(emailDoc.id, senderEmail, replyId, classification);
    
    console.log(`[Inbound Webhook] Fuzzy matched ${classification.type} from ${senderEmail} to email ${emailDoc.id}`);
    
    await db.collection(INBOUND_COLLECTION).doc(replyId).update({
      fuzzyMatched: true,
      originalEmailId: emailDoc.id,
      enrollmentId: emailData.enrollmentId,
    });
  }
}

/**
 * Handle sequence action based on reply classification
 * Uses SequenceStateMachine for proper state transitions
 */
async function handleSequenceAction(
  emailId: string, 
  senderEmail: string, 
  trigger: TransitionTrigger,
  resumeAt?: Date,
  replyType?: ReplyType
): Promise<void> {
  // Find enrollment by email ID
  const queueItem = await db.collection('email_queue').doc(emailId).get();
  const enrollmentId = queueItem.data()?.enrollmentId;

  if (enrollmentId) {
    await updateEnrollmentState(enrollmentId, trigger, resumeAt, replyType);
    console.log(`[Inbound Webhook] Processed ${trigger} for enrollment ${enrollmentId}`);
    return;
  }

  // Fallback: find by prospect email
  const enrollments = await db.collection('sequenceEnrollments')
    .where('prospectEmail', '==', senderEmail)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (!enrollments.empty) {
    const enrollmentDoc = enrollments.docs[0];
    await updateEnrollmentState(enrollmentDoc.id, trigger, resumeAt, replyType);
    console.log(`[Inbound Webhook] Processed ${trigger} for enrollment ${enrollmentDoc.id}`);
  }
}

/**
 * Update enrollment state using the state machine
 */
async function updateEnrollmentState(
  enrollmentId: string,
  trigger: TransitionTrigger,
  resumeAt?: Date,
  replyType?: ReplyType
): Promise<void> {
  // Get current enrollment
  const enrollmentDoc = await db.collection('sequenceEnrollments').doc(enrollmentId).get();
  if (!enrollmentDoc.exists) {
    console.warn(`[Inbound Webhook] Enrollment ${enrollmentId} not found`);
    return;
  }

  const enrollment = enrollmentDoc.data();
  const targetState = stateMachine.getTargetState(trigger);
  
  if (!targetState) {
    console.warn(`[Inbound Webhook] Unknown trigger: ${trigger}`);
    return;
  }

  // Build update using state machine
  const update = stateMachine.buildTransitionUpdate(targetState, trigger);
  
  // Add OOO-specific fields
  if (replyType === 'out_of_office' && resumeAt) {
    Object.assign(update, {
      oooResumeAt: resumeAt.toISOString(),
      pauseReason: `Out-of-office detected. Auto-resume scheduled for ${resumeAt.toLocaleDateString()}`,
    });
  }

  await db.collection('sequenceEnrollments').doc(enrollmentId).update(update as unknown as Record<string, unknown>);
}
