/**
 * Loyalty Program Hooks
 *
 * React Query hooks for managing loyalty program data.
 * Includes settings, rewards, client loyalty, transactions, and redemptions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from './useBusiness';
import {
  getLoyaltySettings,
  upsertLoyaltySettings,
  getLoyaltyRewards,
  createLoyaltyReward,
  updateLoyaltyReward,
  deleteLoyaltyReward,
  getClientLoyalty,
  getAllClientLoyalty,
  upsertClientLoyalty,
  toggleClientLoyaltyEnrollment,
  getClientLoyaltyTransactions,
  getBusinessLoyaltyTransactions,
  awardLoyaltyPoints,
  deductLoyaltyPoints,
  getClientRedemptions,
  getPendingRedemptions,
  getBusinessAllRedemptions,
  createRedemption,
  updateRedemptionStatus,
  getLoyaltyAnalytics,
  LoyaltySettings,
  LoyaltyReward,
  ClientLoyalty,
  LoyaltyTransaction,
  LoyaltyRedemption,
  RedemptionStatus,
} from '@/services/loyaltyService';

// ============================================
// Query Keys
// ============================================

export const loyaltyKeys = {
  all: ['loyalty'] as const,
  settings: (businessId: string) => [...loyaltyKeys.all, 'settings', businessId] as const,
  rewards: (businessId: string) => [...loyaltyKeys.all, 'rewards', businessId] as const,
  clientLoyalty: (businessId: string, clientId: string) =>
    [...loyaltyKeys.all, 'clientLoyalty', businessId, clientId] as const,
  allClientLoyalty: (businessId: string) => [...loyaltyKeys.all, 'allClientLoyalty', businessId] as const,
  clientTransactions: (businessId: string, clientId: string) =>
    [...loyaltyKeys.all, 'transactions', businessId, clientId] as const,
  businessTransactions: (businessId: string, startDate?: string, endDate?: string) =>
    [...loyaltyKeys.all, 'businessTransactions', businessId, startDate, endDate] as const,
  clientRedemptions: (businessId: string, clientId: string) =>
    [...loyaltyKeys.all, 'redemptions', businessId, clientId] as const,
  pendingRedemptions: (businessId: string) => [...loyaltyKeys.all, 'pendingRedemptions', businessId] as const,
  allBusinessRedemptions: (businessId: string) => [...loyaltyKeys.all, 'allBusinessRedemptions', businessId] as const,
  analytics: (businessId: string, startDate?: string, endDate?: string) =>
    [...loyaltyKeys.all, 'analytics', businessId, startDate, endDate] as const,
};

// ============================================
// Settings Hooks
// ============================================

/**
 * Get loyalty settings for the current business
 */
export function useLoyaltySettings() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: loyaltyKeys.settings(businessId ?? ''),
    queryFn: async () => {
      if (!businessId) return null;
      const { data, error } = await getLoyaltySettings(businessId);
      if (error) throw error;
      return data;
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Update loyalty settings
 */
export function useUpdateLoyaltySettings() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (settings: Partial<Omit<LoyaltySettings, 'id' | 'business_id' | 'created_at' | 'updated_at'>>) => {
      if (!businessId) throw new Error('No business ID');
      const { data, error } = await upsertLoyaltySettings(businessId, settings);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.settings(businessId) });
      }
    },
  });
}

// ============================================
// Rewards Hooks
// ============================================

/**
 * Get all loyalty rewards for the current business
 */
export function useLoyaltyRewards() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: loyaltyKeys.rewards(businessId ?? ''),
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await getLoyaltyRewards(businessId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Create a new loyalty reward
 */
export function useCreateLoyaltyReward() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (reward: Omit<LoyaltyReward, 'id' | 'business_id' | 'created_at' | 'updated_at'>) => {
      if (!businessId) throw new Error('No business ID');
      const { data, error } = await createLoyaltyReward(businessId, reward);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.rewards(businessId) });
      }
    },
  });
}

