/**
 * FilterBuilderService
 * 
 * Provides a composable filter system for prospects and companies.
 * Supports multiple filter types, operators, and compound filters.
 */

/**
 * Filter operators
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'in'
  | 'not_in';

/**
 * Filter value types
 */
export type FilterValue = string | number | boolean | Date | string[] | number[];

/**
 * Single filter condition
 */
export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: FilterValue;
  valueEnd?: FilterValue; // For 'between' operator
}

/**
 * Compound filter (AND/OR groups)
 */
export interface FilterGroup {
  id: string;
  type: 'and' | 'or';
  conditions: (FilterCondition | FilterGroup)[];
}

/**
 * Complete filter definition
 */
export interface FilterDefinition {
  id: string;
  name: string;
  description?: string;
  rootGroup: FilterGroup;
  createdAt: Date;
  updatedAt: Date;
  isQuickFilter?: boolean;
}

/**
 * Field definition for filter builder UI
 */
export interface FilterableField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array';
  operators: FilterOperator[];
  enumValues?: { value: string; label: string }[];
}

/**
 * Available operators by field type
 */
export const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  string: [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'is_empty',
    'is_not_empty',
  ],
  number: [
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'between',
    'is_empty',
    'is_not_empty',
  ],
  boolean: ['equals', 'not_equals'],
  date: [
    'equals',
    'not_equals',
    'greater_than',
    'less_than',
    'between',
    'is_empty',
    'is_not_empty',
  ],
  enum: ['equals', 'not_equals', 'in', 'not_in', 'is_empty', 'is_not_empty'],
  array: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
};

/**
 * Operator display names
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
  greater_than: 'greater than',
  less_than: 'less than',
  greater_than_or_equal: 'greater than or equal to',
  less_than_or_equal: 'less than or equal to',
  between: 'between',
  in: 'is one of',
  not_in: 'is not one of',
};

/**
 * Operators that don't require a value
 */
export const NO_VALUE_OPERATORS: FilterOperator[] = ['is_empty', 'is_not_empty'];

/**
 * Generate a unique ID
 */
export function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new empty filter condition
 */
export function createCondition(
  field: string = '',
  operator: FilterOperator = 'equals',
  value: FilterValue = ''
): FilterCondition {
  return {
    id: generateFilterId(),
    field,
    operator,
    value,
  };
}

/**
 * Create a new filter group
 */
export function createFilterGroup(type: 'and' | 'or' = 'and'): FilterGroup {
  return {
    id: generateFilterId(),
    type,
    conditions: [],
  };
}

/**
 * Create a new filter definition
 */
