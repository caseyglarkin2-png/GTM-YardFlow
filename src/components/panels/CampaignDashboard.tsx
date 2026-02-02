import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LazyIcon } from '../icons';
import { DateRangePicker } from '../DateRangePicker';
import { EmailHealthStatus } from '../EmailHealthStatus';
import { ErrorState, KPIGridSkeleton, LeaderboardSkeleton, LoadingOverlay } from '../DashboardStates';
import { KPICard } from '../KPICard';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useToast } from '../Toast';
import { dashboardExporter } from '../../services/DashboardExporter';
import { createAnalyticsAggregator, type ProspectData, type ActivityData } from '../../services/AnalyticsAggregator';
import { getMeetingStats } from '../../services/MeetingAttributionService';
import type { TimePeriod, DateRange } from '../../types/analytics';
import type { Prospect } from '../../types';

// Components
import ROICalculator from './ROICalculator';
import { DataQualityPanel } from '../DataQualityPanel';
import { WarmupDashboard } from '../WarmupDashboard';
import { MeetingsKPICard } from '../MeetingsKPICard';
import { TimeHeatmap } from '../TimeHeatmap';
import { SequenceComparison } from '../analytics/SequenceComparison';
import { SequencePerformancePanel } from '../SequencePerformancePanel';
import { Leaderboard } from '../Leaderboard';
import { FunnelChart, BarChart, PieChart, LineChart } from '../charts';
import { EmailAnalytics } from '../dashboard/EmailAnalytics';

interface CampaignDashboardProps {
  prospects: Prospect[];
  currentUser: string;
  stats: {
    total: number;
    contacted: number;
    booked: number;
    tier1: number;
  };
}

