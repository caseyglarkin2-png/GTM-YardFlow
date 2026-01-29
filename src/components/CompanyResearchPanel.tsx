/**
 * Company Research Panel - YardFlow Hub
 * 
 * UI for AI-powered company research with Gemini.
 * Supports single research, batch processing, and queue management.
 * 
 * Sprint 59: T59.1 - Research Panel Component
 */

import { useState, useCallback } from 'react';
import {
  useCompanyResearch,
  type CompanyResearchResult,
  type ResearchedCompanyData,
} from '../hooks/useCompanyResearch';
import type { EnrichedCompany } from '../types/marketing';

// ============================================
// Types
// ============================================

export interface CompanyResearchPanelProps {
  companies: Partial<EnrichedCompany>[];
  onResearchComplete?: (result: CompanyResearchResult) => void;
  onBatchComplete?: (results: CompanyResearchResult[]) => void;
  className?: string;
}

export interface ResearchResultCardProps {
  result: CompanyResearchResult;
  onApply?: () => void;
  onDismiss?: () => void;
}

// ============================================
// Sub-Components
// ============================================

/**
 * Display confidence badge
 */
function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' | 'verified' | 'estimated' | 'inferred' | 'unknown' }) {
  const colors = {
    high: 'bg-green-100 text-green-800',
    verified: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    estimated: 'bg-yellow-100 text-yellow-800',
    inferred: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[level]}`}>
      {level}
    </span>
  );
}

/**
 * Display a single research field with source/reasoning
 */
function ResearchField({
  label,
  value,
  source,
  confidence,
}: {
  label: string;
  value: string | number | boolean | undefined;
  source?: string;
  confidence?: 'verified' | 'estimated' | 'inferred' | 'unknown';
}) {
  if (value === undefined || value === null) {
    return (
      <div className="flex justify-between items-center py-2 border-b border-gray-100">
        <span className="text-sm text-gray-500">{label}</span>
        <span className="text-sm text-gray-400 italic">Unknown</span>
      </div>
    );
  }

  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);

  return (
    <div className="py-2 border-b border-gray-100">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900">{displayValue}</span>
          {confidence && <ConfidenceBadge level={confidence} />}
        </div>
      </div>
      {source && (
        <p className="text-xs text-gray-500 mt-1">{source}</p>
      )}
    </div>
  );
}

/**
 * Research result card showing all researched data
 */
export function ResearchResultCard({
  result,
  onApply,
  onDismiss,
}: ResearchResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (!result.success || !result.data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium text-red-800">Research Failed</span>
        </div>
        <p className="text-sm text-red-600 mt-2">{result.error || 'Unknown error'}</p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="mt-3 text-sm text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  const { data, confidence, sources } = result;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-gray-900">{result.companyName}</h3>
            <p className="text-xs text-gray-500">
              Researched {result.researchedAt.toLocaleString()}
            </p>
          </div>
          {confidence && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Confidence:</span>
              <ConfidenceBadge level={confidence.overall} />
            </div>
          )}
        </div>
      </div>

      {/* Key Fields */}
      <div className="px-4 py-2">
        <ResearchField
          label="Facility Count"
          value={data.facilityCount}
          source={data.facilityCountSource}
          confidence={confidence?.facilityCount}
        />
        <ResearchField
          label="Industry"
          value={data.industryCategory?.replace(/_/g, ' ')}
          source={data.industryCategoryReasoning}
          confidence={confidence?.industryCategory}
        />
        <ResearchField
          label="Distribution Footprint"
          value={data.distributionFootprint}
          source={data.distributionFootprintReasoning}
          confidence={confidence?.distributionFootprint}
        />
        <ResearchField
          label="Yard Intensive"
          value={data.isYardIntensive}
          source={data.isYardIntensiveReasoning}
        />
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          {data.description && (
            <p className="text-sm text-gray-600 mb-2">{data.description}</p>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {data.headquarters && (
              <div>
                <span className="text-gray-500">HQ:</span> {data.headquarters}
              </div>
            )}
            {data.website && (
              <div>
                <span className="text-gray-500">Website:</span>{' '}
                <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {data.website}
                </a>
              </div>
            )}
            {data.revenueEstimate && (
              <div>
                <span className="text-gray-500">Revenue:</span> {data.revenueEstimate}
              </div>
            )}
            {data.estimatedTruckVolume && (
              <div>
                <span className="text-gray-500">Est. Trucks/Day:</span> {data.estimatedTruckVolume}
              </div>
            )}
          </div>
          {data.keyProducts && data.keyProducts.length > 0 && (
            <div className="mt-2">
              <span className="text-sm text-gray-500">Products:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.keyProducts.map((product, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-200 rounded text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
          {sources && sources.length > 0 && (
            <div className="mt-2">
              <span className="text-sm text-gray-500">Sources:</span>
              <ul className="list-disc list-inside text-xs text-gray-600 mt-1">
                {sources.map((source, i) => (
                  <li key={i}>{source}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          {expanded ? 'Show Less' : 'Show More'}
        </button>
        <div className="flex gap-2">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
            >
              Dismiss
            </button>
          )}
          {onApply && (
            <button
              onClick={onApply}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
            >
              Apply to Company
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Progress bar for batch/queue operations
 */
function ProgressBar({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label?: string;
}) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{label}</span>
          <span>{completed} / {total}</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function CompanyResearchPanel({
  companies,
  onResearchComplete,
  onBatchComplete,
  className = '',
}: CompanyResearchPanelProps) {
  const [singleCompanyName, setSingleCompanyName] = useState('');
  const [showResults, setShowResults] = useState(true);
  
  const {
    isResearching,
    isBatchResearching,
    lastResult,
    error,
    queue,
    queueProgress,
    batchProgress,
    batchResults,
    summary,
    estimate,
    research,
    buildQueue,
    runQueue,
    clearQueue,
    reset,
  } = useCompanyResearch(companies);

  // ============================================
  // Handlers
  // ============================================

  const handleSingleResearch = useCallback(async () => {
    if (!singleCompanyName.trim()) return;
    
    const result = await research({ companyName: singleCompanyName.trim() });
    onResearchComplete?.(result);
  }, [singleCompanyName, research, onResearchComplete]);

  const handleBuildQueue = useCallback(() => {
    buildQueue(companies);
  }, [buildQueue, companies]);

  const handleRunQueue = useCallback(async () => {
    const results = await runQueue();
    onBatchComplete?.(results.results);
  }, [runQueue, onBatchComplete]);

  const handleClearQueue = useCallback(() => {
    clearQueue();
    reset();
  }, [clearQueue, reset]);

  // ============================================
  // Render
  // ============================================

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Company Research
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Use AI to research company data for Primo Lookalike scoring
        </p>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
              <div className="text-xs text-gray-500">Total Companies</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{summary.fullyResearched}</div>
              <div className="text-xs text-gray-500">Fully Researched</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{summary.partiallyResearched}</div>
              <div className="text-xs text-gray-500">Partial</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{summary.notResearched}</div>
              <div className="text-xs text-gray-500">Not Researched</div>
            </div>
          </div>
        </div>
      )}

      {/* Single Company Research */}
      <div className="px-6 py-4 border-b border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Research Single Company
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={singleCompanyName}
            onChange={(e) => setSingleCompanyName(e.target.value)}
            placeholder="Enter company name..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSingleResearch()}
            disabled={isResearching}
          />
          <button
            onClick={handleSingleResearch}
            disabled={isResearching || !singleCompanyName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isResearching ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Researching...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Research
              </>
            )}
          </button>
        </div>
      </div>

      {/* Batch Research Queue */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Batch Research Queue
          </label>
          {queue.length > 0 && (
            <span className="text-xs text-gray-500">
              Est. {estimate.estimatedMinutes} min • {estimate.estimatedCost}
            </span>
          )}
        </div>

        {queue.length === 0 ? (
          <button
            onClick={handleBuildQueue}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Build Research Queue from Unenriched Companies
          </button>
        ) : (
          <div className="space-y-3">
            <ProgressBar
              completed={queueProgress.completed}
              total={queueProgress.total}
              label="Queue Progress"
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleRunQueue}
                disabled={isBatchResearching}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isBatchResearching ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing {batchProgress.completed}/{batchProgress.total}...
                  </span>
                ) : (
                  `Run Queue (${queue.filter(q => q.status === 'pending').length} pending)`
                )}
              </button>
              <button
                onClick={handleClearQueue}
                disabled={isBatchResearching}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            {/* Queue Preview */}
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1">Company</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.slice(0, 10).map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-1 truncate max-w-[200px]">{item.companyName}</td>
                      <td className="px-2 py-1">
                        <span className={`
                          ${item.status === 'completed' ? 'text-green-600' : ''}
                          ${item.status === 'failed' ? 'text-red-600' : ''}
                          ${item.status === 'in-progress' ? 'text-blue-600' : ''}
                          ${item.status === 'pending' ? 'text-gray-400' : ''}
                        `}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {queue.length > 10 && (
                    <tr>
                      <td colSpan={2} className="px-2 py-1 text-gray-500 text-center">
                        ... and {queue.length - 10} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {(lastResult || error) && showResults && (
        <div className="px-6 py-4">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Research Result
            </label>
            <button
              onClick={() => setShowResults(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Hide
            </button>
          </div>
          
          {error && !lastResult && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
              {error}
            </div>
          )}
          
          {lastResult && (
            <ResearchResultCard
              result={lastResult}
              onDismiss={() => reset()}
            />
          )}
        </div>
      )}

      {/* Batch Results Summary */}
      {batchResults && batchResults.total > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Batch Complete</span>
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">✓ {batchResults.successful} succeeded</span>
              {batchResults.failed > 0 && (
                <span className="text-red-600">✗ {batchResults.failed} failed</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyResearchPanel;