export function createFilterDefinition(name: string = 'New Filter'): FilterDefinition {
  const now = new Date();
  return {
    id: generateFilterId(),
    name,
    rootGroup: createFilterGroup('and'),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Add a condition to a filter group
 */
export function addConditionToGroup(
  group: FilterGroup,
  condition: FilterCondition
): FilterGroup {
  return {
    ...group,
    conditions: [...group.conditions, condition],
  };
}

/**
 * Add a nested group to a filter group
 */
export function addGroupToGroup(
  parentGroup: FilterGroup,
  childGroup: FilterGroup
): FilterGroup {
  return {
    ...parentGroup,
    conditions: [...parentGroup.conditions, childGroup],
  };
}

/**
 * Remove a condition or group by ID
 */
export function removeFromGroup(group: FilterGroup, id: string): FilterGroup {
  return {
    ...group,
    conditions: group.conditions
      .filter(item => item.id !== id)
      .map(item => ('conditions' in item ? removeFromGroup(item, id) : item)),
  };
}

/**
 * Update a condition in a filter group
 */
export function updateConditionInGroup(
  group: FilterGroup,
  conditionId: string,
  updates: Partial<FilterCondition>
): FilterGroup {
  return {
    ...group,
    conditions: group.conditions.map(item => {
      if ('conditions' in item) {
        // It's a nested group
        return updateConditionInGroup(item, conditionId, updates);
      }
      if (item.id === conditionId) {
        return { ...item, ...updates };
      }
      return item;
    }),
  };
}

/**
 * Check if a value matches a filter condition
 */
export function matchesCondition<T extends Record<string, unknown>>(
  item: T,
  condition: FilterCondition
): boolean {
  const fieldValue = item[condition.field];
  const { operator, value, valueEnd } = condition;

  // Handle empty operators
  if (operator === 'is_empty') {
    return (
      fieldValue === null ||
      fieldValue === undefined ||
      fieldValue === '' ||
      (Array.isArray(fieldValue) && fieldValue.length === 0)
    );
  }

  if (operator === 'is_not_empty') {
    return (
      fieldValue !== null &&
      fieldValue !== undefined &&
      fieldValue !== '' &&
      (!Array.isArray(fieldValue) || fieldValue.length > 0)
    );
  }

  // Null/undefined checks for other operators
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }

  // String operations
  if (typeof fieldValue === 'string') {
    const strValue = fieldValue.toLowerCase();
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
      case 'in':
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase() === strValue);
        }
        return false;
      case 'not_in':
        if (Array.isArray(value)) {
          return !value.some(v => String(v).toLowerCase() === strValue);
        }
        return true;
      default:
        return false;
    }
  }

  // Number operations
  if (typeof fieldValue === 'number') {
    const numValue = fieldValue;
    const compareValue = typeof value === 'number' ? value : Number(value);

    switch (operator) {
      case 'equals':
        return numValue === compareValue;
      case 'not_equals':
        return numValue !== compareValue;
      case 'greater_than':
        return numValue > compareValue;
      case 'less_than':
        return numValue < compareValue;
      case 'greater_than_or_equal':
        return numValue >= compareValue;
      case 'less_than_or_equal':
        return numValue <= compareValue;
      case 'between':
        if (valueEnd !== undefined) {
          const endValue = typeof valueEnd === 'number' ? valueEnd : Number(valueEnd);
          return numValue >= compareValue && numValue <= endValue;
        }
        return false;
      default:
        return false;
    }
  }

  // Boolean operations
  if (typeof fieldValue === 'boolean') {
    const boolValue = fieldValue;
    const compareBool = value === true || value === 'true';

    switch (operator) {
      case 'equals':
        return boolValue === compareBool;
      case 'not_equals':
        return boolValue !== compareBool;
      default:
        return false;
    }
  }

  // Date operations
  if (fieldValue instanceof Date) {
    const dateValue = fieldValue.getTime();
    const compareDate = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();

    switch (operator) {
      case 'equals':
        return dateValue === compareDate;
      case 'not_equals':
        return dateValue !== compareDate;
      case 'greater_than':
        return dateValue > compareDate;
      case 'less_than':
        return dateValue < compareDate;
      case 'between':
        if (valueEnd !== undefined) {
          const endDate =
            valueEnd instanceof Date ? valueEnd.getTime() : new Date(String(valueEnd)).getTime();
          return dateValue >= compareDate && dateValue <= endDate;
        }
        return false;
      default:
        return false;
    }
  }

  // Array operations
  if (Array.isArray(fieldValue)) {
    switch (operator) {
      case 'contains':
        return fieldValue.some(
          v => String(v).toLowerCase() === String(value).toLowerCase()
        );
      case 'not_contains':
        return !fieldValue.some(
          v => String(v).toLowerCase() === String(value).toLowerCase()
        );
      case 'in':
        if (Array.isArray(value)) {
          return value.some(v =>
            fieldValue.some(fv => String(fv).toLowerCase() === String(v).toLowerCase())
          );
        }
        return false;
      case 'not_in':
        if (Array.isArray(value)) {
          return !value.some(v =>
            fieldValue.some(fv => String(fv).toLowerCase() === String(v).toLowerCase())
          );
        }
        return true;
      default:
        return false;
    }
  }

  // Enum/in operations for string values
  if (operator === 'in' && Array.isArray(value)) {
    return value.some(v => String(v).toLowerCase() === String(fieldValue).toLowerCase());
  }
  if (operator === 'not_in' && Array.isArray(value)) {
    return !value.some(v => String(v).toLowerCase() === String(fieldValue).toLowerCase());
  }

  return false;
}

/**
 * Check if an item matches a filter group
 */
