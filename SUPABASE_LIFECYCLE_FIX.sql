-- ============================================================
-- LIFECYCLE FIX PATCH
-- Run this in Supabase SQL Editor to fix:
--   1. "relation eligible_gc does not exist" error in transition_overdue_appointments
--   2. Ensure gift_card_transactions has business_id + store_id columns
--   3. Reload PostgREST schema cache
-- ============================================================

-- ============================================================
-- STEP 1: Ensure gift_card_transactions has required columns
-- (idempotent - safe to run multiple times)
-- ============================================================
ALTER TABLE public.gift_card_transactions
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- ============================================================
-- STEP 2: Replace transition_overdue_appointments
-- This version fixes the "eligible_gc does not exist" error
-- by avoiding a CTE that references a non-existent relation.
-- Logic is identical but uses a plain subquery/join instead.
-- ============================================================
CREATE OR REPLACE FUNCTION public.transition_overdue_appointments(
  p_business_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scheduled_count INTEGER;
  v_checked_in_count INTEGER;
BEGIN
  -- --------------------------------------------------------
  -- Part 1: scheduled → pending_confirmation
  -- Appointments whose end_at has passed and are still in
  -- 'scheduled' state (staff never checked them in)
  -- --------------------------------------------------------
  UPDATE public.appointments
    SET lifecycle_status = 'pending_confirmation',
        updated_at = NOW()
    WHERE lifecycle_status = 'scheduled'
      AND end_at < NOW()
      AND COALESCE(is_deleted, FALSE) = FALSE
      AND COALESCE(is_cancelled, FALSE) = FALSE
      AND (p_business_id IS NULL OR business_id = p_business_id);

  GET DIAGNOSTICS v_scheduled_count = ROW_COUNT;

  -- --------------------------------------------------------
  -- Part 2: checked_in → completed (auto-complete)
  -- Appointments that were checked in but the service time
  -- has now passed. Mark complete.
  -- --------------------------------------------------------
  UPDATE public.appointments
    SET lifecycle_status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE lifecycle_status = 'checked_in'
      AND end_at < NOW()
      AND COALESCE(is_deleted, FALSE) = FALSE
      AND (p_business_id IS NULL OR business_id = p_business_id);

  GET DIAGNOSTICS v_checked_in_count = ROW_COUNT;

  -- --------------------------------------------------------
  -- Part 3: Gift card debit for newly auto-completed appointments
  -- Only runs if a gift card was linked and not yet debited.
  -- Uses a plain UPDATE+INSERT (no CTE) to avoid planner issues.
  -- --------------------------------------------------------

  -- Insert debit transactions for qualifying auto-completed appointments
  INSERT INTO public.gift_card_transactions (
    user_id, business_id, store_id,
    gift_card_id, client_id,
    type, amount, balance_before, balance_after,
    appointment_id, notes, created_at
  )
  SELECT
    a.client_id,
    a.business_id,
    a.store_id,
    a.gift_card_id,
    a.client_id,
    'redemption',
    LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0)),
    COALESCE(gc.current_balance, 0),
    GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0))),
    a.id,
    'Auto-debit: appointment auto-completed after check-in',
    NOW()
  FROM public.appointments a
  JOIN public.gift_cards gc ON gc.id = a.gift_card_id
  WHERE a.lifecycle_status = 'completed'
    AND a.completed_at >= NOW() - INTERVAL '1 minute'
    AND a.gift_card_intent = TRUE
    AND COALESCE(a.gift_card_debited, FALSE) = FALSE
    AND gc.status = 'active'
    AND (p_business_id IS NULL OR a.business_id = p_business_id);

  -- Update gift card balances for those same appointments
  UPDATE public.gift_cards gc
    SET current_balance = GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0))),
        status = CASE
          WHEN GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0))) <= 0
          THEN 'fully_used' ELSE 'active' END,
        first_used_at = COALESCE(gc.first_used_at, NOW()),
        fully_used_at = CASE
          WHEN GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0))) <= 0
          THEN NOW() ELSE NULL END,
        updated_at = NOW()
  FROM public.appointments a
  WHERE gc.id = a.gift_card_id
    AND a.lifecycle_status = 'completed'
    AND a.completed_at >= NOW() - INTERVAL '1 minute'
    AND a.gift_card_intent = TRUE
    AND COALESCE(a.gift_card_debited, FALSE) = FALSE
    AND gc.status = 'active'
    AND (p_business_id IS NULL OR a.business_id = p_business_id);

  -- Mark appointments as debited (prevent double-debit)
  UPDATE public.appointments a
    SET gift_card_debited = TRUE
    FROM public.gift_cards gc
    WHERE gc.id = a.gift_card_id
      AND a.lifecycle_status = 'completed'
      AND a.completed_at >= NOW() - INTERVAL '1 minute'
      AND a.gift_card_intent = TRUE
      AND COALESCE(a.gift_card_debited, FALSE) = FALSE;

  RETURN jsonb_build_object(
    'success', TRUE,
    'pending_confirmation_count', v_scheduled_count,
    'auto_completed_count', v_checked_in_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_overdue_appointments(UUID) TO authenticated, service_role;

-- ============================================================
-- STEP 3: Create a callable RPC to reload PostgREST schema cache
-- This allows the backend server to trigger a schema reload
-- programmatically via supabase.rpc('reload_pgrst_schema')
-- ============================================================
CREATE OR REPLACE FUNCTION public.reload_pgrst_schema()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
  RETURN jsonb_build_object('success', TRUE, 'message', 'PostgREST schema cache reload triggered');
END;
$$;

-- Allow service_role (backend admin client) and authenticated users to call it
GRANT EXECUTE ON FUNCTION public.reload_pgrst_schema() TO authenticated, service_role;

-- ============================================================
-- STEP 4: Reload PostgREST schema cache now
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Lifecycle Fix Patch applied successfully.';
  RAISE NOTICE 'transition_overdue_appointments: UPDATED (no more eligible_gc error)';
  RAISE NOTICE 'gift_card_transactions.business_id: ensured';
  RAISE NOTICE 'gift_card_transactions.store_id: ensured';
  RAISE NOTICE 'reload_pgrst_schema() RPC: CREATED';
  RAISE NOTICE 'PostgREST schema cache: reloaded';
  RAISE NOTICE '==============================================';
END $$;
