-- ============================================
-- ADD BUSINESS_COUNTRY COLUMN TO BUSINESSES
-- ============================================
-- Run this SQL in your Supabase SQL Editor to add the
-- business_country column for currency and regional settings.

-- Step 1: Add business_country column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'business_country'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN business_country TEXT DEFAULT 'US';
    RAISE NOTICE 'Added business_country column to businesses table';
  ELSE
    RAISE NOTICE 'business_country column already exists';
  END IF;
END $$;

-- Step 2: Add business_state column if it doesn't exist (for US state selection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'business_state'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN business_state TEXT;
    RAISE NOTICE 'Added business_state column to businesses table';
  ELSE
    RAISE NOTICE 'business_state column already exists';
  END IF;
END $$;

-- Step 3: Add business_address column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'business_address'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN business_address TEXT;
    RAISE NOTICE 'Added business_address column to businesses table';
  ELSE
    RAISE NOTICE 'business_address column already exists';
  END IF;
END $$;

-- Step 4: Add business_phone_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'business_phone_number'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN business_phone_number TEXT;
    RAISE NOTICE 'Added business_phone_number column to businesses table';
  ELSE
    RAISE NOTICE 'business_phone_number column already exists';
  END IF;
END $$;

-- Step 5: Add email_footer_language column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'businesses'
    AND column_name = 'email_footer_language'
  ) THEN
    ALTER TABLE public.businesses ADD COLUMN email_footer_language TEXT DEFAULT 'en';
    RAISE NOTICE 'Added email_footer_language column to businesses table';
  ELSE
    RAISE NOTICE 'email_footer_language column already exists';
  END IF;
END $$;

-- Step 6: Backfill existing rows - set business_country to 'US' where NULL
UPDATE public.businesses
SET business_country = 'US'
WHERE business_country IS NULL;

-- Step 7: Create index for country lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_businesses_country ON public.businesses(business_country);

-- Step 8: Notify PostgREST to reload schema cache
-- This ensures the new columns are immediately available via the API
NOTIFY pgrst, 'reload schema';

-- Verify columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'businesses'
  AND column_name IN ('business_country', 'business_state', 'business_address', 'business_phone_number', 'email_footer_language')
ORDER BY column_name;
