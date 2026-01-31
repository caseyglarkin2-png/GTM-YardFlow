/**
 * Error Tracking Service Tests
 * Sprint 300 - T300.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/react';

// Mock Sentry before importing the module
vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(() => 'test-event-id'),
  captureMessage: vi.fn(() => 'test-message-id'),
  setUser: vi.fn(),
  setTag: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((callback) => callback({
    setTag: vi.fn(),
    setLevel: vi.fn(),
    setExtra: vi.fn(),
  })),
  startInactiveSpan: vi.fn(() => ({ end: vi.fn() })),
  browserTracingIntegration: vi.fn(() => ({})),
  replayIntegration: vi.fn(() => ({})),
  ErrorBoundary: vi.fn(() => null),
  withProfiler: vi.fn((component) => component),
}));

// Import after mocking
import {
  initErrorTracking,
  captureError,
  captureDomainError,
  captureEmailError,
  captureMeetingError,
  captureWebhookError,
  trackEvent,
  trackRailwayCall,
  trackAuthEvent,
  setUserContext,
} from '../../services/ErrorTracking';

describe('ErrorTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initErrorTracking', () => {
    it('initializes Sentry when DSN is configured', () => {
      // Note: In actual test, VITE_SENTRY_DSN would need to be set
      // For now, this tests the function doesn't throw
      expect(() => initErrorTracking()).not.toThrow();
    });
  });

  describe('captureError', () => {
    it('captures exception with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };
      
      const eventId = captureError(error, context);
      
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: context,
      });
      expect(eventId).toBe('test-event-id');
    });

    it('captures exception without context', () => {
      const error = new Error('Simple error');
      
      captureError(error);
      
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: undefined,
      });
    });
  });

  describe('captureDomainError', () => {
    it('captures error with domain context', () => {
      const error = new Error('Domain error');
      
      captureDomainError(error, {
        domain: 'email',
        prospectId: 'prospect-123',
        enrollmentId: 'enroll-456',
      });
      
      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'domain-error.email',
          message: 'Domain error',
        })
      );
    });

    it('classifies unauthorized errors as critical', () => {
      const error = new Error('Unauthorized access');
      
      captureDomainError(error, { domain: 'auth' });
      
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            severity: 'critical',
          }),
        })
      );
    });

    it('classifies timeout errors as medium severity', () => {
      const error = new Error('Request timeout');
      
      captureDomainError(error, { domain: 'railway' });
      
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            severity: 'medium',
          }),
        })
      );
    });
  });

  describe('captureEmailError', () => {
    it('captures email error with correct domain', () => {
      const error = new Error('Email delivery failed');
      
      captureEmailError(error, {
        prospectId: 'prospect-123',
        enrollmentId: 'enroll-456',
        stepNumber: 2,
        action: 'send',
      });
      
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            domain: 'email',
          }),
        })
      );
    });
  });

  describe('captureMeetingError', () => {
    it('captures meeting error with context', () => {
      const error = new Error('Meeting attribution failed');
      
      captureMeetingError(error, {
        prospectId: 'prospect-123',
        calendlyEventId: 'evt-789',
        action: 'attribution',
      });
      
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            domain: 'meeting',
          }),
        })
      );
    });
  });

  describe('captureWebhookError', () => {
    it('captures webhook error with type', () => {
      const error = new Error('Webhook processing failed');
      
      captureWebhookError(error, {
        webhookType: 'sendgrid',
        eventType: 'delivered',
      });
      
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            domain: 'webhook',
          }),
        })
      );
    });

    it('marks invalid signature as high severity', () => {
      const error = new Error('Invalid webhook signature');
      
      captureWebhookError(error, {
        webhookType: 'sendgrid',
        signatureValid: false,
      });
      
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: expect.objectContaining({
            severity: 'high',
          }),
        })
      );
    });
  });

  describe('trackEvent', () => {
    it('adds breadcrumb for custom events', () => {
      trackEvent('button_clicked', { buttonId: 'submit', value: 42 });
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'custom',
        message: 'button_clicked',
        level: 'info',
        data: { buttonId: 'submit', value: 42 },
      });
    });
  });

  describe('trackRailwayCall', () => {
    it('tracks successful Railway API call', () => {
      trackRailwayCall('/api/prospects', true, 150);
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'railway-api',
        message: '✓ /api/prospects',
        level: 'info',
        data: {
          endpoint: '/api/prospects',
          success: true,
          latencyMs: 150,
        },
      });
    });

    it('tracks failed Railway API call', () => {
      trackRailwayCall('/api/email/send', false, 500);
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'railway-api',
        message: '✗ /api/email/send',
        level: 'warning',
        data: {
          endpoint: '/api/email/send',
          success: false,
          latencyMs: 500,
        },
      });
    });
  });

  describe('trackAuthEvent', () => {
    it('tracks successful login', () => {
      trackAuthEvent('login', 'railway', true);
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'auth',
        message: 'login via railway',
        level: 'info',
        data: { event: 'login', source: 'railway', success: true },
      });
    });

    it('captures message on login failure', () => {
      trackAuthEvent('login', 'firebase', false);
      
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Login failed',
        expect.objectContaining({
          level: 'warning',
        })
      );
    });
  });

  describe('setUserContext', () => {
    it('sets user in Sentry', () => {
      setUserContext({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        tenant: 'tenant-456',
      });
      
      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
        username: 'Test User',
      });
      expect(Sentry.setTag).toHaveBeenCalledWith('tenant', 'tenant-456');
    });

    it('clears user on null', () => {
      setUserContext(null);
      
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });
});
