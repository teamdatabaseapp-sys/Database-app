import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Users,
  UserPlus,
  Calendar,
  Gift,
  Scissors,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

// ============================================
// StatsGrid — 6 KPI cards
// ============================================

export interface StatsGridStats {
  totalClients: number;
  newClients: number;
  totalAppointments: number;
  revenue: number;
  promotionsRedeemed: number;
}

export interface StatsGridPreviousStats {
  totalClients: number;
  newClients: number;
  totalAppointments: number;
  revenue: number;
  promotionsRedeemed: number;
  totalServices: number;
}

export interface StatsGridProps {
  stats: StatsGridStats;
  previousMonthStats: StatsGridPreviousStats;
  totalServiceCount: number;
  currency: string;
  currencySymbol: string;
  language: Language;
  onDrillDown: (type: 'totalClients' | 'newClients' | 'totalAppointments' | 'revenue' | 'promotions' | 'topServices') => void;
}

const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

export function StatsGrid({
  stats,
  previousMonthStats,
  totalServiceCount,
  currency,
  currencySymbol,
  language,
  onDrillDown,
}: StatsGridProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View className="flex-row flex-wrap">
      {/* Total Clients */}
      <Animated.View
        entering={FadeInDown.delay(110).duration(300)}
        className="w-1/2 pr-2 mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('totalClients')}
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
          <View className="flex-row items-center justify-between mb-2">
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color={primaryColor} />
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{stats.totalClients}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('totalClients', language)}</Text>
          <View style={{ height: 20, marginTop: 4 }}>
            {calculateChange(stats.totalClients, previousMonthStats.totalClients) > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#22C55E' }}>
                +{calculateChange(stats.totalClients, previousMonthStats.totalClients)}%
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* New Clients */}
      <Animated.View
        entering={FadeInDown.delay(120).duration(300)}
        className="w-1/2 pl-2 mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('newClients')}
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
          <View className="flex-row items-center justify-between mb-2">
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={16} color={primaryColor} />
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{stats.newClients}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('newThisMonth', language)}</Text>
          <View style={{ height: 20, marginTop: 4 }}>
            {calculateChange(stats.newClients, previousMonthStats.newClients) > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#22C55E' }}>
                +{calculateChange(stats.newClients, previousMonthStats.newClients)}%
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Total Visits */}
      <Animated.View
        entering={FadeInDown.delay(130).duration(300)}
        className="w-1/2 pr-2 mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('totalAppointments')}
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
          <View className="flex-row items-center justify-between mb-2">
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} color={primaryColor} />
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{stats.totalAppointments}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('totalAppointments', language)}</Text>
          <View style={{ height: 20, marginTop: 4 }}>
            {calculateChange(stats.totalAppointments, previousMonthStats.totalAppointments) > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#22C55E' }}>
                +{calculateChange(stats.totalAppointments, previousMonthStats.totalAppointments)}%
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Revenue */}
      <Animated.View
        entering={FadeInDown.delay(140).duration(300)}
        className="w-1/2 pl-2 mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('revenue')}
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
          <View className="flex-row items-center justify-between mb-2">
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: primaryColor }}>{currencySymbol}</Text>
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{formatCurrency(stats.revenue, currency)}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('revenue', language)}</Text>
          <View style={{ height: 20, marginTop: 4 }}>
            {calculateChange(stats.revenue, previousMonthStats.revenue) > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#22C55E' }}>
                +{calculateChange(stats.revenue, previousMonthStats.revenue)}%
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Promotions Redeemed */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(300)}
        className="w-1/2 pr-2 mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('promotions')}
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
          <View className="flex-row items-center justify-between mb-2">
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={16} color={primaryColor} />
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{stats.promotionsRedeemed}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('promotionsRedeemed', language)}</Text>
          <View style={{ height: 20, marginTop: 4 }}>
            {calculateChange(stats.promotionsRedeemed, previousMonthStats.promotionsRedeemed) > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#22C55E' }}>
                +{calculateChange(stats.promotionsRedeemed, previousMonthStats.promotionsRedeemed)}%
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>

      {/* Top Services */}
      <Animated.View
        entering={FadeInDown.delay(160).duration(300)}
        className="w-1/2 pl-2 mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('topServices')}
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
          <View className="flex-row items-center justify-between mb-2">
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Scissors size={16} color={primaryColor} />
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold' }}>{totalServiceCount}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('topServices', language)}</Text>
          <View style={{ height: 20, marginTop: 4 }}>
            {calculateChange(totalServiceCount, previousMonthStats.totalServices) > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#22C55E' }}>
                +{calculateChange(totalServiceCount, previousMonthStats.totalServices)}%
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
