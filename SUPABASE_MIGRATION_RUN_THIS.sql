-- ============================================
-- COMBINED MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor to create all missing tables
--
-- Tables created:
-- 1. gift_cards
-- 2. gift_card_transactions
-- 3. membership_settings
-- 4. membership_plans
-- 5. client_memberships
-- 6. membership_payments
-- 7. membership_credit_transactions
-- 8. membership_benefit_usage
-- 9. loyalty_settings
-- 10. loyalty_rewards
-- 11. client_loyalty
-- 12. loyalty_transactions
-- 13. loyalty_redemptions
-- ============================================

-- ============================================
-- PART 1: GIFT CARDS
-- ============================================

CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'value',
  status TEXT NOT NULL DEFAULT 'active',
  original_value DECIMAL(10, 2),
  current_balance DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  services JSONB DEFAULT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  purchaser_name TEXT,
  personal_message TEXT,
  client_id UUID,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  first_used_at TIMESTAMPTZ,
  fully_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_user_id ON gift_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_client_id ON gift_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gift cards" ON gift_cards;
CREATE POLICY "Users can view own gift cards" ON gift_cards FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own gift cards" ON gift_cards;
CREATE POLICY "Users can insert own gift cards" ON gift_cards FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own gift cards" ON gift_cards;
CREATE POLICY "Users can update own gift cards" ON gift_cards FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own gift cards" ON gift_cards;
CREATE POLICY "Users can delete own gift cards" ON gift_cards FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  client_id UUID,
  type TEXT NOT NULL,
  amount DECIMAL(10, 2),
  balance_before DECIMAL(10, 2),
  balance_after DECIMAL(10, 2),
  service_id UUID,
  service_name TEXT,
  quantity_used INTEGER,
  appointment_id UUID,
  visit_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_user_id ON gift_card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card_id ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_client_id ON gift_card_transactions(client_id);

ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own gift card transactions" ON gift_card_transactions;
CREATE POLICY "Users can view own gift card transactions" ON gift_card_transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own gift card transactions" ON gift_card_transactions;
CREATE POLICY "Users can insert own gift card transactions" ON gift_card_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PART 2: MEMBERSHIP PROGRAM
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

ALTER TABLE membership_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own membership settings" ON membership_settings;
CREATE POLICY "Users can view own membership settings" ON membership_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own membership settings" ON membership_settings;
CREATE POLICY "Users can insert own membership settings" ON membership_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own membership settings" ON membership_settings;
CREATE POLICY "Users can update own membership settings" ON membership_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  renewal_cycle TEXT NOT NULL DEFAULT 'monthly',
  custom_interval_days INTEGER,
  auto_renew_tracking BOOLEAN DEFAULT true,
  benefits JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_user_id ON membership_plans(user_id);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own membership plans" ON membership_plans;
