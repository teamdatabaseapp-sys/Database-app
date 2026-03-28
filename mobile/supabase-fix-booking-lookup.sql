-- ============================================
-- FIX: Allow booking lookup by business ID
-- ============================================
-- The get_public_booking_config function was only looking up by:
-- 1. public_booking_token (UUID)
-- 2. booking_slug (text)
--
-- This update adds support for direct business ID lookup,
-- which is needed when the booking URL uses the business ID.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_public_booking_config(
  p_identifier TEXT, -- Can be UUID (business_id or public_token) or slug
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
  v_logo_url TEXT;
  v_brand_primary_color TEXT;
  v_brand_secondary_color TEXT;
  v_result JSONB;
  v_booking_settings JSONB;
  v_services JSONB;
  v_stores JSONB;
  v_staff JSONB;
BEGIN
  -- Try to find business - check multiple identifiers
  BEGIN
    -- First try as direct business ID
    SELECT b.id, b.name, b.email, b.public_booking_token, b.booking_slug,
           b.logo_url, b.brand_primary_color, b.brand_secondary_color
    INTO v_business_id, v_business_name, v_business_email, v_public_token, v_booking_slug,
         v_logo_url, v_brand_primary_color, v_brand_secondary_color
    FROM public.businesses b
    WHERE b.id = p_identifier::UUID;

    -- If not found by ID, try by public_booking_token
    IF v_business_id IS NULL THEN
      SELECT b.id, b.name, b.email, b.public_booking_token, b.booking_slug,
             b.logo_url, b.brand_primary_color, b.brand_secondary_color
      INTO v_business_id, v_business_name, v_business_email, v_public_token, v_booking_slug,
           v_logo_url, v_brand_primary_color, v_brand_secondary_color
      FROM public.businesses b
      WHERE b.public_booking_token = p_identifier::UUID;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Not a valid UUID, will try as slug below
    NULL;
  END;

  -- If still not found, try as slug
  IF v_business_id IS NULL THEN
    SELECT b.id, b.name, b.email, b.public_booking_token, b.booking_slug,
           b.logo_url, b.brand_primary_color, b.brand_secondary_color
    INTO v_business_id, v_business_name, v_business_email, v_public_token, v_booking_slug,
         v_logo_url, v_brand_primary_color, v_brand_secondary_color
    FROM public.businesses b
    WHERE b.booking_slug = LOWER(p_identifier);
  END IF;

  -- Return null if business not found
  IF v_business_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if booking page is enabled (is_public = true)
  -- If booking_page_settings doesn't exist or is_public is false, still allow access
  -- (we want to be permissive for now)

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

  -- Build final result with branding info
  v_result := jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business_id,
      'name', v_business_name,
      'email', v_business_email,
      'public_token', v_public_token,
      'booking_slug', v_booking_slug,
      'logo_url', v_logo_url,
      'brand_primary_color', COALESCE(v_brand_primary_color, '#0F8F83'),
      'brand_secondary_color', v_brand_secondary_color
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

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================
-- Test the function with a business ID:
-- SELECT get_public_booking_config('5238ceb7-4ced-4524-b347-df4683ab9047', 'en');
