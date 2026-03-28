/**
 * usePromotions Hook
 *
 * React Query hooks for promotions operations.
 * Handles syncing Zustand promotions to Supabase for foreign key compatibility.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPromotions,
  ensurePromotionInSupabase,
  syncPromotionsToSupabase,
  updatePromotion,
  type SupabasePromotion,
} from '@/services/promotionsService';
import { useBusiness } from '@/hooks/useBusiness';
import { useStore } from '@/lib/store';
import type { MarketingPromotion } from '@/lib/types';

// ============================================
// Query Keys
// ============================================

export const promotionKeys = {
  all: ['promotions'] as const,
  lists: () => [...promotionKeys.all, 'list'] as const,
  list: (businessId: string) => [...promotionKeys.lists(), businessId] as const,
};

// ============================================
// Helpers
// ============================================

/**
 * Map a Supabase promotion row back to a Zustand MarketingPromotion.
 * Used to hydrate Zustand with rows that were seeded directly in the DB.
 */
function supabaseToZustand(row: SupabasePromotion, userId: string): MarketingPromotion {
  return {
    id: row.id,
    userId,
    name: row.title,
    description: row.description || '',
    discountType: (row.discount_type as MarketingPromotion['discountType']) || 'percentage',
    discountValue: row.discount_value ?? 0,
    isActive: row.is_active,
    startDate: row.starts_at ? new Date(row.starts_at) : new Date(),
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    color: '',   // no color column in DB — will use theme color
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
  };
}

// ============================================
// Hooks
// ============================================

/**
 * Hook to get all promotions from Supabase
 */
export function usePromotions() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: promotionKeys.list(businessId || ''),
    queryFn: async () => {
      if (!businessId) {
        console.log('[usePromotions] No businessId, returning empty array');
        return [];
      }
      console.log('[usePromotions] Fetching promotions for business:', businessId);
      const result = await getPromotions(businessId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hydrate Zustand marketingPromotions from Supabase.
 * Supabase is the single source of truth. The entire local promotions array
 * is replaced with exactly what Supabase returns — no appending, no merging.
 * This eliminates all duplicate scenarios (stale cache, race conditions, re-seeding).
 */
export function useHydratePromotionsFromSupabase() {
  const { data: supabasePromos, isSuccess } = usePromotions();
  const userId = useStore((s) => s.user?.id);

  useEffect(() => {
    if (!isSuccess || !userId) return;

    // Replace the entire promotions slice with the authoritative Supabase data.
    // Empty array from Supabase means zero promotions — that is correct and must be respected.
    const canonical: MarketingPromotion[] = (supabasePromos ?? []).map((row) =>
      supabaseToZustand(row, userId)
    );

    // Atomically set — no append, no merge, no duplicates possible.
    useStore.setState((state) => ({
      // Preserve promotions belonging to other users (multi-account edge case),
      // then replace this user's promotions with the canonical Supabase set.
      marketingPromotions: [
        ...state.marketingPromotions.filter((p) => p.userId !== userId),
        ...canonical,
      ],
    }));

    console.log(`[useHydratePromotions] Replaced store with ${canonical.length} promotions from Supabase`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, supabasePromos, userId]);
}

/**
 * Hook to ensure a Zustand promotion exists in Supabase
 * Call this before saving an appointment with a promo_id
 */
export function useEnsurePromotion() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (zustandPromotion: MarketingPromotion) => {
      if (!businessId) {
        console.log('[useEnsurePromotion] No businessId, skipping');
        throw new Error('No business ID available');
      }
      console.log('[useEnsurePromotion] Ensuring promotion exists:', zustandPromotion.id);
      const result = await ensurePromotionInSupabase(businessId, zustandPromotion);
      if (result.error) {
        console.log('[useEnsurePromotion] Error syncing promotion:', result.error.message);
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: promotionKeys.all });
      }
    },
  });
}

/**
 * Hook to sync all Zustand promotions to Supabase
 * Call this on app init or when promotions change
 */
export function useSyncPromotions() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (zustandPromotions: MarketingPromotion[]) => {
      if (!businessId) {
        console.log('[useSyncPromotions] No businessId, skipping');
        return [];
      }
      console.log('[useSyncPromotions] Syncing', zustandPromotions.length, 'promotions');
      const result = await syncPromotionsToSupabase(businessId, zustandPromotions);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promotionKeys.all });
    },
  });
}

/**
 * Hook to update an existing promotion in Supabase using UPDATE (never insert).
 * Use this whenever editing an existing promotion.
 */
export function useUpdatePromotion() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (promotion: MarketingPromotion) => {
      if (!businessId) throw new Error('No business ID available');
      console.log('[useUpdatePromotion] Updating promotion:', promotion.id);
      const result = await updatePromotion(businessId, promotion);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promotionKeys.all });
    },
  });
}

// Re-export types
export type { SupabasePromotion };
