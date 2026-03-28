/**
 * Loyalty Program Service
 *
 * Handles all Supabase operations for the loyalty program.
 * Includes settings, rewards, client loyalty, transactions, and redemptions.
 * All operations are scoped by business_id for multi-tenant security.
 */

import { getSupabase } from '@/lib/supabaseClient';

const getBackendUrl = (): string =>
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://localhost:3000';

// ============================================
// Types
// ============================================

export interface LoyaltySettings {
  id: string;
  business_id: string;
  is_enabled: boolean;
  points_per_dollar: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyReward {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  points_required: number;
  linked_service_id: string | null;
  credit_amount: number | null;
  notification_message: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClientLoyalty {
  id: string;
  business_id: string;
  client_id: string;
  is_enrolled: boolean;
  total_points: number;
  lifetime_points: number;
  created_at: string;
  updated_at: string;
}

export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'expired' | 'adjustment' | 'bonus' | 'appointment_reward';

export interface LoyaltyTransaction {
  id: string;
  business_id: string;
  client_id: string;
  points: number;
  transaction_type: LoyaltyTransactionType;
  source_type: string | null;
  source_id: string | null;
  reward_id: string | null;
  notes: string | null;
  revenue_amount: number | null;
  created_at: string;
}

export type RedemptionStatus = 'pending' | 'confirmed' | 'used' | 'cancelled';

export interface LoyaltyRedemption {
  id: string;
  business_id: string;
  client_id: string;
  reward_id: string;
  points_used: number;
  status: RedemptionStatus;
  redeemed_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  used_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Loyalty Settings Operations
// ============================================

/**
 * Get loyalty settings for a business
 */
export async function getLoyaltySettings(businessId: string): Promise<ServiceResult<LoyaltySettings>> {
  try {
    console.log('[LoyaltyService] getLoyaltySettings called:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('loyalty_settings')
      .select('id, business_id, is_enabled, points_per_dollar, created_at, updated_at')
      .eq('business_id', businessId)
      .maybeSingle();

    if (error) {
      console.log('[LoyaltyService] Error fetching loyalty settings:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Loyalty settings fetched:', data ? 'found' : 'not found');
    return { data: data as LoyaltySettings | null, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch loyalty settings'),
    };
  }
}

/**
 * Create or update loyalty settings for a business
 */
export async function upsertLoyaltySettings(
  businessId: string,
  settings: Partial<Omit<LoyaltySettings, 'id' | 'business_id' | 'created_at' | 'updated_at'>>
): Promise<ServiceResult<LoyaltySettings>> {
  try {
    console.log('[LoyaltyService] upsertLoyaltySettings called:', { businessId, settings });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const payload = {
      business_id: businessId,
      ...settings,
    };

    const { data, error } = await getSupabase()
      .from('loyalty_settings')
      .upsert(payload, { onConflict: 'business_id' })
      .select()
      .single();

    if (error) {
      console.log('[LoyaltyService] Error upserting loyalty settings:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Loyalty settings upserted:', data?.id);
    return { data: data as LoyaltySettings, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to upsert loyalty settings'),
    };
  }
}

// ============================================
// Loyalty Rewards Operations
// ============================================

/**
 * Get all loyalty rewards for a business
 */
export async function getLoyaltyRewards(businessId: string): Promise<ServiceResult<LoyaltyReward[]>> {
  try {
    console.log('[LoyaltyService] getLoyaltyRewards called:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('loyalty_rewards')
      .select('id, business_id, title, description, points_required, linked_service_id, credit_amount, notification_message, is_active, sort_order, created_at, updated_at')
      .eq('business_id', businessId)
      .order('points_required', { ascending: true });

    if (error) {
      console.log('[LoyaltyService] Error fetching loyalty rewards:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Loyalty rewards fetched:', data?.length ?? 0);
    return { data: data as LoyaltyReward[], error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch loyalty rewards'),
    };
  }
}

/**
 * Create a new loyalty reward
 */
export async function createLoyaltyReward(
  businessId: string,
  reward: Omit<LoyaltyReward, 'id' | 'business_id' | 'created_at' | 'updated_at'>
): Promise<ServiceResult<LoyaltyReward>> {
  try {
    console.log('[LoyaltyService] createLoyaltyReward called:', { businessId, title: reward.title });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('loyalty_rewards')
      .insert({
        business_id: businessId,
        ...reward,
      })
      .select()
      .single();

    if (error) {
      console.log('[LoyaltyService] Error creating loyalty reward:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Loyalty reward created:', data?.id);
    return { data: data as LoyaltyReward, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create loyalty reward'),
    };
  }
}

/**
 * Update a loyalty reward
 */
export async function updateLoyaltyReward(
  rewardId: string,
  updates: Partial<Omit<LoyaltyReward, 'id' | 'business_id' | 'created_at' | 'updated_at'>>
): Promise<ServiceResult<LoyaltyReward>> {
  try {
    console.log('[LoyaltyService] updateLoyaltyReward called:', { rewardId });

    const { data, error } = await getSupabase()
      .from('loyalty_rewards')
      .update(updates)
      .eq('id', rewardId)
      .select()
      .single();

    if (error) {
      console.log('[LoyaltyService] Error updating loyalty reward:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Loyalty reward updated:', data?.id);
    return { data: data as LoyaltyReward, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update loyalty reward'),
    };
  }
}

/**
 * Delete a loyalty reward
 */
export async function deleteLoyaltyReward(rewardId: string): Promise<ServiceResult<void>> {
  try {
    console.log('[LoyaltyService] deleteLoyaltyReward called:', { rewardId });

    const { error } = await getSupabase()
      .from('loyalty_rewards')
      .delete()
      .eq('id', rewardId);

    if (error) {
      console.log('[LoyaltyService] Error deleting loyalty reward:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Loyalty reward deleted:', rewardId);
    return { data: undefined, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete loyalty reward'),
    };
  }
}

// ============================================
// Client Loyalty Operations
// ============================================

/**
 * Get loyalty status for a specific client
 */
export async function getClientLoyalty(businessId: string, clientId: string): Promise<ServiceResult<ClientLoyalty>> {
  try {
    console.log('[LoyaltyService] getClientLoyalty called:', { businessId, clientId });

    if (!businessId || !clientId) {
      return { data: null, error: new Error('Business ID and Client ID required') };
    }

    const { data, error } = await getSupabase()
      .from('client_loyalty')
      .select('id, business_id, client_id, is_enrolled, total_points, lifetime_points, created_at, updated_at')
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) {
      console.log('[LoyaltyService] Error fetching client loyalty:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Client loyalty fetched:', data ? 'found' : 'not found');
    return { data: data as ClientLoyalty | null, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch client loyalty'),
    };
  }
}

/**
 * Get loyalty status for all clients in a business
 */
export async function getAllClientLoyalty(businessId: string): Promise<ServiceResult<ClientLoyalty[]>> {
  try {
    console.log('[LoyaltyService] getAllClientLoyalty called:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('client_loyalty')
      .select('id, business_id, client_id, is_enrolled, total_points, lifetime_points, created_at, updated_at')
      .eq('business_id', businessId)
      .order('total_points', { ascending: false });

    if (error) {
      console.log('[LoyaltyService] Error fetching all client loyalty:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] All client loyalty fetched:', data?.length ?? 0);
    return { data: data as ClientLoyalty[], error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch all client loyalty'),
    };
  }
}

/**
 * Enroll or update a client in the loyalty program
 */
export async function upsertClientLoyalty(
  businessId: string,
  clientId: string,
  updates: Partial<Omit<ClientLoyalty, 'id' | 'business_id' | 'client_id' | 'created_at' | 'updated_at'>>
): Promise<ServiceResult<ClientLoyalty>> {
  try {
    console.log('[LoyaltyService] upsertClientLoyalty called:', { businessId, clientId, updates });

    if (!businessId || !clientId) {
      return { data: null, error: new Error('Business ID and Client ID required') };
    }

    const payload = {
      business_id: businessId,
      client_id: clientId,
      ...updates,
    };

    const { data, error } = await getSupabase()
      .from('client_loyalty')
      .upsert(payload, { onConflict: 'business_id,client_id' })
      .select()
      .single();

    if (error) {
      console.log('[LoyaltyService] Error upserting client loyalty:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Client loyalty upserted:', data?.id);
    return { data: data as ClientLoyalty, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to upsert client loyalty'),
    };
  }
}

/**
 * Toggle client enrollment in loyalty program.
 * When enrolling (isEnrolled = true), fires a welcome email via the backend.
 */
export async function toggleClientLoyaltyEnrollment(
  businessId: string,
  clientId: string,
  isEnrolled: boolean
): Promise<ServiceResult<ClientLoyalty>> {
  const result = await upsertClientLoyalty(businessId, clientId, { is_enrolled: isEnrolled });

  // Fire enrollment welcome email (fire-and-forget)
  if (isEnrolled && result.data) {
    getSupabase().auth.getSession().then(({ data: sessionData }) => {
      const token = sessionData?.session?.access_token;
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;
      fetch(`${getBackendUrl()}/api/transactional/notify`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          business_id: businessId,
          client_id: clientId,
          event_type: 'loyalty_enrolled',
        }),
      }).catch(() => {/* silent */});
    }).catch(() => {/* silent */});
  }

  // Fire unenroll notification email (fire-and-forget)
  if (!isEnrolled && result.data) {
    getSupabase().auth.getSession().then(({ data: sessionData }) => {
      const token = sessionData?.session?.access_token;
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;
      fetch(`${getBackendUrl()}/api/transactional/notify`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          business_id: businessId,
          client_id: clientId,
          event_type: 'loyalty_unenrolled',
        }),
      }).catch(() => {/* silent */});
    }).catch(() => {/* silent */});
  }

  return result;
}

// ============================================
// Loyalty Transaction Operations
// ============================================

/**
 * Get loyalty transactions for a client
 */
export async function getClientLoyaltyTransactions(
  businessId: string,
  clientId: string,
  limit = 50
): Promise<ServiceResult<LoyaltyTransaction[]>> {
  try {
    console.log('[LoyaltyService] getClientLoyaltyTransactions called:', { businessId, clientId, limit });

    if (!businessId || !clientId) {
      return { data: null, error: new Error('Business ID and Client ID required') };
    }

    const { data, error } = await getSupabase()
      .from('loyalty_transactions')
      .select('id, business_id, client_id, points, points_delta, transaction_type, source_type, source_id, reward_id, notes, revenue_amount, created_at')
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.log('[LoyaltyService] Error fetching loyalty transactions:', error.message);
      return { data: null, error };
    }

    // Normalize: old rows use points_delta + transaction_type='appointment_reward'
    // New rows use points + transaction_type='earned'/'redeemed'
    const normalized = (data ?? []).map((t) => {
      const resolvedPoints = t.points !== 0 ? t.points : ((t as Record<string, unknown>).points_delta as number ?? 0);
      let resolvedType = t.transaction_type;
      if (resolvedType === 'appointment_reward') resolvedType = 'earned';
      else if (resolvedType === 'adjustment' && resolvedPoints < 0) resolvedType = 'redeemed';
      return { ...t, points: resolvedPoints, transaction_type: resolvedType };
    });

    console.log('[LoyaltyService] Loyalty transactions fetched:', normalized.length);
    return { data: normalized as LoyaltyTransaction[], error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch loyalty transactions'),
    };
  }
}

/**
 * Get all loyalty transactions for a business (for analytics)
 */
export async function getBusinessLoyaltyTransactions(
  businessId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceResult<LoyaltyTransaction[]>> {
  try {
    console.log('[LoyaltyService] getBusinessLoyaltyTransactions called:', { businessId, startDate, endDate });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    let query = getSupabase()
      .from('loyalty_transactions')
      .select('id, business_id, client_id, points, points_delta, transaction_type, source_type, source_id, reward_id, notes, revenue_amount, created_at')
      .eq('business_id', businessId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.log('[LoyaltyService] Error fetching business loyalty transactions:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Business loyalty transactions fetched:', data?.length ?? 0);
    // Normalize: old rows use points_delta + transaction_type='appointment_reward'
    const normalized = (data ?? []).map((t) => {
      const resolvedPoints = t.points !== 0 ? t.points : ((t as Record<string, unknown>).points_delta as number ?? 0);
      let resolvedType = t.transaction_type;
      if (resolvedType === 'appointment_reward') resolvedType = 'earned';
      else if (resolvedType === 'adjustment' && resolvedPoints < 0) resolvedType = 'redeemed';
      return { ...t, points: resolvedPoints, transaction_type: resolvedType };
    });
    return { data: normalized as LoyaltyTransaction[], error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch business loyalty transactions'),
    };
  }
}

/**
 * Award points to a client (handles both transaction and balance update)
 */
export async function awardLoyaltyPoints(
  businessId: string,
  clientId: string,
  points: number,
  options: {
    source_type?: string;
    source_id?: string;
    revenue_amount?: number;
    notes?: string;
  } = {}
): Promise<ServiceResult<{ transaction: LoyaltyTransaction; clientLoyalty: ClientLoyalty }>> {
  try {
    console.log('[LoyaltyService] awardLoyaltyPoints called:', { businessId, clientId, points, options });

    if (!businessId || !clientId) {
      return { data: null, error: new Error('Business ID and Client ID required') };
    }

    if (points <= 0) {
      return { data: null, error: new Error('Points must be positive') };
    }

    // Check enrollment first — never auto-create a client_loyalty row
    const { data: existingLoyalty } = await getSupabase()
      .from('client_loyalty')
      .select('id, business_id, client_id, is_enrolled, total_points, lifetime_points, created_at, updated_at')
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (!existingLoyalty || !existingLoyalty.is_enrolled) {
      console.log('[LoyaltyService] Client not enrolled in loyalty program — skipping');
      return { data: null, error: new Error('Client is not enrolled in loyalty program') };
    }

    // Insert the transaction
    const transactionPayload = {
      business_id: businessId,
      client_id: clientId,
      points,
      points_delta: points,
      transaction_type: 'appointment_reward' as const,
      source_type: options.source_type ?? null,
      source_id: options.source_id ?? null,
      revenue_amount: options.revenue_amount ?? null,
      notes: options.notes ?? null,
    };

    const { data: transaction, error: transactionError } = await getSupabase()
      .from('loyalty_transactions')
      .insert(transactionPayload)
      .select()
      .single();

    if (transactionError) {
      console.log('[LoyaltyService] Error creating transaction:', transactionError.message);
      return { data: null, error: transactionError };
    }

    const newTotalPoints = (existingLoyalty.total_points ?? 0) + points;
    const newLifetimePoints = (existingLoyalty.lifetime_points ?? 0) + points;

    const { data: clientLoyalty, error: loyaltyError } = await getSupabase()
      .from('client_loyalty')
      .update({
        total_points: newTotalPoints,
        lifetime_points: newLifetimePoints,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingLoyalty.id)
      .select()
      .single();

    if (loyaltyError) {
      console.log('[LoyaltyService] Error updating client loyalty:', loyaltyError.message);
      return { data: null, error: loyaltyError };
    }

    console.log('[LoyaltyService] Points awarded successfully:', { points, newTotalPoints });
    return {
      data: {
        transaction: transaction as LoyaltyTransaction,
        clientLoyalty: clientLoyalty as ClientLoyalty,
      },
      error: null,
    };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to award points'),
    };
  }
}

/**
 * Deduct points from a client (for redemption)
 */
export async function deductLoyaltyPoints(
  businessId: string,
  clientId: string,
  points: number,
  options: {
    reward_id?: string;
    notes?: string;
  } = {}
): Promise<ServiceResult<{ transaction: LoyaltyTransaction; clientLoyalty: ClientLoyalty }>> {
  try {
    console.log('[LoyaltyService] deductLoyaltyPoints called:', { businessId, clientId, points, options });

    if (!businessId || !clientId) {
      return { data: null, error: new Error('Business ID and Client ID required') };
    }

    if (points <= 0) {
      return { data: null, error: new Error('Points must be positive') };
    }

    // Check if client has enough points
    const { data: existingLoyalty } = await getSupabase()
      .from('client_loyalty')
      .select('id, business_id, client_id, is_enrolled, total_points, lifetime_points, created_at, updated_at')
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (!existingLoyalty || existingLoyalty.total_points < points) {
      return { data: null, error: new Error('Insufficient points') };
    }

    // Insert the transaction (negative points for redemption)
    const transactionPayload = {
      business_id: businessId,
      client_id: clientId,
      points: -points,
      transaction_type: 'adjustment' as const,
      reward_id: options.reward_id ?? null,
      notes: options.notes ?? null,
    };

    const { data: transaction, error: transactionError } = await getSupabase()
      .from('loyalty_transactions')
      .insert(transactionPayload)
      .select()
      .single();

    if (transactionError) {
      console.log('[LoyaltyService] Error creating transaction:', transactionError.message);
      return { data: null, error: transactionError };
    }

    // Update client loyalty balance
    const newTotalPoints = existingLoyalty.total_points - points;

    const { data: clientLoyalty, error: loyaltyError } = await getSupabase()
      .from('client_loyalty')
      .update({ total_points: newTotalPoints })
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .select()
      .single();

    if (loyaltyError) {
      console.log('[LoyaltyService] Error updating client loyalty:', loyaltyError.message);
      return { data: null, error: loyaltyError };
    }

    console.log('[LoyaltyService] Points deducted successfully:', { points, newTotalPoints });
    return {
      data: {
        transaction: transaction as LoyaltyTransaction,
        clientLoyalty: clientLoyalty as ClientLoyalty,
      },
      error: null,
    };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to deduct points'),
    };
  }
}

// ============================================
// Loyalty Redemption Operations
// ============================================

/**
 * Get redemptions for a client
 */
export async function getClientRedemptions(
  businessId: string,
  clientId: string
): Promise<ServiceResult<LoyaltyRedemption[]>> {
  try {
    console.log('[LoyaltyService] getClientRedemptions called:', { businessId, clientId });

    if (!businessId || !clientId) {
      return { data: null, error: new Error('Business ID and Client ID required') };
    }

    const { data, error } = await getSupabase()
      .from('loyalty_redemptions')
      .select('id, business_id, client_id, reward_id, points_used, status, redeemed_at, confirmed_at, confirmed_by, used_at, notes, created_at, updated_at')
      .eq('business_id', businessId)
      .eq('client_id', clientId)
      .order('redeemed_at', { ascending: false });

    if (error) {
      console.log('[LoyaltyService] Error fetching client redemptions:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Client redemptions fetched:', data?.length ?? 0);
    return { data: data as LoyaltyRedemption[], error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch client redemptions'),
    };
  }
}

/**
 * Get all pending redemptions for a business
 */
export async function getPendingRedemptions(businessId: string): Promise<ServiceResult<LoyaltyRedemption[]>> {
  try {
    console.log('[LoyaltyService] getPendingRedemptions called:', { businessId });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('loyalty_redemptions')
      .select('id, business_id, client_id, reward_id, points_used, status, redeemed_at, confirmed_at, confirmed_by, used_at, notes, created_at, updated_at')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .order('redeemed_at', { ascending: true });

    if (error) {
      console.log('[LoyaltyService] Error fetching pending redemptions:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Pending redemptions fetched:', data?.length ?? 0);
    return { data: data as LoyaltyRedemption[], error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch pending redemptions'),
    };
  }
}

/**
 * Get all non-cancelled redemptions for a business (for analytics detail view)
 */
export async function getBusinessAllRedemptions(businessId: string): Promise<ServiceResult<LoyaltyRedemption[]>> {
  try {
    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('loyalty_redemptions')
      .select('id, business_id, client_id, reward_id, points_used, status, redeemed_at, confirmed_at, confirmed_by, used_at, notes, created_at, updated_at')
      .eq('business_id', businessId)
      .neq('status', 'cancelled')
      .order('redeemed_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data as LoyaltyRedemption[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch business redemptions'),
    };
  }
}
export async function createRedemption(
  businessId: string,
  clientId: string,
  rewardId: string,
  pointsUsed: number,
  notes?: string
): Promise<ServiceResult<LoyaltyRedemption>> {
  try {
    console.log('[LoyaltyService] createRedemption called:', { businessId, clientId, rewardId, pointsUsed });

    if (!businessId || !clientId || !rewardId) {
      return { data: null, error: new Error('Business ID, Client ID, and Reward ID required') };
    }

    // First deduct points
    const deductResult = await deductLoyaltyPoints(businessId, clientId, pointsUsed, {
      reward_id: rewardId,
      notes: `Redeemed for reward`,
    });

    if (deductResult.error) {
      return { data: null, error: deductResult.error };
    }

    // Create redemption record
    const { data, error } = await getSupabase()
      .from('loyalty_redemptions')
      .insert({
        business_id: businessId,
        client_id: clientId,
        reward_id: rewardId,
        points_used: pointsUsed,
        status: 'pending' as const,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.log('[LoyaltyService] Error creating redemption:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Redemption created:', data?.id);

    // Fire redemption confirmation email (fire-and-forget)
    // Fetch reward title for the email
    Promise.all([
      getSupabase().from('loyalty_rewards').select('title').eq('id', rewardId).maybeSingle(),
      getSupabase().auth.getSession(),
    ]).then(([{ data: reward }, { data: sessionData }]) => {
      const token = sessionData?.session?.access_token;
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;
      fetch(`${getBackendUrl()}/api/transactional/notify`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          business_id: businessId,
          client_id: clientId,
          event_type: 'loyalty_points_redeemed',
          points_used: pointsUsed,
          points_balance: deductResult.data?.clientLoyalty.total_points ?? 0,
          reward_title: reward?.title ?? 'Reward',
        }),
      }).catch(() => {/* silent */});
    }).catch(() => {/* silent */});

    return { data: data as LoyaltyRedemption, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create redemption'),
    };
  }
}

/**
 * Update redemption status
 */
export async function updateRedemptionStatus(
  redemptionId: string,
  status: RedemptionStatus,
  confirmedBy?: string
): Promise<ServiceResult<LoyaltyRedemption>> {
  try {
    console.log('[LoyaltyService] updateRedemptionStatus called:', { redemptionId, status });

    const updates: Partial<LoyaltyRedemption> = { status };

    if (status === 'confirmed') {
      updates.confirmed_at = new Date().toISOString();
      if (confirmedBy) {
        updates.confirmed_by = confirmedBy;
      }
    } else if (status === 'used') {
      updates.used_at = new Date().toISOString();
    }

    const { data, error } = await getSupabase()
      .from('loyalty_redemptions')
      .update(updates)
      .eq('id', redemptionId)
      .select()
      .single();

    if (error) {
      console.log('[LoyaltyService] Error updating redemption:', error.message);
      return { data: null, error };
    }

    console.log('[LoyaltyService] Redemption updated:', data?.id);
    return { data: data as LoyaltyRedemption, error: null };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update redemption'),
    };
  }
}

// ============================================
// Analytics Helper Functions
// ============================================

/**
 * Get loyalty analytics for a business
 */
export async function getLoyaltyAnalytics(
  businessId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceResult<{
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalRewardsRedeemed: number;
  activeMembersCount: number;
  topLoyaltyClients: Array<{ client_id: string; total_points: number; lifetime_points: number }>;
}>> {
  try {
    console.log('[LoyaltyService] getLoyaltyAnalytics called:', { businessId, startDate, endDate });

    if (!businessId) {
      return { data: null, error: new Error('No business ID provided') };
    }

    // Get transactions for period
    const { data: transactions, error: transError } = await getBusinessLoyaltyTransactions(businessId, startDate, endDate);
    if (transError) {
      return { data: null, error: transError };
    }

    const totalPointsIssued = (transactions ?? [])
      .filter(t => t.transaction_type === 'earned' || t.transaction_type === 'bonus')
      .reduce((sum, t) => sum + t.points, 0);

    const totalPointsRedeemed = Math.abs((transactions ?? [])
      .filter(t => t.transaction_type === 'redeemed')
      .reduce((sum, t) => sum + t.points, 0));

    // Get total rewards redeemed
    let redemptionsQuery = getSupabase()
      .from('loyalty_redemptions')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .neq('status', 'cancelled');

    if (startDate) {
      redemptionsQuery = redemptionsQuery.gte('redeemed_at', startDate.toISOString());
    }
    if (endDate) {
      redemptionsQuery = redemptionsQuery.lte('redeemed_at', endDate.toISOString());
    }

    const { count: totalRewardsRedeemed } = await redemptionsQuery;

    // Get active members count
    const { count: activeMembersCount } = await getSupabase()
      .from('client_loyalty')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .eq('is_enrolled', true);

    // Get top loyalty clients — ordered by current points balance (total_points)
    const { data: topClients } = await getSupabase()
      .from('client_loyalty')
      .select('client_id, total_points, lifetime_points')
      .eq('business_id', businessId)
      .eq('is_enrolled', true)
      .order('total_points', { ascending: false })
      .limit(10);

    return {
      data: {
        totalPointsIssued,
        totalPointsRedeemed,
        totalRewardsRedeemed: totalRewardsRedeemed ?? 0,
        activeMembersCount: activeMembersCount ?? 0,
        topLoyaltyClients: (topClients ?? []) as Array<{ client_id: string; total_points: number; lifetime_points: number }>,
      },
      error: null,
    };
  } catch (err) {
    console.log('[LoyaltyService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to get loyalty analytics'),
    };
  }
}
