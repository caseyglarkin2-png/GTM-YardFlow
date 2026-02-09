/**
 * HubSpot Field Mapping Configuration
 * Sprint 26 - T26.4
 * 
 * Defines bi-directional mappings between YardFlow Prospect fields and HubSpot Contact properties.
 */

import { z } from 'zod';

/**
 * Transform types for field value conversion
 */
export type TransformType = 
  | 'none'          // Pass through unchanged
  | 'lowercase'     // Convert to lowercase
  | 'uppercase'     // Convert to uppercase  
  | 'splitName'     // "John Doe" → { first: "John", last: "Doe" }
  | 'joinName'      // { first: "John", last: "Doe" } → "John Doe"
  | 'e164'          // Phone to E.164 format
  | 'extractLinkedInId' // URL to LinkedIn ID
  | 'statusMap'     // YardFlow status ↔ HubSpot lead status
  | 'timestamp'     // Date string ↔ Unix timestamp
  | 'boolean'       // Boolean ↔ "true"/"false" string
  | 'number'        // Number ↔ string
  | 'custom';       // Custom function

/**
 * Field mapping definition
 */
export interface FieldMapping {
  /** YardFlow prospect field path (dot notation for nested) */
  yardflow: string;
  /** HubSpot property name(s) - comma separated for compound fields */
  hubspot: string;
  /** Transform to apply */
  transform: TransformType;
  /** Custom transform function name (when transform = 'custom') */
  customTransform?: string;
  /** Is this field required for sync? */
  required?: boolean;
  /** Direction: 'push' only, 'pull' only, or 'bidirectional' */
  direction?: 'push' | 'pull' | 'bidirectional';
  /** Priority for conflict resolution (higher wins) */
  priority?: number;
  /** Don't overwrite if target has value */
  preserveExisting?: boolean;
}

/**
 * Zod schema for FieldMapping
 */
export const FieldMappingSchema = z.object({
  yardflow: z.string(),
  hubspot: z.string(),
  transform: z.enum([
    'none', 'lowercase', 'uppercase', 'splitName', 'joinName',
    'e164', 'extractLinkedInId', 'statusMap', 'timestamp',
    'boolean', 'number', 'custom'
  ]),
  customTransform: z.string().optional(),
  required: z.boolean().optional(),
  direction: z.enum(['push', 'pull', 'bidirectional']).optional(),
  priority: z.number().optional(),
  preserveExisting: z.boolean().optional(),
});

/**
 * Default field mappings for YardFlow ↔ HubSpot
 */
export const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  // Core contact fields
  {
    yardflow: 'name',
    hubspot: 'firstname,lastname',
    transform: 'splitName',
    required: true,
    direction: 'bidirectional',
    priority: 1,
  },
  {
    yardflow: 'email',
    hubspot: 'email',
    transform: 'lowercase',
    required: true,
    direction: 'bidirectional',
    priority: 1,
  },
  {
    yardflow: 'company',
    hubspot: 'company',
    transform: 'none',
    direction: 'bidirectional',
  },
  {
    yardflow: 'title',
    hubspot: 'jobtitle',
    transform: 'none',
    direction: 'bidirectional',
  },
  {
    yardflow: 'phone',
    hubspot: 'phone',
    transform: 'e164',
    direction: 'bidirectional',
  },
  
  // Social/Online presence
  {
    yardflow: 'linkedinUrl',
    hubspot: 'hs_linkedinid',
    transform: 'extractLinkedInId',
    direction: 'push', // LinkedIn ID harder to reconstruct
  },
  {
    yardflow: 'website',
    hubspot: 'website',
    transform: 'none',
    direction: 'bidirectional',
  },
  
  // Lead management
  {
    yardflow: 'status',
    hubspot: 'hs_lead_status',
    transform: 'statusMap',
    direction: 'bidirectional',
    priority: 2,
  },
  {
    yardflow: 'score',
    hubspot: 'hs_predictive_lead_score',
    transform: 'number',
    direction: 'push',
    preserveExisting: true,
  },
  
  // Location
  {
    yardflow: 'city',
    hubspot: 'city',
    transform: 'none',
    direction: 'bidirectional',
  },
  {
    yardflow: 'state',
    hubspot: 'state',
    transform: 'none',
    direction: 'bidirectional',
  },
  {
    yardflow: 'country',
    hubspot: 'country',
    transform: 'none',
    direction: 'bidirectional',
  },
  
  // YardFlow custom properties (require HubSpot custom property setup)
  {
    yardflow: 'segment',
    hubspot: 'yardflow_segment',
    transform: 'none',
    direction: 'push',
  },
  {
    yardflow: 'source',
    hubspot: 'yardflow_source',
    transform: 'none',
    direction: 'push',
  },
  {
    yardflow: 'tags',
    hubspot: 'yardflow_tags',
    transform: 'custom',
    customTransform: 'arrayToSemicolon',
    direction: 'bidirectional',
  },
  
  // Metadata
  {
    yardflow: 'createdAt',
    hubspot: 'createdate',
    transform: 'timestamp',
    direction: 'pull',
    preserveExisting: true,
  },
  {
    yardflow: 'updatedAt',
    hubspot: 'lastmodifieddate',
    transform: 'timestamp',
    direction: 'bidirectional',
  },
];

