/**
 * Staff Service
 *
 * Handles all Supabase operations for staff members.
 * Uses the 'staff' table with store_ids array column for store assignments.
 * All operations are scoped by business_id for multi-tenant security.
 *
 * NOTE: The 'staff' table uses:
 *   - 'name' (not 'full_name')
 *   - 'is_active' (not 'is_archived', and it's inverted - true = active, false = archived)
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface SupabaseStaffMember {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
  color: string;
  is_active: boolean;
  store_ids: string[];
  service_ids: string[];
  created_at: string;
}

export interface StaffMemberWithAssignments extends SupabaseStaffMember {
  full_name: string; // Alias for compatibility
  is_archived: boolean; // Computed from is_active
}

export interface CreateStaffInput {
  business_id: string;
  full_name: string; // Will be mapped to 'name'
  email?: string;
  photo_url?: string;
  avatar_url?: string;
  avatar_thumb_url?: string;
  color?: string;
  store_ids?: string[];
  service_ids?: string[];
}

export interface UpdateStaffInput {
  full_name?: string; // Will be mapped to 'name'
  email?: string;
  photo_url?: string | null;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  color?: string;
  is_archived?: boolean; // Will be mapped to is_active (inverted)
  store_ids?: string[];
  service_ids?: string[];
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Helper to map DB row to StaffMemberWithAssignments
// ============================================
function mapStaffRow(staff: Record<string, unknown>): StaffMemberWithAssignments {
  return {
    id: staff.id as string,
    business_id: staff.business_id as string,
    name: (staff.name as string) || '',
    full_name: (staff.name as string) || '', // Alias
    email: (staff.email as string) || null,
    photo_url: (staff.photo_url as string) || null,
    avatar_url: (staff.avatar_url as string) || (staff.photo_url as string) || null,
    avatar_thumb_url: (staff.avatar_thumb_url as string) || null,
    color: (staff.color as string) || '#0D9488',
    is_active: staff.is_active !== false, // Default to true
    is_archived: staff.is_active === false, // Computed inverse
    store_ids: (staff.store_ids as string[]) || [],
    service_ids: (staff.service_ids as string[]) || [],
    created_at: (staff.created_at as string) || new Date().toISOString(),
  };
}

// ============================================
// Staff Member Operations
// ============================================

/**
 * Get all staff members for a business
 * Fetches staff and their store assignments from the store_staff junction table
 */
