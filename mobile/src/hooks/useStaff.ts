/**
 * useStaff Hook
 *
 * React Query hooks for staff members operations.
 * All operations are scoped to the current business.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffMembers,
  getStaffForStore,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  updateStaffStoreAssignments,
  archiveStaffMember,
  restoreStaffMember,
  deleteStaffMember,
  type StaffMemberWithAssignments,
  type CreateStaffInput,
  type UpdateStaffInput,
} from '@/services/staffService';
import { useBusiness } from '@/hooks/useBusiness';
import { staffCalendarKeys } from '@/hooks/useStaffCalendar';

// ============================================
// Query Keys
// ============================================

export const staffKeys = {
  all: ['staff'] as const,
  lists: () => [...staffKeys.all, 'list'] as const,
  list: (businessId: string) => [...staffKeys.lists(), businessId] as const,
  forStore: (businessId: string, storeId: string) => [...staffKeys.lists(), businessId, 'store', storeId] as const,
  details: () => [...staffKeys.all, 'detail'] as const,
  detail: (id: string) => [...staffKeys.details(), id] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to get all staff members for the current business
 */
export function useStaffMembers() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: staffKeys.list(businessId || ''),
    queryFn: async () => {
      if (!businessId) {
        console.log('[useStaffMembers] No businessId, returning empty array');
        return [];
      }
      console.log('[useStaffMembers] Fetching staff for business:', businessId);
      const result = await getStaffMembers(businessId);
      if (result.error) {
        // Check if it's a "table doesn't exist" error - return empty array instead of throwing
        const errorMessage = result.error.message || '';
        if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
          console.log('[useStaffMembers] Staff table not found - returning empty array (table needs to be created)');
          return [];
        }
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 5 * 60 * 1000,
    // Don't retry if table doesn't exist
    retry: (failureCount, error) => {
      const errorMessage = (error as Error)?.message || '';
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to get staff members for a specific store
 */
export function useStaffForStore(storeId: string | null) {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: staffKeys.forStore(businessId || '', storeId || ''),
    queryFn: async () => {
      if (!businessId || !storeId) {
        console.log('[useStaffForStore] No businessId or storeId, returning empty array');
        return [];
      }
      console.log('[useStaffForStore] Fetching staff for store:', storeId);
      const result = await getStaffForStore(businessId, storeId);
      if (result.error) {
        // Check if it's a "table doesn't exist" error - return empty array instead of throwing
        const errorMessage = result.error.message || '';
        if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
          console.log('[useStaffForStore] Staff table not found - returning empty array (table needs to be created)');
          return [];
        }
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId && !!storeId,
    staleTime: 5 * 60 * 1000,
    // Don't retry if table doesn't exist
    retry: (failureCount, error) => {
      const errorMessage = (error as Error)?.message || '';
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to get a single staff member
 */
export function useStaffMember(staffId: string | null) {
  return useQuery({
    queryKey: staffKeys.detail(staffId || ''),
    queryFn: async () => {
      if (!staffId) return null;
      console.log('[useStaffMember] Fetching staff member:', staffId);
      const result = await getStaffMember(staffId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a staff member
 */
export function useCreateStaffMember() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (input: Omit<CreateStaffInput, 'business_id'>) => {
      if (!businessId) {
        console.log('[useCreateStaffMember] No business ID available');
        throw new Error('No business ID available');
      }
      console.log('[useCreateStaffMember] Creating staff member:', input.full_name, 'for business:', businessId);
      const result = await createStaffMember({
        ...input,
        business_id: businessId,
      });
      if (result.error) {
        console.log('[useCreateStaffMember] Error from service:', result.error.message);
        throw result.error;
      }
      console.log('[useCreateStaffMember] Staff member created successfully:', result.data?.id);
      return result.data;
    },
    onSuccess: () => {
      console.log('[useCreateStaffMember] Invalidating staff queries for business:', businessId);
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.list(businessId) });
        // Also invalidate staff calendar queries so new staff appears in calendar
        queryClient.invalidateQueries({ queryKey: staffCalendarKeys.all });
      }
    },
    onError: (error) => {
      console.log('[useCreateStaffMember] Mutation error:', error);
    },
  });
}

/**
 * Hook to update a staff member
 */
export function useUpdateStaffMember() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ staffId, updates }: { staffId: string; updates: UpdateStaffInput }) => {
      console.log('[useUpdateStaffMember] Updating staff member:', staffId);
      const result = await updateStaffMember(staffId, updates, businessId || undefined);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.list(businessId) });
        // Also invalidate staff calendar queries so updated staff assignments are reflected
        queryClient.invalidateQueries({ queryKey: staffCalendarKeys.all });
      }
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: staffKeys.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to update staff store assignments
 */
export function useUpdateStaffAssignments() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ staffId, storeIds }: { staffId: string; storeIds: string[] }) => {
      if (!businessId) {
        throw new Error('No business ID available');
      }
      console.log('[useUpdateStaffAssignments] Updating assignments for:', staffId);
      const result = await updateStaffStoreAssignments(businessId, staffId, storeIds);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.list(businessId) });
        // Also invalidate staff calendar queries so updated staff assignments are reflected
        queryClient.invalidateQueries({ queryKey: staffCalendarKeys.all });
      }
    },
  });
}

/**
 * Hook to archive a staff member
 */
export function useArchiveStaffMember() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (staffId: string) => {
      console.log('[useArchiveStaffMember] Archiving staff member:', staffId);
      const result = await archiveStaffMember(staffId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.list(businessId) });
        // Also invalidate staff calendar queries
        queryClient.invalidateQueries({ queryKey: staffCalendarKeys.all });
      }
    },
  });
}

/**
 * Hook to restore an archived staff member
 */
export function useRestoreStaffMember() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (staffId: string) => {
      console.log('[useRestoreStaffMember] Restoring staff member:', staffId);
      const result = await restoreStaffMember(staffId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.list(businessId) });
        // Also invalidate staff calendar queries
        queryClient.invalidateQueries({ queryKey: staffCalendarKeys.all });
      }
    },
  });
}

/**
 * Hook to delete a staff member permanently
 */
export function useDeleteStaffMember() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (staffId: string) => {
      console.log('[useDeleteStaffMember] Deleting staff member:', staffId);
      const result = await deleteStaffMember(staffId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.list(businessId) });
        // Also invalidate staff calendar queries
        queryClient.invalidateQueries({ queryKey: staffCalendarKeys.all });
      }
    },
  });
}
