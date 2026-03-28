-- ============================================
-- FIX: get_available_slots with Staff Schedule Support + Fallback
-- ============================================
-- This fixes the slot generation to:
-- 1. If staff_id is provided:
--    a. Check staff_special_days for date-specific overrides (highest priority)
--    b. Check staff_blackout_ranges for unavailability
--    c. Check staff_weekly_schedule for regular hours
--    d. If NO staff schedule exists, FALLBACK to store hours (treat staff as always available during store hours)
-- 2. If no staff_id: use store hours only
-- 3. Detailed logging for debugging which constraint eliminates slots
--
-- IMPORTANT: Run this migration in Supabase SQL Editor to deploy the fix
-- ============================================

-- Drop old function signatures to avoid conflicts
DROP FUNCTION IF EXISTS public.get_available_slots(UUID, UUID, UUID, UUID, DATE);
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
  v_timezone TEXT := 'America/New_York'; -- Default timezone
  v_now TIMESTAMPTZ;
  v_skip_reason TEXT;
  v_log_prefix TEXT;
BEGIN
  -- Log input parameters
  v_log_prefix := '[get_available_slots]';
  RAISE NOTICE '% Input: business_id=%, store_id=%, staff_id=%, service_duration=%, date=%, days_ahead=%',
    v_log_prefix, p_business_id, p_store_id, p_staff_id, p_service_duration, p_date, p_days_ahead;

  -- Get current time in the business timezone
  v_now := NOW() AT TIME ZONE v_timezone;

  -- Check if staff has ANY weekly schedule defined (to determine if we should fallback)
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
        v_has_store_override := TRUE;
        v_is_closed := v_override_record.is_closed;
        IF NOT v_is_closed THEN
          v_open_time := v_override_record.open_time;
          v_close_time := v_override_record.close_time;
          v_has_store_hours := TRUE;
        ELSE
          v_skip_reason := 'store_override_closed';
        END IF;
        RAISE NOTICE '% Date %: store_hours_override found - is_closed=%',
          v_log_prefix, v_current_date, v_is_closed;
      END IF;
    END IF;

    -- ========================================
    -- STEP 2: Check blackout_dates on store (if no override)
    -- ========================================
    IF NOT v_has_store_override AND p_store_id IS NOT NULL THEN
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
        RAISE NOTICE '% Date %: store blackout date', v_log_prefix, v_current_date;
      END IF;
    END IF;

    -- ========================================
    -- STEP 3: Get base store hours (if no override and not blackout)
    -- ========================================
    IF NOT v_has_store_override AND NOT v_is_blackout THEN
      -- First try store-specific hours
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
          v_has_store_hours := TRUE;
          v_is_closed := COALESCE(v_hours_record.is_closed, FALSE);
          IF NOT v_is_closed THEN
            v_open_time := v_hours_record.open_time;
            v_close_time := v_hours_record.close_time;
          ELSE
            v_skip_reason := 'store_weekly_closed';
          END IF;
        END IF;
      END IF;

      -- Fall back to business-wide hours
      IF NOT v_has_store_hours THEN
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
    -- STEP 4: Check staff schedule (if staff_id provided)
    -- This can NARROW the available window, but we fallback to store hours if no schedule
    -- ========================================
    IF p_staff_id IS NOT NULL AND NOT v_is_closed THEN
      -- 4a. Check staff_special_days for this specific date (highest priority for staff)
      SELECT
        ssd.is_off,
        ssd.start_time,
        ssd.end_time
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
          RAISE NOTICE '% Date %: staff special day - OFF', v_log_prefix, v_current_date;
        ELSE
          -- Staff has special hours for this day - use them
          v_has_staff_schedule := TRUE;
          -- Narrow the window to staff's special hours (intersect with store hours)
          IF v_staff_record.start_time IS NOT NULL AND v_staff_record.end_time IS NOT NULL THEN
            v_open_time := GREATEST(COALESCE(v_open_time, v_staff_record.start_time), v_staff_record.start_time);
            v_close_time := LEAST(COALESCE(v_close_time, v_staff_record.end_time), v_staff_record.end_time);
          END IF;
          RAISE NOTICE '% Date %: staff special hours % - %',
            v_log_prefix, v_current_date, v_staff_record.start_time, v_staff_record.end_time;
        END IF;
      END IF;

      -- 4b. Check staff_blackout_ranges (if not already off)
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
          RAISE NOTICE '% Date %: staff in blackout range', v_log_prefix, v_current_date;
        END IF;
      END IF;

      -- 4c. Check staff_weekly_schedule (if no special day found and not in blackout)
      IF NOT v_staff_is_off AND NOT v_has_staff_schedule THEN
        SELECT
          sws.is_off,
          sws.start_time,
          sws.end_time
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
            RAISE NOTICE '% Date %: staff weekly schedule - OFF', v_log_prefix, v_current_date;
          ELSE
            -- Narrow the window to staff's hours (intersect with store hours)
            IF v_staff_record.start_time IS NOT NULL AND v_staff_record.end_time IS NOT NULL THEN
              v_open_time := GREATEST(COALESCE(v_open_time, v_staff_record.start_time), v_staff_record.start_time);
              v_close_time := LEAST(COALESCE(v_close_time, v_staff_record.end_time), v_staff_record.end_time);
            END IF;
            RAISE NOTICE '% Date %: staff weekly hours % - %',
              v_log_prefix, v_current_date, v_staff_record.start_time, v_staff_record.end_time;
          END IF;
        ELSE
          -- NO staff schedule for this day
          -- FALLBACK: If staff has NO schedule AT ALL, treat them as available during store hours
          IF NOT v_staff_has_any_schedule THEN
            RAISE NOTICE '% Date %: NO staff schedule exists - using store hours as fallback',
              v_log_prefix, v_current_date;
            -- Keep store hours as-is (already set above)
          ELSE
            -- Staff has schedule for OTHER days but not this day - skip this day
            v_staff_is_off := TRUE;
            v_skip_reason := 'staff_no_schedule_this_day';
            RAISE NOTICE '% Date %: staff has schedule but not for this day (day_of_week=%)',
              v_log_prefix, v_current_date, v_day_of_week;
          END IF;
        END IF;
      END IF;
    END IF;

    -- ========================================
    -- Skip this day if:
    -- - Store is closed
    -- - Staff is off (when staff_id is specified)
    -- - No hours defined
    -- ========================================
    IF v_is_closed THEN
      RAISE NOTICE '% Date %: SKIPPED - %', v_log_prefix, v_current_date, COALESCE(v_skip_reason, 'store_closed');
      CONTINUE;
    END IF;

    IF v_staff_is_off THEN
      RAISE NOTICE '% Date %: SKIPPED - %', v_log_prefix, v_current_date, COALESCE(v_skip_reason, 'staff_off');
      CONTINUE;
    END IF;

    IF NOT v_has_store_hours AND NOT v_has_store_override THEN
      v_skip_reason := 'no_hours_defined';
      RAISE NOTICE '% Date %: SKIPPED - no store hours defined', v_log_prefix, v_current_date;
      CONTINUE;
    END IF;

    IF v_open_time IS NULL OR v_close_time IS NULL THEN
      v_skip_reason := 'null_open_close_times';
      RAISE NOTICE '% Date %: SKIPPED - open_time or close_time is NULL', v_log_prefix, v_current_date;
      CONTINUE;
    END IF;

    -- Check if service duration fits in the available window
    IF (v_close_time - v_open_time) < (p_service_duration || ' minutes')::INTERVAL THEN
      v_skip_reason := 'service_duration_too_long';
      RAISE NOTICE '% Date %: SKIPPED - service duration % mins exceeds available window % - %',
        v_log_prefix, v_current_date, p_service_duration, v_open_time, v_close_time;
      CONTINUE;
    END IF;

    RAISE NOTICE '% Date %: AVAILABLE window % - %', v_log_prefix, v_current_date, v_open_time, v_close_time;

    -- ========================================
    -- Generate time slots for this day
    -- ========================================
    v_slots := '[]'::jsonb;
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
              AND COALESCE(a.is_cancelled, FALSE) = FALSE
              AND (p_store_id IS NULL OR a.store_id = p_store_id)
              AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
              AND a.start_at < v_slot_end
              AND a.end_at > v_slot_time
          ) INTO v_booking_conflict;
        END IF;

        IF NOT v_booking_conflict THEN
          v_slots := v_slots || jsonb_build_object(
            'slot_start', v_slot_time,
            'slot_end', v_slot_end
          );
        END IF;
      END IF;

      -- Move to next slot (30 min intervals)
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
    ELSE
      RAISE NOTICE '% Date %: 0 slots (all past or conflicts)', v_log_prefix, v_current_date;
    END IF;
  END LOOP;

  RAISE NOTICE '% Result: % days with available slots', v_log_prefix, jsonb_array_length(v_result);
  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO authenticated;

