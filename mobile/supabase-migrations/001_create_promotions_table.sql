-- ============================================
-- PROMOTIONS TABLE MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create the promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_service', 'other')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  free_service_after INTEGER, -- For loyalty programs (e.g., 5 services = 1 free)
  other_discount_description TEXT, -- Custom description for 'other' type
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  color TEXT NOT NULL DEFAULT '#6366F1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create index for faster lookups by business
CREATE INDEX IF NOT EXISTS idx_promotions_business_id ON public.promotions(business_id);

-- 3. Create index for active promotions lookup
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(business_id, is_active) WHERE is_active = true;

-- 4. Enable Row Level Security
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for business isolation
-- Users can only see promotions for businesses they own
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

-- 6. Add updated_at trigger
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

-- 7. Add FK constraint from appointments.promo_id to promotions.id
-- First check if the constraint already exists
DO $$
BEGIN
  -- Drop existing constraint if it exists (might be pointing to wrong table)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_promo_id_fkey'
    AND table_name = 'appointments'
  ) THEN
    ALTER TABLE public.appointments DROP CONSTRAINT appointments_promo_id_fkey;
  END IF;

  -- Add the correct foreign key constraint
  ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_promo_id_fkey
  FOREIGN KEY (promo_id) REFERENCES public.promotions(id) ON DELETE SET NULL;

  RAISE NOTICE 'Successfully added FK constraint: appointments.promo_id -> promotions.id';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not add FK constraint (may already exist or column missing): %', SQLERRM;
END $$;

-- 8. Create index on appointments.promo_id for faster joins
CREATE INDEX IF NOT EXISTS idx_appointments_promo_id ON public.appointments(promo_id) WHERE promo_id IS NOT NULL;

-- 9. Create composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_appointments_business_promo ON public.appointments(business_id, promo_id) WHERE promo_id IS NOT NULL;

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify the migration worked
-- ============================================

-- Check if promotions table exists
-- SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'promotions');

-- Check promotions table structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'promotions' ORDER BY ordinal_position;

-- Check FK constraint
-- SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'appointments' AND tc.constraint_type = 'FOREIGN KEY';
