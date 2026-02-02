/**
 * Email Validation Utilities
 *
 * Validates and sanitizes email addresses during import.
 * Filters out invalid values like "N/A", "none", malformed formats.
 *
 * @module utils/emailValidator
 */

/**
 * Basic RFC 5322 compliant email regex
 * Matches: local@domain.tld
 * Does NOT match: @domain.com, user@, invalid
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Common placeholder/invalid values found in CSV imports
 */
const INVALID_VALUES = new Set([
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  '-',
  '--',
  'test',
  'test@test.com',
  'example@example.com',
  'no email',
  'noemail',
  'no-email',
  'not available',
  'not provided',
  'unknown',
  'tbd',
  'pending',
  '',
]);

/**
 * Domains that indicate test/placeholder emails
 */
const INVALID_DOMAINS = new Set([
  'example.com',
  'test.com',
  'localhost',
  'invalid.com',
  'placeholder.com',
  'noemail.com',
  'none.com',
]);

/**
 * Check if an email address is valid
 *
 * @param email - The email address to validate
 * @returns true if the email is valid, false otherwise
 *
 * @example
 * isValidEmail('john.doe@acme.com') // true
 * isValidEmail('N/A') // false
 * isValidEmail('invalid') // false
 */
export function isValidEmail(email: unknown): email is string {
  // Type check
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalized = email.trim().toLowerCase();

  // Check against known invalid values
  if (INVALID_VALUES.has(normalized)) {
    return false;
  }

  // Must match email regex
  if (!EMAIL_REGEX.test(normalized)) {
    return false;
  }

  // Extract domain and check against invalid domains
  const domain = normalized.split('@')[1];
  if (domain && INVALID_DOMAINS.has(domain)) {
    return false;
  }

  return true;
}

/**
 * Sanitize an email address
 *
 * Returns normalized (lowercase, trimmed) email if valid, null otherwise.
 *
 * @param email - The email address to sanitize
 * @returns Sanitized email or null if invalid
 *
 * @example
 * sanitizeEmail('  John.Doe@Acme.COM  ') // 'john.doe@acme.com'
 * sanitizeEmail('N/A') // null
 */
export function sanitizeEmail(email: unknown): string | null {
  if (!isValidEmail(email)) {
    return null;
  }
  return email.trim().toLowerCase();
}

/**
 * Extract domain from email address
 *
 * @param email - The email address
 * @returns Domain portion or null if invalid
 *
 * @example
 * extractDomain('john@acme.com') // 'acme.com'
 */
export function extractDomain(email: string): string | null {
  if (!isValidEmail(email)) {
    return null;
  }
  return email.trim().toLowerCase().split('@')[1] || null;
}

/**
 * Bulk validate emails and return statistics
 *
 * @param emails - Array of email values to validate
 * @returns Object with valid emails, invalid count, and reasons
 */
export function validateEmailBatch(
  emails: unknown[]
): {
  valid: string[];
  invalidCount: number;
  reasons: Record<string, number>;
} {
  const valid: string[] = [];
  const reasons: Record<string, number> = {};

  for (const email of emails) {
    if (!email || typeof email !== 'string') {
      reasons['empty_or_invalid_type'] = (reasons['empty_or_invalid_type'] || 0) + 1;
      continue;
    }

    const normalized = email.trim().toLowerCase();

    if (INVALID_VALUES.has(normalized)) {
      reasons['placeholder_value'] = (reasons['placeholder_value'] || 0) + 1;
      continue;
    }

    if (!EMAIL_REGEX.test(normalized)) {
      reasons['malformed_format'] = (reasons['malformed_format'] || 0) + 1;
      continue;
    }

    const domain = normalized.split('@')[1];
    if (domain && INVALID_DOMAINS.has(domain)) {
      reasons['invalid_domain'] = (reasons['invalid_domain'] || 0) + 1;
      continue;
    }

    valid.push(normalized);
  }

  return {
    valid,
    invalidCount: emails.length - valid.length,
    reasons,
  };
}
