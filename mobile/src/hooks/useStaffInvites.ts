/**
 * useStaffInvites Hook
 *
 * React Query hooks for managing staff invites.
 * Provides CRUD operations for invites and member management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import {
  createStaffInvite,
  getBusinessInvites,
  getPendingInvites,
  cancelInvite,
  resendInvite,
  getBusinessMembers,
  getStaffAccessData,
  updateMember,
  removeMember,
  hasAnyStaffMembership,
  type StaffInvite,
  type BusinessMember,
  type InviteRole,
  type StaffAccessData,
} from '@/services/staffInviteService';

// Query keys
export const INVITES_QUERY_KEY = ['staff-invites'] as const;
export const MEMBERS_QUERY_KEY = ['business-members'] as const;
export const STAFF_ACCESS_QUERY_KEY = ['staff-access'] as const;
export const STAFF_ACCESS_DATA_KEY = ['staff-access-data'] as const;

// ============================================
// Invite Hooks
// ============================================

/**
 * Fetch all invites for the current business
 */
export function useStaffInvites() {
  const { businessId } = useBusiness();

  return useQuery({
    queryKey: [...INVITES_QUERY_KEY, businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await getBusinessInvites(businessId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!businessId,
  });
}

/**
 * Fetch pending (not accepted, not expired) invites
 * @deprecated Use useStaffAccessData() instead for optimized single-query fetch
 */
export function usePendingInvites() {
  const { businessId } = useBusiness();

  return useQuery({
    queryKey: [...INVITES_QUERY_KEY, 'pending', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await getPendingInvites(businessId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!businessId,
    staleTime: 60 * 1000,
  });
}

/**
 * Create a new staff invite
 */
export function useCreateInvite() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (input: {
      email: string;
      role: InviteRole;
      storeIds?: string[];
      invitedBy: string;
    }) => {
      if (!businessId) throw new Error('No business ID');
      const { data, error } = await createStaffInvite({
        businessId,
        ...input,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate combined staff access data query
      queryClient.invalidateQueries({ queryKey: STAFF_ACCESS_DATA_KEY });
    },
  });
}

/**
 * Cancel/delete an invite
 */
export function useCancelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await cancelInvite(inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_ACCESS_DATA_KEY });
    },
  });
}

/**
 * Resend an invite (extends expiration)
 */
export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await resendInvite(inviteId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_ACCESS_DATA_KEY });
    },
  });
}

// ============================================
// Member Hooks
// ============================================

/**
 * Fetch all members of the current business
 * @deprecated Use useStaffAccessData() instead for optimized single-query fetch
 */
export function useBusinessMembers() {
  const { businessId } = useBusiness();

  return useQuery({
    queryKey: [...MEMBERS_QUERY_KEY, businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await getBusinessMembers(businessId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!businessId,
    staleTime: 60 * 1000,
  });
}

/**
 * Update a member's role or store assignments
 */
export function useUpdateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      memberId: string;
      updates: { role?: InviteRole; store_ids?: string[]; is_active?: boolean };
    }) => {
      const { data, error } = await updateMember(input.memberId, input.updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_ACCESS_DATA_KEY });
    },
  });
}

/**
 * Remove a member from the business
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await removeMember(memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_ACCESS_DATA_KEY });
    },
  });
}

// ============================================
// Combined Staff Access Data Hook (Optimized)
// ============================================

// DEV ONLY: Track RPC call count for performance verification
let __staffAccessRpcCallCount = 0;

// DEV ONLY: Export for screen-level audit
export function getStaffAccessRpcCallCount() {
  return __staffAccessRpcCallCount;
}

export function resetStaffAccessRpcCallCount() {
  __staffAccessRpcCallCount = 0;
}

/**
 * Fetch all staff access data in a single RPC call.
 * Returns both pending invites and team members.
 * This is the optimized hook - use instead of separate usePendingInvites + useBusinessMembers.
 */
export function useStaffAccessData() {
  const { businessId } = useBusiness();

  return useQuery({
    queryKey: [...STAFF_ACCESS_DATA_KEY, businessId],
    queryFn: async () => {
      if (!businessId) {
        return { pending_invites: [], team_members: [] } as StaffAccessData;
      }

      // DEV ONLY: Performance logging
      const startTime = performance.now();
      __staffAccessRpcCallCount++;
      const callNumber = __staffAccessRpcCallCount;
      console.log(`[StaffAccess PERF] RPC call #${callNumber} started at ${startTime.toFixed(2)}ms`);

      const { data, error } = await getStaffAccessData(businessId);

      // DEV ONLY: Log completion
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`[StaffAccess PERF] RPC call #${callNumber} completed in ${duration.toFixed(2)}ms (total calls: ${__staffAccessRpcCallCount})`);

      if (error) throw error;
      return data ?? { pending_invites: [], team_members: [] };
    },
    enabled: !!businessId,
    staleTime: 60 * 1000, // Data considered fresh for 60 seconds - no refetch
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes after unmount
    refetchOnMount: false, // Don't refetch if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on app focus
  });
}

// ============================================
// Staff Access Hook
// ============================================

/**
 * Check if current user has ANY staff membership (manager or staff, not owner).
 * Used to determine paywall bypass - staff/managers can access app without subscription.
 */
export function useHasStaffAccess(userId: string | undefined) {
  return useQuery({
    queryKey: [...STAFF_ACCESS_QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return false;
      return await hasAnyStaffMembership(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// ============================================
// Utility Types
// ============================================

export type { StaffInvite, BusinessMember, InviteRole };
