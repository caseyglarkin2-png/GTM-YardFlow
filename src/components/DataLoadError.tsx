/**
 * DataLoadError Component
 *
 * Error boundary fallback UI when hitlist data fails to load.
 * Provides clear messaging and retry action.
 *
 * @module components/DataLoadError
 * @sprint T1000.4
 */

import { LazyIcon } from './icons';

interface DataLoadErrorProps {
  /** Error that caused the data load failure */
  error: Error;
  /** Callback to retry loading data */
  onRetry: () => void;
  /** Optional context about what data failed to load */
  context?: string;
}

/**
 * Display a user-friendly error when data fails to load.
 *
 * Shows:
 * - Error icon
 * - Clear error message
 * - Retry button
 * - Technical details (in development only)
 */
export function DataLoadError({
  error,
  onRetry,
  context = 'prospect data',
}: DataLoadErrorProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 dark:bg-slate-900 p-8 rounded-lg">
      {/* Error Icon */}
      <div className="text-red-500 mb-4">
        <LazyIcon name="AlertTriangle" className="h-12 w-12" />
      </div>

      {/* Main Message */}
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
        Failed to Load Data
      </h2>

      <p className="text-slate-600 dark:text-slate-400 text-center mb-4 max-w-md">
        Unable to load {context}. This might be a temporary issue.
      </p>

      {/* Retry Button */}
      <button
        onClick={onRetry}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-2"
      >
        <LazyIcon name="RefreshCw" className="h-4 w-4" />
        Retry
      </button>

      {/* Technical Details (Dev Only) */}
      {isDev && (
        <details className="mt-6 w-full max-w-lg">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
            Technical Details
          </summary>
          <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-700 dark:text-slate-300 overflow-auto">
            {error.name}: {error.message}
            {error.stack && `\n\nStack:\n${error.stack}`}
          </pre>
        </details>
      )}

      {/* Help Text */}
      <p className="mt-6 text-xs text-slate-400">
        If the problem persists, try refreshing the page or{' '}
        <a
          href="mailto:support@yardflow.io"
          className="text-blue-500 hover:underline"
        >
          contact support
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Full-page version for critical data load failures.
 * Use when the app cannot function without the data.
 */
export function DataLoadErrorFullPage({
  error,
  onRetry,
  context,
}: DataLoadErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <DataLoadError error={error} onRetry={onRetry} context={context} />
    </div>
  );
}

export default DataLoadError;
