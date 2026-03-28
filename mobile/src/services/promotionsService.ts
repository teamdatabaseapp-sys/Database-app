/**
 * Promotions Service
 *
 * Handles all Supabase operations for the promotions table.
 * All operations are scoped by business_id for multi-tenant security.
 *
 * CONFIRMED live DB schema for `promotions` table (verified 2026-03-04):
 *   id, business_id, title, description, discount_type, discount_value,
 *   is_active, starts_at, ends_at, end_date, created_at
 *
 * Columns that DO NOT exist in live DB:
 *   name, start_date, free_service_after, other_discount_description, color, user_id
 *
 * DUPLICATION PREVENTION STRATEGY:
 *   - ensurePromotionInSupabase: uses UPSERT on id (no blind INSERT)
 *   - syncPromotionsToSupabase: DISABLED — do not call. Hydration is read-only from Supabase.
 *   - createPromotion: creates a new row via INSERT only when user explicitly creates one
 *   - deletePromotion: hard-deletes from Supabase by id
 */

import { getSupabase } from '@/lib/supabaseClient';
import type { MarketingPromotion } from '@/lib/types';

// ============================================
// Types — aligned to the real live DB schema
// ============================================

export interface SupabasePromotion {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  end_date: string | null;
  created_at: string;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Helpers
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toIso(d: Date | string | undefined | null): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/**
 * Convert a Zustand MarketingPromotion to the live DB column names.
 * Only includes columns confirmed to exist in the live Supabase schema.
 */
function toDbPayload(businessId: string, promo: MarketingPromotion) {
  return {
    id: promo.id,
    business_id: businessId,
    title: promo.name,
    description: promo.description || null,
    discount_type: promo.discountType,
    discount_value: promo.discountValue,
    is_active: promo.isActive,
    starts_at: toIso(promo.startDate) ?? new Date().toISOString(),
    ends_at: toIso(promo.endDate),
    end_date: toIso(promo.endDate),
  };
}

// ============================================
// Promotion Operations
// ============================================

/**
 * Get all promotions for a business from Supabase.
 * This is the authoritative read — Zustand is always replaced with this result.
 */
export async function getPromotions(businessId: string): Promise<ServiceResult<SupabasePromotion[]>> {
  try {
    console.log('[PromotionsService] getPromotions called:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('promotions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    if (error) {
      console.log('[PromotionsService] Error fetching promotions:', error.message);
      return { data: null, error };
    }

    console.log('[PromotionsService] Promotions fetched:', data?.length ?? 0);
    return { data: data as SupabasePromotion[], error: null };
  } catch (err) {
    console.log('[PromotionsService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch promotions'),
    };
  }
}

/**
 * Get a single promotion by ID
 */
export async function getPromotion(promotionId: string): Promise<ServiceResult<SupabasePromotion>> {
  try {
    const { data, error } = await getSupabase()
      .from('promotions')
      .select('*')
      .eq('id', promotionId)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    return { data: data as SupabasePromotion | null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch promotion'),
    };
  }
}

/**
 * Ensure a Zustand promotion exists in Supabase using UPSERT on id.
 * Called before saving an appointment with a promo_id.
 * UPSERT on `id` means: insert if new, update if exists — never duplicates.
 */
export async function ensurePromotionInSupabase(
  businessId: string,
  zustandPromotion: MarketingPromotion
): Promise<ServiceResult<SupabasePromotion>> {
  try {
    console.log('[PromotionsService] ensurePromotionInSupabase:', {
      businessId,
      id: zustandPromotion.id,
      name: zustandPromotion.name,
    });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!UUID_REGEX.test(zustandPromotion.id)) {
      console.log('[PromotionsService] Invalid UUID:', zustandPromotion.id);
      return { data: null, error: new Error('Promotion ID is not a valid UUID') };
    }

    const payload = toDbPayload(businessId, zustandPromotion);

    // UPSERT on id — safe: if row already exists it gets updated, never inserted twice
    const { data, error } = await getSupabase()
      .from('promotions')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();

    if (error) {
      console.log('[PromotionsService] Error upserting promotion:', error.message, '| code:', error.code);
      return { data: null, error };
    }

    console.log('[PromotionsService] Promotion upserted:', data?.id);
    return { data: data as SupabasePromotion, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to ensure promotion in Supabase'),
    };
  }
}

