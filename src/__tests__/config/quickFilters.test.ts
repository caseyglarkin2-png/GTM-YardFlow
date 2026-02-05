/**
 * Tests for Quick Filter Presets Configuration
 * 
 * Sprint 36C: T36C.1 - Quick filter config tests
 */

import { describe, it, expect } from 'vitest';
import { 
  QUICK_FILTER_PRESETS, 
  getQuickFilterPreset, 
  isPresetActive,
  type QuickFilterPreset 
} from '@/config/quickFilters';

describe('QUICK_FILTER_PRESETS', () => {
  it('has 8 presets', () => {
    expect(QUICK_FILTER_PRESETS).toHaveLength(8);
  });

  it('has unique IDs', () => {
    const ids = QUICK_FILTER_PRESETS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('has required fields on each preset', () => {
    QUICK_FILTER_PRESETS.forEach(preset => {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.emoji).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.filters).toBeDefined();
      expect(preset.color).toBeDefined();
      expect(preset.color.bg).toBeTruthy();
      expect(preset.color.bgActive).toBeTruthy();
      expect(preset.color.text).toBeTruthy();
    });
  });

  it('manifest-2026 has correct tag filter', () => {
    const manifest = QUICK_FILTER_PRESETS.find(p => p.id === 'manifest-2026');
    expect(manifest).toBeDefined();
    expect(manifest?.filters.tags).toContain('Manifest 2026');
  });

  it('t1-ready has tier and email filter', () => {
    const t1Ready = QUICK_FILTER_PRESETS.find(p => p.id === 't1-ready');
    expect(t1Ready).toBeDefined();
    expect(t1Ready?.filters.tiers).toContain('Tier 1');
    expect(t1Ready?.filters.emailStatus).toBe('has_email');
  });

  it('high-value has minFacilities filter', () => {
    const highValue = QUICK_FILTER_PRESETS.find(p => p.id === 'high-value');
    expect(highValue).toBeDefined();
    expect(highValue?.filters.minFacilities).toBe(60);
  });

  it('hot-leads has minScore filter', () => {
    const hotLeads = QUICK_FILTER_PRESETS.find(p => p.id === 'hot-leads');
    expect(hotLeads).toBeDefined();
    expect(hotLeads?.filters.minScore).toBe(70);
  });

  it('gate-issues has hasGateIssue filter', () => {
    const gateIssues = QUICK_FILTER_PRESETS.find(p => p.id === 'gate-issues');
    expect(gateIssues).toBeDefined();
    expect(gateIssues?.filters.hasGateIssue).toBe(true);
  });

  it('needs-email has no_email filter', () => {
    const needsEmail = QUICK_FILTER_PRESETS.find(p => p.id === 'needs-email');
    expect(needsEmail).toBeDefined();
    expect(needsEmail?.filters.emailStatus).toBe('no_email');
  });

  it('needs-research has hasAIResearch false', () => {
    const needsResearch = QUICK_FILTER_PRESETS.find(p => p.id === 'needs-research');
    expect(needsResearch).toBeDefined();
    expect(needsResearch?.filters.hasAIResearch).toBe(false);
  });

  it('t1-t2 has multiple tiers', () => {
    const t1t2 = QUICK_FILTER_PRESETS.find(p => p.id === 't1-t2');
    expect(t1t2).toBeDefined();
    expect(t1t2?.filters.tiers).toContain('Tier 1');
    expect(t1t2?.filters.tiers).toContain('Tier 2');
  });

  it('uses Railway tier format (Tier 1, not T1)', () => {
    QUICK_FILTER_PRESETS.forEach(preset => {
      if (preset.filters.tiers) {
        preset.filters.tiers.forEach(tier => {
          expect(tier).toMatch(/^Tier \d$/);
        });
      }
    });
  });
});

describe('getQuickFilterPreset', () => {
  it('returns preset by ID', () => {
    const preset = getQuickFilterPreset('manifest-2026');
    expect(preset?.id).toBe('manifest-2026');
    expect(preset?.label).toBe('Manifest 2026');
  });

  it('returns undefined for unknown ID', () => {
    const preset = getQuickFilterPreset('unknown-id');
    expect(preset).toBeUndefined();
  });
});

describe('isPresetActive', () => {
  const manifestPreset: QuickFilterPreset = {
    id: 'manifest-2026',
    label: 'Manifest 2026',
    emoji: '🎯',
    description: 'Conference attendees',
    filters: { tags: ['Manifest 2026'] },
    color: { bg: 'bg-purple-100', bgActive: 'bg-purple-600', text: 'text-purple-700' },
  };

  const t1ReadyPreset: QuickFilterPreset = {
    id: 't1-ready',
    label: 'T1 Ready',
    emoji: '⭐',
    description: 'Tier 1 with email',
    filters: { tiers: ['Tier 1'], emailStatus: 'has_email' },
    color: { bg: 'bg-amber-100', bgActive: 'bg-amber-600', text: 'text-amber-700' },
  };

  const highValuePreset: QuickFilterPreset = {
    id: 'high-value',
    label: 'High Value',
    emoji: '💰',
    description: '60+ facilities',
    filters: { minFacilities: 60 },
    color: { bg: 'bg-green-100', bgActive: 'bg-green-600', text: 'text-green-700' },
  };

  it('returns true when tag filter matches', () => {
    const result = isPresetActive(manifestPreset, { tagFilter: 'Manifest 2026' });
    expect(result).toBe(true);
  });

  it('returns false when tag filter does not match', () => {
    const result = isPresetActive(manifestPreset, { tagFilter: 'Other Tag' });
    expect(result).toBe(false);
  });

  it('returns true when tier and email match', () => {
    const result = isPresetActive(t1ReadyPreset, { 
      tierFilter: 'Tier 1', 
      emailFilter: 'has_email' 
    });
    expect(result).toBe(true);
  });

  it('returns false when tier matches but email does not', () => {
    const result = isPresetActive(t1ReadyPreset, { 
      tierFilter: 'Tier 1', 
      emailFilter: 'all' 
    });
    expect(result).toBe(false);
  });

  it('returns true when minFacilities matches', () => {
    const result = isPresetActive(highValuePreset, { minFacilities: 60 });
    expect(result).toBe(true);
  });

  it('returns false when minFacilities does not match', () => {
    const result = isPresetActive(highValuePreset, { minFacilities: 30 });
    expect(result).toBe(false);
  });

  it('handles empty filter state', () => {
    const result = isPresetActive(highValuePreset, {});
    expect(result).toBe(false);
  });
});
