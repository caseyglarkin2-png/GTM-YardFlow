import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';
import { applyRateLimitToRequest } from '../../lib/rateLimiter';

const log = createLogger('privacy-export');
const COLLECTIONS = ['prospects', 'email_logs', 'email_events', 'enrollments'];

async function fetchUserDocs(db: Firestore, collection: string, uid: string) {
  try {
    const snap = await db.collection(collection).where('userId', '==', uid).get();
    if (snap.empty) return [];
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    log.warn('Failed to fetch collection for export', { collection, error: (err as Error).message });
    throw err;
  }
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
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
    const results = await Promise.all(
      COLLECTIONS.map(async (name) => ({ name, docs: await fetchUserDocs(db, name, uid) }))
    );

    const data: Record<string, unknown[]> = {};
    let total = 0;
    for (const entry of results) {
      if (entry.docs.length > 0) {
        data[entry.name] = entry.docs;
        total += entry.docs.length;
      }
    }

    if (total === 0) {
      res.status(404).json({ error: 'No data found for user', requestId });
      return;
    }

    res.status(200).json({
      userId: uid,
      exportedAt: new Date().toISOString(),
      total,
      data,
      requestId,
    });
  } catch (err) {
    requestLog.error('Privacy export failed', err instanceof Error ? err : undefined);
    res.status(500).json({ error: 'Failed to export data', requestId });
  }
}

export default withSentry(handler);
