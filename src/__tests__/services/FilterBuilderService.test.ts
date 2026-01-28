/**
 * FilterBuilderService Tests
 */

import { describe, it, expect } from 'vitest';
import {
  FilterCondition,
  FilterGroup,
  FilterDefinition,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  NO_VALUE_OPERATORS,
  generateFilterId,
  createCondition,
  createFilterGroup,
  createFilterDefinition,
  addConditionToGroup,
  addGroupToGroup,
  removeFromGroup,
  updateConditionInGroup,
  matchesCondition,
  matchesGroup,
  applyFilter,
  serializeFilter,
  deserializeFilter,
  getProspectFilterableFields,
  getCompanyFilterableFields,
  createQuickFilter,
  countConditions,
  validateFilter,
} from '../../services/FilterBuilderService';

// Sample test data
const sampleProspects = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    fullName: 'John Smith',
    email: 'john@acme.com',
    company: 'Acme Corp',
    title: 'VP Sales',
    location: 'San Francisco',
    status: 'new',
    tags: ['enterprise', 'decision-maker'],
    age: 35,
    isActive: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Doe',
    fullName: 'Jane Doe',
    email: 'jane@techstart.io',
    company: 'TechStart Inc',
    title: 'CEO',
    location: 'New York',
    status: 'contacted',
    tags: ['startup', 'founder'],
    age: 42,
    isActive: true,
    createdAt: new Date('2024-02-20'),
  },
  {
    id: '3',
    firstName: 'Bob',
    lastName: 'Wilson',
    fullName: 'Bob Wilson',
    email: 'bob@innovate.co',
    company: 'Innovate Labs',
    title: 'CTO',
    location: 'Austin',
    status: 'qualified',
    tags: [],
    age: 28,
    isActive: false,
    createdAt: new Date('2024-03-10'),
  },
];

describe('Constants', () => {
  it('has operators for all field types', () => {
    expect(OPERATORS_BY_TYPE.string.length).toBeGreaterThan(0);
    expect(OPERATORS_BY_TYPE.number.length).toBeGreaterThan(0);
    expect(OPERATORS_BY_TYPE.boolean.length).toBeGreaterThan(0);
    expect(OPERATORS_BY_TYPE.date.length).toBeGreaterThan(0);
    expect(OPERATORS_BY_TYPE.enum.length).toBeGreaterThan(0);
    expect(OPERATORS_BY_TYPE.array.length).toBeGreaterThan(0);
  });

  it('has labels for all operators', () => {
    const allOperators = new Set<string>();
    Object.values(OPERATORS_BY_TYPE).forEach(ops => {
      ops.forEach(op => allOperators.add(op));
    });

    allOperators.forEach(op => {
      expect(OPERATOR_LABELS[op as keyof typeof OPERATOR_LABELS]).toBeDefined();
    });
  });

  it('has no-value operators defined', () => {
    expect(NO_VALUE_OPERATORS).toContain('is_empty');
    expect(NO_VALUE_OPERATORS).toContain('is_not_empty');
  });
});

describe('generateFilterId', () => {
  it('generates unique IDs', () => {
    const id1 = generateFilterId();
    const id2 = generateFilterId();
    
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^filter_\d+_\w+$/);
  });
});

describe('createCondition', () => {
  it('creates a condition with defaults', () => {
    const condition = createCondition();
    
    expect(condition.id).toBeDefined();
    expect(condition.field).toBe('');
    expect(condition.operator).toBe('equals');
    expect(condition.value).toBe('');
  });

  it('creates a condition with specified values', () => {
    const condition = createCondition('firstName', 'contains', 'John');
    
    expect(condition.field).toBe('firstName');
    expect(condition.operator).toBe('contains');
    expect(condition.value).toBe('John');
  });
});

describe('createFilterGroup', () => {
  it('creates an AND group by default', () => {
    const group = createFilterGroup();
    
    expect(group.type).toBe('and');
    expect(group.conditions).toEqual([]);
  });

  it('creates an OR group when specified', () => {
    const group = createFilterGroup('or');
    
    expect(group.type).toBe('or');
  });
});

describe('createFilterDefinition', () => {
  it('creates a filter definition with defaults', () => {
    const filter = createFilterDefinition();
    
    expect(filter.name).toBe('New Filter');
    expect(filter.rootGroup).toBeDefined();
    expect(filter.rootGroup.type).toBe('and');
    expect(filter.createdAt).toBeInstanceOf(Date);
    expect(filter.updatedAt).toBeInstanceOf(Date);
  });

  it('creates a filter definition with a name', () => {
    const filter = createFilterDefinition('My Filter');
    
    expect(filter.name).toBe('My Filter');
  });
});

