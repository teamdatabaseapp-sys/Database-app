-- ============================================
-- FIX: get_available_slots - Check staff availability when "Any Available" selected
-- ============================================
-- ISSUE: When p_staff_id is NULL (Any Available), only store hours were checked.
--        This showed slots even when NO staff was available.
--
-- FIX: When p_staff_id is NULL, check if ANY staff assigned to the store is available
--      for each time slot. Only show slots where at least one staff member is working.
--
-- AVAILABILITY FORMULA:
--   Slot = Store Hours ∩ (Staff1 Schedule ∪ Staff2 Schedule ∪ ... ∪ StaffN Schedule)
--
-- When specific staff selected:
--   Slot = Store Hours ∩ Selected Staff Schedule
-- ============================================

-- Drop and recreate the function
DROP FUNCTION IF EXISTS public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER);

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id UUID,
  p_store_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_service_duration INTEGER DEFAULT 60,
  p_date DATE DEFAULT CURRENT_DATE,
  p_days_ahead INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_open_time TIME;
  v_close_time TIME;
  v_is_closed BOOLEAN;
  v_slot_time TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_slots JSONB;
  v_booking_conflict BOOLEAN;
  v_override_record RECORD;
  v_hours_record RECORD;
  v_staff_record RECORD;
  v_has_store_override BOOLEAN;
  v_has_store_hours BOOLEAN;
  v_is_blackout BOOLEAN;
  v_has_staff_schedule BOOLEAN;
  v_staff_has_any_schedule BOOLEAN;
  v_staff_is_off BOOLEAN;
  v_staff_in_blackout BOOLEAN;
  v_skip_reason TEXT;
  v_log_prefix TEXT;
  -- TIMEZONE VARIABLES
  v_store_timezone TEXT;
  v_now_in_store_tz TIMESTAMP;
  v_slot_local_time TIMESTAMP;
  -- ANY STAFF AVAILABILITY VARIABLES
  v_any_staff_available BOOLEAN;
  v_store_staff_ids UUID[];
  v_check_staff_id UUID;
  v_staff_available_for_slot BOOLEAN;
