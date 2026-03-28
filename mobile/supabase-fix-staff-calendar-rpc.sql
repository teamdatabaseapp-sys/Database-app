-- ============================================================
-- FIX STAFF CALENDAR RPC - Check ALL staff-store assignment sources
-- ============================================================
-- PROBLEM: The RPC only checked staff_store_assignments table,
-- but staff are assigned via MULTIPLE methods:
--   1. staff_store_assignments table (user_id = staff.id)
--   2. store_staff table (staff_id = staff.id)
--   3. staff.store_ids array column
--
-- This fix checks ALL THREE sources to find staff for a store.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_staff_calendar_shifts(UUID, UUID, DATE);

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

    -- Normalize week start to Monday
    v_normalized_week := get_week_start(p_week_start_date);

    -- ============================================================
    -- GET SHIFTS FOR THIS WEEK
    -- ============================================================

    SELECT COALESCE(
        jsonb_agg(
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
        ),
        '[]'::jsonb
    )
    INTO v_shifts
    FROM public.staff_calendar_shifts scs
    WHERE scs.business_id = p_business_id
      AND scs.store_id = p_store_id
      AND scs.week_start_date = v_normalized_week;

    -- ============================================================
    -- GET STAFF ASSIGNED TO STORE
    -- Check ALL THREE assignment sources:
    -- 1. staff_store_assignments.user_id = staff.id
    -- 2. store_staff.staff_id = staff.id
    -- 3. p_store_id = ANY(staff.store_ids)
    -- ============================================================

    SELECT COALESCE(
        (
            SELECT jsonb_agg(staff_row ORDER BY staff_row->>'name')
            FROM (
                SELECT DISTINCT ON (s.id)
                    jsonb_build_object(
                        'id', s.id,
                        'name', COALESCE(NULLIF(s.name, ''), s.full_name, 'Unnamed'),
                        'email', s.email,
                        'photo_url', s.photo_url,
                        'color', COALESCE(s.color, '#0D9488'),
                        'is_active', COALESCE(s.is_active, TRUE)
                    ) AS staff_row
                FROM public.staff s
                -- Left join to staff_store_assignments
                LEFT JOIN public.staff_store_assignments ssa
                    ON ssa.user_id = s.id
                   AND ssa.store_id = p_store_id
                   AND ssa.business_id = p_business_id
                   AND COALESCE(ssa.is_active, TRUE) = TRUE
                -- Left join to store_staff
                LEFT JOIN public.store_staff ss
                    ON ss.staff_id = s.id
                   AND ss.store_id = p_store_id
                   AND ss.business_id = p_business_id
                WHERE s.business_id = p_business_id
                  AND COALESCE(s.is_active, NOT COALESCE(s.is_archived, FALSE)) = TRUE
                  -- Staff is assigned if ANY of these conditions is true:
                  AND (
                      ssa.id IS NOT NULL                      -- Found in staff_store_assignments
                      OR ss.id IS NOT NULL                    -- Found in store_staff
                      OR p_store_id = ANY(s.store_ids)        -- Found in store_ids array
                  )
                ORDER BY s.id
            ) sub
        ),
        '[]'::jsonb
    )
    INTO v_staff;

    -- ============================================================
    -- GET STORE INFO
    -- ============================================================

    SELECT jsonb_build_object(
        'id', st.id,
        'name', st.name
    )
    INTO v_store
    FROM public.stores st
    WHERE st.id = p_store_id;

    -- ============================================================
    -- FINAL RETURN
    -- ============================================================

    RETURN jsonb_build_object(
        'shifts', v_shifts,
        'staff', v_staff,
        'store', v_store,
        'week_start_date', v_normalized_week
    );

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_calendar_shifts(UUID, UUID, DATE) TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION QUERY (run after migration)
-- ============================================================
-- SELECT public.get_staff_calendar_shifts(
--     'YOUR_BUSINESS_ID'::UUID,
--     'YOUR_STORE_ID'::UUID,
--     CURRENT_DATE
-- );
