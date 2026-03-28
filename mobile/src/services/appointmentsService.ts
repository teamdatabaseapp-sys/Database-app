/**
 * Appointments Service
 *
 * Handles all Supabase operations for appointments.
 * All operations are scoped by business_id for multi-tenant security.
 *
 * NOTE: For Analytics, use analyticsService.ts instead!
 */

import { getSupabase } from '@/lib/supabaseClient';

// Backend URL helper — defined early so it can be used anywhere in this file
const getBackendUrl = (): string => {
  return (
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    'http://localhost:3000'
  );
};

// Flag to prevent spamming RLS error logs
let hasLoggedRlsError = false;

// Helper to log RLS error only once per session
const logRlsErrorOnce = () => {
  if (!hasLoggedRlsError) {
    hasLoggedRlsError = true;
    console.warn('[AppointmentsService] RLS POLICY ERROR: The appointments table has an RLS policy using app.current_business_id which cannot be set from the JS client. Run getSupabase()-analytics-appointments-rpc.sql in Supabase SQL Editor to fix.');
  }
};

// ============================================
// Types
// ============================================

export type AppointmentLifecycleStatus =
  | 'scheduled'
  | 'checked_in'
  | 'pending_confirmation'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export interface SupabaseAppointment {
  id: string;
  business_id: string;
  client_id: string;
  store_id: string;
  staff_id: string | null;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  title: string | null;
  notes: string | null;
  amount: number; // Decimal amount (not cents) - may be missing in some schemas
  currency: string;
  promo_id: string | null;
  // Pricing breakdown (cents integers) — added via migration 20260220200000
  subtotal_cents?: number | null;
  discount_cents?: number | null;
  total_cents?: number | null;
  // Recurring appointment fields
  series_id?: string | null; // Links to appointment_series table
  series_occurrence_index?: number | null; // Which occurrence in the series (1, 2, 3...)
  // Online booking confirmation code (e.g. "34BCC31C") - set by create_public_booking RPC
  confirmation_code?: string | null;
  // Legacy service_tags column (TEXT[] array of service IDs)
  service_tags?: string[] | null;
  // Direct service columns (denormalized for quick access)
  service_id?: string | null;
  service_name?: string | null;
  service_price?: number | null; // Stored in cents (e.g., 7500 = $75.00)
  // Schema variant 1: boolean flags
  is_deleted?: boolean;
  deleted_at?: string | null;
  is_cancelled?: boolean;
  cancelled_at?: string | null;
  // Schema variant 2: status string (legacy)
  status?: string; // 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  // Lifecycle state (enterprise lifecycle system)
  lifecycle_status?: AppointmentLifecycleStatus | null;
  checked_in_at?: string | null;
  completed_at?: string | null;
  outcome_confirmed_at?: string | null;
  // Gift card intent & debit tracking
  gift_card_intent?: boolean | null;
  gift_card_id?: string | null;
  gift_card_debited?: boolean | null;
  // Log Visit flag — true for retroactively logged visits (not scheduled bookings)
  is_log_visit?: boolean | null;
  created_at: string;
  updated_at: string;
  // Joined from appointment_services table
  appointment_services?: Array<{
    service_id: string;
    promo_id?: string | null;
  }>;
  // Joined gift card (populated when gift_card_id is set)
  gift_cards?: { id: string; code: string } | null;
  // Expanded promotion join at appointment level (populated when promotions join is unambiguous)
  promotions?: { id: string; title: string; discount_type: string; discount_value: number } | null;
  // Denormalized customer fields (populated for online bookings)
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  // Joined from related tables via FK constraints (LEFT JOIN)
  // These use the alias format: store:store_id, staff:staff_id, service:service_id
  store?: { id: string; name: string } | null;
  staff?: { id: string; name?: string; full_name?: string } | null;
  service?: { id: string; name: string; price_cents: number } | null;
  // Joined series data (when fetching series info)
  series?: AppointmentSeries | null;
  // Legacy plural aliases (deprecated - use singular above)
  stores?: { id: string; name: string } | null;
  services?: { id: string; name: string; price_cents: number; color: string } | null;
}

export interface CreateAppointmentInput {
  business_id: string;
  client_id: string;
  store_id: string;
  staff_id?: string | null;
  appointment_date: Date; // Required: full timestamp combining selected date + start time
  start_at: Date;
  end_at: Date;
  duration_minutes: number;
  title?: string;
  notes?: string;
  amount?: number;
  currency?: string;
  promo_id?: string | null;
  service_id?: string | null; // Primary service UUID — satisfies appointments_service_id_nn_chk NOT NULL constraint
  service_tags?: string[]; // Array of ALL selected service IDs (backup/analytics)
  // Pricing breakdown (cents)
  subtotal_cents?: number | null;
  discount_cents?: number | null;
  total_cents?: number | null;
  // Gift card intent
  gift_card_intent?: boolean | null;
  gift_card_id?: string | null;
  // Log Visit — bypasses overlap constraint for historical records
  is_log_visit?: boolean;
}

export interface UpdateAppointmentInput {
  staff_id?: string | null;
  store_id?: string | null;
  start_at?: Date;
  end_at?: Date;
  duration_minutes?: number;
  title?: string;
  notes?: string;
  amount?: number;
  currency?: string;
  promo_id?: string | null;
  service_tags?: string[]; // Array of service IDs for backup storage
  // Pricing breakdown (cents)
  subtotal_cents?: number | null;
  discount_cents?: number | null;
  total_cents?: number | null;
  // Gift card intent
  gift_card_intent?: boolean | null;
  gift_card_id?: string | null;
}

// ============================================
// Recurring Appointments Types
// ============================================

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type RecurrenceEndType = 'until_date' | 'occurrence_count';

