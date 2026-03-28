/**
 * useStores Hook
 *
 * React Query hooks for stores operations.
 * All operations are scoped to the current business.
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStores,
  getStore,
  createStore,
  updateStore,
  archiveStore,
  restoreStore,
  deleteStore,
  ensureDefaultStore,
  reorderStores,
  getStoreOverrides,
  upsertStoreOverride,
  deleteStoreOverride,
  type SupabaseStore,
  type CreateStoreInput,
  type UpdateStoreInput,
  type StoreHoursOverride,
  type CreateStoreHoursOverrideInput,
} from '@/services/storesService';
import { useBusiness } from '@/hooks/useBusiness';
import { useStore as useZustandStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';

// ============================================
// Query Keys
// ============================================

export const storeKeys = {
  all: ['stores'] as const,
  lists: () => [...storeKeys.all, 'list'] as const,
  list: (businessId: string) => [...storeKeys.lists(), businessId] as const,
  details: () => [...storeKeys.all, 'detail'] as const,
  detail: (id: string) => [...storeKeys.details(), id] as const,
  overrides: () => [...storeKeys.all, 'overrides'] as const,
  storeOverrides: (storeId: string) => [...storeKeys.overrides(), storeId] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to get all stores for the current business.
 * IMPORTANT: Auto-creates a default store if none exist.
 * Returns the query result plus an isAutoCreating flag.
 *
 * DEBUG: Enhanced logging to diagnose store fetching issues.
 */
export function useStores() {
  const { businessId, business, isInitialized, ownerId } = useBusiness();
  const queryClient = useQueryClient();
  const isCreatingDefaultStore = useRef(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const language = useZustandStore((s) => s.language) as Language;

  // DEBUG: Log business context on mount and changes
  useEffect(() => {
    console.log('[useStores] DEBUG Business context:');
    console.log('  - isInitialized:', isInitialized);
    console.log('  - businessId:', businessId);
    console.log('  - ownerId (auth.uid):', ownerId);
    console.log('  - business name:', business?.name ?? 'N/A');
  }, [isInitialized, businessId, ownerId, business]);

  const query = useQuery({
    queryKey: [...storeKeys.list(businessId || ''), isInitialized],
    queryFn: async () => {
      console.log('[useStores] queryFn called');
      console.log('  - businessId:', businessId);
      console.log('  - query enabled:', isInitialized && !!businessId);

      if (!businessId) {
        console.log('[useStores] No businessId, returning empty array');
        return [];
      }

      console.log('[useStores] Fetching stores for business:', businessId);
      const result = await getStores(businessId);

      if (result.error) {
        const errorMessage = result.error.message || '';
        console.log('[useStores] ERROR from getStores:', errorMessage);

        // Check if it's a "table doesn't exist" error
        if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
          console.log('[useStores] Stores table not found - returning empty array');
          return [];
        }

        throw result.error;
      }

      console.log('[useStores] SUCCESS: Fetched', result.data?.length ?? 0, 'stores');
      // Hard cap: never surface more than 3 stores in the app
      const allFetched = result.data || [];
      if (allFetched.length > 3) {
        console.log('[useStores] Capping to 3 stores (fetched:', allFetched.length, ')');
      }
      return allFetched.slice(0, 3);
    },
    enabled: isInitialized && !!businessId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const errorMessage = (error as Error)?.message || '';
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Track if table exists (to prevent repeated auto-creation attempts)
  const tableExistsRef = useRef<boolean | null>(null);

  // Auto-create default store if none exist (but only if table exists)
  useEffect(() => {
    // Skip if we know the table doesn't exist
    if (tableExistsRef.current === false) {
      return;
    }

    const shouldCreateDefault =
      isInitialized &&
      businessId &&
      business &&
      query.data !== undefined &&
      query.data.length === 0 &&
      !query.isLoading &&
      !query.isFetching &&
      !query.isError && // Don't try if there was an error (likely table doesn't exist)
      !isCreatingDefaultStore.current;

    if (shouldCreateDefault) {
      isCreatingDefaultStore.current = true;
      setIsAutoCreating(true);
      console.log('[useStores] No stores found, auto-creating default store for business:', businessId);

      const translatedDefaultStoreName = t('mainStore', language);
      ensureDefaultStore(businessId, business.name, translatedDefaultStoreName)
        .then((result) => {
          if (result.data) {
            console.log('[useStores] Default store created:', result.data.id, result.data.name);
            tableExistsRef.current = true;
            // Invalidate to refetch with the new store
            queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
          } else if (result.error) {
            const errorMessage = result.error.message || '';
            if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
              console.log('[useStores] Stores table does not exist - skipping auto-creation');
              tableExistsRef.current = false;
            } else {
              console.log('[useStores] Error creating default store:', result.error.message);
            }
          }
        })
        .catch((err) => {
          console.log('[useStores] Error in ensureDefaultStore:', err);
        })
        .finally(() => {
          isCreatingDefaultStore.current = false;
          setIsAutoCreating(false);
        });
    }
  }, [isInitialized, businessId, business, query.data, query.isLoading, query.isFetching, query.isError, queryClient]);

  // Return the query with additional isAutoCreating flag
  return {
    ...query,
    isAutoCreating,
  };
}

/**
 * Hook to get a single store
 */
export function useStore(storeId: string | null) {
  return useQuery({
    queryKey: storeKeys.detail(storeId || ''),
    queryFn: async () => {
      if (!storeId) return null;
      console.log('[useStore] Fetching store:', storeId);
      const result = await getStore(storeId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a store
 */
export function useCreateStore() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (input: Omit<CreateStoreInput, 'business_id'>) => {
      if (!businessId) {
        throw new Error('No business ID available');
      }
      console.log('[useCreateStore] Creating store:', input.name);
      const result = await createStore({
        ...input,
        business_id: businessId,
      });
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
      }
    },
  });
}

/**
 * Hook to update a store
 */
export function useUpdateStore() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ storeId, updates }: { storeId: string; updates: UpdateStoreInput }) => {
      console.log('[useUpdateStore] Updating store:', storeId);
      const result = await updateStore(storeId, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
      }
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: storeKeys.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to archive a store
 */
export function useArchiveStore() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (storeId: string) => {
      console.log('[useArchiveStore] Archiving store:', storeId);
      const result = await archiveStore(storeId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
      }
    },
  });
}

