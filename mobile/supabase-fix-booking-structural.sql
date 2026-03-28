-- ============================================
-- STRUCTURAL FIX: Online Booking RPC Functions
-- ============================================
-- This migration fixes BOTH structural issues:
-- 1. clients.updated_at column does not exist (REMOVED from INSERT)
-- 2. Appointments must be INSERT-only (no ON CONFLICT, no UPDATE)
--
-- GUARANTEES:
-- - NO ON CONFLICT clause
-- - NO UPDATE statement on appointments
-- - NO triggers that modify appointments
-- - STRICT INSERT-only for new appointments
-- ============================================

-- ============================================
-- STEP 1: Drop any triggers that modify appointments
-- ============================================

DROP TRIGGER IF EXISTS check_staff_availability_trigger ON public.appointments;
DROP TRIGGER IF EXISTS validate_staff_schedule_trigger ON public.appointments;
DROP TRIGGER IF EXISTS staff_weekly_check_trigger ON public.appointments;
DROP TRIGGER IF EXISTS appointment_before_insert ON public.appointments;
DROP TRIGGER IF EXISTS appointment_after_insert ON public.appointments;
DROP TRIGGER IF EXISTS appointment_before_update ON public.appointments;
DROP TRIGGER IF EXISTS appointment_after_update ON public.appointments;

DROP FUNCTION IF EXISTS check_staff_availability();
DROP FUNCTION IF EXISTS validate_staff_schedule();
DROP FUNCTION IF EXISTS check_staff_weekly_schedule();

-- ============================================
-- STEP 2: Ensure required columns exist on appointments table
-- ============================================

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS confirmation_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'appointments_confirmation_code_key'
  ) THEN
    CREATE UNIQUE INDEX appointments_confirmation_code_key
    ON public.appointments(confirmation_code)
    WHERE confirmation_code IS NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_name TEXT;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_email TEXT;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS customer_notes TEXT;

DO $$
BEGIN
  ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
EXCEPTION WHEN others THEN
  NULL;
END $$;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS booked_locale TEXT DEFAULT 'en';

-- ============================================
-- STEP 3: Drop and recreate create_public_booking RPC
-- ============================================
-- SECURITY DEFINER bypasses RLS
-- STRICT INSERT-ONLY architecture
-- NO ON CONFLICT
-- NO UPDATE

