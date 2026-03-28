/**
 * Stores Service
 *
 * Handles all Supabase operations for stores.
 * All operations are scoped by business_id for multi-tenant security.
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

// Hours for a single day
export interface StoreHoursDay {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  open_time: string;   // "HH:MM" format e.g. "09:00"
  close_time: string;  // "HH:MM" format e.g. "17:00"
  is_closed: boolean;
}

export interface SupabaseStore {
  id: string;
  business_id: string;
  name: string;
  is_archived: boolean;
  created_at: string;
  // Sort order for user-defined display order
  sort_order?: number;
  // Primary store flag - cannot be deleted
  is_primary?: boolean;
  // New fields for per-store info
  address?: string | null;
  phone?: string | null;
  hours?: StoreHoursDay[] | null;
  blackout_dates?: string[] | null; // Array of ISO date strings "YYYY-MM-DD"
  // Store photo URLs
  photo_url?: string | null;
  photo_thumb_url?: string | null;
}

export interface CreateStoreInput {
  business_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  hours?: StoreHoursDay[] | null;
  blackout_dates?: string[] | null;
}

export interface UpdateStoreInput {
  name?: string;
  is_archived?: boolean;
  sort_order?: number;
  address?: string | null;
  phone?: string | null;
  hours?: StoreHoursDay[] | null;
  blackout_dates?: string[] | null;
  photo_url?: string | null;
  photo_thumb_url?: string | null;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Store Operations
// ============================================

/**
 * Get all stores for a business (non-archived only)
 *
 * Returns all active stores ordered by: is_primary DESC, created_at ASC
 * Primary stores always appear first, then oldest to newest.
 */
