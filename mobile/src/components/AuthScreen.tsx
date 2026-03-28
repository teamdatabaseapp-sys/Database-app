import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Mail, Lock, User, Building2, ScanFace, X } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

// Define entering animations as module-level constants so the same object
// reference is passed on every render. On Expo Web, Reanimated re-runs an
// entering animation whenever it receives a *new* animation instance — if
// these are created inline (e.g. FadeIn.duration(350) inside JSX), every
// re-render (including each keystroke in the password field) causes the
// white panel to restart its fade-in from opacity:0, making the teal
// background flash through and blocking the UI. Stable references fix this.
const ANIM_FADE_IN_350 = FadeIn.duration(350);
const ANIM_FADE_IN_300 = FadeIn.duration(300);
const ANIM_FADE_IN_DOWN_300 = FadeInDown.duration(300);
import * as Application from 'expo-application';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LegalDisclaimerBox } from '@/components/LegalDisclaimerBox';
import { DataBaseLogo } from '@/components/DataBaseLogo';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { CURRENT_TERMS_VERSION } from '@/lib/legal-content';
import {
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  updateProfile,
  resetPassword as supabaseResetPassword,
  createOrGetBusiness,
} from '@/services/authService';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

/** Official multicolor Google G logo for sign-in buttons */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/** Apple logo for sign-in button (white, for dark backgrounds) */
function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 814 1000">
      <Path
        fill="#FFFFFF"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.8-155.5-127.4C46 790.2 0 663 0 541.8c0-194.3 127.4-297.5 252.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
      />
    </Svg>
  );
}


