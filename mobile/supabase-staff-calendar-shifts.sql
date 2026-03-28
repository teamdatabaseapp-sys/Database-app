-- ============================================
-- STAFF CALENDAR SHIFTS - Enterprise Scheduling
-- ============================================
-- Premium staff scheduling with week-based shift management
-- Integrates with existing blackout/special days logic
-- Multi-store, multi-staff scalable architecture
-- ============================================

-- ============================================
-- STEP 1: Create staff_calendar_shifts table
-- ============================================

CREATE TABLE IF NOT EXISTS public.staff_calendar_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- Week identification (Monday of the week, normalized)
  week_start_date DATE NOT NULL,

  -- Day within the week (0=Monday, 1=Tuesday, ..., 6=Sunday)
  -- ISO week standard where Monday=0
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Shift times (TIME type, format: 'HH:MM:SS')
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,

  -- Optional: break period within shift
  break_start TIME,
  break_end TIME,

  -- Metadata
  notes TEXT,
  color TEXT, -- Override staff color for this shift if needed

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT staff_calendar_shifts_valid_times CHECK (shift_end > shift_start),
  CONSTRAINT staff_calendar_shifts_valid_break CHECK (
    (break_start IS NULL AND break_end IS NULL) OR
    (break_start IS NOT NULL AND break_end IS NOT NULL AND break_end > break_start)
  )
);

-- Unique constraint: one shift per staff per day per store per week
CREATE UNIQUE INDEX IF NOT EXISTS staff_calendar_shifts_unique_shift
  ON public.staff_calendar_shifts(staff_id, store_id, week_start_date, day_of_week);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_staff_calendar_shifts_business
  ON public.staff_calendar_shifts(business_id);

CREATE INDEX IF NOT EXISTS idx_staff_calendar_shifts_store
  ON public.staff_calendar_shifts(store_id);

CREATE INDEX IF NOT EXISTS idx_staff_calendar_shifts_staff
  ON public.staff_calendar_shifts(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_calendar_shifts_week
  ON public.staff_calendar_shifts(week_start_date);

CREATE INDEX IF NOT EXISTS idx_staff_calendar_shifts_lookup
  ON public.staff_calendar_shifts(store_id, week_start_date);

CREATE INDEX IF NOT EXISTS idx_staff_calendar_shifts_full_lookup
  ON public.staff_calendar_shifts(business_id, store_id, week_start_date);

-- ============================================
-- STEP 2: Enable RLS on staff_calendar_shifts
-- ============================================

ALTER TABLE public.staff_calendar_shifts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read shifts for businesses they own
CREATE POLICY "Users can read own business shifts"
  ON public.staff_calendar_shifts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = staff_calendar_shifts.business_id
        AND b.user_id = auth.uid()
    )
  );

-- Policy: Users can insert shifts for businesses they own
CREATE POLICY "Users can insert own business shifts"
  ON public.staff_calendar_shifts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = staff_calendar_shifts.business_id
        AND b.user_id = auth.uid()
    )
  );

-- Policy: Users can update shifts for businesses they own
CREATE POLICY "Users can update own business shifts"
  ON public.staff_calendar_shifts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = staff_calendar_shifts.business_id
        AND b.user_id = auth.uid()
    )
  );

-- Policy: Users can delete shifts for businesses they own
CREATE POLICY "Users can delete own business shifts"
  ON public.staff_calendar_shifts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = staff_calendar_shifts.business_id
        AND b.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Ensure staff.email column exists
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff'
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.staff ADD COLUMN email TEXT;
  END IF;
END $$;

-- ============================================
-- STEP 4: Helper function to get Monday of week
-- ============================================

