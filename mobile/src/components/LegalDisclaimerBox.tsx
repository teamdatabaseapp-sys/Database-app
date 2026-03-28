import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Check, X, Scale } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  CURRENT_TERMS_VERSION,
  TERMS_LAST_UPDATED,
  COMPANY_INFO,
  getArbitrationAgreement,
  getIndemnification,
  getLimitationOfLiability,
  getPrivacyPolicy,
  getTermsOfService,
  getLegalDisclaimer,
  getGiftCardTerms,
  getGiftCardTermsTitle,
  getOnlineBookingTerms,
  getPlatformRoleClause,
  getPlatformRoleTitle,
  getCookiePolicySection,
} from '@/lib/legal-content';
import { cn } from '@/lib/cn';
import { LegalContentRenderer } from '@/components/LegalContentRenderer';
import { t } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { Language } from '@/lib/types';

// Sign-up Terms: aligned with Settings Legal Documents (12-section structure)
// Section 1: Arbitration Agreement
// Section 2: Cookie Policy
// Section 3: Email & Campaign Compliance
// Section 4: Gift Cards & Stored Value
// Section 5: Indemnification
// Section 6: Legal Disclaimer
// Section 7: Limitation of Liability
// Section 8: Online Booking System Terms
// Section 9: Pricing Notice
// Section 10: Privacy Policy
// Section 11: Platform Role & Responsibility
// Section 12: Terms of Service

function buildSections(language: Language) {
  return [
    {
      sectionNumber: 1,
      title: t('arbitrationAgreement', language),
      content: getArbitrationAgreement(language),
    },
    {
      sectionNumber: 2,
      title: t('cookiePolicy', language),
      content: [1, 2, 3, 4, 5, 6, 7, 8].map(n => getCookiePolicySection(language, n)).join('\n\n'),
    },
    {
      sectionNumber: 3,
      title: t('emailLegalDisclaimerTitle', language),
      content: t('legalEmailComplianceContent', language),
    },
    {
      sectionNumber: 4,
      title: getGiftCardTermsTitle(language),
      content: getGiftCardTerms(language),
    },
    {
      sectionNumber: 5,
      title: t('indemnification', language),
      content: getIndemnification(language),
    },
    {
      sectionNumber: 6,
      title: t('legalDisclaimer', language),
      content: getLegalDisclaimer(language),
    },
    {
      sectionNumber: 7,
      title: t('limitationOfLiability', language),
      content: getLimitationOfLiability(language),
    },
    {
      sectionNumber: 8,
      title: t('onlineBookingTermsTitle', language),
      content: getOnlineBookingTerms(language),
    },
    {
      sectionNumber: 9,
      title: t('pricingDisclaimerTitle', language),
      content: t('legalPricingContent', language),
    },
    {
      sectionNumber: 10,
      title: t('privacyPolicy', language),
      content: getPrivacyPolicy(language),
    },
    {
      sectionNumber: 11,
      title: getPlatformRoleTitle(language),
      content: getPlatformRoleClause(language),
    },
    {
      sectionNumber: 12,
      title: t('termsOfService', language),
      content: getTermsOfService(language),
    },
  ];
}

interface LegalDisclaimerBoxProps {
  isAccepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
}

