-- ============================================
-- ANALYTICS RPC - SINGLE ENTRY POINT
-- ============================================
-- FIX FOR: "unrecognized configuration parameter app.current_business_id"
--
-- This migration creates a SINGLE unified RPC function that returns
-- ALL analytics data needed by the MonthlyStatsScreen.
--
-- RUN THIS SQL IN YOUR SUPABASE SQL EDITOR
-- ============================================

-- ============================================
-- STEP 1: FIX THE RLS POLICY
-- ============================================
-- Drop problematic policies that use app.current_business_id

DROP POLICY IF EXISTS "appointments_business_select" ON public.appointments;
DROP POLICY IF EXISTS "appointments_business_insert" ON public.appointments;
DROP POLICY IF EXISTS "appointments_business_update" ON public.appointments;
DROP POLICY IF EXISTS "appointments_business_delete" ON public.appointments;
DROP POLICY IF EXISTS "appointments_policy" ON public.appointments;
DROP POLICY IF EXISTS "Users can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can access own business appointments" ON public.appointments;

-- Create proper RLS policy
CREATE POLICY "Users can access own business appointments"
  ON public.appointments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointments.business_id
      AND (
        businesses.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.staff
          WHERE staff.business_id = appointments.business_id
          AND staff.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointments.business_id
      AND (
        businesses.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.staff
          WHERE staff.business_id = appointments.business_id
          AND staff.user_id = auth.uid()
        )
      )
    )
  );

-- Fix appointment_services RLS
DROP POLICY IF EXISTS "Users can access own business appointment_services" ON public.appointment_services;
CREATE POLICY "Users can access own business appointment_services"
  ON public.appointment_services
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.businesses b ON b.id = a.business_id
      WHERE a.id = appointment_services.appointment_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.business_id = a.business_id
          AND s.user_id = auth.uid()
        )
      )
    )
  );

-- ============================================
-- STEP 2: CREATE UNIFIED ANALYTICS RPC
-- ============================================
-- Single entry point for ALL analytics data.
-- Returns structured data with all KPIs.

