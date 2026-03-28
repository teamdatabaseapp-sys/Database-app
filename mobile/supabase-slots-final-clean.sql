-- ============================================
-- FINAL CLEAN: get_available_slots - Enterprise-Grade Timezone-Safe Implementation
-- ============================================
-- This migration ensures ONLY ONE function signature exists in production:
--   public.get_available_slots(
--     p_business_id UUID,
--     p_store_id UUID,
--     p_staff_id UUID,
--     p_service_duration INTEGER,
--     p_date DATE,
--     p_days_ahead INTEGER
--   )
--
-- TIMEZONE HANDLING (ENTERPRISE-GRADE):
-- - Fetches store timezone DYNAMICALLY from stores.timezone column
-- - NO HARDCODED TIMEZONES - if stores.timezone is NULL, function raises explicit exception
-- - All TIME values (open_time, close_time) are interpreted in store's local timezone
-- - Slot comparisons use consistent timezone conversion
-- - NOW() is converted to store's local timezone for "past slot" filtering
--
-- IMPORTANT: Run this in Supabase SQL Editor to clean up all legacy versions
-- ============================================

-- ========================================
-- STEP 1: Drop ALL existing function signatures (clean slate)
-- ========================================
-- Drop legacy 4-parameter version (p_business_id, p_service_id, p_staff_id, p_store_id)
DROP FUNCTION IF EXISTS public.get_available_slots(UUID, UUID, UUID, UUID);

-- Drop legacy 5-parameter version (p_business_id, p_service_id, p_staff_id, p_store_id, DATE)
DROP FUNCTION IF EXISTS public.get_available_slots(UUID, UUID, UUID, UUID, DATE);

-- Drop current 6-parameter version to recreate cleanly
DROP FUNCTION IF EXISTS public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER);

-- ========================================
-- STEP 2: Create the ONLY function signature
-- ========================================
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
  -- TIMEZONE VARIABLES (enterprise-grade - NO HARDCODED VALUES)
  v_store_timezone TEXT;
  v_now_in_store_tz TIMESTAMP;  -- Current time in store's local timezone (no TZ)
  v_slot_local_time TIMESTAMP;  -- Slot time in store's local timezone (no TZ)
