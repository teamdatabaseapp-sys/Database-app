import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus, Calendar } from 'lucide-react-native';
import type { Locale } from 'date-fns';
import { t } from '@/lib/i18n';
import { Language, Visit } from '@/lib/types';
import { VisitCard } from './VisitCard';

export interface ClientVisitHistorySectionProps {
  visits: Visit[];
  serviceTags: { id: string; name: string; color: string }[];
  promotions: { id: string; name: string; color: string }[];
  language: Language;
  colors: {
    text: string;
    card: string;
    border: string;
    textTertiary: string;
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    textSecondary: string;
    [key: string]: string;
  };
  isDark: boolean;
  primaryColor: string;
  currency: string;
  dateLocale?: Locale;
  onEditVisit: (visit: Visit) => void;
  onAddVisit: () => void;
}

export function ClientVisitHistorySection({
  visits,
  serviceTags,
  promotions,
  language,
  colors,
  isDark,
  primaryColor,
  currency,
  dateLocale,
  onEditVisit,
  onAddVisit,
}: ClientVisitHistorySectionProps) {
  return (
    <View
      className="mx-4 mt-6"
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>
          {t('visitHistory', language)}
        </Text>
        <Pressable
          onPress={onAddVisit}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
        >
          <Plus size={16} color={primaryColor} />
          <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 4, fontSize: 14 }}>
            {t('addVisit', language)}
          </Text>
        </Pressable>
      </View>

      {visits.length > 0 ? (
        visits
          .map((visit, index) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              index={index}
              serviceTags={serviceTags}
              promotions={promotions}
              onEdit={onEditVisit}
              colors={colors}
              isDark={isDark}
              primaryColor={primaryColor}
              currency={currency}
              language={language}
              dateLocale={dateLocale}
            />
          ))
      ) : (
        <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 24, alignItems: 'center' }}>
          <Calendar size={32} color={colors.border} />
          <Text style={{ color: colors.textTertiary, marginTop: 8 }}>{t('noVisits', language)}</Text>
        </View>
      )}
    </View>
  );
}
