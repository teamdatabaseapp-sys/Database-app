/**
 * useBusinessHours Hook
 *
 * React Query hook for managing business hours.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from './useBusiness';
import {
  getBusinessHours,
  setBusinessHours,
  updateDayHours,
  BusinessHours,
  BusinessHoursInput,
} from '@/services/businessHoursService';

// Query key factory
const businessHoursKeys = {
  all: ['businessHours'] as const,
  business: (businessId: string) => [...businessHoursKeys.all, businessId] as const,
  store: (businessId: string, storeId: string | null) =>
    [...businessHoursKeys.business(businessId), storeId ?? 'default'] as const,
};

/**
 * Get business hours for a business or specific store
 */
export function useBusinessHours(storeId?: string | null) {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: businessHoursKeys.store(businessId || '', storeId ?? null),
    queryFn: async () => {
      if (!businessId) {
        return [];
      }
      const result = await getBusinessHours(businessId, storeId);
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
 * Set all business hours (replaces existing)
 */
export function useSetBusinessHours() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ hours, storeId }: { hours: BusinessHoursInput[]; storeId?: string | null }) => {
      if (!businessId) {
        throw new Error('No business ID');
      }
      const result = await setBusinessHours(businessId, hours, storeId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific store's hours
      queryClient.invalidateQueries({
        queryKey: businessHoursKeys.store(businessId!, variables.storeId ?? null),
      });
      // Also invalidate setup completion so progress indicators update immediately
      queryClient.invalidateQueries({
        queryKey: ['setup_completion', 'business_hours', businessId!],
      });
    },
  });
}

/**
 * Update a single day's hours
 */
export function useUpdateDayHours() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      dayOfWeek,
      updates,
      storeId,
    }: {
      dayOfWeek: number;
      updates: Partial<BusinessHoursInput>;
      storeId?: string | null;
    }) => {
      if (!businessId) {
        throw new Error('No business ID');
      }
      const result = await updateDayHours(businessId, dayOfWeek, updates, storeId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific store's hours
      queryClient.invalidateQueries({
        queryKey: businessHoursKeys.store(businessId!, variables.storeId ?? null),
      });
      // Also invalidate setup completion so progress indicators update immediately
      queryClient.invalidateQueries({
        queryKey: ['setup_completion', 'business_hours', businessId!],
      });
    },
  });
}

// Re-export types
export type { BusinessHours, BusinessHoursInput };
