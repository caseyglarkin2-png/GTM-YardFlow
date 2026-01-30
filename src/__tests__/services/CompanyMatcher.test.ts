/**
 * Company Matcher Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CompanyMatcher,
  normalizeCompanyName,
  extractDomain,
  extractLinkedInCompanyId,
  generateNameVariations,
  levenshteinDistance,
  jaroWinklerSimilarity,
  fuzzyMatchScore,
  getCompanyMatcher,
  resetCompanyMatcher,
} from '../../services/CompanyMatcher';
import type { Company } from '../../types';

// ============================================
// Test Fixtures
// ============================================

const createMockCompany = (overrides: Partial<Company> = {}): Company => ({
  id: overrides.id || 'company-1',
  name: overrides.name || 'Acme Corporation',
  domain: overrides.domain || 'acme.com',
  linkedinUrl: overrides.linkedinUrl || 'https://linkedin.com/company/acme',
  industry: overrides.industry || 'Technology',
  ...overrides,
});

const testCompanies: Company[] = [
  createMockCompany({
    id: '1',
    name: 'Acme Corporation',
    domain: 'acme.com',
    linkedinUrl: 'https://linkedin.com/company/acme-corp',
  }),
  createMockCompany({
    id: '2',
    name: 'TechStart Inc.',
    domain: 'techstart.io',
    linkedinUrl: 'https://linkedin.com/company/techstart',
  }),
  createMockCompany({
    id: '3',
    name: 'Global Systems Ltd.',
    domain: 'globalsystems.com',
    linkedinUrl: 'https://linkedin.com/company/global-systems',
  }),
  createMockCompany({
    id: '4',
    name: 'Innovate Labs',
    domain: 'innovatelabs.co',
    linkedinUrl: 'https://linkedin.com/company/innovate-labs',
  }),
  createMockCompany({
    id: '5',
    name: 'Smith & Partners LLC',
    domain: 'smithpartners.com',
    linkedinUrl: 'https://linkedin.com/company/smith-partners',
  }),
  createMockCompany({
    id: '6',
    name: 'DataFlow Technologies',
    domain: 'dataflow.tech',
    linkedinUrl: 'https://linkedin.com/company/dataflow-tech',
  }),
  createMockCompany({
    id: '7',
    name: 'The Cloud Company',
    domain: 'cloudcompany.com',
    linkedinUrl: 'https://linkedin.com/company/cloud-company',
  }),
  createMockCompany({
    id: '8',
    name: 'NextGen Software Solutions',
    domain: 'nextgen.software',
    linkedinUrl: 'https://linkedin.com/company/nextgen-software',
  }),
];

// ============================================
// Normalization Tests
// ============================================

describe('normalizeCompanyName', () => {
  it('converts to lowercase', () => {
    expect(normalizeCompanyName('ACME CORP')).toBe('acme');
  });

  it('removes punctuation', () => {
    expect(normalizeCompanyName('Smith & Co.')).toBe('smith');
  });

  it('removes common suffixes', () => {
    expect(normalizeCompanyName('TechStart Inc.')).toBe('techstart');
    expect(normalizeCompanyName('Global Systems Ltd.')).toBe('global systems');
    expect(normalizeCompanyName('Acme Corporation')).toBe('acme');
    expect(normalizeCompanyName('Smith Partners LLC')).toBe('smith'); // 'partners' is also a suffix
  });

  it('removes stop words', () => {
    expect(normalizeCompanyName('The Cloud Company')).toBe('cloud');
  });

  it('collapses whitespace', () => {
    expect(normalizeCompanyName('Tech   Start   Inc')).toBe('tech start');
  });

  it('handles empty string', () => {
    expect(normalizeCompanyName('')).toBe('');
  });

  it('handles multiple suffixes', () => {
    expect(normalizeCompanyName('Acme Holdings Corp.')).toBe('acme');
  });
});

describe('extractDomain', () => {
  it('extracts domain from URL with protocol', () => {
    expect(extractDomain('https://www.acme.com/about')).toBe('acme.com');
    expect(extractDomain('http://techstart.io')).toBe('techstart.io');
  });

  it('handles www prefix', () => {
    expect(extractDomain('www.acme.com')).toBe('acme.com');
  });

  it('extracts domain from email', () => {
    expect(extractDomain('john@acme.com')).toBe('acme.com');
  });

  it('removes path and query', () => {
    expect(extractDomain('https://acme.com/contact?utm_source=google')).toBe('acme.com');
  });

  it('removes port', () => {
    expect(extractDomain('https://acme.com:8080/api')).toBe('acme.com');
  });

  it('handles empty string', () => {
    expect(extractDomain('')).toBe('');
  });

  it('lowercases domain', () => {
    expect(extractDomain('HTTPS://WWW.ACME.COM')).toBe('acme.com');
  });
});

describe('extractLinkedInCompanyId', () => {
  it('extracts company ID from LinkedIn URL', () => {
    expect(extractLinkedInCompanyId('https://linkedin.com/company/acme-corp')).toBe('acme-corp');
    expect(extractLinkedInCompanyId('https://www.linkedin.com/company/techstart')).toBe('techstart');
  });

  it('handles trailing slash', () => {
    expect(extractLinkedInCompanyId('https://linkedin.com/company/acme/')).toBe('acme');
  });

  it('handles query parameters', () => {
    expect(extractLinkedInCompanyId('https://linkedin.com/company/acme?trk=something')).toBe('acme');
  });

  it('returns null for non-LinkedIn URLs', () => {
    expect(extractLinkedInCompanyId('https://twitter.com/acme')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(extractLinkedInCompanyId('')).toBe(null);
  });

  it('lowercases ID', () => {
    expect(extractLinkedInCompanyId('https://linkedin.com/company/ACME-Corp')).toBe('acme-corp');
  });

  it('handles personal profiles', () => {
    expect(extractLinkedInCompanyId('https://linkedin.com/in/john-smith')).toBe('john-smith');
  });
});

describe('generateNameVariations', () => {
  it('includes normalized name', () => {
    const variations = generateNameVariations('Acme Corp');
    expect(variations).toContain('acme');
  });

  it('includes abbreviation for multi-word names', () => {
    const variations = generateNameVariations('International Business Machines');
    expect(variations).toContain('ibm');
  });

  it('includes name without industry terms', () => {
    const variations = generateNameVariations('DataFlow Software');
    expect(variations).toContain('dataflow');
  });

  it('returns empty array for empty input', () => {
    expect(generateNameVariations('')).toEqual([]);
  });
});

// ============================================
// Fuzzy Matching Algorithm Tests
// ============================================

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns string length for empty comparison', () => {
    expect(levenshteinDistance('hello', '')).toBe(5);
    expect(levenshteinDistance('', 'world')).toBe(5);
  });

  it('calculates single character difference', () => {
    expect(levenshteinDistance('cat', 'car')).toBe(1);
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
    expect(levenshteinDistance('cat', 'at')).toBe(1);
  });

  it('calculates multiple differences', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('sunday', 'saturday')).toBe(3);
  });
});

describe('jaroWinklerSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinklerSimilarity('hello', 'hello')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(jaroWinklerSimilarity('abc', 'xyz')).toBe(0);
  });

  it('returns 0 for empty strings', () => {
    expect(jaroWinklerSimilarity('', 'hello')).toBe(0);
    expect(jaroWinklerSimilarity('hello', '')).toBe(0);
  });

  it('gives higher score for common prefix', () => {
    const score1 = jaroWinklerSimilarity('prefix123', 'prefix456');
    const score2 = jaroWinklerSimilarity('123prefix', '456prefix');
    expect(score1).toBeGreaterThan(score2);
  });

  it('calculates similarity for similar strings', () => {
    const score = jaroWinklerSimilarity('martha', 'marhta');
    expect(score).toBeGreaterThan(0.9);
  });
});

describe('fuzzyMatchScore', () => {
  it('returns 100 for exact normalized match', () => {
    expect(fuzzyMatchScore('Acme Corp', 'Acme Corporation')).toBe(100);
  });

  it('returns 0 for empty strings', () => {
    expect(fuzzyMatchScore('', 'Acme')).toBe(0);
    expect(fuzzyMatchScore('Acme', '')).toBe(0);
  });

  it('scores high for similar names', () => {
    const score = fuzzyMatchScore('TechStart', 'Tech Start');
    expect(score).toBeGreaterThan(80);
  });

  it('scores low for dissimilar names', () => {
    const score = fuzzyMatchScore('Acme', 'Zebra Industries');
    expect(score).toBeLessThan(50);
  });

  it('handles substring matches', () => {
    const score = fuzzyMatchScore('Tech', 'TechStart');
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThan(100);
  });
});

// ============================================
// CompanyMatcher Class Tests
// ============================================

describe('CompanyMatcher', () => {
  let matcher: CompanyMatcher;

  beforeEach(() => {
    matcher = new CompanyMatcher();
    matcher.loadCompanies(testCompanies);
  });

  describe('loadCompanies', () => {
    it('loads companies and builds indexes', () => {
      expect(matcher.getCompanyCount()).toBe(8);
    });
  });

  describe('findMatches - LinkedIn URL', () => {
    it('matches by exact LinkedIn URL', () => {
      const matches = matcher.findMatches({
        linkedinUrl: 'https://linkedin.com/company/acme-corp',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.id).toBe('1');
      expect(matches[0].confidence).toBe('exact');
      expect(matches[0].matchedOn).toContain('linkedinUrl');
    });

    it('handles LinkedIn URL variations', () => {
      const matches = matcher.findMatches({
        linkedinUrl: 'https://www.linkedin.com/company/acme-corp/',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.id).toBe('1');
    });
  });

  describe('findMatches - Domain', () => {
    it('matches by domain', () => {
      const matches = matcher.findMatches({
        domain: 'techstart.io',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.id).toBe('2');
      expect(matches[0].matchedOn).toContain('domain');
    });

    it('extracts domain from website URL', () => {
      const matches = matcher.findMatches({
        website: 'https://www.techstart.io/about',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.id).toBe('2');
    });

    it('matches domain over website when both provided', () => {
      const matches = matcher.findMatches({
        domain: 'techstart.io',
        website: 'https://other.com',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.id).toBe('2');
    });
  });

  describe('findMatches - Company Name', () => {
    it('matches by exact normalized name', () => {
      const matches = matcher.findMatches({
        companyName: 'Acme Corporation',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.id).toBe('1');
      expect(matches[0].matchedOn).toContain('name');
    });

    it('matches despite suffix differences', () => {
      const matches = matcher.findMatches({
        companyName: 'Acme Inc',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.name).toBe('Acme Corporation');
    });

    it('fuzzy matches similar names', () => {
      const matches = matcher.findMatches({
        companyName: 'TechStart Technologies',
      });

      expect(matches.length).toBeGreaterThan(0);
      // Should match TechStart Inc.
      expect(matches.some(m => m.company.id === '2')).toBe(true);
    });
  });

  describe('findMatches - Combined inputs', () => {
    it('combines multiple input fields for matching', () => {
      const matches = matcher.findMatches({
        companyName: 'Acme',
        domain: 'acme.com',
        linkedinUrl: 'https://linkedin.com/company/acme-corp',
      });

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].company.id).toBe('1');
      expect(matches[0].matchedOn.length).toBeGreaterThanOrEqual(2);
    });

    it('prioritizes LinkedIn and domain over fuzzy name', () => {
      const matches = matcher.findMatches({
        companyName: 'Acme Technologies', // Fuzzy match
        domain: 'acme.com', // Exact domain
      });

      expect(matches[0].company.id).toBe('1');
      expect(matches[0].score).toBeGreaterThan(90);
    });
  });

  describe('findBestMatch', () => {
    it('returns best match when above threshold', () => {
      const match = matcher.findBestMatch({
        companyName: 'Acme Corporation',
      });

      expect(match).not.toBeNull();
      expect(match?.company.id).toBe('1');
    });

    it('returns null when no matches found', () => {
      const match = matcher.findBestMatch({
        companyName: 'Completely Unknown Company XYZ123',
      });

      expect(match).toBeNull();
    });

    it('returns null when below minimum confidence', () => {
      // This should only match fuzzily
      const match = matcher.findBestMatch(
        { companyName: 'Ak-me' },
        'exact' // Require exact confidence
      );

      expect(match).toBeNull();
    });

    it('respects minimum confidence parameter', () => {
      const match = matcher.findBestMatch(
        { companyName: 'TechStart' },
        'high'
      );

      if (match) {
        expect(['exact', 'high']).toContain(match.confidence);
      }
    });
  });

  describe('batchMatch', () => {
    it('matches multiple inputs at once', () => {
      const inputs = [
        { companyName: 'Acme Corp' },
        { domain: 'techstart.io' },
        { linkedinUrl: 'https://linkedin.com/company/global-systems' },
      ];

      const results = matcher.batchMatch(inputs);

      expect(results.size).toBe(3);
      expect(results.get(0)?.[0]?.company.id).toBe('1');
      expect(results.get(1)?.[0]?.company.id).toBe('2');
      expect(results.get(2)?.[0]?.company.id).toBe('3');
    });
  });

  describe('configuration', () => {
    it('respects minScore threshold', () => {
      const strictMatcher = new CompanyMatcher({ minScore: 90 });
      strictMatcher.loadCompanies(testCompanies);

      const matches = strictMatcher.findMatches({
        companyName: 'Akme Corp', // Fuzzy - won't meet 90 threshold
      });

      // Should only return exact/high matches
      expect(matches.every(m => m.score >= 90)).toBe(true);
    });

    it('respects maxResults limit', () => {
      const limitedMatcher = new CompanyMatcher({ maxResults: 2 });
      limitedMatcher.loadCompanies(testCompanies);

      const matches = limitedMatcher.findMatches({
        companyName: 'Tech',
      });

      expect(matches.length).toBeLessThanOrEqual(2);
    });

    it('updateConfig modifies behavior', () => {
      matcher.updateConfig({ maxResults: 1, minScore: 30 });

      const matches = matcher.findMatches({
        companyName: 'TechStart Inc',
      });

      expect(matches.length).toBeLessThanOrEqual(1);
    });

    it('getConfig returns current configuration', () => {
      const config = matcher.getConfig();

      expect(config.minScore).toBeDefined();
      expect(config.maxResults).toBeDefined();
      expect(config.weights).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty company list', () => {
      const emptyMatcher = new CompanyMatcher();
      emptyMatcher.loadCompanies([]);

      const matches = emptyMatcher.findMatches({
        companyName: 'Acme',
      });

      expect(matches).toEqual([]);
    });

    it('handles null/undefined input fields gracefully', () => {
      const matches = matcher.findMatches({
        companyName: undefined,
        domain: undefined,
      });

      expect(matches).toEqual([]);
    });

    it('handles special characters in company names', () => {
      const specialCompany = createMockCompany({
        id: 'special',
        name: 'O\'Reilly & Sons, Inc.',
      });
      
      const specialMatcher = new CompanyMatcher();
      specialMatcher.loadCompanies([specialCompany]);

      const matches = specialMatcher.findMatches({
        companyName: 'OReilly and Sons',
      });

      expect(matches.length).toBeGreaterThan(0);
    });

    it('handles unicode characters', () => {
      const unicodeCompany = createMockCompany({
        id: 'unicode',
        name: 'Société Générale',
      });
      
      const unicodeMatcher = new CompanyMatcher();
      unicodeMatcher.loadCompanies([unicodeCompany]);

      const matches = unicodeMatcher.findMatches({
        companyName: 'Societe Generale',
      });

      expect(matches.length).toBeGreaterThan(0);
    });
  });
});

// ============================================
// Singleton Tests
// ============================================

describe('Singleton Pattern', () => {
  beforeEach(() => {
    resetCompanyMatcher();
  });

  it('getCompanyMatcher returns singleton', () => {
    const matcher1 = getCompanyMatcher();
    const matcher2 = getCompanyMatcher();

    expect(matcher1).toBe(matcher2);
  });

  it('resetCompanyMatcher clears singleton', () => {
    const matcher1 = getCompanyMatcher();
    resetCompanyMatcher();
    const matcher2 = getCompanyMatcher();

    expect(matcher1).not.toBe(matcher2);
  });

  it('getCompanyMatcher accepts config on first call', () => {
    const matcher = getCompanyMatcher({ maxResults: 3 });

    expect(matcher.getConfig().maxResults).toBe(3);
  });
});
