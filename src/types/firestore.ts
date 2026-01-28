/**
 * Firestore Types
 * Sprint 27 - T27.1
 * 
 * Type definitions for Firestore collections and documents.
 */

import { z } from 'zod';

// =============================================================================
// Base Types
// =============================================================================

export const TimestampSchema = z.object({
  seconds: z.number(),
  nanoseconds: z.number(),
});

export type FirestoreTimestamp = z.infer<typeof TimestampSchema>;

// =============================================================================
// Prospect Types
// =============================================================================

export const ProspectStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
  'nurture',
]);

export const ProspectTierSchema = z.enum(['T1', 'T2', 'T3']);

export const ProspectSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  
  // Classification
  tier: ProspectTierSchema.optional(),
  persona: z.string().optional().nullable(),
  segment: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  
  // Status
  status: ProspectStatusSchema.default('new'),
  score: z.number().min(0).max(100).default(0),
  
  // Location
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  
  // Source
  source: z.string().optional().nullable(),
  sourceDetail: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
  
  // Ownership
  assigneeId: z.string().optional().nullable(),
  assigneeName: z.string().optional().nullable(),
  
  // Tags
  tags: z.array(z.string()).default([]),
  
  // External IDs
  hubspotId: z.string().optional().nullable(),
  salesforceId: z.string().optional().nullable(),
  
  // ROI
  estimatedDealValue: z.number().optional().nullable(),
  estimatedCloseDate: z.string().optional().nullable(),
  
  // Notes
  notes: z.string().optional().nullable(),
  
  // Metadata
  createdAt: z.string().or(TimestampSchema),
  updatedAt: z.string().or(TimestampSchema),
  createdBy: z.string().optional().nullable(),
  updatedBy: z.string().optional().nullable(),
  
  // Sync
  lastSyncAt: z.string().optional().nullable(),
  syncVersion: z.number().default(0),
});

export type Prospect = z.infer<typeof ProspectSchema>;
export type ProspectStatus = z.infer<typeof ProspectStatusSchema>;
export type ProspectTier = z.infer<typeof ProspectTierSchema>;

// =============================================================================
// Company Types
// =============================================================================

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  
  // Classification
  industry: z.string().optional().nullable(),
  size: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+']).optional().nullable(),
  revenue: z.string().optional().nullable(),
  type: z.enum(['prospect', 'customer', 'partner', 'competitor']).optional().nullable(),
  
  // Location
  headquarters: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  
  // Contacts
  prospectIds: z.array(z.string()).default([]),
  primaryContactId: z.string().optional().nullable(),
  
  // Notes
  description: z.string().optional().nullable(),
  
  // Metadata
  createdAt: z.string().or(TimestampSchema),
  updatedAt: z.string().or(TimestampSchema),
  createdBy: z.string().optional().nullable(),
});

export type Company = z.infer<typeof CompanySchema>;

// =============================================================================
// Activity Types
// =============================================================================

export const ActivityTypeSchema = z.enum([
  'email_sent',
  'email_opened',
  'email_clicked',
  'email_replied',
  'call_made',
  'call_received',
  'meeting_scheduled',
  'meeting_completed',
  'note_added',
  'task_created',
  'task_completed',
  'dm_sent',
  'linkedin_connected',
  'status_changed',
  'deal_created',
  'deal_updated',
  'deal_won',
  'deal_lost',
]);

export const ActivitySchema = z.object({
  id: z.string(),
  type: ActivityTypeSchema,
  prospectId: z.string(),
  companyId: z.string().optional().nullable(),
  
  // Content
  subject: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  
  // Duration (for calls/meetings)
  durationMinutes: z.number().optional().nullable(),
  
  // For status changes
  previousValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  
  // For deals
  dealValue: z.number().optional().nullable(),
  
  // Metadata
  userId: z.string(),
  userName: z.string().optional().nullable(),
  timestamp: z.string().or(TimestampSchema),
  createdAt: z.string().or(TimestampSchema),
  
  // External reference
  externalId: z.string().optional().nullable(),
  externalSystem: z.string().optional().nullable(),
});

export type Activity = z.infer<typeof ActivitySchema>;
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

// =============================================================================
// Email Sequence Types
// =============================================================================

export const SequenceStepStatusSchema = z.enum([
  'pending',
  'scheduled',
  'sent',
  'opened',
  'clicked',
  'replied',
  'bounced',
  'unsubscribed',
  'paused',
  'cancelled',
]);

export const SequenceStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  templateId: z.string(),
  scheduledAt: z.string().or(TimestampSchema).optional().nullable(),
  sentAt: z.string().or(TimestampSchema).optional().nullable(),
  status: SequenceStepStatusSchema.default('pending'),
  openCount: z.number().default(0),
  clickCount: z.number().default(0),
});

