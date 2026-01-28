/**
 * Firestore Types Tests
 * Sprint 27 - T27.1
 */

import { describe, it, expect } from 'vitest';
import {
  ProspectSchema,
  CompanySchema,
  ActivitySchema,
  SequenceEnrollmentSchema,
  TenantSchema,
  TenantUserSchema,
  PresenceSchema,
  OfflineOperationSchema,
} from '../../types/firestore';

describe('Firestore Types - T27.1', () => {
  describe('ProspectSchema', () => {
    it('should validate complete prospect', () => {
      const prospect = {
        id: 'p-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+15551234567',
        company: 'Acme Corp',
        title: 'VP Sales',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        tier: 'T1',
        persona: 'Decision Maker',
        status: 'qualified',
        score: 85,
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        source: 'Conference',
        assigneeId: 'user-123',
        tags: ['vip', 'manifest-2026'],
        hubspotId: 'hs-456',
        estimatedDealValue: 50000,
        createdAt: '2026-01-28T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
        createdBy: 'user-123',
        syncVersion: 1,
      };

      const result = ProspectSchema.safeParse(prospect);
      expect(result.success).toBe(true);
    });

    it('should validate minimal prospect', () => {
      const prospect = {
        id: 'p-456',
        name: 'Jane Doe',
        createdAt: '2026-01-28T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      const result = ProspectSchema.safeParse(prospect);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('new');
        expect(result.data.score).toBe(0);
        expect(result.data.tags).toEqual([]);
      }
    });

    it('should reject invalid email', () => {
      const prospect = {
        id: 'p-789',
        name: 'Bad Email',
        email: 'not-an-email',
        createdAt: '2026-01-28T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      const result = ProspectSchema.safeParse(prospect);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tier', () => {
      const prospect = {
        id: 'p-999',
        name: 'Bad Tier',
        tier: 'T4', // Invalid
        createdAt: '2026-01-28T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      const result = ProspectSchema.safeParse(prospect);
      expect(result.success).toBe(false);
    });

    it('should validate Firestore timestamp format', () => {
      const prospect = {
        id: 'p-ts',
        name: 'Timestamp Test',
        createdAt: { seconds: 1738022400, nanoseconds: 0 },
        updatedAt: { seconds: 1738022400, nanoseconds: 0 },
      };

      const result = ProspectSchema.safeParse(prospect);
      expect(result.success).toBe(true);
    });
  });

  describe('CompanySchema', () => {
    it('should validate company', () => {
      const company = {
        id: 'c-123',
        name: 'Acme Corp',
        domain: 'acme.com',
        website: 'https://acme.com',
        industry: 'Technology',
        size: '51-200',
        type: 'prospect',
        prospectIds: ['p-1', 'p-2'],
        createdAt: '2026-01-28T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      const result = CompanySchema.safeParse(company);
      expect(result.success).toBe(true);
    });
  });

  describe('ActivitySchema', () => {
    it('should validate activity', () => {
      const activity = {
        id: 'a-123',
        type: 'email_sent',
        prospectId: 'p-123',
        subject: 'Follow up',
        body: 'Thanks for the call',
        userId: 'user-123',
        userName: 'John Sales',
        timestamp: '2026-01-28T10:00:00Z',
        createdAt: '2026-01-28T10:00:00Z',
      };

      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });

    it('should validate status change activity', () => {
      const activity = {
        id: 'a-456',
        type: 'status_changed',
        prospectId: 'p-123',
        previousValue: 'new',
        newValue: 'qualified',
        userId: 'user-123',
        timestamp: '2026-01-28T10:00:00Z',
        createdAt: '2026-01-28T10:00:00Z',
      };

      const result = ActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });
  });

  describe('SequenceEnrollmentSchema', () => {
    it('should validate sequence enrollment', () => {
      const enrollment = {
        id: 'se-123',
        sequenceId: 'seq-1',
        sequenceName: 'Outbound v2',
        prospectId: 'p-123',
        status: 'active',
        currentStep: 2,
        totalSteps: 5,
        steps: [
          {
            id: 'step-1',
            stepNumber: 1,
            templateId: 'tpl-1',
            sentAt: '2026-01-27T10:00:00Z',
            status: 'sent',
            openCount: 1,
            clickCount: 0,
          },
          {
            id: 'step-2',
            stepNumber: 2,
            templateId: 'tpl-2',
            scheduledAt: '2026-01-29T10:00:00Z',
            status: 'scheduled',
            openCount: 0,
            clickCount: 0,
          },
        ],
        openRate: 50,
        clickRate: 0,
        startedAt: '2026-01-27T10:00:00Z',
        createdBy: 'user-123',
        createdAt: '2026-01-27T09:00:00Z',
        updatedAt: '2026-01-28T10:00:00Z',
      };

      const result = SequenceEnrollmentSchema.safeParse(enrollment);
      expect(result.success).toBe(true);
    });
  });

  describe('TenantSchema', () => {
    it('should validate tenant with defaults', () => {
      const tenant = {
        id: 't-123',
        name: 'Acme Corp',
        slug: 'acme-corp',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      const result = TenantSchema.safeParse(tenant);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.settings.defaultTimezone).toBe('America/New_York');
        expect(result.data.limits.maxProspects).toBe(10000);
      }
    });

    it('should validate tenant with custom settings', () => {
      const tenant = {
        id: 't-456',
        name: 'Euro Corp',
        slug: 'euro-corp',
        settings: {
          defaultTimezone: 'Europe/London',
          dateFormat: 'DD/MM/YYYY',
          currency: 'EUR',
          language: 'en',
        },
        integrations: {
          hubspot: {
            connected: true,
            portalId: '12345',
            lastSyncAt: '2026-01-28T00:00:00Z',
          },
          salesforce: {},
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      const result = TenantSchema.safeParse(tenant);
      expect(result.success).toBe(true);
    });
  });

  describe('TenantUserSchema', () => {
    it('should validate tenant user', () => {
      const user = {
        id: 'tu-123',
        userId: 'uid-456',
        email: 'john@acme.com',
        displayName: 'John Doe',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-28T00:00:00Z',
      };

      const result = TenantUserSchema.safeParse(user);
      expect(result.success).toBe(true);
    });
  });

  describe('PresenceSchema', () => {
    it('should validate presence', () => {
      const presence = {
        id: 'pr-123',
        userId: 'uid-456',
        displayName: 'John Doe',
        status: 'online',
        lastHeartbeat: '2026-01-28T10:00:00Z',
        currentPath: '/prospects/p-123',
        currentProspectId: 'p-123',
        deviceId: 'device-abc',
        userAgent: 'Mozilla/5.0...',
      };

      const result = PresenceSchema.safeParse(presence);
      expect(result.success).toBe(true);
    });
  });

  describe('OfflineOperationSchema', () => {
    it('should validate offline operation', () => {
      const op = {
        id: 'op-123',
        type: 'update',
        collection: 'prospects',
        documentId: 'p-123',
        data: { status: 'qualified' },
        timestamp: Date.now(),
        retries: 0,
      };

      const result = OfflineOperationSchema.safeParse(op);
      expect(result.success).toBe(true);
    });
  });
});
