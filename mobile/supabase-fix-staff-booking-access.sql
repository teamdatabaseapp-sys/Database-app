-- ============================================
-- FIX STAFF ACCESS FOR BOOKING PAGE
-- ============================================
-- This migration ensures the booking page can access staff members
-- Run this in your Supabase SQL Editor
-- ============================================

-- Step 1: Drop existing anon policies on staff table (if any)
DROP POLICY IF EXISTS "Public can view staff for booking" ON public.staff;
DROP POLICY IF EXISTS "Anon can view staff" ON public.staff;

-- Step 2: Create new anon SELECT policy for staff table
CREATE POLICY "Public can view staff for booking" ON public.staff
  FOR SELECT TO anon
  USING (true);

-- Step 3: Grant SELECT permission to anon role
GRANT SELECT ON public.staff TO anon;

-- Step 4: Same for store_staff junction table (for store filtering)
DROP POLICY IF EXISTS "Public can view store_staff" ON public.store_staff;
DROP POLICY IF EXISTS "Anon can view store_staff" ON public.store_staff;

CREATE POLICY "Public can view store_staff for booking" ON public.store_staff
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.store_staff TO anon;

-- Step 5: Ensure staff_members also has anon access (fallback table)
DROP POLICY IF EXISTS "Public can view staff for booking" ON public.staff_members;
DROP POLICY IF EXISTS "Anon can view staff_members" ON public.staff_members;

CREATE POLICY "Public can view staff_members for booking" ON public.staff_members
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.staff_members TO anon;

-- Step 6: Ensure staff_store_assignments has anon access (fallback junction)
DROP POLICY IF EXISTS "Public can view staff_store_assignments" ON public.staff_store_assignments;

CREATE POLICY "Public can view staff_store_assignments for booking" ON public.staff_store_assignments
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.staff_store_assignments TO anon;

-- Step 7: Add avatar columns to staff table if missing
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_thumb_url TEXT;

-- Step 8: Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this migration, test with:
-- SELECT * FROM public.staff LIMIT 5;
-- This should return staff data even when using anon key.
