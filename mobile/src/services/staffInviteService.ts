/**
 * Staff Invite Service
 *
 * Handles staff invitation logic for enterprise RBAC.
 * Owners can invite users (by email) as Manager or Staff roles.
 * When invitees sign up or log in, their membership is automatically activated.
 */

import { getSupabase } from '@/lib/supabaseClient';

// ============================================
// Types
// ============================================

export type InviteRole = 'manager' | 'staff';

export interface StaffInvite {
  id: string;
  business_id: string;
  email: string;
  role: InviteRole;
  store_ids: string[];
  invited_by: string;
  invite_code: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface BusinessMember {
  id: string;
  user_id: string;
  business_id?: string;
  role: 'owner' | 'manager' | 'staff';
  store_ids?: string[];
  invited_by?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // Profile data from RPC join
  user_email?: string | null;
  user_name?: string | null;
}

export interface CreateInviteInput {
  businessId: string;
  email: string;
  role: InviteRole;
  storeIds?: string[];
  invitedBy: string;
}

export interface InviteResult<T = null> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Invite Code Generation
// ============================================

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================
// Invite Management Functions
// ============================================

/**
 * Create a staff invite
 */
export async function createStaffInvite(
  input: CreateInviteInput
): Promise<InviteResult<StaffInvite>> {
  try {
    const { businessId, email, role, storeIds = [], invitedBy } = input;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if there's already a pending invite for this email
    const { data: existingInvite } = await getSupabase()
      .from('business_invites')
      .select('*')
      .eq('business_id', businessId)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .maybeSingle();

    if (existingInvite) {
      return {
        data: null,
        error: new Error('An invite for this email already exists'),
      };
    }

    // Check if user is already a member of this business
    const { data: existingMember } = await getSupabase()
      .from('business_members')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    // Check by email in auth.users (we need to check if any existing member has this email)
    // This requires a more complex query or RPC - for now, we'll proceed

    // Generate invite code and expiration (7 days)
    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await getSupabase()
      .from('business_invites')
      .insert({
        business_id: businessId,
        email: normalizedEmail,
        role,
        store_ids: storeIds,
        invited_by: invitedBy,
        invite_code: inviteCode,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[StaffInviteService] Error creating invite:', error);
      return { data: null, error };
    }

    return { data: data as StaffInvite, error: null };
  } catch (err) {
    console.error('[StaffInviteService] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create invite'),
    };
  }
}

/**
 * Get all invites for a business
 */
export async function getBusinessInvites(
  businessId: string
): Promise<InviteResult<StaffInvite[]>> {
  try {
    const { data, error } = await getSupabase()
      .from('business_invites')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data as StaffInvite[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch invites'),
    };
  }
}

/**
 * Get pending invites for a business
 * @deprecated Use getStaffAccessData() for optimized single-query fetch
 */
export async function getPendingInvites(
  businessId: string
): Promise<InviteResult<StaffInvite[]>> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await getSupabase()
      .from('business_invites')
      .select('id, email, role, expires_at, created_at')
      .eq('business_id', businessId)
      .is('accepted_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data as StaffInvite[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch pending invites'),
    };
  }
}

/**
 * Cancel/delete an invite
 */
export async function cancelInvite(
  inviteId: string
): Promise<InviteResult<null>> {
  try {
    const { error } = await getSupabase()
      .from('business_invites')
      .delete()
      .eq('id', inviteId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to cancel invite'),
    };
  }
}

/**
 * Resend an invite (extends expiration)
 */
export async function resendInvite(
  inviteId: string
): Promise<InviteResult<StaffInvite>> {
  try {
    const newExpiration = new Date();
    newExpiration.setDate(newExpiration.getDate() + 7);

    const { data, error } = await getSupabase()
      .from('business_invites')
      .update({
        expires_at: newExpiration.toISOString(),
        invite_code: generateInviteCode(), // Generate new code
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as StaffInvite, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to resend invite'),
    };
  }
}

// ============================================
// Invite Acceptance Functions
// ============================================

/**
 * Check if a user has a pending invite for any business
 * Called during sign-in/sign-up to auto-activate memberships
 */
export async function checkPendingInviteForEmail(
  email: string
): Promise<InviteResult<StaffInvite | null>> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from('business_invites')
      .select('*')
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: true }) // Oldest first
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[StaffInviteService] Error checking pending invite:', error);
      return { data: null, error };
    }

    return { data: data as StaffInvite | null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to check pending invite'),
    };
  }
}

