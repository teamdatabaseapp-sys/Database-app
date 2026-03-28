-- ============================================================
-- TAMPER-EVIDENT AUDIT LOG HASH CHAIN - STEP BY STEP
-- ============================================================
-- Run these sections one at a time in your Supabase SQL Editor.
-- This version provides granular control and better error handling.
-- ============================================================


-- ============================================================
-- STEP 1: SETUP - Enable pgcrypto
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- STEP 2: CREATE/UPDATE audit_log TABLE
-- ============================================================

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  business_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  chain_hash BYTEA
);

-- Add chain_hash if table exists but column doesn't
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS chain_hash BYTEA;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_business_id ON audit_log(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_business_chain ON audit_log(business_id, created_at ASC, id ASC);


-- ============================================================
-- STEP 3: CANONICAL TEXT FUNCTION
-- ============================================================
-- Matches exact columns: id, created_at, business_id, actor_user_id,
-- action, table_name, record_id, old_data, new_data
-- ============================================================

CREATE OR REPLACE FUNCTION app_audit_log_canonical(
  p_id UUID,
  p_created_at TIMESTAMPTZ,
  p_business_id UUID,
  p_actor_user_id UUID,
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_old_data JSONB,
  p_new_data JSONB
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(p_id::TEXT, '') || '|' ||
    COALESCE(to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), '') || '|' ||
    COALESCE(p_business_id::TEXT, '') || '|' ||
    COALESCE(p_actor_user_id::TEXT, '') || '|' ||
    COALESCE(p_action, '') || '|' ||
    COALESCE(p_table_name, '') || '|' ||
    COALESCE(p_record_id::TEXT, '') || '|' ||
    COALESCE(p_old_data::TEXT, '') || '|' ||
    COALESCE(p_new_data::TEXT, '');
$$;


-- ============================================================
-- STEP 4: COMPUTE CHAIN HASH FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION app_compute_chain_hash(
  p_prev_hash BYTEA,
  p_canonical TEXT
)
RETURNS BYTEA
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT digest(
    COALESCE(p_prev_hash, ''::BYTEA) || convert_to(p_canonical, 'UTF8'),
    'sha256'
  );
$$;


-- ============================================================
-- STEP 5: BACKFILL FUNCTION FOR ONE BUSINESS
-- ============================================================

CREATE OR REPLACE FUNCTION app_backfill_audit_chain(p_business_id UUID)
RETURNS TABLE(
  updated_count BIGINT,
  first_id UUID,
  last_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated BIGINT := 0;
  v_first UUID;
  v_last UUID;
  v_prev_hash BYTEA := NULL;
  v_hash BYTEA;
  v_canon TEXT;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM audit_log
    WHERE audit_log.business_id = p_business_id
    ORDER BY audit_log.created_at ASC, audit_log.id ASC
  LOOP
    IF v_first IS NULL THEN v_first := r.id; END IF;

    v_canon := app_audit_log_canonical(
      r.id, r.created_at, r.business_id, r.actor_user_id,
      r.action, r.table_name, r.record_id, r.old_data, r.new_data
    );
    v_hash := app_compute_chain_hash(v_prev_hash, v_canon);

    UPDATE audit_log SET chain_hash = v_hash WHERE audit_log.id = r.id;

    v_prev_hash := v_hash;
    v_last := r.id;
    v_updated := v_updated + 1;
  END LOOP;

  RETURN QUERY SELECT v_updated, v_first, v_last;
END;
$$;


-- ============================================================
-- STEP 6: BACKFILL ALL BUSINESSES
-- ============================================================

CREATE OR REPLACE FUNCTION app_backfill_all_audit_chains()
RETURNS TABLE(
  business_id UUID,
  updated_count BIGINT,
  first_id UUID,
  last_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_biz UUID;
  v_result RECORD;
BEGIN
  FOR v_biz IN SELECT DISTINCT al.business_id FROM audit_log al
  LOOP
    SELECT * INTO v_result FROM app_backfill_audit_chain(v_biz);
    RETURN QUERY SELECT v_biz, v_result.updated_count, v_result.first_id, v_result.last_id;
  END LOOP;
END;
$$;


-- ============================================================
-- STEP 7: VERIFY CHAIN FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION app_verify_audit_chain(p_business_id UUID)
RETURNS TABLE(
  row_id UUID,
  row_created_at TIMESTAMPTZ,
  stored_hash_hex TEXT,
  expected_hash_hex TEXT,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev BYTEA := NULL;
  v_expected BYTEA;
  v_canon TEXT;
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM audit_log
    WHERE audit_log.business_id = p_business_id
    ORDER BY audit_log.created_at ASC, audit_log.id ASC
  LOOP
    v_canon := app_audit_log_canonical(
      r.id, r.created_at, r.business_id, r.actor_user_id,
      r.action, r.table_name, r.record_id, r.old_data, r.new_data
    );
    v_expected := app_compute_chain_hash(v_prev, v_canon);

    row_id := r.id;
    row_created_at := r.created_at;
    stored_hash_hex := encode(r.chain_hash, 'hex');
    expected_hash_hex := encode(v_expected, 'hex');
    is_valid := (r.chain_hash IS NOT DISTINCT FROM v_expected);
    RETURN NEXT;

    v_prev := r.chain_hash;
  END LOOP;
END;
$$;


-- ============================================================
-- STEP 8: AUTO-HASH TRIGGER FOR NEW INSERTS
-- ============================================================

CREATE OR REPLACE FUNCTION app_audit_log_chain_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev BYTEA;
  v_canon TEXT;
BEGIN
  SELECT chain_hash INTO v_prev
  FROM audit_log
  WHERE business_id = NEW.business_id
    AND (created_at, id) < (NEW.created_at, NEW.id)
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_canon := app_audit_log_canonical(
    NEW.id, NEW.created_at, NEW.business_id, NEW.actor_user_id,
    NEW.action, NEW.table_name, NEW.record_id, NEW.old_data, NEW.new_data
  );

  NEW.chain_hash := app_compute_chain_hash(v_prev, v_canon);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_chain_hash ON audit_log;
CREATE TRIGGER trg_audit_log_chain_hash
  BEFORE INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION app_audit_log_chain_trigger();


-- ============================================================
-- STEP 9: RUN BACKFILL
-- ============================================================
-- Execute this to populate chain_hash for all existing rows

SELECT * FROM app_backfill_all_audit_chains();


-- ============================================================
-- STEP 10: SET NOT NULL (only after successful backfill!)
-- ============================================================
-- First check for NULLs, then apply constraint

DO $$
DECLARE
  v_nulls BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_nulls FROM audit_log WHERE chain_hash IS NULL;

  IF v_nulls = 0 THEN
    EXECUTE 'ALTER TABLE audit_log ALTER COLUMN chain_hash SET NOT NULL';
    RAISE NOTICE 'chain_hash is now NOT NULL';
  ELSE
    RAISE WARNING 'Found % rows with NULL chain_hash - run backfill first', v_nulls;
  END IF;
END $$;


-- ============================================================
-- STEP 11: RLS POLICIES
-- ============================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business audit log read" ON audit_log;
DROP POLICY IF EXISTS "Business audit log insert" ON audit_log;

CREATE POLICY "Business audit log read" ON audit_log
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
      UNION ALL
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business audit log insert" ON audit_log
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
      UNION ALL
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION app_audit_log_canonical TO authenticated;
GRANT EXECUTE ON FUNCTION app_compute_chain_hash TO authenticated;
GRANT EXECUTE ON FUNCTION app_backfill_audit_chain TO authenticated;
GRANT EXECUTE ON FUNCTION app_backfill_all_audit_chains TO authenticated;
GRANT EXECUTE ON FUNCTION app_verify_audit_chain TO authenticated;


-- ============================================================
-- VERIFICATION QUERIES (copy-paste to test)
-- ============================================================

-- Show latest 10 entries with hash
-- SELECT id, created_at, action, table_name, encode(chain_hash, 'hex') AS hash_hex
-- FROM audit_log ORDER BY created_at DESC LIMIT 10;

-- Verify a business chain (returns invalid rows only)
-- SELECT * FROM app_verify_audit_chain('BUSINESS_UUID_HERE') WHERE is_valid = false;

-- Full verification report
-- SELECT * FROM app_verify_audit_chain('BUSINESS_UUID_HERE');

-- Check NULL counts per business
-- SELECT business_id, COUNT(*) AS total, SUM(CASE WHEN chain_hash IS NULL THEN 1 ELSE 0 END) AS null_hashes
-- FROM audit_log GROUP BY business_id;
