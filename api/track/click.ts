import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';

const db = getAdminDb();
const tracking = new EmailTrackingService(db);

// Allowed redirect domains to prevent open redirect attacks
const ALLOWED_REDIRECT_DOMAINS = [
  'calendly.com',
  'freightroll.com',
  'yardflow.com',
  'gtm-yard-flow.vercel.app',
  'hubspot.com',
  'linkedin.com',
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
];

/**
 * Validate that a URL is safe to redirect to
 * Prevents open redirect vulnerabilities
 */
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Check against allowlist
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_REDIRECT_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0] || req.socket.remoteAddress || undefined;
  const userAgent = req.headers['user-agent'] as string | undefined;
  const { url } = await tracking.recordClick(token, ip, userAgent);

  if (!url) {
    res.status(400).json({ error: 'Invalid or missing target' });
    return;
  }

  // Validate URL to prevent open redirect
  if (!isValidRedirectUrl(url)) {
    console.warn('[api/track/click] Blocked redirect to untrusted URL:', url);
    res.status(400).json({ error: 'Untrusted redirect URL' });
    return;
  }

  res.status(302).setHeader('Location', url).end();
}
