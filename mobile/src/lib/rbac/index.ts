/**
 * RBAC Module - Role-Based Access Control
 *
 * Export all RBAC functionality for easy imports:
 * import { useRBAC, PERMISSIONS, can } from '@/lib/rbac';
 */

// Permission constants and types
export {
  ROLES,
  PERMISSION_CATEGORIES,
  PERMISSIONS,
  PERMISSION_METADATA,
  CATEGORY_METADATA,
  getPermissionsForCategory,
  getConfigurablePermissions,
  getOwnerOnlyPermissions,
  getDefaultPermissionsForRole,
  isPermissionConfigurableForRole,
  getCategoryMeta,
  getPermissionMeta,
} from './permissions';

export type {
  Role,
  Permission,
  PermissionCategory,
  PermissionMeta,
  CategoryMeta,
} from './permissions';

// Types
export type {
  BusinessMember,
  RolePermissions,
  PermissionContext,
  PermissionCheckResult,
  PermissionAuditLog,
  UserRoleResponse,
  BusinessRolePermissionsResponse,
  UpdateRolePermissionsRequest,
  PermissionToggle,
  RoleConfig,
  RBACScreenState,
  BusinessInvite,
  UsePermissionResult,
  UseRBACResult,
} from './types';

// Permission service functions
export {
  can,
  canAny,
  canAll,
  checkPermission,
  getUserRole,
  getBusinessPermissions,
  updateRolePermissions,
  setUserRole,
  isOwner,
  isManager,
  isStaff,
  getUserRoleName,
  getAuditLogs,
  getBlockedAuditLogs,
  clearAuditLogs,
  getAuditSummary,
  clearPermissionCache,
  invalidateUserRoleCache,
  invalidateBusinessPermissionsCache,
} from './permissionService';

// React hooks
export {
  usePermission,
  useRBAC,
  useRole,
  createPermissionChecker,
} from './usePermissions';
