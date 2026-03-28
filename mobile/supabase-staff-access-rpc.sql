-- ============================================================
-- STAFF ACCESS - OPTIMIZED RPC
-- Single round-trip to fetch both pending invites and team members
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add indexes for performance (if not already exist)
CREATE INDEX IF NOT EXISTS idx_business_invites_pending
  ON business_invites(business_id, expires_at DESC)
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_members_active
  ON business_members(business_id, role)
  WHERE is_active = true;

-- ============================================================
-- OPTIMIZED RPC: get_staff_access_data
-- Returns both pending invites and team members in one call
-- Now includes profile email for better display
-- ============================================================

CREATE OR REPLACE FUNCTION get_staff_access_data(p_business_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'pending_invites', COALESCE((
      SELECT json_agg(row_to_json(inv))
      FROM (
        SELECT
          id,
          email,
          role,
          expires_at,
          created_at
        FROM business_invites
        WHERE business_id = p_business_id
          AND accepted_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 50
      ) inv
    ), '[]'::json),
    'team_members', COALESCE((
      SELECT json_agg(row_to_json(mem))
      FROM (
        SELECT
          bm.id,
          bm.user_id,
          bm.role,
          bm.is_active,
          bm.created_at,
          p.email as user_email,
          p.business_name as user_name
        FROM business_members bm
        LEFT JOIN profiles p ON p.id = bm.user_id
        WHERE bm.business_id = p_business_id
          AND bm.is_active = true
        ORDER BY
          CASE bm.role
            WHEN 'owner' THEN 1
            WHEN 'manager' THEN 2
            WHEN 'staff' THEN 3
          END,
          bm.created_at ASC
        LIMIT 100
      ) mem
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_staff_access_data TO authenticated;

-- ============================================================
-- DONE
-- This RPC returns:
-- {
--   "pending_invites": [...],
--   "team_members": [...]
-- }
-- ============================================================