/**
 * Status mapping between YardFlow and HubSpot
 */
export const STATUS_MAP: Record<string, string> = {
  // YardFlow → HubSpot
  'new': 'NEW',
  'contacted': 'OPEN',
  'engaged': 'IN_PROGRESS',
  'qualified': 'OPEN_DEAL',
  'nurturing': 'OPEN',
  'converted': 'CUSTOMER',
  'lost': 'UNQUALIFIED',
  'churned': 'BAD_TIMING',
};

/**
 * Reverse status mapping (HubSpot → YardFlow)
 */
export const STATUS_MAP_REVERSE: Record<string, string> = {
  'NEW': 'new',
  'OPEN': 'contacted',
  'IN_PROGRESS': 'engaged',
  'OPEN_DEAL': 'qualified',
  'CUSTOMER': 'converted',
  'UNQUALIFIED': 'lost',
  'BAD_TIMING': 'churned',
  'ATTEMPTED_TO_CONTACT': 'contacted',
  'CONNECTED': 'engaged',
};

/**
 * HubSpot custom properties that need to be created
 */
export const CUSTOM_PROPERTIES = [
  {
    name: 'yardflow_segment',
    label: 'FreightRoll Segment',
    type: 'string',
    groupName: 'contactinformation',
    description: 'Segment assigned by FreightRoll',
  },
  {
    name: 'yardflow_source',
    label: 'FreightRoll Source',
    type: 'string',
    groupName: 'contactinformation',
    description: 'Lead source from FreightRoll',
  },
  {
    name: 'yardflow_tags',
    label: 'FreightRoll Tags',
    type: 'string',
    groupName: 'contactinformation',
    description: 'Tags from FreightRoll (semicolon separated)',
  },
  {
    name: 'yardflow_id',
    label: 'FreightRoll ID',
    type: 'string',
    groupName: 'contactinformation',
    description: 'Internal FreightRoll prospect ID for sync',
  },
  {
    name: 'yardflow_last_sync',
    label: 'FreightRoll Last Sync',
    type: 'datetime',
    groupName: 'contactinformation',
    description: 'Last sync timestamp with FreightRoll',
  },
];

/**
 * Get field mapping by YardFlow field name
 */
export function getMappingByYardFlowField(fieldName: string): FieldMapping | undefined {
  return DEFAULT_FIELD_MAPPINGS.find(m => m.yardflow === fieldName);
}

/**
 * Get field mapping by HubSpot property name
 */
export function getMappingByHubSpotProperty(propName: string): FieldMapping | undefined {
  return DEFAULT_FIELD_MAPPINGS.find(m => 
    m.hubspot === propName || m.hubspot.split(',').includes(propName)
  );
}

/**
 * Get all mappings for a specific direction
 */
export function getMappingsForDirection(
  direction: 'push' | 'pull' | 'bidirectional'
): FieldMapping[] {
  return DEFAULT_FIELD_MAPPINGS.filter(m => 
    m.direction === direction || m.direction === 'bidirectional' || !m.direction
  );
}

/**
 * Get required field mappings
 */
export function getRequiredMappings(): FieldMapping[] {
  return DEFAULT_FIELD_MAPPINGS.filter(m => m.required);
}