export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const recordTermsAcceptance = useStore((s) => s.recordTermsAcceptance);
  const storeRegister = useStore((s) => s.register);
  const language = useStore((s) => s.language) as Language;

  const { primaryColor } = useTheme();
  const { signInWithGoogle, signInWithApple } = useSupabaseAuth();
  const insets = useSafeAreaInsets();

  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

  /**
   * Handle social (Google / Apple) sign in
   */
  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    setError('');
    setSocialLoading(provider);

    console.log(`[Auth] Starting ${provider} OAuth sign in`);

    const result = provider === 'google'
      ? await signInWithGoogle()
      : await signInWithApple();

    setSocialLoading(null);

    if (result.cancelled) {
      // User dismissed the browser — silent, no error shown
      return;
    }

    if (!result.success) {
      const msg = result.error ?? t('socialSignInFailed', language);
      console.log(`[Auth] ${provider} sign in error:`, msg);
      setError(msg);
      return;
    }

    console.log(`[Auth] ${provider} sign in successful`);
    onAuthSuccess();
  };

  /**
   * Handle Sign In - ONLY uses Supabase Auth
   */
  const handleSignIn = async () => {
    setError('');
    setLoading(true);

    console.log('[Auth] Attempting sign in for:', email);

    const { data, error: signInError } = await supabaseSignIn(email, password);

    console.log('[Auth] Sign in result:', { data, error: signInError });

    if (signInError) {
      console.log('[Auth] Sign in error:', signInError.message);
      if (
        signInError.message?.toLowerCase().includes('network request failed') ||
        signInError.message?.toLowerCase().includes('failed to fetch') ||
        signInError.message?.toLowerCase().includes('network error')
      ) {
        setError(t('networkErrorSignIn', language));
      } else {
        setError(signInError.message || t('invalidCredentials', language));
      }
      setLoading(false);
      return;
    }

    if (!data?.session?.user) {
      console.log('[Auth] No session user after sign in');
      setError(t('signInFailed', language));
      setLoading(false);
      return;
    }

    console.log('[Auth] Sign in successful, user ID:', data.session.user.id);

    // Sync user to Zustand store for app compatibility
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    storeRegister({
      email: data.session.user.email || email,
      name: name || data.session.user.email?.split('@')[0] || 'User',
      role: 'business',
      businessName: businessName || 'My Business',
      membershipPlan: 'monthly',
      membershipStartDate: now,
      trialStartDate: now,
      trialEndDate: trialEnd,
      hasActivePaidSubscription: false,
    });

    setLoading(false);
    onAuthSuccess();
  };

  /**
   * Handle Sign Up - ONLY uses Supabase Auth
   */
  const handleSignUp = async () => {
    setError('');

    // Validation
    if (!termsAccepted) {
      setError(t('termsAcceptanceRequired', language));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch', language));
      return;
    }

    if (password.length < 6) {
      setError(t('passwordTooShort', language));
      return;
    }

    if (!email.includes('@')) {
      setError(t('invalidEmail', language));
      return;
    }

    setLoading(true);

    console.log('[Auth] Attempting sign up for:', email);

    const { data, error: signUpError } = await supabaseSignUp(email, password);

    console.log('[Auth] Sign up result:', { data, error: signUpError });

    if (signUpError) {
      console.log('[Auth] Sign up error:', signUpError.message);

      // Check for "user already registered" error
      if (
        signUpError.message?.toLowerCase().includes('already registered') ||
        signUpError.message?.toLowerCase().includes('already exists') ||
        signUpError.message?.toLowerCase().includes('user already')
      ) {
        setError(t('emailAlreadyInUse', language));
      } else if (
        signUpError.message?.toLowerCase().includes('network request failed') ||
        signUpError.message?.toLowerCase().includes('failed to fetch') ||
        signUpError.message?.toLowerCase().includes('network error')
      ) {
        setError(t('networkErrorSignUp', language));
      } else {
        setError(signUpError.message || t('signUpFailed', language));
      }

      setLoading(false);
      return;
    }

    if (!data?.user) {
      console.log('[Auth] No user after sign up');
      setError(t('signUpFailed', language));
      setLoading(false);
      return;
    }

    console.log('[Auth] Sign up successful, user ID:', data.user.id);

    // If no session (email confirmation required), inform the user
    if (!data.session) {
      console.log('[Auth] No session - email confirmation may be required');
      setError(t('emailConfirmationRequired', language));
      setLoading(false);
      return;
    }

    // Update profile with business name
    if (businessName && data.session) {
      console.log('[Auth] Updating profile with business name:', businessName);
      await updateProfile({
        business_name: businessName,
        email: email.toLowerCase().trim(),
      });
    }

    // Create business row in public.businesses
    console.log('[Auth] Creating business for user:', data.user.id);
    const { data: businessData, error: businessError } = await createOrGetBusiness(
      data.user.id,
      businessName || 'My Business',
      email
    );

    if (businessError) {
      console.log('[Auth] Error creating business:', businessError.message);
      // Don't block signup, just log the error
    } else if (businessData?.alreadyExists) {
      console.log('[Auth] Business already exists for user:', businessData.business?.id);
    } else {
      console.log('[Auth] Business created successfully:', businessData?.business?.id);
    }

    // Sync user to Zustand store for app compatibility
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    storeRegister({
      email: data.user.email || email,
      name: name || data.user.email?.split('@')[0] || 'User',
      role: 'business',
      businessName: businessName || 'My Business',
      membershipPlan: 'monthly',
      membershipStartDate: now,
      trialStartDate: now,
      trialEndDate: trialEnd,
      hasActivePaidSubscription: false,
    });

    // Record terms acceptance
    const appVersion = Application.nativeApplicationVersion || '1.0.0';
    const deviceOS = `${Platform.OS} ${Platform.Version}`;

    recordTermsAcceptance({
      userId: data.user.id,
      termsVersion: CURRENT_TERMS_VERSION,
      acceptedAt: new Date(),
      appVersion,
      deviceOS,
      explicitConsent: true,
    });

    setLoading(false);
    onAuthSuccess();
  };

  /**
   * Handle form submit
   */
  const handleSubmit = async () => {
    if (isLogin) {
      await handleSignIn();
    } else {
      await handleSignUp();
    }
  };

  /**
   * Handle password reset
   */
  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setError(t('emailRequiredForReset', language));
      return;
    }
    if (!resetEmail.includes('@')) {
      setError(t('invalidEmailForReset', language));
      return;
    }
    setError('');

    console.log('[Auth] Requesting password reset for:', resetEmail);

    const { error: resetError } = await supabaseResetPassword(resetEmail);

    if (resetError) {
      console.log('[Auth] Password reset error:', resetError.message);
      setError(resetError.message || t('resetEmailFailed', language));
      return;
    }

    console.log('[Auth] Password reset email sent');
    setResetSent(true);
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
      <View style={{ flex: 1, backgroundColor: primaryColor }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── HERO — compact, sits high in the teal band ── */}
        <View
          style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 0, paddingBottom: 40, marginTop: -28 }}
        >
          <DataBaseLogo size="medium" />
          <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: -24, letterSpacing: -0.3 }}>
            {isLogin ? t('welcome', language) : t('heroCreateAccount', language)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15, marginTop: 2, textAlign: 'center', lineHeight: 22 }}>
            {isLogin ? t('heroSignInSubtitle', language) : t('heroSignUpSubtitle', language)}
          </Text>
        </View>

        {/* ── WHITE PANEL — rounded top, extends flush to physical screen bottom ── */}
          <View
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
              marginTop: -24,
            }}
          >
            <ScrollView
              scrollEnabled={false}
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: Math.max(insets.bottom + 32, 52) }}
            >
              <Text style={{ color: '#1E293B', fontSize: 21, fontWeight: 'bold', marginBottom: 22 }}>
                {isLogin ? t('signIn', language) : t('signUp', language)}
              </Text>

              {!isLogin && (
                <>
                  <Input
                    label={t('fullName', language)}
                    placeholder={t('namePlaceholder', language)}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    icon={<User size={20} color="#64748B" />}
                  />
                  <Input
                    label={t('businessName', language)}
                    placeholder={t('businessNamePlaceholder', language)}
                    value={businessName}
                    onChangeText={setBusinessName}
                    autoCapitalize="words"
                    icon={<Building2 size={20} color="#64748B" />}
                  />
                </>
              )}

              <Input
                label={t('email', language)}
                placeholder={t('emailPlaceholder', language)}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Mail size={20} color="#64748B" />}
              />

              <Input
                label={t('password', language)}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="oneTimeCode"
                autoComplete="off"
                autoCorrect={false}
                spellCheck={false}
                icon={<Lock size={20} color="#64748B" />}
              />

              {!isLogin && (
                <Input
                  label={t('confirmPassword', language)}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  icon={<Lock size={20} color="#64748B" />}
                />
              )}

              {error ? (
                <Animated.View entering={ANIM_FADE_IN_DOWN_300}>
                  <Text className="text-red-500 text-sm mb-4 text-center">{error}</Text>
                </Animated.View>
              ) : null}

              <Button
                title={isLogin ? t('signIn', language) : t('createAccount', language)}
                onPress={handleSubmit}
                loading={loading}
                className="mt-2"
              />

              {/* Social sign-in divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500', marginHorizontal: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {t('orContinueWith', language)}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
              </View>

              {/* ── APPLE SIGN IN — always visible placeholder, auth wired separately ── */}
              <Pressable onPress={() => {}}>
                <View style={{
                  height: 52,
                  width: '100%',
                  backgroundColor: '#000000',
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  marginBottom: 12,
                }}>
                  <View style={{ width: 20, height: 20, marginRight: 10 }}>
                    <AppleIcon size={20} />
                  </View>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                    {t('continueWithApple', language)}
                  </Text>
                </View>
              </Pressable>

              {/* ── GOOGLE SIGN IN ── */}
              <Pressable
                onPress={() => handleSocialSignIn('google')}
                disabled={socialLoading !== null || loading}
                style={{ opacity: (socialLoading !== null || loading) ? 0.55 : 1 }}
              >
                <View style={{
                  height: 52,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                }}>
                  <View style={{ width: 20, height: 20, marginRight: 12 }}>
                    <GoogleIcon size={20} />
                  </View>
                  {socialLoading === 'google' ? (
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151' }}>{t('socialConnecting', language)}</Text>
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#374151' }}>{t('continueWithGoogle', language)}</Text>
                  )}
                </View>
              </Pressable>

              {isLogin && (
                <Pressable
                  style={{ marginTop: 16, paddingVertical: 4 }}
                  onPress={() => {
                    setResetEmail('');
                    setResetSent(false);
                    setError('');
                    setShowForgotPassword(true);
                  }}
                >
                  <Text style={{ color: primaryColor, textAlign: 'center', fontWeight: '500' }}>
                    {t('forgotPassword', language)}
                  </Text>
                </Pressable>
              )}

              <View className="flex-row items-center justify-center" style={{ marginTop: 16, marginBottom: 8 }}>
                <Text className="text-slate-500">
                  {isLogin ? t('dontHaveAccount', language) : t('alreadyHaveAccount', language)}{' '}
                </Text>
                <Pressable
                  onPress={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                >
                  <Text style={{ color: primaryColor, fontWeight: '600' }}>
                    {isLogin ? t('signUp', language) : t('signIn', language)}
                  </Text>
                </Pressable>
              </View>

              {/* Face ID Notice - Only shown during Sign Up on iOS */}
              {!isLogin && Platform.OS === 'ios' && (
                <View className="mt-4 p-3 bg-teal-50 rounded-xl flex-row items-center">
                  <ScanFace size={18} color="#0D9488" />
                  <Text className="text-teal-700 text-xs ml-2 flex-1">
                    {t('faceIdPrivacyNotice', language)}
                  </Text>
                </View>
              )}

              {/* Legal Disclaimer Box - Only shown during Sign Up */}
              {!isLogin && (
                <LegalDisclaimerBox isAccepted={termsAccepted} onAcceptChange={setTermsAccepted} />
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
          {/* Header — Lock icon + title LEFT, X close RIGHT */}
          <Animated.View
            entering={ANIM_FADE_IN_300}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Lock size={18} color={primaryColor} />
              <Text style={{ color: '#1E293B', fontSize: 17, fontWeight: '700', marginLeft: 8 }}>
                {t('resetPasswordTitle', language)}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowForgotPassword(false)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} color="#64748B" />
            </Pressable>
          </Animated.View>

          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
            {!resetSent ? (
              <>
                <Text style={{ color: '#1E293B', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
                  {t('forgotPasswordQuestion', language)}
                </Text>
                <Text style={{ color: '#64748B', fontSize: 14, lineHeight: 20, marginBottom: 28 }}>
                  {t('forgotPasswordDescription', language)}
                </Text>

                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 13, marginBottom: 8 }}>
                  {t('email', language)}
                </Text>
                <TextInput
                  value={resetEmail}
                  onChangeText={(v) => { setResetEmail(v); setError(''); }}
                  placeholder={t('enterEmailPlaceholder', language)}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#1E293B',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    fontSize: 16,
                    marginBottom: 4,
                  }}
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />

                {error ? (
                  <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 16, marginTop: 4 }}>{error}</Text>
                ) : <View style={{ marginBottom: 20 }} />}

                <Pressable
                  onPress={handleResetPassword}
                  style={{
                    backgroundColor: primaryColor,
                    borderRadius: 14,
                    paddingVertical: 17,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                    {t('sendResetLink', language)}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 28 }}>
                  <View style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    backgroundColor: primaryColor + '18',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                    flexShrink: 0,
                  }}>
                    <Mail size={28} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1, paddingTop: 2 }}>
                    <Text style={{ color: '#1E293B', fontSize: 20, fontWeight: '800', marginBottom: 5, letterSpacing: -0.3 }}>
                      {t('checkYourEmail', language)}
                    </Text>
                    <Text style={{ color: '#64748B', fontSize: 14, lineHeight: 20, marginBottom: 4 }}>
                      {t('resetInstructionsSent', language)}
                    </Text>
                    <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14 }}>
                      {resetEmail}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 18, marginBottom: 36 }}>
                  {t('emailNotFoundHint', language)}
                </Text>

                <Pressable
                  onPress={() => setShowForgotPassword(false)}
                  style={{
                    backgroundColor: primaryColor,
                    borderRadius: 14,
                    paddingVertical: 17,
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                    {t('backToLogin', language)}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => { setResetSent(false); setError(''); }}
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#64748B', fontWeight: '500', fontSize: 15 }}>
                    {t('tryDifferentEmail', language)}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
