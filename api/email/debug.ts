import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Debug endpoint to identify what's crashing
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const results: Record<string, string> = {};
  
  // Test 1: Basic
  results.basic = 'ok';
  
  // Test 2: Firebase Admin
  try {
    const { getAdminDb } = await import('../../lib/firebaseAdmin');
    const db = getAdminDb();
    results.firebase = db ? 'ok' : 'null';
  } catch (err) {
    results.firebase = `error: ${(err as Error).message}`;
  }
  
  // Test 3: Logger
  try {
    const { createLogger } = await import('../../lib/logger');
    const log = createLogger('test');
    results.logger = log ? 'ok' : 'null';
  } catch (err) {
    results.logger = `error: ${(err as Error).message}`;
  }
  
  // Test 4: Rate limiter
  try {
    const { applyRateLimitToRequest } = await import('../../lib/rateLimiter');
    results.rateLimiter = applyRateLimitToRequest ? 'ok' : 'null';
  } catch (err) {
    results.rateLimiter = `error: ${(err as Error).message}`;
  }
  
  // Test 5: SendGrid Client
  try {
    const { SendGridClient } = await import('../../src/services/SendGridClient');
    results.sendgridClient = SendGridClient ? 'ok' : 'null';
  } catch (err) {
    results.sendgridClient = `error: ${(err as Error).message}`;
  }
  
  // Test 6: Email Queue Service
  try {
    const { EmailQueueService } = await import('../../src/services/EmailQueueService');
    results.emailQueue = EmailQueueService ? 'ok' : 'null';
  } catch (err) {
    results.emailQueue = `error: ${(err as Error).message}`;
  }
  
  // Test 7: Spam Score Service
  try {
    const { spamScoreService } = await import('../../src/services/SpamScoreService');
    results.spamScore = spamScoreService ? 'ok' : 'null';
  } catch (err) {
    results.spamScore = `error: ${(err as Error).message}`;
  }
  
  // Test 8: Sentry
  try {
    const { withSentry } = await import('../../lib/sentry-server');
    results.sentry = withSentry ? 'ok' : 'null';
  } catch (err) {
    results.sentry = `error: ${(err as Error).message}`;
  }
  
  // Test 9: Zod
  try {
    const { z } = await import('zod');
    results.zod = z ? 'ok' : 'null';
  } catch (err) {
    results.zod = `error: ${(err as Error).message}`;
  }
  
  // Test 10: DOMPurify + JSDOM
  try {
    const createDOMPurify = require('dompurify');
    const { JSDOM } = require('jsdom');
    const window = new JSDOM('').window;
    const purify = createDOMPurify(window);
    results.dompurify = purify ? 'ok' : 'null';
  } catch (err) {
    results.dompurify = `error: ${(err as Error).message}`;
  }
  
  res.status(200).json({
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    results,
  });
}
