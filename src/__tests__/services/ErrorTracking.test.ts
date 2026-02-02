/**
 * Error Tracking Service Tests
 * Sprint 903: Reliability
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initErrorTracking,
  captureException,
  setUserContext,
  errorTracking
} from '../../services/ErrorTracking';

// Mock logger since the new service uses it
vi.mock('../../../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

import { logger } from '../../../lib/logger';

describe('ErrorTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset initialized state
    // @ts-ignore - access private
    errorTracking['initialized'] = false;
    // @ts-ignore - access private
    errorTracking['user'] = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initErrorTracking', () => {
    it('initializes without errors', () => {
      expect(() => initErrorTracking()).not.toThrow();
      expect(logger.info).toHaveBeenCalledWith('Error tracking initialized');
    });
  });

  describe('captureException', () => {
    it('captures exception with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };
      
      captureException(error, context);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Test error',
        error,
        expect.objectContaining({ ...context })
      );
    });

    it('captures string errors', () => {
      const error = 'Simple error';
      
      captureException(error);
      
      expect(logger.error).toHaveBeenCalledWith(
        'Simple error',
        undefined,
        expect.anything()
      );
    });
  });

  describe('setUserContext', () => {
    it('sets user context for subsequent errors', () => {
      const user = { id: 'u1', email: 'test@example.com' };
      setUserContext(user);
      
      const error = new Error('User error');
      captureException(error);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ user })
      );
    });
  });
});
