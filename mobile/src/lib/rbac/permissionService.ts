/**
 * RBAC Permission Service
 * Centralized permission checking with telemetry logging
 *
 * SHADOW MODE: This service logs permission checks but does NOT block actions.
 * All permission checks return true in shadow mode, but log what would have been blocked.
 */

import {
  Role,
  Permission,
  ROLES,
  PERMISSION_METADATA,
  getDefaultPermissionsForRole,
} from './permissions';
import {
  PermissionContext,
  PermissionCheckResult,
  PermissionAuditLog,
  UserRoleResponse,
  BusinessRolePermissionsResponse,
} from './types';

// ============================================
// Shadow Mode Configuration
// ============================================

/**
 * SHADOW_MODE: When true, all permission checks pass but log what would be blocked
 * Set to false when ready to enforce permissions
 */
const SHADOW_MODE = true;

/**
 * Enable/disable audit logging
 */
const ENABLE_AUDIT_LOGGING = true;

// ============================================
// In-Memory Cache (will be replaced with Supabase)
// ============================================

interface PermissionCache {
  userRoles: Map<string, UserRoleResponse>; // key: `${user_id}:${business_id}`
  businessPermissions: Map<string, BusinessRolePermissionsResponse>; // key: business_id
  auditLogs: PermissionAuditLog[]; // In-memory audit log for shadow mode
}

const cache: PermissionCache = {
  userRoles: new Map(),
  businessPermissions: new Map(),
  auditLogs: [],
};

// ============================================
// Permission Service Functions
// ============================================

/**
 * Get user's role in a business
 * In shadow mode, returns 'owner' if no role is found (backwards compatibility)
 */
export function getUserRole(userId: string, businessId: string): UserRoleResponse | null {
  const cacheKey = `${userId}:${businessId}`;
  const cached = cache.userRoles.get(cacheKey);

  if (cached) {
    return cached;
  }

  // SHADOW MODE: Return owner role for current user (backwards compatibility)
  // In production, this would fetch from Supabase
  if (SHADOW_MODE) {
    const defaultOwnerRole: UserRoleResponse = {
      user_id: userId,
      business_id: businessId,
      role: ROLES.OWNER,
      permissions: getDefaultPermissionsForRole(ROLES.OWNER),
      is_owner: true,
    };
    cache.userRoles.set(cacheKey, defaultOwnerRole);
    return defaultOwnerRole;
  }

  return null;
}

/**
 * Get business role permissions configuration
 */
export function getBusinessPermissions(businessId: string): BusinessRolePermissionsResponse {
  const cached = cache.businessPermissions.get(businessId);

  if (cached) {
    return cached;
  }

  // Return defaults if not configured
  const defaultPermissions: BusinessRolePermissionsResponse = {
    business_id: businessId,
    manager_permissions: getDefaultPermissionsForRole(ROLES.MANAGER),
    staff_permissions: getDefaultPermissionsForRole(ROLES.STAFF),
  };

  cache.businessPermissions.set(businessId, defaultPermissions);
  return defaultPermissions;
}

/**
 * Update role permissions for a business
 */
export function updateRolePermissions(
  businessId: string,
  role: 'manager' | 'staff',
  permissions: Permission[]
): void {
  const current = getBusinessPermissions(businessId);

  const updated: BusinessRolePermissionsResponse = {
    ...current,
    [role === 'manager' ? 'manager_permissions' : 'staff_permissions']: permissions,
  };

  cache.businessPermissions.set(businessId, updated);

  // Log the update for audit
  console.log(`[RBAC] Updated ${role} permissions for business ${businessId}:`, permissions);
}

/**
 * Set user role in a business (for testing/setup)
 */
export function setUserRole(
  userId: string,
  businessId: string,
  role: Role,
  permissions?: Permission[]
): void {
  const cacheKey = `${userId}:${businessId}`;
  const effectivePermissions = permissions ?? getDefaultPermissionsForRole(role);

  cache.userRoles.set(cacheKey, {
    user_id: userId,
    business_id: businessId,
    role,
    permissions: effectivePermissions,
    is_owner: role === ROLES.OWNER,
  });
}

// ============================================
// Core Permission Check Function
// ============================================

/**
 * Check if user has a specific permission
 *
 * @param context - User and business context
 * @param permission - The permission to check
 * @param actionContext - Description of what action triggered this check
 * @param component - Which UI component triggered this
 * @returns PermissionCheckResult with allowed status and audit info
 *
 * SHADOW MODE: Always returns allowed=true, but logs what would be blocked
 */
export function checkPermission(
  context: PermissionContext,
  permission: Permission,
  actionContext: string = 'unknown',
  component: string = 'unknown'
): PermissionCheckResult {
  const { user_id, business_id, store_id } = context;

  // Get user's role
  const userRole = getUserRole(user_id, business_id);

  // No role found
  if (!userRole) {
    const result: PermissionCheckResult = {
      allowed: SHADOW_MODE, // Allow in shadow mode
      permission,
      context,
      role: ROLES.STAFF, // Default to most restrictive
      reason: 'no_role_found',
      checked_at: new Date(),
    };

    logPermissionCheck(result, actionContext, component, !SHADOW_MODE);
    return result;
  }

  // Owner always has all permissions
  if (userRole.is_owner) {
    const result: PermissionCheckResult = {
      allowed: true,
      permission,
      context,
      role: ROLES.OWNER,
      reason: 'owner_always_allowed',
      checked_at: new Date(),
    };

    logPermissionCheck(result, actionContext, component, false);
    return result;
  }

  // Check if user has the specific permission
  const hasPermission = userRole.permissions.includes(permission);

  const result: PermissionCheckResult = {
    allowed: SHADOW_MODE ? true : hasPermission, // Allow all in shadow mode
    permission,
    context,
    role: userRole.role,
    reason: hasPermission ? 'permission_granted' : 'permission_denied',
    checked_at: new Date(),
  };

  // Log what would be blocked
  logPermissionCheck(result, actionContext, component, !hasPermission);

  return result;
}

