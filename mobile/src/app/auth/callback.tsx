/**
 * auth/callback.tsx
 *
 * Handles deep link from Supabase password reset email.
 * URL format: <scheme>://auth/callback#access_token=...&refresh_token=...&type=recovery
 *
 * Flow:
 *  1. App opens from password reset email link
 *  2. Expo Router navigates here via deep link
 *  3. We parse the URL hash for recovery tokens
 *  4. User enters a new password
 *  5. We set the session then call updateUser({ password })
 *  6. We sign out so user lands on auth screen with clean state
 *  7. User signs in with their new password
 *
 * GATING BYPASS: Sets isInPasswordRecovery=true in the store so that
 * FreeTrialPaywall and SubscriptionPaywall are suppressed while this
 * screen is active. Cleared on exit.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { ShieldCheck, Eye, EyeOff, X, CircleAlert, CheckCircle2, ArrowRight } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import { getSupabase } from '@/lib/supabaseClient';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface RecoveryTokens {
  access_token: string;
  refresh_token: string;
}

type ScreenState = 'loading' | 'form' | 'success' | 'error';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Extract implicit-flow tokens from the URL hash fragment.
 * Supabase emits: #access_token=...&refresh_token=...&type=recovery
 */
function extractImplicitTokens(rawUrl: string): RecoveryTokens | null {
  try {
    const hashPart = rawUrl.split('#')[1];
    if (!hashPart) return null;
    const params = new URLSearchParams(hashPart);
    if (params.get('type') !== 'recovery') return null;
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) return { access_token, refresh_token };
  } catch (e) {
    console.log('[auth/callback] extractImplicitTokens error:', e);
  }
  return null;
}

/**
 * Extract PKCE authorization code from query params.
 * Supabase emits: ?code=...&type=recovery (or just ?code=...)
 */
