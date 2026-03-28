/**
 * Promotion Assignments Service
 *
 * Manages persisted status of client-to-marketing-promotion assignments.
 * status: 'active' | 'paused' | 'removed'
 *
 * All state is stored in the `client_promotion_assignments` Supabase table via the backend.
 * This is the single source of truth — not local Zustand state.
 */

import { getSupabase } from '../lib/supabaseClient';

const getBackendUrl = (): string =>
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:3000';

export type PromoAssignmentStatus = 'active' | 'paused' | 'removed';

export interface PromoAssignmentRow {
  id: string;
  client_id: string;
  promotion_id: string;
  status: PromoAssignmentStatus;
  assigned_at: string;
  paused_at: string | null;
}

// ─── Auth token helper ────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabase().auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ─── Fetch all assignments for a business ────────────────────────────────────

export async function fetchPromotionAssignments(
  businessId: string
): Promise<{ data: PromoAssignmentRow[] | null; error: Error | null }> {
  try {
    const headers = await getAuthHeaders();
    const url = `${getBackendUrl()}/api/promotion-assignments?business_id=${encodeURIComponent(businessId)}`;
    const res = await fetch(url, { headers });
    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json.error ?? 'Fetch failed') };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Network error') };
  }
}

// ─── Assign client to promotion ──────────────────────────────────────────────

export async function assignClientToPromotionDB(
  businessId: string,
  clientId: string,
  promotionId: string
): Promise<{ data: PromoAssignmentRow | null; error: Error | null }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${getBackendUrl()}/api/promotion-assignments/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ business_id: businessId, client_id: clientId, promotion_id: promotionId }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json.error ?? 'Assign failed') };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Network error') };
  }
}

// ─── Pause assignment ────────────────────────────────────────────────────────

export async function pausePromotionAssignment(
  businessId: string,
  clientId: string,
  promotionId: string
): Promise<{ data: PromoAssignmentRow | null; error: Error | null }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${getBackendUrl()}/api/promotion-assignments/pause`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ business_id: businessId, client_id: clientId, promotion_id: promotionId }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json.error ?? 'Pause failed') };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Network error') };
  }
}

// ─── Resume assignment ───────────────────────────────────────────────────────

export async function resumePromotionAssignment(
  businessId: string,
  clientId: string,
  promotionId: string
): Promise<{ data: PromoAssignmentRow | null; error: Error | null }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${getBackendUrl()}/api/promotion-assignments/resume`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ business_id: businessId, client_id: clientId, promotion_id: promotionId }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json.error ?? 'Resume failed') };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Network error') };
  }
}

// ─── Remove assignment ───────────────────────────────────────────────────────

export async function removePromotionAssignment(
  businessId: string,
  clientId: string,
  promotionId: string
): Promise<{ data: PromoAssignmentRow | null; error: Error | null }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${getBackendUrl()}/api/promotion-assignments/remove`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ business_id: businessId, client_id: clientId, promotion_id: promotionId }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json.error ?? 'Remove failed') };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Network error') };
  }
}
