import { getSupabase } from '@/lib/supabaseClient';
import { getStaffForStore, type StaffMemberWithAssignments } from './staffService';

// ============================================
// Types
// ============================================

export interface StaffCalendarShift {
  id: string;
  business_id: string;
  store_id: string;
  staff_id: string;
  week_start_date: string; // YYYY-MM-DD (Monday)
  day_of_week: number; // 0=Monday, 6=Sunday
  shift_start: string; // HH:MM
  shift_end: string; // HH:MM
  break_start?: string | null;
  break_end?: string | null;
  notes?: string | null;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StaffForCalendar {
  id: string;
  name: string;
  email?: string | null;
  photo_url?: string | null;
  color: string;
  is_active: boolean;
}

export interface StoreForCalendar {
  id: string;
  name: string;
}

export interface StaffCalendarData {
  shifts: StaffCalendarShift[];
  staff: StaffForCalendar[];
  store: StoreForCalendar;
  week_start_date: string;
}

export interface ShiftInput {
  staff_id: string;
  day_of_week: number;
  shift_start: string;
  shift_end: string;
  break_start?: string | null;
  break_end?: string | null;
  notes?: string | null;
  color?: string | null;
}

export interface UpsertShiftsResult {
  success: boolean;
  created?: number;
  updated?: number;
  week_start_date?: string;
  error?: string;
}

export interface CalendarSummary {
  business_name: string;
  store_name: string;
  week_start_date: string;
  week_end_date: string;
  schedule: Array<{
    staff_id: string;
    staff_name: string;
    staff_email?: string | null;
    shifts: Array<{
      day_of_week: number;
      day_name: string;
      shift_start: string;
      shift_end: string;
    }>;
  }>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get Monday of the week containing the given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Convert Sunday=0 to Monday=0 system
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get day name from day_of_week (0=Monday)
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayOfWeek] || '';
}

/**
 * Get short day name from day_of_week (0=Monday)
 */
export function getShortDayName(dayOfWeek: number): string {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[dayOfWeek] || '';
}

/**
 * Format time from HH:MM:SS to HH:MM AM/PM
 */
export function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format time range
 */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

// ============================================
// API Functions
// ============================================

/**
 * Get shifts for a specific week and store
 *
 * IMPORTANT: Uses getStaffForStore() as the source of truth for staff-store
 * assignments. This ensures Staff Calendar shows the SAME staff as Settings.
 * The RPC only provides shifts; we override its staff list with the authoritative
 * source from staffService which checks:
 *   1. store_staff table (staff_id + store_id)
 *   2. staff_store_assignments table (user_id OR staff_id + store_id)
 */
export async function getStaffCalendarShifts(
  businessId: string,
  storeId: string,
  weekStartDate: Date
): Promise<StaffCalendarData> {
  const dateStr = formatDateISO(getWeekStart(weekStartDate));

  // Fetch shifts from RPC
  const { data, error } = await getSupabase().rpc('get_staff_calendar_shifts', {
    p_business_id: businessId,
    p_store_id: storeId,
    p_week_start_date: dateStr,
  });

  if (error) {
    console.error('[StaffCalendar] Error fetching shifts:', error);
    throw error;
  }

  const rpcResult = data as StaffCalendarData;

  // CRITICAL FIX: Always use getStaffForStore() as the authoritative source
  // for staff-store assignments. This is the same function used by Settings.
  console.log('[StaffCalendar] Fetching staff using staffService.getStaffForStore (same as Settings)');
  const staffResult = await getStaffForStore(businessId, storeId);

  if (staffResult.error) {
    console.error('[StaffCalendar] Error fetching staff from staffService:', staffResult.error);
    // Fall back to RPC staff if staffService fails
    return rpcResult;
  }

  // Map StaffMemberWithAssignments to StaffForCalendar format
  const staffForCalendar: StaffForCalendar[] = (staffResult.data || []).map(
    (staff: StaffMemberWithAssignments) => ({
      id: staff.id,
      name: staff.name || staff.full_name || 'Unnamed',
      email: staff.email,
      photo_url: staff.photo_url || staff.avatar_url,
      color: staff.color || '#0D9488',
      is_active: staff.is_active,
    })
  );

  console.log('[StaffCalendar] Staff from staffService:', staffForCalendar.length, 'members');
  console.log('[StaffCalendar] Staff IDs:', staffForCalendar.map(s => s.id));

  // Return RPC shifts with authoritative staff list from staffService
  return {
    ...rpcResult,
    staff: staffForCalendar,
  };
}

/**
 * Upsert shifts (batch create/update)
 * Note: shifts[].staff_id must be a valid public.staff.id (NOT auth.users.id)
 */
export async function upsertStaffCalendarShifts(
  businessId: string,
  storeId: string,
  weekStartDate: Date,
  shifts: ShiftInput[]
): Promise<UpsertShiftsResult> {
  const dateStr = formatDateISO(getWeekStart(weekStartDate));

  console.log('[StaffCalendar] Upserting shifts:', {
    businessId,
    storeId,
    weekStartDate: dateStr,
    shiftsCount: shifts.length,
    shifts: shifts.map(s => ({
      staff_id: s.staff_id,
      day_of_week: s.day_of_week,
      shift_start: s.shift_start,
      shift_end: s.shift_end,
    })),
  });

  const { data, error } = await getSupabase().rpc('upsert_staff_calendar_shifts', {
    p_business_id: businessId,
    p_store_id: storeId,
    p_week_start_date: dateStr,
    p_shifts: shifts,
  });

  if (error) {
    console.error('[StaffCalendar] Error upserting shifts:', error);
    throw error;
  }

  console.log('[StaffCalendar] Upsert result:', data);
  return data as UpsertShiftsResult;
}

