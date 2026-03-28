/**
 * Analytics Service
 *
 * SINGLE SOURCE OF TRUTH for all Analytics data.
 * Uses ONLY the get_monthly_analytics_overview RPC function.
 * NO direct table queries. NO fallbacks.
 *
 * RPC Response Shape:
 * {
 *   success: boolean,
 *   total_appointments: number,
 *   total_services: number,
 *   revenue_cents: number,
 *   top_clients: Array<{
 *     client_id: string,
 *     display_name: string,
 *     appointment_count: number,
 *     total_spend_cents: number
 *   }>
 * }
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types - match RPC response EXACTLY
// ============================================

// Top client item from RPC
export interface RPCTopClient {
  client_id: string;
  display_name: string;
  appointment_count: number;
  total_spend_cents: number;
}

// Full RPC response structure
export interface AnalyticsOverviewData {
  success: boolean;
  total_appointments: number;
  total_services: number;
  revenue_cents: number;
  top_clients: RPCTopClient[];
}

export interface AnalyticsResult {
  data: AnalyticsOverviewData | null;
  error: string | null;
  isLoading: boolean;
}

// ============================================
// Error Types
// ============================================

export type AnalyticsErrorType =
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'RPC_NOT_FOUND'
  | 'BUSINESS_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'VALIDATION_FAILED'
  | 'UNKNOWN';

// ============================================
// Runtime Validator
// ============================================

function validateRPCResponse(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data === null || data === undefined) {
    errors.push('Response is null or undefined');
    return { valid: false, errors };
  }

  if (typeof data !== 'object') {
    errors.push(`Expected object, got ${typeof data}`);
    return { valid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  // Validate required fields
  if (typeof obj.success !== 'boolean') {
    errors.push(`success: expected boolean, got ${typeof obj.success}`);
  }
  if (typeof obj.total_appointments !== 'number') {
    errors.push(`total_appointments: expected number, got ${typeof obj.total_appointments}`);
  }
  if (typeof obj.total_services !== 'number') {
    errors.push(`total_services: expected number, got ${typeof obj.total_services}`);
  }
  if (typeof obj.revenue_cents !== 'number') {
    errors.push(`revenue_cents: expected number, got ${typeof obj.revenue_cents}`);
  }
  // top_clients is optional — older deployed RPCs may omit it; default to []
  if (obj.top_clients !== undefined && obj.top_clients !== null && !Array.isArray(obj.top_clients)) {
    errors.push(`top_clients: expected array, got ${typeof obj.top_clients}`);
  } else if (Array.isArray(obj.top_clients)) {
    // Validate top_clients items only when present
    (obj.top_clients as unknown[]).forEach((client, idx) => {
      if (typeof client !== 'object' || client === null) {
        errors.push(`top_clients[${idx}]: expected object`);
        return;
      }
      const c = client as Record<string, unknown>;
      if (typeof c.client_id !== 'string') {
        errors.push(`top_clients[${idx}].client_id: expected string`);
      }
      if (typeof c.display_name !== 'string') {
        errors.push(`top_clients[${idx}].display_name: expected string`);
      }
      if (typeof c.appointment_count !== 'number') {
        errors.push(`top_clients[${idx}].appointment_count: expected number`);
      }
      if (typeof c.total_spend_cents !== 'number') {
        errors.push(`top_clients[${idx}].total_spend_cents: expected number`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// RPC Call - SINGLE DATA PATH
// ============================================

export async function getMonthlyAnalyticsOverview(
  businessId: string,
  startDate: Date,
  endDate: Date,
  storeId?: string | null
): Promise<{ data: AnalyticsOverviewData | null; error: string | null; errorType?: AnalyticsErrorType }> {
  // Validate business_id
  if (!businessId) {
    console.warn('[AnalyticsService] business_id is required');
    return { data: null, error: 'business_id is required', errorType: 'INVALID_INPUT' };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(businessId)) {
    console.warn('[AnalyticsService] Invalid business_id format:', businessId);
    return { data: null, error: 'Invalid business_id format', errorType: 'INVALID_INPUT' };
  }

  // Check authentication
  const { data: sessionData, error: sessionError } = await getSupabase().auth.getSession();
  if (sessionError || !sessionData?.session) {
    console.warn('[AnalyticsService] No authenticated session');
    return { data: null, error: 'Authentication required. Please sign in.', errorType: 'AUTH_REQUIRED' };
  }

  console.log('[AnalyticsService] Calling RPC get_monthly_analytics_overview:', {
    p_business_id: businessId,
    p_start_at: startDate.toISOString(),
    p_end_at: endDate.toISOString(),
    p_store_id: storeId || null,
  });

  try {
    const { data, error } = await getSupabase().rpc('get_monthly_analytics_overview', {
      p_business_id: businessId,
      p_start_at: startDate.toISOString(),
      p_end_at: endDate.toISOString(),
      p_store_id: storeId || null,
    });

    if (error) {
      console.warn('[AnalyticsService] RPC error:', error.message, 'Code:', error.code);

      if (error.code === '42501') {
        return { data: null, error: 'Permission denied for this business.', errorType: 'PERMISSION_DENIED' };
      }
      if (error.code === '42883' || error.message.includes('Could not find the function')) {
        return { data: null, error: 'Analytics RPC not found.', errorType: 'RPC_NOT_FOUND' };
      }

      return { data: null, error: error.message, errorType: 'UNKNOWN' };
    }

    // Log raw payload for debugging
    console.log('[AnalyticsService] Raw RPC payload:', JSON.stringify(data));

    // Validate response structure
    const validation = validateRPCResponse(data);
    if (!validation.valid) {
      console.warn('[AnalyticsService] VALIDATION FAILED:', validation.errors);
      console.warn('[AnalyticsService] Raw payload was:', JSON.stringify(data));
      return { data: null, error: `Invalid RPC response: ${validation.errors.join(', ')}`, errorType: 'VALIDATION_FAILED' };
    }

    const analyticsData = data as AnalyticsOverviewData;
    // Normalize top_clients — older deployed RPCs may omit the field entirely
    if (!Array.isArray(analyticsData.top_clients)) {
      analyticsData.top_clients = [];
    }

    console.log('[AnalyticsService] RPC SUCCESS:', {
      success: analyticsData.success,
      total_appointments: analyticsData.total_appointments,
      total_services: analyticsData.total_services,
      revenue_cents: analyticsData.revenue_cents,
      top_clients_count: analyticsData.top_clients.length,
    });

    return { data: analyticsData, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[AnalyticsService] Unexpected error:', errorMessage);
    return { data: null, error: errorMessage, errorType: 'UNKNOWN' };
  }
}

// ============================================
// Helpers
// ============================================

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function getDayName(dayOfWeek: number, short = false): string {
  const days = short
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || '';
}

export function getMonthName(month: number, short = false): string {
  const months = short
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}
