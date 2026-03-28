-- ============================================
-- FIX: Add missing columns to booking_page_settings table
-- Run this in your Supabase SQL Editor if you see:
-- "Could not find the 'default_locale' column of 'booking_page_settings'"
-- ============================================

-- Add default_locale column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'booking_page_settings'
    AND column_name = 'default_locale'
  ) THEN
    ALTER TABLE public.booking_page_settings
    ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'en';
    RAISE NOTICE 'Added default_locale column';
  ELSE
    RAISE NOTICE 'default_locale column already exists';
  END IF;
END $$;

-- Add enabled_locales column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'booking_page_settings'
    AND column_name = 'enabled_locales'
  ) THEN
    ALTER TABLE public.booking_page_settings
    ADD COLUMN enabled_locales TEXT[] NOT NULL DEFAULT ARRAY['en'];
    RAISE NOTICE 'Added enabled_locales column';
  ELSE
    RAISE NOTICE 'enabled_locales column already exists';
  END IF;
END $$;

-- Add smart_language_detection column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'booking_page_settings'
    AND column_name = 'smart_language_detection'
  ) THEN
    ALTER TABLE public.booking_page_settings
    ADD COLUMN smart_language_detection BOOLEAN NOT NULL DEFAULT TRUE;
    RAISE NOTICE 'Added smart_language_detection column';
  ELSE
    RAISE NOTICE 'smart_language_detection column already exists';
  END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'booking_page_settings'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.booking_page_settings
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column';
  ELSE
    RAISE NOTICE 'updated_at column already exists';
  END IF;
END $$;

-- Add constraints if they don't exist (these won't error if they already exist)
DO $$
BEGIN
  -- Try to add the enabled_locales_contains_english constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
    AND table_name = 'booking_page_settings'
    AND constraint_name = 'enabled_locales_contains_english'
  ) THEN
    BEGIN
      ALTER TABLE public.booking_page_settings
      ADD CONSTRAINT enabled_locales_contains_english CHECK ('en' = ANY(enabled_locales));
      RAISE NOTICE 'Added enabled_locales_contains_english constraint';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'enabled_locales_contains_english constraint already exists';
    END;
  END IF;
END $$;

DO $$
BEGIN
  -- Try to add the default_locale_in_enabled constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
    AND table_name = 'booking_page_settings'
    AND constraint_name = 'default_locale_in_enabled'
  ) THEN
    BEGIN
      ALTER TABLE public.booking_page_settings
      ADD CONSTRAINT default_locale_in_enabled CHECK (default_locale = ANY(enabled_locales));
      RAISE NOTICE 'Added default_locale_in_enabled constraint';
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'default_locale_in_enabled constraint already exists';
    END;
  END IF;
END $$;

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_booking_page_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS booking_page_settings_updated_at_trigger ON public.booking_page_settings;
CREATE TRIGGER booking_page_settings_updated_at_trigger
  BEFORE UPDATE ON public.booking_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_booking_page_settings_updated_at();

-- Ensure RLS is enabled
ALTER TABLE public.booking_page_settings ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can read own booking page settings" ON public.booking_page_settings;
DROP POLICY IF EXISTS "Users can insert own booking page settings" ON public.booking_page_settings;
DROP POLICY IF EXISTS "Users can update own booking page settings" ON public.booking_page_settings;
DROP POLICY IF EXISTS "Users can delete own booking page settings" ON public.booking_page_settings;

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

-- Grant permissions
GRANT SELECT, UPDATE, INSERT, DELETE ON public.booking_page_settings TO authenticated;

-- ============================================
-- DONE - Schema should now be complete
-- ============================================
SELECT 'booking_page_settings schema fix complete!' AS status;
