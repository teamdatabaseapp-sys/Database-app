import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export type TimeOffType = 'days_off' | 'sick' | 'vacation';

export interface StaffTimeOff {
  id: string;
  business_id: string;
  staff_id: string;
  type: TimeOffType;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  note?: string | null;
  created_at?: string;
}

export interface CreateTimeOffInput {
  staff_id: string;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  note?: string | null;
}

// ============================================
// Service Functions
// ============================================

/**
 * Fetch all time off entries for a staff member within a date range.
 */
export async function getStaffTimeOff(
  businessId: string,
  staffId: string,
  fromDate?: string,
  toDate?: string,
): Promise<StaffTimeOff[]> {
  let query = getSupabase()
    .from('staff_time_off')
    .select('*')
    .eq('business_id', businessId)
    .eq('staff_id', staffId)
    .order('start_date', { ascending: false });

  if (fromDate) query = query.gte('end_date', fromDate);
  if (toDate) query = query.lte('start_date', toDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StaffTimeOff[];
}

/**
 * Fetch all time off entries for all staff in a business (for calendar view).
 */
export async function getBusinessTimeOff(
  businessId: string,
  fromDate?: string,
  toDate?: string,
): Promise<StaffTimeOff[]> {
  let query = getSupabase()
    .from('staff_time_off')
    .select('*')
    .eq('business_id', businessId)
    .order('start_date', { ascending: false });

  if (fromDate) query = query.gte('end_date', fromDate);
  if (toDate) query = query.lte('start_date', toDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StaffTimeOff[];
}

/**
 * Create a new time off entry.
 */
export async function createTimeOff(
  businessId: string,
  input: CreateTimeOffInput,
): Promise<StaffTimeOff> {
  const { data, error } = await getSupabase()
    .from('staff_time_off')
    .insert({
      business_id: businessId,
      staff_id: input.staff_id,
      type: input.type,
      start_date: input.start_date,
      end_date: input.end_date,
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as StaffTimeOff;
}

/**
 * Delete a time off entry.
 */
export async function deleteTimeOff(id: string, businessId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('staff_time_off')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) throw error;
}

/**
 * Check if a staff member has time off on a specific date.
 */
export function hasTimeOffOnDate(
  timeOffList: StaffTimeOff[],
  staffId: string,
  date: string, // YYYY-MM-DD
): StaffTimeOff | undefined {
  return timeOffList.find(
    t =>
      t.staff_id === staffId &&
      t.start_date <= date &&
      t.end_date >= date,
  );
}

/**
 * Check if a date string (YYYY-MM-DD) falls within any time off entry for a staff.
 */
export function isDateTimeOff(
  timeOffList: StaffTimeOff[],
  staffId: string,
  dateISO: string,
): boolean {
  return timeOffList.some(
    t => t.staff_id === staffId && t.start_date <= dateISO && t.end_date >= dateISO,
  );
}
