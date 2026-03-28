/**
 * Business Hours Service
 *
 * Handles all Supabase operations for business hours.
 * All operations are scoped by business_id for multi-tenant security.
 *
 * The 'business_hours' table schema:
 *   - id (UUID)
 *   - business_id (UUID)
 *   - store_id (UUID nullable - null means primary/default hours)
 *   - day_of_week (INTEGER 0-6, 0=Sunday)
 *   - open_time (TIME, format '09:00')
 *   - close_time (TIME, format '17:00')
 *   - is_closed (BOOLEAN)
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface BusinessHours {
  id: string;
  business_id: string;
  store_id: string | null;
  day_of_week: number; // 0-6, where 0=Sunday
  open_time: string; // Format: 'HH:MM' e.g. '09:00'
  close_time: string; // Format: 'HH:MM' e.g. '17:00'
  is_closed: boolean;
}

export interface BusinessHoursInput {
  day_of_week: number; // 0-6, where 0=Sunday
  open_time: string; // Format: 'HH:MM' e.g. '09:00'
  close_time: string; // Format: 'HH:MM' e.g. '17:00'
  is_closed: boolean;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Business Hours Operations
// ============================================

/**
 * Get business hours for a business or specific store
 *
 * @param businessId - The business ID
 * @param storeId - Optional store ID. If null/undefined, returns default business hours (where store_id is null)
 * @returns Array of business hours for each day of the week
 */
