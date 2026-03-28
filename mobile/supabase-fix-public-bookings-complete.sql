-- ============================================
-- COMPLETE FIX: Public Bookings Schema
-- Run this in your Supabase SQL Editor
-- ============================================
--
-- ISSUE: public_bookings is currently a VIEW, not a TABLE.
-- The view is built on appointments but doesn't support inserts properly.
--
-- SOLUTION: Drop the view and create a proper TABLE for public bookings.
-- This allows storing customer info, confirmation codes, etc.
-- ============================================

-- STEP 1: Drop the existing view (if it exists)
DROP VIEW IF EXISTS public.public_bookings CASCADE;

-- STEP 2: Create the public_bookings TABLE with full schema
CREATE TABLE IF NOT EXISTS public.public_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,

  -- Customer information (no auth required for public bookings)
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_notes TEXT,

  -- Appointment timing
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'booked', 'cancelled', 'completed', 'no_show')),

  -- Unique confirmation code for customer lookup
  confirmation_code TEXT UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),

  -- Locale used during booking (for emails, etc.)
  booked_locale TEXT DEFAULT 'en',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- STEP 3: Enable Row Level Security
ALTER TABLE public.public_bookings ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create RLS Policies

-- Business owners can view all their bookings
CREATE POLICY "Business owners can view their bookings"
  ON public.public_bookings
  FOR SELECT
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

-- Business owners can update their bookings
CREATE POLICY "Business owners can update their bookings"
  ON public.public_bookings
  FOR UPDATE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

-- Business owners can delete their bookings
CREATE POLICY "Business owners can delete their bookings"
  ON public.public_bookings
  FOR DELETE
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

-- Anonymous users can INSERT new bookings (public booking flow)
CREATE POLICY "Anonymous users can create public bookings"
  ON public.public_bookings
  FOR INSERT
  WITH CHECK (true);

-- Anonymous users can SELECT their own booking by confirmation code
CREATE POLICY "Anyone can lookup booking by confirmation code"
  ON public.public_bookings
  FOR SELECT
  USING (true);

-- STEP 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_public_bookings_business_id ON public.public_bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_store_id ON public.public_bookings(store_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_staff_id ON public.public_bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_service_id ON public.public_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_start_at ON public.public_bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_public_bookings_status ON public.public_bookings(status);
CREATE INDEX IF NOT EXISTS idx_public_bookings_confirmation_code ON public.public_bookings(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_public_bookings_customer_email ON public.public_bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_public_bookings_created_at ON public.public_bookings(created_at);

-- STEP 6: Grant permissions
GRANT SELECT ON public.public_bookings TO anon;
GRANT INSERT ON public.public_bookings TO anon;
GRANT SELECT ON public.public_bookings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.public_bookings TO authenticated;

-- STEP 7: Update or create the create_public_booking function
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
    'confirmed'
  )
  RETURNING id, confirmation_code INTO v_booking_id, v_confirmation_code;

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
      'customer_email', LOWER(TRIM(p_customer_email)),
      'start_at', p_start_at,
      'end_at', v_end_at,
      'duration_minutes', p_duration_minutes,
      'status', 'confirmed'
    )
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INTEGER, TEXT) TO authenticated;

-- STEP 8: Create/update get_booking_by_confirmation function
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
    'staff_name', COALESCE(st.full_name, st.name),
    'store_name', str.name,
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
  LEFT JOIN public.staff st ON st.id = pb.staff_id
  LEFT JOIN public.stores str ON str.id = pb.store_id
  WHERE pb.confirmation_code = UPPER(p_confirmation_code);

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_booking_by_confirmation(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booking_by_confirmation(TEXT) TO authenticated;

-- ============================================
-- VERIFICATION QUERY
-- Run this to confirm the migration worked:
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'public_bookings'
-- ORDER BY ordinal_position;

-- ============================================
-- EXPECTED RESULT (19 columns):
-- ============================================
-- id, business_id, store_id, staff_id, service_id,
-- customer_name, customer_email, customer_phone, customer_notes,
-- start_at, end_at, duration_minutes, status,
-- confirmation_code, booked_locale,
-- created_at, updated_at, confirmed_at, cancelled_at
-- ============================================
