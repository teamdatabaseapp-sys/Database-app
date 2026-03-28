-- ============================================
-- CREATE STORE_STAFF JUNCTION TABLE
-- Run this SQL in your Supabase SQL Editor
-- This table links staff members to stores
-- ============================================

-- Create the store_staff junction table
CREATE TABLE IF NOT EXISTS public.store_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, store_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_store_staff_business_id ON public.store_staff(business_id);
CREATE INDEX IF NOT EXISTS idx_store_staff_staff_id ON public.store_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_store_staff_store_id ON public.store_staff(store_id);

-- Enable RLS
ALTER TABLE public.store_staff ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own business store_staff" ON public.store_staff;
DROP POLICY IF EXISTS "Users can insert own business store_staff" ON public.store_staff;
DROP POLICY IF EXISTS "Users can update own business store_staff" ON public.store_staff;
DROP POLICY IF EXISTS "Users can delete own business store_staff" ON public.store_staff;
DROP POLICY IF EXISTS "Public can view store_staff for booking" ON public.store_staff;

-- RLS Policies
CREATE POLICY "Users can view own business store_staff" ON public.store_staff
  FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business store_staff" ON public.store_staff
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business store_staff" ON public.store_staff
  FOR UPDATE TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business store_staff" ON public.store_staff
  FOR DELETE TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Allow anonymous users to read for public booking page
CREATE POLICY "Public can view store_staff for booking" ON public.store_staff
  FOR SELECT TO anon
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_staff TO authenticated;
GRANT SELECT ON public.store_staff TO anon;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Verify table was created
SELECT 'store_staff table created successfully' as status,
       column_name,
       data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'store_staff'
ORDER BY ordinal_position;
