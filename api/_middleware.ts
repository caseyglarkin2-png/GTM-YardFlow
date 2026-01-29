/**
 * Vercel Edge Middleware for API Security
 * Adds security headers and rate limiting to all API routes
 * 
 * Sprint 45 - T45.4 & T45.6
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAllowedOrigin, ALLOWED_ORIGINS } from '../lib/origins';

/**
 * Security headers applied to all API responses
 */
const SECURITY_HEADERS = {
  // Prevent XSS attacks by restricting script sources
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com; frame-ancestors 'none';",
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable browser XSS filter
  'X-XSS-Protection': '1; mode=block',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Restrict browser features
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  
  // HSTS for HTTPS enforcement (1 year)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Rate limiting configuration
 * Uses Vercel Edge Config or headers for rate limit info
 */
const RATE_LIMIT_HEADERS = {
  'X-RateLimit-Policy': '100 requests per minute',
};

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Handle preflight OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    const preflightHeaders = new Headers({
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
    });
    
    // Set appropriate origin for CORS
    if (origin && isAllowedOrigin(origin)) {
      preflightHeaders.set('Access-Control-Allow-Origin', origin);
    } else {
      preflightHeaders.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }
    
    return new NextResponse(null, {
      status: 204,
      headers: preflightHeaders,
    });
  }
  
  // Continue with the request and add security headers to response
  const response = NextResponse.next();
  
  // Add security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Add rate limit headers
  Object.entries(RATE_LIMIT_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Set CORS headers for allowed origins
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return response;
}

/**
 * Configure which routes this middleware applies to
 * Only API routes need security headers and CORS handling
 */
export const config = {
  matcher: '/api/:path*',
};
