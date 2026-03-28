/**
 * Membership Program Service
 * Offline Payment Tracking System - NO payment processing
 *
 * All payments are collected offline by the business (in-store POS / cash / external processor)
 * This service only tracks membership status, dates, benefits, and usage
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

import {
  MembershipPlan,
  MembershipBenefit,
  ClientMembership,
  MembershipPayment,
  MembershipCreditTransaction,
  MembershipBenefitUsage,
  MembershipSettings,
  MembershipStatus,
  MembershipPaymentMethod,
  MembershipRenewalCycle,
} from '@/lib/types';

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate next renewal date based on cycle
 */
export function calculateNextRenewalDate(
  fromDate: Date,
  cycle: MembershipRenewalCycle,
  customDays?: number
): Date {
  const date = new Date(fromDate);

  switch (cycle) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'custom':
      if (customDays) {
        date.setDate(date.getDate() + customDays);
      } else {
        date.setMonth(date.getMonth() + 1); // Default to monthly
      }
      break;
  }

  return date;
}

/**
 * Check if membership is past due
 */
export function isMembershipPastDue(membership: ClientMembership): boolean {
  if (membership.status !== 'active') return false;
  return new Date(membership.nextRenewalDate) < new Date();
}

/**
 * Get membership status display info
 */
export function getMembershipStatusInfo(status: MembershipStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  const statusMap: Record<MembershipStatus, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: '#10B981', bgColor: '#10B98115' },
    past_due: { label: 'Past Due', color: '#F59E0B', bgColor: '#F59E0B15' },
    cancelled: { label: 'Cancelled', color: '#EF4444', bgColor: '#EF444415' },
    expired: { label: 'Expired', color: '#6B7280', bgColor: '#6B728015' },
    paused: { label: 'Paused', color: '#8B5CF6', bgColor: '#8B5CF615' },
  };
  return statusMap[status];
}

// ============================================
// Membership Settings (Business-level)
// ============================================

// UUID validation helper
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Get membership settings for a business
 */
export async function getMembershipSettings(businessId: string): Promise<MembershipSettings | null> {
  // Validate UUID format before querying Supabase
  if (!isValidUUID(businessId)) {
    console.warn('[MembershipService] Invalid business ID format (not a UUID):', businessId);
    // Return default settings for invalid business ID
    return {
      userId: businessId,
      isEnabled: false,
      notifyBeforeRenewalDays: 7,
      notifyPastDueDays: 3,
      gracePeriodDays: 7,
      updatedAt: new Date(),
    };
  }

  const { data, error } = await getSupabase()
    .from('membership_settings')
    .select('user_id, is_enabled, notify_before_renewal_days, notify_past_due_days, grace_period_days, updated_at')
    .eq('user_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[MembershipService] Error fetching settings:', error.code, error.message);
    return null; // Propagate failure — caller must check for null
  }

  if (!data) {
    // Return default settings
    return {
      userId: businessId,
      isEnabled: false,
      notifyBeforeRenewalDays: 7,
      notifyPastDueDays: 3,
      gracePeriodDays: 7,
      updatedAt: new Date(),
    };
  }

  return {
    userId: data.user_id,
    isEnabled: data.is_enabled,
    notifyBeforeRenewalDays: data.notify_before_renewal_days,
    notifyPastDueDays: data.notify_past_due_days,
    gracePeriodDays: data.grace_period_days,
    updatedAt: new Date(data.updated_at),
  };
}

/**
 * Update membership settings
 */
