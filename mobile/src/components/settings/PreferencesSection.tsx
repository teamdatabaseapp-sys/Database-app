import React from 'react';
import { View, Text, Image, Platform } from 'react-native';
import {
  Globe,
  Palette,
  Moon,
  ScanFace,
  Volume2,
  Download,
  KeyRound,
  FileText,
  LogOut,
  Trash2,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { COMPANY_INFO } from '@/lib/legal-content';
import { SettingsLinkItem } from './SettingsLinkItem';

// ============================================
// PreferencesSection — Card #4: Security, Preferences & System
// ============================================

export interface PreferencesSectionProps {
  language: Language;
  themeSettings: { primaryColor: string; buttonColor: string };
  faceIdAvailable: boolean;
  faceIdEnabled: boolean;
  onLanguagePress: () => void;
  onThemeColorsPress: () => void;
  onDarkModePress: () => void;
  /** Full pre-built handler for face ID row press (enable or disable) */
  onFaceIdPress: () => Promise<void>;
  onSoundHapticsPress: () => void;
  onExportDataPress: () => void;
  onEmailPasswordPress: () => void;
  onLegalPress: () => void;
  onLogoutPress: () => void;
  onDeleteAccountPress: () => void;
}

export function PreferencesSection({
  language,
  themeSettings,
  faceIdAvailable,
  faceIdEnabled,
  onLanguagePress,
  onThemeColorsPress,
  onDarkModePress,
  onFaceIdPress,
  onSoundHapticsPress,
  onExportDataPress,
  onEmailPasswordPress,
  onLegalPress,
  onLogoutPress,
  onDeleteAccountPress,
}: PreferencesSectionProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <>
      {/* ── CARD #4: Security, Preferences & System ── */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(400)}
        style={{
          backgroundColor: colors.card,
          marginHorizontal: 16,
          marginTop: 16,
          borderRadius: 16,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        {/* 1. Language */}
        <SettingsLinkItem
          icon={<Globe size={20} color={colors.textSecondary} />}
          label={t('language', language)}
          onPress={onLanguagePress}
          trailing={<><Text style={{ color: colors.textTertiary, marginRight: 8 }}>{language === 'en' ? 'English' : language === 'es' ? 'Español' : language === 'fr' ? 'Français' : language === 'ht' ? 'Kreyòl Ayisyen' : language === 'pt' ? 'Português' : language === 'de' ? 'Deutsch' : language === 'it' ? 'Italiano' : language === 'nl' ? 'Nederlands' : language === 'sv' ? 'Svenska' : language === 'no' ? 'Norsk' : language === 'da' ? 'Dansk' : language === 'fi' ? 'Suomi' : language === 'is' ? 'Íslenska' : language === 'ru' ? 'Русский' : language === 'tr' ? 'Türkçe' : language === 'zh' ? '中文' : language === 'ko' ? '한국어' : '日本語'}</Text><ChevronRight size={18} color={colors.textTertiary} /></>}
        />

        {/* 2. Theme Colors */}
        <SettingsLinkItem
          icon={<Palette size={20} color={colors.textSecondary} />}
          label={t('themeColors', language)}
          onPress={onThemeColorsPress}
          trailing={<><View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}><View style={{ width: 20, height: 20, borderRadius: 10, marginRight: 4, backgroundColor: themeSettings.primaryColor }} /><View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: themeSettings.buttonColor }} /></View><ChevronRight size={18} color={colors.textTertiary} /></>}
        />

        {/* 3. Dark Mode */}
        <SettingsLinkItem
          icon={<Moon size={20} color={colors.textSecondary} />}
          label={t('darkMode', language)}
          onPress={onDarkModePress}
          trailing={<View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isDark ? primaryColor : 'transparent', borderWidth: 2, borderColor: isDark ? primaryColor : colors.border, alignItems: 'center', justifyContent: 'center' }}>{isDark && <Check size={14} color="#FFFFFF" />}</View>}
        />

        {/* 4. Enable Face ID — iOS only */}
        {Platform.OS === 'ios' && faceIdAvailable && (
          <SettingsLinkItem
            icon={<ScanFace size={20} color={colors.textSecondary} />}
            label={t('enableFaceId', language)}
            onPress={onFaceIdPress}
          />
        )}

        {/* 5. Sound & Haptics */}
        <SettingsLinkItem
          icon={<Volume2 size={20} color={colors.textSecondary} />}
          label={t('soundAndHaptics', language)}
          onPress={onSoundHapticsPress}
        />

        {/* 6. Export Data */}
        <SettingsLinkItem
          icon={<Download size={20} color={colors.textSecondary} />}
          label={t('exportData', language)}
          onPress={onExportDataPress}
        />

        {/* 7. Email Address & Change Password */}
        <SettingsLinkItem
          icon={<KeyRound size={20} color={colors.textSecondary} />}
          label={t('emailAndChangePassword', language)}
          onPress={onEmailPasswordPress}
        />

        {/* 8. Legal Documents & Help Center */}
        <SettingsLinkItem
          icon={<FileText size={20} color={colors.textSecondary} />}
          label={`${t('legalDocuments', language)} & ${t('helpCenter', language)}`}
          onPress={onLegalPress}
        />

        {/* 9. Logout */}
        <SettingsLinkItem
          icon={<LogOut size={20} color="#EF4444" />}
          label={<Text style={{ color: '#EF4444', fontWeight: '500' }}>{t('logout', language)}</Text>}
          onPress={onLogoutPress}
        />

        {/* 10. Delete Account */}
        <SettingsLinkItem
          icon={<Trash2 size={20} color="#EF4444" />}
          label={<Text style={{ color: '#EF4444', fontWeight: '500' }}>{t('deleteAccount', language)}</Text>}
          onPress={onDeleteAccountPress}
        />

        {/* Logo */}
        <View style={{ paddingTop: 8, paddingBottom: 1, alignItems: 'center' }}>
          <Image
            source={require('../../../public/image-1769784304.png')}
            fadeDuration={0}
            style={{
              width: 280,
              height: 84,
              resizeMode: 'contain',
              tintColor: colors.textTertiary,
            }}
          />
        </View>

        {/* Footer */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
            2026 {COMPANY_INFO.name}, Miami, United States
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', marginBottom: 4 }}>
            {t('forSupport', language)}: {COMPANY_INFO.email}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', marginBottom: 4 }}>
            Phone (US): +1 786-707-7103
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
            {t('versionLabel', language)} 1.0.0
          </Text>
        </View>
      </Animated.View>
    </>
  );
}
