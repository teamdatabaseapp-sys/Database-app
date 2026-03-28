-- ============================================================
-- TAMPER-EVIDENT AUDIT LOG WITH HASH CHAIN
-- ============================================================
-- This migration creates a cryptographically linked audit log
-- where each entry's hash depends on the previous entry's hash,
-- making tampering detectable.
--
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- Enable pgcrypto extension for SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. CREATE AUDIT_LOG TABLE (if not exists)
-- ============================================================
-- Columns: id, created_at, business_id, actor_user_id, action,
--          table_name, record_id, old_data, new_data, chain_hash
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  chain_hash BYTEA  -- Will be set NOT NULL after backfill
);

-- Add chain_hash column if table already exists but column doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
      AND column_name = 'chain_hash'
  ) THEN
    ALTER TABLE audit_log ADD COLUMN chain_hash BYTEA;
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_log_business_id ON audit_log(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
-- Index for chain verification queries (ordering within a business)
CREATE INDEX IF NOT EXISTS idx_audit_log_business_chain
  ON audit_log(business_id, created_at ASC, id ASC);

-- ============================================================
-- 2. CANONICAL TEXT BUILDER FUNCTION
-- ============================================================
-- Creates a deterministic string representation of an audit_log row.
-- The canonical format is:
--   id|created_at_iso|business_id|actor_user_id|action|table_name|record_id|old_data_json|new_data_json
--
-- NULL values are represented as empty strings.
-- JSONB is serialized with sorted keys for determinism.
-- ============================================================

DROP FUNCTION IF EXISTS app_audit_log_canonical(
  UUID, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, UUID, JSONB, JSONB
);

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
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_canonical TEXT;
BEGIN
  -- Build canonical string with pipe-separated values
  -- NULLs become empty strings, JSONB is cast to text (sorted keys by default in PostgreSQL)
  v_canonical := COALESCE(p_id::TEXT, '') || '|' ||
                 COALESCE(to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), '') || '|' ||
                 COALESCE(p_business_id::TEXT, '') || '|' ||
                 COALESCE(p_actor_user_id::TEXT, '') || '|' ||
                 COALESCE(p_action, '') || '|' ||
                 COALESCE(p_table_name, '') || '|' ||
                 COALESCE(p_record_id::TEXT, '') || '|' ||
                 COALESCE(p_old_data::TEXT, '') || '|' ||
                 COALESCE(p_new_data::TEXT, '');

  RETURN v_canonical;
END;
$$;

-- Also create a version that takes a row directly (for convenience)
DROP FUNCTION IF EXISTS app_audit_log_canonical_row(audit_log);

CREATE OR REPLACE FUNCTION app_audit_log_canonical_row(r audit_log)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN app_audit_log_canonical(
    r.id,
    r.created_at,
    r.business_id,
    r.actor_user_id,
    r.action,
    r.table_name,
    r.record_id,
    r.old_data,
    r.new_data
  );
END;
$$;

-- ============================================================
-- 3. COMPUTE CHAIN HASH FUNCTION
-- ============================================================
-- Computes: SHA-256(prev_chain_hash || canonical_text)
-- For the first entry in a chain, prev_chain_hash is NULL/empty.
-- ============================================================

DROP FUNCTION IF EXISTS app_compute_chain_hash(BYTEA, TEXT);

CREATE OR REPLACE FUNCTION app_compute_chain_hash(
  p_prev_hash BYTEA,
  p_canonical TEXT
)
RETURNS BYTEA
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Concatenate previous hash (or empty if NULL) with canonical text
  -- and compute SHA-256
  RETURN digest(
    COALESCE(p_prev_hash, ''::BYTEA) || convert_to(p_canonical, 'UTF8'),
    'sha256'
  );
END;
$$;

-- ============================================================
-- 4. BACKFILL FUNCTION - Per Business
-- ============================================================
-- Backfills chain_hash for all audit_log entries of a specific business.
-- Processes in deterministic order: (created_at ASC, id ASC)
-- ============================================================

DROP FUNCTION IF EXISTS app_backfill_audit_chain(UUID);