describe('addConditionToGroup', () => {
  it('adds a condition to a group', () => {
    const group = createFilterGroup();
    const condition = createCondition('firstName', 'equals', 'John');
    
    const result = addConditionToGroup(group, condition);
    
    expect(result.conditions.length).toBe(1);
    expect(result.conditions[0]).toBe(condition);
  });

  it('preserves existing conditions', () => {
    let group = createFilterGroup();
    const condition1 = createCondition('firstName', 'equals', 'John');
    const condition2 = createCondition('lastName', 'equals', 'Doe');
    
    group = addConditionToGroup(group, condition1);
    group = addConditionToGroup(group, condition2);
    
    expect(group.conditions.length).toBe(2);
  });
});

describe('addGroupToGroup', () => {
  it('adds a nested group', () => {
    const parent = createFilterGroup('and');
    const child = createFilterGroup('or');
    
    const result = addGroupToGroup(parent, child);
    
    expect(result.conditions.length).toBe(1);
    expect((result.conditions[0] as FilterGroup).type).toBe('or');
  });
});

describe('removeFromGroup', () => {
  it('removes a condition by ID', () => {
    const condition = createCondition('firstName', 'equals', 'John');
    let group = createFilterGroup();
    group = addConditionToGroup(group, condition);
    
    const result = removeFromGroup(group, condition.id);
    
    expect(result.conditions.length).toBe(0);
  });

  it('removes from nested groups', () => {
    const condition = createCondition('firstName', 'equals', 'John');
    const nestedGroup = addConditionToGroup(createFilterGroup('or'), condition);
    let parentGroup = addGroupToGroup(createFilterGroup('and'), nestedGroup);
    
    const result = removeFromGroup(parentGroup, condition.id);
    const nested = result.conditions[0] as FilterGroup;
    
    expect(nested.conditions.length).toBe(0);
  });
});

describe('updateConditionInGroup', () => {
  it('updates a condition', () => {
    const condition = createCondition('firstName', 'equals', 'John');
    let group = addConditionToGroup(createFilterGroup(), condition);
    
    group = updateConditionInGroup(group, condition.id, { value: 'Jane' });
    
    expect((group.conditions[0] as FilterCondition).value).toBe('Jane');
  });

  it('updates conditions in nested groups', () => {
    const condition = createCondition('firstName', 'equals', 'John');
    const nestedGroup = addConditionToGroup(createFilterGroup('or'), condition);
    let parentGroup = addGroupToGroup(createFilterGroup('and'), nestedGroup);
    
    parentGroup = updateConditionInGroup(parentGroup, condition.id, { value: 'Jane' });
    const nested = parentGroup.conditions[0] as FilterGroup;
    
    expect((nested.conditions[0] as FilterCondition).value).toBe('Jane');
  });
});

