-- ============================================================
-- PROMOTION REDEMPTIONS - SINGLE SOURCE OF TRUTH
-- ============================================================
-- This migration creates a dedicated table to track promotion usage.
-- Analytics and Client Details will read from this table.
--
-- The appointments.promo_id column remains for backward compatibility,
-- but the redemptions table is the authoritative source for analytics.
-- ============================================================

-- ============================================================
-- STEP 1: CREATE THE PROMOTION_REDEMPTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,

  -- Source tracking: where did this redemption come from?
  source TEXT NOT NULL DEFAULT 'visit' CHECK (source IN ('visit', 'appointment', 'manual', 'checkout')),
  source_id UUID, -- The appointment/visit ID that triggered this redemption

  -- Redemption details
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discount_amount NUMERIC(10, 2), -- The actual discount applied (if calculable)
  original_amount NUMERIC(10, 2), -- The original amount before discount
  final_amount NUMERIC(10, 2), -- The final amount after discount
  currency TEXT DEFAULT 'USD',

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure idempotency: one redemption per source_id (e.g., one per appointment)
  CONSTRAINT unique_redemption_per_source UNIQUE (source, source_id)
);

-- Add comment for documentation
COMMENT ON TABLE public.promotion_redemptions IS 'Single source of truth for promotion usage tracking. Used by Analytics and Client Details.';
COMMENT ON COLUMN public.promotion_redemptions.source IS 'Where the redemption originated: visit, appointment, manual, or checkout';
COMMENT ON COLUMN public.promotion_redemptions.source_id IS 'The ID of the source record (e.g., appointment_id for visit/appointment sources)';

-- ============================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Index for business-scoped queries (most common)
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_business_redeemed
ON public.promotion_redemptions(business_id, redeemed_at DESC);

-- Index for client-specific queries (Client Details view)
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_client
ON public.promotion_redemptions(business_id, client_id, redeemed_at DESC);

-- Index for promotion-specific analytics
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_promotion
ON public.promotion_redemptions(business_id, promotion_id, redeemed_at DESC);

-- Index for store-filtered analytics
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_store
ON public.promotion_redemptions(business_id, store_id, redeemed_at DESC);

-- Index for source lookups (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_source
ON public.promotion_redemptions(source, source_id);

-- ============================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their business redemptions" ON public.promotion_redemptions;
DROP POLICY IF EXISTS "Users can insert their business redemptions" ON public.promotion_redemptions;
DROP POLICY IF EXISTS "Users can update their business redemptions" ON public.promotion_redemptions;
DROP POLICY IF EXISTS "Users can delete their business redemptions" ON public.promotion_redemptions;

-- Create RLS policies (business-scoped, same pattern as other tables)
CREATE POLICY "Users can view their business redemptions"
  ON public.promotion_redemptions FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert their business redemptions"
  ON public.promotion_redemptions FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update their business redemptions"
  ON public.promotion_redemptions FOR UPDATE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete their business redemptions"
  ON public.promotion_redemptions FOR DELETE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ============================================================
-- STEP 4: CREATE UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_promotion_redemptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_promotion_redemptions_updated_at ON public.promotion_redemptions;
CREATE TRIGGER trigger_promotion_redemptions_updated_at
  BEFORE UPDATE ON public.promotion_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_redemptions_updated_at();

-- ============================================================
-- STEP 5: CREATE TRIGGER TO AUTO-CREATE REDEMPTION ON APPOINTMENT INSERT/UPDATE
-- ============================================================
-- When appointments.promo_id is set, automatically create a redemption record

CREATE OR REPLACE FUNCTION auto_create_promotion_redemption()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if promo_id is set and not null
  IF NEW.promo_id IS NOT NULL THEN
    -- Upsert: insert if not exists, update if exists (idempotent)
    INSERT INTO public.promotion_redemptions (
      business_id,
      store_id,
      client_id,
      promotion_id,
      source,
      source_id,
      redeemed_at,
      discount_amount,
      original_amount,
      final_amount,
      currency
    ) VALUES (
      NEW.business_id,
      NEW.store_id,
      NEW.client_id,
      NEW.promo_id,
      'visit',
      NEW.id,
      COALESCE(NEW.start_at, NOW()),
      NULL, -- discount_amount not always calculable
      NULL, -- original_amount not always known
      NEW.amount,
      NEW.currency
    )
    ON CONFLICT (source, source_id)
    DO UPDATE SET
      promotion_id = EXCLUDED.promotion_id,
      store_id = EXCLUDED.store_id,
      final_amount = EXCLUDED.final_amount,
      currency = EXCLUDED.currency,
      updated_at = NOW();
  END IF;

  -- If promo_id was removed (changed from non-null to null), optionally delete the redemption
  IF TG_OP = 'UPDATE' AND OLD.promo_id IS NOT NULL AND NEW.promo_id IS NULL THEN
    DELETE FROM public.promotion_redemptions
    WHERE source = 'visit' AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_create_promotion_redemption ON public.appointments;
CREATE TRIGGER trigger_auto_create_promotion_redemption
  AFTER INSERT OR UPDATE OF promo_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_promotion_redemption();

-- ============================================================
-- STEP 6: BACKFILL EXISTING APPOINTMENTS WITH PROMO_ID
-- ============================================================
-- Create redemption records for any existing appointments that have promo_id set

INSERT INTO public.promotion_redemptions (
  business_id,
  store_id,
  client_id,
  promotion_id,
  source,
  source_id,
  redeemed_at,
  final_amount,
  currency
)
SELECT
  a.business_id,
  a.store_id,
  a.client_id,
  a.promo_id,
  'visit',
  a.id,
  COALESCE(a.start_at, a.created_at),
  a.amount,
  a.currency
FROM public.appointments a
WHERE a.promo_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.promotion_redemptions pr
    WHERE pr.source = 'visit' AND pr.source_id = a.id
  );

