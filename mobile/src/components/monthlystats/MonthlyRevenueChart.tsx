import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/currency';

// ============================================
// Shared types used by MonthlyRevenueChart
// ============================================

export interface AnalyticsAppointment {
  id: string;
  clientId: string;
  storeId: string;
  staffId?: string;
  date: Date;
  amount: number;
  currency: string;
  isCancelled: boolean;
  serviceTags?: string[];
  promoId?: string;
}

// ============================================
// Helpers (scoped to this module)
// ============================================

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const getMonthShortNames = (language: Language) => [
  capitalize(t('janShort', language)), capitalize(t('febShort', language)), capitalize(t('marShort', language)),
  capitalize(t('aprShort', language)), capitalize(t('mayShort', language)), capitalize(t('junShort', language)),
  capitalize(t('julShort', language)), capitalize(t('augShort', language)), capitalize(t('sepShort', language)),
  capitalize(t('octShort', language)), capitalize(t('novShort', language)), capitalize(t('decShort', language)),
];

const getMonths = (language: Language) => [
  capitalize(t('january', language)), capitalize(t('february', language)), capitalize(t('march', language)),
  capitalize(t('april', language)), capitalize(t('may', language)), capitalize(t('june', language)),
  capitalize(t('july', language)), capitalize(t('august', language)), capitalize(t('september', language)),
  capitalize(t('october', language)), capitalize(t('november', language)), capitalize(t('december', language)),
];

// ============================================
// MonthlyRevenueChart Component
// ============================================

export interface MonthlyRevenueChartProps {
  appointments: AnalyticsAppointment[];
  selectedYear: number;
  language: Language;
  currency: string;
  compact?: boolean;
  highlightMonthIndex?: number;
}