export async function getStaffMembers(businessId: string): Promise<ServiceResult<StaffMemberWithAssignments[]>> {
  try {
    console.log('[StaffService] getStaffMembers called for business:', businessId);

    if (!businessId) {
      console.log('[StaffService] No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    // Fetch staff members
    const { data: staffData, error: staffError } = await getSupabase()
      .from('staff')
      .select('id, business_id, name, email, photo_url, avatar_url, avatar_thumb_url, color, is_active, created_at')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (staffError) {
      console.log('[StaffService] Error fetching staff:', staffError.message);
      return { data: null, error: staffError };
    }

    // Fetch store assignments from BOTH junction tables for compatibility
    let storeAssignments: { staff_id: string; store_id: string }[] = [];

    // Try store_staff first
    const { data: storeStaffData, error: storeStaffError } = await getSupabase()
      .from('store_staff')
      .select('staff_id, store_id')
      .eq('business_id', businessId);

    if (!storeStaffError && storeStaffData) {
      storeAssignments = storeStaffData;
      console.log('[StaffService] Got assignments from store_staff:', storeStaffData.length);
    }

    // Also try staff_store_assignments (may use user_id or staff_id column)
    const { data: staffStoreData, error: staffStoreError } = await getSupabase()
      .from('staff_store_assignments')
      .select('user_id, staff_id, store_id, is_active')
      .eq('business_id', businessId);

    if (!staffStoreError && staffStoreData) {
      // Merge assignments, using user_id or staff_id
      const additionalAssignments = staffStoreData
        .filter((a: { is_active?: boolean }) => a.is_active !== false)
        .map((a: { user_id?: string; staff_id?: string; store_id: string }) => ({
          staff_id: a.user_id || a.staff_id || '',
          store_id: a.store_id,
        }))
        .filter((a: { staff_id: string }) => a.staff_id);

      // Combine with existing, avoiding duplicates
      const existingKeys = new Set(storeAssignments.map(a => `${a.staff_id}-${a.store_id}`));
      additionalAssignments.forEach((a: { staff_id: string; store_id: string }) => {
        const key = `${a.staff_id}-${a.store_id}`;
        if (!existingKeys.has(key)) {
          storeAssignments.push(a);
          existingKeys.add(key);
        }
      });
      console.log('[StaffService] Got assignments from staff_store_assignments:', staffStoreData.length);
    }

    // Fetch service assignments from junction table
    // Note: staff_services table does NOT have a business_id column
    // We need to filter by staff_id instead (staff are already filtered by business_id)
    const staffIds = (staffData || []).map(s => s.id);
    let serviceAssignments: { staff_id: string; service_id: string }[] = [];

    if (staffIds.length > 0) {
      const { data: serviceData, error: serviceAssignError } = await getSupabase()
        .from('staff_services')
        .select('staff_id, service_id')
        .in('staff_id', staffIds);

      if (serviceAssignError) {
        console.log('[StaffService] Error fetching service assignments:', serviceAssignError.message);
        // Continue without assignments
      } else {
        serviceAssignments = serviceData || [];
      }
    }

    // Build a map of staff_id -> store_ids
    const storeMap = new Map<string, string[]>();
    (storeAssignments || []).forEach(assignment => {
      const staffId = assignment.staff_id;
      if (!storeMap.has(staffId)) {
        storeMap.set(staffId, []);
      }
      storeMap.get(staffId)!.push(assignment.store_id);
    });

    // Build a map of staff_id -> service_ids
    const serviceMap = new Map<string, string[]>();
    (serviceAssignments || []).forEach(assignment => {
      const staffId = assignment.staff_id;
      if (!serviceMap.has(staffId)) {
        serviceMap.set(staffId, []);
      }
      serviceMap.get(staffId)!.push(assignment.service_id);
    });

    // Map staff data with assignments
    const staffWithAssignments = (staffData || []).map(staff => {
      const mapped = mapStaffRow(staff);
      mapped.store_ids = storeMap.get(staff.id) || [];
      mapped.service_ids = serviceMap.get(staff.id) || [];
      return mapped;
    });

    console.log('[StaffService] Staff fetched:', staffWithAssignments.length);
    // Debug: log each staff member's store assignments
    staffWithAssignments.forEach(s => {
      console.log(`[StaffService] Staff "${s.name}" (${s.id}): store_ids =`, s.store_ids);
    });
    return { data: staffWithAssignments, error: null };
  } catch (err) {
    console.log('[StaffService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch staff'),
    };
  }
}

/**
 * Get staff members assigned to a specific store
 * Uses BOTH store_staff AND staff_store_assignments junction tables
 */
export async function getStaffForStore(
  businessId: string,
  storeId: string
): Promise<ServiceResult<StaffMemberWithAssignments[]>> {
  try {
    console.log('[StaffService] getStaffForStore called:', { businessId, storeId });

    if (!businessId || !storeId) {
      return { data: null, error: new Error('Business ID and Store ID are required') };
    }

    // Get staff IDs from BOTH junction tables
    const staffIdSet = new Set<string>();

    // Try store_staff
    const { data: storeStaffData } = await getSupabase()
      .from('store_staff')
      .select('staff_id')
      .eq('business_id', businessId)
      .eq('store_id', storeId);

    if (storeStaffData) {
      storeStaffData.forEach((a: { staff_id: string }) => staffIdSet.add(a.staff_id));
      console.log('[StaffService] Found', storeStaffData.length, 'from store_staff');
    }

    // Also try staff_store_assignments (may use user_id or staff_id)
    const { data: staffStoreData } = await getSupabase()
      .from('staff_store_assignments')
      .select('user_id, staff_id, is_active')
      .eq('business_id', businessId)
      .eq('store_id', storeId);

    if (staffStoreData) {
      staffStoreData
        .filter((a: { is_active?: boolean }) => a.is_active !== false)
        .forEach((a: { user_id?: string; staff_id?: string }) => {
          const id = a.user_id || a.staff_id;
          if (id) staffIdSet.add(id);
        });
      console.log('[StaffService] Found', staffStoreData.length, 'from staff_store_assignments');
    }

    const staffIds = Array.from(staffIdSet);
    console.log('[StaffService] Total unique staff IDs for store:', staffIds.length);

    if (staffIds.length === 0) {
      console.log('[StaffService] No staff assigned to store');
      return { data: [], error: null };
    }

    // Fetch staff members by IDs
    const { data: staffData, error: staffError } = await getSupabase()
      .from('staff')
      .select('id, business_id, name, email, photo_url, avatar_url, avatar_thumb_url, color, is_active, created_at')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .in('id', staffIds);

    if (staffError) {
      console.log('[StaffService] Error fetching staff for store:', staffError.message);
      return { data: null, error: staffError };
    }

    // Also fetch all store assignments to populate store_ids
    const { data: allStoreAssignments } = await getSupabase()
      .from('store_staff')
      .select('staff_id, store_id')
      .eq('business_id', businessId);

    // Build a map of staff_id -> store_ids
    const storeMap = new Map<string, string[]>();
    (allStoreAssignments || []).forEach(assignment => {
      const staffId = assignment.staff_id;
      if (!storeMap.has(staffId)) {
        storeMap.set(staffId, []);
      }
      storeMap.get(staffId)!.push(assignment.store_id);
    });

    const staffWithAssignments = (staffData || []).map(staff => {
      const mapped = mapStaffRow(staff);
      mapped.store_ids = storeMap.get(staff.id) || [];
      return mapped;
    });

    console.log('[StaffService] Staff for store fetched:', staffWithAssignments.length);
    return { data: staffWithAssignments, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch staff for store'),
    };
  }
}

/**
 * Get a single staff member by ID
 */
export async function getStaffMember(staffId: string): Promise<ServiceResult<StaffMemberWithAssignments>> {
  try {
    console.log('[StaffService] getStaffMember called for id:', staffId);

    const { data: staffData, error: staffError } = await getSupabase()
      .from('staff')
      .select('id, business_id, name, email, photo_url, avatar_url, avatar_thumb_url, color, is_active, created_at')
      .eq('id', staffId)
      .single();

    if (staffError) {
      console.log('[StaffService] Error fetching staff member:', staffError.message);
      return { data: null, error: staffError };
    }

    console.log('[StaffService] Staff member fetched:', staffData?.id);
    return {
      data: mapStaffRow(staffData),
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch staff member'),
    };
  }
}

/**
 * Create a new staff member
 * Creates staff record first, then inserts store assignments into store_staff junction table
 */

// ─── Internal helper ────────────────────────────────────────────────────────
/**
 * Initialize staff_weekly_schedule for a new staff member.
 *
 * Priority:
 *   1. Copy from the first assigned store's business_hours (store-specific rows).
 *   2. If none, copy from business-wide defaults (business_hours WHERE store_id IS NULL).
 *   3. If neither exists, apply a safe structural fallback:
 *        - day_of_week 0 (Sunday)    → is_off = true
 *        - day_of_week 1–6 (Mon–Sat) → start_time = '10:00', end_time = '17:00', is_off = false
 *
 * IMPORTANT — Austin-type bug prevention:
 *   The RPC distinguishes two states:
 *     - Staff has ZERO schedule rows  → v_staff_has_any_schedule = FALSE → uses store hours (safe)
 *     - Staff has SOME rows, day missing → that day treated as "staff is OFF" (partial = broken)
 *   This function always writes ALL 7 days so the staff member is never in the partial state.
 *   Template rows are mapped for all 7 days. If the template is missing days (e.g. only 5),
 *   missing days are filled with the structural fallback values.
 *
 * day_of_week convention: Postgres DOW — 0 = Sunday, 1 = Monday … 6 = Saturday.
 * Confirmed from: staff_weekly_schedule UNIQUE(staff_id, day_of_week) constraint.
 *
 * Uses upsert on (staff_id, day_of_week) — fully idempotent.
 * Failures are logged as WARNING and do NOT propagate (staff creation succeeds).
 * On failure: staff has zero schedule rows → RPC uses store hours as fallback → safe.
 */
async function initStaffWeeklySchedule(staffId: string, businessId: string, storeIds: string[]): Promise<void> {
  // Structural fallback row values (day 0 = Sunday off, days 1-6 = Mon-Sat 10-5)
  const FALLBACK: Record<number, { start_time: string; end_time: string; is_off: boolean }> = {
    0: { start_time: '10:00', end_time: '17:00', is_off: true  },
    1: { start_time: '10:00', end_time: '17:00', is_off: false },
    2: { start_time: '10:00', end_time: '17:00', is_off: false },
    3: { start_time: '10:00', end_time: '17:00', is_off: false },
    4: { start_time: '10:00', end_time: '17:00', is_off: false },
    5: { start_time: '10:00', end_time: '17:00', is_off: false },
    6: { start_time: '10:00', end_time: '17:00', is_off: false },
  };

  type HoursTemplate = { day_of_week: number; open_time: string; close_time: string; is_closed: boolean };
  let template: HoursTemplate[] | null = null;

  // ── Step 1: Try store-specific hours ────────────────────────────────────
  if (storeIds.length > 0) {
    const { data: storeHours, error: storeErr } = await getSupabase()
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('business_id', businessId)
      .eq('store_id', storeIds[0]);

    if (!storeErr && storeHours && storeHours.length > 0) {
      template = storeHours as HoursTemplate[];
      console.log('[StaffService] Using store', storeIds[0], 'hours as staff schedule template (', template.length, 'days)');
    }
  }

  // ── Step 2: Fall back to business-wide defaults ──────────────────────────
  if (!template) {
    const { data: bizHours, error: bizErr } = await getSupabase()
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('business_id', businessId)
      .is('store_id', null);

    if (!bizErr && bizHours && bizHours.length > 0) {
      template = bizHours as HoursTemplate[];
      console.log('[StaffService] Using business-wide hours as staff schedule template (', template.length, 'days)');
    }
  }

  // ── Step 3: Build all 7 rows, using template where available, fallback otherwise ──
  // This guarantees NO partial schedule — every day is always explicitly defined.
  const templateMap = new Map<number, HoursTemplate>();
  if (template) {
    template.forEach((t) => templateMap.set(t.day_of_week, t));
  }

  if (!template) {
    console.log('[StaffService] No hours template found for staff', staffId, '— applying structural fallback (Mon–Sat 10:00–17:00, Sun off)');
  }

  const rows = Array.from({ length: 7 }, (_, day) => {
    const t = templateMap.get(day);
    if (t) {
      return {
        staff_id: staffId,
        business_id: businessId,
        day_of_week: day,
        start_time: t.open_time,
        end_time: t.close_time,
        is_off: t.is_closed,
      };
    }
    // Day missing from template — use structural fallback
    return {
      staff_id: staffId,
      business_id: businessId,
      day_of_week: day,
      ...FALLBACK[day],
    };
  });

  const { error: upsertError } = await getSupabase()
    .from('staff_weekly_schedule')
    .upsert(rows, { onConflict: 'staff_id,day_of_week', ignoreDuplicates: false });

  if (upsertError) {
    console.log('[StaffService] WARNING: Failed to init staff_weekly_schedule for staff', staffId, '—', upsertError.message);
    console.log('[StaffService] Effect: staff has zero schedule rows. RPC v_staff_has_any_schedule=FALSE → falls back to store hours (line 284 get_available_slots). SAFE only if store business_hours rows exist. If store hours are also missing, every date hits null_open_close_times → zero slots.');
  } else {
    console.log('[StaffService] Initialized 7 staff_weekly_schedule rows for staff:', staffId, '(template days:', templateMap.size, ', fallback days:', 7 - templateMap.size, ')');
  }
}
// ────────────────────────────────────────────────────────────────────────────

export async function createStaffMember(input: CreateStaffInput): Promise<ServiceResult<StaffMemberWithAssignments>> {
  try {
    console.log('[StaffService] createStaffMember called:', JSON.stringify(input, null, 2));

    if (!input.business_id) {
      console.log('[StaffService] ERROR: No business ID provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!input.full_name?.trim()) {
      console.log('[StaffService] ERROR: Staff name is required');
      return { data: null, error: new Error('Staff name is required') };
    }

    const storeIds = input.store_ids || [];
    const serviceIds = input.service_ids || [];

    // Insert staff member (without store_ids/service_ids - those go in junction tables)
    let staffData = null;
    let staffError = null;

    console.log('[StaffService] Attempting to insert staff member...');

    // Try with avatar columns first
    const result = await getSupabase()
      .from('staff')
      .insert({
        business_id: input.business_id,
        name: input.full_name.trim(),
        email: input.email?.trim() || null,
        photo_url: input.photo_url || null,
        avatar_url: input.avatar_url || null,
        avatar_thumb_url: input.avatar_thumb_url || null,
        color: input.color || '#0D9488',
        is_active: true,
      })
      .select()
      .single();

    staffData = result.data;
    staffError = result.error;

    // If error about avatar columns not existing, retry without them
    if (staffError && (staffError.message?.includes('avatar_url') || staffError.message?.includes('avatar_thumb_url'))) {
      console.log('[StaffService] Avatar columns not found, retrying without them...');
      const retryResult = await getSupabase()
        .from('staff')
        .insert({
          business_id: input.business_id,
          name: input.full_name.trim(),
          email: input.email?.trim() || null,
          photo_url: input.photo_url || null,
          color: input.color || '#0D9488',
          is_active: true,
        })
        .select()
        .single();

      staffData = retryResult.data;
      staffError = retryResult.error;
    }

    if (staffError) {
      console.log('[StaffService] ERROR creating staff member:', JSON.stringify({
        code: (staffError as { code?: string }).code,
        message: staffError.message,
        details: (staffError as { details?: string }).details,
        hint: (staffError as { hint?: string }).hint,
      }));
      return { data: null, error: staffError };
    }

    const staffId = staffData?.id as string;
    console.log('[StaffService] Staff member created successfully:', staffId);

    // Seed 7 canonical staff_weekly_schedule rows for this new staff member.
    // This prevents the Austin-type bug where staff have calendar shifts but no
    // weekly schedule, causing booking availability to return empty results.
    await initStaffWeeklySchedule(staffId, input.business_id, storeIds);

    // DEBUG: Post-write verification - re-fetch staff to confirm write
    console.log('[StaffService] DEBUG: Verifying staff write by re-fetching:', staffId);
    const { data: verifyStaff, error: verifyStaffError } = await getSupabase()
      .from('staff')
      .select('id, name, business_id')
      .eq('id', staffId)
      .single();

    if (verifyStaffError) {
      console.log('[StaffService] DEBUG: Post-write verification FAILED:', JSON.stringify({
        code: (verifyStaffError as { code?: string }).code,
        message: verifyStaffError.message,
      }));
    } else {
      console.log('[StaffService] DEBUG: Post-write verification SUCCESS:', JSON.stringify({
        id: verifyStaff?.id,
        name: verifyStaff?.name,
        business_id: verifyStaff?.business_id,
      }));
    }

    // Insert store assignments into BOTH junction tables for compatibility
    // The database may use either store_staff or staff_store_assignments
    if (storeIds.length > 0) {
      console.log('[StaffService] Inserting store assignments:', storeIds);

      // Try store_staff table first (newer schema)
      const storeStaffAssignments = storeIds.map(storeId => ({
        business_id: input.business_id,
        staff_id: staffId,
        store_id: storeId,
      }));

      console.log('[StaffService] DEBUG: store_staff insert payload:', JSON.stringify(storeStaffAssignments));

      const { error: storeStaffError } = await getSupabase()
        .from('store_staff')
        .insert(storeStaffAssignments);

      if (storeStaffError) {
        console.log('[StaffService] store_staff insert failed (table may not exist):', storeStaffError.message);
      } else {
        console.log('[StaffService] store_staff assignments created successfully');
      }

      // Also try staff_store_assignments table (may use user_id column)
      // This table may have user_id instead of staff_id
      const staffStoreAssignments = storeIds.map(storeId => ({
        business_id: input.business_id,
        user_id: staffId, // Using user_id as per user specification
        store_id: storeId,
        is_active: true,
      }));

      console.log('[StaffService] DEBUG: staff_store_assignments insert payload:', JSON.stringify(staffStoreAssignments));

      const { error: staffStoreError } = await getSupabase()
        .from('staff_store_assignments')
        .insert(staffStoreAssignments);

      if (staffStoreError) {
        // Try with staff_id instead of user_id (fallback)
        const staffStoreAssignmentsFallback = storeIds.map(storeId => ({
          business_id: input.business_id,
          staff_id: staffId,
          store_id: storeId,
        }));

        const { error: fallbackError } = await getSupabase()
          .from('staff_store_assignments')
          .insert(staffStoreAssignmentsFallback);

        if (fallbackError) {
          console.log('[StaffService] staff_store_assignments insert failed:', fallbackError.message);
        } else {
          console.log('[StaffService] staff_store_assignments created (with staff_id)');
        }
      } else {
        console.log('[StaffService] staff_store_assignments created (with user_id)');
      }

      // DEBUG: Verify store assignments were written to at least one table
      const { data: verifyAssignments } = await getSupabase()
        .from('store_staff')
        .select('staff_id, store_id')
        .eq('staff_id', staffId);

      const { data: verifyAssignments2 } = await getSupabase()
        .from('staff_store_assignments')
        .select('staff_id, store_id')
        .or(`user_id.eq.${staffId},staff_id.eq.${staffId}`);

      console.log('[StaffService] DEBUG: Post-write verification:', JSON.stringify({
        staff_id: staffId,
        store_staff_count: verifyAssignments?.length || 0,
        staff_store_assignments_count: verifyAssignments2?.length || 0,
      }));
    }

    // Insert service assignments into staff_services junction table (if any)
    // Note: staff_services does NOT have a business_id column - only staff_id and service_id
    if (serviceIds.length > 0) {
      console.log('[StaffService] Inserting service assignments:', serviceIds);
      const serviceAssignments = serviceIds.map(serviceId => ({
        staff_id: staffId,
        service_id: serviceId,
      }));

      const { error: serviceAssignError } = await getSupabase()
        .from('staff_services')
        .insert(serviceAssignments);

      if (serviceAssignError) {
        console.log('[StaffService] Error inserting service assignments:', serviceAssignError.message);
        // Don't fail - just log
      } else {
        console.log('[StaffService] Service assignments created successfully');
      }
    }

    // Return mapped staff with the store_ids we just assigned
    const mappedStaff = mapStaffRow(staffData);
    mappedStaff.store_ids = storeIds;
    mappedStaff.service_ids = serviceIds;

    return {
      data: mappedStaff,
      error: null,
    };
  } catch (err) {
    console.log('[StaffService] UNEXPECTED ERROR creating staff member:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create staff member'),
    };
  }
}

/**
 * Update a staff member
 * Updates staff record and manages store/service assignments via junction tables
 */
export async function updateStaffMember(
  staffId: string,
  updates: UpdateStaffInput,
  businessId?: string
): Promise<ServiceResult<SupabaseStaffMember>> {
  try {
    console.log('[StaffService] updateStaffMember called:', staffId, updates);

    // Extract store_ids and service_ids for junction table updates
    const storeIds = updates.store_ids;
    const serviceIds = updates.service_ids;

    // Map the updates to the correct column names (without junction table columns)
    const dbUpdates: Record<string, unknown> = {};
    if (updates.full_name !== undefined) dbUpdates.name = updates.full_name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.photo_url !== undefined) dbUpdates.photo_url = updates.photo_url;
    if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url;
    if (updates.avatar_thumb_url !== undefined) dbUpdates.avatar_thumb_url = updates.avatar_thumb_url;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.is_archived !== undefined) dbUpdates.is_active = !updates.is_archived; // Invert

    // Only update staff table if there are actual field updates
    let data = null;
    let error = null;

    if (Object.keys(dbUpdates).length > 0) {
      const result = await getSupabase()
        .from('staff')
        .update(dbUpdates)
        .eq('id', staffId)
        .select()
        .single();

      data = result.data;
      error = result.error;

      // If error about avatar columns, retry without them
      if (error && (error.message?.includes('avatar_url') || error.message?.includes('avatar_thumb_url'))) {
        console.log('[StaffService] Avatar columns not found in update, retrying without them...');
        delete dbUpdates.avatar_url;
        delete dbUpdates.avatar_thumb_url;
        const retryResult = await getSupabase()
          .from('staff')
          .update(dbUpdates)
          .eq('id', staffId)
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        console.log('[StaffService] Error updating staff member:', error.message);
        return { data: null, error };
      }
    } else {
      // No field updates, just fetch current data
      const fetchResult = await getSupabase()
        .from('staff')
        .select()
        .eq('id', staffId)
        .single();
      data = fetchResult.data;
      error = fetchResult.error;
      if (error) {
        return { data: null, error };
      }
    }

    // Get business_id from data if not provided
    const bizId = businessId || (data?.business_id as string);

    // Update store assignments via BOTH junction tables for compatibility
    if (storeIds !== undefined && bizId) {
      console.log('[StaffService] Updating store assignments via junction tables:', storeIds);

      // Delete existing assignments from BOTH tables
      console.log('[StaffService] DEBUG: Deleting existing store assignments for staff:', staffId);

      // Delete from store_staff
      await getSupabase().from('store_staff').delete().eq('staff_id', staffId);

      // Delete from staff_store_assignments (try both user_id and staff_id columns)
      await getSupabase().from('staff_store_assignments').delete().eq('user_id', staffId);
      await getSupabase().from('staff_store_assignments').delete().eq('staff_id', staffId);

      // Insert new assignments into BOTH tables
      if (storeIds.length > 0) {
        // Insert into store_staff
        const storeStaffAssignments = storeIds.map(storeId => ({
          business_id: bizId,
          staff_id: staffId,
          store_id: storeId,
        }));

        const { error: storeStaffError } = await getSupabase()
          .from('store_staff')
          .insert(storeStaffAssignments);

        if (storeStaffError) {
          console.log('[StaffService] store_staff insert failed:', storeStaffError.message);
        } else {
          console.log('[StaffService] store_staff assignments updated');
        }

        // Insert into staff_store_assignments (try user_id first, then staff_id)
        const staffStoreAssignments = storeIds.map(storeId => ({
          business_id: bizId,
          user_id: staffId,
          store_id: storeId,
          is_active: true,
        }));

        const { error: staffStoreError } = await getSupabase()
          .from('staff_store_assignments')
          .insert(staffStoreAssignments);

        if (staffStoreError) {
          // Fallback: try with staff_id instead
          const staffStoreAssignmentsFallback = storeIds.map(storeId => ({
            business_id: bizId,
            staff_id: staffId,
            store_id: storeId,
          }));

          const { error: fallbackError } = await getSupabase()
            .from('staff_store_assignments')
            .insert(staffStoreAssignmentsFallback);

          if (fallbackError) {
            console.log('[StaffService] staff_store_assignments insert failed:', fallbackError.message);
          } else {
            console.log('[StaffService] staff_store_assignments updated (with staff_id)');
          }
        } else {
          console.log('[StaffService] staff_store_assignments updated (with user_id)');
        }
      }

      // DEBUG: Verify final store assignments
      const { data: verifyStoreStaff } = await getSupabase()
        .from('store_staff')
        .select('staff_id, store_id')
        .eq('staff_id', staffId);

      const { data: verifyStaffStore } = await getSupabase()
        .from('staff_store_assignments')
        .select('staff_id, store_id')
        .or(`user_id.eq.${staffId},staff_id.eq.${staffId}`);

      console.log('[StaffService] DEBUG: Post-update store assignments:', JSON.stringify({
        staff_id: staffId,
        expected_store_ids: storeIds,
        store_staff_count: verifyStoreStaff?.length || 0,
        staff_store_assignments_count: verifyStaffStore?.length || 0,
      }));
    }

    // Update service assignments via junction table if provided
    // Note: staff_services does NOT have a business_id column - only staff_id and service_id
    if (serviceIds !== undefined) {
      console.log('[StaffService] Updating service assignments via junction table:', serviceIds);

      // Delete existing assignments
      const { error: deleteError } = await getSupabase()
        .from('staff_services')
        .delete()
        .eq('staff_id', staffId);

      if (deleteError) {
        console.log('[StaffService] Error deleting old service assignments:', deleteError.message);
      }

      // Insert new assignments
      if (serviceIds.length > 0) {
        const serviceAssignments = serviceIds.map(serviceId => ({
          staff_id: staffId,
          service_id: serviceId,
        }));

        console.log('[StaffService] DEBUG: Inserting service assignments:', JSON.stringify(serviceAssignments));

        const { error: insertError } = await getSupabase()
          .from('staff_services')
          .insert(serviceAssignments);

        if (insertError) {
          console.log('[StaffService] Error inserting service assignments:', insertError.message);
        } else {
          console.log('[StaffService] Service assignments updated successfully');
        }
      }

      // DEBUG: Verify final service assignments
      const { data: verifyServices, error: verifyServiceError } = await getSupabase()
        .from('staff_services')
        .select('staff_id, service_id')
        .eq('staff_id', staffId);

      if (verifyServiceError) {
        console.log('[StaffService] DEBUG: Post-update service assignment verification FAILED:', verifyServiceError.message);
      } else {
        console.log('[StaffService] DEBUG: Post-update service assignments:', JSON.stringify({
          staff_id: staffId,
          expected_service_ids: serviceIds,
          actual_service_ids: verifyServices?.map(a => a.service_id) || [],
          match: JSON.stringify(serviceIds.sort()) === JSON.stringify((verifyServices?.map(a => a.service_id) || []).sort()),
        }));
      }
    }

    console.log('[StaffService] Staff member updated:', data?.id);
    const mappedStaff = mapStaffRow(data) as SupabaseStaffMember;
    // Include the updated store/service IDs in the response
    if (storeIds !== undefined) mappedStaff.store_ids = storeIds;
    if (serviceIds !== undefined) mappedStaff.service_ids = serviceIds;

    return { data: mappedStaff, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update staff member'),
    };
  }
}

