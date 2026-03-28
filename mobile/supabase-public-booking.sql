-- ============================================
-- PUBLIC BOOKING WEBSITE - Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================
-- This adds the necessary tables, functions, and policies
-- for the public booking website at rsvdatabase.com/{business-slug}

-- ============================================
-- STEP 1: Add business_hours table for availability
-- ============================================
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one entry per business/store/day
  UNIQUE(business_id, store_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_hours
CREATE POLICY "Users can view own business hours" ON public.business_hours
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own business hours" ON public.business_hours
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update own business hours" ON public.business_hours
  FOR UPDATE USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete own business hours" ON public.business_hours
  FOR DELETE USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_business_hours_business_id ON public.business_hours(business_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_store_id ON public.business_hours(store_id);

-- ============================================
-- STEP 2: Add public_bookings table for customer bookings
-- ============================================
CREATE TABLE IF NOT EXISTS public.public_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,

  -- Customer info (no auth required)
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_notes TEXT,

  -- Appointment details
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  confirmation_code TEXT UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),

  -- Locale used during booking
  booked_locale TEXT DEFAULT 'en',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.public_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public_bookings
-- Authenticated users (business owners) can view their bookings
CREATE POLICY "Users can view own business public bookings" ON public.public_bookings
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update own business public bookings" ON public.public_bookings
  FOR UPDATE USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete own business public bookings" ON public.public_bookings
  FOR DELETE USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_public_bookings_business_id ON public.public_bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_store_id ON public.public_bookings(store_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_staff_id ON public.public_bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_start_at ON public.public_bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_public_bookings_status ON public.public_bookings(status);
CREATE INDEX IF NOT EXISTS idx_public_bookings_confirmation_code ON public.public_bookings(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_public_bookings_customer_email ON public.public_bookings(customer_email);

-- ============================================
-- STEP 3: Add duration_minutes, price_cents, and currency_code to services if not exists
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE public.services ADD COLUMN duration_minutes INTEGER DEFAULT 60;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'price_cents'
  ) THEN
    ALTER TABLE public.services ADD COLUMN price_cents INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'currency_code'
  ) THEN
    ALTER TABLE public.services ADD COLUMN currency_code TEXT DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.services ADD COLUMN description TEXT;
  END IF;
END $$;

-- ============================================
-- STEP 4: Add booking_slug to businesses if not exists
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'booking_slug'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN booking_slug TEXT UNIQUE;
  END IF;
END $$;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_businesses_booking_slug ON public.businesses(booking_slug);

-- ============================================
-- STEP 5: Enhanced get_public_booking_config function
-- ============================================
CREATE OR REPLACE FUNCTION public.get_public_booking_config(
  p_identifier TEXT, -- Can be UUID (public_token) or slug
  p_locale TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_business_name TEXT;
  v_business_email TEXT;
  v_public_token UUID;
  v_booking_slug TEXT;
  v_result JSONB;
  v_booking_settings JSONB;
  v_services JSONB;
  v_stores JSONB;
  v_staff JSONB;
BEGIN
  -- Try to find business by UUID (public_token) or by slug
  BEGIN
    -- First try as UUID
    SELECT b.id, b.name, b.email, b.public_booking_token, b.booking_slug
    INTO v_business_id, v_business_name, v_business_email, v_public_token, v_booking_slug
    FROM public.businesses b
    WHERE b.public_booking_token = p_identifier::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Not a valid UUID, try as slug
    SELECT b.id, b.name, b.email, b.public_booking_token, b.booking_slug
    INTO v_business_id, v_business_name, v_business_email, v_public_token, v_booking_slug
    FROM public.businesses b
    WHERE b.booking_slug = LOWER(p_identifier);
  END;

  -- Return null if business not found
  IF v_business_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get booking page settings (with defaults if not set)
  SELECT jsonb_build_object(
    'enabled_locales', COALESCE(bps.enabled_locales, ARRAY['en']),
    'default_locale', COALESCE(bps.default_locale, 'en'),
    'smart_language_detection', COALESCE(bps.smart_language_detection, TRUE)
  ) INTO v_booking_settings
  FROM (SELECT 1) dummy
  LEFT JOIN public.booking_page_settings bps ON bps.business_id = v_business_id;

  -- If no settings exist, return defaults
  IF v_booking_settings IS NULL OR v_booking_settings = 'null'::jsonb THEN
    v_booking_settings := jsonb_build_object(
      'enabled_locales', ARRAY['en'],
      'default_locale', 'en',
      'smart_language_detection', TRUE
    );
  END IF;

  -- Get active services for the business
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'description', s.description,
      'color', s.color,
      'duration_minutes', COALESCE(s.duration_minutes, 60),
      'price_cents', COALESCE(s.price_cents, 0),
      'currency_code', COALESCE(s.currency_code, 'USD'),
      'is_active', s.is_active
    ) ORDER BY s.name
  ), '[]'::jsonb) INTO v_services
  FROM public.services s
  WHERE s.business_id = v_business_id
    AND s.is_active = TRUE;

  -- Get active stores for the business
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'name', st.name
    ) ORDER BY st.name
  ), '[]'::jsonb) INTO v_stores
  FROM public.stores st
  WHERE st.business_id = v_business_id
    AND st.is_archived = FALSE;

  -- Get active staff for the business
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sm.id,
      'name', sm.full_name,
      'color', sm.color,
      'store_ids', COALESCE(sm.store_ids, ARRAY[]::UUID[])
    ) ORDER BY sm.full_name
  ), '[]'::jsonb) INTO v_staff
  FROM public.staff_members sm
  WHERE sm.business_id = v_business_id
    AND sm.is_archived = FALSE;

  -- Build final result
  v_result := jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business_id,
      'name', v_business_name,
      'email', v_business_email,
      'public_token', v_public_token,
      'booking_slug', v_booking_slug
    ),
    'booking_page_settings', v_booking_settings,
    'services', v_services,
    'stores', v_stores,
    'staff', v_staff,
    'requested_locale', p_locale
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO authenticated;