function extractPkceCode(rawUrl: string): string | null {
  try {
    const qStart = rawUrl.indexOf('?');
    if (qStart === -1) return null;
    const params = new URLSearchParams(rawUrl.substring(qStart + 1));
    return params.get('code');
  } catch (e) {
    console.log('[auth/callback] extractPkceCode error:', e);
  }
  return null;
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export default function AuthCallbackScreen() {
  const { primaryColor, isDark, colors } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const setIsInPasswordRecovery = useStore((s) => s.setIsInPasswordRecovery);

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [tokens, setTokens] = useState<RecoveryTokens | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedRef = useRef(false);

  // Activate recovery gate on mount — suppress paywalls while we're here
  useEffect(() => {
    setIsInPasswordRecovery(true);
    return () => {
      setIsInPasswordRecovery(false);
    };
  }, [setIsInPasswordRecovery]);

  const handleUrl = useCallback(async (rawUrl: string | null) => {
    if (!rawUrl || parsedRef.current) return;
    console.log('[auth/callback] Received URL:', rawUrl);

    // --- 1. Implicit flow: tokens in hash fragment ---
    const implicitTokens = extractImplicitTokens(rawUrl);
    if (implicitTokens) {
      console.log('[auth/callback] Implicit flow: recovery tokens found');
      parsedRef.current = true;
      setTokens(implicitTokens);
      setScreenState('form');
      return;
    }

    // --- 2. PKCE flow: exchange ?code= for session ---
    const code = extractPkceCode(rawUrl);
    if (code) {
      console.log('[auth/callback] PKCE flow: exchanging code for session...');
      // Mark parsed immediately so the 3s timeout cannot race to error state
      parsedRef.current = true;
      try {
        const { data, error: exchangeError } = await getSupabase().auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) {
          console.log('[auth/callback] PKCE exchange failed:', exchangeError?.message ?? 'no session returned');
          setScreenState('error');
          return;
        }
        console.log('[auth/callback] PKCE exchange success');
        setTokens({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        setScreenState('form');
      } catch (e) {
        console.log('[auth/callback] PKCE exchange exception:', e);
        setScreenState('error');
      }
      return;
    }

    // --- 3. Nothing usable in this URL ---
    if (!parsedRef.current) {
      console.log('[auth/callback] No valid recovery tokens found in URL');
      setScreenState('error');
    }
  }, []);

  // Listen for URL changes (warm start — app was already running)
  const liveUrl = Linking.useURL();
  useEffect(() => {
    if (liveUrl) handleUrl(liveUrl);
  }, [liveUrl, handleUrl]);

  // Check initial URL (cold start — app opened from link)
  useEffect(() => {
    Linking.getInitialURL().then((initialUrl) => {
      handleUrl(initialUrl);
    });

    const timer = setTimeout(() => {
      if (!parsedRef.current) {
        console.log('[auth/callback] Timeout: no valid recovery URL found');
        setScreenState('error');
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [handleUrl]);

  const handleUpdatePassword = async () => {
    setError('');

    if (!tokens) {
      setError(t('invalidRecoveryLink', language));
      return;
    }
    if (password.length < 6) {
      setError(t('newPasswordMinLength', language));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('newPasswordsDoNotMatch', language));
      return;
    }

    setIsSubmitting(true);
    console.log('[auth/callback] Setting recovery session...');

    try {
      // Step 1: Establish the recovery session
      const { error: sessionError } = await getSupabase().auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });

      if (sessionError) {
        console.log('[auth/callback] setSession error:', sessionError.message);
        setError(sessionError.message || t('invalidRecoveryLink', language));
        setIsSubmitting(false);
        return;
      }

      console.log('[auth/callback] Session set. Updating password...');

      // Step 2: Update the password
      const { error: updateError } = await getSupabase().auth.updateUser({
        password,
      });

      if (updateError) {
        console.log('[auth/callback] updateUser error:', updateError.message);
        setError(updateError.message || t('setNewPasswordButton', language));
        setIsSubmitting(false);
        return;
      }

      console.log('[auth/callback] Password updated. Signing out for clean session...');

      // Step 3: Sign out so user lands on auth screen with clean state.
      // This prevents the trial paywall from appearing after recovery
      // because the user will be unauthenticated until they sign in fresh.
      await getSupabase().auth.signOut();

      console.log('[auth/callback] Password updated successfully');
      setScreenState('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      console.log('[auth/callback] Unexpected error:', msg);
      setError(msg);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsInPasswordRecovery(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

  const handleOpenApp = () => {
    setIsInPasswordRecovery(false);
    // Guard: window is only available in a web context
    if (typeof window === 'undefined') return;
    if (isDev) {
      // Preview: redirect to the Expo web login page (no custom scheme)
      const previewBase = process.env.EXPO_PUBLIC_PREVIEW_CALLBACK_URL?.replace('/auth/callback', '') ?? 'https://sdtjvohthaqo.dev.vibecode.run';
      window.location.href = previewBase;
    } else {
      // Production: deep link into the native app
      window.location.href = 'database://auth/callback';
    }
  };

  // ── Loading ──
  if (screenState === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={{ color: isDark ? colors.textSecondary : '#64748B', marginTop: 16, fontSize: 15 }}>
          {t('verifyingResetLink', language)}
        </Text>
      </View>
    );
  }

  // ── Invalid / expired link ──
  if (screenState === 'error') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top', 'bottom']}>
        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
            <CircleAlert size={44} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: isDark ? colors.text : '#1E293B', textAlign: 'center', marginBottom: 12, letterSpacing: -0.3 }}>
            {t('linkExpired', language)}
          </Text>
          <Text style={{ fontSize: 15, color: isDark ? colors.textSecondary : '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
            {t('invalidRecoveryLink', language)}
          </Text>
          <Pressable
            onPress={handleClose}
            style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
              {t('backToLogin', language)}
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Success ──
  if (screenState === 'success') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top', 'bottom']}>
        <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>

          {/* Success icon */}
          <Animated.View
            entering={ZoomIn.springify().damping(12).mass(0.8)}
            style={{
              width: 100,
              height: 100,
              borderRadius: 32,
              backgroundColor: primaryColor + '15',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
            }}
          >
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              backgroundColor: primaryColor + '25',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircle2 size={40} color={primaryColor} strokeWidth={2} />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(180).duration(350)}
            style={{ fontSize: 28, fontWeight: '800', color: isDark ? colors.text : '#0F172A', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 }}
          >
            {t('passwordResetSuccess', language)}
          </Animated.Text>

          {/* Description */}
          <Animated.Text
            entering={FadeInDown.delay(260).duration(350)}
            style={{ fontSize: 16, color: isDark ? colors.textSecondary : '#64748B', textAlign: 'center', lineHeight: 24, marginBottom: 48 }}
          >
            {t('passwordResetSuccessDescription', language)}
          </Animated.Text>

          {/* Divider */}
          <Animated.View
            entering={FadeInDown.delay(320).duration(300)}
            style={{ width: '100%' }}
          >
            {/* Sign In Card */}
            <View style={{
              backgroundColor: isDark ? colors.card : '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 16,
              elevation: 4,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? colors.textSecondary : '#94A3B8', textAlign: 'center', letterSpacing: 0.5, marginBottom: 16, textTransform: 'uppercase' }}>
                {t('passwordResetSuccess', language)}
              </Text>
              <Pressable
                onPress={handleOpenApp}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? primaryColor + 'DD' : primaryColor,
                  borderRadius: 14,
                  paddingVertical: 18,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>
                  {isDev ? t('backToLogin', language) : 'Open App'}
                </Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Set New Password Form ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#FFFFFF' }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? colors.border : '#F1F5F9',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <ShieldCheck size={20} color={primaryColor} />
          <Text style={{ color: isDark ? colors.text : '#1E293B', fontSize: 17, fontWeight: '700', marginLeft: 8 }}>
            {t('setNewPasswordTitle', language)}
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          hitSlop={8}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.card : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} color={isDark ? colors.textSecondary : '#64748B'} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(300)}>
            {/* Hero icon */}
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              backgroundColor: primaryColor + '18',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}>
              <ShieldCheck size={36} color={primaryColor} />
            </View>

            <Text style={{ fontSize: 24, fontWeight: '800', color: isDark ? colors.text : '#1E293B', marginBottom: 8, letterSpacing: -0.3 }}>
              {t('setNewPasswordTitle', language)}
            </Text>
            <Text style={{ fontSize: 14, color: isDark ? colors.textSecondary : '#64748B', lineHeight: 20, marginBottom: 32 }}>
              {t('setNewPasswordDescription', language)}
            </Text>

            {/* New Password */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? colors.textSecondary : '#374151', marginBottom: 8 }}>
              {t('newPassword', language)}
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.card : '#F8FAFC',
              borderWidth: 1,
              borderColor: isDark ? colors.border : '#E2E8F0',
              borderRadius: 12,
              paddingHorizontal: 14,
              marginBottom: 16,
            }}>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                placeholder="••••••••"
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="new-password"
                autoCorrect={false}
                selectionColor={primaryColor}
                style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: isDark ? colors.text : '#1E293B' }}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} style={{ padding: 4 }}>
                {showPassword
                  ? <EyeOff size={18} color={isDark ? '#475569' : '#94A3B8'} />
                  : <Eye size={18} color={isDark ? '#475569' : '#94A3B8'} />}
              </Pressable>
            </View>

            {/* Confirm Password */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? colors.textSecondary : '#374151', marginBottom: 8 }}>
              {t('confirmNewPassword', language)}
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.card : '#F8FAFC',
              borderWidth: 1,
              borderColor: isDark ? colors.border : '#E2E8F0',
              borderRadius: 12,
              paddingHorizontal: 14,
              marginBottom: 24,
            }}>
              <TextInput
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
                placeholder="••••••••"
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                autoComplete="new-password"
                autoCorrect={false}
                selectionColor={primaryColor}
                style={{ flex: 1, paddingVertical: 14, fontSize: 16, color: isDark ? colors.text : '#1E293B' }}
              />
              <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8} style={{ padding: 4 }}>
                {showConfirm
                  ? <EyeOff size={18} color={isDark ? '#475569' : '#94A3B8'} />
                  : <Eye size={18} color={isDark ? '#475569' : '#94A3B8'} />}
              </Pressable>
            </View>

            {error ? (
              <Animated.View entering={FadeInDown.duration(200)} style={{ marginBottom: 16, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12 }}>
                <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', fontWeight: '500' }}>{error}</Text>
              </Animated.View>
            ) : null}

            <Pressable
              onPress={handleUpdatePassword}
              disabled={isSubmitting || !password || !confirmPassword}
              style={({ pressed }) => ({
                backgroundColor: isSubmitting || !password || !confirmPassword
                  ? (isDark ? '#334155' : '#CBD5E1')
                  : pressed ? primaryColor + 'DD' : primaryColor,
                borderRadius: 14,
                paddingVertical: 18,
                alignItems: 'center',
              })}
            >
              {isSubmitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                    {t('setNewPasswordButton', language)}
                  </Text>
              }
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
