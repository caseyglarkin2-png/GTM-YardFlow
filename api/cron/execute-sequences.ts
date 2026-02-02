import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';
import { SequenceSchedulerService, type SchedulerResult } from '../../src/services/SequenceSchedulerService';
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';
import { RailwayMailSender } from '../../src/services/RailwayMailSender';
import type { IEmailSender } from '../../src/services/IEmailSender';

const log = createLogger('cron-execute-sequences');

/**
 * Sequence Execution Cron Job
 * 
 * THE ENGINE that makes sequences auto-send.
 * 
 * Runs every 5 minutes to:
 * 1. Find enrollments due for their next step
 * 2. Queue emails to the email send queue
 * 3. Track step advancement
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
  log.info('Starting sequence execution');

  try {
    const db = getAdminDb();
    
    // Determine which sender to use based on env vars (for consistency, though only used for queuing here)
    const useRailway = process.env.RAILWAY_EMAIL_ENABLED === 'true' || process.env.VITE_RAILWAY_EMAIL_ENABLED === 'true';
    let sender: IEmailSender;
    
    if (useRailway) {
        sender = new RailwayMailSender();
    } else {
        sender = new SendGridClient();
    }
    
    // Initialize dependencies for EmailQueueService
    const compliance = new EmailComplianceService(db, sender instanceof SendGridClient ? sender : undefined);
    const warmup = new EmailWarmupService(db);
    const tracking = new EmailTrackingService(db);
    const queueService = new EmailQueueService(db, sender, compliance, warmup, tracking, 'sequence-scheduler');

    const scheduler = new SequenceSchedulerService(db, queueService);

    // Get enrollments due for their next step
    const dueEnrollments = await scheduler.getDueEnrollments(25);
    
    log.info(`Found ${dueEnrollments.length} enrollments due for next step`);

    const results: SchedulerResult[] = [];

    for (const { enrollment, sequence, nextStep } of dueEnrollments) {
      try {
        // Fetch prospect data for personalization
        const prospectDoc = await db.collection('prospects').doc(enrollment.prospectId).get();
        const prospectData = prospectDoc.exists 
          ? prospectDoc.data() 
          : { 
              firstName: enrollment.prospectName.split(' ')[0],
              company: enrollment.companyName,
            };

        // Queue the next step
        const queueItemId = await scheduler.queueNextStep(
          enrollment,
          sequence,
          nextStep,
          {
            firstName: prospectData?.firstName || enrollment.prospectName.split(' ')[0],
            company: prospectData?.company || enrollment.companyName,
            trailerCount: prospectData?.trailerCount,
            industry: prospectData?.industry,
          }
        );

        results.push({
          enrollmentId: enrollment.id,
          status: 'queued',
          queueItemId,
        });

        log.info(`Queued step ${nextStep.type} for enrollment ${enrollment.id}`);
      } catch (err) {
        const error = err as Error;
        log.error(`Failed to queue step for enrollment ${enrollment.id}`, error);
        
        results.push({
          enrollmentId: enrollment.id,
          status: 'failed',
          reason: error.message,
        });
      }
    }

    const queued = results.filter(r => r.status === 'queued').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const duration = Date.now() - startTime;

    log.info('Sequence execution complete', { 
      total: results.length, 
      queued, 
      failed,
      durationMs: duration 
    });

    res.status(200).json({
      success: true,
      processed: results.length,
      queued,
      failed,
      results,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    log.error('Sequence execution failed', err as Error, { durationMs: duration });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      durationMs: duration,
    });
  }
}
