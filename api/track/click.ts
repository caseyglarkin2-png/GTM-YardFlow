import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { isValidRedirectUrl } from '../../lib/origins';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';

const db = getAdminDb();
const tracking = new EmailTrackingService(db);

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
