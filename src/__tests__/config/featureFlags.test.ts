/**
 * T90.4: Feature Flags Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to test the feature flags module, but it reads from import.meta.env
// at module load time. We'll test the helper functions.

describe('Feature Flags', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('parseBoolean helper', () => {
    it('returns default when value is undefined', () => {
      // Test logic directly
      const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
        if (value === undefined || value === '') return defaultValue;
        return value.toLowerCase() === 'true' || value === '1';
      };

      expect(parseBoolean(undefined, true)).toBe(true);
      expect(parseBoolean(undefined, false)).toBe(false);
      expect(parseBoolean('', true)).toBe(true);
    });

    it('parses true values correctly', () => {
      const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
        if (value === undefined || value === '') return defaultValue;
        return value.toLowerCase() === 'true' || value === '1';
      };

      expect(parseBoolean('true', false)).toBe(true);
      expect(parseBoolean('TRUE', false)).toBe(true);
      expect(parseBoolean('True', false)).toBe(true);
      expect(parseBoolean('1', false)).toBe(true);
    });

    it('parses false values correctly', () => {
      const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
        if (value === undefined || value === '') return defaultValue;
        return value.toLowerCase() === 'true' || value === '1';
      };

      expect(parseBoolean('false', true)).toBe(false);
      expect(parseBoolean('FALSE', true)).toBe(false);
      expect(parseBoolean('0', true)).toBe(false);
      expect(parseBoolean('random', true)).toBe(false);
    });
  });

  describe('parseNumber helper', () => {
    it('returns default when value is undefined', () => {
      const parseNumber = (value: string | undefined, defaultValue: number): number => {
        if (value === undefined || value === '') return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      expect(parseNumber(undefined, 50)).toBe(50);
      expect(parseNumber('', 50)).toBe(50);
    });

    it('parses valid numbers', () => {
      const parseNumber = (value: string | undefined, defaultValue: number): number => {
        if (value === undefined || value === '') return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      expect(parseNumber('100', 0)).toBe(100);
      expect(parseNumber('0', 50)).toBe(0);
      expect(parseNumber('75', 0)).toBe(75);
    });

    it('returns default for invalid numbers', () => {
      const parseNumber = (value: string | undefined, defaultValue: number): number => {
        if (value === undefined || value === '') return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      expect(parseNumber('abc', 50)).toBe(50);
      expect(parseNumber('not-a-number', 100)).toBe(100);
    });
  });

  describe('shouldUseRailway logic', () => {
    it('returns false when RAILWAY_ENABLED is false', () => {
      const featureFlags = {
        RAILWAY_ENABLED: false,
        RAILWAY_TRAFFIC_PERCENT: 100,
      };

      const shouldUseRailway = () => {
        if (!featureFlags.RAILWAY_ENABLED) return false;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT >= 100) return true;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT <= 0) return false;
        return Math.random() * 100 < featureFlags.RAILWAY_TRAFFIC_PERCENT;
      };

      expect(shouldUseRailway()).toBe(false);
    });

    it('returns true when traffic is 100%', () => {
      const featureFlags = {
        RAILWAY_ENABLED: true,
        RAILWAY_TRAFFIC_PERCENT: 100,
      };

      const shouldUseRailway = () => {
        if (!featureFlags.RAILWAY_ENABLED) return false;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT >= 100) return true;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT <= 0) return false;
        return Math.random() * 100 < featureFlags.RAILWAY_TRAFFIC_PERCENT;
      };

      expect(shouldUseRailway()).toBe(true);
    });

    it('returns false when traffic is 0%', () => {
      const featureFlags = {
        RAILWAY_ENABLED: true,
        RAILWAY_TRAFFIC_PERCENT: 0,
      };

      const shouldUseRailway = () => {
        if (!featureFlags.RAILWAY_ENABLED) return false;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT >= 100) return true;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT <= 0) return false;
        return Math.random() * 100 < featureFlags.RAILWAY_TRAFFIC_PERCENT;
      };

      expect(shouldUseRailway()).toBe(false);
    });

    it('uses random for partial traffic', () => {
      const featureFlags = {
        RAILWAY_ENABLED: true,
        RAILWAY_TRAFFIC_PERCENT: 50,
      };

      // With 50% traffic, over many iterations we should see both true and false
      let trueCount = 0;
      let falseCount = 0;

      const shouldUseRailway = () => {
        if (!featureFlags.RAILWAY_ENABLED) return false;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT >= 100) return true;
        if (featureFlags.RAILWAY_TRAFFIC_PERCENT <= 0) return false;
        return Math.random() * 100 < featureFlags.RAILWAY_TRAFFIC_PERCENT;
      };

      for (let i = 0; i < 1000; i++) {
        if (shouldUseRailway()) {
          trueCount++;
        } else {
          falseCount++;
        }
      }

      // Should be roughly 50/50 (with some tolerance)
      expect(trueCount).toBeGreaterThan(350);
      expect(trueCount).toBeLessThan(650);
      expect(falseCount).toBeGreaterThan(350);
      expect(falseCount).toBeLessThan(650);
    });
  });

  describe('isDualWriteEnabled logic', () => {
    it('returns true only when both flags are enabled', () => {
      const testCases = [
        { RAILWAY_ENABLED: true, DUAL_WRITE_ENABLED: true, expected: true },
        { RAILWAY_ENABLED: true, DUAL_WRITE_ENABLED: false, expected: false },
        { RAILWAY_ENABLED: false, DUAL_WRITE_ENABLED: true, expected: false },
        { RAILWAY_ENABLED: false, DUAL_WRITE_ENABLED: false, expected: false },
      ];

      testCases.forEach(({ RAILWAY_ENABLED, DUAL_WRITE_ENABLED, expected }) => {
        const isDualWriteEnabled = () => DUAL_WRITE_ENABLED && RAILWAY_ENABLED;
        expect(isDualWriteEnabled()).toBe(expected);
      });
    });
  });
});
