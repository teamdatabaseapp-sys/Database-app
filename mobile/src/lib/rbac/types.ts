/**
 * RBAC Type Definitions
 * Database schema types for Role-Based Access Control
 */

import { Role, Permission } from './permissions';

// ============================================
// Database Types
// ============================================

/**
 * Business member - links a user to a business with a role
 * Scoped by (user_id, business_id) with optional store_id
 */
export interface BusinessMember {
  id: string;
  user_id: string;
  business_id: string;
  role: Role;
  store_ids?: string[]; // Optional: specific stores this member can access
  invited_by?: string; // User ID who invited this member
  invited_at?: Date;
  accepted_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Role permissions - stores custom permission overrides for a role within a business
 */
export interface RolePermissions {
  id: string;
  business_id: string;
  role: Role; // 'manager' or 'staff' (owner permissions are fixed)
  permissions: Permission[]; // Array of granted permissions
  created_at: Date;
  updated_at: Date;
}

/**
 * Permission check context
 */
export interface PermissionContext {
  user_id: string;
  business_id: string;
  store_id?: string; // Optional: for store-scoped permission checks
}

/**
 * Permission check result with audit info
 */
export interface PermissionCheckResult {
  allowed: boolean;
  permission: Permission;
  context: PermissionContext;
  role: Role;
  reason: 'owner_always_allowed' | 'permission_granted' | 'permission_denied' | 'no_role_found';
  checked_at: Date;
}

/**
 * Permission audit log entry (for telemetry/shadow mode)
 */
export interface PermissionAuditLog {
  id: string;
  user_id: string;
  business_id: string;
  store_id?: string;
  permission: Permission;
  role: Role;
  allowed: boolean;
  would_be_blocked: boolean; // Shadow mode: would this have been blocked in production?
  action_context: string; // What action triggered this check (e.g., 'delete_client', 'create_appointment')
  component: string; // Which UI component triggered this
  timestamp: Date;
}

// ============================================
// API Response Types
// ============================================

/**
 * Response when fetching user's role in a business
 */
export interface UserRoleResponse {
  user_id: string;
  business_id: string;
  role: Role;
  permissions: Permission[];
  is_owner: boolean;
}

/**
 * Response when fetching all role permissions for a business
 */
export interface BusinessRolePermissionsResponse {
  business_id: string;
  manager_permissions: Permission[];
  staff_permissions: Permission[];
}

/**
 * Request to update role permissions
 */
export interface UpdateRolePermissionsRequest {
  business_id: string;
  role: 'manager' | 'staff'; // Can't update owner permissions
  permissions: Permission[];
}

// ============================================
// UI State Types
// ============================================

/**
 * Permission toggle state for UI
 */
export interface PermissionToggle {
  permission: Permission;
  enabled: boolean;
  isLocked: boolean; // true if owner-only or cannot be changed
}

/**
 * Role configuration state for UI
 */
export interface RoleConfig {
  role: Role;
  permissions: PermissionToggle[];
  isDirty: boolean; // Has unsaved changes
}

/**
 * RBAC screen state
 */
export interface RBACScreenState {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  managerConfig: RoleConfig;
  staffConfig: RoleConfig;
  selectedRole: 'manager' | 'staff';
}

// ============================================
// Invite Types
// ============================================

/**
 * Business invite for adding new team members
 */
export interface BusinessInvite {
  id: string;
  business_id: string;
  email: string;
  role: 'manager' | 'staff'; // Can't invite as owner
  store_ids?: string[];
  invited_by: string;
  invite_code: string;
  expires_at: Date;
  accepted_at?: Date;
  created_at: Date;
}

// ============================================
// Permission Check Hook Types
// ============================================

/**
 * Hook return type for usePermission
 */
export interface UsePermissionResult {
  can: boolean;
  role: Role | null;
  isOwner: boolean;
  isLoading: boolean;
}

/**
 * Hook return type for useRBAC
 */
export interface UseRBACResult {
  role: Role | null;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  isLoading: boolean;
  can: (permission: Permission, storeId?: string) => boolean;
  canAny: (permissions: Permission[], storeId?: string) => boolean;
  canAll: (permissions: Permission[], storeId?: string) => boolean;
}