CREATE POLICY "Users can view own membership plans" ON membership_plans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own membership plans" ON membership_plans;
CREATE POLICY "Users can insert own membership plans" ON membership_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own membership plans" ON membership_plans;
CREATE POLICY "Users can update own membership plans" ON membership_plans FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own membership plans" ON membership_plans;
CREATE POLICY "Users can delete own membership plans" ON membership_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS client_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ NOT NULL,
  next_renewal_date TIMESTAMPTZ NOT NULL,
  last_payment_date TIMESTAMPTZ,
  cancelled_date TIMESTAMPTZ,
  paused_date TIMESTAMPTZ,
  pause_end_date TIMESTAMPTZ,
  payment_method TEXT DEFAULT 'cash',
  payment_notes TEXT,
  credit_balance DECIMAL(10, 2) DEFAULT 0,
  credit_currency TEXT DEFAULT 'USD',
  free_services_used JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_memberships_user_id ON client_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client_id ON client_memberships(client_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_plan_id ON client_memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_client_memberships_status ON client_memberships(status);

ALTER TABLE client_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own client memberships" ON client_memberships;
CREATE POLICY "Users can view own client memberships" ON client_memberships FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own client memberships" ON client_memberships;
CREATE POLICY "Users can insert own client memberships" ON client_memberships FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own client memberships" ON client_memberships;
CREATE POLICY "Users can update own client memberships" ON client_memberships FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own client memberships" ON client_memberships;
CREATE POLICY "Users can delete own client memberships" ON client_memberships FOR DELETE USING (auth.uid() = user_id);

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

CREATE INDEX IF NOT EXISTS idx_membership_payments_user_id ON membership_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_payments_membership_id ON membership_payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_payments_client_id ON membership_payments(client_id);

ALTER TABLE membership_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own membership payments" ON membership_payments;
CREATE POLICY "Users can view own membership payments" ON membership_payments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own membership payments" ON membership_payments;
CREATE POLICY "Users can insert own membership payments" ON membership_payments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own membership payments" ON membership_payments;
CREATE POLICY "Users can update own membership payments" ON membership_payments FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS membership_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES client_memberships(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  type TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_user_id ON membership_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_membership_id ON membership_credit_transactions(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_client_id ON membership_credit_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_membership_credit_transactions_type ON membership_credit_transactions(type);

ALTER TABLE membership_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit transactions" ON membership_credit_transactions;
CREATE POLICY "Users can view own credit transactions" ON membership_credit_transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own credit transactions" ON membership_credit_transactions;
CREATE POLICY "Users can insert own credit transactions" ON membership_credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS membership_benefit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES client_memberships(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  benefit_id TEXT NOT NULL,
  benefit_type TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_user_id ON membership_benefit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_membership_id ON membership_benefit_usage(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_client_id ON membership_benefit_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_usage_benefit_type ON membership_benefit_usage(benefit_type);

ALTER TABLE membership_benefit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own benefit usage" ON membership_benefit_usage;
CREATE POLICY "Users can view own benefit usage" ON membership_benefit_usage FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own benefit usage" ON membership_benefit_usage;
CREATE POLICY "Users can insert own benefit usage" ON membership_benefit_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PART 3: LOYALTY PROGRAM
-- ============================================

CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  points_per_dollar NUMERIC(10, 2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_settings_business_id ON public.loyalty_settings(business_id);

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own business loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Users can read own business loyalty settings"
  ON public.loyalty_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_settings.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Users can insert own business loyalty settings"
  ON public.loyalty_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_settings.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Users can update own business loyalty settings"
  ON public.loyalty_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_settings.business_id AND businesses.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_settings.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Users can delete own business loyalty settings"
  ON public.loyalty_settings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_settings.business_id AND businesses.owner_id = auth.uid()));

GRANT SELECT, UPDATE, INSERT, DELETE ON public.loyalty_settings TO authenticated;

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  linked_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  credit_amount NUMERIC(10, 2),
  notification_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_business_id ON public.loyalty_rewards(business_id);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own business loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Users can read own business loyalty rewards"
  ON public.loyalty_rewards FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_rewards.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Users can insert own business loyalty rewards"
  ON public.loyalty_rewards FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_rewards.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Users can update own business loyalty rewards"
  ON public.loyalty_rewards FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_rewards.business_id AND businesses.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_rewards.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Users can delete own business loyalty rewards"
  ON public.loyalty_rewards FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_rewards.business_id AND businesses.owner_id = auth.uid()));

GRANT SELECT, UPDATE, INSERT, DELETE ON public.loyalty_rewards TO authenticated;

CREATE TABLE IF NOT EXISTS public.client_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_enrolled BOOLEAN NOT NULL DEFAULT true,
  total_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_loyalty_business_id ON public.client_loyalty(business_id);
CREATE INDEX IF NOT EXISTS idx_client_loyalty_client_id ON public.client_loyalty(client_id);

ALTER TABLE public.client_loyalty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own business client loyalty" ON public.client_loyalty;
CREATE POLICY "Users can read own business client loyalty"
  ON public.client_loyalty FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = client_loyalty.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business client loyalty" ON public.client_loyalty;
CREATE POLICY "Users can insert own business client loyalty"
  ON public.client_loyalty FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = client_loyalty.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business client loyalty" ON public.client_loyalty;
CREATE POLICY "Users can update own business client loyalty"
  ON public.client_loyalty FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = client_loyalty.business_id AND businesses.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = client_loyalty.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business client loyalty" ON public.client_loyalty;
CREATE POLICY "Users can delete own business client loyalty"
  ON public.client_loyalty FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = client_loyalty.business_id AND businesses.owner_id = auth.uid()));

