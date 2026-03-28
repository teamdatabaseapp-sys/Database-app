-- ============================================
-- BUSINESS LOGOS STORAGE BUCKET SETUP
-- ============================================
-- Run this SQL in your Supabase SQL Editor to enable logo uploads.
-- This script is idempotent - safe to run multiple times.

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- Step 2: Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Business owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload logos" ON storage.objects;

-- Step 3: Create permissive policies for the business-logos bucket
-- These policies allow uploads via the backend API

-- Allow INSERT for anon and authenticated users
CREATE POLICY "Anyone can upload logos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'business-logos');

-- Allow UPDATE for anon and authenticated users (for upsert)
CREATE POLICY "Anyone can update logos"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'business-logos')
WITH CHECK (bucket_id = 'business-logos');

-- Allow public SELECT (read) access
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'business-logos');

-- Step 4: Verify the bucket was created
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'business-logos';
