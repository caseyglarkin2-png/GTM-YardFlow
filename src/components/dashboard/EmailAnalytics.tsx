import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { emailStatsService, type EmailStatsData } from '@/services/EmailStatsService';
import { LazyIcon } from '@/components/icons';

interface EmailAnalyticsProps {
  initialPeriod?: '7d' | '30d';
}

export function EmailAnalytics({ initialPeriod = '7d' }: EmailAnalyticsProps) {
  const [period, setPeriod] = useState<'7d' | '30d'>(initialPeriod);
  const [stats, setStats] = useState<EmailStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [period]);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);
      const data = await emailStatsService.getStats(period);
      setStats(data);
    } catch (err) {
      console.error('Failed to load email analytics', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="text-center text-red-500">
          <p className="font-medium">{error}</p>
          <button 
            onClick={() => loadStats()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Outreach Performance</h2>
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setPeriod('7d')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              period === '7d' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              period === '30d' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Sent"
          value={stats.totals.sent}
          icon="Send"
          color="blue"
        />
        <StatCard
          label="Opened"
          value={stats.totals.opened}
          subValue={`${stats.totals.sent ? Math.round((stats.totals.opened / stats.totals.sent) * 100) : 0}%`}
          icon="Eye"
          color="indigo"
        />
        <StatCard
          label="Replied"
          value={stats.totals.replied}
          subValue={`${stats.totals.sent ? Math.round((stats.totals.replied / stats.totals.sent) * 100) : 0}%`}
          icon="MessageSquare"
          color="purple"
        />
        <StatCard
          label="Meetings"
          value={stats.totals.meeting}
          icon="Calendar"
          color="green"
          highlight
        />
      </div>

      {/* Chart */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 h-80">
        <h3 className="mb-4 text-sm font-medium text-slate-500">Activity Timeline</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748B' }}
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              minTickGap={30}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748B' }}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              cursor={{ fill: '#F1F5F9' }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            <Bar name="Sent" dataKey="sent" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar name="Opened" dataKey="opened" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar name="Replied" dataKey="replied" fill="#A855F7" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  color: 'blue' | 'indigo' | 'purple' | 'green';
  highlight?: boolean;
}

function StatCard({ label, value, subValue, icon, color, highlight }: StatCardProps) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-green-50/50 border-green-200' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorStyles[color]}`}>
          <LazyIcon name={icon as any} className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{value}</span>
            {subValue && (
              <span className="text-xs font-medium text-slate-500">{subValue}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
