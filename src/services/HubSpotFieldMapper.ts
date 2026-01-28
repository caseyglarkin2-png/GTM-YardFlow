/**
 * HubSpot Field Mapping Service
 * Sprint 26 - T26.4
 * 
 * Handles bi-directional field transformation between YardFlow Prospects and HubSpot Contacts.
 */

import {
  DEFAULT_FIELD_MAPPINGS,
  STATUS_MAP,
  STATUS_MAP_REVERSE,
  type FieldMapping,
  type TransformType,
} from '../config/hubspotFieldMap';
import type { HubSpotContact } from '../types/hubspot';

/**
 * Prospect type (minimal interface for mapping)
 */
export interface ProspectFields {
  id?: string;
  name?: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
  website?: string;
  status?: string;
  score?: number;
  city?: string;
  state?: string;
  country?: string;
  segment?: string;
  source?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * HubSpot contact properties
 */
export type HubSpotProperties = Record<string, string | number | null | undefined>;

/**
 * Conflict record for sync resolution
 */
export interface FieldConflict {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
}

/**
 * Mapping result with potential conflicts
 */
export interface MappingResult {
  properties: HubSpotProperties;
  conflicts: FieldConflict[];
  skipped: string[];
}

/**
 * Custom transform functions
 */
const customTransforms: Record<string, (value: unknown, reverse?: boolean) => unknown> = {
  arrayToSemicolon: (value, reverse) => {
    if (reverse) {
      return typeof value === 'string' ? value.split(';').map(s => s.trim()).filter(Boolean) : [];
    }
    return Array.isArray(value) ? value.join(';') : '';
  },
};

/**
 * Field Mapper Service Factory
 */
export function createFieldMapper(
  options: {
    mappings?: FieldMapping[];
    customTransforms?: Record<string, (value: unknown, reverse?: boolean) => unknown>;
  } = {}
) {
  const mappings = options.mappings || DEFAULT_FIELD_MAPPINGS;
  const transforms = { ...customTransforms, ...options.customTransforms };

  /**
   * Split a full name into first and last name
   * Handles multi-part names: "Mary Jane Watson" → { first: "Mary Jane", last: "Watson" }
   */
  function splitName(fullName: string): { first: string; last: string } {
    if (!fullName || typeof fullName !== 'string') {
      return { first: '', last: '' };
    }
    
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length === 1) {
      return { first: parts[0], last: '' };
    }
    
    // Last word is last name, everything else is first name
    const last = parts.pop() || '';
    const first = parts.join(' ');
    
    return { first, last };
  }

  /**
   * Join first and last name
   */
  function joinName(first: string | undefined, last: string | undefined): string {
    const parts = [first, last].filter(Boolean);
    return parts.join(' ');
  }

  /**
   * Convert phone to E.164 format (simplified)
   */
  function toE164(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');
    
    // If US number without country code, add +1
    if (digits.length === 10) {
      digits = '1' + digits;
    }
    
    // If has country code, add +
    if (digits.length >= 11) {
      return '+' + digits;
    }
    
    return phone; // Return original if can't parse
  }

  /**
   * Extract LinkedIn ID from URL
   */
  function extractLinkedInId(url: string): string {
    if (!url) return '';
    
    // Match patterns like linkedin.com/in/username or linkedin.com/pub/name/x/y/z
    const match = url.match(/linkedin\.com\/(?:in|pub)\/([^\/\?]+)/i);
    return match ? match[1] : url;
  }

  /**
   * Convert status between systems
   */
  function mapStatus(status: string, toHubSpot: boolean): string {
    if (!status) return '';
    
    const map = toHubSpot ? STATUS_MAP : STATUS_MAP_REVERSE;
    return map[status.toLowerCase()] || map[status.toUpperCase()] || status;
  }

  /**
   * Convert timestamp
   */
  function convertTimestamp(value: unknown, toHubSpot: boolean): unknown {
    if (!value) return null;
    
    if (toHubSpot) {
      // ISO string to Unix timestamp (ms)
      if (typeof value === 'string') {
        return new Date(value).getTime();
      }
      return value;
    } else {
      // Unix timestamp to ISO string
      if (typeof value === 'number') {
        return new Date(value).toISOString();
      }
      return value;
    }
  }

