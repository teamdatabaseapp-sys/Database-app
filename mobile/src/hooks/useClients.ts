/**
 * useClients Hook
 *
 * Provides React Query hooks for client operations.
 * All operations are automatically scoped to the current business.
 *
 * IMPORTANT: These hooks require a valid business context.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  incrementVisitCount,
  type SupabaseClient,
  type CreateClientData,
  type UpdateClientData,
} from '@/services/clientsService';

// ============================================
// Query Keys
// ============================================

export const CLIENTS_QUERY_KEY = ['clients'] as const;

export const clientKeys = {
  all: CLIENTS_QUERY_KEY,
  lists: () => [...CLIENTS_QUERY_KEY, 'list'] as const,
  list: (businessId: string) => [...CLIENTS_QUERY_KEY, 'list', businessId] as const,
  details: () => [...CLIENTS_QUERY_KEY, 'detail'] as const,
  detail: (id: string) => [...CLIENTS_QUERY_KEY, 'detail', id] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to fetch all clients for the current business.
 */
export function useClients() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: clientKeys.list(businessId || ''),
    queryFn: async () => {
      if (!businessId) return [];
      const result = await getClients(businessId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 5 * 60 * 1000, // Serve from cache for 5 min — instant navigation back to list
    gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
  });
}

/**
 * Hook to fetch a single client by ID.
 */
export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: clientKeys.detail(clientId || ''),
    queryFn: async () => {
      if (!clientId) return null;
      const result = await getClient(clientId);
      if (result.error) return null;
      return result.data ?? null;
    },
    enabled: !!clientId,
    staleTime: 60_000,  // 1 min — prefetch fills cache, screen renders immediately
    gcTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,  // keep previous data while revalidating
  });
}

/**
 * Hook to create a new client.
 */
export function useCreateClient() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (data: Omit<CreateClientData, 'business_id'>) => {
      if (!businessId) throw new Error('No business context - cannot create client');
      const result = await createClient({ ...data, business_id: businessId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (newClient) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: clientKeys.list(businessId) });
      }
      if (newClient && businessId) {
        queryClient.setQueryData<SupabaseClient[]>(
          clientKeys.list(businessId),
          (old) => (old ? [newClient, ...old] : [newClient])
        );
      }
    },
    onError: (error) => {
      if (__DEV__) console.log('[useCreateClient] Error:', error);
    },
    throwOnError: false,
  });
}

/**
 * Hook to update an existing client.
 * Uses optimistic updates: applies changes immediately to cache, rolls back on error.
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ clientId, updates }: { clientId: string; updates: UpdateClientData }) => {
      const result = await updateClient(clientId, updates);
      if (result.error) throw result.error;
      return result.data;
    },
    onMutate: async ({ clientId, updates }) => {
      // Cancel any in-flight queries to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: clientKeys.detail(clientId) });
      if (businessId) {
        await queryClient.cancelQueries({ queryKey: clientKeys.list(businessId) });
      }

      // Snapshot previous values for rollback
      const previousDetail = queryClient.getQueryData<SupabaseClient>(clientKeys.detail(clientId));
      const previousList = businessId
        ? queryClient.getQueryData<SupabaseClient[]>(clientKeys.list(businessId))
        : undefined;

      // Optimistically update detail cache
      if (previousDetail) {
        queryClient.setQueryData<SupabaseClient>(clientKeys.detail(clientId), {
          ...previousDetail,
          ...(updates as Partial<SupabaseClient>),
        });
      }

      // Optimistically update list cache
      if (previousList && businessId) {
        queryClient.setQueryData<SupabaseClient[]>(
          clientKeys.list(businessId),
          previousList.map((c) =>
            c.id === clientId ? { ...c, ...(updates as Partial<SupabaseClient>) } : c
          )
        );
      }

      return { previousDetail, previousList };
    },
    onError: (_error, { clientId }, context) => {
      // Roll back to snapshot on failure
      if (context?.previousDetail) {
        queryClient.setQueryData(clientKeys.detail(clientId), context.previousDetail);
      }
      if (context?.previousList && businessId) {
        queryClient.setQueryData(clientKeys.list(businessId), context.previousList);
      }
    },
    onSuccess: (updatedClient, variables) => {
      // Replace optimistic value with real server response
      if (updatedClient) {
        queryClient.setQueryData(clientKeys.detail(variables.clientId), updatedClient);
        if (businessId) {
          queryClient.setQueryData<SupabaseClient[]>(
            clientKeys.list(businessId),
            (old) => old?.map((c) => c.id === variables.clientId ? updatedClient : c) ?? old
          );
        }
      }
    },
    throwOnError: false,
  });
}

/**
 * Hook to delete a client.
 *
 * IMPORTANT: When a client is deleted, their appointments are CASCADE deleted
 * by the database (appointments.client_id REFERENCES clients.id ON DELETE CASCADE).
 * Therefore we must invalidate ALL appointment caches to reflect this.
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const result = await deleteClient(clientId);
      if (result.error) throw result.error;
      return clientId;
    },
    onSuccess: (deletedClientId) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: clientKeys.list(businessId) });
        queryClient.setQueryData<SupabaseClient[]>(
          clientKeys.list(businessId),
          (old) => old?.filter((c) => c.id !== deletedClientId) || []
        );
      }
      queryClient.removeQueries({ queryKey: clientKeys.detail(deletedClientId) });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error) => {
      if (__DEV__) console.log('[useDeleteClient] Error:', error);
    },
  });
}

/**
 * Hook to increment a client's visit count.
 */
export function useIncrementVisitCount() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const result = await incrementVisitCount(clientId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (updatedClient, clientId) => {
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: clientKeys.list(businessId) });
      }
      if (updatedClient) {
        queryClient.setQueryData(clientKeys.detail(clientId), updatedClient);
      }
    },
    onError: (error) => {
      console.log('[useIncrementVisitCount] Error:', error);
    },
  });
}
