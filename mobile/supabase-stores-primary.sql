-- ============================================
-- MIGRATION: Add is_primary column to stores table
-- Purpose: Mark primary store that cannot be deleted
-- ============================================

-- 1. Add is_primary column to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- 2. Set the first store (by created_at) for each business as primary
-- This handles existing data
WITH first_stores AS (
  SELECT DISTINCT ON (business_id) id
  FROM public.stores
  WHERE is_archived = FALSE OR is_archived IS NULL
  ORDER BY business_id, created_at ASC
)
UPDATE public.stores
SET is_primary = TRUE
WHERE id IN (SELECT id FROM first_stores)
AND (is_primary IS NULL OR is_primary = FALSE);

-- 3. Create or replace function to prevent primary store deletion
CREATE OR REPLACE FUNCTION prevent_primary_store_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if trying to delete or archive a primary store
  IF OLD.is_primary = TRUE THEN
    -- For DELETE operation
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Primary store cannot be deleted';
    END IF;
    -- For UPDATE (archive) operation
    IF TG_OP = 'UPDATE' AND NEW.is_archived = TRUE AND (OLD.is_archived = FALSE OR OLD.is_archived IS NULL) THEN
      RAISE EXCEPTION 'Primary store cannot be archived';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_primary_store_deletion_trigger ON public.stores;

-- 5. Create trigger to prevent primary store deletion/archiving
CREATE TRIGGER prevent_primary_store_deletion_trigger
BEFORE DELETE OR UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION prevent_primary_store_deletion();

-- 6. Create or replace function to ensure exactly one primary store per business
-- This runs on INSERT to set first store as primary if none exists
CREATE OR REPLACE FUNCTION ensure_primary_store()
RETURNS TRIGGER AS $$
DECLARE
  existing_primary_count INTEGER;
BEGIN
  -- Count existing primary stores for this business
  SELECT COUNT(*) INTO existing_primary_count
  FROM public.stores
  WHERE business_id = NEW.business_id
  AND is_primary = TRUE
  AND id != NEW.id;

  -- If no primary store exists and this is not marked as primary, make it primary
  IF existing_primary_count = 0 AND (NEW.is_primary IS NULL OR NEW.is_primary = FALSE) THEN
    NEW.is_primary := TRUE;
  END IF;

  -- If trying to set as primary when one already exists, allow it but we don't change the existing one
  -- (Optional: could add logic to unset existing primary here)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS ensure_primary_store_trigger ON public.stores;

-- 8. Create trigger to ensure primary store on insert
CREATE TRIGGER ensure_primary_store_trigger
BEFORE INSERT ON public.stores
FOR EACH ROW
EXECUTE FUNCTION ensure_primary_store();

-- 9. Create index for faster primary store lookups
CREATE INDEX IF NOT EXISTS idx_stores_is_primary ON public.stores(business_id, is_primary) WHERE is_primary = TRUE;

-- 10. Add comment to document the column
COMMENT ON COLUMN public.stores.is_primary IS 'Indicates if this is the primary store for the business. Primary stores cannot be deleted.';
