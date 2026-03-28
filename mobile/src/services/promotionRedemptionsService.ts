/**
 * Promotion Redemptions Service
 *
 * Single source of truth: public.promotion_redemptions
 *
 * The table is populated by:
 *   - A Postgres trigger on appointments (INSERT/UPDATE promo_id)
 *   - A one-time backfill migration
 *
 * All functions query promotion_redemptions directly.
 * No fallback to appointments.promo_id — the table is authoritative.
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface PromotionRedemption {
  id: string;
  business_id: string;
  store_id: string | null;
  client_id: string;
  promotion_id: string;
  source: 'visit' | 'appointment' | 'manual' | 'checkout';
  source_id: string | null;
  redeemed_at: string;
  final_amount: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Row returned by the promotions drilldown (get_promotions_redeemed_rows RPC) */
export interface PromotionRedemptionRow {
  id: string;
  client_id: string;
  client_name: string | null;
  store_id: string | null;
  store_name: string | null;
  promo_id: string;
  promo_name: string | null;
  promo_color: string | null;
  redeemed_at: string;
  amount: number | null;   // final_amount in dollars
}

export interface ClientPromotionUsed {
  id: string;
  promotion_id: string;
  promotion_name: string;
  promotion_color: string;
  discount_type: string;
  discount_value: number;
  redeemed_at: string;
  store_id: string | null;
  store_name: string | null;
  final_amount: number | null;
  currency: string;
}

export interface PromotionBreakdown {
  promotion_id: string;
  promotion_name: string;
  redemption_count: number;
  total_discount_amount: number | null;
  total_final_amount: number | null;
}

