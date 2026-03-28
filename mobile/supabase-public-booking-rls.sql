-- ============================================
-- PUBLIC BOOKING PAGE RLS POLICIES
-- ============================================
-- Run this SQL in your Supabase SQL Editor to allow
-- public access to business data for booking pages.
-- This is required for the booking page to work without authentication.

-- Step 1: Allow public SELECT on businesses for booking pages
-- This policy allows anyone to read basic business info needed for booking
DROP POLICY IF EXISTS "Public can view businesses for booking" ON public.businesses;
CREATE POLICY "Public can view businesses for booking"
ON public.businesses FOR SELECT
TO anon, authenticated
USING (true);

-- Step 2: Allow public SELECT on services for booking pages
DROP POLICY IF EXISTS "Public can view services for booking" ON public.services;
CREATE POLICY "Public can view services for booking"
ON public.services FOR SELECT
TO anon, authenticated
USING (true);

-- Step 3: Allow public SELECT on stores for booking pages
DROP POLICY IF EXISTS "Public can view stores for booking" ON public.stores;
CREATE POLICY "Public can view stores for booking"
ON public.stores FOR SELECT
TO anon, authenticated
USING (true);

-- Step 4: Allow public SELECT on booking_page_settings
DROP POLICY IF EXISTS "Public can view booking settings" ON public.booking_page_settings;
CREATE POLICY "Public can view booking settings"
ON public.booking_page_settings FOR SELECT
TO anon, authenticated
USING (true);

-- Step 5: Allow public SELECT on business_hours for availability
DROP POLICY IF EXISTS "Public can view business hours" ON public.business_hours;
CREATE POLICY "Public can view business hours"
ON public.business_hours FOR SELECT
TO anon, authenticated
USING (true);

-- Step 6: Allow public SELECT on staff_members for booking pages
DROP POLICY IF EXISTS "Public can view staff for booking" ON public.staff_members;
CREATE POLICY "Public can view staff for booking"
ON public.staff_members FOR SELECT
TO anon, authenticated
USING (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('businesses', 'services', 'stores', 'booking_page_settings', 'business_hours', 'staff_members')
ORDER BY tablename, policyname;
