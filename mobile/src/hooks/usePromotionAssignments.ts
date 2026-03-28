/**
 * usePromotionAssignments Hook
 *
 * React Query wrapper for client_promotion_assignments.
 * Provides real-time fetch + optimistic update helpers for
 * assign / pause / resume / remove operations.
 *
 * This is the authoritative source of promotion assignment status —
 * NOT Zustand local state.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import {
  fetchPromotionAssignments,
  assignClientToPromotionDB,
  pausePromotionAssignment,
  resumePromotionAssignment,
  removePromotionAssignment,
  PromoAssignmentRow,
} from '@/services/promotionAssignmentsService';

// ─── Query keys ──────────────────────────────────────────────────────────────

export const promoAssignmentKeys = {
  all: ['promo-assignments'] as const,
  list: (businessId: string) => ['promo-assignments', 'list', businessId] as const,
};

// ─── Fetch hook ───────────────────────────────────────────────────────────────

export function usePromotionAssignments() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery<PromoAssignmentRow[]>({
    queryKey: promoAssignmentKeys.list(businessId ?? ''),
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await fetchPromotionAssignments(businessId);
      if (error) {
        console.warn('[usePromotionAssignments] fetch error:', error.message);
        return [];
      }
      return data ?? [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 2 * 60 * 1000, // 2 min — assignments change via optimistic updates + invalidation
    gcTime: 2 * 60 * 1000,
  });
}

// ─── Action helpers (optimistic + invalidate) ─────────────────────────────────

export function usePromotionAssignmentActions() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  const queryKey = promoAssignmentKeys.list(businessId ?? '');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: promoAssignmentKeys.list(businessId ?? '') });

  const optimisticUpdate = (updater: (rows: PromoAssignmentRow[]) => PromoAssignmentRow[]) => {
    queryClient.setQueryData<PromoAssignmentRow[]>(queryKey, (old) => updater(old ?? []));
  };

  /** Assign a client to a promotion (creates or re-activates). */
  const assign = async (clientId: string, promotionId: string) => {
    if (!businessId) return;
    // Optimistic: add as active
    optimisticUpdate((rows) => {
      const exists = rows.find((r) => r.client_id === clientId && r.promotion_id === promotionId);
      if (exists) return rows.map((r) => r.client_id === clientId && r.promotion_id === promotionId ? { ...r, status: 'active' as const } : r);
      return [...rows, { id: `temp-${clientId}-${promotionId}`, client_id: clientId, promotion_id: promotionId, status: 'active' as const, assigned_at: new Date().toISOString(), paused_at: null }];
    });
    const { error } = await assignClientToPromotionDB(businessId, clientId, promotionId);
    if (error) console.error('[usePromotionAssignmentActions] assign error:', error.message);
    await invalidate();
  };

  /** Pause an active assignment. */
  const pause = async (clientId: string, promotionId: string) => {
    if (!businessId) return;
    optimisticUpdate((rows) =>
      rows.map((r) => r.client_id === clientId && r.promotion_id === promotionId
        ? { ...r, status: 'paused' as const, paused_at: new Date().toISOString() }
        : r)
    );
    const { error } = await pausePromotionAssignment(businessId, clientId, promotionId);
    if (error) console.error('[usePromotionAssignmentActions] pause error:', error.message);
    await invalidate();
  };

  /** Resume a paused assignment. */
  const resume = async (clientId: string, promotionId: string) => {
    if (!businessId) return;
    optimisticUpdate((rows) =>
      rows.map((r) => r.client_id === clientId && r.promotion_id === promotionId
        ? { ...r, status: 'active' as const, paused_at: null }
        : r)
    );
    const { error } = await resumePromotionAssignment(businessId, clientId, promotionId);
    if (error) console.error('[usePromotionAssignmentActions] resume error:', error.message);
    await invalidate();
  };

  /** Remove an assignment permanently. */
  const remove = async (clientId: string, promotionId: string) => {
    if (!businessId) return;
    optimisticUpdate((rows) =>
      rows.filter((r) => !(r.client_id === clientId && r.promotion_id === promotionId))
    );
    const { error } = await removePromotionAssignment(businessId, clientId, promotionId);
    if (error) console.error('[usePromotionAssignmentActions] remove error:', error.message);
    await invalidate();
  };

  return { assign, pause, resume, remove };
}
