/**
 * Conflict Resolver Service
 * Sprint 27 - T27.4
 * 
 * Handles document conflicts with configurable resolution strategies.
 */

export type ConflictStrategy = 'last-write-wins' | 'merge' | 'manual';

export interface ConflictField {
  field: string;
  strategy: ConflictStrategy;
  customMerge?: (local: unknown, remote: unknown) => unknown;
}

export interface DocumentVersion {
  id: string;
  data: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface ConflictResult {
  hasConflict: boolean;
  resolved: boolean;
  strategy: ConflictStrategy;
  resolvedData?: Record<string, unknown>;
  conflicts?: ConflictDetail[];
}

export interface ConflictDetail {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  baseValue?: unknown;
  selectedValue?: unknown;
}

export interface ConflictResolverConfig {
  defaultStrategy: ConflictStrategy;
  fieldStrategies?: ConflictField[];
  arrayMergeMode?: 'union' | 'replace' | 'concat';
  preserveLocalDrafts?: boolean;
}

const DEFAULT_CONFIG: ConflictResolverConfig = {
  defaultStrategy: 'last-write-wins',
  arrayMergeMode: 'union',
  preserveLocalDrafts: true,
};

/**
 * Create a Conflict Resolver
 */
export function createConflictResolver(config: Partial<ConflictResolverConfig> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Field-specific strategies
  const fieldStrategies = new Map<string, ConflictField>();
  for (const fs of cfg.fieldStrategies || []) {
    fieldStrategies.set(fs.field, fs);
  }

  /**
   * Detect if there's a conflict between local and remote versions
   */
  function detectConflict(
    local: DocumentVersion,
    remote: DocumentVersion,
    base?: DocumentVersion
  ): boolean {
    // No conflict if same version
    if (local.version === remote.version) {
      return false;
    }
    
    // Conflict if local was modified after base and remote differs
    if (base) {
      const localModified = local.updatedAt !== base.updatedAt;
      const remoteModified = remote.updatedAt !== base.updatedAt;
      return localModified && remoteModified;
    }
    
    // Simple comparison: conflict if both modified at different times
    return local.updatedAt !== remote.updatedAt;
  }

  /**
   * Resolve conflict between local and remote versions
   */
  function resolve(
    local: DocumentVersion,
    remote: DocumentVersion,
    base?: DocumentVersion
  ): ConflictResult {
    const hasConflict = detectConflict(local, remote, base);
    
    if (!hasConflict) {
      // No conflict - use remote as source of truth
      return {
        hasConflict: false,
        resolved: true,
        strategy: cfg.defaultStrategy,
        resolvedData: remote.data,
      };
    }

    // Check if all fields can be auto-resolved
    const conflicts: ConflictDetail[] = [];
    const resolvedData: Record<string, unknown> = {};
    
    // Get all unique fields
    const allFields = new Set([
      ...Object.keys(local.data),
      ...Object.keys(remote.data),
    ]);
    
    for (const field of allFields) {
      const localValue = local.data[field];
      const remoteValue = remote.data[field];
      const baseValue = base?.data[field];
      
      const fieldConfig = fieldStrategies.get(field) || { 
        field, 
        strategy: cfg.defaultStrategy 
      };
      
      const resolution = resolveField(
        field,
        localValue,
        remoteValue,
        baseValue,
        fieldConfig,
        local,
        remote
      );
      
      if (resolution.needsManualResolution) {
        conflicts.push({
          field,
          localValue,
          remoteValue,
          baseValue,
        });
      } else {
        resolvedData[field] = resolution.value;
      }
    }
    
    // If there are manual conflicts, we can't fully resolve
    if (conflicts.length > 0 && cfg.defaultStrategy === 'manual') {
      return {
        hasConflict: true,
        resolved: false,
        strategy: 'manual',
        conflicts,
        resolvedData, // Partial resolution
      };
    }
    
    // All resolved
    return {
      hasConflict: true,
      resolved: true,
      strategy: cfg.defaultStrategy,
      resolvedData,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Resolve a single field conflict
   */
  function resolveField(
    _field: string,
    localValue: unknown,
    remoteValue: unknown,
    baseValue: unknown,
    fieldConfig: ConflictField,
    local: DocumentVersion,
    remote: DocumentVersion
  ): { value: unknown; needsManualResolution: boolean } {
    // No conflict if values are equal
    if (deepEqual(localValue, remoteValue)) {
      return { value: remoteValue ?? localValue, needsManualResolution: false };
    }
    
    // Handle fields that only exist on one side
    if (localValue !== undefined && remoteValue === undefined) {
      // Field only in local
      if (baseValue !== undefined) {
        // Was deleted remotely - honor deletion
        return { value: undefined, needsManualResolution: false };
      }
      // New local field - keep it
      return { value: localValue, needsManualResolution: false };
    }
    
    if (localValue === undefined && remoteValue !== undefined) {
      // Field only in remote - use it
      return { value: remoteValue, needsManualResolution: false };
    }
    
    // If only one side changed from base, use that
    if (baseValue !== undefined) {
      const localChanged = !deepEqual(localValue, baseValue);
      const remoteChanged = !deepEqual(remoteValue, baseValue);
      
      if (!localChanged && remoteChanged) {
        return { value: remoteValue, needsManualResolution: false };
      }
      
      if (localChanged && !remoteChanged) {
        return { value: localValue, needsManualResolution: false };
      }
    }
    
    // Apply strategy
    switch (fieldConfig.strategy) {
      case 'last-write-wins':
        // Use the most recent value
        const localTime = new Date(local.updatedAt).getTime();
        const remoteTime = new Date(remote.updatedAt).getTime();
        return { 
          value: localTime > remoteTime ? localValue : remoteValue,
          needsManualResolution: false,
        };
      
      case 'merge':
        // Attempt to merge
        const merged = mergeValues(localValue, remoteValue, baseValue);
        return { value: merged, needsManualResolution: false };
      
      case 'manual':
        return { value: undefined, needsManualResolution: true };
      
      default:
        // Custom merge function
        if (fieldConfig.customMerge) {
          return { 
            value: fieldConfig.customMerge(localValue, remoteValue),
            needsManualResolution: false,
          };
        }
        return { value: remoteValue, needsManualResolution: false };
    }
  }

  /**
   * Merge two values intelligently
   */
  function mergeValues(local: unknown, remote: unknown, base?: unknown): unknown {
    // Arrays: use configured merge mode
    if (Array.isArray(local) && Array.isArray(remote)) {
      return mergeArrays(local, remote, base as unknown[] | undefined);
    }
    
    // Objects: deep merge
    if (isPlainObject(local) && isPlainObject(remote)) {
      return mergeObjects(
        local as Record<string, unknown>,
        remote as Record<string, unknown>,
        base as Record<string, unknown> | undefined
      );
    }
    
    // Primitives: last-write-wins
    return remote;
  }

  /**
   * Merge arrays based on configured mode
   */
  function mergeArrays(local: unknown[], remote: unknown[], base?: unknown[]): unknown[] {
    switch (cfg.arrayMergeMode) {
      case 'union':
        // Combine unique values
        const set = new Set([...local, ...remote]);
        return Array.from(set);
      
      case 'concat':
        // Add new items from both
        if (base) {
          const localAdded = local.filter(v => !base.includes(v));
          const remoteAdded = remote.filter(v => !base.includes(v));
          const localRemoved = base.filter(v => !local.includes(v));
          const remoteRemoved = base.filter(v => !remote.includes(v));
          
          // Start with base, add both additions, remove both removals
          let result = [...base];
          result.push(...localAdded.filter(v => !result.includes(v)));
          result.push(...remoteAdded.filter(v => !result.includes(v)));
          result = result.filter(v => !localRemoved.includes(v) && !remoteRemoved.includes(v));
          return result;
        }
        return [...new Set([...local, ...remote])];
      
      case 'replace':
      default:
        return remote;
    }
  }

  /**
   * Deep merge objects
   */
  function mergeObjects(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
    base?: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...remote };
    
    for (const key of Object.keys(local)) {
      if (!(key in remote)) {
        // Field exists only in local
        if (base && key in base) {
          // Was deleted remotely - honor deletion
          continue;
        }
        // New local field - keep it
        result[key] = local[key];
      } else {
        // Field exists in both - merge recursively
        result[key] = mergeValues(local[key], remote[key], base?.[key]);
      }
    }
    
    return result;
  }

  /**
   * Apply manual resolution choices
   */
  function applyManualResolution(
    conflicts: ConflictDetail[],
    choices: Array<{ field: string; choice: 'local' | 'remote' | 'custom'; customValue?: unknown }>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    
    for (const conflict of conflicts) {
      const choice = choices.find(c => c.field === conflict.field);
      
      if (!choice) {
        // Default to remote
        resolved[conflict.field] = conflict.remoteValue;
      } else {
        switch (choice.choice) {
          case 'local':
            resolved[conflict.field] = conflict.localValue;
            break;
          case 'remote':
            resolved[conflict.field] = conflict.remoteValue;
            break;
          case 'custom':
            resolved[conflict.field] = choice.customValue;
            break;
        }
      }
    }
    
    return resolved;
  }

  /**
   * Check if value is a plain object
   */
  function isPlainObject(value: unknown): boolean {
    return typeof value === 'object' && 
           value !== null && 
           !Array.isArray(value) &&
           Object.getPrototypeOf(value) === Object.prototype;
  }

  /**
   * Deep equality check
   */
  function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    
    if (typeof a !== typeof b) return false;
    
    if (a === null || b === null) return a === b;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((v, i) => deepEqual(v, b[i]));
    }
    
    if (isPlainObject(a) && isPlainObject(b)) {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);
      
      if (aKeys.length !== bKeys.length) return false;
      return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
    }
    
    return false;
  }

  /**
   * Create a document version from data
   */
  function createVersion(
    id: string,
    data: Record<string, unknown>,
    userId: string,
    version = 1
  ): DocumentVersion {
    return {
      id,
      data,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
      version,
    };
  }

  /**
   * Set field-specific strategy
   */
  function setFieldStrategy(field: string, strategy: ConflictStrategy): void {
    fieldStrategies.set(field, { field, strategy });
  }

  return {
    resolve,
    detectConflict,
    applyManualResolution,
    createVersion,
    setFieldStrategy,
    deepEqual,
  };
}

export type ConflictResolver = ReturnType<typeof createConflictResolver>;