describe('matchesCondition', () => {
  describe('string operations', () => {
    it('matches equals', () => {
      const condition = createCondition('firstName', 'equals', 'John');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(false);
    });

    it('matches not_equals', () => {
      const condition = createCondition('firstName', 'not_equals', 'John');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(true);
    });

    it('matches contains', () => {
      const condition = createCondition('email', 'contains', 'acme');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(false);
    });

    it('matches not_contains', () => {
      const condition = createCondition('email', 'not_contains', 'acme');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(true);
    });

    it('matches starts_with', () => {
      const condition = createCondition('email', 'starts_with', 'john');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(false);
    });

    it('matches ends_with', () => {
      const condition = createCondition('email', 'ends_with', '.com');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(false);
    });

    it('is case insensitive', () => {
      const condition = createCondition('firstName', 'equals', 'john');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
    });
  });

  describe('number operations', () => {
    it('matches equals', () => {
      const condition = createCondition('age', 'equals', 35);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(false);
    });

    it('matches greater_than', () => {
      const condition = createCondition('age', 'greater_than', 30);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[2], condition)).toBe(false);
    });

    it('matches less_than', () => {
      const condition = createCondition('age', 'less_than', 30);
      expect(matchesCondition(sampleProspects[2], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false);
    });

    it('matches between', () => {
      const condition: FilterCondition = {
        ...createCondition('age', 'between', 30),
        valueEnd: 40,
      };
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true); // age 35
      expect(matchesCondition(sampleProspects[2], condition)).toBe(false); // age 28
    });

    it('handles string numbers', () => {
      const condition = createCondition('age', 'equals', '35');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
    });
  });

  describe('boolean operations', () => {
    it('matches equals true', () => {
      const condition = createCondition('isActive', 'equals', true);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[2], condition)).toBe(false);
    });

    it('matches equals false', () => {
      const condition = createCondition('isActive', 'equals', false);
      expect(matchesCondition(sampleProspects[2], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false);
    });
  });

  describe('date operations', () => {
    it('matches greater_than (after)', () => {
      const condition = createCondition('createdAt', 'greater_than', new Date('2024-02-01'));
      expect(matchesCondition(sampleProspects[1], condition)).toBe(true); // Feb 20
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false); // Jan 15
    });

    it('matches less_than (before)', () => {
      const condition = createCondition('createdAt', 'less_than', new Date('2024-02-01'));
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true); // Jan 15
      expect(matchesCondition(sampleProspects[1], condition)).toBe(false); // Feb 20
    });
  });

  describe('array operations', () => {
    it('matches contains', () => {
      const condition = createCondition('tags', 'contains', 'enterprise');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[1], condition)).toBe(false);
    });

    it('matches not_contains', () => {
      const condition = createCondition('tags', 'not_contains', 'enterprise');
      expect(matchesCondition(sampleProspects[1], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false);
    });
  });

  describe('empty operations', () => {
    it('matches is_empty for empty array', () => {
      const condition = createCondition('tags', 'is_empty', '');
      expect(matchesCondition(sampleProspects[2], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false);
    });

    it('matches is_not_empty for non-empty array', () => {
      const condition = createCondition('tags', 'is_not_empty', '');
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true);
      expect(matchesCondition(sampleProspects[2], condition)).toBe(false);
    });

    it('matches is_empty for null/undefined', () => {
      const condition = createCondition('phone', 'is_empty', '');
      expect(matchesCondition({ phone: null }, condition)).toBe(true);
      expect(matchesCondition({ phone: undefined }, condition)).toBe(true);
      expect(matchesCondition({ phone: '' }, condition)).toBe(true);
    });
  });

  describe('in/not_in operations', () => {
    it('matches in', () => {
      const condition = createCondition('status', 'in', ['new', 'contacted']);
      expect(matchesCondition(sampleProspects[0], condition)).toBe(true); // new
      expect(matchesCondition(sampleProspects[1], condition)).toBe(true); // contacted
      expect(matchesCondition(sampleProspects[2], condition)).toBe(false); // qualified
    });

    it('matches not_in', () => {
      const condition = createCondition('status', 'not_in', ['new', 'contacted']);
      expect(matchesCondition(sampleProspects[2], condition)).toBe(true); // qualified
      expect(matchesCondition(sampleProspects[0], condition)).toBe(false); // new
    });
  });
});

describe('matchesGroup', () => {
  it('returns true for empty group', () => {
    const group = createFilterGroup();
    expect(matchesGroup(sampleProspects[0], group)).toBe(true);
  });

  it('matches AND groups (all conditions must match)', () => {
    let group = createFilterGroup('and');
    group = addConditionToGroup(group, createCondition('firstName', 'equals', 'John'));
    group = addConditionToGroup(group, createCondition('company', 'equals', 'Acme Corp'));
    
    expect(matchesGroup(sampleProspects[0], group)).toBe(true);
    expect(matchesGroup(sampleProspects[1], group)).toBe(false);
  });

  it('matches OR groups (any condition must match)', () => {
    let group = createFilterGroup('or');
    group = addConditionToGroup(group, createCondition('firstName', 'equals', 'John'));
    group = addConditionToGroup(group, createCondition('firstName', 'equals', 'Jane'));
    
    expect(matchesGroup(sampleProspects[0], group)).toBe(true);
    expect(matchesGroup(sampleProspects[1], group)).toBe(true);
    expect(matchesGroup(sampleProspects[2], group)).toBe(false);
  });

  it('handles nested groups', () => {
    // (firstName = John AND company = Acme) OR (firstName = Jane)
    let andGroup = createFilterGroup('and');
    andGroup = addConditionToGroup(andGroup, createCondition('firstName', 'equals', 'John'));
    andGroup = addConditionToGroup(andGroup, createCondition('company', 'equals', 'Acme Corp'));
    
    let orGroup = createFilterGroup('or');
    orGroup = addGroupToGroup(orGroup, andGroup);
    orGroup = addConditionToGroup(orGroup, createCondition('firstName', 'equals', 'Jane'));
    
    expect(matchesGroup(sampleProspects[0], orGroup)).toBe(true); // John at Acme
    expect(matchesGroup(sampleProspects[1], orGroup)).toBe(true); // Jane
    expect(matchesGroup(sampleProspects[2], orGroup)).toBe(false); // Bob
  });
});

describe('applyFilter', () => {
  it('filters an array of items', () => {
    const filter = createFilterDefinition('Test');
    filter.rootGroup = addConditionToGroup(
      filter.rootGroup,
      createCondition('isActive', 'equals', true)
    );
    
    const result = applyFilter(sampleProspects, filter);
    
    expect(result.length).toBe(2);
    expect(result.every(p => p.isActive)).toBe(true);
  });

  it('returns all items for empty filter', () => {
    const filter = createFilterDefinition('Empty');
    const result = applyFilter(sampleProspects, filter);
    
    expect(result.length).toBe(sampleProspects.length);
  });
});

