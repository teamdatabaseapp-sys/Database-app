/**
 * useStaffServices Hook
 *
 * React Query hooks for staff_services operations (staff skills).
 * Links staff members to the services they can perform.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabaseClient';
import { useBusiness } from '@/hooks/useBusiness';
import { staffKeys } from '@/hooks/useStaff';

// ============================================
// Types
// ============================================

export interface StaffServiceSkill {
  id: string;
  business_id: string;
  staff_id: string;
  service_id: string;
  created_at: string;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Query Keys
// ============================================

export const staffServicesKeys = {
  all: ['staff_services'] as const,
  forStaff: (staffId: string) => [...staffServicesKeys.all, 'staff', staffId] as const,
  forService: (serviceId: string) => [...staffServicesKeys.all, 'service', serviceId] as const,
};

// ============================================
// Service Functions
// ============================================

/**
 * Get all service skills for a staff member
 */
async function getStaffServiceSkills(staffId: string): Promise<ServiceResult<StaffServiceSkill[]>> {
  try {
    console.log('[StaffServicesService] getStaffServiceSkills called for staff:', staffId);

    if (!staffId) {
      return { data: [], error: null };
    }

    const { data, error } = await getSupabase()
      .from('staff_services')
      .select('*')
      .eq('staff_id', staffId);

    if (error) {
      // Handle table not existing gracefully
      const errorMessage = error.message || '';
      if (errorMessage.includes('does not exist') || errorMessage.includes('Could not find')) {
        console.log('[StaffServicesService] staff_services table not found - returning empty array');
        return { data: [], error: null };
      }
      console.log('[StaffServicesService] Error fetching staff services:', error.message);
      return { data: null, error };
    }

    console.log('[StaffServicesService] Staff services fetched:', data?.length ?? 0);
    return { data: data as StaffServiceSkill[], error: null };
  } catch (err) {
    console.log('[StaffServicesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch staff services'),
    };
  }
}

/**
 * Get all staff members who can perform a specific service
 */
async function getStaffForService(serviceId: string): Promise<ServiceResult<StaffServiceSkill[]>> {
  try {
    console.log('[StaffServicesService] getStaffForService called for service:', serviceId);

    if (!serviceId) {
      return { data: [], error: null };
    }

    const { data, error } = await getSupabase()
      .from('staff_services')
      .select('*')
      .eq('service_id', serviceId);

    if (error) {
      const errorMessage = error.message || '';
      if (errorMessage.includes('does not exist') || errorMessage.includes('Could not find')) {
        console.log('[StaffServicesService] staff_services table not found - returning empty array');
        return { data: [], error: null };
      }
      console.log('[StaffServicesService] Error fetching staff for service:', error.message);
      return { data: null, error };
    }

    console.log('[StaffServicesService] Staff for service fetched:', data?.length ?? 0);
    return { data: data as StaffServiceSkill[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch staff for service'),
    };
  }
}

/**
 * Update staff service skills (delete existing, insert new)
 */
async function updateStaffServiceSkills(
  businessId: string,
  staffId: string,
  serviceIds: string[]
): Promise<ServiceResult<null>> {
  try {
    console.log('[StaffServicesService] updateStaffServiceSkills called:', { staffId, serviceIds });

    // Delete existing skills for this staff member
    const { error: deleteError } = await getSupabase()
      .from('staff_services')
      .delete()
      .eq('staff_id', staffId);

    if (deleteError) {
      const errorMessage = deleteError.message || '';
      if (errorMessage.includes('does not exist') || errorMessage.includes('Could not find')) {
        console.log('[StaffServicesService] staff_services table not found - skipping update');
        return { data: null, error: null };
      }
      console.log('[StaffServicesService] Error deleting old skills:', deleteError.message);
      return { data: null, error: deleteError };
    }

    // Insert new skills
    if (serviceIds.length > 0) {
      const insertData = serviceIds.map((serviceId) => ({
        business_id: businessId,
        staff_id: staffId,
        service_id: serviceId,
      }));

      const { error: insertError } = await getSupabase()
        .from('staff_services')
        .insert(insertData);

      if (insertError) {
        console.log('[StaffServicesService] Error inserting new skills:', insertError.message);
        return { data: null, error: insertError };
      }
    }

    console.log('[StaffServicesService] Staff skills updated successfully');
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update staff skills'),
    };
  }
}

// ============================================
// Hooks
// ============================================

/**
 * Hook to get service skills for a staff member
 */
export function useStaffServiceSkills(staffId: string | null) {
  return useQuery({
    queryKey: staffServicesKeys.forStaff(staffId || ''),
    queryFn: async () => {
      if (!staffId) return [];
      const result = await getStaffServiceSkills(staffId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!staffId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const errorMessage = (error as Error)?.message || '';
      if (errorMessage.includes('does not exist') || errorMessage.includes('Could not find')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to get staff members who can perform a specific service
 */
export function useStaffForService(serviceId: string | null) {
  return useQuery({
    queryKey: staffServicesKeys.forService(serviceId || ''),
    queryFn: async () => {
      if (!serviceId) return [];
      const result = await getStaffForService(serviceId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const errorMessage = (error as Error)?.message || '';
      if (errorMessage.includes('does not exist') || errorMessage.includes('Could not find')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook to update staff service skills
 */
export function useUpdateStaffServiceSkills() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({ staffId, serviceIds }: { staffId: string; serviceIds: string[] }) => {
      if (!businessId) {
        throw new Error('No business ID available');
      }
      console.log('[useUpdateStaffServiceSkills] Updating skills for staff:', staffId);
      const result = await updateStaffServiceSkills(businessId, staffId, serviceIds);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the staff's skills query
      queryClient.invalidateQueries({ queryKey: staffServicesKeys.forStaff(variables.staffId) });
      // Invalidate service queries for all affected services
      variables.serviceIds.forEach((serviceId) => {
        queryClient.invalidateQueries({ queryKey: staffServicesKeys.forService(serviceId) });
      });
      // Also invalidate staff list to refresh any derived data
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: staffKeys.list(businessId) });
      }
    },
  });
}