CREATE OR REPLACE FUNCTION app_backfill_audit_chain(p_business_id UUID)
RETURNS TABLE(
  updated_count BIGINT,
  first_id UUID,
  last_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count BIGINT := 0;
  v_first_id UUID;
  v_last_id UUID;
  v_prev_hash BYTEA := NULL;
  v_current_hash BYTEA;
  v_canonical TEXT;
  rec RECORD;
BEGIN
  -- Process all rows for this business in deterministic order
  FOR rec IN
    SELECT *
    FROM audit_log
    WHERE business_id = p_business_id
    ORDER BY created_at ASC, id ASC
  LOOP
    -- Track first ID
    IF v_first_id IS NULL THEN
      v_first_id := rec.id;
    END IF;

    -- Build canonical text
    v_canonical := app_audit_log_canonical(
      rec.id,
      rec.created_at,
      rec.business_id,
      rec.actor_user_id,
      rec.action,
      rec.table_name,
      rec.record_id,
      rec.old_data,
      rec.new_data
    );

    -- Compute chain hash
    v_current_hash := app_compute_chain_hash(v_prev_hash, v_canonical);

    -- Update the row
    UPDATE audit_log
    SET chain_hash = v_current_hash
    WHERE id = rec.id;

    -- Track for next iteration
    v_prev_hash := v_current_hash;
    v_last_id := rec.id;
    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- Return summary
  updated_count := v_updated_count;
  first_id := v_first_id;
  last_id := v_last_id;
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 5. BACKFILL ALL BUSINESSES FUNCTION
-- ============================================================
-- Convenience function to backfill all businesses at once.
-- ============================================================

DROP FUNCTION IF EXISTS app_backfill_all_audit_chains();

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
  v_business_id UUID;
  v_result RECORD;
BEGIN
  -- Get distinct business IDs
  FOR v_business_id IN
    SELECT DISTINCT al.business_id
    FROM audit_log al
    ORDER BY al.business_id
  LOOP
    -- Backfill this business
    SELECT * INTO v_result
    FROM app_backfill_audit_chain(v_business_id);

    -- Return row for this business
    business_id := v_business_id;
    updated_count := v_result.updated_count;
    first_id := v_result.first_id;
    last_id := v_result.last_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================
-- 6. VERIFY CHAIN INTEGRITY FUNCTION
-- ============================================================
-- Verifies the hash chain for a specific business.
-- Returns rows where the stored chain_hash doesn't match the computed hash.
-- Empty result = chain is valid.
-- ============================================================

DROP FUNCTION IF EXISTS app_verify_audit_chain(UUID);

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
  v_prev_hash BYTEA := NULL;
  v_expected_hash BYTEA;
  v_canonical TEXT;
  rec RECORD;
BEGIN
  -- Process all rows for this business in deterministic order
  FOR rec IN
    SELECT *
    FROM audit_log
    WHERE business_id = p_business_id
    ORDER BY created_at ASC, id ASC
  LOOP
    -- Build canonical text
    v_canonical := app_audit_log_canonical(
      rec.id,
      rec.created_at,
      rec.business_id,
      rec.actor_user_id,
      rec.action,
      rec.table_name,
      rec.record_id,
      rec.old_data,
      rec.new_data
    );

    -- Compute expected chain hash
    v_expected_hash := app_compute_chain_hash(v_prev_hash, v_canonical);

    -- Return this row's verification status
    row_id := rec.id;
    row_created_at := rec.created_at;
    stored_hash_hex := encode(rec.chain_hash, 'hex');
    expected_hash_hex := encode(v_expected_hash, 'hex');
    is_valid := (rec.chain_hash = v_expected_hash);
    RETURN NEXT;

    -- Use stored hash for next iteration (to continue verification)
    v_prev_hash := rec.chain_hash;
  END LOOP;
END;
$$;

-- ============================================================
-- 7. TRIGGER TO AUTO-COMPUTE CHAIN HASH ON INSERT
-- ============================================================
-- Automatically computes chain_hash when new rows are inserted.
-- IMPORTANT: This assumes sequential inserts. For concurrent inserts,
-- additional locking may be needed.
-- ============================================================

DROP FUNCTION IF EXISTS app_audit_log_chain_trigger() CASCADE;

CREATE OR REPLACE FUNCTION app_audit_log_chain_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prev_hash BYTEA;
  v_canonical TEXT;
BEGIN
  -- Get the previous hash for this business (most recent entry)
  SELECT chain_hash INTO v_prev_hash
  FROM audit_log
  WHERE business_id = NEW.business_id
    AND (created_at, id) < (NEW.created_at, NEW.id)
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Build canonical text
  v_canonical := app_audit_log_canonical(
    NEW.id,
    NEW.created_at,
    NEW.business_id,
    NEW.actor_user_id,
    NEW.action,
    NEW.table_name,
    NEW.record_id,
    NEW.old_data,
    NEW.new_data
  );

  -- Compute and set chain hash
  NEW.chain_hash := app_compute_chain_hash(v_prev_hash, v_canonical);

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_audit_log_chain_hash ON audit_log;

CREATE TRIGGER trg_audit_log_chain_hash
  BEFORE INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION app_audit_log_chain_trigger();

-- ============================================================
-- 8. ENABLE RLS AND CREATE POLICIES
-- ============================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their business audit logs" ON audit_log;
DROP POLICY IF EXISTS "Users can insert audit logs for their business" ON audit_log;

-- Business owners and members can view audit logs
CREATE POLICY "Users can view their business audit logs"
  ON audit_log FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

-- Only allow inserts (no updates/deletes for audit integrity)
CREATE POLICY "Users can insert audit logs for their business"
  ON audit_log FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
      UNION
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION app_audit_log_canonical TO authenticated;
GRANT EXECUTE ON FUNCTION app_audit_log_canonical_row TO authenticated;
GRANT EXECUTE ON FUNCTION app_compute_chain_hash TO authenticated;
GRANT EXECUTE ON FUNCTION app_backfill_audit_chain TO authenticated;
GRANT EXECUTE ON FUNCTION app_backfill_all_audit_chains TO authenticated;
GRANT EXECUTE ON FUNCTION app_verify_audit_chain TO authenticated;

-- ============================================================
-- 9. BACKFILL EXISTING DATA
-- ============================================================
-- Run the backfill for all existing audit_log entries.
-- This is safe to run multiple times (idempotent).
-- ============================================================

SELECT * FROM app_backfill_all_audit_chains();

-- ============================================================
-- 10. SET chain_hash NOT NULL (after backfill)
-- ============================================================
-- Only run this AFTER confirming backfill succeeded.
-- This ensures all future inserts must have a chain_hash.
-- ============================================================

-- Check if there are any NULL chain_hash values before setting NOT NULL
DO $$
DECLARE
  v_null_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM audit_log
  WHERE chain_hash IS NULL;

  IF v_null_count > 0 THEN
    RAISE NOTICE 'Found % rows with NULL chain_hash. Run backfill first!', v_null_count;
    RAISE EXCEPTION 'Cannot set NOT NULL: % rows have NULL chain_hash', v_null_count;
  ELSE
    -- Safe to set NOT NULL
    ALTER TABLE audit_log ALTER COLUMN chain_hash SET NOT NULL;
    RAISE NOTICE 'Successfully set chain_hash to NOT NULL';
  END IF;
END $$;

-- ============================================================
-- 11. VERIFICATION QUERIES
-- ============================================================
-- Use these queries to verify chain integrity.
-- ============================================================

-- Query 1: Show latest 10 audit log entries with chain_hash in hex
-- SELECT
--   id,
--   created_at,
--   business_id,
--   action,
--   table_name,
--   encode(chain_hash, 'hex') as chain_hash_hex
-- FROM audit_log
-- ORDER BY created_at DESC
-- LIMIT 10;

-- Query 2: Verify chain integrity for a specific business
-- Returns only invalid rows (empty = all valid)
-- SELECT * FROM app_verify_audit_chain('YOUR_BUSINESS_UUID_HERE')
-- WHERE is_valid = false;

-- Query 3: Full verification report for a business
-- SELECT * FROM app_verify_audit_chain('YOUR_BUSINESS_UUID_HERE');

-- Query 4: Count audit logs per business with chain status
-- SELECT
--   business_id,
--   COUNT(*) as total_entries,
--   COUNT(chain_hash) as entries_with_hash,
--   COUNT(*) - COUNT(chain_hash) as entries_without_hash
-- FROM audit_log
-- GROUP BY business_id
-- ORDER BY total_entries DESC;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
