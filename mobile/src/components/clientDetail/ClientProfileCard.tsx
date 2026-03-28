import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Mail, Phone, Send, MessageCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { t } from '@/lib/i18n';
import { Language, Client } from '@/lib/types';
import { formatPhoneDisplay } from '@/lib/phone-utils';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

export interface ClientProfileCardProps {
  client: Client;
  initials: string;
  language: Language;
  colors: {
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    card: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    [key: string]: string;
  };
  isDark: boolean;
  primaryColor: string;
  buttonColor: string;
  dateLocale?: Locale;
  onEmailPress: () => void;
}

export function ClientProfileCard({
  client,
  initials,
  language,
  colors,
  isDark,
  primaryColor,
  buttonColor,
  dateLocale,
  onEmailPress,
}: ClientProfileCardProps) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-16 h-16 rounded-full items-center justify-center"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 24 }}>
            {initials}
          </Text>
        </View>
        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 20 }}>
              {client.name}
            </Text>
            {client.isArchived && (
              <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#E2E8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{t('archived', language)}</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 2 }}>
            {t('clientSince', language).replace('{date}', capitalizeDate(format(new Date(client.createdAt), 'MMMM yyyy', { locale: dateLocale })))}
          </Text>
        </View>
      </View>

      {/* Contact Info */}
      <View className="mt-5 space-y-3">
        <Pressable className="flex-row items-center py-2">
          <View style={{ width: 40, height: 40, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={18} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, marginLeft: 12, flex: 1 }}>{client.email}</Text>
        </Pressable>
        <Pressable className="flex-row items-center py-2">
          <View style={{ width: 40, height: 40, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={18} color={colors.textSecondary} />
          </View>
          <Text style={{ color: colors.textSecondary, marginLeft: 12, flex: 1 }}>{formatPhoneDisplay(client.phone)}</Text>
        </Pressable>
      </View>

      {/* Call & Email Buttons */}
      <View className="flex-row mt-4">
        <Pressable
          onPress={() => {
            const phoneNumber = client.phone.replace(/[^0-9+]/g, '');
            Linking.openURL(`tel:${phoneNumber}`);
          }}
          className="flex-1 mr-2 rounded-xl py-3 flex-row items-center justify-center"
          style={{ backgroundColor: buttonColor }}
        >
          <Phone size={18} color="#fff" />
          <Text className="text-white font-semibold ml-2" numberOfLines={1} adjustsFontSizeToFit>{t('call', language)}</Text>
        </Pressable>
        <Pressable
          onPress={onEmailPress}
          className="flex-1 ml-2 rounded-xl py-3 flex-row items-center justify-center"
          style={{ backgroundColor: buttonColor }}
        >
          <Send size={18} color="#fff" />
          <Text className="text-white font-semibold ml-2" numberOfLines={1} adjustsFontSizeToFit>{t('email', language)}</Text>
        </Pressable>
      </View>

      {/* Notes */}
      {client.notes && (
        <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View className="flex-row items-center mb-2">
            <MessageCircle size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginLeft: 8 }}>{t('notes', language)}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{client.notes}</Text>
        </View>
      )}

    </View>
  );
}
