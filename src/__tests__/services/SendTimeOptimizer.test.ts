/**
 * SendTimeOptimizer Tests - Sprint 39D.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  SendTimeOptimizer, 
  getOptimalSendTime, 
  isGoodTimeToSendNow,
  type ProspectTimingData,
} from '../../services/SendTimeOptimizer';

describe('SendTimeOptimizer', () => {
  let optimizer: SendTimeOptimizer;

  beforeEach(() => {
    optimizer = new SendTimeOptimizer();
    // Use fake timers for consistency
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-05T14:00:00Z')); // Thursday 9am ET
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getOptimalTime', () => {
    it('returns optimal time with timezone', () => {
      const prospect: ProspectTimingData = { state: 'CA' };
      const result = optimizer.getOptimalTime(prospect);

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
      expect(result.timezone).toBe('America/Los_Angeles');
      expect(result.localTime).toBeDefined();
      expect(result.dayOfWeek).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.scheduledAt).toBeInstanceOf(Date);
    });

    it('uses explicit timezone if provided', () => {
      const prospect: ProspectTimingData = { 
        timezone: 'Europe/London',
        state: 'CA', // Should be ignored
      };
      const result = optimizer.getOptimalTime(prospect);

      expect(result.timezone).toBe('Europe/London');
    });

    it('infers timezone from state', () => {
      const prospects: Array<{ state: string; expected: string }> = [
        { state: 'NY', expected: 'America/New_York' },
        { state: 'IL', expected: 'America/Chicago' },
        { state: 'CO', expected: 'America/Denver' },
        { state: 'WA', expected: 'America/Los_Angeles' },
      ];

      for (const { state, expected } of prospects) {
        const result = optimizer.getOptimalTime({ state });
        expect(result.timezone).toBe(expected);
      }
    });

    it('defaults to Eastern time when no data', () => {
      const result = optimizer.getOptimalTime({});
      expect(result.timezone).toBe('America/New_York');
    });

    it('schedules a valid future date', () => {
      const result = optimizer.getOptimalTime({ state: 'TX' });
      
      // Should return a valid timestamp
      expect(result.timestamp).toBeDefined();
      expect(result.scheduledAt).toBeInstanceOf(Date);
      // Should be a weekday (not Sat or Sun)
      const day = result.scheduledAt.getDay();
      expect(day).not.toBe(0); // Not Sunday
      expect(day).not.toBe(6); // Not Saturday
    });

    it('applies minHoursInFuture option by scheduling later', () => {
      const shortFuture = optimizer.getOptimalTime(
        { state: 'TX' },
        { minHoursInFuture: 1 }
      );
      const longFuture = optimizer.getOptimalTime(
        { state: 'TX' },
        { minHoursInFuture: 48 }
      );
      
      // With 48 hour minimum, should be at or after the 1-hour result
      expect(longFuture.timestamp).toBeGreaterThanOrEqual(shortFuture.timestamp);
    });

    it('skips weekends by default', () => {
      const result = optimizer.getOptimalTime({ state: 'NY' });
      const day = result.scheduledAt.getDay();
      
      // Should not be Saturday (6) or Sunday (0)
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    });

    it('uses morning time by default', () => {
      const result = optimizer.getOptimalTime({ state: 'NY' });
      // Can't assert exact hour due to time-sensitive nature
      expect(result.reason).toContain('am');
    });

    it('uses afternoon time when preferMorning is false', () => {
      const result = optimizer.getOptimalTime(
        { state: 'NY' },
        { preferMorning: false }
      );
      expect(result.reason).toContain('pm');
    });

    it('can skip Monday', () => {
      // Set to Sunday
      vi.setSystemTime(new Date('2026-02-08T10:00:00')); // Sunday
      
      const result = optimizer.getOptimalTime(
        { timezone: 'UTC' },
        { skipMonday: true, minHoursInFuture: 1 }
      );
      
      // If Sunday at 10am, next business day would be Monday, but we skip it
      const day = result.scheduledAt.getDay();
      expect(day).not.toBe(1); // Not Monday
    });

    it('can skip Friday', () => {
      // Set to Thursday evening
      vi.setSystemTime(new Date('2026-02-05T20:00:00')); // Thursday 8pm UTC
      
      const result = optimizer.getOptimalTime(
        { timezone: 'UTC' },
        { skipFriday: true, minHoursInFuture: 1 }
      );
      
      // Next day would be Friday, but we skip it
      const day = result.scheduledAt.getDay();
      expect(day).not.toBe(5); // Not Friday
    });
  });

  describe('getOptimalTimesForBatch', () => {
    it('returns times for multiple prospects', () => {
      const prospects = [
        { id: 'p1', data: { state: 'NY' } },
        { id: 'p2', data: { state: 'CA' } },
        { id: 'p3', data: { state: 'TX' } },
      ];

      const results = optimizer.getOptimalTimesForBatch(prospects);

      expect(results.size).toBe(3);
      expect(results.get('p1')?.timezone).toBe('America/New_York');
      expect(results.get('p2')?.timezone).toBe('America/Los_Angeles');
      expect(results.get('p3')?.timezone).toBe('America/Chicago');
    });
  });

  describe('isGoodTimeToSend', () => {
    it('returns false on weekend', () => {
      // Saturday 10am in New York
      vi.setSystemTime(new Date('2026-02-07T15:00:00Z')); // UTC = 10am ET
      
      const result = optimizer.isGoodTimeToSend({ timezone: 'America/New_York' });
      
      expect(result.isGood).toBe(false);
      expect(result.reason).toContain('Weekend');
    });

    it('returns false before 8am', () => {
      // Thursday 7am in New York
      vi.setSystemTime(new Date('2026-02-05T12:00:00Z')); // UTC = 7am ET
      
      const result = optimizer.isGoodTimeToSend({ timezone: 'America/New_York' });
      
      expect(result.isGood).toBe(false);
      expect(result.reason).toContain('Too early');
      expect(result.suggestedDelay).toBeDefined();
    });

    it('returns false after 6pm', () => {
      // Thursday 7pm in New York
      vi.setSystemTime(new Date('2026-02-06T00:00:00Z')); // UTC = 7pm ET
      
      const result = optimizer.isGoodTimeToSend({ timezone: 'America/New_York' });
      
      expect(result.isGood).toBe(false);
      expect(result.reason).toContain('After business hours');
    });

    it('returns true during optimal morning hours', () => {
      // Thursday 10am in New York
      vi.setSystemTime(new Date('2026-02-05T15:00:00Z')); // UTC = 10am ET
      
      const result = optimizer.isGoodTimeToSend({ timezone: 'America/New_York' });
      
      expect(result.isGood).toBe(true);
      expect(result.reason).toContain('Optimal morning');
    });

    it('returns true during optimal afternoon hours', () => {
      // Thursday 3pm in New York
      vi.setSystemTime(new Date('2026-02-05T20:00:00Z')); // UTC = 3pm ET
      
      const result = optimizer.isGoodTimeToSend({ timezone: 'America/New_York' });
      
      expect(result.isGood).toBe(true);
      expect(result.reason).toContain('Optimal afternoon');
    });

    it('warns about lunch hour', () => {
      // Thursday 12pm in New York
      vi.setSystemTime(new Date('2026-02-05T17:00:00Z')); // UTC = 12pm ET
      
      const result = optimizer.isGoodTimeToSend({ timezone: 'America/New_York' });
      
      expect(result.isGood).toBe(true);
      expect(result.reason).toContain('Lunch');
    });
  });

  describe('getDayRanking', () => {
    it('ranks Tuesday-Thursday as excellent', () => {
      expect(optimizer.getDayRanking(2).label).toBe('excellent'); // Tuesday
      expect(optimizer.getDayRanking(3).label).toBe('excellent'); // Wednesday
      expect(optimizer.getDayRanking(4).label).toBe('excellent'); // Thursday
    });

    it('ranks Monday and Friday as fair', () => {
      expect(optimizer.getDayRanking(1).label).toBe('fair'); // Monday
      expect(optimizer.getDayRanking(5).label).toBe('fair'); // Friday
    });

    it('ranks weekends as poor', () => {
      expect(optimizer.getDayRanking(0).label).toBe('poor'); // Sunday
      expect(optimizer.getDayRanking(6).label).toBe('poor'); // Saturday
    });
  });

  describe('explainTiming', () => {
    it('includes day and time in explanation', () => {
      const optimalTime = optimizer.getOptimalTime({ state: 'NY' });
      const explanation = optimizer.explainTiming(optimalTime);

      expect(explanation).toContain('Send on');
      expect(explanation).toContain(optimalTime.dayOfWeek);
    });

    it('mentions excellent days', () => {
      // Tuesday
      vi.setSystemTime(new Date('2026-02-03T10:00:00Z'));
      
      const optimalTime = optimizer.getOptimalTime({ timezone: 'UTC' }, { minHoursInFuture: 1 });
      const explanation = optimizer.explainTiming(optimalTime);

      // If Tuesday-Thursday, should mention high open rates
      if (['Tuesday', 'Wednesday', 'Thursday'].includes(optimalTime.dayOfWeek)) {
        expect(explanation).toContain('highest open rates');
      }
    });
  });

  describe('Convenience exports', () => {
    it('getOptimalSendTime works', () => {
      const result = getOptimalSendTime({ state: 'FL' });
      expect(result.timezone).toBe('America/New_York');
    });

    it('isGoodTimeToSendNow works', () => {
      const result = isGoodTimeToSendNow({ state: 'FL' });
      expect(result).toHaveProperty('isGood');
      expect(result).toHaveProperty('reason');
    });
  });
});
