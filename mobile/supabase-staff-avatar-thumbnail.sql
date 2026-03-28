-- ============================================
-- ADD STAFF AVATAR THUMBNAIL COLUMN
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Add avatar_thumb_url and avatar_url columns to 'staff' table
-- This stores the thumbnail (128px) and full image (1024px) URLs
DO $$
BEGIN
  -- Add avatar_thumb_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staff'
    AND column_name = 'avatar_thumb_url'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN avatar_thumb_url TEXT;
    RAISE NOTICE 'Added avatar_thumb_url column to staff';
  ELSE
    RAISE NOTICE 'avatar_thumb_url column already exists on staff';
  END IF;

  -- Add avatar_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staff'
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN avatar_url TEXT;
    -- Copy data from photo_url to avatar_url if photo_url has data
    UPDATE public.staff SET avatar_url = photo_url WHERE photo_url IS NOT NULL;
    RAISE NOTICE 'Added avatar_url column and migrated data from photo_url';
  ELSE
    RAISE NOTICE 'avatar_url column already exists on staff';
  END IF;
END $$;

-- ============================================
-- CREATE STORAGE BUCKET FOR STAFF PHOTOS
-- ============================================
-- Note: Storage bucket creation requires Supabase dashboard or service role
-- The bucket will be created programmatically via the backend API

-- ============================================
-- VERIFY COLUMNS
-- ============================================
SELECT 'staff avatar columns' as status,
       column_name,
       data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'staff'
AND column_name IN ('photo_url', 'avatar_url', 'avatar_thumb_url')
ORDER BY column_name;

-- ============================================
-- NOTIFY POSTGREST TO RELOAD SCHEMA
-- ============================================
NOTIFY pgrst, 'reload schema';
