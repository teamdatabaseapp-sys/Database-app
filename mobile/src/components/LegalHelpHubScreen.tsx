import React, { useState, useMemo } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  FileText,
  HelpCircle,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
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
  getPrivacyPolicySection,
  getCookiePolicySection,
  getOnlineBookingTerms,
  getGiftCardTerms,
  getGiftCardTermsTitle,
  getPlatformRoleClause,
  getPlatformRoleTitle,
} from '@/lib/legal-content';
import { HelpCenterScreen } from '@/components/HelpCenterScreen';
import { LegalContentRenderer } from '@/components/LegalContentRenderer';

interface LegalHelpHubScreenProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
}

type HubTab = 'legal' | 'help';

export function LegalHelpHubScreen({ visible, onClose, language }: LegalHelpHubScreenProps) {
  const { colors, primaryColor, isDark } = useTheme();
  const themeSettings = useStore((s: any) => s.themeSettings);
  const [activeTab, setActiveTab] = useTabPersistence<HubTab>('legal_help_hub', 'legal');

  // ── Legal content data ──────────────────────────────────────────────────

  const versionText = t('versionLabel', language);
  const lastUpdatedText = t('lastUpdatedLabel', language);

  // Sections 1–8: core terms
  const coreSections = useMemo(() => [
    { sectionNumber: 1, title: t('termsOfService', language), content: getTermsOfService(language) },
    { sectionNumber: 2, title: t('legalDisclaimer', language), content: getLegalDisclaimer(language) },
    { sectionNumber: 3, title: t('limitationOfLiability', language), content: getLimitationOfLiability(language) },
    { sectionNumber: 4, title: t('arbitrationAgreement', language), content: getArbitrationAgreement(language) },
    { sectionNumber: 5, title: t('indemnification', language), content: getIndemnification(language) },
    { sectionNumber: 6, title: t('privacyPolicy', language), content: getPrivacyPolicy(language) },
    { sectionNumber: 7, title: t('onlineBookingTermsTitle', language), content: getOnlineBookingTerms(language) },
    { sectionNumber: 8, title: getGiftCardTermsTitle(language), content: getGiftCardTerms(language) },
  ], [language]);

  // Sections 9–12: additional policies (alphabetical order)
  // 9: Cookie Policy, 10: Email & Campaign Compliance, 11: Pricing Notice, 12: Privacy Policy
  const cookieSections = useMemo(() => [
    { sectionNumber: 1, title: t('aboutThisPolicy', language), content: getCookiePolicySection(language, 1) },
    { sectionNumber: 2, title: t('cookieUsage', language), content: getCookiePolicySection(language, 2) },
    { sectionNumber: 3, title: t('noCookiesUsed', language), content: getCookiePolicySection(language, 3) },
    { sectionNumber: 4, title: t('whatWeStorLocally', language), content: getCookiePolicySection(language, 4) },
    { sectionNumber: 5, title: t('yourControl', language), content: getCookiePolicySection(language, 5) },
    { sectionNumber: 6, title: t('thirdPartyServices', language), content: getCookiePolicySection(language, 6) },
    { sectionNumber: 7, title: t('changesToThisPolicy', language), content: getCookiePolicySection(language, 7) },
    { sectionNumber: 8, title: t('contactUs', language), content: getCookiePolicySection(language, 8) },
  ], [language]);

  const privacySections = useMemo(() => [
    { sectionNumber: 1, title: t('dataWeCollect', language), content: getPrivacyPolicySection(language, 1) },
    { sectionNumber: 2, title: t('howWeUseData', language), content: getPrivacyPolicySection(language, 2) },
    { sectionNumber: 3, title: t('dataStorageSecurity', language), content: getPrivacyPolicySection(language, 3) },
    { sectionNumber: 4, title: t('yourRights', language), content: getPrivacyPolicySection(language, 4) },
    { sectionNumber: 5, title: t('legalCompliance', language), content: getPrivacyPolicySection(language, 5) },
    { sectionNumber: 6, title: t('contactUs', language), content: getPrivacyPolicySection(language, 6) },
  ], [language]);

  // ── Render helpers ──────────────────────────────────────────────────────

  const sectionHeader = (num: number, title: string) => (
    <View
      style={{
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        backgroundColor: isDark ? '#134E4A' : '#F0FDFA',
      }}
    >
      <Text style={{ color: isDark ? '#5EEAD4' : '#0F766E', fontWeight: 'bold', fontSize: 15 }}>
        {t('section', language)} {num}: {title.toUpperCase()}
      </Text>
    </View>
  );

  const sectionDivider = () => (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginVertical: 28 }} />
  );

  const subSectionHeader = (num: number, title: string) => (
    <View
      style={{
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
        {num}. {title}
      </Text>
    </View>
  );

  // ── Legal tab content ───────────────────────────────────────────────────

  const legalContent = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      showsVerticalScrollIndicator={true}
    >
      {/* Version subtitle */}
      <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 16 }}>
        {versionText} {CURRENT_TERMS_VERSION} • {lastUpdatedText} {TERMS_LAST_UPDATED}
      </Text>

      {/* Table of Contents — alphabetical, no divider */}
      <View
        style={{
          borderRadius: 14,
          padding: 16,
          marginBottom: 24,
          backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
        }}
      >
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15, marginBottom: 12 }}>
          {t('tableOfContents', language)}
        </Text>
        {/* 1 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 1: {t('arbitrationAgreement', language)}</Text>
        {/* 2 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 2: {t('cookiePolicyTitle', language)}</Text>
        {/* 3 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 3: {t('emailLegalDisclaimerTitle', language)}</Text>
        {/* 4 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 4: {getGiftCardTermsTitle(language)}</Text>
        {/* 5 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 5: {t('indemnification', language)}</Text>
        {/* 6 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 6: {t('legalDisclaimer', language)}</Text>
        {/* 7 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 7: {t('limitationOfLiability', language)}</Text>
        {/* 8 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 8: {t('onlineBookingTermsTitle', language)}</Text>
        {/* 9 */ }<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 9: {t('pricingDisclaimerTitle', language)}</Text>
        {/* 10 */}<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 10: {t('privacyPolicy', language)}</Text>
        {/* 11 */}<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 11: {getPlatformRoleTitle(language)}</Text>
        {/* 12 */}<Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 3 }}>{t('section', language)} 12: {t('termsOfService', language)}</Text>
      </View>

      {/* ── SECTION 1: ARBITRATION AGREEMENT ── */}
      {sectionHeader(1, t('arbitrationAgreement', language))}
      <LegalContentRenderer content={getArbitrationAgreement(language)} />
      {sectionDivider()}

      {/* ── SECTION 2: COOKIE POLICY ── */}
      {sectionHeader(2, t('cookiePolicyTitle', language))}
      {cookieSections.map((sub, i) => (
        <View key={sub.sectionNumber} style={i > 0 ? { marginTop: 16 } : {}}>
          {subSectionHeader(sub.sectionNumber, sub.title)}
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}>
            {sub.content}
          </Text>
        </View>
      ))}
      {sectionDivider()}

      {/* ── SECTION 3: EMAIL & CAMPAIGN COMPLIANCE ── */}
      {sectionHeader(3, t('emailLegalDisclaimerTitle', language))}
      <View
        style={{
          backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}08`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: isDark ? `${primaryColor}30` : `${primaryColor}20`,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
          {t('emailLegalDisclaimer', language)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: isDark ? `${primaryColor}10` : `${primaryColor}05`,
          padding: 16,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: primaryColor,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22, fontStyle: 'italic' }}>
          {t('emailLegalRegionNote', language)}
        </Text>
      </View>
      {sectionDivider()}

      {/* ── SECTION 4: GIFT CARDS & STORED VALUE ── */}
      {sectionHeader(4, getGiftCardTermsTitle(language))}
      <LegalContentRenderer content={getGiftCardTerms(language)} />
      {sectionDivider()}

      {/* ── SECTION 5: INDEMNIFICATION ── */}
      {sectionHeader(5, t('indemnification', language))}
      <LegalContentRenderer content={getIndemnification(language)} />
      {sectionDivider()}

      {/* ── SECTION 6: LEGAL DISCLAIMER ── */}
      {sectionHeader(6, t('legalDisclaimer', language))}
      <LegalContentRenderer content={getLegalDisclaimer(language)} />
      {sectionDivider()}

      {/* ── SECTION 7: LIMITATION OF LIABILITY ── */}
      {sectionHeader(7, t('limitationOfLiability', language))}
      <LegalContentRenderer content={getLimitationOfLiability(language)} />
      {sectionDivider()}

      {/* ── SECTION 8: ONLINE BOOKING SYSTEM TERMS ── */}
      {sectionHeader(8, t('onlineBookingTermsTitle', language))}
      <LegalContentRenderer content={getOnlineBookingTerms(language)} />
      {sectionDivider()}

      {/* ── SECTION 9: PRICING NOTICE ── */}
      {sectionHeader(9, t('pricingDisclaimerTitle', language))}
      <View
        style={{
          backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}08`,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: isDark ? `${primaryColor}30` : `${primaryColor}20`,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
          {t('pricingDisclaimer', language)}
        </Text>
      </View>
      {sectionDivider()}

      {/* ── SECTION 10: PRIVACY POLICY ── */}
      {sectionHeader(10, t('privacyPolicy', language))}
      <LegalContentRenderer content={getPrivacyPolicy(language)} />
      {privacySections.map((sub, i) => (
        <View key={sub.sectionNumber} style={i > 0 ? { marginTop: 16 } : { marginTop: 16 }}>
          {subSectionHeader(sub.sectionNumber, sub.title)}
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}>
            {sub.content}
          </Text>
        </View>
      ))}
      {sectionDivider()}

      {/* ── SECTION 11: PLATFORM ROLE & RESPONSIBILITY ── */}
      {sectionHeader(11, getPlatformRoleTitle(language))}
      <LegalContentRenderer content={getPlatformRoleClause(language)} />
      {sectionDivider()}

      {/* ── SECTION 12: TERMS OF SERVICE ── */}
      {sectionHeader(12, t('termsOfService', language))}
      <LegalContentRenderer content={getTermsOfService(language)} />

      {/* Footer */}
      <View style={{ marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' }}>
        <Image
          source={require('../../public/image-1769784304.png')}
          fadeDuration={0}
          style={{ width: 240, height: 72, resizeMode: 'contain', tintColor: colors.textTertiary }}
        />
        <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          2026 {COMPANY_INFO.name}, Miami, United States
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
          {t('forSupport', language)}: {COMPANY_INFO.email}
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <FileText size={22} color={primaryColor} style={{ marginRight: 8 }} />
          <Text style={{ flex: 1, fontSize: 17, fontWeight: 'bold', color: colors.text }}>
            {t('legalDocuments', language)} & {t('helpCenter', language)}
          </Text>
          <Pressable
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Segmented Control */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginVertical: 12,
            backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
            borderRadius: 10,
            padding: 3,
          }}
        >
          {([
            { key: 'legal' as HubTab, label: t('legalDocuments', language) },
            { key: 'help' as HubTab, label: t('helpCenter', language) },
          ]).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: activeTab === tab.key
                  ? (isDark ? colors.card : '#FFFFFF')
                  : 'transparent',
                shadowColor: activeTab === tab.key ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === tab.key ? 0.08 : 0,
                shadowRadius: 2,
                elevation: activeTab === tab.key ? 2 : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab.key ? '600' : '500',
                  color: activeTab === tab.key ? primaryColor : colors.textSecondary,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {activeTab === 'legal' && legalContent}
          {activeTab === 'help' && (
            <HelpCenterScreen
              visible={visible}
              onClose={onClose}
              language={language}
              embedded
            />
          )}
        </View>

      </SafeAreaView>
    </Modal>
  );
}
