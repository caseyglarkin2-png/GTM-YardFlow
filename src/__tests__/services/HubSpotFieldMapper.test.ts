/**
 * HubSpot Field Mapper Tests
 * Sprint 26 - T26.4
 */

import { describe, it, expect } from 'vitest';
import { createFieldMapper, type ProspectFields } from '../../services/HubSpotFieldMapper';
import type { HubSpotContact } from '../../types/hubspot';

describe('HubSpot Field Mapper - T26.4', () => {
  const mapper = createFieldMapper();

  describe('Name Splitting', () => {
    it('should split simple two-part name', () => {
      const result = mapper.splitName('John Doe');
      expect(result).toEqual({ first: 'John', last: 'Doe' });
    });

    it('should split multi-part name (last word is last name)', () => {
      const result = mapper.splitName('Mary Jane Watson');
      expect(result).toEqual({ first: 'Mary Jane', last: 'Watson' });
    });

    it('should handle single name', () => {
      const result = mapper.splitName('Madonna');
      expect(result).toEqual({ first: 'Madonna', last: '' });
    });

    it('should handle empty name', () => {
      const result = mapper.splitName('');
      expect(result).toEqual({ first: '', last: '' });
    });

    it('should trim whitespace', () => {
      const result = mapper.splitName('  John   Doe  ');
      expect(result).toEqual({ first: 'John', last: 'Doe' });
    });

    it('should handle complex name with multiple spaces', () => {
      const result = mapper.splitName('Jean-Pierre   De La Fontaine');
      expect(result).toEqual({ first: 'Jean-Pierre De La', last: 'Fontaine' });
    });
  });

  describe('Name Joining', () => {
    it('should join first and last name', () => {
      const result = mapper.joinName('John', 'Doe');
      expect(result).toBe('John Doe');
    });

    it('should handle missing last name', () => {
      const result = mapper.joinName('Madonna', undefined);
      expect(result).toBe('Madonna');
    });

    it('should handle missing first name', () => {
      const result = mapper.joinName(undefined, 'Cher');
      expect(result).toBe('Cher');
    });

    it('should handle both empty', () => {
      const result = mapper.joinName(undefined, undefined);
      expect(result).toBe('');
    });
  });

  describe('Phone E.164 Conversion', () => {
    it('should add +1 to 10-digit US numbers', () => {
      const result = mapper.toE164('5551234567');
      expect(result).toBe('+15551234567');
    });

    it('should handle number with country code', () => {
      const result = mapper.toE164('15551234567');
      expect(result).toBe('+15551234567');
    });

    it('should strip formatting', () => {
      const result = mapper.toE164('(555) 123-4567');
      expect(result).toBe('+15551234567');
    });

    it('should handle international format', () => {
      const result = mapper.toE164('+44 20 7946 0958');
      expect(result).toBe('+442079460958');
    });

    it('should return original for unparseable', () => {
      const result = mapper.toE164('ext 123');
      expect(result).toBe('ext 123');
    });
  });

  describe('LinkedIn ID Extraction', () => {
    it('should extract ID from /in/ URL', () => {
      const result = mapper.extractLinkedInId('https://www.linkedin.com/in/johndoe');
      expect(result).toBe('johndoe');
    });

    it('should extract ID from /pub/ URL', () => {
      const result = mapper.extractLinkedInId('https://linkedin.com/pub/jane-doe/12/345/678');
      expect(result).toBe('jane-doe');
    });

    it('should handle URL with query params', () => {
      const result = mapper.extractLinkedInId('https://linkedin.com/in/johndoe?trk=nav');
      expect(result).toBe('johndoe');
    });

    it('should return original if not a LinkedIn URL', () => {
      const result = mapper.extractLinkedInId('johndoe');
      expect(result).toBe('johndoe');
    });

    it('should handle empty', () => {
      const result = mapper.extractLinkedInId('');
      expect(result).toBe('');
    });
  });

  describe('Status Mapping', () => {
    it('should map YardFlow status to HubSpot', () => {
      expect(mapper.mapStatus('new', true)).toBe('NEW');
      expect(mapper.mapStatus('qualified', true)).toBe('OPEN_DEAL');
      expect(mapper.mapStatus('converted', true)).toBe('CUSTOMER');
    });

    it('should map HubSpot status to YardFlow', () => {
      expect(mapper.mapStatus('NEW', false)).toBe('new');
      expect(mapper.mapStatus('OPEN_DEAL', false)).toBe('qualified');
      expect(mapper.mapStatus('CUSTOMER', false)).toBe('converted');
    });

    it('should pass through unknown status', () => {
      expect(mapper.mapStatus('CUSTOM_STATUS', true)).toBe('CUSTOM_STATUS');
    });
  });

  describe('Prospect to HubSpot Conversion', () => {
    it('should map all basic fields', () => {
      const prospect: ProspectFields = {
        id: 'yf-123',
        name: 'John Doe',
        email: 'John.Doe@Example.com',
        company: 'Acme Corp',
        title: 'CEO',
        phone: '5551234567',
        status: 'qualified',
      };

      const result = mapper.prospectToHubSpot(prospect);

      expect(result.properties.firstname).toBe('John');
      expect(result.properties.lastname).toBe('Doe');
      expect(result.properties.email).toBe('john.doe@example.com');
      expect(result.properties.company).toBe('Acme Corp');
      expect(result.properties.jobtitle).toBe('CEO');
      expect(result.properties.phone).toBe('+15551234567');
      expect(result.properties.hs_lead_status).toBe('OPEN_DEAL');
      expect(result.properties.yardflow_id).toBe('yf-123');
    });

    it('should skip null/undefined values', () => {
      const prospect: ProspectFields = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        company: undefined,
        phone: null as unknown as string,
      };

      const result = mapper.prospectToHubSpot(prospect);

      expect(result.properties.company).toBeUndefined();
      expect(result.properties.phone).toBeUndefined();
      expect(result.skipped).toContain('company');
      expect(result.skipped).toContain('phone');
    });

    it('should handle LinkedIn URL', () => {
      const prospect: ProspectFields = {
        name: 'John Doe',
        email: 'john@example.com',
        linkedinUrl: 'https://linkedin.com/in/johndoe?trk=nav',
      };

      const result = mapper.prospectToHubSpot(prospect);

      expect(result.properties.hs_linkedinid).toBe('johndoe');
    });

    it('should handle tags array', () => {
      const prospect: ProspectFields = {
        name: 'John Doe',
        email: 'john@example.com',
        tags: ['vip', 'enterprise', 'demo-requested'],
      };

      const result = mapper.prospectToHubSpot(prospect);

      expect(result.properties.yardflow_tags).toBe('vip;enterprise;demo-requested');
    });
  });

  describe('HubSpot to Prospect Conversion', () => {
    it('should map all basic fields', () => {
      const contact: HubSpotContact = {
        id: 'hs-456',
        properties: {
          firstname: 'Jane',
          lastname: 'Smith',
          email: 'jane@example.com',
          company: 'Tech Inc',
          jobtitle: 'CTO',
          phone: '+15559876543',
          hs_lead_status: 'CUSTOMER',
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      };

      const result = mapper.hubSpotToProspect(contact);

      expect(result.properties.name).toBe('Jane Smith');
      expect(result.properties.email).toBe('jane@example.com');
      expect(result.properties.company).toBe('Tech Inc');
      expect(result.properties.title).toBe('CTO');
      expect(result.properties.status).toBe('converted');
      expect(result.properties.hubspotId).toBe('hs-456');
    });

    it('should join first and last name correctly', () => {
      const contact: HubSpotContact = {
        id: 'hs-789',
        properties: {
          firstname: 'Mary Jane',
          lastname: 'Watson',
          email: 'mj@example.com',
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      };

      const result = mapper.hubSpotToProspect(contact);

      expect(result.properties.name).toBe('Mary Jane Watson');
    });

    it('should handle tags semicolon-separated', () => {
      const contact: HubSpotContact = {
        id: 'hs-123',
        properties: {
          firstname: 'Test',
          lastname: 'User',
          email: 'test@example.com',
          yardflow_tags: 'vip;enterprise;demo',
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      };

      const result = mapper.hubSpotToProspect(contact);

      expect(result.properties.tags).toEqual(['vip', 'enterprise', 'demo']);
    });
  });

  describe('Validation', () => {
    it('should detect missing required fields', () => {
      const prospect: ProspectFields = {
        company: 'Acme',
      };

      const result = mapper.validateProspectForSync(prospect);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('name');
      expect(result.missing).toContain('email');
    });

    it('should pass with all required fields', () => {
      const prospect: ProspectFields = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = mapper.validateProspectForSync(prospect);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });

  describe('Transform Application', () => {
    it('should apply lowercase transform', () => {
      const result = mapper.applyTransform('HELLO@EXAMPLE.COM', 'lowercase', undefined, true);
      expect(result).toBe('hello@example.com');
    });

    it('should apply uppercase transform', () => {
      const result = mapper.applyTransform('hello', 'uppercase', undefined, true);
      expect(result).toBe('HELLO');
    });

    it('should apply number transform', () => {
      const result = mapper.applyTransform(42, 'number', undefined, true);
      expect(result).toBe('42');
    });

    it('should reverse number transform', () => {
      const result = mapper.applyTransform('42.5', 'number', undefined, false);
      expect(result).toBe(42.5);
    });

    it('should apply boolean transform', () => {
      const result = mapper.applyTransform(true, 'boolean', undefined, true);
      expect(result).toBe('true');
    });

    it('should reverse boolean transform', () => {
      const result = mapper.applyTransform('true', 'boolean', undefined, false);
      expect(result).toBe(true);
    });

    it('should handle null gracefully', () => {
      const result = mapper.applyTransform(null, 'lowercase', undefined, true);
      expect(result).toBeNull();
    });
  });
});
