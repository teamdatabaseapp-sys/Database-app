/**
 * React Query hooks for staff schedule data
 *
 * Provides hooks for:
 * - Weekly schedule (7 days)
 * - Special days (single-date overrides)
 * - Blackout ranges (datetime ranges)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from './useBusiness';
import {
  getStaffWeeklySchedule,
  setStaffWeeklySchedule,
  getStaffSpecialDays,
  upsertStaffSpecialDay,
  deleteStaffSpecialDay,
  getStaffBlackoutRanges,
  createStaffBlackoutRange,
  updateStaffBlackoutRange,
  deleteStaffBlackoutRange,
  getStaffScheduleData,
  type StaffWeeklySchedule,
  type StaffSpecialDay,
  type StaffBlackoutRange,
  type WeeklyScheduleInput,
  type SpecialDayInput,
  type BlackoutRangeInput,
  type StaffScheduleData,
} from '@/services/staffScheduleService';

// Query keys
const STAFF_SCHEDULE_KEYS = {
  all: ['staff-schedule'] as const,
  weekly: (staffId: string, businessId: string) => [...STAFF_SCHEDULE_KEYS.all, 'weekly', staffId, businessId] as const,
  specialDays: (staffId: string, businessId: string) => [...STAFF_SCHEDULE_KEYS.all, 'special-days', staffId, businessId] as const,
  blackouts: (staffId: string, businessId: string) => [...STAFF_SCHEDULE_KEYS.all, 'blackouts', staffId, businessId] as const,
  fullSchedule: (staffId: string, businessId: string) => [...STAFF_SCHEDULE_KEYS.all, 'full', staffId, businessId] as const,
};

// ============================================
// Weekly Schedule Hooks
// ============================================

/**
 * Hook to fetch weekly schedule for a staff member
 */
export function useStaffWeeklySchedule(staffId: string | null | undefined) {
  const { businessId } = useBusiness();

  return useQuery<StaffWeeklySchedule[], Error>({
    queryKey: STAFF_SCHEDULE_KEYS.weekly(staffId || '', businessId || ''),
    queryFn: async () => {
      if (!staffId || !businessId) return [];
      const result = await getStaffWeeklySchedule(staffId, businessId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!staffId && !!businessId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to set/update weekly schedule for a staff member
 */
export function useSetStaffWeeklySchedule() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation<
    StaffWeeklySchedule[],
    Error,
    { staffId: string; schedule: WeeklyScheduleInput[] }
  >({
    mutationFn: async ({ staffId, schedule }) => {
      if (!businessId) throw new Error('No business ID');
      const result = await setStaffWeeklySchedule(staffId, businessId, schedule);
      if (result.error) throw result.error;
      return result.data || [];
    },
    onSuccess: (_, { staffId }) => {
      if (!businessId) return;
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.weekly(staffId, businessId) });
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.fullSchedule(staffId, businessId) });
    },
  });
}

// ============================================
// Special Days Hooks
// ============================================

/**
 * Hook to fetch special days for a staff member
 */
export function useStaffSpecialDays(staffId: string | null | undefined) {
  const { businessId } = useBusiness();

  return useQuery<StaffSpecialDay[], Error>({
    queryKey: STAFF_SCHEDULE_KEYS.specialDays(staffId || '', businessId || ''),
    queryFn: async () => {
      if (!staffId || !businessId) return [];
      const result = await getStaffSpecialDays(staffId, businessId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!staffId && !!businessId,
    staleTime: 30000,
  });
}

/**
 * Hook to add/update a special day
 */
export function useUpsertStaffSpecialDay() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation<
    StaffSpecialDay,
    Error,
    { staffId: string; specialDay: SpecialDayInput }
  >({
    mutationFn: async ({ staffId, specialDay }) => {
      if (!businessId) throw new Error('No business ID');
      const result = await upsertStaffSpecialDay(staffId, businessId, specialDay);
      if (result.error) throw result.error;
      if (!result.data) throw new Error('No data returned');
      return result.data;
    },
    onSuccess: (_, { staffId }) => {
      if (!businessId) return;
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.specialDays(staffId, businessId) });
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.fullSchedule(staffId, businessId) });
    },
  });
}

