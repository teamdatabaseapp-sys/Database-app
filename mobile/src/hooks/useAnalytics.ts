/**
 * useAnalytics Hook
 *
 * SINGLE SOURCE OF TRUTH for Analytics data.
 * Uses ONLY the get_monthly_analytics_overview RPC.
 * NO direct table queries. NO fallbacks. NO legacy adapters.
 *
 * RPC Response:
 * {
 *   success: boolean,
 *   total_appointments: number,
 *   total_services: number,
 *   revenue_cents: number,
 *   top_clients: Array<{ client_id, display_name, appointment_count, total_spend_cents }>
 * }
 */

import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useMemo, useEffect, useRef } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import {
  getMonthlyAnalyticsOverview,
  type AnalyticsOverviewData,
  type AnalyticsErrorType,
} from '@/services/analyticsService';
import { useBusiness } from '@/hooks/useBusiness';

// ============================================
// Query Keys
// ============================================

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (businessId: string, startDate: string, endDate: string, storeId?: string | null) =>
    [...analyticsKeys.all, 'overview', businessId, startDate, endDate, storeId || 'all'] as const,
};

// ============================================
// Hook
// ============================================

interface UseAnalyticsOverviewOptions {
  startDate: Date;
  endDate: Date;
  storeId?: string | null;
}

interface UseAnalyticsOverviewResult {
  data: AnalyticsOverviewData | null;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  errorType: AnalyticsErrorType | null;
  refetch: () => void;
}

/**
 * Hook to fetch ALL analytics data via RPC.
 *
 * Prerequisites:
 * - Business must be initialized (businessId available)
 * - User must be authenticated (Supabase session active)
 * - The get_monthly_analytics_overview RPC must exist in Supabase
 *   (run getSupabase()-analytics-appointments-rpc.sql if missing)
 *
 * Error Types:
 * - AUTH_REQUIRED: User not signed in
 * - PERMISSION_DENIED: User doesn't have access to business (42501)
 * - RPC_NOT_FOUND: RPC function doesn't exist in database
 * - BUSINESS_NOT_FOUND: Business doesn't exist
 * - INVALID_INPUT: Invalid businessId or params
 * - UNKNOWN: Other errors
 *
 * Returns:
 * - data: Complete analytics overview or null
 * - isLoading: True while fetching
 * - isError: True if RPC failed
 * - error: Error message if failed
 * - errorType: Type of error for proper UI handling
 */
