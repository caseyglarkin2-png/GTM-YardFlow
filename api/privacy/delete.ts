import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';
import { applyRateLimitToRequest } from '../../lib/rateLimiter';
import { railwayServerClient } from '../../lib/railway-client';

const log = createLogger('privacy-delete');
const COLLECTIONS = ['prospects', 'email_logs', 'email_events', 'enrollments'];

async function fetchUserDocs(db: Firestore, collection: string, uid: string) {
  try {
    const snap = await db.collection(collection).where('userId', '==', uid).get();
    if (snap.empty) return [];
    return snap.docs;
  } catch (err) {
    log.warn('Failed to fetch collection for deletion', { collection, error: (err as Error).message });
    throw err;
  }
}

async function syncRailway(deletionPayload: { railwayUserIds: string[]; railwayEnrollmentIds: string[] }) {
  if (!deletionPayload.railwayUserIds.length && !deletionPayload.railwayEnrollmentIds.length) return;
  try {
    await railwayServerClient.post('/api/privacy/delete', deletionPayload);
  } catch (err) {
    log.warn('Railway deletion sync failed', { error: err instanceof Error ? err.message : err });
  }
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const allowed = await applyRateLimitToRequest(req, res);
  if (!allowed) return;

  const requestId = getRequestId(req);
  const requestLog = log.withRequestId(requestId);

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token', requestId });
    return;
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    const db = getAdminDb();
    const deletionPayload = { railwayUserIds: new Set<string>(), railwayEnrollmentIds: new Set<string>() };
    let redacted = 0;

    for (const collection of COLLECTIONS) {
      const docs = await fetchUserDocs(db, collection, uid);
      for (const doc of docs) {
        const data = doc.data() as Record<string, unknown>;
        if (typeof data.railwayUserId === 'string') deletionPayload.railwayUserIds.add(data.railwayUserId);
        if (typeof data.railwayEnrollmentId === 'string') deletionPayload.railwayEnrollmentIds.add(data.railwayEnrollmentId);

        await doc.ref.set({
          redacted: true,
          deletedAt: new Date().toISOString(),
          userId: null,
          email: null,
          name: null,
          content: null,
        }, { merge: true });
        redacted++;
      }
    }

    await syncRailway({
      railwayUserIds: Array.from(deletionPayload.railwayUserIds),
      railwayEnrollmentIds: Array.from(deletionPayload.railwayEnrollmentIds),
    });

    res.status(200).json({ status: 'deleted', redacted, requestId });
  } catch (err) {
    requestLog.error('Privacy deletion failed', err instanceof Error ? err : undefined);
    res.status(500).json({ error: 'Failed to delete data', requestId });
  }
}

export default withSentry(handler);