/**
 * Hook to restore an archived store
 */
export function useRestoreStore() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (storeId: string) => {
      console.log('[useRestoreStore] Restoring store:', storeId);
      const result = await restoreStore(storeId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
      }
    },
  });
}

/**
 * Hook to delete a store permanently
 */
export function useDeleteStore() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (storeId: string) => {
      console.log('[useDeleteStore] Deleting store:', storeId);
      const result = await deleteStore(storeId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
      }
    },
  });
}

/**
 * Hook to reorder stores (update sort_order for multiple stores)
 */
export function useReorderStores() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (storeOrders: Array<{ id: string; sort_order: number }>) => {
      console.log('[useReorderStores] Reordering stores:', storeOrders.length);
      const result = await reorderStores(storeOrders);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        // Invalidate stores list to refetch with new order
        queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
      }
    },
  });
}

/**
 * Hook to ensure a default store exists for the business.
 * This should be called on app initialization to ensure single-store
 * businesses have a store to work with.
 */
export function useEnsureDefaultStore() {
  const queryClient = useQueryClient();
  const { businessId, business } = useBusiness();
  const language = useZustandStore((s) => s.language) as Language;

  return useMutation({
    mutationFn: async () => {
      if (!businessId || !business) {
        throw new Error('No business available');
      }
      console.log('[useEnsureDefaultStore] Ensuring default store for business:', businessId);
      const translatedDefaultStoreName = t('mainStore', language);
      const result = await ensureDefaultStore(businessId, business.name, translatedDefaultStoreName);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: storeKeys.list(businessId) });
      }
    },
  });
}

// ============================================
// Store Hours Overrides (Special Hours) Hooks
// ============================================

/**
 * Hook to get all hours overrides for a store
 */
export function useStoreOverrides(storeId: string | null) {
  return useQuery({
    queryKey: storeKeys.storeOverrides(storeId || ''),
    queryFn: async () => {
      if (!storeId) return [];
      console.log('[useStoreOverrides] Fetching overrides for store:', storeId);
      const result = await getStoreOverrides(storeId);
      if (result.error) {
        // Check if table doesn't exist - return empty array
        const errorMessage = result.error.message || '';
        if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
          console.log('[useStoreOverrides] Table not found, returning empty array');
          return [];
        }
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!storeId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error) => {
      const errorMessage = (error as Error)?.message || '';
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to create or update a store hours override
 */
export function useUpsertStoreOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateStoreHoursOverrideInput & { id?: string }) => {
      console.log('[useUpsertStoreOverride] Upserting override:', input);
      const result = await upsertStoreOverride(input);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.store_id) {
        queryClient.invalidateQueries({ queryKey: storeKeys.storeOverrides(data.store_id) });
      }
    },
  });
}

/**
 * Hook to delete a store hours override
 */
export function useDeleteStoreOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ overrideId, storeId }: { overrideId: string; storeId: string }) => {
      console.log('[useDeleteStoreOverride] Deleting override:', overrideId);
      const result = await deleteStoreOverride(overrideId);
      if (result.error) {
        throw result.error;
      }
      return { storeId };
    },
    onSuccess: (data) => {
      if (data?.storeId) {
        queryClient.invalidateQueries({ queryKey: storeKeys.storeOverrides(data.storeId) });
      }
    },
  });
}

// Export types for external use
export type { StoreHoursOverride, CreateStoreHoursOverrideInput };
