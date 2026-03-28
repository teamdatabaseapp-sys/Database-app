-- ============================================
-- FIX: Booking Staff Filtering with store_ids and service_ids
-- Run this SQL in your Supabase SQL Editor
-- ============================================
-- This update ensures:
-- 1. Staff store_ids come from store_staff junction table
-- 2. Staff service_ids come from staff_services junction table
-- 3. Store hours are included for each store
-- 4. Store hours overrides are included for special dates
-- ============================================

-- Drop existing function first to avoid conflicts
DROP FUNCTION IF EXISTS public.get_public_booking_config(TEXT, TEXT);

-- Recreate function with proper junction table lookups
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
  v_store_hours_overrides jsonb;
BEGIN
  -- Look up business by multiple identifiers
  SELECT
    b.id,
    b.name,
    b.email,
    b.phone,
    b.address,
    b.public_booking_token,
    b.booking_slug,
    b.logo_url,
    b.brand_primary_color,
    b.brand_secondary_color
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

  -- Get active services (excluding products)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'description', s.description,
      'color', s.color,
      'duration_minutes', COALESCE(s.duration_minutes, 60),
      'price_cents', COALESCE(s.price_cents, 0),
      'is_active', s.is_active
    )
    ORDER BY s.name
  ), '[]'::jsonb)
  INTO v_services
  FROM public.services s
  WHERE s.business_id = v_business.id
    AND s.is_active = TRUE
    AND COALESCE(s.service_type, 'service') != 'product';

  -- Get non-archived stores with their weekly hours
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'name', st.name,
      'address', st.address,
      'phone', st.phone,
      'blackout_dates', COALESCE(st.blackout_dates, ARRAY[]::TEXT[]),
      'hours', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'day_of_week', bh.day_of_week,
            'open_time', bh.open_time::TEXT,
            'close_time', bh.close_time::TEXT,
            'is_closed', COALESCE(bh.is_closed, FALSE)
          )
          ORDER BY bh.day_of_week
        )
        FROM public.business_hours bh
        WHERE bh.business_id = v_business.id
          AND (bh.store_id = st.id OR bh.store_id IS NULL)
      ), '[]'::jsonb)
    )
    ORDER BY st.created_at
  ), '[]'::jsonb)
  INTO v_stores
  FROM public.stores st
  WHERE st.business_id = v_business.id
    AND st.is_archived = FALSE;

  -- Get store hours overrides (special hours for specific dates)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sho.id,
      'store_id', sho.store_id,
      'start_date', sho.start_date::TEXT,
      'end_date', sho.end_date::TEXT,
      'is_closed', sho.is_closed,
      'open_time', sho.open_time::TEXT,
      'close_time', sho.close_time::TEXT,
      'note', sho.note
    )
  ), '[]'::jsonb)
  INTO v_store_hours_overrides
  FROM public.store_hours_overrides sho
  WHERE sho.business_id = v_business.id
    AND sho.end_date >= CURRENT_DATE;

  -- Get active staff WITH store_ids from store_staff junction and service_ids from staff_services junction
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'color', s.color,
      'avatar_url', s.avatar_url,
      'avatar_thumb_url', s.avatar_thumb_url,
      -- Get store_ids from store_staff junction table
      'store_ids', COALESCE((
        SELECT array_agg(ss.store_id)
        FROM public.store_staff ss
        WHERE ss.staff_id = s.id
      ), ARRAY[]::UUID[]),
      -- Get service_ids from staff_services junction table
      'service_ids', COALESCE((
        SELECT array_agg(svc.service_id)
        FROM public.staff_services svc
        WHERE svc.staff_id = s.id
      ), ARRAY[]::UUID[])
    )
    ORDER BY s.name
  ), '[]'::jsonb)
  INTO v_staff
  FROM public.staff s
  WHERE s.business_id = v_business.id
    AND s.is_active = TRUE;

  -- Return complete config
  RETURN jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'email', v_business.email,
      'phone', v_business.phone,
      'address', v_business.address,
      'public_token', v_business.public_booking_token,
      'booking_slug', v_business.booking_slug,
      'logo_url', v_business.logo_url,
      'brand_primary_color', v_business.brand_primary_color,
      'brand_secondary_color', v_business.brand_secondary_color
    ),
    'booking_page_settings', jsonb_build_object(
      'enabled_locales', v_booking_settings.enabled_locales,
      'default_locale', v_booking_settings.default_locale,
      'smart_language_detection', v_booking_settings.smart_language_detection
    ),
    'services', v_services,
    'stores', v_stores,
    'store_hours_overrides', v_store_hours_overrides,
    'staff', v_staff,
    'requested_locale', p_locale
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(TEXT, TEXT) TO authenticated;

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'get_public_booking_config updated with proper staff filtering (store_ids from store_staff, service_ids from staff_services)' as status;
