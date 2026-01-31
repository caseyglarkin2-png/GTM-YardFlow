/**
 * Logger Tests
 * Sprint 300 - T300.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  createLogger,
  logRequest,
  logResponse,
  generateRequestId,
  createRequestLogger,
  type LogLevel,
} from '../../../lib/logger';

describe('Logger', () => {
  let consoleSpy: {
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Logger class', () => {
    it('creates logger with endpoint context', () => {
      const logger = createLogger('/api/test');
      logger.info('Test message');

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logOutput.endpoint).toBe('/api/test');
      expect(logOutput.message).toBe('Test message');
    });

    it('creates child logger with additional context', () => {
      const logger = createLogger('/api/test');
      const childLogger = logger.withUser('user-123').withRequestId('req-456');
      childLogger.info('Child message');

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logOutput.userId).toBe('user-123');
      expect(logOutput.requestId).toBe('req-456');
    });

    it('logs error with stack trace', () => {
      const logger = createLogger('/api/test');
      const error = new Error('Test error');
      logger.error('An error occurred', error);

      expect(consoleSpy.error).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(logOutput.level).toBe('error');
      expect(logOutput.error).toBe('Test error');
      expect(logOutput.stack).toBeDefined();
    });

    it('redacts sensitive fields', () => {
      const logger = createLogger('/api/test');
      logger.info('Request', {
        password: 'secret123',
        apiKey: 'key-xyz',
        authorization: 'Bearer token',
        normalField: 'visible',
      });

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logOutput.context.password).toBe('[REDACTED]');
      expect(logOutput.context.apiKey).toBe('[REDACTED]');
      expect(logOutput.context.authorization).toBe('[REDACTED]');
      expect(logOutput.context.normalField).toBe('visible');
    });

    it('outputs valid JSON', () => {
      const logger = createLogger('/api/test');
      logger.info('JSON test', { key: 'value', number: 42 });

      const output = consoleSpy.info.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('logRequest', () => {
    it('logs request with all metadata', () => {
      const logger = createLogger('/api/prospects');
      const requestId = 'req-test-123';

      logRequest(logger, {
        method: 'POST',
        path: '/api/prospects',
        query: { limit: '10' },
        userAgent: 'TestAgent/1.0',
        ip: '127.0.0.1',
        contentLength: 256,
      }, requestId);

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logOutput.message).toBe('Request received');
      expect(logOutput.requestId).toBe(requestId);
      expect(logOutput.context.method).toBe('POST');
      expect(logOutput.context.path).toBe('/api/prospects');
    });

    it('sanitizes request headers', () => {
      const logger = createLogger('/api/test');

      logRequest(logger, {
        method: 'GET',
        path: '/api/test',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer secret-token',
          'x-api-key': 'api-secret',
        },
      }, 'req-123');

      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logOutput.context.headers['content-type']).toBe('application/json');
      expect(logOutput.context.headers['authorization']).toBe('[REDACTED]');
    });
  });

  describe('logResponse', () => {
    it('logs successful response as info', () => {
      const logger = createLogger('/api/test');

      logResponse(logger, {
        status: 200,
        durationMs: 150,
        contentLength: 1024,
      }, 'req-123');

      expect(consoleSpy.info).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(logOutput.message).toBe('Request completed');
      expect(logOutput.context.status).toBe(200);
      expect(logOutput.context.durationMs).toBe(150);
    });

    it('logs 4xx response as warning', () => {
      const logger = createLogger('/api/test');

      logResponse(logger, {
        status: 404,
        durationMs: 50,
        error: 'Not found',
      }, 'req-123');

      expect(consoleSpy.warn).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
      expect(logOutput.message).toBe('Request error');
      expect(logOutput.context.status).toBe(404);
    });

    it('logs 5xx response as error', () => {
      const logger = createLogger('/api/test');

      logResponse(logger, {
        status: 500,
        durationMs: 200,
        error: 'Internal server error',
      }, 'req-123');

      expect(consoleSpy.error).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(logOutput.message).toBe('Request failed');
      expect(logOutput.context.status).toBe(500);
    });
  });

  describe('generateRequestId', () => {
    it('generates unique request IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });

    it('generates IDs with req_ prefix', () => {
      const id = generateRequestId();
      expect(id.startsWith('req_')).toBe(true);
    });
  });

  describe('createRequestLogger', () => {
    it('creates logger with timing tracking', async () => {
      const reqLogger = createRequestLogger('/api/test');
      
      expect(reqLogger.logger).toBeInstanceOf(Logger);
      expect(reqLogger.requestId).toMatch(/^req_/);
      expect(typeof reqLogger.startTime).toBe('number');
    });

    it('logs start and end with duration', async () => {
      const reqLogger = createRequestLogger('/api/test');
      
      reqLogger.logStart({
        method: 'GET',
        path: '/api/test',
      });
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 5));
      
      reqLogger.logEnd(200);

      expect(consoleSpy.info).toHaveBeenCalledTimes(2);
      
      const startLog = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(startLog.message).toBe('Request received');
      
      const endLog = JSON.parse(consoleSpy.info.mock.calls[1][0] as string);
      expect(endLog.message).toBe('Request completed');
      expect(endLog.context.durationMs).toBeGreaterThanOrEqual(0); // Just verify it exists
      expect(typeof endLog.context.durationMs).toBe('number');
    });
  });
});
