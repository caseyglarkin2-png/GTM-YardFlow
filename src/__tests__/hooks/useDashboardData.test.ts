/**
 * useDashboardData Hook Tests
 * Sprint 28B - T28B.8
 * Sprint 35 - T35.0 - Added aggregator integration tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from '../../hooks/useDashboardData';
import type { DateRange } from '../../types/analytics';
import type { AnalyticsAggregator } from '../../services/AnalyticsAggregator';

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

  describe('aggregator integration', () => {
    const mockKPIs = {
      totalProspects: { current: 100, previous: 80, change: 20, changePercent: 25, trend: 'up' as const },
      activeDeals: { current: 50, previous: 45, change: 5, changePercent: 11, trend: 'up' as const },
      pipelineValue: { current: 500000, previous: 400000, change: 100000, changePercent: 25, trend: 'up' as const },
      winRate: { current: 30, previous: 25, change: 5, changePercent: 20, trend: 'up' as const },
      avgDealSize: { current: 10000, previous: 9000, change: 1000, changePercent: 11, trend: 'up' as const },
      activitiesThisPeriod: { current: 200, previous: 150, change: 50, changePercent: 33, trend: 'up' as const },
    };

    const mockFunnelData = {
      stages: [{ id: 'new', name: 'New', count: 100, value: 100000, conversionRate: 100, avgTimeInStage: 5, color: '#3B82F6' }],
      totalConversionRate: 10,
      avgCycleTime: 30,
      period: mockDateRange,
    };

    const mockActivityMetrics = {
      byType: [{ type: 'email_sent' as const, count: 100, label: 'Emails Sent' }],
      trend: [],
      totalActivities: 100,
      avgPerDay: 10,
      topPerformers: [],
    };

    const mockPipelineMetrics = {
      totalValue: 500000,
      totalDeals: 50,
      avgDealSize: 10000,
      winRate: 30,
      lossRate: 20,
      avgCycleTime: 30,
      byStage: [],
      trend: [],
    };

    const mockTeamMetrics = {
      totalMembers: 5,
      activeMembers: 4,
      totalActivities: 200,
      leaderboard: [],
      period: mockDateRange,
    };

    let mockAggregator: AnalyticsAggregator;
    
    beforeEach(() => {
      mockAggregator = {
        getKPIs: vi.fn().mockReturnValue(mockKPIs),
        getFunnelData: vi.fn().mockReturnValue(mockFunnelData),
        getActivityMetrics: vi.fn().mockReturnValue(mockActivityMetrics),
        getPipelineMetrics: vi.fn().mockReturnValue(mockPipelineMetrics),
        getTeamMetrics: vi.fn().mockReturnValue(mockTeamMetrics),
        getDateRange: vi.fn(),
        getPreviousPeriod: vi.fn(),
        getConversionMetrics: vi.fn(),
        getSummary: vi.fn(),
        _calculateKPI: vi.fn(),
        _isInRange: vi.fn(),
      } as unknown as AnalyticsAggregator;
    });

    it('uses aggregator when provided', async () => {
      const { result } = renderHook(() => 
        useDashboardData(mockDateRange, { aggregator: mockAggregator })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(mockAggregator.getKPIs).toHaveBeenCalledWith(mockDateRange);
      expect(mockAggregator.getFunnelData).toHaveBeenCalledWith(mockDateRange);
      expect(mockAggregator.getActivityMetrics).toHaveBeenCalledWith(mockDateRange);
      expect(mockAggregator.getPipelineMetrics).toHaveBeenCalledWith(mockDateRange);
      expect(mockAggregator.getTeamMetrics).toHaveBeenCalledWith(mockDateRange);
    });

    it('converts aggregator KPIs to KPIMetric array format', async () => {
      const { result } = renderHook(() => 
        useDashboardData(mockDateRange, { aggregator: mockAggregator })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      const kpis = result.current.data.kpis;
      expect(kpis.length).toBeGreaterThan(0);
      expect(kpis.find(k => k.id === 'total-prospects')).toBeDefined();
      expect(kpis.find(k => k.id === 'pipeline-value')).toBeDefined();
      expect(kpis.find(k => k.id === 'win-rate')).toBeDefined();
    });

    it('returns funnel data from aggregator', async () => {
      const { result } = renderHook(() => 
        useDashboardData(mockDateRange, { aggregator: mockAggregator })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.data.funnel).toEqual(mockFunnelData);
    });

    it('returns activity metrics from aggregator', async () => {
      const { result } = renderHook(() => 
        useDashboardData(mockDateRange, { aggregator: mockAggregator })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 2000 });

      expect(result.current.data.activities).toEqual(mockActivityMetrics);
    });
  });
});
