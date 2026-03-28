/**
 * Services Service
 *
 * Handles all Supabase operations for the services table and appointment_services junction table.
 * All operations are scoped by business_id for multi-tenant security.
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export interface SupabaseService {
  id: string;
  business_id: string;
  name: string;
  description?: string | null; // Optional service description
  color: string;
  duration_minutes: number;
  price_cents: number;
  currency_code: string; // Currency derived from business country at save time
  service_type: 'service' | 'product'; // 'service' = appointment-based, 'product' = no time required
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentService {
  appointment_id: string;
  service_id: string;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Service Operations
// ============================================

/**
 * Get all active services for a business
 */
export async function getServices(businessId: string): Promise<ServiceResult<SupabaseService[]>> {
  try {
    console.log('[ServicesService] getServices called:', { businessId });

    if (!businessId) {
      console.log('[ServicesService] No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    const { data, error } = await getSupabase()
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.log('[ServicesService] Error fetching services:', error.message);
      return { data: null, error };
    }

    console.log('[ServicesService] Services fetched:', data?.length ?? 0);
    return { data: data as SupabaseService[], error: null };
  } catch (err) {
    console.log('[ServicesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch services'),
    };
  }
}

/**
 * Get services for a specific appointment
 */
export async function getAppointmentServices(appointmentId: string): Promise<ServiceResult<SupabaseService[]>> {
  try {
    console.log('[ServicesService] getAppointmentServices called:', { appointmentId });

    const { data, error } = await getSupabase()
      .from('appointment_services')
      .select(`
        service_id,
        services:service_id (
          id,
          business_id,
          name,
          color,
          is_active,
          created_at,
          updated_at
        )
      `)
      .eq('appointment_id', appointmentId);

    if (error) {
      console.log('[ServicesService] Error fetching appointment services:', error.message);
      return { data: null, error };
    }

    // Extract services from the joined data
    // Supabase returns the joined table as an array, so we need to flatten it
    const services: SupabaseService[] = [];
    for (const item of data || []) {
      const svc = item.services;
      if (Array.isArray(svc)) {
        // If it's an array (shouldn't be with single FK, but handle it)
        for (const s of svc) {
          if (s && typeof s === 'object' && 'id' in s) {
            services.push(s as SupabaseService);
          }
        }
      } else if (svc && typeof svc === 'object' && 'id' in svc) {
        services.push(svc as SupabaseService);
      }
    }

    console.log('[ServicesService] Appointment services fetched:', services.length);
    return { data: services, error: null };
  } catch (err) {
    console.log('[ServicesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch appointment services'),
    };
  }
}

/**
 * Sync appointment services (delete existing, insert new)
 * This is called after creating/updating an appointment
 */
export async function syncAppointmentServices(
  appointmentId: string,
  serviceIds: string[]
): Promise<ServiceResult<AppointmentService[]>> {
  try {
    console.log('[ServicesService] syncAppointmentServices called:', { appointmentId, serviceIds });

    // Step 1: Delete all existing appointment_services for this appointment
    const { error: deleteError } = await getSupabase()
      .from('appointment_services')
      .delete()
      .eq('appointment_id', appointmentId);

    if (deleteError) {
      console.log('[ServicesService] Error deleting existing appointment services:', deleteError.message);
      return { data: null, error: deleteError };
    }

    // Step 2: If no services to insert, we're done
    if (serviceIds.length === 0) {
      console.log('[ServicesService] No services to insert, done');
      return { data: [], error: null };
    }

    // Step 3: Insert new appointment_services
    const insertData = serviceIds.map((serviceId) => ({
      appointment_id: appointmentId,
      service_id: serviceId,
    }));

    const { data, error: insertError } = await getSupabase()
      .from('appointment_services')
      .insert(insertData)
      .select();

    if (insertError) {
      console.log('[ServicesService] Error inserting appointment services:', insertError.message);
      return { data: null, error: insertError };
    }

    console.log('[ServicesService] Appointment services synced:', data?.length ?? 0);
    return { data: data as AppointmentService[], error: null };
  } catch (err) {
    console.log('[ServicesService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to sync appointment services'),
    };
  }
}

