-- ============================================
-- CRITICAL FIX: Sync Online Bookings to CRM
-- ============================================
-- This migration updates the create_public_booking function to:
-- 1. Create/match a client in the clients table
-- 2. Create an appointment in the appointments table
-- 3. Link the appointment to the client
--
-- This ensures online bookings appear in:
-- - Appointments view
-- - Today itinerary
-- - Calendar view
-- - Client details
-- ============================================

-- STEP 1: Update the create_public_booking function to sync to appointments
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_business_id UUID,
  p_store_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL,
  p_start_at TIMESTAMPTZ,
  p_duration_minutes INTEGER DEFAULT 60,
  p_locale TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_confirmation_code TEXT;
  v_end_at TIMESTAMPTZ;
  v_conflict_exists BOOLEAN;
  v_business_name TEXT;
  v_service_name TEXT;
  v_staff_name TEXT;
  v_client_id UUID;
  v_appointment_id UUID;
  v_normalized_email TEXT;
  v_normalized_phone TEXT;
BEGIN
  -- Validate required fields
  IF p_customer_name IS NULL OR TRIM(p_customer_name) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Customer name is required');
  END IF;

  IF p_customer_email IS NULL OR TRIM(p_customer_email) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Customer email is required');
  END IF;

  IF p_start_at IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Start time is required');
  END IF;

  -- Check if booking is in the past
  IF p_start_at < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Cannot book in the past');
  END IF;

  -- Normalize email and phone for matching
  v_normalized_email := LOWER(TRIM(p_customer_email));
  v_normalized_phone := REGEXP_REPLACE(COALESCE(p_customer_phone, ''), '[^0-9]', '', 'g');

  -- Calculate end time
  v_end_at := p_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Check for time slot conflicts in public_bookings
  SELECT EXISTS (
    SELECT 1 FROM public.public_bookings pb
    WHERE pb.business_id = p_business_id
      AND pb.status NOT IN ('cancelled')
      AND (p_store_id IS NULL OR pb.store_id = p_store_id)
      AND (p_staff_id IS NULL OR pb.staff_id = p_staff_id)
      AND pb.start_at < v_end_at
      AND pb.end_at > p_start_at
  ) INTO v_conflict_exists;

  -- Also check internal appointments table
  IF NOT v_conflict_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.business_id = p_business_id
        AND COALESCE(a.is_deleted, FALSE) = FALSE
        AND COALESCE(a.is_cancelled, FALSE) = FALSE
        AND (p_store_id IS NULL OR a.store_id = p_store_id)
        AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
        AND a.start_at < v_end_at
        AND a.end_at > p_start_at
    ) INTO v_conflict_exists;
  END IF;

  IF v_conflict_exists THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Time slot is no longer available');
  END IF;

  -- Get business name
  SELECT name INTO v_business_name
  FROM public.businesses
  WHERE id = p_business_id;

  -- Get service name if provided
  IF p_service_id IS NOT NULL THEN
    SELECT name INTO v_service_name
    FROM public.services
    WHERE id = p_service_id AND business_id = p_business_id;
  END IF;

  -- Get staff name if provided
  IF p_staff_id IS NOT NULL THEN
    SELECT COALESCE(full_name, name) INTO v_staff_name
    FROM public.staff
    WHERE id = p_staff_id AND business_id = p_business_id;
  END IF;

  -- ============================================
  -- STEP A: Create/match client
  -- ============================================

  -- Try to find existing client by email
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE business_id = p_business_id
    AND LOWER(TRIM(email)) = v_normalized_email
  LIMIT 1;

  -- If not found by email, try to find by phone
  IF v_client_id IS NULL AND v_normalized_phone IS NOT NULL AND LENGTH(v_normalized_phone) >= 7 THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE business_id = p_business_id
      AND phone IS NOT NULL
      AND (
        REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = v_normalized_phone
        OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE '%' || v_normalized_phone
        OR v_normalized_phone LIKE '%' || REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
      )
    LIMIT 1;
  END IF;

  -- If no existing client found, create a new one
  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      business_id,
      name,
      email,
      phone,
      created_at,
      updated_at
    ) VALUES (
      p_business_id,
      TRIM(p_customer_name),
      v_normalized_email,
      p_customer_phone,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- ============================================
  -- STEP B: Create the public booking record
  -- ============================================
  INSERT INTO public.public_bookings (
    business_id,
    store_id,
    staff_id,
    service_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_notes,
    start_at,
    end_at,
    duration_minutes,
    booked_locale,
    status
  ) VALUES (
    p_business_id,
    p_store_id,
    p_staff_id,
    p_service_id,
    TRIM(p_customer_name),
    v_normalized_email,
    p_customer_phone,
    p_customer_notes,
    p_start_at,
    v_end_at,
    p_duration_minutes,
    p_locale,
    'confirmed'
  )
  RETURNING id, confirmation_code INTO v_booking_id, v_confirmation_code;

  -- ============================================
  -- STEP C: Create appointment in CRM table
  -- ============================================
  INSERT INTO public.appointments (
    business_id,
    store_id,
    staff_id,
    client_id,
    start_at,
    end_at,
    notes,
    is_deleted,
    is_cancelled,
    created_at,
    updated_at
  ) VALUES (
    p_business_id,
    p_store_id,
    p_staff_id,
    v_client_id,
    p_start_at,
    v_end_at,
    'Online Booking' || E'\n' ||
    'Customer: ' || TRIM(p_customer_name) || E'\n' ||
    'Email: ' || v_normalized_email ||
    CASE WHEN p_customer_phone IS NOT NULL THEN E'\n' || 'Phone: ' || p_customer_phone ELSE '' END ||
    CASE WHEN p_customer_notes IS NOT NULL THEN E'\n' || 'Notes: ' || p_customer_notes ELSE '' END ||
    E'\n' || 'Confirmation Code: ' || v_confirmation_code,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_appointment_id;

  -- ============================================
  -- STEP D: Link appointment to service (if provided)
  -- ============================================
  IF p_service_id IS NOT NULL AND v_appointment_id IS NOT NULL THEN
    -- Check if appointment_services table exists and insert
    BEGIN
      INSERT INTO public.appointment_services (appointment_id, service_id)
      VALUES (v_appointment_id, p_service_id);
    EXCEPTION WHEN undefined_table THEN
      -- Table doesn't exist, skip
      NULL;
    WHEN others THEN
      -- Other error, skip silently
      NULL;
    END;
  END IF;

  -- Return success with booking details
  RETURN jsonb_build_object(
    'success', TRUE,
    'booking', jsonb_build_object(
      'id', v_booking_id,
      'confirmation_code', v_confirmation_code,
      'business_name', v_business_name,
      'service_name', v_service_name,
      'staff_name', v_staff_name,
      'customer_name', TRIM(p_customer_name),
      'customer_email', v_normalized_email,
      'start_at', p_start_at,
      'end_at', v_end_at,
      'duration_minutes', p_duration_minutes,
      'status', 'confirmed',
      'client_id', v_client_id,
      'appointment_id', v_appointment_id
    )
  );

EXCEPTION WHEN others THEN
  -- Log error and return failure
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Failed to create booking: ' || SQLERRM
  );
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO authenticated;

-- ============================================
-- STEP 2: Create a sync function for existing bookings
-- ============================================
-- This function syncs existing public_bookings to appointments
-- Run this once to sync any bookings that were created before this migration

CREATE OR REPLACE FUNCTION public.sync_existing_bookings_to_appointments()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_booking RECORD;
  v_client_id UUID;
  v_appointment_id UUID;
  v_normalized_email TEXT;
  v_normalized_phone TEXT;
BEGIN
  -- Loop through all confirmed bookings that don't have a corresponding appointment
  FOR v_booking IN
    SELECT pb.*
    FROM public.public_bookings pb
    WHERE pb.status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.business_id = pb.business_id
          AND a.start_at = pb.start_at
          AND a.notes LIKE '%' || pb.confirmation_code || '%'
      )
    ORDER BY pb.created_at
  LOOP
    -- Normalize email and phone
    v_normalized_email := LOWER(TRIM(v_booking.customer_email));
    v_normalized_phone := REGEXP_REPLACE(COALESCE(v_booking.customer_phone, ''), '[^0-9]', '', 'g');

    -- Find or create client
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE business_id = v_booking.business_id
      AND LOWER(TRIM(email)) = v_normalized_email
    LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (
        business_id,
        name,
        email,
        phone,
        created_at,
        updated_at
      ) VALUES (
        v_booking.business_id,
        TRIM(v_booking.customer_name),
        v_normalized_email,
        v_booking.customer_phone,
        COALESCE(v_booking.created_at, NOW()),
        NOW()
      )
      RETURNING id INTO v_client_id;
    END IF;

    -- Create appointment
    INSERT INTO public.appointments (
      business_id,
      store_id,
      staff_id,
      client_id,
      start_at,
      end_at,
      notes,
      is_deleted,
      is_cancelled,
      created_at,
      updated_at
    ) VALUES (
      v_booking.business_id,
      v_booking.store_id,
      v_booking.staff_id,
      v_client_id,
      v_booking.start_at,
      v_booking.end_at,
      'Online Booking' || E'\n' ||
      'Customer: ' || TRIM(v_booking.customer_name) || E'\n' ||
      'Email: ' || v_normalized_email ||
      CASE WHEN v_booking.customer_phone IS NOT NULL THEN E'\n' || 'Phone: ' || v_booking.customer_phone ELSE '' END ||
      CASE WHEN v_booking.customer_notes IS NOT NULL THEN E'\n' || 'Notes: ' || v_booking.customer_notes ELSE '' END ||
      E'\n' || 'Confirmation Code: ' || v_booking.confirmation_code,
      FALSE,
      CASE WHEN v_booking.status = 'cancelled' THEN TRUE ELSE FALSE END,
      COALESCE(v_booking.created_at, NOW()),
      NOW()
    )
    RETURNING id INTO v_appointment_id;

    -- Link to service if exists
    IF v_booking.service_id IS NOT NULL AND v_appointment_id IS NOT NULL THEN
      BEGIN
        INSERT INTO public.appointment_services (appointment_id, service_id)
        VALUES (v_appointment_id, v_booking.service_id);
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END IF;

    v_synced_count := v_synced_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'synced_count', v_synced_count,
    'message', 'Synced ' || v_synced_count || ' bookings to appointments'
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'synced_count', v_synced_count
  );
END;
$$;

-- Grant execute to authenticated users (business owners)
GRANT EXECUTE ON FUNCTION public.sync_existing_bookings_to_appointments() TO authenticated;

-- ============================================
-- STEP 3: Run the sync for existing bookings
-- ============================================
-- Uncomment the following line to sync existing bookings:
-- SELECT public.sync_existing_bookings_to_appointments();

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- 1. Copy this entire SQL to your Supabase SQL Editor
-- 2. Click "Run" to execute the migration
-- 3. To sync existing bookings, run:
--    SELECT public.sync_existing_bookings_to_appointments();
-- 4. New online bookings will automatically create appointments
-- ============================================
