/**
 * Tests for Mock Factories
 * 
 * Ensures factory functions produce valid mock data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateId,
  resetIdCounter,
  createMockProspect,
  createMockProspects,
  createMockCompanyRow,
  createMockCompanyRows,
  createMockRailwayProspect,
  createMockRailwaySequence,
  createMockRailwayEnrollment,
  createMockHealthResponse,
  createMockBulkRecipient,
  createMockBulkRecipients,
  createMockPaginatedResponse,
  createMockErrorResponse,
} from './index';

describe('Mock Factories', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('supports custom prefix', () => {
      const id = generateId('custom');
      expect(id).toMatch(/^custom-/);
    });
  });

  describe('createMockProspect', () => {
    it('creates prospect with default values', () => {
      const prospect = createMockProspect();
      
      expect(prospect.id).toBeDefined();
      expect(prospect.email).toContain('@example.com');
      expect(prospect.tier).toBe('Tier 1');
      expect(prospect.status).toBe('new');
    });

    it('accepts overrides', () => {
      const prospect = createMockProspect({ 
        name: 'Custom Name',
        tier: 'Tier 2',
      });
      
      expect(prospect.name).toBe('Custom Name');
      expect(prospect.tier).toBe('Tier 2');
    });
  });

  describe('createMockProspects', () => {
    it('creates array of prospects', () => {
      const prospects = createMockProspects(5);
      
      expect(prospects).toHaveLength(5);
      // All should have unique IDs
      const ids = prospects.map(p => p.id);
      expect(new Set(ids).size).toBe(5);
    });
  });

  describe('createMockCompanyRow', () => {
    it('creates company with default contacts', () => {
      const company = createMockCompanyRow();
      
      expect(company.id).toBeDefined();
      expect(company.contacts).toHaveLength(2);
      expect(company.contactCount).toBe(2);
    });

    it('calculates exec/ops counts correctly', () => {
      const company = createMockCompanyRow({
        contacts: [
          createMockProspect({ isExec: true, isOps: false }),
          createMockProspect({ isExec: false, isOps: true }),
          createMockProspect({ isExec: true, isOps: true }),
        ],
      });
      
      expect(company.execCount).toBe(2);
      expect(company.opsCount).toBe(2);
    });
  });

  describe('createMockHealthResponse', () => {
    it('creates healthy response by default', () => {
      const health = createMockHealthResponse();
      
      expect(health.status).toBe('healthy');
      expect(health.checks.database.status).toBe('ok');
      expect(health.checks.redis.status).toBe('ok');
    });

    it('creates degraded response', () => {
      const health = createMockHealthResponse('degraded');
      
      expect(health.status).toBe('degraded');
      expect(health.checks.database.status).toBe('ok');
      expect(health.checks.redis.status).toBe('error');
    });

    it('creates unhealthy response', () => {
      const health = createMockHealthResponse('unhealthy');
      
      expect(health.status).toBe('unhealthy');
      expect(health.checks.database.status).toBe('error');
      expect(health.checks.redis.status).toBe('error');
    });
  });

  describe('createMockBulkRecipient', () => {
    it('creates recipient with default pending status', () => {
      const recipient = createMockBulkRecipient();
      
      expect(recipient.status).toBe('pending');
      expect(recipient.prospect).toBeDefined();
      expect(recipient.subject).toBe('Test Subject');
    });

    it('accepts status parameter', () => {
      const recipient = createMockBulkRecipient('approved');
      
      expect(recipient.status).toBe('approved');
    });
  });

  describe('createMockBulkRecipients', () => {
    it('creates array with specified statuses', () => {
      const recipients = createMockBulkRecipients(3, ['pending', 'approved', 'sent']);
      
      expect(recipients).toHaveLength(3);
      expect(recipients[0].status).toBe('pending');
      expect(recipients[1].status).toBe('approved');
      expect(recipients[2].status).toBe('sent');
    });
  });

  describe('createMockPaginatedResponse', () => {
    it('wraps items in pagination structure', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = createMockPaginatedResponse(items);
      
      expect(response.items).toBe(items);
      expect(response.total).toBe(2);
      expect(response.limit).toBe(50);
      expect(response.offset).toBe(0);
    });

    it('accepts custom total', () => {
      const items = [{ id: '1' }];
      const response = createMockPaginatedResponse(items, 100);
      
      expect(response.total).toBe(100);
    });
  });

  describe('createMockErrorResponse', () => {
    it('creates error response with all fields', () => {
      const error = createMockErrorResponse(500, 'Internal error', 'INTERNAL_ERROR');
      
      expect(error.error).toBe('Internal error');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.requestId).toBeDefined();
      expect(error.detail).toContain('Error occurred');
    });
  });

  describe('Railway Type Factories', () => {
    it('createMockRailwayProspect creates valid prospect', () => {
      const prospect = createMockRailwayProspect();
      
      expect(prospect.id).toBeDefined();
      expect(prospect.email).toContain('@example.com');
      expect(prospect.createdAt).toBeDefined();
    });

    it('createMockRailwaySequence creates sequence with steps', () => {
      const sequence = createMockRailwaySequence();
      
      expect(sequence.id).toBeDefined();
      expect(sequence.steps).toHaveLength(3);
      expect(sequence.steps[0].type).toBe('email');
      expect(sequence.steps[1].type).toBe('wait');
    });

    it('createMockRailwayEnrollment creates valid enrollment', () => {
      const enrollment = createMockRailwayEnrollment();
      
      expect(enrollment.id).toBeDefined();
      expect(enrollment.prospectId).toBeDefined();
      expect(enrollment.sequenceId).toBeDefined();
      expect(enrollment.status).toBe('active');
      expect(enrollment.currentStep).toBe(0);
    });
  });
});
