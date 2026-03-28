-- ============================================
-- SUPABASE MIGRATION - Required Tables
-- ============================================
-- Run this SQL in your Supabase SQL Editor to create all required tables
-- Go to: https://app.supabase.com → Your Project → SQL Editor → New Query

-- ============================================
-- 1. STORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access stores for businesses they own
CREATE POLICY "Users can view own business stores" ON public.stores
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business stores" ON public.stores
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business stores" ON public.stores
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business stores" ON public.stores
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_stores_business_id ON public.stores(business_id);


-- ============================================
-- 2. STAFF_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  color TEXT DEFAULT '#0D9488',
  is_archived BOOLEAN DEFAULT false,
  store_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access staff for businesses they own
CREATE POLICY "Users can view own business staff" ON public.staff_members
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business staff" ON public.staff_members
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business staff" ON public.staff_members
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business staff" ON public.staff_members
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_members_business_id ON public.staff_members(business_id);


-- ============================================
-- 3. APPOINTMENTS TABLE (with correct columns)
-- ============================================
-- Drop existing appointments table if it has wrong columns
-- WARNING: This will delete existing appointment data!
-- Comment out if you want to preserve data and manually add columns instead
-- DROP TABLE IF EXISTS public.appointments;

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  title TEXT,
  notes TEXT,
  amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  service_tags TEXT[],
  promo_id UUID,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access appointments for businesses they own
CREATE POLICY "Users can view own business appointments" ON public.appointments
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business appointments" ON public.appointments
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business appointments" ON public.appointments
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business appointments" ON public.appointments
  FOR DELETE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON public.appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_store_id ON public.appointments(store_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON public.appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON public.appointments(start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_is_deleted ON public.appointments(is_deleted);


-- ============================================
-- 4. UPDATE CLIENTS TABLE (if store_id column is missing)
-- ============================================
-- Add store_id column to clients table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'clients'
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_clients_store_id ON public.clients(store_id);
  END IF;
END $$;


-- ============================================
-- 5. VERIFY TABLES WERE CREATED
-- ============================================
-- Run this to verify all tables exist:
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('businesses', 'clients', 'stores', 'staff_members', 'appointments');


-- ============================================
-- 6. ADD SERVICE DESCRIPTION COLUMN
-- ============================================
-- Add description column to services table for service details
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description TEXT;


-- ============================================
-- 7. ADD STORE PHOTO COLUMNS
-- ============================================
-- Add photo columns to stores table for store photos
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS photo_thumb_url TEXT;
