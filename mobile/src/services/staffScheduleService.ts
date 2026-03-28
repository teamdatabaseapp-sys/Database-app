/**
 * Staff Schedule Service
 *
 * Handles all Supabase operations for staff scheduling:
 * - Weekly schedule (7 days with start/end times and is_off toggle)
 * - Special days (single-date overrides)
 * - Blackout ranges (datetime ranges to block availability)
 *
 * Tables:
 * - staff_weekly_schedule: staff_id, business_id, day_of_week (0-6), start_time, end_time, is_off
 * - staff_special_days: staff_id, business_id, date, start_time, end_time, is_off, note
 * - staff_blackout_ranges: staff_id, business_id, start_at, end_at, note
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface StaffWeeklySchedule {
  id?: string;
  staff_id: string;
  business_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_off: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StaffSpecialDay {
  id: string;
  staff_id: string;
  business_id: string;
  date: string; // YYYY-MM-DD format
  start_time: string | null; // HH:MM format, null if is_off
  end_time: string | null; // HH:MM format, null if is_off
  is_off: boolean;
  note: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StaffBlackoutRange {
  id: string;
  staff_id: string;
  business_id: string;
  start_at: string; // ISO datetime
  end_at: string; // ISO datetime
  note: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklyScheduleInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_off: boolean;
}

export interface SpecialDayInput {
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_off: boolean;
  note?: string | null;
}

export interface BlackoutRangeInput {
  start_at: string;
  end_at: string;
  note?: string | null;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Weekly Schedule Operations
// ============================================

/**
 * Get weekly schedule for a staff member
 */
export async function getStaffWeeklySchedule(
  staffId: string,
  businessId: string
): Promise<ServiceResult<StaffWeeklySchedule[]>> {
  try {
    console.log('[StaffScheduleService] getStaffWeeklySchedule called:', { staffId, businessId });

    const { data, error } = await getSupabase()
      .from('staff_weekly_schedule')
      .select('*')
      .eq('staff_id', staffId)
      .eq('business_id', businessId)
      .order('day_of_week', { ascending: true });

    if (error) {
      // Table might not exist yet
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.log('[StaffScheduleService] Table staff_weekly_schedule does not exist yet');
        return { data: [], error: null };
      }
      console.log('[StaffScheduleService] Error fetching weekly schedule:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Weekly schedule fetched:', data?.length ?? 0, 'days');
    return { data: data as StaffWeeklySchedule[], error: null };
  } catch (err) {
    console.log('[StaffScheduleService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch weekly schedule'),
    };
  }
}

/**
 * Set/update weekly schedule for a staff member
 * Upserts all 7 days at once
 */
