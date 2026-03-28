import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Mail,
  Zap,
  Crown,
  Star,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { StoreFilter } from './StoreFilter';

// ============================================
// BestClientsDrillDown — bestClients case
// ============================================

export interface BestClientsDrillDownClient {
  id: string;
  name: string;
}

export interface BestClientsDrillDownClientItem {
  client: BestClientsDrillDownClient;
  totalVisits: number;
  totalRevenue: number;
  lastVisit: Date | null;
  score: number;
}

export interface BestClientsDrillDownInsight {
  count: number;
  clients: BestClientsDrillDownClientItem[];
}

export interface BestClientsDrillDownProps {
  insight: BestClientsDrillDownInsight;
  sortBy: 'score' | 'visits' | 'revenue';
  onSortByChange: (sort: 'score' | 'visits' | 'revenue') => void;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  language: Language;
  dateLocale: Locale | undefined;
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

function capitalizeDate(str: string): string {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
}

export function BestClientsDrillDown({
  insight,
  sortBy,
  onSortByChange,
  stores,
  selectedStoreId,
  onSelectStore,
  language,
  dateLocale,
  currency,
  onClientPress,
  onOpenSmartDrip,
  onOpenMarketing,
}: BestClientsDrillDownProps) {
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
        {t('yourBestClients', language)} ({insight.count})
      </Text>

      {/* Sort Filter Buttons */}
      <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, padding: 4 }}>
        <Pressable
          onPress={() => onSortByChange('visits')}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: sortBy === 'visits' ? primaryColor : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: sortBy === 'visits' ? '#fff' : colors.textSecondary,
            }}
          >
            {t('mostVisits', language)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onSortByChange('revenue')}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: sortBy === 'revenue' ? primaryColor : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: sortBy === 'revenue' ? '#fff' : colors.textSecondary,
            }}
          >
            {t('byRevenue', language)}
          </Text>
        </Pressable>
      </View>

      <View
        className="rounded-xl p-3 mb-4"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        <Text style={{ color: primaryColor, fontSize: 14 }}>
          {sortBy === 'visits'
            ? t('sortedByVisits', language)
            : t('sortedByRevenue', language)}
        </Text>
      </View>
      {insight.clients.length > 0 && (
        <>
          {onOpenSmartDrip && (
            <Pressable
              onPress={() => onOpenSmartDrip({
                name: 'VIP Retention Campaign',
                frequency: 'monthly',
                contextLabel: t('aiRecVipDripContext', language).replace('{count}', String(insight.count)),
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
                <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecBestClientsDrip', language)}</Text>
              </View>
              <ChevronRight size={20} color={primaryColor} />
            </Pressable>
          )}
          {onOpenMarketing && (
            <Pressable
              onPress={() => onOpenMarketing({
                discountType: 'free_service',
                name: 'VIP Reward',
                contextLabel: t('aiRecVipPromoContext', language),
              })}
              style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Crown size={24} color={primaryColor} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Zap size={14} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiMarketingPromotion', language)}</Text>
                </View>
                <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecBestClientsPromo', language)}</Text>
              </View>
              <ChevronRight size={20} color={primaryColor} />
            </Pressable>
          )}
        </>
      )}
      {insight.clients.slice(0, 20).map((item, index) => {
        // Define colors for top 3: gold, silver, bronze
        const getRankStyle = (rank: number) => {
          if (rank === 0) return { bg: isDark ? '#92400E30' : '#FEF3C7', starColor: '#F59E0B', textColor: '#92400E' }; // Gold
          if (rank === 1) return { bg: isDark ? colors.backgroundTertiary : '#F1F5F9', starColor: '#94A3B8', textColor: '#475569' }; // Silver
          if (rank === 2) return { bg: isDark ? '#9A341230' : '#FED7AA', starColor: '#EA580C', textColor: '#9A3412' }; // Bronze
          return null;
        };
        const rankStyle = getRankStyle(index);

        return (
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
              <View className="w-10 h-10 items-center justify-center" style={{ backgroundColor: rankStyle ? rankStyle.bg : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderRadius: 20 }}>
                {rankStyle ? (
                  <View className="relative items-center justify-center">
                    <Star size={28} color={rankStyle.starColor} fill={rankStyle.starColor} />
                    <Text
                      className="absolute font-bold text-xs"
                      style={{ color: index === 0 ? '#FFFFFF' : rankStyle.textColor, marginTop: 1 }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>{index + 1}</Text>
                )}
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ color: colors.text, fontWeight: '500' }}>{item.client.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                  {item.totalVisits} {item.totalVisits !== 1 ? t('visits', language) : t('visit', language)} • {formatCurrency(item.totalRevenue, currency)} {t('totalLabel', language)}
                </Text>
              </View>
              <View className="items-end">
                {item.lastVisit && (
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {t('lastVisitShort', language)}: {capitalizeDate(format(item.lastVisit, 'MMM d', { locale: dateLocale }))}
                  </Text>
                )}
                <ChevronRight size={18} color={colors.textTertiary} />
              </View>
            </View>
          </Pressable>
        );
      })}
      {insight.clients.length === 0 && (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('noClientsWithVisitsYet', language)}</Text>
      )}
    </View>
  );
}
