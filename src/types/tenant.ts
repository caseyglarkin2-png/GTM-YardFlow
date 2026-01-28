/**
 * Multi-tenant Types - YardFlow Hub
 * 
 * Type definitions for multi-tenant architecture:
 * - Tenant/Organization management
 * - User roles and permissions
 * - Team hierarchy
 * - Data isolation patterns
 */

import { z } from 'zod';

// ============================================
// Tenant Types
// ============================================

export const TenantStatusSchema = z.enum([
  'trial',
  'active',
  'suspended',
  'cancelled',
]);

export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const TenantPlanSchema = z.enum([
  'free',
  'starter',
  'professional',
  'enterprise',
]);

export type TenantPlan = z.infer<typeof TenantPlanSchema>;

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(), // URL-friendly identifier
  domain: z.string().optional(), // Custom domain if any
  
  // Status and billing
  status: TenantStatusSchema,
  plan: TenantPlanSchema,
  trialEndsAt: z.string().optional(),
  billingEmail: z.string().email().optional(),
  
  // Branding
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
  
  // Settings
  settings: z.object({
    timezone: z.string().default('America/New_York'),
    dateFormat: z.string().default('MM/DD/YYYY'),
    defaultSenderName: z.string().optional(),
    defaultSenderEmail: z.string().email().optional(),
    
    // Feature flags
    features: z.object({
      aiAssets: z.boolean().default(true),
      emailSequences: z.boolean().default(true),
      socialChannels: z.boolean().default(false),
      advancedAnalytics: z.boolean().default(false),
      customIntegrations: z.boolean().default(false),
      ssoEnabled: z.boolean().default(false),
    }).default({
      aiAssets: true,
      emailSequences: true,
      socialChannels: false,
      advancedAnalytics: false,
      customIntegrations: false,
      ssoEnabled: false,
    }),
  }).default({
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    features: {
      aiAssets: true,
      emailSequences: true,
      socialChannels: false,
      advancedAnalytics: false,
      customIntegrations: false,
      ssoEnabled: false,
    },
  }),
  
  // Limits
  limits: z.object({
    maxUsers: z.number().default(5),
    maxProspects: z.number().default(1000),
    maxSequences: z.number().default(10),
    maxEmailsPerMonth: z.number().default(5000),
    maxAICredits: z.number().default(100),
  }).default({
    maxUsers: 5,
    maxProspects: 1000,
    maxSequences: 10,
    maxEmailsPerMonth: 5000,
    maxAICredits: 100,
  }),
  
  // Usage tracking
  usage: z.object({
    currentUsers: z.number().default(0),
    currentProspects: z.number().default(0),
    emailsSentThisMonth: z.number().default(0),
    aiCreditsUsed: z.number().default(0),
  }).default({
    currentUsers: 0,
    currentProspects: 0,
    emailsSentThisMonth: 0,
    aiCreditsUsed: 0,
  }),
  
  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
});

export type Tenant = z.infer<typeof TenantSchema>;

// ============================================
// User Types
// ============================================

export const UserRoleSchema = z.enum([
  'owner',      // Full access, can delete tenant
  'admin',      // Full access, cannot delete tenant
  'manager',    // Can manage team members and content
  'member',     // Standard access
  'readonly',   // View only
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum([
  'pending',    // Invited but not accepted
  'active',
  'suspended',
  'deactivated',
]);

export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().optional(),
  
  // Tenant membership
  tenantId: z.string(),
  role: UserRoleSchema,
  teamIds: z.array(z.string()).default([]),
  
  // Status
  status: UserStatusSchema,
  lastLoginAt: z.string().optional(),
  invitedAt: z.string().optional(),
  invitedBy: z.string().optional(),
  
  // Preferences
  preferences: z.object({
    timezone: z.string().optional(),
    emailNotifications: z.boolean().default(true),
    weeklyDigest: z.boolean().default(true),
  }).default({
    emailNotifications: true,
    weeklyDigest: true,
  }),
  
  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type User = z.infer<typeof UserSchema>;

// ============================================
// Team Types
// ============================================

export const TeamSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Team lead/manager
  leaderId: z.string().optional(),
  
  // Settings
  settings: z.object({
    isPrivate: z.boolean().default(false),
    autoAssignLeads: z.boolean().default(false),
  }).default({
    isPrivate: false,
    autoAssignLeads: false,
  }),
  
  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});

export type Team = z.infer<typeof TeamSchema>;

export const TeamMembershipSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  role: z.enum(['leader', 'member']),
  joinedAt: z.string(),
});

export type TeamMembership = z.infer<typeof TeamMembershipSchema>;

// ============================================
// Permission Types
// ============================================

/**
 * Resource types that can be protected
 */
export const ResourceTypeSchema = z.enum([
  'prospect',
  'sequence',
  'campaign',
  'template',
  'asset',
  'analytics',
  'settings',
  'users',
  'teams',
  'integrations',
  'billing',
]);

export type ResourceType = z.infer<typeof ResourceTypeSchema>;

/**
 * Actions that can be performed on resources
 */
export const ActionSchema = z.enum([
  'create',
  'read',
  'update',
  'delete',
  'export',
  'share',
  'assign',
]);

export type Action = z.infer<typeof ActionSchema>;

/**
 * Permission definition
 */
export const PermissionSchema = z.object({
  resource: ResourceTypeSchema,
  actions: z.array(ActionSchema),
});

export type Permission = z.infer<typeof PermissionSchema>;

