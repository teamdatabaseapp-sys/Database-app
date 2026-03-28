-- ============================================
-- UNIFIED APPOINTMENTS ARCHITECTURE
-- ============================================
-- This migration consolidates the booking system to use
-- appointments as the SINGLE source of truth.
--
-- Changes:
-- 1. Add confirmation_code column to appointments table
-- 2. Add online booking metadata columns to appointments
-- 3. Update create_public_booking RPC to write ONLY to appointments
-- 4. Update get_booking_by_confirmation to query appointments
-- 5. Keep public_bookings only for analytics/audit (not for logic)
-- ============================================

-- ============================================
-- STEP 1: Add confirmation_code and online booking columns to appointments
-- ============================================

-- Add confirmation_code column (for online booking lookups)
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS confirmation_code TEXT UNIQUE;

-- Add online booking customer info columns
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_name TEXT;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Add booking source tracking
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'online_booking', 'import', 'recurring'));

-- Add booked locale for email translations
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS booked_locale TEXT DEFAULT 'en';

-- Create index for confirmation code lookups
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_code
ON public.appointments(confirmation_code)
WHERE confirmation_code IS NOT NULL;

-- Create index for online bookings
CREATE INDEX IF NOT EXISTS idx_appointments_source
ON public.appointments(source);

-- ============================================
-- STEP 2: Update create_public_booking RPC
-- ============================================
-- Now writes ONLY to appointments (single source of truth)
-- public_bookings insert is optional audit log only

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
  v_appointment_id UUID;
  v_confirmation_code TEXT;
  v_end_at TIMESTAMPTZ;
  v_conflict_exists BOOLEAN;
  v_business_name TEXT;
  v_service_name TEXT;
  v_staff_name TEXT;
  v_client_id UUID;
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

  -- Generate unique confirmation code
  v_confirmation_code := UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));

  -- Check for time slot conflicts in appointments table ONLY
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
      AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = v_normalized_phone
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
  -- STEP B: Create appointment (SINGLE SOURCE OF TRUTH)
  -- ============================================
  INSERT INTO public.appointments (
    business_id,
    store_id,
    staff_id,
    client_id,
    start_at,
    end_at,
    confirmation_code,
    customer_name,
    customer_email,
    customer_phone,
    customer_notes,
    source,
    booked_locale,
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
    v_confirmation_code,
    TRIM(p_customer_name),
    v_normalized_email,
    p_customer_phone,
    p_customer_notes,
    'online_booking',
    p_locale,
    'Online Booking' || E'\n' ||
    'Customer: ' || TRIM(p_customer_name) || E'\n' ||
    'Email: ' || v_normalized_email ||
    CASE WHEN p_customer_phone IS NOT NULL THEN E'\n' || 'Phone: ' || p_customer_phone ELSE '' END ||
    CASE WHEN p_customer_notes IS NOT NULL THEN E'\n' || 'Notes: ' || p_customer_notes ELSE '' END,
    FALSE,
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_appointment_id;

  -- ============================================
  -- STEP C: Link appointment to service (if provided)
  -- ============================================
  IF p_service_id IS NOT NULL AND v_appointment_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.appointment_services (appointment_id, service_id)
      VALUES (v_appointment_id, p_service_id);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    WHEN unique_violation THEN
      NULL;
    WHEN others THEN
      NULL;
    END;
  END IF;

  -- ============================================
  -- STEP D: Log to public_bookings for audit (optional, non-blocking)
  -- ============================================
  BEGIN
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
      confirmation_code,
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
      v_confirmation_code,
      p_locale,
      'confirmed'
    );
  EXCEPTION WHEN others THEN
    -- Non-blocking: audit log failure doesn't affect booking
    NULL;
  END;

  -- Return success with booking details
  RETURN jsonb_build_object(
    'success', TRUE,
    'booking', jsonb_build_object(
      'id', v_appointment_id,
      'confirmation_code', v_confirmation_code,
      'business_id', p_business_id,
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
      'appointment_id', v_appointment_id,
      'source', 'online_booking'
    )
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Failed to create booking: ' || SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO authenticated;

-- ============================================
-- STEP 3: Update get_booking_by_confirmation RPC
-- ============================================
-- Now queries ONLY the appointments table

CREATE OR REPLACE FUNCTION public.get_booking_by_confirmation(
  p_confirmation_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'business_id', a.business_id,
    'confirmation_code', a.confirmation_code,
    'business_name', b.name,
    'service_name', s.name,
    'staff_name', COALESCE(st.full_name, st.name),
    'store_name', str.name,
    'store_address', str.address,
    'customer_name', COALESCE(a.customer_name, c.name),
    'customer_email', COALESCE(a.customer_email, c.email),
    'customer_phone', COALESCE(a.customer_phone, c.phone),
    'customer_notes', a.customer_notes,
    'start_at', a.start_at,
    'end_at', a.end_at,
    'duration_minutes', EXTRACT(EPOCH FROM (a.end_at - a.start_at)) / 60,
    'status', CASE
      WHEN a.is_cancelled THEN 'cancelled'
      WHEN a.is_deleted THEN 'deleted'
      ELSE 'confirmed'
    END,
    'source', a.source,
    'booked_locale', a.booked_locale,
    'created_at', a.created_at,
    'client_id', a.client_id
  ) INTO v_result
  FROM public.appointments a
  JOIN public.businesses b ON b.id = a.business_id
  LEFT JOIN public.clients c ON c.id = a.client_id
  LEFT JOIN public.staff st ON st.id = a.staff_id
  LEFT JOIN public.stores str ON str.id = a.store_id
  LEFT JOIN public.appointment_services aps ON aps.appointment_id = a.id
  LEFT JOIN public.services s ON s.id = aps.service_id
  WHERE a.confirmation_code = UPPER(p_confirmation_code)
    AND COALESCE(a.is_deleted, FALSE) = FALSE;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_booking_by_confirmation(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booking_by_confirmation(TEXT) TO authenticated;

-- ============================================
-- STEP 4: Migration function for existing data
-- ============================================
-- Migrates public_bookings to appointments with confirmation_code

CREATE OR REPLACE FUNCTION public.migrate_bookings_to_unified_appointments()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_migrated_count INTEGER := 0;
  v_booking RECORD;
  v_client_id UUID;
  v_appointment_id UUID;
  v_normalized_email TEXT;
BEGIN
  -- Loop through public_bookings that don't have corresponding appointments
  FOR v_booking IN
    SELECT pb.*
    FROM public.public_bookings pb
    WHERE pb.status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.confirmation_code = pb.confirmation_code
      )
    ORDER BY pb.created_at
  LOOP
    v_normalized_email := LOWER(TRIM(v_booking.customer_email));

    -- Find or create client
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE business_id = v_booking.business_id
      AND LOWER(TRIM(email)) = v_normalized_email
    LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (
        business_id, name, email, phone, created_at, updated_at
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

    -- Create appointment with confirmation_code
    INSERT INTO public.appointments (
      business_id,
      store_id,
      staff_id,
      client_id,
      start_at,
      end_at,
      confirmation_code,
      customer_name,
      customer_email,
      customer_phone,
      customer_notes,
      source,
      booked_locale,
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
      v_booking.confirmation_code,
      TRIM(v_booking.customer_name),
      v_normalized_email,
      v_booking.customer_phone,
      v_booking.customer_notes,
      'online_booking',
      COALESCE(v_booking.booked_locale, 'en'),
      'Online Booking (Migrated)' || E'\n' ||
      'Customer: ' || TRIM(v_booking.customer_name) || E'\n' ||
      'Email: ' || v_normalized_email ||
      CASE WHEN v_booking.customer_phone IS NOT NULL THEN E'\n' || 'Phone: ' || v_booking.customer_phone ELSE '' END,
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

    v_migrated_count := v_migrated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'migrated_count', v_migrated_count,
    'message', 'Migrated ' || v_migrated_count || ' bookings to unified appointments'
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM,
    'migrated_count', v_migrated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrate_bookings_to_unified_appointments() TO authenticated;

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- 1. Run this entire SQL in Supabase SQL Editor
-- 2. Migrate existing bookings:
--    SELECT public.migrate_bookings_to_unified_appointments();
-- 3. Verify: SELECT id, confirmation_code, customer_name, source
--            FROM appointments WHERE source = 'online_booking';
-- ============================================
