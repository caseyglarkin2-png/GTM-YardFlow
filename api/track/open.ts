import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';

const db = getAdminDb();
const tracking = new EmailTrackingService(db);
const PIXEL = Buffer.from('R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0] || req.socket.remoteAddress || undefined;
  const userAgent = req.headers['user-agent'] as string | undefined;
  await tracking.recordOpen(token, ip, userAgent);

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Length', PIXEL.length.toString());
  res.status(200).end(PIXEL);
}
