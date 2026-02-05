import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';
import { sendAlert, AlertSeverity } from '../../lib/alerting';
import { SuppressionSyncService } from '../../src/services/SuppressionSyncService';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { SendGridClient } from '../../src/services/SendGridClient';

const log = createLogger('cron-sync-suppressions');

/**
 * Suppression List Sync Cron Job
 * Sprint 39E.2: Two-way sync between Firestore and SendGrid suppression lists
 * 
 * Runs daily to ensure:
 * 1. All Firestore suppressions are in SendGrid (outbound compliance)
 * 2. All SendGrid suppressions are in Firestore (inbound compliance)
 * 
 * This prevents sending to bounced/complained/unsubscribed emails.
 * 
 * Security: Requires CRON_SECRET in Authorization header.
 */

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = getRequestId(req);
  const requestLog = log.withRequestId(requestId);

  // Verify cron secret
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    requestLog.warn('Unauthorized cron access attempt');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  requestLog.info('Starting suppression sync cron job');
  const startTime = Date.now();

  try {
    const db = getAdminDb();
    const sendGrid = new SendGridClient();
    const compliance = new EmailComplianceService(db, sendGrid);
    const syncService = new SuppressionSyncService(sendGrid, compliance, db);

    // Phase 1: Push Firestore suppressions to SendGrid
    requestLog.info('Phase 1: Syncing Firestore to SendGrid');
    const toSendGrid = await syncService.syncToSendGrid();
    requestLog.info('Firestore to SendGrid sync complete', {
      synced: toSendGrid.synced,
      errors: toSendGrid.errors,
      total: toSendGrid.total,
    });

    // Phase 2: Pull SendGrid suppressions to Firestore
    requestLog.info('Phase 2: Syncing SendGrid to Firestore');
    const fromSendGrid = await syncService.syncFromSendGrid();
    requestLog.info('SendGrid to Firestore sync complete', {
      imported: fromSendGrid.imported,
      total: fromSendGrid.total,
    });

    const duration = Date.now() - startTime;

    // Record sync metadata
    await db.collection('sync_metadata').doc('suppression_sync').set({
      lastSyncAt: Date.now(),
      toSendGrid,
      fromSendGrid,
      duration,
      requestId,
    }, { merge: true });

    // Alert if there were sync errors
    if (toSendGrid.errors > 0) {
      await sendAlert(
        `Suppression Sync Errors: ${toSendGrid.errors} emails failed to sync to SendGrid`,
        AlertSeverity.WARNING,
        { toSendGrid, requestId }
      );
    }

    requestLog.info('Suppression sync completed', { duration });
    res.status(200).json({
      success: true,
      toSendGrid,
      fromSendGrid,
      duration,
      requestId,
    });

  } catch (err) {
    const error = err as Error;
    requestLog.error('Suppression sync failed', error);

    await sendAlert(
      `Suppression Sync Failed: ${error.message}`,
      AlertSeverity.ERROR,
      { requestId, error: error.message }
    );

    res.status(500).json({
      error: 'Suppression sync failed',
      detail: error.message,
      requestId,
    });
  }
}

export default withSentry(handler);