-- ============================================
-- STEP 6: Function to get available time slots
-- ============================================
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id UUID,
  p_store_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_service_duration INTEGER DEFAULT 60,
  p_date DATE DEFAULT CURRENT_DATE,
  p_days_ahead INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
  v_current_date DATE;
  v_day_slots JSONB;
  v_day_of_week INTEGER;
  v_open_time TIME;
  v_close_time TIME;
  v_is_closed BOOLEAN;
  v_slot_time TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_slots JSONB;
  v_booking_conflict BOOLEAN;
BEGIN
  -- Loop through dates
  FOR i IN 0..p_days_ahead LOOP
    v_current_date := p_date + i;
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INTEGER;

    -- Get business hours for this day
    SELECT
      COALESCE(bh.open_time, '09:00'::TIME),
      COALESCE(bh.close_time, '17:00'::TIME),
      COALESCE(bh.is_closed, FALSE)
    INTO v_open_time, v_close_time, v_is_closed
    FROM (SELECT 1) dummy
    LEFT JOIN public.business_hours bh ON
      bh.business_id = p_business_id
      AND (bh.store_id = p_store_id OR bh.store_id IS NULL)
      AND bh.day_of_week = v_day_of_week
    ORDER BY bh.store_id NULLS LAST
    LIMIT 1;

    -- Default hours if not set
    IF v_open_time IS NULL THEN
      v_open_time := '09:00'::TIME;
    END IF;
    IF v_close_time IS NULL THEN
      v_close_time := '17:00'::TIME;
    END IF;

    -- Skip if closed
    IF v_is_closed THEN
      CONTINUE;
    END IF;

    -- Generate slots for this day
    v_slots := '[]'::jsonb;
    v_slot_time := v_current_date + v_open_time;

    WHILE v_slot_time::TIME + (p_service_duration || ' minutes')::INTERVAL <= v_close_time LOOP
      v_slot_end := v_slot_time + (p_service_duration || ' minutes')::INTERVAL;

      -- Skip if slot is in the past
      IF v_slot_time > NOW() THEN
        -- Check for conflicts with existing bookings
        SELECT EXISTS (
          SELECT 1 FROM public.public_bookings pb
          WHERE pb.business_id = p_business_id
            AND pb.status NOT IN ('cancelled')
            AND (p_store_id IS NULL OR pb.store_id = p_store_id)
            AND (p_staff_id IS NULL OR pb.staff_id = p_staff_id)
            AND pb.start_at < v_slot_end
            AND pb.end_at > v_slot_time
        ) INTO v_booking_conflict;

        -- Also check internal appointments table
        IF NOT v_booking_conflict THEN
          SELECT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.business_id = p_business_id
              AND COALESCE(a.is_deleted, FALSE) = FALSE
              AND (p_store_id IS NULL OR a.store_id = p_store_id)
              AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
              AND a.start_at < v_slot_end
              AND a.end_at > v_slot_time
          ) INTO v_booking_conflict;
        END IF;

        IF NOT v_booking_conflict THEN
          v_slots := v_slots || jsonb_build_object(
            'start', v_slot_time,
            'end', v_slot_end
          );
        END IF;
      END IF;

      -- Move to next slot (30 min intervals)
      v_slot_time := v_slot_time + '30 minutes'::INTERVAL;
    END LOOP;

    -- Add day to result if it has slots
    IF jsonb_array_length(v_slots) > 0 THEN
      v_result := v_result || jsonb_build_object(
        'date', v_current_date,
        'day_of_week', v_day_of_week,
        'slots', v_slots
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO authenticated;

-- ============================================
-- STEP 7: Function to create a public booking
-- ============================================
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
  v_service_valid BOOLEAN;
  v_staff_valid BOOLEAN;
  v_business_name TEXT;
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

  -- Calculate end time
  v_end_at := p_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Validate service belongs to business (if provided)
  IF p_service_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = p_service_id
        AND s.business_id = p_business_id
        AND s.is_active = TRUE
    ) INTO v_service_valid;

    IF NOT v_service_valid THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid service');
    END IF;
  END IF;

  -- Validate staff belongs to business (if provided)
  IF p_staff_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.staff_members sm
      WHERE sm.id = p_staff_id
        AND sm.business_id = p_business_id
        AND sm.is_archived = FALSE
    ) INTO v_staff_valid;

    IF NOT v_staff_valid THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid staff member');
    END IF;
  END IF;

  -- Check for time slot conflicts
  SELECT EXISTS (
    SELECT 1 FROM public.public_bookings pb
    WHERE pb.business_id = p_business_id
      AND pb.status NOT IN ('cancelled')
      AND (p_store_id IS NULL OR pb.store_id = p_store_id)
      AND (p_staff_id IS NULL OR pb.staff_id = p_staff_id)
      AND pb.start_at < v_end_at
      AND pb.end_at > p_start_at
  ) INTO v_conflict_exists;

  -- Also check internal appointments
  IF NOT v_conflict_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.business_id = p_business_id
        AND COALESCE(a.is_deleted, FALSE) = FALSE
        AND (p_store_id IS NULL OR a.store_id = p_store_id)
        AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
        AND a.start_at < v_end_at
        AND a.end_at > p_start_at
    ) INTO v_conflict_exists;
  END IF;

  IF v_conflict_exists THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Time slot is no longer available');
  END IF;

  -- Get business name for confirmation
  SELECT name INTO v_business_name
  FROM public.businesses
  WHERE id = p_business_id;

  -- Create the booking
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
    LOWER(TRIM(p_customer_email)),
    p_customer_phone,
    p_customer_notes,
    p_start_at,
    v_end_at,
    p_duration_minutes,
    p_locale,
    'pending'
  )
  RETURNING id, confirmation_code INTO v_booking_id, v_confirmation_code;

  -- Return success with booking details
  RETURN jsonb_build_object(
    'success', TRUE,
    'booking', jsonb_build_object(
      'id', v_booking_id,
      'confirmation_code', v_confirmation_code,
      'business_name', v_business_name,
      'customer_name', TRIM(p_customer_name),
      'customer_email', LOWER(TRIM(p_customer_email)),
      'start_at', p_start_at,
      'end_at', v_end_at,
      'duration_minutes', p_duration_minutes,
      'status', 'pending'
    )
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO authenticated;

-- ============================================
-- STEP 8: Function to lookup booking by confirmation code
-- ============================================
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
    'id', pb.id,
    'confirmation_code', pb.confirmation_code,
    'business_name', b.name,
    'service_name', s.name,
    'staff_name', sm.full_name,
    'store_name', st.name,
    'customer_name', pb.customer_name,
    'customer_email', pb.customer_email,
    'start_at', pb.start_at,
    'end_at', pb.end_at,
    'duration_minutes', pb.duration_minutes,
    'status', pb.status,
    'created_at', pb.created_at
  ) INTO v_result
  FROM public.public_bookings pb
  JOIN public.businesses b ON b.id = pb.business_id
  LEFT JOIN public.services s ON s.id = pb.service_id
  LEFT JOIN public.staff_members sm ON sm.id = pb.staff_id
  LEFT JOIN public.stores st ON st.id = pb.store_id
  WHERE pb.confirmation_code = UPPER(p_confirmation_code);

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_booking_by_confirmation(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booking_by_confirmation(TEXT) TO authenticated;

-- ============================================
-- STEP 9: Grant table permissions
-- ============================================
GRANT SELECT ON public.business_hours TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;

GRANT SELECT ON public.public_bookings TO authenticated;
GRANT UPDATE, DELETE ON public.public_bookings TO authenticated;

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- Tables created:
--   - business_hours (store operating hours)
--   - public_bookings (customer booking records)
--
-- Functions created:
--   - get_public_booking_config(identifier, locale) - Get booking page config
--   - get_available_slots(business_id, store_id, staff_id, duration, date, days) - Get available times
--   - create_public_booking(...) - Create a new booking
--   - get_booking_by_confirmation(code) - Lookup booking
--
-- All functions are SECURITY DEFINER and accessible to anonymous users
-- ============================================
