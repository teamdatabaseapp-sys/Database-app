import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface TrialLegalBlockProps {
  language: Language;
}

export function TrialLegalBlock({ language }: TrialLegalBlockProps) {
  const { colors } = useTheme();

  return (
    <View style={{ marginHorizontal: 20, marginTop: 12 }}>
      <Text style={{
        color: colors.textTertiary,
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
      }}>
        {t('trialLegalNote', language)}
      </Text>
    </View>
  );
}
