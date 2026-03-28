import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Clock,
  Star,
  UserX,
  Settings,
  ChevronRight,
  Users,
  TrendingUp,
  Zap,
  Crown,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import type { MarketingPromotion } from '@/lib/types';
import type { PromotionRedemptionRow } from '@/services/promotionRedemptionsService';

// ============================================
// InsightCards — AI insight cards + Growth Results
// ============================================

export interface InsightCardsAnalyticsClient {
  id: string;
  name: string;
  lastVisitAt: Date | null;
}

export interface InsightCardsBestClient {
  client: { name: string };
  totalVisits: number;
  totalRevenue: number;
}

export interface InsightCardsAnalyticsAppointment {
  clientId: string;
  amount?: number;
  promoId?: string;
  isCancelled: boolean;
}

export interface InsightCardsProps {
  peakDaysWithRevenue: { hasData: boolean; topDayNames: string[] };
  bestClientsInsight: {
    clients: InsightCardsBestClient[];
    topClient: InsightCardsBestClient | null;
    count: number;
  };
  inactiveClientsInsight: { count: number; atRiskDays: number };
  analyticsLoading: boolean;
  currency: string;
  language: Language;
  atRiskDays: number;
  onDrillDown: (type: 'busiestTimes' | 'bestClients' | 'clientsAtRisk') => void;
  onShowAtRiskSettings: () => void;
  // Growth Results inputs
  allAnalyticsClients: InsightCardsAnalyticsClient[];
  appointmentsThisPeriod: InsightCardsAnalyticsAppointment[];
  marketingPromotions: MarketingPromotion[];
  promotionRedemptionRows: PromotionRedemptionRow[];
  periodStart: Date;
}

