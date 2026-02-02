/**
 * Tests for emailValidator utilities
 *
 * @module __tests__/utils/emailValidator.test
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  sanitizeEmail,
  extractDomain,
  validateEmailBatch,
} from '../../utils/emailValidator';

describe('emailValidator', () => {
  describe('isValidEmail', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('john.doe@acme.com')).toBe(true);
      expect(isValidEmail('jane@company.io')).toBe(true);
      expect(isValidEmail('user123@domain.co.uk')).toBe(true);
      expect(isValidEmail('first.last@subdomain.example.org')).toBe(true);
      expect(isValidEmail('user+tag@gmail.com')).toBe(true);
    });

    it('rejects empty and null values', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });

    it('rejects placeholder values like N/A and none', () => {
      expect(isValidEmail('N/A')).toBe(false);
      expect(isValidEmail('n/a')).toBe(false);
      expect(isValidEmail('NA')).toBe(false);
      expect(isValidEmail('none')).toBe(false);
      expect(isValidEmail('None')).toBe(false);
      expect(isValidEmail('NONE')).toBe(false);
      expect(isValidEmail('-')).toBe(false);
      expect(isValidEmail('--')).toBe(false);
      expect(isValidEmail('null')).toBe(false);
      expect(isValidEmail('undefined')).toBe(false);
      expect(isValidEmail('test')).toBe(false);
      expect(isValidEmail('unknown')).toBe(false);
      expect(isValidEmail('tbd')).toBe(false);
      expect(isValidEmail('pending')).toBe(false);
      expect(isValidEmail('not available')).toBe(false);
      expect(isValidEmail('not provided')).toBe(false);
    });

    it('rejects malformed email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('user domain.com')).toBe(false);
      expect(isValidEmail('user@@domain.com')).toBe(false);
    });

    it('rejects test/placeholder domains', () => {
      expect(isValidEmail('user@example.com')).toBe(false);
      expect(isValidEmail('test@test.com')).toBe(false);
      expect(isValidEmail('user@localhost')).toBe(false);
      expect(isValidEmail('admin@invalid.com')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail({})).toBe(false);
      expect(isValidEmail([])).toBe(false);
      expect(isValidEmail(true)).toBe(false);
    });
  });

  describe('sanitizeEmail', () => {
    it('normalizes valid emails to lowercase', () => {
      expect(sanitizeEmail('John.Doe@ACME.COM')).toBe('john.doe@acme.com');
      expect(sanitizeEmail('  USER@Domain.io  ')).toBe('user@domain.io');
    });

    it('returns null for invalid emails', () => {
      expect(sanitizeEmail('N/A')).toBeNull();
      expect(sanitizeEmail('invalid')).toBeNull();
      expect(sanitizeEmail('')).toBeNull();
      expect(sanitizeEmail(null)).toBeNull();
    });
  });

  describe('extractDomain', () => {
    it('extracts domain from valid email', () => {
      expect(extractDomain('john@acme.com')).toBe('acme.com');
      expect(extractDomain('user@sub.domain.io')).toBe('sub.domain.io');
    });

    it('returns null for invalid email', () => {
      expect(extractDomain('invalid')).toBeNull();
      expect(extractDomain('N/A')).toBeNull();
    });

    it('normalizes domain to lowercase', () => {
      expect(extractDomain('User@DOMAIN.COM')).toBe('domain.com');
    });
  });

  describe('validateEmailBatch', () => {
    it('separates valid and invalid emails', () => {
      const emails = [
        'valid@company.com',
        'another@firm.io',
        'N/A',
        'invalid',
        '',
        'test@test.com',
      ];

      const result = validateEmailBatch(emails);

      expect(result.valid).toHaveLength(2);
      expect(result.valid).toContain('valid@company.com');
      expect(result.valid).toContain('another@firm.io');
      expect(result.invalidCount).toBe(4);
    });

    it('categorizes invalid reasons correctly', () => {
      const emails = ['', null, 'N/A', 'none', 'bad', 'test@example.com'];

      const result = validateEmailBatch(emails);

      expect(result.reasons['empty_or_invalid_type']).toBe(2); // '' and null
      expect(result.reasons['placeholder_value']).toBe(2); // N/A, none
      expect(result.reasons['malformed_format']).toBe(1); // bad
      expect(result.reasons['invalid_domain']).toBe(1); // test@example.com
    });

    it('handles empty array', () => {
      const result = validateEmailBatch([]);
      expect(result.valid).toHaveLength(0);
      expect(result.invalidCount).toBe(0);
      expect(Object.keys(result.reasons)).toHaveLength(0);
    });

    it('handles all valid emails', () => {
      const emails = ['a@b.com', 'c@d.io', 'e@f.org'];
      const result = validateEmailBatch(emails);

      expect(result.valid).toHaveLength(3);
      expect(result.invalidCount).toBe(0);
    });
  });
});
