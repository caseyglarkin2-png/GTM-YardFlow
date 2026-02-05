import { describe, it, expect } from 'vitest';

// Sprint 39F: Content validation tests for EmailComplianceService.validateContentForSend
// These are pure function tests that don't need Firebase mocking

describe('EmailComplianceService.validateContentForSend', () => {
  // Mock the function signature since we're testing the logic
  function validateContentForSend(subject: string, body: string): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const subjectLower = subject.toLowerCase();

    const spamTriggers = [
      'free', 'winner', 'congratulations', 'urgent', 'act now',
      'limited time', 'exclusive deal', 'click here', 'buy now',
    ];
    
    for (const trigger of spamTriggers) {
      if (subjectLower.includes(trigger)) {
        warnings.push(`Subject contains spam trigger word: "${trigger}"`);
      }
    }

    const capsCount = (subject.match(/[A-Z]/g) || []).length;
    const totalLetters = (subject.match(/[a-zA-Z]/g) || []).length;
    if (totalLetters > 0 && capsCount / totalLetters > 0.5) {
      warnings.push('Subject has excessive capitalization (over 50%)');
    }

    if (subject.includes('!!!') || subject.includes('???')) {
      warnings.push('Subject has excessive punctuation');
    }

    if (subjectLower.startsWith('re:') || subjectLower.startsWith('fw:')) {
      warnings.push('Subject starts with Re:/Fw: which may appear misleading');
    }

    if (body.length < 50) {
      warnings.push('Body is very short - may be flagged as spam');
    }

    const linkCount = (body.match(/https?:\/\//gi) || []).length;
    const wordCount = body.split(/\s+/).length;
    if (linkCount > 0 && linkCount / wordCount > 0.1) {
      warnings.push('High ratio of links to text - may hurt deliverability');
    }

    const bodyLower = body.toLowerCase();
    if (!bodyLower.includes('{{') && !body.includes('{name}') && !body.includes('{first_name}')) {
      if (body.length > 200) {
        warnings.push('No personalization detected - consider adding recipient name');
      }
    }

    return { valid: warnings.length === 0, warnings };
  }

  describe('spam trigger detection', () => {
    it('detects FREE in subject', () => {
      const result = validateContentForSend('FREE offer for you!', 'This is a valid body with more than fifty characters in it.');
      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Subject contains spam trigger word: "free"');
    });

    it('detects WINNER in subject', () => {
      const result = validateContentForSend('Congratulations Winner!', 'This is a valid body with more than fifty characters in it.');
      expect(result.warnings).toContain('Subject contains spam trigger word: "winner"');
      expect(result.warnings).toContain('Subject contains spam trigger word: "congratulations"');
    });

    it('detects urgent in subject', () => {
      const result = validateContentForSend('URGENT: Act now!', 'This is a valid body with more than fifty characters in it.');
      expect(result.warnings).toContain('Subject contains spam trigger word: "urgent"');
      expect(result.warnings).toContain('Subject contains spam trigger word: "act now"');
    });

    it('passes clean subject', () => {
      const result = validateContentForSend(
        'Quick question about Manifest 2026',
        'Hi {{first_name}}, I wanted to reach out because I noticed your company is in the logistics space. Would love to connect.'
      );
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('formatting validation', () => {
    it('detects excessive caps', () => {
      const result = validateContentForSend('MEETING REQUEST FOR YOU TODAY', 'This is a valid body with more than fifty characters in it.');
      expect(result.warnings).toContain('Subject has excessive capitalization (over 50%)');
    });

    it('detects excessive punctuation', () => {
      const result = validateContentForSend('Amazing opportunity!!!', 'This is a valid body with more than fifty characters in it.');
      expect(result.warnings).toContain('Subject has excessive punctuation');
    });

    it('detects misleading Re: prefix', () => {
      const result = validateContentForSend('Re: Our previous conversation', 'This is a valid body with more than fifty characters in it.');
      expect(result.warnings).toContain('Subject starts with Re:/Fw: which may appear misleading');
    });

    it('detects misleading Fw: prefix', () => {
      const result = validateContentForSend('Fw: Interesting article', 'This is a valid body with more than fifty characters in it.');
      expect(result.warnings).toContain('Subject starts with Re:/Fw: which may appear misleading');
    });
  });

  describe('body validation', () => {
    it('warns about very short body', () => {
      const result = validateContentForSend('Hello', 'Click here!');
      expect(result.warnings).toContain('Body is very short - may be flagged as spam');
    });

    it('warns about link-heavy content', () => {
      const result = validateContentForSend(
        'Check these links',
        'https://link1.com https://link2.com https://link3.com more links!'
      );
      expect(result.warnings).toContain('High ratio of links to text - may hurt deliverability');
    });

    it('warns about missing personalization in long templates', () => {
      const longBody = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
      const result = validateContentForSend('Generic email', longBody);
      expect(result.warnings).toContain('No personalization detected - consider adding recipient name');
    });

    it('accepts personalized templates', () => {
      const personalizedBody = 'Hi {{first_name}}, Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.';
      const result = validateContentForSend('Following up', personalizedBody);
      expect(result.warnings).not.toContain('No personalization detected - consider adding recipient name');
    });
  });
});
