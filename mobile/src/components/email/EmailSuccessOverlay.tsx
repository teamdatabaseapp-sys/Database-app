import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { SlideInUp } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface EmailSuccessOverlayProps {
  allowedClientsCount: number;
  buttonColor: string;
  colors: {
    card: string;
    text: string;
    textSecondary: string;
  };
  language: Language;
  onClose: () => void;
}

export function EmailSuccessOverlay({
  allowedClientsCount,
  buttonColor,
  colors,
  language,
  onClose,
}: EmailSuccessOverlayProps) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 9999 }}>
      <Animated.View
        entering={SlideInUp.duration(300)}
        style={{ backgroundColor: colors.card, borderRadius: 24, padding: 32, width: '100%', maxWidth: 360, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12 }}
      >
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Check size={36} color="#fff" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 10, textAlign: 'center' }}>
          {t('emailsSentSuccessfully', language)}
        </Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
          {allowedClientsCount === 1
            ? `1 ${t('sendConfirmRecipients', language).toLowerCase()}`
            : `${allowedClientsCount} ${t('sendConfirmRecipients', language).toLowerCase()}`}
        </Text>
        <Pressable
          onPress={onClose}
          style={{ width: '100%', paddingVertical: 15, borderRadius: 14, backgroundColor: buttonColor, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.7}>{t('done', language)}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