/**
 * Delete a single shift
 */
export async function deleteStaffCalendarShift(shiftId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await getSupabase().rpc('delete_staff_calendar_shift', {
    p_shift_id: shiftId,
  });

  if (error) {
    console.error('[StaffCalendar] Error deleting shift:', error);
    throw error;
  }

  return data as { success: boolean; error?: string };
}

/**
 * Copy shifts from one week to another
 */
export async function copyWeekShifts(
  businessId: string,
  storeId: string,
  sourceWeek: Date,
  targetWeek: Date
): Promise<{ success: boolean; copied?: number; error?: string }> {
  const { data, error } = await getSupabase().rpc('copy_staff_calendar_week', {
    p_business_id: businessId,
    p_store_id: storeId,
    p_source_week: formatDateISO(getWeekStart(sourceWeek)),
    p_target_week: formatDateISO(getWeekStart(targetWeek)),
  });

  if (error) {
    console.error('[StaffCalendar] Error copying week:', error);
    throw error;
  }

  return data as { success: boolean; copied?: number; error?: string };
}

/**
 * Returns true if the business has at least one staff calendar shift configured.
 * Used by Business Setup to determine if the staffCalendar step is complete.
 */
export async function hasStaffCalendarShifts(businessId: string): Promise<boolean> {
  const { count, error } = await getSupabase()
    .from('staff_calendar_shifts')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);

  if (error) {
    console.error('[StaffCalendar] Error checking shift count:', error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Apply default weekly schedule to a specific week
 */
export async function applyDefaultSchedule(
  businessId: string,
  storeId: string,
  staffId: string,
  weekStartDate: Date
): Promise<{ success: boolean; applied?: number; error?: string }> {
  const { data, error } = await getSupabase().rpc('apply_default_schedule_to_week', {
    p_business_id: businessId,
    p_store_id: storeId,
    p_staff_id: staffId,
    p_week_start_date: formatDateISO(getWeekStart(weekStartDate)),
  });

  if (error) {
    console.error('[StaffCalendar] Error applying defaults:', error);
    throw error;
  }

  return data as { success: boolean; applied?: number; error?: string };
}

/**
 * Get calendar summary for sharing
 */
export async function getCalendarSummary(
  businessId: string,
  storeId: string,
  weekStartDate: Date,
  staffIds?: string[]
): Promise<CalendarSummary> {
  const { data, error } = await getSupabase().rpc('get_staff_calendar_summary', {
    p_business_id: businessId,
    p_store_id: storeId,
    p_week_start_date: formatDateISO(getWeekStart(weekStartDate)),
    p_staff_ids: staffIds || null,
  });

  if (error) {
    console.error('[StaffCalendar] Error getting summary:', error);
    throw error;
  }

  return data as CalendarSummary;
}

/**
 * Format summary as plain text for sharing
 */
export function formatSummaryAsText(summary: CalendarSummary): string {
  const weekStart = new Date(summary.week_start_date);
  const weekEnd = new Date(summary.week_end_date);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  let text = `📅 ${summary.business_name} - ${summary.store_name}\n`;
  text += `Week of ${formatDate(weekStart)} - ${formatDate(weekEnd)}\n\n`;

  for (const staff of summary.schedule) {
    text += `👤 ${staff.staff_name}\n`;
    if (staff.shifts.length === 0) {
      text += `   No shifts scheduled\n`;
    } else {
      for (const shift of staff.shifts) {
        text += `   ${shift.day_name}: ${formatTime(shift.shift_start)} - ${formatTime(shift.shift_end)}\n`;
      }
    }
    text += '\n';
  }

  return text;
}

/**
 * Format summary as HTML for email
 */
export function formatSummaryAsHTML(summary: CalendarSummary): string {
  const weekStart = new Date(summary.week_start_date);
  const weekEnd = new Date(summary.week_end_date);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header p { margin: 0; opacity: 0.9; }
    .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
    .staff-card { background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .staff-name { font-weight: 600; font-size: 16px; margin-bottom: 12px; color: #374151; }
    .shift-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .shift-row:last-child { border-bottom: none; }
    .day-name { color: #6b7280; }
    .shift-time { font-weight: 500; color: #1f2937; }
    .no-shifts { color: #9ca3af; font-style: italic; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${summary.business_name}</h1>
      <p>${summary.store_name} • Week of ${formatDate(weekStart)} - ${formatDate(weekEnd)}</p>
    </div>
    <div class="content">
`;

  for (const staff of summary.schedule) {
    html += `
      <div class="staff-card">
        <div class="staff-name">${staff.staff_name}</div>
`;
    if (staff.shifts.length === 0) {
      html += `<div class="no-shifts">No shifts scheduled</div>`;
    } else {
      for (const shift of staff.shifts) {
        html += `
        <div class="shift-row">
          <span class="day-name">${shift.day_name}</span>
          <span class="shift-time">${formatTime(shift.shift_start)} - ${formatTime(shift.shift_end)}</span>
        </div>
`;
      }
    }
    html += `</div>`;
  }

  html += `
    </div>
    <div class="footer">
      Sent from ${summary.business_name}
    </div>
  </div>
</body>
</html>
`;

  return html;
}