/**
 * Role-based permission matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    { resource: 'prospect', actions: ['create', 'read', 'update', 'delete', 'export', 'share', 'assign'] },
    { resource: 'sequence', actions: ['create', 'read', 'update', 'delete', 'share'] },
    { resource: 'campaign', actions: ['create', 'read', 'update', 'delete', 'share'] },
    { resource: 'template', actions: ['create', 'read', 'update', 'delete', 'share'] },
    { resource: 'asset', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'analytics', actions: ['read', 'export'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'teams', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'integrations', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'billing', actions: ['read', 'update'] },
  ],
  admin: [
    { resource: 'prospect', actions: ['create', 'read', 'update', 'delete', 'export', 'share', 'assign'] },
    { resource: 'sequence', actions: ['create', 'read', 'update', 'delete', 'share'] },
    { resource: 'campaign', actions: ['create', 'read', 'update', 'delete', 'share'] },
    { resource: 'template', actions: ['create', 'read', 'update', 'delete', 'share'] },
    { resource: 'asset', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'analytics', actions: ['read', 'export'] },
    { resource: 'settings', actions: ['read', 'update'] },
    { resource: 'users', actions: ['create', 'read', 'update'] },
    { resource: 'teams', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'integrations', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'billing', actions: ['read'] },
  ],
  manager: [
    { resource: 'prospect', actions: ['create', 'read', 'update', 'export', 'share', 'assign'] },
    { resource: 'sequence', actions: ['create', 'read', 'update', 'share'] },
    { resource: 'campaign', actions: ['create', 'read', 'update', 'share'] },
    { resource: 'template', actions: ['create', 'read', 'update', 'share'] },
    { resource: 'asset', actions: ['create', 'read', 'update'] },
    { resource: 'analytics', actions: ['read', 'export'] },
    { resource: 'settings', actions: ['read'] },
    { resource: 'users', actions: ['read'] },
    { resource: 'teams', actions: ['read', 'update'] },
    { resource: 'integrations', actions: ['read'] },
    { resource: 'billing', actions: [] },
  ],
  member: [
    { resource: 'prospect', actions: ['create', 'read', 'update', 'share'] },
    { resource: 'sequence', actions: ['read'] },
    { resource: 'campaign', actions: ['read'] },
    { resource: 'template', actions: ['read'] },
    { resource: 'asset', actions: ['create', 'read'] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'settings', actions: [] },
    { resource: 'users', actions: ['read'] },
    { resource: 'teams', actions: ['read'] },
    { resource: 'integrations', actions: [] },
    { resource: 'billing', actions: [] },
  ],
  readonly: [
    { resource: 'prospect', actions: ['read'] },
    { resource: 'sequence', actions: ['read'] },
    { resource: 'campaign', actions: ['read'] },
    { resource: 'template', actions: ['read'] },
    { resource: 'asset', actions: ['read'] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'settings', actions: [] },
    { resource: 'users', actions: ['read'] },
    { resource: 'teams', actions: ['read'] },
    { resource: 'integrations', actions: [] },
    { resource: 'billing', actions: [] },
  ],
};

// ============================================
// Audit Log Types
// ============================================

export const AuditEventTypeSchema = z.enum([
  'user.login',
  'user.logout',
  'user.invite',
  'user.role_change',
  'user.deactivate',
  'prospect.create',
  'prospect.update',
  'prospect.delete',
  'prospect.export',
  'sequence.create',
  'sequence.activate',
  'sequence.pause',
  'campaign.launch',
  'settings.update',
  'integration.connect',
  'integration.disconnect',
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  
  // Event details
  eventType: AuditEventTypeSchema,
  resourceType: ResourceTypeSchema.optional(),
  resourceId: z.string().optional(),
  
  // Context
  action: z.string(),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  
  // Request info
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  
  timestamp: z.string(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ============================================
// Invitation Types
// ============================================

export const InvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'expired',
  'revoked',
]);

export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const InvitationSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  teamIds: z.array(z.string()).default([]),
  
  status: InvitationStatusSchema,
  token: z.string(),
  expiresAt: z.string(),
  
  invitedBy: z.string(),
  invitedAt: z.string(),
  acceptedAt: z.string().optional(),
});

export type Invitation = z.infer<typeof InvitationSchema>;

// ============================================
// Plan Limits Configuration
// ============================================

export const PLAN_LIMITS: Record<TenantPlan, Tenant['limits']> = {
  free: {
    maxUsers: 1,
    maxProspects: 100,
    maxSequences: 2,
    maxEmailsPerMonth: 100,
    maxAICredits: 10,
  },
  starter: {
    maxUsers: 3,
    maxProspects: 1000,
    maxSequences: 5,
    maxEmailsPerMonth: 2500,
    maxAICredits: 50,
  },
  professional: {
    maxUsers: 10,
    maxProspects: 10000,
    maxSequences: 25,
    maxEmailsPerMonth: 15000,
    maxAICredits: 250,
  },
  enterprise: {
    maxUsers: 999999, // Unlimited
    maxProspects: 999999,
    maxSequences: 999999,
    maxEmailsPerMonth: 999999,
    maxAICredits: 999999,
  },
};

export const PLAN_FEATURES: Record<TenantPlan, Tenant['settings']['features']> = {
  free: {
    aiAssets: false,
    emailSequences: true,
    socialChannels: false,
    advancedAnalytics: false,
    customIntegrations: false,
    ssoEnabled: false,
  },
  starter: {
    aiAssets: true,
    emailSequences: true,
    socialChannels: false,
    advancedAnalytics: false,
    customIntegrations: false,
    ssoEnabled: false,
  },
  professional: {
    aiAssets: true,
    emailSequences: true,
    socialChannels: true,
    advancedAnalytics: true,
    customIntegrations: false,
    ssoEnabled: false,
  },
  enterprise: {
    aiAssets: true,
    emailSequences: true,
    socialChannels: true,
    advancedAnalytics: true,
    customIntegrations: true,
    ssoEnabled: true,
  },
};