export async function updateMembershipSettings(
  userId: string,
  settings: Partial<MembershipSettings>
): Promise<MembershipSettings> {
  const { data, error } = await getSupabase()
    .from('membership_settings')
    .upsert({
      user_id: userId,
      is_enabled: settings.isEnabled,
      notify_before_renewal_days: settings.notifyBeforeRenewalDays,
      notify_past_due_days: settings.notifyPastDueDays,
      grace_period_days: settings.gracePeriodDays,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('[MembershipService] Error updating settings:', error);
    throw error;
  }

  return {
    userId: data.user_id,
    isEnabled: data.is_enabled,
    notifyBeforeRenewalDays: data.notify_before_renewal_days,
    notifyPastDueDays: data.notify_past_due_days,
    gracePeriodDays: data.grace_period_days,
    updatedAt: new Date(data.updated_at),
  };
}

// ============================================
// Membership Plans (Business-level)
// ============================================

/**
 * Get all membership plans for a business
 */
export async function getMembershipPlans(businessId: string): Promise<MembershipPlan[]> {
  // Validate UUID format before querying Supabase
  if (!isValidUUID(businessId)) {
    console.warn('[MembershipService] Invalid business ID format (not a UUID):', businessId);
    return [];
  }

  const { data, error } = await getSupabase()
    .from('membership_plans')
    .select('id, user_id, name, description, display_price, currency, renewal_cycle, custom_interval_days, auto_renew_tracking, benefits, is_active, sort_order, created_at, updated_at')
    .eq('user_id', businessId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[MembershipService] Error fetching plans:', error);
    return [];
  }

  return (data || []).map(mapPlanFromDb);
}

/**
 * Get a single membership plan
 */
export async function getMembershipPlan(planId: string): Promise<MembershipPlan | null> {
  const { data, error } = await getSupabase()
    .from('membership_plans')
    .select('id, user_id, name, description, display_price, currency, renewal_cycle, custom_interval_days, auto_renew_tracking, benefits, is_active, sort_order, created_at, updated_at')
    .eq('id', planId)
    .single();

  if (error) {
    console.error('[MembershipService] Error fetching plan:', error);
    return null;
  }

  return mapPlanFromDb(data);
}

/**
 * Create a new membership plan
 * Routes through backend API so server-side audit logging is guaranteed.
 */
export async function createMembershipPlan(
  userId: string,
  plan: Omit<MembershipPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<MembershipPlan> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/plans`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name:                 plan.name,
      description:          plan.description,
      display_price:        plan.displayPrice,
      currency:             plan.currency,
      renewal_cycle:        plan.renewalCycle,
      custom_interval_days: plan.customIntervalDays,
      auto_renew_tracking:  plan.autoRenewTracking,
      benefits:             plan.benefits,
      is_active:            plan.isActive,
      sort_order:           plan.sortOrder,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create plan' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to create plan');
  }

  const { data } = await res.json();
  return mapPlanFromDb(data);
}

/**
 * Update a membership plan
 * Routes through backend API so server-side audit logging is guaranteed.
 */
export async function updateMembershipPlan(
  planId: string,
  updates: Partial<MembershipPlan>
): Promise<MembershipPlan> {
  const body: Record<string, unknown> = {};
  if (updates.name              !== undefined) body.name                = updates.name;
  if (updates.description       !== undefined) body.description         = updates.description;
  if (updates.displayPrice      !== undefined) body.display_price       = updates.displayPrice;
  if (updates.currency          !== undefined) body.currency            = updates.currency;
  if (updates.renewalCycle      !== undefined) body.renewal_cycle       = updates.renewalCycle;
  if (updates.customIntervalDays !== undefined) body.custom_interval_days = updates.customIntervalDays;
  if (updates.autoRenewTracking !== undefined) body.auto_renew_tracking = updates.autoRenewTracking;
  if (updates.benefits          !== undefined) body.benefits            = updates.benefits;
  if (updates.isActive          !== undefined) body.is_active           = updates.isActive;
  if (updates.sortOrder         !== undefined) body.sort_order          = updates.sortOrder;

  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/plans/${planId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update plan' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to update plan');
  }

  const { data } = await res.json();
  return mapPlanFromDb(data);
}

/**
 * Delete a membership plan
 * Routes through backend API so server-side audit logging is guaranteed.
 */
export async function deleteMembershipPlan(planId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/plans/${planId}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete plan' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to delete plan');
  }
}

// ============================================
// Client Memberships
// ============================================

/**
 * Get all memberships for a business
 */
export async function getAllMemberships(businessId: string): Promise<ClientMembership[]> {
  // Validate UUID format before querying Supabase
  if (!isValidUUID(businessId)) {
    console.warn('[MembershipService] Invalid business ID format (not a UUID):', businessId);
    return [];
  }

  const { data, error } = await getSupabase()
    .from('client_memberships')
    .select('id, user_id, client_id, plan_id, status, start_date, next_renewal_date, last_payment_date, cancelled_date, paused_date, pause_end_date, payment_method, payment_notes, credit_balance, credit_currency, free_services_used, notes, created_at, updated_at')
    .eq('user_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[MembershipService] Error fetching memberships:', error);
    return [];
  }

  return (data || []).map(mapMembershipFromDb);
}

/**
 * Get membership for a specific client
 */
export async function getClientMembership(clientId: string): Promise<ClientMembership | null> {
  const { data, error } = await getSupabase()
    .from('client_memberships')
    .select('id, user_id, client_id, plan_id, status, start_date, next_renewal_date, last_payment_date, cancelled_date, paused_date, pause_end_date, payment_method, payment_notes, credit_balance, credit_currency, free_services_used, notes, created_at, updated_at')
    .eq('client_id', clientId)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[MembershipService] Error fetching client membership:', error);
    return null;
  }

  return data ? mapMembershipFromDb(data) : null;
}

/**
 * Get all memberships for a client (including cancelled)
 */
export async function getClientMembershipHistory(clientId: string): Promise<ClientMembership[]> {
  const { data, error } = await getSupabase()
    .from('client_memberships')
    .select('id, user_id, client_id, plan_id, status, start_date, next_renewal_date, last_payment_date, cancelled_date, paused_date, pause_end_date, payment_method, payment_notes, credit_balance, credit_currency, free_services_used, notes, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[MembershipService] Error fetching membership history:', error);
    return [];
  }

  return (data || []).map(mapMembershipFromDb);
}

/**
 * Enroll a client in a membership (manual/offline)
 */
export async function enrollClientInMembership(
  userId: string,
  clientId: string,
  planId: string,
  enrollment: {
    startDate: Date;
    nextRenewalDate: Date;
    paymentMethod: MembershipPaymentMethod;
    paymentNotes?: string;
    notes?: string;
    initialCreditBalance?: number;
  }
): Promise<ClientMembership> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/enroll`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      client_id: clientId,
      plan_id: planId,
      start_date: enrollment.startDate.toISOString(),
      next_renewal_date: enrollment.nextRenewalDate.toISOString(),
      payment_method: enrollment.paymentMethod,
      payment_notes: enrollment.paymentNotes,
      notes: enrollment.notes,
      initial_credit_balance: enrollment.initialCreditBalance,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Enroll failed: ${res.status}`);
  }

  const json = await res.json() as { success: boolean; data: Record<string, unknown> };
  return mapMembershipFromDb(json.data);
}

// Fire membership activation email after enrollment (fire-and-forget)
// Called externally so we can pass business_id from the caller context
export function fireMembershipActivationEmail(
  businessId: string,
  clientId: string,
  planName: string,
  nextRenewalDate: Date
): void {
  const renewalDateStr = nextRenewalDate.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
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
        event_type: 'membership_activated',
        membership_plan_name: planName,
        membership_renewal_date: renewalDateStr,
      }),
    }).catch(() => {/* silent */});
  }).catch(() => {/* silent */});
}
export async function markPaymentReceived(
  membershipId: string,
  payment: {
    amount: number;
    currency: string;
    paymentMethod: MembershipPaymentMethod;
    paymentDate: Date;
    periodStart: Date;
    periodEnd: Date;
    notes?: string;
    receivedBy?: string;
  }
): Promise<{ membership: ClientMembership; payment: MembershipPayment }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/pay`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      membership_id: membershipId,
      amount: payment.amount,
      currency: payment.currency,
      payment_method: payment.paymentMethod,
      payment_date: payment.paymentDate.toISOString(),
      period_start: payment.periodStart.toISOString(),
      period_end: payment.periodEnd.toISOString(),
      notes: payment.notes,
      received_by: payment.receivedBy,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Payment failed: ${res.status}`);
  }

  const json = await res.json() as {
    success: boolean;
    membership: Record<string, unknown>;
    payment: Record<string, unknown>;
  };
  return {
    membership: mapMembershipFromDb(json.membership),
    payment: mapPaymentFromDb(json.payment),
  };
}

/**
 * Cancel membership
 */
export async function cancelMembership(
  membershipId: string,
  reason?: string
): Promise<ClientMembership> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ membership_id: membershipId, reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Cancel failed: ${res.status}`);
  }

  const json = await res.json() as { success: boolean; data: Record<string, unknown> };
  return mapMembershipFromDb(json.data);
}

