/**
 * Authentication Service
 *
 * Handles all Supabase authentication operations.
 * This service should be used by UI components and hooks - never call getSupabase().auth directly in components.
 *
 * All functions return { data, error } pattern for consistent error handling.
 */

import { getSupabase, type Profile, type SupabaseUser, type Session } from '@/lib/supabaseClient';
import type { AuthError, AuthResponse, AuthTokenResponsePassword } from '@supabase/supabase-js';
import { ensureDefaultStore, getPrimaryStore } from '@/services/storesService';
import { createStaffMember, type CreateStaffInput } from '@/services/staffService';
import { createService } from '@/services/servicesService';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// Required for expo-auth-session to complete the OAuth flow on mobile
WebBrowser.maybeCompleteAuthSession();

// ============================================
// Types
// ============================================

export interface AuthResult<T = null> {
  data: T | null;
  error: AuthError | Error | null;
}

export interface SignUpResult {
  user: SupabaseUser | null;
  session: Session | null;
}

export interface SignInResult {
  user: SupabaseUser | null;
  session: Session | null;
}

export interface CurrentUserResult {
  user: SupabaseUser | null;
  session: Session | null;
}

export interface ProfileResult {
  profile: Profile | null;
}

// ============================================
// Authentication Functions
// ============================================

/**
 * Sign up a new user with email and password.
 * A profile row is automatically created via database trigger.
 *
 * @param email - User's email address
 * @param password - User's password (min 6 characters by Supabase default)
 * @returns Promise with user and session data, or error
 */
export async function signUp(
  email: string,
  password: string
): Promise<AuthResult<SignUpResult>> {
  try {
    const { data, error }: AuthResponse = await getSupabase().auth.signUp({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        user: data.user,
        session: data.session,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('An unexpected error occurred during sign up'),
    };
  }
}

/**
 * Sign in an existing user with email and password.
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise with user and session data, or error
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult<SignInResult>> {
  try {
    const { data, error }: AuthTokenResponsePassword =
      await getSupabase().auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        user: data.user,
        session: data.session,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('An unexpected error occurred during sign in'),
    };
  }
}

/**
 * Sign out the current user.
 * Clears the session from AsyncStorage.
 *
 * @returns Promise with null data on success, or error
 */
export async function signOut(): Promise<AuthResult<null>> {
  try {
    const { error } = await getSupabase().auth.signOut();

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('An unexpected error occurred during sign out'),
    };
  }
}

/**
 * Get the currently authenticated user and session.
 * Checks AsyncStorage for persisted session.
 *
 * @returns Promise with user and session data, or null if not authenticated
 */
export async function getCurrentUser(): Promise<AuthResult<CurrentUserResult>> {
  try {
    const { data, error } = await getSupabase().auth.getSession();

    if (error) {
      // If the refresh token is invalid/expired, clear it and treat as signed out
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('refresh token') || msg.includes('invalid_grant') || error.status === 400) {
        console.log('[authService] Stale refresh token detected, clearing session');
        await getSupabase().auth.signOut();
        return { data: { user: null, session: null }, error: null };
      }
      return { data: null, error };
    }

    if (!data.session) {
      return {
        data: { user: null, session: null },
        error: null,
      };
    }

    return {
      data: {
        user: data.session.user,
        session: data.session,
      },
      error: null,
    };
  } catch (err) {
    // AuthApiError for invalid refresh token — clear storage and treat as signed out
    const errMsg = err instanceof Error ? err.message.toLowerCase() : '';
    if (errMsg.includes('refresh token') || errMsg.includes('invalid_grant')) {
      console.log('[authService] Caught stale refresh token exception, clearing session');
      try { await getSupabase().auth.signOut(); } catch (_) { /* ignore */ }
      return { data: { user: null, session: null }, error: null };
    }
    return {
      data: null,
      error:
        err instanceof Error ? err : new Error('An unexpected error occurred getting current user'),
    };
  }
}