export interface AppointmentSeries {
  id: string;
  business_id: string;
  store_id: string;
  staff_id: string | null;
  client_id: string;
  service_ids: string[];
  frequency_type: RecurrenceFrequency;
  interval_value: number; // e.g., 1 for weekly, 2 for every 2 weeks
  start_date: string; // ISO date string
  end_type: RecurrenceEndType;
  end_date: string | null; // If end_type is 'until_date'
  occurrence_count: number | null; // If end_type is 'occurrence_count'
  start_time: string; // HH:MM format
  duration_minutes: number;
  amount: number;
  currency: string;
  notes: string | null;
  timezone: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CreateSeriesInput {
  business_id: string;
  store_id: string;
  staff_id?: string | null;
  client_id: string;
  service_ids: string[];
  frequency_type: RecurrenceFrequency;
  interval_value?: number;
  start_date: Date;
  end_type: RecurrenceEndType;
  end_date?: Date | null;
  occurrence_count?: number | null;
  start_time: string;
  duration_minutes: number;
  amount?: number;
  currency?: string;
  notes?: string;
  timezone?: string;
}

export interface SeriesOccurrence {
  date: Date;
  start_at: Date;
  end_at: Date;
  hasConflict: boolean;
  conflictReason?: string;
}

export interface SeriesPreview {
  occurrences: SeriesOccurrence[];
  totalCount: number;
  conflictCount: number;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Appointment Operations
// ============================================

/**
 * Get appointments for a date range.
 *
 * NOTE: For Analytics, use the analyticsService.ts instead!
 * This function is for calendar/scheduling views only.
 */
export async function getAppointments(
  businessId: string,
  options: {
    startDate: Date;
    endDate: Date;
    storeId?: string;
    staffId?: string;
    includeDeleted?: boolean;
  }
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    console.log('[AppointmentsService] getAppointments called:', {
      businessId,
      startDate: options.startDate.toISOString(),
      endDate: options.endDate.toISOString(),
      storeId: options.storeId,
      staffId: options.staffId,
    });

    if (!businessId) {
      console.log('[AppointmentsService] No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    // Query appointments with services join — explicit columns only (no overfetch).
    // The wildcard select('*') was transferring all columns including large text fields
    // on every calendar and analytics load.
    let query = getSupabase()
      .from('appointments')
      .select(`
        id, business_id, client_id, store_id, staff_id,
        start_at, end_at, duration_minutes,
        title, notes, amount, currency,
        promo_id, subtotal_cents, discount_cents, total_cents,
        series_id, series_occurrence_index, confirmation_code,
        service_tags, service_id, service_name, service_price,
        is_deleted, deleted_at, is_cancelled,
        lifecycle_status, checked_in_at, completed_at, outcome_confirmed_at,
        gift_card_intent, gift_card_id, gift_card_debited,
        is_log_visit, created_at, updated_at,
        customer_name, customer_email, customer_phone,
        services!appointments_service_id_fkey (
          id,
          name,
          price_cents,
          color
        ),
        appointment_services (
          service_id
        ),
        gift_cards (
          id,
          code
        )
      `)
      .eq('business_id', businessId)
      .gte('start_at', options.startDate.toISOString())
      .lte('start_at', options.endDate.toISOString());

    // Filter by store if provided
    if (options.storeId) {
      query = query.eq('store_id', options.storeId);
    }

    // Filter by staff if provided
    if (options.staffId) {
      query = query.eq('staff_id', options.staffId);
    }

    // Filter out deleted unless explicitly requested
    if (!options.includeDeleted) {
      query = query.or('is_deleted.eq.false,is_deleted.is.null');
    }

    // Order by start time
    query = query.order('start_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      // Log RLS error only once to avoid spam
      if (error.message?.includes('app.current_business_id')) {
        logRlsErrorOnce();
      } else {
        console.warn('[AppointmentsService] Error fetching appointments:', error.message);
      }
      return { data: null, error };
    }

    console.log('[AppointmentsService] Appointments fetched:', data?.length ?? 0);
    return { data: data as unknown as SupabaseAppointment[], error: null };
  } catch (err) {
    console.warn('[AppointmentsService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch appointments'),
    };
  }
}

/**
 * Get deleted appointments for restore feature (last 30 days)
 */
export async function getDeletedAppointments(
  businessId: string,
  storeId?: string
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    console.log('[AppointmentsService] getDeletedAppointments called:', { businessId, storeId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let query = getSupabase()
      .from('appointments')
      .select(`
        *,
        services!appointments_service_id_fkey (
          id,
          name,
          price_cents,
          color
        ),
        appointment_services (
          service_id
        ),
        gift_cards (
          id,
          code
        )
      `)
      .eq('business_id', businessId)
      .or('is_deleted.eq.true,is_cancelled.eq.true')
      .gte('deleted_at', thirtyDaysAgo.toISOString())
      .order('deleted_at', { ascending: false });

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('app.current_business_id')) {
        logRlsErrorOnce();
      }
      return { data: null, error };
    }

    console.log('[AppointmentsService] Deleted appointments fetched:', data?.length ?? 0);
    return { data: data as SupabaseAppointment[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch deleted appointments'),
    };
  }
}

/**
 * Search all appointments across all stores.
 * Returns appointments from the past year + next 6 months for comprehensive search.
 *
 * NOTE: For Analytics, use the analyticsService.ts instead!
 */
/**
 * Search appointments by term across all dates (no date bounds).
 * Searches confirmation_code, client name/email/phone using Supabase OR filters.
 * Used when search query is present in AppointmentsScreen.
 */
export async function searchAppointmentsByTerm(
  businessId: string,
  term: string
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    if (!businessId || !term.trim()) {
      return { data: [], error: null };
    }

    const normalizedTerm = term.trim().toUpperCase();
    const lowerTerm = term.trim().toLowerCase();
    const digitsTerm = term.replace(/\D/g, '');

    // Determine if input looks like a confirmation code (6-12 alphanumeric chars, no spaces)
    const isConfirmationCodeCandidate = /^[A-Z0-9]{6,12}$/.test(normalizedTerm);

    if (isConfirmationCodeCandidate) {
      // Primary: search by confirmation_code (ILIKE for partial prefix match, no date bounds)
      const { data, error } = await getSupabase()
        .from('appointments')
        .select(`
          *,
          appointment_services ( service_id ),
          gift_cards ( id, code )
        `)
        .eq('business_id', businessId)
        .ilike('confirmation_code', `${normalizedTerm}%`)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('start_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('[AppointmentsService] searchAppointmentsByTerm (code) error:', error.message);
        return { data: null, error };
      }

      console.log('[AppointmentsService] Code search found:', data?.length ?? 0);
      return { data: data as SupabaseAppointment[], error: null };
    }

    // Fallback: search across past 2 years by name (client join) or email/phone
    // Use client_id join via clients table for name/email/phone
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const oneYearFuture = new Date();
    oneYearFuture.setFullYear(oneYearFuture.getFullYear() + 1);

    // Build OR filter: search by customer_email, customer_name, customer_phone stored on appointment
    let orParts: string[] = [
      `customer_name.ilike.%${lowerTerm}%`,
      `customer_email.ilike.%${lowerTerm}%`,
    ];
    if (digitsTerm.length >= 3) {
      orParts.push(`customer_phone.ilike.%${digitsTerm}%`);
    }

    const { data, error } = await getSupabase()
      .from('appointments')
      .select(`
        *,
        appointment_services ( service_id ),
        gift_cards ( id, code )
      `)
      .eq('business_id', businessId)
      .or(orParts.join(','))
      .gte('start_at', twoYearsAgo.toISOString())
      .lte('start_at', oneYearFuture.toISOString())
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('start_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('[AppointmentsService] searchAppointmentsByTerm (name) error:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Term search found:', data?.length ?? 0);
    return { data: data as SupabaseAppointment[], error: null };
  } catch (err) {
    console.warn('[AppointmentsService] Unexpected error in searchAppointmentsByTerm:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Search failed'),
    };
  }
}

/**
 * Search appointments by ID prefix (fallback for legacy confirmation code display).
 * Returns appointments whose UUID starts with the given prefix (case-insensitive).
 */
export async function searchAllAppointments(
  businessId: string
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    console.log('[AppointmentsService] searchAllAppointments called:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    // Get appointments from 1 year ago to 6 months in the future
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    const { data, error } = await getSupabase()
      .from('appointments')
      .select(`
        id, business_id, client_id, store_id, staff_id,
        start_at, end_at, duration_minutes,
        title, notes, amount, currency,
        promo_id, subtotal_cents, discount_cents, total_cents,
        series_id, series_occurrence_index, confirmation_code,
        service_tags, service_id, service_name, service_price,
        is_deleted, deleted_at, is_cancelled,
        lifecycle_status, checked_in_at, completed_at, outcome_confirmed_at,
        gift_card_intent, gift_card_id, gift_card_debited,
        is_log_visit, created_at, updated_at,
        customer_name, customer_email, customer_phone,
        services!appointments_service_id_fkey (
          id,
          name,
          price_cents,
          color
        ),
        appointment_services (
          service_id
        ),
        gift_cards (
          id,
          code
        )
      `)
      .eq('business_id', businessId)
      .gte('start_at', oneYearAgo.toISOString())
      .lte('start_at', sixMonthsFromNow.toISOString())
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('start_at', { ascending: false })
      .limit(1000);

    if (error) {
      if (error.message?.includes('app.current_business_id')) {
        logRlsErrorOnce();
      } else {
        console.warn('[AppointmentsService] Error fetching searchable appointments:', error.message);
      }
      return { data: null, error };
    }

    console.log('[AppointmentsService] Searchable appointments fetched:', data?.length ?? 0);
    return { data: data as unknown as SupabaseAppointment[], error: null };
  } catch (err) {
    console.warn('[AppointmentsService] Unexpected error in search:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch searchable appointments'),
    };
  }
}

