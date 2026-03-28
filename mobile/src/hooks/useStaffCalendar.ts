import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffCalendarShifts,
  upsertStaffCalendarShifts,
  deleteStaffCalendarShift,
  copyWeekShifts,
  applyDefaultSchedule,
  getCalendarSummary,
  getWeekStart,
  formatDateISO,
  type StaffCalendarData,
  type ShiftInput,
  type UpsertShiftsResult,
  type CalendarSummary,
} from '@/services/staffCalendarService';

// ============================================
// Query Keys
// ============================================

export const staffCalendarKeys = {
  all: ['staff-calendar'] as const,
  shifts: (businessId: string, storeId: string, weekStart: string) =>
    [...staffCalendarKeys.all, 'shifts', businessId, storeId, weekStart] as const,
  summary: (businessId: string, storeId: string, weekStart: string) =>
    [...staffCalendarKeys.all, 'summary', businessId, storeId, weekStart] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to fetch all shifts for a calendar month.
 * Finds every Monday (week start) that overlaps the month, fetches each week,
 * and returns a merged result with shifts filtered to dates within the month.
 */
export function useStaffCalendarMonthShifts(
  businessId: string | undefined,
  storeId: string | undefined,
  monthDate: Date, // any date within the target month
) {
  // Compute first/last day of the month (local)
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  // Collect all Monday week-starts that overlap this month
  const weekStarts: string[] = [];
  let cursor = getWeekStart(monthStart);
  while (cursor <= monthEnd) {
    weekStarts.push(formatDateISO(cursor));
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const results = useQueries({
    queries: weekStarts.map(weekStart => ({
      queryKey: staffCalendarKeys.shifts(businessId || '', storeId || '', weekStart),
      queryFn: async (): Promise<StaffCalendarData> => {
        const weekDate = new Date(weekStart + 'T00:00:00');
        return getStaffCalendarShifts(businessId!, storeId!, weekDate);
      },
      enabled: !!businessId && !!storeId,
      staleTime: 30 * 1000,
    })),
  });

  const isLoading = results.some(r => r.isLoading);
  const staff = results[0]?.data?.staff || [];

  // Merge shifts from all weeks, filtering to only those within the month
  const monthStartStr = formatDateISO(monthStart);
  const monthEndStr = formatDateISO(monthEnd);

  const allShifts = results.flatMap(r => {
    if (!r.data?.shifts) return [];
    return r.data.shifts.filter(shift => {
      // Compute the actual date of this shift
      const weekDate = new Date(shift.week_start_date + 'T00:00:00');
      const shiftDate = new Date(weekDate.getTime() + shift.day_of_week * 24 * 60 * 60 * 1000);
      const shiftDateStr = formatDateISO(shiftDate);
      return shiftDateStr >= monthStartStr && shiftDateStr <= monthEndStr;
    });
  });

  const refetch = () => results.forEach(r => r.refetch());

  return { allShifts, staff, isLoading, weekStarts, monthStart, monthEnd, refetch };
}

/**
 * Hook to fetch staff calendar shifts for a week
 */
export function useStaffCalendarShifts(
  businessId: string | undefined,
  storeId: string | undefined,
  weekStartDate: Date
) {
  const weekStart = formatDateISO(getWeekStart(weekStartDate));

  // NOTE: Debug logs removed from render path - they were causing performance issues
  // by executing on every component re-render

  return useQuery<StaffCalendarData>({
    // FIXED: Use consistent query key structure (ISO string only, no Date object)
    // This ensures mutations properly invalidate the cache
    queryKey: staffCalendarKeys.shifts(businessId || '', storeId || '', weekStart),
    queryFn: async () => {
      // Create normalized Date from weekStart string inside queryFn
      // This ensures consistent behavior and avoids query key dependency issues
      const normalizedWeekDate = new Date(weekStart + 'T00:00:00');
      // Debug log only when actually fetching (not on every render)
      console.log('[useStaffCalendarShifts] Fetching:', { businessId, storeId, weekStart });
      const result = await getStaffCalendarShifts(businessId!, storeId!, normalizedWeekDate);
      console.log('[useStaffCalendarShifts] Result:', {
        shifts: result?.shifts?.length || 0,
        staff: result?.staff?.length || 0,
      });
      return result;
    },
    enabled: !!businessId && !!storeId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to upsert shifts
 */
export function useUpsertStaffCalendarShifts() {
  const queryClient = useQueryClient();

  return useMutation<
    UpsertShiftsResult,
    Error,
    {
      businessId: string;
      storeId: string;
      weekStartDate: Date;
      shifts: ShiftInput[];
    }
  >({
    mutationFn: ({ businessId, storeId, weekStartDate, shifts }) =>
      upsertStaffCalendarShifts(businessId, storeId, weekStartDate, shifts),
    onSuccess: (_, variables) => {
      const weekStart = formatDateISO(getWeekStart(variables.weekStartDate));
      queryClient.invalidateQueries({
        queryKey: staffCalendarKeys.shifts(variables.businessId, variables.storeId, weekStart),
      });
    },
  });
}

/**
 * Hook to delete a single shift
 */
export function useDeleteStaffCalendarShift() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; error?: string },
    Error,
    {
      shiftId: string;
      businessId: string;
      storeId: string;
      weekStartDate: Date;
    }
  >({
    mutationFn: ({ shiftId }) => deleteStaffCalendarShift(shiftId),
    onSuccess: (_, variables) => {
      const weekStart = formatDateISO(getWeekStart(variables.weekStartDate));
      queryClient.invalidateQueries({
        queryKey: staffCalendarKeys.shifts(variables.businessId, variables.storeId, weekStart),
      });
    },
  });
}

/**
 * Hook to copy shifts from one week to another
 */
export function useCopyWeekShifts() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; copied?: number; error?: string },
    Error,
    {
      businessId: string;
      storeId: string;
      sourceWeek: Date;
      targetWeek: Date;
    }
  >({
    mutationFn: ({ businessId, storeId, sourceWeek, targetWeek }) =>
      copyWeekShifts(businessId, storeId, sourceWeek, targetWeek),
    onSuccess: (_, variables) => {
      const targetWeekStart = formatDateISO(getWeekStart(variables.targetWeek));
      queryClient.invalidateQueries({
        queryKey: staffCalendarKeys.shifts(variables.businessId, variables.storeId, targetWeekStart),
      });
    },
  });
}

/**
 * Hook to apply default schedule to a week
 */
export function useApplyDefaultSchedule() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; applied?: number; error?: string },
    Error,
    {
      businessId: string;
      storeId: string;
      staffId: string;
      weekStartDate: Date;
    }
  >({
    mutationFn: ({ businessId, storeId, staffId, weekStartDate }) =>
      applyDefaultSchedule(businessId, storeId, staffId, weekStartDate),
    onSuccess: (_, variables) => {
      const weekStart = formatDateISO(getWeekStart(variables.weekStartDate));
      queryClient.invalidateQueries({
        queryKey: staffCalendarKeys.shifts(variables.businessId, variables.storeId, weekStart),
      });
    },
  });
}

/**
 * Hook to get calendar summary for sharing
 */
export function useCalendarSummary(
  businessId: string | undefined,
  storeId: string | undefined,
  weekStartDate: Date,
  staffIds?: string[],
  enabled = false
) {
  const weekStart = formatDateISO(getWeekStart(weekStartDate));

  return useQuery<CalendarSummary>({
    // FIXED: Use consistent query key structure (ISO string only, no Date object)
    // Include staffIds in key since it affects the query result
    queryKey: [...staffCalendarKeys.summary(businessId || '', storeId || '', weekStart), staffIds],
    queryFn: () => {
      // Create normalized Date from weekStart string inside queryFn
      const normalizedWeekDate = new Date(weekStart + 'T00:00:00');
      return getCalendarSummary(businessId!, storeId!, normalizedWeekDate, staffIds);
    },
    enabled: enabled && !!businessId && !!storeId,
  });
}
