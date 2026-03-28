-- ============================================
-- Add timezone column to stores table
-- ============================================
-- This migration adds a timezone column to stores for proper booking time display.
-- Default: America/New_York (US Eastern) for existing stores.
-- Future stores can set their own timezone.

-- Add timezone column with default UTC
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- Update existing stores to use America/New_York if they are currently UTC
-- (Most US-based businesses use Eastern time as default)
UPDATE public.stores
SET timezone = 'America/New_York'
WHERE timezone = 'UTC';

-- Create index for faster timezone lookups
CREATE INDEX IF NOT EXISTS idx_stores_timezone ON public.stores(timezone);

-- Verify the change
-- SELECT id, name, timezone FROM public.stores LIMIT 5;

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- 1. Copy this entire SQL to your Supabase SQL Editor
-- 2. Click "Run" to execute the migration
-- 3. Verify stores have timezone set:
--    SELECT name, timezone FROM stores;
-- 4. Update individual store timezones as needed:
--    UPDATE stores SET timezone = 'America/Los_Angeles' WHERE id = 'store-uuid';
--
-- Common US timezones:
--   - America/New_York (Eastern)
--   - America/Chicago (Central)
--   - America/Denver (Mountain)
--   - America/Los_Angeles (Pacific)
-- ============================================