export function useAnalyticsOverview(options: UseAnalyticsOverviewOptions): UseAnalyticsOverviewResult {
  const { businessId, isInitialized } = useBusiness();

  // Memoize date strings to prevent unnecessary re-fetches
  const dateRange = useMemo(
    () => ({
      startDateISO: options.startDate.toISOString(),
      endDateISO: options.endDate.toISOString(),
    }),
    [options.startDate, options.endDate]
  );

  const query = useQuery({
    queryKey: analyticsKeys.overview(
      businessId || '',
      dateRange.startDateISO,
      dateRange.endDateISO,
      options.storeId
    ),
    queryFn: async () => {
      // GUARD: Do not call RPC if businessId is not loaded
      if (!businessId) {
        console.log('[useAnalyticsOverview] businessId not loaded yet, skipping RPC call');
        return { data: null, errorType: null };
      }

      console.log('[useAnalyticsOverview] Calling RPC with:', {
        businessId,
        startDate: dateRange.startDateISO,
        endDate: dateRange.endDateISO,
        storeId: options.storeId,
      });

      const result = await getMonthlyAnalyticsOverview(
        businessId,
        new Date(dateRange.startDateISO),
        new Date(dateRange.endDateISO),
        options.storeId
      );

      // Throw error to trigger React Query error state
      // Include errorType in the error for proper handling
      if (result.error) {
        const error = new Error(result.error) as Error & { errorType?: AnalyticsErrorType };
        error.errorType = result.errorType;
        throw error;
      }

      return { data: result.data, errorType: null };
    },
    // Only run query when business is initialized AND businessId is available
    enabled: isInitialized && !!businessId,
    // Analytics is expensive — don't refetch just because the app comes to foreground
    refetchOnWindowFocus: false,
    // Cache data for 5 minutes — makes Analytics feel instant on revisit
    staleTime: 5 * 60 * 1000,
    // Keep cached data for 10 minutes after last use
    gcTime: 10 * 60 * 1000,
    // Retry on failure EXCEPT for permission/auth errors
    retry: (failureCount, error) => {
      const errorType = (error as Error & { errorType?: AnalyticsErrorType }).errorType;
      // Don't retry auth or permission errors - they won't magically fix themselves
      if (errorType === 'AUTH_REQUIRED' || errorType === 'PERMISSION_DENIED' || errorType === 'BUSINESS_NOT_FOUND') {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Extract errorType from the error if available
  const errorType = (query.error as Error & { errorType?: AnalyticsErrorType })?.errorType ?? null;

  return {
    data: query.data?.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message ?? null,
    errorType,
    refetch: query.refetch,
  };
}

// ============================================
// Per-Store Breakdown Hook
// ============================================

export interface StoreAnalyticsBreakdown {
  store_id: string;
  store_name: string;
  appointments: number;
  revenue_cents: number;
  // Previous period (for growth %)
  prev_appointments: number;
  prev_revenue_cents: number;
}

interface UseStoreBreakdownOptions {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
  // Array of { id, name } for all stores in the business
  stores: Array<{ id: string; name: string }>;
  // Only run when filter is "ALL" (null). Hide when scoped to a single store.
  enabled: boolean;
}

interface UseStoreBreakdownResult {
  breakdown: StoreAnalyticsBreakdown[];
  topStore: StoreAnalyticsBreakdown | null;
  isLoading: boolean;
}

/**
 * Fetches analytics for each store in BOTH current and previous periods in parallel.
 * Used for Compare Mode and "Top Store This Month" display.
 * Makes two RPC calls per store (current + previous) — all cached individually.
 */
export function useStoreBreakdownAnalytics(options: UseStoreBreakdownOptions): UseStoreBreakdownResult {
  const { businessId, isInitialized } = useBusiness();

  const startISO = useMemo(() => options.startDate.toISOString(), [options.startDate]);
  const endISO = useMemo(() => options.endDate.toISOString(), [options.endDate]);
  const prevStartISO = useMemo(() => options.previousStartDate.toISOString(), [options.previousStartDate]);
  const prevEndISO = useMemo(() => options.previousEndDate.toISOString(), [options.previousEndDate]);

  const isEnabled = options.enabled && isInitialized && !!businessId && options.stores.length > 1;

  // Build queries: current period + previous period for each store
  // Layout: [store0_curr, store0_prev, store1_curr, store1_prev, ...]
  const { breakdown, topStore, isLoading } = useQueries({
    queries: options.stores.flatMap((store) => [
      // Current period
      {
        queryKey: analyticsKeys.overview(businessId || '', startISO, endISO, store.id),
        queryFn: async () => {
          if (!businessId) return { data: null };
          const result = await getMonthlyAnalyticsOverview(
            businessId,
            new Date(startISO),
            new Date(endISO),
            store.id
          );
          return { data: result.data };
        },
        enabled: isEnabled,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      // Previous period
      {
        queryKey: analyticsKeys.overview(businessId || '', prevStartISO, prevEndISO, store.id),
        queryFn: async () => {
          if (!businessId) return { data: null };
          const result = await getMonthlyAnalyticsOverview(
            businessId,
            new Date(prevStartISO),
            new Date(prevEndISO),
            store.id
          );
          return { data: result.data };
        },
        enabled: isEnabled,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    ]),
    combine: (results) => {
      const breakdown: StoreAnalyticsBreakdown[] = options.stores.map((store, idx) => {
        const currData = results[idx * 2]?.data?.data;
        const prevData = results[idx * 2 + 1]?.data?.data;
        return {
          store_id: store.id,
          store_name: store.name,
          appointments: currData?.total_appointments ?? 0,
          revenue_cents: currData?.revenue_cents ?? 0,
          prev_appointments: prevData?.total_appointments ?? 0,
          prev_revenue_cents: prevData?.revenue_cents ?? 0,
        };
      });

      const withData = breakdown.filter((s) => s.appointments > 0 || s.revenue_cents > 0);
      const topStore: StoreAnalyticsBreakdown | null = withData.length === 0
        ? null
        : withData.reduce((best, curr) => {
            if (curr.revenue_cents > best.revenue_cents) return curr;
            if (curr.revenue_cents === best.revenue_cents && curr.appointments > best.appointments) return curr;
            return best;
          });

      return {
        breakdown,
        topStore,
        isLoading: results.some((r) => r.isLoading),
      };
    },
  });

  return { breakdown, topStore, isLoading };
}

// ============================================
// Prefetch Hook (warm cache before user taps Analytics tab)
// ============================================

/**
 * Call this in DashboardScreen to silently prefetch the current-month analytics.
 * Data will be ready in cache when the user opens Analytics, eliminating the blank delay.
 */
export function usePrefetchAnalytics() {
  const queryClient = useQueryClient();
  const { businessId, isInitialized } = useBusiness();
  // Ref-guard: only fire once per businessId to prevent duplicate prefetches
  // across re-renders before the query settles into cache.
  const prefetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isInitialized || !businessId) return;
    // Skip if we already prefetched for this businessId this session
    if (prefetchedForRef.current === businessId) return;

    // Use startOfMonth / endOfMonth (same as MonthlyStatsScreen) so the
    // prefetch queryKey matches exactly — preventing a duplicate RPC call
    // when the user opens the Analytics tab.
    const now = new Date();
    const startDate = startOfMonth(now);
    const endDate = endOfMonth(now);
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const queryKey = analyticsKeys.overview(businessId, startISO, endISO, null);

    // Only prefetch if not already cached
    const existing = queryClient.getQueryData(queryKey);
    if (existing) {
      prefetchedForRef.current = businessId;
      return;
    }

    prefetchedForRef.current = businessId;
    queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const result = await getMonthlyAnalyticsOverview(businessId, startDate, endDate, null);
        return { data: result.data, errorType: null };
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [isInitialized, businessId, queryClient]);
}