/**
 * Get the current user's ID if authenticated.
 * Convenience function for quick user ID checks.
 *
 * @returns Promise with user ID string, or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await getCurrentUser();
  return data?.user?.id ?? null;
}

// ============================================
// Profile Functions
// ============================================

/**
 * Get the current user's profile from the profiles table.
 *
 * @returns Promise with profile data, or error
 */
export async function getProfile(): Promise<AuthResult<ProfileResult>> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return {
        data: null,
        error: new Error('No authenticated user'),
      };
    }

    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return {
      data: { profile: data as Profile },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('An unexpected error occurred getting profile'),
    };
  }
}

/**
 * Update the current user's profile.
 *
 * @param updates - Partial profile fields to update
 * @returns Promise with updated profile, or error
 */
export async function updateProfile(
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<AuthResult<ProfileResult>> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return {
        data: null,
        error: new Error('No authenticated user'),
      };
    }

    const { data, error } = await getSupabase()
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return {
      data: { profile: data as Profile },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error:
        err instanceof Error ? err : new Error('An unexpected error occurred updating profile'),
    };
  }
}

// ============================================
// Session Listener
// ============================================

/**
 * Subscribe to authentication state changes.
 * Use this to react to sign in/out events.
 *
 * @param callback - Function called when auth state changes
 * @returns Unsubscribe function
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { unsubscribe: () => void } {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('[authService] Supabase not configured — skipping auth state listener');
    return { unsubscribe: () => {} };
  }
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return { unsubscribe: () => data.subscription.unsubscribe() };
}

/**
 * Password reset request.
 * Sends a password reset email to the user.
 *
 * @param email - User's email address
 * @returns Promise with null data on success, or error
 */
export async function resetPassword(email: string): Promise<AuthResult<null>> {
  try {
    // Environment-aware redirect URI for password reset:
    //
    // WHY NOT vibecode://auth/callback in preview:
    //   iOS Safari cannot follow a server-side 302 redirect (from Supabase's
    //   /auth/v1/verify endpoint) to a custom scheme (vibecode://).
    //   This is an OS security restriction — custom scheme redirects only work
    //   from direct user taps, not from cross-origin server redirects.
    //   Result: "Safari cannot open the page because the address is invalid."
    //
    // WHY NOT EXPO_PUBLIC_BASE_URL:
    //   EXPO_PUBLIC_BASE_URL is injected by Vibecode's runtime as the CODE SANDBOX
    //   URL (e.g. sijinkspteww.dev.vibecode.run). Visiting that URL in a browser
    //   shows the Vibecode platform UI ("Acquiring Sandbox") — NOT the Expo web app.
    //
    // FIX — Preview (__DEV__):
    //   Use EXPO_PUBLIC_PREVIEW_CALLBACK_URL — the stable Expo web preview URL
    //   (e.g. https://sdtjvohthaqo.dev.vibecode.run/auth/callback) set explicitly
    //   in mobile/.env. Supabase's 302 redirect to an HTTPS URL works fine in
    //   Safari, and the Expo web app at that URL handles the token hash correctly.
    //
    // Production:
    //   Use database://auth/callback (registered scheme in app.json).
    //   Supabase emails open in the native browser, which follows the 302 and
    //   hands off to iOS's URL scheme handler for database:// → opens the app.
    const previewCallbackUrl = process.env.EXPO_PUBLIC_PREVIEW_CALLBACK_URL;
    const redirectTo = __DEV__ && previewCallbackUrl
      ? previewCallbackUrl
      : AuthSession.makeRedirectUri({ scheme: 'database', path: 'auth/callback' });
    console.log('[authService] resetPassword redirectTo:', redirectTo);
    const { error } = await getSupabase().auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      { redirectTo }
    );

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error('An unexpected error occurred requesting password reset'),
    };
  }
}

// ============================================
// OAuth / Social Sign-In
// ============================================

export interface OAuthSignInResult {
  session: Session | null;
}