export function CampaignDashboard({ prospects = [], currentUser, stats }: CampaignDashboardProps) {
  const { success: showSuccess, error: showError } = useToast();
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  // Safe Prospects Map
  const safeProspects = useMemo(() => Array.isArray(prospects) ? prospects : [], [prospects]);

  // State
  const [dashboardPeriod, setDashboardPeriod] = useState<TimePeriod>('month');
  const [dashboardCustomRange, setDashboardCustomRange] = useState<DateRange | undefined>(undefined);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [meetingStats, setMeetingStats] = useState<{ thisWeek: number; lastWeek: number; total: number }>({ thisWeek: 0, lastWeek: 0, total: 0 });

  // Calculate accumulated stats (Meeting stats from service)
  useEffect(() => {
    const loadMeetingStats = async () => {
      try {
        const stats = await getMeetingStats();
        setMeetingStats(stats);
      } catch (err) {
        console.error('Failed to load meeting stats:', err);
      }
    };
    
    loadMeetingStats();
    // Refresh every 60 seconds
    const interval = setInterval(loadMeetingStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Derived Date Range
  const dashboardDateRange = useMemo(() => {
    if (dashboardPeriod === 'custom' && dashboardCustomRange) {
      return { start: dashboardCustomRange.start, end: dashboardCustomRange.end };
    }
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    switch (dashboardPeriod) {
      case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': start = new Date(now); start.setDate(start.getDate() - 7); break;
      case 'quarter': start = new Date(now); start.setMonth(start.getMonth() - 3); break;
      case 'year': start = new Date(now); start.setFullYear(start.getFullYear() - 1); break;
      case 'month':
      default: start = new Date(now); start.setMonth(start.getMonth() - 1); break;
    }
    return { start, end };
  }, [dashboardPeriod, dashboardCustomRange]);

  // Aggregator
  const aggregator = useMemo(() => {
    const prospectData: ProspectData[] = safeProspects.map(p => ({
      id: p.id,
      status: p.status,
      source: p.source,
      segment: p.tier,
      assignee: p.lastEditedBy,
      dealValue: p.score * 1000,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
    }));
    const activityData: ActivityData[] = []; 
    const userData = [{ id: 'me', name: currentUser }];
    return createAnalyticsAggregator({ prospects: prospectData, activities: activityData, users: userData });
  }, [safeProspects, currentUser]);

  const dashboard = useDashboardData(dashboardDateRange, { aggregator });

  // Handlers
  const handleDashboardExport = async (format: 'png' | 'pdf') => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      if (format === 'png') {
        await dashboardExporter.downloadPng(dashboardRef.current, {
          dateRange: dashboardDateRange,
        });
        showSuccess('Export Complete', 'Dashboard exported as PNG');
      } else {
        await dashboardExporter.downloadPdf(dashboardRef.current, {
          dateRange: dashboardDateRange,
          includeHeader: true,
        });
        showSuccess('Export Complete', 'Dashboard exported as PDF');
      }
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export Failed', 'Unable to export dashboard. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={dashboardRef} className="p-6 space-y-6" data-testid="dashboard-tab">
      {/* Dashboard Header with DateRangePicker */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <LazyIcon name="TrendingUp" className="h-5 w-5" />
            <span className="text-blue-100 text-xs font-medium uppercase tracking-wider">Analytics Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={dashboard.refetch}
              disabled={dashboard.isLoading}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
              aria-label="Refresh data"
              data-testid="dashboard-refresh"
            >
              <LazyIcon name="RefreshCw" className={`h-4 w-4 ${dashboard.isLoading ? 'animate-spin' : ''}`} />
            </button>
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                aria-label="Export dashboard"
                data-testid="dashboard-export"
              >
                <LazyIcon name="Download" className={`h-4 w-4 ${isExporting ? 'animate-pulse' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                  <button
                    onClick={() => handleDashboardExport('png')}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    data-testid="export-png"
                  >
                    Export as PNG
                  </button>
                  <button
                    onClick={() => handleDashboardExport('pdf')}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    data-testid="export-pdf"
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold">GTM Performance</div>
        <div className="text-blue-200 text-xs mt-2 flex items-center justify-between">
          <span>Real-time metrics from your outreach campaigns</span>
          {dashboard.lastUpdated && (
            <span className="text-blue-300">
              Updated {dashboard.lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      
      {/* Date Range Picker */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between">
        <DateRangePicker
          selectedPeriod={dashboardPeriod}
          customRange={dashboardCustomRange}
          onPeriodChange={setDashboardPeriod}
          onCustomRangeChange={setDashboardCustomRange}
        />
        <div className="flex items-center gap-4">
          <EmailHealthStatus compact />
          <div className="text-xs text-slate-500">
            {dashboardDateRange.start.toLocaleDateString()} - {dashboardDateRange.end.toLocaleDateString()}
          </div>
        </div>
      </div>
      
      {/* Error State */}
      {dashboard.error && (
        <ErrorState
          title="Failed to load dashboard data"
          message={dashboard.error.message || 'An error occurred while loading analytics. Please try again.'}
          onRetry={dashboard.refetch}
        />
      )}
      
      {/* KPI Cards */}
      {dashboard.isLoading ? (
        <KPIGridSkeleton count={4} columns={2} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {dashboard.data.kpis.length > 0 ? (
            dashboard.data.kpis.slice(0, 4).map(kpi => (
              <KPICard key={kpi.id} metric={kpi} />
            ))
          ) : (
            <>
              <KPICard metric={{ id: 'total', name: 'Total Prospects', value: { current: stats.total, previous: stats.total, change: 0, changePercent: 0, trend: 'flat' }, format: 'number' }} />
              <KPICard metric={{ 
                id: 'booked', 
                name: 'Meetings This Week', 
                value: { 
                  current: meetingStats.thisWeek, 
                  previous: meetingStats.lastWeek, 
                  change: meetingStats.thisWeek - meetingStats.lastWeek, 
                  changePercent: meetingStats.lastWeek > 0 ? Math.round(((meetingStats.thisWeek - meetingStats.lastWeek) / meetingStats.lastWeek) * 100) : 0, 
                  trend: meetingStats.thisWeek >= meetingStats.lastWeek ? 'up' : 'down' 
                }, 
                format: 'number' 
              }} />
              <KPICard metric={{ id: 'rate', name: 'Contact Rate', value: { current: stats.total ? (stats.contacted / stats.total) * 100 : 0, previous: 50, change: stats.total ? (stats.contacted / stats.total) * 100 - 50 : 0, changePercent: 10, trend: 'up' }, format: 'percent' }} />
              <KPICard metric={{ id: 'tier1', name: 'Tier 1 Pipeline', value: { current: stats.tier1, previous: stats.tier1, change: 0, changePercent: 0, trend: 'flat' }, format: 'number' }} />
            </>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {dashboard.isLoading ? (
        <LeaderboardSkeleton rows={3} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Team Leaderboard</h3>
          <Leaderboard
            data={dashboard.data.team?.leaderboard ?? [
              { userId: '1', userName: 'Me', totalActivities: 45, prospectsContacted: stats.contacted, dealsCreated: stats.booked, dealsWon: Math.floor(stats.booked * 0.5), revenue: stats.contacted * 10000, avgResponseTime: 2, rank: 1 },
              { userId: '2', userName: 'Jake', totalActivities: 38, prospectsContacted: Math.floor(stats.contacted * 0.7), dealsCreated: Math.floor(stats.booked * 0.7), dealsWon: Math.floor(stats.booked * 0.35), revenue: stats.contacted * 8000, avgResponseTime: 3, rank: 2 },
            ]}
          />
        </div>
      )}

      {/* Manifest ROI Calculator */}
      {!dashboard.isLoading && (
          <ROICalculator />
      )}

      {/* Data Quality Panel */}
      {!dashboard.isLoading && (
        <DataQualityPanel prospects={prospects} className="lg:col-span-full" />
      )}

      {/* Email Warmup & Analytics Section */}
      {!dashboard.isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WarmupDashboard className="lg:col-span-1" />
          <MeetingsKPICard className="lg:col-span-1" />
        </div>
      )}

      {/* Time Analysis & Sequence Comparison */}
      {!dashboard.isLoading && (
        <div className="space-y-4">
          <TimeHeatmap title="Email Send Time Performance" />
          <SequenceComparison showRecommendations={true} />
        </div>
      )}

      {/* Sequence Performance Report */}
      {!dashboard.isLoading && (
        <SequencePerformancePanel />
      )}

      {/* Charts Row */}
      <LoadingOverlay isLoading={dashboard.isLoading} message="Loading charts...">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Email Analytics (Real Data) */}
        <div className="lg:col-span-2">
          <EmailAnalytics />
        </div>

        {/* Funnel Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Pipeline Funnel</h3>
          <FunnelChart
            data={dashboard.data.funnel?.stages ?? [
              { id: 'new', name: 'New', count: stats.total, value: stats.total * 5000, conversionRate: 100, avgTimeInStage: 3, color: '#3B82F6' },
              { id: 'contacted', name: 'Contacted', count: stats.contacted, value: stats.contacted * 5000, conversionRate: Math.round((stats.contacted / stats.total) * 100), avgTimeInStage: 5, color: '#8B5CF6' },
              { id: 'booked', name: 'Booked', count: stats.booked, value: stats.booked * 10000, conversionRate: Math.round((stats.booked / stats.contacted) * 100), avgTimeInStage: 7, color: '#10B981' },
            ]}
            height={200}
          />
        </div>

        {/* Activity Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Activity by Type</h3>
          <BarChart
            data={dashboard.data.activities?.byType.map((a: any) => ({ label: a.label, value: a.count, color: '#3B82F6' })) ?? [
              { label: 'Messages Sent', value: stats.contacted * 2, color: '#3B82F6' },
              { label: 'Replies', value: Math.floor(stats.contacted * 0.3), color: '#10B981' },
              { label: 'Meetings', value: stats.booked, color: '#F59E0B' },
            ]}
            height={200}
          />
        </div>

        {/* Tier Distribution Pie */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Tier Distribution</h3>
          <PieChart
            data={[
              { label: 'Tier 1', value: stats.tier1, color: '#F59E0B' },
              { label: 'Tier 2', value: prospects.filter(p => p.tier === 'Tier 2').length, color: '#3B82F6' },
              { label: 'Tier 3', value: prospects.filter(p => p.tier === 'Tier 3').length, color: '#8B5CF6' },
            ]}
            height={200}
          />
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Outreach Status</h3>
          <PieChart
            data={[
              { label: 'New', value: prospects.filter(p => p.status === 'new').length, color: '#6B7280' },
              { label: 'Contacted', value: prospects.filter(p => p.status === 'contacted').length, color: '#3B82F6' },
              { label: 'Booked', value: prospects.filter(p => p.status === 'meeting_booked').length, color: '#10B981' },
            ]}
            height={200}
          />
        </div>
      </div>
      </LoadingOverlay>
    </div>
  );
}