/**
 * Get a single appointment by ID
 */
export async function getAppointment(appointmentId: string): Promise<ServiceResult<SupabaseAppointment>> {
  try {
    console.log('[AppointmentsService] getAppointment called for id:', appointmentId);

    const { data, error } = await getSupabase()
      .from('appointments')
      .select(`
        *,
        services!appointments_service_id_fkey (
          id,
          name,
          price_cents,
          color
        ),
        appointment_services (
          service_id
        ),
        gift_cards (
          id,
          code
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (error) {
      console.log('[AppointmentsService] Error fetching appointment:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Appointment fetched:', data?.id);
    return { data: data as SupabaseAppointment, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch appointment'),
    };
  }
}

/**
 * Create a new appointment
 *
 * Routes creation through the backend server (POST /api/appointments/create)
 * which uses the Supabase admin client to bypass RLS policies.
 * This ensures the business owner is never blocked by permission checks.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<ServiceResult<SupabaseAppointment>> {
  try {
    console.log('[AppointmentsService] createAppointment called with payload:', {
      business_id: input.business_id,
      client_id: input.client_id,
      store_id: input.store_id,
      staff_id: input.staff_id,
      start_at: input.start_at.toISOString(),
      end_at: input.end_at.toISOString(),
      duration_minutes: input.duration_minutes,
      amount: input.amount,
      currency: input.currency,
    });

    if (!input.business_id) {
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!input.client_id) {
      return { data: null, error: new Error('Client ID is required') };
    }

    if (!input.store_id) {
      return { data: null, error: new Error('Store ID is required') };
    }

    // Validate UUIDs before sending to backend
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(input.business_id)) {
      return { data: null, error: new Error('Invalid business ID format') };
    }
    if (!uuidRegex.test(input.client_id)) {
      return { data: null, error: new Error('Invalid client ID format') };
    }
    if (!uuidRegex.test(input.store_id)) {
      return { data: null, error: new Error('Invalid store ID format') };
    }
    if (input.staff_id && !uuidRegex.test(input.staff_id)) {
      input.staff_id = null;
    }
    if (input.promo_id && !uuidRegex.test(input.promo_id)) {
      input.promo_id = null;
    }

    const primaryServiceId = input.service_id ||
      (input.service_tags && input.service_tags.length > 0 ? input.service_tags[0] : null);

    // Get the auth token to pass to backend
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      return { data: null, error: new Error('Not authenticated. Please sign in and try again.') };
    }

    const backendUrl = getBackendUrl();
    const url = `${backendUrl}/api/appointments/create`;

    const requestBody: Record<string, unknown> = {
      business_id: input.business_id,
      client_id: input.client_id,
      store_id: input.store_id,
      start_at: input.start_at.toISOString(),
      end_at: input.end_at.toISOString(),
      duration_minutes: input.duration_minutes,
      service_id: primaryServiceId ?? null,
      staff_id: input.staff_id ?? null,
      title: input.title ?? null,
      notes: input.notes ?? null,
      amount: input.amount ?? 0,
      currency: input.currency ?? 'USD',
      promo_id: input.promo_id ?? null,
      service_tags: input.service_tags && input.service_tags.length > 0 ? input.service_tags : null,
      subtotal_cents: input.subtotal_cents ?? null,
      discount_cents: input.discount_cents ?? 0,
      total_cents: input.total_cents ?? null,
      gift_card_id: input.gift_card_id ?? null,
      gift_card_intent: input.gift_card_intent ?? (input.gift_card_id != null ? true : false),
      is_log_visit: input.is_log_visit === true,
      lifecycle_status: input.is_log_visit === true ? 'pending_confirmation' : null,
      appointment_date: input.appointment_date.toISOString(),
    };

    console.log('[AppointmentsService] Routing creation through backend to bypass RLS →', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await res.text();
    let json: { success: boolean; data?: SupabaseAppointment; error?: string; code?: string };
    try {
      json = JSON.parse(rawText) as { success: boolean; data?: SupabaseAppointment; error?: string; code?: string };
    } catch {
      console.error('[AppointmentsService] Non-JSON response from backend (status', res.status, '):', rawText.slice(0, 500));
      return {
        data: null,
        error: new Error(`Server returned an unexpected response (HTTP ${res.status}). Please try again.`),
      };
    }

    if (!res.ok || !json.success) {
      const errorMsg = json.error ?? `Server responded with status ${res.status}`;
      console.log('[AppointmentsService] Backend create error:', errorMsg, 'code:', json.code);

      // Map backend error messages to user-friendly messages
      let userMessage = errorMsg;
      if (json.code === '23503') {
        if (errorMsg.includes('staff_id')) {
          userMessage = 'Invalid staff member selected. Please select a different staff member or leave it as "Any".';
        } else if (errorMsg.includes('client_id')) {
          userMessage = 'The selected client could not be found. Please try selecting the client again.';
        } else if (errorMsg.includes('store_id')) {
          userMessage = 'The selected store could not be found. Please try selecting a different store.';
        } else if (errorMsg.includes('promo_id')) {
          userMessage = 'The selected promotion no longer exists. Please remove the promotion and try again.';
        } else {
          userMessage = 'A referenced record was not found. Please refresh and try again.';
        }
      } else if (json.code === '23505') {
        userMessage = 'This appointment time slot is already booked.';
      } else if (res.status === 403) {
        userMessage = 'You do not have permission to create appointments. Please check your account settings.';
      }

      return { data: null, error: new Error(userMessage) };
    }

    console.log('[AppointmentsService] Appointment created successfully via backend:', json.data?.id);
    return { data: json.data as SupabaseAppointment, error: null };
  } catch (err) {
    console.log('[AppointmentsService] Unexpected error in createAppointment:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create appointment'),
    };
  }
}

/**
 * Update an appointment
 */
export async function updateAppointment(
  appointmentId: string,
  updates: UpdateAppointmentInput
): Promise<ServiceResult<SupabaseAppointment>> {
  try {
    console.log('[AppointmentsService] updateAppointment called:', appointmentId, updates);

    const updateData: Record<string, unknown> = {};

    if (updates.staff_id !== undefined) {
      updateData.staff_id = updates.staff_id;
    }
    if (updates.start_at !== undefined) {
      updateData.start_at = updates.start_at.toISOString();
    }
    if (updates.end_at !== undefined) {
      updateData.end_at = updates.end_at.toISOString();
    }
    if (updates.duration_minutes !== undefined) {
      updateData.duration_minutes = updates.duration_minutes;
    }
    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }
    if (updates.amount !== undefined) {
      updateData.amount = updates.amount;
    }
    if (updates.currency !== undefined) {
      updateData.currency = updates.currency;
    }
    if (updates.promo_id !== undefined) {
      updateData.promo_id = updates.promo_id;
    }
    if (updates.gift_card_id !== undefined) {
      updateData.gift_card_id = updates.gift_card_id;
    }
    if (updates.service_tags !== undefined) {
      updateData.service_tags = updates.service_tags.length > 0 ? updates.service_tags : null;
    }
    if (updates.subtotal_cents !== undefined) {
      updateData.subtotal_cents = updates.subtotal_cents;
    }
    if (updates.discount_cents !== undefined) {
      updateData.discount_cents = updates.discount_cents;
    }
    if (updates.total_cents !== undefined) {
      updateData.total_cents = updates.total_cents;
    }

    const { data, error } = await getSupabase()
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      console.log('[AppointmentsService] Error updating appointment:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Appointment updated:', data?.id);
    return { data: data as SupabaseAppointment, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update appointment'),
    };
  }
}

/**
 * Soft delete an appointment
 */
export async function deleteAppointment(appointmentId: string): Promise<ServiceResult<SupabaseAppointment>> {
  try {
    console.log('[AppointmentsService] deleteAppointment (soft) called:', appointmentId);

    const { data, error } = await getSupabase()
      .from('appointments')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      console.log('[AppointmentsService] Error deleting appointment:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Appointment soft deleted:', data?.id);
    return { data: data as SupabaseAppointment, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete appointment'),
    };
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(appointmentId: string): Promise<ServiceResult<SupabaseAppointment>> {
  try {
    console.log('[AppointmentsService] cancelAppointment called:', appointmentId);

    const { data, error } = await getSupabase()
      .from('appointments')
      .update({
        is_cancelled: true,
        lifecycle_status: 'cancelled',
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      console.log('[AppointmentsService] Error cancelling appointment:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Appointment cancelled:', data?.id);
    return { data: data as SupabaseAppointment, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to cancel appointment'),
    };
  }
}

/**
 * Restore a deleted or cancelled appointment
 */
export async function restoreAppointment(appointmentId: string): Promise<ServiceResult<SupabaseAppointment>> {
  try {
    console.log('[AppointmentsService] restoreAppointment called:', appointmentId);

    const { data, error } = await getSupabase()
      .from('appointments')
      .update({
        is_deleted: false,
        deleted_at: null,
        is_cancelled: false,
        cancelled_at: null,
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      console.log('[AppointmentsService] Error restoring appointment:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Appointment restored:', data?.id);
    return { data: data as SupabaseAppointment, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to restore appointment'),
    };
  }
}

/**
 * Permanently delete an appointment
 */
export async function hardDeleteAppointment(appointmentId: string): Promise<ServiceResult<null>> {
  try {
    console.log('[AppointmentsService] hardDeleteAppointment called:', appointmentId);

    const { error } = await getSupabase()
      .from('appointments')
      .delete()
      .eq('id', appointmentId);

    if (error) {
      console.log('[AppointmentsService] Error hard deleting appointment:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Appointment hard deleted:', appointmentId);
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete appointment'),
    };
  }
}

/**
 * Check for appointment conflicts
 */
export async function checkAppointmentConflict(
  businessId: string,
  storeId: string,
  staffId: string | null,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    console.log('[AppointmentsService] checkAppointmentConflict called:', {
      businessId,
      storeId,
      staffId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });

    let query = getSupabase()
      .from('appointments')
      .select('*')
      .eq('business_id', businessId)
      .eq('store_id', storeId)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .or('is_cancelled.eq.false,is_cancelled.is.null')
      // Check for overlapping time ranges
      .lt('start_at', endAt.toISOString())
      .gt('end_at', startAt.toISOString());

    // If staff is specified, only check conflicts for that staff
    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    // Exclude the current appointment if editing
    if (excludeAppointmentId) {
      query = query.neq('id', excludeAppointmentId);
    }

    const { data, error } = await query;

    if (error) {
      console.log('[AppointmentsService] Error checking conflicts:', error.message);
      return { data: null, error };
    }

    console.log('[AppointmentsService] Conflicts found:', data?.length ?? 0);
    return { data: data as SupabaseAppointment[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to check conflicts'),
    };
  }
}

/**
 * Get appointments for a specific client
 * Uses proper relational fetching via FK constraints:
 * - appointments.store_id → stores.id
 * - appointments.staff_id → staff.id
 * - appointments.service_id → services.id
 */
export async function getClientAppointments(
  businessId: string,
  clientId: string
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    console.log('[AppointmentsService] getClientAppointments called:', { businessId, clientId });

    // Fetch core appointment data + appointment_services junction + service name join
    // Avoid complex FK-hint joins (store/staff) that can fail silently
    // if foreign key constraints aren't defined in PostgREST schema cache
    const { data, error } = await getSupabase()
      .from('appointments')
      .select(`
        *,
        services!appointments_service_id_fkey (
          id,
          name,
          price_cents,
          color
        ),
        appointment_services (
          service_id,
          promo_id
        ),
        gift_cards (
          id,
          code
        )
      `)
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('start_at', { ascending: false });

    if (error) {
      console.log('[AppointmentsService] Error fetching client appointments:', error.message, error.code, error.details);
      // If the is_deleted filter fails (column might not exist), retry without it
      if (error.message?.includes('is_deleted') || error.code === '42703') {
        console.log('[AppointmentsService] Retrying without is_deleted filter...');
        const { data: retryData, error: retryError } = await getSupabase()
          .from('appointments')
          .select(`*, services!appointments_service_id_fkey ( id, name, price_cents, color ), appointment_services ( service_id, promo_id ), gift_cards ( id, code )`)
          .eq('business_id', businessId)
          .eq('client_id', clientId)
          .order('start_at', { ascending: false });
        if (retryError) {
          console.log('[AppointmentsService] Retry also failed:', retryError.message);
          return { data: null, error: retryError };
        }
        console.log('[AppointmentsService] Retry fetched:', retryData?.length ?? 0, 'appointments');
        return { data: retryData as SupabaseAppointment[], error: null };
      }
      return { data: null, error };
    }

    console.log('[AppointmentsService] Client appointments fetched:', data?.length ?? 0);
    // Log first appointment's relational data for debugging
    if (data && data.length > 0) {
      const first = data[0] as Record<string, unknown>;
      console.log('[AppointmentsService] First appointment relational data:', {
        id: first.id,
        amount: first.amount,
        service_price: first.service_price,
        store_id: first.store_id,
        staff_id: first.staff_id,
        service_id: first.service_id,
        appointment_services: first.appointment_services,
      });
    }
    return { data: data as SupabaseAppointment[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch client appointments'),
    };
  }
}

// ============================================
// Recurring Appointment Series Operations
// ============================================

/**
 * Generate preview of recurring appointment occurrences
 * This does not create any appointments, just calculates dates
 */
export function generateSeriesPreview(
  input: CreateSeriesInput,
  storeHours?: { day_of_week: number; is_closed: boolean; open_time: string; close_time: string }[],
  blackoutDates?: string[],
  existingAppointments?: { start_at: string; end_at: string; staff_id: string | null }[]
): SeriesPreview {
  const occurrences: SeriesOccurrence[] = [];
  const startDate = new Date(input.start_date);
  const startTime = input.start_time;
  const duration = input.duration_minutes;

  // Calculate interval in days based on frequency
  let intervalDays: number;
  switch (input.frequency_type) {
    case 'weekly':
      intervalDays = 7;
      break;
    case 'biweekly':
      intervalDays = 14;
      break;
    case 'monthly':
      intervalDays = 30; // Approximate, will adjust per month
      break;
    case 'custom':
      intervalDays = (input.interval_value || 7) * 7; // Custom weeks
      break;
    default:
      intervalDays = 7;
  }

  // Determine how many occurrences to generate
  let maxOccurrences: number;
  let endDate: Date | null = null;

  if (input.end_type === 'occurrence_count' && input.occurrence_count) {
    maxOccurrences = input.occurrence_count;
  } else if (input.end_type === 'until_date' && input.end_date) {
    endDate = new Date(input.end_date);
    maxOccurrences = 52; // Max 1 year of occurrences
  } else {
    maxOccurrences = 10; // Default preview
  }

  let currentDate = new Date(startDate);
  let count = 0;
  let conflictCount = 0;

  while (count < maxOccurrences) {
    // Check if past end date
    if (endDate && currentDate > endDate) {
      break;
    }

    // Parse start time
    const [hours, minutes] = startTime.split(':').map(Number);
    const startAt = new Date(currentDate);
    startAt.setHours(hours, minutes, 0, 0);

    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + duration);

    // Check for conflicts
    let hasConflict = false;
    let conflictReason: string | undefined;

    // Check blackout dates
    const dateStr = currentDate.toISOString().split('T')[0];
    if (blackoutDates?.includes(dateStr)) {
      hasConflict = true;
      conflictReason = 'Store is closed (blackout date)';
    }

    // Check store hours
    if (!hasConflict && storeHours) {
      const dayOfWeek = currentDate.getDay();
      const dayHours = storeHours.find(h => h.day_of_week === dayOfWeek);
      if (!dayHours || dayHours.is_closed) {
        hasConflict = true;
        conflictReason = 'Store is closed on this day';
      }
    }

    // Check for double booking (staff conflicts)
    if (!hasConflict && existingAppointments && input.staff_id) {
      const staffConflict = existingAppointments.find(apt => {
        if (apt.staff_id !== input.staff_id) return false;
        const aptStart = new Date(apt.start_at);
        const aptEnd = new Date(apt.end_at);
        return startAt < aptEnd && endAt > aptStart;
      });
      if (staffConflict) {
        hasConflict = true;
        conflictReason = 'Staff has another appointment';
      }
    }

    if (hasConflict) {
      conflictCount++;
    }

    occurrences.push({
      date: new Date(currentDate),
      start_at: startAt,
      end_at: endAt,
      hasConflict,
      conflictReason,
    });

    count++;

    // Move to next occurrence
    if (input.frequency_type === 'monthly') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + intervalDays);
    }
  }

  return {
    occurrences,
    totalCount: occurrences.length,
    conflictCount,
  };
}

/**
 * Create a recurring appointment series
 */
export async function createAppointmentSeries(
  input: CreateSeriesInput
): Promise<ServiceResult<AppointmentSeries>> {
  try {
    console.log('[AppointmentsService] Creating appointment series:', input);

    const seriesData = {
      business_id: input.business_id,
      store_id: input.store_id,
      staff_id: input.staff_id || null,
      client_id: input.client_id,
      service_ids: input.service_ids,
      frequency_type: input.frequency_type,
      interval_value: input.interval_value || 1,
      start_date: input.start_date.toISOString().split('T')[0],
      end_type: input.end_type,
      end_date: input.end_date ? input.end_date.toISOString().split('T')[0] : null,
      occurrence_count: input.occurrence_count || null,
      start_time: input.start_time,
      duration_minutes: input.duration_minutes,
      amount: input.amount || 0,
      currency: input.currency || 'USD',
      notes: input.notes || null,
      timezone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      status: 'active',
    };

    const { data, error } = await getSupabase()
      .from('appointment_series')
      .insert(seriesData)
      .select()
      .single();

    if (error) {
      console.log('[AppointmentsService] Error creating series — full error:', JSON.stringify(error));
      return { data: null, error };
    }

    console.log('[AppointmentsService] Series created:', data.id);
    return { data: data as AppointmentSeries, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create appointment series'),
    };
  }
}

/**
 * Create appointments from a series (batch create all occurrences)
 */
export async function createAppointmentsFromSeries(
  series: AppointmentSeries,
  occurrences: SeriesOccurrence[],
  skipConflicts: boolean = true
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    console.log('[AppointmentsService] Creating appointments from series:', {
      seriesId: series.id,
      totalOccurrences: occurrences.length,
      skipConflicts,
    });

    // Filter out conflicts if requested
    const toCreate = skipConflicts
      ? occurrences.filter(o => !o.hasConflict)
      : occurrences;

    if (toCreate.length === 0) {
      return { data: [], error: null };
    }

    // The appointments table has a NOT NULL check constraint on service_id.
    // Pull the primary service from the series service_ids array.
    const primaryServiceId = series.service_ids && series.service_ids.length > 0
      ? series.service_ids[0]
      : null;

    // Build the insert payload — only include columns that exist in the schema.
    // Do NOT include service_tags (column may not exist / not needed here).
    const appointmentData = toCreate.map((occurrence, index) => ({
      business_id: series.business_id,
      store_id: series.store_id,
      staff_id: series.staff_id ?? null,
      client_id: series.client_id,
      service_id: primaryServiceId,           // Required by appointments_service_id_nn_chk
      start_at: occurrence.start_at.toISOString(),
      end_at: occurrence.end_at.toISOString(),
      duration_minutes: series.duration_minutes,
      amount: series.amount ?? 0,
      currency: series.currency ?? 'USD',
      notes: series.notes ?? null,
      series_id: series.id,
      series_occurrence_index: index + 1,     // 1-based occurrence index
      is_deleted: false,
      is_cancelled: false,
    }));

    console.log('[AppointmentsService] Batch insert payload sample (first row):', JSON.stringify(appointmentData[0]));

    const { data, error } = await getSupabase()
      .from('appointments')
      .insert(appointmentData)
      .select();

    if (error) {
      // Log full error object for diagnosis
      console.log('[AppointmentsService] Error creating appointments from series — full error:', JSON.stringify(error));
      console.log('[AppointmentsService] Error message:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);

      // Rollback: delete the series record so it doesn't become orphaned
      console.log('[AppointmentsService] Rolling back series insert:', series.id);
      const { error: rollbackError } = await getSupabase()
        .from('appointment_series')
        .delete()
        .eq('id', series.id);
      if (rollbackError) {
        console.log('[AppointmentsService] Rollback failed:', rollbackError.message);
      } else {
        console.log('[AppointmentsService] Series rolled back successfully.');
      }

      return { data: null, error };
    }

    console.log('[AppointmentsService] Created', data.length, 'appointments from series');
    return { data: data as SupabaseAppointment[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create appointments from series'),
    };
  }
}

/**
 * Get an appointment series by ID
 */
export async function getAppointmentSeries(
  seriesId: string
): Promise<ServiceResult<AppointmentSeries>> {
  try {
    const { data, error } = await getSupabase()
      .from('appointment_series')
      .select('*')
      .eq('id', seriesId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as AppointmentSeries, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch appointment series'),
    };
  }
}

/**
 * Get all appointments belonging to a series
 */
export async function getSeriesAppointments(
  seriesId: string
): Promise<ServiceResult<SupabaseAppointment[]>> {
  try {
    const { data, error } = await getSupabase()
      .from('appointments')
      .select('*')
      .eq('series_id', seriesId)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('start_at', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    return { data: data as SupabaseAppointment[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch series appointments'),
    };
  }
}

/**
 * Cancel remaining appointments in a series (from a specific appointment onward)
 */
export async function cancelSeriesFromAppointment(
  seriesId: string,
  fromAppointmentId: string,
  cancelAll: boolean = false
): Promise<ServiceResult<number>> {
  try {
    // First, get the appointment to find its index
    const { data: appointment, error: fetchError } = await getSupabase()
      .from('appointments')
      .select('series_occurrence_index, start_at')
      .eq('id', fromAppointmentId)
      .single();

    if (fetchError || !appointment) {
      return { data: null, error: fetchError || new Error('Appointment not found') };
    }

    let query = getSupabase()
      .from('appointments')
      .update({
        is_cancelled: true,
        cancelled_at: new Date().toISOString(),
      })
      .eq('series_id', seriesId)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .or('is_cancelled.eq.false,is_cancelled.is.null');

    // If not cancelling all, only cancel from this occurrence onward
    if (!cancelAll && appointment.series_occurrence_index) {
      query = query.gte('series_occurrence_index', appointment.series_occurrence_index);
    }

    const { error, count } = await query.select();

    if (error) {
      return { data: null, error };
    }

    // Update series status
    await getSupabase()
      .from('appointment_series')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', seriesId);

    return { data: count || 0, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to cancel series appointments'),
    };
  }
}

/**
 * Update future appointments in a series
 */
export async function updateSeriesFutureAppointments(
  seriesId: string,
  fromDate: Date,
  updates: Partial<UpdateAppointmentInput>
): Promise<ServiceResult<number>> {
  try {
    const { error, count } = await getSupabase()
      .from('appointments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('series_id', seriesId)
      .gte('start_at', fromDate.toISOString())
      .or('is_deleted.eq.false,is_deleted.is.null')
      .select();

    if (error) {
      return { data: null, error };
    }

    return { data: count || 0, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update series appointments'),
    };
  }
}

// ============================================
// Email Notifications
// ============================================

/**
 * Fire-and-forget: notify the backend to send an appointment email.
 * Never throws — email failure must never block the booking action.
 *
 * @param appointmentId  The Supabase appointment UUID
 * @param eventType      'created' | 'updated' | 'cancelled'
 */
export async function notifyAppointmentEmail(
  appointmentId: string,
  eventType: 'created' | 'updated' | 'cancelled',
  language?: string
): Promise<void> {
  try {
    const url = `${getBackendUrl()}/api/appointments/notify`;
    console.log(`[AppointmentsService] Notifying email: ${eventType} → ${appointmentId}`);
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ appointment_id: appointmentId, event_type: eventType, language: language ?? 'en' }),
    });
    if (!res.ok) {
      console.warn(`[AppointmentsService] Email notify responded ${res.status} for ${eventType}`);
    } else {
      const rawText = await res.text();
      let json: { success: boolean; skipped?: string; error?: string };
      try {
        json = JSON.parse(rawText) as { success: boolean; skipped?: string; error?: string };
      } catch {
        console.warn(`[AppointmentsService] Email notify non-JSON response for ${eventType}`);
        return;
      }
      if (json.skipped) {
        console.log(`[AppointmentsService] Email skipped (${json.skipped})`);
      } else if (!json.success) {
        console.warn(`[AppointmentsService] Email notify failed: ${json.error}`);
      } else {
        console.log(`[AppointmentsService] Email notify sent OK for ${eventType}`);
      }
    }
  } catch (err) {
    // Never throw — email failure is non-blocking
    console.warn('[AppointmentsService] Email notify error (non-blocking):', err);
  }
}

// ============================================
// Lifecycle Operations
// ============================================

interface LifecycleResult {
  success: boolean;
  lifecycle_status?: AppointmentLifecycleStatus;
  checked_in_at?: string;
  completed_at?: string;
  outcome_confirmed_at?: string;
  gift_card_debited?: boolean;
  error?: string;
}

/**
 * Check in an appointment (Scheduled → Checked-In).
 * Stores check_in_at timestamp. Once checked in, the appointment
 * will auto-complete when service duration ends.
 */
export async function checkInAppointment(
  appointmentId: string,
  authToken?: string
): Promise<ServiceResult<LifecycleResult>> {
  try {
    const url = `${getBackendUrl()}/api/appointments/check-in`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    console.log('[AppointmentsService] checkInAppointment → POST', url, 'appointmentId:', appointmentId);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ appointment_id: appointmentId }),
    });

    const rawText = await res.text();
    console.log('[AppointmentsService] checkInAppointment ← status:', res.status, 'body:', rawText.slice(0, 300));

    let json: LifecycleResult;
    try {
      json = JSON.parse(rawText) as LifecycleResult;
    } catch {
      console.error('[AppointmentsService] checkInAppointment non-JSON response (status', res.status, '):', rawText.slice(0, 500));
      return { data: null, error: new Error(`Server returned an unexpected response (HTTP ${res.status}). Please try again.`) };
    }

    if (!json.success) {
      return { data: null, error: new Error(json.error ?? 'Check-in failed') };
    }
    return { data: json, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Check-in request failed';
    console.error('[AppointmentsService] checkInAppointment error:', message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Complete an appointment (triggers revenue + optional gift card debit).
 * Only allowed from checked_in, scheduled, or pending_confirmation states.
 */
export async function completeAppointment(
  appointmentId: string,
  giftCardId?: string | null,
  authToken?: string
): Promise<ServiceResult<LifecycleResult>> {
  try {
    const url = `${getBackendUrl()}/api/appointments/complete`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ appointment_id: appointmentId, gift_card_id: giftCardId ?? null }),
    });
    const text = await res.text();
    let json: LifecycleResult;
    try {
      json = JSON.parse(text) as LifecycleResult;
    } catch {
      console.error('[AppointmentsService] completeAppointment non-JSON response:', res.status, text.slice(0, 200));
      return { data: null, error: new Error(`Server error (${res.status})`) };
    }
    if (!json.success) {
      return { data: null, error: new Error(json.error ?? 'Complete failed') };
    }
    return { data: json, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Complete request failed';
    console.error('[AppointmentsService] completeAppointment error:', message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Set appointment outcome: 'completed', 'no_show', or 'cancelled'.
 * Completed triggers revenue + gift card debit (if applicable).
 * No Show / Cancelled: no revenue, no gift card debit.
 */
export async function setAppointmentOutcome(
  appointmentId: string,
  outcome: 'completed' | 'no_show' | 'cancelled',
  giftCardId?: string | null,
  authToken?: string,
  debitGiftCard?: boolean,
  language?: string
): Promise<ServiceResult<LifecycleResult>> {
  try {
    const url = `${getBackendUrl()}/api/appointments/outcome`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        appointment_id: appointmentId,
        outcome,
        gift_card_id: giftCardId ?? null,
        debit_gift_card: debitGiftCard !== false,
        language: language ?? 'en',
      }),
    });
    const text = await res.text();
    let json: LifecycleResult;
    try {
      json = JSON.parse(text) as LifecycleResult;
    } catch {
      console.error('[AppointmentsService] setAppointmentOutcome non-JSON response:', res.status, text.slice(0, 200));
      return { data: null, error: new Error(`Server error (${res.status})`) };
    }
    if (!json.success) {
      return { data: null, error: new Error(json.error ?? 'Outcome update failed') };
    }
    return { data: json, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Outcome request failed';
    console.error('[AppointmentsService] setAppointmentOutcome error:', message);
    return { data: null, error: new Error(message) };
  }
}

/**
 * Transition overdue appointments:
 * - scheduled + past end_at → pending_confirmation
 * - checked_in + past end_at → completed (+ auto gift card debit)
 * Called periodically from the app (on focus, every few minutes).
 */
export async function transitionOverdueAppointments(
  _businessId?: string
): Promise<void> {
  try {
    const url = `${getBackendUrl()}/api/appointments/transition-overdue`;
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return; // Not logged in — skip silently
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch (err) {
    // Non-blocking background operation
    console.warn('[AppointmentsService] transitionOverdueAppointments error (non-blocking):', err);
  }
}
