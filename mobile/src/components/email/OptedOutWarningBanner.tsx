import React from 'react';
import { View, Text } from 'react-native';
import Animated, { SlideInUp } from 'react-native-reanimated';
import { MailX } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface OptedOutWarningBannerProps {
  blockedClients: { name: string }[];
  isDark: boolean;
  language: Language;
}

export function OptedOutWarningBanner({ blockedClients, isDark, language }: OptedOutWarningBannerProps) {
  if (blockedClients.length === 0) return null;

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      style={{
        backgroundColor: isDark ? '#92400E30' : '#FFFBEB',
        borderWidth: 1,
        borderColor: isDark ? '#F59E0B50' : '#FDE68A',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: isDark ? '#F59E0B30' : '#FEF3C7',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <MailX size={18} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isDark ? '#FDE047' : '#92400E', fontWeight: '600', marginBottom: 4 }}>
            {blockedClients.length} {t('recipientsOptedOut', language)}
          </Text>
          <Text style={{ color: isDark ? '#FCD34D' : '#B45309', fontSize: 14 }}>
            {blockedClients.map((c) => c.name).join(', ')} — {t('optedOutMessage', language)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