export function LegalDisclaimerBox({ isAccepted, onAcceptChange }: LegalDisclaimerBoxProps) {
  const [showTermsModal, setShowTermsModal] = useState(false);
  const language = useStore((s) => s.language) as Language;

  console.log('[LegalDisclaimerBox] LANGUAGE ACTIVE:', language);

  const sections = buildSections(language);

  return (
    <>
      {/* Compact Legal Disclaimer Box */}
      <Animated.View
        entering={FadeIn.delay(400).duration(400)}
        className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4"
      >
        {/* Header */}
        <View className="flex-row items-center mb-3">
          <View className="w-8 h-8 bg-teal-100 rounded-lg items-center justify-center mr-2">
            <Scale size={16} color="#0D9488" />
          </View>
          <View className="flex-1">
            <Text className="text-slate-700 font-semibold text-sm">
              {t('legalDisclaimerTitle', language)}
            </Text>
            <Text className="text-slate-400 text-xs">v{CURRENT_TERMS_VERSION}</Text>
          </View>
        </View>

        {/* Brief Summary */}
        <Text className="text-slate-500 text-xs leading-4 mb-3">
          {t('iAgreeToTerms', language)}. {t('faceIdPrivacyNotice', language)}
        </Text>

        {/* Checkbox and Read Full Terms Row */}
        <View className="flex-row items-center justify-between">
          {/* Acceptance Checkbox */}
          <Pressable
            onPress={() => onAcceptChange(!isAccepted)}
            className="flex-row items-center flex-1"
          >
            <View
              className={cn(
                'w-5 h-5 rounded border-2 items-center justify-center mr-2',
                isAccepted ? 'bg-teal-500 border-teal-500' : 'border-slate-300 bg-white'
              )}
            >
              {isAccepted && <Check size={12} color="#fff" strokeWidth={3} />}
            </View>
            <Text className="text-slate-600 text-xs flex-1">
              {t('iAcceptThe', language)}{' '}
              <Text className="text-teal-600 font-medium">
                {t('termsAndConditionsLink', language)}
              </Text>
            </Text>
          </Pressable>

          {/* Read Full Terms Link */}
          <Pressable
            onPress={() => setShowTermsModal(true)}
            className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-lg active:bg-slate-200"
          >
            <FileText size={12} color="#64748B" />
            <Text className="text-slate-600 text-xs font-medium ml-1">
              {t('readFullTerms', language)}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Full Terms Modal */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
            <View className="flex-1">
              <Text className="text-slate-800 font-bold text-lg">
                {t('termsAndConditions', language)}
              </Text>
              <Text className="text-slate-400 text-xs">
                {t('versionLabel', language)} {CURRENT_TERMS_VERSION} • {t('lastUpdatedLabel', language)} {TERMS_LAST_UPDATED}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowTermsModal(false)}
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
            >
              <X size={20} color="#64748B" />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
          >
            {/* Table of Contents */}
            <View className="bg-slate-50 rounded-xl p-4 mb-6">
              <Text className="text-slate-800 font-bold text-base mb-3">
                {t('tableOfContents', language)}
              </Text>
              {sections.map((section) => (
                <Text
                  key={section.sectionNumber}
                  className="text-slate-600 text-sm py-1"
                >
                  {t('section', language)} {section.sectionNumber}: {section.title}
                </Text>
              ))}
            </View>

            {/* All Sections */}
            {sections.map((section, index) => (
              <View key={section.sectionNumber} className={index > 0 ? 'mt-8' : ''}>
                {/* Section Header */}
                <View className="bg-teal-50 rounded-xl p-4 mb-4">
                  <Text className="text-teal-700 font-bold text-base">
                    {t('section', language)} {section.sectionNumber}: {section.title.toUpperCase()}
                  </Text>
                </View>

                {/* Section Content */}
                <LegalContentRenderer
                  content={section.content}
                  bodyColor="#334155"
                />

                {/* Section Divider */}
                {index < sections.length - 1 && (
                  <View className="border-b border-slate-200 mt-8" />
                )}
              </View>
            ))}

            {/* Important Acknowledgments */}
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-8">
              <Text className="text-amber-700 font-bold text-sm mb-2">
                {t('keyPointsToKnow', language)}
              </Text>
              <View className="space-y-1">
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpSoftwarePlatformOnly', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpBusinessOperatorResponsibility', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpGiftCardResponsibility', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpMaxLiabilityLimit', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpMarketingConsent', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpDataStorageSecurity', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpArbitrationDisputes', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpNoPartnership', language)}
                </Text>
                <Text className="text-amber-800 text-xs leading-4">
                  • {t('kpAIInsightsOnly', language)}
                </Text>
              </View>
            </View>

            {/* Footer with Logo */}
            <View className="mt-8 pt-6 border-t border-slate-200 items-center">
              <Image
                source={require('../../public/image-1769784304.png')}
                style={{
                  width: 280,
                  height: 84,
                  resizeMode: 'contain',
                  tintColor: '#94A3B8',
                }}
              />
              <Text className="text-slate-400 text-xs text-center mt-2">
                2026 {COMPANY_INFO.name}, {t('companyAddress', language)}
              </Text>
              <Text className="text-slate-400 text-xs text-center mt-1">
                {t('forSupport', language)}: {COMPANY_INFO.email}
              </Text>
            </View>
          </ScrollView>

          {/* Footer with Accept Button */}
          <View className="px-5 pb-6 pt-3 border-t border-slate-100">
            <Pressable
              onPress={() => {
                onAcceptChange(true);
                setShowTermsModal(false);
              }}
              className="bg-teal-500 rounded-xl py-3.5 items-center active:bg-teal-600"
            >
              <Text className="text-white font-bold">
                {t('iUnderstandAndAccept', language)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTermsModal(false)}
              className="mt-2 py-2 items-center"
            >
              <Text className="text-slate-500 text-sm">{t('close', language)}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