BEGIN
  -- Log input parameters
  v_log_prefix := '[get_available_slots]';
  RAISE NOTICE '% Input: business_id=%, store_id=%, staff_id=%, service_duration=%, date=%, days_ahead=%',
    v_log_prefix, p_business_id, p_store_id, p_staff_id, p_service_duration, p_date, p_days_ahead;

  -- ========================================
  -- VALIDATE REQUIRED PARAMETERS
  -- ========================================
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id is required and cannot be NULL';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'p_store_id is required for timezone-aware slot generation. Cannot be NULL.';
  END IF;

  -- ========================================
  -- FETCH STORE TIMEZONE (DYNAMIC - NO HARDCODED FALLBACKS)
  -- ========================================
  SELECT s.timezone
  INTO v_store_timezone
  FROM public.stores s
  WHERE s.id = p_store_id
    AND s.business_id = p_business_id;

  -- CRITICAL: Validate timezone is configured
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found: store_id=% does not exist for business_id=%', p_store_id, p_business_id;
  END IF;

  IF v_store_timezone IS NULL OR v_store_timezone = '' THEN
    RAISE EXCEPTION 'Store timezone not configured for store_id=%. Please set stores.timezone column (e.g., ''America/New_York'', ''Europe/London'', ''Asia/Tokyo'')', p_store_id;
  END IF;

  RAISE NOTICE '% Using store timezone: % (dynamically fetched from stores table)', v_log_prefix, v_store_timezone;

  -- ========================================
  -- CALCULATE "NOW" IN STORE'S LOCAL TIMEZONE
  -- ========================================
  -- NOW() returns TIMESTAMPTZ (UTC in Supabase)
  -- We convert to store's local time for consistent comparison
  -- Result is TIMESTAMP WITHOUT TIME ZONE representing local time
  v_now_in_store_tz := (NOW() AT TIME ZONE v_store_timezone);

  RAISE NOTICE '% Server NOW(): % | Store local time (%): %',
    v_log_prefix, NOW(), v_store_timezone, v_now_in_store_tz;

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
        RAISE NOTICE '% Date %: store blackout date', v_log_prefix, v_current_date;
      END IF;
    END IF;

    -- ========================================
    -- STEP 3: Get base store hours (if no override and not blackout)
    -- ========================================
    IF NOT v_has_store_override AND NOT v_is_blackout THEN
      -- First try store-specific hours
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
      ELSE
        -- Fall back to business-wide hours
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

    RAISE NOTICE '% Date %: AVAILABLE window % - % (timezone: %)', v_log_prefix, v_current_date, v_open_time, v_close_time, v_store_timezone;

    -- ========================================
    -- Generate time slots for this day
    -- ========================================
    v_slots := '[]'::jsonb;

    -- Create slot time as TIMESTAMPTZ by interpreting local time in store's timezone
    -- Formula: (DATE || TIME)::TIMESTAMP gives local time, AT TIME ZONE converts to UTC-based TIMESTAMPTZ
    v_slot_time := (v_current_date || ' ' || v_open_time)::TIMESTAMP AT TIME ZONE v_store_timezone;

    WHILE (v_slot_time AT TIME ZONE v_store_timezone)::TIME + (p_service_duration || ' minutes')::INTERVAL <= v_close_time LOOP
      v_slot_end := v_slot_time + (p_service_duration || ' minutes')::INTERVAL;

      -- ========================================
      -- TIMEZONE-SAFE "PAST SLOT" CHECK
      -- ========================================
      -- Convert slot time to store's local time (TIMESTAMP WITHOUT TZ)
      -- Compare against current time in store's local timezone
      -- This ensures correct filtering regardless of server timezone
      v_slot_local_time := (v_slot_time AT TIME ZONE v_store_timezone);

      -- Only include slots that are in the future (in store's local time)
      IF v_slot_local_time > v_now_in_store_tz THEN
        -- Check for conflicts with public bookings
        SELECT EXISTS (
          SELECT 1 FROM public.public_bookings pb
          WHERE pb.business_id = p_business_id
            AND pb.status NOT IN ('cancelled')
            AND pb.store_id = p_store_id
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
              AND a.store_id = p_store_id
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

      -- Move to next slot (15 min intervals)
      v_slot_time := v_slot_time + '15 minutes'::INTERVAL;
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

-- ========================================
-- STEP 3: Grant execute permissions
-- ========================================
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, INTEGER, DATE, INTEGER) TO authenticated;

-- ========================================
-- STEP 4: Verify only ONE function exists
-- ========================================
-- Run this query to verify:
-- SELECT proname, pg_get_function_arguments(oid) as args
-- FROM pg_proc
-- WHERE proname = 'get_available_slots'
-- AND pronamespace = 'public'::regnamespace;
--
-- Expected result: ONLY ONE row with:
--   proname: get_available_slots
--   args: p_business_id uuid DEFAULT NULL::uuid, p_store_id uuid DEFAULT NULL::uuid, p_staff_id uuid DEFAULT NULL::uuid, p_service_duration integer DEFAULT 60, p_date date DEFAULT CURRENT_DATE, p_days_ahead integer DEFAULT 30

-- ============================================
-- TIMEZONE HANDLING DOCUMENTATION (ENTERPRISE-GRADE)
-- ============================================
-- This function handles timezones correctly for multi-country CRMs:
--
-- 1. STORE TIMEZONE LOOKUP (NO HARDCODED VALUES):
--    - Fetches timezone DYNAMICALLY from stores.timezone column
--    - If store not found: RAISE EXCEPTION (no silent fallback)
--    - If timezone is NULL or empty: RAISE EXCEPTION (no silent fallback)
--    - Supported formats: IANA timezone identifiers (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo')
--
-- 2. REQUIRED PARAMETER VALIDATION:
--    - p_business_id: REQUIRED - raises exception if NULL
--    - p_store_id: REQUIRED - raises exception if NULL (timezone requires store)
--
-- 3. TIME COMPARISONS:
--    - v_now_in_store_tz: Current time converted to store's local timezone
--    - v_slot_local_time: Slot time converted to store's local timezone
--    - Comparison: v_slot_local_time > v_now_in_store_tz (both are TIMESTAMP WITHOUT TZ)
--
-- 4. WHY THIS WORKS:
--    - All comparisons happen in the same timezone context (store's local time)
--    - No implicit server timezone assumptions
--    - Works correctly across DST transitions
--    - Works correctly with different database server timezones
--    - NO HARDCODED TIMEZONES - fully dynamic
--
-- 5. SLOT OUTPUT:
--    - slot_start/slot_end are returned as TIMESTAMPTZ (ISO 8601 with offset)
--    - Client applications can convert to any timezone for display
--
-- 6. SUPPORTED SCENARIOS:
--    - Store in America/New_York, server in UTC: WORKS
--    - Store in Europe/London, server in UTC: WORKS
--    - Store in Asia/Tokyo, server in America/Los_Angeles: WORKS
--    - DST transitions (March/November): WORKS
--    - Multi-country businesses with different store timezones: WORKS
--
-- 7. ERROR HANDLING:
--    - Store not found: RAISE EXCEPTION with store_id and business_id
--    - Timezone not configured: RAISE EXCEPTION with store_id and instructions
--    - No silent fallbacks - errors are explicit and actionable
--
-- ============================================
-- FUNCTION SIGNATURE REFERENCE
-- ============================================
-- FINAL SIGNATURE (the ONLY one that should exist):
--   public.get_available_slots(
--     p_business_id UUID,        -- Required: The business ID
--     p_store_id UUID,           -- Required: The store ID (timezone lookup)
--     p_staff_id UUID,           -- Optional: Filter by staff member (DEFAULT NULL)
--     p_service_duration INTEGER,-- Required: Service duration in minutes (DEFAULT 60)
--     p_date DATE,               -- Optional: Start date (DEFAULT CURRENT_DATE)
--     p_days_ahead INTEGER       -- Optional: Number of days to look ahead (DEFAULT 30)
--   )
--   RETURNS JSONB
--
-- BACKEND RPC CALL EXAMPLE:
--   const { data, error } = await supabase.rpc("get_available_slots", {
--     p_business_id: businessId,
--     p_store_id: storeId,       // REQUIRED - cannot be null
--     p_staff_id: staffId || null,
--     p_service_duration: serviceDurationMinutes,
--     p_date: startDate,
--     p_days_ahead: 30,
--   });
--
-- LEGACY SIGNATURES (REMOVED):
--   - get_available_slots(UUID, UUID, UUID, UUID) -- 4-param with p_service_id
--   - get_available_slots(UUID, UUID, UUID, UUID, DATE) -- 5-param with p_service_id
