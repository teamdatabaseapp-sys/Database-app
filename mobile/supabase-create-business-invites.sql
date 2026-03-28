-- Migration: Create business_invites table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS business_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'staff')),
  store_ids UUID[] DEFAULT '{}',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, email) WHERE accepted_at IS NULL
);

CREATE INDEX IF NOT EXISTS idx_business_invites_email ON business_invites(email);
CREATE INDEX IF NOT EXISTS idx_business_invites_invite_code ON business_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_business_invites_business_id ON business_invites(business_id);

ALTER TABLE business_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business invites"
  ON business_invites FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Owners can manage business invites"
  ON business_invites FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON business_invites TO authenticated;
