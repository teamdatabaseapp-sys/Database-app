/**
 * Promotion Counters Service
 *
 * DB-backed punch-card counters. Calls the backend API (which uses the Supabase admin
 * client to bypass RLS for server-side mutations).
 *
 * Read operations call the Supabase RPC directly for speed.
 * Write operations go through the backend API with a valid Bearer token.
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface PromotionCounter {
  id: string;
  promotion_id: string | null;
  promotion_title: string;
  promotion_color: string | null;
  required_count: number;
  current_count: number;
  is_completed: boolean;
  started_at: string;
  created_at: string;
}

export interface PromotionCounterRedemption {
  id: string;
  counter_id: string;
  service_id: string | null;
  service_name: string | null;
  store_id: string | null;
  store_name: string | null;
  staff_id: string | null;
  staff_name: string | null;
  redeemed_at: string;
  note: string | null;
  edited_at: string | null;
  edited_by_name: string | null;
  original_snapshot: OriginalSnapshot | null;
}

export interface OriginalSnapshot {
  service_id: string | null;
  store_id: string | null;
  staff_id: string | null;
  redeemed_at: string;
  note: string | null;
}

export interface AddRedemptionInput {
  business_id: string;
  client_id: string;
  service_id?: string | null;
  store_id?: string | null;
  staff_id?: string | null;
  redeemed_at?: string;
  note?: string | null;
  /** Idempotency key — prevents double-increment on network retry. Pass a stable UUID per tap. */
  idempotency_key?: string;
}

export interface EditRedemptionInput {
  service_id?: string | null;
  store_id?: string | null;
  staff_id?: string | null;
  redeemed_at?: string;
  note?: string | null;
  edited_by?: string;
  edited_by_name?: string;
}

export interface CreateCounterInput {
  business_id: string;
  client_id: string;
  /** Optional: link to an existing promotion row */
  promotion_id?: string;
  /** Name displayed in the UI — stored directly on promotion_counters.counter_name (no promotions row created) */
  promotion_name?: string;
  required_count: number;
  created_by?: string;
}

// ============================================
// Backend URL
// ============================================

const getBackendUrl = (): string =>
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:3000';

// ============================================
// Auth helper — get current session token
// ============================================

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session?.access_token ?? null;
}

// ============================================
// Read: get counters via Supabase RPC
// ============================================

export async function getPromotionCountersForClient(
  businessId: string,
  clientId: string
): Promise<{ data: PromotionCounter[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await getSupabase().rpc('get_promotion_counters_for_client', {
      p_business_id: businessId,
      p_client_id: clientId,
    });

    if (error) {
      console.log('[PromotionCounters] getForClient error:', error.message);
      return { data: null, error };
    }

    return { data: (data ?? []) as PromotionCounter[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.log('[PromotionCounters] getForClient exception:', message);
    return { data: null, error: { message } };
  }
}

// ============================================
// Read: get redemptions via Supabase RPC
// ============================================

export async function getCounterRedemptions(
  counterId: string
): Promise<{ data: PromotionCounterRedemption[] | null; error: { message: string } | null }> {
  try {
    const { data, error } = await getSupabase().rpc('get_promotion_counter_redemptions', {
      p_counter_id: counterId,
    });

    if (error) {
      console.log('[PromotionCounters] getRedemptions error:', error.message);
      return { data: null, error };
    }

    return { data: (data ?? []) as PromotionCounterRedemption[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: { message } };
  }
}

// ============================================
// Write: create counter via backend API
// ============================================

export async function createPromotionCounter(
  input: CreateCounterInput
): Promise<{ data: { id: string } | null; error: { message: string } | null }> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    const url = `${getBackendUrl()}/api/promotion-counters`;
    console.log('[PromotionCounters] createPromotionCounter calling backend:', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const json = await res.json() as { success: boolean; data?: { id: string }; error?: string };

    if (!json.success) {
      console.log('[PromotionCounters] createCounter error:', json.error);
      return { data: null, error: { message: json.error ?? 'Unknown error' } };
    }

    return { data: json.data ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: { message } };
  }
}

// ============================================
// Write: add redemption (increment counter)
// ============================================

export async function addCounterRedemption(
  counterId: string,
  input: AddRedemptionInput
): Promise<{
  data: PromotionCounterRedemption | null;
  counter: { id: string; current_count: number; required_count: number; is_completed: boolean } | null;
  error: { message: string } | null;
}> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { data: null, counter: null, error: { message: 'Not authenticated' } };
    }

    const url = `${getBackendUrl()}/api/promotion-counters/${counterId}/redemptions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const json = await res.json() as {
      success: boolean;
      data?: PromotionCounterRedemption;
      counter?: { id: string; current_count: number; required_count: number; is_completed: boolean };
      error?: string;
    };

    if (!json.success) {
      console.log('[PromotionCounters] addRedemption error:', json.error);
      return { data: null, counter: null, error: { message: json.error ?? 'Unknown error' } };
    }

    return { data: json.data ?? null, counter: json.counter ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, counter: null, error: { message } };
  }
}

// ============================================
// Write: edit redemption (with audit trail)
// ============================================

export async function editCounterRedemption(
  redemptionId: string,
  input: EditRedemptionInput
): Promise<{ data: PromotionCounterRedemption | null; error: { message: string } | null }> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    const url = `${getBackendUrl()}/api/promotion-counters/redemptions/${redemptionId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const json = await res.json() as { success: boolean; data?: PromotionCounterRedemption; error?: string };

    if (!json.success) {
      console.log('[PromotionCounters] editRedemption error:', json.error);
      return { data: null, error: { message: json.error ?? 'Unknown error' } };
    }

    return { data: json.data ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: { message } };
  }
}

// ============================================
// Write: delete counter and all its redemptions
// ============================================

export async function deletePromotionCounter(
  counterId: string
): Promise<{ error: { message: string } | null }> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { error: { message: 'Not authenticated' } };
    }

    const response = await fetch(`${getBackendUrl()}/api/promotion-counters/${counterId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const json = (await response.json()) as { success: boolean; error?: string };
    if (!json.success) {
      return { error: { message: json.error ?? 'Delete failed' } };
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: { message } };
  }
}
