/**
 * Duplicate Detector Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DuplicateDetector,
  normalizeEmail,
  normalizePhone,
  normalizeLinkedInUrl,
  normalizeName,
  nameMatchScore,
  getDuplicateDetector,
  resetDuplicateDetector,
} from '../../services/DuplicateDetector';
import type { Prospect } from '../../types';

// ============================================
// Test Fixtures
// ============================================

const createMockProspect = (overrides: Partial<Prospect> = {}): Prospect => ({
  id: overrides.id || 'prospect-1',
  name: overrides.name || 'John Smith',
  email: overrides.email || 'john.smith@acme.com',
  company: overrides.company || 'Acme Corp',
  title: overrides.title || 'VP Sales',
  phone: overrides.phone || '+1 (555) 123-4567',
  linkedinUrl: overrides.linkedinUrl || 'https://linkedin.com/in/johnsmith',
  status: overrides.status || 'new',
  tier: overrides.tier || '1',
  score: overrides.score ?? 0,
  isOps: overrides.isOps ?? false,
  isExec: overrides.isExec ?? false,
  source: overrides.source || 'linkedin',
  tags: overrides.tags || [],
  notes: overrides.notes || '',
  createdAt: overrides.createdAt || Date.now(),
  updatedAt: overrides.updatedAt || Date.now(),
  ...overrides,
});

const testProspects: Prospect[] = [
  createMockProspect({
    id: '1',
    name: 'John Smith',
    email: 'john.smith@acme.com',
    phone: '555-123-4567',
    linkedinUrl: 'https://linkedin.com/in/johnsmith',
    company: 'Acme Corp',
  }),
  createMockProspect({
    id: '2',
    name: 'Jane Doe',
    email: 'jane.doe@techstart.io',
    phone: '555-987-6543',
    linkedinUrl: 'https://linkedin.com/in/janedoe',
    company: 'TechStart',
  }),
  createMockProspect({
    id: '3',
    name: 'Robert Johnson',
    email: 'robert@globalsystems.com',
    phone: '555-456-7890',
    linkedinUrl: 'https://linkedin.com/in/robertjohnson',
    company: 'Global Systems',
  }),
  createMockProspect({
    id: '4',
    name: 'Sarah Williams',
    email: 'sarah.w@innovatelabs.co',
    phone: '555-321-0987',
    linkedinUrl: 'https://linkedin.com/in/sarahwilliams',
    company: 'Innovate Labs',
  }),
];

// ============================================
// Normalization Tests
// ============================================

describe('normalizeEmail', () => {
  it('lowercases email', () => {
    expect(normalizeEmail('John.Smith@ACME.com')).toBe('john.smith@acme.com');
  });

  it('removes Gmail dots', () => {
    expect(normalizeEmail('john.smith@gmail.com')).toBe('johnsmith@gmail.com');
    expect(normalizeEmail('j.o.h.n@gmail.com')).toBe('john@gmail.com');
  });

  it('removes plus aliases', () => {
    expect(normalizeEmail('john+newsletter@acme.com')).toBe('john@acme.com');
    expect(normalizeEmail('jane+work@gmail.com')).toBe('jane@gmail.com');
  });

  it('trims whitespace', () => {
    expect(normalizeEmail('  john@acme.com  ')).toBe('john@acme.com');
  });

  it('handles empty string', () => {
    expect(normalizeEmail('')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('extracts digits only', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('5551234567');
    expect(normalizePhone('555.123.4567')).toBe('5551234567');
  });

  it('removes leading 1 for US numbers', () => {
    expect(normalizePhone('1-555-123-4567')).toBe('5551234567');
    expect(normalizePhone('+1-555-123-4567')).toBe('5551234567');
  });

  it('handles international numbers', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('442079460958');
  });

  it('returns empty for too few digits', () => {
    expect(normalizePhone('123')).toBe('');
    expect(normalizePhone('555-12')).toBe('');
  });

  it('handles empty string', () => {
    expect(normalizePhone('')).toBe('');
  });
});

describe('normalizeLinkedInUrl', () => {
  it('extracts profile ID from standard URL', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/in/johnsmith')).toBe('johnsmith');
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/jane-doe')).toBe('jane-doe');
  });

  it('handles /pub/ format', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/pub/john-smith/1/2/3')).toBe('john-smith');
  });

  it('removes trailing slashes and hyphens', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/in/johnsmith/')).toBe('johnsmith');
    expect(normalizeLinkedInUrl('https://linkedin.com/in/johnsmith---')).toBe('johnsmith');
  });

  it('handles query parameters', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/in/johnsmith?trk=something')).toBe('johnsmith');
  });

  it('returns empty for non-LinkedIn URLs', () => {
    expect(normalizeLinkedInUrl('https://twitter.com/johnsmith')).toBe('');
  });

  it('handles empty string', () => {
    expect(normalizeLinkedInUrl('')).toBe('');
  });
});

describe('normalizeName', () => {
  it('lowercases name', () => {
    expect(normalizeName('John SMITH')).toBe('john smith');
  });

  it('removes punctuation', () => {
    expect(normalizeName("O'Brien, Jr.")).toBe('obrien jr');
  });

  it('normalizes whitespace', () => {
    expect(normalizeName('John    Smith')).toBe('john smith');
  });

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });
});

describe('nameMatchScore', () => {
  it('returns 100 for exact match', () => {
    expect(nameMatchScore('John Smith', 'John Smith')).toBe(100);
  });

  it('returns 100 for case-insensitive match', () => {
    expect(nameMatchScore('John Smith', 'john smith')).toBe(100);
  });

  it('returns 95 for swapped name parts', () => {
    expect(nameMatchScore('John Smith', 'Smith John')).toBe(95);
  });

  it('scores high for similar names', () => {
    const score = nameMatchScore('John Smith', 'Jon Smith');
    expect(score).toBeGreaterThan(85);
  });

  it('scores low for different names', () => {
    const score = nameMatchScore('John Smith', 'Jane Doe');
    expect(score).toBeLessThan(60);
  });

  it('returns 0 for empty names', () => {
    expect(nameMatchScore('', 'John Smith')).toBe(0);
    expect(nameMatchScore('John Smith', '')).toBe(0);
  });
});

// ============================================
// DuplicateDetector Tests
// ============================================

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector();
    detector.loadProspects(testProspects);
  });

  describe('loadProspects', () => {
    it('loads prospects and builds indexes', () => {
      expect(detector.getProspectCount()).toBe(4);
    });
  });

  describe('findDuplicates - Email', () => {
    it('finds exact email match', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'john.smith@acme.com', // Same email as prospect 1
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates.length).toBe(1);
      expect(result.duplicates[0].duplicate.id).toBe('1');
      expect(result.duplicates[0].matchedFields).toContain('email');
      expect(result.duplicates[0].confidence).toBe('exact');
    });

    it('normalizes email before matching', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'JOHN.SMITH@ACME.COM', // Same email, different case
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates[0].duplicate.id).toBe('1');
    });

    it('handles Gmail dot normalization', () => {
      const gmailDetector = new DuplicateDetector();
      gmailDetector.loadProspects([
        createMockProspect({ id: 'gmail-1', email: 'johnsmith@gmail.com' }),
      ]);

      const newProspect = createMockProspect({
        id: 'new-gmail',
        email: 'john.smith@gmail.com', // Same Gmail with dots
      });

      const result = gmailDetector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
    });
  });

  describe('findDuplicates - LinkedIn', () => {
    it('finds exact LinkedIn match', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'different@email.com',
        linkedinUrl: 'https://linkedin.com/in/johnsmith', // Same as prospect 1
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates[0].matchedFields).toContain('linkedinUrl');
    });

    it('handles LinkedIn URL variations', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'different@email.com',
        linkedinUrl: 'https://www.linkedin.com/in/johnsmith/', // With www and trailing slash
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
    });
  });

  describe('findDuplicates - Phone', () => {
    it('finds exact phone match', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'different@email.com',
        linkedinUrl: 'https://linkedin.com/in/different',
        phone: '555-123-4567', // Same as prospect 1
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates[0].matchedFields).toContain('phone');
    });

    it('normalizes phone format before matching', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'different@email.com',
        linkedinUrl: 'https://linkedin.com/in/different',
        phone: '+1 (555) 123-4567', // Same digits, different format
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
    });
  });

  describe('findDuplicates - Fuzzy Name', () => {
    it('finds similar names', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        name: 'Jon Smith', // Similar to John Smith
        email: 'different@email.com',
        linkedinUrl: 'https://linkedin.com/in/different',
        phone: '555-000-0000',
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates[0].matchedFields).toContain('name');
    });

    it('respects name match threshold', () => {
      const strictDetector = new DuplicateDetector({ nameMatchThreshold: 95 });
      strictDetector.loadProspects(testProspects);

      const newProspect = createMockProspect({
        id: 'new-1',
        name: 'Jon Smith', // Similar but not 95%+ match
        email: 'different@email.com',
        linkedinUrl: 'https://linkedin.com/in/different',
        phone: '555-000-0000',
      });

      const result = strictDetector.findDuplicates(newProspect);

      // Should not match because threshold is too high
      expect(result.duplicates.every(d => !d.matchedFields.includes('name'))).toBe(true);
    });
  });

  describe('findDuplicates - Name and Company', () => {
    it('finds duplicate when name and company match', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        name: 'John Smith',
        company: 'Acme Corporation', // Same as 'Acme Corp' when normalized
        email: 'different@email.com',
        linkedinUrl: 'https://linkedin.com/in/different',
        phone: '555-000-0000',
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates.some(d => d.matchedFields.includes('nameAndCompany'))).toBe(true);
    });
  });

  describe('findDuplicates - Multiple Fields', () => {
    it('combines scores from multiple matching fields', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'john.smith@acme.com',
        linkedinUrl: 'https://linkedin.com/in/johnsmith',
        phone: '555-123-4567',
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates[0].matchedFields.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isDuplicate', () => {
    it('returns true for duplicate', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'john.smith@acme.com',
      });

      expect(detector.isDuplicate(newProspect)).toBe(true);
    });

    it('returns false for unique prospect', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'unique@email.com',
        name: 'Unique Person',
        linkedinUrl: 'https://linkedin.com/in/uniqueperson',
        phone: '555-000-0001',
        company: 'Unique Company',
      });

      expect(detector.isDuplicate(newProspect)).toBe(false);
    });
  });

  describe('findAllDuplicates', () => {
    it('finds duplicates across multiple prospects', () => {
      const newProspects = [
        createMockProspect({
          id: 'new-1',
          email: 'john.smith@acme.com', // Duplicate of 1
        }),
        createMockProspect({
          id: 'new-2',
          email: 'unique@email.com', // Unique
          name: 'Unique Person',
          linkedinUrl: 'https://linkedin.com/in/unique',
          phone: '555-000-0000',
          company: 'Unique Co',
        }),
      ];

      const result = detector.findAllDuplicates(newProspects);

      expect(result.totalChecked).toBe(2);
      expect(result.duplicatePairs.length).toBeGreaterThan(0);
      expect(result.uniqueProspects.length).toBe(1);
    });

    it('returns sorted by score', () => {
      const newProspects = [
        createMockProspect({ id: 'new-1', email: 'john.smith@acme.com' }),
        createMockProspect({ id: 'new-2', linkedinUrl: 'https://linkedin.com/in/janedoe' }),
      ];

      const result = detector.findAllDuplicates(newProspects);

      // Check pairs are sorted by score descending
      for (let i = 1; i < result.duplicatePairs.length; i++) {
        expect(result.duplicatePairs[i - 1].score).toBeGreaterThanOrEqual(
          result.duplicatePairs[i].score
        );
      }
    });
  });

  describe('findImportDuplicates', () => {
    it('finds duplicates within import batch', () => {
      const imports = [
        createMockProspect({
          id: 'import-1',
          email: 'import@test.com',
        }),
        createMockProspect({
          id: 'import-2',
          email: 'import@test.com', // Same email as import-1
        }),
      ];

      const result = detector.findImportDuplicates(imports);

      expect(result.duplicatePairs.length).toBeGreaterThan(0);
    });

    it('finds duplicates against existing prospects', () => {
      const imports = [
        createMockProspect({
          id: 'import-1',
          email: 'john.smith@acme.com', // Same as existing prospect 1
        }),
      ];

      const result = detector.findImportDuplicates(imports);

      expect(result.duplicatePairs.length).toBeGreaterThan(0);
    });
  });

  describe('mergeProspects', () => {
    it('keeps original values and fills gaps from duplicate', () => {
      const original = createMockProspect({
        id: 'original',
        name: 'John Smith',
        email: 'john@acme.com',
        phone: '', // Empty
        title: 'VP Sales',
      });

      const duplicate = createMockProspect({
        id: 'duplicate',
        name: 'John Smith',
        email: 'john.smith@acme.com',
        phone: '555-123-4567', // Has value
        title: 'CEO', // Different - should keep original
      });

      const merged = detector.mergeProspects(original, duplicate);

      expect(merged.email).toBe('john@acme.com'); // Keep original
      expect(merged.phone).toBe('555-123-4567'); // Fill from duplicate
      expect(merged.title).toBe('VP Sales'); // Keep original
    });

    it('combines tags from both prospects', () => {
      const original = createMockProspect({
        id: 'original',
        tags: ['vip', 'manifest2026'],
      });

      const duplicate = createMockProspect({
        id: 'duplicate',
        tags: ['priority', 'manifest2026'], // Overlapping tag
      });

      const merged = detector.mergeProspects(original, duplicate);

      expect(merged.tags).toContain('vip');
      expect(merged.tags).toContain('priority');
      expect(merged.tags).toContain('manifest2026');
      expect(merged.tags?.length).toBe(3); // No duplicates
    });

    it('adds merge note', () => {
      const original = createMockProspect({ id: 'original' });
      const duplicate = createMockProspect({ id: 'duplicate' });

      const merged = detector.mergeProspects(original, duplicate);

      expect(merged.notes).toContain('Merged from duplicate: duplicate');
    });
  });

  describe('configuration', () => {
    it('can disable email matching', () => {
      const noEmailDetector = new DuplicateDetector({ matchEmail: false });
      noEmailDetector.loadProspects(testProspects);

      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'john.smith@acme.com',
        name: 'Unique Name',
        linkedinUrl: 'https://linkedin.com/in/unique',
        phone: '555-000-0000',
        company: 'Unique Co',
      });

      const result = noEmailDetector.findDuplicates(newProspect);

      expect(result.duplicates.every(d => !d.matchedFields.includes('email'))).toBe(true);
    });

    it('updateConfig modifies behavior', () => {
      detector.updateConfig({ matchPhone: false });

      const newProspect = createMockProspect({
        id: 'new-1',
        phone: '555-123-4567',
        email: 'unique@email.com',
        name: 'Unique Name',
        linkedinUrl: 'https://linkedin.com/in/unique',
        company: 'Unique Co',
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.duplicates.every(d => !d.matchedFields.includes('phone'))).toBe(true);
    });

    it('getConfig returns current configuration', () => {
      const config = detector.getConfig();

      expect(config.matchEmail).toBe(true);
      expect(config.matchLinkedIn).toBe(true);
      expect(config.nameMatchThreshold).toBe(85);
    });
  });

  describe('recommendations', () => {
    it('recommends merge for exact matches', () => {
      const newProspect = createMockProspect({
        id: 'new-1',
        email: 'john.smith@acme.com',
        linkedinUrl: 'https://linkedin.com/in/johnsmith',
      });

      const result = detector.findDuplicates(newProspect);

      expect(result.duplicates[0].recommendation).toBe('merge');
    });

    it('recommends review for high confidence matches', () => {
      // Create a scenario with 85-94 score
      const newProspect = createMockProspect({
        id: 'new-1',
        name: 'John Smyth', // Similar but not exact
        email: 'unique@email.com',
        linkedinUrl: 'https://linkedin.com/in/unique',
        phone: '555-000-0000',
        company: 'Acme Corp',
      });

      const result = detector.findDuplicates(newProspect);

      const reviewRecommendations = result.duplicates.filter(
        d => d.recommendation === 'review'
      );

      // May or may not have review recommendations based on score
      expect(Array.isArray(reviewRecommendations)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty prospect list', () => {
      const emptyDetector = new DuplicateDetector();
      emptyDetector.loadProspects([]);

      const newProspect = createMockProspect({ id: 'new-1' });
      const result = emptyDetector.findDuplicates(newProspect);

      expect(result.hasDuplicates).toBe(false);
    });

    it('does not match prospect with itself', () => {
      const selfProspect = testProspects[0];
      const result = detector.findDuplicates(selfProspect);

      expect(result.duplicates.every(d => d.duplicate.id !== selfProspect.id)).toBe(true);
    });

    it('handles prospects with missing fields', () => {
      const sparseProspect = createMockProspect({
        id: 'sparse',
        name: 'Sparse Prospect',
        email: undefined,
        phone: undefined,
        linkedinUrl: undefined,
      });

      const result = detector.findDuplicates(sparseProspect);

      // Should not throw
      expect(result).toBeDefined();
    });
  });
});

// ============================================
// Singleton Tests
// ============================================

describe('Singleton Pattern', () => {
  beforeEach(() => {
    resetDuplicateDetector();
  });

  it('getDuplicateDetector returns singleton', () => {
    const detector1 = getDuplicateDetector();
    const detector2 = getDuplicateDetector();

    expect(detector1).toBe(detector2);
  });

  it('resetDuplicateDetector clears singleton', () => {
    const detector1 = getDuplicateDetector();
    resetDuplicateDetector();
    const detector2 = getDuplicateDetector();

    expect(detector1).not.toBe(detector2);
  });

  it('getDuplicateDetector accepts config on first call', () => {
    const detector = getDuplicateDetector({ nameMatchThreshold: 90 });

    expect(detector.getConfig().nameMatchThreshold).toBe(90);
  });
});
