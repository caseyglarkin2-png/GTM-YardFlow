/**
 * ReputationCard Component
 * 
 * Sprint 39A.4: Dashboard card showing email reputation metrics
 * 
 * Displays:
 * - Health score as circular gauge (0-100)
 * - Key metrics: Deliverability, Bounce Rate, Spam Rate, Open Rate
 * - Color-coded status (green/yellow/red)
 * - Warning banner if issues detected
 * - Recommendations for improvement
 */

import { useState } from 'react';
import { useEmailReputation, type ReputationData } from '@/hooks/useEmailReputation';
import { LazyIcon } from '@/components/icons';

interface ReputationCardProps {
  /** Time period for metrics */
  period?: '24h' | '7d' | '30d';
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Circular gauge component for health score
 */
function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getGaugeColor = () => {
    if (score >= 90) return '#22c55e'; // green-500
    if (score >= 80) return '#3b82f6'; // blue-500
    if (score >= 70) return '#eab308'; // yellow-500
    if (score >= 60) return '#f97316'; // orange-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="relative w-28 h-28">
      <svg className="transform -rotate-90 w-28 h-28">
        {/* Background circle */}
        <circle
          cx="56"
          cy="56"
          r="40"
          stroke="#e2e8f0"
          strokeWidth="8"
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx="56"
          cy="56"
          r="40"
          stroke={getGaugeColor()}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-800">{score}</span>
        <span className={`text-lg font-semibold ${getGradeColorClass(grade)}`}>
          {grade}
        </span>
      </div>
    </div>
  );
}

/**
 * Get Tailwind color class for grade
 */
function getGradeColorClass(grade: string): string {
  switch (grade) {
    case 'A': return 'text-green-600';
    case 'B': return 'text-blue-600';
    case 'C': return 'text-yellow-600';
    case 'D': return 'text-orange-600';
    case 'F': return 'text-red-600';
    default: return 'text-slate-400';
  }
}

/**
 * Metric display component
 */
function MetricItem({
  label,
  value,
  format = 'percent',
  threshold,
  inverse = false,
}: {
  label: string;
  value: number;
  format?: 'percent' | 'number';
  threshold?: number;
  inverse?: boolean; // true if lower is better (bounce, spam)
}) {
  const displayValue = format === 'percent' 
    ? `${(value * 100).toFixed(1)}%`
    : value.toString();

  const isWarning = threshold !== undefined && (
    inverse ? value > threshold : value < threshold
  );

  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-medium ${isWarning ? 'text-red-600' : 'text-slate-800'}`}>
        {displayValue}
      </span>
    </div>
  );
}

/**
 * Issue banner component
 */
function IssueBanner({ issues }: { issues: ReputationData['issues'] }) {
  const criticalIssues = issues.filter(i => i.type === 'critical');
  const warningIssues = issues.filter(i => i.type === 'warning');

  if (criticalIssues.length === 0 && warningIssues.length === 0) {
    return null;
  }

  const topIssue = criticalIssues[0] || warningIssues[0];
  const isCritical = topIssue.type === 'critical';

  return (
    <div className={`rounded-lg p-3 mb-4 ${
      isCritical ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
    }`}>
      <div className="flex items-start gap-2">
        <LazyIcon 
          name={isCritical ? 'AlertTriangle' : 'AlertCircle'} 
          className={`h-5 w-5 flex-shrink-0 ${isCritical ? 'text-red-500' : 'text-yellow-500'}`}
        />
        <div>
          <p className={`text-sm font-medium ${isCritical ? 'text-red-800' : 'text-yellow-800'}`}>
            {topIssue.message}
          </p>
          {criticalIssues.length + warningIssues.length > 1 && (
            <p className="text-xs text-slate-600 mt-1">
              +{criticalIssues.length + warningIssues.length - 1} more issue(s)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ReputationCard - Main component
 */
export function ReputationCard({ period = '7d', compact = false, className = '' }: ReputationCardProps) {
  const { data, isLoading, error, refresh, gradeColor, isHealthy, shouldPauseSending } = useEmailReputation({
    period,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
  });
  
  const [showRecommendations, setShowRecommendations] = useState(false);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="flex items-center justify-center h-28">
            <div className="w-28 h-28 bg-slate-200 rounded-full"></div>
          </div>
          <div className="space-y-2 mt-4">
            <div className="h-3 bg-slate-200 rounded"></div>
            <div className="h-3 bg-slate-200 rounded"></div>
            <div className="h-3 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-4 ${className}`}>
        <div className="text-center py-6">
          <LazyIcon name="AlertCircle" className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Failed to load reputation</p>
          <button
            onClick={refresh}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-4 ${className}`}>
        <div className="text-center py-6">
          <LazyIcon name="Mail" className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">No email data yet</p>
        </div>
      </div>
    );
  }

  const { metrics, issues, recommendations } = data;

  if (compact) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-2xl font-bold ${gradeColor}`}>
              {metrics.healthGrade}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Email Health</p>
              <p className="text-xs text-slate-500">{metrics.healthScore}/100</p>
            </div>
          </div>
          {shouldPauseSending && (
            <div className="flex items-center gap-1 text-red-600">
              <LazyIcon name="AlertTriangle" className="h-4 w-4" />
              <span className="text-xs font-medium">Pause sending</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-slate-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Email Reputation</h3>
        <div className="flex items-center gap-2">
          <select
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-600"
            value={period}
            disabled
          >
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
          </select>
          <button
            onClick={refresh}
            className="text-slate-400 hover:text-slate-600"
            title="Refresh"
          >
            <LazyIcon name="RefreshCw" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Issues banner */}
        <IssueBanner issues={issues} />

        {/* Health gauge and metrics */}
        <div className="flex items-start gap-6">
          {/* Gauge */}
          <div className="flex-shrink-0">
            <HealthGauge 
              score={metrics.healthScore} 
              grade={metrics.healthGrade} 
            />
            <p className="text-xs text-center text-slate-500 mt-1">Health Score</p>
          </div>

          {/* Metrics */}
          <div className="flex-1 min-w-0">
            <MetricItem 
              label="Deliverability" 
              value={metrics.deliverabilityRate}
              threshold={0.90}
            />
            <MetricItem 
              label="Bounce Rate" 
              value={metrics.bounceRate}
              threshold={0.05}
              inverse
            />
            <MetricItem 
              label="Spam Rate" 
              value={metrics.spamRate}
              threshold={0.001}
              inverse
            />
            <MetricItem 
              label="Open Rate" 
              value={metrics.openRate}
              threshold={0.15}
            />
            <div className="border-t border-slate-100 mt-2 pt-2">
              <MetricItem 
                label="Emails Sent" 
                value={metrics.sent}
                format="number"
              />
            </div>
          </div>
        </div>

        {/* Recommendations toggle */}
        {recommendations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
            >
              <LazyIcon 
                name={showRecommendations ? 'ChevronDown' : 'ChevronRight'} 
                className="h-4 w-4" 
              />
              <span>Recommendations ({recommendations.length})</span>
            </button>
            
            {showRecommendations && (
              <ul className="mt-2 space-y-1.5">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <LazyIcon name="CheckCircle" className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReputationCard;
