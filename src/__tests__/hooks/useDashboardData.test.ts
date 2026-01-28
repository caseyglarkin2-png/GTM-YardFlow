/**
 * useDashboardData Hook Tests
 * Sprint 28B - T28B.8
 */

import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from '../../hooks/useDashboardData';
import type { DateRange } from '../../types/analytics';

describe('useDashboardData', () => {
  const mockDateRange: DateRange = {
    start: new Date('2026-01-01'),
    end: new Date('2026-01-31'),
  };

  describe('initial state', () => {
    it('returns loading state initially', () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('returns empty data initially', () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));
      
      expect(result.current.data.kpis).toEqual([]);
      expect(result.current.data.funnel).toBeNull();
      expect(result.current.data.activities).toBeNull();
      expect(result.current.data.pipeline).toBeNull();
      expect(result.current.data.team).toBeNull();
    });

    it('lastUpdated is null initially', () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));
      
      expect(result.current.lastUpdated).toBeNull();
    });

    it('provides refetch function', () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));
      
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('data fetching', () => {
    it('fetches data and updates state', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.data.kpis.length).toBeGreaterThan(0);
      expect(result.current.data.funnel).not.toBeNull();
      expect(result.current.data.activities).not.toBeNull();
      expect(result.current.data.pipeline).not.toBeNull();
      expect(result.current.data.team).not.toBeNull();
    });

    it('sets lastUpdated after fetch', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });

    it('clears error after successful fetch', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.error).toBeNull();
    });
  });

  describe('KPI data structure', () => {
    it('returns properly structured KPI metrics', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      const kpis = result.current.data.kpis;
      expect(kpis.length).toBeGreaterThan(0);
      
      const firstKpi = kpis[0];
      expect(firstKpi).toHaveProperty('id');
      expect(firstKpi).toHaveProperty('name');
      expect(firstKpi).toHaveProperty('value');
      expect(firstKpi).toHaveProperty('format');
      expect(firstKpi.value).toHaveProperty('current');
      expect(firstKpi.value).toHaveProperty('previous');
      expect(firstKpi.value).toHaveProperty('change');
      expect(firstKpi.value).toHaveProperty('changePercent');
      expect(firstKpi.value).toHaveProperty('trend');
    });
  });

  describe('funnel data structure', () => {
    it('returns properly structured funnel data', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      const funnel = result.current.data.funnel;
      expect(funnel).not.toBeNull();
      expect(funnel!.stages.length).toBeGreaterThan(0);
      expect(funnel).toHaveProperty('totalConversionRate');
      expect(funnel).toHaveProperty('avgCycleTime');
      expect(funnel).toHaveProperty('period');
    });
  });

  describe('team data structure', () => {
    it('returns properly structured team metrics', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      const team = result.current.data.team;
      expect(team).not.toBeNull();
      expect(team).toHaveProperty('totalMembers');
      expect(team).toHaveProperty('activeMembers');
      expect(team).toHaveProperty('leaderboard');
      expect(team!.leaderboard.length).toBeGreaterThan(0);
    });
  });

  describe('activities data structure', () => {
    it('returns properly structured activity metrics', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      const activities = result.current.data.activities;
      expect(activities).not.toBeNull();
      expect(activities).toHaveProperty('byType');
      expect(activities).toHaveProperty('totalActivities');
      expect(activities).toHaveProperty('avgPerDay');
    });
  });

  describe('pipeline data structure', () => {
    it('returns properly structured pipeline metrics', async () => {
      const { result } = renderHook(() => useDashboardData(mockDateRange));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      const pipeline = result.current.data.pipeline;
      expect(pipeline).not.toBeNull();
      expect(pipeline).toHaveProperty('totalValue');
      expect(pipeline).toHaveProperty('totalDeals');
      expect(pipeline).toHaveProperty('avgDealSize');
      expect(pipeline).toHaveProperty('winRate');
    });
  });
});
