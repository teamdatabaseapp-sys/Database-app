import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

// ============================================
// SettingsHeader — screen title + icon row
// ============================================

export interface SettingsHeaderProps {
  language: Language;
}

export function SettingsHeader({ language }: SettingsHeaderProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.headerBackground }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Settings size={22} color={primaryColor} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
            {t('settings', language)}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
