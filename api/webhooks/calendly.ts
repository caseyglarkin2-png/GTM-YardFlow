import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { getAdminDb } from '../../lib/firebaseAdmin';

const db = getAdminDb();

const MEETINGS_COLLECTION = 'meetings';
const PROSPECTS_COLLECTION = 'prospects';

/**
 * Calendly Webhook
 * 
 * Receives Calendly webhook events for meeting tracking:
 * - invitee.created: Meeting booked
 * - invitee.canceled: Meeting canceled
 * 
 * This is the NORTH STAR metric - meetings booked from outreach!
 * 
 * Configure in Calendly:
 * 1. Go to Integrations > Webhooks
 * 2. Add webhook URL: https://your-domain.com/api/webhooks/calendly
 * 3. Subscribe to invitee.created and invitee.canceled
 * 4. Copy signing key to CALENDLY_WEBHOOK_SECRET env var
 * 
 * @see https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-overview
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify Calendly signature
  const signatureValid = verifySignature(req);
  if (!signatureValid) {
    console.warn('[Calendly Webhook] Invalid signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const { event, payload } = req.body;

  if (!event || !payload) {
    res.status(400).json({ error: 'Missing event or payload' });
    return;
  }

  try {
    switch (event) {
      case 'invitee.created':
        await handleMeetingBooked(payload);
        break;
      case 'invitee.canceled':
        await handleMeetingCanceled(payload);
        break;
      default:
        console.log(`[Calendly Webhook] Unhandled event type: ${event}`);
    }

    res.status(200).json({ success: true, event });
  } catch (error) {
    console.error('[Calendly Webhook] Error processing event:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  timezone?: string;
  text_reminder_number?: string;
  created_at: string;
  updated_at: string;
  canceled?: boolean;
  canceler_name?: string;
  cancel_reason?: string;
  reschedule_url?: string;
  cancel_url?: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
  }>;
  tracking?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    salesforce_uuid?: string;
  };
}

interface CalendlyEvent {
  uri: string;
  name: string;
  start_time: string;
  end_time: string;
  location?: {
    type: string;
    location?: string;
    join_url?: string;
  };
  status: string;
  created_at: string;
  updated_at: string;
}

interface CalendlyPayload {
  invitee: CalendlyInvitee;
  event: CalendlyEvent;
  event_type?: {
    uri: string;
    name: string;
    duration: number;
  };
}

async function handleMeetingBooked(payload: CalendlyPayload): Promise<void> {
  const { invitee, event: calEvent, event_type } = payload;
  
  const email = invitee.email.toLowerCase();
  const inviteeUri = invitee.uri;
  const eventUri = calEvent.uri;
  
  // Extract IDs from URIs
  const inviteeId = inviteeUri.split('/').pop() || inviteeUri;
  const eventId = eventUri.split('/').pop() || eventUri;
  
  // Create meeting record
  const meetingDoc = {
    id: `calendly_${inviteeId}`,
    source: 'calendly',
    
    // Invitee details
    inviteeEmail: email,
    inviteeName: invitee.name,
    inviteeFirstName: invitee.first_name,
    inviteeLastName: invitee.last_name,
    inviteeTimezone: invitee.timezone,
    
    // Event details
    eventName: calEvent.name,
    eventType: event_type?.name,
    eventDuration: event_type?.duration,
    startTime: new Date(calEvent.start_time).getTime(),
    endTime: new Date(calEvent.end_time).getTime(),
    
    // Location
    locationType: calEvent.location?.type,
    locationUrl: calEvent.location?.join_url || calEvent.location?.location,
    
    // Status
    status: 'booked',
    bookedAt: Date.now(),
    
    // Attribution (UTM params from Calendly link)
    attribution: invitee.tracking || {},
    
    // Q&A responses
    questionsAndAnswers: invitee.questions_and_answers || [],
    
    // Links
    rescheduleUrl: invitee.reschedule_url,
    cancelUrl: invitee.cancel_url,
    
    // Calendly URIs for reference
    calendlyInviteeUri: inviteeUri,
    calendlyEventUri: eventUri,
    
    // Timestamps
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.collection(MEETINGS_COLLECTION).doc(meetingDoc.id).set(meetingDoc);

  // Try to link to a prospect and update their status
  await linkMeetingToProspect(email, meetingDoc.id);

  console.log(`[Calendly Webhook] Meeting booked: ${email} for ${calEvent.name} at ${calEvent.start_time}`);
}

async function handleMeetingCanceled(payload: CalendlyPayload): Promise<void> {
  const { invitee, event: calEvent } = payload;
  
  const inviteeUri = invitee.uri;
  const inviteeId = inviteeUri.split('/').pop() || inviteeUri;
  const meetingId = `calendly_${inviteeId}`;
  
  // Update meeting status
  await db.collection(MEETINGS_COLLECTION).doc(meetingId).update({
    status: 'canceled',
    canceledAt: Date.now(),
    cancelerName: invitee.canceler_name,
    cancelReason: invitee.cancel_reason,
    updatedAt: Date.now(),
  });

  // Update prospect status if linked
  const email = invitee.email.toLowerCase();
  const prospects = await db.collection(PROSPECTS_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!prospects.empty) {
    await prospects.docs[0].ref.update({
      status: 'meeting_canceled',
      lastMeetingCanceledAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  console.log(`[Calendly Webhook] Meeting canceled: ${email} - ${invitee.cancel_reason || 'no reason'}`);
}

/**
 * Link meeting to prospect and update their status
 * This is the key attribution moment - outreach → meeting
 */
