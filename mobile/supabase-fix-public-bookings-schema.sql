-- ============================================
-- FIX: Add missing columns to public_bookings table
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add service_id column with foreign key
ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- Add customer information columns
ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '';

ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';

ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Add duration column
ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;

-- Add confirmation code (unique identifier for customers)
ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS confirmation_code TEXT UNIQUE DEFAULT UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));

-- Add locale tracking
ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS booked_locale TEXT DEFAULT 'en';

-- Add timestamps
ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE public.public_bookings
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Update status check constraint to include all valid statuses
ALTER TABLE public.public_bookings
DROP CONSTRAINT IF EXISTS public_bookings_status_check;

ALTER TABLE public.public_bookings
ADD CONSTRAINT public_bookings_status_check
CHECK (status IN ('pending', 'confirmed', 'booked', 'cancelled', 'completed', 'no_show'));

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_public_bookings_service_id ON public.public_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_public_bookings_confirmation_code ON public.public_bookings(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_public_bookings_customer_email ON public.public_bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_public_bookings_created_at ON public.public_bookings(created_at);

-- Remove the NOT NULL DEFAULT '' constraints once existing rows are updated
-- (run these after confirming the columns exist)
-- ALTER TABLE public.public_bookings ALTER COLUMN customer_name DROP DEFAULT;
-- ALTER TABLE public.public_bookings ALTER COLUMN customer_email DROP DEFAULT;

-- ============================================
-- VERIFY: Run this to confirm the fix worked
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'public_bookings'
-- ORDER BY ordinal_position;

-- ============================================
-- EXPECTED COLUMNS AFTER FIX:
-- ============================================
-- id                UUID (PK)
-- business_id       UUID (FK to businesses)
-- store_id          UUID (FK to stores)
-- staff_id          UUID (FK to staff)
-- service_id        UUID (FK to services)
-- customer_name     TEXT
-- customer_email    TEXT
-- customer_phone    TEXT
-- customer_notes    TEXT
-- start_at          TIMESTAMPTZ
-- end_at            TIMESTAMPTZ
-- duration_minutes  INTEGER
-- status            TEXT (pending/confirmed/booked/cancelled/completed/no_show)
-- confirmation_code TEXT (unique)
-- booked_locale     TEXT
-- created_at        TIMESTAMPTZ
-- updated_at        TIMESTAMPTZ
-- confirmed_at      TIMESTAMPTZ
-- cancelled_at      TIMESTAMPTZ
-- ============================================