/**
 * Update a loyalty reward
 */
export function useUpdateLoyaltyReward() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      rewardId,
      updates,
    }: {
      rewardId: string;
      updates: Partial<Omit<LoyaltyReward, 'id' | 'business_id' | 'created_at' | 'updated_at'>>;
    }) => {
      const { data, error } = await updateLoyaltyReward(rewardId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.rewards(businessId) });
      }
    },
  });
}

/**
 * Delete a loyalty reward
 */
export function useDeleteLoyaltyReward() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await deleteLoyaltyReward(rewardId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.rewards(businessId) });
      }
    },
  });
}

// ============================================
// Client Loyalty Hooks
// ============================================

/**
 * Get loyalty status for a specific client
 */
export function useClientLoyalty(clientId: string | undefined) {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: loyaltyKeys.clientLoyalty(businessId ?? '', clientId ?? ''),
    queryFn: async () => {
      if (!businessId || !clientId) return null;
      const { data, error } = await getClientLoyalty(businessId, clientId);
      if (error) throw error;
      return data;
    },
    enabled: isInitialized && !!businessId && !!clientId,
    staleTime: 30 * 1000, // 30s — points balance changes only on mutations which invalidate cache
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Get loyalty status for all clients in the business
 */
export function useAllClientLoyalty() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: loyaltyKeys.allClientLoyalty(businessId ?? ''),
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await getAllClientLoyalty(businessId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Toggle client enrollment in loyalty program
 */
export function useToggleClientLoyaltyEnrollment() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ clientId, isEnrolled }: { clientId: string; isEnrolled: boolean }) => {
      if (!businessId) throw new Error('No business ID');
      const { data, error } = await toggleClientLoyaltyEnrollment(businessId, clientId, isEnrolled);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientLoyalty(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.allClientLoyalty(businessId) });
      }
    },
  });
}

// ============================================
// Transaction Hooks
// ============================================

/**
 * Get loyalty transactions for a client
 */
export function useClientLoyaltyTransactions(clientId: string | undefined, limit = 50) {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: [...loyaltyKeys.clientTransactions(businessId ?? '', clientId ?? ''), limit],
    queryFn: async () => {
      if (!businessId || !clientId) return [];
      const { data, error } = await getClientLoyaltyTransactions(businessId, clientId, limit);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isInitialized && !!businessId && !!clientId,
    staleTime: 30 * 1000, // 30s — transactions only change on mutations which invalidate cache
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Get all loyalty transactions for the business (for analytics)
 */
export function useBusinessLoyaltyTransactions(startDate?: Date, endDate?: Date) {
  const { businessId, isInitialized } = useBusiness();
  const startDateStr = startDate?.toISOString();
  const endDateStr = endDate?.toISOString();

  return useQuery({
    queryKey: loyaltyKeys.businessTransactions(businessId ?? '', startDateStr, endDateStr),
    queryFn: async () => {
      if (!businessId) return [];
      const start = startDateStr ? new Date(startDateStr) : undefined;
      const end = endDateStr ? new Date(endDateStr) : undefined;
      const { data, error } = await getBusinessLoyaltyTransactions(businessId, start, end);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Award points to a client
 */
export function useAwardLoyaltyPoints() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      clientId,
      points,
      options,
    }: {
      clientId: string;
      points: number;
      options?: {
        source_type?: string;
        source_id?: string;
        revenue_amount?: number;
        notes?: string;
      };
    }) => {
      if (!businessId) throw new Error('No business ID');
      const { data, error } = await awardLoyaltyPoints(businessId, clientId, points, options);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientLoyalty(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientTransactions(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.allClientLoyalty(businessId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.analytics(businessId) });
      }
    },
  });
}

/**
 * Deduct points from a client
 */
export function useDeductLoyaltyPoints() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      clientId,
      points,
      options,
    }: {
      clientId: string;
      points: number;
      options?: {
        reward_id?: string;
        notes?: string;
      };
    }) => {
      if (!businessId) throw new Error('No business ID');
      const { data, error } = await deductLoyaltyPoints(businessId, clientId, points, options);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientLoyalty(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientTransactions(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.allClientLoyalty(businessId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.analytics(businessId) });
      }
    },
  });
}

