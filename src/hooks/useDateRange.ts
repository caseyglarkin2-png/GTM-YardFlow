/**
 * useDateRange Hook
 * Sprint 46 - T46.1
 * 
 * Extracted date range logic from App.tsx to eliminate duplication
 * Supports both nullable (hitlist) and required (dashboard) date range patterns
 */

import { useMemo, useState, useCallback } from 'react';

export type TimePeriod = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UseDateRangeOptions {
  /**
   * If true, returns null for 'all' period (hitlist behavior)
   * If false, 'all' is treated as 'month' (dashboard behavior)
   */
  allowNull?: boolean;
  
  /**
   * If true, sets end time to 23:59:59 (dashboard behavior)
   * If false, uses current time (hitlist behavior)
   */
  setEndOfDay?: boolean;
  
  /**
   * Initial period
   */
  initialPeriod?: TimePeriod;
  
  /**
   * Initial custom range (only used if initialPeriod is 'custom')
   */
  initialCustomRange?: DateRange;
}

export interface UseDateRangeReturn {
  /**
   * Current period selection
   */
  period: TimePeriod;
  
  /**
   * Set the period (will clear custom range if not 'custom')
   */
  setPeriod: (period: TimePeriod) => void;
  
  /**
   * Custom date range (only set when period is 'custom')
   */
  customRange: DateRange | undefined;
  
  /**
   * Set custom range (automatically sets period to 'custom')
   */
  setCustomRange: (range: DateRange | undefined) => void;
  
  /**
   * Computed date range based on period and custom range
   * Returns null if allowNull=true and period='all'
   */
  dateRange: DateRange | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hook for managing date range selection with computed ranges
 * 
 * @example
 * // Hitlist pattern (nullable, uses current time)
 * const { period, setPeriod, dateRange } = useDateRange({ allowNull: true });
 * 
 * @example
 * // Dashboard pattern (required, end of day)
 * const { period, setPeriod, dateRange } = useDateRange({ 
 *   allowNull: false, 
 *   setEndOfDay: true,
 *   initialPeriod: 'month' 
 * });
 */
export function useDateRange(options: UseDateRangeOptions = {}): UseDateRangeReturn {
  const {
    allowNull = false,
    setEndOfDay = false,
    initialPeriod = allowNull ? 'all' : 'month',
    initialCustomRange,
  } = options;

  const [period, setPeriodState] = useState<TimePeriod>(initialPeriod);
  const [customRange, setCustomRangeState] = useState<DateRange | undefined>(initialCustomRange);

  const setPeriod = useCallback((newPeriod: TimePeriod) => {
    setPeriodState(newPeriod);
    if (newPeriod !== 'custom') {
      setCustomRangeState(undefined);
    }
  }, []);

  const setCustomRange = useCallback((range: DateRange | undefined) => {
    setCustomRangeState(range);
    if (range) {
      setPeriodState('custom');
    }
  }, []);

  const dateRange = useMemo((): DateRange | null => {
    // Handle custom range
    if (period === 'custom' && customRange) {
      return { start: customRange.start, end: customRange.end };
    }

    // Handle 'all' period
    if (period === 'all') {
      if (allowNull) {
        return null;
      }
      // Fall through to default (month)
    }

    const now = new Date();
    let start: Date;
    let end: Date;

    if (setEndOfDay) {
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else {
      end = now;
    }

    switch (period) {
      case 'today':
        if (setEndOfDay) {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else {
          start = new Date(now.getTime() - 1 * DAY_MS);
        }
        break;
      case 'week':
        if (setEndOfDay) {
          start = new Date(now);
          start.setDate(start.getDate() - 7);
        } else {
          start = new Date(now.getTime() - 7 * DAY_MS);
        }
        break;
      case 'month':
      case 'all': // 'all' falls through to month when not nullable
        if (setEndOfDay) {
          start = new Date(now);
          start.setMonth(start.getMonth() - 1);
        } else {
          start = new Date(now.getTime() - 30 * DAY_MS);
        }
        break;
      case 'quarter':
        if (setEndOfDay) {
          start = new Date(now);
          start.setMonth(start.getMonth() - 3);
        } else {
          start = new Date(now.getTime() - 90 * DAY_MS);
        }
        break;
      case 'year':
        if (setEndOfDay) {
          start = new Date(now);
          start.setFullYear(start.getFullYear() - 1);
        } else {
          start = new Date(now.getTime() - 365 * DAY_MS);
        }
        break;
      default:
        start = new Date(now.getTime() - 30 * DAY_MS);
    }

    return { start, end };
  }, [period, customRange, allowNull, setEndOfDay]);

  return {
    period,
    setPeriod,
    customRange,
    setCustomRange,
    dateRange,
  };
}

export default useDateRange;
