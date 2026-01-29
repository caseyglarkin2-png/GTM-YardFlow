/**
 * ErrorBoundary Component
 * Sprint 46 - T46.3
 * 
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Prevents a single component crash from taking down the entire app.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  
  /** Custom fallback UI to display on error */
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
  
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  
  /** Optional name for identifying which boundary caught the error */
  name?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches errors in its children
 * 
 * @example
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * @example
 * <ErrorBoundary 
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={reset}>Try Again</button>
 *     </div>
 *   )}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, name } = this.props;
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary${name ? `: ${name}` : ''}] Caught error:`, error);
      console.error('Component stack:', errorInfo.componentStack);
    }
    
    // Call custom error handler
    onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, name } = this.props;

    if (hasError && error) {
      // Custom fallback
      if (typeof fallback === 'function') {
        return fallback(error, this.resetError);
      }
      if (fallback) {
        return fallback;
      }
      
      // Default fallback UI
      return (
        <div 
          role="alert"
          className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
        >
          <svg 
            className="w-12 h-12 text-red-500 mb-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Something went wrong{name ? ` in ${name}` : ''}
          </h2>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4 text-center max-w-md">
            {error.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.resetError}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Try Again
          </button>
          {import.meta.env.DEV && (
            <details className="mt-4 text-xs text-red-500 dark:text-red-400 max-w-full overflow-auto">
              <summary className="cursor-pointer">Technical Details</summary>
              <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

/**
 * Simple error fallback component for use with ErrorBoundary
 */
export function ErrorFallback({ 
  error, 
  resetError,
  title = 'Something went wrong' 
}: { 
  error?: Error; 
  resetError?: () => void;
  title?: string;
}): JSX.Element {
  return (
    <div 
      role="alert"
      className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
    >
      <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
        {title}
      </h3>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
          {error.message}
        </p>
      )}
      {resetError && (
        <button
          onClick={resetError}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
