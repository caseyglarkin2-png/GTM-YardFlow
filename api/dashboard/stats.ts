import type { VercelRequest, VercelResponse } from '@vercel/node';
import { railwayServerClient } from '../../lib/railway-client';

/**
 * Dashboard Stats API
 * 
 * Fetches aggregated stats from Railway backend for the dashboard.
 * Uses the new S2S authentication pattern with x-service-key headers.
 * 
 * GET /api/dashboard/stats
 * 
 * Query params:
 * - userId: Optional user ID to scope stats (defaults to service-level)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract user context from Firebase auth headers if present
    const userId = req.headers['x-firebase-uid']?.toString() || undefined;
    const email = req.headers['x-user-email']?.toString() || undefined;

    // Fetch stats from Railway backend
    const stats = await railwayServerClient.fetch<{
      totalProspects: number;
      activeSequences: number;
      emailsSentToday: number;
      openRate: number;
      replyRate: number;
      meetingsBooked: number;
    }>('/api/dashboards/stats', {
      method: 'GET',
    }, userId ? { userId, email } : undefined);

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Check if it's a Railway client error with status
    if (error && typeof error === 'object' && 'status' in error) {
      const clientError = error as { status: number; message: string };
      return res.status(clientError.status).json({ 
        error: 'Railway API error',
        message: clientError.message 
      });
    }

    return res.status(500).json({ 
      error: 'Failed to fetch dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
