/**
 * useSupabaseAuth Hook
 *
 * Bridges Supabase authentication with the app's Zustand store.
 * Handles session persistence, auto-login on app reload, and state sync.
 *
 * IMPORTANT: This is the ONLY source of truth for authentication.
 * - No fake/mock sessions allowed
 * - Access is blocked without a valid Supabase session
 * - Business is hydrated on EVERY app start and EVERY sign-in
 *
 * Usage:
 * - Wrap your app with SupabaseAuthProvider in _layout.tsx
 * - Use useSupabaseAuth in components that need auth state
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { useStore } from '@/lib/store';
import { useQueryClient } from '@tanstack/react-query';
import {
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
  getCurrentUser,
  getProfile,
  updateProfile,
  onAuthStateChange,
  resetPassword as supabaseResetPassword,
  getBusiness,
  createOrGetBusiness,
  signInWithOAuth,
  type Business,
} from '@/services/authService';
import { processInvitesForUser } from '@/services/staffInviteService';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/supabaseClient';
import { BUSINESS_QUERY_KEY } from '@/hooks/useBusiness';

// ============================================
// Types
// ============================================

interface AuthState {
  isLoading: boolean;
  isInitialized: boolean;
  session: Session | null;
  profile: Profile | null;
  business: Business | null;
}

interface UseSupabaseAuthReturn extends AuthState {
  // Auth actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    metadata?: { name?: string; businessName?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;

  // Social / OAuth auth
  signInWithGoogle: () => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;
  signInWithApple: () => Promise<{ success: boolean; cancelled?: boolean; error?: string }>;

  // Profile actions
  refreshProfile: () => Promise<void>;
  updateUserProfile: (
    updates: Partial<Omit<Profile, 'id' | 'created_at'>>
  ) => Promise<{ success: boolean; error?: string }>;
}

// ============================================
// Context
// ============================================

const SupabaseAuthContext = createContext<UseSupabaseAuthReturn | null>(null);

// ============================================
// Hook Implementation
// ============================================

function useSupabaseAuthInternal(): UseSupabaseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isInitialized: false,
    session: null,
    profile: null,
    business: null,
  });

  // Store actions
  const storeLogout = useStore((s) => s.logout);
  const storeRegister = useStore((s) => s.register);
  const updateUserInfo = useStore((s) => s.updateUserInfo);

  // React Query client for updating business cache
  const queryClient = useQueryClient();

  // Track if we've initialized
  const initRef = useRef(false);

  /**
   * Load and ensure business exists for the user
   * Creates business if it doesn't exist (upsert pattern)
   */
  const loadOrCreateBusiness = useCallback(async (
    userId: string,
    email: string,
    profile: Profile | null
  ): Promise<Business | null> => {
    console.log('[useSupabaseAuth] loadOrCreateBusiness called for user:', userId);

    // First try to get existing business
    const { data: businessData, error: businessError } = await getBusiness();

    if (businessError) {
      console.log('[useSupabaseAuth] Error fetching business:', businessError.message);
    }

    if (businessData?.business) {
      console.log('[useSupabaseAuth] Business found:', businessData.business.id, businessData.business.name);
      return businessData.business;
    }

    // No business exists, create one
    console.log('[useSupabaseAuth] No business found, creating one...');
    const businessName = profile?.business_name || email.split('@')[0] || 'My Business';

    const { data: createResult, error: createError } = await createOrGetBusiness(
      userId,
      businessName,
      email
    );

    if (createError) {
      console.log('[useSupabaseAuth] Error creating business:', createError.message);
      return null;
    }

    if (createResult?.business) {
      console.log('[useSupabaseAuth] Business created:', createResult.business.id, createResult.business.name);
      return createResult.business;
    }

    console.log('[useSupabaseAuth] Failed to create business');
    return null;
  }, []);

  /**
   * Sync Supabase user + business to Zustand store
   */
  const syncUserToStore = useCallback(
    async (session: Session | null, profile: Profile | null, business: Business | null) => {
      console.log('[useSupabaseAuth] syncUserToStore called', {
        hasSession: !!session,
        hasProfile: !!profile,
        hasBusiness: !!business,
        userId: session?.user?.id,
        businessId: business?.id,
        businessName: business?.name,
      });

      if (session?.user) {
        // Create user in Zustand store to maintain compatibility
        const now = new Date();
        const createdAt = profile?.created_at ? new Date(profile.created_at) : now;

        // --- Server-backed trial entitlement ---
        // Only use dates from Supabase. If trial_started_at is null the user
        // has not started a trial yet — pass null so getTrialStatus correctly
        // returns canAccessApp = false and shows the FreeTrialPaywall.
        const trialStartDate = profile?.trial_started_at
          ? new Date(profile.trial_started_at)
          : null;
        const trialEndDate = profile?.trial_end_at
          ? new Date(profile.trial_end_at)
          : null;

        // Use business name from Supabase business table (highest priority)
        // Fall back to profile, then email prefix
        const businessName = business?.name || profile?.business_name || session.user.email?.split('@')[0] || 'My Business';

        storeRegister({
          email: session.user.email || '',
          name: businessName,
          role: 'business',
          businessName: businessName,
          // Hydrate business info from Supabase (CAN-SPAM compliance fields)
          businessAddress: business?.business_address || undefined,
          businessPhoneNumber: business?.business_phone_number || undefined,
          businessCountry: (business?.business_country as import('@/lib/types').CountryCode) || undefined,
          businessState: business?.business_state || undefined,
          emailFooterLanguage: (business?.email_footer_language as import('@/lib/types').Language) || undefined,
          businessTimezone: (business as unknown as Record<string, unknown>)?.timezone as string | undefined || undefined,
          membershipPlan: (profile?.membership_plan as 'monthly' | 'yearly') || 'monthly',
          membershipStartDate: createdAt,
          trialStartDate,
          trialEndDate,
          hasActivePaidSubscription: profile?.membership_status === 'active',
        });

        // Mark onboarding as seen if Supabase says the trial was already started.
        // This prevents the FreeTrialPaywall from re-appearing on existing users.
        if (profile?.trial_started_at) {
          useStore.getState().markTrialOnboardingSeen();
        }

        console.log('[useSupabaseAuth] User synced to store with businessName:', businessName,
          '| trial_started_at:', profile?.trial_started_at ?? 'not set',
          '| trial_end_at:', profile?.trial_end_at ?? 'not set');

        // Also update React Query cache for business
        if (business) {
          queryClient.setQueryData(BUSINESS_QUERY_KEY, business);
        }
      } else {
        console.log('[useSupabaseAuth] No session, logging out store');
        storeLogout();
        // Clear business cache on logout
        queryClient.setQueryData(BUSINESS_QUERY_KEY, null);
      }
    },
    [storeRegister, storeLogout, queryClient]
  );

  /**
   * Load profile from Supabase
   */
  const loadProfile = useCallback(async (): Promise<Profile | null> => {
    console.log('[useSupabaseAuth] Loading profile...');
    const { data, error } = await getProfile();

    if (error) {
      console.log('[useSupabaseAuth] Profile load error:', error);
      return null;
    }

    console.log('[useSupabaseAuth] Profile loaded:', data?.profile?.id);
    return data?.profile ?? null;
  }, []);

  /**
   * Helper to check if an error is a network-related error
   */
  const isNetworkError = (error: { message?: string } | null): boolean => {
    if (!error?.message) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('timeout')
    );
  };

  /**
   * Initialize auth state on mount - checks for existing session
   * CRITICAL: Also loads/creates business on every app start
   */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initializeAuth = async () => {
      console.log('[useSupabaseAuth] Initializing auth...');

      try {
        const { data, error } = await getCurrentUser();

        console.log('[useSupabaseAuth] getCurrentUser result:', {
          hasSession: !!data?.session,
          userId: data?.session?.user?.id,
          error: error?.message,
        });

        if (error) {
          // For network errors, log but don't treat as auth failure
          // The user might have a valid cached session that works once network is restored
          if (isNetworkError(error)) {
            console.log('[useSupabaseAuth] Network error during init, will retry on next interaction:', error.message);
          } else {
            console.log('[useSupabaseAuth] Session check error:', error.message);
          }
          setState({
            isLoading: false,
            isInitialized: true,
            session: null,
            profile: null,
            business: null,
          });
          storeLogout();
          return;
        }

        if (!data?.session) {
          console.log('[useSupabaseAuth] No existing session found');
          setState({
            isLoading: false,
            isInitialized: true,
            session: null,
            profile: null,
            business: null,
          });
          storeLogout();
          return;
        }

        console.log('[useSupabaseAuth] Existing session found, user ID:', data.session.user.id);

        // Load profile and attempt to fetch business in parallel to cut cold-start latency
        const [profile, existingBusinessResult] = await Promise.all([
          loadProfile(),
          getBusiness(),
        ]);

        let business: Business | null = null;
        if (existingBusinessResult.data?.business) {
          business = existingBusinessResult.data.business;
          console.log('[useSupabaseAuth] Business found:', business.id, business.name);
        } else {
          // No business yet — create one (rare path: new user or data loss)
          console.log('[useSupabaseAuth] No business found, creating one...');
          const businessName = profile?.business_name || data.session.user.email?.split('@')[0] || 'My Business';
          const { data: createResult, error: createError } = await createOrGetBusiness(
            data.session.user.id,
            businessName,
            data.session.user.email || ''
          );
          if (!createError && createResult?.business) {
            business = createResult.business;
            console.log('[useSupabaseAuth] Business created:', business.id, business.name);
          } else {
            console.log('[useSupabaseAuth] Error creating business:', createError?.message);
          }
        }

        setState({
          isLoading: false,
          isInitialized: true,
          session: data.session,
          profile,
          business,
        });

        // Sync to store with business data
        await syncUserToStore(data.session, profile, business);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Check if it's a network error
        const networkError =
          errorMessage.toLowerCase().includes('network request failed') ||
          errorMessage.toLowerCase().includes('failed to fetch') ||
          errorMessage.toLowerCase().includes('network');

        if (networkError) {
          console.log('[useSupabaseAuth] Network error during init, app will retry on interaction:', errorMessage);
        } else {
          console.log('[useSupabaseAuth] Init error:', err);
        }

        setState({
          isLoading: false,
          isInitialized: true,
          session: null,
          profile: null,
          business: null,
        });
        storeLogout();
      }
    };

    initializeAuth();
  }, [loadProfile, syncUserToStore, storeLogout]);

  /**
   * Listen for auth state changes
   */
  useEffect(() => {
    console.log('[useSupabaseAuth] Setting up auth state listener');

    const { unsubscribe } = onAuthStateChange(async (event, session) => {
      console.log('[useSupabaseAuth] Auth state changed:', event, 'user:', session?.user?.id);

      if (event === 'SIGNED_IN' && session) {
        const profile = await loadProfile();
        // CRITICAL: Load or create business on EVERY sign-in
        const business = await loadOrCreateBusiness(
          session.user.id,
          session.user.email || '',
          profile
        );
        setState((prev) => ({
          ...prev,
          session,
          profile,
          business,
        }));
        await syncUserToStore(session, profile, business);
      } else if (event === 'SIGNED_OUT') {
        console.log('[useSupabaseAuth] User signed out');
        setState((prev) => ({
          ...prev,
          session: null,
          profile: null,
          business: null,
        }));
        storeLogout();
        // Clear business cache
        queryClient.setQueryData(BUSINESS_QUERY_KEY, null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('[useSupabaseAuth] Token refreshed');
        setState((prev) => ({
          ...prev,
          session,
        }));
      } else if (event === 'PASSWORD_RECOVERY') {
        // Recovery session from password reset email — let auth/callback screen handle UX.
        // Just store the session; do NOT load business or redirect to main app.
        console.log('[useSupabaseAuth] PASSWORD_RECOVERY event — recovery session active');
        setState((prev) => ({
          ...prev,
          session: session ?? prev.session,
        }));
      } else if (event === 'USER_UPDATED' && session) {
        // Fired after supabase.auth.updateUser() — password has been changed.
        // Refresh session state so the app holds the latest token.
        console.log('[useSupabaseAuth] USER_UPDATED event — refreshing session');
        setState((prev) => ({
          ...prev,
          session,
        }));
      }
    });

    return () => {
      console.log('[useSupabaseAuth] Cleaning up auth state listener');
      unsubscribe();
    };
  }, [loadProfile, loadOrCreateBusiness, syncUserToStore, storeLogout, queryClient]);

  /**
   * Sign in with email/password
   */
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
      console.log('[useSupabaseAuth] signIn called for:', email);
      setState((prev) => ({ ...prev, isLoading: true }));

      const { data, error } = await supabaseSignIn(email, password);

      console.log('[useSupabaseAuth] signIn result:', {
        success: !error,
        userId: data?.session?.user?.id,
        error: error?.message,
      });

      if (error || !data?.session) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: error?.message || 'Sign in failed',
        };
      }

      const profile = await loadProfile();

      // Process any pending staff invites for this user
      // This auto-activates memberships if user was invited to a business
      try {
        const { data: acceptedMemberships } = await processInvitesForUser(
          data.session.user.id,
          data.session.user.email || email
        );
        if (acceptedMemberships && acceptedMemberships.length > 0) {
          console.log('[useSupabaseAuth] Auto-activated', acceptedMemberships.length, 'invite(s)');
        }
      } catch (inviteError) {
        // Don't block sign-in if invite processing fails
        console.warn('[useSupabaseAuth] Error processing invites:', inviteError);
      }

      // CRITICAL: Load or create business on sign-in
      const business = await loadOrCreateBusiness(
        data.session.user.id,
        data.session.user.email || email,
        profile
      );

      setState((prev) => ({
        ...prev,
        isLoading: false,
        session: data.session,
        profile,
        business,
      }));

      await syncUserToStore(data.session, profile, business);

      return { success: true };
    },
    [loadProfile, loadOrCreateBusiness, syncUserToStore]
  );

  /**
   * Sign up with email/password
   */
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { name?: string; businessName?: string }
    ): Promise<{ success: boolean; error?: string }> => {
      console.log('[useSupabaseAuth] signUp called for:', email);
      setState((prev) => ({ ...prev, isLoading: true }));

      const { data, error } = await supabaseSignUp(email, password);

      console.log('[useSupabaseAuth] signUp result:', {
        success: !error,
        userId: data?.user?.id,
        hasSession: !!data?.session,
        error: error?.message,
      });

      if (error || !data?.user) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return {
          success: false,
          error: error?.message || 'Sign up failed',
        };
      }

      // Update profile with business name if provided
      if (metadata?.businessName && data.session) {
        console.log('[useSupabaseAuth] Updating profile with business name');
        await updateProfile({
          business_name: metadata.businessName,
          email: email.toLowerCase().trim(),
        });
      }

      // Reload profile
      const profile = await loadProfile();

      // Process any pending staff invites for this user
      // This auto-activates memberships if user was invited to a business
      if (data.session) {
        try {
          const { data: acceptedMemberships } = await processInvitesForUser(
            data.session.user.id,
            data.session.user.email || email
          );
          if (acceptedMemberships && acceptedMemberships.length > 0) {
            console.log('[useSupabaseAuth] Auto-activated', acceptedMemberships.length, 'invite(s) on signup');
          }
        } catch (inviteError) {
          // Don't block sign-up if invite processing fails
          console.warn('[useSupabaseAuth] Error processing invites on signup:', inviteError);
        }
      }

      // CRITICAL: Create business on sign-up
      let business: Business | null = null;
      if (data.session) {
        const businessName = metadata?.businessName || email.split('@')[0] || 'My Business';
        const { data: businessResult } = await createOrGetBusiness(
          data.session.user.id,
          businessName,
          email
        );
        business = businessResult?.business ?? null;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        session: data.session,
        profile,
        business,
      }));

      if (data.session) {
        await syncUserToStore(data.session, profile, business);
      }

      return { success: true };
    },
    [loadProfile, syncUserToStore]
  );

  /**
   * Sign out
   */
  const signOut = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    console.log('[useSupabaseAuth] signOut called');
    setState((prev) => ({ ...prev, isLoading: true }));

    const { error } = await supabaseSignOut();

    console.log('[useSupabaseAuth] signOut result:', { success: !error, error: error?.message });

    if (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return {
        success: false,
        error: error.message || 'Sign out failed',
      };
    }

    // ONLY clear business on explicit sign out
    setState((prev) => ({
      ...prev,
      isLoading: false,
      session: null,
      profile: null,
      business: null,
    }));

    storeLogout();
    // Clear business cache on sign out
    queryClient.setQueryData(BUSINESS_QUERY_KEY, null);

    return { success: true };
  }, [storeLogout, queryClient]);

  /**
   * Reset password
   */
  const resetPassword = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      console.log('[useSupabaseAuth] resetPassword called for:', email);
      const { error } = await supabaseResetPassword(email);

      console.log('[useSupabaseAuth] resetPassword result:', {
        success: !error,
        error: error?.message,
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Password reset failed',
        };
      }

      return { success: true };
    },
    []
  );

  /**
   * Refresh profile from database
   */
  const refreshProfile = useCallback(async () => {
    console.log('[useSupabaseAuth] refreshProfile called');
    const profile = await loadProfile();
    setState((prev) => ({ ...prev, profile }));
  }, [loadProfile]);

  /**
   * Update user profile
   */
  const updateUserProfile = useCallback(
    async (
      updates: Partial<Omit<Profile, 'id' | 'created_at'>>
    ): Promise<{ success: boolean; error?: string }> => {
      console.log('[useSupabaseAuth] updateUserProfile called:', updates);
      const { data, error } = await updateProfile(updates);

      if (error || !data?.profile) {
        return {
          success: false,
          error: error?.message || 'Profile update failed',
        };
      }

      setState((prev) => ({ ...prev, profile: data.profile }));

      // Sync to Zustand store
      if (updates.business_name) {
        updateUserInfo({ businessName: updates.business_name });
      }

      return { success: true };
    },
    [updateUserInfo]
  );

  /**
   * Shared OAuth handler used by signInWithGoogle and signInWithApple.
   *
   * After a successful OAuth flow Supabase fires SIGNED_IN via onAuthStateChange,
   * which already handles profile/business loading and store sync. However, we
   * also handle it inline here so callers get an immediate synchronous result
   * and avoid depending on the event listener timing.
   *
   * Duplicate-account safety: Supabase deduplicates by verified email. If the
   * same email already exists (any provider or email/password), Supabase links
   * the accounts rather than creating a new one — no fragmented duplicates.
   */
  const handleOAuthSignIn = useCallback(
    async (
      provider: 'google' | 'apple'
    ): Promise<{ success: boolean; cancelled?: boolean; error?: string }> => {
      console.log(`[useSupabaseAuth] handleOAuthSignIn provider=${provider}`);
      setState((prev) => ({ ...prev, isLoading: true }));

      const { data, error } = await signInWithOAuth(provider);

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return { success: false, error: error.message };
      }

      if (!data?.session) {
        // User cancelled the browser flow — not an error
        setState((prev) => ({ ...prev, isLoading: false }));
        return { success: false, cancelled: true };
      }

      // Session is live — load profile + business then sync store
      const profile = await loadProfile();

      try {
        const { data: acceptedMemberships } = await processInvitesForUser(
          data.session.user.id,
          data.session.user.email ?? ''
        );
        if (acceptedMemberships && acceptedMemberships.length > 0) {
          console.log('[useSupabaseAuth] OAuth: auto-activated', acceptedMemberships.length, 'invite(s)');
        }
      } catch (inviteError) {
        console.warn('[useSupabaseAuth] OAuth: error processing invites:', inviteError);
      }

      const business = await loadOrCreateBusiness(
        data.session.user.id,
        data.session.user.email ?? '',
        profile
      );

      setState((prev) => ({
        ...prev,
        isLoading: false,
        session: data.session,
        profile,
        business,
      }));

      await syncUserToStore(data.session, profile, business);
      return { success: true };
    },
    [loadProfile, loadOrCreateBusiness, syncUserToStore]
  );

  const signInWithGoogle = useCallback(
    () => handleOAuthSignIn('google'),
    [handleOAuthSignIn]
  );

  const signInWithApple = useCallback(
    () => handleOAuthSignIn('apple'),
    [handleOAuthSignIn]
  );

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    signInWithGoogle,
    signInWithApple,
    refreshProfile,
    updateUserProfile,
  };
}

// ============================================
// Provider Component
// ============================================

interface SupabaseAuthProviderProps {
  children: ReactNode;
}

export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const auth = useSupabaseAuthInternal();

  return React.createElement(SupabaseAuthContext.Provider, { value: auth }, children);
}

// ============================================
// Consumer Hook
// ============================================

export function useSupabaseAuth(): UseSupabaseAuthReturn {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}
