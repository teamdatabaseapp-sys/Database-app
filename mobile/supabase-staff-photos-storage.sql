-- ============================================
-- CREATE STAFF-PHOTOS STORAGE BUCKET
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Note: Storage bucket creation requires the Storage Admin or service role.
-- This script should be run after the storage bucket is created via the Supabase Dashboard
-- or via the Supabase client with service role key.

-- ============================================
-- STEP 1: Storage bucket should be created via Dashboard or API
-- ============================================
-- Bucket name: staff-photos
-- Public: Yes
-- File size limit: 10MB (10485760 bytes)
-- Allowed MIME types: image/jpeg, image/png, image/heic

-- If using Supabase Dashboard:
-- 1. Go to Storage
-- 2. Create a new bucket named "staff-photos"
-- 3. Set it to Public
-- 4. Configure file size limit and MIME types as needed

-- ============================================
-- STEP 2: RLS Policies for Storage (run after bucket creation)
-- ============================================

-- Allow authenticated users to upload to their business folder
-- Note: These policies are created via the Supabase Dashboard
-- or using the storage API

-- Policy: Allow authenticated users to upload
-- Bucket: staff-photos
-- Policy name: "Business owners can upload staff photos"
-- Operation: INSERT
-- Target roles: authenticated
-- Policy definition:
--   (bucket_id = 'staff-photos' AND
--    (storage.foldername(name))[1] IN (
--      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
--    ))

-- Policy: Allow authenticated users to update their files
-- Bucket: staff-photos
-- Policy name: "Business owners can update staff photos"
-- Operation: UPDATE
-- Target roles: authenticated
-- Policy definition:
--   (bucket_id = 'staff-photos' AND
--    (storage.foldername(name))[1] IN (
--      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
--    ))

-- Policy: Allow authenticated users to delete their files
-- Bucket: staff-photos
-- Policy name: "Business owners can delete staff photos"
-- Operation: DELETE
-- Target roles: authenticated
-- Policy definition:
--   (bucket_id = 'staff-photos' AND
--    (storage.foldername(name))[1] IN (
--      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
--    ))

-- Policy: Allow public read access (since bucket is public)
-- Bucket: staff-photos
-- Policy name: "Public can view staff photos"
-- Operation: SELECT
-- Target roles: public (anon)
-- Policy definition:
--   (bucket_id = 'staff-photos')

-- ============================================
-- VERIFICATION NOTES
-- ============================================
-- After running this migration:
-- 1. Verify the bucket exists in Supabase Storage
-- 2. Verify RLS policies are applied
-- 3. Test upload from the mobile app
-- 4. Verify public URL access works

SELECT 'Staff photos storage bucket instructions complete' as status;
SELECT 'Please create the bucket via Supabase Dashboard if not already done' as note;
