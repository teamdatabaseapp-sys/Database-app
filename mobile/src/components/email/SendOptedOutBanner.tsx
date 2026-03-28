import React from 'react';
import { View, Text } from 'react-native';
import { MailX } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface SendOptedOutBannerProps {
  isOptedOut: boolean;
  isDark: boolean;
  clientName: string;
  language: Language;
}

export function SendOptedOutBanner({ isOptedOut, isDark, clientName, language }: SendOptedOutBannerProps) {
  if (!isOptedOut) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={{
        backgroundColor: isDark ? '#7F1D1D' : '#FEF2F2',
        borderWidth: 1,
        borderColor: isDark ? '#991B1B' : '#FECACA',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isDark ? '#991B1B' : '#FEE2E2',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
          <MailX size={18} color="#EF4444" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isDark ? '#FCA5A5' : '#B91C1C', fontWeight: '600', marginBottom: 4 }}>
            {t('cannotSendEmail', language)}
          </Text>
          <Text style={{ color: isDark ? '#FECACA' : '#DC2626', fontSize: 14 }}>
            {clientName} {t('optedOutMessage', language)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
