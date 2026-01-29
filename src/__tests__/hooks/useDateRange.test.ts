/**
 * useDateRange Hook Tests
 * Sprint 46 - T46.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDateRange, type TimePeriod, type DateRange } from '../../hooks/useDateRange';

describe('useDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Default Behavior', () => {
    it('should default to month period when allowNull is false', () => {
      const { result } = renderHook(() => useDateRange({ allowNull: false }));
      expect(result.current.period).toBe('month');
      expect(result.current.dateRange).not.toBeNull();
    });

    it('should default to all period when allowNull is true', () => {
      const { result } = renderHook(() => useDateRange({ allowNull: true }));
      expect(result.current.period).toBe('all');
      expect(result.current.dateRange).toBeNull();
    });
  });

  describe('Period Selection', () => {
    it('should update period when setPeriod is called', () => {
      const { result } = renderHook(() => useDateRange());
      
      act(() => {
        result.current.setPeriod('week');
      });
      
      expect(result.current.period).toBe('week');
    });

    it('should clear custom range when switching from custom to another period', () => {
      const { result } = renderHook(() => useDateRange({
        initialPeriod: 'custom',
        initialCustomRange: { start: new Date(), end: new Date() },
      }));
      
      expect(result.current.customRange).toBeDefined();
      
      act(() => {
        result.current.setPeriod('month');
      });
      
      expect(result.current.customRange).toBeUndefined();
    });
  });

  describe('Custom Range', () => {
    it('should set period to custom when setCustomRange is called', () => {
      const { result } = renderHook(() => useDateRange());
      const customRange = { start: new Date('2026-01-01'), end: new Date('2026-01-15') };
      
      act(() => {
        result.current.setCustomRange(customRange);
      });
      
      expect(result.current.period).toBe('custom');
      expect(result.current.dateRange).toEqual(customRange);
    });
  });

  describe('Nullable Behavior (Hitlist Pattern)', () => {
    it('should return null for all period when allowNull is true', () => {
      const { result } = renderHook(() => useDateRange({ allowNull: true }));
      
      act(() => {
        result.current.setPeriod('all');
      });
      
      expect(result.current.dateRange).toBeNull();
    });

    it('should return date range for other periods even when allowNull is true', () => {
      const { result } = renderHook(() => useDateRange({ allowNull: true }));
      
      act(() => {
        result.current.setPeriod('week');
      });
      
      expect(result.current.dateRange).not.toBeNull();
    });
  });

  describe('End of Day Behavior (Dashboard Pattern)', () => {
    it('should set end time to 23:59:59 when setEndOfDay is true', () => {
      const { result } = renderHook(() => useDateRange({ setEndOfDay: true }));
      
      const range = result.current.dateRange;
      expect(range).not.toBeNull();
      expect(range!.end.getHours()).toBe(23);
      expect(range!.end.getMinutes()).toBe(59);
      expect(range!.end.getSeconds()).toBe(59);
    });

    it('should use current time as end when setEndOfDay is false', () => {
      const { result } = renderHook(() => useDateRange({ setEndOfDay: false }));
      
      const range = result.current.dateRange;
      expect(range).not.toBeNull();
      // Current time is 12:00:00
      expect(range!.end.getHours()).toBe(12);
    });
  });

  describe('Date Range Calculations', () => {
    it('should calculate today range correctly', () => {
      const { result } = renderHook(() => useDateRange({ setEndOfDay: false }));
      
      act(() => {
        result.current.setPeriod('today');
      });
      
      const range = result.current.dateRange;
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      expect(range).not.toBeNull();
      expect(range!.start.getTime()).toBeCloseTo(dayAgo.getTime(), -3);
    });

    it('should calculate week range correctly', () => {
      const { result } = renderHook(() => useDateRange());
      
      act(() => {
        result.current.setPeriod('week');
      });
      
      const range = result.current.dateRange;
      expect(range).not.toBeNull();
      
      const diffDays = (range!.end.getTime() - range!.start.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('should calculate quarter range correctly', () => {
      const { result } = renderHook(() => useDateRange());
      
      act(() => {
        result.current.setPeriod('quarter');
      });
      
      const range = result.current.dateRange;
      expect(range).not.toBeNull();
      
      const diffDays = (range!.end.getTime() - range!.start.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(90, 0);
    });

    it('should calculate year range correctly', () => {
      const { result } = renderHook(() => useDateRange());
      
      act(() => {
        result.current.setPeriod('year');
      });
      
      const range = result.current.dateRange;
      expect(range).not.toBeNull();
      
      const diffDays = (range!.end.getTime() - range!.start.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(365, 0);
    });
  });

  describe('Initial Values', () => {
    it('should use initialPeriod when provided', () => {
      const { result } = renderHook(() => useDateRange({ initialPeriod: 'quarter' }));
      expect(result.current.period).toBe('quarter');
    });

    it('should use initialCustomRange when provided with custom period', () => {
      const customRange = { start: new Date('2026-01-01'), end: new Date('2026-01-15') };
      const { result } = renderHook(() => useDateRange({
        initialPeriod: 'custom',
        initialCustomRange: customRange,
      }));
      
      expect(result.current.period).toBe('custom');
      expect(result.current.customRange).toEqual(customRange);
      expect(result.current.dateRange).toEqual(customRange);
    });
  });
});
