-- ============================================================
-- Store Hours Overrides (Special Hours / Exceptions)
-- Date-specific overrides for store business hours
-- ============================================================

-- Create the store_hours_overrides table
CREATE TABLE IF NOT EXISTS public.store_hours_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  open_time TIME NULL,
  close_time TIME NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT end_date_after_start CHECK (end_date >= start_date),
  CONSTRAINT closed_times_null CHECK (
    (is_closed = true AND open_time IS NULL AND close_time IS NULL) OR
    (is_closed = false AND open_time IS NOT NULL AND close_time IS NOT NULL)
  )
);

-- Create index for efficient queries by store and date range
CREATE INDEX IF NOT EXISTS idx_store_hours_overrides_store_dates
  ON public.store_hours_overrides(store_id, start_date, end_date);

-- Create index for business_id lookups
CREATE INDEX IF NOT EXISTS idx_store_hours_overrides_business
  ON public.store_hours_overrides(business_id);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE public.store_hours_overrides ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "store_hours_overrides_select_owner" ON public.store_hours_overrides;
DROP POLICY IF EXISTS "store_hours_overrides_insert_owner" ON public.store_hours_overrides;
DROP POLICY IF EXISTS "store_hours_overrides_update_owner" ON public.store_hours_overrides;
DROP POLICY IF EXISTS "store_hours_overrides_delete_owner" ON public.store_hours_overrides;

-- SELECT: Business owner can read their overrides
CREATE POLICY "store_hours_overrides_select_owner" ON public.store_hours_overrides
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- INSERT: Business owner can create overrides
CREATE POLICY "store_hours_overrides_insert_owner" ON public.store_hours_overrides
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- UPDATE: Business owner can update their overrides
CREATE POLICY "store_hours_overrides_update_owner" ON public.store_hours_overrides
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- DELETE: Business owner can delete their overrides
CREATE POLICY "store_hours_overrides_delete_owner" ON public.store_hours_overrides
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- Public read access for booking page
-- ============================================================

-- Allow public/anon to read store hours overrides for booking pages
-- (needed when customers view booking availability)
DROP POLICY IF EXISTS "store_hours_overrides_select_public" ON public.store_hours_overrides;

CREATE POLICY "store_hours_overrides_select_public" ON public.store_hours_overrides
  FOR SELECT
  USING (true);