/**
 * Sign in with a social OAuth provider (Google or Apple) using Supabase.
 *
 * Flow:
 * 1. Build the redirect URI using expo-auth-session (works for both native + web)
 * 2. Ask Supabase for the provider authorization URL
 * 3. Open the browser via expo-web-browser
 * 4. Supabase redirects back to the app with the session fragment
 * 5. Exchange the tokens; Supabase stores the session in AsyncStorage automatically
 *
 * Security guarantees:
 * - The Supabase server validates the OAuth tokens — we never trust client-side identity alone
 * - We never store or expose any secrets in the frontend
 * - The returned session is from Supabase (the source of truth)
 *
 * Duplicate-account safety:
 * - Supabase auth uses the provider's verified email as the identity key
 * - If an account with that email already exists (any provider), Supabase links it
 *   automatically when "Link accounts with the same email" is enabled in the project settings
 *
 * @param provider - 'google' | 'apple'
 */
export async function signInWithOAuth(
  provider: 'google' | 'apple'
): Promise<AuthResult<OAuthSignInResult>> {
  try {
    // Build the redirect URI that Supabase will redirect back to after OAuth
    // AuthSession.makeRedirectUri auto-detects the correct scheme for native vs web
    const redirectTo = AuthSession.makeRedirectUri({
      scheme: 'database',
      path: 'auth/callback',
    });

    console.log(`[authService] signInWithOAuth provider=${provider} redirectTo=${redirectTo}`);

    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true, // We manage the browser ourselves via expo-web-browser
      },
    });

    if (error || !data?.url) {
      console.log('[authService] OAuth URL generation error:', error?.message);
      return { data: null, error: error ?? new Error('Failed to generate OAuth URL') };
    }

    console.log(`[authService] OAuth authorize URL: ${data.url}`);
    console.log(`[authService] Opening OAuth browser for ${provider}`);

    // Open the OAuth provider in an in-app browser
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    console.log(`[authService] WebBrowser result type:`, result.type);

    if (result.type !== 'success') {
      // User cancelled or browser was dismissed — not an error
      return { data: { session: null }, error: null };
    }

    // Extract the token fragment from the redirect URL
    const url = result.url;
    const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      console.log('[authService] No tokens in redirect URL — checking existing session');
      // Supabase may have set the session via onAuthStateChange already
      const { data: sessionData } = await getSupabase().auth.getSession();
      return {
        data: { session: sessionData?.session ?? null },
        error: null,
      };
    }

    console.log('[authService] Setting session from OAuth tokens');
    const { data: sessionData, error: sessionError } = await getSupabase().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      console.log('[authService] Error setting OAuth session:', sessionError.message);
      return { data: null, error: sessionError };
    }

    console.log('[authService] OAuth sign in successful, user:', sessionData?.session?.user?.id);
    return {
      data: { session: sessionData?.session ?? null },
      error: null,
    };
  } catch (err) {
    console.log('[authService] Unexpected error in signInWithOAuth:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('An unexpected error occurred during OAuth sign in'),
    };
  }
}

// ============================================
// Trial Functions
// ============================================

/**
 * Trial state as stored in Supabase profiles table.
 */
export interface TrialState {
  trial_started_at: string | null;
  trial_end_at: string | null;
}

/**
 * Activate the free trial for the current user.
 * This is a one-time operation: if trial_started_at is already set, returns an error.
 * trial_end_at = now + durationDays (computed server-side on the Supabase row).
 *
 * @param durationDays  Number of days the trial should last
 * @returns The updated TrialState or an error
 */