export async function getBusinessHours(
  businessId: string,
  storeId?: string | null
): Promise<ServiceResult<BusinessHours[]>> {
  try {
    console.log('[BusinessHoursService] getBusinessHours called:', { businessId, storeId });

    if (!businessId) {
      console.log('[BusinessHoursService] ERROR: No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    let query = getSupabase()
      .from('business_hours')
      .select('*')
      .eq('business_id', businessId);

    // If storeId is explicitly provided (including null), filter by it
    // If storeId is undefined, get default hours (store_id is null)
    if (storeId === null || storeId === undefined) {
      query = query.is('store_id', null);
    } else {
      query = query.eq('store_id', storeId);
    }

    query = query.order('day_of_week', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.log('[BusinessHoursService] QUERY ERROR:', error.code, error.message, error.details);
      return { data: null, error };
    }

    console.log('[BusinessHoursService] SUCCESS: Fetched', data?.length ?? 0, 'business hours records');
    return { data: data as BusinessHours[], error: null };
  } catch (err) {
    console.log('[BusinessHoursService] UNEXPECTED ERROR:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch business hours'),
    };
  }
}

/**
 * Set business hours for all 7 days of the week
 * This will delete existing hours and insert new ones
 *
 * @param businessId - The business ID
 * @param hours - Array of 7 BusinessHoursInput objects, one for each day
 * @param storeId - Optional store ID. If null/undefined, sets default business hours
 * @returns Array of created business hours records
 */
export async function setBusinessHours(
  businessId: string,
  hours: BusinessHoursInput[],
  storeId?: string | null
): Promise<ServiceResult<BusinessHours[]>> {
  try {
    console.log('[BusinessHoursService] setBusinessHours called:', {
      businessId,
      storeId,
      hoursCount: hours.length,
    });

    if (!businessId) {
      console.log('[BusinessHoursService] ERROR: No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!hours || hours.length === 0) {
      console.log('[BusinessHoursService] ERROR: No hours provided');
      return { data: null, error: new Error('Hours data is required') };
    }

    // Validate that all days are within valid range (0-6)
    const invalidDays = hours.filter(h => h.day_of_week < 0 || h.day_of_week > 6);
    if (invalidDays.length > 0) {
      console.log('[BusinessHoursService] ERROR: Invalid day_of_week values:', invalidDays);
      return { data: null, error: new Error('day_of_week must be between 0 and 6') };
    }

    // Delete existing hours for this business/store combination
    console.log('[BusinessHoursService] Deleting existing hours...');
    let deleteQuery = getSupabase()
      .from('business_hours')
      .delete()
      .eq('business_id', businessId);

    if (storeId === null || storeId === undefined) {
      deleteQuery = deleteQuery.is('store_id', null);
    } else {
      deleteQuery = deleteQuery.eq('store_id', storeId);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.log('[BusinessHoursService] Error deleting existing hours:', deleteError.message);
      return { data: null, error: deleteError };
    }

    console.log('[BusinessHoursService] Existing hours deleted successfully');

    // Prepare records for insertion
    const recordsToInsert = hours.map(h => ({
      business_id: businessId,
      store_id: storeId ?? null,
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: h.is_closed,
    }));

    console.log('[BusinessHoursService] Inserting', recordsToInsert.length, 'hours records...');

    const { data, error } = await getSupabase()
      .from('business_hours')
      .insert(recordsToInsert)
      .select();

    if (error) {
      console.log('[BusinessHoursService] Error inserting hours:', error.message);
      return { data: null, error };
    }

    console.log('[BusinessHoursService] SUCCESS: Created', data?.length ?? 0, 'business hours records');
    return { data: data as BusinessHours[], error: null };
  } catch (err) {
    console.log('[BusinessHoursService] UNEXPECTED ERROR:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to set business hours'),
    };
  }
}

/**
 * Update hours for a single day of the week
 * If no record exists for that day, creates one
 *
 * @param businessId - The business ID
 * @param dayOfWeek - Day of week (0-6, 0=Sunday)
 * @param updates - Partial updates to apply
 * @param storeId - Optional store ID. If null/undefined, updates default business hours
 * @returns The updated/created business hours record
 */
export async function updateDayHours(
  businessId: string,
  dayOfWeek: number,
  updates: Partial<BusinessHoursInput>,
  storeId?: string | null
): Promise<ServiceResult<BusinessHours>> {
  try {
    console.log('[BusinessHoursService] updateDayHours called:', {
      businessId,
      dayOfWeek,
      storeId,
      updates,
    });

    if (!businessId) {
      console.log('[BusinessHoursService] ERROR: No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      console.log('[BusinessHoursService] ERROR: Invalid dayOfWeek:', dayOfWeek);
      return { data: null, error: new Error('day_of_week must be between 0 and 6') };
    }

    // First, check if a record exists for this day
    let selectQuery = getSupabase()
      .from('business_hours')
      .select('*')
      .eq('business_id', businessId)
      .eq('day_of_week', dayOfWeek);

    if (storeId === null || storeId === undefined) {
      selectQuery = selectQuery.is('store_id', null);
    } else {
      selectQuery = selectQuery.eq('store_id', storeId);
    }

    const { data: existingData, error: selectError } = await selectQuery.maybeSingle();

    if (selectError) {
      console.log('[BusinessHoursService] Error checking existing hours:', selectError.message);
      return { data: null, error: selectError };
    }

    if (existingData) {
      // Update existing record
      console.log('[BusinessHoursService] Updating existing record:', existingData.id);

      const updateData: Record<string, unknown> = {};
      if (updates.open_time !== undefined) updateData.open_time = updates.open_time;
      if (updates.close_time !== undefined) updateData.close_time = updates.close_time;
      if (updates.is_closed !== undefined) updateData.is_closed = updates.is_closed;

      const { data, error } = await getSupabase()
        .from('business_hours')
        .update(updateData)
        .eq('id', existingData.id)
        .select()
        .single();

      if (error) {
        console.log('[BusinessHoursService] Error updating hours:', error.message);
        return { data: null, error };
      }

      console.log('[BusinessHoursService] SUCCESS: Updated hours for day', dayOfWeek);
      return { data: data as BusinessHours, error: null };
    } else {
      // Create new record
      console.log('[BusinessHoursService] Creating new record for day:', dayOfWeek);

      const newRecord = {
        business_id: businessId,
        store_id: storeId ?? null,
        day_of_week: dayOfWeek,
        open_time: updates.open_time ?? '09:00',
        close_time: updates.close_time ?? '17:00',
        is_closed: updates.is_closed ?? false,
      };

      const { data, error } = await getSupabase()
        .from('business_hours')
        .insert(newRecord)
        .select()
        .single();

      if (error) {
        console.log('[BusinessHoursService] Error creating hours:', error.message);
        return { data: null, error };
      }

      console.log('[BusinessHoursService] SUCCESS: Created hours for day', dayOfWeek);
      return { data: data as BusinessHours, error: null };
    }
  } catch (err) {
    console.log('[BusinessHoursService] UNEXPECTED ERROR:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update day hours'),
    };
  }
}