/**
 * Pause membership
 */
export async function pauseMembership(
  membershipId: string,
  pauseEndDate?: Date
): Promise<ClientMembership> {
  const { data, error } = await getSupabase()
    .from('client_memberships')
    .update({
      status: 'paused',
      paused_date: new Date().toISOString(),
      pause_end_date: pauseEndDate?.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', membershipId)
    .select()
    .single();

  if (error) throw error;
  return mapMembershipFromDb(data);
}

/**
 * Resume membership
 */
export async function resumeMembership(membershipId: string): Promise<ClientMembership> {
  const { data, error } = await getSupabase()
    .from('client_memberships')
    .update({
      status: 'active',
      paused_date: null,
      pause_end_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membershipId)
    .select()
    .single();

  if (error) throw error;
  return mapMembershipFromDb(data);
}

/**
 * Update membership status (for batch updates)
 */
export async function updateMembershipStatus(
  membershipId: string,
  status: MembershipStatus
): Promise<ClientMembership> {
  const { data, error } = await getSupabase()
    .from('client_memberships')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membershipId)
    .select()
    .single();

  if (error) throw error;
  return mapMembershipFromDb(data);
}

// ============================================
// Credit Ledger
// ============================================

/**
 * Add a credit transaction
 */
async function addCreditTransaction(
  userId: string,
  membershipId: string,
  clientId: string,
  transaction: {
    type: MembershipCreditTransaction['type'];
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    currency: string;
    reason: string;
    appointmentId?: string;
    visitId?: string;
    serviceId?: string;
    serviceName?: string;
  }
): Promise<MembershipCreditTransaction> {
  const { data, error } = await getSupabase()
    .from('membership_credit_transactions')
    .insert({
      user_id: userId,
      membership_id: membershipId,
      client_id: clientId,
      type: transaction.type,
      amount: transaction.amount,
      balance_before: transaction.balanceBefore,
      balance_after: transaction.balanceAfter,
      currency: transaction.currency,
      reason: transaction.reason,
      appointment_id: transaction.appointmentId,
      visit_id: transaction.visitId,
      service_id: transaction.serviceId,
      service_name: transaction.serviceName,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return mapCreditTransactionFromDb(data);
}

/**
 * Get credit transactions for a membership
 */
export async function getMembershipCreditTransactions(
  membershipId: string
): Promise<MembershipCreditTransaction[]> {
  const { data, error } = await getSupabase()
    .from('membership_credit_transactions')
    .select('id, user_id, membership_id, client_id, type, amount, balance_before, balance_after, currency, reason, appointment_id, visit_id, service_id, service_name, created_at')
    .eq('membership_id', membershipId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[MembershipService] Error fetching credit transactions:', error);
    return [];
  }

  return (data || []).map(mapCreditTransactionFromDb);
}

/**
 * Use membership credits
 */
export async function redeemMembershipCredits(
  membershipId: string,
  amount: number,
  context: {
    reason: string;
    appointmentId?: string;
    visitId?: string;
    serviceId?: string;
    serviceName?: string;
  }
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/redeem-credits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      membership_id: membershipId,
      amount,
      reason: context.reason,
      appointment_id: context.appointmentId,
      visit_id: context.visitId,
      service_id: context.serviceId,
      service_name: context.serviceName,
    }),
  });

  const json = await res.json() as { success: boolean; newBalance?: number; error?: string };

  if (!res.ok) {
    return { success: false, newBalance: json.newBalance ?? 0, error: json.error ?? `Redeem failed: ${res.status}` };
  }

  return { success: true, newBalance: json.newBalance ?? 0 };
}

