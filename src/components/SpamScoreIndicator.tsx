/**
 * SpamScoreIndicator - Sprint 39C.4
 * 
 * Visual indicator showing real-time spam analysis results:
 * - Risk level badge (LOW/MEDIUM/HIGH/CRITICAL)
 * - Spam score (0-100)
 * - Issue list with severity
 * - Improvement suggestions
 * 
 * Integrates with useSpamScore hook for real-time analysis.
 */

import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { SpamScoreResult, SpamIssue, SpamRiskLevel } from '@/types/spamScore';

// ============================================
// Types
// ============================================

export interface SpamScoreIndicatorProps {
  /** Spam analysis result from useSpamScore */
  result: SpamScoreResult | null;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Maximum issues to show (default: 5) */
  maxIssues?: number;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

// ============================================
// Helper Functions
// ============================================

/** Get color classes for risk level */
function getLevelColors(level: SpamRiskLevel): {
  bg: string;
  text: string;
  border: string;
  icon: typeof ShieldCheck | typeof AlertTriangle | typeof ShieldAlert | typeof XCircle;
} {
  switch (level) {
    case 'low':
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: ShieldCheck,
      };
    case 'medium':
      return {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        icon: AlertTriangle,
      };
    case 'high':
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-200',
        icon: ShieldAlert,
      };
    case 'critical':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: XCircle,
      };
  }
}

/** Get score color based on numeric score */
function getScoreColor(score: number): string {
  if (score <= 20) return 'text-green-600';
  if (score <= 40) return 'text-yellow-600';
  if (score <= 60) return 'text-orange-600';
  return 'text-red-600';
}

/** Get severity badge for issues */
function getSeverityBadge(severity: number): { label: string; className: string } {
  if (severity >= 5) {
    return { label: 'Critical', className: 'bg-red-100 text-red-700' };
  }
  if (severity >= 4) {
    return { label: 'High', className: 'bg-orange-100 text-orange-700' };
  }
  if (severity >= 3) {
    return { label: 'Medium', className: 'bg-yellow-100 text-yellow-700' };
  }
  return { label: 'Low', className: 'bg-slate-100 text-slate-600' };
}

/** Format category for display */
function formatCategory(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================
// Subcomponents
// ============================================

/** Compact badge for inline display */
function CompactBadge({
  result,
  isLoading,
  className = '',
}: {
  result: SpamScoreResult | null;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-slate-50 text-slate-400 border-slate-200 ${className}`}>
        Analyzing...
      </span>
    );
  }

  if (!result) {
    return null;
  }

  const colors = getLevelColors(result.level);
  const Icon = colors.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${colors.bg} ${colors.text} ${colors.border} ${className}`}
      title={`Spam Score: ${result.score} - ${result.level.toUpperCase()} risk`}
    >
      <Icon className="h-3 w-3" />
      <span>{result.level.toUpperCase()}</span>
      <span className="opacity-70">({result.score})</span>
    </span>
  );
}

/** Issue list item */
function IssueItem({ issue }: { issue: SpamIssue }) {
  const severityBadge = getSeverityBadge(issue.severity);
  
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className={`shrink-0 px-1.5 py-0.5 text-xs font-medium rounded ${severityBadge.className}`}>
        {severityBadge.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">{issue.description}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatCategory(issue.category)} • {issue.location}
        </p>
      </div>
    </div>
  );
}