export function MonthlyRevenueChart({ appointments, selectedYear, language, currency, compact = false, highlightMonthIndex }: MonthlyRevenueChartProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const currencySymbol = getCurrencySymbol(currency);
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    // Filter out cancelled appointments
    const activeAppointments = appointments.filter((a) => !a.isCancelled);

    const revenueData: Array<{ month: number; revenue: number; label: string }> = [];

    for (let month = 0; month < 12; month++) {
      // Don't include future months for current year
      if (selectedYear === currentYear && month > currentMonth) {
        revenueData.push({ month, revenue: 0, label: getMonthShortNames(language)[month] });
        continue;
      }

      const monthStart = startOfMonth(new Date(selectedYear, month, 1));
      const monthEnd = endOfMonth(new Date(selectedYear, month, 1));

      let revenue = 0;
      // Add revenue from appointments (not cancelled)
      activeAppointments.forEach((appointment) => {
        const appointmentDate = appointment.date;
        if (isWithinInterval(appointmentDate, { start: monthStart, end: monthEnd })) {
          revenue += appointment.amount || 0;
        }
      });

      revenueData.push({ month, revenue, label: getMonthShortNames(language)[month] });
    }

    return revenueData;
  }, [appointments, selectedYear, language]);

  const maxRevenue = useMemo(() => {
    return Math.max(...monthlyRevenue.map((m) => m.revenue), 1);
  }, [monthlyRevenue]);

  const highestMonth = useMemo(() => {
    return monthlyRevenue.reduce((max, curr) => curr.revenue > max.revenue ? curr : max, monthlyRevenue[0]);
  }, [monthlyRevenue]);

  const totalYearRevenue = useMemo(() => {
    return monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
  }, [monthlyRevenue]);

  const formatRevenue = (amount: number) => {
    if (amount >= 1000) {
      return `${currencySymbol}${(amount / 1000).toFixed(1)}k`;
    }
    return `${currencySymbol}${amount}`;
  };

  // Determine which month to highlight - either specified or highest revenue
  const highlightedMonth = highlightMonthIndex !== undefined ? highlightMonthIndex : highestMonth.month;

  // Compact mode for embedding inside Best Month box
  if (compact) {
    return (
      <View
        className="rounded-xl p-3 mb-4"
        style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10` }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 14 }}>{selectedYear} {t('monthlyRevenue', language)}</Text>
          <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 14 }}>{formatRevenue(totalYearRevenue)}</Text>
        </View>

        {/* Bar Chart - Compact */}
        <View className="flex-row items-end justify-between" style={{ height: 80 }}>
          {monthlyRevenue.map((data) => {
            const barHeight = maxRevenue > 0 ? Math.max((data.revenue / maxRevenue) * 70, data.revenue > 0 ? 6 : 2) : 2;
            const isHighlighted = data.month === highlightedMonth && data.revenue > 0;

            return (
              <View key={data.month} className="flex-1 items-center mx-0.5">
                {/* Revenue value above bar */}
                {data.revenue > 0 && (
                  <Text
                    style={{ fontSize: 7, marginBottom: 2, fontWeight: '500', color: isHighlighted ? primaryColor : colors.textTertiary }}
                    numberOfLines={1}
                  >
                    {formatRevenue(data.revenue)}
                  </Text>
                )}
                {/* Bar */}
                <View
                  style={{
                    width: '100%',
                    height: barHeight,
                    borderTopLeftRadius: 2,
                    borderTopRightRadius: 2,
                    backgroundColor: isHighlighted ? primaryColor : data.revenue > 0 ? (isDark ? `${primaryColor}60` : `${primaryColor}40`) : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                  }}
                />
              </View>
            );
          })}
        </View>

        {/* Month Labels */}
        <View className="flex-row justify-between mt-1">
          {monthlyRevenue.map((data) => {
            const isHighlighted = data.month === highlightedMonth && data.revenue > 0;
            return (
              <View key={data.month} className="flex-1 items-center">
                <Text style={{ fontSize: 8, color: isHighlighted ? primaryColor : colors.textTertiary, fontWeight: isHighlighted ? '600' : '400' }}>
                  {data.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? '#10B98130' : '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#10B981' }}>{currencySymbol}</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: 'bold' }}>{selectedYear} {t('revenue', language)}</Text>
        </View>
        <Text style={{ color: '#10B981', fontWeight: '600' }}>{formatRevenue(totalYearRevenue)}</Text>
      </View>

      {/* Bar Chart */}
      <View className="flex-row items-end justify-between" style={{ height: 120 }}>
        {monthlyRevenue.map((data) => {
          const barHeight = maxRevenue > 0 ? Math.max((data.revenue / maxRevenue) * 100, data.revenue > 0 ? 8 : 2) : 2;
          const isHighest = data.month === highestMonth.month && data.revenue > 0;

          return (
            <View key={data.month} className="flex-1 items-center mx-0.5">
              {/* Revenue value above bar */}
              {data.revenue > 0 && (
                <Text
                  style={{ fontSize: 8, marginBottom: 4, fontWeight: '500', color: isHighest ? '#10B981' : colors.textSecondary }}
                  numberOfLines={1}
                >
                  {formatRevenue(data.revenue)}
                </Text>
              )}
              {/* Bar */}
              <View
                style={{
                  width: '100%',
                  height: barHeight,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                  backgroundColor: isHighest ? '#10B981' : data.revenue > 0 ? (isDark ? '#065F46' : '#A7F3D0') : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                }}
              />
            </View>
          );
        })}
      </View>

      {/* Month Labels */}
      <View className="flex-row justify-between mt-2">
        {monthlyRevenue.map((data) => {
          const isHighest = data.month === highestMonth.month && data.revenue > 0;
          return (
            <View key={data.month} className="flex-1 items-center">
              <Text style={{ fontSize: 9, color: isHighest ? '#10B981' : colors.textTertiary, fontWeight: isHighest ? '600' : '400' }}>
                {data.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Highest month indicator */}
      {highestMonth.revenue > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Trophy size={14} color="#10B981" />
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4, flexShrink: 1 }} numberOfLines={1}>
            {t('bestLabel', language)}: <Text style={{ color: '#10B981', fontWeight: '600' }}>{getMonths(language)[highestMonth.month]}</Text> ({formatRevenue(highestMonth.revenue)})
          </Text>
        </View>
      )}
    </View>
  );
}