// ============================================
// Redemption Hooks
// ============================================

/**
 * Get redemptions for a client
 */
export function useClientRedemptions(clientId: string | undefined) {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: loyaltyKeys.clientRedemptions(businessId ?? '', clientId ?? ''),
    queryFn: async () => {
      if (!businessId || !clientId) return [];
      const { data, error } = await getClientRedemptions(businessId, clientId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isInitialized && !!businessId && !!clientId,
    staleTime: 30 * 1000, // 30s — redemptions change only on mutations which invalidate cache
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Get all pending redemptions for the business
 */
export function usePendingRedemptions() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: loyaltyKeys.pendingRedemptions(businessId ?? ''),
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await getPendingRedemptions(businessId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Get all non-cancelled redemptions for the business (analytics detail view)
 */
export function useBusinessAllRedemptions() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: loyaltyKeys.allBusinessRedemptions(businessId ?? ''),
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await getBusinessAllRedemptions(businessId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Create a redemption (redeem a reward for a client)
 */
export function useCreateRedemption() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      clientId,
      rewardId,
      pointsUsed,
      notes,
    }: {
      clientId: string;
      rewardId: string;
      pointsUsed: number;
      notes?: string;
    }) => {
      if (!businessId) throw new Error('No business ID');
      const { data, error } = await createRedemption(businessId, clientId, rewardId, pointsUsed, notes);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientLoyalty(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientTransactions(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.clientRedemptions(businessId, variables.clientId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.pendingRedemptions(businessId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.allClientLoyalty(businessId) });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.analytics(businessId) });
      }
    },
  });
}

/**
 * Update redemption status
 */
export function useUpdateRedemptionStatus() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      redemptionId,
      status,
      confirmedBy,
    }: {
      redemptionId: string;
      status: RedemptionStatus;
      confirmedBy?: string;
    }) => {
      const { data, error } = await updateRedemptionStatus(redemptionId, status, confirmedBy);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.pendingRedemptions(businessId) });
        // Invalidate all client redemptions since we don't know which client
        queryClient.invalidateQueries({ queryKey: [...loyaltyKeys.all, 'redemptions'] });
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.analytics(businessId) });
      }
    },
  });
}

// ============================================
// Analytics Hooks
// ============================================

/**
 * Get loyalty analytics for the business
 */
export function useLoyaltyAnalytics(startDate?: Date, endDate?: Date) {
  const { businessId, isInitialized } = useBusiness();
  const startDateStr = startDate?.toISOString();
  const endDateStr = endDate?.toISOString();

  return useQuery({
    queryKey: loyaltyKeys.analytics(businessId ?? '', startDateStr, endDateStr),
    queryFn: async () => {
      if (!businessId) return null;
      const start = startDateStr ? new Date(startDateStr) : undefined;
      const end = endDateStr ? new Date(endDateStr) : undefined;
      const { data, error } = await getLoyaltyAnalytics(businessId, start, end);
      if (error) throw error;
      return data;
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Check if client has enough points for a reward
 */
export function useCanRedeemReward(clientId: string | undefined, pointsRequired: number) {
  const { data: clientLoyalty } = useClientLoyalty(clientId);

  return (clientLoyalty?.total_points ?? 0) >= pointsRequired;
}

/**
 * Get available rewards for a client (ones they can redeem)
 */
export function useAvailableRewardsForClient(clientId: string | undefined) {
  const { data: clientLoyalty } = useClientLoyalty(clientId);
  const { data: rewards = [] } = useLoyaltyRewards();

  const points = clientLoyalty?.total_points ?? 0;

  return rewards
    .filter((r) => r.is_active && r.points_required <= points)
    .sort((a, b) => b.points_required - a.points_required); // Highest value first
}