/**
 * Hook to delete a special day
 */
export function useDeleteStaffSpecialDay() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation<void, Error, { staffId: string; specialDayId: string }>({
    mutationFn: async ({ specialDayId }) => {
      const result = await deleteStaffSpecialDay(specialDayId);
      if (result.error) throw result.error;
    },
    onSuccess: (_, { staffId }) => {
      if (!businessId) return;
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.specialDays(staffId, businessId) });
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.fullSchedule(staffId, businessId) });
    },
  });
}

// ============================================
// Blackout Ranges Hooks
// ============================================

/**
 * Hook to fetch blackout ranges for a staff member
 */
export function useStaffBlackoutRanges(staffId: string | null | undefined) {
  const { businessId } = useBusiness();

  return useQuery<StaffBlackoutRange[], Error>({
    queryKey: STAFF_SCHEDULE_KEYS.blackouts(staffId || '', businessId || ''),
    queryFn: async () => {
      if (!staffId || !businessId) return [];
      const result = await getStaffBlackoutRanges(staffId, businessId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!staffId && !!businessId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a blackout range
 */
export function useCreateStaffBlackoutRange() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation<
    StaffBlackoutRange,
    Error,
    { staffId: string; blackout: BlackoutRangeInput }
  >({
    mutationFn: async ({ staffId, blackout }) => {
      if (!businessId) throw new Error('No business ID');
      const result = await createStaffBlackoutRange(staffId, businessId, blackout);
      if (result.error) throw result.error;
      if (!result.data) throw new Error('No data returned');
      return result.data;
    },
    onSuccess: (_, { staffId }) => {
      if (!businessId) return;
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.blackouts(staffId, businessId) });
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.fullSchedule(staffId, businessId) });
    },
  });
}

/**
 * Hook to update a blackout range
 */
export function useUpdateStaffBlackoutRange() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation<
    StaffBlackoutRange,
    Error,
    { staffId: string; blackoutId: string; updates: Partial<BlackoutRangeInput> }
  >({
    mutationFn: async ({ blackoutId, updates }) => {
      const result = await updateStaffBlackoutRange(blackoutId, updates);
      if (result.error) throw result.error;
      if (!result.data) throw new Error('No data returned');
      return result.data;
    },
    onSuccess: (_, { staffId }) => {
      if (!businessId) return;
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.blackouts(staffId, businessId) });
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.fullSchedule(staffId, businessId) });
    },
  });
}

/**
 * Hook to delete a blackout range
 */
export function useDeleteStaffBlackoutRange() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation<void, Error, { staffId: string; blackoutId: string }>({
    mutationFn: async ({ blackoutId }) => {
      const result = await deleteStaffBlackoutRange(blackoutId);
      if (result.error) throw result.error;
    },
    onSuccess: (_, { staffId }) => {
      if (!businessId) return;
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.blackouts(staffId, businessId) });
      queryClient.invalidateQueries({ queryKey: STAFF_SCHEDULE_KEYS.fullSchedule(staffId, businessId) });
    },
  });
}

// ============================================
// Combined Schedule Hook
// ============================================

/**
 * Hook to fetch all schedule data for a staff member
 * (weekly schedule, special days, and blackout ranges)
 */
export function useStaffScheduleData(staffId: string | null | undefined) {
  const { businessId } = useBusiness();

  return useQuery<StaffScheduleData, Error>({
    queryKey: STAFF_SCHEDULE_KEYS.fullSchedule(staffId || '', businessId || ''),
    queryFn: async () => {
      if (!staffId || !businessId) {
        return { weeklySchedule: [], specialDays: [], blackoutRanges: [] };
      }
      const result = await getStaffScheduleData(staffId, businessId);
      if (result.error) throw result.error;
      return result.data || { weeklySchedule: [], specialDays: [], blackoutRanges: [] };
    },
    enabled: !!staffId && !!businessId,
    staleTime: 30000,
  });
}

// Re-export types for convenience
export type {
  StaffWeeklySchedule,
  StaffSpecialDay,
  StaffBlackoutRange,
  WeeklyScheduleInput,
  SpecialDayInput,
  BlackoutRangeInput,
  StaffScheduleData,
};