CREATE OR REPLACE FUNCTION public.get_week_start(p_date DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Returns Monday of the week containing p_date
  -- ISO week: Monday = 1, Sunday = 7
  RETURN p_date - (EXTRACT(ISODOW FROM p_date)::INTEGER - 1);
END;
$$;

-- ============================================
-- STEP 5: RPC to get shifts for a week
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
  SELECT COALESCE(jsonb_agg(
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
  LEFT JOIN public.store_staff ss ON ss.staff_id = s.id AND ss.store_id = p_store_id
  WHERE s.business_id = p_business_id
    AND (
      ss.store_id IS NOT NULL
      OR p_store_id = ANY(s.store_ids)
    )
    AND COALESCE(s.is_active, NOT COALESCE(s.is_archived, FALSE)) = TRUE;

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
-- STEP 6: RPC to upsert shifts (batch)
-- ============================================

CREATE OR REPLACE FUNCTION public.upsert_staff_calendar_shifts(
  p_business_id UUID,
  p_store_id UUID,
  p_week_start_date DATE,
  p_shifts JSONB -- Array of shift objects
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_week DATE;
  v_shift JSONB;
  v_created INTEGER := 0;
  v_updated INTEGER := 0;
  v_existing_id UUID;
BEGIN
  -- Normalize to Monday of the week
  v_normalized_week := get_week_start(p_week_start_date);

  -- Process each shift
  FOR v_shift IN SELECT * FROM jsonb_array_elements(p_shifts)
  LOOP
    -- Check if shift already exists
    SELECT id INTO v_existing_id
    FROM public.staff_calendar_shifts
    WHERE staff_id = (v_shift->>'staff_id')::UUID
      AND store_id = p_store_id
      AND week_start_date = v_normalized_week
      AND day_of_week = (v_shift->>'day_of_week')::INTEGER;

    IF v_existing_id IS NOT NULL THEN
      -- Update existing shift
      UPDATE public.staff_calendar_shifts
      SET shift_start = (v_shift->>'shift_start')::TIME,
          shift_end = (v_shift->>'shift_end')::TIME,
          break_start = NULLIF(v_shift->>'break_start', '')::TIME,
          break_end = NULLIF(v_shift->>'break_end', '')::TIME,
          notes = v_shift->>'notes',
          color = v_shift->>'color',
          updated_at = NOW()
      WHERE id = v_existing_id;
      v_updated := v_updated + 1;
    ELSE
      -- Insert new shift
      INSERT INTO public.staff_calendar_shifts (
        business_id,
        store_id,
        staff_id,
        week_start_date,
        day_of_week,
        shift_start,
        shift_end,
        break_start,
        break_end,
        notes,
        color
      ) VALUES (
        p_business_id,
        p_store_id,
        (v_shift->>'staff_id')::UUID,
        v_normalized_week,
        (v_shift->>'day_of_week')::INTEGER,
        (v_shift->>'shift_start')::TIME,
        (v_shift->>'shift_end')::TIME,
        NULLIF(v_shift->>'break_start', '')::TIME,
        NULLIF(v_shift->>'break_end', '')::TIME,
        v_shift->>'notes',
        v_shift->>'color'
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'created', v_created,
    'updated', v_updated,
    'week_start_date', v_normalized_week
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_staff_calendar_shifts(UUID, UUID, DATE, JSONB) TO authenticated;

-- ============================================
-- STEP 7: RPC to delete a shift
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_staff_calendar_shift(
  p_shift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.staff_calendar_shifts
  WHERE id = p_shift_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Shift not found');
  END IF;

  RETURN jsonb_build_object('success', TRUE);

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_staff_calendar_shift(UUID) TO authenticated;

-- ============================================
-- STEP 8: RPC to copy week shifts
-- ============================================

CREATE OR REPLACE FUNCTION public.copy_staff_calendar_week(
  p_business_id UUID,
  p_store_id UUID,
  p_source_week DATE,
  p_target_week DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_normalized DATE;
  v_target_normalized DATE;
  v_copied INTEGER := 0;
BEGIN
  v_source_normalized := get_week_start(p_source_week);
  v_target_normalized := get_week_start(p_target_week);

  -- Delete existing shifts in target week
  DELETE FROM public.staff_calendar_shifts
  WHERE business_id = p_business_id
    AND store_id = p_store_id
    AND week_start_date = v_target_normalized;

  -- Copy shifts from source to target
  INSERT INTO public.staff_calendar_shifts (
    business_id, store_id, staff_id, week_start_date,
    day_of_week, shift_start, shift_end, break_start, break_end, notes, color
  )
  SELECT
    business_id, store_id, staff_id, v_target_normalized,
    day_of_week, shift_start, shift_end, break_start, break_end, notes, color
  FROM public.staff_calendar_shifts
  WHERE business_id = p_business_id
    AND store_id = p_store_id
    AND week_start_date = v_source_normalized;

  GET DIAGNOSTICS v_copied = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', TRUE,
    'copied', v_copied,
    'source_week', v_source_normalized,
    'target_week', v_target_normalized
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.copy_staff_calendar_week(UUID, UUID, DATE, DATE) TO authenticated;

-- ============================================
-- STEP 9: RPC to apply default weekly schedule
-- ============================================

CREATE OR REPLACE FUNCTION public.apply_default_schedule_to_week(
  p_business_id UUID,
  p_store_id UUID,
  p_staff_id UUID,
  p_week_start_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_week DATE;
  v_applied INTEGER := 0;
  v_schedule RECORD;
BEGIN
  v_normalized_week := get_week_start(p_week_start_date);

  -- Get staff's default weekly schedule and apply
  FOR v_schedule IN
    SELECT
      sws.day_of_week,
      sws.start_time,
      sws.end_time,
      sws.is_off
    FROM public.staff_weekly_schedule sws
    WHERE sws.staff_id = p_staff_id
      AND sws.business_id = p_business_id
      AND sws.is_off = FALSE
  LOOP
    -- Convert day_of_week: existing uses 0=Sunday, we use 0=Monday
    -- So Sunday(0) -> 6, Monday(1) -> 0, etc.
    DECLARE
      v_iso_day INTEGER;
    BEGIN
      v_iso_day := CASE v_schedule.day_of_week
        WHEN 0 THEN 6  -- Sunday
        WHEN 1 THEN 0  -- Monday
        WHEN 2 THEN 1  -- Tuesday
        WHEN 3 THEN 2  -- Wednesday
        WHEN 4 THEN 3  -- Thursday
        WHEN 5 THEN 4  -- Friday
        WHEN 6 THEN 5  -- Saturday
      END;

      INSERT INTO public.staff_calendar_shifts (
        business_id, store_id, staff_id, week_start_date,
        day_of_week, shift_start, shift_end
      ) VALUES (
        p_business_id, p_store_id, p_staff_id, v_normalized_week,
        v_iso_day, v_schedule.start_time, v_schedule.end_time
      )
      ON CONFLICT (staff_id, store_id, week_start_date, day_of_week)
      DO UPDATE SET
        shift_start = EXCLUDED.shift_start,
        shift_end = EXCLUDED.shift_end,
        updated_at = NOW();

      v_applied := v_applied + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'applied', v_applied,
    'week_start_date', v_normalized_week
  );

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_default_schedule_to_week(UUID, UUID, UUID, DATE) TO authenticated;

-- ============================================
-- STEP 10: RPC to get weekly summary for sharing
-- ============================================

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
          AND EXISTS (
            SELECT 1 FROM public.store_staff ss
            WHERE ss.staff_id = s.id AND ss.store_id = p_store_id
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
-- STEP 11: Notify PostgREST to reload schema
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'STAFF CALENDAR SHIFTS TABLE CREATED' as status,
       'RLS enabled' as security,
       'Multi-store ready' as scalability,
       '6 RPC functions' as api_functions;
