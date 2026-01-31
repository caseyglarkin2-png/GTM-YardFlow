/**
 * Environment Variable Validation
 * Sprint 300 - T300.6
 * 
 * Validates required environment variables at startup and provides
 * helpful error messages for missing or invalid configuration.
 */

// =============================================================================
// Types
// =============================================================================

export type EnvVarType = 'string' | 'boolean' | 'number' | 'url';

export interface EnvVarConfig {
  name: string;
  type: EnvVarType;
  required: boolean;
  description: string;
  defaultValue?: string;
  validate?: (value: string) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: EnvVarError[];
  warnings: EnvVarWarning[];
}

export interface EnvVarError {
  name: string;
  message: string;
  description: string;
}

export interface EnvVarWarning {
  name: string;
  message: string;
}

// =============================================================================
// Environment Variable Schema
// =============================================================================

/**
 * Schema defining all expected environment variables for the frontend app
 */
export const ENV_SCHEMA: EnvVarConfig[] = [
  // Firebase Configuration
  {
    name: 'VITE_FIREBASE_API_KEY',
    type: 'string',
    required: true,
    description: 'Firebase API key for authentication',
  },
  {
    name: 'VITE_FIREBASE_AUTH_DOMAIN',
    type: 'url',
    required: true,
    description: 'Firebase auth domain',
    validate: (v) => v.includes('.firebaseapp.com') || v.includes('.web.app'),
  },
  {
    name: 'VITE_FIREBASE_PROJECT_ID',
    type: 'string',
    required: true,
    description: 'Firebase project ID',
  },
  {
    name: 'VITE_FIREBASE_STORAGE_BUCKET',
    type: 'string',
    required: false,
    description: 'Firebase storage bucket',
  },
  {
    name: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
    type: 'string',
    required: false,
    description: 'Firebase messaging sender ID',
  },
  {
    name: 'VITE_FIREBASE_APP_ID',
    type: 'string',
    required: true,
    description: 'Firebase app ID',
  },
  
  // Railway Configuration
  {
    name: 'VITE_RAILWAY_ENABLED',
    type: 'boolean',
    required: false,
    description: 'Enable Railway API integration',
    defaultValue: 'false',
  },
  {
    name: 'VITE_RAILWAY_EMAIL_ENABLED',
    type: 'boolean',
    required: false,
    description: 'Route email via Railway backend',
    defaultValue: 'false',
  },
  {
    name: 'VITE_RAILWAY_AUTH_ENABLED',
    type: 'boolean',
    required: false,
    description: 'Use Railway for session management',
    defaultValue: 'false',
  },
  
  // Sentry (Optional)
  {
    name: 'VITE_SENTRY_DSN',
    type: 'url',
    required: false,
    description: 'Sentry DSN for error tracking',
    validate: (v) => v.startsWith('https://') && v.includes('@') && v.includes('.ingest.sentry.io'),
  },
  
  // Environment
  {
    name: 'VITE_ENV',
    type: 'string',
    required: false,
    description: 'Environment name (development, staging, production)',
    defaultValue: 'development',
    validate: (v) => ['development', 'staging', 'production'].includes(v),
  },
  {
    name: 'VITE_APP_VERSION',
    type: 'string',
    required: false,
    description: 'App version for tracking',
    defaultValue: '1.0.0',
  },
];

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Get an environment variable value, preferring import.meta.env over process.env
 */
function getEnvValue(name: string): string | undefined {
  // Browser context - use import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[name] as string | undefined;
  }
  // Node context (API routes) - use process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}

/**
 * Validate a single environment variable
 */
function validateEnvVar(config: EnvVarConfig): { error?: EnvVarError; warning?: EnvVarWarning } {
  const value = getEnvValue(config.name);
  
  // Check required
  if (config.required && !value) {
    return {
      error: {
        name: config.name,
        message: `Missing required environment variable: ${config.name}`,
        description: config.description,
      },
    };
  }
  
  // If not set and not required, just note if there's no default
  if (!value && !config.required && !config.defaultValue) {
    return {
      warning: {
        name: config.name,
        message: `Optional variable not set: ${config.name}`,
      },
    };
  }
  
  // If value exists, validate type
  if (value) {
    switch (config.type) {
      case 'boolean':
        if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
          return {
            error: {
              name: config.name,
              message: `Invalid boolean value for ${config.name}: "${value}"`,
              description: 'Expected "true" or "false"',
            },
          };
        }
        break;
        
      case 'number':
        if (isNaN(Number(value))) {
          return {
            error: {
              name: config.name,
              message: `Invalid number value for ${config.name}: "${value}"`,
              description: 'Expected a numeric value',
            },
          };
        }
        break;
        
      case 'url':
        try {
          new URL(value);
        } catch {
          return {
            error: {
              name: config.name,
              message: `Invalid URL for ${config.name}: "${value}"`,
              description: 'Expected a valid URL',
            },
          };
        }
        break;
    }
    
    // Custom validation
    if (config.validate && !config.validate(value)) {
      return {
        error: {
          name: config.name,
          message: `Invalid value for ${config.name}: "${value}"`,
          description: config.description,
        },
      };
    }
  }
  
  return {};
}

/**
 * Validate all environment variables against schema
 */
export function validateEnvironment(schema: EnvVarConfig[] = ENV_SCHEMA): ValidationResult {
  const errors: EnvVarError[] = [];
  const warnings: EnvVarWarning[] = [];
  
  for (const config of schema) {
    const result = validateEnvVar(config);
    if (result.error) {
      errors.push(result.error);
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Assert environment is valid - throws on failure
 */
export function assertEnvironment(): void {
  const result = validateEnvironment();
  
  if (!result.valid) {
    const errorMessages = result.errors.map(e => `  - ${e.name}: ${e.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }
}

/**
 * Log environment validation results
 */
export function logEnvironmentStatus(): void {
  const result = validateEnvironment();
  const isDev = getEnvValue('VITE_ENV') !== 'production';
  
  if (result.valid) {
    if (isDev && result.warnings.length > 0) {
      console.warn(`[Env] ${result.warnings.length} optional variables not set`);
    }
    console.log('[Env] Environment validated successfully');
  } else {
    console.error('[Env] Environment validation failed:');
    result.errors.forEach(e => {
      console.error(`  ❌ ${e.name}: ${e.description}`);
    });
  }
}

/**
 * Get a typed environment variable with default
 */
export function getEnv(name: string, defaultValue: string = ''): string {
  return getEnvValue(name) ?? defaultValue;
}

/**
 * Get a boolean environment variable
 */
export function getBoolEnv(name: string, defaultValue: boolean = false): boolean {
  const value = getEnvValue(name);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get a number environment variable
 */
export function getNumEnv(name: string, defaultValue: number = 0): number {
  const value = getEnvValue(name);
  if (!value) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export default {
  validate: validateEnvironment,
  assert: assertEnvironment,
  log: logEnvironmentStatus,
  get: getEnv,
  getBool: getBoolEnv,
  getNum: getNumEnv,
  schema: ENV_SCHEMA,
};
