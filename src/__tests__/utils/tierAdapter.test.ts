/**
 * Tier Adapter Tests
 * 
 * Sprint 902: Type Safety Layer - T902.2
 */

import { describe, it, expect } from 'vitest';
import {
  toRailwayTier,
  toFirestoreTier,
  isFirestoreTier,
  isRailwayTier,
  normalizeToFirestoreTier,
  normalizeToRailwayTier,
  getTierPriority,
  compareTiers,
  type FirestoreTier,
  type RailwayTier,
} from '../../utils/tierAdapter';

describe('Tier Adapter', () => {
  describe('toRailwayTier', () => {
    it.each([
      ['T1', 'Tier 1'],
      ['T2', 'Tier 2'],
      ['T3', 'Tier 3'],
      ['T4', 'Tier 4'],
    ] as [FirestoreTier, RailwayTier][])('converts %s to %s', (input, expected) => {
      expect(toRailwayTier(input)).toBe(expected);
    });

    it('throws on invalid tier', () => {
      expect(() => toRailwayTier('T5' as FirestoreTier)).toThrow('Invalid Firestore tier');
    });
  });

  describe('toFirestoreTier', () => {
    it.each([
      ['Tier 1', 'T1'],
      ['Tier 2', 'T2'],
      ['Tier 3', 'T3'],
      ['Tier 4', 'T4'],
    ] as [RailwayTier, FirestoreTier][])('converts %s to %s', (input, expected) => {
      expect(toFirestoreTier(input)).toBe(expected);
    });

    it('throws on invalid tier', () => {
      expect(() => toFirestoreTier('Tier 5' as RailwayTier)).toThrow('Invalid Railway tier');
    });
  });

  describe('isFirestoreTier', () => {
    it.each(['T1', 'T2', 'T3', 'T4'])('returns true for %s', (tier) => {
      expect(isFirestoreTier(tier)).toBe(true);
    });

    it.each(['Tier 1', 'Tier 2', 't1', 'tier1', 'invalid'])('returns false for %s', (tier) => {
      expect(isFirestoreTier(tier)).toBe(false);
    });
  });

  describe('isRailwayTier', () => {
    it.each(['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'])('returns true for %s', (tier) => {
      expect(isRailwayTier(tier)).toBe(true);
    });

    it.each(['T1', 'T2', 'tier 1', 'Tier1', 'invalid'])('returns false for %s', (tier) => {
      expect(isRailwayTier(tier)).toBe(false);
    });
  });

  describe('normalizeToFirestoreTier', () => {
    it('passes through Firestore format unchanged', () => {
      expect(normalizeToFirestoreTier('T1')).toBe('T1');
      expect(normalizeToFirestoreTier('T3')).toBe('T3');
    });

    it('converts Railway format to Firestore', () => {
      expect(normalizeToFirestoreTier('Tier 1')).toBe('T1');
      expect(normalizeToFirestoreTier('Tier 4')).toBe('T4');
    });

    it('throws on invalid format', () => {
      expect(() => normalizeToFirestoreTier('invalid' as FirestoreTier)).toThrow();
    });
  });

  describe('normalizeToRailwayTier', () => {
    it('passes through Railway format unchanged', () => {
      expect(normalizeToRailwayTier('Tier 1')).toBe('Tier 1');
      expect(normalizeToRailwayTier('Tier 3')).toBe('Tier 3');
    });

    it('converts Firestore format to Railway', () => {
      expect(normalizeToRailwayTier('T1')).toBe('Tier 1');
      expect(normalizeToRailwayTier('T4')).toBe('Tier 4');
    });

    it('throws on invalid format', () => {
      expect(() => normalizeToRailwayTier('invalid' as RailwayTier)).toThrow();
    });
  });

  describe('getTierPriority', () => {
    it.each([
      ['T1', 1],
      ['T2', 2],
      ['T3', 3],
      ['T4', 4],
      ['Tier 1', 1],
      ['Tier 2', 2],
      ['Tier 3', 3],
      ['Tier 4', 4],
    ])('returns correct priority for %s', (tier, expected) => {
      expect(getTierPriority(tier as FirestoreTier)).toBe(expected);
    });
  });

  describe('compareTiers', () => {
    it('returns negative when first tier is higher priority', () => {
      expect(compareTiers('T1', 'T2')).toBeLessThan(0);
      expect(compareTiers('Tier 1', 'Tier 4')).toBeLessThan(0);
    });

    it('returns positive when first tier is lower priority', () => {
      expect(compareTiers('T3', 'T1')).toBeGreaterThan(0);
      expect(compareTiers('Tier 4', 'Tier 2')).toBeGreaterThan(0);
    });

    it('returns 0 for equal tiers', () => {
      expect(compareTiers('T2', 'T2')).toBe(0);
      expect(compareTiers('Tier 1', 'T1')).toBe(0); // Cross-format comparison
    });

    it('handles cross-format comparisons', () => {
      expect(compareTiers('T1', 'Tier 2')).toBeLessThan(0);
      expect(compareTiers('Tier 3', 'T1')).toBeGreaterThan(0);
    });
  });
});
