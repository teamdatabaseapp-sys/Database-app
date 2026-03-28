-- ============================================
-- FIX: get_available_slots with Proper Store Hours Logic
-- ============================================
-- This fixes the slot generation to:
-- 1. Use actual store hours without 9:00 AM fallback
-- 2. Properly prioritize overrides over regular hours
-- 3. Skip days with no hours defined (instead of defaulting)
-- Priority: store_hours_overrides > blackout_dates > business_hours (for that store/day)
-- ============================================

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
  v_has_override BOOLEAN;
  v_has_hours BOOLEAN;
  v_is_blackout BOOLEAN;
  v_timezone TEXT := 'America/New_York'; -- Default timezone
  v_now TIMESTAMPTZ;
BEGIN
  -- Get current time in the business timezone
  v_now := NOW() AT TIME ZONE v_timezone;

  -- Loop through dates
  FOR i IN 0..p_days_ahead LOOP
    v_current_date := p_date + i;
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INTEGER;
    v_has_override := FALSE;
    v_has_hours := FALSE;
    v_is_blackout := FALSE;
    v_is_closed := FALSE;
    v_open_time := NULL;
    v_close_time := NULL;

    -- ========================================
    -- STEP 1: Check for store_hours_overrides (highest priority)
    -- ========================================
    IF p_store_id IS NOT NULL THEN
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
        v_has_override := TRUE;
        v_is_closed := v_override_record.is_closed;
        -- Only use override times if not closed
        IF NOT v_is_closed THEN
          v_open_time := v_override_record.open_time;
          v_close_time := v_override_record.close_time;
          v_has_hours := TRUE;
        END IF;
      END IF;
    END IF;

    -- ========================================
    -- STEP 2: Check blackout_dates (if no override)
    -- ========================================
    IF NOT v_has_override AND p_store_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = p_store_id
          AND s.business_id = p_business_id
          AND s.blackout_dates IS NOT NULL
          AND to_char(v_current_date, 'YYYY-MM-DD') = ANY(s.blackout_dates)
      ) INTO v_is_blackout;

      IF v_is_blackout THEN
        v_is_closed := TRUE;
      END IF;
    END IF;

    -- ========================================
    -- STEP 3: Use regular business_hours (if no override and not blackout)
    -- Priority: store-specific hours > business-wide hours
    -- NO DEFAULT FALLBACK - if no hours exist, skip the day
    -- ========================================
    IF NOT v_has_override AND NOT v_is_blackout THEN
      -- First try to get store-specific hours for this day
      IF p_store_id IS NOT NULL THEN
        SELECT
          bh.open_time,
          bh.close_time,
          bh.is_closed
        INTO v_hours_record
        FROM public.business_hours bh
        WHERE bh.business_id = p_business_id
          AND bh.store_id = p_store_id
          AND bh.day_of_week = v_day_of_week
        LIMIT 1;

        IF FOUND THEN
          v_has_hours := TRUE;
          v_is_closed := COALESCE(v_hours_record.is_closed, FALSE);
          IF NOT v_is_closed THEN
            v_open_time := v_hours_record.open_time;
            v_close_time := v_hours_record.close_time;
          END IF;
        END IF;
      END IF;

      -- If no store-specific hours, try business-wide hours (store_id IS NULL)
      IF NOT v_has_hours THEN
        SELECT
          bh.open_time,
          bh.close_time,
          bh.is_closed
        INTO v_hours_record
        FROM public.business_hours bh
        WHERE bh.business_id = p_business_id
          AND bh.store_id IS NULL
          AND bh.day_of_week = v_day_of_week
        LIMIT 1;

        IF FOUND THEN
          v_has_hours := TRUE;
          v_is_closed := COALESCE(v_hours_record.is_closed, FALSE);
          IF NOT v_is_closed THEN
            v_open_time := v_hours_record.open_time;
            v_close_time := v_hours_record.close_time;
          END IF;
        END IF;
      END IF;
    END IF;

    -- ========================================
    -- Skip this day if:
    -- - Closed (by override, blackout, or regular hours)
    -- - No hours defined at all
    -- - Open/close times are NULL
    -- ========================================
    IF v_is_closed THEN
      CONTINUE;
    END IF;

    IF NOT v_has_hours OR v_open_time IS NULL OR v_close_time IS NULL THEN
      -- No hours defined for this day - skip it entirely
      -- DO NOT default to 9:00 AM - 5:00 PM
      CONTINUE;
    END IF;

    -- ========================================
    -- Generate time slots for this day
    -- ========================================
    v_slots := '[]'::jsonb;
    -- Create slot time in the business timezone
    v_slot_time := (v_current_date || ' ' || v_open_time)::TIMESTAMP AT TIME ZONE v_timezone;

    WHILE (v_slot_time AT TIME ZONE v_timezone)::TIME + (p_service_duration || ' minutes')::INTERVAL <= v_close_time LOOP
      v_slot_end := v_slot_time + (p_service_duration || ' minutes')::INTERVAL;

      -- Skip slots in the past (compare TIMESTAMPTZ directly)
      IF v_slot_time > NOW() THEN
        -- Check for conflicts with public bookings
        SELECT EXISTS (
          SELECT 1 FROM public.public_bookings pb
          WHERE pb.business_id = p_business_id
            AND pb.status NOT IN ('cancelled')
            AND (p_store_id IS NULL OR pb.store_id = p_store_id)
            AND (p_staff_id IS NULL OR pb.staff_id = p_staff_id)
            AND pb.start_at < v_slot_end
            AND pb.end_at > v_slot_time
        ) INTO v_booking_conflict;

        -- Also check internal appointments table
        IF NOT v_booking_conflict THEN
          SELECT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.business_id = p_business_id
              AND COALESCE(a.is_deleted, FALSE) = FALSE
              AND (p_store_id IS NULL OR a.store_id = p_store_id)
              AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
              AND a.start_at < v_slot_end
              AND a.end_at > v_slot_time
          ) INTO v_booking_conflict;
        END IF;

        IF NOT v_booking_conflict THEN
          v_slots := v_slots || jsonb_build_object(
            'start', v_slot_time,
            'end', v_slot_end
          );
        END IF;
      END IF;

      -- Move to next slot (30 min intervals)
      v_slot_time := v_slot_time + '30 minutes'::INTERVAL;
    END LOOP;

    -- Add day to result if it has available slots
    IF jsonb_array_length(v_slots) > 0 THEN
      v_result := v_result || jsonb_build_object(
        'date', v_current_date,
        'day_of_week', v_day_of_week,
        'slots', v_slots
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO authenticated;

-- ============================================
-- Verification queries
-- ============================================
-- Test the function with a specific store:
-- SELECT get_available_slots('your-business-uuid', 'your-store-uuid', NULL, 60, CURRENT_DATE, 7);
--
-- Check business_hours for a store:
-- SELECT * FROM business_hours WHERE store_id = 'your-store-uuid' ORDER BY day_of_week;
--
-- Check store_hours_overrides:
-- SELECT * FROM store_hours_overrides WHERE store_id = 'your-store-uuid' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE;
