/**
 * Tests for OutOfOfficeDetector
 * 
 * Sprint 3 T3.4: Unit tests for OOO detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  OutOfOfficeDetector, 
  outOfOfficeDetector,
  detectOOO,
  shouldPauseForOOO,
  type OOODetectionResult 
} from './OutOfOfficeDetector';

describe('OutOfOfficeDetector', () => {
  let detector: OutOfOfficeDetector;

  beforeEach(() => {
    detector = new OutOfOfficeDetector();
  });

  describe('detect', () => {
    describe('English OOO patterns', () => {
      it('should detect "out of office" in subject', () => {
        const result = detector.detect('Out of Office: Re: Your proposal', '');
        expect(result.isOOO).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(60);
      });

      it('should detect "out of office" in body', () => {
        const result = detector.detect(
          'Re: Your proposal',
          'Hi, I am currently out of the office with limited access to email. I will respond when I return on Monday.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(60);
      });

      it('should detect automatic reply', () => {
        const result = detector.detect(
          'Automatic Reply: Meeting request',
          'This is an automatic reply. I am away from my desk until January 15th.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(60);
      });

      it('should detect vacation message', () => {
        const result = detector.detect(
          'Re: Proposal',
          'Thanks for your email! I am on vacation until next Monday. I will have limited email access during this time.'
        );
        expect(result.isOOO).toBe(true);
      });

      it('should detect PTO/OOO abbreviations', () => {
        const result = detector.detect('Re: Demo request', "Hi! I'm currently OOO until Friday.");
        expect(result.isOOO).toBe(true);
      });

      it('should detect limited access message', () => {
        const result = detector.detect(
          'Re: Partnership',
          'I will have limited email access for the next week. Please contact Sarah for urgent matters.'
        );
        expect(result.isOOO).toBe(true);
      });

      it('should detect parental leave', () => {
        const result = detector.detect(
          'Automatic Reply',
          'I am currently on maternity leave and will return in February.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(70);
      });
    });

    describe('German OOO patterns', () => {
      it('should detect Abwesenheitsnotiz', () => {
        const result = detector.detect(
          'Abwesenheitsnotiz: Betreff',
          'Ich bin derzeit nicht im Büro und werde am Montag zurückkehren.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.language).toBe('de');
      });

      it('should detect Urlaub message', () => {
        const result = detector.detect(
          'Re: Anfrage',
          'Ich bin im Urlaub bis zum 15. Januar.'
        );
        expect(result.isOOO).toBe(true);
      });
    });

    describe('French OOO patterns', () => {
      it('should detect absence du bureau', () => {
        const result = detector.detect(
          'Réponse automatique',
          'Je suis absent du bureau jusqu\'au lundi.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.language).toBe('fr');
      });
    });

    describe('Spanish OOO patterns', () => {
      it('should detect fuera de oficina', () => {
        const result = detector.detect(
          'Respuesta automática',
          'Estoy fuera de la oficina hasta el próximo lunes.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.language).toBe('es');
      });
    });

    describe('Non-OOO messages', () => {
      it('should NOT detect regular reply as OOO', () => {
        const result = detector.detect(
          'Re: Your proposal',
          'Thanks for reaching out! This looks interesting. Let\'s schedule a call next week to discuss.'
        );
        expect(result.isOOO).toBe(false);
      });

      it('should NOT detect interest response as OOO', () => {
        const result = detector.detect(
          'Re: YardFlow Demo',
          'Hi, I\'m interested in learning more. Can you call me at 555-1234?'
        );
        expect(result.isOOO).toBe(false);
      });

      it('should NOT detect unsubscribe request as OOO', () => {
        const result = detector.detect(
          'Re: Your email',
          'Please unsubscribe me from your mailing list. Remove me from your database.'
        );
        expect(result.isOOO).toBe(false);
      });

      it('should reduce confidence for messages with engagement signals', () => {
        const result = detector.detect(
          'Re: Demo',
          'I am currently out of office but sounds good! Let\'s schedule something when I\'m back.'
        );
        // Still OOO but lower confidence due to engagement signals
        expect(result.confidence).toBeLessThan(90);
      });
    });

    describe('Return date extraction', () => {
      it('should extract month-day format', () => {
        const result = detector.detect(
          'Out of Office',
          'I am out of the office and will return on January 15.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.returnDate).toBeDefined();
        expect(result.returnDateText).toContain('january 15');
      });

      it('should extract abbreviated month format', () => {
        const result = detector.detect(
          'Automatic Reply',
          'Away from office until Jan 20th. Back on Jan 21.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.returnDate).toBeDefined();
      });

      it('should extract numeric date format', () => {
        const result = detector.detect(
          'OOO',
          'I will be back on 1/15 with limited access until then.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.returnDate).toBeDefined();
      });

      it('should extract weekday return date', () => {
        const result = detector.detect(
          'Out of Office',
          'I am away until Monday. For urgent matters contact...'
        );
        expect(result.isOOO).toBe(true);
        expect(result.returnDate).toBeDefined();
        expect(result.returnDateText?.toLowerCase()).toContain('monday');
      });

      it('should handle "next week" return', () => {
        const result = detector.detect(
          'Auto Reply',
          'I am out of office and will return next week.'
        );
        expect(result.isOOO).toBe(true);
        expect(result.returnDate).toBeDefined();
      });
    });
  });

  describe('getScheduleAction', () => {
    it('should not pause for non-OOO', () => {
      const detection: OOODetectionResult = {
        isOOO: false,
        confidence: 20,
        matchedPatterns: [],
      };
      const action = detector.getScheduleAction(detection);
      expect(action.shouldPause).toBe(false);
    });

    it('should pause with return date when detected', () => {
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + 3);
      
      const detection: OOODetectionResult = {
        isOOO: true,
        confidence: 85,
        returnDate,
        returnDateText: 'January 15',
        matchedPatterns: ['out of office'],
      };
      
      const action = detector.getScheduleAction(detection);
      expect(action.shouldPause).toBe(true);
      expect(action.resumeAt).toBeDefined();
      expect(action.resumeAt!.getTime()).toBeGreaterThan(returnDate.getTime());
      expect(action.reason).toContain('85%');
    });

    it('should default to 5 day pause when no return date', () => {
      const detection: OOODetectionResult = {
        isOOO: true,
        confidence: 70,
        matchedPatterns: ['out of office'],
      };
      
      const action = detector.getScheduleAction(detection);
      expect(action.shouldPause).toBe(true);
      expect(action.resumeAt).toBeDefined();
      expect(action.reason).toContain('5 day pause');
    });
  });

  describe('quickCheck', () => {
    it('should quickly identify OOO subjects', () => {
      expect(detector.quickCheck('Out of Office: Re: Proposal')).toBe(true);
      expect(detector.quickCheck('Automatic Reply: Meeting')).toBe(true);
      expect(detector.quickCheck('Auto: Your message')).toBe(true);
    });

    it('should quickly reject non-OOO subjects', () => {
      expect(detector.quickCheck('Re: Your proposal')).toBe(false);
      expect(detector.quickCheck('Thanks for reaching out!')).toBe(false);
      expect(detector.quickCheck('Question about pricing')).toBe(false);
    });
  });

  describe('isUnsubscribeRequest', () => {
    it('should detect unsubscribe requests', () => {
      expect(detector.isUnsubscribeRequest('Please unsubscribe me')).toBe(true);
      expect(detector.isUnsubscribeRequest('Remove me from your list')).toBe(true);
      expect(detector.isUnsubscribeRequest('Stop emailing me')).toBe(true);
      expect(detector.isUnsubscribeRequest('Please opt out of future emails')).toBe(true);
      expect(detector.isUnsubscribeRequest('Do not contact me again')).toBe(true);
    });

    it('should NOT flag regular messages as unsubscribe', () => {
      expect(detector.isUnsubscribeRequest('Thanks for your email')).toBe(false);
      expect(detector.isUnsubscribeRequest("Let's schedule a call")).toBe(false);
    });
  });
});

describe('Module exports', () => {
  describe('detectOOO', () => {
    it('should use singleton detector', () => {
      const result = detectOOO('Out of Office', 'I am away');
      expect(result.isOOO).toBe(true);
    });
  });

  describe('shouldPauseForOOO', () => {
    it('should return boolean for pause decision', () => {
      expect(shouldPauseForOOO('Out of Office', 'I am away until Monday')).toBe(true);
      expect(shouldPauseForOOO('Re: Proposal', 'Sounds great!')).toBe(false);
    });
  });
});
