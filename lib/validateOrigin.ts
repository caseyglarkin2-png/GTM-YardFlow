/**
 * Shared Origin Validation Utilities
 * Sprint 47 - T47.4
 * 
 * Centralized request origin validation for CSRF protection
 */

import type { VercelRequest } from '@vercel/node';
import { isAllowedOrigin } from './origins';

export interface ValidateOriginOptions {
  /**
   * Allow requests without Origin header in development
   * @default true
   */
  allowDevWithoutOrigin?: boolean;
  
  /**
   * Check Referer header as fallback in development
   * @default true
   */
  checkRefererInDev?: boolean;
  
  /**
   * Allow GET requests without Origin (for landing pages)
   * @default false
   */
  allowGetWithoutOrigin?: boolean;
  
  /**
   * Custom validation function for special cases (e.g., List-Unsubscribe)
   */
  customValidator?: (req: VercelRequest) => boolean;
}

/**
 * Validate request origin for CSRF protection
 * 
 * @param req - Vercel request object
 * @param options - Validation options
 * @returns true if origin is valid
 * 
 * @example
 * // Strict mode (production)
 * if (!validateRequestOrigin(req)) {
 *   return res.status(403).json({ error: 'Invalid origin' });
 * }
 * 
 * @example
 * // With custom validator for List-Unsubscribe
 * if (!validateRequestOrigin(req, {
 *   customValidator: (req) => isListUnsubscribeOneClick(req)
 * })) {
 *   return res.status(403).json({ error: 'Invalid origin' });
 * }
 */
export function validateRequestOrigin(
  req: VercelRequest,
  options: ValidateOriginOptions = {}
): boolean {
  const {
    allowDevWithoutOrigin = true,
    checkRefererInDev = true,
    allowGetWithoutOrigin = false,
    customValidator,
  } = options;

  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  
  // Check custom validator first (for special cases like List-Unsubscribe)
  if (customValidator && customValidator(req)) {
    return true;
  }
  
  // Allow GET requests without Origin if configured
  if (allowGetWithoutOrigin && req.method === 'GET') {
    return true;
  }
  
  // Check Origin header
  if (isAllowedOrigin(origin)) {
    return true;
  }
  
  // In production, Origin is required
  if (isProduction) {
    return false;
  }
  
  // Development mode relaxations
  if (checkRefererInDev && referer && isAllowedOrigin(referer)) {
    return true;
  }
  
  if (allowDevWithoutOrigin && !origin) {
    return true;
  }
  
  return false;
}

/**
 * Check if request is a List-Unsubscribe One-Click (RFC 8058)
 * These requests from email clients may not include Origin header
 */
export function isListUnsubscribeOneClick(req: VercelRequest): boolean {
  if (req.method !== 'POST') {
    return false;
  }
  
  const body = req.body;
  if (!body) {
    return false;
  }
  
  if (typeof body === 'string') {
    return body.includes('List-Unsubscribe=One-Click');
  }
  
  if (typeof body === 'object') {
    return Object.values(body).some(
      val => typeof val === 'string' && val.includes('List-Unsubscribe=One-Click')
    );
  }
  
  return false;
}

export default validateRequestOrigin;
