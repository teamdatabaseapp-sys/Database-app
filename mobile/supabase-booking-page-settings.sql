-- ============================================
-- BOOKING PAGE SETTINGS - Language Configuration
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Create booking_page_settings table
-- ============================================

CREATE TABLE IF NOT EXISTS public.booking_page_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled_locales TEXT[] NOT NULL DEFAULT ARRAY['en'],
  default_locale TEXT NOT NULL DEFAULT 'en',
  smart_language_detection BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints: enabled_locales must always contain 'en'
  CONSTRAINT enabled_locales_contains_english CHECK ('en' = ANY(enabled_locales)),
  -- Constraints: default_locale must be in enabled_locales
  CONSTRAINT default_locale_in_enabled CHECK (default_locale = ANY(enabled_locales))
);

-- ============================================
-- STEP 2: Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE public.booking_page_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create RLS Policies
-- ============================================

-- Policy: Business owners can read their own booking page settings
CREATE POLICY "Users can read own booking page settings"
  ON public.booking_page_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_page_settings.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Business owners can insert their own booking page settings
CREATE POLICY "Users can insert own booking page settings"
  ON public.booking_page_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_page_settings.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Business owners can update their own booking page settings
CREATE POLICY "Users can update own booking page settings"
  ON public.booking_page_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_page_settings.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_page_settings.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Business owners can delete their own booking page settings
CREATE POLICY "Users can delete own booking page settings"
  ON public.booking_page_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = booking_page_settings.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- ============================================
-- STEP 4: Grant permissions
-- ============================================

GRANT SELECT, UPDATE, INSERT, DELETE ON public.booking_page_settings TO authenticated;

-- ============================================
-- STEP 5: Create trigger for auto-updating updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_booking_page_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (for re-running)
DROP TRIGGER IF EXISTS booking_page_settings_updated_at_trigger ON public.booking_page_settings;

-- Create the trigger
CREATE TRIGGER booking_page_settings_updated_at_trigger
  BEFORE UPDATE ON public.booking_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_booking_page_settings_updated_at();

-- ============================================
-- STEP 6: Create public function for fetching booking config
-- This function can be called by anonymous users via public tokens
-- ============================================

-- First, add public_booking_token to businesses table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'public_booking_token'
  ) THEN
    ALTER TABLE public.businesses
    ADD COLUMN public_booking_token UUID DEFAULT gen_random_uuid() UNIQUE;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_public_booking_token
  ON public.businesses(public_booking_token);

-- Create the public function
CREATE OR REPLACE FUNCTION public.get_public_booking_config(
  p_public_token UUID,
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
  v_result JSONB;
  v_booking_settings JSONB;
  v_services JSONB;
BEGIN
  -- Find business by public token
  SELECT id, name INTO v_business_id, v_business_name
  FROM public.businesses
  WHERE public_booking_token = p_public_token;

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
      'color', s.color,
      'is_active', s.is_active
    ) ORDER BY s.name
  ), '[]'::jsonb) INTO v_services
  FROM public.services s
  WHERE s.business_id = v_business_id
    AND s.is_active = TRUE;

  -- Build final result
  v_result := jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business_id,
      'name', v_business_name
    ),
    'booking_link', p_public_token,
    'booking_page_settings', v_booking_settings,
    'services', v_services,
    'requested_locale', p_locale
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_booking_config(UUID, TEXT) TO authenticated;

-- ============================================
-- SETUP COMPLETE - SUMMARY
-- ============================================
--
-- Table created:
--   booking_page_settings
--     - business_id (PK, FK to businesses)
--     - enabled_locales TEXT[] (always contains 'en')
--     - default_locale TEXT (must be in enabled_locales)
--     - smart_language_detection BOOLEAN
--     - updated_at TIMESTAMPTZ
--
-- Function created:
--   get_public_booking_config(p_public_token UUID, p_locale TEXT)
--     - Returns business info, booking settings, and services
--     - Safe for anonymous access
--     - Returns defaults if settings don't exist
--
-- Column added to businesses:
--   public_booking_token UUID (unique, auto-generated)
--
-- ============================================
