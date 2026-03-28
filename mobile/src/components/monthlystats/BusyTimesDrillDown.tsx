import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Mail,
  Zap,
  Clock,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { StoreFilter } from './StoreFilter';

// ============================================
// BusyTimesDrillDown — busiestTimes case
// ============================================

export interface BusyTimesDrillDownDay {
  name: string;
  fullName: string;
  visits: number;
  revenue: number;
  percentage: number;
}

export interface BusyTimesDrillDownPeakDays {
  days: BusyTimesDrillDownDay[];
  hasData: boolean;
  topDayNames: string[];
}

export interface BusyTimesDrillDownProps {
  peakDays: BusyTimesDrillDownPeakDays;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  language: Language;
  currency: string;
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
  onOpenMarketing?: (prefill?: {
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string;
    contextLabel?: string;
  }) => void;
}

export function BusyTimesDrillDown({
  peakDays,
  stores,
  selectedStoreId,
  onSelectStore,
  language,
  currency,
  onOpenSmartDrip,
  onOpenMarketing,
}: BusyTimesDrillDownProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View>
      <StoreFilter
        stores={stores}
        selectedStoreId={selectedStoreId}
        onSelect={onSelectStore}
        language={language}
      />
      <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
        {t('yourBusiestTimes', language)}
      </Text>
      {peakDays.hasData ? (
        <>
          <View
            className="rounded-xl p-4 mb-4"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <View className="flex-row items-center mb-3">
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: `${primaryColor}30`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Clock size={24} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>
                  {peakDays.topDayNames.join(' & ')}
                </Text>
                <Text style={{ color: colors.textSecondary }}>{t('highestRevenueDays', language)}</Text>
              </View>
            </View>
          </View>
          {/* AI Recommendation Cards — Drip + Marketing for slowest day */}
          {(() => {
            const slowestDay = peakDays.hasData && peakDays.days.some((d) => d.revenue > 0)
              ? [...peakDays.days].sort((a, b) => a.revenue - b.revenue)[0]
              : null;
            if (!slowestDay) return null;
            return (
              <>
                {onOpenSmartDrip && (
                  <Pressable
                    onPress={() => onOpenSmartDrip({
                      name: `${slowestDay.fullName} Boost Campaign`,
                      frequency: 'monthly',
                      contextLabel: t('aiRecSlowDayDripContext', language).replace('{day}', slowestDay.fullName),
                    })}
                    style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                      <Mail size={24} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Zap size={14} color={primaryColor} />
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiSmartDripCampaign', language)}</Text>
                      </View>
                      <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecBusiestTimesDrip', language)}</Text>
                    </View>
                    <ChevronRight size={20} color={primaryColor} />
                  </Pressable>
                )}
                {onOpenMarketing && (
                  <Pressable
                    onPress={() => onOpenMarketing({
                      discountType: 'flash_sale',
                      name: `${slowestDay.fullName} Flash Sale`,
                      contextLabel: t('aiRecSlowDayPromoContext', language).replace('{day}', slowestDay.fullName),
                    })}
                    style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                      <Zap size={24} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Zap size={14} color={primaryColor} />
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiMarketingPromotion', language)}</Text>
                      </View>
                      <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecBusiestTimesPromo', language)}</Text>
                    </View>
                    <ChevronRight size={20} color={primaryColor} />
                  </Pressable>
                )}
              </>
            );
          })()}
          <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 12 }}>{t('revenueByDay', language)}</Text>
          {peakDays.days.map((day) => (
            <View
              key={day.name}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ color: colors.text, fontWeight: '500' }}>{day.fullName}</Text>
                <Text style={{ color: colors.textSecondary }}>{day.visits} {day.visits !== 1 ? t('visits', language) : t('visit', language)} • {formatCurrency(day.revenue, currency)}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    borderRadius: 4,
                    width: `${day.percentage}%`,
                    backgroundColor: day.percentage > 80 ? primaryColor : day.percentage > 50 ? `${primaryColor}CC` : `${primaryColor}80`,
                  }}
                />
              </View>
            </View>
          ))}
        </>
      ) : (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('notEnoughData', language)}</Text>
      )}
    </View>
  );
}
