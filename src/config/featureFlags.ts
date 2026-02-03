/**
 * T90.4: Feature Flags Configuration
 * 
 * Controls gradual rollout of Railway migration features.
 * These flags can be toggled via Vercel environment variables without redeploying.
 * 
 * Usage:
 *   import { featureFlags, shouldUseRailway } from '@/config/featureFlags';
 *   
 *   if (featureFlags.RAILWAY_ENABLED) {
 *     // Use Railway backend
 *   }
 *   
 *   if (shouldUseRailway()) {
 *     // Traffic-based routing (for gradual rollout)
 *   }
 */

// =============================================================================
// Feature Flag Definitions
// =============================================================================

export interface FeatureFlags {
  // Railway Migration Flags
  RAILWAY_ENABLED: boolean;
  RAILWAY_AUTH_ENABLED: boolean;
  RAILWAY_EMAIL_ENABLED: boolean;
  RAILWAY_DATA_ENABLED: boolean;
  
  // Traffic Routing
  RAILWAY_TRAFFIC_PERCENT: number;
  
  // Safety Flags
  DUAL_WRITE_ENABLED: boolean;
  FIREBASE_AUTH_FALLBACK: boolean;
  
  // Debug Flags
  DEBUG_RAILWAY_REQUESTS: boolean;
  DEBUG_FEATURE_FLAGS: boolean;
}

// =============================================================================
// Environment Variable Parsing
// =============================================================================

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// =============================================================================
// Feature Flags Object
// =============================================================================

export const featureFlags: FeatureFlags = {
  // Railway Migration Flags
  // Default: false (safe - use Firestore)
  RAILWAY_ENABLED: parseBoolean(
    import.meta.env.VITE_RAILWAY_ENABLED,
    false
  ),
  
  RAILWAY_AUTH_ENABLED: parseBoolean(
    import.meta.env.VITE_RAILWAY_AUTH_ENABLED,
    false
  ),
  
  RAILWAY_EMAIL_ENABLED: parseBoolean(
    import.meta.env.VITE_RAILWAY_EMAIL_ENABLED,
    false
  ),
  
  RAILWAY_DATA_ENABLED: parseBoolean(
    import.meta.env.VITE_RAILWAY_DATA_ENABLED,
    false
  ),
  
  // Traffic Routing (0-100%)
  // Start at 0 for safety, gradually increase
  RAILWAY_TRAFFIC_PERCENT: parseNumber(
    import.meta.env.VITE_RAILWAY_TRAFFIC_PERCENT,
    0
  ),
  
  // Safety Flags
  // DUAL_WRITE: Write to both Firestore and Railway during migration
  DUAL_WRITE_ENABLED: parseBoolean(
    import.meta.env.VITE_DUAL_WRITE_ENABLED,
    false
  ),
  
  // FIREBASE_AUTH_FALLBACK: Allow Firebase login during auth transition
  FIREBASE_AUTH_FALLBACK: parseBoolean(
    import.meta.env.VITE_FIREBASE_AUTH_FALLBACK,
    true // Default true for safety
  ),
  
  // Debug Flags
  DEBUG_RAILWAY_REQUESTS: parseBoolean(
    import.meta.env.VITE_DEBUG_RAILWAY_REQUESTS,
    false
  ),
  
  DEBUG_FEATURE_FLAGS: parseBoolean(
    import.meta.env.VITE_DEBUG_FEATURE_FLAGS,
    false
  ),
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine if Railway should be used for this request.
 * Uses traffic percentage for gradual rollout.
 * 
 * @param forceFlag - Optional flag to override traffic-based routing
 * @returns boolean - Whether to use Railway
 */
export function shouldUseRailway(forceFlag?: keyof Pick<FeatureFlags, 'RAILWAY_ENABLED' | 'RAILWAY_AUTH_ENABLED' | 'RAILWAY_EMAIL_ENABLED' | 'RAILWAY_DATA_ENABLED'>): boolean {
  // Check specific flag if provided
  if (forceFlag && !featureFlags[forceFlag]) {
    return false;
  }
  
  // Check master flag
  if (!featureFlags.RAILWAY_ENABLED) {
    return false;
  }
  
  // 100% traffic → always use Railway
  if (featureFlags.RAILWAY_TRAFFIC_PERCENT >= 100) {
    return true;
  }
  
  // 0% traffic → never use Railway
  if (featureFlags.RAILWAY_TRAFFIC_PERCENT <= 0) {
    return false;
  }
  
  // Traffic-based routing
  return Math.random() * 100 < featureFlags.RAILWAY_TRAFFIC_PERCENT;
}

/**
 * Check if dual-write mode is active.
 * In dual-write, data is written to both Firestore and Railway.
 */
export function isDualWriteEnabled(): boolean {
  return featureFlags.DUAL_WRITE_ENABLED && featureFlags.RAILWAY_ENABLED;
}

/**
 * Check if Railway auth should be used.
 */
export function shouldUseRailwayAuth(): boolean {
  return featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_AUTH_ENABLED;
}

/**
 * Check if Railway email should be used.
 */
export function shouldUseRailwayEmail(): boolean {
  return featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_EMAIL_ENABLED;
}

/**
 * Check if Railway data storage should be used.
 */
export function shouldUseRailwayData(): boolean {
  return featureFlags.RAILWAY_ENABLED && featureFlags.RAILWAY_DATA_ENABLED;
}

/**
 * Get a summary of current feature flag states.
 * Useful for debugging and logging.
 */
export function getFeatureFlagSummary(): Record<string, boolean | number> {
  return {
    ...featureFlags,
    computed_shouldUseRailway: shouldUseRailway(),
    computed_isDualWrite: isDualWriteEnabled(),
    computed_useRailwayAuth: shouldUseRailwayAuth(),
    computed_useRailwayEmail: shouldUseRailwayEmail(),
    computed_useRailwayData: shouldUseRailwayData(),
  };
}

// =============================================================================
// Debug Logging
// =============================================================================

if (featureFlags.DEBUG_FEATURE_FLAGS) {
  console.log('🚩 Feature Flags:', getFeatureFlagSummary());
}

/**
 * Log feature flags at app startup.
 * Call this from App.tsx to see current configuration.
 * Always logs in development, respects DEBUG_FEATURE_FLAGS in production.
 */
export function logFeatureFlagsOnStartup(): void {
  const isDev = import.meta.env.DEV;
  const shouldLog = isDev || featureFlags.DEBUG_FEATURE_FLAGS;
  
  if (!shouldLog) return;
  
  console.group('🚩 [FreightRoll] Feature Flags');
  console.log('Railway Enabled:', featureFlags.RAILWAY_ENABLED);
  console.log('Railway Auth:', featureFlags.RAILWAY_AUTH_ENABLED);
  console.log('Railway Email:', featureFlags.RAILWAY_EMAIL_ENABLED);
  console.log('Railway Data:', featureFlags.RAILWAY_DATA_ENABLED);
  console.log('Dual Write:', featureFlags.DUAL_WRITE_ENABLED);
  console.log('Traffic %:', featureFlags.RAILWAY_TRAFFIC_PERCENT);
  console.log('---');
  console.log('shouldUseRailway():', shouldUseRailway());
  console.log('shouldUseRailwayData():', shouldUseRailwayData());
  console.log('shouldUseRailwayEmail():', shouldUseRailwayEmail());
  console.groupEnd();
}
