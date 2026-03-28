-- ============================================================
-- ADD SORT ORDER TO STORES TABLE
-- ============================================================
-- This migration adds a sort_order column to allow users to
-- reorder their stores. The order is reflected everywhere stores
-- are displayed (Settings, Staff Calendar tabs, etc.)
-- ============================================================

-- Add sort_order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'stores'
    AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.stores ADD COLUMN sort_order INTEGER DEFAULT 0;
    RAISE NOTICE 'Added sort_order column to stores table';
  ELSE
    RAISE NOTICE 'sort_order column already exists';
  END IF;
END $$;

-- Backfill sort_order for existing stores based on created_at
-- Each business gets its stores ordered sequentially
WITH ranked_stores AS (
  SELECT 
    id,
    business_id,
    ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY created_at ASC) as rank
  FROM public.stores
  WHERE sort_order IS NULL OR sort_order = 0
)
UPDATE public.stores s
SET sort_order = rs.rank
FROM ranked_stores rs
WHERE s.id = rs.id;

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_stores_business_sort_order 
ON public.stores(business_id, sort_order);

-- Add a comment for documentation
COMMENT ON COLUMN public.stores.sort_order IS 'User-defined display order within the business. Lower numbers appear first.';

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT id, business_id, name, sort_order, created_at 
-- FROM public.stores 
-- ORDER BY business_id, sort_order;
