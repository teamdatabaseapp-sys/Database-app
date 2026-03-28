import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

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

interface LoyaltyRedemptionsDetailProps {
  rewardsRedeemedList: RedemptionItem[];
  language: Language;
  onBack: () => void;
}

export function LoyaltyRedemptionsDetail({
  rewardsRedeemedList,
  language,
  onBack,
}: LoyaltyRedemptionsDetailProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Pressable
          onPress={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <ChevronRight size={18} color={primaryColor} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>
          {t('loyaltyTotalRewardsRedeemed', language)} ({rewardsRedeemedList.length})
        </Text>
      </View>

      {/* Redemption List */}
      {rewardsRedeemedList.map((item) => {
        const displayName = item.clientName ?? `#${item.client_id.slice(0, 8)}`;
        const nameParts = displayName.trim().split(/\s+/);
        const initials = nameParts.length >= 2
          ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
          : displayName.charAt(0).toUpperCase();
        const rewardLabel = item.rewardTitle ?? t('loyaltyRewards', language);
        const dateStr = item.redeemed_at
          ? new Date(item.redeemed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : null;
        return (
          <View
            key={item.id}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 15 }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '500', fontSize: 15 }}>{displayName}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                {rewardLabel}{item.points_used > 0 ? ` · ${item.points_used.toLocaleString()} ${t('loyaltyPoints', language).toLowerCase()}` : ''}{dateStr ? ` · ${dateStr}` : ''}
              </Text>
            </View>
          </View>
        );
      })}

      {rewardsRedeemedList.length === 0 && (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>
          {t('loyaltyNoAnalyticsData', language)}
        </Text>
      )}
    </View>
  );
}
