/**
 * Research Button - YardFlow Hub
 * 
 * Inline button for researching a single company.
 * Can be used in prospect rows, company cards, etc.
 * 
 * Sprint 59: T59.2 - Research Button Component
 */

import { useState, useCallback } from 'react';
import {
  researchCompany,
  type CompanyResearchResult,
} from '../services/CompanyResearchService';
import { setEnrichmentData } from '../services/CompanyEnrichmentService';

// ============================================
// Types
// ============================================

export interface ResearchButtonProps {
  companyId: string;
  companyName: string;
  variant?: 'icon' | 'text' | 'full';
  size?: 'sm' | 'md' | 'lg';
  onComplete?: (result: CompanyResearchResult) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================
// Component
// ============================================

export function ResearchButton({
  companyId,
  companyName,
  variant = 'icon',
  size = 'md',
  onComplete,
  onError,
  disabled = false,
  className = '',
}: ResearchButtonProps) {
  const [isResearching, setIsResearching] = useState(false);
  const [result, setResult] = useState<CompanyResearchResult | null>(null);

  const handleResearch = useCallback(async () => {
    if (isResearching || disabled || !companyName) return;

    setIsResearching(true);
    setResult(null);

    try {
      const researchResult = await researchCompany({ companyName });
      setResult(researchResult);

      if (researchResult.success && researchResult.data) {
        // Auto-save to enrichment store
        setEnrichmentData(companyId, {
          facilityCount: researchResult.data.facilityCount,
          industryCategory: researchResult.data.industryCategory,
          distributionFootprint: researchResult.data.distributionFootprint,
          isYardIntensive: researchResult.data.isYardIntensive,
          estimatedTruckVolume: researchResult.data.estimatedTruckVolume,
        });
        onComplete?.(researchResult);
      } else {
        onError?.(researchResult.error || 'Research failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);
    } finally {
      setIsResearching(false);
    }
  }, [companyId, companyName, isResearching, disabled, onComplete, onError]);

  // Size classes
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Base classes
  const baseClasses = `
    inline-flex items-center justify-center gap-1
    rounded transition-colors
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  // Variant-specific rendering
  if (variant === 'icon') {
    return (
      <button
        onClick={handleResearch}
        disabled={disabled || isResearching}
        title={isResearching ? 'Researching...' : `Research ${companyName}`}
        className={`
          ${baseClasses}
          ${sizeClasses[size]}
          text-gray-500 hover:text-blue-600 hover:bg-blue-50
          ${result?.success ? 'text-green-600' : ''}
          ${result && !result.success ? 'text-red-600' : ''}
          ${className}
        `}
      >
        {isResearching ? (
          <svg className={`animate-spin ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : result?.success ? (
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </button>
    );
  }

  if (variant === 'text') {
    return (
      <button
        onClick={handleResearch}
        disabled={disabled || isResearching}
        className={`
          ${baseClasses}
          ${sizeClasses[size]}
          ${textSizes[size]}
          text-blue-600 hover:text-blue-800 hover:bg-blue-50
          ${className}
        `}
      >
        {isResearching ? (
          <>
            <svg className={`animate-spin ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Researching...
          </>
        ) : result?.success ? (
          <>
            <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Done
          </>
        ) : (
          'Research'
        )}
      </button>
    );
  }

  // Full variant with more detail
  return (
    <button
      onClick={handleResearch}
      disabled={disabled || isResearching}
      className={`
        ${baseClasses}
        px-4 py-2
        ${textSizes[size]}
        bg-blue-600 text-white hover:bg-blue-700
        ${result?.success ? 'bg-green-600 hover:bg-green-700' : ''}
        ${result && !result.success ? 'bg-red-600 hover:bg-red-700' : ''}
        ${className}
      `}
    >
      {isResearching ? (
        <>
          <svg className={`animate-spin ${iconSizes[size]}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Researching {companyName}...
        </>
      ) : result?.success ? (
        <>
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Research Complete
        </>
      ) : (
        <>
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Research {companyName}
        </>
      )}
    </button>
  );
}

export default ResearchButton;
