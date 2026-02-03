/**
 * SuppressionSyncService Tests
 * 
 * Sprint 301: T301.3 - Suppression sync coverage
 * Tests syncing suppression lists between SendGrid and local compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuppressionSyncService } from '@/services/SuppressionSyncService';
import type { SendGridClient } from '@/services/SendGridClient';
import type { EmailComplianceService } from '@/services/EmailComplianceService';
import type { Firestore } from 'firebase-admin/firestore';

describe('SuppressionSyncService', () => {
  let mockSendGrid: {
    listSuppressions: ReturnType<typeof vi.fn>;
    addToSuppression: ReturnType<typeof vi.fn>;
  };
  let mockCompliance: {
    isOnSuppressionList: ReturnType<typeof vi.fn>;
    addToSuppressionList: ReturnType<typeof vi.fn>;
  };
  let mockDb: {
    collection: ReturnType<typeof vi.fn>;
  };
  const mockCollectionRef = {
    get: vi.fn(),
  };
  let service: SuppressionSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSendGrid = {
      listSuppressions: vi.fn(),
      addToSuppression: vi.fn(),
    };
    
    mockCompliance = {
      isOnSuppressionList: vi.fn(),
      addToSuppressionList: vi.fn(),
    };

    mockDb = {
      collection: vi.fn(() => mockCollectionRef),
    };
    
    service = new SuppressionSyncService(
      mockSendGrid as unknown as SendGridClient,
      mockCompliance as unknown as EmailComplianceService,
      mockDb as unknown as Firestore,
    );
  });

  describe('syncFromSendGrid', () => {
    it('imports all new suppressions from SendGrid', async () => {
      mockSendGrid.listSuppressions.mockResolvedValue([
        'bounced@example.com',
        'unsubscribed@example.com',
        'spam@example.com',
      ]);
      
      // None are on suppression list yet
      mockCompliance.isOnSuppressionList.mockResolvedValue(false);
      mockCompliance.addToSuppressionList.mockResolvedValue(undefined);

      const result = await service.syncFromSendGrid();

      expect(result.imported).toBe(3);
      expect(result.total).toBe(3);
      expect(mockCompliance.addToSuppressionList).toHaveBeenCalledTimes(3);
      expect(mockCompliance.addToSuppressionList).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'bounced@example.com',
          reason: 'manual',
          source: 'sendgrid',
        })
      );
    });

    it('skips emails already on suppression list', async () => {
      mockSendGrid.listSuppressions.mockResolvedValue([
        'existing@example.com',
        'new@example.com',
      ]);
      
      // First is already suppressed
      mockCompliance.isOnSuppressionList
        .mockResolvedValueOnce(true)  // existing@example.com
        .mockResolvedValueOnce(false); // new@example.com
      mockCompliance.addToSuppressionList.mockResolvedValue(undefined);

      const result = await service.syncFromSendGrid();

      expect(result.imported).toBe(1);
      expect(result.total).toBe(2);
      expect(mockCompliance.addToSuppressionList).toHaveBeenCalledTimes(1);
      expect(mockCompliance.addToSuppressionList).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' })
      );
    });

    it('returns zero imported when all emails already exist', async () => {
      mockSendGrid.listSuppressions.mockResolvedValue([
        'existing1@example.com',
        'existing2@example.com',
      ]);
      
      // All already suppressed
      mockCompliance.isOnSuppressionList.mockResolvedValue(true);

      const result = await service.syncFromSendGrid();

      expect(result.imported).toBe(0);
      expect(result.total).toBe(2);
      expect(mockCompliance.addToSuppressionList).not.toHaveBeenCalled();
    });

    it('handles empty suppression list from SendGrid', async () => {
      mockSendGrid.listSuppressions.mockResolvedValue([]);

      const result = await service.syncFromSendGrid();

      expect(result.imported).toBe(0);
      expect(result.total).toBe(0);
      expect(mockCompliance.isOnSuppressionList).not.toHaveBeenCalled();
      expect(mockCompliance.addToSuppressionList).not.toHaveBeenCalled();
    });

    it('includes createdAt timestamp in suppression entry', async () => {
      mockSendGrid.listSuppressions.mockResolvedValue(['test@example.com']);
      mockCompliance.isOnSuppressionList.mockResolvedValue(false);
      mockCompliance.addToSuppressionList.mockResolvedValue(undefined);

      const beforeTime = Date.now();
      await service.syncFromSendGrid();
      const afterTime = Date.now();

      expect(mockCompliance.addToSuppressionList).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: expect.any(Number),
        })
      );

      const call = mockCompliance.addToSuppressionList.mock.calls[0][0];
      expect(call.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(call.createdAt).toBeLessThanOrEqual(afterTime);
    });

    it('sets source to "sendgrid" for all imported entries', async () => {
      mockSendGrid.listSuppressions.mockResolvedValue([
        'one@example.com',
        'two@example.com',
      ]);
      mockCompliance.isOnSuppressionList.mockResolvedValue(false);
      mockCompliance.addToSuppressionList.mockResolvedValue(undefined);

      await service.syncFromSendGrid();

      const calls = mockCompliance.addToSuppressionList.mock.calls;
      expect(calls.every((call: unknown[]) => (call[0] as { source: string }).source === 'sendgrid')).toBe(true);
    });

    it('processes emails sequentially', async () => {
      const callOrder: string[] = [];
      
      mockSendGrid.listSuppressions.mockResolvedValue(['a@test.com', 'b@test.com', 'c@test.com']);
      mockCompliance.isOnSuppressionList.mockImplementation(async (email: string) => {
        callOrder.push(`check:${email}`);
        return false;
      });
      mockCompliance.addToSuppressionList.mockImplementation(async ({ email }: { email: string }) => {
        callOrder.push(`add:${email}`);
      });

      await service.syncFromSendGrid();

      // Verify sequential processing (check then add for each email)
      expect(callOrder).toEqual([
        'check:a@test.com',
        'add:a@test.com',
        'check:b@test.com',
        'add:b@test.com',
        'check:c@test.com',
        'add:c@test.com',
      ]);
    });
  });

  describe('syncToSendGrid', () => {
    it('pushes local suppressions to SendGrid', async () => {
      mockCollectionRef.get.mockResolvedValue({
        size: 2,
        docs: [
          { id: 'one@example.com', data: () => ({ reason: 'bounce' }) },
          { id: 'two@example.com', data: () => ({}) },
        ],
      });

      mockSendGrid.addToSuppression.mockResolvedValue(undefined);

      const result = await service.syncToSendGrid();

      expect(result.synced).toBe(2);
      expect(result.errors).toBe(0);
      expect(result.total).toBe(2);
      expect(mockSendGrid.addToSuppression).toHaveBeenCalledWith('one@example.com', 'bounce');
      expect(mockSendGrid.addToSuppression).toHaveBeenCalledWith('two@example.com', 'manual');
    });

    it('counts errors when SendGrid sync fails', async () => {
      mockCollectionRef.get.mockResolvedValue({
        size: 1,
        docs: [
          { id: 'fail@example.com', data: () => ({ reason: 'manual' }) },
        ],
      });

      mockSendGrid.addToSuppression.mockRejectedValue(new Error('fail'));

      const result = await service.syncToSendGrid();

      expect(result.synced).toBe(0);
      expect(result.errors).toBe(1);
      expect(result.total).toBe(1);
    });
  });
});
