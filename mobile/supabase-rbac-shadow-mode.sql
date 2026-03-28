-- ============================================================
-- RBAC (Role-Based Access Control) - SHADOW MODE Setup
-- Run this in Supabase SQL Editor
-- ============================================================
--
-- This creates the tables for RBAC but does NOT enforce RLS yet.
-- Shadow mode: UI will check permissions, backend will log but not block.
--
-- Roles:
-- - owner: Full access, non-removable (linked to businesses.owner_id)
-- - manager: Configurable permissions by owner
-- - staff: Configurable permissions by owner (more restricted defaults)
--
-- Philosophy:
-- - All roles can VIEW everything
-- - Only ACTIONS are restricted by permission toggles
-- ============================================================

-- ============================================================
-- 1. BUSINESS MEMBERS TABLE
-- Links users to businesses with roles
-- ============================================================

CREATE TABLE IF NOT EXISTS business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  store_ids UUID[] DEFAULT '{}', -- Optional: specific stores this member can access
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Each user can only have one role per business
  UNIQUE(user_id, business_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_role ON business_members(role);

-- ============================================================
-- 2. ROLE PERMISSIONS TABLE
-- Stores custom permission overrides for manager/staff roles
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'staff')), -- Owner permissions are fixed
  permissions TEXT[] NOT NULL DEFAULT '{}', -- Array of permission keys
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Each business has one permission config per role
  UNIQUE(business_id, role)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_business_id ON role_permissions(business_id);

-- ============================================================
-- 3. PERMISSION AUDIT LOG TABLE
-- Tracks permission checks for shadow mode analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  permission TEXT NOT NULL,
  role TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  would_be_blocked BOOLEAN NOT NULL DEFAULT false, -- Shadow mode indicator
  action_context TEXT, -- What action triggered this check
  component TEXT, -- Which UI component triggered this
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for analysis queries
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_business_id ON permission_audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id ON permission_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON permission_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_would_be_blocked ON permission_audit_logs(would_be_blocked) WHERE would_be_blocked = true;

-- ============================================================
-- 4. BUSINESS INVITES TABLE
-- For inviting new team members
-- ============================================================

CREATE TABLE IF NOT EXISTS business_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'staff')), -- Can't invite as owner
  store_ids UUID[] DEFAULT '{}',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate pending invites
  UNIQUE(business_id, email) WHERE accepted_at IS NULL
);

-- Index for invite lookups
CREATE INDEX IF NOT EXISTS idx_business_invites_email ON business_invites(email);
CREATE INDEX IF NOT EXISTS idx_business_invites_invite_code ON business_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_business_invites_business_id ON business_invites(business_id);

-- ============================================================
-- 5. AUTO-CREATE OWNER MEMBERSHIP
-- Trigger to automatically create owner membership when business is created
-- ============================================================

CREATE OR REPLACE FUNCTION create_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- Create owner membership for the business owner
  INSERT INTO business_members (user_id, business_id, role, is_active, accepted_at)
  VALUES (NEW.owner_id, NEW.id, 'owner', true, now())
  ON CONFLICT (user_id, business_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_owner_membership ON businesses;

-- Create trigger
CREATE TRIGGER trigger_create_owner_membership
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION create_owner_membership();

-- ============================================================
-- 6. BACKFILL EXISTING BUSINESSES
-- Create owner memberships for existing businesses
-- ============================================================

INSERT INTO business_members (user_id, business_id, role, is_active, accepted_at)
SELECT owner_id, id, 'owner', true, now()
FROM businesses
WHERE owner_id IS NOT NULL
ON CONFLICT (user_id, business_id) DO NOTHING;

-- ============================================================
-- 7. DEFAULT ROLE PERMISSIONS
-- Create default permission configs for existing businesses
-- ============================================================

-- Manager defaults
INSERT INTO role_permissions (business_id, role, permissions)
SELECT
  id,
  'manager',
  ARRAY[
    'clients.create', 'clients.edit', 'clients.delete', 'clients.archive', 'clients.export', 'clients.send_email',
    'appointments.create', 'appointments.edit', 'appointments.delete', 'appointments.cancel',
    'staff_management.create', 'staff_management.edit', 'staff_management.assign_stores', 'staff_management.manage_schedule',
    'stores.edit', 'stores.manage_hours',
    'services.create', 'services.edit',
    'campaigns.create', 'campaigns.edit', 'campaigns.activate', 'campaigns.send',
    'promotions.create', 'promotions.edit', 'promotions.activate',
    'analytics.view_revenue', 'analytics.export',
    'settings.theme', 'settings.booking_page'
  ]
FROM businesses
ON CONFLICT (business_id, role) DO NOTHING;

-- Staff defaults
INSERT INTO role_permissions (business_id, role, permissions)
SELECT
  id,
  'staff',
  ARRAY[
    'clients.create', 'clients.edit', 'clients.archive',
    'appointments.create', 'appointments.edit', 'appointments.cancel'
  ]
FROM businesses
ON CONFLICT (business_id, role) DO NOTHING;

-- ============================================================
-- 8. HELPER FUNCTIONS FOR PERMISSION CHECKS
-- ============================================================

-- Get user's role in a business
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID, p_business_id UUID)
RETURNS TABLE (
  role TEXT,
  is_owner BOOLEAN,
  permissions TEXT[]
) AS $$
DECLARE
  v_role TEXT;
  v_is_owner BOOLEAN;
  v_permissions TEXT[];