describe('serializeFilter / deserializeFilter', () => {
  it('serializes and deserializes a filter', () => {
    const original = createFilterDefinition('Test Filter');
    original.description = 'A test filter';
    original.rootGroup = addConditionToGroup(
      original.rootGroup,
      createCondition('firstName', 'equals', 'John')
    );
    
    const json = serializeFilter(original);
    const restored = deserializeFilter(json);
    
    expect(restored.name).toBe('Test Filter');
    expect(restored.description).toBe('A test filter');
    expect(restored.createdAt).toBeInstanceOf(Date);
    expect(restored.rootGroup.conditions.length).toBe(1);
  });
});

describe('getProspectFilterableFields', () => {
  it('returns filterable fields for prospects', () => {
    const fields = getProspectFilterableFields();
    
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.find(f => f.name === 'firstName')).toBeDefined();
    expect(fields.find(f => f.name === 'email')).toBeDefined();
    expect(fields.find(f => f.name === 'status')).toBeDefined();
  });

  it('includes operators for each field', () => {
    const fields = getProspectFilterableFields();
    
    fields.forEach(field => {
      expect(field.operators.length).toBeGreaterThan(0);
    });
  });

  it('includes enum values for status', () => {
    const fields = getProspectFilterableFields();
    const statusField = fields.find(f => f.name === 'status');
    
    expect(statusField?.enumValues?.length).toBeGreaterThan(0);
  });
});

describe('getCompanyFilterableFields', () => {
  it('returns filterable fields for companies', () => {
    const fields = getCompanyFilterableFields();
    
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.find(f => f.name === 'name')).toBeDefined();
    expect(fields.find(f => f.name === 'industry')).toBeDefined();
  });
});

describe('createQuickFilter', () => {
  it('creates a quick filter', () => {
    const filter = createQuickFilter('Active Only', 'isActive', 'equals', true);
    
    expect(filter.name).toBe('Active Only');
    expect(filter.isQuickFilter).toBe(true);
    expect(filter.rootGroup.conditions.length).toBe(1);
  });
});

describe('countConditions', () => {
  it('counts conditions in a group', () => {
    let group = createFilterGroup();
    group = addConditionToGroup(group, createCondition('a', 'equals', '1'));
    group = addConditionToGroup(group, createCondition('b', 'equals', '2'));
    
    expect(countConditions(group)).toBe(2);
  });

  it('counts conditions in nested groups', () => {
    let nested = createFilterGroup('or');
    nested = addConditionToGroup(nested, createCondition('c', 'equals', '3'));
    
    let parent = createFilterGroup('and');
    parent = addConditionToGroup(parent, createCondition('a', 'equals', '1'));
    parent = addGroupToGroup(parent, nested);
    
    expect(countConditions(parent)).toBe(2);
  });

  it('returns 0 for empty group', () => {
    expect(countConditions(createFilterGroup())).toBe(0);
  });
});

describe('validateFilter', () => {
  it('validates a correct filter', () => {
    let filter = createFilterDefinition('Test');
    filter.rootGroup = addConditionToGroup(
      filter.rootGroup,
      createCondition('firstName', 'equals', 'John')
    );
    
    const result = validateFilter(filter);
    
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('rejects filter without name', () => {
    const filter = createFilterDefinition('');
    
    const result = validateFilter(filter);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Filter name is required');
  });

  it('rejects condition without field', () => {
    let filter = createFilterDefinition('Test');
    filter.rootGroup = addConditionToGroup(
      filter.rootGroup,
      createCondition('', 'equals', 'value')
    );
    
    const result = validateFilter(filter);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects condition without value (except empty operators)', () => {
    let filter = createFilterDefinition('Test');
    filter.rootGroup = addConditionToGroup(
      filter.rootGroup,
      createCondition('firstName', 'equals', '')
    );
    
    const result = validateFilter(filter);
    
    expect(result.valid).toBe(false);
  });

  it('allows is_empty without value', () => {
    let filter = createFilterDefinition('Test');
    filter.rootGroup = addConditionToGroup(
      filter.rootGroup,
      createCondition('firstName', 'is_empty', '')
    );
    
    const result = validateFilter(filter);
    
    expect(result.valid).toBe(true);
  });
});

describe('Edge Cases', () => {
  it('handles null field values', () => {
    const condition = createCondition('phone', 'equals', '123');
    expect(matchesCondition({ phone: null }, condition)).toBe(false);
  });

  it('handles undefined field values', () => {
    const condition = createCondition('phone', 'equals', '123');
    expect(matchesCondition({}, condition)).toBe(false);
  });

  it('handles empty string comparisons', () => {
    const condition = createCondition('phone', 'equals', '');
    expect(matchesCondition({ phone: '' }, condition)).toBe(true);
  });
});
