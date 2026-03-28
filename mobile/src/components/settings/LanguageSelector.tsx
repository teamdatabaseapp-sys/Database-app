import React from 'react';
import { View, Text, Modal, ScrollView, Pressable } from 'react-native';
import { Globe, X, Check } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

// ============================================
// LanguageSelector — language selection modal
// ============================================

export interface LanguageSelectorProps {
  visible: boolean;
  language: Language;
  onClose: () => void;
  /** Full pre-built handler: fires haptics, sets language, closes modal */
  onSelectLanguage: (lang: Language) => Promise<void>;
}

export function LanguageSelector({
  visible,
  language,
  onClose,
  onSelectLanguage,
}: LanguageSelectorProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.modal,
            borderRadius: 20,
            marginHorizontal: 20,
            width: '90%',
            maxWidth: 360,
            maxHeight: '80%',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
          }}
          onPress={() => {}}
        >
          {/* Modal Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Globe size={22} color={primaryColor} />
              <Text style={{
                color: colors.text,
                fontWeight: 'bold',
                fontSize: 20,
                marginLeft: 12,
              }}>
                {t('language', language)}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isDark ? colors.border : '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Scrollable Language List */}
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={true}
          >
            {(() => {
              // Sort languages: English first, then alphabetically by native name
              const languageNames: Record<string, string> = {
                en: 'English',
                es: 'Español',
                fr: 'Français',
                ht: 'Kreyòl Ayisyen',
                pt: 'Português',
                de: 'Deutsch',
                it: 'Italiano',
                nl: 'Nederlands',
                sv: 'Svenska',
                no: 'Norsk',
                da: 'Dansk',
                fi: 'Suomi',
                is: 'Íslenska',
                ru: 'Русский',
                tr: 'Türkçe',
                zh: '中文',
                ko: '한국어',
                ja: '日本語',
              };
              const allLangs = ['en', 'es', 'fr', 'ht', 'pt', 'de', 'it', 'nl', 'sv', 'no', 'da', 'fi', 'is', 'ru', 'tr', 'zh', 'ko', 'ja'] as const;
              const sortedLangs = [
                'en' as const,
                ...allLangs.filter(l => l !== 'en').sort((a, b) => languageNames[a].localeCompare(languageNames[b]))
              ];
              return sortedLangs;
            })().map((lang) => {
              const isSelected = language === lang;
              const languageNames: Record<string, string> = {
                en: 'English',
                es: 'Español',
                fr: 'Français',
                ht: 'Kreyòl Ayisyen',
                pt: 'Português',
                de: 'Deutsch',
                it: 'Italiano',
                nl: 'Nederlands',
                sv: 'Svenska',
                no: 'Norsk',
                da: 'Dansk',
                fi: 'Suomi',
                is: 'Íslenska',
                ru: 'Русский',
                tr: 'Türkçe',
                zh: '中文',
                ko: '한국어',
                ja: '日本語',
              };

              return (
                <Pressable
                  key={lang}
                  onPress={() => onSelectLanguage(lang)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    marginHorizontal: 8,
                    marginVertical: 2,
                    borderRadius: 12,
                    backgroundColor: isSelected
                      ? (isDark ? `${primaryColor}25` : `${primaryColor}12`)
                      : 'transparent',
                  }}
                >
                  {/* Language Name */}
                  <Text
                    style={{
                      flex: 1,
                      color: isSelected ? primaryColor : colors.text,
                      fontSize: 17,
                      fontWeight: isSelected ? '600' : '400',
                      textAlign: 'left',
                      lineHeight: 24,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {languageNames[lang]}
                  </Text>

                  {/* Checkmark for selected language */}
                  {isSelected && (
                    <View style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: primaryColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 12,
                    }}>
                      <Check size={16} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