/**
 * Simplified permission check - returns boolean only
 *
 * This is the main function to use throughout the app:
 * if (can(userId, businessId, PERMISSIONS.CLIENTS_DELETE)) { ... }
 */
export function can(
  userId: string,
  businessId: string,
  permission: Permission,
  storeId?: string,
  actionContext: string = 'check',
  component: string = 'unknown'
): boolean {
  const result = checkPermission(
    { user_id: userId, business_id: businessId, store_id: storeId },
    permission,
    actionContext,
    component
  );
  return result.allowed;
}

/**
 * Check if user has ANY of the given permissions
 */
export function canAny(
  userId: string,
  businessId: string,
  permissions: Permission[],
  storeId?: string,
  actionContext: string = 'check_any',
  component: string = 'unknown'
): boolean {
  return permissions.some(permission =>
    can(userId, businessId, permission, storeId, actionContext, component)
  );
}

/**
 * Check if user has ALL of the given permissions
 */
export function canAll(
  userId: string,
  businessId: string,
  permissions: Permission[],
  storeId?: string,
  actionContext: string = 'check_all',
  component: string = 'unknown'
): boolean {
  return permissions.every(permission =>
    can(userId, businessId, permission, storeId, actionContext, component)
  );
}

// ============================================
// Role Check Helpers
// ============================================

/**
 * Check if user is the owner of a business
 */
export function isOwner(userId: string, businessId: string): boolean {
  const userRole = getUserRole(userId, businessId);
  return userRole?.is_owner ?? false;
}

/**
 * Check if user is a manager in a business
 */
export function isManager(userId: string, businessId: string): boolean {
  const userRole = getUserRole(userId, businessId);
  return userRole?.role === ROLES.MANAGER;
}

/**
 * Check if user is staff in a business
 */
export function isStaff(userId: string, businessId: string): boolean {
  const userRole = getUserRole(userId, businessId);
  return userRole?.role === ROLES.STAFF;
}

/**
 * Get user's role name for display
 */
export function getUserRoleName(userId: string, businessId: string): Role | null {
  const userRole = getUserRole(userId, businessId);
  return userRole?.role ?? null;
}

// ============================================
// Audit Logging
// ============================================

/**
 * Log a permission check for audit/telemetry
 */
function logPermissionCheck(
  result: PermissionCheckResult,
  actionContext: string,
  component: string,
  wouldBeBlocked: boolean
): void {
  if (!ENABLE_AUDIT_LOGGING) return;

  const logEntry: PermissionAuditLog = {
    id: generateId(),
    user_id: result.context.user_id,
    business_id: result.context.business_id,
    store_id: result.context.store_id,
    permission: result.permission,
    role: result.role,
    allowed: result.allowed,
    would_be_blocked: wouldBeBlocked,
    action_context: actionContext,
    component,
    timestamp: result.checked_at,
  };

  // Store in memory for shadow mode analysis
  cache.auditLogs.push(logEntry);

  // Keep only last 1000 entries to prevent memory issues
  if (cache.auditLogs.length > 1000) {
    cache.auditLogs = cache.auditLogs.slice(-1000);
  }

  // Console log for development visibility
  if (wouldBeBlocked) {
    console.log(
      `[RBAC SHADOW] Would block: ${result.permission} for ${result.role} in ${component} (${actionContext})`
    );
  } else if (result.reason !== 'owner_always_allowed') {
    console.log(
      `[RBAC] Allowed: ${result.permission} for ${result.role} in ${component}`
    );
  }
}

/**
 * Get audit logs for analysis (shadow mode)
 */
export function getAuditLogs(): PermissionAuditLog[] {
  return [...cache.auditLogs];
}

/**
 * Get audit logs that would have been blocked
 */
export function getBlockedAuditLogs(): PermissionAuditLog[] {
  return cache.auditLogs.filter(log => log.would_be_blocked);
}

/**
 * Clear audit logs
 */
export function clearAuditLogs(): void {
  cache.auditLogs = [];
}

/**
 * Get audit summary for debugging
 */
export function getAuditSummary(): {
  total: number;
  allowed: number;
  wouldBeBlocked: number;
  byPermission: Record<string, number>;
  byRole: Record<string, number>;
} {
  const logs = cache.auditLogs;
  const byPermission: Record<string, number> = {};
  const byRole: Record<string, number> = {};

  logs.forEach(log => {
    byPermission[log.permission] = (byPermission[log.permission] || 0) + 1;
    byRole[log.role] = (byRole[log.role] || 0) + 1;
  });

  return {
    total: logs.length,
    allowed: logs.filter(l => l.allowed).length,
    wouldBeBlocked: logs.filter(l => l.would_be_blocked).length,
    byPermission,
    byRole,
  };
}

// ============================================
// Utility Functions
// ============================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================
// Cache Management
// ============================================

/**
 * Clear all caches (for logout/refresh)
 */
export function clearPermissionCache(): void {
  cache.userRoles.clear();
  cache.businessPermissions.clear();
}

/**
 * Invalidate cache for a specific user/business
 */
export function invalidateUserRoleCache(userId: string, businessId: string): void {
  cache.userRoles.delete(`${userId}:${businessId}`);
}

/**
 * Invalidate cache for a business's permissions
 */
export function invalidateBusinessPermissionsCache(businessId: string): void {
  cache.businessPermissions.delete(businessId);
}
