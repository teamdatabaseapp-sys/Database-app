/**
 * useRealtimeClientSummary
 *
 * Subscribes to Supabase Postgres realtime changes for the four tables that
 * drive the Client Details summary cards. On any change, the hook surgically
 * invalidates only the affected React Query key — no full-screen reload, no
 * query storms, no flicker.
 *
 * Requires migration 20260325000001_god_tier_hardening to have been applied
 * (adds the tables to the supabase_realtime publication). Before the migration
 * the subscription silently no-ops — all existing React Query polling remains
 * active so the app degrades gracefully.
 *
 * Tables watched (filtered per clientId):
 *   client_loyalty       → loyaltyKeys.clientLoyalty
 *   client_memberships   → membershipKeys.client
 *   gift_cards           → ['client_gift_cards', clientId, userId]
 *   promotion_counters   → promotionCounterKeys.forClient
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabaseClient';
import { loyaltyKeys } from '@/hooks/useLoyalty';
import { membershipKeys } from '@/hooks/useMembership';
import { promotionCounterKeys } from '@/hooks/usePromotionCounters';
import { useBusiness } from '@/hooks/useBusiness';

// Mirror the constant from useGiftCards so we don't need to export it
const CLIENT_GIFT_CARDS_KEY = 'client_gift_cards';

export function useRealtimeClientSummary(
  clientId: string | undefined,
  userId: string | undefined,
) {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  useEffect(() => {
    if (!clientId || !businessId) return;

    const channelName = `client-summary:${clientId}`;

    const channel = getSupabase()
      .channel(channelName)

      // ── Loyalty balance ────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'client_loyalty',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: loyaltyKeys.clientLoyalty(businessId, clientId),
          });
        },
      )

      // ── Active membership ──────────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'client_memberships',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: membershipKeys.client(clientId),
          });
        },
      )

      // ── Gift card balance ──────────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'gift_cards',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: [CLIENT_GIFT_CARDS_KEY, clientId, userId],
          });
        },
      )

      // ── Promotion counters ─────────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'promotion_counters',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: promotionCounterKeys.forClient(businessId, clientId),
          });
        },
      )

      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] client-summary subscription error — falling back to polling');
        }
      });

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [clientId, businessId, userId, queryClient]);
}
