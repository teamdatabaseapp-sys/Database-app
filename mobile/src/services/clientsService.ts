/**
 * Clients Service
 *
 * Handles all Supabase client operations with business-scoped access.
 * All operations are protected by RLS policies - users can only access
 * clients belonging to their own business.
 *
 * IMPORTANT: The clients table uses 'business_id' to link to the business record.
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface SupabaseClient {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  visits_count: number;
  last_visit_at: string | null;
  created_at: string;
}

export interface CreateClientData {
  business_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface UpdateClientData {
  name?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  visits_count?: number;
}

export interface ClientsResult<T = null> {
  data: T | null;
  error: Error | null;
}

export interface ClientCounts {
  total: number;
  newThisMonth: number;
  fetchedAt: number; // timestamp
}

// ============================================
// Fast Count Query (lightweight, for KPI cards)
// ============================================

/**
 * Get just the total and new-this-month client counts.
 * Uses head:true count query — returns a number, no row data.
 * Runs both queries in parallel for maximum speed.
 */
export async function getClientCounts(
  businessId: string
): Promise<ClientsResult<ClientCounts>> {
  if (!businessId) {
    return { data: null, error: new Error('No business_id provided') };
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Run both count queries in parallel — no row data transferred
    const [totalResult, newResult] = await Promise.all([
      getSupabase()
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId),
      getSupabase()
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', monthStart),
    ]);

    if (totalResult.error) {
      return { data: null, error: totalResult.error };
    }

    return {
      data: {
        total: totalResult.count ?? 0,
        newThisMonth: newResult.count ?? 0,
        fetchedAt: Date.now(),
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error') };
  }
}

// ============================================
// Client CRUD Operations
// ============================================

/**
 * Get all clients for a business.
 * RLS ensures only clients belonging to the user's business are returned.
 * Fetches visit counts separately from client_visits view and merges in code.
 *
 * @param businessId - The business ID (businesses.id) to fetch clients for
 * @returns Promise with clients array, or error
 */
export async function getClients(
  businessId: string
): Promise<ClientsResult<SupabaseClient[]>> {
  try {
    console.log('[ClientsService] getClients called for business:', businessId);

    if (!businessId) {
      console.log('[ClientsService] No business_id provided');
      return { data: null, error: new Error('No business_id provided') };
    }

    // Step 1: Query clients — explicit columns only (no overfetch), capped at 200 rows.
    // last_visit_at and visits_count live in the client_visits view, not the clients table.
    const { data: clientsData, error: clientsError } = await getSupabase()
      .from('clients')
      .select('id, business_id, name, email, phone, notes, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (clientsError) {
      console.log('[ClientsService] Error fetching clients:', clientsError.message);
      return { data: null, error: clientsError };
    }

    // Step 2: Separately query visits from client_visits view — only the 3 columns needed
    const { data: visitsData, error: visitsError } = await getSupabase()
      .from('client_visits')
      .select('client_id, visits_count, last_visit_at')
      .eq('business_id', businessId)
      .limit(200);

    if (visitsError) {
      console.log('[ClientsService] Error fetching visits (non-blocking):', visitsError.message);
      // Non-blocking - continue with clients, just default visits to 0
    }

    // Step 3: Build a map of visits by client_id
    const visitsByClientId: Record<string, { visits_count: number; last_visit_at: string | null }> = {};
    if (visitsData) {
      for (const visit of visitsData) {
        visitsByClientId[visit.client_id] = {
          visits_count: visit.visits_count ?? 0,
          last_visit_at: visit.last_visit_at ?? null,
        };
      }
    }

    // Step 4: Merge results
    const mergedClients: SupabaseClient[] = (clientsData || []).map((client) => {
      const visitInfo = visitsByClientId[client.id];
      return {
        id: client.id,
        business_id: client.business_id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
        created_at: client.created_at,
        visits_count: visitInfo?.visits_count ?? 0,
        last_visit_at: visitInfo?.last_visit_at ?? null,
      };
    });

    console.log('[ClientsService] Fetched', mergedClients.length, 'clients');
    return { data: mergedClients, error: null };
  } catch (err) {
    console.log('[ClientsService] Unexpected error in getClients:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch clients'),
    };
  }
}

