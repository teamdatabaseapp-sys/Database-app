import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Gift,
  Users,
  TrendingUp,
  Star,
  Crown,
  Percent,
  Activity,
  Layers,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { LoyaltyActiveMembersDetail } from './LoyaltyActiveMembersDetail';
import { LoyaltyRedemptionsDetail } from './LoyaltyRedemptionsDetail';

interface ActiveMember {
  client_id: string;
  name: string;
  total_points: number;
}

interface RedemptionItem {
  id: string;
  client_id: string;
  reward_id: string;
  points_used: number;
  redeemed_at: string | null;
  status: string;
  clientName: string | null;
  rewardTitle: string | null;
}

interface AnalyticsData {
  activeMembersCount: number;
  totalRewardsRedeemed: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
}

interface LoyaltyAnalyticsViewProps {
  analytics: AnalyticsData | null | undefined;
  activeMembersCount: number;
  activeMembersList: ActiveMember[];
  rewardsRedeemedList: RedemptionItem[];
  showActiveMembersDetail: boolean;
  showRewardsRedeemedDetail: boolean;
  onShowActiveMembersDetail: () => void;
  onHideActiveMembersDetail: () => void;
  onShowRewardsRedeemedDetail: () => void;
  onHideRewardsRedeemedDetail: () => void;
  language: Language;
  onOpenSmartDrip?: () => void;
  onOpenMarketing?: () => void;
}

export function LoyaltyAnalyticsView({
  analytics,
  activeMembersCount,
  activeMembersList,
  rewardsRedeemedList,
  showActiveMembersDetail,
  showRewardsRedeemedDetail,
  onShowActiveMembersDetail,
  onHideActiveMembersDetail,
  onShowRewardsRedeemedDetail,
  onHideRewardsRedeemedDetail,
  language,
  onOpenSmartDrip,
  onOpenMarketing,
}: LoyaltyAnalyticsViewProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View>
      {showActiveMembersDetail ? (
        <LoyaltyActiveMembersDetail
          activeMembersList={activeMembersList}
          language={language}
          onBack={onHideActiveMembersDetail}
          onOpenSmartDrip={onOpenSmartDrip}
          onOpenMarketing={onOpenMarketing}
        />
      ) : showRewardsRedeemedDetail ? (
        <LoyaltyRedemptionsDetail
          rewardsRedeemedList={rewardsRedeemedList}
          language={language}
          onBack={onHideRewardsRedeemedDetail}
        />
      ) : (
        <>
      {/* Stats Grid */}
      <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
        {/* Top-left: Active Members — tappable, has chevron */}
        <Animated.View
          entering={FadeInDown.delay(0).duration(300)}
          style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}
        >
          <Pressable
            onPress={onShowActiveMembersDetail}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              minHeight: 110
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15` }}
              >
                <Users size={22} color={primaryColor} />
              </View>
              <ChevronRight size={16} color={colors.border} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
              {analytics?.activeMembersCount ?? activeMembersCount}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{t('loyaltyActiveMembers', language)}</Text>
          </Pressable>
        </Animated.View>

        {/* Top-right: Rewards Redeemed — tappable, has chevron */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(300)}
          style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}
        >
          <Pressable
            onPress={onShowRewardsRedeemedDetail}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              minHeight: 110
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Gift size={22} color={primaryColor} />
              </View>
              <ChevronRight size={16} color={colors.border} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
              {analytics?.totalRewardsRedeemed ?? 0}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{t('loyaltyTotalRewardsRedeemed', language)}</Text>
          </Pressable>
        </Animated.View>

        {/* Bottom-left: Total Points Issued — no chevron */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(300)}
          style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              minHeight: 110
            }}
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${primaryColor}15`, marginBottom: 8 }}
            >
              <TrendingUp size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
              {(analytics?.totalPointsIssued ?? 0).toLocaleString()}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{t('loyaltyTotalPointsIssued', language)}</Text>
          </View>
        </Animated.View>

        {/* Bottom-right: Total Points Redeemed — no chevron */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(300)}
          style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              minHeight: 110
            }}
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${primaryColor}15`, marginBottom: 8 }}
            >
              <Star size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
              {(analytics?.totalPointsRedeemed ?? 0).toLocaleString()}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{t('loyaltyTotalPointsRedeemed', language)}</Text>
          </View>
        </Animated.View>
      </View>

      {/* Intelligence Metrics Row */}
      {(analytics?.totalPointsIssued ?? 0) > 0 && (
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          <Animated.View entering={FadeInDown.delay(180).duration(300)} style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, minHeight: 110 }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${primaryColor}15`, marginBottom: 8 }}>
                <Percent size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
                {activeMembersCount > 0 ? `${Math.round(((analytics?.totalRewardsRedeemed ?? 0) / activeMembersCount) * 100)}%` : '0%'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{t('loyaltyRedemptionRate', language)}</Text>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(210).duration(300)} style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, minHeight: 110 }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${primaryColor}15`, marginBottom: 8 }}>
                <Activity size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
                {activeMembersCount > 0 ? Math.round((analytics?.totalPointsIssued ?? 0) / activeMembersCount).toLocaleString() : '0'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{t('loyaltyAvgPointsPerMember', language)}</Text>
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ width: '100%', paddingHorizontal: 6, marginBottom: 12 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, minHeight: 110, flexDirection: 'row', alignItems: 'center' }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${primaryColor}15`, marginRight: 16 }}>
                <Layers size={22} color={primaryColor} />
              </View>
              <View>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>
                  {((analytics?.totalPointsIssued ?? 0) - (analytics?.totalPointsRedeemed ?? 0)).toLocaleString()}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('loyaltyPointsLiability', language)}</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Top Loyalty Clients */}
      {activeMembersList.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(300)}
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
          }}
        >
          <View className="flex-row items-center mb-4">
            <Crown size={20} color={primaryColor} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
              {t('loyaltyTopClients', language)}
            </Text>
          </View>
          {activeMembersList.slice(0, 10).map((client, index) => {
            const getRankStyle = (rank: number) => {
              if (rank === 0) return { bg: isDark ? '#92400E30' : '#FEF3C7', starColor: '#F59E0B', textColor: '#92400E' };
              if (rank === 1) return { bg: isDark ? colors.backgroundTertiary : '#F1F5F9', starColor: '#94A3B8', textColor: '#475569' };
              if (rank === 2) return { bg: isDark ? '#9A341230' : '#FED7AA', starColor: '#EA580C', textColor: '#9A3412' };
              return null;
            };
            const rankStyle = getRankStyle(index);
            return (
            <View
              key={client.client_id}
              className="flex-row items-center justify-between py-3"
              style={{
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
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
                <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                  {client.name}
                </Text>
              </View>
              <Text style={{ color: primaryColor, fontWeight: '600' }}>
                {client.total_points.toLocaleString()} {t('loyaltyPoints', language).toLowerCase()}
              </Text>
            </View>
            );
          })}
        </Animated.View>
      )}

      {/* No data state */}
      {activeMembersList.length === 0 && activeMembersCount === 0 && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(300)}
          className="items-center py-8"
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <TrendingUp size={32} color={primaryColor} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500', textAlign: 'center' }}>
            {t('loyaltyNoAnalyticsData', language)}
          </Text>
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 13,
              textAlign: 'center',
              marginTop: 4,
              paddingHorizontal: 32,
            }}
          >
            {t('loyaltyNoAnalyticsDataDescription', language)}
          </Text>
        </Animated.View>
      )}
        </>
      )}
    </View>
  );
}