/**
 * Accept an invite and create/link staff membership
 * Called automatically when user signs in/up with matching email
 */
export async function acceptInvite(
  inviteId: string,
  userId: string
): Promise<InviteResult<BusinessMember>> {
  try {
    // Get the invite
    const { data: invite, error: inviteError } = await getSupabase()
      .from('business_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      return { data: null, error: inviteError || new Error('Invite not found') };
    }

    const now = new Date().toISOString();

    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      return { data: null, error: new Error('Invite has expired') };
    }

    // Check if invite was already accepted
    if (invite.accepted_at) {
      return { data: null, error: new Error('Invite was already accepted') };
    }

    // Check if user already has a membership in this business
    const { data: existingMember } = await getSupabase()
      .from('business_members')
      .select('*')
      .eq('user_id', userId)
      .eq('business_id', invite.business_id)
      .maybeSingle();

    if (existingMember) {
      // User is already a member - just mark invite as accepted
      await getSupabase()
        .from('business_invites')
        .update({ accepted_at: now })
        .eq('id', inviteId);

      return { data: existingMember as BusinessMember, error: null };
    }

    // Create business membership
    const { data: membership, error: memberError } = await getSupabase()
      .from('business_members')
      .insert({
        user_id: userId,
        business_id: invite.business_id,
        role: invite.role,
        store_ids: invite.store_ids || [],
        invited_by: invite.invited_by,
        invited_at: invite.created_at,
        accepted_at: now,
        is_active: true,
      })
      .select()
      .single();

    if (memberError) {
      console.error('[StaffInviteService] Error creating membership:', memberError);
      return { data: null, error: memberError };
    }

    // Mark invite as accepted
    await getSupabase()
      .from('business_invites')
      .update({ accepted_at: now })
      .eq('id', inviteId);

    console.log('[StaffInviteService] Invite accepted, membership created:', membership.id);

    return { data: membership as BusinessMember, error: null };
  } catch (err) {
    console.error('[StaffInviteService] Error accepting invite:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to accept invite'),
    };
  }
}

/**
 * Process pending invites for a user after login/signup
 * This is called from the auth flow to auto-activate any pending invites
 */
export async function processInvitesForUser(
  userId: string,
  email: string
): Promise<InviteResult<BusinessMember[]>> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();

    // Get all pending invites for this email
    const { data: invites, error: fetchError } = await getSupabase()
      .from('business_invites')
      .select('*')
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .gt('expires_at', now);

    if (fetchError) {
      console.warn('[StaffInviteService] Error fetching pending invites:', fetchError);
      return { data: null, error: fetchError };
    }

    if (!invites || invites.length === 0) {
      return { data: [], error: null };
    }

    console.log(`[StaffInviteService] Found ${invites.length} pending invite(s) for ${email}`);

    const acceptedMemberships: BusinessMember[] = [];

    // Accept each invite
    for (const invite of invites) {
      const { data: membership, error: acceptError } = await acceptInvite(
        invite.id,
        userId
      );

      if (acceptError) {
        console.warn(`[StaffInviteService] Error accepting invite ${invite.id}:`, acceptError);
        continue; // Continue with other invites even if one fails
      }

      if (membership) {
        acceptedMemberships.push(membership);
      }
    }

    console.log(`[StaffInviteService] Accepted ${acceptedMemberships.length} invite(s)`);

    return { data: acceptedMemberships, error: null };
  } catch (err) {
    console.warn('[StaffInviteService] Error processing invites:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to process invites'),
    };
  }
}

// ============================================
// Business Member Functions
// ============================================

/**
 * Get all members of a business
 * @deprecated Use getStaffAccessData() for optimized single-query fetch
 */
