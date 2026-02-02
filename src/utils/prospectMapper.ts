/**
 * Prospect Mapper Utility
 * 
 * Converts between Firestore Prospect format and Railway Prospect format.
 * Handles type mapping, field renaming, and tier conversion.
 * 
 * Sprint 902: Type Safety Layer - T902.3
 */

import type { Prospect } from '../types';
import type { 
  RailwayProspect, 
  CreateProspectRequest, 
  UpdateProspectRequest,
  ProspectStatus as RailwayStatus,
  ProspectTier as RailwayTier,
} from '../types/railway';
import { 
  toRailwayTier, 
  toFirestoreTier, 
  isFirestoreTier, 
  isRailwayTier,
  type FirestoreTier,
} from './tierAdapter';

// =============================================================================
// Status Mapping
// =============================================================================

type FirestoreStatus = 'new' | 'drafted' | 'contacted' | 'meeting_booked' | 'replied' | 'bounced' | 'unsubscribed';

const STATUS_FIRESTORE_TO_RAILWAY: Record<FirestoreStatus, RailwayStatus> = {
  'new': 'new',
  'drafted': 'researching',
  'contacted': 'contacted',
  'meeting_booked': 'meeting_scheduled',
  'replied': 'replied',
  'bounced': 'bounced',
  'unsubscribed': 'unsubscribed',
};

const STATUS_RAILWAY_TO_FIRESTORE: Record<RailwayStatus, FirestoreStatus> = {
  'new': 'new',
  'researching': 'drafted',
  'contacted': 'contacted',
  'replied': 'replied',
  'meeting_scheduled': 'meeting_booked',
  'closed_won': 'meeting_booked',
  'closed_lost': 'contacted',
  'nurturing': 'drafted',
  'bounced': 'bounced',
  'unsubscribed': 'unsubscribed',
};

/**
 * Convert Firestore status to Railway status
 */
export function toRailwayStatus(status: FirestoreStatus): RailwayStatus {
  return STATUS_FIRESTORE_TO_RAILWAY[status] || 'new';
}

/**
 * Convert Railway status to Firestore status
 */
export function toFirestoreStatus(status: RailwayStatus): FirestoreStatus {
  return STATUS_RAILWAY_TO_FIRESTORE[status] || 'new';
}

// =============================================================================
// Prospect Mapping
// =============================================================================

/**
 * Parse name into firstName and lastName
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

/**
 * Convert tier string to Railway format, handling unknown formats
 */
function safeToRailwayTier(tier: string | undefined): RailwayTier {
  if (!tier) return 'Tier 3'; // Default
  
  if (isRailwayTier(tier)) {
    return tier;
  }
  
  if (isFirestoreTier(tier)) {
    return toRailwayTier(tier);
  }
  
  // Try pattern matching: T1, Tier 1, tier1, etc.
  const match = tier.match(/(\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 4) {
      return `Tier ${num}` as RailwayTier;
    }
  }
  
  return 'Tier 3'; // Fallback
}

/**
 * Convert tier string to Firestore format, handling unknown formats
 */
function safeToFirestoreTier(tier: string | undefined): FirestoreTier {
  if (!tier) return 'T3'; // Default
  
  if (isFirestoreTier(tier)) {
    return tier;
  }
  
  if (isRailwayTier(tier)) {
    return toFirestoreTier(tier);
  }
  
  // Try pattern matching
  const match = tier.match(/(\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 4) {
      return `T${num}` as FirestoreTier;
    }
  }
  
  return 'T3'; // Fallback
}

/**
 * Convert Firestore Prospect to Railway CreateProspectRequest
 * Used when creating new prospects in Railway from Firestore data
 */
export function toRailwayCreateRequest(prospect: Prospect): CreateProspectRequest {
  const { firstName, lastName } = parseName(prospect.name);
  
  return {
    firstName,
    lastName,
    email: prospect.email || undefined,
    phone: prospect.phone || undefined,
    title: prospect.title || undefined,
    companyName: prospect.company || undefined,
    linkedinUrl: prospect.linkedinUrl || undefined,
    status: toRailwayStatus(prospect.status as FirestoreStatus),
    tier: safeToRailwayTier(prospect.tier),
    score: prospect.score || 0,
    notes: prospect.notes || undefined,
    tags: prospect.tags || [],
    customFields: {
      firestoreId: prospect.id,
      isOps: prospect.isOps,
      isExec: prospect.isExec,
      category: prospect.category,
      qualified: prospect.qualified,
    },
  };
}

/**
 * Convert Firestore Prospect to Railway UpdateProspectRequest
 * Used when updating existing prospects in Railway
 */
export function toRailwayUpdateRequest(prospect: Partial<Prospect>): UpdateProspectRequest {
  const result: UpdateProspectRequest = {};
  
  if (prospect.name) {
    const { firstName, lastName } = parseName(prospect.name);
    result.firstName = firstName;
    result.lastName = lastName;
  }
  
  if (prospect.email !== undefined) result.email = prospect.email || null;
  if (prospect.phone !== undefined) result.phone = prospect.phone || null;
  if (prospect.title !== undefined) result.title = prospect.title || null;
  if (prospect.company !== undefined) result.companyName = prospect.company || null;
  if (prospect.linkedinUrl !== undefined) result.linkedinUrl = prospect.linkedinUrl || null;
  if (prospect.status !== undefined) result.status = toRailwayStatus(prospect.status as FirestoreStatus);
  if (prospect.tier !== undefined) result.tier = safeToRailwayTier(prospect.tier);
  if (prospect.score !== undefined) result.score = prospect.score;
  if (prospect.notes !== undefined) result.notes = prospect.notes || null;
  if (prospect.tags !== undefined) result.tags = prospect.tags;
  
  return result;
}

/**
 * Convert Railway Prospect to Firestore Prospect format
 * Used when syncing Railway data back to Firestore
 */
export function toFirestoreProspect(railwayProspect: RailwayProspect): Partial<Prospect> {
  return {
    id: railwayProspect.id,
    name: railwayProspect.name,
    email: railwayProspect.email || undefined,
    phone: railwayProspect.phone || undefined,
    title: railwayProspect.title || undefined,
    company: railwayProspect.companyName || undefined,
    linkedinUrl: railwayProspect.linkedinUrl || undefined,
    status: toFirestoreStatus(railwayProspect.status),
    tier: safeToFirestoreTier(railwayProspect.tier),
    score: railwayProspect.score,
    notes: railwayProspect.notes || undefined,
    tags: railwayProspect.tags,
    // Extract custom fields if present
    isOps: railwayProspect.customFields?.isOps as boolean | undefined,
    isExec: railwayProspect.customFields?.isExec as boolean | undefined,
    category: railwayProspect.customFields?.category as 'Speaker' | 'Attendee' | 'Sponsor' | undefined,
    qualified: railwayProspect.customFields?.qualified as boolean | undefined,
    createdAt: new Date(railwayProspect.createdAt).getTime(),
    updatedAt: new Date(railwayProspect.updatedAt).getTime(),
  };
}

/**
 * Batch convert Firestore prospects to Railway format
 */
export function toRailwayCreateRequests(prospects: Prospect[]): CreateProspectRequest[] {
  return prospects.map(toRailwayCreateRequest);
}

/**
 * Batch convert Railway prospects to Firestore format
 */
export function toFirestoreProspects(railwayProspects: RailwayProspect[]): Partial<Prospect>[] {
  return railwayProspects.map(toFirestoreProspect);
}
