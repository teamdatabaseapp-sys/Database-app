-- ============================================
-- FIX SERVICES AND STAFF MEMBERS - Required Migrations
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: CREATE SERVICES TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#0D9488',
  duration_minutes INTEGER DEFAULT 60,
  price_cents INTEGER DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  service_type TEXT DEFAULT 'service', -- 'service' (appointment-based) or 'product' (no time required)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add currency_code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'services'
    AND column_name = 'currency_code'
  ) THEN
    ALTER TABLE public.services ADD COLUMN currency_code TEXT DEFAULT 'USD';
  END IF;
END $$;

-- Add service_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'services'
    AND column_name = 'service_type'
  ) THEN
    ALTER TABLE public.services ADD COLUMN service_type TEXT DEFAULT 'service';
  END IF;
END $$;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_services_business_id ON public.services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services(is_active);

-- ============================================
-- PART 2: ENABLE RLS ON SERVICES
-- ============================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 3: ADD RLS POLICIES FOR SERVICES (Business Owners)
-- ============================================

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view own business services" ON public.services;
DROP POLICY IF EXISTS "Users can insert own business services" ON public.services;
DROP POLICY IF EXISTS "Users can update own business services" ON public.services;
DROP POLICY IF EXISTS "Users can delete own business services" ON public.services;
DROP POLICY IF EXISTS "Public can view services for booking" ON public.services;

-- Policy: Users can read their own business services
CREATE POLICY "Users can view own business services"
ON public.services FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- Policy: Users can insert services for their own business
CREATE POLICY "Users can insert own business services"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- Policy: Users can update their own business services
CREATE POLICY "Users can update own business services"
ON public.services FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- Policy: Users can delete their own business services
CREATE POLICY "Users can delete own business services"
ON public.services FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT id FROM public.businesses WHERE owner_id = auth.uid()
  )
);

-- Policy: Public can read services for booking page (anon users)
CREATE POLICY "Public can view services for booking"
ON public.services FOR SELECT
TO anon
USING (true);

-- ============================================
-- PART 4: ADD service_ids COLUMN TO STAFF_MEMBERS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staff_members'
    AND column_name = 'service_ids'
  ) THEN
    ALTER TABLE public.staff_members ADD COLUMN service_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- PART 5: GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT ON public.services TO anon;

-- ============================================
-- PART 6: CREATE staff TABLE FOR PUBLIC BOOKING (if needed)
-- The booking page uses 'staff' table, not 'staff_members'
-- This creates a view if the table doesn't exist
-- ============================================

-- First check if 'staff' table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'staff'
  ) THEN
    -- Create staff table mirroring staff_members
    CREATE TABLE public.staff (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT,
      photo_url TEXT,
      color TEXT DEFAULT '#0D9488',
      is_active BOOLEAN DEFAULT true,
      store_ids UUID[] DEFAULT '{}',
      service_ids UUID[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

    -- Create index
    CREATE INDEX IF NOT EXISTS idx_staff_business_id ON public.staff(business_id);

    -- RLS Policies
    CREATE POLICY "Users can view own business staff" ON public.staff
      FOR SELECT TO authenticated
      USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

    CREATE POLICY "Users can insert own business staff" ON public.staff
      FOR INSERT TO authenticated
      WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

    CREATE POLICY "Users can update own business staff" ON public.staff
      FOR UPDATE TO authenticated
      USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

    CREATE POLICY "Users can delete own business staff" ON public.staff
      FOR DELETE TO authenticated
      USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

    CREATE POLICY "Public can view staff for booking" ON public.staff
      FOR SELECT TO anon
      USING (true);

    -- Grant permissions
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
    GRANT SELECT ON public.staff TO anon;
  END IF;
END $$;

-- ============================================
-- PART 7: CREATE staff_services JUNCTION TABLE (for staff-service skills mapping)
-- ============================================
CREATE TABLE IF NOT EXISTS public.staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, service_id)
);

-- Enable RLS
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_services
DROP POLICY IF EXISTS "Users can view own business staff_services" ON public.staff_services;
DROP POLICY IF EXISTS "Users can insert own business staff_services" ON public.staff_services;
DROP POLICY IF EXISTS "Users can delete own business staff_services" ON public.staff_services;
DROP POLICY IF EXISTS "Public can view staff_services for booking" ON public.staff_services;

CREATE POLICY "Users can view own business staff_services" ON public.staff_services
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert own business staff_services" ON public.staff_services
  FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own business staff_services" ON public.staff_services
  FOR DELETE TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Public can view staff_services for booking" ON public.staff_services
  FOR SELECT TO anon
  USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_services_business_id ON public.staff_services(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_staff_id ON public.staff_services(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service_id ON public.staff_services(service_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.staff_services TO authenticated;
GRANT SELECT ON public.staff_services TO anon;

-- ============================================
-- VERIFICATION: Check tables were created properly
-- ============================================
SELECT 'VERIFICATION' as step;
SELECT table_name,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.table_name) as policy_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('services', 'staff_members', 'staff', 'staff_services')
ORDER BY table_name;

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- This ensures new columns are immediately available
-- ============================================
NOTIFY pgrst, 'reload schema';
