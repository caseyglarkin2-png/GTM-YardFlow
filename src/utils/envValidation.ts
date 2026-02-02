/**
 * Environment Variable Validation
 * 
 * Checks for required environment variables at startup.
 * Helps prevent silent failures due to missing config.
 */

const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_AUTH_DOMAIN',
];

const OPTIONAL_ENV_VARS = [
  'VITE_RAILWAY_ENABLED',
  'VITE_RAILWAY_API_URL',
  'VITE_MEETING_LINK_SHORT',
];

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing = REQUIRED_ENV_VARS.filter(v => !import.meta.env[v]);
  const warnings = OPTIONAL_ENV_VARS.filter(v => !import.meta.env[v]);
  
  if (import.meta.env.DEV) {
    if (missing.length > 0) {
      console.error('🚨 [YardFlow] Missing required env vars:', missing);
    }
    if (warnings.length > 0) {
      console.warn('⚠️ [YardFlow] Missing optional env vars:', warnings);
    }
  }
  
  return { valid: missing.length === 0, missing, warnings };
}