/**
 * Get a single client by ID.
 * RLS ensures the client belongs to the user's business.
 * Fetches visit count separately from client_visits view.
 *
 * @param clientId - The client ID to fetch
 * @returns Promise with client data, or error
 */
export async function getClient(
  clientId: string
): Promise<ClientsResult<SupabaseClient>> {
  try {
    console.log('[ClientsService] getClient called for ID:', clientId);

    // Step 1: Query client normally
    const { data, error } = await getSupabase()
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();

    if (error) {
      console.log('[ClientsService] Error fetching client:', error.message);
      return { data: null, error };
    }

    if (!data) {
      console.log('[ClientsService] Client not found:', clientId);
      return { data: null, error: null };
    }

    // Step 2: Separately query visits from client_visits view
    const { data: visitData, error: visitError } = await getSupabase()
      .from('client_visits')
      .select('visits_count, last_visit_at')
      .eq('business_id', data.business_id)
      .eq('client_id', clientId)
      .maybeSingle();

    if (visitError) {
      console.log('[ClientsService] Error fetching visit data (non-blocking):', visitError.message);
      // Non-blocking - continue with client, just default visits to 0
    }

    // Step 3: Merge results
    const mergedClient: SupabaseClient = {
      id: data.id,
      business_id: data.business_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
      created_at: data.created_at,
      visits_count: visitData?.visits_count ?? 0,
      last_visit_at: visitData?.last_visit_at ?? null,
    };

    console.log('[ClientsService] Fetched client:', mergedClient.id, mergedClient.name);
    return { data: mergedClient, error: null };
  } catch (err) {
    console.log('[ClientsService] Unexpected error in getClient:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch client'),
    };
  }
}

/**
 * Create a new client.
 * RLS ensures the business_id belongs to the authenticated user.
 *
 * @param clientData - The client data to create
 * @returns Promise with created client, or error
 */
export async function createClient(
  clientData: CreateClientData
): Promise<ClientsResult<SupabaseClient>> {
  try {
    console.log('[ClientsService] createClient called:', {
      business_id: clientData.business_id,
      name: clientData.name,
    });

    if (!clientData.business_id) {
      console.log('[ClientsService] No business_id provided for create');
      return { data: null, error: new Error('No business_id provided') };
    }

    if (!clientData.name?.trim()) {
      console.log('[ClientsService] No name provided for create');
      return { data: null, error: new Error('Client name is required') };
    }

    // --- Duplicate email guard ---
    // Normalize: always lower+trim before any comparison or insert
    const normalizedEmail = clientData.email?.trim().toLowerCase() || null;
    if (normalizedEmail) {
      const { data: existingByEmail, error: emailLookupError } = await getSupabase()
        .from('clients')
        .select('*')
        .eq('business_id', clientData.business_id)
        .eq('email', normalizedEmail)         // exact match on already-normalized value
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })     // fully deterministic tiebreaker
        .limit(1)
        .maybeSingle();

      if (emailLookupError) {
        console.log('[ClientsService] Email lookup error (non-fatal):', emailLookupError.message);
      } else if (existingByEmail) {
        console.log('[ClientsService] Duplicate email detected — reusing client:', existingByEmail.id);
        const dupError = new Error('CLIENT_EMAIL_DUPLICATE') as any;
        dupError.code = 'CLIENT_EMAIL_DUPLICATE';
        dupError.existingClientId = existingByEmail.id;
        dupError.existingClient = existingByEmail;
        return { data: null, error: dupError };
      }
    }
    // --- End duplicate email guard ---

    // --- Duplicate phone guard ---
    const normalizedPhone = clientData.phone?.trim() || null;
    if (normalizedPhone) {
      const { data: existingByPhone, error: phoneLookupError } = await getSupabase()
        .from('clients')
        .select('*')
        .eq('business_id', clientData.business_id)
        .eq('phone', normalizedPhone)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (phoneLookupError) {
        console.log('[ClientsService] Phone lookup error (non-fatal):', phoneLookupError.message);
      } else if (existingByPhone) {
        console.log('[ClientsService] Duplicate phone detected — reusing client:', existingByPhone.id);
        const dupError = new Error('CLIENT_PHONE_DUPLICATE') as any;
        dupError.code = 'CLIENT_PHONE_DUPLICATE';
        dupError.existingClientId = existingByPhone.id;
        dupError.existingClient = existingByPhone;
        return { data: null, error: dupError };
      }
    }
    // --- End duplicate phone guard ---

    const { data, error } = await getSupabase()
      .from('clients')
      .insert({
        business_id: clientData.business_id,
        name: clientData.name.trim(),
        email: normalizedEmail || null,
        phone: clientData.phone?.trim() || null,
        notes: clientData.notes?.trim() || null,
        visits_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.log('[ClientsService] Error creating client:', error.message, error.code);
      // DB-level unique constraint on (business_id, lower(email)) — treat as duplicate
      if (error.code === '23505' && error.message?.includes('idx_clients_business_email_unique')) {
        // Re-fetch the canonical existing client
        const { data: existing } = await getSupabase()
          .from('clients')
          .select('*')
          .eq('business_id', clientData.business_id)
          .eq('email', normalizedEmail ?? '')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();
        const dupError = new Error('CLIENT_EMAIL_DUPLICATE') as any;
        dupError.code = 'CLIENT_EMAIL_DUPLICATE';
        dupError.existingClientId = existing?.id;
        dupError.existingClient = existing;
        return { data: null, error: dupError };
      }
      return { data: null, error };
    }

    console.log('[ClientsService] Client created successfully:', data.id);
    return { data: data as SupabaseClient, error: null };
  } catch (err) {
    console.log('[ClientsService] Unexpected error in createClient:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create client'),
    };
  }
}

