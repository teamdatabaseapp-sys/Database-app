/**
 * PromotionSync Component
 *
 * Automatically syncs Zustand promotions to Supabase when:
 * 1. User logs in (business becomes available)
 * 2. App starts with an existing session
 * 3. User creates/updates/deletes a promotion (promotions array changes)
 *
 * This ensures the promotions table in Supabase always has the user's
 * promotions, allowing appointments to reference them via promo_id FK.
 *
 * NOTE: This component should NOT run on public routes like /book/[slug]
 * because those routes use anonymous/public access without authentication.
 */

import { useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'expo-router';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import { useSyncPromotions } from '@/hooks/usePromotions';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

export function PromotionSync() {
  const pathname = usePathname();
  const { businessId, isInitialized } = useBusiness();
  const { session } = useSupabaseAuth();
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const userId = useStore((s) => s.user?.id);
  const syncPromotionsMutation = useSyncPromotions();

  // Track last synced promotion IDs to detect changes
  const lastSyncedIdsRef = useRef<string>('');
  const lastBusinessIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);

  // Check if we're on a public route that doesn't require authentication
  const isPublicRoute = useMemo(() => {
    // Public routes that should NOT trigger promotion sync
    const publicRoutes = ['/book/', '/unsubscribe'];
    return publicRoutes.some((route) => pathname?.startsWith(route));
  }, [pathname]);

  // Filter promotions for current user
  const userPromotions = useMemo(() => {
    if (!userId) return [];
    return allMarketingPromotions.filter((p) => p.userId === userId);
  }, [allMarketingPromotions, userId]);

  // Create a stable identifier for current promotions state
  const promotionsFingerprint = useMemo(() => {
    return userPromotions.map((p) => p.id).sort().join(',');
  }, [userPromotions]);

  useEffect(() => {
    // Skip sync on public routes (booking page, unsubscribe, etc.)
    // These routes use anonymous access and shouldn't write to promotions
    if (isPublicRoute) {
      return;
    }

    // Only sync when:
    // 1. Business is initialized and we have a businessId
    // 2. We have a valid authenticated session
    // 3. We have a user logged in
    // 4. Not already syncing
    if (!isInitialized || !businessId || !session?.user || !userId || isSyncingRef.current) {
      return;
    }

    // Reset on business change (user switched accounts)
    if (lastBusinessIdRef.current !== businessId) {
      lastSyncedIdsRef.current = '';
      lastBusinessIdRef.current = businessId;
    }

    // Skip if promotions haven't changed since last sync
    if (lastSyncedIdsRef.current === promotionsFingerprint) {
      return;
    }

    // Handle empty promotions
    if (userPromotions.length === 0) {
      console.log('[PromotionSync] No promotions to sync for user:', userId);
      lastSyncedIdsRef.current = promotionsFingerprint;
      return;
    }

    console.log('[PromotionSync] Syncing', userPromotions.length, 'promotions to Supabase');
    isSyncingRef.current = true;

    syncPromotionsMutation.mutate(userPromotions, {
      onSuccess: (data) => {
        console.log('[PromotionSync] Successfully synced', data?.length ?? 0, 'promotions');
        lastSyncedIdsRef.current = promotionsFingerprint;
        isSyncingRef.current = false;
      },
      onError: (error) => {
        console.log('[PromotionSync] Sync failed:', error);
        isSyncingRef.current = false;
        // Don't update lastSyncedIdsRef - allow retry on next promotion change
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, businessId, userId, promotionsFingerprint, isPublicRoute, session]);

  // This component doesn't render anything
  return null;
}
