import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, ChevronRight, X } from 'lucide-react-native';
import {
  CURRENT_TERMS_VERSION,
  TERMS_LAST_UPDATED,
  COMPANY_INFO,
  getTermsOfService,
  getLegalDisclaimer,
  getLimitationOfLiability,
  getArbitrationAgreement,
  getIndemnification,
  getPrivacyPolicy,
} from '@/lib/legal-content';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { LegalContentRenderer } from '@/components/LegalContentRenderer';

export function LegalDocumentViewer() {
  const [showTermsModal, setShowTermsModal] = useState(false);
  const language = useStore((s) => s.language) as Language;

  // Generate sections with language-aware content
  const termsAndConditionsSections = useMemo(() => [
    {
      sectionNumber: 1,
      title: t('termsOfService', language),
      content: getTermsOfService(language),
    },
    {
      sectionNumber: 2,
      title: t('legalDisclaimer', language),
      content: getLegalDisclaimer(language),
    },
    {
      sectionNumber: 3,
      title: t('limitationOfLiability', language),
      content: getLimitationOfLiability(language),
    },
    {
      sectionNumber: 4,
      title: t('arbitrationAgreement', language),
      content: getArbitrationAgreement(language),
    },
    {
      sectionNumber: 5,
      title: t('indemnification', language),
      content: getIndemnification(language),
    },
    {
      sectionNumber: 6,
      title: t('privacyPolicy', language),
      content: getPrivacyPolicy(language),
    },
  ], [language]);

  const contactText = language === 'es'
    ? 'Para preguntas sobre nuestros términos legales, contáctenos en:'
    : language === 'fr'
    ? 'Pour toute question concernant nos conditions juridiques, contactez-nous à :'
    : language === 'pt'
    ? 'Para perguntas sobre nossos termos legais, entre em contato conosco em:'
    : language === 'de'
    ? 'Bei Fragen zu unseren rechtlichen Bedingungen kontaktieren Sie uns unter:'
    : 'For questions about our legal terms, contact us at:';

  const lastUpdatedText = language === 'es'
    ? 'Última actualización'
    : language === 'fr'
    ? 'Dernière mise à jour'
    : language === 'pt'
    ? 'Última atualização'
    : language === 'de'
    ? 'Letzte Aktualisierung'
    : 'Last Updated';

  const versionText = language === 'es'
    ? 'Versión'
    : language === 'fr'
    ? 'Version'
    : language === 'pt'
    ? 'Versão'
    : language === 'de'
    ? 'Version'
    : 'Version';

  const forSupportText = language === 'es'
    ? 'Para soporte'
    : language === 'fr'
    ? 'Pour l\'assistance'
    : language === 'pt'
    ? 'Para suporte'
    : language === 'de'
    ? 'Für Support'
    : 'For support';

  return (
    <>
      {/* Single Terms and Conditions Entry */}
      <View className="bg-white rounded-2xl overflow-hidden">
        <Pressable
          onPress={() => setShowTermsModal(true)}
          className="flex-row items-center p-4 active:bg-slate-50"
        >
          <View className="w-10 h-10 rounded-xl bg-teal-50 items-center justify-center mr-3">
            <FileText size={20} color="#0D9488" />
          </View>
          <View className="flex-1">
            <Text className="text-slate-800 font-semibold">{t('termsAndConditions', language)}</Text>
            <Text className="text-slate-400 text-xs mt-0.5">
              {versionText} {CURRENT_TERMS_VERSION} • {lastUpdatedText} {TERMS_LAST_UPDATED}
            </Text>
          </View>
          <ChevronRight size={18} color="#CBD5E1" />
        </Pressable>
      </View>

      {/* Contact Info */}
      <View className="mt-4 px-2">
        <Text className="text-slate-400 text-xs text-center">
          {contactText}
        </Text>
        <Text className="text-teal-600 text-xs text-center font-medium mt-1">
          {COMPANY_INFO.email}
        </Text>
      </View>

      {/* Terms and Conditions Modal */}
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
                {versionText} {CURRENT_TERMS_VERSION} • {lastUpdatedText} {TERMS_LAST_UPDATED}
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
              {termsAndConditionsSections.map((section) => (
                <Text
                  key={section.sectionNumber}
                  className="text-slate-600 text-sm py-1"
                >
                  {t('section', language)} {section.sectionNumber}: {section.title}
                </Text>
              ))}
            </View>

            {/* All Sections */}
            {termsAndConditionsSections.map((section, index) => (
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
                {index < termsAndConditionsSections.length - 1 && (
                  <View className="border-b border-slate-200 mt-8" />
                )}
              </View>
            ))}

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
                2026 {COMPANY_INFO.name}, Miami, United States
              </Text>
              <Text className="text-slate-400 text-xs text-center mt-1">
                {forSupportText}: {COMPANY_INFO.email}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
