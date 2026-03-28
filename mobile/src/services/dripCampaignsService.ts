/**
 * Drip Campaigns Service
 *
 * Source of truth: public.drip_campaigns in Supabase, via the backend API.
 * The table must exist. If it doesn't, log a clear error.
 */

import { DripCampaign, DripTriggerConfig, DripTriggerType } from '@/lib/types';
import { getSupabase } from '@/lib/supabaseClient';

const getBackendUrl = (): string => {
  return (
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    'http://localhost:3000'
  );
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: sessionData } = await getSupabase().auth.getSession();
  const token = sessionData?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DripCampaignRow {
  id: string;
  business_id: string;
  name: string;
  color: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  custom_days: number | null;
  is_active: boolean;
  is_eu_enabled: boolean;
  emails: DripCampaign['emails'];
  trigger_type: DripTriggerType | null;
  trigger_config: DripTriggerConfig | null;
  created_at: string;
  updated_at: string;
}

function toRow(campaign: DripCampaign, businessId: string): Omit<DripCampaignRow, 'created_at' | 'updated_at'> {
  return {
    id: campaign.id,
    business_id: businessId,
    name: campaign.name,
    color: campaign.color,
    frequency: campaign.frequency,
    custom_days: campaign.customDays ?? null,
    is_active: campaign.isActive,
    is_eu_enabled: campaign.isEuEnabled ?? false,
    emails: campaign.emails,
    trigger_type: campaign.triggerType ?? null,
    trigger_config: campaign.triggerConfig ?? null,
  };
}

export function fromRow(row: DripCampaignRow, userId: string): DripCampaign {
  return {
    id: row.id,
    userId,
    name: row.name,
    color: row.color,
    frequency: row.frequency,
    customDays: row.custom_days ?? undefined,
    isActive: row.is_active,
    isEuEnabled: row.is_eu_enabled,
    emails: row.emails ?? [],
    createdAt: new Date(row.created_at),
    triggerType: row.trigger_type ?? undefined,
    triggerConfig: row.trigger_config ?? undefined,
  };
}

/** Fetch all campaigns for a business from Supabase via backend. */
export async function fetchDripCampaigns(
  businessId: string
): Promise<{ data: DripCampaign[] | null; tableExists: boolean; error: string | null }> {
  try {
    const url = `${getBackendUrl()}/api/drip-campaigns?business_id=${businessId}`;
    console.log('[DripCampaignsService] Fetching campaigns:', url);
    const authHeaders = await getAuthHeaders();
    const res = await fetch(url, { method: 'GET', headers: authHeaders });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      const msg = String(body?.error ?? `HTTP ${res.status}`);
      const code = String(body?.code ?? '');
      // 502/503/504 are proxy/gateway errors — treat as transient, not table-missing
      if (res.status >= 502 && res.status <= 504) {
        console.warn('[DripCampaignsService] Transient gateway error:', res.status);
        return { data: null, tableExists: true, error: msg };
      }
      const tableExists = code !== 'PGRST205' && !msg.includes('schema cache') && !msg.includes('does not exist');
      console.warn('[DripCampaignsService] Fetch error:', msg, '| code:', code, '| tableExists:', tableExists);
      return { data: null, tableExists, error: msg };
    }

    if (body.tableExists === false) {
      console.error('[DripCampaignsService] Server reports table does not exist');
      return { data: null, tableExists: false, error: 'drip_campaigns table missing in Supabase' };
    }

    const rows = (body.data ?? []) as DripCampaignRow[];
    console.log('[DripCampaignsService] Fetched', rows.length, 'campaigns');
    // userId will be filled in by the hydration hook using the current Zustand userId
    const campaigns = rows.map((r) => fromRow(r, ''));
    return { data: campaigns, tableExists: true, error: null };
  } catch (err) {
    console.warn('[DripCampaignsService] Network error:', err);
    return { data: null, tableExists: true, error: String(err) };
  }
}

