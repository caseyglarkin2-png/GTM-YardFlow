/**
 * Company Research Service Tests - YardFlow Hub
 * 
 * Tests for Sprint 58: AI-powered company research with Gemini
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  researchCompany,
  batchResearchCompanies,
  createResearchQueue,
  researchFromQueue,
  buildResearchPrompt,
  parseResearchResponse,
  needsResearch,
  getResearchSummary,
  estimateResearchTime,
  type CompanyResearchRequest,
  type ResearchedCompanyData,
  type ResearchQueueItem,
} from '../../services/CompanyResearchService';
import type { EnrichedCompany } from '../../types/marketing';

describe('CompanyResearchService', () => {
  // ============================================
  // buildResearchPrompt Tests
  // ============================================
  describe('buildResearchPrompt', () => {
    it('should build a prompt with company name', () => {
      const prompt = buildResearchPrompt({ companyName: 'Primo Brands' });
      
      expect(prompt).toContain('Primo Brands');
      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('facilityCount');
      expect(prompt).toContain('industryCategory');
    });

    it('should include existing data when provided', () => {
      const prompt = buildResearchPrompt({
        companyName: 'Test Company',
        existingData: {
          tier: 'Tier 1',
          attendees: 15,
          opsShare: 0.75,
        },
      });
      
      expect(prompt).toContain('Tier 1');
      expect(prompt).toContain('15');
      expect(prompt).toContain('75%');
    });

    it('should adjust for research depth', () => {
      const quickPrompt = buildResearchPrompt({
        companyName: 'Test',
        researchDepth: 'quick',
      });
      const deepPrompt = buildResearchPrompt({
        companyName: 'Test',
        researchDepth: 'deep',
      });
      
      expect(quickPrompt).toContain('brief overview');
      expect(deepPrompt).toContain('in-depth research');
    });

    it('should include YardFlow context', () => {
      const prompt = buildResearchPrompt({ companyName: 'Test' });
      
      expect(prompt).toContain('YardFlow');
      expect(prompt).toContain('Primo Brands');
      expect(prompt).toContain('yard management');
      expect(prompt).toContain('50+ facilities');
    });
  });

  // ============================================
  // parseResearchResponse Tests
  // ============================================
  describe('parseResearchResponse', () => {
    it('should parse valid JSON response', () => {
      const rawResponse = `
        Here is the research for the company:
        \`\`\`json
        {
          "facilityCount": 150,
          "industryCategory": "beverage",
          "distributionFootprint": "national",
          "isYardIntensive": true,
          "sources": ["Company website", "LinkedIn"],
          "confidence": {
            "overall": "high",
            "facilityCount": "verified",
            "industryCategory": "verified",
            "distributionFootprint": "inferred"
          }
        }
        \`\`\`
      `;

      const { data, sources, confidence } = parseResearchResponse(rawResponse);

      expect(data.facilityCount).toBe(150);
      expect(data.industryCategory).toBe('beverage');
      expect(data.distributionFootprint).toBe('national');
      expect(data.isYardIntensive).toBe(true);
      expect(sources).toContain('Company website');
      expect(confidence.overall).toBe('high');
      expect(confidence.facilityCount).toBe('verified');
    });

    it('should handle JSON without code blocks', () => {
      const rawResponse = `{
        "facilityCount": 50,
        "industryCategory": "cpg",
        "distributionFootprint": "regional"
      }`;

      const { data } = parseResearchResponse(rawResponse);

      expect(data.facilityCount).toBe(50);
      expect(data.industryCategory).toBe('cpg');
    });

    it('should normalize industry category', () => {
      const rawResponse = `{
        "industryCategory": "BEVERAGE",
        "distributionFootprint": "National"
      }`;

      const { data } = parseResearchResponse(rawResponse);

      expect(data.industryCategory).toBe('beverage');
      expect(data.distributionFootprint).toBe('national');
    });

    it('should reject invalid industry categories', () => {
      const rawResponse = `{
        "industryCategory": "technology",
        "distributionFootprint": "national"
      }`;

      const { data } = parseResearchResponse(rawResponse);

      expect(data.industryCategory).toBeUndefined();
    });

    it('should handle missing optional fields', () => {
      const rawResponse = `{
        "facilityCount": 100
      }`;

      const { data, confidence } = parseResearchResponse(rawResponse);

      expect(data.facilityCount).toBe(100);
      expect(data.industryCategory).toBeUndefined();
      expect(confidence.overall).toBe('low');
    });

    it('should throw on invalid JSON', () => {
      const rawResponse = 'This is not JSON at all';

      expect(() => parseResearchResponse(rawResponse)).toThrow();
    });

    it('should parse all optional fields', () => {
      const rawResponse = `{
        "facilityCount": 200,
        "facilityCountSource": "Annual report",
        "industryCategory": "food_manufacturing",
        "industryCategoryReasoning": "Makes food products",
        "distributionFootprint": "international",
        "distributionFootprintReasoning": "Ships globally",
        "isYardIntensive": true,
        "isYardIntensiveReasoning": "Large DCs",
        "estimatedTruckVolume": 500,
        "headquarters": "Chicago, IL",
        "website": "https://example.com",
        "description": "A food company",
        "parentCompany": "Big Corp",
        "keyProducts": ["Snacks", "Beverages"],
        "revenueEstimate": "$5B-$10B"
      }`;

      const { data } = parseResearchResponse(rawResponse);

      expect(data.facilityCount).toBe(200);
      expect(data.facilityCountSource).toBe('Annual report');
      expect(data.industryCategory).toBe('food_manufacturing');
      expect(data.headquarters).toBe('Chicago, IL');
      expect(data.keyProducts).toEqual(['Snacks', 'Beverages']);
      expect(data.revenueEstimate).toBe('$5B-$10B');
    });
  });

  // ============================================
  // researchCompany Tests (Mock Mode)
  // ============================================
  describe('researchCompany', () => {
    it('should return error for empty company name', async () => {
      const result = await researchCompany({ companyName: '' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return mock data in test mode', async () => {
      const result = await researchCompany({ companyName: 'Test Beverage Co' });

      expect(result.success).toBe(true);
      expect(result.companyName).toBe('Test Beverage Co');
      expect(result.data).toBeDefined();
      expect(result.researchedAt).toBeInstanceOf(Date);
    });

    it('should infer industry from company name in mock mode', async () => {
      const beverageResult = await researchCompany({ companyName: 'Coca Cola Beverages' });
      const foodResult = await researchCompany({ companyName: 'Acme Food Processing' });
      const logisticsResult = await researchCompany({ companyName: 'XYZ Logistics' });

      expect(beverageResult.data?.industryCategory).toBe('beverage');
      expect(foodResult.data?.industryCategory).toBe('food_manufacturing');
      expect(logisticsResult.data?.industryCategory).toBe('distribution');
    });

    it('should return confidence data', async () => {
      const result = await researchCompany({ companyName: 'Test Company' });

      expect(result.confidence).toBeDefined();
      expect(result.confidence?.overall).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.confidence?.overall);
    });

    it('should return sources', async () => {
      const result = await researchCompany({ companyName: 'Test Company' });

      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);
    });
  });

  // ============================================
  // batchResearchCompanies Tests
  // ============================================
  describe('batchResearchCompanies', () => {
    it('should research multiple companies', async () => {
      const companies: CompanyResearchRequest[] = [
        { companyName: 'Company A' },
        { companyName: 'Company B' },
        { companyName: 'Company C' },
      ];

      const result = await batchResearchCompanies(companies);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should call progress callback', async () => {
      const companies: CompanyResearchRequest[] = [
        { companyName: 'Company A' },
        { companyName: 'Company B' },
      ];

      const progressCalls: Array<{ completed: number; total: number }> = [];

      await batchResearchCompanies(companies, {
        onProgress: (completed, total) => {
          progressCalls.push({ completed, total });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1].completed).toBe(2);
    });

    it('should handle empty list', async () => {
      const result = await batchResearchCompanies([]);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should count failures', async () => {
      const companies: CompanyResearchRequest[] = [
        { companyName: 'Valid Company' },
        { companyName: '' }, // This will fail
      ];

      const result = await batchResearchCompanies(companies);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  // ============================================
  // createResearchQueue Tests
  // ============================================
  describe('createResearchQueue', () => {
    const sampleCompanies: Partial<EnrichedCompany>[] = [
      { id: '1', company: 'Tier 1 High', tier: 'Tier 1', attendees: 20 },
      { id: '2', company: 'Tier 1 Low', tier: 'Tier 1', attendees: 5 },
      { id: '3', company: 'Tier 2 High', tier: 'Tier 2', attendees: 15 },
      { id: '4', company: 'Already Enriched', tier: 'Tier 1', attendees: 25, 
        facilityCount: 100, industryCategory: 'beverage', distributionFootprint: 'national' },
    ];

    it('should create queue excluding enriched companies', () => {
      const queue = createResearchQueue(sampleCompanies);

      expect(queue).toHaveLength(3);
      expect(queue.find(q => q.companyName === 'Already Enriched')).toBeUndefined();
    });

    it('should prioritize Tier 1 companies first', () => {
      const queue = createResearchQueue(sampleCompanies);

      // First two should be Tier 1
      expect(queue[0].companyName).toBe('Tier 1 High');
      expect(queue[1].companyName).toBe('Tier 1 Low');
      expect(queue[2].companyName).toBe('Tier 2 High');
    });

    it('should prioritize higher attendees within same tier', () => {
      const queue = createResearchQueue(sampleCompanies);

      // Tier 1 High (20 attendees) should come before Tier 1 Low (5 attendees)
      const tier1High = queue.findIndex(q => q.companyName === 'Tier 1 High');
      const tier1Low = queue.findIndex(q => q.companyName === 'Tier 1 Low');

      expect(tier1High).toBeLessThan(tier1Low);
    });

    it('should apply custom filter', () => {
      const queue = createResearchQueue(sampleCompanies, {
        filterFn: (company) => (company.attendees || 0) >= 10,
      });

      expect(queue).toHaveLength(2);
      expect(queue.find(q => q.companyName === 'Tier 1 Low')).toBeUndefined();
    });

    it('should set initial status to pending', () => {
      const queue = createResearchQueue(sampleCompanies);

      for (const item of queue) {
        expect(item.status).toBe('pending');
      }
    });

    it('should include company ID when available', () => {
      const queue = createResearchQueue(sampleCompanies);

      const tier1High = queue.find(q => q.companyName === 'Tier 1 High');
      expect(tier1High?.companyId).toBe('1');
    });

    it('should handle companies without names', () => {
      const companiesWithMissing: Partial<EnrichedCompany>[] = [
        { id: '1', company: undefined },
        { id: '2', company: 'Valid Company' },
      ];

      const queue = createResearchQueue(companiesWithMissing);

      expect(queue).toHaveLength(1);
      expect(queue[0].companyName).toBe('Valid Company');
    });
  });

  // ============================================
  // researchFromQueue Tests
  // ============================================
  describe('researchFromQueue', () => {
    it('should process queue items', async () => {
      const queue: ResearchQueueItem[] = [
        { companyName: 'Company A', priority: 0, status: 'pending' },
        { companyName: 'Company B', priority: 100, status: 'pending' },
      ];

      const result = await researchFromQueue(queue);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(queue[0].status).toBe('completed');
      expect(queue[1].status).toBe('completed');
    });

    it('should respect maxItems limit', async () => {
      const queue: ResearchQueueItem[] = [
        { companyName: 'Company A', priority: 0, status: 'pending' },
        { companyName: 'Company B', priority: 100, status: 'pending' },
        { companyName: 'Company C', priority: 200, status: 'pending' },
      ];

      const result = await researchFromQueue(queue, { maxItems: 2 });

      expect(result.total).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should call progress callback for each item', async () => {
      const queue: ResearchQueueItem[] = [
        { companyName: 'Company A', priority: 0, status: 'pending' },
        { companyName: 'Company B', priority: 100, status: 'pending' },
      ];

      const progressItems: string[] = [];

      await researchFromQueue(queue, {
        onProgress: (item) => {
          progressItems.push(item.companyName);
        },
      });

      expect(progressItems).toEqual(['Company A', 'Company B']);
    });

    it('should update item status during processing', async () => {
      const queue: ResearchQueueItem[] = [
        { companyName: 'Valid Company', priority: 0, status: 'pending' },
      ];

      await researchFromQueue(queue);

      expect(queue[0].status).toBe('completed');
      expect(queue[0].result).toBeDefined();
      expect(queue[0].result?.success).toBe(true);
    });

    it('should sort by priority before processing', async () => {
      const queue: ResearchQueueItem[] = [
        { companyName: 'Low Priority', priority: 200, status: 'pending' },
        { companyName: 'High Priority', priority: 0, status: 'pending' },
      ];

      const processOrder: string[] = [];

      await researchFromQueue(queue, {
        onProgress: (item) => {
          processOrder.push(item.companyName);
        },
      });

      expect(processOrder[0]).toBe('High Priority');
      expect(processOrder[1]).toBe('Low Priority');
    });
  });

  // ============================================
  // needsResearch Tests
  // ============================================
  describe('needsResearch', () => {
    it('should return true when all fields missing', () => {
      const company: Partial<EnrichedCompany> = {
        company: 'Test',
      };

      expect(needsResearch(company)).toBe(true);
    });

    it('should return false when all fields present', () => {
      const company: Partial<EnrichedCompany> = {
        company: 'Test',
        facilityCount: 100,
        industryCategory: 'beverage',
        distributionFootprint: 'national',
      };

      expect(needsResearch(company)).toBe(false);
    });

    it('should return true when any field missing', () => {
      expect(needsResearch({ facilityCount: 100, industryCategory: 'beverage' })).toBe(true);
      expect(needsResearch({ facilityCount: 100, distributionFootprint: 'national' })).toBe(true);
      expect(needsResearch({ industryCategory: 'beverage', distributionFootprint: 'national' })).toBe(true);
    });
  });

  // ============================================
  // getResearchSummary Tests
  // ============================================
  describe('getResearchSummary', () => {
    it('should summarize research status', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { company: 'Full', tier: 'Tier 1', facilityCount: 100, industryCategory: 'beverage', distributionFootprint: 'national' },
        { company: 'Partial', tier: 'Tier 1', facilityCount: 50 },
        { company: 'None', tier: 'Tier 2' },
      ];

      const summary = getResearchSummary(companies);

      expect(summary.total).toBe(3);
      expect(summary.fullyResearched).toBe(1);
      expect(summary.partiallyResearched).toBe(1);
      expect(summary.notResearched).toBe(1);
    });

    it('should break down by tier', () => {
      const companies: Partial<EnrichedCompany>[] = [
        { company: 'T1 Full', tier: 'Tier 1', facilityCount: 100, industryCategory: 'beverage', distributionFootprint: 'national' },
        { company: 'T1 None', tier: 'Tier 1' },
        { company: 'T2 None', tier: 'Tier 2' },
      ];

      const summary = getResearchSummary(companies);

      expect(summary.byTier['Tier 1'].total).toBe(2);
      expect(summary.byTier['Tier 1'].researched).toBe(1);
      expect(summary.byTier['Tier 2'].total).toBe(1);
      expect(summary.byTier['Tier 2'].researched).toBe(0);
    });

    it('should handle empty list', () => {
      const summary = getResearchSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.fullyResearched).toBe(0);
    });
  });

  // ============================================
  // estimateResearchTime Tests
  // ============================================
  describe('estimateResearchTime', () => {
    it('should estimate time for queue', () => {
      const estimate = estimateResearchTime(10);

      expect(estimate.estimatedMinutes).toBeGreaterThan(0);
      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.estimatedCost).toMatch(/^\$\d+\.\d+$/);
    });

    it('should scale with queue size', () => {
      const small = estimateResearchTime(10);
      const large = estimateResearchTime(100);

      expect(large.estimatedMinutes).toBeGreaterThan(small.estimatedMinutes);
      expect(large.estimatedTokens).toBeGreaterThan(small.estimatedTokens);
    });

    it('should return zero for empty queue', () => {
      const estimate = estimateResearchTime(0);

      expect(estimate.estimatedMinutes).toBe(0);
      expect(estimate.estimatedTokens).toBe(0);
    });
  });
});