  /**
   * Apply transform to a value
   */
  function applyTransform(
    value: unknown,
    transform: TransformType,
    customTransformName?: string,
    toHubSpot: boolean = true
  ): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    switch (transform) {
      case 'none':
        return value;

      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;

      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;

      case 'splitName':
        // This is handled specially in the mapping logic
        return value;

      case 'joinName':
        // This is handled specially in the mapping logic
        return value;

      case 'e164':
        return toHubSpot ? toE164(String(value)) : value;

      case 'extractLinkedInId':
        return toHubSpot ? extractLinkedInId(String(value)) : value;

      case 'statusMap':
        return mapStatus(String(value), toHubSpot);

      case 'timestamp':
        return convertTimestamp(value, toHubSpot);

      case 'boolean':
        return toHubSpot 
          ? String(Boolean(value)).toLowerCase()
          : value === 'true' || value === true;

      case 'number':
        return toHubSpot 
          ? String(value) 
          : typeof value === 'string' ? parseFloat(value) : value;

      case 'custom':
        if (customTransformName && transforms[customTransformName]) {
          return transforms[customTransformName](value, !toHubSpot);
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Convert YardFlow Prospect to HubSpot Contact properties
   */
  function prospectToHubSpot(
    prospect: ProspectFields,
    existingContact?: HubSpotContact
  ): MappingResult {
    const properties: HubSpotProperties = {};
    const conflicts: FieldConflict[] = [];
    const skipped: string[] = [];

    for (const mapping of mappings) {
      // Skip pull-only mappings
      if (mapping.direction === 'pull') {
        skipped.push(mapping.yardflow);
        continue;
      }

      const value = getNestedValue(prospect as Record<string, unknown>, mapping.yardflow);

      // Skip null/undefined values (don't overwrite with nulls)
      if (value === null || value === undefined) {
        skipped.push(mapping.yardflow);
        continue;
      }

      // Handle name splitting specially
      if (mapping.transform === 'splitName') {
        const { first, last } = splitName(String(value));
        const [firstProp, lastProp] = mapping.hubspot.split(',');
        
        if (first) properties[firstProp] = first;
        if (last) properties[lastProp] = last;
        continue;
      }

      // Check for conflicts with existing contact
      if (existingContact && mapping.priority) {
        const existingValue = existingContact.properties[mapping.hubspot];
        if (existingValue !== undefined && existingValue !== null) {
          const transformedValue = applyTransform(value, mapping.transform, mapping.customTransform, true);
          
          if (String(existingValue) !== String(transformedValue)) {
            // Check timestamps to determine winner
            const localTime = new Date(prospect.updatedAt || 0).getTime();
            const remoteTime = new Date(existingContact.updatedAt).getTime();
            
            if (remoteTime > localTime && mapping.preserveExisting) {
              conflicts.push({
                field: mapping.yardflow,
                localValue: value,
                remoteValue: existingValue,
                localUpdatedAt: prospect.updatedAt || '',
                remoteUpdatedAt: existingContact.updatedAt,
              });
              skipped.push(mapping.yardflow);
              continue;
            }
          }
        }
      }

      // Apply transform
      const transformed = applyTransform(value, mapping.transform, mapping.customTransform, true);
      
      if (transformed !== null && transformed !== undefined) {
        properties[mapping.hubspot] = transformed as string | number;
      }
    }

    // Add YardFlow ID for linking
    if (prospect.id) {
      properties['yardflow_id'] = prospect.id;
    }

    // Add sync timestamp
    properties['yardflow_last_sync'] = Date.now();

    return { properties, conflicts, skipped };
  }

  /**
   * Convert HubSpot Contact to YardFlow Prospect fields
   */
  function hubSpotToProspect(
    contact: HubSpotContact,
    existingProspect?: ProspectFields
  ): MappingResult {
    const properties: Record<string, unknown> = {};
    const conflicts: FieldConflict[] = [];
    const skipped: string[] = [];

    for (const mapping of mappings) {
      // Skip push-only mappings
      if (mapping.direction === 'push') {
        skipped.push(mapping.hubspot);
        continue;
      }

      // Handle name joining specially
      if (mapping.transform === 'splitName' || mapping.transform === 'joinName') {
        const [firstProp, lastProp] = mapping.hubspot.split(',');
        const first = contact.properties[firstProp];
        const last = contact.properties[lastProp];
        
        const fullName = joinName(
          first as string | undefined,
          last as string | undefined
        );
        
        if (fullName) {
          properties[mapping.yardflow] = fullName;
        }
        continue;
      }

      const value = contact.properties[mapping.hubspot];

      // Skip null/undefined values
      if (value === null || value === undefined || value === '') {
        skipped.push(mapping.hubspot);
        continue;
      }

      // Check for conflicts with existing prospect
      if (existingProspect && mapping.priority) {
        const existingValue = getNestedValue(
          existingProspect as Record<string, unknown>, 
          mapping.yardflow
        );
        
        if (existingValue !== undefined && existingValue !== null) {
          const transformedValue = applyTransform(value, mapping.transform, mapping.customTransform, false);
          
          if (String(existingValue) !== String(transformedValue)) {
            const localTime = new Date(existingProspect.updatedAt || 0).getTime();
            const remoteTime = new Date(contact.updatedAt).getTime();
            
            if (localTime > remoteTime && mapping.preserveExisting) {
              conflicts.push({
                field: mapping.yardflow,
                localValue: existingValue,
                remoteValue: value,
                localUpdatedAt: existingProspect.updatedAt || '',
                remoteUpdatedAt: contact.updatedAt,
              });
              skipped.push(mapping.hubspot);
              continue;
            }
          }
        }
      }

      // Apply reverse transform
      const transformed = applyTransform(value, mapping.transform, mapping.customTransform, false);
      
      if (transformed !== null && transformed !== undefined) {
        properties[mapping.yardflow] = transformed;
      }
    }

    // Extract HubSpot ID
    properties['hubspotId'] = contact.id;

    return { 
      properties: properties as unknown as HubSpotProperties, 
      conflicts, 
      skipped 
    };
  }

  /**
   * Get required fields that are missing from a prospect
   */
  function getMissingRequiredFields(prospect: ProspectFields): string[] {
    const missing: string[] = [];
    
    for (const mapping of mappings) {
      if (mapping.required && mapping.direction !== 'pull') {
        const value = getNestedValue(prospect as Record<string, unknown>, mapping.yardflow);
        if (value === null || value === undefined || value === '') {
          missing.push(mapping.yardflow);
        }
      }
    }
    
    return missing;
  }

  /**
   * Validate that a prospect has all required fields
   */
  function validateProspectForSync(prospect: ProspectFields): { 
    valid: boolean; 
    missing: string[] 
  } {
    const missing = getMissingRequiredFields(prospect);
    return { valid: missing.length === 0, missing };
  }

  return {
    prospectToHubSpot,
    hubSpotToProspect,
    getMissingRequiredFields,
    validateProspectForSync,
    splitName,
    joinName,
    applyTransform,
    mapStatus,
    toE164,
    extractLinkedInId,
  };
}

/**
 * Default field mapper instance
 */
export const fieldMapper = createFieldMapper();

export type FieldMapper = ReturnType<typeof createFieldMapper>;