-- ============================================
-- Also create tables if they don't exist
-- ============================================

-- Staff Weekly Schedule table
CREATE TABLE IF NOT EXISTS public.staff_weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_off BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week)
);

-- Staff Special Days table
CREATE TABLE IF NOT EXISTS public.staff_special_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_off BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Staff Blackout Ranges table
CREATE TABLE IF NOT EXISTS public.staff_blackout_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for staff schedule tables
ALTER TABLE public.staff_weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_special_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_blackout_ranges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Staff weekly schedule read" ON public.staff_weekly_schedule;
DROP POLICY IF EXISTS "Staff weekly schedule write" ON public.staff_weekly_schedule;
DROP POLICY IF EXISTS "Staff weekly schedule anon read" ON public.staff_weekly_schedule;
DROP POLICY IF EXISTS "Staff special days read" ON public.staff_special_days;
DROP POLICY IF EXISTS "Staff special days write" ON public.staff_special_days;
DROP POLICY IF EXISTS "Staff special days anon read" ON public.staff_special_days;
DROP POLICY IF EXISTS "Staff blackout ranges read" ON public.staff_blackout_ranges;
DROP POLICY IF EXISTS "Staff blackout ranges write" ON public.staff_blackout_ranges;
DROP POLICY IF EXISTS "Staff blackout ranges anon read" ON public.staff_blackout_ranges;

