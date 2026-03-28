-- ============================================
-- COMPLETE PROMOTIONS SETUP
-- ============================================
-- This script ensures:
-- 1. The promotions table exists
-- 2. The appointments.promo_id column exists
-- 3. The FK constraint is set up
-- 4. RLS policies are configured
--
-- Safe to run multiple times (idempotent)
-- ============================================

-- Step 1: Create the promotions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_service', 'other')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  free_service_after INTEGER,
  other_discount_description TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color TEXT NOT NULL DEFAULT '#6366F1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Add promo_id column to appointments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'appointments'
    AND column_name = 'promo_id'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN promo_id UUID;
    RAISE NOTICE 'Added promo_id column to appointments table';
  ELSE
    RAISE NOTICE 'promo_id column already exists in appointments table';
  END IF;
END $$;

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_promotions_business_id ON public.promotions(business_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(business_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_appointments_promo_id ON public.appointments(promo_id) WHERE promo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_business_promo ON public.appointments(business_id, promo_id) WHERE promo_id IS NOT NULL;

-- Step 4: Enable Row Level Security on promotions
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop and recreate RLS policies (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view their own promotions" ON public.promotions;
DROP POLICY IF EXISTS "Users can insert their own promotions" ON public.promotions;
DROP POLICY IF EXISTS "Users can update their own promotions" ON public.promotions;
DROP POLICY IF EXISTS "Users can delete their own promotions" ON public.promotions;

CREATE POLICY "Users can view their own promotions"
  ON public.promotions FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert their own promotions"
  ON public.promotions FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update their own promotions"
  ON public.promotions FOR UPDATE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete their own promotions"
  ON public.promotions FOR DELETE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Step 6: Add FK constraint from appointments.promo_id to promotions.id
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_promo_id_fkey'
    AND table_name = 'appointments'
  ) THEN
    ALTER TABLE public.appointments DROP CONSTRAINT appointments_promo_id_fkey;
    RAISE NOTICE 'Dropped existing FK constraint';
  END IF;

  -- Add the foreign key constraint
  ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_promo_id_fkey
  FOREIGN KEY (promo_id) REFERENCES public.promotions(id) ON DELETE SET NULL;

  RAISE NOTICE 'Added FK constraint: appointments.promo_id -> promotions.id';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not add FK constraint: %', SQLERRM;
END $$;

-- Step 7: Create updated_at trigger for promotions
CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_promotions_updated_at ON public.promotions;
CREATE TRIGGER trigger_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotions_updated_at();

-- Step 8: Verify setup
SELECT 'Promotions table exists' AS status,
       COUNT(*) AS columns_count
FROM information_schema.columns
WHERE table_name = 'promotions' AND table_schema = 'public';

SELECT 'appointments.promo_id exists' AS status,
       data_type
FROM information_schema.columns
WHERE table_name = 'appointments'
AND column_name = 'promo_id'
AND table_schema = 'public';
