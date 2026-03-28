import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Dimensions, Modal, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Check, Sparkles, RotateCcw, X, FileText, Scale } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Application from 'expo-application';
import { useStore } from '@/lib/store';
import { getSubscriptionPlans, getFeatureBlockedMessage } from '@/lib/trial-service';
import { SubscriptionPlanInfo } from '@/lib/types';
import { t, formatPrice } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { CURRENT_TERMS_VERSION, COMPANY_INFO } from '@/lib/legal-content';
import { LegalDisclaimerBox } from '@/components/LegalDisclaimerBox';
import { DataBaseLogo } from '@/components/DataBaseLogo';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SubscriptionPaywallProps {
  visible: boolean;
  onClose?: () => void;
  featureBlockedAction?: 'createClient' | 'addVisit' | 'exportData' | 'createCampaign' | 'sendEmail';
  allowDismiss?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SubscriptionPaywall({
  visible,
  onClose,
  featureBlockedAction,
  allowDismiss = false,
}: SubscriptionPaywallProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { primaryColor } = useTheme();

  const activateSubscription = useStore((s) => s.activateSubscription);
  const restorePurchase = useStore((s) => s.restorePurchase);
  const recordTermsAcceptance = useStore((s) => s.recordTermsAcceptance);
  const user = useStore((s) => s.user);
  const language = useStore((s) => s.language);
  const currency = useStore((s) => s.currency);

  const plans = getSubscriptionPlans(language, currency);
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSelectPlan = (planId: 'monthly' | 'yearly') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlan(planId);
  };

  const handleUpgrade = async () => {
    if (!termsAccepted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSequence(
      withSpring(0.95),
      withSpring(1)
    );

    setIsProcessing(true);

    // Record terms acceptance before processing subscription
    if (user) {
      const appVersion = Application.nativeApplicationVersion || '1.0.0';
      const deviceOS = `${Platform.OS} ${Platform.Version}`;

      recordTermsAcceptance({
        userId: user.id,
        termsVersion: CURRENT_TERMS_VERSION,
        acceptedAt: new Date(),
        appVersion,
        deviceOS,
        explicitConsent: true,
      });
    }

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Activate subscription
    activateSubscription(selectedPlan);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setIsProcessing(false);
    setTermsAccepted(false);
    onClose?.();
  };

  const handleRestorePurchase = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRestoring(true);

    // Simulate restore check
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const restored = restorePurchase();

    if (restored) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose?.();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    setIsRestoring(false);
  };

  const renderPlanCard = (plan: SubscriptionPlanInfo, index: number) => {
    const isSelected = selectedPlan === plan.id;

    return (
      <AnimatedPressable
        key={plan.id}
        entering={FadeInDown.delay(300 + index * 100).springify()}
        onPress={() => handleSelectPlan(plan.id)}
        className="mb-3"
      >
        <View
          className={`relative rounded-2xl border-2 overflow-hidden ${
            isSelected
              ? 'border-teal-500 bg-teal-50/60'
              : 'border-slate-200 bg-white/80'
          }`}
        >
          {/* Best Value Badge */}
          {plan.isMostPopular && (
            <View className="absolute top-0 right-0">
              <LinearGradient
                colors={['#0D9488', '#0F766E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderBottomLeftRadius: 12,
                }}
              >
                <View className="flex-row items-center">
                  <Sparkles size={12} color="#FFF" />
                  <Text className="text-white text-xs font-bold ml-1">{t('bestValue', language)}</Text>
                </View>
              </LinearGradient>
            </View>
          )}

          <View className="p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className={`text-lg font-bold ${isSelected ? 'text-teal-900' : 'text-slate-800'}`}>
                    {plan.name}
                  </Text>
                  {plan.savings && (
                    <View className="ml-2 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Text className="text-emerald-700 text-xs font-semibold">{plan.savings}</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-baseline mt-1">
                  <Text className={`text-2xl font-bold ${isSelected ? 'text-teal-800' : 'text-slate-700'}`}>
                    {formatPrice(plan.price, language, currency)}
                  </Text>
                  <Text className={`text-sm ml-1 ${isSelected ? 'text-teal-600' : 'text-slate-500'}`}>
                    /{plan.period}
                  </Text>
                  {plan.savingsAmount && (
                    <Text className={`text-xs ml-2 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`}>
                      ({t('savePer', language)} {plan.savingsAmount})
                    </Text>
                  )}
                </View>
                {/* Plan description */}
                {plan.description && (
                  <Text className={`text-xs mt-1 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`}>
                    {plan.description}
                  </Text>
                )}
              </View>

              {/* Selection indicator */}
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? primaryColor : '#CBD5E1',
                  backgroundColor: isSelected ? primaryColor : '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
              </View>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    );
  };

  const contextMessage = featureBlockedAction
    ? getFeatureBlockedMessage(featureBlockedAction, language)
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={allowDismiss ? onClose : undefined}
    >
      <View className="flex-1">
        {/* Semi-dark background overlay */}
        <Animated.View
          entering={FadeIn.duration(300)}
          className="absolute inset-0 bg-black/70"
        />

        {/* Content container */}
        <View className="flex-1 justify-end">
          <Animated.View
            entering={FadeInUp.delay(100).springify().damping(15)}
            className="bg-white rounded-t-3xl overflow-hidden"
            style={{ maxHeight: SCREEN_HEIGHT * 0.85 }}
          >
            {/* Dismiss button if allowed */}
            {allowDismiss && onClose && (
              <Pressable
                onPress={onClose}
                className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-100 rounded-full items-center justify-center"
              >
                <X size={18} color="#64748B" />
              </Pressable>
            )}

            {/* Header — exact same gradient/logo treatment as Login (AuthScreen) */}
            <LinearGradient
              colors={['#0D9488', '#0F766E', '#115E59']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingTop: 36, paddingBottom: 28 }}
            >
              {/* DataBase logo — full width, scales to container, same as Login */}
              <Animated.View
                entering={FadeInDown.delay(0).springify().damping(14)}
                style={{ marginBottom: 20, width: '100%', alignItems: 'center', paddingHorizontal: 24 }}
              >
                <DataBaseLogo size="large" />
              </Animated.View>

              <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
                <Animated.Text
                  entering={FadeInDown.delay(120).springify()}
                  style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 }}
                >
                  {featureBlockedAction
                    ? t('subscriptionRequired', language)
                    : t('freeTrialEnded', language)}
                </Animated.Text>

                <Animated.Text
                  entering={FadeInDown.delay(200).springify()}
                  style={{ color: 'rgba(255,255,255,0.80)', fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}
                >
                  {contextMessage || t('choosePlanToContinue', language)}
                </Animated.Text>
              </View>
            </LinearGradient>

            {/* Scrollable content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Plans */}
              <View className="px-5 pt-5 pb-2">
                {plans.map((plan, index) => renderPlanCard(plan, index))}
              </View>

            {/* Features — grouped enterprise sections */}
            <Animated.View
              entering={FadeInDown.delay(500).springify()}
              className="px-5 pb-4"
            >
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 14 }}>
                  {t('paywallEverythingIncluded', language)}
                </Text>

                {/* BUSINESS PLATFORM */}
                <View style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <Sparkles size={15} color={primaryColor} strokeWidth={2.5} />
                    </View>
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('paywallSectionBizPlatform', language)}</Text>
                  </View>
                  {[
                    t('paywallFeatureCRM', language),
                    t('paywallFeatureBooking', language),
                    t('paywallFeatureStaff', language),
                    t('paywallFeatureServices', language),
                  ].map((b, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 3 }}>
                      <Text style={{ color: primaryColor, fontSize: 15, lineHeight: 22, marginRight: 6, fontWeight: '600' }}>·</Text>
                      <Text style={{ color: '#475569', fontSize: 15, flex: 1, lineHeight: 22 }}>{b}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 14 }} />

                {/* MARKETING & REVENUE */}
                <View style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <Sparkles size={15} color={primaryColor} strokeWidth={2.5} />
                    </View>
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('paywallSectionMarketing', language)}</Text>
                  </View>
                  {[
                    t('paywallFeatureEmailCampaigns', language),
                    t('paywallFeatureDrip', language),
                    t('paywallFeaturePromotions', language),
                    t('paywallFeatureSocial', language),
                    t('paywallFeatureGiftLoyalty', language),
                  ].map((b, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 3 }}>
                      <Text style={{ color: primaryColor, fontSize: 15, lineHeight: 22, marginRight: 6, fontWeight: '600' }}>·</Text>
                      <Text style={{ color: '#475569', fontSize: 15, flex: 1, lineHeight: 22 }}>{b}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 14 }} />

                {/* AI & ANALYTICS */}
                <View style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <Sparkles size={15} color={primaryColor} strokeWidth={2.5} />
                    </View>
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('paywallSectionAI', language)}</Text>
                  </View>
                  {[
                    t('paywallFeatureAIPromo', language),
                    t('paywallFeatureAICampaigns', language),
                    t('paywallFeatureAIInsights', language),
                    t('paywallFeatureRevenue', language),
                  ].map((b, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 3 }}>
                      <Text style={{ color: primaryColor, fontSize: 15, lineHeight: 22, marginRight: 6, fontWeight: '600' }}>·</Text>
                      <Text style={{ color: '#475569', fontSize: 15, flex: 1, lineHeight: 22 }}>{b}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 14 }} />

                {/* GLOBAL PLATFORM */}
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <Sparkles size={15} color={primaryColor} strokeWidth={2.5} />
                    </View>
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{t('paywallSectionGlobal', language)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 3 }}>
                    <Text style={{ color: primaryColor, fontSize: 15, lineHeight: 22, marginRight: 6, fontWeight: '600' }}>·</Text>
                    <Text style={{ color: '#475569', fontSize: 15, flex: 1, lineHeight: 22 }}>{t('paywallFeature18Lang', language)}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Terms & Conditions Acceptance */}
            <View className="px-5 pb-2">
              <LegalDisclaimerBox
                isAccepted={termsAccepted}
                onAcceptChange={setTermsAccepted}
              />
            </View>

            {/* Action buttons */}
            <View className="px-5 pb-8">
              <AnimatedPressable
                style={buttonAnimatedStyle}
                onPress={handleUpgrade}
                disabled={isProcessing || isRestoring || !termsAccepted}
                className="overflow-hidden rounded-2xl"
              >
                <LinearGradient
                  colors={isProcessing || !termsAccepted ? ['#94A3B8', '#64748B'] : ['#0D9488', '#0F766E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    borderRadius: 16,
                    opacity: termsAccepted ? 1 : 0.7,
                  }}
                >
                  <Text className="text-white text-lg font-bold text-center px-4">
                    {isProcessing ? t('processing', language) : termsAccepted ? t('upgradeNow', language) : t('mustAcceptTerms', language)}
                  </Text>
                </LinearGradient>
              </AnimatedPressable>

              <Pressable
                onPress={handleRestorePurchase}
                disabled={isProcessing || isRestoring}
                className="mt-4 py-3 items-center"
              >
                <View className="flex-row items-center">
                  <RotateCcw size={16} color="#64748B" />
                  <Text className="text-slate-500 font-medium ml-2">
                    {isRestoring ? t('restoring', language) : t('restorePurchase', language)}
                  </Text>
                </View>
              </Pressable>
            </View>
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
