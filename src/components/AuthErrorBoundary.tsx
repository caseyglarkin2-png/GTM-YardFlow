/**
 * T98.4: Auth Error Boundary Component
 * 
 * Catches auth-related errors and provides graceful recovery options.
 * Handles session expiry, network issues, and invalid tokens.
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogIn, Wifi, WifiOff } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type AuthErrorType = 
  | 'session_expired'
  | 'invalid_token'
  | 'network_error'
  | 'unauthorized'
  | 'unknown';

interface AuthErrorState {
  hasError: boolean;
  errorType: AuthErrorType;
  errorMessage: string;
  retryCount: number;
}

interface AuthErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorType: AuthErrorType) => void;
  onRetry?: () => void;
  maxRetries?: number;
}

// =============================================================================
// Error Classification
// =============================================================================

function classifyError(error: Error): AuthErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('expired') || message.includes('session')) {
    return 'session_expired';
  }
  if (message.includes('invalid') || message.includes('token')) {
    return 'invalid_token';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network_error';
  }
  if (message.includes('401') || message.includes('unauthorized')) {
    return 'unauthorized';
  }
  
  return 'unknown';
}

// =============================================================================
// Error UI Components
// =============================================================================

interface ErrorDisplayProps {
  errorType: AuthErrorType;
  errorMessage: string;
  onRetry: () => void;
  onLogin: () => void;
  isRetrying: boolean;
}

function ErrorDisplay({ errorType, errorMessage, onRetry, onLogin, isRetrying }: ErrorDisplayProps) {
  const getErrorConfig = () => {
    switch (errorType) {
      case 'session_expired':
        return {
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again to continue.',
          icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
          actions: ['login'],
        };
      case 'invalid_token':
        return {
          title: 'Authentication Error',
          message: 'There was a problem with your authentication. Please try logging in again.',
          icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
          actions: ['login'],
        };
      case 'network_error':
        return {
          title: 'Connection Problem',
          message: 'Unable to connect to the server. Please check your internet connection.',
          icon: <WifiOff className="w-12 h-12 text-gray-500" />,
          actions: ['retry'],
        };
      case 'unauthorized':
        return {
          title: 'Access Denied',
          message: 'You do not have permission to access this resource.',
          icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
          actions: ['login'],
        };
      default:
        return {
          title: 'Something Went Wrong',
          message: errorMessage || 'An unexpected error occurred. Please try again.',
          icon: <AlertTriangle className="w-12 h-12 text-gray-500" />,
          actions: ['retry', 'login'],
        };
    }
  };

  const config = getErrorConfig();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      {config.icon}
      
      <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
        {config.title}
      </h2>
      
      <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-md">
        {config.message}
      </p>
      
      <div className="mt-6 flex gap-3">
        {config.actions.includes('retry') && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        )}
        
        {config.actions.includes('login') && (
          <button
            onClick={onLogin}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Log In
          </button>
        )}
      </div>
      
      {/* Online status indicator */}
      <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
        {navigator.onLine ? (
          <>
            <Wifi className="w-4 h-4 text-green-500" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-500" />
            <span>Offline</span>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Error Boundary Component
// =============================================================================

export class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorState> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorType: 'unknown',
      errorMessage: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AuthErrorState> {
    return {
      hasError: true,
      errorType: classifyError(error),
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorType = classifyError(error);
    
    console.error('Auth Error Boundary caught error:', {
      error,
      errorType,
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorType);

    // Auto-retry for network errors with exponential backoff
    if (errorType === 'network_error' && this.state.retryCount < (this.props.maxRetries ?? 3)) {
      const delay = Math.pow(2, this.state.retryCount) * 1000;
      
      this.retryTimeout = setTimeout(() => {
        this.handleRetry();
      }, delay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      retryCount: prev.retryCount + 1,
    }));
    
    this.props.onRetry?.();
  };

  handleLogin = () => {
    // Clear error state and redirect to login
    this.setState({
      hasError: false,
      errorType: 'unknown',
      errorMessage: '',
      retryCount: 0,
    });
    
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorDisplay
          errorType={this.state.errorType}
          errorMessage={this.state.errorMessage}
          onRetry={this.handleRetry}
          onLogin={this.handleLogin}
          isRetrying={false}
        />
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// Hook for manual error handling
// =============================================================================

export function useAuthErrorHandler() {
  const [error, setError] = React.useState<{
    type: AuthErrorType;
    message: string;
  } | null>(null);

  const handleError = React.useCallback((err: Error) => {
    const type = classifyError(err);
    setError({ type, message: err.message });
    
    // Auto-redirect on auth errors
    if (type === 'session_expired' || type === 'unauthorized') {
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}

export default AuthErrorBoundary;
