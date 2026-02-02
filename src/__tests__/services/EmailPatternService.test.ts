/**
 * Tests for EmailPatternService
 * Sprint 1001: Email Pattern Inference
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EmailPatternService,
  detectPattern,
  generateEmail,
  type EmailPattern,
  type DomainPatternData,
} from '../../services/EmailPatternService';

describe('EmailPatternService', () => {
  describe('detectPattern', () => {
    it('detects first.last pattern', () => {
      expect(detectPattern('john.doe@acme.com', 'John', 'Doe')).toBe('first.last');
      expect(detectPattern('jane.smith@company.io', 'Jane', 'Smith')).toBe('first.last');
    });

    it('detects first pattern', () => {
      expect(detectPattern('john@acme.com', 'John', 'Doe')).toBe('first');
      expect(detectPattern('jane@company.io', 'Jane', 'Smith')).toBe('first');
    });

    it('detects flast pattern (first initial + last)', () => {
      expect(detectPattern('jdoe@acme.com', 'John', 'Doe')).toBe('flast');
      expect(detectPattern('jsmith@company.io', 'Jane', 'Smith')).toBe('flast');
    });

    it('detects f.last pattern', () => {
      expect(detectPattern('j.doe@acme.com', 'John', 'Doe')).toBe('f.last');
      expect(detectPattern('j.smith@company.io', 'Jane', 'Smith')).toBe('f.last');
    });

    it('detects firstlast pattern', () => {
      expect(detectPattern('johndoe@acme.com', 'John', 'Doe')).toBe('firstlast');
      expect(detectPattern('janesmith@company.io', 'Jane', 'Smith')).toBe('firstlast');
    });

    it('detects first_last pattern', () => {
      expect(detectPattern('john_doe@acme.com', 'John', 'Doe')).toBe('first_last');
    });

    it('detects last pattern', () => {
      expect(detectPattern('doe@acme.com', 'John', 'Doe')).toBe('last');
    });

    it('detects lastf pattern', () => {
      expect(detectPattern('doej@acme.com', 'John', 'Doe')).toBe('lastf');
    });

    it('detects last.first pattern', () => {
      expect(detectPattern('doe.john@acme.com', 'John', 'Doe')).toBe('last.first');
    });

    it('returns unknown for unrecognized patterns', () => {
      expect(detectPattern('johnnyd@acme.com', 'John', 'Doe')).toBe('unknown');
      expect(detectPattern('contact@acme.com', 'John', 'Doe')).toBe('unknown');
    });

    it('handles case insensitivity', () => {
      expect(detectPattern('JOHN.DOE@acme.com', 'john', 'doe')).toBe('first.last');
      expect(detectPattern('John.Doe@acme.com', 'JOHN', 'DOE')).toBe('first.last');
    });

    it('handles names with accents', () => {
      expect(detectPattern('jose.garcia@acme.com', 'José', 'García')).toBe('first.last');
    });
  });

  describe('generateEmail', () => {
    it('generates first.last pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'first.last')).toBe('john.doe@acme.com');
    });

    it('generates first pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'first')).toBe('john@acme.com');
    });

    it('generates flast pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'flast')).toBe('jdoe@acme.com');
    });

    it('generates f.last pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'f.last')).toBe('j.doe@acme.com');
    });

    it('generates firstlast pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'firstlast')).toBe('johndoe@acme.com');
    });

    it('generates first_last pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'first_last')).toBe('john_doe@acme.com');
    });

    it('generates last pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'last')).toBe('doe@acme.com');
    });

    it('generates lastf pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'lastf')).toBe('doej@acme.com');
    });

    it('generates last.first pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'last.first')).toBe('doe.john@acme.com');
    });

    it('normalizes names with special characters', () => {
      expect(generateEmail("O'Brien", 'Mary-Jane', 'acme.com', 'first.last')).toBe('obrien.maryjane@acme.com');
    });

    it('handles names with accents', () => {
      expect(generateEmail('José', 'García', 'acme.com', 'first.last')).toBe('jose.garcia@acme.com');
    });

    it('defaults to first.last for unknown pattern', () => {
      expect(generateEmail('John', 'Doe', 'acme.com', 'unknown')).toBe('john.doe@acme.com');
    });

    it('returns empty string for missing data', () => {
      expect(generateEmail('', 'Doe', 'acme.com', 'first.last')).toBe('');
      expect(generateEmail('John', '', 'acme.com', 'first.last')).toBe('');
      expect(generateEmail('John', 'Doe', '', 'first.last')).toBe('');
    });
  });

  describe('EmailPatternService class', () => {
    let service: EmailPatternService;

    beforeEach(() => {
      service = new EmailPatternService();
    });

    describe('learnFromSamples', () => {
      it('learns pattern from consistent samples', () => {
        service.learnFromSamples([
          { email: 'john.doe@acme.com', firstName: 'John', lastName: 'Doe' },
          { email: 'jane.smith@acme.com', firstName: 'Jane', lastName: 'Smith' },
          { email: 'bob.jones@acme.com', firstName: 'Bob', lastName: 'Jones' },
        ]);

        expect(service.hasPattern('acme.com')).toBe(true);
        const pattern = service.getPattern('acme.com');
        expect(pattern?.pattern).toBe('first.last');
        expect(pattern?.confidence).toBe(100);
        expect(pattern?.sampleCount).toBe(3);
      });

      it('picks most common pattern when mixed', () => {
        service.learnFromSamples([
          { email: 'john.doe@acme.com', firstName: 'John', lastName: 'Doe' },
          { email: 'jane.smith@acme.com', firstName: 'Jane', lastName: 'Smith' },
          { email: 'bjones@acme.com', firstName: 'Bob', lastName: 'Jones' }, // Different pattern
        ]);

        const pattern = service.getPattern('acme.com');
        expect(pattern?.pattern).toBe('first.last');
        expect(pattern?.confidence).toBe(67); // 2/3
      });

      it('learns patterns from multiple domains', () => {
        service.learnFromSamples([
          { email: 'john.doe@acme.com', firstName: 'John', lastName: 'Doe' },
          { email: 'jsmith@bigco.com', firstName: 'Jane', lastName: 'Smith' },
          { email: 'bjones@bigco.com', firstName: 'Bob', lastName: 'Jones' },
        ]);

        expect(service.hasPattern('acme.com')).toBe(true);
        expect(service.hasPattern('bigco.com')).toBe(true);
        expect(service.getPattern('acme.com')?.pattern).toBe('first.last');
        expect(service.getPattern('bigco.com')?.pattern).toBe('flast');
      });
    });

    describe('inferEmail', () => {
      beforeEach(() => {
        service.learnFromSamples([
          { email: 'john.doe@acme.com', firstName: 'John', lastName: 'Doe' },
          { email: 'jane.smith@acme.com', firstName: 'Jane', lastName: 'Smith' },
        ]);
      });

      it('infers email for known domain', () => {
        const result = service.inferEmail('Bob', 'Jones', 'acme.com');
        expect(result).not.toBeNull();
        expect(result?.email).toBe('bob.jones@acme.com');
        expect(result?.pattern).toBe('first.last');
        expect(result?.confidence).toBe(100);
      });

      it('returns null for unknown domain', () => {
        const result = service.inferEmail('Bob', 'Jones', 'unknown.com');
        expect(result).toBeNull();
      });

      it('returns null when confidence below threshold', () => {
        service.learnFromSamples([
          { email: 'asmith@lowconf.com', firstName: 'Alice', lastName: 'Smith' },
          { email: 'bob.jones@lowconf.com', firstName: 'Bob', lastName: 'Jones' },
        ]);

        const result = service.inferEmail('Charlie', 'Brown', 'lowconf.com', 80);
        expect(result).toBeNull(); // 50% confidence < 80% threshold
      });
    });

    describe('inferEmailWithFallback', () => {
      it('uses known pattern for known domain', () => {
        service.learnFromSamples([
          { email: 'jdoe@acme.com', firstName: 'John', lastName: 'Doe' },
        ]);

        const result = service.inferEmailWithFallback('Bob', 'Jones', 'acme.com');
        expect(result.email).toBe('bjones@acme.com');
        expect(result.pattern).toBe('flast');
        expect(result.confidence).toBe(100);
      });

      it('falls back to first.last for unknown domain', () => {
        const result = service.inferEmailWithFallback('Bob', 'Jones', 'unknown.com');
        expect(result.email).toBe('bob.jones@unknown.com');
        expect(result.pattern).toBe('first.last');
        expect(result.confidence).toBe(30);
      });
    });

    describe('initialization with pattern data', () => {
      it('can be initialized with existing patterns', () => {
        const patternData: Record<string, DomainPatternData> = {
          'acme.com': { pattern: 'first.last', sampleCount: 10, confidence: 95 },
          'bigco.com': { pattern: 'flast', sampleCount: 5, confidence: 80 },
        };

        const initializedService = new EmailPatternService(patternData);
        
        expect(initializedService.domainCount).toBe(2);
        expect(initializedService.getPattern('acme.com')?.pattern).toBe('first.last');
        expect(initializedService.getPattern('bigco.com')?.pattern).toBe('flast');
      });
    });

    describe('exportPatterns', () => {
      it('exports learned patterns', () => {
        service.learnFromSamples([
          { email: 'john.doe@acme.com', firstName: 'John', lastName: 'Doe' },
          { email: 'jsmith@bigco.com', firstName: 'Jane', lastName: 'Smith' },
        ]);

        const exported = service.exportPatterns();
        
        expect(exported['acme.com']).toBeDefined();
        expect(exported['acme.com'].pattern).toBe('first.last');
        expect(exported['bigco.com']).toBeDefined();
        expect(exported['bigco.com'].pattern).toBe('flast');
      });
    });

    describe('getStats', () => {
      it('returns statistics about pattern database', () => {
        service.learnFromSamples([
          { email: 'john.doe@acme.com', firstName: 'John', lastName: 'Doe' },
          { email: 'jane.smith@acme.com', firstName: 'Jane', lastName: 'Smith' },
          { email: 'jsmith@bigco.com', firstName: 'Jane', lastName: 'Smith' },
        ]);

        const stats = service.getStats();
        
        expect(stats.totalDomains).toBe(2);
        expect(stats.patternDistribution['first.last']).toBe(1);
        expect(stats.patternDistribution['flast']).toBe(1);
        expect(stats.avgConfidence).toBeGreaterThan(0);
      });
    });
  });
});
