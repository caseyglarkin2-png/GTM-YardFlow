/**
 * HubSpot Deal Service Tests
 * Sprint 26 - T26.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createDealService, 
  DEAL_STAGE_MAP, 
  DEAL_STAGE_MAP_REVERSE 
} from '../../services/HubSpotDealService';
import type { HubSpotClient } from '../../services/HubSpotClient';
import type { HubSpotDeal } from '../../types/hubspot';

describe('HubSpot Deal Service - T26.6', () => {
  let mockClient: HubSpotClient;
  let dealService: ReturnType<typeof createDealService>;

  const sampleDeal: HubSpotDeal = {
    id: 'deal-123',
    properties: {
      dealname: 'Acme Corp - John Doe',
      dealstage: 'appointmentscheduled',
      amount: '50000',
      closedate: '2026-04-28',
      yardflow_prospect_id: 'yf-123',
    },
    createdAt: '2026-01-28T00:00:00Z',
    updatedAt: '2026-01-28T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      getDeals: vi.fn().mockResolvedValue({ results: [], hasMore: false }),
      getDeal: vi.fn().mockResolvedValue(sampleDeal),
      createDeal: vi.fn().mockResolvedValue({ id: 'deal-new', properties: {} }),
      updateDeal: vi.fn().mockResolvedValue(undefined),
      associateContactToDeal: vi.fn().mockResolvedValue(undefined),
      getContacts: vi.fn(),
      getContact: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
      searchContacts: vi.fn(),
      createNote: vi.fn(),
      createTask: vi.fn(),
      logEmail: vi.fn(),
      batchCreateContacts: vi.fn(),
      getRateLimitStatus: vi.fn(),
      invalidateCache: vi.fn(),
    } as unknown as HubSpotClient;

    dealService = createDealService(mockClient);
  });

  describe('Stage Mapping', () => {
    it('should map YardFlow stages to HubSpot', () => {
      expect(dealService.mapStage('qualified')).toBe('appointmentscheduled');
      expect(dealService.mapStage('discovery')).toBe('qualifiedtobuy');
      expect(dealService.mapStage('proposal')).toBe('presentationscheduled');
      expect(dealService.mapStage('closed_won')).toBe('closedwon');
      expect(dealService.mapStage('closed_lost')).toBe('closedlost');
    });

    it('should map HubSpot stages to YardFlow', () => {
      expect(dealService.mapStageReverse('appointmentscheduled')).toBe('qualified');
      expect(dealService.mapStageReverse('qualifiedtobuy')).toBe('discovery');
      expect(dealService.mapStageReverse('closedwon')).toBe('closed_won');
      expect(dealService.mapStageReverse('closedlost')).toBe('closed_lost');
    });

    it('should default unknown stages', () => {
      expect(dealService.mapStage('unknown')).toBe('appointmentscheduled');
      expect(dealService.mapStageReverse('customstage')).toBe('qualified');
    });

    it('should be case-insensitive', () => {
      expect(dealService.mapStage('QUALIFIED')).toBe('appointmentscheduled');
      expect(dealService.mapStageReverse('CLOSEDWON')).toBe('closed_won');
    });
  });

  describe('Deal Name Generation', () => {
    it('should generate name with company', () => {
      const name = dealService.generateDealName('John Doe', 'Acme Corp');
      expect(name).toBe('Acme Corp - John Doe');
    });

    it('should generate name without company', () => {
      const name = dealService.generateDealName('John Doe');
      expect(name).toBe('John Doe - New Opportunity');
    });
  });

  describe('createDealForProspect', () => {
    it('should create deal for new prospect', async () => {
      const result = await dealService.createDealForProspect({
        contactId: 'hs-contact-123',
        prospectId: 'yf-123',
        prospectName: 'John Doe',
        companyName: 'Acme Corp',
        amount: 50000,
        stage: 'qualified',
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.dealId).toBe('deal-new');
      
      expect(mockClient.createDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          dealname: 'Acme Corp - John Doe',
          amount: '50000',
          dealstage: 'appointmentscheduled',
          yardflow_prospect_id: 'yf-123',
        })
      );
    });

    it('should associate contact to deal', async () => {
      await dealService.createDealForProspect({
        contactId: 'hs-contact-123',
        prospectId: 'yf-123',
        prospectName: 'John Doe',
      });

      expect(mockClient.associateContactToDeal).toHaveBeenCalledWith(
        'hs-contact-123',
        'deal-new'
      );
    });

    it('should not create duplicate deal', async () => {
      vi.mocked(mockClient.getDeals).mockResolvedValueOnce({
        results: [sampleDeal],
        hasMore: false,
      });

      const result = await dealService.createDealForProspect({
        contactId: 'hs-contact-123',
        prospectId: 'yf-123',
        prospectName: 'John Doe',
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);
      expect(result.dealId).toBe('deal-123');
      expect(mockClient.createDeal).not.toHaveBeenCalled();
    });

    it('should use default close date if not provided', async () => {
      await dealService.createDealForProspect({
        contactId: 'hs-contact-123',
        prospectId: 'yf-456',
        prospectName: 'Jane Doe',
      });

      expect(mockClient.createDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          closedate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
    });

    it('should handle creation error', async () => {
      vi.mocked(mockClient.createDeal).mockRejectedValueOnce(new Error('API Error'));

      const result = await dealService.createDealForProspect({
        contactId: 'hs-contact-123',
        prospectId: 'yf-789',
        prospectName: 'Error User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('updateDealStage', () => {
    it('should update deal stage', async () => {
      const result = await dealService.updateDealStage('deal-123', 'proposal');

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(mockClient.updateDeal).toHaveBeenCalledWith('deal-123', {
        dealstage: 'presentationscheduled',
      });
    });

    it('should handle update error', async () => {
      vi.mocked(mockClient.updateDeal).mockRejectedValueOnce(new Error('Update failed'));

      const result = await dealService.updateDealStage('deal-123', 'proposal');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('updateDealAmount', () => {
    it('should update deal amount', async () => {
      const result = await dealService.updateDealAmount('deal-123', 75000);

      expect(result.success).toBe(true);
      expect(mockClient.updateDeal).toHaveBeenCalledWith('deal-123', {
        amount: '75000',
      });
    });
  });

  describe('closeDeal', () => {
    it('should close deal as won', async () => {
      const result = await dealService.closeDeal('deal-123', 'won');

      expect(result.success).toBe(true);
      expect(mockClient.updateDeal).toHaveBeenCalledWith('deal-123', {
        dealstage: 'closedwon',
      });
    });

    it('should close deal as lost with reason', async () => {
      const result = await dealService.closeDeal('deal-123', 'lost', 'Budget constraints');

      expect(result.success).toBe(true);
      expect(mockClient.updateDeal).toHaveBeenCalledWith('deal-123', {
        dealstage: 'closedlost',
        closed_lost_reason: 'Budget constraints',
      });
    });
  });

  describe('getStageChanges', () => {
    it('should detect stage changes', async () => {
      vi.mocked(mockClient.getDeals).mockResolvedValueOnce({
        results: [{
          ...sampleDeal,
          properties: {
            ...sampleDeal.properties,
            dealstage: 'qualifiedtobuy', // Changed from appointmentscheduled
          },
        }],
        hasMore: false,
      });

      const knownDeals = new Map([['deal-123', 'appointmentscheduled']]);
      const changes = await dealService.getStageChanges(knownDeals);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        dealId: 'deal-123',
        prospectId: 'yf-123',
        newStage: 'discovery',
      });
    });

    it('should not report unchanged deals', async () => {
      vi.mocked(mockClient.getDeals).mockResolvedValueOnce({
        results: [sampleDeal],
        hasMore: false,
      });

      const knownDeals = new Map([['deal-123', 'appointmentscheduled']]);
      const changes = await dealService.getStageChanges(knownDeals);

      expect(changes).toHaveLength(0);
    });
  });

  describe('getDealSummary', () => {
    it('should return deal summary for prospect with deal', async () => {
      vi.mocked(mockClient.getDeals).mockResolvedValueOnce({
        results: [sampleDeal],
        hasMore: false,
      });

      const summary = await dealService.getDealSummary('yf-123');

      expect(summary.hasDeal).toBe(true);
      expect(summary.dealId).toBe('deal-123');
      expect(summary.stage).toBe('qualified');
      expect(summary.amount).toBe(50000);
    });

    it('should return no deal for prospect without deal', async () => {
      const summary = await dealService.getDealSummary('yf-no-deal');

      expect(summary.hasDeal).toBe(false);
      expect(summary.dealId).toBeUndefined();
    });
  });

  describe('Stage Map Completeness', () => {
    it('should have matching forward and reverse mappings', () => {
      for (const [key, value] of Object.entries(DEAL_STAGE_MAP)) {
        expect(DEAL_STAGE_MAP_REVERSE[value]).toBeDefined();
      }
    });
  });
});
