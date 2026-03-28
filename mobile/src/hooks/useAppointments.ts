/**
 * useAppointments Hook
 *
 * React Query hooks for appointments operations.
 * All operations are scoped to the current business.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { promotionRedemptionKeys } from '@/hooks/usePromotionRedemptions';
import { clientKeys } from '@/hooks/useClients';
import { loyaltyKeys } from '@/hooks/useLoyalty';
import {
  getAppointments,
  getDeletedAppointments,
  getAppointment,
  getClientAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  cancelAppointment,
  restoreAppointment,
  checkAppointmentConflict,
  searchAllAppointments,
  searchAppointmentsByTerm,
  checkInAppointment,
  completeAppointment,
  setAppointmentOutcome,
  transitionOverdueAppointments,
  // Series operations
  createAppointmentSeries,
  createAppointmentsFromSeries,
  getAppointmentSeries,
  getSeriesAppointments,
  cancelSeriesFromAppointment,
  updateSeriesFutureAppointments,
  generateSeriesPreview,
  type SupabaseAppointment,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
  type AppointmentSeries,
  type CreateSeriesInput,
  type SeriesPreview,
  type SeriesOccurrence,
  type AppointmentLifecycleStatus,
} from '@/services/appointmentsService';
import { useBusiness } from '@/hooks/useBusiness';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

// ============================================
// Query Keys
// ============================================

export const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (businessId: string, filters: string) => [...appointmentKeys.lists(), businessId, filters] as const,
  deleted: (businessId: string, storeId?: string) => [...appointmentKeys.all, 'deleted', businessId, storeId] as const,
  forClient: (businessId: string, clientId: string) => [...appointmentKeys.all, 'client', businessId, clientId] as const,
  details: () => [...appointmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...appointmentKeys.details(), id] as const,
  // Series keys
  series: () => [...appointmentKeys.all, 'series'] as const,
  seriesDetail: (seriesId: string) => [...appointmentKeys.series(), seriesId] as const,
  seriesAppointments: (seriesId: string) => [...appointmentKeys.series(), seriesId, 'appointments'] as const,
};

// ============================================
// Types
// ============================================

export type DateRangeMode = 'day' | 'week' | 'month';

interface AppointmentsFilters {
  date: Date;
  rangeMode: DateRangeMode;
  storeId?: string;
  staffId?: string;
}

// ============================================
// Hooks
// ============================================

/**
 * Hook to get appointments for a date range with filters
 */
