-- ============================================
-- SUPABASE SETUP SQL
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Create profiles table
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  email TEXT,
  membership_plan TEXT DEFAULT 'monthly',
  membership_status TEXT DEFAULT 'trial',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- STEP 2: Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create RLS Policies
-- ============================================

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile (needed for trigger)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 4: Create trigger function
-- Auto-creates profile when user signs up
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, membership_status)
  VALUES (
    NEW.id,
    NEW.email,
    'trial'
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- STEP 5: Create trigger on auth.users
-- ============================================

-- Drop existing trigger if it exists (for re-running)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 6: Grant necessary permissions
-- ============================================

-- Allow authenticated users to access profiles table
GRANT SELECT, UPDATE, INSERT ON public.profiles TO authenticated;

-- ============================================
-- STEP 7: Create businesses table
-- ============================================

CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_owner UNIQUE (owner_id)
);

-- ============================================
-- STEP 8: Enable RLS on businesses
-- ============================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 9: Create businesses RLS Policies
-- ============================================

-- Policy: Users can read their own business
CREATE POLICY "Users can read own business"
  ON public.businesses
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Policy: Users can update their own business
CREATE POLICY "Users can update own business"
  ON public.businesses
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can insert their own business
CREATE POLICY "Users can insert own business"
  ON public.businesses
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can delete their own business
CREATE POLICY "Users can delete own business"
  ON public.businesses
  FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- STEP 10: Grant permissions for businesses
-- ============================================

GRANT SELECT, UPDATE, INSERT, DELETE ON public.businesses TO authenticated;

-- ============================================
-- STEP 11: Create clients table
-- ============================================

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  visits_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_clients_business_id ON public.clients(business_id);

-- ============================================
-- STEP 12: Enable RLS on clients
-- ============================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 13: Create clients RLS Policies
-- Users can only access clients belonging to their business
-- ============================================

-- Policy: Users can SELECT clients only if they belong to a business they own
CREATE POLICY "Users can read own business clients"
  ON public.clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = clients.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can INSERT clients only if business_id belongs to them
CREATE POLICY "Users can insert own business clients"
  ON public.clients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = clients.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can UPDATE clients only if they belong to their business
CREATE POLICY "Users can update own business clients"
  ON public.clients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = clients.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = clients.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Policy: Users can DELETE clients only if they belong to their business
CREATE POLICY "Users can delete own business clients"
  ON public.clients
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = clients.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- ============================================
-- STEP 14: Grant permissions for clients
-- ============================================

GRANT SELECT, UPDATE, INSERT, DELETE ON public.clients TO authenticated;

-- ============================================
-- VERIFICATION QUERIES (Optional - run to test)
-- ============================================

-- Check if table exists
-- SELECT * FROM public.profiles LIMIT 5;

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- Check policies exist
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- ============================================
-- STEP 15: Create stores table
-- ============================================

CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_stores_business_id ON public.stores(business_id);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stores
CREATE POLICY "Users can read own business stores"
  ON public.stores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = stores.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business stores"
  ON public.stores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = stores.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business stores"
  ON public.stores
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = stores.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = stores.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business stores"
  ON public.stores
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = stores.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, UPDATE, INSERT, DELETE ON public.stores TO authenticated;

-- ============================================
-- STEP 16: Create staff_members table
-- ============================================

CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  color TEXT DEFAULT '#6366f1',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_members_business_id ON public.staff_members(business_id);

-- Enable RLS
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_members
CREATE POLICY "Users can read own business staff"
  ON public.staff_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_members.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business staff"
  ON public.staff_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_members.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business staff"
  ON public.staff_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_members.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_members.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business staff"
  ON public.staff_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_members.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, UPDATE, INSERT, DELETE ON public.staff_members TO authenticated;

-- ============================================
-- STEP 17: Create staff_store_assignments table (many-to-many)
-- ============================================