/**
 * Update staff store assignments via BOTH junction tables
 * Deletes all existing assignments and inserts new ones
 */
export async function updateStaffStoreAssignments(
  businessId: string,
  staffId: string,
  newStoreIds: string[]
): Promise<ServiceResult<null>> {
  try {
    console.log('[StaffService] updateStaffStoreAssignments called:', { staffId, newStoreIds });

    // Delete existing assignments from BOTH tables
    await getSupabase().from('store_staff').delete().eq('staff_id', staffId);
    await getSupabase().from('staff_store_assignments').delete().eq('user_id', staffId);
    await getSupabase().from('staff_store_assignments').delete().eq('staff_id', staffId);

    // Insert new assignments into BOTH tables
    if (newStoreIds.length > 0) {
      // Insert into store_staff
      const storeStaffAssignments = newStoreIds.map(storeId => ({
        business_id: businessId,
        staff_id: staffId,
        store_id: storeId,
      }));

      const { error: storeStaffError } = await getSupabase()
        .from('store_staff')
        .insert(storeStaffAssignments);

      if (storeStaffError) {
        console.log('[StaffService] store_staff insert error:', storeStaffError.message);
      }

      // Insert into staff_store_assignments (try user_id first)
      const staffStoreAssignments = newStoreIds.map(storeId => ({
        business_id: businessId,
        user_id: staffId,
        store_id: storeId,
        is_active: true,
      }));

      const { error: staffStoreError } = await getSupabase()
        .from('staff_store_assignments')
        .insert(staffStoreAssignments);

      if (staffStoreError) {
        // Fallback: try with staff_id
        const fallbackAssignments = newStoreIds.map(storeId => ({
          business_id: businessId,
          staff_id: staffId,
          store_id: storeId,
        }));

        await getSupabase().from('staff_store_assignments').insert(fallbackAssignments);
      }
    }

    console.log('[StaffService] Staff store assignments updated');
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update staff assignments'),
    };
  }
}

/**
 * Archive a staff member (soft delete - sets is_active to false)
 */
export async function archiveStaffMember(staffId: string): Promise<ServiceResult<SupabaseStaffMember>> {
  return updateStaffMember(staffId, { is_archived: true });
}

/**
 * Restore an archived staff member
 */
export async function restoreStaffMember(staffId: string): Promise<ServiceResult<SupabaseStaffMember>> {
  return updateStaffMember(staffId, { is_archived: false });
}

/**
 * Delete a staff member permanently
 */
export async function deleteStaffMember(staffId: string): Promise<ServiceResult<null>> {
  try {
    console.log('[StaffService] deleteStaffMember called:', staffId);

    const { error } = await getSupabase()
      .from('staff')
      .delete()
      .eq('id', staffId);

    if (error) {
      console.log('[StaffService] Error deleting staff member:', error.message);
      return { data: null, error };
    }

    console.log('[StaffService] Staff member deleted:', staffId);
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete staff member'),
    };
  }
}
