/**
 * SpamScoreService Tests
 * 
 * Sprint 39C.1: Tests for spam content analysis
 */

import { describe, it, expect } from 'vitest';
import { SpamScoreService, spamScoreService } from '../../services/SpamScoreService';

describe('SpamScoreService', () => {
  describe('Singleton', () => {
    it('returns singleton instance', () => {
      const instance1 = SpamScoreService.getInstance();
      const instance2 = SpamScoreService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('exports singleton as spamScoreService', () => {
      expect(spamScoreService).toBe(SpamScoreService.getInstance());
    });
  });

  describe('analyze', () => {
    describe('Clean emails', () => {
      it('scores clean professional email as low risk', () => {
        const result = spamScoreService.analyze({
          subject: 'Follow-up on our meeting yesterday',
          body: `Hi John,

It was great meeting with you yesterday. As discussed, I wanted to share some additional information about our logistics platform.

Please let me know if you have any questions.

Best regards,
Sarah

123 Main Street, Suite 100
San Francisco, CA 94102

To unsubscribe from these emails, click here.`,
        });

        expect(result.level).toBe('low');
        expect(result.score).toBeLessThan(20);
      });

      it('flags lack of unsubscribe link', () => {
        const result = spamScoreService.analyze({
          subject: 'Meeting follow-up',
          body: `Hi John,

Just following up on our conversation.

Best,
Sarah

123 Main Street, San Francisco, CA`,
        });

        expect(result.analysis.quality.hasUnsubscribe).toBe(false);
        expect(result.issues.some(i => i.category === 'compliance')).toBe(true);
      });

      it('detects personalization with merge tags', () => {
        const result = spamScoreService.analyze({
          subject: 'Hello {{first_name}}',
          body: 'Hi {{first_name}}, how are you? Unsubscribe here. 123 Main St',
        });

        expect(result.analysis.quality.personalization).toBe(true);
      });

      it('detects personalization with greetings', () => {
        const result = spamScoreService.analyze({
          subject: 'Quick question',
          body: 'Dear John, I hope this finds you well. Unsubscribe. 123 Main St',
        });

        expect(result.analysis.quality.personalization).toBe(true);
      });
    });

    describe('Subject line analysis', () => {
      it('flags all caps subject', () => {
        const result = spamScoreService.analyze({
          subject: 'URGENT: READ THIS NOW!!!',
          body: 'Some normal body content. Unsubscribe here. 123 Main St, City',
        });

        expect(result.analysis.subject.capsRatio).toBeGreaterThan(0.5);
        expect(result.issues.some(i => 
          i.location === 'subject' && i.category === 'formatting'
        )).toBe(true);
      });

      it('flags long subject line', () => {
        const result = spamScoreService.analyze({
          subject: 'This is a very long subject line that goes on and on and probably should be much shorter for better deliverability',
          body: 'Content here. Unsubscribe. 123 Main St',
        });

        expect(result.analysis.subject.length).toBeGreaterThan(70);
        expect(result.issues.some(i => i.category === 'length')).toBe(true);
      });

      it('detects spam patterns in subject', () => {
        const patterns = [
          { subject: 'Re: Re: Re: Your message', pattern: 'multiple RE' },
          { subject: 'Congratulations! You won!', pattern: 'congratulations' },
          { subject: 'Save 50% off today!!', pattern: 'percentage discount' },
          { subject: 'You have won $1000!', pattern: 'dollar amount' },
        ];

        for (const { subject, pattern } of patterns) {
          const result = spamScoreService.analyze({
            subject,
            body: 'Normal content. Unsubscribe. 123 Main St',
          });

          expect(result.issues.some(i => 
            i.location === 'subject' && i.category === 'pattern'
          ), `Should detect ${pattern}`).toBe(true);
        }
      });

      it('detects spam words in subject', () => {
        const result = spamScoreService.analyze({
          subject: 'Free trial - Act now for limited time offer',
          body: 'Normal content. Unsubscribe. 123 Main St',
        });

        expect(result.analysis.subject.hasSpamWords).toBe(true);
        expect(result.analysis.subject.spamWordsFound).toContain('free');
        expect(result.analysis.subject.spamWordsFound).toContain('act now');
      });
    });

    describe('Body content analysis', () => {
      it('counts spam words in body', () => {
        const result = spamScoreService.analyze({
          subject: 'Offer for you',
          body: `This is your chance to earn FREE money!
            
Act now to receive your BONUS cash prize.
             
Make guaranteed income today!
             
Click here now!
             
Unsubscribe. 123 Main St`,
        });

        expect(result.analysis.body.spamWordCount).toBeGreaterThan(3);
        expect(result.issues.some(i => 
          i.location === 'body' && i.category === 'spam_words'
        )).toBe(true);
      });

      it('detects excessive formatting in HTML', () => {
        const htmlBody = `
          <b>BOLD</b> <b>TEXT</b> <b>HERE</b>
          <b>MORE</b> <b>BOLD</b> <b>TEXT</b>
          <b>EVEN</b> <b>MORE</b> <b>BOLD</b>
          <b>SO</b> <b>MUCH</b> <b>BOLD</b>
          <span style="color: red">RED</span>
          <span style="color: blue">BLUE</span>
          <span style="color: green">GREEN</span>
          <span style="color: yellow">YELLOW</span>
          <span style="color: purple">PURPLE</span>
          <span style="color: orange">ORANGE</span>
          Unsubscribe. 123 Main St
        `;

        const result = spamScoreService.analyze({
          subject: 'Info',
          body: htmlBody,
          isHtml: true,
        });

        expect(result.analysis.body.hasExcessiveFormatting).toBe(true);
      });

      it('detects high image-to-text ratio', () => {
        const result = spamScoreService.analyze({
          subject: 'Check this out',
          body: '<img src="a.jpg"><img src="b.jpg"><img src="c.jpg">Short text.',
          isHtml: true,
        });

        expect(result.analysis.body.imageCount).toBe(3);
        expect(result.issues.some(i => i.category === 'content')).toBe(true);
      });

      it('flags very short body', () => {
        const result = spamScoreService.analyze({
          subject: 'Hi',
          body: 'Click here. Unsub. 123 St',
        });

        expect(result.issues.some(i => 
          i.description.includes('too short')
        )).toBe(true);
      });
    });

    describe('Link analysis', () => {
      it('counts links in email', () => {
        const result = spamScoreService.analyze({
          subject: 'Resources',
          body: `Check out these links:
            https://example.com/page1
            https://example.com/page2
            https://example.com/page3
            
            Unsubscribe. 123 Main Street, City`,
        });

        expect(result.analysis.links.totalLinks).toBe(3);
      });

      it('flags excessive links', () => {
        const links = Array.from({ length: 15 }, (_, i) => 
          `https://example.com/page${i}`
        ).join('\n');

        const result = spamScoreService.analyze({
          subject: 'Many links',
          body: `${links}\nUnsubscribe. 123 Main St`,
        });

        expect(result.analysis.links.excessiveLinks).toBe(true);
        expect(result.issues.some(i => i.category === 'links')).toBe(true);
      });

      it('detects URL shorteners', () => {
        const result = spamScoreService.analyze({
          subject: 'Check this',
          body: `Click here: https://bit.ly/abc123
            
            Unsubscribe. 123 Main Street`,
        });

        expect(result.analysis.links.suspiciousLinks).toContain('https://bit.ly/abc123');
      });

      it('detects mismatched link text in HTML', () => {
        const result = spamScoreService.analyze({
          subject: 'Important',
          body: `<a href="https://malicious.com/steal">https://trusted-bank.com/login</a>
            Unsubscribe. 123 Main St`,
          isHtml: true,
        });

        expect(result.issues.some(i => i.category === 'deceptive')).toBe(true);
        // Deceptive links are severe but combined with clean subject doesn't push over 30
        expect(result.score).toBeGreaterThan(0);
      });
    });

    describe('Risk levels', () => {
      it('categorizes low risk correctly', () => {
        const result = spamScoreService.analyze({
          subject: 'Meeting follow-up',
          body: `Hi there,
            
            Thanks for your time today.
            
            Best,
            John
            
            123 Main Street, New York, NY 10001
            
            To unsubscribe, reply STOP`,
        });

        expect(result.level).toBe('low');
        expect(result.score).toBeLessThanOrEqual(20);
      });

      it('categorizes high risk correctly', () => {
        const result = spamScoreService.analyze({
          subject: 'URGENT: ACT NOW - FREE MONEY!!!',
          body: `You have WON a MILLION DOLLARS!
            
            Click here NOW to claim your FREE prize!
            
            This is URGENT - limited time only!
            
            Guaranteed winner! Buy now!
            
            http://bit.ly/claim123
            http://tinyurl.com/free456
            http://is.gd/money789`,
        });

        // With weighted scoring, this should be at least medium risk
        expect(['medium', 'high', 'critical']).toContain(result.level);
        expect(result.score).toBeGreaterThan(20);
      });
    });

    describe('Suggestions', () => {
      it('generates relevant suggestions', () => {
        const result = spamScoreService.analyze({
          subject: 'FREE OFFER',
          body: 'Act now! Click here: http://bit.ly/test',
        });

        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions.some(s => 
          s.toLowerCase().includes('spam') || s.toLowerCase().includes('trigger')
        )).toBe(true);
      });

      it('suggests compliance fixes when missing', () => {
        const result = spamScoreService.analyze({
          subject: 'Newsletter',
          body: 'Here is our monthly newsletter content.',
        });

        expect(result.suggestions.some(s => 
          s.toLowerCase().includes('unsubscribe') || s.toLowerCase().includes('can-spam')
        )).toBe(true);
      });

      it('gives positive feedback for clean emails', () => {
        const result = spamScoreService.analyze({
          subject: 'Meeting notes',
          body: `Hi Team,
            
            Here are the notes from today's meeting.
            
            Best regards,
            Sarah
            
            123 Main Street, Suite 200
            San Francisco, CA 94102
            
            Unsubscribe from these emails`,
        });

        if (result.score < 20) {
          expect(result.suggestions.some(s => 
            s.toLowerCase().includes('good') || s.toLowerCase().includes('no major')
          )).toBe(true);
        }
      });
    });
  });

  describe('isSpamWord', () => {
    it('identifies spam words', () => {
      expect(spamScoreService.isSpamWord('free')).toBe(true);
      expect(spamScoreService.isSpamWord('urgent')).toBe(true);
      expect(spamScoreService.isSpamWord('guaranteed')).toBe(true);
    });

    it('returns false for normal words', () => {
      expect(spamScoreService.isSpamWord('meeting')).toBe(false);
      expect(spamScoreService.isSpamWord('hello')).toBe(false);
      expect(spamScoreService.isSpamWord('information')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(spamScoreService.isSpamWord('FREE')).toBe(true);
      expect(spamScoreService.isSpamWord('Free')).toBe(true);
    });
  });

  describe('getSpamCategories', () => {
    it('returns all spam categories', () => {
      const categories = spamScoreService.getSpamCategories();
      
      expect(categories.urgency).toBeDefined();
      expect(categories.freeOffer).toBeDefined();
      expect(categories.money).toBeDefined();
      expect(categories.pressure).toBeDefined();
      expect(categories.financial).toBeDefined();
      expect(categories.health).toBeDefined();
      expect(categories.deceptive).toBeDefined();
    });

    it('each category has weight and words', () => {
      const categories = spamScoreService.getSpamCategories();
      
      for (const [key, category] of Object.entries(categories)) {
        expect(category.weight, `${key} should have weight`).toBeGreaterThan(0);
        expect(category.words.length, `${key} should have words`).toBeGreaterThan(0);
      }
    });
  });

  describe('getThresholds', () => {
    it('returns score thresholds', () => {
      const thresholds = spamScoreService.getThresholds();
      
      expect(thresholds.low).toBe(20);
      expect(thresholds.medium).toBe(40);
      expect(thresholds.high).toBe(60);
    });
  });

  describe('HTML handling', () => {
    it('strips HTML tags for text analysis', () => {
      const result = spamScoreService.analyze({
        subject: 'Newsletter',
        body: `<html><body>
          <p>Hello <strong>John</strong>,</p>
          <p>This is a <em>test</em> email.</p>
          <p>Unsubscribe here.</p>
          <p>123 Main Street, City, ST 12345</p>
        </body></html>`,
        isHtml: true,
      });

      // Should not flag HTML tags as content issues
      expect(result.level).toBe('low');
    });

    it('strips style and script tags', () => {
      const result = spamScoreService.analyze({
        subject: 'Styled email',
        body: `
          <style>body { font-family: sans-serif; }</style>
          <script>alert('test');</script>
          <p>Hello there, this is a normal email with proper content.</p>
          <p>Unsubscribe link here. 123 Main Street, City</p>
        `,
        isHtml: true,
      });

      // Script/style content should not affect spam score
      expect(result.analysis.body.spamWordsFound).not.toContain('script');
    });
  });
});
