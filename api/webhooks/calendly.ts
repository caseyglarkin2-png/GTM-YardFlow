import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { railwayServerClient } from '../../lib/railway-client';
import { CalendlyEventPayloadSchema } from '../../lib/schemas/webhooks';

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

  const parseResult = CalendlyEventPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.warn('[Calendly Webhook] Invalid payload:', parseResult.error);
    res.status(400).json({ error: 'Invalid payload format', details: parseResult.error });
    return;
  }

  const { event, payload } = parseResult.data;

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

interface CalendlyPayload {
  invitee: any;
  event: any;
  event_type?: any;
}

async function handleMeetingBooked(payload: CalendlyPayload): Promise<void> {
  const { invitee, event: calEvent, event_type } = payload;
  
  const email = invitee.email.toLowerCase();
  const inviteeUri = invitee.uri;
  const eventUri = calEvent.uri;
  
  // Extract IDs from URIs
  const inviteeId = inviteeUri.split('/').pop() || inviteeUri;
  
  // Create meeting record
  const meetingDoc = {
    id: `calendly_${inviteeId}`,
    source: 'calendly',
    inviteeEmail: email,
    inviteeName: invitee.name,
    eventName: calEvent.name,
    eventType: event_type?.name,
    startTime: new Date(calEvent.start_time).getTime(),
    endTime: new Date(calEvent.end_time).getTime(),
    status: 'booked',
    bookedAt: Date.now(),
    attribution: invitee.tracking || {},
    calendlyInviteeUri: inviteeUri,
    calendlyEventUri: eventUri,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.collection(MEETINGS_COLLECTION).doc(meetingDoc.id).set(meetingDoc);

  // Link meeting to prospect and update status - SPRINT 1006 CORE LOGIC
  await processMeetingAttribution(email, meetingDoc.id);

  console.log(`[Calendly Webhook] Meeting booked: ${email} for ${calEvent.name}`);
}

async function handleMeetingCanceled(payload: CalendlyPayload): Promise<void> {
  const { invitee } = payload;
  
  const inviteeUri = invitee.uri;
  const inviteeId = inviteeUri.split('/').pop() || inviteeUri;
  const meetingId = `calendly_${inviteeId}`;
  
  await db.collection(MEETINGS_COLLECTION).doc(meetingId).update({
    status: 'canceled',
    canceledAt: Date.now(),
    cancelerName: invitee.canceler_name,
    cancelReason: invitee.cancel_reason,
    updatedAt: Date.now(),
  });

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

  console.log(`[Calendly Webhook] Meeting canceled: ${email}`);
}

/**
 * Process Meeting Attribution (Sprint 1006)
 * 1. Find prospect by email
 * 2. Update prospect status
 * 3. Find ACTIVE enrollments for this PROSPECT ID
 * 4. Stop sequence (set status='meeting')
 * 5. Sync to Railway
 */
async function processMeetingAttribution(email: string, meetingId: string): Promise<void> {
  // 1. Search Firestore for a prospect with this email
  const prospects = await db.collection(PROSPECTS_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (prospects.empty) {
    console.log(`[Calendly Webhook] Attribution failed: No prospect found for ${email}`);
    return;
  }

  const prospectDoc = prospects.docs[0];
  const prospectId = prospectDoc.id;
  const prospectData = prospectDoc.data();

  // 2. Update prospect status to 'meeting_booked' (or customer)
  await prospectDoc.ref.update({
    status: 'meeting_booked',
    lastMeetingId: meetingId,
    lastMeetingBookedAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Link meeting to prospect
  await db.collection(MEETINGS_COLLECTION).doc(meetingId).update({
    prospectId: prospectId,
    prospectName: prospectData.name,
    prospectCompany: prospectData.company,
    linkedAt: Date.now(),
  });

  console.log(`[Calendly Webhook] Linked meeting to prospect ${prospectId}`);

  // 3. Search sequenceEnrollments for any 'active' enrollment for this prospectId
  // Note: We query by prospectId as requested, though older code might have used email
  const enrollments = await db.collection('sequenceEnrollments')
    .where('prospectId', '==', prospectId)
    .where('status', '==', 'active')
    .get();

  if (enrollments.empty) {
    console.log(`[Calendly Webhook] No active enrollments found for prospect ${prospectId}`);
    return;
  }

  const batch = db.batch();
  const railwaySyncPromises: Promise<void>[] = [];
  
  // 4. Update enrollment status to 'meeting'
  for (const doc of enrollments.docs) {
    const enrollmentData = doc.data();
    
    batch.update(doc.ref, {
      status: 'meeting',
      completionReason: 'meeting_booked',
      completedAt: Date.now(),
      lastUpdated: Date.now(),
    });
    
    // 5. Sync to Railway
    // If featureFlags.RAILWAY_ENABLED (implied by checking if we have a railways enrollment ID)
    // We check for ID because even if flag is on, legacy enrollments might not be in Railway
    if (enrollmentData.railwayEnrollmentId) {
      railwaySyncPromises.push(
        syncEnrollmentToRailway(enrollmentData.railwayEnrollmentId, 'meeting', 'meeting_booked')
      );
    }
  }

  await batch.commit();
  console.log(`[Calendly Webhook] Updated ${enrollments.size} active enrollments to 'meeting'`);

  // Execute non-blocking Railway syncs
  if (railwaySyncPromises.length > 0) {
    try {
      await Promise.all(railwaySyncPromises);
      console.log(`[Calendly Webhook] Synced ${railwaySyncPromises.length} enrollments to Railway`);
    } catch (error) {
      console.error('[Calendly Webhook] Failed to sync to Railway:', error);
    }
  }
}

async function syncEnrollmentToRailway(
  railwayEnrollmentId: string,
  status: string,
  completionReason: string
): Promise<void> {
  try {
    await railwayServerClient.patch(`/api/enrollments/${railwayEnrollmentId}`, {
      status,
      completionReason,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[Calendly Webhook] Railway sync failed for ${railwayEnrollmentId}:`, error);
    // Don't throw, we want to continue processing
  }
}

function verifySignature(req: VercelRequest): boolean {
  const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Calendly Webhook] CALENDLY_WEBHOOK_SECRET missing in production');
      return false;
    }
    return true; // Dev bypass
  }

  const signature = req.headers['calendly-webhook-signature'] as string;
  if (!signature) return false;

  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.slice(2);
  const expectedSignature = signaturePart.slice(3);

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
