import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Calendar, Gift, ChevronRight } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

export interface ClientStatsCardsProps {
  totalVisitCount: number;
  promotionsUsedCount: number;
  language: Language;
  colors: {
    card: string;
    text: string;
    textTertiary: string;
    border: string;
    [key: string]: string;
  };
  primaryColor: string;
  onAppointmentsPress: () => void;
  onPromotionsPress: () => void;
}

export function ClientStatsCards({
  totalVisitCount,
  promotionsUsedCount,
  language,
  colors,
  primaryColor,
  onAppointmentsPress,
  onPromotionsPress,
}: ClientStatsCardsProps) {
  return (
    <View className="flex-row mx-4 mt-4">
      <Pressable
        onPress={onAppointmentsPress}
        style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 16, marginRight: 8 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Calendar size={18} color={primaryColor} />
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginLeft: 8 }}>{t('appointments', language)}</Text>
          </View>
          <ChevronRight size={16} color={colors.border} />
        </View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
          {totalVisitCount}
        </Text>
      </Pressable>
      <Pressable
        onPress={onPromotionsPress}
        style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 16, marginLeft: 8 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Gift size={18} color={primaryColor} />
            <Text style={{ color: colors.textTertiary, fontSize: 14, marginLeft: 8 }}>{t('promotions', language)}</Text>
          </View>
          <ChevronRight size={16} color={colors.border} />
        </View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
          {promotionsUsedCount}
        </Text>
      </Pressable>
    </View>
  );
}
