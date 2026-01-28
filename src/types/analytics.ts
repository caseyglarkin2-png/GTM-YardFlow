/**
 * Analytics Types
 * Sprint 28 - T28.1
 * 
 * Type definitions for analytics dashboard metrics and aggregations.
 */

import { z } from 'zod';

// =============================================================================
// Time Period Types
// =============================================================================

export type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export const DateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

// =============================================================================
// KPI Types
// =============================================================================

export interface KPIValue {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'flat';
}

export interface KPIMetric {
  id: string;
  name: string;
  value: KPIValue;
  format: 'number' | 'currency' | 'percent' | 'duration';
  icon?: string;
  color?: string;
}

export const KPIValueSchema = z.object({
  current: z.number(),
  previous: z.number(),
  change: z.number(),
  changePercent: z.number(),
  trend: z.enum(['up', 'down', 'flat']),
});

// =============================================================================
// Funnel Types
// =============================================================================

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  value: number;
  conversionRate: number;
  avgTimeInStage: number; // days
  color: string;
}

export interface FunnelData {
  stages: FunnelStage[];
  totalConversionRate: number;
  avgCycleTime: number; // days
  period: DateRange;
}

export const FunnelStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number(),
  value: z.number(),
  conversionRate: z.number(),
  avgTimeInStage: z.number(),
  color: z.string(),
});

// =============================================================================
// Activity Types
// =============================================================================

export type ActivityType = 
  | 'email_sent'
  | 'email_opened'
  | 'email_replied'
  | 'call_made'
  | 'meeting_scheduled'
  | 'meeting_completed'
  | 'linkedin_message'
  | 'note_added'
  | 'status_changed'
  | 'deal_created';

export interface ActivityCount {
  type: ActivityType;
  count: number;
  label: string;
}

export interface ActivityTrend {
  date: string; // ISO date
  activities: Record<ActivityType, number>;
  total: number;
}

export interface ActivityMetrics {
  byType: ActivityCount[];
  trend: ActivityTrend[];
  totalActivities: number;
  avgPerDay: number;
  topPerformers: UserActivitySummary[];
}

// =============================================================================
// User/Team Types
// =============================================================================

export interface UserActivitySummary {
  userId: string;
  userName: string;
  userAvatar?: string;
  totalActivities: number;
  prospectsContacted: number;
  dealsCreated: number;
  dealsWon: number;
  revenue: number;
  avgResponseTime: number; // hours
  rank: number;
}

export interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  totalActivities: number;
  leaderboard: UserActivitySummary[];
  period: DateRange;
}

export const UserActivitySummarySchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userAvatar: z.string().optional(),
  totalActivities: z.number(),
  prospectsContacted: z.number(),
  dealsCreated: z.number(),
  dealsWon: z.number(),
  revenue: z.number(),
  avgResponseTime: z.number(),
  rank: z.number(),
});

// =============================================================================
// Pipeline Types
// =============================================================================

export interface PipelineMetrics {
  totalValue: number;
  totalDeals: number;
  avgDealSize: number;
  winRate: number;
  lossRate: number;
  avgCycleTime: number;
  byStage: StageMetrics[];
  trend: PipelineTrend[];
}

export interface StageMetrics {
  stageId: string;
  stageName: string;
  count: number;
  value: number;
  avgAge: number;
  staleCount: number; // deals older than threshold
}

export interface PipelineTrend {
  date: string;
  totalValue: number;
  newDeals: number;
  closedWon: number;
  closedLost: number;
}

// =============================================================================
// Conversion Types
// =============================================================================

export interface ConversionMetrics {
  leadToOpportunity: number;
  opportunityToProposal: number;
  proposalToClose: number;
  overallConversion: number;
  bySource: SourceConversion[];
  bySegment: SegmentConversion[];
}

export interface SourceConversion {
  source: string;
  leads: number;
  conversions: number;
  rate: number;
  revenue: number;
}

export interface SegmentConversion {
  segment: string;
  leads: number;
  conversions: number;
  rate: number;
  avgDealSize: number;
}

// =============================================================================
// Chart Data Types
// =============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface BarChartData {
  categories: string[];
  series: {
    name: string;
    data: number[];
    color?: string;
  }[];
}

export interface LineChartData {
  series: {
    name: string;
    data: TimeSeriesPoint[];
    color?: string;
  }[];
}

export interface PieChartData {
  data: ChartDataPoint[];
  total: number;
}

// =============================================================================
// Dashboard Configuration
// =============================================================================

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'funnel' | 'bar' | 'line' | 'pie' | 'leaderboard' | 'table';
  title: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  position: { row: number; col: number };
  config: Record<string, unknown>;
}

export interface DashboardConfig {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  defaultPeriod: TimePeriod;
  refreshInterval: number; // seconds, 0 = manual
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Aggregation Result Types
// =============================================================================

export interface AnalyticsSummary {
  kpis: {
    totalProspects: KPIValue;
    activeDeals: KPIValue;
    pipelineValue: KPIValue;
    winRate: KPIValue;
    avgDealSize: KPIValue;
    activitiesThisPeriod: KPIValue;
  };
  funnel: FunnelData;
  activities: ActivityMetrics;
  pipeline: PipelineMetrics;
  conversions: ConversionMetrics;
  team: TeamMetrics;
  period: DateRange;
  generatedAt: string;
}

export const AnalyticsSummarySchema = z.object({
  kpis: z.object({
    totalProspects: KPIValueSchema,
    activeDeals: KPIValueSchema,
    pipelineValue: KPIValueSchema,
    winRate: KPIValueSchema,
    avgDealSize: KPIValueSchema,
    activitiesThisPeriod: KPIValueSchema,
  }),
  period: DateRangeSchema,
  generatedAt: z.string(),
});

// =============================================================================
// Export Types
// =============================================================================

export interface DashboardExportOptions {
  format: 'png' | 'pdf' | 'csv';
  includeCharts: boolean;
  includeRawData: boolean;
  period: DateRange;
  widgets?: string[]; // specific widget IDs, or all if empty
}
