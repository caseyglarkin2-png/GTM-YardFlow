/**
 * Analytics Dashboard Layout Component
 * Sprint 28B - T28B.4
 * 
 * Main dashboard container with responsive grid layout.
 */

import type { ReactNode } from 'react';
import type { TimePeriod, DateRange } from '../types/analytics';
import { DateRangePicker } from './DateRangePicker';

export interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  selectedPeriod: TimePeriod;
  customRange?: DateRange;
  onPeriodChange: (period: TimePeriod) => void;
  onCustomRangeChange?: (range: DateRange) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  lastUpdated?: Date;
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({
  title = 'Analytics Dashboard',
  subtitle,
  selectedPeriod,
  customRange,
  onPeriodChange,
  onCustomRangeChange,
  onRefresh,
  onExport,
  isLoading = false,
  lastUpdated,
  children,
  className = '',
}: DashboardLayoutProps) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`} data-testid="dashboard-layout">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Title Section */}
            <div>
              <h1 className="text-xl font-bold text-gray-900" data-testid="dashboard-title">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-gray-500" data-testid="dashboard-subtitle">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <DateRangePicker
                selectedPeriod={selectedPeriod}
                customRange={customRange}
                onPeriodChange={onPeriodChange}
                onCustomRangeChange={onCustomRangeChange}
              />

              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 
                           rounded-lg transition-colors disabled:opacity-50"
                  aria-label="Refresh data"
                  data-testid="refresh-button"
                >
                  <svg 
                    className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                </button>
              )}

              {onExport && (
                <button
                  onClick={onExport}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 
                           bg-white border border-gray-300 rounded-lg hover:bg-gray-50 
                           transition-colors disabled:opacity-50"
                  data-testid="export-button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                    />
                  </svg>
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="pb-2 text-xs text-gray-400" data-testid="last-updated">
              Last updated: {lastUpdated.toLocaleString()}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading && (
          <div 
            className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center"
            data-testid="loading-overlay"
          >
            <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-lg shadow-lg">
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
              <span className="text-gray-600 font-medium">Loading...</span>
            </div>
          </div>
        )}
        
        <div data-testid="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Dashboard Section Component
// =============================================================================

export interface DashboardSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  description,
  actions,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <section className={`mb-8 ${className}`} data-testid="dashboard-section">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900" data-testid="section-title">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5" data-testid="section-description">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2" data-testid="section-actions">
            {actions}
          </div>
        )}
      </div>
      <div data-testid="section-content">
        {children}
      </div>
    </section>
  );
}

// =============================================================================
// Dashboard Card Component
// =============================================================================

export interface DashboardCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function DashboardCard({
  title,
  children,
  className = '',
  padding = 'md',
}: DashboardCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div 
      className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}
      data-testid="dashboard-card"
    >
      {title && (
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-medium text-gray-900" data-testid="card-title">
            {title}
          </h3>
        </div>
      )}
      <div className={paddingClasses[padding]} data-testid="card-content">
        {children}
      </div>
    </div>
  );
}

// =============================================================================
// Dashboard Grid Component
// =============================================================================

export interface DashboardGridProps {
  columns?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}

export function DashboardGrid({
  columns = 2,
  children,
  className = '',
}: DashboardGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div 
      className={`grid gap-6 ${gridCols[columns]} ${className}`}
      data-testid="dashboard-grid"
    >
      {children}
    </div>
  );
}
