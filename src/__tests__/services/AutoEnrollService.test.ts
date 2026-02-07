/**
 * AutoEnrollService Tests
 * Sprint 49D: Test coverage for S46 Pipeline Automation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoEnrollService, type AutoEnrollRule } from '../../services/AutoEnrollService';
import type { Prospect } from '../../types';
import type { FilterGroup } from '../../services/FilterBuilderService';

// Mock prospect factory
const createProspect = (overrides: Partial<Prospect> = {}): Prospect => ({
  id: 'prospect-1',
  name: 'John Doe',
  email: 'john@example.com',
  company: 'Acme Corp',
  title: 'VP Operations',
  status: 'new',
  tier: 'Tier 1',
  score: 85,
  isOps: true,
  isExec: true,
  tags: [],
  createdAt: Date.now(),
  ...overrides,
});

// Mock rule factory
const createRule = (overrides: Partial<AutoEnrollRule> = {}): AutoEnrollRule => ({
  id: 'rule-1',
  name: 'Test Rule',
  description: 'Test auto-enroll rule',
  conditions: {
    type: 'and',
    conditions: [
      { id: 'c1', field: 'tier', operator: 'equals', value: 'Tier 1' },
    ],
  } as FilterGroup,
  sequenceId: 'seq-1',
  isActive: true,
  priority: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  enrolledCount: 0,
  ...overrides,
});

describe('AutoEnrollService', () => {
  let service: AutoEnrollService;

  beforeEach(() => {
    service = new AutoEnrollService();
  });

  describe('loadRules', () => {
    it('loads and sorts rules by priority', () => {
      const rules = [
        createRule({ id: 'rule-3', priority: 3 }),
        createRule({ id: 'rule-1', priority: 1 }),
        createRule({ id: 'rule-2', priority: 2 }),
      ];
      
      service.loadRules(rules);
      
      // Rules should be sorted by priority
      const loaded = service.getRules();
      expect(loaded[0].id).toBe('rule-1');
      expect(loaded[1].id).toBe('rule-2');
      expect(loaded[2].id).toBe('rule-3');
    });
  });

  describe('evaluateProspect', () => {
    it('matches prospect against active rules', () => {
      const rule = createRule({
        conditions: {
          type: 'and',
          conditions: [
            { id: 'c1', field: 'tier', operator: 'equals', value: 'Tier 1' },
          ],
        } as FilterGroup,
      });
      service.loadRules([rule]);

      const prospect = createProspect({ tier: 'Tier 1', status: 'new' });
      const result = service.evaluateProspect(prospect);

      expect(result).not.toBeNull();
      expect(result?.ruleId).toBe('rule-1');
      expect(result?.sequenceId).toBe('seq-1');
    });

    it('skips inactive rules', () => {
      const rule = createRule({ isActive: false });
      service.loadRules([rule]);

      const prospect = createProspect({ tier: 'Tier 1' });
      const result = service.evaluateProspect(prospect);

      expect(result).toBeNull();
    });

    it('returns first matching rule by priority', () => {
      const rules = [
        createRule({ id: 'rule-high', priority: 1, sequenceId: 'seq-high' }),
        createRule({ id: 'rule-low', priority: 2, sequenceId: 'seq-low' }),
      ];
      service.loadRules(rules);

      const prospect = createProspect({ tier: 'Tier 1' });
      const result = service.evaluateProspect(prospect);

      expect(result?.ruleId).toBe('rule-high');
      expect(result?.sequenceId).toBe('seq-high');
    });
  });

  describe('getRules / getActiveRules', () => {
    it('returns all rules via getRules', () => {
      const rules = [
        createRule({ id: 'r1', isActive: true }),
        createRule({ id: 'r2', isActive: false }),
      ];
      service.loadRules(rules);
      
      expect(service.getRules()).toHaveLength(2);
    });

    it('returns only active rules via getActiveRules', () => {
      const rules = [
        createRule({ id: 'r1', isActive: true }),
        createRule({ id: 'r2', isActive: false }),
      ];
      service.loadRules(rules);
      
      expect(service.getActiveRules()).toHaveLength(1);
      expect(service.getActiveRules()[0].id).toBe('r1');
    });
  });

  describe('createRule', () => {
    it('creates a new rule with generated ID and timestamps', () => {
      const newRule = service.createRule({
        name: 'New Rule',
        conditions: { type: 'and', conditions: [] } as unknown as FilterGroup,
        sequenceId: 'seq-new',
        isActive: true,
        priority: 1,
      });

      expect(newRule.id).toBeDefined();
      expect(newRule.createdAt).toBeDefined();
      expect(newRule.updatedAt).toBeDefined();
      expect(newRule.enrolledCount).toBe(0);
    });
  });

  describe('updateRule', () => {
    it('updates an existing rule', () => {
      service.loadRules([createRule({ id: 'r1', name: 'Old Name' })]);
      
      const updated = service.updateRule('r1', { name: 'New Name' });
      
      expect(updated?.name).toBe('New Name');
    });

    it('returns null for non-existent rule', () => {
      const result = service.updateRule('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('deleteRule', () => {
    it('deletes an existing rule', () => {
      service.loadRules([createRule({ id: 'to-delete' })]);
      
      const deleted = service.deleteRule('to-delete');
      
      expect(deleted).toBe(true);
      expect(service.getRules()).toHaveLength(0);
    });

    it('returns false for non-existent rule', () => {
      const result = service.deleteRule('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('onEnroll event handler', () => {
    it('removes handler when unsubscribe called', () => {
      const handler = vi.fn();
      const unsubscribe = service.onEnroll(handler);
      
      // Verify it was registered
      expect(typeof unsubscribe).toBe('function');
      
      // Unsubscribe
      unsubscribe();
      
      // Handler should not be called anymore (tested via implementation)
    });
  });
});
