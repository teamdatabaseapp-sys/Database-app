-- ============================================
-- FIX: Update get_public_booking_config to use correct staff table
-- and include service_ids for staff filtering
-- ============================================
-- This updates the function to:
-- 1. Query the 'staff' table instead of 'staff_members'
-- 2. Include service_ids for each staff member (from staff_services junction table)
-- 3. Include avatar URLs for staff photos
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
  v_business_phone TEXT;
  v_business_address TEXT;
  v_business_country TEXT;
  v_brand_primary_color TEXT;
  v_logo_url TEXT;
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
    SELECT b.id, b.name, b.email, b.phone, b.address, b.country,
           b.brand_primary_color, b.logo_url,
           b.public_booking_token, b.booking_slug
    INTO v_business_id, v_business_name, v_business_email, v_business_phone,
         v_business_address, v_business_country, v_brand_primary_color, v_logo_url,
         v_public_token, v_booking_slug
    FROM public.businesses b
    WHERE b.public_booking_token = p_identifier::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Not a valid UUID, try as slug
    SELECT b.id, b.name, b.email, b.phone, b.address, b.country,
           b.brand_primary_color, b.logo_url,
           b.public_booking_token, b.booking_slug
    INTO v_business_id, v_business_name, v_business_email, v_business_phone,
         v_business_address, v_business_country, v_brand_primary_color, v_logo_url,
         v_public_token, v_booking_slug
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

  -- Get active services for the business (excluding products)
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
    AND s.is_active = TRUE
    AND COALESCE(s.service_type, 'service') != 'product';

  -- Get active stores for the business with address and phone
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'name', st.name,
      'address', st.address,
      'phone', st.phone
    ) ORDER BY st.name
  ), '[]'::jsonb) INTO v_stores
  FROM public.stores st
  WHERE st.business_id = v_business_id
    AND st.is_archived = FALSE;

  -- Get active staff for the business with service_ids from junction table
  -- Uses 'staff' table (not staff_members)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'color', s.color,
      'avatar_url', s.avatar_url,
      'avatar_thumb_url', s.avatar_thumb_url,
      'store_ids', COALESCE((
        SELECT array_agg(ss.store_id)
        FROM public.store_staff ss
        WHERE ss.staff_id = s.id
      ), ARRAY[]::UUID[]),
      'service_ids', COALESCE((
        SELECT array_agg(svc.service_id)
        FROM public.staff_services svc
        WHERE svc.staff_id = s.id
      ), ARRAY[]::UUID[])
    ) ORDER BY s.name
  ), '[]'::jsonb) INTO v_staff
  FROM public.staff s
  WHERE s.business_id = v_business_id
    AND s.is_active = TRUE;

  -- Build final result
  v_result := jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business_id,
      'name', v_business_name,
      'email', v_business_email,
      'phone', v_business_phone,
      'address', v_business_address,
      'country', v_business_country,
      'brand_primary_color', v_brand_primary_color,
      'logo_url', v_logo_url,
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
-- Also update create_public_booking to validate staff can perform service
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
  v_staff_can_perform_service BOOLEAN;
  v_business_name TEXT;
  v_service_name TEXT;
  v_staff_name TEXT;
  v_store_address TEXT;
  v_booking_url TEXT;
  v_timezone TEXT;
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
    SELECT s.name INTO v_service_name
    FROM public.services s
    WHERE s.id = p_service_id
      AND s.business_id = p_business_id
      AND s.is_active = TRUE;

    IF v_service_name IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid service');
    END IF;
  END IF;

  -- Validate staff belongs to business (if provided)
  IF p_staff_id IS NOT NULL THEN
    SELECT s.name INTO v_staff_name
    FROM public.staff s
    WHERE s.id = p_staff_id
      AND s.business_id = p_business_id
      AND s.is_active = TRUE;

    IF v_staff_name IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid staff member');
    END IF;

    -- Validate staff can perform the service (if both staff and service selected)
    IF p_service_id IS NOT NULL THEN
      -- Check if staff has NO service restrictions (empty service_ids means can do all)
      -- OR if staff has this service in their service_ids
      SELECT (
        NOT EXISTS (SELECT 1 FROM public.staff_services ss WHERE ss.staff_id = p_staff_id)
        OR EXISTS (SELECT 1 FROM public.staff_services ss WHERE ss.staff_id = p_staff_id AND ss.service_id = p_service_id)
      ) INTO v_staff_can_perform_service;

      IF NOT v_staff_can_perform_service THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Staff member cannot perform this service');
      END IF;
    END IF;
  END IF;

  -- Check for time slot conflicts (DOUBLE BOOKING PREVENTION)
  -- For PUBLIC BOOKINGS
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

  -- Get business name and other info for confirmation
  SELECT name INTO v_business_name
  FROM public.businesses
  WHERE id = p_business_id;

  -- Get store address if store selected
  IF p_store_id IS NOT NULL THEN
    SELECT address INTO v_store_address
    FROM public.stores
    WHERE id = p_store_id;
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
      'service_name', v_service_name,
      'staff_name', v_staff_name,
      'store_address', v_store_address,
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
-- VERIFICATION
-- ============================================
-- After running this migration, test with:
-- SELECT get_public_booking_config('your-business-uuid-or-slug', 'en');
-- Check that staff includes service_ids array
