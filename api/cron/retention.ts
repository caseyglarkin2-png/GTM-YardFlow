import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';

const log = createLogger('cron-retention');
const RETENTION_DAYS = 90;
const COLLECTIONS = [
  { name: 'email_logs', dateField: 'createdAt' },
  { name: 'email_events', dateField: 'timestamp' },
];

async function purgeCollection(
  db: Firestore,
  name: string,
  dateField: string,
  cutoff: Date
): Promise<number> {
  let deleted = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  try {
    while (true) {
      let query: FirebaseFirestore.Query = db
        .collection(name)
        .orderBy(dateField)
        .where(dateField, '<', cutoff)
        .limit(450);

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const snap = await query.get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      deleted += snap.size;
      cursor = snap.docs[snap.docs.length - 1];

      if (snap.size < 450) break;
    }

    return deleted;
  } catch (err) {
    log.warn('Retention query failed', { collection: name, error: (err as Error).message });
    throw err;
  }
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = getRequestId(req);
  const requestLog = log.withRequestId(requestId);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', requestId });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const providedToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!cronSecret || providedToken !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized', requestId });
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const db = getAdminDb();
    const results: Record<string, number> = {};

    for (const { name, dateField } of COLLECTIONS) {
      results[name] = await purgeCollection(db, name, dateField, cutoff);
    }

    requestLog.info('Retention run complete', { cutoff: cutoff.toISOString(), results, requestId });
    res.status(200).json({ cutoff: cutoff.toISOString(), results, requestId });
  } catch (err) {
    requestLog.error('Retention run failed', err instanceof Error ? err : undefined);
    res.status(500).json({ error: 'Retention failed', requestId });
  }
}

export default withSentry(handler);
