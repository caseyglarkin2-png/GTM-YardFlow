/**
 * Centralized origin/domain configuration for CORS and CSRF protection
 * All API endpoints should import from this module
 */

export const ALLOWED_ORIGINS = [
  'https://gtm-yard-flow.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;

/**
 * Check if an origin is allowed for CORS/CSRF purposes
 * Uses exact URL object comparison to prevent subdomain attacks
 * @param origin - The Origin header value
 * @returns true if the origin is in the allowlist
 */
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const originBase = `${parsed.protocol}//${parsed.host}`;
    return ALLOWED_ORIGINS.some(allowed => originBase === allowed);
  } catch {
    return false;
  }
}

/**
 * Allowed redirect domains for click tracking
 * Prevents open redirect vulnerabilities
 */
export const ALLOWED_REDIRECT_DOMAINS = [
  'calendly.com',
  'freightroll.com',
  'yardflow.com',
  'gtm-yard-flow.vercel.app',
  'hubspot.com',
  'linkedin.com',
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
] as const;

/**
 * Check if a URL is safe to redirect to
 * @param url - The target URL to validate
 * @returns true if the URL's domain is in the allowlist
 */
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Check against allowlist
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_REDIRECT_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}