GRANT SELECT, UPDATE, INSERT, DELETE ON public.client_loyalty TO authenticated;

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjustment', 'bonus')),
  source_type TEXT,
  source_id UUID,
  reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  notes TEXT,
  revenue_amount NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_business_id ON public.loyalty_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_client_id ON public.loyalty_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_business_client ON public.loyalty_transactions(business_id, client_id);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own business loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Users can read own business loyalty transactions"
  ON public.loyalty_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_transactions.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Users can insert own business loyalty transactions"
  ON public.loyalty_transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_transactions.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Users can update own business loyalty transactions"
  ON public.loyalty_transactions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_transactions.business_id AND businesses.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_transactions.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Users can delete own business loyalty transactions"
  ON public.loyalty_transactions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_transactions.business_id AND businesses.owner_id = auth.uid()));

GRANT SELECT, UPDATE, INSERT, DELETE ON public.loyalty_transactions TO authenticated;

CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  points_used INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'used', 'cancelled')),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  used_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_business_id ON public.loyalty_redemptions(business_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_client_id ON public.loyalty_redemptions(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_reward_id ON public.loyalty_redemptions(reward_id);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own business loyalty redemptions" ON public.loyalty_redemptions;
CREATE POLICY "Users can read own business loyalty redemptions"
  ON public.loyalty_redemptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_redemptions.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business loyalty redemptions" ON public.loyalty_redemptions;
CREATE POLICY "Users can insert own business loyalty redemptions"
  ON public.loyalty_redemptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_redemptions.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business loyalty redemptions" ON public.loyalty_redemptions;
CREATE POLICY "Users can update own business loyalty redemptions"
  ON public.loyalty_redemptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_redemptions.business_id AND businesses.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_redemptions.business_id AND businesses.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business loyalty redemptions" ON public.loyalty_redemptions;
CREATE POLICY "Users can delete own business loyalty redemptions"
  ON public.loyalty_redemptions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.businesses WHERE businesses.id = loyalty_redemptions.business_id AND businesses.owner_id = auth.uid()));

GRANT SELECT, UPDATE, INSERT, DELETE ON public.loyalty_redemptions TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'All tables created successfully!';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'Gift Cards: gift_cards, gift_card_transactions';
  RAISE NOTICE 'Membership: membership_settings, membership_plans, client_memberships, membership_payments, membership_credit_transactions, membership_benefit_usage';
  RAISE NOTICE 'Loyalty: loyalty_settings, loyalty_rewards, client_loyalty, loyalty_transactions, loyalty_redemptions';
  RAISE NOTICE '=============================================';
END $$;
-- ============================================
-- APPOINTMENT LIFECYCLE SYSTEM
-- Enterprise-grade lifecycle states with check-in,
-- revenue integrity, and gift card intent tracking.
-- ============================================

-- ============================================
-- STEP 1: Add lifecycle fields to appointments
-- ============================================

-- Lifecycle status column
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT
    CHECK (lifecycle_status IN ('scheduled', 'checked_in', 'pending_confirmation', 'completed', 'no_show', 'cancelled'))
    DEFAULT 'scheduled';

-- Check-in timestamp
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- Completed timestamp
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- No-show / confirmed timestamp
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS outcome_confirmed_at TIMESTAMPTZ;

-- Gift card intent: was a gift card planned for this appointment?
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS gift_card_intent BOOLEAN DEFAULT FALSE;

