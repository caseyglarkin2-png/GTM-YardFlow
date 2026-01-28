/**
 * Dashboard Loading & Error Components
 * Sprint 28B - T28B.6
 * 
 * Skeleton loaders and error states for dashboard components.
 */

import type { ReactNode } from 'react';

// =============================================================================
// Skeleton Components
// =============================================================================

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      data-testid="skeleton"
      aria-hidden="true"
    />
  );
}

// =============================================================================
// KPI Card Skeleton
// =============================================================================

export function KPICardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${className}`}
      data-testid="kpi-card-skeleton"
    >
      <div className="flex items-start justify-between mb-3">
        <Skeleton variant="text" width={100} />
        <Skeleton variant="rectangular" width={60} height={24} />
      </div>
      <Skeleton variant="text" width={120} height={32} className="mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton variant="text" width={80} />
        <Skeleton variant="text" width={60} />
      </div>
    </div>
  );
}

export function KPIGridSkeleton({ 
  count = 4,
  columns = 4,
  className = '',
}: { 
  count?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div 
      className={`grid gap-4 ${gridCols[columns]} ${className}`}
      data-testid="kpi-grid-skeleton"
    >
      {Array.from({ length: count }).map((_, i) => (
        <KPICardSkeleton key={i} />
      ))}
    </div>
  );
}

// =============================================================================
// Chart Skeleton
// =============================================================================

export function ChartSkeleton({ 
  height = 300,
  className = '',
}: { 
  height?: number;
  className?: string;
}) {
  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${className}`}
      data-testid="chart-skeleton"
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" width={150} />
        <Skeleton variant="rectangular" width={100} height={32} />
      </div>
      <Skeleton variant="rectangular" width="100%" height={height - 80} />
    </div>
  );
}

// =============================================================================
// Leaderboard Skeleton
// =============================================================================

export function LeaderboardSkeleton({ 
  rows = 5,
  className = '',
}: { 
  rows?: number;
  className?: string;
}) {
  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}
      data-testid="leaderboard-skeleton"
    >
      <div className="px-5 py-4 border-b border-gray-100">
        <Skeleton variant="text" width={140} />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-4">
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="circular" width={40} height={40} />
            <div className="flex-1">
              <Skeleton variant="text" width={120} className="mb-2" />
              <Skeleton variant="text" width={180} height={12} />
            </div>
            <div className="text-right">
              <Skeleton variant="text" width={80} className="mb-2" />
              <Skeleton variant="text" width={100} height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Table Skeleton
// =============================================================================

export function TableSkeleton({ 
  rows = 5,
  columns = 4,
  className = '',
}: { 
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}
      data-testid="table-skeleton"
    >
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={100} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-5 py-4 flex gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" className="flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Error Components
// =============================================================================

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error while loading this content. Please try again.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div 
      className={`bg-red-50 border border-red-200 rounded-xl p-6 text-center ${className}`}
      data-testid="error-state"
      role="alert"
    >
      <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-red-800 mb-2" data-testid="error-title">
        {title}
      </h3>
      <p className="text-red-600 mb-4" data-testid="error-message">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg 
                   hover:bg-red-700 transition-colors font-medium"
          data-testid="error-retry"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          Try Again
        </button>
      )}
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = 'No data available',
  message = 'There is no data to display for the selected period.',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div 
      className={`bg-gray-50 border border-gray-200 rounded-xl p-8 text-center ${className}`}
      data-testid="empty-state"
    >
      {icon ? (
        <div className="mb-4" data-testid="empty-icon">{icon}</div>
      ) : (
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" 
            />
          </svg>
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-700 mb-2" data-testid="empty-title">
        {title}
      </h3>
      <p className="text-gray-500 mb-4" data-testid="empty-message">
        {message}
      </p>
      {action && (
        <div data-testid="empty-action">
          {action}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Loading Overlay
// =============================================================================

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: ReactNode;
  className?: string;
}

export function LoadingOverlay({
  isLoading,
  message = 'Loading...',
  children,
  className = '',
}: LoadingOverlayProps) {
  return (
    <div className={`relative ${className}`} data-testid="loading-overlay-container">
      {children}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-xl"
          data-testid="loading-overlay-active"
        >
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" cy="12" r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-600 font-medium">{message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
