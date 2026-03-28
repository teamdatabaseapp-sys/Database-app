import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Mail,
  Zap,
  Gift,
  Trophy,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { StoreFilter } from './StoreFilter';
import { MonthlyRevenueChart, type AnalyticsAppointment } from './MonthlyRevenueChart';

// ============================================
// BestMonthDrillDown — bestMonth case
// ============================================

export interface BestMonthDrillDownBestMonth {
  month: string;
  monthIndex: number;
  visits: number;
  revenue: number;
}

export interface BestMonthDrillDownClient {
  id: string;
  name: string;
}

export interface BestMonthDrillDownClientItem {
  client: BestMonthDrillDownClient;
  visits: number;
  revenue: number;
}

export interface BestMonthDrillDownProps {
  bestMonth: BestMonthDrillDownBestMonth | null;
  bestMonthClients: BestMonthDrillDownClientItem[];
  /** Pre-filtered appointments for the MonthlyRevenueChart (store-filtered + non-cancelled) */
  chartAppointments: AnalyticsAppointment[];
  selectedYear: number;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  language: Language;
  currency: string;
  onClientPress: (clientId: string) => void;
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

export function BestMonthDrillDown({
  bestMonth,
  bestMonthClients,
  chartAppointments,
  selectedYear,
  stores,
  selectedStoreId,
  onSelectStore,
  language,
  currency,
  onClientPress,
  onOpenSmartDrip,
  onOpenMarketing,
}: BestMonthDrillDownProps) {
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
        {t('bestMonth', language)} {selectedYear}
      </Text>
      {onOpenSmartDrip && (
        <Pressable
          onPress={() => onOpenSmartDrip({ name: t('smartTripBestMonthName', language), frequency: 'monthly', contextLabel: t('smartRecommendationBestMonthRepeat', language) })}
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
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('smartRecommendationBestMonthRepeat', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {onOpenMarketing && bestMonth && (
        <Pressable
          onPress={() => onOpenMarketing({ discountType: 'percentage', name: '', contextLabel: `${t('aiRecTopServicesPromo', language)} — ${bestMonth?.month ?? ''}` })}
          style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiMarketingPromotion', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecTopServicesPromo', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {bestMonth ? (
        <>
          <View
            className="rounded-xl p-4 mb-4"
            style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}15` }}
          >
            <View className="flex-row items-center">
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Trophy size={24} color={primaryColor} />
              </View>
              <View className="flex-1">
                <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 20 }}>{bestMonth.month}</Text>
                <Text style={{ color: isDark ? `${primaryColor}CC` : primaryColor }}>
                  {bestMonth.visits} {bestMonth.visits !== 1 ? t('visits', language) : t('visit', language)} • {formatCurrency(bestMonth.revenue, currency)} {t('revenue', language).toLowerCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* Monthly Revenue Chart - Compact version inside Best Month */}
          <MonthlyRevenueChart
            appointments={chartAppointments}
            selectedYear={selectedYear}
            language={language}
            currency={currency}
            compact={true}
            highlightMonthIndex={bestMonth.monthIndex}
          />

          {/* Client List for Best Month */}
          {bestMonthClients.length > 0 && (
            <>
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 12 }}>
                {t('clientsIn', language)} {bestMonth.month} ({bestMonthClients.length})
              </Text>
              {bestMonthClients.map((item) => (
                <Pressable
                  key={item.client.id}
                  onPress={() => onClientPress(item.client.id)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                  }}
                >
                  <View className="flex-row items-center">
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: primaryColor, fontWeight: 'bold' }}>
                        {item.client.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text, fontWeight: '500' }}>{item.client.name}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                        {t('totalSpentIn', language)} {bestMonth.month}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text style={{ color: primaryColor, fontWeight: 'bold', marginRight: 8 }}>{formatCurrency(item.revenue, currency)}</Text>
                      <ChevronRight size={18} color={colors.textTertiary} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </>
      ) : (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('noActivityThisYear', language)}</Text>
      )}
    </View>
  );
}
