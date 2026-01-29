# ADR-001: Security Architecture Decisions

**Status:** Accepted  
**Date:** 2026-01-29  
**Authors:** Development Team

## Context

YardFlow GTM Hub handles sensitive data including:
- HubSpot OAuth tokens for CRM access
- Email addresses and prospect information
- Email tracking data (opens, clicks)
- User authentication tokens

We need to implement security measures that protect this data while maintaining performance and developer experience.

## Decisions

### 1. AES-256-GCM for Token Encryption

**Decision:** Use AES-256-GCM (Galois/Counter Mode) for encrypting OAuth tokens stored in cookies.

**Rationale:**
- GCM provides authenticated encryption (confidentiality + integrity)
- 256-bit key provides sufficient security margin
- 12-byte IV is the GCM standard recommendation
- Authentication tag prevents tampering

**Alternatives Considered:**
- XOR encryption (rejected: trivially reversible, no authentication)
- AES-CBC (rejected: requires separate MAC, padding oracle vulnerabilities)
- RSA encryption (rejected: larger ciphertext, slower)

### 2. PBKDF2 for Key Derivation

**Decision:** Use PBKDF2 with 100,000 iterations and SHA-256 for deriving encryption keys from secrets.

**Rationale:**
- PBKDF2 provides key stretching to slow brute-force attacks
- 100k iterations is OWASP 2023 recommendation
- SHA-256 is widely available and secure
- Static salt is acceptable since secret is unique per deployment

**Alternatives Considered:**
- Direct key truncation (rejected: no stretching, weak)
- scrypt (considered: higher memory cost, but PBKDF2 is sufficient)
- Argon2 (considered: requires native module, deployment complexity)

### 3. Timing-Safe HMAC Comparison

**Decision:** Use `crypto.timingSafeEqual()` for all HMAC signature comparisons.

**Rationale:**
- Prevents timing attacks that measure response time to deduce signature bytes
- Node.js `timingSafeEqual` is O(n) regardless of where mismatch occurs
- Zero additional overhead for correct usage

### 4. Origin-Based CSRF Protection

**Decision:** Validate Origin header against allowlist for all mutating API endpoints.

**Rationale:**
- Origin header is set by browsers and cannot be spoofed by JavaScript
- Simpler than CSRF tokens for stateless APIs
- Allowlist prevents subdomain attacks

**Special Cases:**
- List-Unsubscribe One-Click (RFC 8058): May not have Origin header; uses HMAC token validation instead
- Development mode: Allows Referer fallback for testing

### 5. Open Redirect Prevention

**Decision:** Maintain allowlist of valid redirect domains for click tracking.

**Rationale:**
- Click tracking rewrites URLs through our domain
- Without validation, attackers could use our domain for phishing
- Allowlist is simpler than complex URL parsing/validation

### 6. Security Headers via Edge Middleware

**Decision:** Apply security headers at the Edge Middleware layer.

**Headers Applied:**
- `Content-Security-Policy`: Restricts script/style sources
- `X-Frame-Options: DENY`: Prevents clickjacking
- `X-Content-Type-Options: nosniff`: Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block`: Browser XSS filter
- `Strict-Transport-Security`: Forces HTTPS
- `Referrer-Policy`: Controls referrer information
- `Permissions-Policy`: Restricts browser features

**Rationale:**
- Edge Middleware ensures headers are applied to all API routes
- Single point of configuration
- No per-route implementation required

### 7. Token Expiry

**Decision:** All tracking tokens expire after 90 days.

**Rationale:**
- Prevents indefinite token replay
- Aligns with data retention policy
- Balance between user experience and security

## Consequences

### Positive
- Strong encryption protects tokens at rest
- CSRF protection prevents cross-site attacks
- Open redirect prevention protects users
- Timing-safe comparison prevents information leakage

### Negative
- PBKDF2 adds ~50ms latency to first request (one-time key derivation)
- Redirect allowlist requires maintenance when adding new integrations
- Origin validation may cause issues with certain proxies/load balancers

## References

- OWASP Cryptographic Storage Cheat Sheet
- RFC 8058 (List-Unsubscribe One-Click)
- Node.js crypto documentation
- Vercel Edge Middleware documentation