export async function startTrialInSupabase(
  durationDays: number
): Promise<AuthResult<TrialState>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[startTrialInSupabase] No authenticated user — session not ready');
      return { data: null, error: new Error('No authenticated user') };
    }

    console.log('[startTrialInSupabase] Starting trial for user:', userId);

    // Read current trial state — use maybeSingle() so a missing profile row
    // returns null instead of a PGRST116 error.
    const { data: existingProfile, error: readError } = await getSupabase()
      .from('profiles')
      .select('trial_started_at, trial_end_at')
      .eq('id', userId)
      .maybeSingle();

    if (readError) {
      console.warn('[startTrialInSupabase] Profile read error:', readError.message, readError.code);
      return { data: null, error: readError };
    }

    if (existingProfile?.trial_started_at) {
      // Trial already started — return current state, not an error
      console.log('[startTrialInSupabase] Trial already active, returning existing state');
      return {
        data: existingProfile as TrialState,
        error: null,
      };
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + durationDays);

    if (existingProfile === null) {
      // Profile row does not exist yet — create it with trial dates in one shot
      console.log('[startTrialInSupabase] Profile row missing, upserting with trial dates');
      const { data: inserted, error: insertError } = await getSupabase()
        .from('profiles')
        .upsert({
          id: userId,
          trial_started_at: now.toISOString(),
          trial_end_at: trialEnd.toISOString(),
        })
        .select('trial_started_at, trial_end_at')
        .single();

      if (insertError) {
        console.warn('[startTrialInSupabase] Profile upsert error:', insertError.message, insertError.code);
        return { data: null, error: insertError };
      }
      console.log('[startTrialInSupabase] Profile created and trial activated');
      return { data: inserted as TrialState, error: null };
    }

    // Profile exists but trial not started — update trial dates
    const { data: updated, error: updateError } = await getSupabase()
      .from('profiles')
      .update({
        trial_started_at: now.toISOString(),
        trial_end_at: trialEnd.toISOString(),
      })
      .eq('id', userId)
      .select('trial_started_at, trial_end_at')
      .single();

    if (updateError) {
      console.warn('[startTrialInSupabase] Profile update error:', updateError.message, updateError.code);
      return { data: null, error: updateError };
    }

    console.log('[startTrialInSupabase] Trial activated successfully');
    return { data: updated as TrialState, error: null };
  } catch (err) {
    console.warn('[startTrialInSupabase] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unexpected error starting trial'),
    };
  }
}

/**
 * Fetch the current trial state for the authenticated user from Supabase.
 */
export async function getTrialState(): Promise<AuthResult<TrialState>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { data: null, error: new Error('No authenticated user') };
    }

    const { data, error } = await getSupabase()
      .from('profiles')
      .select('trial_started_at, trial_end_at')
      .eq('id', userId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data as TrialState, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Unexpected error fetching trial state'),
    };
  }
}

/**
 * Business record in the public.businesses table
 */
export interface Business {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at?: string;
  // Business Information fields (CAN-SPAM compliance)
  business_address?: string | null;
  business_phone_number?: string | null;
  business_country?: string | null;
  business_state?: string | null;
  email_footer_language?: string | null;
}

/**
 * Input type for updating business information
 */
export interface UpdateBusinessInfoInput {
  business_address?: string;
  business_phone_number?: string;
  business_country?: string;
  business_state?: string;
  email_footer_language?: string;
  name?: string;
  timezone?: string;
}

export interface BusinessResult {
  business: Business | null;
  alreadyExists: boolean;
}

/**
 * Seeds a default service and staff member so a brand-new business is immediately
 * booking-ready. Safe to call in both the new-business and existing-business paths:
 *
 * - Checks staff count first — returns immediately if staff already exist (idempotent).
 * - New-business path: caller treats a non-null error as a hard failure.
 * - Existing-business path: caller logs the error but does not block login.
 *
 * Staff full_name is always 'Owner' — the Profile type carries no person name field,
 * so businessName is not a valid person-identity source.
 */