-- ============================================================
-- STEP 7: CREATE RPC FOR ANALYTICS - PROMOTIONS REDEEMED COUNT
-- ============================================================
-- Returns count of promotions redeemed for a business within a date range

CREATE OR REPLACE FUNCTION get_promotions_redeemed_count(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_store_id UUID DEFAULT NULL,
  p_promotion_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM promotion_redemptions pr
  WHERE pr.business_id = p_business_id
    AND pr.redeemed_at >= p_start_date
    AND pr.redeemed_at < p_end_date
    AND (p_store_id IS NULL OR pr.store_id = p_store_id)
    AND (p_promotion_id IS NULL OR pr.promotion_id = p_promotion_id);

  RETURN v_count;
END;
$$;

-- ============================================================
-- STEP 8: CREATE RPC FOR ANALYTICS - PROMOTIONS BREAKDOWN BY PROMOTION
-- ============================================================
-- Returns breakdown of redemptions by promotion for a business within a date range

CREATE OR REPLACE FUNCTION get_promotions_breakdown(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE (
  promotion_id UUID,
  promotion_name TEXT,
  redemption_count BIGINT,
  total_discount_amount NUMERIC,
  total_final_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.promotion_id,
    p.name AS promotion_name,
    COUNT(*) AS redemption_count,
    SUM(pr.discount_amount) AS total_discount_amount,
    SUM(pr.final_amount) AS total_final_amount
  FROM promotion_redemptions pr
  JOIN promotions p ON p.id = pr.promotion_id
  WHERE pr.business_id = p_business_id
    AND pr.redeemed_at >= p_start_date
    AND pr.redeemed_at < p_end_date
    AND (p_store_id IS NULL OR pr.store_id = p_store_id)
  GROUP BY pr.promotion_id, p.name
  ORDER BY redemption_count DESC;
END;
$$;

-- ============================================================
-- STEP 9: CREATE RPC FOR CLIENT DETAILS - PROMOTIONS USED BY CLIENT
-- ============================================================
-- Returns list of promotions used by a specific client

CREATE OR REPLACE FUNCTION get_client_promotions_used(
  p_business_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  promotion_id UUID,
  promotion_name TEXT,
  promotion_color TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  redeemed_at TIMESTAMPTZ,
  store_id UUID,
  store_name TEXT,
  final_amount NUMERIC,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.promotion_id,
    p.name AS promotion_name,
    p.color AS promotion_color,
    p.discount_type,
    p.discount_value,
    pr.redeemed_at,
    pr.store_id,
    s.name AS store_name,
    pr.final_amount,
    pr.currency
  FROM promotion_redemptions pr
  JOIN promotions p ON p.id = pr.promotion_id
  LEFT JOIN stores s ON s.id = pr.store_id
  WHERE pr.business_id = p_business_id
    AND pr.client_id = p_client_id
  ORDER BY pr.redeemed_at DESC;
END;
$$;

-- ============================================================
-- STEP 10: CREATE RPC FOR ANALYTICS TIME SERIES
-- ============================================================
-- Returns daily/weekly/monthly redemption counts for charting

CREATE OR REPLACE FUNCTION get_promotions_time_series(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_interval TEXT DEFAULT 'day', -- 'day', 'week', 'month'
  p_store_id UUID DEFAULT NULL
)
RETURNS TABLE (
  period_start TIMESTAMPTZ,
  redemption_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC(p_interval, pr.redeemed_at) AS period_start,
    COUNT(*) AS redemption_count
  FROM promotion_redemptions pr
  WHERE pr.business_id = p_business_id
    AND pr.redeemed_at >= p_start_date
    AND pr.redeemed_at < p_end_date
    AND (p_store_id IS NULL OR pr.store_id = p_store_id)
  GROUP BY DATE_TRUNC(p_interval, pr.redeemed_at)
  ORDER BY period_start;
END;
$$;

-- ============================================================
-- STEP 11: GRANT EXECUTE PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION get_promotions_redeemed_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_promotions_breakdown TO authenticated;
GRANT EXECUTE ON FUNCTION get_client_promotions_used TO authenticated;
GRANT EXECUTE ON FUNCTION get_promotions_time_series TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:

-- Check table was created
-- SELECT * FROM information_schema.tables WHERE table_name = 'promotion_redemptions';

-- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'promotion_redemptions';

-- Check trigger exists
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_auto_create_promotion_redemption';

-- Check RLS policies
-- SELECT policyname FROM pg_policies WHERE tablename = 'promotion_redemptions';

-- Check backfill worked
-- SELECT COUNT(*) FROM promotion_redemptions;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