export interface PromotionTimeSeries {
  period_start: string;
  redemption_count: number;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Count
// ============================================

/**
 * Count promotions redeemed for a business within [startDate, endDate).
 * Queries promotion_redemptions via RPC, with direct table fallback.
 */
export async function getPromotionsRedeemedCount(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null,
  promotionId?: string | null
): Promise<ServiceResult<number>> {
  // Try the RPC first
  try {
    const { data, error } = await getSupabase().rpc('get_promotions_redeemed_count', {
      p_business_id:  businessId,
      p_start_date:   startDate.toISOString(),
      p_end_date:     endDate.toISOString(),
      p_store_id:     storeId     || null,
      p_promotion_id: promotionId || null,
    });

    if (!error) {
      console.log('[PromotionRedemptionsService] count via RPC:', data,
        '| store:', storeId || 'ALL',
        '| period:', startDate.toISOString().slice(0, 10), '→', endDate.toISOString().slice(0, 10));
      return { data: (data as number) ?? 0, error: null };
    }

    // RPC not deployed yet — fall through to direct table query
    console.log('[PromotionRedemptionsService] RPC unavailable:', error.message);
  } catch {
    // ignore, fall through
  }

  // Direct table query (same table, no appointments fallback)
  return getPromotionsRedeemedCountDirect(businessId, startDate, endDate, storeId, promotionId);
}

async function getPromotionsRedeemedCountDirect(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null,
  promotionId?: string | null
): Promise<ServiceResult<number>> {
  try {
    let query = getSupabase()
      .from('promotion_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('redeemed_at', startDate.toISOString())
      .lt('redeemed_at', endDate.toISOString());

    if (storeId)     query = query.eq('store_id',     storeId);
    if (promotionId) query = query.eq('promotion_id', promotionId);

    const { count, error } = await query;

    if (error) {
      console.log('[PromotionRedemptionsService] direct count error:', error.message);
      return { data: 0, error: null };
    }

    // If promotion_redemptions is empty, fall back to counting distinct appointments
    // from appointment_services.promo_id (service-level promotions)
    if ((count || 0) === 0) {
      return getPromotionsRedeemedCountFromServices(businessId, startDate, endDate, storeId, promotionId);
    }

    console.log('[PromotionRedemptionsService] count via direct table:', count,
      '| store:', storeId || 'ALL');
    return { data: count || 0, error: null };
  } catch {
    return { data: 0, error: null };
  }
}

/**
 * Fallback: count distinct appointments that had a promotion applied.
 * An appointment counts once if:
 *   - appointments.promo_id IS NOT NULL, OR
 *   - any related appointment_services row has promo_id IS NOT NULL
 * No double-counting: one appointment = one redemption regardless of how many
 * service lines have promo_id set.
 *
 * Used when promotion_redemptions table has no records yet.
 */
async function getPromotionsRedeemedCountFromServices(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null,
  promotionId?: string | null
): Promise<ServiceResult<number>> {
  try {
    // Fetch appointments in range scoped to this business,
    // joining their service lines so we can check service-level promos too.
    let apptQuery = getSupabase()
      .from('appointments')
      .select('id, promo_id, appointment_services(promo_id)', { count: 'exact', head: false })
      .eq('business_id', businessId)
      .gte('start_at', startDate.toISOString())
      .lt('start_at', endDate.toISOString())
      .or('is_deleted.eq.false,is_deleted.is.null');

    if (storeId) apptQuery = apptQuery.eq('store_id', storeId);

    const { data: appts, error: apptError } = await apptQuery;
    if (apptError || !appts) {
      console.log('[PromotionRedemptionsService] appt_services count fallback error:', apptError?.message);
      return { data: 0, error: null };
    }

    // Count distinct appointments that have any promo applied
    // (either at appointment level or on at least one service line)
    const redeemedIds = new Set<string>();
    for (const a of appts as Array<{ id: string; promo_id: string | null; appointment_services: Array<{ promo_id: string | null }> | null }>) {
      const apptHasPromo = !!a.promo_id;
      const serviceHasPromo = (a.appointment_services ?? []).some(s => !!s.promo_id);
      if (!apptHasPromo && !serviceHasPromo) continue;

      // If filtering by a specific promotion, check it matches
      if (promotionId) {
        const apptMatches = a.promo_id === promotionId;
        const serviceMatches = (a.appointment_services ?? []).some(s => s.promo_id === promotionId);
        if (!apptMatches && !serviceMatches) continue;
      }

      redeemedIds.add(a.id);
    }

    const distinctCount = redeemedIds.size;
    console.log('[PromotionRedemptionsService] count via appointment_services fallback:', distinctCount,
      '| business:', businessId,
      '| store:', storeId || 'ALL',
      '| period:', startDate.toISOString().slice(0, 10), '→', endDate.toISOString().slice(0, 10),
      '| total_appts_in_range:', appts.length,
      '| promo_filter:', promotionId || 'none');
    return { data: distinctCount, error: null };
  } catch (err) {
    console.log('[PromotionRedemptionsService] appt_services count fallback exception:', err);
    return { data: 0, error: null };
  }
}

// ============================================
// Drilldown rows
// ============================================

/**
 * Fetch the list of redemption rows for the drilldown screen.
 * Returns joined data: client name, store name, promotion name/color.
 */
export async function getPromotionsRedeemedRows(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null,
  promotionId?: string | null
): Promise<ServiceResult<PromotionRedemptionRow[]>> {
  // Try RPC first
  try {
    const { data, error } = await getSupabase().rpc('get_promotions_redeemed_rows', {
      p_business_id:  businessId,
      p_start_date:   startDate.toISOString(),
      p_end_date:     endDate.toISOString(),
      p_store_id:     storeId     || null,
      p_promotion_id: promotionId || null,
    });

    if (!error && data) {
      const rows = (data as Record<string, unknown>[]).map((r) => ({
        id:          r.id          as string,
        client_id:   r.client_id   as string,
        client_name: r.client_name as string | null,
        store_id:    r.store_id    as string | null,
        store_name:  r.store_name  as string | null,
        promo_id:    r.promo_id    as string,
        promo_name:  r.promo_name  as string | null,
        promo_color: r.promo_color as string | null,
        redeemed_at: r.redeemed_at as string,
        amount:      r.amount      as number | null,
      }));
      console.log('[PromotionRedemptionsService] rows via RPC:', rows.length,
        '| sample_id:', rows[0]?.id ?? 'none');
      return { data: rows, error: null };
    }

    console.log('[PromotionRedemptionsService] rows RPC unavailable:', error?.message);
  } catch {
    // fall through to direct query
  }

  return getPromotionsRedeemedRowsDirect(businessId, startDate, endDate, storeId, promotionId);
}

async function getPromotionsRedeemedRowsDirect(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null,
  promotionId?: string | null
): Promise<ServiceResult<PromotionRedemptionRow[]>> {
  try {
    let query = getSupabase()
      .from('promotion_redemptions')
      .select(`
        id,
        client_id,
        store_id,
        promotion_id,
        redeemed_at,
        final_amount,
        clients:client_id ( name ),
        stores:store_id ( name ),
        promotions:promotion_id ( title, discount_type, discount_value )
      `)
      .eq('business_id', businessId)
      .gte('redeemed_at', startDate.toISOString())
      .lt('redeemed_at', endDate.toISOString())
      .order('redeemed_at', { ascending: false });

    if (storeId)     query = query.eq('store_id',     storeId);
    if (promotionId) query = query.eq('promotion_id', promotionId);

    const { data, error } = await query;

    if (error) {
      console.log('[PromotionRedemptionsService] rows direct error:', error.message);
      // Table may not exist yet — fall back to appointment_services
      return getPromotionsRedeemedRowsFromServices(businessId, startDate, endDate, storeId, promotionId);
    }

    const rows: PromotionRedemptionRow[] = (data || []).map((r: Record<string, unknown>) => ({
      id:          r.id as string,
      client_id:   r.client_id as string,
      client_name: (r.clients as Record<string, unknown> | null)?.name as string | null,
      store_id:    r.store_id as string | null,
      store_name:  (r.stores as Record<string, unknown> | null)?.name as string | null,
      promo_id:    r.promotion_id as string,
      promo_name:  (r.promotions as Record<string, unknown> | null)?.title as string | null,
      promo_color: null,
      redeemed_at: r.redeemed_at as string,
      amount:      r.final_amount as number | null,
    }));

    // If table exists but is empty, also try appointment_services fallback
    if (rows.length === 0) {
      return getPromotionsRedeemedRowsFromServices(businessId, startDate, endDate, storeId, promotionId);
    }

    console.log('[PromotionRedemptionsService] rows via direct table:', rows.length,
      '| sample_id:', rows[0]?.id ?? 'none');
    return { data: rows, error: null };
  } catch {
    return getPromotionsRedeemedRowsFromServices(businessId, startDate, endDate, storeId, promotionId);
  }
}

/**
 * Fallback: build drilldown rows directly from appointments + appointment_services.
 * Uses appointments as the primary table (scoped by business/date/store),
 * then resolves the effective promo_id (appointment-level first, then service-level).
 * One row per appointment — no double-counting across service lines.
 * Used when promotion_redemptions table is not yet deployed or is empty.
 */
async function getPromotionsRedeemedRowsFromServices(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null,
  promotionId?: string | null
): Promise<ServiceResult<PromotionRedemptionRow[]>> {
  try {
    // Fetch appointments in range + their service promo lines
    // Use explicit column selection to avoid ambiguous relationship errors
    let apptQuery = getSupabase()
      .from('appointments')
      .select(`
        id,
        client_id,
        store_id,
        start_at,
        amount,
        promo_id,
        appointment_services ( promo_id )
      `)
      .eq('business_id', businessId)
      .gte('start_at', startDate.toISOString())
      .lt('start_at', endDate.toISOString())
      .or('is_deleted.eq.false,is_deleted.is.null');

    if (storeId) apptQuery = apptQuery.eq('store_id', storeId);

    const { data: appts, error: apptError } = await apptQuery;
    if (apptError || !appts) {
      console.log('[PromotionRedemptionsService] rows appt_services fallback error:', apptError?.message);
      return { data: [], error: null };
    }

    // Collect all unique client IDs + store IDs + promo IDs for bulk lookups
    const clientIds = new Set<string>();
    const storeIds = new Set<string>();
    const promoIds = new Set<string>();

    for (const a of appts as Record<string, unknown>[]) {
      if (a.client_id) clientIds.add(a.client_id as string);
      if (a.store_id) storeIds.add(a.store_id as string);
      if (a.promo_id) promoIds.add(a.promo_id as string);
      const svc = a.appointment_services as Array<{ promo_id: string | null }> | null;
      svc?.forEach(s => { if (s.promo_id) promoIds.add(s.promo_id); });
    }

    // Bulk fetch client names
    const clientMap: Record<string, string> = {};
    if (clientIds.size > 0) {
      const { data: clients } = await getSupabase()
        .from('clients')
        .select('id, name')
        .in('id', [...clientIds]);
      (clients || []).forEach((c: Record<string, unknown>) => {
        clientMap[c.id as string] = c.name as string;
      });
    }

    // Bulk fetch store names
    const storeMap: Record<string, string> = {};
    if (storeIds.size > 0) {
      const { data: storeRows } = await getSupabase()
        .from('stores')
        .select('id, name')
        .in('id', [...storeIds]);
      (storeRows || []).forEach((s: Record<string, unknown>) => {
        storeMap[s.id as string] = s.name as string;
      });
    }

    // Bulk fetch promotion titles
    const promoMap: Record<string, string> = {};
    if (promoIds.size > 0) {
      const { data: promos } = await getSupabase()
        .from('promotions')
        .select('id, title')
        .in('id', [...promoIds]);
      (promos || []).forEach((p: Record<string, unknown>) => {
        promoMap[p.id as string] = p.title as string;
      });
    }

    const rows: PromotionRedemptionRow[] = [];
    for (const a of appts as Array<{
      id: string;
      client_id: string;
      store_id: string | null;
      start_at: string;
      amount: number | null;
      promo_id: string | null;
      appointment_services: Array<{ promo_id: string | null }> | null;
    }>) {
      // Resolve effective promo: appointment-level first, then first service-level
      const svcPromoId = (a.appointment_services ?? []).find(s => s.promo_id)?.promo_id ?? null;
      const effectivePromoId = a.promo_id || svcPromoId;
      if (!effectivePromoId) continue;
      if (promotionId && effectivePromoId !== promotionId) continue;

      rows.push({
        id:          a.id,
        client_id:   a.client_id,
        client_name: clientMap[a.client_id] || null,
        store_id:    a.store_id,
        store_name:  a.store_id ? (storeMap[a.store_id] || null) : null,
        promo_id:    effectivePromoId,
        promo_name:  promoMap[effectivePromoId] || null,
        promo_color: null,
        redeemed_at: a.start_at,
        amount:      a.amount,
      });
    }

    // Sort by redeemed_at desc
    rows.sort((a, b) => new Date(b.redeemed_at).getTime() - new Date(a.redeemed_at).getTime());

    console.log('[PromotionRedemptionsService] rows via appt_services fallback:', rows.length,
      '| business:', businessId,
      '| store:', storeId || 'ALL');
    return { data: rows, error: null };
  } catch (err) {
    console.log('[PromotionRedemptionsService] rows appt_services fallback exception:', err);
    return { data: [], error: null };
  }
}

// ============================================
// Client promotion history
// ============================================

export async function getClientPromotionsUsed(
  businessId: string,
  clientId: string
): Promise<ServiceResult<ClientPromotionUsed[]>> {
  try {
    const { data, error } = await getSupabase().rpc('get_client_promotions_used', {
      p_business_id: businessId,
      p_client_id:   clientId,
    });

    if (!error && data) {
      return { data: data as ClientPromotionUsed[], error: null };
    }

    console.log('[PromotionRedemptionsService] client RPC unavailable:', error?.message);
  } catch {
    // fall through
  }

  // Direct table fallback
  try {
    const { data, error } = await getSupabase()
      .from('promotion_redemptions')
      .select(`
        id, promotion_id, redeemed_at, store_id, final_amount, currency,
        promotions:promotion_id ( title, discount_type, discount_value ),
        stores:store_id ( name )
      `)
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .order('redeemed_at', { ascending: false });

    if (error) return { data: [], error: null };

    const transformed: ClientPromotionUsed[] = (data || []).map((r: Record<string, unknown>) => ({
      id:              r.id as string,
      promotion_id:    r.promotion_id as string,
      promotion_name:  (r.promotions as Record<string, unknown>)?.title as string || 'Unknown',
      promotion_color: '#6366F1',
      discount_type:   (r.promotions as Record<string, unknown>)?.discount_type  as string || 'other',
      discount_value:  (r.promotions as Record<string, unknown>)?.discount_value as number || 0,
      redeemed_at:     r.redeemed_at  as string,
      store_id:        r.store_id     as string | null,
      store_name:      (r.stores as Record<string, unknown>)?.name as string | null,
      final_amount:    r.final_amount as number | null,
      currency:        r.currency     as string || 'USD',
    }));
    return { data: transformed, error: null };
  } catch {
    return { data: [], error: null };
  }
}

// ============================================
// Breakdown by promotion
// ============================================

export async function getPromotionsBreakdown(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null
): Promise<ServiceResult<PromotionBreakdown[]>> {
  try {
    const { data, error } = await getSupabase().rpc('get_promotions_breakdown', {
      p_business_id: businessId,
      p_start_date:  startDate.toISOString(),
      p_end_date:    endDate.toISOString(),
      p_store_id:    storeId || null,
    });

    if (!error && data) return { data: data as PromotionBreakdown[], error: null };
    console.log('[PromotionRedemptionsService] breakdown RPC unavailable:', error?.message);
  } catch {
    // fall through
  }
  return { data: [], error: null };
}

// ============================================
// Time series
// ============================================

export async function getPromotionsTimeSeries(
  businessId: string,
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month' = 'day',
  storeId?: string | null
): Promise<ServiceResult<PromotionTimeSeries[]>> {
  try {
    const { data, error } = await getSupabase().rpc('get_promotions_time_series', {
      p_business_id: businessId,
      p_start_date:  startDate.toISOString(),
      p_end_date:    endDate.toISOString(),
      p_interval:    interval,
      p_store_id:    storeId || null,
    });

    if (!error && data) return { data: data as PromotionTimeSeries[], error: null };
    console.log('[PromotionRedemptionsService] timeseries RPC unavailable:', error?.message);
  } catch {
    // fall through
  }
  return { data: [], error: null };
}

// ============================================
// Manual redemption
// ============================================

export async function createManualRedemption(
  businessId: string,
  clientId: string,
  promotionId: string,
  storeId?: string | null,
  amount?: number | null,
  currency?: string,
  notes?: string
): Promise<ServiceResult<PromotionRedemption>> {
  try {
    const { data, error } = await getSupabase()
      .from('promotion_redemptions')
      .insert({
        business_id:  businessId,
        client_id:    clientId,
        promotion_id: promotionId,
        store_id:     storeId   || null,
        source:       'manual',
        source_id:    null,
        final_amount: amount    || null,
        currency:     currency  || 'USD',
        notes:        notes     || null,
      })
      .select()
      .single();

    if (error) return { data: null, error };
    return { data: data as PromotionRedemption, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to create redemption') };
  }
}
