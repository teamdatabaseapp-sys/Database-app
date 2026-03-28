import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, FileText, Shield, Scale, AlertTriangle, Lock, ExternalLink, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import {
  CURRENT_TERMS_VERSION,
  TERMS_LAST_UPDATED,
  COMPANY_INFO,
  getDataStoragePolicy,
  getDeviceLimitPolicy,
  getMaximumLiabilityPolicy,
  getUseAtOwnRiskPolicy,
  getArbitrationAgreement,
  getIndemnification,
  getLimitationOfLiability,
  getPrivacyPolicy,
  getTermsOfService,
  getLegalDisclaimer,
} from '@/lib/legal-content';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/ThemeContext';
import * as Application from 'expo-application';
import { LegalContentRenderer } from '@/components/LegalContentRenderer';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface TermsAcceptanceModalProps {
  visible: boolean;
  onAccept: () => void;
  isReacceptance?: boolean;
  previousVersion?: string;
}

type DocumentSection = 'arbitration' | 'dataStorage' | 'deviceLimit' | 'disclaimer' | 'indemnification' | 'liability' | 'maxLiability' | 'privacy' | 'tos' | 'useAtOwnRisk';

function buildSections(language: Language): { id: DocumentSection; title: string; icon: typeof FileText; content: string }[] {
  return [
    { id: 'arbitration', title: t('arbitrationAgreement', language), icon: Scale, content: getArbitrationAgreement(language) },
    { id: 'dataStorage', title: t('dataStorageTitle', language), icon: Shield, content: getDataStoragePolicy(language) },
    { id: 'deviceLimit', title: t('deviceLimitTitle', language), icon: Lock, content: getDeviceLimitPolicy(language) },
    { id: 'indemnification', title: t('indemnification', language), icon: Lock, content: getIndemnification(language) },
    { id: 'disclaimer', title: t('legalDisclaimer', language), icon: AlertTriangle, content: getLegalDisclaimer(language) },
    { id: 'liability', title: t('limitationOfLiability', language), icon: Shield, content: getLimitationOfLiability(language) },
    { id: 'maxLiability', title: t('maximumLiabilityTitle', language), icon: AlertTriangle, content: getMaximumLiabilityPolicy(language) },
    { id: 'privacy', title: t('privacyPolicy', language), icon: Shield, content: getPrivacyPolicy(language) },
    { id: 'tos', title: t('termsOfService', language), icon: FileText, content: getTermsOfService(language) },
    { id: 'useAtOwnRisk', title: t('useAtOwnRiskTitle', language), icon: AlertTriangle, content: getUseAtOwnRiskPolicy(language) },
  ];
}

