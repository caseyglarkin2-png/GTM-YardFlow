/**
 * HubSpot CRM Integration Types
 * Sprint 26 - T26.1
 */

import { z } from 'zod';

// =============================================================================
// API Response Types
// =============================================================================

export const HubSpotPaginationSchema = z.object({
  after: z.string().optional(),
  link: z.string().optional(),
});

export const HubSpotPagingSchema = z.object({
  next: HubSpotPaginationSchema.optional(),
});

// =============================================================================
// Contact Types
// =============================================================================

export const HubSpotContactPropertiesSchema = z.object({
  email: z.string().email().optional().nullable(),
  firstname: z.string().optional().nullable(),
  lastname: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  jobtitle: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  hs_linkedinid: z.string().optional().nullable(),
  hs_lead_status: z.string().optional().nullable(),
  notes_last_contacted: z.string().optional().nullable(),
  createdate: z.string().optional(),
  lastmodifieddate: z.string().optional(),
  hs_object_id: z.string().optional(),
  
  // YardFlow custom properties
  yardflow_id: z.string().optional().nullable(),
  yardflow_tier: z.string().optional().nullable(),
  yardflow_persona: z.string().optional().nullable(),
  yardflow_last_sync: z.string().optional().nullable(),
  yardflow_tags: z.string().optional().nullable(),
}).passthrough();

export const HubSpotContactSchema = z.object({
  id: z.string(),
  properties: HubSpotContactPropertiesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean().optional(),
});

export type HubSpotContactProperties = z.infer<typeof HubSpotContactPropertiesSchema>;
export type HubSpotContact = z.infer<typeof HubSpotContactSchema>;

// =============================================================================
// Deal Types
// =============================================================================

export const HubSpotDealStageSchema = z.enum([
  'appointmentscheduled',
  'qualifiedtobuy',
  'presentationscheduled',
  'decisionmakerboughtin',
  'contractsent',
  'closedwon',
  'closedlost',
]);

export const HubSpotDealPropertiesSchema = z.object({
  dealname: z.string(),
  amount: z.string().optional().nullable(),
  dealstage: z.string(),
  closedate: z.string().optional().nullable(),
  pipeline: z.string().optional(),
  hs_object_id: z.string().optional(),
  createdate: z.string().optional(),
  lastmodifieddate: z.string().optional(),
  hs_associated_contact_ids: z.string().optional().nullable(),
  
  // YardFlow custom properties
  yardflow_prospect_id: z.string().optional().nullable(),
  yardflow_roi_estimate: z.string().optional().nullable(),
}).passthrough();

export const HubSpotDealSchema = z.object({
  id: z.string(),
  properties: HubSpotDealPropertiesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean().optional(),
});

export type HubSpotDealProperties = z.infer<typeof HubSpotDealPropertiesSchema>;
export type HubSpotDeal = z.infer<typeof HubSpotDealSchema>;
export type HubSpotDealStage = z.infer<typeof HubSpotDealStageSchema>;

// =============================================================================
// Engagement/Activity Types
// =============================================================================

export const HubSpotEngagementTypeSchema = z.enum([
  'NOTE',
  'EMAIL',
  'TASK',
  'MEETING',
  'CALL',
]);

