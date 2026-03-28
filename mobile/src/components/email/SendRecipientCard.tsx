import React from 'react';
import { View, Text } from 'react-native';
import { User } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface SendRecipientCardProps {
  isOptedOut: boolean;
  isDark: boolean;
  clientName: string;
  clientEmail: string;
  primaryColor: string;
  colors: {
    text: string;
    textTertiary: string;
    card: string;
    border: string;
  };
  language: Language;
}

export function SendRecipientCard({
  isOptedOut,
  isDark,
  clientName,
  clientEmail,
  primaryColor,
  colors,
  language,
}: SendRecipientCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(50).duration(300)}>
      <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>{t('toLabel', language)}</Text>
      <View style={{
        backgroundColor: isOptedOut ? (isDark ? '#7F1D1D' : '#FEF2F2') : colors.card,
        borderWidth: 1,
        borderColor: isOptedOut ? (isDark ? '#991B1B' : '#FECACA') : colors.border,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isOptedOut ? (isDark ? '#991B1B' : '#FEE2E2') : `${primaryColor}15`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <User size={16} color={isOptedOut ? '#EF4444' : primaryColor} />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ fontWeight: '500', color: isOptedOut ? (isDark ? '#FCA5A5' : '#B91C1C') : colors.text }}>
            {clientName}
          </Text>
          <Text style={{ fontSize: 14, color: isOptedOut ? (isDark ? '#FECACA' : '#DC2626') : colors.textTertiary }}>
            {clientEmail}
          </Text>
        </View>
        {isOptedOut && (
          <View style={{ backgroundColor: isDark ? '#991B1B' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '500' }}>{t('optedOut', language)}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
