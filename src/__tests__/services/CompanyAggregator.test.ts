/**
 * Tests for Company Aggregator Service
 * 
 * Sprint 72: T72.5 - Company Aggregation Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  aggregateByCompany,
  getCompanyContacts,
  calculateCompanyMetrics,
  normalizeCompanyName,
  QUICK_FILTERS,
  type CompanyRow,
} from '../../services/CompanyAggregator';
import type { Prospect } from '../../types';
import type { EnrichedCompany, CompanyTier } from '../../types/marketing';

// Mock the dependencies
vi.mock('../../services/PrimoLookalikeScoring', () => ({
  calculatePrimoLookalikeScore: vi.fn((input) => ({
    totalScore: input.facilityCount >= 100 ? 85 : input.facilityCount >= 50 ? 65 : 45,
    facilityScore: 0,
    industryScore: 0,
    opsIntensityScore: 0,
    revenueScore: 0,
    footprintScore: 0,
    factors: [],
  })),
}));

vi.mock('../../services/GateBottleneckInference', () => ({
  inferGateBottleneck: vi.fn((company) => ({
    isLikelyBottleneck: company.industryCategory === 'beverage',
    confidence: 'high' as const,
    reasoning: 'Test',
    signals: {},
  })),
  getGateLikelihoodLabel: vi.fn((result) => ({
    label: result.isLikelyBottleneck ? 'Likely' : 'Unlikely',
    color: 'green',
    icon: '✓',
  })),
}));

// Helper to create mock prospects
function createProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: 'John Doe',
    title: 'VP Operations',
    company: 'Acme Corp',
    score: 75,
    qualified: true,
    isExec: false,
    isOps: true,
    status: 'new',
    notes: '',
    touchHistory: [],
    ...overrides,
  };
}

// Helper to create mock enrichment
function createEnrichment(overrides: Partial<EnrichedCompany> = {}): Partial<EnrichedCompany> {
  return {
    company: 'Acme Corp',
    facilityCount: 25,
    industryCategory: 'distribution',
    distributionFootprint: 'regional',
    estimatedTruckVolume: 50,
    tier: 'Tier 2',
    ...overrides,
  };
}

describe('CompanyAggregator', () => {
  describe('normalizeCompanyName', () => {
    it('normalizes company names consistently', () => {
      expect(normalizeCompanyName('Acme Corp')).toBe('acme');
      expect(normalizeCompanyName('Acme Corp.')).toBe('acme');
      expect(normalizeCompanyName('ACME CORP')).toBe('acme');
      expect(normalizeCompanyName('Acme, Inc.')).toBe('acme');
      expect(normalizeCompanyName('Acme LLC')).toBe('acme');
      expect(normalizeCompanyName('Acme Ltd.')).toBe('acme');
    });

    it('handles edge cases', () => {
      expect(normalizeCompanyName('')).toBe('');
      expect(normalizeCompanyName('   ')).toBe('');
      expect(normalizeCompanyName('A')).toBe('a');
    });

    it('preserves meaningful differences', () => {
      expect(normalizeCompanyName('Primo Brands')).not.toBe(normalizeCompanyName('Prime Brands'));
    });
  });

  describe('aggregateByCompany', () => {
    it('aggregates prospects by company', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Acme Corp', name: 'John' }),
        createProspect({ company: 'Acme Corp', name: 'Jane' }),
        createProspect({ company: 'Beta Inc', name: 'Bob' }),
      ];

      const rows = aggregateByCompany(prospects);

      expect(rows).toHaveLength(2);
      const acme = rows.find(r => r.company === 'Acme Corp');
      expect(acme?.contactCount).toBe(2);
      const beta = rows.find(r => r.company === 'Beta Inc');
      expect(beta?.contactCount).toBe(1);
    });

    it('handles different company name spellings', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Acme Corp' }),
        createProspect({ company: 'Acme Corp.' }),
        createProspect({ company: 'ACME CORP' }),
      ];

      const rows = aggregateByCompany(prospects);

      expect(rows).toHaveLength(1);
      expect(rows[0].contactCount).toBe(3);
    });

    it('uses most common company name spelling', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Acme Corp' }),
        createProspect({ company: 'Acme Corp' }),
        createProspect({ company: 'ACME CORP' }),
      ];

      const rows = aggregateByCompany(prospects);

      expect(rows[0].company).toBe('Acme Corp');
    });

    it('merges with enrichment data', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Primo Brands' }),
        createProspect({ company: 'Primo Brands' }),
      ];

      const enrichment: Partial<EnrichedCompany>[] = [
        createEnrichment({
          company: 'Primo Brands',
          facilityCount: 260,
          industryCategory: 'beverage',
          distributionFootprint: 'national',
        }),
      ];

      const rows = aggregateByCompany(prospects, enrichment);

      expect(rows).toHaveLength(1);
      expect(rows[0].facilityCount).toBe(260);
      expect(rows[0].industryCategory).toBe('beverage');
    });

    it('counts personas correctly', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Acme', isExec: true, isOps: false }),
        createProspect({ company: 'Acme', isExec: false, isOps: true }),
        createProspect({ company: 'Acme', isExec: true, isOps: true }),
        createProspect({ company: 'Acme', isExec: false, isOps: false }),
      ];

      const rows = aggregateByCompany(prospects);

      expect(rows[0].execCount).toBe(2);
      expect(rows[0].opsCount).toBe(2);
      expect(rows[0].execOpsCount).toBe(1);
    });

    it('calculates ROI potential based on facilities', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'BigCorp' }),
      ];

      const enrichment: Partial<EnrichedCompany>[] = [
        createEnrichment({ company: 'BigCorp', facilityCount: 100 }),
      ];

      const rows = aggregateByCompany(prospects, enrichment);

      expect(rows[0].roiPotential).toBe(100_000_000); // $1M per facility
    });

    it('marks companies needing research', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Unknown Corp' }),
      ];

      const rows = aggregateByCompany(prospects); // No enrichment

      expect(rows[0].needsResearch).toBe(true);
    });
  });

  describe('filtering', () => {
    let prospects: Prospect[];
    let enrichment: Partial<EnrichedCompany>[];

    beforeEach(() => {
      prospects = [
        createProspect({ company: 'BigCorp' }),
        createProspect({ company: 'SmallCo' }),
        createProspect({ company: 'BevCo' }),
      ];

      enrichment = [
        createEnrichment({ company: 'BigCorp', facilityCount: 100, tier: 'Tier 1' }),
        createEnrichment({ company: 'SmallCo', facilityCount: 10, tier: 'Tier 3' }),
        createEnrichment({ company: 'BevCo', facilityCount: 80, industryCategory: 'beverage' }),
      ];
    });

    it('filters by minimum facilities', () => {
      const rows = aggregateByCompany(prospects, enrichment, {
        filterMinFacilities: 60,
      });

      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.company).sort()).toEqual(['BevCo', 'BigCorp']);
    });

    it('filters by tier', () => {
      const rows = aggregateByCompany(prospects, enrichment, {
        filterTiers: ['Tier 1'],
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].company).toBe('BigCorp');
    });

    it('filters by gate bottleneck', () => {
      const rows = aggregateByCompany(prospects, enrichment, {
        filterHasGate: true,
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].company).toBe('BevCo');
    });

    it('filters by search term', () => {
      const rows = aggregateByCompany(prospects, enrichment, {
        searchTerm: 'big',
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].company).toBe('BigCorp');
    });

    it('filters by minimum contacts', () => {
      prospects.push(createProspect({ company: 'BigCorp' })); // 2 contacts now

      const rows = aggregateByCompany(prospects, enrichment, {
        minContacts: 2,
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].company).toBe('BigCorp');
    });
  });

  describe('sorting', () => {
    let prospects: Prospect[];
    let enrichment: Partial<EnrichedCompany>[];

    beforeEach(() => {
      prospects = [
        createProspect({ company: 'MediumCorp' }),
        createProspect({ company: 'BigCorp' }),
        createProspect({ company: 'SmallCo' }),
      ];

      enrichment = [
        createEnrichment({ company: 'MediumCorp', facilityCount: 50 }),
        createEnrichment({ company: 'BigCorp', facilityCount: 100 }),
        createEnrichment({ company: 'SmallCo', facilityCount: 10 }),
      ];
    });

    it('sorts by facilities descending', () => {
      const rows = aggregateByCompany(prospects, enrichment, {
        sortBy: 'facilities',
        sortDirection: 'desc',
      });

      expect(rows.map(r => r.company)).toEqual(['BigCorp', 'MediumCorp', 'SmallCo']);
    });

    it('sorts by facilities ascending', () => {
      const rows = aggregateByCompany(prospects, enrichment, {
        sortBy: 'facilities',
        sortDirection: 'asc',
      });

      expect(rows.map(r => r.company)).toEqual(['SmallCo', 'MediumCorp', 'BigCorp']);
    });

    it('sorts by score descending by default', () => {
      const rows = aggregateByCompany(prospects, enrichment);

      // BigCorp has 100 facilities, should score highest
      expect(rows[0].company).toBe('BigCorp');
    });
  });

  describe('getCompanyContacts', () => {
    it('returns all contacts for a company', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Acme Corp', name: 'John' }),
        createProspect({ company: 'Acme Corp', name: 'Jane' }),
        createProspect({ company: 'Beta Inc', name: 'Bob' }),
      ];

      const contacts = getCompanyContacts('Acme Corp', prospects);

      expect(contacts).toHaveLength(2);
      expect(contacts.map(c => c.name).sort()).toEqual(['Jane', 'John']);
    });

    it('handles case variations', () => {
      const prospects: Prospect[] = [
        createProspect({ company: 'Acme Corp' }),
        createProspect({ company: 'ACME CORP' }),
      ];

      const contacts = getCompanyContacts('acme corp', prospects);

      expect(contacts).toHaveLength(2);
    });
  });

  describe('calculateCompanyMetrics', () => {
    it('calculates metrics correctly', () => {
      const rows: CompanyRow[] = [
        {
          id: '1',
          company: 'BigCorp',
          tier: 'Tier 1',
          contactCount: 5,
          facilityCount: 100,
          hasGateBottleneck: true,
          gateConfidence: 'high',
          gateLabel: 'Likely',
          industryCategory: 'beverage',
          estimatedTruckVolume: 200,
          distributionFootprint: 'national',
          primoLookalikeScore: 85,
          roiPotential: 100_000_000,
          contacts: [],
          execCount: 2,
          opsCount: 3,
          execOpsCount: 1,
          lastResearchedAt: null,
          needsResearch: false,
        },
        {
          id: '2',
          company: 'SmallCo',
          tier: 'Tier 3',
          contactCount: 1,
          facilityCount: 10,
          hasGateBottleneck: false,
          gateConfidence: 'low',
          gateLabel: 'Unlikely',
          industryCategory: 'other',
          estimatedTruckVolume: 20,
          distributionFootprint: 'local',
          primoLookalikeScore: 35,
          roiPotential: 10_000_000,
          contacts: [],
          execCount: 0,
          opsCount: 1,
          execOpsCount: 0,
          lastResearchedAt: null,
          needsResearch: true,
        },
      ];

      const metrics = calculateCompanyMetrics(rows);

      expect(metrics.totalCompanies).toBe(2);
      expect(metrics.companiesWithFacilities).toBe(2);
      expect(metrics.companiesNeedingResearch).toBe(1);
      expect(metrics.highPriorityCompanies).toBe(1);
      expect(metrics.tier1Count).toBe(1);
      expect(metrics.tier3Count).toBe(1);
      expect(metrics.avgPrimoScore).toBe(60); // (85 + 35) / 2
    });

    it('handles empty input', () => {
      const metrics = calculateCompanyMetrics([]);

      expect(metrics.totalCompanies).toBe(0);
      expect(metrics.avgPrimoScore).toBe(0);
    });
  });

  describe('QUICK_FILTERS', () => {
    it('has correct presets', () => {
      expect(QUICK_FILTERS.SIXTY_PLUS_FACILITIES.filter.filterMinFacilities).toBe(60);
      expect(QUICK_FILTERS.PRIMO_LIKE.filter.filterTiers).toContain('Tier 1');
      expect(QUICK_FILTERS.GATE_BOTTLENECK.filter.filterHasGate).toBe(true);
    });
  });
});