/**
 * Update an existing client.
 * RLS ensures the client belongs to the user's business.
 *
 * @param clientId - The client ID to update
 * @param updates - The fields to update
 * @returns Promise with updated client, or error
 */
export async function updateClient(
  clientId: string,
  updates: UpdateClientData
): Promise<ClientsResult<SupabaseClient>> {
  try {
    console.log('[ClientsService] updateClient called:', { clientId, updates });

    if (!clientId) {
      console.log('[ClientsService] No client_id provided for update');
      return { data: null, error: new Error('No client_id provided') };
    }

    // --- Duplicate email guard for update ---
    const normalizedEmailUpdate = updates.email?.trim().toLowerCase() || null;
    if (updates.email !== undefined && normalizedEmailUpdate) {
      // Fetch current client to get business_id
      const { data: currentClient } = await getSupabase()
        .from('clients')
        .select('id, business_id')
        .eq('id', clientId)
        .single();

      if (currentClient?.business_id) {
        const { data: existingEmail } = await getSupabase()
          .from('clients')
          .select('id')
          .eq('business_id', currentClient.business_id)
          .ilike('email', normalizedEmailUpdate)
          .neq('id', clientId)
          .limit(1)
          .maybeSingle();

        if (existingEmail) {
          console.log('[ClientsService] Duplicate email on update:', existingEmail.id);
          const dupError = new Error('CLIENT_EMAIL_DUPLICATE') as Error & { code: string; existingClientId: string };
          (dupError as any).code = 'CLIENT_EMAIL_DUPLICATE';
          (dupError as any).existingClientId = existingEmail.id;
          return { data: null, error: dupError };
        }
      }
    }

    // --- Duplicate phone guard for update ---
    const normalizedPhoneUpdate = updates.phone?.trim() || null;
    if (updates.phone !== undefined && normalizedPhoneUpdate) {
      const { data: currentClient } = await getSupabase()
        .from('clients')
        .select('id, business_id')
        .eq('id', clientId)
        .single();

      if (currentClient?.business_id) {
        const { data: existingPhone } = await getSupabase()
          .from('clients')
          .select('id')
          .eq('business_id', currentClient.business_id)
          .eq('phone', normalizedPhoneUpdate)
          .neq('id', clientId)
          .limit(1)
          .maybeSingle();

        if (existingPhone) {
          console.log('[ClientsService] Duplicate phone on update:', existingPhone.id);
          const dupError = new Error('CLIENT_PHONE_DUPLICATE') as Error & { code: string; existingClientId: string };
          (dupError as any).code = 'CLIENT_PHONE_DUPLICATE';
          (dupError as any).existingClientId = existingPhone.id;
          return { data: null, error: dupError };
        }
      }
    }
    // --- End duplicate guards ---

    // Build update object, only including defined fields
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.email !== undefined) updateData.email = updates.email?.trim() || null;
    if (updates.phone !== undefined) updateData.phone = updates.phone?.trim() || null;
    if (updates.notes !== undefined) updateData.notes = updates.notes?.trim() || null;
    if (updates.visits_count !== undefined) updateData.visits_count = updates.visits_count;

    const { data, error } = await getSupabase()
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select()
      .single();

    if (error) {
      console.log('[ClientsService] Error updating client:', error.message);
      return { data: null, error };
    }

    console.log('[ClientsService] Client updated successfully:', data.id);
    return { data: data as SupabaseClient, error: null };
  } catch (err) {
    console.log('[ClientsService] Unexpected error in updateClient:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update client'),
    };
  }
}

