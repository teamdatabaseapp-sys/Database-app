/**
 * Promotion Counters Hooks
 *
 * React Query hooks for the DB-backed punch-card counter system.
 * Reads via Supabase RPC, writes via backend API.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import {
  getPromotionCountersForClient,
  getCounterRedemptions,
  createPromotionCounter,
  addCounterRedemption,
  editCounterRedemption,
  deletePromotionCounter,
  type PromotionCounter,
  type PromotionCounterRedemption,
  type AddRedemptionInput,
  type EditRedemptionInput,
  type CreateCounterInput,
} from '@/services/promotionCountersService';

// ============================================
// Query Keys
// ============================================

export const promotionCounterKeys = {
  all: ['promotion-counters'] as const,
  forClient: (businessId: string, clientId: string) =>
    [...promotionCounterKeys.all, 'client', businessId, clientId] as const,
  redemptions: (counterId: string) =>
    [...promotionCounterKeys.all, 'redemptions', counterId] as const,
};

// ============================================
// useClientPromotionCounters
// Fetch all counters for a given client
// ============================================

export function useClientPromotionCounters(clientId: string | null, enabled = true) {
  const { businessId } = useBusiness();

  return useQuery({
    queryKey: promotionCounterKeys.forClient(businessId || '', clientId || ''),
    queryFn: async (): Promise<PromotionCounter[]> => {
      if (!businessId || !clientId) return [];

      const result = await getPromotionCountersForClient(businessId, clientId);

      if (result.error) {
        console.log('[useClientPromotionCounters] Error:', result.error.message);
        return [];
      }

      return result.data ?? [];
    },
    enabled: enabled && !!businessId && !!clientId,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev: PromotionCounter[] | undefined) => prev,
  });
}

// ============================================
// useCounterRedemptions
// Fetch redemption history for a specific counter
// ============================================

export function useCounterRedemptions(counterId: string | null, enabled = true) {
  return useQuery({
    queryKey: promotionCounterKeys.redemptions(counterId || ''),
    queryFn: async (): Promise<PromotionCounterRedemption[]> => {
      if (!counterId) return [];

      const result = await getCounterRedemptions(counterId);

      if (result.error) {
        console.log('[useCounterRedemptions] Error:', result.error.message);
        return [];
      }

      return result.data ?? [];
    },
    enabled: enabled && !!counterId,
    staleTime: 30 * 1000, // 30s — redemptions change only on mutations which invalidate cache
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ============================================
// useCreatePromotionCounter
// ============================================

export function useCreatePromotionCounter(clientId: string) {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: (input: CreateCounterInput) => createPromotionCounter(input),
    onSuccess: () => {
      if (businessId && clientId) {
        queryClient.invalidateQueries({
          queryKey: promotionCounterKeys.forClient(businessId, clientId),
        });
      }
    },
  });
}

// ============================================
// useAddCounterRedemption
// Add a count (increment the counter)
// ============================================

export function useAddCounterRedemption(clientId: string) {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: ({
      counterId,
      input,
    }: {
      counterId: string;
      input: AddRedemptionInput;
    }) => {
      // Generate a stable idempotency key for this specific mutation call.
      // If the same object reference is retried (React Query retry), the key stays
      // the same — the backend deduplicates and returns the already-inserted row.
      const key = input.idempotency_key ?? `${counterId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return addCounterRedemption(counterId, { ...input, idempotency_key: key });
    },
    onSuccess: (result, variables) => {
      // Invalidate both the counter list and its redemptions
      if (businessId && clientId) {
        queryClient.invalidateQueries({
          queryKey: promotionCounterKeys.forClient(businessId, clientId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: promotionCounterKeys.redemptions(variables.counterId),
      });
    },
  });
}

// ============================================
// useEditCounterRedemption
// Edit a redemption with audit trail
// ============================================

export function useEditCounterRedemption(clientId: string, counterId: string) {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: ({
      redemptionId,
      input,
    }: {
      redemptionId: string;
      input: EditRedemptionInput;
    }) => editCounterRedemption(redemptionId, input),
    onSuccess: () => {
      // Refresh both the counter list (is_completed may have changed) and the redemptions list
      if (businessId && clientId) {
        queryClient.invalidateQueries({
          queryKey: promotionCounterKeys.forClient(businessId, clientId),
        });
      }
      if (counterId) {
        queryClient.invalidateQueries({
          queryKey: promotionCounterKeys.redemptions(counterId),
        });
      }
    },
  });
}

// ============================================
// useDeletePromotionCounter
// Delete a counter and all its redemptions
// ============================================

export function useDeletePromotionCounter(clientId: string) {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: (counterId: string) => deletePromotionCounter(counterId),
    onSuccess: () => {
      if (businessId && clientId) {
        queryClient.invalidateQueries({
          queryKey: promotionCounterKeys.forClient(businessId, clientId),
        });
      }
    },
  });
}
