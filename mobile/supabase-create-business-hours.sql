-- ============================================
-- CREATE BUSINESS HOURS TABLE
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- This enables business hours management for Online Booking
-- ============================================

-- Create business_hours table
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one entry per business/store/day
  UNIQUE(business_id, store_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_business_hours_business_id ON public.business_hours(business_id);
CREATE INDEX IF NOT EXISTS idx_business_hours_store_id ON public.business_hours(store_id);

-- RLS Policies for authenticated users
DROP POLICY IF EXISTS "Users can view own business hours" ON public.business_hours;
CREATE POLICY "Users can view own business hours" ON public.business_hours
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business hours" ON public.business_hours;
CREATE POLICY "Users can insert own business hours" ON public.business_hours
  FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business hours" ON public.business_hours;
CREATE POLICY "Users can update own business hours" ON public.business_hours
  FOR UPDATE TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business hours" ON public.business_hours;
CREATE POLICY "Users can delete own business hours" ON public.business_hours
  FOR DELETE TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- RLS Policies for anonymous users (public booking page)
DROP POLICY IF EXISTS "Public can view business hours for booking" ON public.business_hours;
CREATE POLICY "Public can view business hours for booking" ON public.business_hours
  FOR SELECT TO anon
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_hours TO authenticated;
GRANT SELECT ON public.business_hours TO anon;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify the table was created:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'business_hours';
