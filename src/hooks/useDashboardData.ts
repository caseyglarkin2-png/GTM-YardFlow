/**
 * useDashboardData Hook
 * Sprint 28B - T28B.8
 * Sprint 35 - T35.0 - Wire to AnalyticsAggregator
 * 
 * Connects dashboard to live data via AnalyticsAggregator.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AnalyticsAggregator } from '../services/AnalyticsAggregator';
import type {
  DateRange,
  KPIMetric,
  FunnelData,
  ActivityMetrics,
  PipelineMetrics,
  TeamMetrics,
} from '../types/analytics';

export interface DashboardData {
  kpis: KPIMetric[];
  funnel: FunnelData | null;
  activities: ActivityMetrics | null;
  pipeline: PipelineMetrics | null;
  team: TeamMetrics | null;
}

export interface UseDashboardDataResult {
  data: DashboardData;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  lastUpdated: Date | null;
}

export interface UseDashboardDataOptions {
  cacheTtl?: number; // milliseconds, default 60000 (1 minute)
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  aggregator?: AnalyticsAggregator | null; // Optional real analytics aggregator
}

const EMPTY_DATA: DashboardData = {
  kpis: [],
  funnel: null,
  activities: null,
  pipeline: null,
  team: null,
};

// Simple in-memory cache
const cache = new Map<string, { data: DashboardData; timestamp: number }>();

function getCacheKey(dateRange: DateRange, useAggregator: boolean): string {
  const source = useAggregator ? 'agg' : 'mock';
  return `${source}:${dateRange.start.toISOString()}-${dateRange.end.toISOString()}`;
}

export function useDashboardData(
  dateRange: DateRange,
  options: UseDashboardDataOptions = {}
): UseDashboardDataResult {
  const {
    cacheTtl = 60000,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
    aggregator = null,
  } = options;

  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (skipCache = false) => {
    const cacheKey = getCacheKey(dateRange, !!aggregator);
    
    // Check cache first
    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTtl) {
        setData(cached.data);
        setIsLoading(false);
        setLastUpdated(new Date(cached.timestamp));
        return;
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      let newData: DashboardData;
      
      if (aggregator) {
        // Use real AnalyticsAggregator for live data
        const kpisData = aggregator.getKPIs(dateRange);
        const funnelData = aggregator.getFunnelData(dateRange);
        const activityData = aggregator.getActivityMetrics(dateRange);
        const pipelineData = aggregator.getPipelineMetrics(dateRange);
        const teamData = aggregator.getTeamMetrics(dateRange);
        
        // Convert aggregator KPIs format to KPIMetric[] format
        const kpis: KPIMetric[] = [
          { id: 'total-prospects', name: 'Total Prospects', value: kpisData.totalProspects, format: 'number' },
          { id: 'pipeline-value', name: 'Pipeline Value', value: kpisData.pipelineValue, format: 'currency' },
          { id: 'win-rate', name: 'Win Rate', value: kpisData.winRate, format: 'percent' },
          { id: 'avg-deal-size', name: 'Avg Deal Size', value: kpisData.avgDealSize, format: 'currency' },
          { id: 'active-deals', name: 'Active Deals', value: kpisData.activeDeals, format: 'number' },
          { id: 'activities', name: 'Activities', value: kpisData.activitiesThisPeriod, format: 'number' },
        ];
        
        newData = {
          kpis,
          funnel: funnelData,
          activities: activityData,
          pipeline: pipelineData,
          team: teamData,
        };
      } else {
        // Use mock data for demo mode
        const [kpis, funnel, activities, pipeline, team] = await Promise.all([
          fetchKPIs(dateRange),
          fetchFunnelData(dateRange),
          fetchActivityMetrics(dateRange),
          fetchPipelineMetrics(dateRange),
          fetchTeamMetrics(dateRange),
        ]);

        newData = {
          kpis,
          funnel,
          activities,
          pipeline,
          team,
        };
      }

      // Update cache
      cache.set(cacheKey, { data: newData, timestamp: Date.now() });

      setData(newData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore abort errors
      }
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, cacheTtl, aggregator]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Fetch on mount and when dateRange changes
  useEffect(() => {
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchData(true);
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    lastUpdated,
  };
}

// Data fetching functions (would integrate with AnalyticsAggregator in production)
async function fetchKPIs(_dateRange: DateRange): Promise<KPIMetric[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return [
    {
      id: 'total-prospects',
      name: 'Total Prospects',
      value: { current: 1250, previous: 1100, change: 150, changePercent: 13.6, trend: 'up' },
      format: 'number',
    },
    {
      id: 'pipeline-value',
      name: 'Pipeline Value',
      value: { current: 2500000, previous: 2100000, change: 400000, changePercent: 19.0, trend: 'up' },
      format: 'currency',
    },
    {
      id: 'conversion-rate',
      name: 'Conversion Rate',
      value: { current: 12.5, previous: 11.2, change: 1.3, changePercent: 11.6, trend: 'up' },
      format: 'percent',
    },
    {
      id: 'avg-deal-size',
      name: 'Avg Deal Size',
      value: { current: 45000, previous: 42000, change: 3000, changePercent: 7.1, trend: 'up' },
      format: 'currency',
    },
  ];
}

async function fetchFunnelData(dateRange: DateRange): Promise<FunnelData> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    stages: [
      { id: 'lead', name: 'Leads', count: 1000, value: 500000, conversionRate: 100, avgTimeInStage: 5, color: '#3B82F6' },
      { id: 'qualified', name: 'Qualified', count: 500, value: 300000, conversionRate: 50, avgTimeInStage: 7, color: '#10B981' },
      { id: 'proposal', name: 'Proposal', count: 200, value: 150000, conversionRate: 40, avgTimeInStage: 10, color: '#F59E0B' },
      { id: 'closed', name: 'Closed', count: 80, value: 100000, conversionRate: 40, avgTimeInStage: 3, color: '#EF4444' },
    ],
    totalConversionRate: 8,
    avgCycleTime: 25,
    period: dateRange,
  };
}

async function fetchActivityMetrics(_dateRange: DateRange): Promise<ActivityMetrics> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    byType: [
      { type: 'email_sent', count: 1500, label: 'Emails Sent' },
      { type: 'call_made', count: 450, label: 'Calls Made' },
      { type: 'meeting_scheduled', count: 120, label: 'Meetings Scheduled' },
      { type: 'linkedin_message', count: 380, label: 'LinkedIn Messages' },
    ],
    trend: [],
    totalActivities: 2450,
    avgPerDay: 81.7,
    topPerformers: [],
  };
}

async function fetchPipelineMetrics(_dateRange: DateRange): Promise<PipelineMetrics> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    totalValue: 2500000,
    totalDeals: 156,
    avgDealSize: 16025,
    winRate: 32,
    lossRate: 18,
    avgCycleTime: 45,
    byStage: [],
    trend: [],
  };
}

async function fetchTeamMetrics(dateRange: DateRange): Promise<TeamMetrics> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    totalMembers: 8,
    activeMembers: 7,
    totalActivities: 2450,
    leaderboard: [
      { userId: '1', userName: 'Sarah Johnson', totalActivities: 420, prospectsContacted: 85, dealsCreated: 12, dealsWon: 4, revenue: 180000, avgResponseTime: 2.5, rank: 1 },
      { userId: '2', userName: 'Mike Chen', totalActivities: 380, prospectsContacted: 72, dealsCreated: 10, dealsWon: 3, revenue: 135000, avgResponseTime: 3.2, rank: 2 },
      { userId: '3', userName: 'Emily Davis', totalActivities: 350, prospectsContacted: 68, dealsCreated: 9, dealsWon: 3, revenue: 120000, avgResponseTime: 2.8, rank: 3 },
    ],
    period: dateRange,
  };
}
