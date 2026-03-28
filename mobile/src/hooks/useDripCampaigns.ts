/**
 * useDripCampaigns Hook
 *
 * Hydrates Zustand dripCampaigns from Supabase on every screen mount.
 * Source of truth: public.drip_campaigns (Supabase).
 *
 * The drip_campaigns table MUST exist in Supabase.
 * Run the migration SQL from /api/migrations/sql in the Supabase SQL Editor.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import {
  fetchDripCampaigns,
  fetchEnrollments,
  upsertDripCampaign,
  deleteDripCampaignFromSupabase,
  type EnrollmentRow,
} from '@/services/dripCampaignsService';
import type { DripCampaign } from '@/lib/types';

export const enrollmentKeys = {
  all: ['drip-enrollments'] as const,
  list: (businessId: string) => ['drip-enrollments', 'list', businessId] as const,
};

/**
 * React Query hook that fetches ALL active enrollments for the business.
 * This is the source of truth for stats in AssignManageView.
 */
export function useEnrollments() {
  const { businessId, isInitialized } = useBusiness();
  return useQuery<EnrollmentRow[]>({
    queryKey: enrollmentKeys.list(businessId || ''),
    queryFn: async () => {
      if (!businessId) return [];
      console.log('[useEnrollments] Fetching enrollments for business:', businessId);
      const { data, error } = await fetchEnrollments(businessId);
      if (error) {
        console.warn('[useEnrollments] Error:', error);
        return [];
      }
      console.log('[useEnrollments] Fetched', data?.length ?? 0, 'enrollments');
      return data ?? [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 2 * 60 * 1000, // 2 min — enrollment counts update via mutations that invalidate
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Call this hook in DripCampaignScreen and ClientDetailScreen.
 * Fetches from Supabase and merges into Zustand on every mount.
 */
export function useHydrateDripCampaigns() {
  const { businessId, isInitialized } = useBusiness();
  const userId = useStore((s) => s.user?.id);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isInitialized || !businessId || !userId) return;
    if (runningRef.current) return;
    runningRef.current = true;

    (async () => {
      try {
        console.log('[useDripCampaigns] Hydrating from Supabase, businessId:', businessId);
        const { data, tableExists, error } = await fetchDripCampaigns(businessId);

        if (!tableExists) {
          console.error('[useDripCampaigns] drip_campaigns table does not exist in Supabase. Run migration SQL.');
          return;
        }
        if (error) {
          // Use warn for network/transient errors to avoid React error boundaries
          console.warn('[useDripCampaigns] Fetch failed:', error);
          return;
        }
        if (!data) return;

        if (data.length === 0) {
          console.log('[useDripCampaigns] No campaigns in Supabase for this business');
          return;
        }

        // Merge Supabase rows into Zustand, preserving userId
        const currentCampaigns = useStore.getState().dripCampaigns;
        const currentById = new Map(currentCampaigns.map((c) => [c.id, c]));

        const toAdd: DripCampaign[] = [];
        const toUpdate: Array<{ id: string; updates: Partial<DripCampaign> }> = [];

        for (const row of data) {
          const hydrated: DripCampaign = { ...row, userId };
          if (!currentById.has(row.id)) {
            toAdd.push(hydrated);
          } else {
            toUpdate.push({
              id: row.id,
              updates: {
                name: hydrated.name,
                color: hydrated.color,
                frequency: hydrated.frequency,
                customDays: hydrated.customDays,
                isActive: hydrated.isActive,
                isEuEnabled: hydrated.isEuEnabled,
                emails: hydrated.emails,
              },
            });
          }
        }

        if (toAdd.length > 0 || toUpdate.length > 0) {
          useStore.setState((state) => {
            const existing = new Map(state.dripCampaigns.map((c) => [c.id, c]));
            for (const { id, updates } of toUpdate) {
              const c = existing.get(id);
              if (c) existing.set(id, { ...c, ...updates });
            }
            const merged = Array.from(existing.values());
            for (const c of toAdd) {
              if (!existing.has(c.id)) merged.push(c);
            }
            return { dripCampaigns: merged };
          });
          console.log(`[useDripCampaigns] Hydrated: +${toAdd.length} new, ~${toUpdate.length} updated`);
        } else {
          console.log('[useDripCampaigns] Zustand already up to date');
        }
      } finally {
        runningRef.current = false;
      }
    })();
  // Re-run whenever the screen mounts (userId/businessId change)
  }, [isInitialized, businessId, userId]);
}

/**
 * Push a single campaign to Supabase after a local Zustand save.
 * Call this after addDripCampaign / updateDripCampaign.
 */
export async function syncCampaignToSupabase(
  campaign: DripCampaign,
  businessId: string
): Promise<void> {
  console.log('[useDripCampaigns] Syncing campaign to Supabase:', campaign.id);
  const { error } = await upsertDripCampaign(campaign, businessId);
  if (error) {
    console.error('[useDripCampaigns] Sync error:', error);
  }
}

/**
 * Delete a campaign from Supabase after a local Zustand delete.
 */
export async function syncDeleteCampaignFromSupabase(id: string, businessId?: string): Promise<void> {
  console.log('[useDripCampaigns] Deleting campaign from Supabase:', id);
  const { error } = await deleteDripCampaignFromSupabase(id, businessId);
  if (error) {
    console.error('[useDripCampaigns] Delete sync error:', error);
  }
}
