/**
 * useServices Hook
 *
 * React Query hooks for services operations.
 * All operations are scoped to the current business.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getServices,
  getAppointmentServices,
  syncAppointmentServices,
  createService,
  updateService,
  deleteService,
  type SupabaseService,
} from '@/services/servicesService';
import { useBusiness } from '@/hooks/useBusiness';

// ============================================
// Query Keys
// ============================================

export const serviceKeys = {
  all: ['services'] as const,
  lists: () => [...serviceKeys.all, 'list'] as const,
  list: (businessId: string) => [...serviceKeys.lists(), businessId] as const,
  forAppointment: (appointmentId: string) => [...serviceKeys.all, 'appointment', appointmentId] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to get all active services for the current business
 */
export function useServices() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: serviceKeys.list(businessId || ''),
    queryFn: async () => {
      if (!businessId) {
        console.log('[useServices] No businessId, returning empty array');
        return [];
      }
      console.log('[useServices] Fetching services for business:', businessId);
      const result = await getServices(businessId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 30 * 1000, // 30 seconds - allow more frequent refetches
  });
}

/**
 * Hook to get services for a specific appointment
 */
export function useAppointmentServices(appointmentId: string | null) {
  return useQuery({
    queryKey: serviceKeys.forAppointment(appointmentId || ''),
    queryFn: async () => {
      if (!appointmentId) {
        return [];
      }
      console.log('[useAppointmentServices] Fetching services for appointment:', appointmentId);
      const result = await getAppointmentServices(appointmentId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!appointmentId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to sync appointment services
 */
export function useSyncAppointmentServices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentId, serviceIds }: { appointmentId: string; serviceIds: string[] }) => {
      console.log('[useSyncAppointmentServices] Syncing services for appointment:', appointmentId);
      const result = await syncAppointmentServices(appointmentId, serviceIds);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate appointment services query
      queryClient.invalidateQueries({ queryKey: serviceKeys.forAppointment(variables.appointmentId) });
    },
  });
}

/**
 * Hook to create a new service
 */
export function useCreateService() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ name, color, duration_minutes, price_cents, currency_code, service_type, description }: { name: string; color: string; duration_minutes?: number; price_cents?: number; currency_code?: string; service_type?: 'service' | 'product'; description?: string | null }) => {
      if (!businessId) {
        console.log('[useCreateService] No business ID available');
        throw new Error('No business ID available');
      }
      console.log('[useCreateService] Creating service:', { name, color, duration_minutes, price_cents, currency_code, service_type, description, businessId });
      const result = await createService(businessId, name, color, duration_minutes, price_cents, currency_code, service_type, description);
      if (result.error) {
        console.log('[useCreateService] Error from service:', result.error.message);
        throw result.error;
      }
      console.log('[useCreateService] Service created successfully:', result.data?.id);
      return result.data;
    },
    onSuccess: () => {
      console.log('[useCreateService] Invalidating service queries');
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    },
    onError: (error) => {
      console.log('[useCreateService] Mutation error:', error);
    },
  });
}

/**
 * Hook to update a service
 */
export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      serviceId,
      updates,
    }: {
      serviceId: string;
      updates: { name?: string; description?: string | null; color?: string; duration_minutes?: number; price_cents?: number; currency_code?: string; service_type?: 'service' | 'product'; is_active?: boolean };
    }) => {
      console.log('[useUpdateService] Updating service:', serviceId);
      const result = await updateService(serviceId, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

/**
 * Hook to delete a service (soft delete)
 */
export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceId: string) => {
      console.log('[useDeleteService] Deleting service:', serviceId);
      const result = await deleteService(serviceId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    },
  });
}

// Re-export type for convenience
export type { SupabaseService };