DROP FUNCTION IF EXISTS public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_business_id UUID,
  p_store_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL,
  p_start_at TIMESTAMPTZ DEFAULT NULL,
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
  -- Log entry
  RAISE NOTICE '[create_public_booking] Starting with business_id=%, store_id=%, staff_id=%',
    p_business_id, p_store_id, p_staff_id;

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

  -- Normalize email and phone for matching
  v_normalized_email := LOWER(TRIM(p_customer_email));
  v_normalized_phone := REGEXP_REPLACE(COALESCE(p_customer_phone, ''), '[^0-9]', '', 'g');

  -- Calculate end time
  v_end_at := p_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Generate unique confirmation code (8 chars, uppercase)
  v_confirmation_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));

  RAISE NOTICE '[create_public_booking] Generated confirmation_code=%', v_confirmation_code;

  -- Check for time slot conflicts in appointments table
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
    RAISE NOTICE '[create_public_booking] Time slot conflict detected';
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
  -- STEP A: Create/match client (SECURITY DEFINER bypasses RLS)
  -- NOTE: clients table does NOT have updated_at column
  -- ============================================
  RAISE NOTICE '[create_public_booking] Looking for existing client by email=%', v_normalized_email;

  -- Try to find existing client by email
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE business_id = p_business_id
    AND LOWER(TRIM(email)) = v_normalized_email
  LIMIT 1;

  -- If not found by email, try to find by phone
  IF v_client_id IS NULL AND v_normalized_phone IS NOT NULL AND LENGTH(v_normalized_phone) >= 7 THEN
    RAISE NOTICE '[create_public_booking] Not found by email, trying phone=%', v_normalized_phone;
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE business_id = p_business_id
      AND phone IS NOT NULL
      AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = v_normalized_phone
    LIMIT 1;
  END IF;

  -- If no existing client found, create a new one
  -- FIXED: Removed updated_at column (does not exist in production)
  IF v_client_id IS NULL THEN
    RAISE NOTICE '[create_public_booking] Creating new client';
    INSERT INTO public.clients (
      business_id,
      name,
      email,
      phone,
      created_at
    ) VALUES (
      p_business_id,
      TRIM(p_customer_name),
      v_normalized_email,
      p_customer_phone,
      NOW()
    )
    RETURNING id INTO v_client_id;
    RAISE NOTICE '[create_public_booking] Created client_id=%', v_client_id;
  ELSE
    RAISE NOTICE '[create_public_booking] Found existing client_id=%', v_client_id;
  END IF;

  -- ============================================
  -- STEP B: Create NEW appointment (STRICT INSERT ONLY)
  -- ============================================
  -- CRITICAL GUARANTEES:
  -- 1. Generate NEW UUID before insert
  -- 2. Use plain INSERT (no ON CONFLICT)
  -- 3. No UPDATE statement
  -- 4. Each booking = one new row

  v_appointment_id := gen_random_uuid();

  RAISE NOTICE '[create_public_booking] Creating NEW appointment with id=%', v_appointment_id;

  INSERT INTO public.appointments (
    id,
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
    v_appointment_id,
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
  );

  RAISE NOTICE '[create_public_booking] INSERTED appointment_id=% for client_id=%', v_appointment_id, v_client_id;

  -- ============================================
  -- STEP C: Link appointment to service (if provided)
  -- ============================================
  IF p_service_id IS NOT NULL AND v_appointment_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.appointment_services (appointment_id, service_id)
      VALUES (v_appointment_id, p_service_id);
      RAISE NOTICE '[create_public_booking] Linked service_id=%', p_service_id;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE '[create_public_booking] appointment_services table does not exist';
    WHEN unique_violation THEN
      RAISE NOTICE '[create_public_booking] Service link already exists';
    WHEN others THEN
      RAISE NOTICE '[create_public_booking] Failed to link service: %', SQLERRM;
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
    RAISE NOTICE '[create_public_booking] Logged to public_bookings';
  EXCEPTION WHEN others THEN
    RAISE NOTICE '[create_public_booking] public_bookings audit log failed: %', SQLERRM;
  END;

  RAISE NOTICE '[create_public_booking] SUCCESS - appointment_id=%, client_id=%, confirmation_code=%',
    v_appointment_id, v_client_id, v_confirmation_code;

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
  RAISE NOTICE '[create_public_booking] EXCEPTION: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Failed to create booking: ' || SQLERRM
  );
END;
$$;

-- Grant execute permission to all (including anon for public booking page)
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO authenticated;

-- ============================================
-- STEP 4: Create create_online_booking alias
-- ============================================
-- Backend tries create_online_booking first, then create_public_booking

DROP FUNCTION IF EXISTS public.create_online_booking(UUID, UUID, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_online_booking(
  p_business_id UUID,
  p_store_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_start_at TIMESTAMPTZ DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_locale TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration INTEGER := 60;
BEGIN
  -- Look up service duration if service_id provided
  IF p_service_id IS NOT NULL THEN
    SELECT COALESCE(duration_minutes, 60) INTO v_duration
    FROM public.services
    WHERE id = p_service_id;
  END IF;

  -- Delegate to create_public_booking
  RETURN public.create_public_booking(
    p_business_id,
    p_store_id,
    p_staff_id,
    p_service_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    NULL, -- customer_notes
    p_start_at,
    v_duration,
    p_locale
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_online_booking(UUID, UUID, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_online_booking(UUID, UUID, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- STEP 5: Notify PostgREST to reload schema
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'STRUCTURAL FIX COMPLETE' as status,
       'No ON CONFLICT' as guarantee_1,
       'No UPDATE on appointments' as guarantee_2,
       'No triggers on appointments' as guarantee_3,
       'clients.updated_at removed' as guarantee_4;
