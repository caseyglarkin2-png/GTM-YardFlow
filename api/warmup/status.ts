/**
 * Warmup Status API Endpoint
 * 
 * GET /api/warmup/status
 * Returns current email warmup status for the authenticated user's domain
 * 
 * Used by WarmupDashboard component (T2.4)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Warmup schedule configuration
const WARMUP_SCHEDULE = [
  { week: 1, limit: 50 },
  { week: 2, limit: 100 },
  { week: 3, limit: 250 },
  { week: 4, limit: 500 },
];

interface WarmupStatus {
  startedAt: number;
  paused: boolean;
  pauseReason?: string;
  currentDay: number;
  currentWeek: number;
  dailyLimit: number;
  sentToday: number;
  maxLimit: number;
  warmupComplete: boolean;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: In production, fetch from database using authenticated user's tenant
    // For now, calculate based on a simulated start date
    
    // Simulate warmup started 10 days ago
    const startedAt = Date.now() - (10 * 24 * 60 * 60 * 1000);
    const now = Date.now();
    const daysSinceStart = Math.floor((now - startedAt) / (24 * 60 * 60 * 1000));
    const weeksSinceStart = Math.floor(daysSinceStart / 7) + 1;
    
    const scheduleEntry = WARMUP_SCHEDULE.find(s => s.week >= weeksSinceStart);
    const dailyLimit = scheduleEntry ? scheduleEntry.limit : Number.POSITIVE_INFINITY;
    const warmupComplete = weeksSinceStart > WARMUP_SCHEDULE.length;
    
    // Simulate sent today (would come from email tracking in production)
    const sentToday = Math.floor(Math.random() * (dailyLimit * 0.7));
    
    const status: WarmupStatus = {
      startedAt,
      paused: false,
      currentDay: daysSinceStart + 1,
      currentWeek: weeksSinceStart,
      dailyLimit: Number.isFinite(dailyLimit) ? dailyLimit : -1, // Use -1 for unlimited
      sentToday,
      maxLimit: WARMUP_SCHEDULE[WARMUP_SCHEDULE.length - 1].limit,
      warmupComplete,
    };

    return res.status(200).json(status);
  } catch (error) {
    console.error('Warmup status error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch warmup status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
