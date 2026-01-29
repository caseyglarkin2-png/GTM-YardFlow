/**
 * Analytics Aggregator Tests
 * Sprint 28 - T28.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAnalyticsAggregator, type ProspectData, type ActivityData, type UserData } from '../../services/AnalyticsAggregator';

describe('AnalyticsAggregator', () => {
  // Test data
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const mockUsers: UserData[] = [
    { id: 'user1', name: 'Alice', avatar: 'alice.png' },
    { id: 'user2', name: 'Bob', avatar: 'bob.png' },
    { id: 'user3', name: 'Carol', avatar: 'carol.png' },
  ];

  function createMockProspects(count: number, overrides: Partial<ProspectData>[] = []): ProspectData[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `prospect-${i}`,
      status: 'new',
      source: 'website',
      segment: 'enterprise',
      assignee: mockUsers[i % mockUsers.length].id,
      dealValue: 10000 + i * 1000,
      createdAt: oneWeekAgo.toISOString(),
      updatedAt: now.toISOString(),
      ...overrides[i],
    }));
  }

  function createMockActivities(count: number, overrides: Partial<ActivityData>[] = []): ActivityData[] {
    const types = ['email_sent', 'call_made', 'meeting_scheduled', 'linkedin_message', 'note_added'] as const;
    return Array.from({ length: count }, (_, i) => ({
      id: `activity-${i}`,
      type: types[i % types.length],
      prospectId: `prospect-${i % 10}`,
      userId: mockUsers[i % mockUsers.length].id,
      userName: mockUsers[i % mockUsers.length].name,
      timestamp: new Date(now.getTime() - i * 60 * 60 * 1000).toISOString(), // Hourly
      ...overrides[i],
    }));
  }

  let aggregator: ReturnType<typeof createAnalyticsAggregator>;

  // ==========================================================================
  // KPI Tests
  // ==========================================================================

  describe('getKPIs', () => {
    it('should calculate total prospects', () => {
      const prospects = createMockProspects(10);
      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const kpis = aggregator.getKPIs(range);

      expect(kpis.totalProspects.current).toBe(10);
    });

    it('should calculate KPI trends', () => {
      // Create prospects with dates within the week range
      const todayStr = new Date().toISOString();
      const currentProspects = createMockProspects(10, 
        Array(10).fill({ createdAt: todayStr })
      );

      aggregator = createAnalyticsAggregator({
        prospects: currentProspects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('week');
      const kpis = aggregator.getKPIs(range);

      // Current week should have 10 prospects
      expect(kpis.totalProspects.current).toBe(10);
    });

    it('should calculate pipeline value', () => {
      const prospects = createMockProspects(5, [
        { status: 'qualified', dealValue: 50000 },
        { status: 'proposal', dealValue: 30000 },
        { status: 'negotiation', dealValue: 20000 },
        { status: 'won', dealValue: 10000 },
        { status: 'lost', dealValue: 5000 },
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const kpis = aggregator.getKPIs(range);

      // Only active deals (qualified, proposal, negotiation)
      expect(kpis.pipelineValue.current).toBe(100000); // 50k + 30k + 20k
    });

    it('should calculate win rate', () => {
      const prospects = createMockProspects(10, [
        { status: 'won', closedAt: now.toISOString() },
        { status: 'won', closedAt: now.toISOString() },
        { status: 'won', closedAt: now.toISOString() },
        { status: 'lost', closedAt: now.toISOString() },
        { status: 'lost', closedAt: now.toISOString() },
        { status: 'qualified' },
        { status: 'proposal' },
        { status: 'new' },
        { status: 'contacted' },
        { status: 'negotiation' },
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const kpis = aggregator.getKPIs(range);

      // 3 won / 5 closed = 60%
      expect(kpis.winRate.current).toBe(60);
    });

    it('should calculate activities count', () => {
      const activities = createMockActivities(25);

      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities,
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const kpis = aggregator.getKPIs(range);

      expect(kpis.activitiesThisPeriod.current).toBe(25);
    });
  });

  // ==========================================================================
  // Funnel Tests
  // ==========================================================================

  describe('getFunnelData', () => {
    it('should calculate funnel stages', () => {
      const prospects = createMockProspects(20, [
        { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, // 5 new
        { status: 'contacted' }, { status: 'contacted' }, { status: 'contacted' }, { status: 'contacted' }, // 4 contacted
        { status: 'qualified' }, { status: 'qualified' }, { status: 'qualified' }, // 3 qualified
        { status: 'proposal' }, { status: 'proposal' }, // 2 proposal
        { status: 'negotiation' }, // 1 negotiation
        { status: 'won' }, { status: 'won' }, // 2 won
        { status: 'lost' }, { status: 'lost' }, { status: 'lost' }, // 3 lost (not in funnel)
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const funnel = aggregator.getFunnelData(range);

      expect(funnel.stages.length).toBeGreaterThan(0);
      expect(funnel.stages.find(s => s.id === 'new')?.count).toBe(5);
      expect(funnel.stages.find(s => s.id === 'contacted')?.count).toBe(4);
      expect(funnel.stages.find(s => s.id === 'won')?.count).toBe(2);
      // Lost stage should not be in funnel
      expect(funnel.stages.find(s => s.id === 'lost')).toBeUndefined();
    });

    it('should calculate conversion rates between stages', () => {
      const prospects = createMockProspects(10, [
        { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, // 4 new
        { status: 'contacted' }, { status: 'contacted' }, // 2 contacted
        { status: 'qualified' }, // 1 qualified
        { status: 'won' }, // 1 won
        { status: 'lost' }, { status: 'lost' }, // 2 lost
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const funnel = aggregator.getFunnelData(range);

      // Conversion from new to contacted: 2/4 = 50%
      const newStage = funnel.stages.find(s => s.id === 'new');
      expect(newStage?.conversionRate).toBe(50);
    });

    it('should calculate overall conversion rate', () => {
      const prospects = createMockProspects(10, [
        { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, // 5
        { status: 'contacted' }, { status: 'contacted' }, // 2
        { status: 'qualified' }, // 1
        { status: 'won' }, { status: 'won' }, // 2
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const funnel = aggregator.getFunnelData(range);

      // 2 won / 5 new = 40%
      expect(funnel.totalConversionRate).toBe(40);
    });
  });

  // ==========================================================================
  // Activity Tests
  // ==========================================================================

  describe('getActivityMetrics', () => {
    it('should count activities by type', () => {
      const activities = createMockActivities(50);

      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities,
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getActivityMetrics(range);

      expect(metrics.byType.length).toBeGreaterThan(0);
      expect(metrics.totalActivities).toBe(50);
    });

    it('should calculate average activities per day', () => {
      // Create activities spread over 10 days
      const activities = createMockActivities(100, 
        Array.from({ length: 100 }, (_, i) => ({
          timestamp: new Date(now.getTime() - (i % 10) * 24 * 60 * 60 * 1000).toISOString(),
        }))
      );

      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities,
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getActivityMetrics(range);

      expect(metrics.avgPerDay).toBeGreaterThan(0);
    });

    it('should identify top performers', () => {
      // Give user1 more activities
      const activities = [
        ...createMockActivities(30, Array(30).fill({ userId: 'user1', userName: 'Alice' })),
        ...createMockActivities(20, Array(20).fill({ userId: 'user2', userName: 'Bob' })),
        ...createMockActivities(10, Array(10).fill({ userId: 'user3', userName: 'Carol' })),
      ];

      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities,
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getActivityMetrics(range);

      expect(metrics.topPerformers.length).toBeGreaterThan(0);
      expect(metrics.topPerformers[0].userName).toBe('Alice');
      expect(metrics.topPerformers[0].rank).toBe(1);
    });

    it('should generate activity trend', () => {
      const activities = createMockActivities(50);

      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities,
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getActivityMetrics(range);

      expect(metrics.trend.length).toBeGreaterThan(0);
      expect(metrics.trend[0]).toHaveProperty('date');
      expect(metrics.trend[0]).toHaveProperty('total');
    });
  });

  // ==========================================================================
  // Pipeline Tests
  // ==========================================================================

  describe('getPipelineMetrics', () => {
    it('should calculate total pipeline value', () => {
      const prospects = createMockProspects(5, [
        { status: 'qualified', dealValue: 50000 },
        { status: 'proposal', dealValue: 40000 },
        { status: 'negotiation', dealValue: 30000 },
        { status: 'won', dealValue: 20000 }, // Not active
        { status: 'lost', dealValue: 10000 }, // Not active
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getPipelineMetrics(range);

      expect(metrics.totalValue).toBe(120000); // 50k + 40k + 30k
      expect(metrics.totalDeals).toBe(3);
    });

    it('should calculate average deal size', () => {
      const prospects = createMockProspects(3, [
        { status: 'qualified', dealValue: 30000 },
        { status: 'proposal', dealValue: 60000 },
        { status: 'negotiation', dealValue: 90000 },
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getPipelineMetrics(range);

      expect(metrics.avgDealSize).toBe(60000); // (30k + 60k + 90k) / 3
    });

    it('should identify stale deals', () => {
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
      const prospects = createMockProspects(5, [
        { status: 'qualified', updatedAt: oldDate.toISOString() },
        { status: 'qualified', updatedAt: oldDate.toISOString() },
        { status: 'qualified', updatedAt: now.toISOString() }, // Recent
        { status: 'proposal', updatedAt: oldDate.toISOString() },
        { status: 'negotiation', updatedAt: now.toISOString() }, // Recent
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('year');
      const metrics = aggregator.getPipelineMetrics(range);

      const qualifiedStage = metrics.byStage.find(s => s.stageId === 'qualified');
      expect(qualifiedStage?.staleCount).toBe(2);
    });
  });

  // ==========================================================================
  // Conversion Tests
  // ==========================================================================

  describe('getConversionMetrics', () => {
    it('should calculate stage conversion rates', () => {
      const prospects = createMockProspects(20, [
        { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' },
        { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, { status: 'new' }, // 10 new
        { status: 'qualified' }, { status: 'qualified' }, { status: 'qualified' }, { status: 'qualified' }, // 4 qualified
        { status: 'proposal' }, { status: 'proposal' }, // 2 proposal
        { status: 'won' }, // 1 won
        { status: 'lost' }, { status: 'lost' }, { status: 'lost' }, // 3 lost
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getConversionMetrics(range);

      // All prospects that reached qualified stage or beyond: 4 + 2 + 1 + 3 = 10
      // Overall conversion (won/total): 1/20 = 5%
      expect(metrics.overallConversion).toBe(5);
    });

    it('should group conversions by source', () => {
      const prospects = createMockProspects(10, [
        { source: 'website', status: 'won' },
        { source: 'website', status: 'won' },
        { source: 'website', status: 'lost' },
        { source: 'linkedin', status: 'won' },
        { source: 'linkedin', status: 'lost' },
        { source: 'linkedin', status: 'lost' },
        { source: 'referral', status: 'won' },
        { source: 'referral', status: 'won' },
        { source: 'referral', status: 'won' },
        { source: 'referral', status: 'won' },
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getConversionMetrics(range);

      expect(metrics.bySource.length).toBe(3);
      
      const referral = metrics.bySource.find(s => s.source === 'referral');
      expect(referral?.rate).toBe(100); // 4/4
      
      const linkedin = metrics.bySource.find(s => s.source === 'linkedin');
      expect(linkedin?.rate).toBeCloseTo(33.3, 0); // 1/3
    });

    it('should group conversions by segment', () => {
      const prospects = createMockProspects(8, [
        { segment: 'enterprise', status: 'won', dealValue: 100000 },
        { segment: 'enterprise', status: 'won', dealValue: 80000 },
        { segment: 'enterprise', status: 'lost', dealValue: 50000 },
        { segment: 'smb', status: 'won', dealValue: 10000 },
        { segment: 'smb', status: 'won', dealValue: 15000 },
        { segment: 'smb', status: 'lost', dealValue: 8000 },
        { segment: 'smb', status: 'lost', dealValue: 12000 },
        { segment: 'smb', status: 'lost', dealValue: 5000 },
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getConversionMetrics(range);

      expect(metrics.bySegment.length).toBe(2);
      
      const enterprise = metrics.bySegment.find(s => s.segment === 'enterprise');
      expect(enterprise?.avgDealSize).toBe(90000); // (100k + 80k) / 2
    });
  });

  // ==========================================================================
  // Team Tests
  // ==========================================================================

  describe('getTeamMetrics', () => {
    it('should count active team members', () => {
      const activities = [
        ...createMockActivities(10, Array(10).fill({ userId: 'user1' })),
        ...createMockActivities(5, Array(5).fill({ userId: 'user2' })),
        // user3 has no activities
      ];

      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities,
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getTeamMetrics(range);

      expect(metrics.totalMembers).toBe(3);
      expect(metrics.activeMembers).toBe(2);
    });

    it('should rank team by performance', () => {
      const prospects = createMockProspects(6, [
        { assignee: 'user1', status: 'won', dealValue: 100000, closedAt: now.toISOString() },
        { assignee: 'user1', status: 'won', dealValue: 50000, closedAt: now.toISOString() },
        { assignee: 'user2', status: 'won', dealValue: 200000, closedAt: now.toISOString() },
        { assignee: 'user3', status: 'won', dealValue: 30000, closedAt: now.toISOString() },
        { assignee: 'user3', status: 'won', dealValue: 20000, closedAt: now.toISOString() },
        { assignee: 'user3', status: 'won', dealValue: 10000, closedAt: now.toISOString() },
      ]);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities: [],
        users: mockUsers,
      });

      const range = aggregator.getDateRange('month');
      const metrics = aggregator.getTeamMetrics(range);

      // user2 has highest revenue ($200k)
      expect(metrics.leaderboard[0].userId).toBe('user2');
      expect(metrics.leaderboard[0].revenue).toBe(200000);
      expect(metrics.leaderboard[0].rank).toBe(1);

      // user1 has second highest ($150k)
      expect(metrics.leaderboard[1].userId).toBe('user1');
      expect(metrics.leaderboard[1].revenue).toBe(150000);
    });
  });

  // ==========================================================================
  // Date Range Tests
  // ==========================================================================

  describe('getDateRange', () => {
    it('should return correct range for week', () => {
      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities: [],
        users: [],
      });

      const range = aggregator.getDateRange('week');
      const diff = range.end.getTime() - range.start.getTime();
      const days = diff / (1000 * 60 * 60 * 24);

      // Range is ~7-8 days depending on end-of-day calculation
      expect(days).toBeGreaterThanOrEqual(7);
      expect(days).toBeLessThan(8.5);
    });

    it('should return correct range for month', () => {
      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities: [],
        users: [],
      });

      const range = aggregator.getDateRange('month');
      const diff = range.end.getTime() - range.start.getTime();
      const days = diff / (1000 * 60 * 60 * 24);

      // Should be approximately 30-31 days
      expect(days).toBeGreaterThanOrEqual(29);
      expect(days).toBeLessThanOrEqual(32);
    });

    it('should use custom range when provided', () => {
      const customStart = new Date('2025-01-01');
      const customEnd = new Date('2025-01-31');

      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities: [],
        users: [],
      });

      const range = aggregator.getDateRange('custom', { start: customStart, end: customEnd });

      expect(range.start).toEqual(customStart);
      expect(range.end).toEqual(customEnd);
    });
  });

  // ==========================================================================
  // Summary Tests
  // ==========================================================================

  describe('getSummary', () => {
    it('should return complete analytics summary', () => {
      const prospects = createMockProspects(20);
      const activities = createMockActivities(50);

      aggregator = createAnalyticsAggregator({
        prospects,
        activities,
        users: mockUsers,
      });

      const summary = aggregator.getSummary('month');

      expect(summary).toHaveProperty('kpis');
      expect(summary).toHaveProperty('funnel');
      expect(summary).toHaveProperty('activities');
      expect(summary).toHaveProperty('pipeline');
      expect(summary).toHaveProperty('conversions');
      expect(summary).toHaveProperty('team');
      expect(summary).toHaveProperty('period');
      expect(summary).toHaveProperty('generatedAt');
    });
  });

  // ==========================================================================
  // Internal Method Tests
  // ==========================================================================

  describe('_calculateKPI', () => {
    it('should calculate positive trend', () => {
      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities: [],
        users: [],
      });

      const kpi = aggregator._calculateKPI(100, 80);

      expect(kpi.change).toBe(20);
      expect(kpi.changePercent).toBe(25);
      expect(kpi.trend).toBe('up');
    });

    it('should calculate negative trend', () => {
      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities: [],
        users: [],
      });

      const kpi = aggregator._calculateKPI(60, 100);

      expect(kpi.change).toBe(-40);
      expect(kpi.changePercent).toBe(-40);
      expect(kpi.trend).toBe('down');
    });

    it('should handle flat trend', () => {
      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities: [],
        users: [],
      });

      const kpi = aggregator._calculateKPI(50, 50);

      expect(kpi.change).toBe(0);
      expect(kpi.changePercent).toBe(0);
      expect(kpi.trend).toBe('flat');
    });

    it('should handle zero previous value', () => {
      aggregator = createAnalyticsAggregator({
        prospects: [],
        activities: [],
        users: [],
      });

      const kpi = aggregator._calculateKPI(100, 0);

      expect(kpi.changePercent).toBe(100);
      expect(kpi.trend).toBe('up');
    });
  });
});