// ============================================
// Benefit Usage
// ============================================

/**
 * Record benefit usage
 */
export async function recordBenefitUsage(
  userId: string,
  membershipId: string,
  clientId: string,
  benefitId: string,
  usage: {
    benefitType: MembershipBenefit['type'];
    discountAmount?: number;
    originalAmount?: number;
    finalAmount?: number;
    serviceId?: string;
    serviceName?: string;
    creditUsed?: number;
    appointmentId?: string;
    visitId?: string;
  }
): Promise<MembershipBenefitUsage> {
  const { data, error } = await getSupabase()
    .from('membership_benefit_usage')
    .insert({
      user_id: userId,
      membership_id: membershipId,
      client_id: clientId,
      benefit_id: benefitId,
      benefit_type: usage.benefitType,
      discount_amount: usage.discountAmount,
      original_amount: usage.originalAmount,
      final_amount: usage.finalAmount,
      service_id: usage.serviceId,
      service_name: usage.serviceName,
      credit_used: usage.creditUsed,
      appointment_id: usage.appointmentId,
      visit_id: usage.visitId,
      used_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return mapBenefitUsageFromDb(data);
}

/**
 * Get benefit usage history
 */
export async function getBenefitUsageHistory(
  membershipId: string
): Promise<MembershipBenefitUsage[]> {
  const { data, error } = await getSupabase()
    .from('membership_benefit_usage')
    .select('id, user_id, membership_id, client_id, benefit_id, benefit_type, discount_amount, original_amount, final_amount, service_id, service_name, credit_used, appointment_id, visit_id, used_at')
    .eq('membership_id', membershipId)
    .order('used_at', { ascending: false });

  if (error) return [];
  return (data || []).map(mapBenefitUsageFromDb);
}

/**
 * Use a free service benefit
 */
export async function redeemFreeService(
  membershipId: string,
  serviceId: string,
  serviceName: string,
  context?: { appointmentId?: string; visitId?: string }
): Promise<{ success: boolean; error?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${getBackendUrl()}/api/memberships/redeem-free-service`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      membership_id: membershipId,
      service_id: serviceId,
      service_name: serviceName,
      appointment_id: context?.appointmentId,
      visit_id: context?.visitId,
    }),
  });

  const json = await res.json() as { success: boolean; error?: string };

  if (!res.ok) {
    return { success: false, error: json.error ?? `Redeem failed: ${res.status}` };
  }

  return { success: true };
}

// ============================================
// Analytics
// ============================================

/**
 * Get membership analytics
 */
export async function getMembershipAnalytics(userId: string): Promise<{
  activeMembers: number;
  pastDueMembers: number;
  cancelledMembers: number;
  totalMembers: number;
  estimatedMonthlyRevenue: number;
  estimatedYearlyRevenue: number;
  totalCreditsUsed: number;
  totalFreeServicesRedeemed: number;
  topPlans: { planId: string; planName: string; memberCount: number }[];
}> {
  // Get all memberships
  const { data: memberships, error: membershipError } = await getSupabase()
    .from('client_memberships')
    .select('id, user_id, client_id, plan_id, status, start_date, next_renewal_date, last_payment_date, cancelled_date, paused_date, pause_end_date, payment_method, payment_notes, credit_balance, credit_currency, free_services_used, notes, created_at, updated_at')
    .eq('user_id', userId);

  if (membershipError) {
    console.error('[MembershipService] Analytics error:', membershipError);
    return {
      activeMembers: 0,
      pastDueMembers: 0,
      cancelledMembers: 0,
      totalMembers: 0,
      estimatedMonthlyRevenue: 0,
      estimatedYearlyRevenue: 0,
      totalCreditsUsed: 0,
      totalFreeServicesRedeemed: 0,
      topPlans: [],
    };
  }

  // Get all plans for price lookup
  const plans = await getMembershipPlans(userId);
  const planMap = new Map(plans.map(p => [p.id, p]));

  // Calculate stats
  const activeMembers = (memberships || []).filter(m => m.status === 'active').length;
  const pastDueMembers = (memberships || []).filter(m => m.status === 'past_due').length;
  const cancelledMembers = (memberships || []).filter(m => m.status === 'cancelled').length;

  // Calculate estimated revenue (display only)
  let monthlyRevenue = 0;
  let yearlyRevenue = 0;

  (memberships || [])
    .filter(m => m.status === 'active')
    .forEach(m => {
      const plan = planMap.get(m.plan_id);
      if (plan) {
        if (plan.renewalCycle === 'monthly') {
          monthlyRevenue += plan.displayPrice;
          yearlyRevenue += plan.displayPrice * 12;
        } else if (plan.renewalCycle === 'yearly') {
          monthlyRevenue += plan.displayPrice / 12;
          yearlyRevenue += plan.displayPrice;
        }
      }
    });

  // Get credit usage
  const { data: creditData } = await getSupabase()
    .from('membership_credit_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'credit_used');

  const totalCreditsUsed = (creditData || []).reduce((sum, t) => sum + (t.amount || 0), 0);

  // Get free service redemptions
  const { data: usageData } = await getSupabase()
    .from('membership_benefit_usage')
    .select('id')
    .eq('user_id', userId)
    .eq('benefit_type', 'free_service');

  const totalFreeServicesRedeemed = (usageData || []).length;

  // Calculate top plans
  const planCounts = new Map<string, number>();
  (memberships || [])
    .filter(m => m.status === 'active')
    .forEach(m => {
      planCounts.set(m.plan_id, (planCounts.get(m.plan_id) || 0) + 1);
    });

  const topPlans = Array.from(planCounts.entries())
    .map(([planId, count]) => ({
      planId,
      planName: planMap.get(planId)?.name || 'Unknown',
      memberCount: count,
    }))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 5);

  return {
    activeMembers,
    pastDueMembers,
    cancelledMembers,
    totalMembers: (memberships || []).length,
    estimatedMonthlyRevenue: monthlyRevenue,
    estimatedYearlyRevenue: yearlyRevenue,
    totalCreditsUsed,
    totalFreeServicesRedeemed,
    topPlans,
  };
}

// ============================================
// Payment History
// ============================================

/**
 * Get payment history for a membership
 */
export async function getMembershipPayments(membershipId: string): Promise<MembershipPayment[]> {
  const { data, error } = await getSupabase()
    .from('membership_payments')
    .select('id, user_id, membership_id, client_id, plan_id, amount, currency, payment_method, payment_date, period_start, period_end, notes, received_by, created_at')
    .eq('membership_id', membershipId)
    .order('payment_date', { ascending: false });

  if (error) return [];
  return (data || []).map(mapPaymentFromDb);
}

/**
 * Get all payments for a business
 */
export async function getAllMembershipPayments(userId: string): Promise<MembershipPayment[]> {
  const { data, error } = await getSupabase()
    .from('membership_payments')
    .select('id, user_id, membership_id, client_id, plan_id, amount, currency, payment_method, payment_date, period_start, period_end, notes, received_by, created_at')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false });

  if (error) return [];
  return (data || []).map(mapPaymentFromDb);
}

// ============================================
// Mappers
// ============================================

function mapPlanFromDb(data: Record<string, unknown>): MembershipPlan {
  let benefits: MembershipBenefit[] = [];
  try {
    benefits = typeof data.benefits === 'string' ? JSON.parse(data.benefits) : data.benefits || [];
  } catch {
    benefits = [];
  }

  return {
    id: data.id as string,
    userId: data.user_id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    displayPrice: data.display_price as number,
    currency: data.currency as string,
    renewalCycle: data.renewal_cycle as MembershipRenewalCycle,
    customIntervalDays: data.custom_interval_days as number | undefined,
    autoRenewTracking: data.auto_renew_tracking as boolean,
    benefits,
    isActive: data.is_active as boolean,
    sortOrder: data.sort_order as number,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function mapMembershipFromDb(data: Record<string, unknown>): ClientMembership {
  let freeServicesUsed: { serviceId: string; usedCount: number; cycleStart: Date }[] = [];
  try {
    const parsed = typeof data.free_services_used === 'string'
      ? JSON.parse(data.free_services_used)
      : data.free_services_used || [];
    freeServicesUsed = parsed.map((s: { serviceId: string; usedCount: number; cycleStart: string }) => ({
      ...s,
      cycleStart: new Date(s.cycleStart),
    }));
  } catch {
    freeServicesUsed = [];
  }

  return {
    id: data.id as string,
    userId: data.user_id as string,
    clientId: data.client_id as string,
    planId: data.plan_id as string,
    status: data.status as MembershipStatus,
    startDate: new Date(data.start_date as string),
    nextRenewalDate: new Date(data.next_renewal_date as string),
    lastPaymentDate: data.last_payment_date ? new Date(data.last_payment_date as string) : undefined,
    cancelledDate: data.cancelled_date ? new Date(data.cancelled_date as string) : undefined,
    pausedDate: data.paused_date ? new Date(data.paused_date as string) : undefined,
    pauseEndDate: data.pause_end_date ? new Date(data.pause_end_date as string) : undefined,
    paymentMethod: data.payment_method as MembershipPaymentMethod,
    paymentNotes: data.payment_notes as string | undefined,
    creditBalance: data.credit_balance as number,
    creditCurrency: data.credit_currency as string | undefined,
    freeServicesUsed,
    notes: data.notes as string | undefined,
    createdAt: new Date(data.created_at as string),
    updatedAt: new Date(data.updated_at as string),
  };
}

function mapPaymentFromDb(data: Record<string, unknown>): MembershipPayment {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    membershipId: data.membership_id as string,
    clientId: data.client_id as string,
    planId: data.plan_id as string,
    amount: data.amount as number,
    currency: data.currency as string,
    paymentMethod: data.payment_method as MembershipPaymentMethod,
    paymentDate: new Date(data.payment_date as string),
    periodStart: new Date(data.period_start as string),
    periodEnd: new Date(data.period_end as string),
    notes: data.notes as string | undefined,
    receivedBy: data.received_by as string | undefined,
    createdAt: new Date(data.created_at as string),
  };
}

function mapCreditTransactionFromDb(data: Record<string, unknown>): MembershipCreditTransaction {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    membershipId: data.membership_id as string,
    clientId: data.client_id as string,
    type: data.type as MembershipCreditTransaction['type'],
    amount: data.amount as number,
    balanceBefore: data.balance_before as number,
    balanceAfter: data.balance_after as number,
    currency: data.currency as string,
    reason: data.reason as string,
    appointmentId: data.appointment_id as string | undefined,
    visitId: data.visit_id as string | undefined,
    serviceId: data.service_id as string | undefined,
    serviceName: data.service_name as string | undefined,
    createdAt: new Date(data.created_at as string),
  };
}

function mapBenefitUsageFromDb(data: Record<string, unknown>): MembershipBenefitUsage {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    membershipId: data.membership_id as string,
    clientId: data.client_id as string,
    benefitId: data.benefit_id as string,
    benefitType: data.benefit_type as MembershipBenefit['type'],
    discountAmount: data.discount_amount as number | undefined,
    originalAmount: data.original_amount as number | undefined,
    finalAmount: data.final_amount as number | undefined,
    serviceId: data.service_id as string | undefined,
    serviceName: data.service_name as string | undefined,
    creditUsed: data.credit_used as number | undefined,
    appointmentId: data.appointment_id as string | undefined,
    visitId: data.visit_id as string | undefined,
    usedAt: new Date(data.used_at as string),
  };
}

// ============================================
// Calculate Benefits for Checkout
// ============================================

/**
 * Calculate applicable benefits for a checkout
 */
export async function calculateMembershipBenefits(
  clientId: string,
  services: { id: string; name: string; price: number }[],
  totalAmount: number
): Promise<{
  hasMembership: boolean;
  membership?: ClientMembership;
  plan?: MembershipPlan;
  discountPercent: number;
  discountAmount: number;
  freeServices: { serviceId: string; serviceName: string; available: boolean }[];
  availableCredits: number;
  finalAmount: number;
}> {
  const membership = await getClientMembership(clientId);

  if (!membership || membership.status !== 'active') {
    return {
      hasMembership: false,
      discountPercent: 0,
      discountAmount: 0,
      freeServices: [],
      availableCredits: 0,
      finalAmount: totalAmount,
    };
  }

  const plan = await getMembershipPlan(membership.planId);
  if (!plan) {
    return {
      hasMembership: true,
      membership,
      discountPercent: 0,
      discountAmount: 0,
      freeServices: [],
      availableCredits: 0,
      finalAmount: totalAmount,
    };
  }

  // Calculate discount
  const discountBenefit = plan.benefits.find(b => b.type === 'discount' && b.isActive);
  const discountPercent = discountBenefit?.discountPercent || 0;
  const discountAmount = (totalAmount * discountPercent) / 100;

  // Check free services
  const freeServices = services.map(service => {
    const freeServiceBenefit = plan.benefits.find(
      b => b.type === 'free_service' && b.freeServiceId === service.id && b.isActive
    );

    if (!freeServiceBenefit) {
      return { serviceId: service.id, serviceName: service.name, available: false };
    }

    const usage = membership.freeServicesUsed.find(u => u.serviceId === service.id);
    const usedCount = usage?.usedCount || 0;
    const maxAllowed = freeServiceBenefit.freeServiceQuantity || 1;

    return {
      serviceId: service.id,
      serviceName: service.name,
      available: usedCount < maxAllowed,
    };
  });

  const finalAmount = Math.max(0, totalAmount - discountAmount);

  return {
    hasMembership: true,
    membership,
    plan,
    discountPercent,
    discountAmount,
    freeServices,
    availableCredits: membership.creditBalance,
    finalAmount,
  };
}
