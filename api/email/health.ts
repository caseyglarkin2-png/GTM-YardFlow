import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Email Health Check Endpoint
 * 
 * Returns the configuration status of all email-related environment variables
 * and services. Use this to diagnose email sending issues.
 * 
 * GET /api/email/health
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const checks = {
    // Required for sending
    sendgridApiKey: !!process.env.SENDGRID_API_KEY,
    sendgridFromEmail: !!process.env.SENDGRID_FROM_EMAIL,
    
    // Required for tracking
    trackingSecret: !!process.env.TRACKING_SECRET,
    publicBaseUrl: !!(process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL),
    
    // Required for compliance
    unsubscribeSecret: !!process.env.UNSUBSCRIBE_HMAC_SECRET,
    
    // Firebase (for queue)
    firebaseConfigured: !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT),
    
    // Optional but recommended
    bypassWarmup: process.env.BYPASS_EMAIL_WARMUP === 'true',
    cronSecret: !!process.env.CRON_SECRET,
  };

  const requiredChecks = [
    checks.sendgridApiKey,
    checks.sendgridFromEmail,
    checks.trackingSecret,
    checks.unsubscribeSecret,
    checks.firebaseConfigured,
  ];

  const healthy = requiredChecks.every(Boolean);
  const warnings: string[] = [];

  if (!checks.publicBaseUrl) {
    warnings.push('PUBLIC_BASE_URL not set - tracking links may not work correctly');
  }
  if (!checks.cronSecret) {
    warnings.push('CRON_SECRET not set - queue processing cron will be unauthenticated');
  }
  if (checks.bypassWarmup) {
    warnings.push('BYPASS_EMAIL_WARMUP is enabled - remove in production');
  }

  const missing = Object.entries(checks)
    .filter(([key, value]) => !value && !['bypassWarmup', 'cronSecret'].includes(key))
    .map(([key]) => key);

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    missing: missing.length > 0 ? missing : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    timestamp: new Date().toISOString(),
    documentation: 'See SPRINT_PARALLEL_EXECUTION.md for required environment variables',
  });
}