export async function getBusinessMembers(
  businessId: string
): Promise<InviteResult<BusinessMember[]>> {
  try {
    const { data, error } = await getSupabase()
      .from('business_members')
      .select('id, user_id, role, is_active, created_at')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('role', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    return { data: data as BusinessMember[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch members'),
    };
  }
}

/**
 * Get user's membership for a specific business
 */
export async function getUserMembership(
  userId: string,
  businessId: string
): Promise<InviteResult<BusinessMember | null>> {
  try {
    const { data, error } = await getSupabase()
      .from('business_members')
      .select('*')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    return { data: data as BusinessMember | null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch membership'),
    };
  }
}

/**
 * Get all business memberships for a user
 * Used to show which businesses a staff member belongs to
 */
export async function getUserMemberships(
  userId: string
): Promise<InviteResult<BusinessMember[]>> {
  try {
    const { data, error } = await getSupabase()
      .from('business_members')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      return { data: null, error };
    }

    return { data: data as BusinessMember[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch memberships'),
    };
  }
}

/**
 * Update a member's role or store assignments
 */
export async function updateMember(
  memberId: string,
  updates: { role?: InviteRole; store_ids?: string[]; is_active?: boolean }
): Promise<InviteResult<BusinessMember>> {
  try {
    const { data, error } = await getSupabase()
      .from('business_members')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as BusinessMember, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update member'),
    };
  }
}

/**
 * Remove a member from a business (soft delete)
 * CRITICAL: Blocks removal of owners to prevent lockout
 */
export async function removeMember(
  memberId: string
): Promise<InviteResult<null>> {
  try {
    // First, check if the member is an owner - BLOCK if so
    const { data: member, error: fetchError } = await getSupabase()
      .from('business_members')
      .select('role, business_id')
      .eq('id', memberId)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    // CRITICAL: Never allow removing an owner
    if (member?.role === 'owner') {
      return {
        data: null,
        error: new Error('Owner cannot be removed from the business'),
      };
    }

    // Proceed with soft delete for non-owners
    const { error } = await getSupabase()
      .from('business_members')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to remove member'),
    };
  }
}

// ============================================
// Optimized Staff Access RPC
// ============================================

export interface StaffAccessData {
  pending_invites: StaffInvite[];
  team_members: BusinessMember[];
}

/**
 * Get all staff access data in a single RPC call
 * Returns both pending invites and team members
 */
export async function getStaffAccessData(
  businessId: string
): Promise<InviteResult<StaffAccessData>> {
  try {
    const { data, error } = await getSupabase().rpc('get_staff_access_data', {
      p_business_id: businessId,
    });

    if (error) {
      console.error('[StaffInviteService] RPC error:', error);
      return { data: null, error };
    }

    // Parse result - RPC returns JSON
    const result: StaffAccessData = {
      pending_invites: data?.pending_invites ?? [],
      team_members: data?.team_members ?? [],
    };

    return { data: result, error: null };
  } catch (err) {
    console.error('[StaffInviteService] Unexpected RPC error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch staff access data'),
    };
  }
}

// ============================================
// Access Check Functions
// ============================================

/**
 * Check if a user has staff access to a business (owner, manager, or staff)
 * This is used to determine if a user can access the app without their own subscription
 */
export async function hasStaffAccess(
  userId: string,
  businessId: string
): Promise<boolean> {
  try {
    const { data: membership } = await getSupabase()
      .from('business_members')
      .select('role, is_active')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    return membership !== null;
  } catch {
    return false;
  }
}

/**
 * Get user's role in a business
 */
export async function getUserRole(
  userId: string,
  businessId: string
): Promise<'owner' | 'manager' | 'staff' | null> {
  try {
    const { data: membership } = await getSupabase()
      .from('business_members')
      .select('role')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    return membership?.role as 'owner' | 'manager' | 'staff' | null;
  } catch {
    return null;
  }
}

/**
 * Check if a user has ANY staff membership (manager or staff role, not owner).
 * Used to determine if the user can bypass the paywall.
 * Staff/managers can access the app without their own subscription.
 */
export async function hasAnyStaffMembership(
  userId: string
): Promise<boolean> {
  try {
    const { data: memberships } = await getSupabase()
      .from('business_members')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('role', ['manager', 'staff']);

    return memberships !== null && memberships.length > 0;
  } catch {
    return false;
  }
}