async function bootstrapNewBusinessIfNeeded(
  businessId: string,
  email: string,
  storeId?: string | null,
): Promise<{ error: Error | null }> {
  // Idempotency guard + fast path for established businesses
  const { count: staffCount, error: countError } = await getSupabase()
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (countError) {
    return { error: new Error('Bootstrap preflight check failed: ' + countError.message) };
  }
  if ((staffCount ?? 0) > 0) {
    console.log('[AuthService] Bootstrap: staff already exists — skipping.');
    return { error: null };
  }

  // Resolve storeId if not provided (existing-business retry path)
  let resolvedStoreId = storeId ?? null;
  if (!resolvedStoreId) {
    const { data: primaryStore } = await getPrimaryStore(businessId);
    resolvedStoreId = primaryStore?.id ?? null;
  }

  // 1. Default service: "New Service", 30 min, $0
  console.log('[AuthService] Bootstrap: creating default service...');
  const serviceResult = await createService(
    businessId,
    'New Service',
    '#0D9488',
    30,
    0,
    'USD',
    'service',
    null,
  );
  if (serviceResult.error) {
    console.log('[AuthService] Bootstrap FAILED — default service:', serviceResult.error.message);
    return { error: new Error('Failed to create default service: ' + serviceResult.error.message) };
  }
  console.log('[AuthService] Bootstrap: default service created:', serviceResult.data?.id);

  // 2. Default staff member (owner) — full_name is always 'Owner' because the Profile
  //    type has no person-name field. createStaffMember() auto-calls
  //    initStaffWeeklySchedule() which seeds 7 staff_weekly_schedule rows.
  console.log('[AuthService] Bootstrap: creating default staff...');
  const staffInput: CreateStaffInput = {
    business_id: businessId,
    full_name: 'Owner',
    email,
    store_ids: resolvedStoreId ? [resolvedStoreId] : [],
    service_ids: serviceResult.data?.id ? [serviceResult.data.id] : [],
  };
  const staffResult = await createStaffMember(staffInput);
  if (staffResult.error) {
    console.log('[AuthService] Bootstrap FAILED — default staff:', staffResult.error.message);
    return { error: new Error('Failed to create default staff: ' + staffResult.error.message) };
  }
  console.log('[AuthService] Bootstrap: default staff created:', staffResult.data?.id, '(weekly schedule auto-initialized)');

  return { error: null };
}

/**
 * Create or get business for the current user.
 * This ensures only one business per owner_id.
 *
 * @param ownerId - The auth user ID (session.user.id)
 * @param businessName - The business name from signup form
 * @param email - The user's email
 * @returns Promise with business data, or error
 */
export async function createOrGetBusiness(
  ownerId: string,
  businessName: string,
  email: string
): Promise<AuthResult<BusinessResult>> {
  try {
    console.log('[AuthService] createOrGetBusiness called:', { ownerId, businessName, email });

    // First, check if a business already exists for this owner.
    // Use limit(1) instead of maybeSingle() so multiple rows don't cause an error.
    const { data: existingRows, error: selectError } = await getSupabase()
      .from('businesses')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (selectError) {
      console.log('[AuthService] Error checking existing business:', selectError.message);
      return { data: null, error: selectError };
    }

    const existingBusiness = existingRows?.[0] ?? null;

    if (existingBusiness) {
      console.log('[AuthService] Business already exists for user:', existingBusiness.id);
      // Recovery bootstrap: repairs partial-failure state where business was created
      // but the initial staff/service seed failed. Staff count check short-circuits
      // immediately for all established businesses — no meaningful overhead.
      // Non-fatal: must not block login for existing users.
      const { error: recoveryError } = await bootstrapNewBusinessIfNeeded(existingBusiness.id, email);
      if (recoveryError) {
        console.log('[AuthService] Recovery bootstrap warning (non-fatal):', recoveryError.message);
      }
      return {
        data: {
          business: existingBusiness as Business,
          alreadyExists: true,
        },
        error: null,
      };
    }

    // No existing business, create a new one
    console.log('[AuthService] Creating new business for user:', ownerId);

    const { data: newBusiness, error: insertError } = await getSupabase()
      .from('businesses')
      .insert({
        owner_id: ownerId,
        name: businessName || 'My Business',
        email: email.toLowerCase().trim(),
        phone: null,
      })
      .select()
      .single();

    if (insertError) {
      console.log('[AuthService] Error creating business:', insertError.message);
      return { data: null, error: insertError };
    }

    console.log('[AuthService] Business created successfully:', newBusiness.id);

    // Auto-create a default store for the new business
    console.log('[AuthService] Creating default store for new business...');
    const storeResult = await ensureDefaultStore(newBusiness.id, businessName || 'My Business');
    if (storeResult.error) {
      console.log('[AuthService] Warning: Failed to create default store:', storeResult.error.message);
      // Don't fail the business creation if store creation fails - it can be created later
    } else {
      console.log('[AuthService] Default store created:', storeResult.data?.id);
    }

    // ── Critical bootstrap: seed default service + staff for immediate booking readiness ──
    // Fail-closed: if bootstrap fails, return an error so the caller surfaces it to the
    // user. The business row already exists at this point, so the next sign-in attempt
    // hits the alreadyExists: true → recovery bootstrap path above and completes setup.
    const defaultStoreId = storeResult.data?.id ?? null;
    const { error: bootstrapError } = await bootstrapNewBusinessIfNeeded(newBusiness.id, email, defaultStoreId);
    if (bootstrapError) {
      console.log('[AuthService] CRITICAL: New-business bootstrap failed:', bootstrapError.message);
      return {
        data: null,
        error: new Error('Account created but initial setup failed. Please sign in again to complete setup.'),
      };
    }
    // ── End bootstrap ──

    return {
      data: {
        business: newBusiness as Business,
        alreadyExists: false,
      },
      error: null,
    };
  } catch (err) {
    console.log('[AuthService] Unexpected error in createOrGetBusiness:', err);
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error('An unexpected error occurred creating business'),
    };
  }
}

