/**
 * Sender Configuration Tests
 * 
 * Sprint 38B: Tests for sender identity configuration
 */

import { describe, it, expect } from 'vitest';
import {
  SENDER_IDENTITIES,
  getSender,
  getDefaultSender,
  getSenderName,
  getSenderEmail,
  interpolateSender,
} from '../../config/senders';

describe('Sender Configuration', () => {
  describe('SENDER_IDENTITIES', () => {
    it('includes verified senders', () => {
      const senderIds = SENDER_IDENTITIES.map(s => s.id);
      
      // Currently only jake@freightroll.com is verified in SendGrid
      expect(senderIds).toContain('jake');
      expect(SENDER_IDENTITIES.length).toBeGreaterThanOrEqual(1);
    });

    it('all senders have freightroll.com email', () => {
      for (const sender of SENDER_IDENTITIES) {
        expect(sender.email).toMatch(/@freightroll\.com$/);
      }
    });

    it('all senders have required fields', () => {
      for (const sender of SENDER_IDENTITIES) {
        expect(sender.id).toBeTruthy();
        expect(sender.name).toBeTruthy();
        expect(sender.email).toBeTruthy();
        expect(sender.signOff).toBeTruthy();
      }
    });

    it('has exactly one default sender', () => {
      const defaults = SENDER_IDENTITIES.filter(s => s.isDefault);
      expect(defaults.length).toBe(1);
    });
  });

  describe('getSender', () => {
    it('returns sender by id', () => {
      const jake = getSender('jake');
      
      expect(jake?.id).toBe('jake');
      expect(jake?.name).toBe('Jake');
      expect(jake?.email).toBe('jake@freightroll.com');
    });

    it('returns undefined for unknown sender', () => {
      const unknown = getSender('unknown');
      
      expect(unknown).toBeUndefined();
    });
  });

  describe('getDefaultSender', () => {
    it('returns the default sender (Jake)', () => {
      const defaultSender = getDefaultSender();
      
      expect(defaultSender.id).toBe('jake');
      expect(defaultSender.isDefault).toBe(true);
    });
  });

  describe('getSenderName', () => {
    it('returns sender name for valid id', () => {
      expect(getSenderName('jake')).toBe('Jake');
    });

    it('returns default sender name when no id provided', () => {
      expect(getSenderName()).toBe('Jake');
    });

    it('returns fallback for unknown sender', () => {
      expect(getSenderName('unknown')).toBe('The FreightRoll Team');
    });
  });

  describe('getSenderEmail', () => {
    it('returns sender email for valid id', () => {
      expect(getSenderEmail('jake')).toBe('jake@freightroll.com');
    });

    it('returns default sender email when no id provided', () => {
      expect(getSenderEmail()).toBe('jake@freightroll.com');
    });
  });

  describe('interpolateSender', () => {
    it('replaces {{senderName}} with sender name', () => {
      const template = 'Best,\n{{senderName}}';
      
      expect(interpolateSender(template, 'jake')).toBe('Best,\nJake');
    });

    it('replaces multiple occurrences', () => {
      const template = 'Hi, I am {{senderName}}. Contact {{senderName}} for help.';
      
      expect(interpolateSender(template, 'jake')).toBe('Hi, I am Jake. Contact Jake for help.');
    });

    it('handles {senderName} variant (single braces)', () => {
      const template = 'Best,\n{senderName}';
      
      expect(interpolateSender(template, 'jake')).toBe('Best,\nJake');
    });

    it('handles {{sender_name}} variant (underscore)', () => {
      const template = 'Best,\n{{sender_name}}';
      
      // Falls back to default (Jake) or "The FreightRoll Team" for unknown
      expect(interpolateSender(template, 'jake')).toBe('Best,\nJake');
    });

    it('uses default sender when no id provided', () => {
      const template = 'Best,\n{{senderName}}';
      
      expect(interpolateSender(template)).toBe('Best,\nJake');
    });
  });
});
