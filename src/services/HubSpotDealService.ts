/**
 * HubSpot Deal Pipeline Service
 * Sprint 26 - T26.6
 * 
 * Manages deal creation and stage tracking for qualified prospects.
 */

import type { HubSpotClient } from './HubSpotClient';
import type { HubSpotDeal } from '../types/hubspot';

/**
 * Deal stage mapping between YardFlow and HubSpot
 */
export const DEAL_STAGE_MAP: Record<string, string> = {
  // YardFlow → HubSpot deal stages
  'qualified': 'appointmentscheduled',
  'discovery': 'qualifiedtobuy',
  'proposal': 'presentationscheduled',
  'negotiation': 'decisionmakerboughtin',
  'closed_won': 'closedwon',
  'closed_lost': 'closedlost',
};

/**
 * Reverse deal stage mapping (HubSpot → YardFlow)
 */
export const DEAL_STAGE_MAP_REVERSE: Record<string, string> = {
  'appointmentscheduled': 'qualified',
  'qualifiedtobuy': 'discovery',
  'presentationscheduled': 'proposal',
  'decisionmakerboughtin': 'negotiation',
  'contractsent': 'negotiation',
  'closedwon': 'closed_won',
  'closedlost': 'closed_lost',
};

/**
 * Deal creation input
 */
export interface CreateDealInput {
  /** Contact ID in HubSpot */
  contactId: string;
  /** Prospect ID in YardFlow */
  prospectId: string;
  /** Prospect name */
  prospectName: string;
  /** Company name */
  companyName?: string;
  /** Deal amount (from ROI calculator) */
  amount?: number;
  /** Deal stage */
  stage?: string;
  /** Expected close date */
  closeDate?: string;
  /** Pipeline ID (default: default pipeline) */
  pipelineId?: string;
}

/**
 * Deal sync result
 */
export interface DealSyncResult {
  success: boolean;
  dealId?: string;
  error?: string;
  created?: boolean;
  updated?: boolean;
}

/**
 * Deal with association info
 */
export interface DealWithContact {
  deal: HubSpotDeal;
  contactId?: string;
  prospectId?: string;
}

/**
 * Create HubSpot Deal Service
 */
