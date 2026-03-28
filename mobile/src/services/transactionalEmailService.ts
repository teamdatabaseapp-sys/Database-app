/**
 * Transactional Email Service
 *
 * Fire-and-forget helper that calls the backend /api/transactional/notify
 * endpoint for loyalty, gift card, and promotion email events.
 *
 * NEVER throws — email failure must not block any user action.
 */

import { getSupabase } from '@/lib/supabaseClient';

export type TransactionalEventType =
  | 'loyalty_points_earned'
  | 'loyalty_points_redeemed'
  | 'gift_card_issued'
  | 'gift_card_redeemed'
  | 'promotion_applied'
  | 'promotion_counter_reward';

export interface TransactionalEmailPayload {
  business_id: string;
  client_id: string;
  event_type: TransactionalEventType;
  // Loyalty
  points_earned?: number;
  points_balance?: number;
  reward_title?: string;
  points_used?: number;
  // Gift card
  gift_card_code?: string;
  gift_card_type?: 'value' | 'service';
  gift_card_value?: number;
  gift_card_balance?: number;
  gift_card_service_name?: string;
  gift_card_personal_message?: string;
  // Promotion
  promo_title?: string;
  promo_discount_type?: string;
  promo_discount_value?: number;
  // Counter
  counter_current?: number;
  counter_target?: number;
  counter_service_name?: string;
  counter_is_edit?: boolean;
  // Shared
  currency_code?: string;
  appointment_date?: string;
  appointment_time?: string;
}

const getBackendUrl = (): string => {
  return (
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    'http://localhost:3000'
  );
};

/**
 * Fire-and-forget transactional email.
 * Logs outcome but never throws.
 */
export async function notifyTransactionalEmail(
  payload: TransactionalEmailPayload
): Promise<void> {
  try {
    const url = `${getBackendUrl()}/api/transactional/notify`;
    console.log(`[TransactionalEmail] Firing: ${payload.event_type} → client ${payload.client_id}`);

    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn(`[TransactionalEmail] HTTP ${res.status} for ${payload.event_type}`);
      return;
    }

    const json = await res.json() as { success: boolean; skipped?: string; error?: string };
    if (json.skipped) {
      console.log(`[TransactionalEmail] Skipped (${json.skipped}) for ${payload.event_type}`);
    } else if (!json.success) {
      console.warn(`[TransactionalEmail] Failed: ${json.error}`);
    } else {
      console.log(`[TransactionalEmail] Sent OK: ${payload.event_type}`);
    }
  } catch (err) {
    console.warn('[TransactionalEmail] Error (non-blocking):', err);
  }
}
