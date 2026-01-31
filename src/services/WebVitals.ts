/**
 * Web Vitals Performance Monitoring Service
 * Sprint 300 - T300.7
 * 
 * Tracks Core Web Vitals metrics (LCP, CLS, TTFB, INP)
 * and reports them to analytics/monitoring services.
 * Note: FID was deprecated in favor of INP in web-vitals v4+
 */

import { onCLS, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';

// =============================================================================
// Types
// =============================================================================

export interface WebVitalsConfig {
  /** Report metrics to console in development */
  logToConsole?: boolean;
  /** Custom handler for metrics */
  onMetric?: (metric: WebVitalMetric) => void;
  /** Report to Sentry */
  reportToSentry?: boolean;
  /** Report to analytics */
  reportToAnalytics?: boolean;
}

export interface WebVitalMetric {
  name: 'CLS' | 'LCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

export interface WebVitalsReport {
  CLS?: WebVitalMetric;
  LCP?: WebVitalMetric;
  TTFB?: WebVitalMetric;
  INP?: WebVitalMetric;
  timestamp: number;
}

// =============================================================================
// Global State
// =============================================================================

let currentReport: WebVitalsReport = { timestamp: Date.now() };
let config: WebVitalsConfig = {};
let isInitialized = false;

// =============================================================================
// Metric Handler
// =============================================================================

function handleMetric(metric: Metric): void {
  const webVitalMetric: WebVitalMetric = {
    name: metric.name as WebVitalMetric['name'],
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  };
  
  // Update current report
  currentReport[metric.name as keyof Omit<WebVitalsReport, 'timestamp'>] = webVitalMetric;
  currentReport.timestamp = Date.now();
  
  // Log to console if enabled
  if (config.logToConsole) {
    const emoji = webVitalMetric.rating === 'good' ? '✅' : 
                  webVitalMetric.rating === 'needs-improvement' ? '⚠️' : '❌';
    console.log(
      `[WebVitals] ${emoji} ${metric.name}: ${metric.value.toFixed(2)} (${webVitalMetric.rating})`
    );
  }
  
  // Call custom handler
  if (config.onMetric) {
    config.onMetric(webVitalMetric);
  }
  
  // Report to Sentry
  if (config.reportToSentry) {
    reportToSentry(webVitalMetric);
  }
  
  // Report to analytics
  if (config.reportToAnalytics) {
    reportToAnalytics(webVitalMetric);
  }
}

// =============================================================================
// Reporting Functions
// =============================================================================

function reportToSentry(metric: WebVitalMetric): void {
  // Dynamically import Sentry to avoid circular dependencies
  import('@sentry/react').then((Sentry) => {
    Sentry.addBreadcrumb({
      category: 'web-vital',
      message: `${metric.name}: ${metric.value.toFixed(2)}`,
      level: metric.rating === 'poor' ? 'warning' : 'info',
      data: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
      },
    });
    
    // Set as measurement
    Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond');
    
    // Report poor vitals as messages
    if (metric.rating === 'poor') {
      Sentry.captureMessage(`Poor ${metric.name}: ${metric.value.toFixed(2)}`, 'warning');
    }
  }).catch(() => {
    // Sentry not available
  });
}

function reportToAnalytics(metric: WebVitalMetric): void {
  // Use Google Analytics if available
  if (typeof window !== 'undefined' && 'gtag' in window) {
    const gtag = (window as unknown as { gtag: (command: string, action: string, params: Record<string, unknown>) => void }).gtag;
    gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.rating,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      non_interaction: true,
    });
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize Web Vitals monitoring
 */
export function initWebVitals(options: WebVitalsConfig = {}): void {
  if (isInitialized) {
    console.warn('[WebVitals] Already initialized');
    return;
  }
  
  config = {
    logToConsole: import.meta.env.DEV,
    reportToSentry: true,
    reportToAnalytics: import.meta.env.PROD,
    ...options,
  };
  
  // Register metric handlers
  onCLS(handleMetric);
  onLCP(handleMetric);
  onTTFB(handleMetric);
  onINP(handleMetric);
  
  isInitialized = true;
  
  if (config.logToConsole) {
    console.log('[WebVitals] Monitoring initialized');
  }
}

/**
 * Get the current Web Vitals report
 */
export function getWebVitalsReport(): WebVitalsReport {
  return { ...currentReport };
}

/**
 * Get a specific metric value
 */
export function getMetric(name: WebVitalMetric['name']): WebVitalMetric | undefined {
  return currentReport[name];
}

/**
 * Check if all Core Web Vitals are good
 */
export function areVitalsGood(): boolean {
  const metrics = [currentReport.LCP, currentReport.INP, currentReport.CLS];
  return metrics.every(m => !m || m.rating === 'good');
}

/**
 * Get overall performance score (0-100)
 */
export function getPerformanceScore(): number {
  const metrics = [
    currentReport.LCP,
    currentReport.CLS,
    currentReport.TTFB,
    currentReport.INP,
  ].filter(Boolean) as WebVitalMetric[];
  
  if (metrics.length === 0) return 100;
  
  const scores: number[] = metrics.map(m => {
    if (m.rating === 'good') return 100;
    if (m.rating === 'needs-improvement') return 50;
    return 0;
  });
  
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Reset Web Vitals state (for testing)
 */
export function resetWebVitals(): void {
  currentReport = { timestamp: Date.now() };
  config = {};
  isInitialized = false;
}

export default {
  init: initWebVitals,
  getReport: getWebVitalsReport,
  getMetric,
  areVitalsGood,
  getPerformanceScore,
  reset: resetWebVitals,
};