export function TermsAcceptanceModal({
  visible,
  onAccept,
  isReacceptance = false,
  previousVersion,
}: TermsAcceptanceModalProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [selectedSection, setSelectedSection] = useState<DocumentSection>('tos');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const { primaryColor } = useTheme();

  const user = useStore((s) => s.user);
  const recordTermsAcceptance = useStore((s) => s.recordTermsAcceptance);
  const language = useStore((s) => s.language) as Language;

  const sections = buildSections(language);

  const handleAccept = useCallback(async () => {
    if (!isChecked || !user) return;

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

    setIsChecked(false);
    onAccept();
  }, [isChecked, user, recordTermsAcceptance, onAccept]);

  const openDocument = (section: DocumentSection) => {
    setSelectedSection(section);
    setShowDocumentModal(true);
  };

  const currentDocument = sections.find((d) => d.id === selectedSection);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <SafeAreaView className="flex-1 bg-slate-900" edges={['top', 'bottom']}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="px-5 pt-6 pb-4"
        >
          <View className="flex-row items-center mb-2">
            <View className="w-12 h-12 rounded-2xl bg-teal-500/20 items-center justify-center mr-3">
              <Scale size={24} color="#14B8A6" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">
                {isReacceptance ? t('updatedTerms', language) : t('termsOfService', language)}
              </Text>
              <Text className="text-slate-400 text-sm">
                {t('legalAndDisclaimer', language)}
              </Text>
            </View>
          </View>

          {isReacceptance && previousVersion && (
            <View className="bg-amber-500/20 rounded-xl p-3 mt-3">
              <Text className="text-amber-400 text-sm font-medium">
                {t('termsUpdatedFrom', language)
                  .replace('{prev}', previousVersion)
                  .replace('{curr}', CURRENT_TERMS_VERSION)}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Important Notice */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="mx-5 mb-4 bg-slate-800/50 rounded-2xl p-4"
        >
          <Text className="text-slate-300 text-sm leading-5">
            {t('readAndUnderstandTerms', language)}
          </Text>
          <View className="flex-row items-center mt-2">
            <Text className="text-slate-500 text-xs">
              {t('lastUpdatedLabel', language)}: {TERMS_LAST_UPDATED} • {t('versionLabel', language)} {CURRENT_TERMS_VERSION}
            </Text>
          </View>
        </Animated.View>

        {/* Document Sections */}
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Animated.View
                key={section.id}
                entering={FadeInUp.delay(300 + index * 50).duration(400)}
              >
                <Pressable
                  onPress={() => openDocument(section.id)}
                  className="bg-slate-800 rounded-xl p-4 mb-3 flex-row items-center active:bg-slate-700"
                >
                  <View className="w-10 h-10 rounded-xl bg-slate-700 items-center justify-center mr-3">
                    <Icon size={20} color="#94A3B8" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{section.title}</Text>
                    <Text className="text-slate-400 text-xs mt-0.5">
                      {t('tapToReadFull', language)}
                    </Text>
                  </View>
                  <ExternalLink size={18} color="#64748B" />
                </Pressable>
              </Animated.View>
            );
          })}

          {/* Key Points Summary */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(400)}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mt-2"
          >
            <Text className="text-red-400 font-bold text-sm mb-2">
              {t('importantAcknowledgments', language)}
            </Text>
            <View className="space-y-2">
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackToolOnly', language)}
              </Text>
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackUseAtOwnRisk', language)}
              </Text>
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackDataThirdParty', language)}
              </Text>
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackMaxLiability', language)}
              </Text>
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackDeviceLimit', language)}
              </Text>
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackWaiverJuryTrial', language)}
              </Text>
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackWaiverClassAction', language)}
              </Text>
              <Text className="text-slate-300 text-xs leading-5">
                • {t('ackIndemnify', language)} {COMPANY_INFO.name}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Footer with Checkbox and Button */}
        <Animated.View
          entering={FadeIn.delay(700).duration(400)}
          className="px-5 pb-4 pt-3 border-t border-slate-800"
        >
          {/* Checkbox */}
          <Pressable
            onPress={() => setIsChecked(!isChecked)}
            className="flex-row items-start mb-4"
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: isChecked ? primaryColor : '#64748B',
                backgroundColor: isChecked ? primaryColor : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                marginTop: 2,
              }}
            >
              {isChecked && <Check size={16} color="#fff" strokeWidth={3} />}
            </View>
            <Text className="text-slate-300 text-sm flex-1 leading-5">
              {t('iHaveReadAndAgree', language)}{' '}
              <Text style={{ color: primaryColor }} className="font-medium">{t('termsOfService', language)}</Text>,{' '}
              <Text style={{ color: primaryColor }} className="font-medium">{t('legalDisclaimer', language)}</Text>,{' '}
              <Text style={{ color: primaryColor }} className="font-medium">{t('privacyPolicy', language)}</Text>{' '}
              {t('andConjunction', language)}{' '}
              <Text style={{ color: primaryColor }} className="font-medium">{t('arbitrationAgreement', language)}</Text>
            </Text>
          </Pressable>

          {/* Continue Button */}
          <Pressable
            onPress={handleAccept}
            disabled={!isChecked}
            style={{
              backgroundColor: isChecked ? primaryColor : '#334155',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: isChecked ? 1 : 0.7,
            }}
          >
            <Text
              className={cn(
                'font-bold text-base text-center px-4',
                isChecked ? 'text-white' : 'text-slate-500'
              )}
            >
              {isChecked ? t('iUnderstandAndAccept', language) : t('mustAcceptTerms', language)}
            </Text>
          </Pressable>

          <Text className="text-slate-500 text-xs text-center mt-3">
            {t('acceptanceRecorded', language)}
          </Text>
        </Animated.View>

        {/* Document Detail Modal */}
        <Modal
          visible={showDocumentModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDocumentModal(false)}
        >
          <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            {/* Document Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
              <Text className="text-slate-800 font-bold text-lg flex-1">
                {currentDocument?.title}
              </Text>
              <Pressable
                onPress={() => setShowDocumentModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                <X size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Document Content */}
            <ScrollView
              className="flex-1 px-5"
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingVertical: 20 }}
            >
              {currentDocument?.content ? (
                <LegalContentRenderer
                  content={currentDocument.content}
                  bodyColor="#334155"
                />
              ) : null}

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
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
