-- ============================================
-- GIFT CARDS TABLES
-- ============================================

-- ============================================
-- 1. GIFT CARDS
-- ============================================

CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'value', -- value, service
  initial_value DECIMAL(10, 2),
  current_balance DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  service_id UUID,
  service_name TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  sender_name TEXT,
  sender_email TEXT,
  message TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active, used, expired, cancelled
  client_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, code)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_gift_cards_user_id ON gift_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_client_id ON gift_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

-- RLS for gift_cards
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gift cards"
  ON gift_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gift cards"
  ON gift_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gift cards"
  ON gift_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gift cards"
  ON gift_cards FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. GIFT CARD TRANSACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_card_id UUID NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- purchase, redemption, refund, expiration
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT,
  appointment_id UUID,
  client_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_user_id ON gift_card_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card_id ON gift_card_transactions(gift_card_id);

-- RLS for gift_card_transactions
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gift card transactions"
  ON gift_card_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gift card transactions"
  ON gift_card_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Gift Cards tables created successfully!';
END $$;
