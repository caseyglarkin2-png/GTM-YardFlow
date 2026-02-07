/**
 * Config Health Check Endpoint
 * Sprint 50 - T50.4
 * 
 * Verifies all required environment variables are present.
 * Does NOT expose actual values, only presence (configured: true/false).
 * 
 * Usage: curl https://your-app.vercel.app/api/health/config
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ConfigCheckResult {
  name: string;
  configured: boolean;
}

interface HealthResponse {
  status: 'healthy' | 'misconfigured';
  client: ConfigCheckResult[];
  server: ConfigCheckResult[];
  timestamp: string;
  missingVars?: string[];
}

export default function handler(
  req: VercelRequest,
  res: VercelResponse<HealthResponse>
): void {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end();
    return;
  }

  // Client-side variables (VITE_ prefix required for Vite to bundle)
  const clientVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_APP_ID',
  ];

  // Server-side variables (used by Vercel Functions)
  const serverVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_SERVICE_ACCOUNT_KEY',
    'SENDGRID_API_KEY',
    'FROM_EMAIL',
  ];

  // Optional variables (nice to have, not required)
  const optionalVars = [
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'RAILWAY_API_SECRET',
    'CRON_SECRET',
    'SENTRY_DSN',
  ];

  const client: ConfigCheckResult[] = clientVars.map((v) => ({
    name: v,
    configured: !!process.env[v],
  }));

  const server: ConfigCheckResult[] = serverVars.map((v) => ({
    name: v,
    configured: !!process.env[v],
  }));

  // Check if all required vars are present
  const allConfigured = [...client, ...server].every((v) => v.configured);
  const missingVars = [...client, ...server]
    .filter((v) => !v.configured)
    .map((v) => v.name);

  // Set appropriate status code
  const statusCode = allConfigured ? 200 : 503;

  // Add cache headers (short cache, since config doesn't change often)
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

  res.status(statusCode).json({
    status: allConfigured ? 'healthy' : 'misconfigured',
    client,
    server,
    timestamp: new Date().toISOString(),
    ...(missingVars.length > 0 && { missingVars }),
  });
}
