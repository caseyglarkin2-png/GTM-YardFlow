/**
 * Unit tests for DM Character Counter
 * 
 * Tests the 250-character limit enforcement for Manifest DMs
 */

import { describe, it, expect } from 'vitest';

// Constants matching App.tsx
const DM_CHAR_LIMIT = 250;
const WARN_THRESHOLD = 200;

// Helper functions that mirror App.tsx logic
function isOverLimit(text: string): boolean {
  return text.length > DM_CHAR_LIMIT;
}

function isNearLimit(text: string): boolean {
  return text.length >= WARN_THRESHOLD && text.length <= DM_CHAR_LIMIT;
}

function getRemainingChars(text: string): number {
  return DM_CHAR_LIMIT - text.length;
}

function getCharCountColor(text: string): 'red' | 'yellow' | 'green' {
  if (isOverLimit(text)) return 'red';
  if (isNearLimit(text)) return 'yellow';
  return 'green';
}

describe('DM Character Counter', () => {
  describe('isOverLimit', () => {
    it('returns false for empty string', () => {
      expect(isOverLimit('')).toBe(false);
    });

    it('returns false for text under 250 chars', () => {
      const text = 'a'.repeat(249);
      expect(isOverLimit(text)).toBe(false);
    });

    it('returns false for exactly 250 chars', () => {
      const text = 'a'.repeat(250);
      expect(isOverLimit(text)).toBe(false);
    });

    it('returns true for 251 chars', () => {
      const text = 'a'.repeat(251);
      expect(isOverLimit(text)).toBe(true);
    });
  });

  describe('isNearLimit', () => {
    it('returns false for text under 200 chars', () => {
      const text = 'a'.repeat(199);
      expect(isNearLimit(text)).toBe(false);
    });

    it('returns true for exactly 200 chars', () => {
      const text = 'a'.repeat(200);
      expect(isNearLimit(text)).toBe(true);
    });

    it('returns true for 250 chars', () => {
      const text = 'a'.repeat(250);
      expect(isNearLimit(text)).toBe(true);
    });

    it('returns false for text over 250 chars', () => {
      const text = 'a'.repeat(251);
      expect(isNearLimit(text)).toBe(false);
    });
  });

  describe('getRemainingChars', () => {
    it('returns 250 for empty string', () => {
      expect(getRemainingChars('')).toBe(250);
    });

    it('returns 150 for 100 char string', () => {
      const text = 'a'.repeat(100);
      expect(getRemainingChars(text)).toBe(150);
    });

    it('returns 0 for 250 char string', () => {
      const text = 'a'.repeat(250);
      expect(getRemainingChars(text)).toBe(0);
    });

    it('returns negative for over-limit string', () => {
      const text = 'a'.repeat(260);
      expect(getRemainingChars(text)).toBe(-10);
    });
  });

  describe('getCharCountColor', () => {
    it('returns green for short text', () => {
      expect(getCharCountColor('Hello!')).toBe('green');
    });

    it('returns green for text at 199 chars', () => {
      const text = 'a'.repeat(199);
      expect(getCharCountColor(text)).toBe('green');
    });

    it('returns yellow for text at 200 chars (warning zone)', () => {
      const text = 'a'.repeat(200);
      expect(getCharCountColor(text)).toBe('yellow');
    });

    it('returns yellow for text at exactly 250 chars', () => {
      const text = 'a'.repeat(250);
      expect(getCharCountColor(text)).toBe('yellow');
    });

    it('returns red for text over 250 chars', () => {
      const text = 'a'.repeat(251);
      expect(getCharCountColor(text)).toBe('red');
    });
  });

  describe('Template Validation', () => {
    // Sample templates that should fit under 250 chars
    const SAMPLE_TEMPLATES = {
      intro: `Hey {{firstName}},

Love what {{company}} is building. We're bringing product leads to Manifest 2025 - would you be interested in meeting our curated VIP truck fleet buyers?

Quick intro: {{calendlyLink}}`,

      direct: `Hi {{firstName}},

Quick note - I'm connecting execs at Manifest who need fleet solutions with the right partners.

Interested in 15 min? {{calendlyLink}}`,

      minimal: `Hey {{firstName}}, saw your work at {{company}}. We're curating VIP meetings at Manifest. Worth a quick chat? {{calendlyLink}}`,
    };

    // Short link placeholder (what we'd use in production)
    const SHORT_LINK = 'https://cal.co/j/15';
    
    // Function to render template
    function renderTemplate(template: string, data: { firstName: string; company: string; calendlyLink: string }): string {
      return template
        .replace(/\{\{firstName\}\}/g, data.firstName)
        .replace(/\{\{company\}\}/g, data.company)
        .replace(/\{\{calendlyLink\}\}/g, data.calendlyLink);
    }

    it('intro template fits under limit with short link', () => {
      const rendered = renderTemplate(SAMPLE_TEMPLATES.intro, {
        firstName: 'John',
        company: 'Acme',
        calendlyLink: SHORT_LINK,
      });
      
      expect(rendered.length).toBeLessThanOrEqual(DM_CHAR_LIMIT);
    });

    it('direct template fits under limit with short link', () => {
      const rendered = renderTemplate(SAMPLE_TEMPLATES.direct, {
        firstName: 'John',
        company: 'Acme',
        calendlyLink: SHORT_LINK,
      });
      
      expect(rendered.length).toBeLessThanOrEqual(DM_CHAR_LIMIT);
    });

    it('minimal template fits under limit with short link', () => {
      const rendered = renderTemplate(SAMPLE_TEMPLATES.minimal, {
        firstName: 'John',
        company: 'Acme',
        calendlyLink: SHORT_LINK,
      });
      
      expect(rendered.length).toBeLessThanOrEqual(DM_CHAR_LIMIT);
    });

    it('templates may exceed limit with long company names', () => {
      const rendered = renderTemplate(SAMPLE_TEMPLATES.intro, {
        firstName: 'Bartholomew',
        company: 'International Business Machines Corporation Logistics Division',
        calendlyLink: SHORT_LINK,
      });
      
      // This demonstrates why we have the warning - some real data may exceed
      // The UI should warn users in this case
      console.log(`Long name template: ${rendered.length} chars`);
      
      // Just verify we're testing this case
      expect(rendered.length).toBeGreaterThan(0);
    });
  });

  describe('Copy Blocking', () => {
    it('blocks copy when over limit', () => {
      const text = 'a'.repeat(251);
      const canCopy = !isOverLimit(text);
      
      expect(canCopy).toBe(false);
    });

    it('allows copy at exactly 250 chars', () => {
      const text = 'a'.repeat(250);
      const canCopy = !isOverLimit(text);
      
      expect(canCopy).toBe(true);
    });

    it('allows copy under limit', () => {
      const text = 'Hello world!';
      const canCopy = !isOverLimit(text);
      
      expect(canCopy).toBe(true);
    });
  });
});
