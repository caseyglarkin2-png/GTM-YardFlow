/**
 * ABTestingDashboard Component
 * Sprint 205: Template A/B Testing Framework
 * 
 * Shows performance comparison between variants with statistical significance.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Info,
} from 'lucide-react';
import {
  type VariantStats,
  type ABTestResult,
  analyzeABTest,
} from '@/services/ABTestingService';

// =============================================================================
// Types
// =============================================================================

interface ABTest {
  id: string;
  templateName: string;
  stepName: string;
  sequenceId: string;
  variantA: VariantStats;
  variantB: VariantStats;
  startedAt: string;
}

interface UseABTestsReturn {
  tests: ABTest[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

// =============================================================================
// Hook
// =============================================================================

function useABTests(): UseABTestsReturn {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analytics/ab-tests');
      if (!response.ok) {
        throw new Error('Failed to fetch A/B tests');
      }
      const data = await response.json();
      setTests(data.data || []);
    } catch (err) {
      console.error('[useABTests] Error:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tests, isLoading, error, refresh };
}

// =============================================================================
// Sub-components
// =============================================================================

function SignificanceBadge({
  significance,
}: {
  significance: ABTestResult['openSignificance'];
}) {
  if (!significance.significant) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-600">
        <Clock className="h-3 w-3" />
        No winner yet
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
      <CheckCircle className="h-3 w-3" />
      Variant {significance.winner} wins ({significance.confidence}%)
    </span>
  );
}

function MetricComparison({
  label,
  valueA,
  valueB,
  rateA,
  rateB,
  significance,
}: {
  label: string;
  valueA: number;
  valueB: number;
  rateA: number;
  rateB: number;
  significance: ABTestResult['openSignificance'];
}) {
  const diff = rateA - rateB;
  const diffPercent = rateB > 0 ? ((rateA - rateB) / rateB * 100).toFixed(1) : '0';

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600 w-20">{label}</span>
      
      <div className="flex items-center gap-4 flex-1 justify-center">
        <div className="text-center min-w-[60px]">
          <span className={`text-sm font-medium ${
            significance.winner === 'A' ? 'text-green-600' : 'text-slate-700'
          }`}>
            {valueA} ({(rateA * 100).toFixed(1)}%)
          </span>
        </div>
        
        <span className="text-slate-300">vs</span>
        
        <div className="text-center min-w-[60px]">
          <span className={`text-sm font-medium ${
            significance.winner === 'B' ? 'text-green-600' : 'text-slate-700'
          }`}>
            {valueB} ({(rateB * 100).toFixed(1)}%)
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 min-w-[100px] justify-end">
        {diff !== 0 && (
          <span className={`text-xs flex items-center gap-0.5 ${
            diff > 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Number(diffPercent))}%
          </span>
        )}
        <SignificanceBadge significance={significance} />
      </div>
    </div>
  );
}

function ABTestCard({ test }: { test: ABTest }) {
  const analysis = useMemo(
    () => analyzeABTest(test.id, test.variantA, test.variantB),
    [test.id, test.variantA, test.variantB]
  );

  const statusColors = {
    running: 'bg-blue-100 text-blue-700',
    concluded: 'bg-green-100 text-green-700',
    insufficient_data: 'bg-amber-100 text-amber-700',
  };

  const statusLabels = {
    running: 'Running',
    concluded: 'Concluded',
    insufficient_data: 'Need More Data',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h4 className="font-medium text-slate-800">{test.templateName}</h4>
          <p className="text-xs text-slate-500">Step: {test.stepName}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[analysis.status]}`}>
          {statusLabels[analysis.status]}
        </span>
      </div>

      {/* Variant Headers */}
      <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
        <span className="w-20" />
        <div className="flex-1 flex items-center justify-center gap-4">
          <span className="text-center min-w-[60px]">
            <strong className="text-slate-700">{test.variantA.name}</strong>
            <br />
            {test.variantA.sends} sends
          </span>
          <span />
          <span className="text-center min-w-[60px]">
            <strong className="text-slate-700">{test.variantB.name}</strong>
            <br />
            {test.variantB.sends} sends
          </span>
        </div>
        <span className="min-w-[100px]" />
      </div>

      {/* Metrics */}
      <div className="px-4 py-2">
        <MetricComparison
          label="Opens"
          valueA={test.variantA.opens}
          valueB={test.variantB.opens}
          rateA={test.variantA.sends > 0 ? test.variantA.opens / test.variantA.sends : 0}
          rateB={test.variantB.sends > 0 ? test.variantB.opens / test.variantB.sends : 0}
          significance={analysis.openSignificance}
        />
        <MetricComparison
          label="Clicks"
          valueA={test.variantA.clicks}
          valueB={test.variantB.clicks}
          rateA={test.variantA.sends > 0 ? test.variantA.clicks / test.variantA.sends : 0}
          rateB={test.variantB.sends > 0 ? test.variantB.clicks / test.variantB.sends : 0}
          significance={analysis.clickSignificance}
        />
        <MetricComparison
          label="Replies"
          valueA={test.variantA.replies}
          valueB={test.variantB.replies}
          rateA={test.variantA.sends > 0 ? test.variantA.replies / test.variantA.sends : 0}
          rateB={test.variantB.sends > 0 ? test.variantB.replies / test.variantB.sends : 0}
          significance={analysis.replySignificance}
        />
      </div>

      {/* Recommendation */}
      <div className={`px-4 py-3 text-sm flex items-start gap-2 ${
        analysis.status === 'concluded' ? 'bg-green-50' :
        analysis.status === 'insufficient_data' ? 'bg-amber-50' :
        'bg-blue-50'
      }`}>
        <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
          analysis.status === 'concluded' ? 'text-green-600' :
          analysis.status === 'insufficient_data' ? 'text-amber-600' :
          'text-blue-600'
        }`} />
        <p className={
          analysis.status === 'concluded' ? 'text-green-700' :
          analysis.status === 'insufficient_data' ? 'text-amber-700' :
          'text-blue-700'
        }>
          {analysis.recommendation}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ABTestingDashboard() {
  const { tests, isLoading, error, refresh } = useABTests();

  // Loading state
  if (isLoading && tests.length === 0) {
    return (
      <div className="space-y-6" data-testid="ab-testing-dashboard">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            A/B Testing
          </h2>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/4 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-8 bg-slate-50 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6" data-testid="ab-testing-dashboard">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            A/B Testing
          </h2>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-slate-500 mb-3">{error.message}</p>
          <button
            onClick={refresh}
            className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (tests.length === 0) {
    return (
      <div className="space-y-6" data-testid="ab-testing-dashboard">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-600" />
            A/B Testing
          </h2>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="bg-slate-50 rounded-lg p-8 text-center">
          <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-700 mb-1">No A/B tests yet</h3>
          <p className="text-slate-500 text-sm mb-4">
            Add variants to your email templates to start testing
          </p>
          <div className="text-xs text-slate-400 max-w-md mx-auto">
            <p>To create an A/B test:</p>
            <ol className="list-decimal text-left pl-5 mt-2 space-y-1">
              <li>Open a sequence in the builder</li>
              <li>Click &quot;Add Variant&quot; on any email step</li>
              <li>Configure different subject lines or body content</li>
              <li>Set traffic split percentages</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ab-testing-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-purple-600" />
          A/B Testing
          <span className="text-sm font-normal text-slate-500">
            ({tests.length} active test{tests.length !== 1 ? 's' : ''})
          </span>
        </h2>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Test Cards */}
      <div className="space-y-4">
        {tests.map((test) => (
          <ABTestCard key={test.id} test={test} />
        ))}
      </div>

      {/* Info Footer */}
      <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
        <p className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-slate-400 flex-shrink-0" />
          Statistical significance is calculated using a Z-test for proportions.
          A winner is declared when confidence reaches 95% (z &gt; 1.96).
          Tests require at least 30 sends per variant for valid analysis.
        </p>
      </div>
    </div>
  );
}

export default ABTestingDashboard;