export const SequenceEnrollmentSchema = z.object({
  id: z.string(),
  sequenceId: z.string(),
  sequenceName: z.string(),
  prospectId: z.string(),
  
  // Status
  status: z.enum(['active', 'completed', 'paused', 'cancelled', 'replied']).default('active'),
  currentStep: z.number().default(1),
  totalSteps: z.number(),
  
  // Steps
  steps: z.array(SequenceStepSchema),
  
  // Metrics
  openRate: z.number().default(0),
  clickRate: z.number().default(0),
  
  // Metadata
  startedAt: z.string().or(TimestampSchema),
  completedAt: z.string().or(TimestampSchema).optional().nullable(),
  createdBy: z.string(),
  createdAt: z.string().or(TimestampSchema),
  updatedAt: z.string().or(TimestampSchema),
});

export type SequenceStep = z.infer<typeof SequenceStepSchema>;
export type SequenceStepStatus = z.infer<typeof SequenceStepStatusSchema>;
export type SequenceEnrollment = z.infer<typeof SequenceEnrollmentSchema>;

// =============================================================================
// Tenant Types
// =============================================================================

const TenantSettingsSchema = z.object({
  defaultTimezone: z.string().default('America/New_York'),
  dateFormat: z.string().default('MM/DD/YYYY'),
  currency: z.string().default('USD'),
  language: z.string().default('en'),
});

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  
  // Settings
  settings: TenantSettingsSchema.default({
    defaultTimezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    language: 'en',
  }),
  
  // Branding
  branding: z.object({
    logo: z.string().optional().nullable(),
    primaryColor: z.string().optional().nullable(),
    secondaryColor: z.string().optional().nullable(),
  }).default({
    logo: null,
    primaryColor: null,
    secondaryColor: null,
  }),
  
  // Integrations
  integrations: z.object({
    hubspot: z.object({
      connected: z.boolean().default(false),
      portalId: z.string().optional().nullable(),
      lastSyncAt: z.string().optional().nullable(),
    }).default({
      connected: false,
      portalId: null,
      lastSyncAt: null,
    }),
    salesforce: z.object({
      connected: z.boolean().default(false),
      instanceUrl: z.string().optional().nullable(),
    }).default({
      connected: false,
      instanceUrl: null,
    }),
  }).default({
    hubspot: {
      connected: false,
      portalId: null,
      lastSyncAt: null,
    },
    salesforce: {
      connected: false,
      instanceUrl: null,
    },
  }),
  
  // Limits
  limits: z.object({
    maxProspects: z.number().default(10000),
    maxUsers: z.number().default(10),
    maxSequences: z.number().default(50),
  }).default({
    maxProspects: 10000,
    maxUsers: 10,
    maxSequences: 50,
  }),
  
  // Metadata
  createdAt: z.string().or(TimestampSchema),
  updatedAt: z.string().or(TimestampSchema),
});

export type Tenant = z.infer<typeof TenantSchema>;

// =============================================================================
// User Types
// =============================================================================

export const UserRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);

export const TenantUserSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string().email(),
  displayName: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  
  // Role
  role: UserRoleSchema.default('member'),
  
  // Status
  status: z.enum(['active', 'invited', 'suspended']).default('active'),
  
  // Presence
  lastActiveAt: z.string().or(TimestampSchema).optional().nullable(),
  currentPage: z.string().optional().nullable(),
  isOnline: z.boolean().default(false),
  
  // Metadata
  invitedAt: z.string().or(TimestampSchema).optional().nullable(),
  invitedBy: z.string().optional().nullable(),
  joinedAt: z.string().or(TimestampSchema).optional().nullable(),
  createdAt: z.string().or(TimestampSchema),
  updatedAt: z.string().or(TimestampSchema),
});

export type TenantUser = z.infer<typeof TenantUserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;

// =============================================================================
// Presence Types
// =============================================================================

export const PresenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  photoUrl: z.string().optional().nullable(),
  
  // Status
  status: z.enum(['online', 'idle', 'offline']).default('offline'),
  lastHeartbeat: z.string().or(TimestampSchema),
  
  // Current view
  currentPath: z.string().optional().nullable(),
  currentProspectId: z.string().optional().nullable(),
  
  // Device
  deviceId: z.string(),
  userAgent: z.string().optional().nullable(),
});

export type Presence = z.infer<typeof PresenceSchema>;

// =============================================================================
// Offline Queue Types
// =============================================================================

export const OfflineOperationSchema = z.object({
  id: z.string(),
  type: z.enum(['create', 'update', 'delete']),
  collection: z.string(),
  documentId: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number(),
  retries: z.number().default(0),
  error: z.string().optional().nullable(),
});

export type OfflineOperation = z.infer<typeof OfflineOperationSchema>;
