/**
 * Tier Adapter Utility
 * 
 * Converts between Firestore tier format (T1, T2, T3, T4) and
 * Railway tier format (Tier 1, Tier 2, Tier 3, Tier 4).
 * 
 * Sprint 902: Type Safety Layer - T902.2
 */

/**
 * Firestore tier format (short)
 */
export type FirestoreTier = 'T1' | 'T2' | 'T3' | 'T4';

/**
 * Railway tier format (verbose)
 */
export type RailwayTier = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

/**
 * Union type for any valid tier
 */
export type AnyTier = FirestoreTier | RailwayTier;

const FIRESTORE_TO_RAILWAY: Record<FirestoreTier, RailwayTier> = {
  'T1': 'Tier 1',
  'T2': 'Tier 2',
  'T3': 'Tier 3',
  'T4': 'Tier 4',
};

const RAILWAY_TO_FIRESTORE: Record<RailwayTier, FirestoreTier> = {
  'Tier 1': 'T1',
  'Tier 2': 'T2',
  'Tier 3': 'T3',
  'Tier 4': 'T4',
};

/**
 * Convert Firestore tier to Railway tier
 * 
 * @example
 * toRailwayTier('T1') // 'Tier 1'
 * toRailwayTier('T3') // 'Tier 3'
 */
export function toRailwayTier(tier: FirestoreTier): RailwayTier {
  const result = FIRESTORE_TO_RAILWAY[tier];
  if (!result) {
    throw new Error(`Invalid Firestore tier: ${tier}`);
  }
  return result;
}

/**
 * Convert Railway tier to Firestore tier
 * 
 * @example
 * toFirestoreTier('Tier 1') // 'T1'
 * toFirestoreTier('Tier 3') // 'T3'
 */
export function toFirestoreTier(tier: RailwayTier): FirestoreTier {
  const result = RAILWAY_TO_FIRESTORE[tier];
  if (!result) {
    throw new Error(`Invalid Railway tier: ${tier}`);
  }
  return result;
}

/**
 * Check if a string is a valid Firestore tier
 */
export function isFirestoreTier(tier: string): tier is FirestoreTier {
  return tier in FIRESTORE_TO_RAILWAY;
}

/**
 * Check if a string is a valid Railway tier
 */
export function isRailwayTier(tier: string): tier is RailwayTier {
  return tier in RAILWAY_TO_FIRESTORE;
}

/**
 * Normalize any tier to Firestore format
 * Handles both formats gracefully
 * 
 * @example
 * normalizeToFirestoreTier('T1')      // 'T1'
 * normalizeToFirestoreTier('Tier 1')  // 'T1'
 */
export function normalizeToFirestoreTier(tier: AnyTier): FirestoreTier {
  if (isFirestoreTier(tier)) {
    return tier;
  }
  if (isRailwayTier(tier)) {
    return toFirestoreTier(tier);
  }
  throw new Error(`Invalid tier format: ${tier}`);
}

/**
 * Normalize any tier to Railway format
 * Handles both formats gracefully
 * 
 * @example
 * normalizeToRailwayTier('T1')      // 'Tier 1'
 * normalizeToRailwayTier('Tier 1')  // 'Tier 1'
 */
export function normalizeToRailwayTier(tier: AnyTier): RailwayTier {
  if (isRailwayTier(tier)) {
    return tier;
  }
  if (isFirestoreTier(tier)) {
    return toRailwayTier(tier);
  }
  throw new Error(`Invalid tier format: ${tier}`);
}

/**
 * Get tier priority (1-4, where 1 is highest priority)
 * Works with either format
 */
export function getTierPriority(tier: AnyTier): number {
  const normalized = normalizeToFirestoreTier(tier);
  return parseInt(normalized.slice(1), 10);
}

/**
 * Compare two tiers
 * Returns negative if a < b (higher priority), positive if a > b, 0 if equal
 */
export function compareTiers(a: AnyTier, b: AnyTier): number {
  return getTierPriority(a) - getTierPriority(b);
}
