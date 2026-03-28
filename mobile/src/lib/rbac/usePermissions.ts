/**
 * RBAC React Hooks
 * Hooks for checking permissions in React components
 */

import { useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import {
  Role,
  Permission,
  ROLES,
} from './permissions';
import {
  UsePermissionResult,
  UseRBACResult,
} from './types';
import {
  can as checkCan,
  canAny as checkCanAny,
  canAll as checkCanAll,
  getUserRole,
  isOwner as checkIsOwner,
  isManager as checkIsManager,
  isStaff as checkIsStaff,
} from './permissionService';

/**
 * Hook to check a single permission
 *
 * Usage:
 * const { can, isOwner, isLoading } = usePermission(PERMISSIONS.CLIENTS_DELETE);
 * if (can) { // show delete button }
 */
export function usePermission(
  permission: Permission,
  storeId?: string,
  actionContext?: string
): UsePermissionResult {
  const userId = useStore((s) => s.user?.id);
  const { businessId, isLoading } = useBusiness();

  const result = useMemo(() => {
    if (!userId || !businessId) {
      return {
        can: false,
        role: null,
        isOwner: false,
        isLoading: true,
      };
    }

    const userRole = getUserRole(userId, businessId);
    const canDo = checkCan(
      userId,
      businessId,
      permission,
      storeId,
      actionContext ?? `check_${permission}`,
      'usePermission'
    );

    return {
      can: canDo,
      role: userRole?.role ?? null,
      isOwner: userRole?.is_owner ?? false,
      isLoading: false,
    };
  }, [userId, businessId, permission, storeId, actionContext]);

  return {
    ...result,
    isLoading: isLoading || !userId || !businessId,
  };
}

/**
 * Main RBAC hook for components that need multiple permission checks
 *
 * Usage:
 * const { can, isOwner, role } = useRBAC();
 * if (can(PERMISSIONS.CLIENTS_DELETE)) { // show delete button }
 * if (can(PERMISSIONS.APPOINTMENTS_CREATE)) { // show create button }
 */
export function useRBAC(): UseRBACResult {
  const userId = useStore((s) => s.user?.id);
  const { businessId, isLoading } = useBusiness();

  // Get user's role info
  const roleInfo = useMemo(() => {
    if (!userId || !businessId) {
      return {
        role: null,
        isOwner: false,
        isManager: false,
        isStaff: false,
      };
    }

    const userRole = getUserRole(userId, businessId);
    return {
      role: userRole?.role ?? null,
      isOwner: userRole?.is_owner ?? false,
      isManager: userRole?.role === ROLES.MANAGER,
      isStaff: userRole?.role === ROLES.STAFF,
    };
  }, [userId, businessId]);

  // Memoized can function
  const can = useCallback(
    (permission: Permission, storeId?: string): boolean => {
      if (!userId || !businessId) return false;
      return checkCan(
        userId,
        businessId,
        permission,
        storeId,
        `check_${permission}`,
        'useRBAC'
      );
    },
    [userId, businessId]
  );

  // Memoized canAny function
  const canAny = useCallback(
    (permissions: Permission[], storeId?: string): boolean => {
      if (!userId || !businessId) return false;
      return checkCanAny(
        userId,
        businessId,
        permissions,
        storeId,
        'check_any',
        'useRBAC'
      );
    },
    [userId, businessId]
  );

  // Memoized canAll function
  const canAll = useCallback(
    (permissions: Permission[], storeId?: string): boolean => {
      if (!userId || !businessId) return false;
      return checkCanAll(
        userId,
        businessId,
        permissions,
        storeId,
        'check_all',
        'useRBAC'
      );
    },
    [userId, businessId]
  );

  return {
    ...roleInfo,
    isLoading: isLoading || !userId || !businessId,
    can,
    canAny,
    canAll,
  };
}

/**
 * Hook to get current user's role
 *
 * Usage:
 * const { role, isOwner } = useRole();
 */
export function useRole(): {
  role: Role | null;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  isLoading: boolean;
} {
  const userId = useStore((s) => s.user?.id);
  const { businessId, isLoading } = useBusiness();

  const result = useMemo(() => {
    if (!userId || !businessId) {
      return {
        role: null,
        isOwner: false,
        isManager: false,
        isStaff: false,
      };
    }

    return {
      role: getUserRole(userId, businessId)?.role ?? null,
      isOwner: checkIsOwner(userId, businessId),
      isManager: checkIsManager(userId, businessId),
      isStaff: checkIsStaff(userId, businessId),
    };
  }, [userId, businessId]);

  return {
    ...result,
    isLoading: isLoading || !userId || !businessId,
  };
}

/**
 * Helper to create a permission check function for a specific context
 * Useful for passing permission checks to child components
 *
 * Usage:
 * const checkPerm = createPermissionChecker(userId, businessId);
 * checkPerm(PERMISSIONS.CLIENTS_DELETE) // returns boolean
 */
export function createPermissionChecker(
  userId: string | undefined,
  businessId: string | undefined
): (permission: Permission, storeId?: string) => boolean {
  return (permission: Permission, storeId?: string): boolean => {
    if (!userId || !businessId) return false;
    return checkCan(
      userId,
      businessId,
      permission,
      storeId,
      `check_${permission}`,
      'createPermissionChecker'
    );
  };
}
