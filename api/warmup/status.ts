/**
 * Warmup Status API Endpoint
 * 
 * GET /api/warmup/status
 * Returns current email warmup status from Firestore
 * 
 * Used by WarmupDashboard component (T2.4)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';

// Warmup schedule configuration (matches EmailWarmupService)
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
  bypassed?: boolean;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function weeksSince(start: number): number {
  const diff = Date.now() - start;
  return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function daysSince(start: number): number {
  const diff = Date.now() - start;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function getLimitForWeek(week: number): number {
  if (week <= 1) return 50;
  if (week === 2) return 100;
  if (week === 3) return 250;
  if (week === 4) return 500;
  return Number.POSITIVE_INFINITY;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if warmup is bypassed
    if (process.env.BYPASS_EMAIL_WARMUP === 'true') {
      const status: WarmupStatus = {
        startedAt: Date.now(),
        paused: false,
        currentDay: 0,
        currentWeek: 0,
        dailyLimit: -1, // -1 = unlimited
        sentToday: 0,
        maxLimit: WARMUP_SCHEDULE[WARMUP_SCHEDULE.length - 1].limit,
        warmupComplete: true,
        bypassed: true,
      };
      return res.status(200).json(status);
    }

    const db = getAdminDb();
    const tenantId = (req.query.tenantId as string) || 'default';
    
    // Get warmup state from Firestore
    const stateRef = db.collection('email_warmup_state').doc(tenantId);
    const stateSnap = await stateRef.get();
    const state = stateSnap.data() as {
      startedAt?: number;
      paused?: boolean;
      pausedAt?: number;
      reason?: string;
      lastSentAt?: number;
    } | undefined;

    // Initialize warmup state if it doesn't exist
    const now = Date.now();
    let startedAt = state?.startedAt;
    
    if (!startedAt) {
      startedAt = now;
      await stateRef.set({ startedAt }, { merge: true });
    }

    // Calculate warmup progress
    const currentDay = daysSince(startedAt) + 1;
    const currentWeek = weeksSince(startedAt);
    const dailyLimit = getLimitForWeek(currentWeek);
    const warmupComplete = currentWeek > WARMUP_SCHEDULE.length;

    // Get today's send count from Firestore
    const dayRef = stateRef.collection('days').doc(todayKey());
    const daySnap = await dayRef.get();
    const sentToday = (daySnap.data() as { count?: number } | undefined)?.count || 0;

    const status: WarmupStatus = {
      startedAt,
      paused: state?.paused || false,
      pauseReason: state?.reason,
      currentDay,
      currentWeek,
      dailyLimit: Number.isFinite(dailyLimit) ? dailyLimit : -1,
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