CREATE TABLE IF NOT EXISTS public.staff_store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(staff_id, store_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_store_assignments_business_id ON public.staff_store_assignments(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_store_assignments_store_id ON public.staff_store_assignments(business_id, store_id);
CREATE INDEX IF NOT EXISTS idx_staff_store_assignments_staff_id ON public.staff_store_assignments(business_id, staff_id);

-- Enable RLS
ALTER TABLE public.staff_store_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_store_assignments
CREATE POLICY "Users can read own business staff assignments"
  ON public.staff_store_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_store_assignments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business staff assignments"
  ON public.staff_store_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_store_assignments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business staff assignments"
  ON public.staff_store_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_store_assignments.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_store_assignments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business staff assignments"
  ON public.staff_store_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = staff_store_assignments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, UPDATE, INSERT, DELETE ON public.staff_store_assignments TO authenticated;

-- ============================================
-- STEP 18: Create appointments table
-- ============================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  title TEXT,
  notes TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  promo_id UUID,
  service_tags TEXT[],
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_appointments_business_id_start ON public.appointments(business_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_business_store_start ON public.appointments(business_id, store_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_business_staff_start ON public.appointments(business_id, staff_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointments
CREATE POLICY "Users can read own business appointments"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business appointments"
  ON public.appointments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointments.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business appointments"
  ON public.appointments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointments.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, UPDATE, INSERT, DELETE ON public.appointments TO authenticated;

-- ============================================
-- STEP 19: Create trigger for auto-updating updated_at on appointments
-- ============================================

CREATE OR REPLACE FUNCTION public.update_appointments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (for re-running)
DROP TRIGGER IF EXISTS appointments_updated_at_trigger ON public.appointments;

-- Create the trigger
CREATE TRIGGER appointments_updated_at_trigger
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_appointments_updated_at();

-- ============================================
-- STEP 19b: Add recurring appointment columns to appointments
-- ============================================

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.appointment_series(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS series_occurrence_index INT;

CREATE INDEX IF NOT EXISTS idx_appointments_series_id ON public.appointments(series_id);

-- ============================================
-- STEP 19c: Create appointment_series table for recurring appointments
-- ============================================

CREATE TABLE IF NOT EXISTS public.appointment_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_ids TEXT[] NOT NULL DEFAULT '{}',
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('weekly', 'biweekly', 'monthly', 'custom')),
  interval_value INT NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_type TEXT NOT NULL CHECK (end_type IN ('until_date', 'occurrence_count')),
  end_date DATE,
  occurrence_count INT,
  start_time TIME NOT NULL,
  duration_minutes INT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  timezone TEXT DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_appointment_series_business_id ON public.appointment_series(business_id);
CREATE INDEX IF NOT EXISTS idx_appointment_series_client_id ON public.appointment_series(client_id);
CREATE INDEX IF NOT EXISTS idx_appointment_series_store_id ON public.appointment_series(store_id);
CREATE INDEX IF NOT EXISTS idx_appointment_series_status ON public.appointment_series(status);

-- Enable RLS
ALTER TABLE public.appointment_series ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointment_series
CREATE POLICY "Users can read own business appointment series"
  ON public.appointment_series
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointment_series.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business appointment series"
  ON public.appointment_series
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointment_series.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business appointment series"
  ON public.appointment_series
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointment_series.business_id
      AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointment_series.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business appointment series"
  ON public.appointment_series
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = appointment_series.business_id
      AND businesses.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, UPDATE, INSERT, DELETE ON public.appointment_series TO authenticated;

-- Create trigger for auto-updating updated_at on appointment_series
CREATE OR REPLACE FUNCTION public.update_appointment_series_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointment_series_updated_at_trigger ON public.appointment_series;

CREATE TRIGGER appointment_series_updated_at_trigger
  BEFORE UPDATE ON public.appointment_series
  FOR EACH ROW
  EXECUTE FUNCTION public.update_appointment_series_updated_at();

-- ============================================
-- STEP 20: Create trigger for auto-setting deleted_at on soft delete
-- ============================================

CREATE OR REPLACE FUNCTION public.set_deleted_at_on_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_deleted = TRUE AND OLD.is_deleted = FALSE THEN
    NEW.deleted_at = NOW();
  ELSIF NEW.is_deleted = FALSE AND OLD.is_deleted = TRUE THEN
    NEW.deleted_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (for re-running)
DROP TRIGGER IF EXISTS appointments_soft_delete_trigger ON public.appointments;

-- Create the trigger for appointments soft delete
CREATE TRIGGER appointments_soft_delete_trigger
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deleted_at_on_soft_delete();

-- ============================================
-- STEP 21: Create trigger for auto-setting cancelled_at
-- ============================================

CREATE OR REPLACE FUNCTION public.set_cancelled_at_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_cancelled = TRUE AND OLD.is_cancelled = FALSE THEN
    NEW.cancelled_at = NOW();
  ELSIF NEW.is_cancelled = FALSE AND OLD.is_cancelled = TRUE THEN
    NEW.cancelled_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (for re-running)
DROP TRIGGER IF EXISTS appointments_cancelled_trigger ON public.appointments;

-- Create the trigger for appointments cancellation
CREATE TRIGGER appointments_cancelled_trigger
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cancelled_at_on_cancel();

-- ============================================
-- STEP 22: Create trigger to auto-assign owner_id on business insert
-- ============================================

CREATE OR REPLACE FUNCTION public.set_business_owner_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists (for re-running)
DROP TRIGGER IF EXISTS set_business_owner_id_trigger ON public.businesses;

-- Create the trigger
CREATE TRIGGER set_business_owner_id_trigger
  BEFORE INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_business_owner_id();

-- ============================================
-- STEP 23: Additional useful indexes
-- ============================================

-- Index for filtering active appointments (not deleted, not cancelled)
CREATE INDEX IF NOT EXISTS idx_appointments_active
  ON public.appointments(business_id, start_at)
  WHERE is_deleted = FALSE AND is_cancelled = FALSE;

-- Index for client search by name
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);

-- Index for staff search by name
CREATE INDEX IF NOT EXISTS idx_staff_members_full_name ON public.staff_members(full_name);

-- Index for stores search by name
CREATE INDEX IF NOT EXISTS idx_stores_name ON public.stores(name);

-- Index for filtering non-archived stores
CREATE INDEX IF NOT EXISTS idx_stores_active
  ON public.stores(business_id)
  WHERE is_archived = FALSE;

-- Index for filtering non-archived staff
CREATE INDEX IF NOT EXISTS idx_staff_members_active
  ON public.staff_members(business_id)
  WHERE is_archived = FALSE;

-- ============================================
-- SETUP COMPLETE - SUMMARY
-- ============================================
--
-- Tables created:
--   1. profiles (auto-created on user signup, linked to auth.users)
--   2. businesses (with owner_id FK to auth.users)
--   3. clients (with business_id FK)
--   4. stores (with business_id FK, supports archiving)
--   5. staff_members (with business_id FK, supports archiving)
--   6. staff_store_assignments (many-to-many: staff <-> stores)
--   7. appointments (with all FKs: business, client, store, staff; supports soft delete & cancellation)
--
-- RLS enabled on ALL tables with policies scoped by:
--   businesses.owner_id = auth.uid()
--
-- Triggers:
--   - Auto-create profile when user signs up
--   - Auto-update updated_at on appointments
--   - Auto-set deleted_at on soft delete
--   - Auto-set cancelled_at on cancellation
--   - Auto-set owner_id on business insert
--
-- Indexes on all foreign keys and commonly queried columns
--
-- To run: Copy entire file into Supabase SQL Editor and execute
-- ============================================
