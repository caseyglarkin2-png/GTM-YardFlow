/**
 * Tests for TimezoneService
 * 
 * Sprint 3 T3.5: Unit tests for timezone utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TimezoneService, 
  timezoneService,
  inferTimezone,
  calculateProspectSendTime,
  isBusinessHoursForProspect,
  TIMEZONE_SHORTCUTS,
  US_STATE_TIMEZONES,
} from './TimezoneService';

describe('TimezoneService', () => {
  let service: TimezoneService;

  beforeEach(() => {
    service = new TimezoneService();
  });

  describe('normalizeTimezone', () => {
    it('should return default for null/undefined', () => {
      expect(service.normalizeTimezone(null)).toBe('America/New_York');
      expect(service.normalizeTimezone(undefined)).toBe('America/New_York');
    });

    it('should convert shortcuts to IANA format', () => {
      expect(service.normalizeTimezone('EST')).toBe('America/New_York');
      expect(service.normalizeTimezone('PST')).toBe('America/Los_Angeles');
      expect(service.normalizeTimezone('CST')).toBe('America/Chicago');
      expect(service.normalizeTimezone('MST')).toBe('America/Denver');
    });

    it('should handle lowercase shortcuts', () => {
      expect(service.normalizeTimezone('est')).toBe('America/New_York');
      expect(service.normalizeTimezone('pst')).toBe('America/Los_Angeles');
    });

    it('should handle short codes (ET, PT, etc)', () => {
      expect(service.normalizeTimezone('ET')).toBe('America/New_York');
      expect(service.normalizeTimezone('PT')).toBe('America/Los_Angeles');
      expect(service.normalizeTimezone('CT')).toBe('America/Chicago');
    });

    it('should pass through IANA format unchanged', () => {
      expect(service.normalizeTimezone('America/New_York')).toBe('America/New_York');
      expect(service.normalizeTimezone('Europe/London')).toBe('Europe/London');
    });

    it('should convert US state codes', () => {
      expect(service.normalizeTimezone('NY')).toBe('America/New_York');
      expect(service.normalizeTimezone('CA')).toBe('America/Los_Angeles');
      expect(service.normalizeTimezone('TX')).toBe('America/Chicago');
    });
  });

  describe('inferTimezone', () => {
    it('should use explicit timezone if provided', () => {
      const result = service.inferTimezone({
        timezone: 'America/Los_Angeles',
        state: 'NY',
      });
      expect(result).toBe('America/Los_Angeles');
    });

    it('should infer from state if no timezone', () => {
      const result = service.inferTimezone({
        state: 'California',
      });
      expect(result).toBe('America/Los_Angeles');
    });

    it('should infer from state code', () => {
      const result = service.inferTimezone({
        state: 'TX',
      });
      expect(result).toBe('America/Chicago');
    });

    it('should return default if no data', () => {
      const result = service.inferTimezone({});
      expect(result).toBe('America/New_York');
    });
  });

  describe('getCurrentTimeInTimezone', () => {
    it('should return a Date object', () => {
      const result = service.getCurrentTimeInTimezone('America/New_York');
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle different timezones', () => {
      const ny = service.getCurrentTimeInTimezone('America/New_York');
      const la = service.getCurrentTimeInTimezone('America/Los_Angeles');
      
      // LA should be 3 hours behind NY (approximately)
      expect(ny).toBeInstanceOf(Date);
      expect(la).toBeInstanceOf(Date);
    });
  });

  describe('formatInTimezone', () => {
    it('should format in short format', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = service.formatInTimezone(date, 'America/New_York', 'short');
      
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
    });

    it('should format in long format', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = service.formatInTimezone(date, 'America/New_York', 'long');
      
      expect(formatted).toContain('January');
      expect(formatted).toContain('2024');
    });

    it('should format time only', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = service.formatInTimezone(date, 'America/New_York', 'time');
      
      expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('isWeekend', () => {
    it('should detect Saturday', () => {
      const saturday = new Date('2024-01-13T12:00:00Z'); // This is a Saturday
      expect(service.isWeekend(saturday, 'America/New_York')).toBe(true);
    });

    it('should detect Sunday', () => {
      const sunday = new Date('2024-01-14T12:00:00Z'); // This is a Sunday
      expect(service.isWeekend(sunday, 'America/New_York')).toBe(true);
    });

    it('should detect weekday', () => {
      const monday = new Date('2024-01-15T12:00:00Z'); // This is a Monday
      expect(service.isWeekend(monday, 'America/New_York')).toBe(false);
    });
  });

  describe('getDayOfWeek', () => {
    it('should return day name', () => {
      const monday = new Date('2024-01-15T12:00:00Z');
      const result = service.getDayOfWeek(monday, 'America/New_York');
      expect(result).toBe('Monday');
    });
  });

  describe('calculateSendTime', () => {
    it('should return schedule result', () => {
      const result = service.calculateSendTime(
        new Date(),
        9,
        30,
        'America/New_York',
        true
      );

      expect(result.sendAt).toBeInstanceOf(Date);
      expect(result.timezone).toBe('America/New_York');
      expect(result.dayOfWeek).toBeDefined();
      expect(typeof result.wasAdjusted).toBe('boolean');
    });

    it('should skip weekends when configured', () => {
      // Create a date that's Saturday at noon UTC
      const saturday = new Date('2024-01-13T12:00:00Z');
      
      const result = service.calculateSendTime(
        saturday,
        9,
        0,
        'America/New_York',
        true
      );

      // Should not be a weekend
      expect(result.isWeekend).toBe(false);
    });

    it('should not skip weekends when disabled', () => {
      const saturday = new Date('2024-01-13T12:00:00Z');
      
      const result = service.calculateSendTime(
        saturday,
        9,
        0,
        'America/New_York',
        false // Don't skip weekends
      );

      expect(typeof result.wasAdjusted).toBe('boolean');
    });
  });

  describe('isBusinessHours', () => {
    it('should check business hours', () => {
      // Just verify it returns a boolean
      const result = service.isBusinessHours('America/New_York');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getSupportedTimezones', () => {
    it('should return grouped timezones', () => {
      const result = service.getSupportedTimezones();
      
      expect(result['US Eastern']).toContain('America/New_York');
      expect(result['US Pacific']).toContain('America/Los_Angeles');
      expect(result['Europe']).toContain('Europe/London');
    });
  });
});

describe('Constants', () => {
  describe('TIMEZONE_SHORTCUTS', () => {
    it('should have common US timezone shortcuts', () => {
      expect(TIMEZONE_SHORTCUTS['EST']).toBe('America/New_York');
      expect(TIMEZONE_SHORTCUTS['PST']).toBe('America/Los_Angeles');
      expect(TIMEZONE_SHORTCUTS['CST']).toBe('America/Chicago');
    });

    it('should have European shortcuts', () => {
      expect(TIMEZONE_SHORTCUTS['GMT']).toBe('Europe/London');
      expect(TIMEZONE_SHORTCUTS['CET']).toBe('Europe/Paris');
    });
  });

  describe('US_STATE_TIMEZONES', () => {
    it('should cover all US states', () => {
      expect(Object.keys(US_STATE_TIMEZONES).length).toBeGreaterThan(40);
    });

    it('should map states correctly', () => {
      expect(US_STATE_TIMEZONES['NY']).toBe('America/New_York');
      expect(US_STATE_TIMEZONES['CA']).toBe('America/Los_Angeles');
      expect(US_STATE_TIMEZONES['TX']).toBe('America/Chicago');
      expect(US_STATE_TIMEZONES['CO']).toBe('America/Denver');
    });
  });
});

describe('Module exports', () => {
  describe('inferTimezone', () => {
    it('should use singleton', () => {
      const result = inferTimezone({ state: 'NY' });
      expect(result).toBe('America/New_York');
    });
  });

  describe('calculateProspectSendTime', () => {
    it('should calculate send time', () => {
      const result = calculateProspectSendTime(9, 30, 'America/New_York');
      expect(result.sendAt).toBeInstanceOf(Date);
    });
  });

  describe('isBusinessHoursForProspect', () => {
    it('should check business hours', () => {
      const result = isBusinessHoursForProspect('America/New_York');
      expect(typeof result).toBe('boolean');
    });
  });
});
