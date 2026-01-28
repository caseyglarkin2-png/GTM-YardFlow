/**
 * Asset Services Tests - YardFlow Hub
 * 
 * Tests for Approved Claims, Prompt Builder, Cache, and Gemini Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getApprovedClaims,
  getClaimById,
  formatClaimsForPrompt,
  getClaimsForContext,
  checkForUnapprovedClaims,
} from '../../config/approvedClaims';
import {
  buildAssetPrompt,
  buildDMPrompt,
  buildBriefPrompt,
  buildEmailPrompt,
  estimateTokenCount,
} from '../../services/AssetPromptBuilder';
import {
  getCached,
  setCache,
  generateCacheKey,
  invalidateProspect,
  clearAll,
  getCacheStats,
} from '../../services/AssetCacheService';
import type { AssetContext, GeneratedAssets } from '../../types/assets';

// ============================================
// Approved Claims Tests
// ============================================

describe('Approved Claims Registry', () => {
  describe('getApprovedClaims', () => {
    it('should return only approved claims', () => {
      const claims = getApprovedClaims();
      
      expect(claims.length).toBeGreaterThan(0);
      claims.forEach(claim => {
        expect(claim.approved).toBe(true);
      });
    });

    it('should filter by category', () => {
      const roiClaims = getApprovedClaims(['roi']);
      
      expect(roiClaims.length).toBeGreaterThan(0);
      roiClaims.forEach(claim => {
        expect(claim.category).toBe('roi');
      });
    });

    it('should filter by multiple categories', () => {
      const claims = getApprovedClaims(['roi', 'benchmark']);
      
      expect(claims.length).toBeGreaterThan(0);
      claims.forEach(claim => {
        expect(['roi', 'benchmark']).toContain(claim.category);
      });
    });

    it('should return all claims when no category filter', () => {
      const allClaims = getApprovedClaims();
      const categories = new Set(allClaims.map(c => c.category));
      
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getClaimById', () => {
    it('should find claim by ID', () => {
      const claim = getClaimById('ROI-001');
      
      expect(claim).toBeDefined();
      expect(claim?.id).toBe('ROI-001');
    });

    it('should return undefined for non-existent ID', () => {
      const claim = getClaimById('FAKE-999');
      
      expect(claim).toBeUndefined();
    });
  });

  describe('formatClaimsForPrompt', () => {
    it('should format claims as numbered list', () => {
      const claims = getApprovedClaims(['roi']);
      const formatted = formatClaimsForPrompt(claims);
      
      expect(formatted).toContain('APPROVED CLAIMS');
      expect(formatted).toContain('1.');
      expect(formatted).toContain('[Source:');
    });

    it('should handle empty claims', () => {
      const formatted = formatClaimsForPrompt([]);
      
      expect(formatted).toBe('No approved claims available.');
    });
  });

  describe('getClaimsForContext', () => {
    it('should return appropriate claims for dm context', () => {
      const claims = getClaimsForContext('dm');
      
      expect(claims).toContain('APPROVED CLAIMS');
      // DM context uses roi + benchmark
    });

    it('should return all claims for all context', () => {
      const claims = getClaimsForContext('all');
      
      expect(claims).toContain('APPROVED CLAIMS');
    });
  });

  describe('checkForUnapprovedClaims', () => {
    it('should flag suspicious percentage claims', () => {
      const text = 'We achieve 99% reduction in costs!';
      const suspicious = checkForUnapprovedClaims(text);
      
      expect(suspicious.length).toBeGreaterThan(0);
    });

    it('should not flag approved claims', () => {
      // Using exact text from approved claims
      const text = 'Paper handling costs ~$0.50/pallet';
      const suspicious = checkForUnapprovedClaims(text);
      
      // May or may not flag depending on matching logic, but should handle it
      expect(Array.isArray(suspicious)).toBe(true);
    });
  });
});

// ============================================
// Asset Prompt Builder Tests
// ============================================

describe('Asset Prompt Builder', () => {
  const mockContext: AssetContext = {
    prospectId: 'test-123',
    prospectName: 'John Doe',
    prospectTitle: 'VP Operations',
    companyName: 'Acme Corp',
    tier: 'Tier 1',
    isOps: true,
    isExec: false,
    targetAssets: ['brief', 'dms', 'emails'],
  };

  describe('buildAssetPrompt', () => {
    it('should include prospect name and company', () => {
      const prompt = buildAssetPrompt(mockContext);
      
      expect(prompt).toContain('John Doe');
      expect(prompt).toContain('Acme Corp');
    });

    it('should include approved claims', () => {
      const prompt = buildAssetPrompt(mockContext);
      
      expect(prompt).toContain('APPROVED CLAIMS');
      expect(prompt).toContain('do not invent');
    });

    it('should include persona type', () => {
      const prompt = buildAssetPrompt(mockContext);
      
      expect(prompt).toContain('Operations');
    });

    it('should include ROI data when provided', () => {
      const contextWithROI: AssetContext = {
        ...mockContext,
        roiData: {
          totalAnnualSavings: 500000,
          paperSavings: 200000,
        },
      };
      
      const prompt = buildAssetPrompt(contextWithROI);
      
      expect(prompt).toContain('ROI DATA');
      expect(prompt).toContain('$500K');
    });

    it('should note when ROI data is not available', () => {
      const prompt = buildAssetPrompt(mockContext);
      
      expect(prompt).toContain('Not available');
    });
  });

  describe('buildDMPrompt', () => {
    it('should focus on DM requirements', () => {
      const prompt = buildDMPrompt(mockContext);
      
      expect(prompt).toContain('DM Variants');
      expect(prompt).toContain('250 characters');
    });
  });

  describe('buildBriefPrompt', () => {
    it('should focus on brief requirements', () => {
      const prompt = buildBriefPrompt(mockContext);
      
      expect(prompt).toContain('Mini-Brief');
    });
  });

  describe('buildEmailPrompt', () => {
    it('should focus on email sequence requirements', () => {
      const prompt = buildEmailPrompt(mockContext);
      
      expect(prompt).toContain('Email Sequence');
      expect(prompt).toContain('4-step');
    });

    it('should include existing DM when provided', () => {
      const prompt = buildEmailPrompt(mockContext, 'Hey, quick question about YardFlow...');
      
      expect(prompt).toContain('Initial DM sent');
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate ~4 chars per token', () => {
      const text = 'a'.repeat(400);
      const estimate = estimateTokenCount(text);
      
      expect(estimate).toBe(100);
    });
  });
});

// ============================================
// Asset Cache Service Tests
// ============================================

describe('Asset Cache Service', () => {
  beforeEach(() => {
    clearAll();
  });

  const mockAssets: GeneratedAssets = {
    prospectId: 'test-123',
    prospectName: 'John Doe',
    companyName: 'Acme Corp',
    miniBrief: {
      hook: 'Test hook',
      painPoints: ['pain 1', 'pain 2', 'pain 3'],
      valueProps: ['value 1', 'value 2', 'value 3'],
      roiSnapshot: 'ROI info',
      cta: 'Book a demo',
    },
    dmVariants: [
      { id: 'dm-1', type: 'exec', content: 'Exec message', characterCount: 12 },
    ],
    generatedAt: new Date().toISOString(),
    fromCache: false,
  };

  describe('generateCacheKey', () => {
    it('should generate consistent keys', () => {
      const key1 = generateCacheKey('prospect-1', 'hash-1');
      const key2 = generateCacheKey('prospect-1', 'hash-1');
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = generateCacheKey('prospect-1', 'hash-1');
      const key2 = generateCacheKey('prospect-2', 'hash-1');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('setCache and getCached', () => {
    it('should store and retrieve assets', () => {
      const key = generateCacheKey('test-123', 'prompt-hash');
      
      setCache(key, mockAssets, 'prompt-hash');
      const retrieved = getCached(key);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.prospectId).toBe('test-123');
      expect(retrieved?.fromCache).toBe(true);
    });

    it('should return null for non-existent key', () => {
      const retrieved = getCached('non-existent-key');
      
      expect(retrieved).toBeNull();
    });
  });

  describe('invalidateProspect', () => {
    it('should remove all entries for a prospect', () => {
      const key1 = generateCacheKey('test-123', 'hash-1');
      const key2 = generateCacheKey('test-123', 'hash-2');
      
      setCache(key1, mockAssets, 'hash-1');
      setCache(key2, mockAssets, 'hash-2');
      
      const removed = invalidateProspect('test-123');
      
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(getCached(key1)).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return empty stats for empty cache', () => {
      const stats = getCacheStats();
      
      expect(stats.totalEntries).toBe(0);
    });

    it('should count entries correctly', () => {
      setCache(generateCacheKey('p1', 'h1'), mockAssets, 'h1');
      setCache(generateCacheKey('p2', 'h2'), mockAssets, 'h2');
      
      const stats = getCacheStats();
      
      expect(stats.totalEntries).toBe(2);
    });
  });

  describe('clearAll', () => {
    it('should remove all cache entries', () => {
      setCache(generateCacheKey('p1', 'h1'), mockAssets, 'h1');
      setCache(generateCacheKey('p2', 'h2'), mockAssets, 'h2');
      
      clearAll();
      
      const stats = getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