export function useAppointments(filters: AppointmentsFilters) {
  const { businessId, isInitialized } = useBusiness();

  // Calculate date range based on mode - memoized for stability
  const dateRange = useMemo(() => {
    const range = getDateRange(filters.date, filters.rangeMode);
    return {
      startDateISO: range.startDate.toISOString(),
      endDateISO: range.endDate.toISOString(),
    };
  }, [filters.date, filters.rangeMode]);

  return useQuery({
    queryKey: [
      ...appointmentKeys.lists(),
      businessId || '',
      dateRange.startDateISO,
      dateRange.endDateISO,
      filters.storeId || 'all',
      filters.staffId || 'all',
    ],
    queryFn: async () => {
      if (!businessId) {
        console.log('[useAppointments] No businessId, returning empty array');
        return [];
      }
      console.log('[useAppointments] Fetching appointments:', {
        businessId,
        startDate: dateRange.startDateISO,
        endDate: dateRange.endDateISO,
        storeId: filters.storeId,
        staffId: filters.staffId,
      });
      const result = await getAppointments(businessId, {
        startDate: new Date(dateRange.startDateISO),
        endDate: new Date(dateRange.endDateISO),
        storeId: filters.storeId,
        staffId: filters.staffId,
      });
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 30 * 1000, // 30 seconds — ensures online bookings appear quickly
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Poll every 30s so online bookings appear without manual refresh
    // Keep previous data when date/range changes so the UI doesn't flash empty or break layout
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to get deleted appointments for restore feature
 */
export function useDeletedAppointments(storeId?: string) {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: appointmentKeys.deleted(businessId || '', storeId),
    queryFn: async () => {
      if (!businessId) {
        console.log('[useDeletedAppointments] No businessId, returning empty array');
        return [];
      }
      console.log('[useDeletedAppointments] Fetching deleted appointments:', { businessId, storeId });
      const result = await getDeletedAppointments(businessId, storeId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Hook to get a single appointment
 */
export function useAppointment(appointmentId: string | null) {
  return useQuery({
    queryKey: appointmentKeys.detail(appointmentId || ''),
    queryFn: async () => {
      if (!appointmentId) return null;
      console.log('[useAppointment] Fetching appointment:', appointmentId);
      const result = await getAppointment(appointmentId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!appointmentId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Hook to get appointments for a specific client
 */
export function useClientAppointments(clientId: string | null) {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: appointmentKeys.forClient(businessId || '', clientId || ''),
    queryFn: async () => {
      if (!businessId || !clientId) {
        console.log('[useClientAppointments] Skipping fetch — businessId:', businessId, 'clientId:', clientId);
        return [];
      }
      console.log('[useClientAppointments] Fetching appointments for client:', clientId, 'businessId:', businessId);
      const result = await getClientAppointments(businessId, clientId);
      if (result.error) {
        console.log('[useClientAppointments] Error:', result.error.message);
        throw result.error;
      }
      console.log('[useClientAppointments] Fetched', result.data?.length ?? 0, 'appointments for client:', clientId);
      return result.data || [];
    },
    enabled: isInitialized && !!businessId && !!clientId,
    staleTime: 2 * 60 * 1000, // 2 min — visit history changes via mutations that invalidate cache
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get all searchable appointments (for quick search feature)
 * Returns appointments from past year + next 6 months with joined data
 */
export function useSearchableAppointments() {
  const { businessId, isInitialized } = useBusiness();

  return useQuery({
    queryKey: [...appointmentKeys.all, 'searchable', businessId || ''],
    queryFn: async () => {
      if (!businessId) {
        return [];
      }
      console.log('[useSearchableAppointments] Fetching searchable appointments');
      const result = await searchAllAppointments(businessId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    staleTime: 5 * 60 * 1000, // 5 minutes - search data doesn't need to be as fresh
  });
}

/**
 * Server-side appointment search by term (confirmation code, name, email, phone).
 * No date bounds for confirmation code searches; broader date range for name/email/phone.
 * Only fires when searchTerm is non-empty.
 */
export function useSearchAppointments(searchTerm: string) {
  const { businessId, isInitialized } = useBusiness();
  const trimmed = searchTerm.trim();

  return useQuery({
    queryKey: [...appointmentKeys.all, 'term-search', businessId || '', trimmed],
    queryFn: async () => {
      if (!businessId || !trimmed) return [];
      const result = await searchAppointmentsByTerm(businessId, trimmed);
      if (result.error) {
        console.warn('[useSearchAppointments] Error:', result.error);
        return [];
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId && trimmed.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to create an appointment
 */
export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async (input: Omit<CreateAppointmentInput, 'business_id'>) => {
      if (!businessId) {
        throw new Error('No business ID available');
      }
      console.log('[useCreateAppointment] Creating appointment with business_id:', businessId);
      console.log('[useCreateAppointment] Input IDs — client_id:', input.client_id, '| store_id:', input.store_id, '| staff_id:', input.staff_id ?? 'null', '| promo_id:', input.promo_id ?? 'null');
      const result = await createAppointment({
        ...input,
        business_id: businessId,
      });
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      // For log visits: immediately patch the newly-created appointment in every cached list
      // so the "LOG VISIT • PENDING CONFIRMATION" badge shows without waiting for refetch.
      if (data?.is_log_visit === true) {
        queryClient.setQueriesData<SupabaseAppointment[]>(
          { queryKey: appointmentKeys.lists() },
          (old) => {
            if (!old || !data) return old;
            // If this appointment is already in the cache (by id), patch it;
            // otherwise prepend it so it's visible immediately.
            const exists = old.some((a) => a.id === data.id);
            const patched: SupabaseAppointment = {
              ...data,
              is_log_visit: true,
              lifecycle_status: 'pending_confirmation',
            };
            if (exists) {
              return old.map((a) => (a.id === data.id ? patched : a));
            }
            return [patched, ...old];
          }
        );
      }
      // Invalidate all appointment queries to refresh data
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      // Invalidate client queries so Client Details appointment count updates immediately
      if (data?.client_id) {
        queryClient.invalidateQueries({ queryKey: clientKeys.detail(data.client_id) });
        queryClient.invalidateQueries({ queryKey: appointmentKeys.forClient(data.business_id ?? '', data.client_id) });
      }
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      // Also invalidate promotion redemption queries so Analytics + Client Details update
      queryClient.invalidateQueries({ queryKey: promotionRedemptionKeys.all });
    },
  });
}

/**
 * Hook to update an appointment
 */
export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentId, updates }: { appointmentId: string; updates: UpdateAppointmentInput }) => {
      console.log('[useUpdateAppointment] Updating appointment:', appointmentId);
      const result = await updateAppointment(appointmentId, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: appointmentKeys.detail(data.id) });
      }
    },
  });
}

/**
 * Hook to soft delete an appointment
 */
export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      console.log('[useDeleteAppointment] Deleting appointment:', appointmentId);
      const result = await deleteAppointment(appointmentId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

/**
 * Hook to cancel an appointment
 */
export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      console.log('[useCancelAppointment] Cancelling appointment:', appointmentId);
      const result = await cancelAppointment(appointmentId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data, appointmentId) => {
      // Immediately patch every cached appointment query so the card re-renders
      // as cancelled without waiting for a network refetch.
      queryClient.setQueriesData<SupabaseAppointment[]>(
        { queryKey: appointmentKeys.all },
        (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((apt) =>
            apt.id === appointmentId
              ? { ...apt, is_cancelled: true, lifecycle_status: 'cancelled' as const }
              : apt
          );
        }
      );
      // Also invalidate so the next background refetch gets fresh server data.
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

/**
 * Hook to restore a deleted/cancelled appointment
 */
export function useRestoreAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      console.log('[useRestoreAppointment] Restoring appointment:', appointmentId);
      const result = await restoreAppointment(appointmentId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

/**
 * Hook to check for appointment conflicts
 */
export function useCheckAppointmentConflict() {
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      storeId,
      staffId,
      startAt,
      endAt,
      excludeAppointmentId,
    }: {
      storeId: string;
      staffId: string | null;
      startAt: Date;
      endAt: Date;
      excludeAppointmentId?: string;
    }) => {
      if (!businessId) {
        throw new Error('No business ID available');
      }
      console.log('[useCheckAppointmentConflict] Checking conflicts');
      const result = await checkAppointmentConflict(
        businessId,
        storeId,
        staffId,
        startAt,
        endAt,
        excludeAppointmentId
      );
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
  });
}

/**
 * Hook to get appointments for Analytics (flexible date range)
 * Used by MonthlyStatsScreen for revenue and appointment stats
 */
export function useAnalyticsAppointments(startDate: Date, endDate: Date, storeId?: string | null) {
  const { businessId, isInitialized } = useBusiness();

  // Memoize ISO strings to prevent unnecessary re-fetches
  const dateRange = useMemo(() => ({
    startDateISO: startDate.toISOString(),
    endDateISO: endDate.toISOString(),
  }), [startDate, endDate]);

  return useQuery({
    queryKey: [
      ...appointmentKeys.lists(),
      businessId || '',
      'analytics',
      dateRange.startDateISO,
      dateRange.endDateISO,
      storeId || 'all',
    ],
    queryFn: async () => {
      if (!businessId) {
        console.log('[useAnalyticsAppointments] No businessId, returning empty array');
        return [];
      }
      console.log('[useAnalyticsAppointments] Fetching appointments for analytics:', {
        businessId,
        startDate: dateRange.startDateISO,
        endDate: dateRange.endDateISO,
        storeId,
      });
      const result = await getAppointments(businessId, {
        startDate: new Date(dateRange.startDateISO),
        endDate: new Date(dateRange.endDateISO),
        storeId: storeId || undefined,
      });
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: isInitialized && !!businessId,
    // 2-minute stale time prevents duplicate fetches on re-renders while keeping
    // analytics data fresh. React Query deduplicates in-flight requests automatically.
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// Helpers
// ============================================

/**
 * Calculate date range based on mode
 */
function getDateRange(date: Date, mode: DateRangeMode): { startDate: Date; endDate: Date } {
  switch (mode) {
    case 'day':
      return {
        startDate: startOfDay(date),
        endDate: endOfDay(date),
      };
    case 'week':
      return {
        startDate: startOfWeek(date, { weekStartsOn: 0 }),
        endDate: endOfWeek(date, { weekStartsOn: 0 }),
      };
    case 'month':
      return {
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
      };
    default:
      return {
        startDate: startOfDay(date),
        endDate: endOfDay(date),
      };
  }
}

/**
 * Convert Supabase appointment to local format for UI compatibility
 */
export function convertToLocalAppointment(apt: SupabaseAppointment): {
  id: string;
  userId: string;
  clientId: string;
  storeId: string;
  staffId?: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;
  title: string;
  notes?: string;
  amount?: number;
  currency?: string;
  promotionId?: string;
  serviceTags?: string[];
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number; // Converted from cents to dollars
  serviceColor?: string;
  // Joined data from related tables
  storeName?: string;
  staffName?: string;
  // Denormalized customer name (for online bookings)
  customerName?: string;
  // Recurring appointment fields
  seriesId?: string;
  seriesOccurrenceIndex?: number;
  cancelled: boolean;
  deleted: boolean;
  // Lifecycle
  lifecycleStatus: AppointmentLifecycleStatus;
  checkedInAt?: Date;
  completedAt?: Date;
  outcomeConfirmedAt?: Date;
  // Gift card
  giftCardIntent: boolean;
  giftCardId?: string;
  giftCardDebited: boolean;
  // Log Visit flag
  isLogVisit: boolean;
  // Confirmation code
  confirmationCode?: string;
  // Gift card code parsed from appointment notes (online bookings)
  giftCardCodeFromNotes?: string;
  // Cents-based pricing
  subtotalCents?: number | null;
  totalCents?: number | null;
  createdAt: Date;
  updatedAt: Date;
} {
  const startDate = new Date(apt.start_at);
  const endDate = new Date(apt.end_at);

  // Get service IDs from joined services table, junction table, or direct service_id column
  let serviceTags: string[] | undefined;
  let serviceId: string | undefined;
  let serviceName: string | undefined;
  let serviceColor: string | undefined;
  let servicePriceInDollars: number | undefined;

  // Priority 1: Use joined services table data (FK join — most reliable for online bookings)
  if (apt.services?.id) {
    serviceId = apt.services.id;
    serviceName = apt.services.name;
    serviceColor = apt.services.color;
    servicePriceInDollars = apt.services.price_cents != null ? apt.services.price_cents / 100 : undefined;
    serviceTags = [apt.services.id];
  }
  // Priority 2: Use joined service (singular alias)
  else if (apt.service?.id) {
    serviceId = apt.service.id;
    serviceName = apt.service.name;
    servicePriceInDollars = apt.service.price_cents != null ? apt.service.price_cents / 100 : undefined;
    serviceTags = [apt.service.id];
  }
  // Priority 3: Use direct service columns
  else if (apt.service_id) {
    serviceId = apt.service_id;
    serviceName = apt.service_name ?? undefined;
    servicePriceInDollars = apt.service_price != null ? apt.service_price / 100 : undefined;
    serviceTags = [apt.service_id];
  }
  // Priority 4: Use appointment_services junction table
  else if (apt.appointment_services && apt.appointment_services.length > 0) {
    serviceTags = apt.appointment_services.map((as) => as.service_id);
  }

  // If servicePrice is still not resolved, try to derive from cents pricing
  if (servicePriceInDollars == null && apt.subtotal_cents != null && apt.subtotal_cents > 0) {
    servicePriceInDollars = apt.subtotal_cents / 100;
  }
  if (servicePriceInDollars == null && apt.total_cents != null && apt.total_cents > 0) {
    servicePriceInDollars = apt.total_cents / 100;
  }

  // Get store name from joined data (support both aliases)
  const storeName = apt.stores?.name ?? apt.store?.name;

  // Get staff name from joined data (prefer full_name over name, support both aliases)
  const staffName = apt.staff?.full_name || apt.staff?.name;

  // Get customer name for online bookings (denormalized column on appointments table)
  const customerName = (apt as any).customer_name ?? undefined;

  // Parse notes for fallback confirmation_code and gift_card_code
  // Format: "Online Booking\nConfirmation Code: XXXXXX"
  // Format: "Gift Card: GC-XXXX-XXXX-XXXX"
  const notes = apt.notes ?? '';
  const confirmationFromNotes = (() => {
    const m = notes.match(/Confirmation Code:\s*([A-Z0-9]+)/i);
    return m ? m[1].toUpperCase() : undefined;
  })();
  const giftCardFromNotes = (() => {
    const m = notes.match(/Gift Card:\s*([A-Z0-9\-]+)/i);
    return m ? m[1].toUpperCase() : undefined;
  })();

  // Resolve confirmation code: DB field first, then notes fallback
  const resolvedConfirmationCode = apt.confirmation_code ?? confirmationFromNotes ?? undefined;

  // Resolve gift card code: joined gift_cards table first, then parsed from notes fallback
  const resolvedGiftCardCodeFromNotes = apt.gift_cards?.code ?? giftCardFromNotes ?? undefined;

  return {
    id: apt.id,
    userId: apt.business_id, // Use business_id as userId for compatibility
    clientId: apt.client_id,
    storeId: apt.store_id,
    staffId: apt.staff_id ?? undefined,
    date: startDate,
    startTime: formatTime(startDate),
    endTime: formatTime(endDate),
    duration: apt.duration_minutes,
    title: apt.title || '',
    notes: apt.notes ?? undefined,
    amount: apt.amount || 0,
    currency: apt.currency || 'USD',
    promotionId: apt.promo_id ?? undefined,
    serviceTags,
    serviceId,
    serviceName,
    servicePrice: servicePriceInDollars,
    serviceColor,
    storeName,
    staffName,
    customerName,
    // Recurring appointment fields
    seriesId: apt.series_id ?? undefined,
    seriesOccurrenceIndex: apt.series_occurrence_index ?? undefined,
    cancelled: apt.is_cancelled === true || apt.status === 'cancelled',
    deleted: apt.is_deleted === true,
    // Lifecycle — for log visits, always treat non-terminal status as pending_confirmation
    // so the badge shows correctly on first render without waiting for a background refetch.
    lifecycleStatus: (() => {
      const raw = apt.lifecycle_status ?? deriveLifecycleStatus(apt);
      // If this is a log visit and the status is still at 'scheduled' (or was derived as such),
      // override to 'pending_confirmation' so the card shows the correct badge immediately.
      if (
        apt.is_log_visit === true &&
        (raw === 'scheduled' || raw == null)
      ) {
        return 'pending_confirmation' as AppointmentLifecycleStatus;
      }
      return raw as AppointmentLifecycleStatus;
    })(),
    checkedInAt: apt.checked_in_at ? new Date(apt.checked_in_at) : undefined,
    completedAt: apt.completed_at ? new Date(apt.completed_at) : undefined,
    outcomeConfirmedAt: apt.outcome_confirmed_at ? new Date(apt.outcome_confirmed_at) : undefined,
    // Gift card
    giftCardIntent: apt.gift_card_intent === true,
    giftCardId: apt.gift_card_id ?? undefined,
    giftCardDebited: apt.gift_card_debited === true,
    // Log Visit flag
    isLogVisit: apt.is_log_visit === true,
    // Confirmation code: DB field first, then parsed from notes
    confirmationCode: resolvedConfirmationCode,
    // Gift card code parsed from notes (for online bookings that don't store gift_card_id)
    giftCardCodeFromNotes: resolvedGiftCardCodeFromNotes,
    // Cents-based pricing
    subtotalCents: apt.subtotal_cents ?? null,
    totalCents: apt.total_cents ?? null,
    createdAt: new Date(apt.created_at),
    updatedAt: new Date(apt.updated_at),
  };
}

/**
 * Format time as HH:mm
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Derive lifecycle status from legacy boolean flags for appointments
 * that predate the lifecycle system.
 */
function deriveLifecycleStatus(apt: SupabaseAppointment): AppointmentLifecycleStatus {
  if (apt.is_deleted === true) return 'cancelled';
  if (apt.is_cancelled === true || apt.status === 'cancelled') return 'cancelled';
  if (apt.status === 'completed') return 'completed';
  // Log visits that have no explicit lifecycle_status yet are always pending confirmation
  // (they were retroactively logged and need the outcome confirmed)
  if (apt.is_log_visit === true) return 'pending_confirmation';
  return 'scheduled';
}

// ============================================
// Lifecycle Mutation Hooks
// ============================================

/**
 * Hook to check in an appointment.
 * Transitions: scheduled → checked_in
 */
export function useCheckInAppointment() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      authToken,
    }: {
      appointmentId: string;
      authToken?: string;
    }) => {
      const result = await checkInAppointment(appointmentId, authToken);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      }
    },
  });
}

/**
 * Hook to complete an appointment.
 * Transitions: checked_in/scheduled/pending_confirmation → completed
 * Triggers revenue finalization + optional gift card debit.
 */
export function useCompleteAppointment() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      giftCardId,
      authToken,
    }: {
      appointmentId: string;
      giftCardId?: string | null;
      authToken?: string;
    }) => {
      const result = await completeAppointment(appointmentId, giftCardId, authToken);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      }
      // Invalidate gift card data so View Appointment + Recent Activity refresh after debit
      queryClient.invalidateQueries({ queryKey: ['gift_cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift_card_transactions'] }); // covers redemption sub-keys
      queryClient.invalidateQueries({ queryKey: ['client_gift_cards'] });
      // Invalidate loyalty data immediately so Client Details + Loyalty Program reflect new points
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.all });
    },
  });
}

