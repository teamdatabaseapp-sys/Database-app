import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffTimeOff,
  getBusinessTimeOff,
  createTimeOff,
  deleteTimeOff,
  type StaffTimeOff,
  type CreateTimeOffInput,
} from '@/services/staffTimeOffService';

// ============================================
// Query Keys
// ============================================

export const timeOffKeys = {
  all: ['staff-time-off'] as const,
  staff: (businessId: string, staffId: string) =>
    [...timeOffKeys.all, 'staff', businessId, staffId] as const,
  business: (businessId: string, fromDate?: string, toDate?: string) =>
    [...timeOffKeys.all, 'business', businessId, fromDate, toDate] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Fetch all time off entries for a specific staff member.
 */
export function useStaffTimeOff(
  businessId: string | undefined,
  staffId: string | undefined,
  fromDate?: string,
  toDate?: string,
) {
  return useQuery<StaffTimeOff[]>({
    queryKey: [...timeOffKeys.staff(businessId ?? '', staffId ?? ''), fromDate, toDate],
    queryFn: () => getStaffTimeOff(businessId!, staffId!, fromDate, toDate),
    enabled: !!businessId && !!staffId,
    staleTime: 30_000,
  });
}

/**
 * Fetch all time off entries for the entire business (used in calendar view).
 */
export function useBusinessTimeOff(
  businessId: string | undefined,
  fromDate?: string,
  toDate?: string,
) {
  return useQuery<StaffTimeOff[]>({
    queryKey: timeOffKeys.business(businessId ?? '', fromDate, toDate),
    queryFn: () => getBusinessTimeOff(businessId!, fromDate, toDate),
    enabled: !!businessId,
    staleTime: 30_000,
  });
}

/**
 * Create a new time off entry.
 */
export function useCreateTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: CreateTimeOffInput }) =>
      createTimeOff(businessId, input),
    onSuccess: (_data, { businessId, input }) => {
      // Invalidate both staff-specific and business-wide queries
      queryClient.invalidateQueries({ queryKey: timeOffKeys.staff(businessId, input.staff_id) });
      queryClient.invalidateQueries({ queryKey: timeOffKeys.all });
    },
  });
}

/**
 * Delete a time off entry.
 */
export function useDeleteTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, businessId }: { id: string; businessId: string }) =>
      deleteTimeOff(id, businessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timeOffKeys.all });
    },
  });
}
