/**
 * Template Adapter Tests
 * 
 * Sprint 27 T4.8: Tests for schema alignment between GTM and Railway
 */

import { describe, it, expect } from 'vitest';
import {
  toRailwayTone,
  toGtmTone,
  toRailwayChannel,
  toGtmCategory,
  toGtmTemplate,
  toGtmTemplates,
  toRailwayCreateRequest,
  toRailwayUpdateRequest,
  isValidRailwayTone,
  isValidRailwayChannel,
  normalizeToRailwayTone,
  type RailwayTemplateRecord,
} from '@/utils/templateAdapter';
import type { CreateTemplateRequest, UpdateTemplateRequest } from '@/types/railway';

describe('templateAdapter', () => {
  describe('toRailwayTone', () => {
    it('converts lowercase GTM tones to uppercase Railway tones', () => {
      expect(toRailwayTone('freightroll')).toBe('FREIGHTROLL');
      expect(toRailwayTone('professional')).toBe('PROFESSIONAL');
      expect(toRailwayTone('challenger')).toBe('CHALLENGER');
    });

    it('maps unsupported tones to PROFESSIONAL', () => {
      expect(toRailwayTone('casual')).toBe('PROFESSIONAL');
      expect(toRailwayTone('friendly')).toBe('PROFESSIONAL');
      expect(toRailwayTone('formal')).toBe('PROFESSIONAL');
    });

    it('returns undefined for undefined input', () => {
      expect(toRailwayTone(undefined)).toBeUndefined();
    });
  });

  describe('toGtmTone', () => {
    it('converts uppercase Railway tones to lowercase GTM tones', () => {
      expect(toGtmTone('FREIGHTROLL')).toBe('freightroll');
      expect(toGtmTone('PROFESSIONAL')).toBe('professional');
      expect(toGtmTone('CHALLENGER')).toBe('challenger');
    });

    it('handles mixed case input', () => {
      expect(toGtmTone('Freightroll')).toBe('freightroll');
      expect(toGtmTone('Professional')).toBe('professional');
    });

    it('returns undefined for undefined input', () => {
      expect(toGtmTone(undefined)).toBeUndefined();
    });

    it('defaults unknown tones to professional', () => {
      expect(toGtmTone('UNKNOWN')).toBe('professional');
    });
  });

  describe('toRailwayChannel', () => {
    it('always returns EMAIL for email templates', () => {
      expect(toRailwayChannel('intro')).toBe('EMAIL');
      expect(toRailwayChannel('followup')).toBe('EMAIL');
      expect(toRailwayChannel('custom')).toBe('EMAIL');
    });

    it('handles undefined input', () => {
      expect(toRailwayChannel(undefined)).toBe('EMAIL');
    });
  });

  describe('toGtmCategory', () => {
    it('returns custom for all Railway channels', () => {
      expect(toGtmCategory('EMAIL')).toBe('custom');
      expect(toGtmCategory('LINKEDIN')).toBe('custom');
      expect(toGtmCategory('PHONE')).toBe('custom');
    });

    it('handles undefined input', () => {
      expect(toGtmCategory(undefined)).toBe('custom');
    });
  });

  describe('toGtmTemplate', () => {
    it('converts Railway template to GTM format', () => {
      const railwayTemplate: RailwayTemplateRecord = {
        id: 'template-123',
        name: 'Follow Up',
        channel: 'EMAIL',
        tone: 'FREIGHTROLL',
        subject: 'Quick follow up',
        template: 'Hi {first_name}, just following up...',
        isActive: true,
        isDefault: false,
        createdAt: '2026-02-03T10:00:00Z',
        updatedAt: '2026-02-03T10:00:00Z',
      };

      const gtmTemplate = toGtmTemplate(railwayTemplate);

      expect(gtmTemplate).toEqual({
        id: 'template-123',
        name: 'Follow Up',
        subject: 'Quick follow up',
        body: 'Hi {first_name}, just following up...', // Railway 'template' → GTM 'body'
        category: 'custom',
        tone: 'freightroll', // Uppercase → lowercase
        isDefault: false,
        isActive: true,
        createdAt: '2026-02-03T10:00:00Z',
        updatedAt: '2026-02-03T10:00:00Z',
      });
    });

    it('handles missing optional fields', () => {
      const railwayTemplate: RailwayTemplateRecord = {
        id: 'template-456',
        name: 'Simple',
        channel: 'EMAIL',
        template: 'Hello!',
      };

      const gtmTemplate = toGtmTemplate(railwayTemplate);

      expect(gtmTemplate.id).toBe('template-456');
      expect(gtmTemplate.subject).toBe('');
      expect(gtmTemplate.tone).toBeUndefined();
      expect(gtmTemplate.isDefault).toBeUndefined();
    });
  });

  describe('toGtmTemplates', () => {
    it('converts array of Railway templates', () => {
      const railwayTemplates: RailwayTemplateRecord[] = [
        { id: '1', name: 'Template 1', channel: 'EMAIL', template: 'Body 1' },
        { id: '2', name: 'Template 2', channel: 'EMAIL', template: 'Body 2' },
      ];

      const gtmTemplates = toGtmTemplates(railwayTemplates);

      expect(gtmTemplates).toHaveLength(2);
      expect(gtmTemplates[0].id).toBe('1');
      expect(gtmTemplates[0].body).toBe('Body 1');
      expect(gtmTemplates[1].id).toBe('2');
      expect(gtmTemplates[1].body).toBe('Body 2');
    });

    it('handles empty array', () => {
      expect(toGtmTemplates([])).toEqual([]);
    });
  });

  describe('toRailwayCreateRequest', () => {
    it('converts GTM create request to Railway format', () => {
      const gtmRequest: CreateTemplateRequest = {
        name: 'New Template',
        subject: 'Subject line',
        body: 'Email body content',
        category: 'intro',
        tone: 'freightroll',
      };

      const railwayRequest = toRailwayCreateRequest(gtmRequest);

      expect(railwayRequest).toEqual({
        name: 'New Template',
        channel: 'EMAIL',
        tone: 'FREIGHTROLL',
        subject: 'Subject line',
        template: 'Email body content', // GTM 'body' → Railway 'template'
        isActive: true,
      });
    });

    it('handles missing optional fields', () => {
      const gtmRequest: CreateTemplateRequest = {
        name: 'Basic',
        subject: 'Hi',
        body: 'Hello',
        category: 'custom',
      };

      const railwayRequest = toRailwayCreateRequest(gtmRequest);

      expect(railwayRequest.tone).toBeUndefined();
      expect(railwayRequest.channel).toBe('EMAIL');
    });
  });

  describe('toRailwayUpdateRequest', () => {
    it('converts GTM update request to Railway format', () => {
      const gtmRequest: UpdateTemplateRequest = {
        name: 'Updated Name',
        body: 'Updated body',
        tone: 'challenger',
      };

      const railwayRequest = toRailwayUpdateRequest(gtmRequest);

      expect(railwayRequest).toEqual({
        name: 'Updated Name',
        template: 'Updated body',
        tone: 'CHALLENGER',
      });
    });

    it('only includes defined fields', () => {
      const gtmRequest: UpdateTemplateRequest = {
        name: 'Only Name',
      };

      const railwayRequest = toRailwayUpdateRequest(gtmRequest);

      expect(railwayRequest).toEqual({ name: 'Only Name' });
      expect(railwayRequest).not.toHaveProperty('template');
      expect(railwayRequest).not.toHaveProperty('tone');
      expect(railwayRequest).not.toHaveProperty('channel');
    });

    it('handles empty update', () => {
      const railwayRequest = toRailwayUpdateRequest({});
      expect(railwayRequest).toEqual({});
    });
  });

  describe('isValidRailwayTone', () => {
    it('returns true for valid Railway tones', () => {
      expect(isValidRailwayTone('FREIGHTROLL')).toBe(true);
      expect(isValidRailwayTone('PROFESSIONAL')).toBe(true);
      expect(isValidRailwayTone('CHALLENGER')).toBe(true);
    });

    it('returns false for invalid tones', () => {
      expect(isValidRailwayTone('freightroll')).toBe(false);
      expect(isValidRailwayTone('CASUAL')).toBe(false);
      expect(isValidRailwayTone('invalid')).toBe(false);
    });
  });

  describe('isValidRailwayChannel', () => {
    it('returns true for valid Railway channels', () => {
      expect(isValidRailwayChannel('EMAIL')).toBe(true);
      expect(isValidRailwayChannel('LINKEDIN')).toBe(true);
      expect(isValidRailwayChannel('PHONE')).toBe(true);
    });

    it('returns false for invalid channels', () => {
      expect(isValidRailwayChannel('email')).toBe(false);
      expect(isValidRailwayChannel('SMS')).toBe(false);
      expect(isValidRailwayChannel('invalid')).toBe(false);
    });
  });

  describe('normalizeToRailwayTone', () => {
    it('handles uppercase input', () => {
      expect(normalizeToRailwayTone('FREIGHTROLL')).toBe('FREIGHTROLL');
      expect(normalizeToRailwayTone('PROFESSIONAL')).toBe('PROFESSIONAL');
    });

    it('handles lowercase input', () => {
      expect(normalizeToRailwayTone('freightroll')).toBe('FREIGHTROLL');
      expect(normalizeToRailwayTone('professional')).toBe('PROFESSIONAL');
    });

    it('handles mixed case input', () => {
      expect(normalizeToRailwayTone('Freightroll')).toBe('FREIGHTROLL');
      expect(normalizeToRailwayTone('Professional')).toBe('PROFESSIONAL');
    });

    it('returns undefined for undefined input', () => {
      expect(normalizeToRailwayTone(undefined)).toBeUndefined();
    });
  });
});
