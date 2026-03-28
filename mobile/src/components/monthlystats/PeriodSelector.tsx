import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { TimeFilterType } from './TimeFilterTabs';

// ============================================
// Helpers (scoped to this module)
// ============================================

const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const getMonths = (language: Language) => [
  capitalize(t('january', language)), capitalize(t('february', language)), capitalize(t('march', language)),
  capitalize(t('april', language)), capitalize(t('may', language)), capitalize(t('june', language)),
  capitalize(t('july', language)), capitalize(t('august', language)), capitalize(t('september', language)),
  capitalize(t('october', language)), capitalize(t('november', language)), capitalize(t('december', language)),
];

// ============================================
// PeriodSelector Component
// ============================================

export interface PeriodSelectorProps {
  timeFilter: TimeFilterType;
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  periodStart: Date;
  dateLocale: Locale | undefined;
  language: Language;
  onPrev: () => void;
  onNext: () => void;
  isNextDisabled: boolean;
}

export function PeriodSelector({
  timeFilter,
  selectedYear,
  selectedMonth,
  selectedDay,
  periodStart,
  dateLocale,
  language,
  onPrev,
  onNext,
  isNextDisabled,
}: PeriodSelectorProps) {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(300)}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      }}
    >
      <Pressable
        onPress={onPrev}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={20} color={colors.textSecondary} />
      </Pressable>
      <View className="items-center">
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>
          {timeFilter === 'daily'
            ? capitalizeDate(format(new Date(selectedYear, selectedMonth, selectedDay), 'MMM d, yyyy', { locale: dateLocale }))
            : timeFilter === 'weekly'
            ? `${t('weekOf', language)} ${capitalizeDate(format(periodStart, 'MMM d', { locale: dateLocale }))}`
            : timeFilter === 'yearly'
            ? selectedYear.toString()
            : getMonths(language)[selectedMonth]}
        </Text>
        {timeFilter === 'monthly' && (
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{selectedYear}</Text>
        )}
      </View>
      <Pressable
        onPress={onNext}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isNextDisabled ? (isDark ? colors.background : '#F8FAFC') : (isDark ? colors.backgroundTertiary : '#F1F5F9'), alignItems: 'center', justifyContent: 'center' }}
        disabled={isNextDisabled}
      >
        <ChevronRight size={20} color={isNextDisabled ? colors.border : colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}
