import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Public Health Endpoint
 * Sprint 209: Production Monitoring & Runbook
 * T209.4: Add Uptime Monitoring
 * 
 * Returns health status for external uptime monitoring services
 * (UptimeRobot, Pingdom, etc.)
 * 
 * GET /api/health
 */

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version?: string;
  timestamp: string;
  environment: string;
  checks?: {
    name: string;
    status: 'pass' | 'fail';
    duration?: number;
  }[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    // Basic health response
    const response: HealthResponse = {
      status: 'ok',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'development',
    };

    // Optional: Include detailed checks if requested
    const includeDetails = req.query.details === 'true';
    
    if (includeDetails) {
      const checks: HealthResponse['checks'] = [];
      
      // Check Railway API
      if (process.env.RAILWAY_API_URL) {
        const railwayStart = Date.now();
        try {
          const railwayResponse = await fetch(`${process.env.RAILWAY_API_URL}/api/health`, {
            signal: AbortSignal.timeout(3000),
          });
          checks.push({
            name: 'railway_api',
            status: railwayResponse.ok ? 'pass' : 'fail',
            duration: Date.now() - railwayStart,
          });
        } catch {
          checks.push({
            name: 'railway_api',
            status: 'fail',
            duration: Date.now() - railwayStart,
          });
        }
      }

      // Overall status based on checks
      const failedChecks = checks.filter(c => c.status === 'fail');
      if (failedChecks.length > 0) {
        response.status = failedChecks.length === checks.length ? 'error' : 'degraded';
      }
      
      response.checks = checks;
    }

    // Set cache headers for monitoring
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'development',
    });
  }
}