CREATE OR REPLACE FUNCTION public.get_monthly_analytics_overview(
  p_business_id UUID,
  p_start_at    TIMESTAMPTZ,
  p_end_at      TIMESTAMPTZ,
  p_store_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_total_appointments INTEGER := 0;
  v_total_revenue_cents BIGINT := 0;
  v_new_clients INTEGER := 0;
  v_promotions_redeemed INTEGER := 0;
  v_top_service_id UUID;
  v_top_service_name TEXT;
  v_top_service_count INTEGER := 0;
  v_top_service_revenue_cents BIGINT := 0;
  v_best_revenue_month INTEGER;
  v_best_revenue_month_cents BIGINT := 0;
  v_busiest_day INTEGER; -- 0=Sunday, 6=Saturday
  v_busiest_day_count INTEGER := 0;
  v_busiest_hour INTEGER; -- 0-23
  v_busiest_hour_count INTEGER := 0;
  v_top_clients JSONB;
BEGIN
  -- Validate business_id is provided
  IF p_business_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'business_id is required');
  END IF;

  -- Validate business exists and user has access
  SELECT owner_id INTO v_owner_id
  FROM public.businesses
  WHERE id = p_business_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Business not found');
  END IF;

  IF v_owner_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff
      WHERE business_id = p_business_id AND user_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Access denied');
    END IF;
  END IF;

  -- ==========================================
  -- KPI 1: Total Appointments + Revenue
  -- Revenue = sum of appointment.amount (source of truth, matches what was charged)
  -- ==========================================
  SELECT
    COUNT(*),
    COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT  -- store as cents (amount is in dollars)
  INTO v_total_appointments, v_total_revenue_cents
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id);

  -- ==========================================
  -- KPI 2: New Clients (created in period)
  -- ==========================================
  SELECT COUNT(*)
  INTO v_new_clients
  FROM public.clients c
  WHERE c.business_id = p_business_id
    AND c.created_at >= p_start_at
    AND c.created_at <  p_end_at;

  -- ==========================================
  -- KPI 3: Promotions Redeemed
  -- Count DISTINCT appointments where a promo was applied — either at the
  -- appointment level (appointments.promo_id) OR at the service line level
  -- (appointment_services.promo_id). Never double-count the same appointment.
  -- ==========================================
  SELECT COUNT(DISTINCT a.id)
  INTO v_promotions_redeemed
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND (
      a.promo_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.appointment_services aps
        WHERE aps.appointment_id = a.id
          AND aps.promo_id IS NOT NULL
      )
    );

  -- ==========================================
  -- KPI 4: Top Service
  -- ==========================================
  SELECT
    aps.service_id,
    s.name,
    COUNT(*) as cnt,
    COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT
  INTO v_top_service_id, v_top_service_name, v_top_service_count, v_top_service_revenue_cents
  FROM public.appointment_services aps
  JOIN public.appointments a ON a.id = aps.appointment_id
  LEFT JOIN public.services s ON s.id = aps.service_id
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
  GROUP BY aps.service_id, s.name
  ORDER BY cnt DESC
  LIMIT 1;

  -- ==========================================
  -- KPI 5: Best Month (highest revenue in year)
  -- ==========================================
  SELECT
    EXTRACT(MONTH FROM a.start_at)::INTEGER,
    COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT
  INTO v_best_revenue_month, v_best_revenue_month_cents
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND EXTRACT(YEAR FROM a.start_at) = EXTRACT(YEAR FROM p_start_at)
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
  GROUP BY EXTRACT(MONTH FROM a.start_at)
  ORDER BY 2 DESC
  LIMIT 1;

  -- ==========================================
  -- KPI 6: Busiest Day of Week
  -- ==========================================
  SELECT
    EXTRACT(DOW FROM a.start_at)::INTEGER,
    COUNT(*)
  INTO v_busiest_day, v_busiest_day_count
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
  GROUP BY EXTRACT(DOW FROM a.start_at)
  ORDER BY 2 DESC
  LIMIT 1;

  -- ==========================================
  -- KPI 7: Busiest Hour
  -- ==========================================
  SELECT
    EXTRACT(HOUR FROM a.start_at)::INTEGER,
    COUNT(*)
  INTO v_busiest_hour, v_busiest_hour_count
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
  GROUP BY EXTRACT(HOUR FROM a.start_at)
  ORDER BY 2 DESC
  LIMIT 1;

  -- ==========================================
  -- DETAIL: Top Clients by Revenue (appointment count + spend)
  -- ==========================================
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_top_clients
  FROM (
    SELECT
      a.client_id,
      COALESCE(c.name, 'Client') AS display_name,
      COUNT(a.id)::INTEGER                                  AS appointment_count,
      COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT AS total_spend_cents
    FROM public.appointments a
    LEFT JOIN public.clients c ON c.id = a.client_id
    WHERE a.business_id = p_business_id
      AND a.start_at >= p_start_at
      AND a.start_at <  p_end_at
      AND COALESCE(a.is_deleted, FALSE) = FALSE
      AND COALESCE(a.is_cancelled, FALSE) = FALSE
      AND (p_store_id IS NULL OR a.store_id = p_store_id)
    GROUP BY a.client_id, c.name
    ORDER BY total_spend_cents DESC
    LIMIT 10
  ) t;

  -- ==========================================
  -- RETURN UNIFIED RESULT
  -- Flat structure — keys match AnalyticsOverviewData interface exactly
  -- ==========================================
  RETURN jsonb_build_object(
    'success',            TRUE,
    'total_appointments', v_total_appointments,
    'total_services',     v_top_service_count,
    'revenue_cents',      v_total_revenue_cents,
    'top_clients',        COALESCE(v_top_clients, '[]'::jsonb)
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_monthly_analytics_overview(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================
-- Test with:
-- SELECT * FROM get_monthly_analytics_overview(
--   'YOUR_BUSINESS_ID'::uuid,
--   date_trunc('month', NOW()),
--   date_trunc('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second'
-- );
