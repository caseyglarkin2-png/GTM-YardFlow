/**
 * Alerting Module Tests
 * Sprint 200 - Production Hardening
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAlert, alertCronFailure, alertCronSuccess, AlertSeverity } from '../../../lib/alerting';

// Mock logger
vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('alerting module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Clear env vars
    delete process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_EMAIL;
    delete process.env.RAILWAY_API_URL;
    delete process.env.SERVICE_TO_SERVICE_SECRET;
    delete process.env.ALERT_ON_SUCCESS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendAlert', () => {
    it('should log to console for all severity levels', async () => {
      const { logger } = await import('../../../lib/logger');

      await sendAlert('Test info', AlertSeverity.INFO, { cronName: 'test' });
      expect(logger.info).toHaveBeenCalled();

      await sendAlert('Test warning', AlertSeverity.WARNING, { cronName: 'test' });
      expect(logger.warn).toHaveBeenCalled();

      await sendAlert('Test error', AlertSeverity.ERROR, { cronName: 'test' });
      expect(logger.error).toHaveBeenCalled();

      await sendAlert('Test critical', AlertSeverity.CRITICAL, { cronName: 'test' });
      expect(logger.error).toHaveBeenCalledTimes(2); // ERROR + CRITICAL both use error
    });

    it('should return success with console channel when no webhooks configured', async () => {
      const result = await sendAlert('Test message', AlertSeverity.INFO);

      expect(result.success).toBe(true);
      expect(result.channels).toContain('console');
      expect(result.channels).not.toContain('webhook');
      expect(result.channels).not.toContain('email');
    });

    it('should send to webhook when ALERT_WEBHOOK_URL is set', async () => {
      process.env.ALERT_WEBHOOK_URL = 'https://webhook.example.com/alerts';
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await sendAlert('Webhook test', AlertSeverity.ERROR, {
        cronName: 'test-cron',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://webhook.example.com/alerts',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(result.channels).toContain('webhook');
    });

    it('should handle webhook failure gracefully', async () => {
      process.env.ALERT_WEBHOOK_URL = 'https://webhook.example.com/alerts';
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await sendAlert('Webhook fail test', AlertSeverity.ERROR);

      expect(result.success).toBe(true); // Still succeeds via console
      expect(result.channels).toContain('console');
      expect(result.channels).not.toContain('webhook');
      expect(result.errors).toContain('Webhook failed: 500');
    });

    it('should send email for critical/error when configured', async () => {
      process.env.ALERT_EMAIL = 'admin@example.com';
      process.env.RAILWAY_API_URL = 'https://railway.example.com';
      process.env.SERVICE_TO_SERVICE_SECRET = 'test-secret';
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await sendAlert('Email test', AlertSeverity.CRITICAL, {
        cronName: 'critical-cron',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://railway.example.com/api/email/internal',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-service-key': 'test-secret',
          }),
        })
      );
      expect(result.channels).toContain('email');
    });

    it('should NOT send email for info/warning levels', async () => {
      process.env.ALERT_EMAIL = 'admin@example.com';
      process.env.RAILWAY_API_URL = 'https://railway.example.com';
      process.env.SERVICE_TO_SERVICE_SECRET = 'test-secret';

      await sendAlert('Info test', AlertSeverity.INFO);
      await sendAlert('Warning test', AlertSeverity.WARNING);

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('api/email/internal'),
        expect.anything()
      );
    });

    it('should enrich context with timestamp and environment', async () => {
      const { logger } = await import('../../../lib/logger');

      await sendAlert('Context test', AlertSeverity.INFO, { cronName: 'test' });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[ALERT:INFO]'),
        expect.objectContaining({
          cronName: 'test',
          timestamp: expect.any(String),
          environment: expect.any(String),
        })
      );
    });
  });

  describe('alertCronFailure', () => {
    it('should send ERROR alert with cron context', async () => {
      const error = new Error('Database connection failed');
      
      const result = await alertCronFailure('process-queue', error, 5000);

      expect(result.success).toBe(true);
      expect(result.channels).toContain('console');
    });

    it('should handle string errors', async () => {
      const result = await alertCronFailure('execute-sequences', 'Timeout exceeded', 10000);

      expect(result.success).toBe(true);
    });
  });

  describe('alertCronSuccess', () => {
    it('should NOT alert on success by default', async () => {
      const result = await alertCronSuccess('test-cron', { processed: 10 }, 500);

      expect(result.success).toBe(true);
      expect(result.channels).toEqual([]);
    });

    it('should alert on success when ALERT_ON_SUCCESS is set', async () => {
      process.env.ALERT_ON_SUCCESS = 'true';
      const { logger } = await import('../../../lib/logger');

      await alertCronSuccess('test-cron', { processed: 10 }, 500);

      expect(logger.info).toHaveBeenCalled();
    });
  });
});
