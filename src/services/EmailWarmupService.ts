import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { EmailStats } from '../types/email';

const STATE_COLLECTION = 'email_warmup_state';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function weeksSince(start: number): number {
  const diff = Date.now() - start;
  return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function getLimitForWeek(week: number): number {
  // Warmup schedule for new sending domains
  // Can be bypassed with BYPASS_EMAIL_WARMUP=true in Vercel
  if (week <= 1) return 50;   // Week 1: 50/day (increased from 20)
  if (week === 2) return 100; // Week 2: 100/day
  if (week === 3) return 250; // Week 3: 250/day
  if (week === 4) return 500; // Week 4: 500/day
  return Number.POSITIVE_INFINITY;
}

export class EmailWarmupService {
  constructor(private readonly db: Firestore) {}

  async canSend(tenantId: string | undefined, count: number, stats?: EmailStats): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
    if (!tenantId) {
      return { allowed: true };
    }

    const stateRef = this.db.collection(STATE_COLLECTION).doc(tenantId);
    const stateSnap = await stateRef.get();
    const state = stateSnap.data() as { startedAt: number; paused?: boolean } | undefined;
    const startedAt = state?.startedAt || Date.now();
    const week = weeksSince(startedAt);
    const limit = getLimitForWeek(week);

    if (state?.paused) {
      return { allowed: false, reason: 'paused' };
    }

    const dayRef = stateRef.collection('days').doc(todayKey());
    const daySnap = await dayRef.get();
    const countToday = (daySnap.data() as { count?: number } | undefined)?.count || 0;
    const remaining = Number.isFinite(limit) ? Math.max(0, limit - countToday) : Number.POSITIVE_INFINITY;

    if (stats && this.shouldPause(stats)) {
      await stateRef.set({ startedAt, paused: true, pausedAt: Date.now(), reason: 'health' }, { merge: true });
      return { allowed: false, reason: 'health' };
    }

    if (countToday + count > limit) {
      return { allowed: false, remaining: Math.max(0, limit - countToday), reason: 'warmup_limit' };
    }

    // Ensure state exists
    await stateRef.set({ startedAt }, { merge: true });
    return { allowed: true, remaining };
  }

  async recordSend(tenantId: string | undefined, count: number): Promise<void> {
    if (!tenantId) return;
    const stateRef = this.db.collection(STATE_COLLECTION).doc(tenantId);
    const dayRef = stateRef.collection('days').doc(todayKey());
    await dayRef.set({ count: FieldValue.increment(count) } as never, { merge: true });
    await stateRef.set({ lastSentAt: Date.now() }, { merge: true });
  }

  shouldPause(stats: EmailStats): boolean {
    const bounceRate = stats.bounceRate ?? (stats.delivered ? stats.bounced / stats.delivered : 0);
    const spamRate = stats.spamRate ?? (stats.delivered ? stats.spam / stats.delivered : 0);
    return bounceRate > 0.05 || spamRate > 0.001;
  }
}