/**
 * Hook to set appointment outcome.
 * For pending_confirmation appointments: completed | no_show | cancelled
 */
export function useSetAppointmentOutcome() {
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();
  const language = useStore((s) => s.language) as string;

  return useMutation({
    mutationFn: async ({
      appointmentId,
      outcome,
      giftCardId,
      authToken,
      debitGiftCard,
    }: {
      appointmentId: string;
      outcome: 'completed' | 'no_show' | 'cancelled';
      giftCardId?: string | null;
      authToken?: string;
      debitGiftCard?: boolean;
    }) => {
      const result = await setAppointmentOutcome(appointmentId, outcome, giftCardId, authToken, debitGiftCard, language);
      if (result.error) throw result.error;
      return result.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      }
      // Always invalidate gift card data so Recent Activity refreshes after server-side debit
      queryClient.invalidateQueries({ queryKey: ['gift_cards'] });
      queryClient.invalidateQueries({ queryKey: ['gift_card_transactions'] }); // covers redemption sub-keys
      queryClient.invalidateQueries({ queryKey: ['client_gift_cards'] });
      // Invalidate loyalty data when appointment is completed so client profile reflects new points
      if (variables.outcome === 'completed') {
        queryClient.invalidateQueries({ queryKey: loyaltyKeys.all });
      }
    },
  });
}

