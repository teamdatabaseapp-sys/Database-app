/**
 * useBusiness Hook
 *
 * Resolves and provides the current user's business context.
 * This hook should be used by all components that need to access
 * business-scoped data (clients, appointments, etc.)
 *
 * IMPORTANT: Never perform client operations without a valid business_id.
 */

import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBusiness, type Business } from '@/services/authService';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

// ============================================
// Types
// ============================================

interface UseBusinessReturn {
  business: Business | null;
  businessId: string | null;
  ownerId: string | null; // The auth user ID (owner_id in businesses table)
  isLoading: boolean;
  isInitialized: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================
// Query Key
// ============================================

export const BUSINESS_QUERY_KEY = ['business'] as const;

// ============================================
// Hook
// ============================================

/**
 * Hook to get the current user's business.
 * Automatically fetches business on mount if user is authenticated.
 *
 * @returns Business data, loading state, and error
 */
export function useBusiness(): UseBusinessReturn {
  const { session, isInitialized: authInitialized, business: authBusiness } = useSupabaseAuth();
  const queryClient = useQueryClient();

  // CRITICAL: Use business from auth hook directly if available (prevents race condition)
  // This ensures we have the business_id immediately after sign-in without waiting for React Query
  const {
    data: businessResult,
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: BUSINESS_QUERY_KEY,
    queryFn: async () => {
      console.log('[useBusiness] Fetching business from Supabase...');
      const result = await getBusiness();

      if (result.error) {
        console.log('[useBusiness] Error fetching business:', result.error.message);
        throw result.error;
      }

      console.log('[useBusiness] Business fetched from Supabase:', result.data?.business?.id);
      return result.data?.business ?? null;
    },
    enabled: authInitialized && !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
    retry: 2,
    // Use authBusiness as initial data to prevent null businessId during first render
    initialData: authBusiness ?? undefined,
  });

  // Resolve business: prefer React Query result, fallback to auth hook business
  const resolvedBusiness = businessResult ?? authBusiness ?? null;

  const refetch = useCallback(async () => {
    console.log('[useBusiness] Manual refetch triggered');
    await queryRefetch();
  }, [queryRefetch]);

  // Clear business data when user logs out
  useEffect(() => {
    if (authInitialized && !session?.user) {
      console.log('[useBusiness] User logged out, clearing business cache');
      queryClient.setQueryData(BUSINESS_QUERY_KEY, null);
    }
  }, [authInitialized, session, queryClient]);

  // Sync authBusiness to React Query cache when auth hook provides business
  // This ensures React Query has the business immediately after sign-in
  useEffect(() => {
    if (authBusiness && !businessResult) {
      console.log('[useBusiness] Syncing authBusiness to React Query cache:', authBusiness.id);
      queryClient.setQueryData(BUSINESS_QUERY_KEY, authBusiness);
    }
  }, [authBusiness, businessResult, queryClient]);

  return {
    business: resolvedBusiness,
    businessId: resolvedBusiness?.id ?? null,
    ownerId: resolvedBusiness?.owner_id ?? null,
    isLoading: !authInitialized || (isLoading && !resolvedBusiness), // Not loading if we have fallback data
    isInitialized: authInitialized && (!isLoading || !!resolvedBusiness),
    error: error instanceof Error ? error : null,
    refetch,
  };
}

/**
 * Hook to get just the business ID (convenience hook).
 * Returns null if no business exists or user is not authenticated.
 */
export function useBusinessId(): string | null {
  const { businessId } = useBusiness();
  return businessId;
}
