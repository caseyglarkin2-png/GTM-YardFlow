/**
 * Tenant Service Tests - YardFlow Hub
 * 
 * Tests for multi-tenant functionality:
 * - Tenant CRUD operations
 * - User management
 * - Permission checking
 * - Usage tracking
 * - Team management
 * - Invitations
 * - Audit logging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTenant,
  updateTenant,
  changePlan,
  updateTenantStatus,
  canAddResource,
  updateUsage,
  resetMonthlyUsage,
  getUsagePercentage,
  hasFeature,
  getEnabledFeatures,
  createUser,
  createInvitedUser,
  updateUserRole,
  updateUserStatus,
  addUserToTeam,
  removeUserFromTeam,
  hasPermission,
  getAllowedActions,
  canManageUsers,
  canInviteWithRole,
  createTeam,
  updateTeam,
  createTeamMembership,
  createInvitation,
  isInvitationValid,
  acceptInvitation,
  revokeInvitation,
  createAuditLog,
  filterAuditLogs,
  createTenantScope,
  filterByTenant,
  validateTenantAccess,
  createCompositeScope,
} from '../../services/TenantService';
import type { Tenant, User, Team, AuditLog } from '../../types/tenant';
import { PLAN_LIMITS, PLAN_FEATURES } from '../../types/tenant';

describe('TenantService', () => {
  // ============================================
  // Tenant Management Tests
  // ============================================
  
  describe('createTenant', () => {
    it('should create a free tenant with correct defaults', () => {
      const tenant = createTenant('Acme Logistics', 'admin@acme.com', 'free');
      
      expect(tenant.name).toBe('Acme Logistics');
      expect(tenant.slug).toBe('acme-logistics');
      expect(tenant.status).toBe('active'); // Free plans are active immediately
      expect(tenant.plan).toBe('free');
      expect(tenant.billingEmail).toBe('admin@acme.com');
      expect(tenant.trialEndsAt).toBeUndefined();
      expect(tenant.limits).toEqual(PLAN_LIMITS.free);
      expect(tenant.settings.features).toEqual(PLAN_FEATURES.free);
      expect(tenant.usage.currentUsers).toBe(1);
    });
    
    it('should create a paid tenant with trial period', () => {
      const tenant = createTenant('Pro Corp', 'admin@pro.com', 'professional');
      
      expect(tenant.status).toBe('trial');
      expect(tenant.plan).toBe('professional');
      expect(tenant.trialEndsAt).toBeDefined();
      expect(tenant.limits).toEqual(PLAN_LIMITS.professional);
      expect(tenant.settings.features).toEqual(PLAN_FEATURES.professional);
    });
    
    it('should generate URL-friendly slug', () => {
      const tenant = createTenant('ABC   Trucking & Logistics!', 'admin@abc.com');
      
      expect(tenant.slug).toBe('abc-trucking-logistics');
    });
    
    it('should use default timezone and date format', () => {
      const tenant = createTenant('Test Co', 'admin@test.com');
      
      expect(tenant.settings.timezone).toBe('America/New_York');
      expect(tenant.settings.dateFormat).toBe('MM/DD/YYYY');
    });
  });
  
  describe('updateTenant', () => {
    let tenant: Tenant;
    
    beforeEach(() => {
      tenant = createTenant('Test Company', 'admin@test.com');
    });
    
    it('should update basic fields', () => {
      const updated = updateTenant(tenant, {
        name: 'New Name',
        logoUrl: 'https://example.com/logo.png',
      });
      
      expect(updated.name).toBe('New Name');
      expect(updated.logoUrl).toBe('https://example.com/logo.png');
      // Check that updatedAt is a valid ISO timestamp
      expect(new Date(updated.updatedAt).toISOString()).toBe(updated.updatedAt);
    });
    
    it('should merge settings correctly', () => {
      const updated = updateTenant(tenant, {
        settings: {
          ...tenant.settings,
          timezone: 'America/Los_Angeles',
        },
      });
      
      expect(updated.settings.timezone).toBe('America/Los_Angeles');
      expect(updated.settings.dateFormat).toBe('MM/DD/YYYY'); // Preserved
    });
  });
  
  describe('changePlan', () => {
    it('should upgrade plan with new limits and features', () => {
      const tenant = createTenant('Starter Co', 'admin@starter.com', 'starter');
      const upgraded = changePlan(tenant, 'enterprise');
      
      expect(upgraded.plan).toBe('enterprise');
      expect(upgraded.limits).toEqual(PLAN_LIMITS.enterprise);
      expect(upgraded.settings.features).toEqual(PLAN_FEATURES.enterprise);
      expect(upgraded.trialEndsAt).toBeUndefined(); // Cleared
    });
    
    it('should set active status when downgrading to free', () => {
      const tenant = createTenant('Pro Co', 'admin@pro.com', 'professional');
      const downgraded = changePlan(tenant, 'free');
      
      expect(downgraded.plan).toBe('free');
      expect(downgraded.status).toBe('active');
    });
  });
  
  describe('updateTenantStatus', () => {
    it('should update tenant status', () => {
      const tenant = createTenant('Test Co', 'admin@test.com');
      const suspended = updateTenantStatus(tenant, 'suspended');
      
      expect(suspended.status).toBe('suspended');
    });
  });
  
  // ============================================
  // Usage Tracking Tests
  // ============================================
  
  describe('canAddResource', () => {
    let tenant: Tenant;
    
    beforeEach(() => {
      tenant = createTenant('Limited Co', 'admin@limited.com', 'starter');
    });
    
    it('should allow adding resources within limits', () => {
      const result = canAddResource(tenant, 'users', 1);
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(PLAN_LIMITS.starter.maxUsers);
    });
    
    it('should deny adding resources when at limit', () => {
      // Update to be at limit
      tenant = updateUsage(tenant, { currentUsers: PLAN_LIMITS.starter.maxUsers });
      const result = canAddResource(tenant, 'users', 1);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
    
    it('should calculate remaining correctly', () => {
      tenant = updateUsage(tenant, { currentProspects: 500 });
      const result = canAddResource(tenant, 'prospects', 100);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(500);
    });
  });
  
  describe('updateUsage', () => {
    it('should update usage counters', () => {
      const tenant = createTenant('Usage Co', 'admin@usage.com');
      const updated = updateUsage(tenant, {
        emailsSentThisMonth: 100,
        aiCreditsUsed: 5,
      });
      
      expect(updated.usage.emailsSentThisMonth).toBe(100);
      expect(updated.usage.aiCreditsUsed).toBe(5);
    });
  });
  
  describe('resetMonthlyUsage', () => {
    it('should reset monthly counters', () => {
      let tenant = createTenant('Reset Co', 'admin@reset.com');
      tenant = updateUsage(tenant, {
        emailsSentThisMonth: 5000,
        aiCreditsUsed: 100,
        currentProspects: 500, // Should not be reset
      });
      
      const reset = resetMonthlyUsage(tenant);
      
      expect(reset.usage.emailsSentThisMonth).toBe(0);
      expect(reset.usage.aiCreditsUsed).toBe(0);
      expect(reset.usage.currentProspects).toBe(500);
    });
  });
  
  describe('getUsagePercentage', () => {
    it('should calculate usage percentage correctly', () => {
      let tenant = createTenant('Percentage Co', 'admin@pct.com', 'starter');
      tenant = updateUsage(tenant, { currentUsers: 2 });
      
      const percentage = getUsagePercentage(tenant, 'users');
      
      expect(percentage).toBe(67); // 2/3 = 66.67 rounded to 67
    });
    
    it('should return 0 for zero limits', () => {
      const tenant = createTenant('Zero Co', 'admin@zero.com');
      // Manually set max to 0 (edge case)
      tenant.limits.maxUsers = 0;
      
      const percentage = getUsagePercentage(tenant, 'users');
      
      expect(percentage).toBe(0);
    });
  });
  
  // ============================================
  // Feature Flags Tests
  // ============================================
  
  describe('hasFeature', () => {
    it('should return true for enabled features', () => {
      const tenant = createTenant('Feature Co', 'admin@feature.com', 'professional');
      
      expect(hasFeature(tenant, 'aiAssets')).toBe(true);
      expect(hasFeature(tenant, 'socialChannels')).toBe(true);
    });
    
    it('should return false for disabled features', () => {
      const tenant = createTenant('Free Co', 'admin@free.com', 'free');
      
      expect(hasFeature(tenant, 'aiAssets')).toBe(false);
      expect(hasFeature(tenant, 'ssoEnabled')).toBe(false);
    });
  });
  
  describe('getEnabledFeatures', () => {
    it('should return list of enabled features', () => {
      const tenant = createTenant('Pro Co', 'admin@pro.com', 'professional');
      const features = getEnabledFeatures(tenant);
      
      expect(features).toContain('aiAssets');
      expect(features).toContain('emailSequences');
      expect(features).toContain('socialChannels');
      expect(features).toContain('advancedAnalytics');
      expect(features).not.toContain('ssoEnabled');
    });
  });
  
  // ============================================
  // User Management Tests
  // ============================================
  
  describe('createUser', () => {
    it('should create a user with defaults', () => {
      const user = createUser('tenant-1', 'user@test.com', 'John Doe');
      
      expect(user.email).toBe('user@test.com');
      expect(user.name).toBe('John Doe');
      expect(user.tenantId).toBe('tenant-1');
      expect(user.role).toBe('member');
      expect(user.status).toBe('active');
      expect(user.teamIds).toEqual([]);
    });
    
    it('should create a user with specific role', () => {
      const user = createUser('tenant-1', 'admin@test.com', 'Admin User', 'admin');
      
      expect(user.role).toBe('admin');
    });
  });
  
  describe('createInvitedUser', () => {
    it('should create pending user with invite metadata', () => {
      const user = createInvitedUser('tenant-1', 'new@test.com', 'manager', 'inviter-1', ['team-1']);
      
      expect(user.status).toBe('pending');
      expect(user.invitedBy).toBe('inviter-1');
      expect(user.invitedAt).toBeDefined();
      expect(user.role).toBe('manager');
      expect(user.teamIds).toEqual(['team-1']);
    });
  });
  
  describe('updateUserRole', () => {
    it('should update user role', () => {
      const user = createUser('tenant-1', 'user@test.com', 'User');
      const updated = updateUserRole(user, 'manager');
      
      expect(updated.role).toBe('manager');
    });
  });
  
  describe('updateUserStatus', () => {
    it('should update user status', () => {
      const user = createUser('tenant-1', 'user@test.com', 'User');
      const suspended = updateUserStatus(user, 'suspended');
      
      expect(suspended.status).toBe('suspended');
    });
  });
  
  describe('addUserToTeam / removeUserFromTeam', () => {
    let user: User;
    
    beforeEach(() => {
      user = createUser('tenant-1', 'user@test.com', 'User');
    });
    
    it('should add user to team', () => {
      const updated = addUserToTeam(user, 'team-1');
      
      expect(updated.teamIds).toContain('team-1');
    });
    
    it('should not duplicate team membership', () => {
      let updated = addUserToTeam(user, 'team-1');
      updated = addUserToTeam(updated, 'team-1');
      
      expect(updated.teamIds.filter(id => id === 'team-1').length).toBe(1);
    });
    
    it('should remove user from team', () => {
      let updated = addUserToTeam(user, 'team-1');
      updated = addUserToTeam(updated, 'team-2');
      updated = removeUserFromTeam(updated, 'team-1');
      
      expect(updated.teamIds).not.toContain('team-1');
      expect(updated.teamIds).toContain('team-2');
    });
  });
  
  // ============================================
  // Permission Tests
  // ============================================
  
  describe('hasPermission', () => {
    it('should allow owner full access', () => {
      const owner = createUser('tenant-1', 'owner@test.com', 'Owner', 'owner');
      
      expect(hasPermission(owner, 'prospect', 'create')).toBe(true);
      expect(hasPermission(owner, 'billing', 'update')).toBe(true);
      expect(hasPermission(owner, 'users', 'delete')).toBe(true);
    });
    
    it('should restrict member access', () => {
      const member = createUser('tenant-1', 'member@test.com', 'Member', 'member');
      
      expect(hasPermission(member, 'prospect', 'read')).toBe(true);
      expect(hasPermission(member, 'prospect', 'create')).toBe(true);
      expect(hasPermission(member, 'prospect', 'delete')).toBe(false);
      expect(hasPermission(member, 'billing', 'read')).toBe(false);
    });
    
    it('should allow readonly to only read', () => {
      const readonly = createUser('tenant-1', 'readonly@test.com', 'Viewer', 'readonly');
      
      expect(hasPermission(readonly, 'prospect', 'read')).toBe(true);
      expect(hasPermission(readonly, 'prospect', 'create')).toBe(false);
      expect(hasPermission(readonly, 'prospect', 'update')).toBe(false);
    });
  });
  
  describe('getAllowedActions', () => {
    it('should return all allowed actions for a resource', () => {
      const manager = createUser('tenant-1', 'manager@test.com', 'Manager', 'manager');
      const actions = getAllowedActions(manager, 'prospect');
      
      expect(actions).toContain('create');
      expect(actions).toContain('read');
      expect(actions).toContain('update');
      expect(actions).not.toContain('delete');
    });
    
    it('should return empty array for no access', () => {
      const member = createUser('tenant-1', 'member@test.com', 'Member', 'member');
      const actions = getAllowedActions(member, 'billing');
      
      expect(actions).toEqual([]);
    });
  });
  
  describe('canManageUsers', () => {
    it('should return true for management roles', () => {
      expect(canManageUsers(createUser('t', 'o@t.com', 'O', 'owner'))).toBe(true);
      expect(canManageUsers(createUser('t', 'a@t.com', 'A', 'admin'))).toBe(true);
      expect(canManageUsers(createUser('t', 'm@t.com', 'M', 'manager'))).toBe(true);
    });
    
    it('should return false for non-management roles', () => {
      expect(canManageUsers(createUser('t', 'm@t.com', 'M', 'member'))).toBe(false);
      expect(canManageUsers(createUser('t', 'r@t.com', 'R', 'readonly'))).toBe(false);
    });
  });
  
  describe('canInviteWithRole', () => {
    it('should not allow anyone to invite owners', () => {
      const owner = createUser('t', 'o@t.com', 'O', 'owner');
      
      expect(canInviteWithRole(owner, 'owner')).toBe(false);
    });
    
    it('should allow owner to invite any non-owner role', () => {
      const owner = createUser('t', 'o@t.com', 'O', 'owner');
      
      expect(canInviteWithRole(owner, 'admin')).toBe(true);
      expect(canInviteWithRole(owner, 'manager')).toBe(true);
      expect(canInviteWithRole(owner, 'member')).toBe(true);
    });
    
    it('should restrict manager invitations', () => {
      const manager = createUser('t', 'm@t.com', 'M', 'manager');
      
      expect(canInviteWithRole(manager, 'admin')).toBe(false);
      expect(canInviteWithRole(manager, 'manager')).toBe(true);
      expect(canInviteWithRole(manager, 'member')).toBe(true);
    });
  });
  
  // ============================================
  // Team Management Tests
  // ============================================
  
  describe('createTeam', () => {
    it('should create a team with defaults', () => {
      const team = createTeam('tenant-1', 'Sales Team', 'creator-1');
      
      expect(team.name).toBe('Sales Team');
      expect(team.tenantId).toBe('tenant-1');
      expect(team.createdBy).toBe('creator-1');
      expect(team.settings.isPrivate).toBe(false);
    });
    
    it('should assign team leader', () => {
      const team = createTeam('tenant-1', 'Sales Team', 'creator-1', 'leader-1');
      
      expect(team.leaderId).toBe('leader-1');
    });
  });
  
  describe('updateTeam', () => {
    it('should update team properties', () => {
      const team = createTeam('tenant-1', 'Old Name', 'creator-1');
      const updated = updateTeam(team, {
        name: 'New Name',
        description: 'A description',
      });
      
      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('A description');
    });
  });
  
  describe('createTeamMembership', () => {
    it('should create membership with role', () => {
      const membership = createTeamMembership('team-1', 'user-1', 'leader');
      
      expect(membership.teamId).toBe('team-1');
      expect(membership.userId).toBe('user-1');
      expect(membership.role).toBe('leader');
      expect(membership.joinedAt).toBeDefined();
    });
  });
  
  // ============================================
  // Invitation Tests
  // ============================================
  
  describe('createInvitation', () => {
    it('should create a valid invitation', () => {
      const invitation = createInvitation(
        'tenant-1',
        'invitee@test.com',
        'member',
        'inviter-1'
      );
      
      expect(invitation.email).toBe('invitee@test.com');
      expect(invitation.role).toBe('member');
      expect(invitation.status).toBe('pending');
      expect(invitation.token).toBeDefined();
      expect(invitation.expiresAt).toBeDefined();
    });
  });
  
  describe('isInvitationValid', () => {
    it('should return true for pending non-expired invitation', () => {
      const invitation = createInvitation('t', 'e@t.com', 'member', 'i');
      
      expect(isInvitationValid(invitation)).toBe(true);
    });
    
    it('should return false for accepted invitation', () => {
      let invitation = createInvitation('t', 'e@t.com', 'member', 'i');
      invitation = acceptInvitation(invitation);
      
      expect(isInvitationValid(invitation)).toBe(false);
    });
    
    it('should return false for expired invitation', () => {
      const invitation = createInvitation('t', 'e@t.com', 'member', 'i', [], 0);
      // Set expiry to past
      invitation.expiresAt = new Date(Date.now() - 1000).toISOString();
      
      expect(isInvitationValid(invitation)).toBe(false);
    });
  });
  
  describe('acceptInvitation', () => {
    it('should mark invitation as accepted', () => {
      const invitation = createInvitation('t', 'e@t.com', 'member', 'i');
      const accepted = acceptInvitation(invitation);
      
      expect(accepted.status).toBe('accepted');
      expect(accepted.acceptedAt).toBeDefined();
    });
  });
  
  describe('revokeInvitation', () => {
    it('should mark invitation as revoked', () => {
      const invitation = createInvitation('t', 'e@t.com', 'member', 'i');
      const revoked = revokeInvitation(invitation);
      
      expect(revoked.status).toBe('revoked');
    });
  });
  
  // ============================================
  // Audit Logging Tests
  // ============================================
  
  describe('createAuditLog', () => {
    it('should create audit log entry', () => {
      const log = createAuditLog(
        'tenant-1',
        'user-1',
        'user@test.com',
        'user.login',
        'login',
        'User logged in successfully'
      );
      
      expect(log.tenantId).toBe('tenant-1');
      expect(log.userId).toBe('user-1');
      expect(log.eventType).toBe('user.login');
      expect(log.action).toBe('login');
      expect(log.timestamp).toBeDefined();
    });
    
    it('should include optional metadata', () => {
      const log = createAuditLog(
        'tenant-1',
        'user-1',
        'user@test.com',
        'prospect.create',
        'create',
        'Created prospect',
        {
          resourceType: 'prospect',
          resourceId: 'prospect-123',
          metadata: { name: 'New Prospect' },
          ipAddress: '192.168.1.1',
        }
      );
      
      expect(log.resourceType).toBe('prospect');
      expect(log.resourceId).toBe('prospect-123');
      expect(log.metadata).toEqual({ name: 'New Prospect' });
      expect(log.ipAddress).toBe('192.168.1.1');
    });
  });
  
  describe('filterAuditLogs', () => {
    let logs: AuditLog[];
    
    beforeEach(() => {
      logs = [
        createAuditLog('t1', 'u1', 'u1@t.com', 'user.login', 'login', 'Login'),
        createAuditLog('t1', 'u1', 'u1@t.com', 'prospect.create', 'create', 'Created'),
        createAuditLog('t1', 'u2', 'u2@t.com', 'user.login', 'login', 'Login'),
      ];
    });
    
    it('should filter by userId', () => {
      const filtered = filterAuditLogs(logs, { userId: 'u1' });
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(l => l.userId === 'u1')).toBe(true);
    });
    
    it('should filter by eventType', () => {
      const filtered = filterAuditLogs(logs, { eventType: 'user.login' });
      
      expect(filtered.length).toBe(2);
    });
    
    it('should filter by multiple criteria', () => {
      const filtered = filterAuditLogs(logs, {
        userId: 'u1',
        eventType: 'prospect.create',
      });
      
      expect(filtered.length).toBe(1);
    });
  });
  
  // ============================================
  // Data Isolation Tests
  // ============================================
  
  describe('createTenantScope', () => {
    it('should create a scope filter function', () => {
      const scope = createTenantScope('tenant-1');
      
      expect(scope({ tenantId: 'tenant-1' })).toBe(true);
      expect(scope({ tenantId: 'tenant-2' })).toBe(false);
    });
  });
  
  describe('filterByTenant', () => {
    it('should filter items by tenant', () => {
      const items = [
        { id: '1', tenantId: 'tenant-1' },
        { id: '2', tenantId: 'tenant-2' },
        { id: '3', tenantId: 'tenant-1' },
      ];
      
      const filtered = filterByTenant(items, 'tenant-1');
      
      expect(filtered.length).toBe(2);
      expect(filtered.every(i => i.tenantId === 'tenant-1')).toBe(true);
    });
  });
  
  describe('validateTenantAccess', () => {
    it('should validate tenant access', () => {
      const resource = { id: '1', tenantId: 'tenant-1' };
      
      expect(validateTenantAccess(resource, 'tenant-1')).toBe(true);
      expect(validateTenantAccess(resource, 'tenant-2')).toBe(false);
    });
  });
  
  describe('createCompositeScope', () => {
    it('should filter by tenant only when no team specified', () => {
      const scope = createCompositeScope('tenant-1');
      
      expect(scope({ tenantId: 'tenant-1' })).toBe(true);
      expect(scope({ tenantId: 'tenant-1', teamId: 'team-1' })).toBe(true);
      expect(scope({ tenantId: 'tenant-2' })).toBe(false);
    });
    
    it('should filter by both tenant and team', () => {
      const scope = createCompositeScope('tenant-1', 'team-1');
      
      expect(scope({ tenantId: 'tenant-1', teamId: 'team-1' })).toBe(true);
      expect(scope({ tenantId: 'tenant-1', teamId: 'team-2' })).toBe(false);
      expect(scope({ tenantId: 'tenant-2', teamId: 'team-1' })).toBe(false);
    });
  });
});

// ============================================
// Plan Configuration Tests
// ============================================

describe('Plan Configuration', () => {
  describe('PLAN_LIMITS', () => {
    it('should have increasing limits for higher plans', () => {
      expect(PLAN_LIMITS.starter.maxUsers).toBeGreaterThan(PLAN_LIMITS.free.maxUsers);
      expect(PLAN_LIMITS.professional.maxUsers).toBeGreaterThan(PLAN_LIMITS.starter.maxUsers);
      expect(PLAN_LIMITS.enterprise.maxUsers).toBeGreaterThan(PLAN_LIMITS.professional.maxUsers);
    });
    
    it('should have enterprise with high limits', () => {
      expect(PLAN_LIMITS.enterprise.maxUsers).toBeGreaterThan(1000);
      expect(PLAN_LIMITS.enterprise.maxProspects).toBeGreaterThan(1000);
    });
  });
  
  describe('PLAN_FEATURES', () => {
    it('should progressively enable features', () => {
      expect(PLAN_FEATURES.free.aiAssets).toBe(false);
      expect(PLAN_FEATURES.starter.aiAssets).toBe(true);
      
      expect(PLAN_FEATURES.starter.socialChannels).toBe(false);
      expect(PLAN_FEATURES.professional.socialChannels).toBe(true);
      
      expect(PLAN_FEATURES.professional.ssoEnabled).toBe(false);
      expect(PLAN_FEATURES.enterprise.ssoEnabled).toBe(true);
    });
  });
});
