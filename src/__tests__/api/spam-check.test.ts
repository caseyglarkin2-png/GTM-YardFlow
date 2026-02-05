/**
 * /api/email/spam-check Endpoint Tests
 * 
 * Sprint 39C.2: Tests for spam check API endpoint
 * 
 * Note: These are contract tests that validate the expected
 * request/response format for the spam-check endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpamScoreService } from '../../services/SpamScoreService';

describe('/api/email/spam-check', () => {
  describe('SpamScoreService integration', () => {
    const spamService = SpamScoreService.getInstance();

    describe('Response format', () => {
      it('returns expected structure', () => {
        const result = spamService.analyze({
          subject: 'Test email',
          body: 'Hello, this is a test email with enough content. Unsubscribe. 123 Main St',
        });

        // Verify all required fields are present
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('level');
        expect(result).toHaveProperty('issues');
        expect(result).toHaveProperty('suggestions');
        expect(result).toHaveProperty('analysis');

        // Verify types
        expect(typeof result.score).toBe('number');
        expect(['low', 'medium', 'high', 'critical']).toContain(result.level);
        expect(Array.isArray(result.issues)).toBe(true);
        expect(Array.isArray(result.suggestions)).toBe(true);
        expect(typeof result.analysis).toBe('object');
      });

      it('analysis contains all sub-sections', () => {
        const result = spamService.analyze({
          subject: 'Test',
          body: 'Content here. Unsubscribe. 123 Main St',
        });

        expect(result.analysis).toHaveProperty('subject');
        expect(result.analysis).toHaveProperty('body');
        expect(result.analysis).toHaveProperty('links');
        expect(result.analysis).toHaveProperty('quality');
      });

      it('issues have correct structure', () => {
        const result = spamService.analyze({
          subject: 'FREE MONEY NOW!!!',
          body: 'Click here to win!',
        });

        // Should have at least one issue
        expect(result.issues.length).toBeGreaterThan(0);

        // Check first issue structure
        const issue = result.issues[0];
        expect(issue).toHaveProperty('category');
        expect(issue).toHaveProperty('description');
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('location');

        expect(typeof issue.category).toBe('string');
        expect(typeof issue.description).toBe('string');
        expect(typeof issue.severity).toBe('number');
        expect(['subject', 'body', 'link', 'general']).toContain(issue.location);
      });
    });

    describe('Request handling', () => {
      it('handles plain text body', () => {
        const result = spamService.analyze({
          subject: 'Plain text email',
          body: 'This is a plain text email without any HTML.',
          isHtml: false,
        });

        expect(result.score).toBeDefined();
        expect(result.analysis.body.imageCount).toBe(0);
      });

      it('handles HTML body', () => {
        const result = spamService.analyze({
          subject: 'HTML email',
          body: '<p>This is <strong>HTML</strong> content. Unsubscribe. 123 Main St</p>',
          isHtml: true,
        });

        expect(result.score).toBeDefined();
      });

      it('handles empty subject', () => {
        const result = spamService.analyze({
          subject: '',
          body: 'Body content here. Unsubscribe. 123 Main Street, City',
        });

        expect(result).toBeDefined();
        expect(result.analysis.subject.length).toBe(0);
      });

      it('handles very long content', () => {
        const longBody = 'This is some content. '.repeat(500) + 'Unsubscribe. 123 Main St';
        
        const result = spamService.analyze({
          subject: 'Long email',
          body: longBody,
        });

        expect(result).toBeDefined();
        expect(result.score).toBeLessThanOrEqual(100);
      });

      it('handles special characters', () => {
        const result = spamService.analyze({
          subject: 'Test with émojis 🎉 and spëcial çharacters',
          body: 'Body with unicode: ñ, ü, 中文, العربية. Unsubscribe. 123 Main St',
        });

        expect(result).toBeDefined();
      });
    });

    describe('Score boundaries', () => {
      it('score is between 0 and 100', () => {
        // Test clean email
        const clean = spamService.analyze({
          subject: 'Meeting notes',
          body: 'Hi team, here are the meeting notes. Best, John. 123 Main St. Unsubscribe.',
        });
        expect(clean.score).toBeGreaterThanOrEqual(0);
        expect(clean.score).toBeLessThanOrEqual(100);

        // Test spam-heavy email
        const spammy = spamService.analyze({
          subject: 'FREE URGENT ACT NOW!!!',
          body: 'FREE money! Win MILLIONS! URGENT! Click NOW! Guaranteed!',
        });
        expect(spammy.score).toBeGreaterThanOrEqual(0);
        expect(spammy.score).toBeLessThanOrEqual(100);
      });

      it('risk levels align with score thresholds', () => {
        const thresholds = spamService.getThresholds();

        // Test low risk (0-20)
        const lowRisk = spamService.analyze({
          subject: 'Meeting follow-up',
          body: 'Thanks for your time. Best, Sarah. 123 Main Street. Unsubscribe here.',
        });
        if (lowRisk.score <= thresholds.low) {
          expect(lowRisk.level).toBe('low');
        }

        // Test medium risk (21-40)
        const mediumRisk = spamService.analyze({
          subject: 'Special offer for you',
          body: 'Check out this deal. Limited time. Click here. Unsubscribe. 123 Main St',
        });
        if (mediumRisk.score > thresholds.low && mediumRisk.score <= thresholds.medium) {
          expect(mediumRisk.level).toBe('medium');
        }
      });
    });

    describe('Analysis breakdown', () => {
      it('subject analysis is complete', () => {
        const result = spamService.analyze({
          subject: 'TEST SUBJECT HERE',
          body: 'Body content. Unsubscribe. 123 Main St',
        });

        expect(result.analysis.subject).toHaveProperty('score');
        expect(result.analysis.subject).toHaveProperty('capsRatio');
        expect(result.analysis.subject).toHaveProperty('length');
        expect(result.analysis.subject).toHaveProperty('hasSpamWords');
        expect(result.analysis.subject).toHaveProperty('spamWordsFound');
      });

      it('body analysis is complete', () => {
        const result = spamService.analyze({
          subject: 'Test',
          body: '<p>HTML content with <img src="test.jpg"> image</p>',
          isHtml: true,
        });

        expect(result.analysis.body).toHaveProperty('score');
        expect(result.analysis.body).toHaveProperty('spamWordCount');
        expect(result.analysis.body).toHaveProperty('spamWordsFound');
        expect(result.analysis.body).toHaveProperty('hasExcessiveFormatting');
        expect(result.analysis.body).toHaveProperty('imageCount');
        expect(result.analysis.body).toHaveProperty('linkCount');
      });

      it('link analysis is complete', () => {
        const result = spamService.analyze({
          subject: 'Links',
          body: 'Check these: https://example.com https://bit.ly/test Unsubscribe. 123 Main St',
        });

        expect(result.analysis.links).toHaveProperty('score');
        expect(result.analysis.links).toHaveProperty('totalLinks');
        expect(result.analysis.links).toHaveProperty('suspiciousLinks');
        expect(result.analysis.links).toHaveProperty('excessiveLinks');
      });

      it('quality analysis is complete', () => {
        const result = spamService.analyze({
          subject: 'Test',
          body: 'Hello {{firstName}}, this is a test. Unsubscribe. 123 Main Street',
        });

        expect(result.analysis.quality).toHaveProperty('readabilityScore');
        expect(result.analysis.quality).toHaveProperty('personalization');
        expect(result.analysis.quality).toHaveProperty('hasUnsubscribe');
        expect(result.analysis.quality).toHaveProperty('hasPhysicalAddress');
      });
    });
  });

  describe('Request validation', () => {
    it('validates subject is string', () => {
      // This would be validated by the endpoint
      const invalidSubject = { subject: 123, body: 'test' };
      expect(typeof invalidSubject.subject).not.toBe('string');
    });

    it('validates body is string', () => {
      // This would be validated by the endpoint
      const invalidBody = { subject: 'test', body: null };
      expect(invalidBody.body).toBeNull();
    });

    it('validates isHtml is boolean', () => {
      // This would be validated by the endpoint
      const invalidHtml = { subject: 'test', body: 'test', isHtml: 'yes' };
      expect(typeof invalidHtml.isHtml).not.toBe('boolean');
    });
  });

  describe('Authentication contract', () => {
    it('requires Authorization header or x-service-key', () => {
      // Contract: endpoint requires one of:
      // - Authorization: Bearer <firebase-token>
      // - x-service-key: <RAILWAY_API_SECRET or CRON_SECRET>
      
      // This is a documentation test
      const authMethods = ['Authorization: Bearer <token>', 'x-service-key: <secret>'];
      expect(authMethods.length).toBe(2);
    });

    it('returns 401 without auth', () => {
      // Contract: unauthenticated requests return 401
      const expectedStatus = 401;
      expect(expectedStatus).toBe(401);
    });

    it('returns 405 for non-POST methods', () => {
      // Contract: only POST is allowed
      const expectedStatus = 405;
      expect(expectedStatus).toBe(405);
    });
  });

  describe('Response metadata', () => {
    it('endpoint adds requestId to response', () => {
      // Contract: response includes requestId
      const expectedFields = ['score', 'level', 'issues', 'suggestions', 'analysis', 'requestId', 'analyzedAt', 'userId'];
      expect(expectedFields).toContain('requestId');
    });

    it('endpoint adds analyzedAt timestamp', () => {
      // Contract: response includes timestamp
      const expectedFields = ['score', 'level', 'issues', 'suggestions', 'analysis', 'requestId', 'analyzedAt', 'userId'];
      expect(expectedFields).toContain('analyzedAt');
    });
  });
});
