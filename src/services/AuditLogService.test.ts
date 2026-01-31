/**
 * Tests for AuditLogService
 * 
 * Sprint 3 T3.6: Unit tests for audit logging
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  AuditLogService, 
  CronExecutionContext,
  getAuditLogService,
  startCronAudit,
  logAudit,
  type AuditLogEntry 
} from './AuditLogService';

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    service = new AuditLogService();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log', () => {
    it('should create log entry with correct structure', async () => {
      const id = await service.log('info', 'cron', 'test_action', 'Test message');
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should log to console with correct level', async () => {
      await service.log('info', 'cron', 'test', 'Info message');
      expect(console.log).toHaveBeenCalled();

      await service.log('warn', 'system', 'test', 'Warn message');
      expect(console.warn).toHaveBeenCalled();

      await service.log('error', 'webhook', 'test', 'Error message');
      expect(console.error).toHaveBeenCalled();

      await service.log('debug', 'auth', 'test', 'Debug message');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should include context in log entry', async () => {
      await service.log('info', 'sequence', 'enroll', 'Enrolled prospect', {
        enrollmentId: 'enr-123',
        sequenceId: 'seq-456',
        metadata: { prospectName: 'John Doe' },
      });

      // Verify console was called with the message
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('SEQUENCE:enroll'),
        'Enrolled prospect'
      );
    });
  });

  describe('convenience methods', () => {
    it('should have info method', async () => {
      const id = await service.info('cron', 'start', 'Cron started');
      expect(id).toBeDefined();
    });

    it('should have warn method', async () => {
      const id = await service.warn('system', 'config', 'Config warning');
      expect(id).toBeDefined();
    });

    it('should have error method', async () => {
      const id = await service.error('email', 'send_failed', 'Email failed to send');
      expect(id).toBeDefined();
    });

    it('should have debug method', async () => {
      const id = await service.debug('sync', 'fetch', 'Fetching data');
      expect(id).toBeDefined();
    });
  });

  describe('logSequenceEvent', () => {
    it('should log enrollment event', async () => {
      const id = await service.logSequenceEvent(
        'enroll',
        'enr-123',
        'seq-456',
        'Prospect enrolled in sequence'
      );

      expect(id).toBeDefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('SEQUENCE:enroll'),
        'Prospect enrolled in sequence'
      );
    });

    it('should log step events', async () => {
      await service.logSequenceEvent('step_sent', 'enr-123', 'seq-456', 'Step 1 sent');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('step_sent'),
        'Step 1 sent'
      );
    });
  });

  describe('logEmailEvent', () => {
    it('should log email send event', async () => {
      const id = await service.logEmailEvent('send', 'email-123', 'Email queued');
      expect(id).toBeDefined();
    });

    it('should log email delivery event', async () => {
      const id = await service.logEmailEvent('deliver', 'email-123', 'Email delivered');
      expect(id).toBeDefined();
    });
  });

  describe('logWebhookEvent', () => {
    it('should log successful webhook', async () => {
      const id = await service.logWebhookEvent('received', 'sendgrid', 'Webhook received');
      expect(id).toBeDefined();
    });

    it('should log failed webhook as error', async () => {
      await service.logWebhookEvent('failed', 'calendly', 'Webhook processing failed');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('startCronExecution', () => {
    it('should return CronExecutionContext', () => {
      const context = service.startCronExecution('process-queue');
      
      expect(context).toBeInstanceOf(CronExecutionContext);
    });

    it('should log cron start', () => {
      service.startCronExecution('execute-sequences');
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('CRON:execution_start'),
        expect.stringContaining('execute-sequences')
      );
    });
  });
});

describe('CronExecutionContext', () => {
  let service: AuditLogService;

  beforeEach(() => {
    service = new AuditLogService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordItem', () => {
    it('should track successful items', async () => {
      const context = service.startCronExecution('test-cron');
      
      context.recordItem(true);
      context.recordItem(true);
      context.recordItem(false);

      await context.complete();

      // Should have logged completion
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('CRON:execution_complete'),
        expect.stringContaining('completed successfully')
      );
    });
  });

  describe('addResult', () => {
    it('should store result data', async () => {
      const context = service.startCronExecution('test-cron');
      
      context.addResult('emailsSent', 10);
      context.addResult('enrollmentsProcessed', 5);

      await context.complete({ additionalData: true });

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should log successful completion', async () => {
      const context = service.startCronExecution('process-queue');
      
      await context.complete();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('execution_complete'),
        expect.stringContaining('completed successfully')
      );
    });
  });

  describe('fail', () => {
    it('should log failure with error message', async () => {
      const context = service.startCronExecution('process-queue');
      
      await context.fail('Database connection failed');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('execution_complete'),
        expect.stringContaining('failed'),
        'Database connection failed'
      );
    });

    it('should handle Error objects', async () => {
      const context = service.startCronExecution('test-cron');
      const error = new Error('Something went wrong');

      await context.fail(error);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('execution_complete'),
        expect.any(String),
        'Something went wrong'
      );
    });
  });
});

describe('Module exports', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuditLogService', () => {
    it('should return singleton instance', () => {
      const instance1 = getAuditLogService();
      const instance2 = getAuditLogService();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('logAudit', () => {
    it('should log via singleton', async () => {
      const id = await logAudit('info', 'cron', 'test', 'Test message');
      expect(id).toBeDefined();
    });
  });

  describe('startCronAudit', () => {
    it('should return context from singleton', () => {
      const context = startCronAudit('test-cron');
      expect(context).toBeInstanceOf(CronExecutionContext);
    });
  });
});
