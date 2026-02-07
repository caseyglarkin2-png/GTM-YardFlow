/**
 * AutoEnrollService
 * 
 * Rules engine to automatically enroll prospects into sequences
 * based on configurable criteria. Uses FilterBuilderService patterns
 * for condition evaluation.
 * 
 * Sprint 46: Pipeline Automation
 */

import type { Prospect } from '../types';
import type { FilterGroup, FilterCondition } from './FilterBuilderService';

/**
 * Auto-enrollment rule definition
 */
export interface AutoEnrollRule {
  id: string;
  name: string;
  description?: string;
  conditions: FilterGroup;
  sequenceId: string;
  isActive: boolean;
  priority: number; // Lower = higher priority
  createdAt: Date;
  updatedAt: Date;
  // Analytics
  enrolledCount: number;
  lastTriggeredAt?: Date;
}

/**
 * Result of processing prospects against rules
 */
export interface AutoEnrollResult {
  prospectId: string;
  matchedRuleId: string | null;
  sequenceId: string | null;
  enrolled: boolean;
  reason: string;
}

/**
 * Batch processing result
 */
export interface BatchEnrollResult {
  processed: number;
  enrolled: number;
  skipped: number;
  errors: number;
  results: AutoEnrollResult[];
}

/**
 * Event fired when prospect is auto-enrolled
 */
export interface AutoEnrollEvent {
  prospectId: string;
  ruleId: string;
  ruleName: string;
  sequenceId: string;
  timestamp: Date;
}

type AutoEnrollEventHandler = (event: AutoEnrollEvent) => void;

/**
 * AutoEnrollService - Rules engine for automated sequence enrollment
 */
export class AutoEnrollService {
  private rules: AutoEnrollRule[] = [];
  private eventHandlers: AutoEnrollEventHandler[] = [];

  constructor() {
    // Rules loaded via loadRules()
  }

  /**
   * Load rules from storage (Firestore)
   */
  loadRules(rules: AutoEnrollRule[]): void {
    // Sort by priority (lower = higher priority)
    this.rules = [...rules].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Add an event handler for auto-enrollment events
   */
  onEnroll(handler: AutoEnrollEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Emit an enrollment event
   */
  private emitEvent(event: AutoEnrollEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Auto-enroll event handler error:', error);
      }
    }
  }

  /**
   * Evaluate a prospect against all active rules
   * Returns the first matching rule's sequence ID, or null if no match
   */
  evaluateProspect(prospect: Prospect): { ruleId: string; sequenceId: string } | null {
    const activeRules = this.rules.filter(r => r.isActive);
    
    for (const rule of activeRules) {
      if (this.matchesRule(prospect, rule)) {
        return { ruleId: rule.id, sequenceId: rule.sequenceId };
      }
    }
    
    return null;
  }

  /**
   * Check if a prospect matches a specific rule
   */
  matchesRule(prospect: Prospect, rule: AutoEnrollRule): boolean {
    return this.evaluateFilterGroup(prospect, rule.conditions);
  }

  /**
   * Evaluate a filter group against a prospect
   */
  private evaluateFilterGroup(prospect: Prospect, group: FilterGroup): boolean {
    if (group.type === 'and') {
      return group.conditions.every(condition => 
        this.evaluateCondition(prospect, condition)
      );
    } else {
      return group.conditions.some(condition => 
        this.evaluateCondition(prospect, condition)
      );
    }
  }

  /**
   * Evaluate a single condition or nested group
   */
  private evaluateCondition(
    prospect: Prospect, 
    condition: FilterCondition | FilterGroup
  ): boolean {
    // Nested group
    if ('type' in condition && ('and' === condition.type || 'or' === condition.type)) {
      return this.evaluateFilterGroup(prospect, condition as FilterGroup);
    }

    // Single condition
    const cond = condition as FilterCondition;
    const fieldValue = this.getFieldValue(prospect, cond.field);
    
    return this.evaluateOperator(fieldValue, cond.operator, cond.value, cond.valueEnd);
  }

  /**
   * Get a field value from prospect, supporting dot notation
   */
  private getFieldValue(prospect: Prospect, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = prospect;
    
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    
    return value;
  }

  /**
   * Evaluate an operator against field value
   */
  private evaluateOperator(
    fieldValue: unknown,
    operator: FilterCondition['operator'],
    value: FilterCondition['value'],
    valueEnd?: FilterCondition['valueEnd']
  ): boolean {
    // Handle null/undefined
    if (fieldValue === null || fieldValue === undefined) {
      if (operator === 'is_empty') return true;
      if (operator === 'is_not_empty') return false;
      return false;
    }

    const strValue = String(fieldValue).toLowerCase();
    const compareValue = String(value).toLowerCase();

    switch (operator) {
      case 'equals':
        return strValue === compareValue;
      case 'not_equals':
        return strValue !== compareValue;
      case 'contains':
        return strValue.includes(compareValue);
      case 'not_contains':
        return !strValue.includes(compareValue);
      case 'starts_with':
        return strValue.startsWith(compareValue);
      case 'ends_with':
        return strValue.endsWith(compareValue);
      case 'is_empty':
        return strValue === '';
      case 'is_not_empty':
        return strValue !== '';
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(value);
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(value);
      case 'between':
        if (valueEnd === undefined) return false;
        const num = Number(fieldValue);
        return num >= Number(value) && num <= Number(valueEnd);
      case 'in':
        if (Array.isArray(value)) {
          return value.map(v => String(v).toLowerCase()).includes(strValue);
        }
        return false;
      case 'not_in':
        if (Array.isArray(value)) {
          return !value.map(v => String(v).toLowerCase()).includes(strValue);
        }
        return true;
      default:
        return false;
    }
  }

