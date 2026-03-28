import { getSupabase } from '@/lib/supabaseClient';
import type { GiftCard, GiftCardTransaction, GiftCardSettings, GiftCardType, GiftCardStatus, GiftCardService } from '@/lib/types';

// ============================================
// Gift Card Code Generation
// ============================================

/**
 * Generate a secure, non-guessable gift card code
 * Format: GC-XXXX-XXXX-XXXX (alphanumeric, no confusing chars)
 */
export function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing: I, O, 0, 1
  const segments = 3;
  const segmentLength = 4;

  const generateSegment = () => {
    let segment = '';
    for (let i = 0; i < segmentLength; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return segment;
  };

  const code = Array(segments).fill(null).map(generateSegment).join('-');
  return `GC-${code}`;
}

/**
 * Validate gift card code format
 */
export function isValidGiftCardCode(code: string): boolean {
  const pattern = /^GC-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
  return pattern.test(code);
}

// ============================================
// Supabase Types
// ============================================

export interface SupabaseGiftCard {
  id: string;
  user_id: string;
  code: string;
  type: GiftCardType;
  status: GiftCardStatus;
  original_value: number | null;
  current_balance: number | null;
  currency: string | null;
  services: GiftCardService[] | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  purchaser_name: string | null;
  personal_message: string | null;
  client_id: string | null;
  store_id: string | null;
  created_by_user_id: string | null;
  issued_at: string;
  expires_at: string | null;
  first_used_at: string | null;
  fully_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseGiftCardTransaction {
  id: string;
  gift_card_id: string;
  user_id: string;
  client_id: string | null;
  type: 'redemption' | 'refund' | 'adjustment' | 'purchase' | 'sale';
  amount: number | null;
  balance_before: number | null;
  balance_after: number | null;
  service_id: string | null;
  service_name: string | null;
  quantity_used: number | null;
  appointment_id: string | null;
  visit_id: string | null;
  notes: string | null;
  created_at: string;
}

// ============================================
// Conversion Functions
// ============================================

export function supabaseToGiftCard(row: SupabaseGiftCard): GiftCard {
  return {
    id: row.id,
    userId: row.user_id,
    code: row.code,
    type: row.type,
    status: row.status,
    originalValue: row.original_value ?? undefined,
    currentBalance: row.current_balance ?? undefined,
    currency: row.currency ?? undefined,
    services: row.services ?? undefined,
    recipientName: row.recipient_name ?? undefined,
    recipientEmail: row.recipient_email ?? undefined,
    recipientPhone: row.recipient_phone ?? undefined,
    purchaserName: row.purchaser_name ?? undefined,
    personalMessage: row.personal_message ?? undefined,
    clientId: row.client_id ?? undefined,
    storeId: row.store_id ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    issuedAt: new Date(row.issued_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    firstUsedAt: row.first_used_at ? new Date(row.first_used_at) : undefined,
    fullyUsedAt: row.fully_used_at ? new Date(row.fully_used_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function supabaseToGiftCardTransaction(row: SupabaseGiftCardTransaction): GiftCardTransaction {
  return {
    id: row.id,
    giftCardId: row.gift_card_id,
    userId: row.user_id,
    clientId: row.client_id ?? undefined,
    type: row.type,
    amount: row.amount ?? undefined,
    balanceBefore: row.balance_before ?? undefined,
    balanceAfter: row.balance_after ?? undefined,
    serviceId: row.service_id ?? undefined,
    serviceName: row.service_name ?? undefined,
    quantityUsed: row.quantity_used ?? undefined,
    appointmentId: row.appointment_id ?? undefined,
    visitId: row.visit_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

// ============================================
// Gift Card CRUD Operations
// ============================================

// UUID validation helper
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Fetch all gift cards for a business
 */
export async function fetchGiftCards(businessId: string): Promise<GiftCard[]> {
  // Validate UUID format before querying Supabase
  if (!isValidUUID(businessId)) {
    console.warn('[GiftCard] Invalid business ID format (not a UUID):', businessId);
    return []; // Return empty array instead of throwing
  }

  const { data, error } = await getSupabase()
    .from('gift_cards')
    .select('id, user_id, code, type, status, original_value, current_balance, currency, services, recipient_name, recipient_email, recipient_phone, purchaser_name, personal_message, client_id, store_id, created_by_user_id, issued_at, expires_at, first_used_at, fully_used_at, created_at, updated_at')
    .eq('user_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42704' || error.message?.includes('app.current_business_id')) {
      console.error('[GiftCard] Gift cards RLS policy is broken (error 42704). Apply the fix at: POST /api/migrations/fix-gift-cards-rls or GET /api/migrations/fix-gift-cards-rls for SQL to run manually.');
      return [];
    }
    console.error('[GiftCard] Error fetching gift cards:', error.code, error.message);
    throw error;
  }

  return (data || []).map(supabaseToGiftCard);
}

/**
 * Fetch a single gift card by ID
 */
export async function fetchGiftCardById(id: string): Promise<GiftCard | null> {
  const { data, error } = await getSupabase()
    .from('gift_cards')
    .select('id, user_id, code, type, status, original_value, current_balance, currency, services, recipient_name, recipient_email, recipient_phone, purchaser_name, personal_message, client_id, store_id, created_by_user_id, issued_at, expires_at, first_used_at, fully_used_at, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    if (error.code === '42704' || error.message?.includes('app.current_business_id')) {
      console.warn('[GiftCard] Gift cards RLS not configured, returning null');
      return null;
    }
    console.error('[GiftCard] Error fetching gift card:', error);
    throw error;
  }

  return data ? supabaseToGiftCard(data) : null;
}

/**
 * Fetch a gift card by code
 */
export async function fetchGiftCardByCode(code: string, userId: string): Promise<GiftCard | null> {
  const { data, error } = await getSupabase()
    .from('gift_cards')
    .select('id, user_id, code, type, status, original_value, current_balance, currency, services, recipient_name, recipient_email, recipient_phone, purchaser_name, personal_message, client_id, store_id, created_by_user_id, issued_at, expires_at, first_used_at, fully_used_at, created_at, updated_at')
    .eq('code', code.toUpperCase())
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    if (error.code === '42704' || error.message?.includes('app.current_business_id')) {
      console.warn('[GiftCard] Gift cards RLS not configured, returning null');
      return null;
    }
    console.error('[GiftCard] Error fetching gift card by code:', error);
    throw error;
  }

  return data ? supabaseToGiftCard(data) : null;
}

/**
 * Fetch gift cards for a specific client
 */
export async function fetchClientGiftCards(clientId: string, userId: string): Promise<GiftCard[]> {
  const { data, error } = await getSupabase()
    .from('gift_cards')
    .select('id, user_id, code, type, status, original_value, current_balance, currency, services, recipient_name, recipient_email, recipient_phone, purchaser_name, personal_message, client_id, store_id, created_by_user_id, issued_at, expires_at, first_used_at, fully_used_at, created_at, updated_at')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42704' || error.message?.includes('app.current_business_id')) {
      console.warn('[GiftCard] Gift cards RLS not configured, returning empty array');
      return [];
    }
    console.error('[GiftCard] Error fetching client gift cards:', error);
    throw error;
  }

  return (data || []).map(supabaseToGiftCard);
}

/**
 * Issue a new gift card via backend endpoint (bypasses RLS safely)
 * Requires a Supabase session token for authentication.
 */
export async function issueGiftCard(
  businessId: string,
  token: string,
  data: {
    type: GiftCardType;
    originalValue?: number;
    currency?: string;
    services?: GiftCardService[];
    recipientName?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    personalMessage?: string;
    clientId?: string;
    expiresAt?: Date;
    storeId?: string;
    designColor?: string;
  }
): Promise<GiftCard> {
  const backendUrl =
    (process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      'http://localhost:3000');

  const res = await fetch(`${backendUrl}/api/gift-cards/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      businessId,
      type: data.type,
      originalValue: data.originalValue,
      currency: data.currency,
      services: data.services,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      personalMessage: data.personalMessage,
      clientId: data.clientId,
      expiresAt: data.expiresAt?.toISOString(),
      storeId: data.storeId,
      designColor: data.designColor,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    const msg = errBody?.error || `HTTP ${res.status}`;
    console.error('[GiftCard] issueGiftCard backend error:', msg);
    throw new Error(msg);
  }

  const json = await res.json() as { success: boolean; data: SupabaseGiftCard };
  return supabaseToGiftCard(json.data);
}

/**
 * Create a new gift card (legacy - direct Supabase insert, kept for compatibility)
 * @deprecated Use issueGiftCard instead which uses the backend endpoint to bypass RLS
 */
export async function createGiftCard(
  userId: string,
  data: {
    type: GiftCardType;
    originalValue?: number;
    currency?: string;
    services?: GiftCardService[];
    recipientName?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    purchaserName?: string;
    personalMessage?: string;
    clientId?: string;
    expiresAt?: Date;
  }
): Promise<GiftCard> {
  // Generate unique code (with retry for uniqueness)
  let code = generateGiftCardCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existing = await fetchGiftCardByCode(code, userId);
    if (!existing) break;
    code = generateGiftCardCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique gift card code');
  }

  const now = new Date().toISOString();

  const insertData: Partial<SupabaseGiftCard> = {
    user_id: userId,
    code,
    type: data.type,
    status: 'active',
    original_value: data.originalValue ?? null,
    current_balance: data.originalValue ?? null,
    currency: data.currency ?? null,
    services: data.services ?? null,
    recipient_name: data.recipientName ?? null,
    recipient_email: data.recipientEmail ?? null,
    recipient_phone: data.recipientPhone ?? null,
    purchaser_name: data.purchaserName ?? null,
    personal_message: data.personalMessage ?? null,
    client_id: data.clientId ?? null,
    issued_at: now,
    expires_at: data.expiresAt?.toISOString() ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data: result, error } = await getSupabase()
    .from('gift_cards')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[GiftCard] Error creating gift card:', error);
    throw error;
  }

  return supabaseToGiftCard(result);
}

/**
 * Update a gift card
 */
export async function updateGiftCard(
  id: string,
  updates: Partial<{
    status: GiftCardStatus;
    currentBalance: number;
    services: GiftCardService[];
    clientId: string | null;
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string;
    personalMessage: string;
    firstUsedAt: Date;
    fullyUsedAt: Date;
  }>
): Promise<GiftCard> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.currentBalance !== undefined) updateData.current_balance = updates.currentBalance;
  if (updates.services !== undefined) updateData.services = updates.services;
  if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
  if (updates.recipientName !== undefined) updateData.recipient_name = updates.recipientName;
  if (updates.recipientEmail !== undefined) updateData.recipient_email = updates.recipientEmail;
  if (updates.recipientPhone !== undefined) updateData.recipient_phone = updates.recipientPhone;
  if (updates.personalMessage !== undefined) updateData.personal_message = updates.personalMessage;
  if (updates.firstUsedAt !== undefined) updateData.first_used_at = updates.firstUsedAt.toISOString();
  if (updates.fullyUsedAt !== undefined) updateData.fully_used_at = updates.fullyUsedAt.toISOString();

  const { data, error } = await getSupabase()
    .from('gift_cards')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[GiftCard] Error updating gift card:', error);
    throw error;
  }

  return supabaseToGiftCard(data);
}

/**
 * Delete a gift card (soft delete by setting status to cancelled)
 */
export async function deleteGiftCard(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('gift_cards')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[GiftCard] Error deleting gift card:', error);
    throw error;
  }
}

// ============================================
// Gift Card Redemption
// ============================================

/**
 * Redeem value from a gift card
 */
export async function redeemGiftCardValue(
  giftCardId: string,
  amount: number,
  context: {
    clientId?: string;
    appointmentId?: string;
    visitId?: string;
    notes?: string;
    appointmentDate?: string;
    serviceName?: string;
  }
): Promise<{ giftCard: GiftCard; transaction: GiftCardTransaction }> {
  // IDEMPOTENCY: if a redemption transaction already exists for this appointment+giftCard, return it
  if (context.appointmentId) {
    const { data: existingTx } = await getSupabase()
      .from('gift_card_transactions')
      .select('id, gift_card_id, user_id, client_id, type, amount, balance_before, balance_after, service_id, service_name, quantity_used, appointment_id, visit_id, notes, created_at')
      .eq('gift_card_id', giftCardId)
      .eq('appointment_id', context.appointmentId)
      .eq('type', 'redemption')
      .maybeSingle();
    if (existingTx) {
      console.log('[GiftCard] Redemption already exists for appointment, skipping duplicate debit:', context.appointmentId);
      const giftCard = await fetchGiftCardById(giftCardId);
      if (!giftCard) throw new Error('Gift card not found');
      return { giftCard, transaction: supabaseToGiftCardTransaction(existingTx) };
    }
  }

  // Fetch current gift card
  const giftCard = await fetchGiftCardById(giftCardId);
  if (!giftCard) {
    throw new Error('Gift card not found');
  }

  if (giftCard.type !== 'value') {
    throw new Error('This is not a value-based gift card');
  }

  if (giftCard.status !== 'active') {
    throw new Error(`Gift card is ${giftCard.status}`);
  }

  if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
    // Mark as expired
    await updateGiftCard(giftCardId, { status: 'expired' });
    throw new Error('Gift card has expired');
  }

  const currentBalance = giftCard.currentBalance || 0;
  // Allow partial use: cap deduction at available balance (mirrors backend Math.min behavior)
  const effectiveAmount = Math.min(amount, currentBalance);
  if (effectiveAmount <= 0) {
    throw new Error('Gift card has no remaining balance');
  }

  const newBalance = currentBalance - effectiveAmount;
  const isFullyUsed = newBalance <= 0;
  const now = new Date();

  // Update gift card
  const updatedGiftCard = await updateGiftCard(giftCardId, {
    currentBalance: newBalance,
    status: isFullyUsed ? 'fully_used' : 'active',
    clientId: context.clientId || giftCard.clientId,
    firstUsedAt: giftCard.firstUsedAt || now,
    fullyUsedAt: isFullyUsed ? now : undefined,
  });

  // Create transaction record
  const transactionData = {
    gift_card_id: giftCardId,
    user_id: giftCard.userId,
    client_id: context.clientId ?? null,
    type: 'redemption' as const,
    amount: effectiveAmount,
    balance_before: currentBalance,
    balance_after: newBalance,
    appointment_id: context.appointmentId ?? null,
    visit_id: context.visitId ?? null,
    notes: context.notes ?? null,
    created_at: now.toISOString(),
  };

  const { data: txData, error: txError } = await getSupabase()
    .from('gift_card_transactions')
    .insert(transactionData)
    .select()
    .single();

  if (txError) {
    console.error('[GiftCard] Error creating transaction:', txError);
    throw txError;
  }

  return {
    giftCard: updatedGiftCard,
    transaction: supabaseToGiftCardTransaction(txData),
  };
}

/**
 * Redeem a service from a gift card
 */
export async function redeemGiftCardService(
  giftCardId: string,
  serviceId: string,
  quantity: number = 1,
  context: {
    clientId?: string;
    appointmentId?: string;
    visitId?: string;
    notes?: string;
  }
): Promise<{ giftCard: GiftCard; transaction: GiftCardTransaction }> {
  // Fetch current gift card
  const giftCard = await fetchGiftCardById(giftCardId);
  if (!giftCard) {
    throw new Error('Gift card not found');
  }

  if (giftCard.type !== 'service') {
    throw new Error('This is not a service-based gift card');
  }

  if (giftCard.status !== 'active') {
    throw new Error(`Gift card is ${giftCard.status}`);
  }

  if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
    await updateGiftCard(giftCardId, { status: 'expired' });
    throw new Error('Gift card has expired');
  }

  const services = giftCard.services || [];
  const serviceIndex = services.findIndex(s => s.serviceId === serviceId);

  if (serviceIndex === -1) {
    throw new Error('Service not found on this gift card');
  }

  const service = services[serviceIndex];
  const availableQuantity = service.quantity - service.usedQuantity;

  if (quantity > availableQuantity) {
    throw new Error(`Insufficient service quantity. Available: ${availableQuantity}`);
  }

  // Update service usage
  const updatedServices = [...services];
  updatedServices[serviceIndex] = {
    ...service,
    usedQuantity: service.usedQuantity + quantity,
  };

  // Check if all services are fully used
  const isFullyUsed = updatedServices.every(s => s.usedQuantity >= s.quantity);
  const now = new Date();

  // Update gift card
  const updatedGiftCard = await updateGiftCard(giftCardId, {
    services: updatedServices,
    status: isFullyUsed ? 'fully_used' : 'active',
    clientId: context.clientId || giftCard.clientId,
    firstUsedAt: giftCard.firstUsedAt || now,
    fullyUsedAt: isFullyUsed ? now : undefined,
  });

  // Create transaction record
  const transactionData = {
    gift_card_id: giftCardId,
    user_id: giftCard.userId,
    client_id: context.clientId ?? null,
    type: 'redemption' as const,
    service_id: serviceId,
    service_name: service.serviceName,
    quantity_used: quantity,
    appointment_id: context.appointmentId ?? null,
    visit_id: context.visitId ?? null,
    notes: context.notes ?? null,
    created_at: now.toISOString(),
  };

  const { data: txData, error: txError } = await getSupabase()
    .from('gift_card_transactions')
    .insert(transactionData)
    .select()
    .single();

  if (txError) {
    console.error('[GiftCard] Error creating transaction:', txError);
    throw txError;
  }

  return {
    giftCard: updatedGiftCard,
    transaction: supabaseToGiftCardTransaction(txData),
  };
}

/**
 * Fetch the redemption transaction for a specific appointment.
 * Queries by appointment_id alone (no gift_card_id required) so it works
 * even if the appointment's gift_card_id isn't yet populated on the client.
 * Used by View Appointment to derive the exact deducted amount from the real record.
 */
export async function fetchGiftCardRedemptionByAppointment(
  giftCardId: string | null | undefined,
  appointmentId: string
): Promise<GiftCardTransaction | null> {
  // Primary: query by appointment_id only (most robust)
  let query = getSupabase()
    .from('gift_card_transactions')
    .select('id, gift_card_id, user_id, client_id, type, amount, balance_before, balance_after, service_id, service_name, quantity_used, appointment_id, visit_id, notes, created_at')
    .eq('appointment_id', appointmentId)
    .eq('type', 'redemption')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn('[GiftCard] Error fetching redemption by appointment_id:', error.message, 'appointmentId:', appointmentId);
    return null;
  }

  if (data) {
    console.log('[GiftCard] Redemption found by appointment_id:', appointmentId, 'amount:', data.amount);
    return supabaseToGiftCardTransaction(data);
  }

  // Fallback: query by gift_card_id + appointment_id if provided
  if (giftCardId) {
    const { data: data2, error: error2 } = await getSupabase()
      .from('gift_card_transactions')
      .select('id, gift_card_id, user_id, client_id, type, amount, balance_before, balance_after, service_id, service_name, quantity_used, appointment_id, visit_id, notes, created_at')
      .eq('gift_card_id', giftCardId)
      .eq('appointment_id', appointmentId)
      .eq('type', 'redemption')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error2) {
      console.warn('[GiftCard] Error fetching redemption by gift_card_id:', error2.message);
      return null;
    }

    if (data2) {
      console.log('[GiftCard] Redemption found by gift_card_id:', giftCardId, 'amount:', data2.amount);
      return supabaseToGiftCardTransaction(data2);
    }
  }

  console.log('[GiftCard] No redemption found for appointmentId:', appointmentId, 'giftCardId:', giftCardId ?? 'none');
  return null;
}

/**
 * Fetch transactions for a gift card
 */
export async function fetchGiftCardTransactions(giftCardId: string): Promise<GiftCardTransaction[]> {
  const { data, error } = await getSupabase()
    .from('gift_card_transactions')
    .select('id, gift_card_id, user_id, client_id, type, amount, balance_before, balance_after, service_id, service_name, quantity_used, appointment_id, visit_id, notes, created_at')
    .eq('gift_card_id', giftCardId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GiftCard] Error fetching transactions:', error);
    throw error;
  }

  return (data || []).map(supabaseToGiftCardTransaction);
}

/**
 * Fetch all transactions for a client's gift cards.
 * Fetches by gift_card_id for each gift card linked to the client,
 * guaranteeing purchase events and redemptions are all returned.
 */
export async function fetchClientGiftCardTransactionsByCards(
  clientId: string,
  userId: string
): Promise<GiftCardTransaction[]> {
  // First get all gift cards for this client
  const giftCards = await fetchClientGiftCards(clientId, userId);
  if (giftCards.length === 0) return [];

  const giftCardIds = giftCards.map(gc => gc.id);

  const { data, error } = await getSupabase()
    .from('gift_card_transactions')
    .select('id, gift_card_id, user_id, client_id, type, amount, balance_before, balance_after, service_id, service_name, quantity_used, appointment_id, visit_id, notes, created_at')
    .in('gift_card_id', giftCardIds)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42704' || error.message?.includes('app.current_business_id')) {
      console.warn('[GiftCard] Gift card transactions RLS not configured, returning empty array');
      return [];
    }
    console.error('[GiftCard] Error fetching client card transactions:', error);
    throw error;
  }

  return (data || []).map(supabaseToGiftCardTransaction);
}


/**
 * Fetch all transactions for a client (by client_id on the transaction record)
 */
export async function fetchClientGiftCardTransactions(
  clientId: string,
  userId: string
): Promise<GiftCardTransaction[]> {
  const { data, error } = await getSupabase()
    .from('gift_card_transactions')
    .select('id, gift_card_id, user_id, client_id, type, amount, balance_before, balance_after, service_id, service_name, quantity_used, appointment_id, visit_id, notes, created_at')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42704' || error.message?.includes('app.current_business_id')) {
      console.warn('[GiftCard] Gift card transactions RLS not configured, returning empty array');
      return [];
    }
    console.error('[GiftCard] Error fetching client transactions:', error);
    throw error;
  }

  return (data || []).map(supabaseToGiftCardTransaction);
}

/**
 * Check if a gift card is valid and usable
 */
export function isGiftCardUsable(giftCard: GiftCard): { usable: boolean; reason?: string } {
  if (giftCard.status === 'cancelled') {
    return { usable: false, reason: 'Gift card has been cancelled' };
  }

  if (giftCard.status === 'fully_used') {
    return { usable: false, reason: 'Gift card has been fully used' };
  }

  if (giftCard.status === 'expired') {
    return { usable: false, reason: 'Gift card has expired' };
  }

  if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
    return { usable: false, reason: 'Gift card has expired' };
  }

  if (giftCard.type === 'value') {
    if (!giftCard.currentBalance || giftCard.currentBalance <= 0) {
      return { usable: false, reason: 'Gift card has no remaining balance' };
    }
  }

  if (giftCard.type === 'service') {
    const hasAvailableServices = giftCard.services?.some(s => s.usedQuantity < s.quantity);
    if (!hasAvailableServices) {
      return { usable: false, reason: 'All services have been redeemed' };
    }
  }

  return { usable: true };
}

/**
 * Get gift card summary for display
 */
export function getGiftCardSummary(giftCard: GiftCard): string {
  if (giftCard.type === 'value') {
    return `$${giftCard.currentBalance?.toFixed(2) || '0.00'} remaining`;
  }

  if (giftCard.type === 'service') {
    const totalServices = giftCard.services?.reduce((sum, s) => sum + s.quantity, 0) || 0;
    const usedServices = giftCard.services?.reduce((sum, s) => sum + s.usedQuantity, 0) || 0;
    const remaining = totalServices - usedServices;
    return `${remaining} service${remaining !== 1 ? 's' : ''} remaining`;
  }

  return '';
}
