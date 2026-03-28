import React from 'react';
import { View, Text } from 'react-native';
import { Info } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface SendFooterPreviewProps {
  footerPreview: string;
  isDark: boolean;
  colors: {
    textSecondary: string;
    textTertiary: string;
    backgroundTertiary: string;
    border: string;
  };
  language: Language;
}

export function SendFooterPreview({ footerPreview, isDark, colors, language }: SendFooterPreviewProps) {
  return (
    <Animated.View entering={FadeInDown.delay(250).duration(300)} style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Info size={14} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14, marginLeft: 6 }}>{t('emailFooterPreview', language)}</Text>
      </View>
      <View style={{
        backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
      }}>
        <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 18 }}>{footerPreview}</Text>
      </View>
    </Animated.View>
  );
}
