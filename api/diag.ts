import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Minimal diagnostic endpoint
 * No external dependencies - just checks environment
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    nodeVersion: process.version,
    hasRailwayUrl: !!process.env.RAILWAY_API_URL,
    hasRailwaySecret: !!(process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET),
    hasFirebaseKey: !!(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT),
    hasFirebaseProject: !!(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID),
  });
}
