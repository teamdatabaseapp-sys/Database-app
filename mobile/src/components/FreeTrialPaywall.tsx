import React, { useState } from 'react';
import { View, Modal, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { getSubscriptionPlans, TRIAL_DURATION_DAYS } from '@/lib/trial-service';
import { Language } from '@/lib/types';
import { t } from '@/lib/i18n';
import {
  TrialHeader,
  TrialTimeline,
  TrialPlanCard,
  TrialBenefitsCard,
  TrialLegalBlock,
  TrialCTASection,
} from '@/components/premiumTrial';
import { useTheme } from '@/lib/ThemeContext';
import { startTrialInSupabase } from '@/services/authService';

interface FreeTrialPaywallProps {
  visible: boolean;
}

export function FreeTrialPaywall({ visible }: FreeTrialPaywallProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  const { colors } = useTheme();
  const startTrial = useStore((s) => s.startTrial);
  const restorePurchase = useStore((s) => s.restorePurchase);
  const markTrialOnboardingSeen = useStore((s) => s.markTrialOnboardingSeen);
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);

  const plans = getSubscriptionPlans(language, currency);

  const handleStartTrial = async () => {
    if (isProcessing || isRestoring) return;
    setIsProcessing(true);
    setTrialError(null);
    try {
      // Persist trial to Supabase — server-authoritative, survives reinstall.
      // Trial entitlement is ONLY granted after Supabase confirms the write.
      const { data: trialState, error } = await startTrialInSupabase(TRIAL_DURATION_DAYS);

      if (error) {
        console.warn('[FreeTrialPaywall] Trial activation failed:', error.message);
        setTrialError(t('trialActivationError', language));
        return;
      }

      if (trialState) {
        // Supabase confirmed — sync server-authoritative dates into local store.
        startTrial(selectedPlan); // marks hasSeenTrialOnboarding = true
        const trialEndDate = trialState.trial_end_at ? new Date(trialState.trial_end_at) : null;
        if (trialEndDate) {
          const user = useStore.getState().user;
          if (user) {
            useStore.setState({
              user: {
                ...user,
                trialStartDate: trialState.trial_started_at
                  ? new Date(trialState.trial_started_at)
                  : new Date(),
                trialEndDate,
              },
            });
          }
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreAccess = async () => {
    if (isProcessing || isRestoring) return;
    setIsRestoring(true);
    try {
      restorePurchase();
      markTrialOnboardingSeen();
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView
        edges={Platform.OS === 'ios' ? ['top', 'bottom'] : ['bottom']}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          bounces={false}
        >
          {/* Header section */}
          <TrialHeader language={language} />

          {/* Timeline: how trial works */}
          <TrialTimeline language={language} />

          {/* Plan selection */}
          <View style={{ marginHorizontal: 20, marginTop: 20 }}>
            {plans.map((plan) => (
              <TrialPlanCard
                key={plan.id}
                plan={plan}
                isSelected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id as 'monthly' | 'yearly')}
                language={language}
              />
            ))}
          </View>

          {/* Benefits */}
          <TrialBenefitsCard language={language} />

          {/* Legal */}
          <TrialLegalBlock language={language} />
        </ScrollView>

        {/* CTA pinned at bottom */}
        <TrialCTASection
          language={language}
          isProcessing={isProcessing}
          isRestoring={isRestoring}
          trialError={trialError}
          onStartTrial={handleStartTrial}
          onRestoreAccess={handleRestoreAccess}
        />
      </SafeAreaView>
    </Modal>
  );
}
