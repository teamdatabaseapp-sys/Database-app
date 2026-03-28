/**
 * Promotion Redemptions Hooks
 *
 * React Query hooks for fetching promotion redemption data.
 * Used by Analytics and Client Details screens.
 */

import { useQuery } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import {
  getPromotionsRedeemedCount,
  getPromotionsRedeemedRows,
  getClientPromotionsUsed,
  getPromotionsBreakdown,
  getPromotionsTimeSeries,
  type PromotionRedemptionRow,
  type ClientPromotionUsed,
  type PromotionBreakdown,
  type PromotionTimeSeries,
} from '@/services/promotionRedemptionsService';

// ============================================
// Query Keys
// ============================================

export const promotionRedemptionKeys = {
  all: ['promotion-redemptions'] as const,
  count: (businessId: string, start: string, end: string, storeId?: string, promoId?: string) =>
    [...promotionRedemptionKeys.all, 'count', businessId, start, end, storeId, promoId] as const,
  clientUsed: (businessId: string, clientId: string) =>
    [...promotionRedemptionKeys.all, 'client', businessId, clientId] as const,
  breakdown: (businessId: string, start: string, end: string, storeId?: string) =>
    [...promotionRedemptionKeys.all, 'breakdown', businessId, start, end, storeId] as const,
  timeSeries: (businessId: string, start: string, end: string, interval: string, storeId?: string) =>
    [...promotionRedemptionKeys.all, 'timeseries', businessId, start, end, interval, storeId] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to get count of promotions redeemed in a date range
 * Used by Analytics "Promotions Redeemed" card
 */
export function usePromotionsRedeemedCount(
  startDate: Date,
  endDate: Date,
  options?: {
    storeId?: string | null;
    promotionId?: string | null;
    enabled?: boolean;
  }
) {
  const { businessId } = useBusiness();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  return useQuery({
    queryKey: promotionRedemptionKeys.count(
      businessId || '',
      startIso,
      endIso,
      options?.storeId || undefined,
      options?.promotionId || undefined
    ),
    queryFn: async () => {
      if (!businessId) return 0;

      const result = await getPromotionsRedeemedCount(
        businessId,
        new Date(startIso),
        new Date(endIso),
        options?.storeId,
        options?.promotionId
      );

      if (result.error) {
        console.log('[usePromotionsRedeemedCount] Error:', result.error.message);
        return 0;
      }

      return result.data ?? 0;
    },
    enabled: (options?.enabled ?? true) && !!businessId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to get list of promotion redemption rows for drilldown display
 * Used by Analytics "Promotions Redeemed" drilldown
 */
export function usePromotionsRedeemedRows(
  startDate: Date,
  endDate: Date,
  options?: {
    storeId?: string | null;
    promotionId?: string | null;
    enabled?: boolean;
  }
) {
  const { businessId } = useBusiness();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  return useQuery({
    queryKey: [
      ...promotionRedemptionKeys.all,
      'rows',
      businessId || '',
      startIso,
      endIso,
      options?.storeId || 'all',
      options?.promotionId || 'all',
    ],
    queryFn: async (): Promise<PromotionRedemptionRow[]> => {
      if (!businessId) return [];

      const result = await getPromotionsRedeemedRows(
        businessId,
        new Date(startIso),
        new Date(endIso),
        options?.storeId,
        options?.promotionId
      );

      if (result.error) {
        console.log('[usePromotionsRedeemedRows] Error:', result.error.message);
        return [];
      }

      return result.data ?? [];
    },
    enabled: (options?.enabled ?? true) && !!businessId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to get list of promotions used by a specific client
 * Used by Client Details "Promotions Used" section
 */
export function useClientPromotionsUsed(clientId: string | null, enabled = true) {
  const { businessId } = useBusiness();

  return useQuery({
    queryKey: promotionRedemptionKeys.clientUsed(businessId || '', clientId || ''),
    queryFn: async (): Promise<ClientPromotionUsed[]> => {
      if (!businessId || !clientId) return [];

      const result = await getClientPromotionsUsed(businessId, clientId);

      if (result.error) {
        console.log('[useClientPromotionsUsed] Error:', result.error.message);
        return [];
      }

      return result.data ?? [];
    },
    enabled: enabled && !!businessId && !!clientId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to get breakdown of redemptions by promotion
 * Used by Analytics drill-down views
 */
export function usePromotionsBreakdown(
  startDate: Date,
  endDate: Date,
  options?: {
    storeId?: string | null;
    enabled?: boolean;
  }
) {
  const { businessId } = useBusiness();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  return useQuery({
    queryKey: promotionRedemptionKeys.breakdown(
      businessId || '',
      startIso,
      endIso,
      options?.storeId || undefined
    ),
    queryFn: async (): Promise<PromotionBreakdown[]> => {
      if (!businessId) return [];

      const result = await getPromotionsBreakdown(
        businessId,
        new Date(startIso),
        new Date(endIso),
        options?.storeId
      );

      if (result.error) {
        console.log('[usePromotionsBreakdown] Error:', result.error.message);
        return [];
      }

      return result.data ?? [];
    },
    enabled: (options?.enabled ?? true) && !!businessId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to get time series of redemption counts
 * Used by Analytics charts
 */
export function usePromotionsTimeSeries(
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month' = 'day',
  options?: {
    storeId?: string | null;
    enabled?: boolean;
  }
) {
  const { businessId } = useBusiness();
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  return useQuery({
    queryKey: promotionRedemptionKeys.timeSeries(
      businessId || '',
      startIso,
      endIso,
      interval,
      options?.storeId || undefined
    ),
    queryFn: async (): Promise<PromotionTimeSeries[]> => {
      if (!businessId) return [];

      const result = await getPromotionsTimeSeries(
        businessId,
        new Date(startIso),
        new Date(endIso),
        interval,
        options?.storeId
      );

      if (result.error) {
        console.log('[usePromotionsTimeSeries] Error:', result.error.message);
        return [];
      }

      return result.data ?? [];
    },
    enabled: (options?.enabled ?? true) && !!businessId,
    staleTime: 30 * 1000, // 30 seconds
  });
}
