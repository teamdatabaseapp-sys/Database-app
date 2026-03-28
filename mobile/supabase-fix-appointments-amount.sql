-- Fix: Add missing 'amount' column to appointments table
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This fixes the error: "Could not find the 'amount' column of 'appointments' in the schema cache"

-- Add the amount column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'amount'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN amount NUMERIC NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added amount column to appointments table';
    ELSE
        RAISE NOTICE 'amount column already exists';
    END IF;
END $$;

-- Add the currency column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN currency TEXT DEFAULT 'USD';
        RAISE NOTICE 'Added currency column to appointments table';
    ELSE
        RAISE NOTICE 'currency column already exists';
    END IF;
END $$;

-- Add appointment_date column if it doesn't exist (required for booking flow)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'appointment_date'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN appointment_date TIMESTAMPTZ;
        -- Backfill from start_at for existing records
        UPDATE public.appointments SET appointment_date = start_at WHERE appointment_date IS NULL;
        RAISE NOTICE 'Added appointment_date column to appointments table';
    ELSE
        RAISE NOTICE 'appointment_date column already exists';
    END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'appointments'
AND column_name IN ('amount', 'currency', 'appointment_date')
ORDER BY column_name;