export async function setStaffWeeklySchedule(
  staffId: string,
  businessId: string,
  schedule: WeeklyScheduleInput[]
): Promise<ServiceResult<StaffWeeklySchedule[]>> {
  try {
    console.log('[StaffScheduleService] setStaffWeeklySchedule called:', { staffId, businessId, days: schedule.length });

    // Build upsert payload with all required fields
    const upsertData = schedule.map(day => ({
      staff_id: staffId,
      business_id: businessId,
      day_of_week: day.day_of_week,
      start_time: day.start_time,
      end_time: day.end_time,
      is_off: day.is_off,
    }));

    // Upsert using staff_id + day_of_week as conflict target
    const { data, error } = await getSupabase()
      .from('staff_weekly_schedule')
      .upsert(upsertData, {
        onConflict: 'staff_id,day_of_week',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.log('[StaffScheduleService] Error setting weekly schedule:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Weekly schedule saved:', data?.length ?? 0, 'days');
    return { data: data as StaffWeeklySchedule[], error: null };
  } catch (err) {
    console.log('[StaffScheduleService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to set weekly schedule'),
    };
  }
}

// ============================================
// Special Days Operations
// ============================================

/**
 * Get special days for a staff member
 */
export async function getStaffSpecialDays(
  staffId: string,
  businessId: string
): Promise<ServiceResult<StaffSpecialDay[]>> {
  try {
    console.log('[StaffScheduleService] getStaffSpecialDays called:', { staffId, businessId });

    const { data, error } = await getSupabase()
      .from('staff_special_days')
      .select('*')
      .eq('staff_id', staffId)
      .eq('business_id', businessId)
      .order('date', { ascending: true });

    if (error) {
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.log('[StaffScheduleService] Table staff_special_days does not exist yet');
        return { data: [], error: null };
      }
      console.log('[StaffScheduleService] Error fetching special days:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Special days fetched:', data?.length ?? 0);
    return { data: data as StaffSpecialDay[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch special days'),
    };
  }
}

/**
 * Add or update a special day for a staff member
 * Upserts by staff_id + date
 */
export async function upsertStaffSpecialDay(
  staffId: string,
  businessId: string,
  specialDay: SpecialDayInput
): Promise<ServiceResult<StaffSpecialDay>> {
  try {
    console.log('[StaffScheduleService] upsertStaffSpecialDay called:', { staffId, businessId, date: specialDay.date });

    const upsertData = {
      staff_id: staffId,
      business_id: businessId,
      date: specialDay.date,
      start_time: specialDay.is_off ? null : (specialDay.start_time || '09:00'),
      end_time: specialDay.is_off ? null : (specialDay.end_time || '17:00'),
      is_off: specialDay.is_off,
      note: specialDay.note || null,
    };

    const { data, error } = await getSupabase()
      .from('staff_special_days')
      .upsert(upsertData, {
        onConflict: 'staff_id,date',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.log('[StaffScheduleService] Error upserting special day:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Special day saved:', data?.id);
    return { data: data as StaffSpecialDay, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to save special day'),
    };
  }
}

/**
 * Delete a special day
 */
export async function deleteStaffSpecialDay(specialDayId: string): Promise<ServiceResult<null>> {
  try {
    console.log('[StaffScheduleService] deleteStaffSpecialDay called:', specialDayId);

    const { error } = await getSupabase()
      .from('staff_special_days')
      .delete()
      .eq('id', specialDayId);

    if (error) {
      console.log('[StaffScheduleService] Error deleting special day:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Special day deleted');
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete special day'),
    };
  }
}

// ============================================
// Blackout Ranges Operations
// ============================================

/**
 * Get blackout ranges for a staff member
 */
export async function getStaffBlackoutRanges(
  staffId: string,
  businessId: string
): Promise<ServiceResult<StaffBlackoutRange[]>> {
  try {
    console.log('[StaffScheduleService] getStaffBlackoutRanges called:', { staffId, businessId });

    const { data, error } = await getSupabase()
      .from('staff_blackout_ranges')
      .select('*')
      .eq('staff_id', staffId)
      .eq('business_id', businessId)
      .order('start_at', { ascending: true });

    if (error) {
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        console.log('[StaffScheduleService] Table staff_blackout_ranges does not exist yet');
        return { data: [], error: null };
      }
      console.log('[StaffScheduleService] Error fetching blackout ranges:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Blackout ranges fetched:', data?.length ?? 0);
    return { data: data as StaffBlackoutRange[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch blackout ranges'),
    };
  }
}

/**
 * Add a blackout range for a staff member
 */
export async function createStaffBlackoutRange(
  staffId: string,
  businessId: string,
  blackout: BlackoutRangeInput
): Promise<ServiceResult<StaffBlackoutRange>> {
  try {
    console.log('[StaffScheduleService] createStaffBlackoutRange called:', { staffId, businessId, blackout });

    const insertData = {
      staff_id: staffId,
      business_id: businessId,
      start_at: blackout.start_at,
      end_at: blackout.end_at,
      note: blackout.note || null,
    };

    const { data, error } = await getSupabase()
      .from('staff_blackout_ranges')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.log('[StaffScheduleService] Error creating blackout range:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Blackout range created:', data?.id);
    return { data: data as StaffBlackoutRange, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create blackout range'),
    };
  }
}

/**
 * Update a blackout range
 */
export async function updateStaffBlackoutRange(
  blackoutId: string,
  updates: Partial<BlackoutRangeInput>
): Promise<ServiceResult<StaffBlackoutRange>> {
  try {
    console.log('[StaffScheduleService] updateStaffBlackoutRange called:', { blackoutId, updates });

    const updateData: Record<string, unknown> = {};
    if (updates.start_at !== undefined) updateData.start_at = updates.start_at;
    if (updates.end_at !== undefined) updateData.end_at = updates.end_at;
    if (updates.note !== undefined) updateData.note = updates.note;

    const { data, error } = await getSupabase()
      .from('staff_blackout_ranges')
      .update(updateData)
      .eq('id', blackoutId)
      .select()
      .single();

    if (error) {
      console.log('[StaffScheduleService] Error updating blackout range:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Blackout range updated:', data?.id);
    return { data: data as StaffBlackoutRange, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update blackout range'),
    };
  }
}

/**
 * Delete a blackout range
 */
export async function deleteStaffBlackoutRange(blackoutId: string): Promise<ServiceResult<null>> {
  try {
    console.log('[StaffScheduleService] deleteStaffBlackoutRange called:', blackoutId);

    const { error } = await getSupabase()
      .from('staff_blackout_ranges')
      .delete()
      .eq('id', blackoutId);

    if (error) {
      console.log('[StaffScheduleService] Error deleting blackout range:', error.message);
      return { data: null, error };
    }

    console.log('[StaffScheduleService] Blackout range deleted');
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete blackout range'),
    };
  }
}

// ============================================
// Utility: Get all schedule data for a staff member
// ============================================

export interface StaffScheduleData {
  weeklySchedule: StaffWeeklySchedule[];
  specialDays: StaffSpecialDay[];
  blackoutRanges: StaffBlackoutRange[];
}

/**
 * Get all schedule data for a staff member (weekly, special days, blackouts)
 */
export async function getStaffScheduleData(
  staffId: string,
  businessId: string
): Promise<ServiceResult<StaffScheduleData>> {
  try {
    console.log('[StaffScheduleService] getStaffScheduleData called:', { staffId, businessId });

    // Fetch all three types in parallel
    const [weeklyResult, specialResult, blackoutResult] = await Promise.all([
      getStaffWeeklySchedule(staffId, businessId),
      getStaffSpecialDays(staffId, businessId),
      getStaffBlackoutRanges(staffId, businessId),
    ]);

    // Check for errors (non-table-not-found errors)
    if (weeklyResult.error && !weeklyResult.error.message?.includes('does not exist')) {
      return { data: null, error: weeklyResult.error };
    }
    if (specialResult.error && !specialResult.error.message?.includes('does not exist')) {
      return { data: null, error: specialResult.error };
    }
    if (blackoutResult.error && !blackoutResult.error.message?.includes('does not exist')) {
      return { data: null, error: blackoutResult.error };
    }

    const scheduleData: StaffScheduleData = {
      weeklySchedule: weeklyResult.data || [],
      specialDays: specialResult.data || [],
      blackoutRanges: blackoutResult.data || [],
    };

    console.log('[StaffScheduleService] Schedule data fetched:', {
      weekly: scheduleData.weeklySchedule.length,
      special: scheduleData.specialDays.length,
      blackouts: scheduleData.blackoutRanges.length,
    });

    return { data: scheduleData, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch schedule data'),
    };
  }
}