/**
 * Sync is intentionally a NO-OP.
 *
 * The old sync would INSERT Zustand promotions to Supabase, creating duplicates
 * when the store rebuilt from scratch (e.g. app restart). Supabase is now the
 * source of truth — we only READ from it, never bulk-push Zustand state to it.
 *
 * Promotions reach Supabase through two explicit paths only:
 *   1. createPromotion()  — when user creates a new promotion
 *   2. ensurePromotionInSupabase() — when an appointment references a promo
 *
 * This function is kept to avoid breaking call sites but does nothing.
 */
export async function syncPromotionsToSupabase(
  _businessId: string,
  _zustandPromotions: MarketingPromotion[]
): Promise<ServiceResult<SupabasePromotion[]>> {
  console.log('[PromotionsService] syncPromotionsToSupabase: NO-OP (Supabase is source of truth)');
  return { data: [], error: null };
}

/**
 * Create a new promotion in Supabase.
 * Called when a user explicitly creates a promotion via the UI.
 */
export async function createPromotion(
  businessId: string,
  promotion: Omit<MarketingPromotion, 'userId' | 'createdAt'>
): Promise<ServiceResult<SupabasePromotion>> {
  try {
    console.log('[PromotionsService] createPromotion:', { businessId, name: promotion.name });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const payload = toDbPayload(businessId, promotion as MarketingPromotion);

    // Use upsert on id to be safe — if the UUID already exists, update it
    const { data, error } = await getSupabase()
      .from('promotions')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: false })
      .select()
      .single();

    if (error) {
      console.log('[PromotionsService] Error creating promotion:', error.message);
      return { data: null, error };
    }

    console.log('[PromotionsService] Promotion created:', data?.id);
    return { data: data as SupabasePromotion, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create promotion'),
    };
  }
}

/**
 * Update an existing promotion in Supabase.
 * MUST be used when editing — never uses insert().
 * Only called when the promotion already has a valid DB id.
 */
export async function updatePromotion(
  businessId: string,
  promotion: MarketingPromotion
): Promise<ServiceResult<SupabasePromotion>> {
  try {
    console.log('[PromotionsService] updatePromotion:', { businessId, id: promotion.id });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!UUID_REGEX.test(promotion.id)) {
      return { data: null, error: new Error('Promotion ID is not a valid UUID') };
    }

    const { id, ...rest } = toDbPayload(businessId, promotion);

    const { data, error } = await getSupabase()
      .from('promotions')
      .update(rest)
      .eq('id', promotion.id)
      .select()
      .single();

    if (error) {
      console.log('[PromotionsService] Error updating promotion:', error.message, '| code:', error.code);
      if ((error as { code?: string }).code === '23505') {
        return { data: null, error: new Error('A promotion with this title already exists.') };
      }
      return { data: null, error: new Error(error.message || 'Failed to update promotion') };
    }

    console.log('[PromotionsService] Promotion updated:', data?.id);
    return { data: data as SupabasePromotion, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update promotion'),
    };
  }
}

/**
 * Hard-delete a promotion from Supabase by id.
 * After calling this, invalidate the promotions query so Zustand is updated.
 */
export async function deletePromotion(promotionId: string): Promise<ServiceResult<void>> {
  try {
    console.log('[PromotionsService] deletePromotion:', { promotionId });

    const { error } = await getSupabase()
      .from('promotions')
      .delete()
      .eq('id', promotionId);

    if (error) {
      console.log('[PromotionsService] Error deleting promotion:', error.message);
      return { data: null, error };
    }

    console.log('[PromotionsService] Promotion deleted:', promotionId);
    return { data: undefined, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete promotion'),
    };
  }
}
