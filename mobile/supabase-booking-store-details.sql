-- ============================================
-- UPDATE get_public_booking_config TO INCLUDE STORE DETAILS
-- Run this SQL in your Supabase SQL Editor
-- ============================================
-- This adds address, phone, hours, and blackout_dates to stores
-- for the Online Booking page to display location-specific info

-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_public_booking_config(TEXT, TEXT);

-- Recreate function with full store details
CREATE OR REPLACE FUNCTION public.get_public_booking_config(
  p_identifier TEXT,  -- Can be public_token UUID, business ID, or booking_slug
  p_locale TEXT DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business RECORD;
  v_booking_settings RECORD;
  v_services jsonb;
  v_stores jsonb;
  v_staff jsonb;
  v_store_count integer;
BEGIN
  -- Look up business by multiple identifiers
  SELECT
    b.id,
    b.name,
    b.email,
    b.public_booking_token,
    b.booking_slug,
    b.logo_url,
    b.brand_primary_color,
    b.brand_secondary_color,
    b.address,
    b.phone
  INTO v_business
  FROM public.businesses b
  WHERE
    -- Match by UUID (either as public_token or business_id)
    b.public_booking_token::TEXT = p_identifier
    OR b.id::TEXT = p_identifier
    -- Match by slug (case-insensitive)
    OR LOWER(b.booking_slug) = LOWER(p_identifier)
  LIMIT 1;

  IF v_business.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Business not found');
  END IF;

  -- Get booking page settings
  SELECT
    bps.enabled_locales,
    bps.default_locale,
    bps.smart_language_detection
  INTO v_booking_settings
  FROM public.booking_page_settings bps
  WHERE bps.business_id = v_business.id;

  -- Default settings if not configured
  IF v_booking_settings IS NULL THEN
    v_booking_settings := ROW(ARRAY['en']::TEXT[], 'en', TRUE);
  END IF;

  -- Get active services
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'description', s.description,
      'color', s.color,
      'duration_minutes', s.duration_minutes,
      'price_cents', s.price_cents,
      'is_active', s.is_active
    )
    ORDER BY s.name
  ), '[]'::jsonb)
  INTO v_services
  FROM public.services s
  WHERE s.business_id = v_business.id
    AND s.is_active = TRUE;

  -- Get non-archived stores WITH full details (address, phone, hours, blackout_dates)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'name', st.name,
      'address', st.address,
      'phone', st.phone,
      'hours', COALESCE(st.hours, '[]'::jsonb),
      'blackout_dates', COALESCE(st.blackout_dates, '[]'::jsonb)
    )
    ORDER BY st.created_at
  ), '[]'::jsonb)
  INTO v_stores
  FROM public.stores st
  WHERE st.business_id = v_business.id
    AND (st.is_archived = FALSE OR st.is_archived IS NULL);

  -- Log store count for debugging
  SELECT COUNT(*) INTO v_store_count
  FROM public.stores st
  WHERE st.business_id = v_business.id
    AND (st.is_archived = FALSE OR st.is_archived IS NULL);

  RAISE LOG '[BookingPage] stores count = %, business_id = %', v_store_count, v_business.id;

  -- Get active staff WITH avatar URLs
  -- Try staff_members table first (standard RSV table name)
  BEGIN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', sm.id,
        'name', sm.full_name,
        'color', sm.color,
        'avatar_url', sm.avatar_url,
        'avatar_thumb_url', sm.avatar_thumb_url,
        'store_ids', COALESCE(sm.store_ids, ARRAY[]::UUID[]),
        'service_ids', COALESCE(sm.service_ids, ARRAY[]::UUID[])
      )
      ORDER BY sm.full_name
    ), '[]'::jsonb)
    INTO v_staff
    FROM public.staff_members sm
    WHERE sm.business_id = v_business.id
      AND (sm.is_archived = FALSE OR sm.is_archived IS NULL);
  EXCEPTION WHEN undefined_table THEN
    -- Fall back to 'staff' table if staff_members doesn't exist
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'color', s.color,
        'avatar_url', s.avatar_url,
        'avatar_thumb_url', s.avatar_thumb_url,
        'store_ids', COALESCE(s.store_ids, ARRAY[]::UUID[]),
        'service_ids', COALESCE(s.service_ids, ARRAY[]::UUID[])
      )
      ORDER BY s.name
    ), '[]'::jsonb)
    INTO v_staff
    FROM public.staff s
    WHERE s.business_id = v_business.id
      AND s.is_active = TRUE;
  END;

  -- Return complete config
  RETURN jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'email', v_business.email,
      'public_token', v_business.public_booking_token,
      'booking_slug', v_business.booking_slug,
      'logo_url', v_business.logo_url,
      'brand_primary_color', v_business.brand_primary_color,
      'brand_secondary_color', v_business.brand_secondary_color,
      'address', v_business.address,
      'phone', v_business.phone
    ),
    'booking_page_settings', jsonb_build_object(
      'enabled_locales', v_booking_settings.enabled_locales,
      'default_locale', v_booking_settings.default_locale,
      'smart_language_detection', v_booking_settings.smart_language_detection
    ),
    'services', v_services,
    'stores', v_stores,
    'staff', v_staff,
    'requested_locale', p_locale
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO authenticated;

-- ============================================
-- VERIFY FUNCTION UPDATED
-- ============================================
SELECT 'get_public_booking_config function updated with store details (address, phone, hours, blackout_dates)' as status;

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';