/**
 * Create a new service
 */
export async function createService(
  businessId: string,
  name: string,
  color: string,
  durationMinutes: number = 60,
  priceCents: number = 0,
  currencyCode: string = 'USD',
  serviceType: 'service' | 'product' = 'service',
  description?: string | null
): Promise<ServiceResult<SupabaseService>> {
  try {
    console.log('[ServicesService] createService called:', JSON.stringify({ businessId, name, color, durationMinutes, priceCents, currencyCode, serviceType, description }, null, 2));

    if (!businessId) {
      console.log('[ServicesService] ERROR: No business ID provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    if (!name?.trim()) {
      console.log('[ServicesService] ERROR: Service name is required');
      return { data: null, error: new Error('Service name is required') };
    }

    // Build insert data - start with core fields
    const insertData: Record<string, unknown> = {
      business_id: businessId,
      name: name.trim(),
      color: color || '#0D9488',
      duration_minutes: durationMinutes,
      price_cents: priceCents,
      is_active: true,
    };

    // Try with all optional columns first
    let { data, error } = await getSupabase()
      .from('services')
      .insert({
        ...insertData,
        currency_code: currencyCode,
        service_type: serviceType,
        description: description?.trim() || null,
      })
      .select()
      .single();

    // If column doesn't exist, retry without optional columns one by one
    if (error && (error.message?.includes('currency_code') || error.message?.includes('service_type') || error.message?.includes('description'))) {
      console.log('[ServicesService] Optional columns not found, retrying with core fields only');
      const retryResult = await getSupabase()
        .from('services')
        .insert(insertData)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.log('[ServicesService] ERROR creating service:', error.message, error.code, error.details, error.hint);
      return { data: null, error };
    }

    console.log('[ServicesService] Service created successfully:', data?.id);
    return { data: data as SupabaseService, error: null };
  } catch (err) {
    console.log('[ServicesService] UNEXPECTED ERROR creating service:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create service'),
    };
  }
}

/**
 * Update a service
 */
export async function updateService(
  serviceId: string,
  updates: { name?: string; description?: string | null; color?: string; duration_minutes?: number; price_cents?: number; currency_code?: string; service_type?: 'service' | 'product'; is_active?: boolean }
): Promise<ServiceResult<SupabaseService>> {
  try {
    console.log('[ServicesService] updateService called:', { serviceId, updates });

    let { data, error } = await getSupabase()
      .from('services')
      .update(updates)
      .eq('id', serviceId)
      .select()
      .single();

    // If optional columns don't exist, retry without them
    if (error && (error.message?.includes('currency_code') || error.message?.includes('service_type') || error.message?.includes('description'))) {
      console.log('[ServicesService] Optional columns not found, retrying without them');
      const { currency_code, service_type, description, ...coreUpdates } = updates;
      const retryResult = await getSupabase()
        .from('services')
        .update(coreUpdates)
        .eq('id', serviceId)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.log('[ServicesService] Error updating service:', error.message);
      return { data: null, error };
    }

    console.log('[ServicesService] Service updated:', data?.id);
    return { data: data as SupabaseService, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update service'),
    };
  }
}

/**
 * Soft delete a service (set is_active to false)
 */
export async function deleteService(serviceId: string): Promise<ServiceResult<SupabaseService>> {
  try {
    console.log('[ServicesService] deleteService called:', { serviceId });

    const { data, error } = await getSupabase()
      .from('services')
      .update({ is_active: false })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) {
      console.log('[ServicesService] Error deleting service:', error.message);
      return { data: null, error };
    }

    console.log('[ServicesService] Service deleted:', data?.id);
    return { data: data as SupabaseService, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete service'),
    };
  }
}
