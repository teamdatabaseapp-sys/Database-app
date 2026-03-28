import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  Store as StoreIcon,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Award,
  Zap,
  ChevronDown,
  ChevronUp,
  Check,
  BarChart3,
  Gift,
  Heart,
  CreditCard,
  Users,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { useStoreBreakdownAnalytics } from '@/hooks/useAnalytics';
import { promotionRedemptionKeys } from '@/hooks/usePromotionRedemptions';
import { getPromotionsRedeemedCount } from '@/services/promotionRedemptionsService';
import { useBusiness } from '@/hooks/useBusiness';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useAllMemberships } from '@/hooks/useMembership';
import { getSupabase } from '@/lib/supabaseClient';

interface StoreCompareModeProps {
  stores: Array<{ id: string; name: string }>;
  periodStart: Date;
  periodEnd: Date;
  previousPeriodStart: Date;
  previousPeriodEnd: Date;
  language: Language;
  currency: string;
  onClose?: () => void;
}

interface StoreInsight {
  type: 'topPerforming' | 'fastestGrowing' | 'biggestDrop';
  storeId: string;
  storeName: string;
  value: number;
  metric: string;
}

export function StoreCompareMode({
  stores,
  periodStart,
  periodEnd,
  previousPeriodStart,
  previousPeriodEnd,
  language,
  currency,
}: StoreCompareModeProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const { businessId } = useBusiness();
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(
    stores.slice(0, Math.min(stores.length, 5)).map(s => s.id)
  );
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  // Fetch per-store RPC data (current + previous period) in parallel
  const { breakdown, isLoading } = useStoreBreakdownAnalytics({
    startDate: periodStart,
    endDate: periodEnd,
    previousStartDate: previousPeriodStart,
    previousEndDate: previousPeriodEnd,
    stores,
    enabled: stores.length > 1,
  });

  // Fetch per-store promotions redeemed count in parallel
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();
  const promoCountByStore = useQueries({
    queries: stores.map((store) => ({
      queryKey: promotionRedemptionKeys.count(businessId || '', startIso, endIso, store.id),
      queryFn: async (): Promise<number> => {
        if (!businessId) return 0;
        const result = await getPromotionsRedeemedCount(
          businessId,
          new Date(startIso),
          new Date(endIso),
          store.id
        );
        return result.data ?? 0;
      },
      enabled: !!businessId && stores.length > 1,
      staleTime: 30 * 1000,
    })),
    combine: (results) => {
      const map: Record<string, number> = {};
      stores.forEach((store, idx) => {
        map[store.id] = results[idx]?.data ?? 0;
      });
      return map;
    },
  });

  // Fetch per-store gift card revenue (sum of original_value for active/fully_used cards in period)
  const giftCardCountByStore = useQueries({
    queries: stores.map((store) => ({
      queryKey: ['gift_cards_revenue_by_store', businessId || '', store.id, startIso, endIso],
      queryFn: async (): Promise<number> => {
        if (!businessId) return 0;
        const { data, error } = await getSupabase()
          .from('gift_cards')
          .select('original_value')
          .eq('business_id', businessId)
          .eq('store_id', store.id)
          .in('status', ['active', 'fully_used', 'expired'])
          .neq('status', 'cancelled')
          .gte('issued_at', startIso)
          .lt('issued_at', endIso);
        if (error) {
          console.warn('[GiftCards] gift_card_revenue_by_store error:', error.message);
          return 0;
        }
        const total = (data ?? []).reduce((sum, row) => sum + (row.original_value ?? 0), 0);
        console.log(`[GiftCards] store=${store.id} period=${startIso}→${endIso} rows=${data?.length ?? 0} total=${total}`);
        return total;
      },
      enabled: !!businessId && stores.length > 1,
      staleTime: 60 * 1000,
    })),
    combine: (results) => {
      const map: Record<string, number> = {};
      stores.forEach((store, idx) => {
        map[store.id] = results[idx]?.data ?? 0;
      });
      return map;
    },
  });

  // Business-wide loyalty members count (no store_id column on client_loyalty)
  const { data: allLoyaltyData = [] } = useAllClientLoyalty();
  const totalLoyaltyMembers = useMemo(
    () => allLoyaltyData.filter((l) => l.is_enrolled).length,
    [allLoyaltyData]
  );

  // Business-wide memberships count (no store_id column on client_memberships)
  const { data: allMembershipsData = [] } = useAllMemberships();
  const totalMemberships = useMemo(
    () => allMembershipsData.filter((m) => m.status === 'active').length,
    [allMembershipsData]
  );

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };

  const toggleAllStores = () => {
    setSelectedStoreIds(
      selectedStoreIds.length === stores.length ? [] : stores.map(s => s.id)
    );
  };

  // Filter breakdown to only the selected stores
  const selectedBreakdown = useMemo(
    () => breakdown.filter(s => selectedStoreIds.includes(s.store_id)),
    [breakdown, selectedStoreIds]
  );

  // Build performance data in display-ready dollars
  const storePerformanceData = useMemo(() =>
    selectedBreakdown.map(s => ({
      storeId: s.store_id,
      storeName: s.store_name,
      revenue: s.revenue_cents / 100,
      previousRevenue: s.prev_revenue_cents / 100,
      appointments: s.appointments,
      previousAppointments: s.prev_appointments,
      revenueCents: s.revenue_cents,
      prevRevenueCents: s.prev_revenue_cents,
    })),
    [selectedBreakdown]
  );

  // Insights
  const insights = useMemo((): StoreInsight[] => {
    if (storePerformanceData.length < 2) return [];
    const list: StoreInsight[] = [];

    const topRevenue = [...storePerformanceData].sort((a, b) => b.revenueCents - a.revenueCents)[0];
    if (topRevenue && topRevenue.revenueCents > 0) {
      list.push({ type: 'topPerforming', storeId: topRevenue.storeId, storeName: topRevenue.storeName, value: topRevenue.revenue, metric: 'revenue' });
    }

    const withGrowth = storePerformanceData.map(s => ({
      ...s,
      growthRate: s.prevRevenueCents > 0
        ? ((s.revenueCents - s.prevRevenueCents) / s.prevRevenueCents) * 100
        : s.revenueCents > 0 ? 100 : 0,
    }));

    const fastest = [...withGrowth].sort((a, b) => b.growthRate - a.growthRate)[0];
    if (fastest && fastest.growthRate > 0) {
      list.push({ type: 'fastestGrowing', storeId: fastest.storeId, storeName: fastest.storeName, value: fastest.growthRate, metric: 'growth' });
    }

    const dropped = [...withGrowth].sort((a, b) => a.growthRate - b.growthRate)[0];
    if (dropped && dropped.growthRate < 0) {
      list.push({ type: 'biggestDrop', storeId: dropped.storeId, storeName: dropped.storeName, value: Math.abs(dropped.growthRate), metric: 'decline' });
    }

    return list;
  }, [storePerformanceData]);

  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const getInsightIcon = (type: StoreInsight['type']) => {
    switch (type) {
      case 'topPerforming': return <Award size={20} color={primaryColor} />;
      case 'fastestGrowing': return <Zap size={20} color={primaryColor} />;
      case 'biggestDrop': return <TrendingDown size={20} color={primaryColor} />;
    }
  };

  const getInsightLabel = (type: StoreInsight['type']) => {
    switch (type) {
      case 'topPerforming': return t('topPerformingStore', language);
      case 'fastestGrowing': return t('fastestGrowingStore', language);
      case 'biggestDrop': return t('biggestRevenueDrop', language);
    }
  };

  // Reusable ranking row renderer
  const renderRankingRows = (
    data: Array<{ storeId: string; storeName: string; count: number }>,
    showTrend = false,
    trendData?: Array<{ storeId: string; prevCount: number }>,
    formatValue?: (v: number) => string
  ) => {
    const maxCount = Math.max(...data.map(s => s.count), 1);
    return data.map((store, index) => {
      const barWidth = maxCount > 0 ? (store.count / maxCount) * 100 : 0;
      const prev = trendData?.find(t => t.storeId === store.storeId)?.prevCount ?? 0;
      const changePercent = showTrend ? getChangePercent(store.count, prev) : 0;
      return (
        <View
          key={store.storeId}
          style={{
            padding: 14,
            borderBottomWidth: index < data.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 14, width: 24 }}>#{index + 1}</Text>
              <Text style={{ color: colors.text, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                {getLocalizedStoreName(store.storeName, language)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '600', marginRight: showTrend && changePercent !== 0 ? 8 : 0 }}>
                {formatValue ? formatValue(store.count) : store.count}
              </Text>
              {showTrend && changePercent !== 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {changePercent > 0
                    ? <TrendingUp size={14} color={primaryColor} />
                    : <TrendingDown size={14} color={colors.textTertiary} />}
                  <Text style={{ color: changePercent > 0 ? primaryColor : colors.textTertiary, fontSize: 12, fontWeight: '500', marginLeft: 2 }}>
                    {changePercent > 0 ? '+' : ''}{changePercent}%
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ height: 6, backgroundColor: isDark ? colors.backgroundTertiary : '#E2E8F0', borderRadius: 3 }}>
            <View style={{ height: '100%', width: `${barWidth}%`, backgroundColor: primaryColor, borderRadius: 3 }} />
          </View>
        </View>
      );
    });
  };

  if (stores.length < 2) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <StoreIcon size={48} color={colors.textTertiary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
          {t('selectAtLeastTwoStores', language)}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Store Picker */}
      <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 20 }}>
        <Pressable
          onPress={() => setShowStorePicker(!showStorePicker)}
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <StoreIcon size={20} color={primaryColor} />
            </View>
            <View>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                {t('selectStoresToCompare', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                {selectedStoreIds.length} / {stores.length} {t('stores', language).toLowerCase()}
              </Text>
            </View>
          </View>
          {showStorePicker ? <ChevronUp size={20} color={colors.textSecondary} /> : <ChevronDown size={20} color={colors.textSecondary} />}
        </Pressable>

        {showStorePicker && (
          <View style={{ backgroundColor: colors.card, borderRadius: 12, marginTop: 8, overflow: 'hidden' }}>
            <Pressable
              onPress={toggleAllStores}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: selectedStoreIds.length === stores.length ? primaryColor : colors.border, backgroundColor: selectedStoreIds.length === stores.length ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                {selectedStoreIds.length === stores.length && <Check size={14} color="#fff" />}
              </View>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{t('allStores', language)}</Text>
            </Pressable>
            {stores.map((store, index) => (
              <Pressable
                key={store.id}
                onPress={() => toggleStore(store.id)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: index < stores.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: selectedStoreIds.includes(store.id) ? primaryColor : colors.border, backgroundColor: selectedStoreIds.includes(store.id) ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  {selectedStoreIds.includes(store.id) && <Check size={14} color="#fff" />}
                </View>
                <Text style={{ color: colors.text }}>{getLocalizedStoreName(store.name, language)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>

      {selectedStoreIds.length < 2 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <BarChart3 size={48} color={colors.textTertiary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
            {t('selectAtLeastTwoStores', language)}
          </Text>
        </View>
      ) : isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
            {t('loading', language)}...
          </Text>
        </View>
      ) : (
        <>
          {/* Store Insights */}
          {insights.length > 0 && (
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                {t('storeInsights', language)}
              </Text>
              <View style={{ gap: 10 }}>
                {insights.map((insight) => (
                  <Pressable
                    key={insight.type}
                    onPress={() => setExpandedInsight(expandedInsight === insight.type ? null : insight.type)}
                    style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: primaryColor }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        {getInsightIcon(insight.type)}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
                          {getInsightLabel(insight.type)}
                        </Text>
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginTop: 2 }}>
                          {getLocalizedStoreName(insight.storeName, language)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        {insight.metric === 'revenue' ? (
                          <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 16 }}>
                            {formatCurrency(insight.value, currency)}
                          </Text>
                        ) : (
                          <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 16 }}>
                            {insight.value.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Store Rankings */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
              {t('storeRankings', language)}
            </Text>

            {/* Revenue by Store */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <DollarSign size={18} color={primaryColor} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  {t('revenueByStore', language)}
                </Text>
              </View>
              {[...storePerformanceData]
                .sort((a, b) => b.revenueCents - a.revenueCents)
                .map((store, index) => {
                  const changePercent = getChangePercent(store.revenueCents, store.prevRevenueCents);
                  const maxCents = Math.max(...storePerformanceData.map(s => s.revenueCents), 1);
                  const barWidth = (store.revenueCents / maxCents) * 100;
                  return (
                    <View key={store.storeId} style={{ padding: 14, borderBottomWidth: index < storePerformanceData.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Text style={{ color: colors.textTertiary, fontSize: 14, width: 24 }}>#{index + 1}</Text>
                          <Text style={{ color: colors.text, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                            {getLocalizedStoreName(store.storeName, language)}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: colors.text, fontWeight: '600', marginRight: changePercent !== 0 ? 8 : 0 }}>
                            {formatCurrency(store.revenue, currency)}
                          </Text>
                          {changePercent !== 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {changePercent > 0 ? <TrendingUp size={14} color={primaryColor} /> : <TrendingDown size={14} color={colors.textTertiary} />}
                              <Text style={{ color: changePercent > 0 ? primaryColor : colors.textTertiary, fontSize: 12, fontWeight: '500', marginLeft: 2 }}>
                                {changePercent > 0 ? '+' : ''}{changePercent}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ height: 6, backgroundColor: isDark ? colors.backgroundTertiary : '#E2E8F0', borderRadius: 3 }}>
                        <View style={{ height: '100%', width: `${barWidth}%`, backgroundColor: primaryColor, borderRadius: 3 }} />
                      </View>
                    </View>
                  );
                })}
            </View>

            {/* Appointments by Store */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <Calendar size={18} color={primaryColor} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  {t('appointmentsByStore', language)}
                </Text>
              </View>
              {renderRankingRows(
                [...storePerformanceData]
                  .sort((a, b) => b.appointments - a.appointments)
                  .map(s => ({ storeId: s.storeId, storeName: s.storeName, count: s.appointments })),
                true,
                storePerformanceData.map(s => ({ storeId: s.storeId, prevCount: s.previousAppointments }))
              )}
            </View>

            {/* Promotions Redeemed by Store */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <Gift size={18} color={primaryColor} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  {t('promotionsRedeemed', language)}
                </Text>
              </View>
              {renderRankingRows(
                [...storePerformanceData]
                  .sort((a, b) => (promoCountByStore[b.storeId] ?? 0) - (promoCountByStore[a.storeId] ?? 0))
                  .map(s => ({ storeId: s.storeId, storeName: s.storeName, count: promoCountByStore[s.storeId] ?? 0 }))
              )}
            </View>

            {/* Gift Card Sales by Store */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <CreditCard size={18} color={primaryColor} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  {t('giftCardSalesByStore', language)}
                </Text>
              </View>
              {renderRankingRows(
                [...storePerformanceData]
                  .sort((a, b) => (giftCardCountByStore[b.storeId] ?? 0) - (giftCardCountByStore[a.storeId] ?? 0))
                  .map(s => ({ storeId: s.storeId, storeName: s.storeName, count: giftCardCountByStore[s.storeId] ?? 0 })),
                false,
                undefined,
                (v) => formatCurrency(v, currency)
              )}
            </View>

            {/* Loyalty Members by Store */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <Heart size={18} color={primaryColor} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  Loyalty Members by Store
                </Text>
              </View>
              {/* Loyalty has no store_id — show business total equally across stores */}
              {renderRankingRows(
                storePerformanceData.map(s => ({
                  storeId: s.storeId,
                  storeName: s.storeName,
                  count: totalLoyaltyMembers,
                }))
              )}
            </View>

            {/* Memberships Registered by Store */}
            <View style={{ backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' }}>
              <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                <Users size={18} color={primaryColor} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  Memberships Registered by Store
                </Text>
              </View>
              {/* Memberships have no store_id — show business total equally across stores */}
              {renderRankingRows(
                storePerformanceData.map(s => ({
                  storeId: s.storeId,
                  storeName: s.storeName,
                  count: totalMemberships,
                }))
              )}
            </View>
          </Animated.View>
        </>
      )}
    </ScrollView>
  );
}
