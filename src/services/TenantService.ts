/**
 * Tenant Service - YardFlow Hub
 * 
 * Core multi-tenant functionality:
 * - Tenant CRUD operations
 * - User management
 * - Permission checking
 * - Usage tracking
 * - Audit logging
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Tenant,
  TenantSchema,
  TenantPlan,
  TenantStatus,
  User,
  UserSchema,
  UserRole,
  UserStatus,
  Team,
  TeamSchema,
  TeamMembership,
  Invitation,
  InvitationSchema,
  AuditLog,
  AuditLogSchema,
  AuditEventType,
  ResourceType,
  Action,
  ROLE_PERMISSIONS,
  PLAN_LIMITS,
  PLAN_FEATURES,
} from '../types/tenant';

// ============================================
// Tenant Management
// ============================================

/**
 * Create a new tenant with default settings
 */
export function createTenant(
  name: string,
  ownerEmail: string,
  plan: TenantPlan = 'free'
): Tenant {
  const now = new Date().toISOString();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  const limits = PLAN_LIMITS[plan];
  const features = PLAN_FEATURES[plan];
  
  const tenant: Tenant = {
    id: uuidv4(),
    name,
    slug,
    status: plan === 'free' ? 'active' : 'trial',
    plan,
    trialEndsAt: plan !== 'free' 
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() 
      : undefined,
    billingEmail: ownerEmail,
    settings: {
      timezone: 'America/New_York',
      dateFormat: 'MM/DD/YYYY',
      features,
    },
    limits,
    usage: {
      currentUsers: 1,
      currentProspects: 0,
      emailsSentThisMonth: 0,
      aiCreditsUsed: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
  
  return TenantSchema.parse(tenant);
}

/**
 * Update tenant settings
 */
export function updateTenant(
  tenant: Tenant,
  updates: Partial<Pick<Tenant, 'name' | 'settings' | 'logoUrl' | 'primaryColor'>>
): Tenant {
  const updated = {
    ...tenant,
    ...updates,
    settings: updates.settings 
      ? { ...tenant.settings, ...updates.settings }
      : tenant.settings,
    updatedAt: new Date().toISOString(),
  };
  
  return TenantSchema.parse(updated);
}

/**
 * Upgrade/downgrade tenant plan
 */
export function changePlan(tenant: Tenant, newPlan: TenantPlan): Tenant {
  const limits = PLAN_LIMITS[newPlan];
  const features = PLAN_FEATURES[newPlan];
  
  return TenantSchema.parse({
    ...tenant,
    plan: newPlan,
    limits,
    settings: {
      ...tenant.settings,
      features,
    },
    status: newPlan === 'free' ? 'active' : tenant.status,
    trialEndsAt: undefined, // Clear trial on plan change
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Update tenant status
 */
export function updateTenantStatus(tenant: Tenant, status: TenantStatus): Tenant {
  return TenantSchema.parse({
    ...tenant,
    status,
    updatedAt: new Date().toISOString(),
  });
}

// ============================================
// Usage Tracking
// ============================================

/**
 * Check if tenant can add more of a resource
 */
export function canAddResource(
  tenant: Tenant,
  resourceType: 'users' | 'prospects' | 'sequences' | 'emails' | 'aiCredits',
  count: number = 1
): { allowed: boolean; remaining: number; limit: number } {
  const usageMap: Record<string, { current: number; max: number }> = {
    users: { current: tenant.usage.currentUsers, max: tenant.limits.maxUsers },
    prospects: { current: tenant.usage.currentProspects, max: tenant.limits.maxProspects },
    sequences: { current: 0, max: tenant.limits.maxSequences }, // Would need to track
    emails: { current: tenant.usage.emailsSentThisMonth, max: tenant.limits.maxEmailsPerMonth },
    aiCredits: { current: tenant.usage.aiCreditsUsed, max: tenant.limits.maxAICredits },
  };
  
  const { current, max } = usageMap[resourceType];
  const remaining = max - current;
  
  return {
    allowed: current + count <= max,
    remaining,
    limit: max,
  };
}

/**
 * Update usage counters
 */
export function updateUsage(
  tenant: Tenant,
  updates: Partial<Tenant['usage']>
): Tenant {
  return TenantSchema.parse({
    ...tenant,
    usage: {
      ...tenant.usage,
      ...updates,
    },
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Reset monthly usage (call at billing cycle)
 */
export function resetMonthlyUsage(tenant: Tenant): Tenant {
  return updateUsage(tenant, {
    emailsSentThisMonth: 0,
    aiCreditsUsed: 0,
  });
}

/**
 * Get usage percentage for a resource
 */
export function getUsagePercentage(
  tenant: Tenant,
  resourceType: 'users' | 'prospects' | 'emails' | 'aiCredits'
): number {
  const usageMap: Record<string, { current: number; max: number }> = {
    users: { current: tenant.usage.currentUsers, max: tenant.limits.maxUsers },
    prospects: { current: tenant.usage.currentProspects, max: tenant.limits.maxProspects },
    emails: { current: tenant.usage.emailsSentThisMonth, max: tenant.limits.maxEmailsPerMonth },
    aiCredits: { current: tenant.usage.aiCreditsUsed, max: tenant.limits.maxAICredits },
  };
  
  const { current, max } = usageMap[resourceType];
  if (max === 0) return 0;
  
  return Math.round((current / max) * 100);
}

// ============================================
// Feature Flags
// ============================================

/**
 * Check if a feature is enabled for tenant
 */
export function hasFeature(
  tenant: Tenant,
  feature: keyof Tenant['settings']['features']
): boolean {
  return tenant.settings.features?.[feature] ?? false;
}

/**
 * Get all enabled features for tenant
 */
export function getEnabledFeatures(tenant: Tenant): string[] {
  const features = tenant.settings.features ?? {};
  return Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

// ============================================
// User Management
// ============================================

/**
 * Create a new user in a tenant
 */
export function createUser(
  tenantId: string,
  email: string,
  name: string,
  role: UserRole = 'member'
): User {
  const now = new Date().toISOString();
  
  const user: User = {
    id: uuidv4(),
    email,
    name,
    tenantId,
    role,
    teamIds: [],
    status: 'active',
    preferences: {
      emailNotifications: true,
      weeklyDigest: true,
    },
    createdAt: now,
    updatedAt: now,
  };
  
  return UserSchema.parse(user);
}

/**
 * Create an invited user (pending status)
 */
export function createInvitedUser(
  tenantId: string,
  email: string,
  role: UserRole,
  invitedBy: string,
  teamIds: string[] = []
): User {
  const now = new Date().toISOString();
  
  const user: User = {
    id: uuidv4(),
    email,
    name: email.split('@')[0], // Placeholder until they set their name
    tenantId,
    role,
    teamIds,
    status: 'pending',
    invitedAt: now,
    invitedBy,
    preferences: {
      emailNotifications: true,
      weeklyDigest: true,
    },
    createdAt: now,
    updatedAt: now,
  };
  
  return UserSchema.parse(user);
}

/**
 * Update user role
 */
export function updateUserRole(user: User, newRole: UserRole): User {
  return UserSchema.parse({
    ...user,
    role: newRole,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Update user status
 */
export function updateUserStatus(user: User, status: UserStatus): User {
  return UserSchema.parse({
    ...user,
    status,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Add user to team
 */
export function addUserToTeam(user: User, teamId: string): User {
  if (user.teamIds.includes(teamId)) {
    return user;
  }
  
  return UserSchema.parse({
    ...user,
    teamIds: [...user.teamIds, teamId],
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Remove user from team
 */
export function removeUserFromTeam(user: User, teamId: string): User {
  return UserSchema.parse({
    ...user,
    teamIds: user.teamIds.filter(id => id !== teamId),
    updatedAt: new Date().toISOString(),
  });
}

// ============================================
// Permission Checking
// ============================================

/**
 * Check if a user has permission to perform an action on a resource
 */
export function hasPermission(
  user: User,
  resource: ResourceType,
  action: Action
): boolean {
  const rolePermissions = ROLE_PERMISSIONS[user.role];
  const resourcePermission = rolePermissions.find(p => p.resource === resource);
  
  if (!resourcePermission) {
    return false;
  }
  
  return resourcePermission.actions.includes(action);
}

/**
 * Get all actions a user can perform on a resource
 */
export function getAllowedActions(user: User, resource: ResourceType): Action[] {
  const rolePermissions = ROLE_PERMISSIONS[user.role];
  const resourcePermission = rolePermissions.find(p => p.resource === resource);
  
  return resourcePermission?.actions ?? [];
}

/**
 * Check if user can manage other users
 */
export function canManageUsers(user: User): boolean {
  return ['owner', 'admin', 'manager'].includes(user.role);
}

/**
 * Check if user can invite with a specific role
 */
export function canInviteWithRole(inviter: User, role: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    owner: 5,
    admin: 4,
    manager: 3,
    member: 2,
    readonly: 1,
  };
  
  // Can only invite users with lower or equal role (except owner)
  if (role === 'owner') {
    return false; // No one can invite owners
  }
  
  return roleHierarchy[inviter.role] >= roleHierarchy[role];
}

// ============================================
// Team Management
// ============================================

/**
 * Create a new team
 */
export function createTeam(
  tenantId: string,
  name: string,
  createdBy: string,
  leaderId?: string
): Team {
  const now = new Date().toISOString();
  
  const team: Team = {
    id: uuidv4(),
    tenantId,
    name,
    leaderId,
    settings: {
      isPrivate: false,
      autoAssignLeads: false,
    },
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  
  return TeamSchema.parse(team);
}

/**
 * Update team settings
 */
export function updateTeam(
  team: Team,
  updates: Partial<Pick<Team, 'name' | 'description' | 'leaderId' | 'settings'>>
): Team {
  return TeamSchema.parse({
    ...team,
    ...updates,
    settings: updates.settings 
      ? { ...team.settings, ...updates.settings }
      : team.settings,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Create team membership
 */
export function createTeamMembership(
  teamId: string,
  userId: string,
  role: 'leader' | 'member' = 'member'
): TeamMembership {
  return {
    id: uuidv4(),
    teamId,
    userId,
    role,
    joinedAt: new Date().toISOString(),
  };
}

// ============================================
// Invitations
// ============================================

/**
 * Create an invitation
 */
export function createInvitation(
  tenantId: string,
  email: string,
  role: UserRole,
  invitedBy: string,
  teamIds: string[] = [],
  expiresInDays: number = 7
): Invitation {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  
  const invitation: Invitation = {
    id: uuidv4(),
    tenantId,
    email,
    role,
    teamIds,
    status: 'pending',
    token: uuidv4(), // In real app, use crypto.randomBytes
    expiresAt: expiresAt.toISOString(),
    invitedBy,
    invitedAt: now.toISOString(),
  };
  
  return InvitationSchema.parse(invitation);
}

/**
 * Check if invitation is valid
 */
export function isInvitationValid(invitation: Invitation): boolean {
  if (invitation.status !== 'pending') {
    return false;
  }
  
  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  
  return now < expiresAt;
}

/**
 * Accept an invitation
 */
export function acceptInvitation(invitation: Invitation): Invitation {
  return InvitationSchema.parse({
    ...invitation,
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
  });
}

/**
 * Revoke an invitation
 */
export function revokeInvitation(invitation: Invitation): Invitation {
  return InvitationSchema.parse({
    ...invitation,
    status: 'revoked',
  });
}

// ============================================
// Audit Logging
// ============================================

/**
 * Create an audit log entry
 */
export function createAuditLog(
  tenantId: string,
  userId: string,
  userEmail: string,
  eventType: AuditEventType,
  action: string,
  description: string,
  options?: {
    resourceType?: ResourceType;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): AuditLog {
  const log: AuditLog = {
    id: uuidv4(),
    tenantId,
    userId,
    userEmail,
    eventType,
    action,
    description,
    resourceType: options?.resourceType,
    resourceId: options?.resourceId,
    metadata: options?.metadata,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    timestamp: new Date().toISOString(),
  };
  
  return AuditLogSchema.parse(log);
}

/**
 * Filter audit logs by criteria
 */
export function filterAuditLogs(
  logs: AuditLog[],
  criteria: {
    userId?: string;
    eventType?: AuditEventType;
    resourceType?: ResourceType;
    startDate?: Date;
    endDate?: Date;
  }
): AuditLog[] {
  return logs.filter(log => {
    if (criteria.userId && log.userId !== criteria.userId) return false;
    if (criteria.eventType && log.eventType !== criteria.eventType) return false;
    if (criteria.resourceType && log.resourceType !== criteria.resourceType) return false;
    
    const timestamp = new Date(log.timestamp);
    if (criteria.startDate && timestamp < criteria.startDate) return false;
    if (criteria.endDate && timestamp > criteria.endDate) return false;
    
    return true;
  });
}

// ============================================
// Data Isolation Helpers
// ============================================

/**
 * Create a tenant-scoped query filter
 */
export function createTenantScope<T extends { tenantId: string }>(
  tenantId: string
): (item: T) => boolean {
  return (item: T) => item.tenantId === tenantId;
}

/**
 * Filter array to only include items from tenant
 */
export function filterByTenant<T extends { tenantId: string }>(
  items: T[],
  tenantId: string
): T[] {
  return items.filter(createTenantScope(tenantId));
}

/**
 * Validate that a resource belongs to a tenant
 */
export function validateTenantAccess<T extends { tenantId: string }>(
  resource: T,
  tenantId: string
): boolean {
  return resource.tenantId === tenantId;
}

/**
 * Create a composite scope (tenant + optional team)
 */
export function createCompositeScope<T extends { tenantId: string; teamId?: string }>(
  tenantId: string,
  teamId?: string
): (item: T) => boolean {
  return (item: T) => {
    if (item.tenantId !== tenantId) return false;
    if (teamId && item.teamId !== teamId) return false;
    return true;
  };
}