  /**
   * Process a batch of new prospects against all rules
   * Returns which prospects should be enrolled in which sequences
   */
  async processNewProspects(
    prospects: Prospect[],
    enrollCallback?: (prospectId: string, sequenceId: string, ruleId: string) => Promise<boolean>
  ): Promise<BatchEnrollResult> {
    const results: AutoEnrollResult[] = [];
    let enrolled = 0;
    let skipped = 0;
    let errors = 0;

    for (const prospect of prospects) {
      try {
        // Skip if prospect is already contacted or further in funnel
        if (prospect.status === 'contacted' || prospect.status === 'meeting_booked' || prospect.status === 'replied') {
          results.push({
            prospectId: prospect.id,
            matchedRuleId: null,
            sequenceId: null,
            enrolled: false,
            reason: 'Prospect already in active outreach'
          });
          skipped++;
          continue;
        }

        // Evaluate against rules
        const match = this.evaluateProspect(prospect);
        
        if (!match) {
          results.push({
            prospectId: prospect.id,
            matchedRuleId: null,
            sequenceId: null,
            enrolled: false,
            reason: 'No matching rule'
          });
          skipped++;
          continue;
        }

        // Attempt enrollment via callback
        if (enrollCallback) {
          const success = await enrollCallback(prospect.id, match.sequenceId, match.ruleId);
          if (success) {
            enrolled++;
            this.emitEvent({
              prospectId: prospect.id,
              ruleId: match.ruleId,
              ruleName: this.rules.find(r => r.id === match.ruleId)?.name || 'Unknown',
              sequenceId: match.sequenceId,
              timestamp: new Date()
            });
            results.push({
              prospectId: prospect.id,
              matchedRuleId: match.ruleId,
              sequenceId: match.sequenceId,
              enrolled: true,
              reason: 'Auto-enrolled'
            });
          } else {
            errors++;
            results.push({
              prospectId: prospect.id,
              matchedRuleId: match.ruleId,
              sequenceId: match.sequenceId,
              enrolled: false,
              reason: 'Enrollment callback failed'
            });
          }
        } else {
          // No callback - just report match
          enrolled++;
          results.push({
            prospectId: prospect.id,
            matchedRuleId: match.ruleId,
            sequenceId: match.sequenceId,
            enrolled: true,
            reason: 'Would auto-enroll (dry run)'
          });
        }
      } catch (error) {
        errors++;
        results.push({
          prospectId: prospect.id,
          matchedRuleId: null,
          sequenceId: null,
          enrolled: false,
          reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return {
      processed: prospects.length,
      enrolled,
      skipped,
      errors,
      results
    };
  }

  /**
   * Preview which prospects would match a rule (for UI)
   */
  previewRule(prospects: Prospect[], rule: AutoEnrollRule): Prospect[] {
    return prospects.filter(p => this.matchesRule(p, rule));
  }

  /**
   * Get all rules
   */
  getRules(): AutoEnrollRule[] {
    return [...this.rules];
  }

  /**
   * Get active rules only
   */
  getActiveRules(): AutoEnrollRule[] {
    return this.rules.filter(r => r.isActive);
  }

  /**
   * Create a new rule (in-memory only, persist via Firestore separately)
   */
  createRule(rule: Omit<AutoEnrollRule, 'id' | 'createdAt' | 'updatedAt' | 'enrolledCount'>): AutoEnrollRule {
    const newRule: AutoEnrollRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      enrolledCount: 0
    };
    
    this.rules.push(newRule);
    this.rules.sort((a, b) => a.priority - b.priority);
    
    return newRule;
  }

  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<AutoEnrollRule>): AutoEnrollRule | null {
    const index = this.rules.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    this.rules[index] = {
      ...this.rules[index],
      ...updates,
      updatedAt: new Date()
    };
    
    this.rules.sort((a, b) => a.priority - b.priority);
    
    return this.rules[index];
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(r => r.id !== id);
    return this.rules.length < initialLength;
  }
}

// Singleton instance
let autoEnrollServiceInstance: AutoEnrollService | null = null;

export function getAutoEnrollService(): AutoEnrollService {
  if (!autoEnrollServiceInstance) {
    autoEnrollServiceInstance = new AutoEnrollService();
  }
  return autoEnrollServiceInstance;
}
