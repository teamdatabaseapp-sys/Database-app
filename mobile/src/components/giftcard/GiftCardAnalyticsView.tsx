import React from 'react';
import { View, Text } from 'react-native';
import {
  Gift,
  DollarSign,
  CreditCard,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Award,
  Percent,
  AlertTriangle,
  Crown,
  Star,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language, GiftCard } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

interface GiftCardAnalyticsViewProps {
  giftCards: GiftCard[];
  currency: string;
  language: Language;
}

export function GiftCardAnalyticsView({ giftCards, currency, language }: GiftCardAnalyticsViewProps) {
  const { colors, isDark, primaryColor } = useTheme();

  // ── Computed metrics ─────────────────────────────────────────────────────
  const totalIssued = giftCards.length;
  const valueCards = giftCards.filter(gc => gc.type === 'value');
  const activeCards = giftCards.filter(gc => gc.status === 'active');
  const fullyRedeemed = giftCards.filter(gc => gc.status === 'fully_used');

  const totalValueSold = valueCards.reduce((sum, gc) => sum + (gc.originalValue ?? 0), 0);
  const outstandingBalance = activeCards
    .filter(gc => gc.type === 'value')
    .reduce((sum, gc) => sum + (gc.currentBalance ?? 0), 0);
  const totalRedeemedValue = valueCards.reduce((sum, gc) => {
    const original = gc.originalValue ?? 0;
    const remaining = gc.currentBalance ?? original;
    return sum + (original - remaining);
  }, 0);
  const avgValue = valueCards.length > 0 ? totalValueSold / valueCards.length : 0;
  const largestCard = valueCards.reduce((max, gc) => Math.max(max, gc.originalValue ?? 0), 0);
  const redemptionRate = totalIssued > 0 ? Math.round((fullyRedeemed.length / totalIssued) * 100) : 0;
  // Breakage: outstanding balance on expired or abandoned cards
  const breakageEstimate = giftCards
    .filter(gc => gc.status === 'expired' || (gc.status === 'active' && gc.expiresAt && gc.expiresAt < new Date()))
    .reduce((sum, gc) => sum + (gc.currentBalance ?? 0), 0);

  // Top clients by total value redeemed
  const clientRedemptions: Record<string, { name: string; redeemed: number }> = {};
  valueCards.forEach(gc => {
    if (!gc.recipientName) return;
    const key = gc.recipientEmail ?? gc.recipientName;
    const redeemed = (gc.originalValue ?? 0) - (gc.currentBalance ?? gc.originalValue ?? 0);
    if (redeemed <= 0) return;
    if (!clientRedemptions[key]) clientRedemptions[key] = { name: gc.recipientName, redeemed: 0 };
    clientRedemptions[key].redeemed += redeemed;
  });
  const topClients = Object.values(clientRedemptions)
    .sort((a, b) => b.redeemed - a.redeemed)
    .slice(0, 5);

  const hasData = totalIssued > 0;

  // ── Card styles ───────────────────────────────────────────────────────────
  const iconBg = isDark ? `${primaryColor}30` : `${primaryColor}15`;

  function StatCard({
    icon: Icon,
    value,
    label,
    delay,
    wide,
  }: {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    value: string;
    label: string;
    delay: number;
    wide?: boolean;
  }) {
    return (
      <Animated.View
        entering={FadeInDown.delay(delay).duration(300)}
        style={{ width: wide ? '100%' : '50%', paddingHorizontal: 6, marginBottom: 12 }}
      >
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, minHeight: 110 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Icon size={20} color={primaryColor} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {value}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {label}
          </Text>
        </View>
      </Animated.View>
    );
  }

  if (!hasData) {
    return (
      <Animated.View
        entering={FadeInDown.delay(100).duration(300)}
        style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 }}
      >
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <BarChart2 size={34} color={primaryColor} />
        </View>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
          {t('giftCardAnalyticsNoData', language)}
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
          {t('giftCardAnalyticsNoDataDesc', language)}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View>
      {/* ── PRIMARY METRICS ── */}
      <Animated.View entering={FadeInDown.delay(0).duration(250)}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginHorizontal: 6 }}>
          Overview
        </Text>
      </Animated.View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        <StatCard icon={Gift}        value={String(totalIssued)}                         label={t('giftCardAnalyticsTotalIssued', language)}   delay={0} />
        <StatCard icon={DollarSign}  value={formatCurrency(totalValueSold, currency)}    label={t('giftCardAnalyticsTotalValue', language)}    delay={50} />
        <StatCard icon={CreditCard}  value={String(activeCards.length)}                  label={t('giftCardAnalyticsActiveCards', language)}   delay={100} />
        <StatCard icon={CheckCircle} value={String(fullyRedeemed.length)}                label={t('giftCardAnalyticsRedeemedCards', language)} delay={150} />
      </View>

      {/* ── FINANCIAL METRICS ── */}
      <Animated.View entering={FadeInDown.delay(200).duration(250)}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 6, marginHorizontal: 6 }}>
          Financials
        </Text>
      </Animated.View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        <StatCard icon={TrendingDown} value={formatCurrency(outstandingBalance, currency)} label={t('giftCardAnalyticsOutstandingBalance', language)} delay={210} />
        <StatCard icon={TrendingUp}   value={formatCurrency(totalRedeemedValue, currency)} label={t('giftCardAnalyticsTotalRedeemed', language)}      delay={240} />
        <StatCard icon={BarChart2}    value={formatCurrency(avgValue, currency)}            label={t('giftCardAnalyticsAvgValue', language)}           delay={270} />
        <StatCard icon={Award}        value={formatCurrency(largestCard, currency)}         label={t('giftCardAnalyticsLargestCard', language)}        delay={300} />
      </View>

      {/* ── INTELLIGENCE METRICS ── */}
      <Animated.View entering={FadeInDown.delay(330).duration(250)}>
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 6, marginHorizontal: 6 }}>
          Intelligence
        </Text>
      </Animated.View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        <StatCard icon={Percent}       value={`${redemptionRate}%`}                          label={t('giftCardAnalyticsRedemptionRate', language)} delay={340} />
        <StatCard icon={AlertTriangle} value={formatCurrency(breakageEstimate, currency)}    label={t('giftCardAnalyticsBreakage', language)}       delay={370} />
      </View>

      {/* ── TOP CLIENTS ── */}
      {topClients.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(400).duration(300)}
          style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginTop: 4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Crown size={20} color={primaryColor} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
              {t('giftCardAnalyticsTopClients', language)}
            </Text>
          </View>
          {topClients.map((client, index) => {
            const getRankStyle = (rank: number) => {
              if (rank === 0) return { bg: isDark ? '#92400E30' : '#FEF3C7', starColor: '#F59E0B', textColor: '#92400E' };
              if (rank === 1) return { bg: isDark ? colors.backgroundTertiary : '#F1F5F9', starColor: '#94A3B8', textColor: '#475569' };
              if (rank === 2) return { bg: isDark ? '#9A341230' : '#FED7AA', starColor: '#EA580C', textColor: '#9A3412' };
              return null;
            };
            const rankStyle = getRankStyle(index);
            return (
              <View
                key={client.name + index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: rankStyle ? rankStyle.bg : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}
                  >
                    {rankStyle ? (
                      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                        <Star size={28} color={rankStyle.starColor} fill={rankStyle.starColor} />
                        <Text
                          style={{
                            position: 'absolute',
                            fontWeight: 'bold',
                            fontSize: 12,
                            color: index === 0 ? '#FFFFFF' : rankStyle.textColor,
                            marginTop: 1,
                          }}
                        >
                          {index + 1}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>{index + 1}</Text>
                    )}
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {client.name}
                  </Text>
                </View>
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 14, marginLeft: 8 }}>
                  {formatCurrency(client.redeemed, currency)}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}
