-- ============================================
-- REQUIRED DATABASE MIGRATIONS
-- ============================================
-- Run this SQL in your Supabase SQL Editor:
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor → New Query

-- ============================================
-- 1. Add description column to services table
-- ============================================
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================
-- 2. Add photo columns to stores table
-- ============================================
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS photo_thumb_url TEXT;

-- ============================================
-- Verify columns were added
-- ============================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'services' AND column_name = 'description';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stores' AND column_name IN ('photo_url', 'photo_thumb_url');