-- Gift card ID to be used (set when intent=true)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS gift_card_id UUID REFERENCES public.gift_cards(id) ON DELETE SET NULL;

-- Whether gift card has been debited (prevent double-debit)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS gift_card_debited BOOLEAN DEFAULT FALSE;

-- ============================================
-- STEP 2: Backfill existing appointments
-- ============================================
-- Appointments that are already cancelled → cancelled lifecycle
UPDATE public.appointments
  SET lifecycle_status = 'cancelled'
  WHERE (is_cancelled = TRUE OR is_deleted = TRUE)
    AND lifecycle_status = 'scheduled';

-- Appointments in the past that are not cancelled/deleted → pending_confirmation
-- (they will need manual confirmation retroactively, but we won't touch already-completed ones)

-- ============================================
-- STEP 3: Indexes for lifecycle queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_appointments_lifecycle_status
  ON public.appointments(lifecycle_status)
  WHERE lifecycle_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_lifecycle_business
  ON public.appointments(business_id, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_appointments_gift_card_intent
  ON public.appointments(business_id, gift_card_intent)
  WHERE gift_card_intent = TRUE;

-- ============================================
-- STEP 4: Function to check-in an appointment
-- ============================================
CREATE OR REPLACE FUNCTION public.check_in_appointment(
  p_appointment_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apt RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Fetch appointment
  SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Appointment not found');
  END IF;

  -- Verify access
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = v_apt.business_id
      AND (b.owner_id = v_user_id OR EXISTS (
        SELECT 1 FROM public.staff s WHERE s.business_id = b.id AND s.user_id = v_user_id
      ))
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Access denied');
  END IF;

  -- Only allow check-in from scheduled state
  IF v_apt.lifecycle_status NOT IN ('scheduled', 'pending_confirmation') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Can only check in a scheduled appointment');
  END IF;

  UPDATE public.appointments
    SET lifecycle_status = 'checked_in',
        checked_in_at = NOW(),
        updated_at = NOW()
    WHERE id = p_appointment_id;

  RETURN jsonb_build_object('success', TRUE, 'lifecycle_status', 'checked_in', 'checked_in_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_appointment(UUID, UUID) TO authenticated;

-- ============================================
-- STEP 5: Function to complete an appointment
-- (triggers revenue finalization + gift card debit)
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_appointment(
  p_appointment_id UUID,
  p_gift_card_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apt RECORD;
  v_gc RECORD;
  v_user_id UUID;
  v_debit_amount NUMERIC;
  v_new_balance NUMERIC;
  v_prev_balance NUMERIC;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Fetch appointment with full details
  SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Appointment not found');
  END IF;

  -- Verify access
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = v_apt.business_id
      AND (b.owner_id = v_user_id OR EXISTS (
        SELECT 1 FROM public.staff s WHERE s.business_id = b.id AND s.user_id = v_user_id
      ))
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Access denied');
  END IF;

  -- Allow completing from checked_in, scheduled, or pending_confirmation
  IF v_apt.lifecycle_status NOT IN ('checked_in', 'scheduled', 'pending_confirmation') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Appointment cannot be completed from its current state: ' || COALESCE(v_apt.lifecycle_status, 'unknown'));
  END IF;

  -- Resolve gift card: use p_gift_card_id if provided, else use appointment's gift_card_id
  DECLARE
    v_effective_gc_id UUID := COALESCE(p_gift_card_id, v_apt.gift_card_id);
  BEGIN
    -- Mark appointment as completed first (revenue finalization)
    UPDATE public.appointments
      SET lifecycle_status = 'completed',
          completed_at = NOW(),
          updated_at = NOW(),
          gift_card_id = COALESCE(v_effective_gc_id, v_apt.gift_card_id)
      WHERE id = p_appointment_id;

    -- ============================================
    -- Gift card debit: only if intent=true AND not already debited
    -- ============================================
    IF v_effective_gc_id IS NOT NULL
       AND (v_apt.gift_card_intent = TRUE OR p_gift_card_id IS NOT NULL)
       AND COALESCE(v_apt.gift_card_debited, FALSE) = FALSE
    THEN
      -- Fetch gift card
      SELECT * INTO v_gc FROM public.gift_cards WHERE id = v_effective_gc_id;

      IF v_gc IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gift card not found');
      END IF;

      IF v_gc.status NOT IN ('active') THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Gift card is not active (status: ' || v_gc.status || ')');
      END IF;

      -- Determine debit amount
      IF v_gc.type = 'value' THEN
        -- Debit the appointment total (or full balance if less)
        v_debit_amount := LEAST(
          COALESCE(v_apt.amount, 0),
          COALESCE(v_gc.current_balance, 0)
        );
        v_prev_balance := COALESCE(v_gc.current_balance, 0);
        v_new_balance := v_prev_balance - v_debit_amount;

        -- Update gift card balance
        UPDATE public.gift_cards
          SET current_balance = v_new_balance,
              status = CASE WHEN v_new_balance <= 0 THEN 'fully_used' ELSE 'active' END,
              first_used_at = COALESCE(first_used_at, NOW()),
              fully_used_at = CASE WHEN v_new_balance <= 0 THEN NOW() ELSE NULL END,
              updated_at = NOW()
          WHERE id = v_effective_gc_id;

        -- Insert gift_card_transactions record (audit trail)
        INSERT INTO public.gift_card_transactions (
          user_id, business_id, store_id,
          gift_card_id, client_id,
          type,
          amount, balance_before, balance_after,
          appointment_id,
          notes,
          created_at
        ) VALUES (
          v_user_id, v_apt.business_id, v_apt.store_id,
          v_effective_gc_id, v_apt.client_id,
          'redemption',
          v_debit_amount, v_prev_balance, v_new_balance,
          p_appointment_id,
          'Auto-debit on appointment completion',
          NOW()
        );

        -- Mark appointment as debited (prevent double-debit)
        UPDATE public.appointments
          SET gift_card_debited = TRUE
          WHERE id = p_appointment_id;

      ELSIF v_gc.type = 'service' THEN
        -- Service gift cards: mark as used (no monetary debit)
        UPDATE public.gift_cards
          SET status = 'fully_used',
              first_used_at = COALESCE(first_used_at, NOW()),
              fully_used_at = NOW(),
              updated_at = NOW()
          WHERE id = v_effective_gc_id;

        INSERT INTO public.gift_card_transactions (
          user_id, business_id, store_id,
          gift_card_id, client_id,
          type,
          amount, balance_before, balance_after,
          appointment_id,
          notes,
          created_at
        ) VALUES (
          v_user_id, v_apt.business_id, v_apt.store_id,
          v_effective_gc_id, v_apt.client_id,
          'redemption',
          0, 0, 0,
          p_appointment_id,
          'Service gift card redeemed on appointment completion',
          NOW()
        );

        UPDATE public.appointments
          SET gift_card_debited = TRUE
          WHERE id = p_appointment_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'lifecycle_status', 'completed',
      'completed_at', NOW(),
      'gift_card_debited', (v_effective_gc_id IS NOT NULL AND (v_apt.gift_card_intent = TRUE OR p_gift_card_id IS NOT NULL) AND COALESCE(v_apt.gift_card_debited, FALSE) = FALSE)
    );
  END;

EXCEPTION WHEN others THEN
  RAISE NOTICE '[complete_appointment] EXCEPTION: %', SQLERRM;
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_appointment(UUID, UUID, UUID) TO authenticated;

-- ============================================
-- STEP 6: Function to set outcome (no_show / cancelled)
-- ============================================
CREATE OR REPLACE FUNCTION public.set_appointment_outcome(
  p_appointment_id UUID,
  p_outcome TEXT, -- 'no_show' | 'cancelled' | 'completed'
  p_gift_card_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apt RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF p_outcome NOT IN ('no_show', 'cancelled', 'completed') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid outcome. Must be no_show, cancelled, or completed');
  END IF;

  -- For completed, delegate to complete_appointment
  IF p_outcome = 'completed' THEN
    RETURN public.complete_appointment(p_appointment_id, p_gift_card_id, v_user_id);
  END IF;

  -- Fetch appointment
  SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Appointment not found');
  END IF;

  -- Verify access
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = v_apt.business_id
      AND (b.owner_id = v_user_id OR EXISTS (
        SELECT 1 FROM public.staff s WHERE s.business_id = b.id AND s.user_id = v_user_id
      ))
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Access denied');
  END IF;

  -- Set the outcome (no revenue, no gift card debit)
  UPDATE public.appointments
    SET lifecycle_status = p_outcome,
        outcome_confirmed_at = NOW(),
        is_cancelled = CASE WHEN p_outcome = 'cancelled' THEN TRUE ELSE is_cancelled END,
        cancelled_at = CASE WHEN p_outcome = 'cancelled' THEN NOW() ELSE cancelled_at END,
        updated_at = NOW()
    WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'lifecycle_status', p_outcome,
    'outcome_confirmed_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_appointment_outcome(UUID, TEXT, UUID, UUID) TO authenticated;

-- ============================================
-- STEP 7: Function to transition past appointments
-- to pending_confirmation (for scheduler/cron)
-- ============================================
CREATE OR REPLACE FUNCTION public.transition_overdue_appointments(
  p_business_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Mark appointments that have passed their end_at time as pending_confirmation
  -- Only applies to 'scheduled' status (not checked_in, completed, etc.)
  UPDATE public.appointments
    SET lifecycle_status = 'pending_confirmation',
        updated_at = NOW()
    WHERE lifecycle_status = 'scheduled'
      AND end_at < NOW()
      AND COALESCE(is_deleted, FALSE) = FALSE
      AND COALESCE(is_cancelled, FALSE) = FALSE
      AND (p_business_id IS NULL OR business_id = p_business_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Auto-complete checked_in appointments that have passed end_at
  -- (they physically arrived, service is done)
  WITH auto_completed AS (
    UPDATE public.appointments
      SET lifecycle_status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE lifecycle_status = 'checked_in'
        AND end_at < NOW()
        AND COALESCE(is_deleted, FALSE) = FALSE
        AND (p_business_id IS NULL OR business_id = p_business_id)
      RETURNING id, business_id, client_id, store_id, amount, gift_card_id, gift_card_intent, gift_card_debited
  )
  -- Gift card debit for auto-completed checked-in appointments
  INSERT INTO public.gift_card_transactions (
    user_id, business_id, store_id,
    gift_card_id, client_id,
    type, amount, balance_before, balance_after,
    appointment_id, notes, created_at
  )
  SELECT
    ac.client_id, -- use client as proxy user_id for system actions
    ac.business_id, ac.store_id,
    ac.gift_card_id, ac.client_id,
    'redemption',
    LEAST(COALESCE(ac.amount, 0), COALESCE(gc.current_balance, 0)),
    COALESCE(gc.current_balance, 0),
    GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(ac.amount, 0), COALESCE(gc.current_balance, 0))),
    ac.id,
    'Auto-debit: appointment auto-completed after check-in',
    NOW()
  FROM auto_completed ac
  JOIN public.gift_cards gc ON gc.id = ac.gift_card_id
  WHERE ac.gift_card_id IS NOT NULL
    AND ac.gift_card_intent = TRUE
    AND COALESCE(ac.gift_card_debited, FALSE) = FALSE
    AND gc.status = 'active';

  -- Update gift card balances for auto-completed
  UPDATE public.gift_cards gc
    SET current_balance = GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0))),
        status = CASE
          WHEN GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0))) <= 0
          THEN 'fully_used' ELSE 'active' END,
        first_used_at = COALESCE(gc.first_used_at, NOW()),
        fully_used_at = CASE
          WHEN GREATEST(0, COALESCE(gc.current_balance, 0) - LEAST(COALESCE(a.amount, 0), COALESCE(gc.current_balance, 0))) <= 0
          THEN NOW() ELSE NULL END,
        updated_at = NOW()
  FROM public.appointments a
  WHERE gc.id = a.gift_card_id
    AND a.lifecycle_status = 'completed'
    AND a.completed_at >= NOW() - INTERVAL '1 minute'
    AND a.gift_card_intent = TRUE
    AND COALESCE(a.gift_card_debited, FALSE) = FALSE
    AND gc.status = 'active'
    AND (p_business_id IS NULL OR a.business_id = p_business_id);

  -- Mark debited
  UPDATE public.appointments a
    SET gift_card_debited = TRUE
    FROM public.gift_cards gc
    WHERE gc.id = a.gift_card_id
      AND a.lifecycle_status = 'completed'
      AND a.completed_at >= NOW() - INTERVAL '1 minute'
      AND a.gift_card_intent = TRUE
      AND COALESCE(a.gift_card_debited, FALSE) = FALSE;

  RETURN jsonb_build_object(
    'success', TRUE,
    'pending_confirmation_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_overdue_appointments(UUID) TO authenticated, service_role;

-- ============================================
-- STEP 8: Update analytics RPC to count only COMPLETED appointments
-- ============================================
CREATE OR REPLACE FUNCTION public.get_monthly_analytics_overview(
  p_business_id UUID,
  p_start_at    TIMESTAMPTZ,
  p_end_at      TIMESTAMPTZ,
  p_store_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_total_appointments INTEGER := 0;
  v_total_revenue_cents BIGINT := 0;
  v_new_clients INTEGER := 0;
  v_promotions_redeemed INTEGER := 0;
  v_top_service_id UUID;
  v_top_service_name TEXT;
  v_top_service_count INTEGER := 0;
  v_top_service_revenue_cents BIGINT := 0;
  v_best_revenue_month INTEGER;
  v_best_revenue_month_cents BIGINT := 0;
  v_busiest_day INTEGER;
  v_busiest_day_count INTEGER := 0;
  v_busiest_hour INTEGER;
  v_busiest_hour_count INTEGER := 0;
  v_top_clients JSONB;
BEGIN
  IF p_business_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'business_id is required');
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.businesses WHERE id = p_business_id;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Business not found');
  END IF;

  IF v_owner_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff WHERE business_id = p_business_id AND user_id = auth.uid()
    ) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Access denied');
    END IF;
  END IF;

  -- ==========================================
  -- REVENUE INTEGRITY: Only count COMPLETED appointments
  -- lifecycle_status = 'completed' OR (legacy: no lifecycle_status, not cancelled/deleted)
  -- ==========================================
  SELECT
    COUNT(*),
    COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT
  INTO v_total_appointments, v_total_revenue_cents
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    -- REVENUE INTEGRITY: Only completed appointments count
    AND (
      a.lifecycle_status = 'completed'
      OR (a.lifecycle_status IS NULL AND COALESCE(a.is_deleted, FALSE) = FALSE AND COALESCE(a.is_cancelled, FALSE) = FALSE)
    );

  -- New Clients
  SELECT COUNT(*) INTO v_new_clients
  FROM public.clients c
  WHERE c.business_id = p_business_id
    AND c.created_at >= p_start_at
    AND c.created_at <  p_end_at;

  -- Promotions Redeemed (completed only)
  SELECT COUNT(DISTINCT a.id) INTO v_promotions_redeemed
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND (a.lifecycle_status = 'completed' OR a.lifecycle_status IS NULL)
    AND (
      a.promo_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.appointment_services aps
        WHERE aps.appointment_id = a.id AND aps.promo_id IS NOT NULL
      )
    );

  -- Top Service (completed only)
  SELECT
    aps.service_id, s.name, COUNT(*) as cnt,
    COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT
  INTO v_top_service_id, v_top_service_name, v_top_service_count, v_top_service_revenue_cents
  FROM public.appointment_services aps
  JOIN public.appointments a ON a.id = aps.appointment_id
  LEFT JOIN public.services s ON s.id = aps.service_id
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND (a.lifecycle_status = 'completed' OR a.lifecycle_status IS NULL)
  GROUP BY aps.service_id, s.name
  ORDER BY cnt DESC
  LIMIT 1;

  -- Best Month
  SELECT
    EXTRACT(MONTH FROM a.start_at)::INTEGER,
    COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT
  INTO v_best_revenue_month, v_best_revenue_month_cents
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND EXTRACT(YEAR FROM a.start_at) = EXTRACT(YEAR FROM p_start_at)
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND (a.lifecycle_status = 'completed' OR a.lifecycle_status IS NULL)
  GROUP BY EXTRACT(MONTH FROM a.start_at)
  ORDER BY 2 DESC
  LIMIT 1;

  -- Busiest Day
  SELECT
    EXTRACT(DOW FROM a.start_at)::INTEGER, COUNT(*)
  INTO v_busiest_day, v_busiest_day_count
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND (a.lifecycle_status = 'completed' OR a.lifecycle_status IS NULL)
  GROUP BY EXTRACT(DOW FROM a.start_at)
  ORDER BY 2 DESC LIMIT 1;

  -- Busiest Hour
  SELECT
    EXTRACT(HOUR FROM a.start_at)::INTEGER, COUNT(*)
  INTO v_busiest_hour, v_busiest_hour_count
  FROM public.appointments a
  WHERE a.business_id = p_business_id
    AND a.start_at >= p_start_at
    AND a.start_at <  p_end_at
    AND COALESCE(a.is_deleted, FALSE) = FALSE
    AND COALESCE(a.is_cancelled, FALSE) = FALSE
    AND (p_store_id IS NULL OR a.store_id = p_store_id)
    AND (a.lifecycle_status = 'completed' OR a.lifecycle_status IS NULL)
  GROUP BY EXTRACT(HOUR FROM a.start_at)
  ORDER BY 2 DESC LIMIT 1;

  -- Top Clients (completed only)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_clients
  FROM (
    SELECT
      a.client_id,
      COALESCE(c.name, 'Client') AS display_name,
      COUNT(a.id)::INTEGER AS appointment_count,
      COALESCE(SUM(COALESCE(a.amount, 0) * 100), 0)::BIGINT AS total_spend_cents
    FROM public.appointments a
    LEFT JOIN public.clients c ON c.id = a.client_id
    WHERE a.business_id = p_business_id
      AND a.start_at >= p_start_at
      AND a.start_at <  p_end_at
      AND COALESCE(a.is_deleted, FALSE) = FALSE
      AND COALESCE(a.is_cancelled, FALSE) = FALSE
      AND (p_store_id IS NULL OR a.store_id = p_store_id)
      AND (a.lifecycle_status = 'completed' OR a.lifecycle_status IS NULL)
    GROUP BY a.client_id, c.name
    ORDER BY total_spend_cents DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'total_appointments', v_total_appointments,
    'total_services',     v_top_service_count,
    'revenue_cents',      v_total_revenue_cents,
    'top_clients',        COALESCE(v_top_clients, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_analytics_overview(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

-- ============================================
-- STEP 9: Also update gift card analytics
-- to only count gift cards from completed appointments
-- ============================================

-- Helper view for store analytics with lifecycle awareness
CREATE OR REPLACE VIEW public.completed_appointments_view AS
  SELECT *
  FROM public.appointments
  WHERE COALESCE(is_deleted, FALSE) = FALSE
    AND (
      lifecycle_status = 'completed'
      OR (lifecycle_status IS NULL AND COALESCE(is_cancelled, FALSE) = FALSE)
    );

COMMENT ON VIEW public.completed_appointments_view IS
  'Appointments that have been completed (for revenue/analytics). Excludes all non-completed lifecycle states.';

-- ============================================
-- ADD SOCIAL LINKS TO BOOKING PAGE SETTINGS
-- Run if social links are not appearing in emails
-- ============================================
ALTER TABLE booking_page_settings
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