BEGIN
  v_log_prefix := '[get_available_slots]';
  RAISE NOTICE '% Input: business_id=%, store_id=%, staff_id=%, service_duration=%, date=%, days_ahead=%',
    v_log_prefix, p_business_id, p_store_id, p_staff_id, p_service_duration, p_date, p_days_ahead;

  -- VALIDATE REQUIRED PARAMETERS
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id is required and cannot be NULL';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'p_store_id is required for timezone-aware slot generation. Cannot be NULL.';
  END IF;

  -- FETCH STORE TIMEZONE
  SELECT s.timezone
  INTO v_store_timezone
  FROM public.stores s
  WHERE s.id = p_store_id
    AND s.business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found: store_id=% does not exist for business_id=%', p_store_id, p_business_id;
  END IF;

  IF v_store_timezone IS NULL OR v_store_timezone = '' THEN
    RAISE EXCEPTION 'Store timezone not configured for store_id=%. Please set stores.timezone column.', p_store_id;
  END IF;

  RAISE NOTICE '% Using store timezone: %', v_log_prefix, v_store_timezone;

  -- CALCULATE "NOW" IN STORE'S LOCAL TIMEZONE
  v_now_in_store_tz := (NOW() AT TIME ZONE v_store_timezone);

  RAISE NOTICE '% Server NOW(): % | Store local time (%): %',
    v_log_prefix, NOW(), v_store_timezone, v_now_in_store_tz;

  -- GET STAFF ASSIGNED TO THIS STORE (for "Any Available" logic)
  -- Check both store_staff and staff_store_assignments tables
  SELECT ARRAY_AGG(DISTINCT staff_id) INTO v_store_staff_ids
  FROM (
    -- From store_staff junction table
    SELECT ss.staff_id
    FROM public.store_staff ss
    INNER JOIN public.staff st ON st.id = ss.staff_id
    WHERE ss.store_id = p_store_id
      AND ss.business_id = p_business_id
      AND st.is_active = TRUE
    UNION
    -- From staff_store_assignments table
    SELECT COALESCE(ssa.staff_id, ssa.user_id) as staff_id
    FROM public.staff_store_assignments ssa
    INNER JOIN public.staff st ON st.id = COALESCE(ssa.staff_id, ssa.user_id)
    WHERE ssa.store_id = p_store_id
      AND ssa.business_id = p_business_id
      AND COALESCE(ssa.is_active, TRUE) = TRUE
      AND st.is_active = TRUE
  ) combined;

  IF v_store_staff_ids IS NULL OR array_length(v_store_staff_ids, 1) IS NULL THEN
    RAISE NOTICE '% NO staff assigned to store %. No slots will be generated.', v_log_prefix, p_store_id;
    RETURN '[]'::jsonb;
  END IF;

  RAISE NOTICE '% Staff assigned to store: % (count: %)', v_log_prefix, v_store_staff_ids, array_length(v_store_staff_ids, 1);

  -- Check if specific staff has ANY weekly schedule defined
  v_staff_has_any_schedule := FALSE;
  IF p_staff_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.staff_weekly_schedule sws
      WHERE sws.staff_id = p_staff_id
        AND sws.business_id = p_business_id
    ) INTO v_staff_has_any_schedule;

    RAISE NOTICE '% Staff % has weekly schedule defined: %',
      v_log_prefix, p_staff_id, v_staff_has_any_schedule;
  END IF;

  -- Loop through dates
  FOR i IN 0..p_days_ahead LOOP
    v_current_date := p_date + i;
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INTEGER;
    v_has_store_override := FALSE;
    v_has_store_hours := FALSE;
    v_has_staff_schedule := FALSE;
    v_is_blackout := FALSE;
    v_is_closed := FALSE;
    v_staff_is_off := FALSE;
    v_staff_in_blackout := FALSE;
    v_open_time := NULL;
    v_close_time := NULL;
    v_skip_reason := NULL;

    -- ========================================
    -- STEP 1: Check for store_hours_overrides (highest priority for store)
    -- ========================================
    SELECT
      sho.is_closed,
      sho.open_time,
      sho.close_time
    INTO v_override_record
    FROM public.store_hours_overrides sho
    WHERE sho.store_id = p_store_id
      AND sho.business_id = p_business_id
      AND v_current_date >= sho.start_date
      AND v_current_date <= sho.end_date
    ORDER BY sho.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_has_store_override := TRUE;
      v_is_closed := v_override_record.is_closed;
      IF NOT v_is_closed THEN
        v_open_time := v_override_record.open_time;
        v_close_time := v_override_record.close_time;
        v_has_store_hours := TRUE;
      ELSE
        v_skip_reason := 'store_override_closed';
      END IF;
    END IF;

    -- ========================================
    -- STEP 2: Check blackout_dates on store (if no override)
    -- ========================================
    IF NOT v_has_store_override THEN
      SELECT EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = p_store_id
          AND s.business_id = p_business_id
          AND s.blackout_dates IS NOT NULL
          AND to_char(v_current_date, 'YYYY-MM-DD') = ANY(s.blackout_dates)
      ) INTO v_is_blackout;

      IF v_is_blackout THEN
        v_is_closed := TRUE;
        v_skip_reason := 'store_blackout_date';
      END IF;
    END IF;

    -- ========================================
    -- STEP 3: Get base store hours (if no override and not blackout)
    -- ========================================
    IF NOT v_has_store_override AND NOT v_is_blackout THEN
      -- First try store-specific hours
      SELECT bh.open_time, bh.close_time, bh.is_closed
      INTO v_hours_record
      FROM public.business_hours bh
      WHERE bh.business_id = p_business_id
        AND bh.store_id = p_store_id
        AND bh.day_of_week = v_day_of_week
      LIMIT 1;

      IF FOUND THEN
        v_has_store_hours := TRUE;
        v_is_closed := COALESCE(v_hours_record.is_closed, FALSE);
        IF NOT v_is_closed THEN
          v_open_time := v_hours_record.open_time;
          v_close_time := v_hours_record.close_time;
        ELSE
          v_skip_reason := 'store_weekly_closed';
        END IF;
      ELSE
        -- Fall back to business-wide hours
        SELECT bh.open_time, bh.close_time, bh.is_closed
        INTO v_hours_record
        FROM public.business_hours bh
        WHERE bh.business_id = p_business_id
          AND bh.store_id IS NULL
          AND bh.day_of_week = v_day_of_week
        LIMIT 1;

        IF FOUND THEN
          v_has_store_hours := TRUE;
          v_is_closed := COALESCE(v_hours_record.is_closed, FALSE);
          IF NOT v_is_closed THEN
            v_open_time := v_hours_record.open_time;
            v_close_time := v_hours_record.close_time;
          ELSE
            v_skip_reason := 'business_weekly_closed';
          END IF;
        END IF;
      END IF;
    END IF;

    -- ========================================
    -- STEP 4: Check staff schedule (SPECIFIC staff selected)
    -- ========================================
    IF p_staff_id IS NOT NULL AND NOT v_is_closed THEN
      -- 4a. Check staff_special_days for this specific date
      SELECT ssd.is_off, ssd.start_time, ssd.end_time
      INTO v_staff_record
      FROM public.staff_special_days ssd
      WHERE ssd.staff_id = p_staff_id
        AND ssd.business_id = p_business_id
        AND ssd.date = v_current_date
      LIMIT 1;

      IF FOUND THEN
        IF v_staff_record.is_off THEN
          v_staff_is_off := TRUE;
          v_skip_reason := 'staff_special_day_off';
        ELSE
          v_has_staff_schedule := TRUE;
          IF v_staff_record.start_time IS NOT NULL AND v_staff_record.end_time IS NOT NULL THEN
            v_open_time := GREATEST(COALESCE(v_open_time, v_staff_record.start_time), v_staff_record.start_time);
            v_close_time := LEAST(COALESCE(v_close_time, v_staff_record.end_time), v_staff_record.end_time);
          END IF;
        END IF;
      END IF;

      -- 4b. Check staff_blackout_ranges
      IF NOT v_staff_is_off THEN
        SELECT EXISTS (
          SELECT 1 FROM public.staff_blackout_ranges sbr
          WHERE sbr.staff_id = p_staff_id
            AND sbr.business_id = p_business_id
            AND v_current_date >= sbr.start_at::DATE
            AND v_current_date <= sbr.end_at::DATE
        ) INTO v_staff_in_blackout;

        IF v_staff_in_blackout THEN
          v_staff_is_off := TRUE;
          v_skip_reason := 'staff_blackout_range';
        END IF;
      END IF;

      -- 4c. Check staff_weekly_schedule
      IF NOT v_staff_is_off AND NOT v_has_staff_schedule THEN
        SELECT sws.is_off, sws.start_time, sws.end_time
        INTO v_staff_record
        FROM public.staff_weekly_schedule sws
        WHERE sws.staff_id = p_staff_id
          AND sws.business_id = p_business_id
          AND sws.day_of_week = v_day_of_week
        LIMIT 1;

        IF FOUND THEN
          v_has_staff_schedule := TRUE;
          IF v_staff_record.is_off THEN
            v_staff_is_off := TRUE;
            v_skip_reason := 'staff_weekly_off';
          ELSE
            IF v_staff_record.start_time IS NOT NULL AND v_staff_record.end_time IS NOT NULL THEN
              v_open_time := GREATEST(COALESCE(v_open_time, v_staff_record.start_time), v_staff_record.start_time);
              v_close_time := LEAST(COALESCE(v_close_time, v_staff_record.end_time), v_staff_record.end_time);
            END IF;
          END IF;
        ELSE
          IF NOT v_staff_has_any_schedule THEN
            -- No schedule at all - use store hours
            NULL;
          ELSE
            -- Staff has schedule for other days but not this day
            v_staff_is_off := TRUE;
            v_skip_reason := 'staff_no_schedule_this_day';
          END IF;
        END IF;
      END IF;
    END IF;

    -- Skip this day if store closed or staff is off
    IF v_is_closed THEN
      CONTINUE;
    END IF;

    IF v_staff_is_off THEN
      CONTINUE;
    END IF;

    IF NOT v_has_store_hours AND NOT v_has_store_override THEN
      CONTINUE;
    END IF;

    IF v_open_time IS NULL OR v_close_time IS NULL THEN
      CONTINUE;
    END IF;

    -- Check if service duration fits
    IF (v_close_time - v_open_time) < (p_service_duration || ' minutes')::INTERVAL THEN
      CONTINUE;
    END IF;

    -- ========================================
    -- Generate time slots for this day
    -- ========================================
    v_slots := '[]'::jsonb;
    v_slot_time := (v_current_date || ' ' || v_open_time)::TIMESTAMP AT TIME ZONE v_store_timezone;

    WHILE (v_slot_time AT TIME ZONE v_store_timezone)::TIME + (p_service_duration || ' minutes')::INTERVAL <= v_close_time LOOP
      v_slot_end := v_slot_time + (p_service_duration || ' minutes')::INTERVAL;
      v_slot_local_time := (v_slot_time AT TIME ZONE v_store_timezone);

      -- Only future slots
      IF v_slot_local_time > v_now_in_store_tz THEN
        -- ========================================
        -- STEP 5: Check staff availability for this slot
        -- When p_staff_id IS NULL ("Any Available"), check if ANY assigned staff is available
        -- ========================================
        v_any_staff_available := FALSE;

        IF p_staff_id IS NOT NULL THEN
          -- Specific staff selected - they're available (we already checked above)
          v_any_staff_available := TRUE;
        ELSE
          -- "Any Available" - check if at least one staff member is available
          FOREACH v_check_staff_id IN ARRAY v_store_staff_ids LOOP
            v_staff_available_for_slot := TRUE;

            -- Check staff_special_days
            PERFORM 1 FROM public.staff_special_days ssd
            WHERE ssd.staff_id = v_check_staff_id
              AND ssd.business_id = p_business_id
              AND ssd.date = v_current_date
              AND ssd.is_off = TRUE;
            IF FOUND THEN
              v_staff_available_for_slot := FALSE;
            END IF;

            -- Check staff_blackout_ranges
            IF v_staff_available_for_slot THEN
              PERFORM 1 FROM public.staff_blackout_ranges sbr
              WHERE sbr.staff_id = v_check_staff_id
                AND sbr.business_id = p_business_id
                AND v_current_date >= sbr.start_at::DATE
                AND v_current_date <= sbr.end_at::DATE;
              IF FOUND THEN
                v_staff_available_for_slot := FALSE;
              END IF;
            END IF;

            -- Check staff_weekly_schedule
            IF v_staff_available_for_slot THEN
              -- Check if staff has a weekly schedule
              PERFORM 1 FROM public.staff_weekly_schedule sws
              WHERE sws.staff_id = v_check_staff_id
                AND sws.business_id = p_business_id;

              IF FOUND THEN
                -- Staff has a weekly schedule - check if working this day
                SELECT sws.is_off, sws.start_time, sws.end_time
                INTO v_staff_record
                FROM public.staff_weekly_schedule sws
                WHERE sws.staff_id = v_check_staff_id
                  AND sws.business_id = p_business_id
                  AND sws.day_of_week = v_day_of_week
                LIMIT 1;

                IF NOT FOUND THEN
                  -- No schedule for this day = not working
                  v_staff_available_for_slot := FALSE;
                ELSIF v_staff_record.is_off THEN
                  -- Marked as off
                  v_staff_available_for_slot := FALSE;
                ELSE
                  -- Check if slot time falls within staff's working hours
                  IF v_staff_record.start_time IS NOT NULL AND v_staff_record.end_time IS NOT NULL THEN
                    IF (v_slot_time AT TIME ZONE v_store_timezone)::TIME < v_staff_record.start_time
                       OR (v_slot_end AT TIME ZONE v_store_timezone)::TIME > v_staff_record.end_time THEN
                      v_staff_available_for_slot := FALSE;
                    END IF;
                  END IF;
                END IF;
              ELSE
                -- No weekly schedule at all - staff is available during store hours (fallback behavior)
                NULL;
              END IF;
            END IF;

            -- Check staff_special_days for custom hours (not off)
            IF v_staff_available_for_slot THEN
              SELECT ssd.start_time, ssd.end_time
              INTO v_staff_record
              FROM public.staff_special_days ssd
              WHERE ssd.staff_id = v_check_staff_id
                AND ssd.business_id = p_business_id
                AND ssd.date = v_current_date
                AND ssd.is_off = FALSE
              LIMIT 1;

              IF FOUND AND v_staff_record.start_time IS NOT NULL AND v_staff_record.end_time IS NOT NULL THEN
                -- Staff has special hours - check if slot fits
                IF (v_slot_time AT TIME ZONE v_store_timezone)::TIME < v_staff_record.start_time
                   OR (v_slot_end AT TIME ZONE v_store_timezone)::TIME > v_staff_record.end_time THEN
                  v_staff_available_for_slot := FALSE;
                END IF;
              END IF;
            END IF;

            -- Check for booking conflicts for this staff
            IF v_staff_available_for_slot THEN
              SELECT EXISTS (
                SELECT 1 FROM public.public_bookings pb
                WHERE pb.business_id = p_business_id
                  AND pb.status NOT IN ('cancelled')
                  AND pb.store_id = p_store_id
                  AND pb.staff_id = v_check_staff_id
                  AND pb.start_at < v_slot_end
                  AND pb.end_at > v_slot_time
              ) INTO v_booking_conflict;

              IF NOT v_booking_conflict THEN
                SELECT EXISTS (
                  SELECT 1 FROM public.appointments a
                  WHERE a.business_id = p_business_id
                    AND COALESCE(a.is_deleted, FALSE) = FALSE
                    AND COALESCE(a.is_cancelled, FALSE) = FALSE
                    AND a.store_id = p_store_id
                    AND a.staff_id = v_check_staff_id
                    AND a.start_at < v_slot_end
                    AND a.end_at > v_slot_time
                ) INTO v_booking_conflict;
              END IF;

              IF v_booking_conflict THEN
                v_staff_available_for_slot := FALSE;
              END IF;
            END IF;

            -- If this staff is available, we found at least one
            IF v_staff_available_for_slot THEN
              v_any_staff_available := TRUE;
              EXIT; -- No need to check more staff
            END IF;
          END LOOP;
        END IF;

        -- Only add slot if at least one staff is available
        IF v_any_staff_available THEN
          -- For specific staff, also check booking conflicts
          IF p_staff_id IS NOT NULL THEN
            SELECT EXISTS (
              SELECT 1 FROM public.public_bookings pb
              WHERE pb.business_id = p_business_id
                AND pb.status NOT IN ('cancelled')
                AND pb.store_id = p_store_id
                AND pb.staff_id = p_staff_id
                AND pb.start_at < v_slot_end
                AND pb.end_at > v_slot_time
            ) INTO v_booking_conflict;

            IF NOT v_booking_conflict THEN
              SELECT EXISTS (
                SELECT 1 FROM public.appointments a
                WHERE a.business_id = p_business_id
                  AND COALESCE(a.is_deleted, FALSE) = FALSE
                  AND COALESCE(a.is_cancelled, FALSE) = FALSE
                  AND a.store_id = p_store_id
                  AND a.staff_id = p_staff_id
                  AND a.start_at < v_slot_end
                  AND a.end_at > v_slot_time
              ) INTO v_booking_conflict;
            END IF;

            IF v_booking_conflict THEN
              v_any_staff_available := FALSE;
            END IF;
          END IF;

          IF v_any_staff_available THEN
            v_slots := v_slots || jsonb_build_object(
              'slot_start', v_slot_time,
              'slot_end', v_slot_end
            );
          END IF;
        END IF;
      END IF;

      v_slot_time := v_slot_time + '30 minutes'::INTERVAL;
    END LOOP;

    -- Add day to result if it has available slots
    IF jsonb_array_length(v_slots) > 0 THEN
      RAISE NOTICE '% Date %: % slots generated', v_log_prefix, v_current_date, jsonb_array_length(v_slots);
      v_result := v_result || jsonb_build_object(
        'date', v_current_date,
        'day_of_week', v_day_of_week,
        'slots', v_slots
      );
    END IF;
  END LOOP;

  RAISE NOTICE '% Result: % days with available slots', v_log_prefix, jsonb_array_length(v_result);
  RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO authenticated;

-- ============================================
-- SUMMARY OF CHANGES
-- ============================================
-- 1. Added v_store_staff_ids array to fetch all staff assigned to the store
-- 2. When p_staff_id IS NULL ("Any Available"):
--    - For each slot, iterate through all store staff
--    - Check each staff's availability (special days, blackouts, weekly schedule)
--    - Check if slot time falls within staff's working hours
--    - Check for booking conflicts for each staff
--    - Only show slot if at least ONE staff is available
-- 3. When p_staff_id IS NOT NULL (specific staff selected):
--    - Behavior unchanged - check only that staff's schedule
--
-- This ensures:
-- Availability = Store Hours ∩ (Staff1 Schedule ∪ Staff2 Schedule ∪ ... ∪ StaffN Schedule)