/** Upsert a single campaign to Supabase via backend. */
export async function upsertDripCampaign(
  campaign: DripCampaign,
  businessId: string
): Promise<{ data: DripCampaignRow | null; error: string | null; tableExists: boolean }> {
  try {
    const url = `${getBackendUrl()}/api/drip-campaigns`;
    const authHeaders = await getAuthHeaders();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(toRow(campaign, businessId)),
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      console.error('[DripCampaignsService] Upsert error:', body?.error);
      return { data: null, error: String(body?.error ?? `HTTP ${res.status}`), tableExists: true };
    }
    return { data: body.data as DripCampaignRow, error: null, tableExists: true };
  } catch (err) {
    console.error('[DripCampaignsService] Upsert network error:', err);
    return { data: null, error: String(err), tableExists: true };
  }
}

/** Delete a campaign from Supabase via backend. */
export async function deleteDripCampaignFromSupabase(
  id: string,
  businessId?: string
): Promise<{ error: string | null }> {
  try {
    const params = businessId ? `?business_id=${businessId}` : '';
    const url = `${getBackendUrl()}/api/drip-campaigns/${id}${params}`;
    const authHeaders = await getAuthHeaders();
    const res = await fetch(url, { method: 'DELETE', headers: authHeaders });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { error: String(body?.error ?? `HTTP ${res.status}`) };
    }
    return { error: null };
  } catch (err) {
    return { error: String(err) };
  }
}

export interface EnrollmentRow {
  id: string;
  business_id: string;
  campaign_id: string;
  client_id: string;
  is_active: boolean;
  enrolled_at: string;
  updated_at: string;
}

/** Fetch all active enrollments for a business. */
export async function fetchEnrollments(
  businessId: string
): Promise<{ data: EnrollmentRow[] | null; error: string | null }> {
  const base = getBackendUrl();
  try {
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${base}/api/drip-campaigns/enrollments?business_id=${businessId}`, { headers });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      console.warn('[DripCampaignsService] fetchEnrollments error:', body?.error);
      return { data: null, error: String(body?.error ?? `HTTP ${res.status}`) };
    }
    const rows = (body.data ?? []) as EnrollmentRow[];
    console.log('[DripCampaignsService] fetchEnrollments:', rows.length, 'active enrollments');
    return { data: rows, error: null };
  } catch (err) {
    console.warn('[DripCampaignsService] fetchEnrollments network error:', err);
    return { data: null, error: String(err) };
  }
}

/** Update enrollment status (pause / resume). */
export async function updateEnrollmentStatus(
  clientId: string,
  campaignId: string,
  businessId: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  if (isActive) {
    // Re-enroll = activate
    return persistClientDripAssignment(clientId, campaignId, businessId);
  } else {
    // Deactivate = unenroll
    return persistClientDripAssignment(clientId, null, businessId, campaignId);
  }
}

/**
 * Persist a client's enrollment in a drip campaign.
 * Writes to drip_campaign_enrollments via the backend API.
 */
export async function persistClientDripAssignment(
  clientId: string,
  campaignId: string | null,
  businessId: string,
  previousCampaignId?: string | null
): Promise<{ error: string | null }> {
  const base = getBackendUrl();
  try {
    // Retrieve Supabase access token for auth
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    // Unenroll from previous campaign if switching
    if (previousCampaignId && previousCampaignId !== campaignId) {
      await fetch(`${base}/api/drip-campaigns/unenroll-client`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ client_id: clientId, campaign_id: previousCampaignId, business_id: businessId }),
      });
    }

    // Enroll in new campaign
    if (campaignId) {
      const res = await fetch(`${base}/api/drip-campaigns/enroll-client`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ client_id: clientId, campaign_id: campaignId, business_id: businessId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        console.warn('[DripCampaignsService] enroll-client error:', body?.error);
        return { error: String(body?.error ?? `HTTP ${res.status}`) };
      }
    } else if (previousCampaignId) {
      // Unenroll only (no new campaign)
      const res = await fetch(`${base}/api/drip-campaigns/unenroll-client`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ client_id: clientId, campaign_id: previousCampaignId, business_id: businessId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        return { error: String(body?.error ?? `HTTP ${res.status}`) };
      }
    }

    return { error: null };
  } catch (err) {
    console.warn('[DripCampaignsService] enrollment network error:', err);
    return { error: String(err) };
  }
}
