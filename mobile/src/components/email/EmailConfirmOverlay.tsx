import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { SlideInUp } from 'react-native-reanimated';
import { Send } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface EmailConfirmOverlayProps {
  subject: string;
  previewText: string;
  allowedClientsCount: number;
  blockedClients: { name: string }[];
  attachmentsCount: number;
  emailImagesCount: number;
  isDark: boolean;
  primaryColor: string;
  buttonColor: string;
  colors: {
    card: string;
    text: string;
    textSecondary: string;
    backgroundTertiary: string;
    border: string;
  };
  language: Language;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EmailConfirmOverlay({
  subject,
  previewText,
  allowedClientsCount,
  blockedClients,
  attachmentsCount,
  emailImagesCount,
  isDark,
  primaryColor,
  buttonColor,
  colors,
  language,
  onCancel,
  onConfirm,
}: EmailConfirmOverlayProps) {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 9999,
      }}
    >
      <Animated.View
        entering={SlideInUp.duration(300)}
        style={{
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Send size={20} color={primaryColor} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
            {t('sendConfirmTitle', language)}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          {[
            { label: t('sendConfirmSubject', language), value: subject },
            ...(previewText.trim() ? [{ label: t('sendConfirmPreviewText', language), value: previewText }] : []),
            { label: t('sendConfirmRecipients', language), value: allowedClientsCount.toString() },
            { label: t('sendConfirmAttachments', language), value: attachmentsCount.toString() },
            { label: t('sendConfirmImages', language), value: emailImagesCount.toString() },
          ].map((row, idx, arr) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>{row.label}</Text>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' }} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </View>

        {allowedClientsCount > 5000 && (
          <View style={{ backgroundColor: isDark ? '#92400E20' : '#FFFBEB', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' }}>
            <Text style={{ color: '#92400E', fontSize: 13 }}>{t('sendConfirmBatchNote', language)}</Text>
          </View>
        )}

        {blockedClients.length > 0 && (
          <View style={{ backgroundColor: isDark ? '#92400E20' : '#FFFBEB', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' }}>
            <Text style={{ color: isDark ? '#FDE047' : '#92400E', fontSize: 13 }}>
              {blockedClients.length} {t('recipientsOptedOut', language)} — {t('optedOut', language).toLowerCase()}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={onCancel}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.7}>{t('cancel', language)}</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: buttonColor, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
          >
            <Send size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.7}>{t('sendCampaignBtn', language)}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
