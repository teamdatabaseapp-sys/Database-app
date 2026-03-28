-- ============================================
-- FIX STAFF CALENDAR - Use staff_store_assignments table
-- Run this SQL in your Supabase SQL Editor
-- ============================================
-- This migration updates the get_staff_calendar_shifts RPC to use
-- the staff_store_assignments table with user_id column as the
-- single source of truth for staff-to-store assignments.
-- ============================================

-- Drop existing function to recreate with updated logic
DROP FUNCTION IF EXISTS public.get_staff_calendar_shifts(UUID, UUID, DATE);

-- ============================================
-- Updated RPC to get shifts for a week
-- Uses staff_store_assignments table with user_id column
-- ============================================

CREATE OR REPLACE FUNCTION public.get_staff_calendar_shifts(
  p_business_id UUID,
  p_store_id UUID,
  p_week_start_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shifts JSONB;
  v_staff JSONB;
  v_store JSONB;
  v_normalized_week DATE;
BEGIN
  -- Normalize to Monday of the week
  v_normalized_week := get_week_start(p_week_start_date);

  -- Get all shifts for this week
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', scs.id,
      'business_id', scs.business_id,
      'store_id', scs.store_id,
      'staff_id', scs.staff_id,
      'week_start_date', scs.week_start_date,
      'day_of_week', scs.day_of_week,
      'shift_start', scs.shift_start::TEXT,
      'shift_end', scs.shift_end::TEXT,
      'break_start', scs.break_start::TEXT,
      'break_end', scs.break_end::TEXT,
      'notes', scs.notes,
      'color', scs.color,
      'created_at', scs.created_at,
      'updated_at', scs.updated_at
    )
  ), '[]'::jsonb) INTO v_shifts
  FROM public.staff_calendar_shifts scs
  WHERE scs.business_id = p_business_id
    AND scs.store_id = p_store_id
    AND scs.week_start_date = v_normalized_week;

  -- Get staff assigned to this store
  -- Check MULTIPLE sources for staff-store assignments:
  -- 1. staff_store_assignments.user_id (primary, with is_active check)
  -- 2. staff_store_assignments.staff_id (fallback)
  -- 3. store_staff.staff_id (legacy)
  -- 4. staff.store_ids array (legacy)
  SELECT COALESCE(jsonb_agg(DISTINCT
    jsonb_build_object(
      'id', s.id,
      'name', COALESCE(s.full_name, s.name),
      'email', s.email,
      'photo_url', s.photo_url,
      'color', s.color,
      'is_active', COALESCE(s.is_active, NOT COALESCE(s.is_archived, FALSE))
    )
  ), '[]'::jsonb) INTO v_staff
  FROM public.staff s
  WHERE s.business_id = p_business_id
    AND COALESCE(s.is_active, NOT COALESCE(s.is_archived, FALSE)) = TRUE
    AND (
      -- Check staff_store_assignments with user_id
      EXISTS (
        SELECT 1 FROM public.staff_store_assignments ssa
        WHERE ssa.user_id = s.id
          AND ssa.store_id = p_store_id
          AND ssa.business_id = p_business_id
          AND COALESCE(ssa.is_active, TRUE) = TRUE
      )
      -- OR check staff_store_assignments with staff_id (fallback)
      OR EXISTS (
        SELECT 1 FROM public.staff_store_assignments ssa
        WHERE ssa.staff_id = s.id
          AND ssa.store_id = p_store_id
          AND ssa.business_id = p_business_id
      )
      -- OR check store_staff table (legacy)
      OR EXISTS (
        SELECT 1 FROM public.store_staff ss
        WHERE ss.staff_id = s.id AND ss.store_id = p_store_id
      )
      -- OR check staff.store_ids array (legacy fallback)
      OR p_store_id = ANY(COALESCE(s.store_ids, ARRAY[]::UUID[]))
    );

  -- Get store info
  SELECT jsonb_build_object(
    'id', st.id,
    'name', st.name
  ) INTO v_store
  FROM public.stores st
  WHERE st.id = p_store_id;

  RETURN jsonb_build_object(
    'shifts', v_shifts,
    'staff', v_staff,
    'store', v_store,
    'week_start_date', v_normalized_week
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_calendar_shifts(UUID, UUID, DATE) TO authenticated;

-- ============================================
-- Also update the summary function
-- ============================================

DROP FUNCTION IF EXISTS public.get_staff_calendar_summary(UUID, UUID, DATE, UUID[]);

CREATE OR REPLACE FUNCTION public.get_staff_calendar_summary(
  p_business_id UUID,
  p_store_id UUID,
  p_week_start_date DATE,
  p_staff_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_week DATE;
  v_summary JSONB;
  v_business_name TEXT;
  v_store_name TEXT;
BEGIN
  v_normalized_week := get_week_start(p_week_start_date);

  -- Get business and store names
  SELECT b.name INTO v_business_name
  FROM public.businesses b
  WHERE b.id = p_business_id;

  SELECT st.name INTO v_store_name
  FROM public.stores st
  WHERE st.id = p_store_id;

  -- Build summary grouped by staff
  -- Check MULTIPLE sources for staff-store assignments
  SELECT jsonb_build_object(
    'business_name', v_business_name,
    'store_name', v_store_name,
    'week_start_date', v_normalized_week,
    'week_end_date', v_normalized_week + 6,
    'schedule', COALESCE((
      SELECT jsonb_agg(staff_schedule)
      FROM (
        SELECT jsonb_build_object(
          'staff_id', s.id,
          'staff_name', COALESCE(s.full_name, s.name),
          'staff_email', s.email,
          'shifts', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'day_of_week', scs.day_of_week,
                'day_name', CASE scs.day_of_week
                  WHEN 0 THEN 'Monday'
                  WHEN 1 THEN 'Tuesday'
                  WHEN 2 THEN 'Wednesday'
                  WHEN 3 THEN 'Thursday'
                  WHEN 4 THEN 'Friday'
                  WHEN 5 THEN 'Saturday'
                  WHEN 6 THEN 'Sunday'
                END,
                'shift_start', scs.shift_start::TEXT,
                'shift_end', scs.shift_end::TEXT
              ) ORDER BY scs.day_of_week
            )
            FROM public.staff_calendar_shifts scs
            WHERE scs.staff_id = s.id
              AND scs.store_id = p_store_id
              AND scs.week_start_date = v_normalized_week
          ), '[]'::jsonb)
        ) AS staff_schedule
        FROM public.staff s
        WHERE s.business_id = p_business_id
          AND (
            p_staff_ids IS NULL
            OR s.id = ANY(p_staff_ids)
          )
          AND (
            -- Check staff_store_assignments with user_id
            EXISTS (
              SELECT 1 FROM public.staff_store_assignments ssa
              WHERE ssa.user_id = s.id
                AND ssa.store_id = p_store_id
                AND ssa.business_id = p_business_id
                AND COALESCE(ssa.is_active, TRUE) = TRUE
            )
            -- OR check staff_store_assignments with staff_id
            OR EXISTS (
              SELECT 1 FROM public.staff_store_assignments ssa
              WHERE ssa.staff_id = s.id
                AND ssa.store_id = p_store_id
                AND ssa.business_id = p_business_id
            )
            -- OR check store_staff table
            OR EXISTS (
              SELECT 1 FROM public.store_staff ss
              WHERE ss.staff_id = s.id AND ss.store_id = p_store_id
            )
          )
        ORDER BY COALESCE(s.full_name, s.name)
      ) sub
    ), '[]'::jsonb)
  ) INTO v_summary;

  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_calendar_summary(UUID, UUID, DATE, UUID[]) TO authenticated;

-- ============================================
-- Notify PostgREST to reload schema
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'STAFF CALENDAR ASSIGNMENTS FIX APPLIED' as status,
       'Uses staff_store_assignments.user_id as primary source' as primary_source,
       'Falls back to staff_store_assignments.staff_id' as fallback1,
       'Falls back to store_staff.staff_id' as fallback2,
       'Falls back to staff.store_ids array' as fallback3;
