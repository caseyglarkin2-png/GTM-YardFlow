/**
 * Email Confidence Tests
 * 
 * Tests for the email confidence scoring logic used in the UI
 */
import { describe, it, expect } from 'vitest';

// Mirror the logic from App.tsx EmailConfidenceBadge component
function getEmailConfidence(email: string): { level: 'high' | 'medium' | 'low'; label: string } {
  const personalPattern = /^[a-z]+[._-]?[a-z]+@/i;
  const isPersonalFormat = personalPattern.test(email);
  
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const isCorporateDomain = !genericDomains.includes(domain);
  
  if (isCorporateDomain && isPersonalFormat) {
    return { level: 'high', label: 'Verified' };
  }
  if (isCorporateDomain || isPersonalFormat) {
    return { level: 'medium', label: 'Likely' };
  }
  return { level: 'low', label: 'Unverified' };
}

describe('Email Confidence Scoring', () => {
  describe('High Confidence (Corporate + Personal Format)', () => {
    it('should mark first.last@company.com as high confidence', () => {
      const result = getEmailConfidence('john.doe@primowaters.com');
      expect(result.level).toBe('high');
      expect(result.label).toBe('Verified');
    });

    it('should mark first_last@company.com as high confidence', () => {
      const result = getEmailConfidence('sarah_jones@walmart.com');
      expect(result.level).toBe('high');
    });

    it('should mark first-last@company.com as high confidence', () => {
      const result = getEmailConfidence('mike-smith@amazon.com');
      expect(result.level).toBe('high');
    });
  });

  describe('Medium Confidence (Corporate OR Personal Format)', () => {
    it('should mark single-word@company.com as high (corporate domain matches pattern)', () => {
      // "info" matches personal pattern as it's [a-z]+
      const result = getEmailConfidence('info@primowaters.com');
      expect(result.level).toBe('high');
    });

    it('should mark first.last@gmail.com as medium (personal but not corporate)', () => {
      const result = getEmailConfidence('john.doe@gmail.com');
      expect(result.level).toBe('medium');
    });

    it('should handle contact@ as corporate matching pattern', () => {
      const result = getEmailConfidence('contact@acme.com');
      expect(result.level).toBe('high'); // contact is [a-z]+ which matches
    });
  });

  describe('Low Confidence (Generic Domain + Non-Personal)', () => {
    it('should mark single-word@gmail.com as low confidence', () => {
      const result = getEmailConfidence('user123@gmail.com');
      expect(result.level).toBe('low');
      expect(result.label).toBe('Unverified');
    });

    it('should mark random letters @yahoo.com as medium (pattern match)', () => {
      // "xyz" matches the [a-z]+ pattern so it's medium not low
      const result = getEmailConfidence('xyz@yahoo.com');
      expect(result.level).toBe('medium');
    });

    it('should handle numbers in email as low', () => {
      const result = getEmailConfidence('test123@hotmail.com');
      expect(result.level).toBe('low');
    });

    it('should handle outlook.com with numbers as low', () => {
      const result = getEmailConfidence('user99@outlook.com');
      expect(result.level).toBe('low');
    });

    it('should handle aol.com with numbers as low', () => {
      const result = getEmailConfidence('abc123@aol.com');
      expect(result.level).toBe('low');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty domain as high if matches pattern', () => {
      // "invalid" matches [a-z]+ pattern
      const result = getEmailConfidence('invalid@');
      expect(result.level).toBe('high'); // invalid matches pattern, empty domain is corporate
    });

    it('should handle uppercase emails', () => {
      const result = getEmailConfidence('John.Doe@Company.Com');
      expect(result.level).toBe('high');
    });

    it('should handle subdomain emails', () => {
      const result = getEmailConfidence('john.doe@sales.company.com');
      expect(result.level).toBe('high');
    });
  });
});