-- Authenticated users can read/write their business's staff schedules
CREATE POLICY "Staff weekly schedule read" ON public.staff_weekly_schedule
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Staff weekly schedule write" ON public.staff_weekly_schedule
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- Anon users can read for public booking
CREATE POLICY "Staff weekly schedule anon read" ON public.staff_weekly_schedule
  FOR SELECT TO anon USING (TRUE);

CREATE POLICY "Staff special days read" ON public.staff_special_days
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Staff special days write" ON public.staff_special_days
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Staff special days anon read" ON public.staff_special_days
  FOR SELECT TO anon USING (TRUE);

CREATE POLICY "Staff blackout ranges read" ON public.staff_blackout_ranges
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Staff blackout ranges write" ON public.staff_blackout_ranges
  FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Staff blackout ranges anon read" ON public.staff_blackout_ranges
  FOR SELECT TO anon USING (TRUE);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_weekly_schedule_staff ON public.staff_weekly_schedule(staff_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_staff_weekly_schedule_business ON public.staff_weekly_schedule(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_special_days_staff ON public.staff_special_days(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_special_days_business ON public.staff_special_days(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_blackout_ranges_staff ON public.staff_blackout_ranges(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_blackout_ranges_business ON public.staff_blackout_ranges(business_id);

-- ============================================
-- Verification queries (run manually to test)
-- ============================================
-- Test with staff who has NO schedule (should fallback to store hours):
-- SELECT get_available_slots('business-uuid', 'store-uuid', 'staff-uuid', 60, CURRENT_DATE, 7);

-- Check if staff has any schedule:
-- SELECT * FROM staff_weekly_schedule WHERE staff_id = 'staff-uuid';

-- Check store hours:
-- SELECT * FROM business_hours WHERE business_id = 'business-uuid' ORDER BY store_id, day_of_week;
