/**
 * Tests for DataQualityService
 * Sprint 1004: Data Quality & Dedup
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DataQualityService,
  type ProspectQuality,
  type DataQualityReport,
} from '../../services/DataQualityService';
import type { Prospect } from '../../types';

// Test prospect factory
function createProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: `prospect-${Math.random().toString(36).slice(2)}`,
    name: 'John Doe',
    email: 'john.doe@acme.com',
    emailConfidence: 'verified',
    company: 'Acme Corp',
    title: 'VP Operations',
    tier: 'Tier 1',
    score: 85,
    status: 'new',
    category: 'Attendee',
    qualified: true,
    country: 'United States',
    revenue: '$10M-50M',
    isOps: true,
    isExec: true,
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('DataQualityService', () => {
  let service: DataQualityService;

  beforeEach(() => {
    service = new DataQualityService();
  });

  describe('assessProspect', () => {
    it('scores complete prospects highly', () => {
      const prospect = createProspect();
      const quality = service.assessProspect(prospect);
      
      expect(quality.score).toBeGreaterThanOrEqual(80);
      expect(quality.level).toBe('excellent');
      expect(quality.issues).toHaveLength(0);
    });

    it('identifies missing email as issue', () => {
      const prospect = createProspect({ email: undefined, emailConfidence: undefined });
      const quality = service.assessProspect(prospect);
      
      expect(quality.issues).toContain('No email address');
      expect(quality.recommendations.some(r => r.includes('email'))).toBe(true);
    });

    it('identifies inferred email as issue', () => {
      const prospect = createProspect({ emailConfidence: 'inferred' });
      const quality = service.assessProspect(prospect);
      
      expect(quality.issues).toContain('Email is inferred (not verified)');
      expect(quality.recommendations).toContain('Verify email before outreach');
    });

    it('identifies missing company as issue', () => {
      const prospect = createProspect({ company: '' });
      const quality = service.assessProspect(prospect);
      
      expect(quality.issues).toContain('Missing company');
    });

    it('identifies missing title as issue', () => {
      const prospect = createProspect({ title: '' });
      const quality = service.assessProspect(prospect);
      
      expect(quality.issues).toContain('Missing job title');
    });

    it('identifies missing LinkedIn as issue', () => {
      const prospect = createProspect({ linkedinUrl: undefined });
      const quality = service.assessProspect(prospect);
      
      expect(quality.issues).toContain('No LinkedIn URL');
    });

    it('scores incomplete prospects lower', () => {
      const prospect = createProspect({
        email: undefined,
        emailConfidence: undefined,
        linkedinUrl: undefined,
        title: '',
        country: '',
      });
      const quality = service.assessProspect(prospect);
      
      expect(quality.score).toBeLessThan(60);
      expect(['fair', 'poor']).toContain(quality.level);
    });
  });

  describe('calculateFieldCompleteness', () => {
    it('calculates completeness for all fields', () => {
      const prospects = [
        createProspect(),
        createProspect({ email: undefined }),
        createProspect({ linkedinUrl: undefined }),
      ];

      const completeness = service.calculateFieldCompleteness(prospects);
      
      expect(completeness.length).toBeGreaterThan(0);
      
      const emailField = completeness.find(f => f.field === 'email');
      expect(emailField?.present).toBe(2);
      expect(emailField?.missing).toBe(1);
      expect(emailField?.percentage).toBe(67);
    });

    it('handles empty array', () => {
      const completeness = service.calculateFieldCompleteness([]);
      
      expect(completeness.every(f => f.percentage === 0)).toBe(true);
    });
  });

  describe('analyzeEmailQuality', () => {
    it('categorizes emails correctly', () => {
      const prospects = [
        createProspect({ emailConfidence: 'verified' }),
        createProspect({ emailConfidence: 'verified' }),
        createProspect({ emailConfidence: 'inferred' }),
        createProspect({ email: undefined, emailConfidence: undefined }),
      ];

      const analysis = service.analyzeEmailQuality(prospects);
      
      expect(analysis.verified).toBe(2);
      expect(analysis.inferred).toBe(1);
      expect(analysis.missing).toBe(1);
      expect(analysis.total).toBe(3);
      expect(analysis.contactable).toBe(3);
      expect(analysis.contactablePercentage).toBe(75);
    });
  });

  describe('generateReport', () => {
    it('generates comprehensive report', () => {
      const prospects = [
        createProspect({ tier: 'Tier 1', status: 'new' }),
        createProspect({ tier: 'Tier 1', status: 'contacted' }),
        createProspect({ tier: 'Tier 2', status: 'new', emailConfidence: 'inferred' }),
        createProspect({ tier: 'Tier 3', status: 'new', email: undefined, emailConfidence: undefined }),
      ];

      const report = service.generateReport(prospects);
      
      expect(report.totalProspects).toBe(4);
      expect(report.qualityScore.overall).toBeGreaterThan(0);
      expect(report.qualityScore.level).toBeDefined();
      expect(report.fieldCompleteness.length).toBeGreaterThan(0);
      expect(report.emailBreakdown.total).toBe(3);
      expect(report.tierDistribution['Tier 1']).toBe(2);
      expect(report.tierDistribution['Tier 2']).toBe(1);
      expect(report.statusDistribution['new']).toBe(3);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('includes actionable recommendations', () => {
      const prospects = Array(10).fill(null).map(() => 
        createProspect({ email: undefined, emailConfidence: undefined })
      );

      const report = service.generateReport(prospects);
      
      expect(report.recommendations.some(r => r.includes('email'))).toBe(true);
    });
  });

  describe('getHighQualityProspects', () => {
    it('filters to high quality prospects', () => {
      const prospects = [
        createProspect(), // High quality
        createProspect({ email: undefined, emailConfidence: undefined, linkedinUrl: undefined, title: '' }), // Low quality
      ];

      const highQuality = service.getHighQualityProspects(prospects);
      
      expect(highQuality.length).toBe(1);
      expect(highQuality[0].name).toBe('John Doe');
    });
  });

  describe('getContactableProspects', () => {
    it('returns only prospects with valid emails', () => {
      const prospects = [
        createProspect({ emailConfidence: 'verified' }),
        createProspect({ emailConfidence: 'inferred' }),
        createProspect({ email: undefined, emailConfidence: undefined }),
        createProspect({ email: 'invalid', emailConfidence: 'verified' }),
      ];

      const contactable = service.getContactableProspects(prospects);
      
      expect(contactable.length).toBe(2);
    });
  });

  describe('getVerifiedOnlyProspects', () => {
    it('returns only verified email prospects', () => {
      const prospects = [
        createProspect({ emailConfidence: 'verified' }),
        createProspect({ emailConfidence: 'inferred' }),
        createProspect({ emailConfidence: 'verified' }),
      ];

      const verified = service.getVerifiedOnlyProspects(prospects);
      
      expect(verified.length).toBe(2);
      verified.forEach(p => {
        expect(p.emailConfidence).toBe('verified');
      });
    });
  });

  describe('findDuplicates', () => {
    it('detects email duplicates', () => {
      const prospects = [
        createProspect({ id: '1', email: 'john@acme.com' }),
        createProspect({ id: '2', email: 'john@acme.com' }), // Duplicate email
        createProspect({ id: '3', email: 'jane@acme.com' }),
      ];

      const duplicates = service.findDuplicates(prospects);
      
      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates.some(d => 
        d.matchedFields.includes('email')
      )).toBe(true);
    });

    it('handles no duplicates', () => {
      const prospects = [
        createProspect({ 
          id: '1', 
          email: 'john@acme.com', 
          name: 'John Doe',
          linkedinUrl: 'https://linkedin.com/in/johndoe',
        }),
        createProspect({ 
          id: '2', 
          email: 'jane@bigco.com', 
          name: 'Jane Smith', 
          company: 'BigCo',
          linkedinUrl: 'https://linkedin.com/in/janesmith',
        }),
      ];

      const duplicates = service.findDuplicates(prospects);
      
      expect(duplicates.length).toBe(0);
    });
  });
});