export const HubSpotEngagementSchema = z.object({
  id: z.string(),
  type: HubSpotEngagementTypeSchema,
  properties: z.object({
    hs_timestamp: z.string(),
    hs_body_preview: z.string().optional().nullable(),
    hs_note_body: z.string().optional().nullable(),
    hs_email_subject: z.string().optional().nullable(),
    hs_email_text: z.string().optional().nullable(),
    hs_task_subject: z.string().optional().nullable(),
    hs_task_body: z.string().optional().nullable(),
    hs_task_status: z.string().optional().nullable(),
    hs_meeting_title: z.string().optional().nullable(),
    hs_call_title: z.string().optional().nullable(),
    hs_call_duration: z.string().optional().nullable(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type HubSpotEngagementType = z.infer<typeof HubSpotEngagementTypeSchema>;
export type HubSpotEngagement = z.infer<typeof HubSpotEngagementSchema>;

// =============================================================================
// Owner Types
// =============================================================================

export const HubSpotOwnerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  userId: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean().optional(),
});

export type HubSpotOwner = z.infer<typeof HubSpotOwnerSchema>;

// =============================================================================
// API Response Wrappers
// =============================================================================

export const HubSpotContactsResponseSchema = z.object({
  results: z.array(HubSpotContactSchema),
  paging: HubSpotPagingSchema.optional(),
});

export const HubSpotDealsResponseSchema = z.object({
  results: z.array(HubSpotDealSchema),
  paging: HubSpotPagingSchema.optional(),
});

export const HubSpotSearchResponseSchema = z.object({
  total: z.number(),
  results: z.array(HubSpotContactSchema),
  paging: HubSpotPagingSchema.optional(),
});

export type HubSpotContactsResponse = z.infer<typeof HubSpotContactsResponseSchema>;
export type HubSpotDealsResponse = z.infer<typeof HubSpotDealsResponseSchema>;
export type HubSpotSearchResponse = z.infer<typeof HubSpotSearchResponseSchema>;

// =============================================================================
// Error Types
// =============================================================================

export const HubSpotErrorDetailSchema = z.object({
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const HubSpotErrorSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
  correlationId: z.string().optional(),
  category: z.string().optional(),
  errors: z.array(HubSpotErrorDetailSchema).optional(),
});

export type HubSpotError = z.infer<typeof HubSpotErrorSchema>;

export class HubSpotApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly correlationId?: string,
    public readonly category?: string,
  ) {
    super(message);
    this.name = 'HubSpotApiError';
  }

  static fromResponse(status: number, error: HubSpotError): HubSpotApiError {
    return new HubSpotApiError(
      error.message,
      status,
      error.correlationId,
      error.category,
    );
  }
}

export class RateLimitError extends HubSpotApiError {
  constructor(
    public readonly retryAfter: number,
    correlationId?: string,
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, 429, correlationId, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends HubSpotApiError {
  constructor(message: string, correlationId?: string) {
    super(message, 401, correlationId, 'AUTHENTICATION');
    this.name = 'AuthenticationError';
  }
}

// =============================================================================
// Token Types
// =============================================================================

export const HubSpotTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  expiresAt: z.number(), // Unix timestamp
  tokenType: z.literal('bearer'),
});

export type HubSpotTokens = z.infer<typeof HubSpotTokensSchema>;

// =============================================================================
// Sync Types
// =============================================================================

export const SyncDirectionSchema = z.enum(['push', 'pull', 'bidirectional']);
export type SyncDirection = z.infer<typeof SyncDirectionSchema>;

export interface SyncStatus {
  lastSyncAt: string | null;
  inProgress: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  nextSyncAt: string | null;
  duration?: number;
}

export interface SyncError {
  recordId: string;
  error: string;
  timestamp: string;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  errors: SyncError[];
  conflicts: ConflictRecord[];
}

export interface ConflictRecord {
  id: string;
  prospectId: string;
  hubspotId: string;
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  detectedAt: string;
  resolved: boolean;
  resolution?: 'local' | 'remote';
  resolvedAt?: string;
}

export interface SyncState {
  lastSyncAt: string | null;
  inProgress: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  nextSyncAt: string | null;
  duration?: number;
  pendingCount?: number;
  direction?: SyncDirection;
}

// =============================================================================
// Input Types for Creating/Updating
// =============================================================================

export interface CreateContactInput {
  email?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  jobtitle?: string;
  phone?: string;
  hs_linkedinid?: string;
  hs_lead_status?: string;
  yardflow_id?: string;
  yardflow_tier?: string;
  yardflow_persona?: string;
}

export interface CreateDealInput {
  dealname: string;
  amount?: string;
  dealstage: string;
  closedate?: string;
  pipeline?: string;
  yardflow_prospect_id?: string;
  yardflow_roi_estimate?: string;
}

export interface TaskInput {
  subject: string;
  body?: string;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface EmailLogInput {
  subject: string;
  body: string;
  timestamp?: string;
  direction?: 'SENT' | 'RECEIVED';
}

// =============================================================================
// Pagination & Query Types
// =============================================================================

export interface ListParams {
  limit?: number;
  after?: string;
  properties?: string[];
  archived?: boolean;
}

export interface SearchFilters {
  propertyName: string;
  operator: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE' | 'CONTAINS' | 'NOT_CONTAINS';
  value: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  total?: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface BatchResult {
  status: 'COMPLETE' | 'PARTIAL' | 'FAILED';
  results: Array<{
    id: string;
    status: 'SUCCESS' | 'FAILED';
    error?: string;
  }>;
  numErrors: number;
}

// =============================================================================
// Field Mapping Types
// =============================================================================

export type TransformFunction = 
  | 'none'
  | 'splitName'
  | 'joinName'
  | 'lowercase'
  | 'uppercase'
  | 'e164'
  | 'extractLinkedInId'
  | 'statusMap'
  | 'timestamp'
  | 'tierMap'
  | 'personaMap';

export interface FieldMapping {
  yardflow: string;
  hubspot: string;
  transform: TransformFunction;
  bidirectional?: boolean;
  required?: boolean;
}

// =============================================================================
// Connection State Types
// =============================================================================

export interface HubSpotConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  portalId?: string;
  accountName?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}
