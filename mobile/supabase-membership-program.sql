-- ============================================
-- MEMBERSHIP PROGRAM TABLES
-- Offline Payment Tracking System
-- All payments are collected offline by the business
-- This system only tracks membership status, dates, benefits, and usage
-- ============================================

-- ============================================
-- 1. MEMBERSHIP SETTINGS (Business-level)
-- ============================================

CREATE TABLE IF NOT EXISTS membership_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  notify_before_renewal_days INTEGER DEFAULT 7,
  notify_past_due_days INTEGER DEFAULT 3,
  grace_period_days INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- RLS for membership_settings
ALTER TABLE membership_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership settings"
  ON membership_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own membership settings"
  ON membership_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership settings"
  ON membership_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. MEMBERSHIP PLANS (Business-level)
-- ============================================

CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  renewal_cycle TEXT NOT NULL DEFAULT 'monthly', -- monthly, yearly, custom
  custom_interval_days INTEGER,
  auto_renew_tracking BOOLEAN DEFAULT true,
  benefits JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_membership_plans_user_id ON membership_plans(user_id);

-- RLS for membership_plans
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership plans"
  ON membership_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own membership plans"
  ON membership_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership plans"
  ON membership_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own membership plans"
  ON membership_plans FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. CLIENT MEMBERSHIPS (Client enrollment)
-- ============================================

CREATE TABLE IF NOT EXISTS client_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active', -- active, past_due, cancelled, expired, paused
  start_date TIMESTAMPTZ NOT NULL,
  next_renewal_date TIMESTAMPTZ NOT NULL,
  last_payment_date TIMESTAMPTZ,
  cancelled_date TIMESTAMPTZ,
  paused_date TIMESTAMPTZ,
  pause_end_date TIMESTAMPTZ,
  payment_method TEXT DEFAULT 'cash', -- cash, card, external, other
  payment_notes TEXT,
  credit_balance DECIMAL(10, 2) DEFAULT 0,
  credit_currency TEXT DEFAULT 'USD',
  free_services_used JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_memberships_user_id ON client_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client_id ON client_memberships(client_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_plan_id ON client_memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_status ON client_memberships(status);

-- RLS for client_memberships
ALTER TABLE client_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client memberships"
  ON client_memberships FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client memberships"
  ON client_memberships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own client memberships"
  ON client_memberships FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own client memberships"
  ON client_memberships FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. MEMBERSHIP PAYMENTS (Offline payment records)
-- ============================================

CREATE TABLE IF NOT EXISTS membership_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES client_memberships(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT DEFAULT 'cash',
  payment_date TIMESTAMPTZ NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  notes TEXT,
  received_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_membership_payments_user_id ON membership_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_payments_membership_id ON membership_payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_payments_client_id ON membership_payments(client_id);

-- RLS for membership_payments
ALTER TABLE membership_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership payments"
  ON membership_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own membership payments"
  ON membership_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership payments"
  ON membership_payments FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. MEMBERSHIP CREDIT TRANSACTIONS (Credit ledger)
-- ============================================

CREATE TABLE IF NOT EXISTS membership_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES client_memberships(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  type TEXT NOT NULL, -- credit_added, credit_used, credit_expired, credit_adjustment
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  balance_before DECIMAL(10, 2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  reason TEXT NOT NULL,
  appointment_id UUID,
  visit_id UUID,
  service_id UUID,
  service_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_user_id ON membership_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_membership_id ON membership_credit_transactions(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_client_id ON membership_credit_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_type ON membership_credit_transactions(type);

-- RLS for membership_credit_transactions
ALTER TABLE membership_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions"
  ON membership_credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit transactions"
  ON membership_credit_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 6. MEMBERSHIP BENEFIT USAGE (Audit log)
-- ============================================

CREATE TABLE IF NOT EXISTS membership_benefit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES client_memberships(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  benefit_id TEXT NOT NULL,
  benefit_type TEXT NOT NULL, -- discount, free_service, monthly_credit, custom_perk
  discount_amount DECIMAL(10, 2),
  original_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),
  service_id UUID,
  service_name TEXT,
  credit_used DECIMAL(10, 2),
  appointment_id UUID,
  visit_id UUID,
  used_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_user_id ON membership_benefit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_membership_id ON membership_benefit_usage(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_client_id ON membership_benefit_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_benefit_type ON membership_benefit_usage(benefit_type);

-- RLS for membership_benefit_usage
ALTER TABLE membership_benefit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own benefit usage"
  ON membership_benefit_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own benefit usage"
  ON membership_benefit_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Membership Program tables created successfully!';
  RAISE NOTICE 'Tables: membership_settings, membership_plans, client_memberships, membership_payments, membership_credit_transactions, membership_benefit_usage';
END $$;