BEGIN
  -- Get user's membership
  SELECT bm.role INTO v_role
  FROM business_members bm
  WHERE bm.user_id = p_user_id
    AND bm.business_id = p_business_id
    AND bm.is_active = true;

  IF v_role IS NULL THEN
    -- No membership found
    RETURN;
  END IF;

  v_is_owner := (v_role = 'owner');

  IF v_is_owner THEN
    -- Owner has all permissions (return empty array to indicate "all")
    v_permissions := ARRAY[]::TEXT[];
  ELSE
    -- Get configured permissions for role
    SELECT rp.permissions INTO v_permissions
    FROM role_permissions rp
    WHERE rp.business_id = p_business_id AND rp.role = v_role;

    -- Default to empty if no config found
    IF v_permissions IS NULL THEN
      v_permissions := ARRAY[]::TEXT[];
    END IF;
  END IF;

  RETURN QUERY SELECT v_role, v_is_owner, v_permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_business_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_is_owner BOOLEAN;
  v_permissions TEXT[];
BEGIN
  -- Get user's role
  SELECT role, is_owner, permissions
  INTO v_role, v_is_owner, v_permissions
  FROM get_user_role(p_user_id, p_business_id);

  -- No role means no permission
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Owner always has all permissions
  IF v_is_owner THEN
    RETURN true;
  END IF;

  -- Check if permission is in the list
  RETURN p_permission = ANY(v_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log a permission check (for shadow mode analysis)
CREATE OR REPLACE FUNCTION log_permission_check(
  p_user_id UUID,
  p_business_id UUID,
  p_store_id UUID,
  p_permission TEXT,
  p_role TEXT,
  p_allowed BOOLEAN,
  p_would_be_blocked BOOLEAN,
  p_action_context TEXT,
  p_component TEXT
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO permission_audit_logs (
    user_id, business_id, store_id, permission, role,
    allowed, would_be_blocked, action_context, component
  )
  VALUES (
    p_user_id, p_business_id, p_store_id, p_permission, p_role,
    p_allowed, p_would_be_blocked, p_action_context, p_component
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. RLS POLICIES (SHADOW MODE - READ ONLY)
-- These policies allow reading but don't restrict writes yet
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_invites ENABLE ROW LEVEL SECURITY;

-- Business Members: Users can see members of their businesses
CREATE POLICY "Users can view business members"
  ON business_members FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Business Members: Only owners can modify members (SHADOW MODE - allow all for now)
CREATE POLICY "Owners can manage business members"
  ON business_members FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Role Permissions: Users can view their business's role configs
CREATE POLICY "Users can view role permissions"
  ON role_permissions FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Role Permissions: Only owners can modify (SHADOW MODE - allow all for now)
CREATE POLICY "Owners can manage role permissions"
  ON role_permissions FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Permission Audit Logs: Users can view their own business's logs
CREATE POLICY "Users can view permission audit logs"
  ON permission_audit_logs FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Permission Audit Logs: Allow inserts for logging
CREATE POLICY "Allow permission audit log inserts"
  ON permission_audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Business Invites: Users can view their business's invites
CREATE POLICY "Users can view business invites"
  ON business_invites FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Business Invites: Owners can manage invites
CREATE POLICY "Owners can manage business invites"
  ON business_invites FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- 10. GRANT PERMISSIONS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON business_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO authenticated;
GRANT SELECT, INSERT ON permission_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON business_invites TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION log_permission_check TO authenticated;

-- ============================================================
-- SHADOW MODE COMPLETE
--
-- Next steps:
-- 1. UI reads permissions and shows/hides/disables actions
-- 2. Monitor permission_audit_logs for "would_be_blocked" entries
-- 3. When ready, update RLS policies to enforce permissions
-- ============================================================