/**
 * Get the current user's business from the businesses table.
 *
 * @returns Promise with business data, or error
 */
export async function getBusiness(): Promise<AuthResult<{ business: Business | null }>> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return {
        data: null,
        error: new Error('No authenticated user'),
      };
    }

    // Use limit(1) instead of maybeSingle() so multiple rows don't cause an error.
    const { data: rows, error } = await getSupabase()
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      return { data: null, error };
    }

    return {
      data: { business: (rows?.[0] as Business) ?? null },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error:
        err instanceof Error ? err : new Error('An unexpected error occurred getting business'),
    };
  }
}

/**
 * Helper to check if an error is a schema cache error (missing column)
 */
function isSchemaColumnMissingError(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  // Pattern: "Could not find the 'column_name' column of 'table' in the schema cache"
  return error.message.includes('in the schema cache') || error.code === 'PGRST204';
}

/**
 * Helper to extract missing column name from schema cache error
 */
function getMissingColumnFromError(error: { message?: string } | null): string | null {
  if (!error?.message) return null;
  const match = error.message.match(/Could not find the '([^']+)' column/);
  return match ? match[1] : null;
}

/**
 * Update business information for the current user's business.
 * This persists business address, phone, country, state, and email footer language to Supabase.
 *
 * This function handles schema cache errors gracefully by:
 * 1. Detecting missing column errors (PGRST204)
 * 2. Retrying with only the columns that exist
 * 3. Providing clear error messages to the user
 *
 * @param businessId - The business ID to update
 * @param updates - The fields to update
 * @returns Promise with updated business, or error
 */
