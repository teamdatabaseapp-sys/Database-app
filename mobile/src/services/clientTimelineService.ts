/**
 * Client Timeline Service
 *
 * Fetches the unified chronological timeline for a client from the backend,
 * which delegates to the `get_client_timeline` SECURITY DEFINER RPC.
 *
 * Backed by migration 20260325000002_client_timeline_rpc.sql.
 * If the migration is not yet applied, the backend returns migration_pending: true
 * and the hook returns an empty timeline gracefully.
 */

import { getSupabase } from '@/lib/supabaseClient';

const getBackendUrl = (): string =>
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:3000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: sessionData } = await getSupabase().auth.getSession();
  const token = sessionData?.session?.access_token;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimelineSourceSystem =
  | 'appointment'
  | 'loyalty'
  | 'gift_card'
  | 'membership'
  | 'membership_credit'
  | 'promotion_counter';

export interface TimelineEvent {
  event_id: string;
  source_system: TimelineSourceSystem;
  event_type: string;
  event_at: string;        // ISO timestamp
  summary: string;         // human-readable sentence
  amount: number | null;
  currency: string | null;
  reference_id: string | null;
  reference_label: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown>;
}

export interface ClientTimelineResult {
  events: TimelineEvent[];
  has_more: boolean;
  limit: number;
  offset: number;
  migration_pending?: boolean;
}

// ─── Service Function ─────────────────────────────────────────────────────────

export async function getClientTimeline(
  clientId: string,
  limit = 50,
  offset = 0,
): Promise<ClientTimelineResult> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const res = await fetch(
    `${getBackendUrl()}/api/clients/${clientId}/timeline?${params}`,
    { headers },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    // Migration not applied yet — return empty, don't throw
    if (res.status === 503 && body?.migration_pending) {
      console.warn('[ClientTimeline] RPC migration not applied yet — returning empty timeline');
      return { events: [], has_more: false, limit, offset, migration_pending: true };
    }

    throw new Error(body?.error ?? `Timeline fetch failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    events: (data.events ?? []) as TimelineEvent[],
    has_more: data.has_more ?? false,
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
  };
}
