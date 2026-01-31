/**
 * Web Vitals Service Tests
 * Sprint 300 - T300.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store captured handlers
let capturedHandlers: Record<string, (metric: unknown) => void> = {};

// Mock web-vitals module with factory function
vi.mock('web-vitals', () => ({
  onCLS: vi.fn((handler: (metric: unknown) => void) => { capturedHandlers.onCLS = handler; }),
  onLCP: vi.fn((handler: (metric: unknown) => void) => { capturedHandlers.onLCP = handler; }),
  onTTFB: vi.fn((handler: (metric: unknown) => void) => { capturedHandlers.onTTFB = handler; }),
  onINP: vi.fn((handler: (metric: unknown) => void) => { capturedHandlers.onINP = handler; }),
}));

// Import after mocking
import {
  initWebVitals,
  getWebVitalsReport,
  getMetric,
  areVitalsGood,
  getPerformanceScore,
  resetWebVitals,
} from '../../services/WebVitals';
import { onCLS, onLCP, onTTFB, onINP } from 'web-vitals';

describe('WebVitals', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capturedHandlers = {};
    resetWebVitals();
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initWebVitals', () => {
    it('registers all metric handlers', () => {
      initWebVitals();
      
      expect(onCLS).toHaveBeenCalledTimes(1);
      expect(onLCP).toHaveBeenCalledTimes(1);
      expect(onTTFB).toHaveBeenCalledTimes(1);
      expect(onINP).toHaveBeenCalledTimes(1);
    });

    it('warns on double initialization', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      initWebVitals();
      initWebVitals();
      
      expect(warnSpy).toHaveBeenCalledWith('[WebVitals] Already initialized');
    });

    it('logs initialization in dev mode', () => {
      initWebVitals({ logToConsole: true });
      
      expect(consoleLogSpy).toHaveBeenCalledWith('[WebVitals] Monitoring initialized');
    });

    it('calls custom onMetric handler', () => {
      const onMetric = vi.fn();
      initWebVitals({ onMetric });
      
      // Simulate a metric being reported
      capturedHandlers.onLCP({
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        id: 'test-id',
        navigationType: 'navigate',
      });
      
      expect(onMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'LCP',
          value: 2000,
          rating: 'good',
        })
      );
    });
  });

  describe('getWebVitalsReport', () => {
    it('returns empty report initially', () => {
      const report = getWebVitalsReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.LCP).toBeUndefined();
      expect(report.INP).toBeUndefined();
      expect(report.CLS).toBeUndefined();
    });

    it('returns report with metrics after they are captured', () => {
      initWebVitals();
      
      // Simulate LCP metric
      capturedHandlers.onLCP({
        name: 'LCP',
        value: 1500,
        rating: 'good',
        delta: 1500,
        id: 'lcp-1',
        navigationType: 'navigate',
      });
      
      const report = getWebVitalsReport();
      
      expect(report.LCP).toBeDefined();
      expect(report.LCP?.value).toBe(1500);
      expect(report.LCP?.rating).toBe('good');
    });

    it('returns a copy of the report', () => {
      const report1 = getWebVitalsReport();
      const report2 = getWebVitalsReport();
      
      expect(report1).not.toBe(report2);
    });
  });

  describe('getMetric', () => {
    it('returns undefined for uncaptured metric', () => {
      expect(getMetric('LCP')).toBeUndefined();
    });

    it('returns metric after capture', () => {
      initWebVitals();
      
      capturedHandlers.onCLS({
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'cls-1',
        navigationType: 'navigate',
      });
      
      const metric = getMetric('CLS');
      
      expect(metric).toBeDefined();
      expect(metric?.value).toBe(0.05);
    });
  });

  describe('areVitalsGood', () => {
    it('returns true when no metrics captured', () => {
      expect(areVitalsGood()).toBe(true);
    });

    it('returns true when all core vitals are good', () => {
      initWebVitals();
      
      // Simulate good metrics (LCP, INP, CLS are core vitals as of 2024)
      capturedHandlers.onLCP({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: '1', navigationType: 'navigate' });
      capturedHandlers.onINP({ name: 'INP', value: 50, rating: 'good', delta: 50, id: '2', navigationType: 'navigate' });
      capturedHandlers.onCLS({ name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: '3', navigationType: 'navigate' });
      
      expect(areVitalsGood()).toBe(true);
    });

    it('returns false when any core vital is poor', () => {
      initWebVitals();
      
      capturedHandlers.onLCP({ name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: '1', navigationType: 'navigate' });
      
      expect(areVitalsGood()).toBe(false);
    });
  });

  describe('getPerformanceScore', () => {
    it('returns 100 when no metrics captured', () => {
      expect(getPerformanceScore()).toBe(100);
    });

    it('returns 100 when all metrics are good', () => {
      initWebVitals();
      
      capturedHandlers.onLCP({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: '1', navigationType: 'navigate' });
      capturedHandlers.onCLS({ name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, id: '2', navigationType: 'navigate' });
      
      expect(getPerformanceScore()).toBe(100);
    });

    it('returns 50 for needs-improvement metrics', () => {
      initWebVitals();
      
      capturedHandlers.onLCP({ name: 'LCP', value: 3000, rating: 'needs-improvement', delta: 3000, id: '1', navigationType: 'navigate' });
      
      expect(getPerformanceScore()).toBe(50);
    });

    it('returns 0 for poor metrics', () => {
      initWebVitals();
      
      capturedHandlers.onLCP({ name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: '1', navigationType: 'navigate' });
      
      expect(getPerformanceScore()).toBe(0);
    });

    it('averages scores across multiple metrics', () => {
      initWebVitals();
      
      capturedHandlers.onLCP({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: '1', navigationType: 'navigate' });
      capturedHandlers.onCLS({ name: 'CLS', value: 0.3, rating: 'poor', delta: 0.3, id: '2', navigationType: 'navigate' });
      
      // (100 + 0) / 2 = 50
      expect(getPerformanceScore()).toBe(50);
    });
  });

  describe('resetWebVitals', () => {
    it('clears all captured metrics', () => {
      initWebVitals();
      
      capturedHandlers.onLCP({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: '1', navigationType: 'navigate' });
      
      expect(getMetric('LCP')).toBeDefined();
      
      resetWebVitals();
      
      expect(getMetric('LCP')).toBeUndefined();
    });

    it('allows reinitialization', () => {
      initWebVitals();
      resetWebVitals();
      
      expect(() => initWebVitals()).not.toThrow();
      expect(onLCP).toHaveBeenCalledTimes(2);
    });
  });

  describe('metric logging', () => {
    it('logs metrics with correct emoji for good rating', () => {
      initWebVitals({ logToConsole: true });
      
      capturedHandlers.onLCP({ name: 'LCP', value: 2000, rating: 'good', delta: 2000, id: '1', navigationType: 'navigate' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅')
      );
    });

    it('logs metrics with correct emoji for needs-improvement rating', () => {
      initWebVitals({ logToConsole: true });
      
      capturedHandlers.onLCP({ name: 'LCP', value: 3000, rating: 'needs-improvement', delta: 3000, id: '1', navigationType: 'navigate' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
    });

    it('logs metrics with correct emoji for poor rating', () => {
      initWebVitals({ logToConsole: true });
      
      capturedHandlers.onLCP({ name: 'LCP', value: 5000, rating: 'poor', delta: 5000, id: '1', navigationType: 'navigate' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌')
      );
    });
  });
});