/** Suggestions list */
function SuggestionsList({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
        Suggestions
      </h4>
      <ul className="space-y-1">
        {suggestions.slice(0, 3).map((suggestion, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Analysis breakdown */
function AnalysisBreakdown({ result }: { result: SpamScoreResult }) {
  const { analysis } = result;
  
  const items = [
    { label: 'Subject', score: analysis.subject.score, max: 25 },
    { label: 'Body', score: analysis.body.score, max: 40 },
    { label: 'Links', score: analysis.links.score, max: 20 },
    { label: 'Quality', score: 15 - (analysis.quality.personalization ? 5 : 0) - (analysis.quality.hasUnsubscribe ? 5 : 0) - (analysis.quality.hasPhysicalAddress ? 5 : 0), max: 15 },
  ];

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
        Score Breakdown
      </h4>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-14">{item.label}</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  item.score === 0 ? 'bg-green-500' :
                  item.score < item.max * 0.5 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (item.score / item.max) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 w-8 text-right">
              {item.score}/{item.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function SpamScoreIndicator({
  result,
  isLoading = false,
  error = null,
  compact = false,
  showBreakdown = true,
  maxIssues = 5,
  className = '',
  testId = 'spam-score-indicator',
}: SpamScoreIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort issues by severity (highest first)
  const sortedIssues = useMemo(() => {
    if (!result) return [];
    return [...result.issues]
      .sort((a, b) => b.severity - a.severity)
      .slice(0, maxIssues);
  }, [result, maxIssues]);

  // Check if safe to send
  const isSafe = result?.level === 'low';
  const hasCritical = result?.level === 'critical' || 
    result?.issues.some(i => i.severity >= 5);

  // Show compact badge for inline display
  if (compact) {
    return (
      <CompactBadge
        result={result}
        isLoading={isLoading}
        className={className}
      />
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 border border-red-200 bg-red-50 rounded-lg text-sm text-red-600 ${className}`}
        data-testid={testId}
      >
        <XCircle className="h-4 w-4" />
        <span>Failed to analyze: {error}</span>
      </div>
    );
  }

  // Loading state
  if (isLoading && !result) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-500 ${className}`}
        data-testid={testId}
      >
        <Info className="h-4 w-4 animate-pulse" />
        <span>Analyzing content for spam triggers...</span>
      </div>
    );
  }

  // No result yet
  if (!result) {
    return (
      <div 
        className={`text-xs text-slate-400 py-1 ${className}`}
        data-testid={testId}
      >
        Start typing to see spam analysis...
      </div>
    );
  }

  const colors = getLevelColors(result.level);
  const Icon = colors.icon;

  return (
    <div 
      className={`border rounded-lg overflow-hidden ${colors.border} ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 ${colors.bg} hover:brightness-95 transition-all`}
        aria-expanded={isExpanded}
        data-testid={`${testId}-header`}
      >
        <div className="flex items-center gap-3">
          {/* Level badge */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded ${colors.bg} border ${colors.border}`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
            <span className={`text-sm font-semibold ${colors.text}`}>
              {result.level.toUpperCase()}
            </span>
          </div>

          {/* Score */}
          <div className="text-sm">
            <span className={`font-medium ${getScoreColor(result.score)}`}>
              Score: {result.score}
            </span>
            <span className="text-slate-400 ml-1">/100</span>
          </div>

          {/* Status indicator */}
          {isSafe ? (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="h-3 w-3" />
              Safe to send
            </span>
          ) : hasCritical ? (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <XCircle className="h-3 w-3" />
              Needs attention
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              Review suggested
            </span>
          )}
        </div>

        {/* Expand toggle */}
        <div className="flex items-center gap-2">
          {result.issues.length > 0 && (
            <span className="text-xs text-slate-500">
              {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''}
            </span>
          )}
          {showBreakdown && (
            isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && showBreakdown && (
        <div className="px-3 py-3 bg-white" data-testid={`${testId}-details`}>
          {/* Issues list */}
          {sortedIssues.length > 0 ? (
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Issues Found
              </h4>
              <div className="space-y-0">
                {sortedIssues.map((issue, idx) => (
                  <IssueItem key={idx} issue={issue} />
                ))}
              </div>
              {result.issues.length > maxIssues && (
                <p className="text-xs text-slate-400 mt-2">
                  +{result.issues.length - maxIssues} more issue{result.issues.length - maxIssues !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              No spam issues detected
            </div>
          )}

          {/* Suggestions */}
          <SuggestionsList suggestions={result.suggestions} />

          {/* Analysis breakdown */}
          <AnalysisBreakdown result={result} />
        </div>
      )}
    </div>
  );
}

export default SpamScoreIndicator;