export async function updateBusinessInfo(
  businessId: string,
  updates: UpdateBusinessInfoInput
): Promise<AuthResult<{ business: Business }>> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return {
        data: null,
        error: new Error('No authenticated user'),
      };
    }

    console.log('[AuthService] updateBusinessInfo called:', {
      businessId,
      userId,
      updates,
    });

    // Define the business info columns that need the migration
    const businessInfoColumns = [
      'business_address',
      'business_phone_number',
      'business_country',
      'business_state',
      'email_footer_language',
      'timezone',
    ];

    // Build update payload, only including non-undefined fields
    const updatePayload: Record<string, string | null> = {};
    if (updates.business_address !== undefined) {
      updatePayload.business_address = updates.business_address || null;
    }
    if (updates.business_phone_number !== undefined) {
      updatePayload.business_phone_number = updates.business_phone_number || null;
    }
    if (updates.business_country !== undefined) {
      updatePayload.business_country = updates.business_country || null;
    }
    if (updates.business_state !== undefined) {
      updatePayload.business_state = updates.business_state || null;
    }
    if (updates.email_footer_language !== undefined) {
      updatePayload.email_footer_language = updates.email_footer_language || null;
    }
    if (updates.name !== undefined) {
      updatePayload.name = updates.name || null;
    }
    if (updates.timezone !== undefined) {
      updatePayload.timezone = updates.timezone || null;
    }

    console.log('[AuthService] Executing Supabase update:', {
      table: 'businesses',
      updatePayload,
      where: { id: businessId, owner_id: userId },
    });

    // First attempt with all fields
    const { data, error, count } = await getSupabase()
      .from('businesses')
      .update(updatePayload)
      .eq('id', businessId)
      .eq('owner_id', userId) // RLS double-check: ensure user owns this business
      .select()
      .single();

    console.log('[AuthService] Supabase update result:', {
      hasData: !!data,
      dataId: data?.id,
      error: error?.message,
      count,
    });

    // Handle schema cache errors - missing column in database
    if (error && isSchemaColumnMissingError(error)) {
      const missingColumn = getMissingColumnFromError(error);
      console.log('[AuthService] Schema cache error detected. Missing column:', missingColumn);

      // If timezone column is missing, retry without it (column not yet migrated)
      if (missingColumn === 'timezone' && updatePayload.timezone !== undefined) {
        console.log('[AuthService] Retrying without timezone column (migration pending)');
        const { timezone: _tz, ...payloadWithoutTimezone } = updatePayload;
        const { data: retryData, error: retryError } = await getSupabase()
          .from('businesses')
          .update(payloadWithoutTimezone)
          .eq('id', businessId)
          .eq('owner_id', userId)
          .select()
          .single();
        if (!retryError && retryData) {
          console.log('[AuthService] Business info updated (without timezone - migration pending)');
          return { data: retryData, error: null };
        }
        if (retryError) {
          return { data: null, error: retryError };
        }
      }

      // Check if the missing column is one of the business info columns
      const isMissingBusinessInfoColumn = missingColumn && businessInfoColumns.includes(missingColumn);

      if (isMissingBusinessInfoColumn) {
        // Return a clear, actionable error message
        return {
          data: null,
          error: new Error(
            `Database migration required: The "${missingColumn}" column doesn't exist yet. ` +
            `Please run the "getSupabase()-add-business-country.sql" migration in your Supabase SQL Editor, ` +
            `then try again. This migration adds the columns needed for business information.`
          ),
        };
      }

      // For other missing columns, return generic error
      return {
        data: null,
        error: new Error(
          `Database schema error: Column "${missingColumn}" is missing. ` +
          `Please check your Supabase database schema.`
        ),
      };
    }

    if (error) {
      console.log('[AuthService] Error updating business info:', error.message, error.code, error.details);
      return { data: null, error };
    }

    if (!data) {
      console.log('[AuthService] No rows updated - business not found or not owned by user');
      return {
        data: null,
        error: new Error('Business not found or you do not have permission to update it'),
      };
    }

    console.log('[AuthService] Business info updated successfully:', data.id);

    return {
      data: { business: data as Business },
      error: null,
    };
  } catch (err) {
    console.log('[AuthService] Unexpected error in updateBusinessInfo:', err);
    return {
      data: null,
      error:
        err instanceof Error
          ? err
          : new Error('An unexpected error occurred updating business info'),
    };
  }
}

// ============================================
// Account Deletion
// ============================================

/**
 * Permanently delete the authenticated user's account and all associated data.
 * Calls DELETE /api/account on the backend which uses the Supabase Admin client
 * to remove the auth.users record, cascading to all downstream tables.
 *
 * Apple App Store compliance requirement: apps with account creation must offer deletion.
 */
export async function deleteAccount(): Promise<AuthResult<{ message: string }>> {
  try {
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const backendUrl =
      process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      'http://localhost:3000';

    console.log('[AuthService] Requesting account deletion...');

    const res = await fetch(`${backendUrl}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json() as { success?: boolean; message?: string; error?: string };

    if (!res.ok || !json.success) {
      const msg = json.error ?? 'Failed to delete account';
      console.log('[AuthService] Account deletion failed:', msg);
      return { data: null, error: new Error(msg) };
    }

    console.log('[AuthService] Account deleted successfully');
    return { data: { message: json.message ?? 'Account deleted' }, error: null };
  } catch (err) {
    console.log('[AuthService] Unexpected error in deleteAccount:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('An unexpected error occurred'),
    };
  }
}