export function InsightCards({
  peakDaysWithRevenue,
  bestClientsInsight,
  inactiveClientsInsight,
  analyticsLoading,
  currency,
  language,
  atRiskDays,
  onDrillDown,
  onShowAtRiskSettings,
  allAnalyticsClients,
  appointmentsThisPeriod,
  marketingPromotions,
  promotionRedemptionRows,
  periodStart,
}: InsightCardsProps) {
  const { colors, isDark, primaryColor } = useTheme();

  // ── Growth Results computation (previously IIFE) ──────────────────────────

  // Clients Recovered
  const atRiskCutoffForResults = new Date(periodStart);
  atRiskCutoffForResults.setDate(atRiskCutoffForResults.getDate() - atRiskDays);
  const recoveredClients = allAnalyticsClients.filter((client) => {
    const wasInactive = !client.lastVisitAt || client.lastVisitAt < atRiskCutoffForResults;
    const returnedThisPeriod = appointmentsThisPeriod.some((a) => a.clientId === client.id);
    return wasInactive && returnedThisPeriod;
  });
  const recoveredCount = recoveredClients.length;

  // Revenue Recovered
  const recoveredClientIds = new Set(recoveredClients.map((c) => c.id));
  const recoveredRevenue = appointmentsThisPeriod
    .filter((a) => recoveredClientIds.has(a.clientId))
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  // Bookings Added (Flash / Promo driven)
  const flashPromoIds = new Set(
    marketingPromotions
      .filter((p) => p.discountType === 'flash_sale')
      .map((p) => p.id)
  );
  const flashBookings = appointmentsThisPeriod.filter(
    (a) => a.promoId && flashPromoIds.has(a.promoId)
  );
  const flashBookingsCount = flashBookings.length;

  // Find which promo name was most used for flash bookings
  const flashPromoNameCounts: Record<string, { name: string; count: number }> = {};
  flashBookings.forEach((a) => {
    if (!a.promoId) return;
    const promo = marketingPromotions.find((p) => p.id === a.promoId);
    if (!promo) return;
    if (!flashPromoNameCounts[a.promoId]) {
      flashPromoNameCounts[a.promoId] = { name: promo.name, count: 0 };
    }
    flashPromoNameCounts[a.promoId].count++;
  });
  const topFlashPromo = Object.values(flashPromoNameCounts).sort((a, b) => b.count - a.count)[0] ?? null;

  // VIP Rewards Used (free_service redemptions)
  const vipPromoIds = new Set(
    marketingPromotions
      .filter((p) => p.discountType === 'free_service')
      .map((p) => p.id)
  );
  // Also include any redemption row with a promo that's free_service
  const vipRedemptions = promotionRedemptionRows.filter(
    (r) => vipPromoIds.has(r.promo_id)
  );
  const vipCount = vipRedemptions.length;

  // Also catch promo-driven bookings via any non-flash promo
  // Used just for a general "promotion-driven bookings" count if flash = 0
  const anyPromoBookings = appointmentsThisPeriod.filter((a) => !!a.promoId);
  const anyPromoBookingsCount = anyPromoBookings.length;

  const showClientsRecovered = recoveredCount > 0;
  const showRevenueRecovered = recoveredCount > 0 && recoveredRevenue > 0;
  const showFlashBookings = flashBookingsCount > 0;
  const showVipRewards = vipCount > 0;
  const showGrowthResults = showClientsRecovered || showRevenueRecovered || showFlashBookings || showVipRewards;

  return (
    <>
      {/* ========== AI INSIGHT CARDS (Same style as KPI cards) ========== */}

      {/* Your Busiest Times Card */}
      <Animated.View
        entering={FadeInDown.delay(210).duration(300)}
        className="mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('busiestTimes')}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} color={primaryColor} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 10, flex: 1 }} numberOfLines={1}>{t('yourBusiestTimes', language)}</Text>
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          {peakDaysWithRevenue.hasData && peakDaysWithRevenue.topDayNames.length > 0 ? (
            <>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 2 }}>
                {peakDaysWithRevenue.topDayNames.join(' & ')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {t('generatedHighestRevenueShort', language)}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>{t('notEnoughData', language)}</Text>
          )}
        </Pressable>
      </Animated.View>

      {/* Your Best Clients Card */}
      <Animated.View
        entering={FadeInDown.delay(220).duration(300)}
        className="mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('bestClients')}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Star size={16} color={primaryColor} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 10, flex: 1 }} numberOfLines={1}>{t('yourBestClients', language)}</Text>
            </View>
            <ChevronRight size={16} color={colors.border} />
          </View>
          {bestClientsInsight.clients.length > 0 && bestClientsInsight.topClient ? (
            <>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 2 }}>{bestClientsInsight.topClient.client.name}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                #{1} • {bestClientsInsight.topClient.totalVisits} {t('visits', language)} • {formatCurrency(bestClientsInsight.topClient.totalRevenue, currency)}
              </Text>
            </>
          ) : analyticsLoading ? (
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500' }}>{t('loading', language)}...</Text>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500' }}>{t('notEnoughData', language)}</Text>
          )}
        </Pressable>
      </Animated.View>

      {/* Clients At Risk Card */}
      <Animated.View
        entering={FadeInDown.delay(240).duration(300)}
        className="mb-4"
      >
        <Pressable
          onPress={() => onDrillDown('clientsAtRisk')}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                <UserX size={16} color={primaryColor} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 10, flex: 1 }} numberOfLines={1}>{t('clientsAtRisk', language)}</Text>
            </View>
            <View className="flex-row items-center">
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onShowAtRiskSettings();
                }}
                className="w-7 h-7 rounded-full items-center justify-center mr-1"
                style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15` }}
              >
                <Settings size={14} color={primaryColor} />
              </Pressable>
              <ChevronRight size={16} color={colors.border} />
            </View>
          </View>
          {inactiveClientsInsight.count > 0 ? (
            <>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 2 }}>
                {inactiveClientsInsight.count} {t('inactiveClientsDuring', language)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {t('noVisitInDays', language)} {atRiskDays} {t('daysLabel', language)}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>{t('allClientsActive', language)}</Text>
          )}
        </Pressable>
      </Animated.View>

      {/* ========== GROWTH RESULTS SECTION ========== */}
      {showGrowthResults && (
        <>
          {/* Section Header */}
          <Animated.View
            entering={FadeInDown.delay(340).duration(300)}
            className="mb-3 mt-2"
          >
            <View className="flex-row items-center">
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: isDark ? '#22C55E25' : '#F0FDF4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <TrendingUp size={15} color="#22C55E" />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>
                Growth Results
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, marginLeft: 38 }}>
              Measurable outcomes from your campaigns
            </Text>
          </Animated.View>

          {/* Results cards grid — 2 columns */}
          <Animated.View
            entering={FadeInDown.delay(360).duration(300)}
            className="flex-row flex-wrap mb-2"
            style={{ marginHorizontal: -6 }}
          >
            {/* Card: Clients Recovered */}
            {showClientsRecovered && (
              <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                  }}
                >
                  <View style={{ height: 3, backgroundColor: '#22C55E' }} />
                  <View style={{ padding: 14 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        backgroundColor: isDark ? '#22C55E25' : '#F0FDF4',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <Users size={16} color="#22C55E" />
                    </View>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 }}>
                      {recoveredCount}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>
                      Clients{'\n'}Recovered
                    </Text>
                    <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600', marginTop: 6 }}>
                      ↑ returned this period
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Card: Revenue Recovered */}
            {showRevenueRecovered && (
              <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                  }}
                >
                  <View style={{ height: 3, backgroundColor: '#10B981' }} />
                  <View style={{ padding: 14 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        backgroundColor: isDark ? '#10B98125' : '#ECFDF5',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <TrendingUp size={16} color="#10B981" />
                    </View>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatCurrency(recoveredRevenue, currency)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>
                      Revenue{'\n'}Recovered
                    </Text>
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600', marginTop: 6 }}>
                      from win-back clients
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Card: Flash Bookings Added */}
            {showFlashBookings && (
              <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                  }}
                >
                  <View style={{ height: 3, backgroundColor: '#F59E0B' }} />
                  <View style={{ padding: 14 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        backgroundColor: isDark ? '#F59E0B25' : '#FFFBEB',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <Zap size={16} color="#F59E0B" />
                    </View>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 }}>
                      {flashBookingsCount}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>
                      Bookings{'\n'}Added
                    </Text>
                    <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '600', marginTop: 6 }} numberOfLines={1}>
                      {topFlashPromo ? `via ${topFlashPromo.name}` : 'from flash promos'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Card: VIP Rewards Used */}
            {showVipRewards && (
              <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                  }}
                >
                  <View style={{ height: 3, backgroundColor: '#8B5CF6' }} />
                  <View style={{ padding: 14 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        backgroundColor: isDark ? '#8B5CF625' : '#F5F3FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <Crown size={16} color="#8B5CF6" />
                    </View>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 }}>
                      {vipCount}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>
                      VIP Rewards{'\n'}Redeemed
                    </Text>
                    <Text style={{ color: '#8B5CF6', fontSize: 11, fontWeight: '600', marginTop: 6 }}>
                      loyalty rewards used
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        </>
      )}
      {/* ========== END GROWTH RESULTS SECTION ========== */}

      {/* ========== END AI INSIGHT CARDS ========== */}
    </>
  );
}