/**
 * Hook to trigger overdue appointment transitions.
 * Call on app focus and periodically.
 */
export function useTransitionOverdue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ businessId }: { businessId?: string }) => {
      await transitionOverdueAppointments(businessId);
    },
    onSuccess: () => {
      // Overdue transitions may auto-complete appointments and award loyalty points server-side.
      // Invalidate immediately so Client Details + Loyalty Program reflect new balances without waiting.
      queryClient.invalidateQueries({ queryKey: loyaltyKeys.all });
      queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

// Re-export types for convenience
export type { AppointmentLifecycleStatus };

// ============================================
// Recurring Appointment Series Hooks
// ============================================

/**
 * Hook to generate a preview of recurring appointments
 * Returns calculated occurrences without creating any appointments
 */
export function useSeriesPreview() {
  return useMutation({
    mutationFn: async ({
      input,
      storeHours,
      blackoutDates,
      existingAppointments,
    }: {
      input: CreateSeriesInput;
      storeHours?: { day_of_week: number; is_closed: boolean; open_time: string; close_time: string }[];
      blackoutDates?: string[];
      existingAppointments?: { start_at: string; end_at: string; staff_id: string | null }[];
    }) => {
      return generateSeriesPreview(input, storeHours, blackoutDates, existingAppointments);
    },
  });
}

/**
 * Hook to create a recurring appointment series
 */
export function useCreateAppointmentSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSeriesInput) => {
      const result = await createAppointmentSeries(input);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

/**
 * Hook to create appointments from a series
 */
export function useCreateAppointmentsFromSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      series,
      occurrences,
      skipConflicts = true,
    }: {
      series: AppointmentSeries;
      occurrences: SeriesOccurrence[];
      skipConflicts?: boolean;
    }) => {
      const result = await createAppointmentsFromSeries(series, occurrences, skipConflicts);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

/**
 * Hook to get an appointment series
 */
export function useAppointmentSeries(seriesId: string | null) {
  return useQuery({
    queryKey: appointmentKeys.seriesDetail(seriesId || ''),
    queryFn: async () => {
      if (!seriesId) return null;
      const result = await getAppointmentSeries(seriesId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!seriesId,
  });
}

/**
 * Hook to get all appointments in a series
 */
export function useSeriesAppointments(seriesId: string | null) {
  return useQuery({
    queryKey: appointmentKeys.seriesAppointments(seriesId || ''),
    queryFn: async () => {
      if (!seriesId) return [];
      const result = await getSeriesAppointments(seriesId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!seriesId,
  });
}

/**
 * Hook to cancel series appointments
 */
export function useCancelSeriesAppointments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seriesId,
      fromAppointmentId,
      cancelAll = false,
    }: {
      seriesId: string;
      fromAppointmentId: string;
      cancelAll?: boolean;
    }) => {
      const result = await cancelSeriesFromAppointment(seriesId, fromAppointmentId, cancelAll);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

/**
 * Hook to update future appointments in a series
 */
export function useUpdateSeriesFutureAppointments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seriesId,
      fromDate,
      updates,
    }: {
      seriesId: string;
      fromDate: Date;
      updates: Partial<UpdateAppointmentInput>;
    }) => {
      const result = await updateSeriesFutureAppointments(seriesId, fromDate, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

// Re-export types for convenience
export type {
  AppointmentSeries,
  CreateSeriesInput,
  SeriesPreview,
  SeriesOccurrence,
  RecurrenceFrequency,
  RecurrenceEndType,
} from '@/services/appointmentsService';