export function createDealService(client: HubSpotClient) {
  
  /**
   * Map YardFlow status to HubSpot deal stage
   */
  function mapStage(status: string): string {
    return DEAL_STAGE_MAP[status.toLowerCase()] || 'appointmentscheduled';
  }

  /**
   * Map HubSpot deal stage to YardFlow status
   */
  function mapStageReverse(stage: string): string {
    return DEAL_STAGE_MAP_REVERSE[stage.toLowerCase()] || 'qualified';
  }

  /**
   * Generate deal name from prospect/company
   */
  function generateDealName(prospectName: string, companyName?: string): string {
    if (companyName) {
      return `${companyName} - ${prospectName}`;
    }
    return `${prospectName} - New Opportunity`;
  }

  /**
   * Calculate default close date (90 days from now)
   */
  function getDefaultCloseDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return date.toISOString().split('T')[0];
  }

  /**
   * Find existing deal for a prospect
   */
  async function findDealForProspect(prospectId: string): Promise<HubSpotDeal | null> {
    try {
      const response = await client.getDeals({ limit: 100 });
      
      for (const deal of response.results) {
        if (deal.properties.yardflow_prospect_id === prospectId) {
          return deal;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Find deals for a contact
   */
  async function findDealsForContact(contactId: string): Promise<HubSpotDeal[]> {
    try {
      // Note: In real implementation, this would use the associations API
      const response = await client.getDeals({ limit: 100 });
      
      return response.results.filter(deal => 
        deal.properties.hs_associated_contact_ids?.includes(contactId)
      );
    } catch {
      return [];
    }
  }

  /**
   * Create a deal for a qualified prospect
   */
  async function createDealForProspect(input: CreateDealInput): Promise<DealSyncResult> {
    try {
      // Check for existing deal
      const existingDeal = await findDealForProspect(input.prospectId);
      
      if (existingDeal) {
        return {
          success: true,
          dealId: existingDeal.id,
          created: false,
          updated: false,
        };
      }

      // Create deal
      const dealName = generateDealName(input.prospectName, input.companyName);
      const closeDate = input.closeDate || getDefaultCloseDate();
      const stage = input.stage ? mapStage(input.stage) : 'appointmentscheduled';

      const deal = await client.createDeal({
        dealname: dealName,
        amount: input.amount?.toString(),
        dealstage: stage,
        closedate: closeDate,
        pipeline: input.pipelineId || 'default',
        yardflow_prospect_id: input.prospectId,
      });

      // Associate contact to deal
      await client.associateContactToDeal(input.contactId, deal.id);

      return {
        success: true,
        dealId: deal.id,
        created: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create deal',
      };
    }
  }

  /**
   * Update deal stage
   */
  async function updateDealStage(
    dealId: string, 
    newStage: string
  ): Promise<DealSyncResult> {
    try {
      const hubspotStage = mapStage(newStage);
      
      await client.updateDeal(dealId, {
        dealstage: hubspotStage,
      });

      return {
        success: true,
        dealId,
        updated: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update deal',
      };
    }
  }

  /**
   * Update deal amount
   */
  async function updateDealAmount(
    dealId: string, 
    amount: number
  ): Promise<DealSyncResult> {
    try {
      await client.updateDeal(dealId, {
        amount: amount.toString(),
      });

      return {
        success: true,
        dealId,
        updated: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update deal amount',
      };
    }
  }

  /**
   * Close a deal (won or lost)
   */
  async function closeDeal(
    dealId: string, 
    outcome: 'won' | 'lost',
    reason?: string
  ): Promise<DealSyncResult> {
    try {
      const stage = outcome === 'won' ? 'closedwon' : 'closedlost';
      
      const updateData: Record<string, string> = {
        dealstage: stage,
      };
      
      if (outcome === 'lost' && reason) {
        updateData['closed_lost_reason'] = reason;
      }

      await client.updateDeal(dealId, updateData);

      return {
        success: true,
        dealId,
        updated: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close deal',
      };
    }
  }

  /**
   * Sync deal stages from HubSpot to YardFlow
   * Returns deals that have changed stage since last sync
   */
  async function getStageChanges(
    knownDeals: Map<string, string> // dealId → lastKnownStage
  ): Promise<Array<{ dealId: string; prospectId: string; newStage: string }>> {
    const changes: Array<{ dealId: string; prospectId: string; newStage: string }> = [];
    
    try {
      const response = await client.getDeals({ limit: 100 });
      
      for (const deal of response.results) {
        const prospectId = deal.properties.yardflow_prospect_id as string | undefined;
        if (!prospectId) continue;
        
        const currentStage = deal.properties.dealstage as string;
        const lastKnownStage = knownDeals.get(deal.id);
        
        if (lastKnownStage && currentStage !== lastKnownStage) {
          changes.push({
            dealId: deal.id,
            prospectId,
            newStage: mapStageReverse(currentStage),
          });
        }
      }
    } catch {
      // Log error but don't throw
    }
    
    return changes;
  }

  /**
   * Get deal summary for a prospect
   */
  async function getDealSummary(prospectId: string): Promise<{
    hasDeal: boolean;
    dealId?: string;
    stage?: string;
    amount?: number;
    closeDate?: string;
  }> {
    const deal = await findDealForProspect(prospectId);
    
    if (!deal) {
      return { hasDeal: false };
    }
    
    return {
      hasDeal: true,
      dealId: deal.id,
      stage: mapStageReverse(deal.properties.dealstage || 'appointmentscheduled'),
      amount: deal.properties.amount ? parseFloat(deal.properties.amount as string) : undefined,
      closeDate: deal.properties.closedate as string | undefined,
    };
  }

  return {
    createDealForProspect,
    updateDealStage,
    updateDealAmount,
    closeDeal,
    getStageChanges,
    getDealSummary,
    findDealForProspect,
    findDealsForContact,
    mapStage,
    mapStageReverse,
    generateDealName,
  };
}

export type DealService = ReturnType<typeof createDealService>;