async function linkMeetingToProspect(email: string, meetingId: string): Promise<void> {
  // Find prospect by email
  const prospects = await db.collection(PROSPECTS_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (prospects.empty) {
    console.log(`[Calendly Webhook] No prospect found for ${email}`);
    return;
  }

  const prospectDoc = prospects.docs[0];
  const prospectData = prospectDoc.data();

  // Update prospect status to "Meeting Booked" - this is the GOAL!
  await prospectDoc.ref.update({
    status: 'meeting_booked',
    lastMeetingId: meetingId,
    lastMeetingBookedAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Update meeting with prospect link
  await db.collection(MEETINGS_COLLECTION).doc(meetingId).update({
    prospectId: prospectDoc.id,
    prospectName: prospectData.name || `${prospectData.firstName} ${prospectData.lastName}`,
    prospectCompany: prospectData.company,
    linkedAt: Date.now(),
  });

  // Pause any active sequence enrollments for this prospect
  await pauseSequenceEnrollments(email, 'meeting_booked');

  console.log(`[Calendly Webhook] Linked meeting ${meetingId} to prospect ${prospectDoc.id}`);
}

/**
 * Pause active sequences when meeting is booked
 * We got what we wanted - stop the outreach!
 */
async function pauseSequenceEnrollments(email: string, reason: string): Promise<void> {
  const enrollments = await db.collection('sequence_enrollments')
    .where('prospectEmail', '==', email)
    .where('status', 'in', ['active', 'in_progress'])
    .get();

  const batch = db.batch();
  
  for (const doc of enrollments.docs) {
    batch.update(doc.ref, {
      status: 'completed',
      completedAt: Date.now(),
      completionReason: reason,
      lastUpdated: Date.now(),
    });
  }

  if (!enrollments.empty) {
    await batch.commit();
    console.log(`[Calendly Webhook] Completed ${enrollments.size} sequence enrollments for ${email}`);
  }
}

/**
 * Verify Calendly webhook signature
 * @see https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-overview#webhook-signatures
 */
function verifySignature(req: VercelRequest): boolean {
  const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET;
  
  // If no secret configured, skip verification (development mode)
  if (!webhookSecret) {
    console.warn('[Calendly Webhook] No webhook secret configured, skipping signature check');
    return true;
  }

  const signature = req.headers['calendly-webhook-signature'] as string;
  
  if (!signature) {
    return false;
  }

  // Calendly signature format: t=timestamp,v1=signature
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = timestampPart.slice(2);
  const expectedSignature = signaturePart.slice(3);

  // Create the signed payload
  const signedPayload = `${timestamp}.${JSON.stringify(req.body)}`;
  const computedSignature = createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(computedSignature)
    );
  } catch {
    return false;
  }
}
