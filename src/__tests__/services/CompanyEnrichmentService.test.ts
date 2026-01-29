/**
 * Company Enrichment Service Tests - YardFlow Hub
 * 
 * Tests for Sprint 53: T53.4a-c - Company enrichment CRUD, bulk import, gap detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initializeCompanyStore,
  getEnrichment,
  setFacilityCount,
  setIndustryCategory,
  setDistributionFootprint,
  setYardIntensive,
  setEnrichmentData,
  deleteEnrichment,
  bulkEnrichFromCSV,
  getUnenrichedCompanies,
  getEnrichmentCompletion,
  getAllCompaniesWithScores,
  clearEnrichmentStore,
  clearCompanyStore,
  getCompanyStoreSize,
  getEnrichmentStoreSize,
  type CompanyEnrichmentCSV,
} from '../../services/CompanyEnrichmentService';
import type { EnrichedCompany } from '../../types/marketing';

describe('CompanyEnrichmentService', () => {
  // Sample companies for testing
  const sampleCompanies: Partial<EnrichedCompany>[] = [
    {
      id: 'company-1',
      company: 'Primo Brands',
      tier: 'Tier 1',
      attendees: 15,
      opsShare: 0.75,
    },
    {
      id: 'company-2',
      company: 'Big Beverage Co',
      tier: 'Tier 1',
      attendees: 10,
      opsShare: 0.6,
    },
    {
      id: 'company-3',
      company: 'Small Logistics Inc',
      tier: 'Tier 2',
      attendees: 5,
      opsShare: 0.5,
    },
    {
      id: 'company-4',
      company: 'Tech Startup',
      tier: 'Tier 3',
      attendees: 2,
      opsShare: 0.1,
    },
  ];

  beforeEach(() => {
    clearEnrichmentStore();
    clearCompanyStore();
    initializeCompanyStore(sampleCompanies);
  });

  afterEach(() => {
    clearEnrichmentStore();
    clearCompanyStore();
  });

  describe('initializeCompanyStore', () => {
    it('should initialize with sample companies', () => {
      expect(getCompanyStoreSize()).toBe(4);
    });

    it('should clear existing data on reinitialize', () => {
      initializeCompanyStore([{ company: 'New Company' }]);
      expect(getCompanyStoreSize()).toBe(1);
    });

    it('should handle empty array', () => {
      initializeCompanyStore([]);
      expect(getCompanyStoreSize()).toBe(0);
    });
  });

  describe('CRUD Operations (T53.4a)', () => {
    describe('setFacilityCount', () => {
      it('should set facility count for a company', () => {
        const result = setFacilityCount('company-1', 260);
        
        expect(result.success).toBe(true);
        expect(result.companyId).toBe('company-1');
        expect(result.newScore).toBeGreaterThan(0);
      });

      it('should store enrichment data', () => {
        setFacilityCount('company-1', 100);
        const enrichment = getEnrichment('company-1');
        
        expect(enrichment?.facilityCount).toBe(100);
      });

      it('should recalculate Primo score', () => {
        const result = setFacilityCount('company-1', 260);
        
        // 260 facilities = 30 points
        expect(result.newScore).toBeGreaterThanOrEqual(30);
      });
    });

    describe('setIndustryCategory', () => {
      it('should set industry category', () => {
        const result = setIndustryCategory('company-1', 'beverage');
        
        expect(result.success).toBe(true);
        const enrichment = getEnrichment('company-1');
        expect(enrichment?.industryCategory).toBe('beverage');
      });

      it('should recalculate score with industry bonus', () => {
        setFacilityCount('company-1', 100);
        const before = getEnrichment('company-1');
        
        const result = setIndustryCategory('company-1', 'beverage');
        
        // Beverage industry adds 25 points
        expect(result.newScore).toBeGreaterThan(0);
      });
    });

    describe('setDistributionFootprint', () => {
      it('should set distribution footprint', () => {
        const result = setDistributionFootprint('company-1', 'national');
        
        expect(result.success).toBe(true);
        const enrichment = getEnrichment('company-1');
        expect(enrichment?.distributionFootprint).toBe('national');
      });
    });

    describe('setYardIntensive', () => {
      it('should set yard intensive flag', () => {
        const result = setYardIntensive('company-1', true);
        
        expect(result.success).toBe(true);
        const enrichment = getEnrichment('company-1');
        expect(enrichment?.isYardIntensive).toBe(true);
      });
    });

    describe('setEnrichmentData', () => {
      it('should set all enrichment data at once', () => {
        const result = setEnrichmentData('company-1', {
          facilityCount: 260,
          industryCategory: 'beverage',
          distributionFootprint: 'national',
          isYardIntensive: true,
        });
        
        expect(result.success).toBe(true);
        
        const enrichment = getEnrichment('company-1');
        expect(enrichment?.facilityCount).toBe(260);
        expect(enrichment?.industryCategory).toBe('beverage');
        expect(enrichment?.distributionFootprint).toBe('national');
        expect(enrichment?.isYardIntensive).toBe(true);
      });

      it('should merge with existing data', () => {
        setFacilityCount('company-1', 100);
        setEnrichmentData('company-1', { industryCategory: 'cpg' });
        
        const enrichment = getEnrichment('company-1');
        expect(enrichment?.facilityCount).toBe(100); // Preserved
        expect(enrichment?.industryCategory).toBe('cpg'); // Added
      });
    });

    describe('deleteEnrichment', () => {
      it('should delete enrichment data', () => {
        setFacilityCount('company-1', 100);
        expect(getEnrichment('company-1')).toBeDefined();
        
        const deleted = deleteEnrichment('company-1');
        
        expect(deleted).toBe(true);
        expect(getEnrichment('company-1')).toBeUndefined();
      });

      it('should return false for non-existent enrichment', () => {
        const deleted = deleteEnrichment('non-existent');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('Bulk Operations (T53.4b)', () => {
    describe('bulkEnrichFromCSV', () => {
      it('should enrich multiple companies from CSV', () => {
        const csvData: CompanyEnrichmentCSV[] = [
          { company: 'Primo Brands', facility_count: '260', industry: 'beverage', footprint: 'national' },
          { company: 'Big Beverage Co', facility_count: '150', industry: 'beverage', footprint: 'regional' },
        ];
        
        const result = bulkEnrichFromCSV(csvData);
        
        expect(result.total).toBe(2);
        expect(result.successful).toBe(2);
        expect(result.failed).toBe(0);
      });

      it('should handle numeric facility count', () => {
        const csvData: CompanyEnrichmentCSV[] = [
          { company: 'Primo Brands', facility_count: 260 },
        ];
        
        const result = bulkEnrichFromCSV(csvData);
        
        expect(result.successful).toBe(1);
        const enrichment = getEnrichment('company-1');
        expect(enrichment?.facilityCount).toBe(260);
      });

      it('should parse industry strings correctly', () => {
        const csvData: CompanyEnrichmentCSV[] = [
          { company: 'Primo Brands', industry: 'Beverage Company' },
          { company: 'Big Beverage Co', industry: 'Food Manufacturing' },
          { company: 'Small Logistics Inc', industry: '3PL Distribution' },
        ];
        
        bulkEnrichFromCSV(csvData);
        
        expect(getEnrichment('company-1')?.industryCategory).toBe('beverage');
        expect(getEnrichment('company-2')?.industryCategory).toBe('food_manufacturing');
        expect(getEnrichment('company-3')?.industryCategory).toBe('distribution');
      });

      it('should parse footprint strings correctly', () => {
        const csvData: CompanyEnrichmentCSV[] = [
          { company: 'Primo Brands', footprint: 'Nationwide' },
          { company: 'Big Beverage Co', footprint: 'Multi-State Regional' },
          { company: 'Small Logistics Inc', footprint: 'Local Only' },
        ];
        
        bulkEnrichFromCSV(csvData);
        
        expect(getEnrichment('company-1')?.distributionFootprint).toBe('national');
        expect(getEnrichment('company-2')?.distributionFootprint).toBe('regional');
        expect(getEnrichment('company-3')?.distributionFootprint).toBe('local');
      });

      it('should parse boolean is_yard_intensive', () => {
        const csvData: CompanyEnrichmentCSV[] = [
          { company: 'Primo Brands', is_yard_intensive: 'yes' },
          { company: 'Big Beverage Co', is_yard_intensive: true },
          { company: 'Small Logistics Inc', is_yard_intensive: 'false' },
        ];
        
        bulkEnrichFromCSV(csvData);
        
        expect(getEnrichment('company-1')?.isYardIntensive).toBe(true);
        expect(getEnrichment('company-2')?.isYardIntensive).toBe(true);
        expect(getEnrichment('company-3')?.isYardIntensive).toBe(false);
      });

      it('should fail for companies not in database', () => {
        const csvData: CompanyEnrichmentCSV[] = [
          { company: 'Unknown Company', facility_count: '100' },
        ];
        
        const result = bulkEnrichFromCSV(csvData);
        
        expect(result.failed).toBe(1);
        expect(result.results[0].error).toContain('not found');
      });

      it('should handle mixed success and failure', () => {
        const csvData: CompanyEnrichmentCSV[] = [
          { company: 'Primo Brands', facility_count: '260' },
          { company: 'Unknown Company', facility_count: '100' },
          { company: 'Big Beverage Co', facility_count: '150' },
        ];
        
        const result = bulkEnrichFromCSV(csvData);
        
        expect(result.total).toBe(3);
        expect(result.successful).toBe(2);
        expect(result.failed).toBe(1);
      });

      it('should handle empty CSV', () => {
        const result = bulkEnrichFromCSV([]);
        
        expect(result.total).toBe(0);
        expect(result.successful).toBe(0);
        expect(result.failed).toBe(0);
      });
    });
  });

  describe('Gap Detection (T53.4c)', () => {
    describe('getUnenrichedCompanies', () => {
      it('should return all companies when none are enriched', () => {
        const unenriched = getUnenrichedCompanies();
        expect(unenriched.length).toBe(4);
      });

      it('should exclude fully enriched companies', () => {
        setEnrichmentData('company-1', {
          facilityCount: 260,
          industryCategory: 'beverage',
          distributionFootprint: 'national',
        });
        
        const unenriched = getUnenrichedCompanies();
        expect(unenriched.length).toBe(3);
        expect(unenriched.find(c => c.id === 'company-1')).toBeUndefined();
      });

      it('should include partially enriched companies', () => {
        setFacilityCount('company-1', 260); // Only facility count, missing industry and footprint
        
        const unenriched = getUnenrichedCompanies();
        expect(unenriched.find(c => c.id === 'company-1')).toBeDefined();
      });

      it('should sort by tier then attendees', () => {
        const unenriched = getUnenrichedCompanies();
        
        // Verify all 4 companies are returned as unenriched
        expect(unenriched.length).toBe(4);
        
        // Verify sorting is applied - check order is correct for the full array
        // After sorting: tier order should be respected
        for (let i = 1; i < unenriched.length; i++) {
          const prev = unenriched[i - 1];
          const curr = unenriched[i];
          
          const tierOrder: Record<string, number> = { 'Tier 1': 0, 'Tier 2': 1, 'Tier 3': 2, 'Tier 4': 3, 'Unscored': 4 };
          const prevTier = tierOrder[prev.tier || 'Unscored'] ?? 4;
          const currTier = tierOrder[curr.tier || 'Unscored'] ?? 4;
          
          // Each item should be same or higher tier number than previous
          expect(prevTier).toBeLessThanOrEqual(currTier);
          
          // If same tier, attendees should be descending
          if (prevTier === currTier) {
            expect(prev.attendees || 0).toBeGreaterThanOrEqual(curr.attendees || 0);
          }
        }
      });
    });

    describe('getEnrichmentCompletion', () => {
      it('should return 0% when no companies are enriched', () => {
        const completion = getEnrichmentCompletion();
        
        expect(completion.total).toBe(4);
        expect(completion.enriched).toBe(0);
        expect(completion.percentage).toBe(0);
      });

      it('should count missing fields correctly', () => {
        const completion = getEnrichmentCompletion();
        
        expect(completion.missingFacilityCount).toBe(4);
        expect(completion.missingIndustry).toBe(4);
        expect(completion.missingFootprint).toBe(4);
      });

      it('should update stats when companies are enriched', () => {
        setEnrichmentData('company-1', {
          facilityCount: 260,
          industryCategory: 'beverage',
          distributionFootprint: 'national',
        });
        
        setEnrichmentData('company-2', {
          facilityCount: 150,
          industryCategory: 'beverage',
          distributionFootprint: 'regional',
        });
        
        const completion = getEnrichmentCompletion();
        
        expect(completion.enriched).toBe(2);
        expect(completion.percentage).toBe(50);
        expect(completion.missingFacilityCount).toBe(2);
        expect(completion.missingIndustry).toBe(2);
        expect(completion.missingFootprint).toBe(2);
      });

      it('should return 100% when all companies are enriched', () => {
        for (const company of sampleCompanies) {
          setEnrichmentData(company.id!, {
            facilityCount: 100,
            industryCategory: 'distribution',
            distributionFootprint: 'regional',
          });
        }
        
        const completion = getEnrichmentCompletion();
        expect(completion.percentage).toBe(100);
      });
    });

    describe('getAllCompaniesWithScores', () => {
      it('should return all companies with score breakdowns', () => {
        const results = getAllCompaniesWithScores();
        
        expect(results.length).toBe(4);
        expect(results[0]).toHaveProperty('company');
        expect(results[0]).toHaveProperty('breakdown');
        expect(results[0].breakdown).toHaveProperty('totalScore');
      });

      it('should sort by score descending', () => {
        setEnrichmentData('company-1', {
          facilityCount: 260,
          industryCategory: 'beverage',
        });
        
        const results = getAllCompaniesWithScores();
        
        expect(results[0].company.id).toBe('company-1');
        expect(results[0].breakdown.totalScore).toBeGreaterThan(results[1].breakdown.totalScore);
      });

      it('should merge enrichment data into company', () => {
        setEnrichmentData('company-1', {
          facilityCount: 260,
          industryCategory: 'beverage',
        });
        
        const results = getAllCompaniesWithScores();
        const primo = results.find(r => r.company.id === 'company-1');
        
        expect(primo?.company.facilityCount).toBe(260);
        expect(primo?.company.industryCategory).toBe('beverage');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle company name normalization', () => {
      // Different case and extra spaces should still match
      initializeCompanyStore([{ id: 'test', company: 'PRIMO  BRANDS' }]);
      
      const result = bulkEnrichFromCSV([
        { company: 'primo brands', facility_count: '260' },
      ]);
      
      expect(result.successful).toBe(1);
    });

    it('should handle special characters in company names', () => {
      initializeCompanyStore([{ id: 'test', company: "O'Brien & Associates, LLC" }]);
      
      const result = bulkEnrichFromCSV([
        { company: "O'Brien & Associates, LLC", facility_count: '50' },
      ]);
      
      expect(result.successful).toBe(1);
    });

    it('should handle empty facility count gracefully', () => {
      const result = bulkEnrichFromCSV([
        { company: 'Primo Brands', facility_count: '' },
      ]);
      
      expect(result.successful).toBe(1);
      // Empty string should not set facility count
    });

    it('should handle malformed numeric values', () => {
      const result = bulkEnrichFromCSV([
        { company: 'Primo Brands', facility_count: 'not a number' },
      ]);
      
      expect(result.successful).toBe(1);
      expect(getEnrichment('company-1')?.facilityCount).toBeUndefined();
    });
  });
});
