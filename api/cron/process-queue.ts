import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';
import { RailwayMailSender } from '../../src/services/RailwayMailSender';
import type { IEmailSender } from '../../src/services/IEmailSender';

const log = createLogger('cron-process-queue');

/**
 * Email Queue Processor Cron Job
 * 
 * Processes pending emails from the Firestore queue.
 * Should be called every 5 minutes via Vercel Cron or external scheduler.
 * 
 * Security: Requires CRON_SECRET in Authorization header.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only allow POST (from external) or GET (from Vercel native crons)
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify cron authentication
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  
  // Check for Vercel cron header (native crons don't need auth)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  
  if (!isVercelCron) {
    // External caller - require bearer token
    if (!cronSecret) {
      log.warn('CRON_SECRET not configured - rejecting external cron request');
      res.status(401).json({ error: 'Cron not configured' });
      return;
    }
    
    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (providedToken !== cronSecret) {
      log.warn('Invalid cron authentication attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const startTime = Date.now();
  log.info('Starting queue processing');

  try {
    const db = getAdminDb();
    
    // Determine which sender to use based on env vars
    const useRailway = process.env.RAILWAY_EMAIL_ENABLED === 'true' || process.env.VITE_RAILWAY_EMAIL_ENABLED === 'true';
    let sender: IEmailSender;
    
    if (useRailway) {
        log.info('Using RailwayMailSender (Feature Flag Enabled)');
        sender = new RailwayMailSender();
    } else {
        log.info('Using SendGridClient (Default)');
        sender = new SendGridClient();
    }

    const startClient = Date.now();
    
    // Validate sender if possible
    if (sender instanceof SendGridClient) {
        // SendGrid validation logic if needed
    }

    // Only pass SendGrid client if we are using it
    const compliance = new EmailComplianceService(db, sender instanceof SendGridClient ? sender : undefined); 
    
    const warmup = new EmailWarmupService(db);
    const tracking = new EmailTrackingService(db);
    
    const queue = new EmailQueueService(db, sender, compliance, warmup, tracking, 'cron-worker');

    // Process up to 25 emails per invocation (fits in Vercel timeout)
    const processed = await queue.processBatch(25);
    
    const sent = processed.filter(p => p.status === 'sent').length;
    const failed = processed.filter(p => p.status === 'failed').length;
    const rescheduled = processed.filter(p => p.status === 'scheduled').length;
    const duration = Date.now() - startTime;

    log.info('Queue processing complete', { 
      total: processed.length, 
      sent, 
      failed, 
      rescheduled,
      durationMs: duration 
    });

    res.status(200).json({
      success: true,
      processed: processed.length,
      sent,
      failed,
      rescheduled,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    log.error('Queue processing failed', err as Error, { durationMs: duration });
    
    res.status(500).json({
      success: false,
      error: 'Processing failed',
      detail: (err as Error).message,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  }
}