export async function getStores(businessId: string): Promise<ServiceResult<SupabaseStore[]>> {
  try {
    console.log('[StoresService] getStores called for business:', businessId);

    if (!businessId) {
      console.log('[StoresService] ERROR: No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data: sessionData } = await getSupabase().auth.getSession();
    if (!sessionData?.session) {
      console.log('[StoresService] ERROR: No authenticated session');
      return { data: null, error: new Error('No authenticated session') };
    }

    // Query all non-archived stores, ordered by is_primary DESC, created_at ASC
    const { data, error } = await getSupabase()
      .from('stores')
      .select('id, business_id, name, is_archived, sort_order, is_primary, address, phone, hours, blackout_dates, photo_url, photo_thumb_url, created_at')
      .eq('business_id', businessId)
      .or('is_archived.is.null,is_archived.eq.false')
      .order('is_primary', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.log('[StoresService] QUERY ERROR:', error.code, error.message);
      return { data: null, error };
    }

    console.log('[StoresService] SUCCESS: Fetched', data?.length ?? 0, 'stores');
    return { data: data as SupabaseStore[], error: null };
  } catch (err) {
    console.log('[StoresService] UNEXPECTED ERROR:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch stores'),
    };
  }
}

/**
 * Get all stores including archived
 *
 * Returns all stores ordered by: is_primary DESC, created_at ASC
 * Primary stores always appear first, then oldest to newest.
 */
export async function getAllStores(businessId: string): Promise<ServiceResult<SupabaseStore[]>> {
  try {
    console.log('[StoresService] getAllStores called for business:', businessId);

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('stores')
      .select('id, business_id, name, is_archived, sort_order, is_primary, address, phone, hours, blackout_dates, photo_url, photo_thumb_url, created_at')
      .eq('business_id', businessId)
      .order('is_primary', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.log('[StoresService] Error fetching all stores:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] All stores fetched:', data?.length ?? 0);
    return { data: data as SupabaseStore[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch stores'),
    };
  }
}

/**
 * Get a single store by ID
 */
export async function getStore(storeId: string): Promise<ServiceResult<SupabaseStore>> {
  try {
    console.log('[StoresService] getStore called for id:', storeId);

    const { data, error } = await getSupabase()
      .from('stores')
      .select('id, business_id, name, is_archived, sort_order, is_primary, address, phone, hours, blackout_dates, photo_url, photo_thumb_url, created_at')
      .eq('id', storeId)
      .single();

    if (error) {
      console.log('[StoresService] Error fetching store:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] Store fetched:', data?.id);
    return { data: data as SupabaseStore, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch store'),
    };
  }
}

/**
 * Get the primary store for a business
 */
export async function getPrimaryStore(businessId: string): Promise<ServiceResult<SupabaseStore>> {
  try {
    console.log('[StoresService] getPrimaryStore called for business:', businessId);

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('stores')
      .select('id, business_id, name, is_archived, sort_order, is_primary, address, phone, hours, blackout_dates, photo_url, photo_thumb_url, created_at')
      .eq('business_id', businessId)
      .eq('is_primary', true)
      .single();

    if (error) {
      // PGRST116 means no rows found - not an error, just no primary store
      if (error.code === 'PGRST116') {
        console.log('[StoresService] No primary store found for business:', businessId);
        return { data: null, error: null };
      }
      console.log('[StoresService] Error fetching primary store:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] Primary store fetched:', data?.id, data?.name);
    return { data: data as SupabaseStore, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch primary store'),
    };
  }
}

/**
 * Sync Main Store data from Settings to the primary store
 * Called when user saves Main Store info in Settings
 */
export async function syncMainStoreFromSettings(
  businessId: string,
  updates: {
    address?: string | null;
    phone?: string | null;
  }
): Promise<ServiceResult<SupabaseStore>> {
  try {
    console.log('[StoresService] syncMainStoreFromSettings called:', { businessId, updates });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    // Get the primary store
    const { data: primaryStore, error: fetchError } = await getPrimaryStore(businessId);

    if (fetchError) {
      console.log('[StoresService] Error fetching primary store for sync:', fetchError.message);
      return { data: null, error: fetchError };
    }

    if (!primaryStore) {
      console.log('[StoresService] No primary store found to sync');
      // This shouldn't happen normally, but handle gracefully
      return { data: null, error: new Error('No primary store found') };
    }

    // Update the primary store with the new values
    const { data, error } = await getSupabase()
      .from('stores')
      .update({
        address: updates.address,
        phone: updates.phone,
      })
      .eq('id', primaryStore.id)
      .select()
      .single();

    if (error) {
      console.log('[StoresService] Error syncing main store:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] Main store synced successfully:', data?.id);
    return { data: data as SupabaseStore, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error syncing main store:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to sync main store'),
    };
  }
}

// ============================================
// Internal: Initialize business_hours for a new store
// ============================================

/**
 * Initialize store-scoped business_hours.
 *
 * Priority:
 *   1. Copy from business-wide template (business_hours WHERE store_id IS NULL).
 *      These are the hours the owner configured for their business — the only
 *      trusted source of truth for what this business actually operates.
 *   2. If no template exists (first-time business with no hours set yet), apply a
 *      safe structural fallback:
 *        - day_of_week 0 (Sunday)   → is_closed = true
 *        - day_of_week 1–6 (Mon–Sat) → open_time = '10:00', close_time = '17:00', is_closed = false
 *      This is not a business schedule — it is a neutral starting point that keeps
 *      the store in a bookable state. The owner MUST configure real hours before
 *      going live. The product should surface this as an onboarding action item.
 *
 * day_of_week convention: Postgres DOW — 0 = Sunday, 1 = Monday … 6 = Saturday.
 * Confirmed from: business_hours CHECK constraint + get_available_slots RPC.
 *
 * Uses upsert on (business_id, store_id, day_of_week) — fully idempotent.
 * Failures are logged as WARNING and do NOT propagate (store creation succeeds).
 * On failure: store has no business_hours rows → RPC returns 'no_hours_defined'
 * for all dates → booking page shows zero available slots → immediately visible
 * to the owner.
 */
async function initStoreBusinessHours(storeId: string, businessId: string): Promise<void> {
  // ── Step 1: Try business-wide template (store_id IS NULL) ───────────────
  const { data: template, error: fetchError } = await getSupabase()
    .from('business_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('business_id', businessId)
    .is('store_id', null);

  if (fetchError) {
    console.log('[StoresService] WARNING: Could not fetch business-hours template for store', storeId, '—', fetchError.message);
    console.log('[StoresService] CRITICAL EFFECT: store has zero business_hours rows. RPC will hit null_open_close_times guard → zero booking slots for ALL dates on this store. Owner must configure hours before going live.');
    return;
  }

  let rows: { business_id: string; store_id: string; day_of_week: number; open_time: string; close_time: string; is_closed: boolean }[];

  if (template && template.length > 0) {
    // ── Step 1 success: copy template verbatim ──────────────────────────
    rows = (template as { day_of_week: number; open_time: string; close_time: string; is_closed: boolean }[]).map((t) => ({
      business_id: businessId,
      store_id: storeId,
      day_of_week: t.day_of_week,
      open_time: t.open_time,
      close_time: t.close_time,
      is_closed: t.is_closed,
    }));
    console.log('[StoresService] Copying', rows.length, 'business-hours rows from business template to store:', storeId);
  } else {
    // ── Step 2: No template — apply safe structural fallback ────────────
    // day 0 = Sunday → closed.  days 1-6 = Mon–Sat → 10:00–17:00 open.
    console.log('[StoresService] No business-wide hours template found — applying structural fallback for store:', storeId);
    rows = [
      { business_id: businessId, store_id: storeId, day_of_week: 0, open_time: '10:00', close_time: '17:00', is_closed: true  },
      { business_id: businessId, store_id: storeId, day_of_week: 1, open_time: '10:00', close_time: '17:00', is_closed: false },
      { business_id: businessId, store_id: storeId, day_of_week: 2, open_time: '10:00', close_time: '17:00', is_closed: false },
      { business_id: businessId, store_id: storeId, day_of_week: 3, open_time: '10:00', close_time: '17:00', is_closed: false },
      { business_id: businessId, store_id: storeId, day_of_week: 4, open_time: '10:00', close_time: '17:00', is_closed: false },
      { business_id: businessId, store_id: storeId, day_of_week: 5, open_time: '10:00', close_time: '17:00', is_closed: false },
      { business_id: businessId, store_id: storeId, day_of_week: 6, open_time: '10:00', close_time: '17:00', is_closed: false },
    ];
  }

  const { error: upsertError } = await getSupabase()
    .from('business_hours')
    .upsert(rows, { onConflict: 'business_id,store_id,day_of_week', ignoreDuplicates: false });

  if (upsertError) {
    console.log('[StoresService] WARNING: Failed to write business_hours for store', storeId, '—', upsertError.message);
    console.log('[StoresService] CRITICAL EFFECT: store has zero business_hours rows. RPC null_open_close_times guard fires on every date → zero booking slots regardless of staff schedule. This is the Austin-type failure root cause.');
  } else {
    console.log('[StoresService] Initialized', rows.length, 'business_hours rows for store:', storeId);
  }
}

/**
 * Create a new store
 */
export async function createStore(input: CreateStoreInput): Promise<ServiceResult<SupabaseStore>> {
  try {
    console.log('[StoresService] createStore called:', JSON.stringify(input));

    if (!input.business_id) {
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!input.name?.trim()) {
      return { data: null, error: new Error('Store name is required') };
    }

    // ── Hard limit: max 3 stores per business ──────────────────────────────
    const { count, error: countError } = await getSupabase()
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', input.business_id)
      .eq('is_archived', false);

    if (!countError && (count ?? 0) >= 3) {
      return {
        data: null,
        error: new Error('Store limit reached. You can only have Main Store + 2 additional stores (max 3 total).'),
      };
    }
    // ──────────────────────────────────────────────────────────────────────

    // Always include address/phone/hours/blackout_dates - columns are now guaranteed to exist
    const insertData = {
      business_id: input.business_id,
      name: input.name.trim(),
      address: input.address ?? null,
      phone: input.phone ?? null,
      hours: input.hours ?? [],
      blackout_dates: input.blackout_dates ?? [],
    };

    console.log('[StoresService] Inserting store data:', JSON.stringify(insertData));

    const { data, error } = await getSupabase()
      .from('stores')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.log('[StoresService] ERROR creating store:', JSON.stringify({
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }));
      return { data: null, error };
    }

    console.log('[StoresService] Store created:', data?.id);

    // Seed 7 canonical business_hours rows for this new store.
    // This is the authoritative initialization — booking, UI, and calendar rely on
    // business_hours as source of truth. Must happen at store creation time.
    await initStoreBusinessHours(data.id as string, input.business_id);

    // DEBUG: Post-write verification - re-fetch to confirm write succeeded
    console.log('[StoresService] DEBUG: Verifying write by re-fetching store:', data?.id);
    const { data: verifyData, error: verifyError } = await getSupabase()
      .from('stores')
      .select('id, name, business_id')
      .eq('id', data?.id)
      .single();

    if (verifyError) {
      console.log('[StoresService] DEBUG: Post-write verification FAILED:', JSON.stringify({
        code: verifyError.code,
        message: verifyError.message,
        details: verifyError.details,
        hint: verifyError.hint,
      }));
    } else {
      console.log('[StoresService] DEBUG: Post-write verification SUCCESS:', JSON.stringify({
        id: verifyData?.id,
        name: verifyData?.name,
        business_id: verifyData?.business_id,
      }));
    }

    return { data: data as SupabaseStore, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error creating store:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create store'),
    };
  }
}

/**
 * Update a store
 */
export async function updateStore(
  storeId: string,
  updates: UpdateStoreInput
): Promise<ServiceResult<SupabaseStore>> {
  try {
    console.log('[StoresService] updateStore called:', storeId, JSON.stringify(updates));

    // Build update object - always include all fields that are provided
    // Columns address/phone/hours/blackout_dates are now guaranteed to exist
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.is_archived !== undefined) updateData.is_archived = updates.is_archived;
    if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;
    // Always include these fields when provided (even if null)
    if ('address' in updates) updateData.address = updates.address ?? null;
    if ('phone' in updates) updateData.phone = updates.phone ?? null;
    if ('hours' in updates) updateData.hours = updates.hours ?? [];
    if ('blackout_dates' in updates) updateData.blackout_dates = updates.blackout_dates ?? [];
    // Photo fields (optional - may not exist in DB yet)
    if ('photo_url' in updates) updateData.photo_url = updates.photo_url ?? null;
    if ('photo_thumb_url' in updates) updateData.photo_thumb_url = updates.photo_thumb_url ?? null;

    console.log('[StoresService] Update data:', JSON.stringify(updateData));

    let { data, error } = await getSupabase()
      .from('stores')
      .update(updateData)
      .eq('id', storeId)
      .select()
      .single();

    // If photo columns don't exist, retry without them
    if (error && (error.message?.includes('photo_url') || error.message?.includes('photo_thumb_url'))) {
      console.log('[StoresService] Photo columns not found, retrying without them');
      const { photo_url, photo_thumb_url, ...coreUpdateData } = updateData;
      const retryResult = await getSupabase()
        .from('stores')
        .update(coreUpdateData)
        .eq('id', storeId)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.log('[StoresService] ERROR updating store:', JSON.stringify({
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }));
      return { data: null, error };
    }

    console.log('[StoresService] Store updated successfully:', data?.id);

    // DEBUG: Post-write verification - re-fetch to confirm update succeeded
    console.log('[StoresService] DEBUG: Verifying update by re-fetching store:', storeId);
    const { data: verifyData, error: verifyError } = await getSupabase()
      .from('stores')
      .select('id, name, business_id')
      .eq('id', storeId)
      .single();

    if (verifyError) {
      console.log('[StoresService] DEBUG: Post-update verification FAILED:', JSON.stringify({
        code: verifyError.code,
        message: verifyError.message,
        details: verifyError.details,
        hint: verifyError.hint,
      }));
    } else {
      console.log('[StoresService] DEBUG: Post-update verification SUCCESS:', JSON.stringify({
        id: verifyData?.id,
        name: verifyData?.name,
        business_id: verifyData?.business_id,
      }));
    }

    return { data: data as SupabaseStore, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error updating store:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update store'),
    };
  }
}

/**
 * Archive a store (soft delete)
 * Note: Primary stores cannot be archived
 */
export async function archiveStore(storeId: string): Promise<ServiceResult<SupabaseStore>> {
  // First check if this is a primary store
  const { data: store, error: fetchError } = await getSupabase()
    .from('stores')
    .select('is_primary')
    .eq('id', storeId)
    .single();

  if (fetchError) {
    console.log('[StoresService] Error checking store:', fetchError.message);
    return { data: null, error: fetchError };
  }

  if (store?.is_primary) {
    console.log('[StoresService] Cannot archive primary store:', storeId);
    return { data: null, error: new Error('PRIMARY_STORE_CANNOT_BE_DELETED') };
  }

  return updateStore(storeId, { is_archived: true });
}

/**
 * Restore an archived store
 */
export async function restoreStore(storeId: string): Promise<ServiceResult<SupabaseStore>> {
  return updateStore(storeId, { is_archived: false });
}

/**
 * Delete a store permanently
 * Note: Primary stores cannot be deleted
 */
export async function deleteStore(storeId: string): Promise<ServiceResult<null>> {
  try {
    console.log('[StoresService] deleteStore called:', storeId);

    // First check if this is a primary store
    const { data: store, error: fetchError } = await getSupabase()
      .from('stores')
      .select('is_primary')
      .eq('id', storeId)
      .single();

    if (fetchError) {
      console.log('[StoresService] Error checking store:', fetchError.message);
      return { data: null, error: fetchError };
    }

    if (store?.is_primary) {
      console.log('[StoresService] Cannot delete primary store:', storeId);
      return { data: null, error: new Error('PRIMARY_STORE_CANNOT_BE_DELETED') };
    }

    const { error } = await getSupabase()
      .from('stores')
      .delete()
      .eq('id', storeId);

    if (error) {
      console.log('[StoresService] Error deleting store:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] Store deleted:', storeId);
    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete store'),
    };
  }
}

/**
 * Reorder stores - update sort_order for multiple stores in a batch
 * @param storeOrders - Array of { id, sort_order } to update
 */
export async function reorderStores(
  storeOrders: Array<{ id: string; sort_order: number }>
): Promise<ServiceResult<null>> {
  try {
    console.log('[StoresService] reorderStores called:', JSON.stringify(storeOrders));

    if (!storeOrders || storeOrders.length === 0) {
      return { data: null, error: null };
    }

    // Update each store's sort_order
    // Using Promise.all for parallel updates
    const updates = storeOrders.map(({ id, sort_order }) =>
      getSupabase()
        .from('stores')
        .update({ sort_order })
        .eq('id', id)
    );

    const results = await Promise.all(updates);

    // Check for any errors
    const errors = results.filter((r: { error: unknown }) => r.error);
    if (errors.length > 0) {
      console.log('[StoresService] Error reordering stores:', errors[0].error?.message);
      return { data: null, error: errors[0].error };
    }

    console.log('[StoresService] Stores reordered successfully:', storeOrders.length);
    return { data: null, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error reordering stores:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to reorder stores'),
    };
  }
}

// Global lock to prevent race conditions when creating default stores
const defaultStoreCreationLock = new Map<string, Promise<ServiceResult<SupabaseStore>>>();

/**
 * Ensure a default store exists for a business.
 * Creates one using the provided default store name if no stores exist.
 * This is called automatically when a business is created.
 *
 * Uses a global lock per businessId to prevent race conditions and duplicate stores.
 *
 * @param businessId - The business ID
 * @param businessName - The business name (legacy param, unused)
 * @param defaultStoreName - The name to use for the default store (defaults to 'Main Store' for backwards compatibility)
 * @returns The default store or existing first store
 */
// ============================================
// Store Hours Overrides (Special Hours)
// ============================================

export interface StoreHoursOverride {
  id: string;
  business_id: string;
  store_id: string;
  start_date: string; // "YYYY-MM-DD" format
  end_date: string;   // "YYYY-MM-DD" format
  is_closed: boolean;
  open_time: string | null;  // "HH:MM" format
  close_time: string | null; // "HH:MM" format
  note: string | null;
  created_at: string;
}

export interface CreateStoreHoursOverrideInput {
  business_id: string;
  store_id: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  open_time?: string | null;
  close_time?: string | null;
  note?: string | null;
}

export interface UpdateStoreHoursOverrideInput {
  start_date?: string;
  end_date?: string;
  is_closed?: boolean;
  open_time?: string | null;
  close_time?: string | null;
  note?: string | null;
}

/**
 * Get all hours overrides for a store
 */
export async function getStoreOverrides(storeId: string): Promise<ServiceResult<StoreHoursOverride[]>> {
  try {
    console.log('[StoresService] getStoreOverrides called for store:', storeId);

    if (!storeId) {
      return { data: null, error: new Error('No store ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('store_hours_overrides')
      .select('id, business_id, store_id, start_date, end_date, is_closed, open_time, close_time, note, created_at')
      .eq('store_id', storeId)
      .order('start_date', { ascending: true });

    if (error) {
      console.log('[StoresService] Error fetching store overrides:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] Store overrides fetched:', data?.length ?? 0);
    return { data: data as StoreHoursOverride[], error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error fetching store overrides:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch store overrides'),
    };
  }
}

/**
 * Create or update a store hours override
 */
export async function upsertStoreOverride(
  input: CreateStoreHoursOverrideInput & { id?: string }
): Promise<ServiceResult<StoreHoursOverride>> {
  try {
    console.log('[StoresService] upsertStoreOverride called:', JSON.stringify(input));

    if (!input.business_id) {
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!input.store_id) {
      return { data: null, error: new Error('No store ID provided') };
    }

    // Validate constraints
    if (input.is_closed) {
      // If closed, times must be null
      input.open_time = null;
      input.close_time = null;
    } else {
      // If not closed, times are required
      if (!input.open_time || !input.close_time) {
        return { data: null, error: new Error('Open and close times are required when not closed') };
      }
    }

    const upsertData = {
      ...(input.id ? { id: input.id } : {}),
      business_id: input.business_id,
      store_id: input.store_id,
      start_date: input.start_date,
      end_date: input.end_date,
      is_closed: input.is_closed,
      open_time: input.open_time ?? null,
      close_time: input.close_time ?? null,
      note: input.note ?? null,
    };

    console.log('[StoresService] Upserting store override:', JSON.stringify(upsertData));

    const { data, error } = await getSupabase()
      .from('store_hours_overrides')
      .upsert(upsertData)
      .select()
      .single();

    if (error) {
      console.log('[StoresService] Error upserting store override:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] Store override upserted:', data?.id);
    return { data: data as StoreHoursOverride, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error upserting store override:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to save store override'),
    };
  }
}

/**
 * Delete a store hours override
 */
export async function deleteStoreOverride(overrideId: string): Promise<ServiceResult<null>> {
  try {
    console.log('[StoresService] deleteStoreOverride called:', overrideId);

    if (!overrideId) {
      return { data: null, error: new Error('No override ID provided') };
    }

    const { error } = await getSupabase()
      .from('store_hours_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) {
      console.log('[StoresService] Error deleting store override:', error.message);
      return { data: null, error };
    }

    console.log('[StoresService] Store override deleted:', overrideId);
    return { data: null, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error deleting store override:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete store override'),
    };
  }
}

/**
 * Get today's effective hours for a store (applies overrides)
 * Returns the override if today is within any override range, otherwise returns null
 */
export async function getTodayOverride(storeId: string): Promise<ServiceResult<StoreHoursOverride | null>> {
  try {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    console.log('[StoresService] getTodayOverride for store:', storeId, 'date:', today);

    const { data, error } = await getSupabase()
      .from('store_hours_overrides')
      .select('id, business_id, store_id, start_date, end_date, is_closed, open_time, close_time, note, created_at')
      .eq('store_id', storeId)
      .lte('start_date', today)
      .gte('end_date', today)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('[StoresService] Error fetching today override:', error.message);
      return { data: null, error };
    }

    if (data) {
      console.log('[StoresService] Found override for today:', data.id, 'is_closed:', data.is_closed);
    } else {
      console.log('[StoresService] No override for today');
    }

    return { data: data as StoreHoursOverride | null, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error fetching today override:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch today override'),
    };
  }
}

/**
 * Get override for a specific date
 */
export async function getOverrideForDate(
  storeId: string,
  date: string // "YYYY-MM-DD"
): Promise<ServiceResult<StoreHoursOverride | null>> {
  try {
    console.log('[StoresService] getOverrideForDate for store:', storeId, 'date:', date);

    const { data, error } = await getSupabase()
      .from('store_hours_overrides')
      .select('id, business_id, store_id, start_date, end_date, is_closed, open_time, close_time, note, created_at')
      .eq('store_id', storeId)
      .lte('start_date', date)
      .gte('end_date', date)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('[StoresService] Error fetching date override:', error.message);
      return { data: null, error };
    }

    return { data: data as StoreHoursOverride | null, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error fetching date override:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch date override'),
    };
  }
}

// ============================================
// Default Store Operations
// ============================================

export async function ensureDefaultStore(
  businessId: string,
  businessName: string,
  defaultStoreName: string = 'Main Store'
): Promise<ServiceResult<SupabaseStore>> {
  // Check if there's already a creation in progress for this business
  const existingPromise = defaultStoreCreationLock.get(businessId);
  if (existingPromise) {
    console.log('[StoresService] ensureDefaultStore: Already in progress for business:', businessId);
    return existingPromise;
  }

  // Create the promise and store it
  const creationPromise = _ensureDefaultStoreInternal(businessId, businessName, defaultStoreName);
  defaultStoreCreationLock.set(businessId, creationPromise);

  try {
    const result = await creationPromise;
    return result;
  } finally {
    // Clean up the lock after completion
    defaultStoreCreationLock.delete(businessId);
  }
}

/**
 * Internal implementation of ensureDefaultStore
 */
async function _ensureDefaultStoreInternal(
  businessId: string,
  businessName: string,
  defaultStoreName: string
): Promise<ServiceResult<SupabaseStore>> {
  try {
    console.log('[StoresService] ensureDefaultStore called for business:', businessId);

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    // Check if any stores exist (handle both null and false for is_archived)
    const { data: existingStores, error: fetchError } = await getSupabase()
      .from('stores')
      .select('id, business_id, name, is_archived, sort_order, is_primary, address, phone, hours, blackout_dates, photo_url, photo_thumb_url, created_at')
      .eq('business_id', businessId)
      .or('is_archived.is.null,is_archived.eq.false')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      console.log('[StoresService] Error checking existing stores:', fetchError.message);
      return { data: null, error: fetchError };
    }

    // If a store already exists, return it
    if (existingStores && existingStores.length > 0) {
      console.log('[StoresService] Store already exists:', existingStores[0].id, existingStores[0].name);
      return { data: existingStores[0] as SupabaseStore, error: null };
    }

    // Double-check by counting all stores (including archived) to prevent creating duplicates
    const { count, error: countError } = await getSupabase()
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (countError) {
      console.log('[StoresService] Error counting stores:', countError.message);
      // Continue anyway, we'll handle duplicates gracefully
    } else if (count && count > 0) {
      console.log('[StoresService] Found', count, 'total stores (including archived), fetching first active...');
      // Re-fetch to get the store
      const { data: anyStores } = await getSupabase()
        .from('stores')
        .select('id, business_id, name, is_archived, sort_order, is_primary, address, phone, hours, blackout_dates, photo_url, photo_thumb_url, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (anyStores && anyStores.length > 0) {
        return { data: anyStores[0] as SupabaseStore, error: null };
      }
    }

    // Create a default store as primary
    console.log('[StoresService] Creating default store for business:', businessId);

    const { data: newStore, error: createError } = await getSupabase()
      .from('stores')
      .insert({
        business_id: businessId,
        name: defaultStoreName,
        is_archived: false,
        is_primary: true,
      })
      .select()
      .single();

    if (createError) {
      // Check if it's a unique constraint violation (store already exists)
      if (createError.code === '23505') {
        console.log('[StoresService] Store already exists (unique constraint), fetching...');
        const { data: existingStore } = await getSupabase()
          .from('stores')
          .select('id, business_id, name, is_archived, sort_order, is_primary, address, phone, hours, blackout_dates, photo_url, photo_thumb_url, created_at')
          .eq('business_id', businessId)
          .or('is_archived.is.null,is_archived.eq.false')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        if (existingStore) {
          return { data: existingStore as SupabaseStore, error: null };
        }
      }
      console.log('[StoresService] Error creating default store:', createError.message);
      return { data: null, error: createError };
    }

    console.log('[StoresService] Default store created:', newStore?.id);

    // Seed 7 canonical business_hours rows for the new primary store.
    if (newStore?.id) {
      await initStoreBusinessHours(newStore.id as string, businessId);
    }

    return { data: newStore as SupabaseStore, error: null };
  } catch (err) {
    console.log('[StoresService] Unexpected error in ensureDefaultStore:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to ensure default store'),
    };
  }
}