/**
 * Delete a client via the backend API.
 * The backend uses the admin Supabase client to:
 *   1. Soft-delete all appointments for the client (is_deleted = true)
 *      so the NOT NULL FK constraint is satisfied.
 *   2. Delete the client row.
 *
 * @param clientId - The client ID to delete
 * @returns Promise with null data on success, or error
 */
export async function deleteClient(
  clientId: string
): Promise<ClientsResult<null>> {
  try {
    console.log('[ClientsService] deleteClient called for ID:', clientId);

    if (!clientId) {
      console.log('[ClientsService] No client_id provided for delete');
      return { data: null, error: new Error('No client_id provided') };
    }

    const backendUrl =
      process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      'http://localhost:3000';

    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${backendUrl}/api/clients/${clientId}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      const msg = body?.error || `Server error ${res.status}`;
      console.log('[ClientsService] Error deleting client via API:', msg);
      return { data: null, error: new Error(msg) };
    }

    console.log('[ClientsService] Client deleted successfully:', clientId);
    return { data: null, error: null };
  } catch (err) {
    console.log('[ClientsService] Unexpected error in deleteClient:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete client'),
    };
  }
}

/**
 * Increment a client's visit count.
 *
 * @param clientId - The client ID to update
 * @returns Promise with updated client, or error
 */
export async function incrementVisitCount(
  clientId: string
): Promise<ClientsResult<SupabaseClient>> {
  try {
    console.log('[ClientsService] incrementVisitCount called for ID:', clientId);

    // First get current count
    const { data: currentClient, error: fetchError } = await getSupabase()
      .from('clients')
      .select('visits_count')
      .eq('id', clientId)
      .single();

    if (fetchError) {
      console.log('[ClientsService] Error fetching client for increment:', fetchError.message);
      return { data: null, error: fetchError };
    }

    const newCount = (currentClient?.visits_count || 0) + 1;

    const { data, error } = await getSupabase()
      .from('clients')
      .update({ visits_count: newCount })
      .eq('id', clientId)
      .select()
      .single();

    if (error) {
      console.log('[ClientsService] Error incrementing visit count:', error.message);
      return { data: null, error };
    }

    console.log('[ClientsService] Visit count incremented to:', newCount);
    return { data: data as SupabaseClient, error: null };
  } catch (err) {
    console.log('[ClientsService] Unexpected error in incrementVisitCount:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to increment visit count'),
    };
  }
}

/**
 * Search clients by name, email, or phone.
 *
 * @param ownerId - The owner ID to search within
 * @param query - The search query
 * @returns Promise with matching clients, or error
 */
export async function searchClients(
  ownerId: string,
  query: string
): Promise<ClientsResult<SupabaseClient[]>> {
  try {
    console.log('[ClientsService] searchClients called:', { ownerId, query });

    if (!ownerId) {
      return { data: null, error: new Error('No owner_id provided') };
    }

    if (!query.trim()) {
      return getClients(ownerId);
    }

    const searchTerm = `%${query.trim().toLowerCase()}%`;

    const { data, error } = await getSupabase()
      .from('clients')
      .select('id, business_id, name, email, phone, notes, created_at')
      .eq('owner_id', ownerId)
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.log('[ClientsService] Error searching clients:', error.message);
      return { data: null, error };
    }

    console.log('[ClientsService] Found', data?.length || 0, 'clients matching query');
    return { data: data as SupabaseClient[], error: null };
  } catch (err) {
    console.log('[ClientsService] Unexpected error in searchClients:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to search clients'),
    };
  }
}
