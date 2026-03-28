-- ============================================
-- FIX: Analytics RPC lifecycle_status filter
-- ============================================
-- PROBLEM: The get_monthly_analytics_overview RPC was filtering appointments
-- with: (lifecycle_status = 'completed' OR lifecycle_status IS NULL)
--
-- But since the lifecycle migration set DEFAULT 'scheduled', ALL new appointments
-- have lifecycle_status = 'scheduled' — they match neither branch and return 0.
--
-- FIX:
--   - Appointment COUNT: include all non-cancelled statuses
--     (scheduled, checked_in, pending_confirmation, completed, NULL)
--   - Revenue SUM: only completed appointments (or legacy NULL rows)
--   - All other KPIs: follow same "not cancelled" logic
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ============================================

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
  v_busiest_day INTEGER;
  v_busiest_day_count INTEGER := 0;
  v_busiest_hour INTEGER;
  v_busiest_hour_count INTEGER := 0;
  v_top_clients JSONB;
BEGIN
  IF p_business_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'business_id is required');
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.businesses WHERE id = p_business_id;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Business not found');
  END IF;

  IF v_owner_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff WHERE business_id = p_business_id AND user_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Access denied');
    END IF;
  END IF;

  -- ==========================================
  -- KPI 1: Total Appointments + Revenue
  --
  -- Appointment COUNT: all non-cancelled, non-deleted appointments
  --   (scheduled, checked_in, pending_confirmation, completed, NULL legacy)
  --
  -- Revenue SUM: only completed appointments (or legacy NULL rows where
  --   is_deleted=false and is_cancelled=false — pre-lifecycle rows)
  -- ==========================================
  SELECT
    COUNT(*),
    COALESCE(SUM(
      CASE
        WHEN a.lifecycle_status = 'completed'
          OR (a.lifecycle_status IS NULL AND COALESCE(a.is_deleted, FALSE) = FALSE AND COALESCE(a.is_cancelled, FALSE) = FALSE)
        THEN COALESCE(a.amount, 0) * 100
        ELSE 0
      END
    ), 0)::BIGINT
  INTO v_total_appointments, v_total_revenue_cents
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    -- Include all active lifecycle statuses; exclude only explicitly cancelled
    AND COALESCE(a.lifecycle_status, 'scheduled') != 'cancelled';

  -- ==========================================
  -- KPI 2: New Clients
  -- ==========================================
  SELECT COUNT(*) INTO v_new_clients
  FROM public.clients c
  WHERE c.business_id = p_business_id
    AND c.created_at >= p_start_at
    AND c.created_at <  p_end_at;

  -- ==========================================
  -- KPI 3: Promotions Redeemed
  -- Count appointments with a promo applied (any active status)
  -- ==========================================
  SELECT COUNT(DISTINCT a.id) INTO v_promotions_redeemed
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND COALESCE(a.lifecycle_status, 'scheduled') != 'cancelled'
    AND (
      a.promo_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.appointment_services aps
        WHERE aps.appointment_id = a.id AND aps.promo_id IS NOT NULL
      )
    );

  -- ==========================================
  -- KPI 4: Top Service (all active appointments)
  -- ==========================================
  SELECT
    aps.service_id, s.name, COUNT(*) as cnt,
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
    AND COALESCE(a.lifecycle_status, 'scheduled') != 'cancelled'
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
    AND COALESCE(a.lifecycle_status, 'scheduled') != 'cancelled'
  GROUP BY EXTRACT(MONTH FROM a.start_at)
  ORDER BY 2 DESC
  LIMIT 1;

  -- ==========================================
  -- KPI 6: Busiest Day of Week
  -- ==========================================
  SELECT
    EXTRACT(DOW FROM a.start_at)::INTEGER, COUNT(*)
  INTO v_busiest_day, v_busiest_day_count
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND COALESCE(a.lifecycle_status, 'scheduled') != 'cancelled'
  GROUP BY EXTRACT(DOW FROM a.start_at)
  ORDER BY 2 DESC LIMIT 1;

  -- ==========================================
  -- KPI 7: Busiest Hour
  -- ==========================================
  SELECT
    EXTRACT(HOUR FROM a.start_at)::INTEGER, COUNT(*)
  INTO v_busiest_hour, v_busiest_hour_count
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND COALESCE(a.lifecycle_status, 'scheduled') != 'cancelled'
  GROUP BY EXTRACT(HOUR FROM a.start_at)
  ORDER BY 2 DESC LIMIT 1;

  -- ==========================================
  -- DETAIL: Top Clients by Appointment Count (all active)
  -- Revenue shown from completed appointments only
  -- ==========================================
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_clients
  FROM (
    SELECT
      a.client_id,
      COALESCE(c.name, 'Client') AS display_name,
      COUNT(a.id)::INTEGER AS appointment_count,
      COALESCE(SUM(
        CASE
          WHEN a.lifecycle_status = 'completed'
            OR (a.lifecycle_status IS NULL AND COALESCE(a.is_deleted, FALSE) = FALSE AND COALESCE(a.is_cancelled, FALSE) = FALSE)
          THEN COALESCE(a.amount, 0) * 100
          ELSE 0
        END
      ), 0)::BIGINT AS total_spend_cents
    FROM public.appointments a
    LEFT JOIN public.clients c ON c.id = a.client_id
    WHERE a.business_id = p_business_id
      AND a.start_at >= p_start_at
      AND a.start_at <  p_end_at
      AND COALESCE(a.is_deleted, FALSE) = FALSE
      AND COALESCE(a.is_cancelled, FALSE) = FALSE
      AND (p_store_id IS NULL OR a.store_id = p_store_id)
      AND COALESCE(a.lifecycle_status, 'scheduled') != 'cancelled'
    GROUP BY a.client_id, c.name
    ORDER BY appointment_count DESC, total_spend_cents DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'total_appointments', v_total_appointments,
    'total_services',     v_top_service_count,
    'revenue_cents',      v_total_revenue_cents,
    'top_clients',        COALESCE(v_top_clients, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_analytics_overview(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
