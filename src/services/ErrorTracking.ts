/**
 * T100.2: Error Tracking Service
 * 
 * Centralized error tracking using Sentry for production monitoring.
 * Includes performance monitoring, user context, and custom event tracking.
 */

import * as Sentry from '@sentry/react';
import { featureFlags } from '../config/featureFlags';

// =============================================================================
// Configuration
// =============================================================================

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_ENV || 'development';
const RELEASE = import.meta.env.VITE_APP_VERSION || '1.0.0';

// =============================================================================
// Initialization
// =============================================================================

export function initErrorTracking(): void {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `yardflow-gtm@${RELEASE}`,
    
    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    
    // Sample rates
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Filter out noisy errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      
      // User-triggered
      'ResizeObserver loop',
      'AbortError',
      
      // Firebase (will be removed after migration)
      'Firebase: Error',
    ],
    
    // Filter transactions
    beforeSend(event) {
      // Don't send in development
      if (ENVIRONMENT === 'development') {
        console.log('[Sentry] Would send:', event);
        return null;
      }
      
      return event;
    },
    
    // Custom tags
    initialScope: {
      tags: {
        railwayEnabled: String(featureFlags.RAILWAY_ENABLED),
        railwayAuth: String(featureFlags.RAILWAY_AUTH_ENABLED),
      },
    },
  });

  console.log(`[Sentry] Initialized for ${ENVIRONMENT}`);
}

// =============================================================================
// User Context
// =============================================================================

export interface UserContext {
  id: string;
  email?: string;
  name?: string;
  tenant?: string;
}

export function setUserContext(user: UserContext | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
    
    if (user.tenant) {
      Sentry.setTag('tenant', user.tenant);
    }
  } else {
    Sentry.setUser(null);
  }
}

// =============================================================================
// Error Tracking
// =============================================================================

/**
 * Error domains for classification
 */
export type ErrorDomain = 
  | 'email'        // Email sending, tracking, sequences
  | 'auth'         // Authentication, session management
  | 'railway'      // Railway API communication
  | 'database'     // Firestore operations
  | 'meeting'      // Calendly, meeting attribution
  | 'webhook'      // Webhook processing
  | 'general';     // Uncategorized

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Domain-specific error context
 */
export interface DomainErrorContext {
  domain: ErrorDomain;
  severity?: ErrorSeverity;
  prospectId?: string;
  enrollmentId?: string;
  emailId?: string;
  webhookType?: string;
  endpoint?: string;
  [key: string]: unknown;
}

/**
 * Determine error severity based on domain and error type
 */
function classifyErrorSeverity(domain: ErrorDomain, error: Error): ErrorSeverity {
  const errorMessage = error.message.toLowerCase();
  
  // Critical: Payment, auth failures, data corruption
  if (errorMessage.includes('unauthorized') || 
      errorMessage.includes('forbidden') ||
      errorMessage.includes('data corruption')) {
    return 'critical';
  }
  
  // High: Email delivery failures, webhook processing errors
  if (domain === 'email' && errorMessage.includes('delivery failed')) {
    return 'high';
  }
  if (domain === 'webhook' && errorMessage.includes('signature')) {
    return 'high';
  }
  
  // Medium: API timeouts, rate limits
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429')) {
    return 'medium';
  }
  
  // Default to low for other errors
  return 'low';
}

export function captureError(
  error: Error,
  context?: Record<string, unknown>
): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture error with domain-specific context and classification
 */
export function captureDomainError(
  error: Error,
  context: DomainErrorContext
): string {
  const severity = context.severity || classifyErrorSeverity(context.domain, error);
  
  // Set domain and severity tags
  Sentry.withScope((scope) => {
    scope.setTag('error.domain', context.domain);
    scope.setTag('error.severity', severity);
    
    // Set level based on severity
    scope.setLevel(severity === 'critical' ? 'fatal' : 
                   severity === 'high' ? 'error' : 
                   severity === 'medium' ? 'warning' : 'info');
    
    // Add all context as extra data
    Object.entries(context).forEach(([key, value]) => {
      if (key !== 'domain' && key !== 'severity') {
        scope.setExtra(key, value);
      }
    });
  });
  
  // Add breadcrumb for context
  Sentry.addBreadcrumb({
    category: `domain-error.${context.domain}`,
    message: error.message,
    level: severity === 'critical' || severity === 'high' ? 'error' : 'warning',
    data: context,
  });
  
  return Sentry.captureException(error, {
    extra: context,
    tags: {
      domain: context.domain,
      severity,
    },
  });
}

/**
 * Capture email-related errors with proper context
 */
export function captureEmailError(
  error: Error,
  context: {
    prospectId?: string;
    enrollmentId?: string;
    emailId?: string;
    stepNumber?: number;
    action?: 'send' | 'track' | 'bounce' | 'reply';
  }
): string {
  return captureDomainError(error, {
    domain: 'email',
    ...context,
  });
}

/**
 * Capture meeting/scheduling errors
 */
export function captureMeetingError(
  error: Error,
  context: {
    prospectId?: string;
    calendlyEventId?: string;
    action?: 'create' | 'cancel' | 'reschedule' | 'attribution';
  }
): string {
  return captureDomainError(error, {
    domain: 'meeting',
    ...context,
  });
}

/**
 * Capture webhook processing errors
 */
export function captureWebhookError(
  error: Error,
  context: {
    webhookType: 'sendgrid' | 'calendly' | 'inbound';
    eventType?: string;
    signatureValid?: boolean;
  }
): string {
  return captureDomainError(error, {
    domain: 'webhook',
    severity: context.signatureValid === false ? 'high' : undefined,
    ...context,
  });
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

// =============================================================================
// Custom Events
// =============================================================================

export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>
): void {
  Sentry.addBreadcrumb({
    category: 'custom',
    message: name,
    level: 'info',
    data,
  });
}

// Track Railway API calls
export function trackRailwayCall(
  endpoint: string,
  success: boolean,
  latencyMs: number
): void {
  Sentry.addBreadcrumb({
    category: 'railway-api',
    message: `${success ? '✓' : '✗'} ${endpoint}`,
    level: success ? 'info' : 'warning',
    data: {
      endpoint,
      success,
      latencyMs,
    },
  });
}

// Track auth events
export function trackAuthEvent(
  event: 'login' | 'logout' | 'refresh' | 'error',
  source: 'railway' | 'firebase',
  success: boolean
): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: `${event} via ${source}`,
    level: success ? 'info' : 'warning',
    data: { event, source, success },
  });
  
  if (!success && event === 'login') {
    captureMessage('Login failed', 'warning', { source });
  }
}

// =============================================================================
// Performance Monitoring
// =============================================================================

export function startTransaction(
  name: string,
  op: string = 'custom'
): ReturnType<typeof Sentry.startInactiveSpan> {
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

// =============================================================================
// Error Boundary Integration
// =============================================================================

export const SentryErrorBoundary = Sentry.ErrorBoundary;

export function withProfiler<P extends object>(
  Component: React.ComponentType<P>,
  name?: string
): React.ComponentType<P> {
  return Sentry.withProfiler(Component, { name });
}

// =============================================================================
// Exports
// =============================================================================

export { Sentry };

export default {
  init: initErrorTracking,
  setUser: setUserContext,
  captureError,
  captureDomainError,
  captureEmailError,
  captureMeetingError,
  captureWebhookError,
  captureMessage,
  trackEvent,
  trackRailwayCall,
  trackAuthEvent,
  startTransaction,
  ErrorBoundary: SentryErrorBoundary,
  withProfiler,
};