export function matchesGroup<T extends Record<string, unknown>>(
  item: T,
  group: FilterGroup
): boolean {
  if (group.conditions.length === 0) {
    return true; // Empty filter matches everything
  }

  const results = group.conditions.map(condition => {
    if ('conditions' in condition) {
      // It's a nested group
      return matchesGroup(item, condition);
    }
    // It's a condition
    return matchesCondition(item, condition);
  });

  if (group.type === 'and') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

/**
 * Apply a filter definition to an array of items
 */
export function applyFilter<T extends Record<string, unknown>>(
  items: T[],
  filter: FilterDefinition
): T[] {
  return items.filter(item => matchesGroup(item, filter.rootGroup));
}

/**
 * Serialize a filter to JSON
 */
export function serializeFilter(filter: FilterDefinition): string {
  return JSON.stringify({
    ...filter,
    createdAt: filter.createdAt.toISOString(),
    updatedAt: filter.updatedAt.toISOString(),
  });
}

/**
 * Deserialize a filter from JSON
 */
export function deserializeFilter(json: string): FilterDefinition {
  const parsed = JSON.parse(json);
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
  };
}

/**
 * Get default filterable fields for prospects
 */
export function getProspectFilterableFields(): FilterableField[] {
  return [
    { name: 'firstName', label: 'First Name', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'lastName', label: 'Last Name', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'fullName', label: 'Full Name', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'email', label: 'Email', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'company', label: 'Company', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'title', label: 'Title', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'location', label: 'Location', type: 'string', operators: OPERATORS_BY_TYPE.string },
    {
      name: 'status',
      label: 'Status',
      type: 'enum',
      operators: OPERATORS_BY_TYPE.enum,
      enumValues: [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'qualified', label: 'Qualified' },
        { value: 'negotiating', label: 'Negotiating' },
        { value: 'won', label: 'Won' },
        { value: 'lost', label: 'Lost' },
      ],
    },
    { name: 'tags', label: 'Tags', type: 'array', operators: OPERATORS_BY_TYPE.array },
    { name: 'createdAt', label: 'Created At', type: 'date', operators: OPERATORS_BY_TYPE.date },
    { name: 'lastContactedAt', label: 'Last Contacted', type: 'date', operators: OPERATORS_BY_TYPE.date },
  ];
}

/**
 * Get default filterable fields for companies
 */
export function getCompanyFilterableFields(): FilterableField[] {
  return [
    { name: 'name', label: 'Company Name', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'domain', label: 'Domain', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'industry', label: 'Industry', type: 'string', operators: OPERATORS_BY_TYPE.string },
    {
      name: 'size',
      label: 'Company Size',
      type: 'enum',
      operators: OPERATORS_BY_TYPE.enum,
      enumValues: [
        { value: '1-10', label: '1-10' },
        { value: '11-50', label: '11-50' },
        { value: '51-200', label: '51-200' },
        { value: '201-500', label: '201-500' },
        { value: '501-1000', label: '501-1000' },
        { value: '1001-5000', label: '1001-5000' },
        { value: '5000+', label: '5000+' },
      ],
    },
    { name: 'location', label: 'Location', type: 'string', operators: OPERATORS_BY_TYPE.string },
    { name: 'tags', label: 'Tags', type: 'array', operators: OPERATORS_BY_TYPE.array },
  ];
}

/**
 * Create a quick filter for common use cases
 */
export function createQuickFilter(
  name: string,
  field: string,
  operator: FilterOperator,
  value: FilterValue
): FilterDefinition {
  const filter = createFilterDefinition(name);
  filter.isQuickFilter = true;
  filter.rootGroup = addConditionToGroup(
    filter.rootGroup,
    createCondition(field, operator, value)
  );
  return filter;
}

/**
 * Count conditions in a filter
 */
export function countConditions(group: FilterGroup): number {
  return group.conditions.reduce((count, item) => {
    if ('conditions' in item) {
      return count + countConditions(item);
    }
    return count + 1;
  }, 0);
}

/**
 * Validate a filter definition
 */
export function validateFilter(filter: FilterDefinition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!filter.name || filter.name.trim() === '') {
    errors.push('Filter name is required');
  }

  const validateGroup = (group: FilterGroup, path: string) => {
    for (let i = 0; i < group.conditions.length; i++) {
      const item = group.conditions[i];
      const itemPath = `${path}[${i}]`;

      if ('conditions' in item) {
        validateGroup(item, itemPath);
      } else {
        if (!item.field || item.field.trim() === '') {
          errors.push(`Condition at ${itemPath} is missing a field`);
        }
        if (!NO_VALUE_OPERATORS.includes(item.operator)) {
          if (item.value === '' || item.value === undefined) {
            errors.push(`Condition at ${itemPath} is missing a value`);
          }
        }
      }
    }
  };

  validateGroup(filter.rootGroup, 'root');

  return {
    valid: errors.length === 0,
    errors,
  };
}
