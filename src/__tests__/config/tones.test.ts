/**
 * Tone Configuration Tests
 * 
 * Sprint 27: F1 - Unit tests for tone configuration
 */

import { describe, it, expect } from 'vitest';
import { TONE_OPTIONS, getTone, DEFAULT_TONE, type ToneId } from '../../config/tones';

describe('Tone Configuration', () => {
  describe('TONE_OPTIONS', () => {
    it('includes all required tones', () => {
      const toneIds = TONE_OPTIONS.map(t => t.id);
      
      expect(toneIds).toContain('luis');
      expect(toneIds).toContain('professional');
      expect(toneIds).toContain('challenger');
    });

    it('luis tone has 250 char limit', () => {
      const luis = TONE_OPTIONS.find(t => t.id === 'luis');
      
      expect(luis).toBeDefined();
      expect(luis?.charLimit).toBe(250);
    });

    it('all tones have required fields', () => {
      for (const tone of TONE_OPTIONS) {
        expect(tone.id).toBeTruthy();
        expect(tone.label).toBeTruthy();
        expect(tone.description).toBeTruthy();
      }
    });
  });

  describe('getTone', () => {
    it('returns tone by id', () => {
      const luis = getTone('luis');
      
      expect(luis?.id).toBe('luis');
      expect(luis?.label).toBe('Luis Style');
    });

    it('returns undefined for unknown tone', () => {
      const unknown = getTone('unknown' as ToneId);
      
      expect(unknown).toBeUndefined();
    });
  });

  describe('DEFAULT_TONE', () => {
    it('is a valid tone id', () => {
      const tone = getTone(DEFAULT_TONE);
      
      expect(tone).toBeDefined();
    });

    it('defaults to professional', () => {
      expect(DEFAULT_TONE).toBe('professional');
    });
  });
});
