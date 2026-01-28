/**
 * Analytics Aggregator Service
 * Sprint 28 - T28.1
 * 
 * Aggregates prospect, activity, and deal data into analytics metrics.
 */

import type {
  DateRange,
  TimePeriod,
  KPIValue,
  FunnelData,
  FunnelStage,
  ActivityMetrics,
  ActivityType,
  ActivityTrend,
  ActivityCount,
  PipelineMetrics,
  StageMetrics,
  PipelineTrend,
  ConversionMetrics,
  SourceConversion,
  SegmentConversion,
  TeamMetrics,
  UserActivitySummary,
  AnalyticsSummary,
} from '../types/analytics';

// =============================================================================
// Types for Data Sources
// =============================================================================

export interface ProspectData {
  id: string;
  status: string;
  source?: string;
  segment?: string;
  assignee?: string;
  dealValue?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  stageChanges?: { stage: string; timestamp: string }[];
}

export interface ActivityData {
  id: string;
  type: ActivityType;
  prospectId: string;
  userId: string;
  userName?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface UserData {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface AnalyticsAggregatorConfig {
  prospects: ProspectData[];
  activities: ActivityData[];
  users: UserData[];
  stageConfig?: StageConfig;
}

export interface StageConfig {
  stages: { id: string; name: string; color: string; order: number }[];
  wonStages: string[];
  lostStages: string[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_STAGE_CONFIG: StageConfig = {
  stages: [
    { id: 'new', name: 'New', color: '#6B7280', order: 0 },
    { id: 'contacted', name: 'Contacted', color: '#3B82F6', order: 1 },
    { id: 'qualified', name: 'Qualified', color: '#8B5CF6', order: 2 },
    { id: 'proposal', name: 'Proposal', color: '#F59E0B', order: 3 },
    { id: 'negotiation', name: 'Negotiation', color: '#EC4899', order: 4 },
    { id: 'won', name: 'Won', color: '#10B981', order: 5 },
    { id: 'lost', name: 'Lost', color: '#EF4444', order: 6 },
  ],
  wonStages: ['won', 'closed-won'],
  lostStages: ['lost', 'closed-lost'],
};

const FUNNEL_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // green
];

// =============================================================================
// Analytics Aggregator
// =============================================================================

export function createAnalyticsAggregator(config: AnalyticsAggregatorConfig) {
  const { prospects, activities, users, stageConfig = DEFAULT_STAGE_CONFIG } = config;

  // ==========================================================================
  // Date Utilities
  // ==========================================================================

  function getDateRange(period: TimePeriod, customRange?: DateRange): DateRange {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'custom':
        if (customRange) return customRange;
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'all':
      default:
        start = new Date(0);
        break;
    }

    return { start, end };
  }

  function getPreviousPeriod(range: DateRange): DateRange {
    const duration = range.end.getTime() - range.start.getTime();
    return {
      start: new Date(range.start.getTime() - duration),
      end: new Date(range.start.getTime() - 1),
    };
  }

  function isInRange(date: string | Date, range: DateRange): boolean {
    const d = new Date(date);
    return d >= range.start && d <= range.end;
  }

  // ==========================================================================
  // KPI Calculations
  // ==========================================================================

  function calculateKPI(current: number, previous: number): KPIValue {
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

    return {
      current,
      previous,
      change,
      changePercent: Math.round(changePercent * 10) / 10,
      trend,
    };
  }

  function getKPIs(range: DateRange): AnalyticsSummary['kpis'] {
    const prevRange = getPreviousPeriod(range);

    // Filter prospects
    const currentProspects = prospects.filter(p => isInRange(p.createdAt, range));
    const prevProspects = prospects.filter(p => isInRange(p.createdAt, prevRange));

    // Active deals (not won/lost)
    const activeStatuses = stageConfig.stages
      .filter(s => !stageConfig.wonStages.includes(s.id) && !stageConfig.lostStages.includes(s.id))
      .map(s => s.id);

    const currentActive = prospects.filter(
      p => activeStatuses.includes(p.status) && isInRange(p.updatedAt, range)
    );
    const prevActive = prospects.filter(
      p => activeStatuses.includes(p.status) && isInRange(p.updatedAt, prevRange)
    );

    // Pipeline value
    const currentValue = currentActive.reduce((sum, p) => sum + (p.dealValue || 0), 0);
    const prevValue = prevActive.reduce((sum, p) => sum + (p.dealValue || 0), 0);

    // Win rate
    const currentWon = prospects.filter(
      p => stageConfig.wonStages.includes(p.status) && p.closedAt && isInRange(p.closedAt, range)
    );
    const currentClosed = prospects.filter(
      p =>
        (stageConfig.wonStages.includes(p.status) || stageConfig.lostStages.includes(p.status)) &&
        p.closedAt &&
        isInRange(p.closedAt, range)
    );
    const prevWon = prospects.filter(
      p => stageConfig.wonStages.includes(p.status) && p.closedAt && isInRange(p.closedAt, prevRange)
    );
    const prevClosed = prospects.filter(
      p =>
        (stageConfig.wonStages.includes(p.status) || stageConfig.lostStages.includes(p.status)) &&
        p.closedAt &&
        isInRange(p.closedAt, prevRange)
    );

    const currentWinRate = currentClosed.length > 0 ? (currentWon.length / currentClosed.length) * 100 : 0;
    const prevWinRate = prevClosed.length > 0 ? (prevWon.length / prevClosed.length) * 100 : 0;

    // Avg deal size
    const currentAvgDeal = currentWon.length > 0
      ? currentWon.reduce((sum, p) => sum + (p.dealValue || 0), 0) / currentWon.length
      : 0;
    const prevAvgDeal = prevWon.length > 0
      ? prevWon.reduce((sum, p) => sum + (p.dealValue || 0), 0) / prevWon.length
      : 0;

    // Activities
    const currentActivities = activities.filter(a => isInRange(a.timestamp, range));
    const prevActivities = activities.filter(a => isInRange(a.timestamp, prevRange));

    return {
      totalProspects: calculateKPI(currentProspects.length, prevProspects.length),
      activeDeals: calculateKPI(currentActive.length, prevActive.length),
      pipelineValue: calculateKPI(currentValue, prevValue),
      winRate: calculateKPI(currentWinRate, prevWinRate),
      avgDealSize: calculateKPI(currentAvgDeal, prevAvgDeal),
      activitiesThisPeriod: calculateKPI(currentActivities.length, prevActivities.length),
    };
  }

  // ==========================================================================
  // Funnel Calculations
  // ==========================================================================

  function getFunnelData(range: DateRange): FunnelData {
    const relevantProspects = prospects.filter(p => isInRange(p.updatedAt, range));

    const stages: FunnelStage[] = stageConfig.stages
      .filter(s => !stageConfig.lostStages.includes(s.id))
      .sort((a, b) => a.order - b.order)
      .map((stage, index) => {
        const stageProspects = relevantProspects.filter(p => p.status === stage.id);
        const stageValue = stageProspects.reduce((sum, p) => sum + (p.dealValue || 0), 0);

        // Calculate avg time in stage
        const times = stageProspects
          .filter(p => p.stageChanges && p.stageChanges.length > 0)
          .map(p => {
            const stageEntry = p.stageChanges?.find(sc => sc.stage === stage.id);
            if (!stageEntry) return 0;
            const entryDate = new Date(stageEntry.timestamp);
            const now = new Date();
            return (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
          });
        const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

        return {
          id: stage.id,
          name: stage.name,
          count: stageProspects.length,
          value: stageValue,
          conversionRate: 0, // Calculated below
          avgTimeInStage: Math.round(avgTime * 10) / 10,
          color: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
        };
      });

    // Calculate conversion rates between stages
    for (let i = 0; i < stages.length - 1; i++) {
      if (stages[i].count > 0) {
        stages[i].conversionRate = Math.round((stages[i + 1].count / stages[i].count) * 100 * 10) / 10;
      }
    }

    // Overall conversion: first stage to won
    const wonStage = stages.find(s => stageConfig.wonStages.includes(s.id));
    const totalConversionRate = stages[0]?.count > 0 && wonStage
      ? Math.round((wonStage.count / stages[0].count) * 100 * 10) / 10
      : 0;

    // Avg cycle time
    const closedProspects = relevantProspects.filter(
      p => stageConfig.wonStages.includes(p.status) && p.closedAt
    );
    const cycleTimes = closedProspects.map(p => {
      const created = new Date(p.createdAt);
      const closed = new Date(p.closedAt!);
      return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    });
    const avgCycleTime = cycleTimes.length > 0
      ? Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10
      : 0;

    return {
      stages,
      totalConversionRate,
      avgCycleTime,
      period: range,
    };
  }

  // ==========================================================================
  // Activity Calculations
  // ==========================================================================

  function getActivityMetrics(range: DateRange): ActivityMetrics {
    const rangeActivities = activities.filter(a => isInRange(a.timestamp, range));

    // By type
    const typeCounts = new Map<ActivityType, number>();
    rangeActivities.forEach(a => {
      typeCounts.set(a.type, (typeCounts.get(a.type) || 0) + 1);
    });

    const byType: ActivityCount[] = Array.from(typeCounts.entries())
      .map(([type, count]) => ({
        type,
        count,
        label: formatActivityType(type),
      }))
      .sort((a, b) => b.count - a.count);

    // Trend (daily)
    const trendMap = new Map<string, Record<ActivityType, number>>();
    rangeActivities.forEach(a => {
      const date = a.timestamp.split('T')[0];
      if (!trendMap.has(date)) {
        trendMap.set(date, {} as Record<ActivityType, number>);
      }
      const dayData = trendMap.get(date)!;
      dayData[a.type] = (dayData[a.type] || 0) + 1;
    });

    const trend: ActivityTrend[] = Array.from(trendMap.entries())
      .map(([date, activities]) => ({
        date,
        activities,
        total: Object.values(activities).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Days in range
    const days = Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) || 1;

    // Top performers
    const userActivityMap = new Map<string, ActivityData[]>();
    rangeActivities.forEach(a => {
      if (!userActivityMap.has(a.userId)) {
        userActivityMap.set(a.userId, []);
      }
      userActivityMap.get(a.userId)!.push(a);
    });

    const topPerformers: UserActivitySummary[] = Array.from(userActivityMap.entries())
      .map(([userId, userActivities]) => {
        const user = users.find(u => u.id === userId);
        const prospectIds = new Set(userActivities.map(a => a.prospectId));
        
        return {
          userId,
          userName: user?.name || 'Unknown',
          userAvatar: user?.avatar,
          totalActivities: userActivities.length,
          prospectsContacted: prospectIds.size,
          dealsCreated: 0,
          dealsWon: 0,
          revenue: 0,
          avgResponseTime: 0,
          rank: 0,
        };
      })
      .sort((a, b) => b.totalActivities - a.totalActivities)
      .slice(0, 10)
      .map((user, index) => ({ ...user, rank: index + 1 }));

    return {
      byType,
      trend,
      totalActivities: rangeActivities.length,
      avgPerDay: Math.round((rangeActivities.length / days) * 10) / 10,
      topPerformers,
    };
  }

  // ==========================================================================
  // Pipeline Calculations
  // ==========================================================================

  function getPipelineMetrics(range: DateRange): PipelineMetrics {
    const activeStatuses = stageConfig.stages
      .filter(s => !stageConfig.wonStages.includes(s.id) && !stageConfig.lostStages.includes(s.id))
      .map(s => s.id);

    const activeProspects = prospects.filter(p => activeStatuses.includes(p.status));

    const totalValue = activeProspects.reduce((sum, p) => sum + (p.dealValue || 0), 0);
    const avgDealSize = activeProspects.length > 0 ? totalValue / activeProspects.length : 0;

    // Win/loss rates
    const closedInRange = prospects.filter(
      p =>
        (stageConfig.wonStages.includes(p.status) || stageConfig.lostStages.includes(p.status)) &&
        p.closedAt &&
        isInRange(p.closedAt, range)
    );
    const wonInRange = closedInRange.filter(p => stageConfig.wonStages.includes(p.status));
    const lostInRange = closedInRange.filter(p => stageConfig.lostStages.includes(p.status));

    const winRate = closedInRange.length > 0 ? (wonInRange.length / closedInRange.length) * 100 : 0;
    const lossRate = closedInRange.length > 0 ? (lostInRange.length / closedInRange.length) * 100 : 0;

    // Avg cycle time
    const cycleTimes = wonInRange
      .filter(p => p.closedAt)
      .map(p => {
        const created = new Date(p.createdAt);
        const closed = new Date(p.closedAt!);
        return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      });
    const avgCycleTime = cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : 0;

    // By stage
    const byStage: StageMetrics[] = stageConfig.stages
      .filter(s => !stageConfig.wonStages.includes(s.id) && !stageConfig.lostStages.includes(s.id))
      .map(stage => {
        const stageProspects = activeProspects.filter(p => p.status === stage.id);
        const ages = stageProspects.map(p => {
          const updated = new Date(p.updatedAt);
          return (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
        });
        const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
        const staleThreshold = 30; // days

        return {
          stageId: stage.id,
          stageName: stage.name,
          count: stageProspects.length,
          value: stageProspects.reduce((sum, p) => sum + (p.dealValue || 0), 0),
          avgAge: Math.round(avgAge * 10) / 10,
          staleCount: stageProspects.filter(p => {
            const age = (Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
            return age > staleThreshold;
          }).length,
        };
      });

    // Trend (weekly)
    const trend: PipelineTrend[] = generatePipelineTrend(range);

    return {
      totalValue,
      totalDeals: activeProspects.length,
      avgDealSize: Math.round(avgDealSize),
      winRate: Math.round(winRate * 10) / 10,
      lossRate: Math.round(lossRate * 10) / 10,
      avgCycleTime: Math.round(avgCycleTime * 10) / 10,
      byStage,
      trend,
    };
  }

  function generatePipelineTrend(range: DateRange): PipelineTrend[] {
    const trend: PipelineTrend[] = [];
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let current = new Date(range.start);

    while (current <= range.end) {
      const weekEnd = new Date(Math.min(current.getTime() + weekMs, range.end.getTime()));
      const weekRange = { start: current, end: weekEnd };

      const activeStatuses = stageConfig.stages
        .filter(s => !stageConfig.wonStages.includes(s.id) && !stageConfig.lostStages.includes(s.id))
        .map(s => s.id);

      const weekActive = prospects.filter(
        p => activeStatuses.includes(p.status) && isInRange(p.updatedAt, weekRange)
      );
      const weekNew = prospects.filter(p => isInRange(p.createdAt, weekRange));
      const weekWon = prospects.filter(
        p => stageConfig.wonStages.includes(p.status) && p.closedAt && isInRange(p.closedAt, weekRange)
      );
      const weekLost = prospects.filter(
        p => stageConfig.lostStages.includes(p.status) && p.closedAt && isInRange(p.closedAt, weekRange)
      );

      trend.push({
        date: current.toISOString().split('T')[0],
        totalValue: weekActive.reduce((sum, p) => sum + (p.dealValue || 0), 0),
        newDeals: weekNew.length,
        closedWon: weekWon.length,
        closedLost: weekLost.length,
      });

      current = new Date(current.getTime() + weekMs);
    }

    return trend;
  }

  // ==========================================================================
  // Conversion Calculations
  // ==========================================================================

  function getConversionMetrics(range: DateRange): ConversionMetrics {
    const rangeProspects = prospects.filter(p => isInRange(p.createdAt, range));

    // Stage conversions - count prospects that have reached each stage or beyond
    const qualified = rangeProspects.filter(p =>
      stageConfig.stages.findIndex(s => s.id === p.status) >=
      stageConfig.stages.findIndex(s => s.id === 'qualified')
    );
    const proposal = rangeProspects.filter(p =>
      stageConfig.stages.findIndex(s => s.id === p.status) >=
      stageConfig.stages.findIndex(s => s.id === 'proposal')
    );
    const won = rangeProspects.filter(p => stageConfig.wonStages.includes(p.status));

    const leadToOpportunity = rangeProspects.length > 0 ? (qualified.length / rangeProspects.length) * 100 : 0;
    const opportunityToProposal = qualified.length > 0 ? (proposal.length / qualified.length) * 100 : 0;
    const proposalToClose = proposal.length > 0 ? (won.length / proposal.length) * 100 : 0;
    const overallConversion = rangeProspects.length > 0 ? (won.length / rangeProspects.length) * 100 : 0;

    // By source
    const sourceMap = new Map<string, ProspectData[]>();
    rangeProspects.forEach(p => {
      const source = p.source || 'Unknown';
      if (!sourceMap.has(source)) sourceMap.set(source, []);
      sourceMap.get(source)!.push(p);
    });

    const bySource: SourceConversion[] = Array.from(sourceMap.entries())
      .map(([source, sourceProspects]) => {
        const sourceWon = sourceProspects.filter(p => stageConfig.wonStages.includes(p.status));
        return {
          source,
          leads: sourceProspects.length,
          conversions: sourceWon.length,
          rate: sourceProspects.length > 0 ? (sourceWon.length / sourceProspects.length) * 100 : 0,
          revenue: sourceWon.reduce((sum, p) => sum + (p.dealValue || 0), 0),
        };
      })
      .sort((a, b) => b.conversions - a.conversions);

    // By segment
    const segmentMap = new Map<string, ProspectData[]>();
    rangeProspects.forEach(p => {
      const segment = p.segment || 'Unknown';
      if (!segmentMap.has(segment)) segmentMap.set(segment, []);
      segmentMap.get(segment)!.push(p);
    });

    const bySegment: SegmentConversion[] = Array.from(segmentMap.entries())
      .map(([segment, segmentProspects]) => {
        const segmentWon = segmentProspects.filter(p => stageConfig.wonStages.includes(p.status));
        return {
          segment,
          leads: segmentProspects.length,
          conversions: segmentWon.length,
          rate: segmentProspects.length > 0 ? (segmentWon.length / segmentProspects.length) * 100 : 0,
          avgDealSize: segmentWon.length > 0
            ? segmentWon.reduce((sum, p) => sum + (p.dealValue || 0), 0) / segmentWon.length
            : 0,
        };
      })
      .sort((a, b) => b.conversions - a.conversions);

    return {
      leadToOpportunity: Math.round(leadToOpportunity * 10) / 10,
      opportunityToProposal: Math.round(opportunityToProposal * 10) / 10,
      proposalToClose: Math.round(proposalToClose * 10) / 10,
      overallConversion: Math.round(overallConversion * 10) / 10,
      bySource,
      bySegment,
    };
  }

  // ==========================================================================
  // Team Calculations
  // ==========================================================================

  function getTeamMetrics(range: DateRange): TeamMetrics {
    const rangeActivities = activities.filter(a => isInRange(a.timestamp, range));
    const activeUserIds = new Set(rangeActivities.map(a => a.userId));

    const leaderboard: UserActivitySummary[] = users
      .map(user => {
        const userActivities = rangeActivities.filter(a => a.userId === user.id);
        const userProspects = prospects.filter(p => p.assignee === user.id);
        const userWon = userProspects.filter(
          p => stageConfig.wonStages.includes(p.status) && p.closedAt && isInRange(p.closedAt, range)
        );

        return {
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          totalActivities: userActivities.length,
          prospectsContacted: new Set(userActivities.map(a => a.prospectId)).size,
          dealsCreated: userProspects.filter(p => isInRange(p.createdAt, range)).length,
          dealsWon: userWon.length,
          revenue: userWon.reduce((sum, p) => sum + (p.dealValue || 0), 0),
          avgResponseTime: 0,
          rank: 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.dealsWon - a.dealsWon || b.totalActivities - a.totalActivities)
      .map((user, index) => ({ ...user, rank: index + 1 }));

    return {
      totalMembers: users.length,
      activeMembers: activeUserIds.size,
      totalActivities: rangeActivities.length,
      leaderboard,
      period: range,
    };
  }

  // ==========================================================================
  // Full Summary
  // ==========================================================================

  function getSummary(period: TimePeriod = 'month', customRange?: DateRange): AnalyticsSummary {
    const range = getDateRange(period, customRange);

    return {
      kpis: getKPIs(range),
      funnel: getFunnelData(range),
      activities: getActivityMetrics(range),
      pipeline: getPipelineMetrics(range),
      conversions: getConversionMetrics(range),
      team: getTeamMetrics(range),
      period: range,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  function formatActivityType(type: ActivityType): string {
    const labels: Record<ActivityType, string> = {
      email_sent: 'Emails Sent',
      email_opened: 'Emails Opened',
      email_replied: 'Email Replies',
      call_made: 'Calls Made',
      meeting_scheduled: 'Meetings Scheduled',
      meeting_completed: 'Meetings Completed',
      linkedin_message: 'LinkedIn Messages',
      note_added: 'Notes Added',
      status_changed: 'Status Changes',
      deal_created: 'Deals Created',
    };
    return labels[type] || type;
  }

  return {
    // Date utilities
    getDateRange,
    getPreviousPeriod,

    // Individual metrics
    getKPIs,
    getFunnelData,
    getActivityMetrics,
    getPipelineMetrics,
    getConversionMetrics,
    getTeamMetrics,

    // Full summary
    getSummary,

    // Testing
    _calculateKPI: calculateKPI,
    _isInRange: isInRange,
  };
}

export type AnalyticsAggregator = ReturnType<typeof createAnalyticsAggregator>;
