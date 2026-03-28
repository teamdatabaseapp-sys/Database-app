-- ============================================
-- CREATE STAFF_MEMBERS TABLE
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: CREATE STAFF_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  photo_url TEXT,
  color TEXT DEFAULT '#0D9488',
  is_archived BOOLEAN DEFAULT false,
  store_ids UUID[] DEFAULT '{}',
  service_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PART 2: ENABLE RLS
-- ============================================
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 3: DROP EXISTING POLICIES (if any)
-- ============================================
DROP POLICY IF EXISTS "Users can view own business staff" ON public.staff_members;
DROP POLICY IF EXISTS "Users can insert own business staff" ON public.staff_members;
DROP POLICY IF EXISTS "Users can update own business staff" ON public.staff_members;
DROP POLICY IF EXISTS "Users can delete own business staff" ON public.staff_members;
DROP POLICY IF EXISTS "Public can view staff for booking" ON public.staff_members;

-- ============================================
-- PART 4: CREATE RLS POLICIES
-- ============================================

-- Policy: Users can read their own business staff
CREATE POLICY "Users can view own business staff" ON public.staff_members
  FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can insert staff for their own business
CREATE POLICY "Users can insert own business staff" ON public.staff_members
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can update their own business staff
CREATE POLICY "Users can update own business staff" ON public.staff_members
  FOR UPDATE TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can delete their own business staff
CREATE POLICY "Users can delete own business staff" ON public.staff_members
  FOR DELETE TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Policy: Public can read staff for booking page (anon users)
CREATE POLICY "Public can view staff for booking" ON public.staff_members
  FOR SELECT TO anon
  USING (true);

-- ============================================
-- PART 5: CREATE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_staff_members_business_id ON public.staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_is_archived ON public.staff_members(is_archived);

-- ============================================
-- PART 6: GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT SELECT ON public.staff_members TO anon;

-- ============================================
-- PART 7: ADD MISSING COLUMNS (if table already exists)
-- ============================================
DO $$
BEGIN
  -- Add photo_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staff_members'
    AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE public.staff_members ADD COLUMN photo_url TEXT;
  END IF;

  -- Add service_ids column if it doesn't exist
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
-- VERIFY TABLE WAS CREATED
-- ============================================
SELECT 'staff_members table created successfully' as status,
       column_name,
       data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'staff_members'
ORDER BY ordinal_position;

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';
