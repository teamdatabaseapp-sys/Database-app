import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Gift, DollarSign, Star, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { formatCurrency } from '@/lib/currency';
import { Language } from '@/lib/types';
import { LoyaltyReward } from '@/services/loyaltyService';

interface LoyaltyRewardCardProps {
  reward: LoyaltyReward;
  index: number;
  language: Language;
  currency: string;
  onPress: (reward: LoyaltyReward) => void;
}

export function LoyaltyRewardCard({
  reward,
  index,
  language,
  currency,
  onPress,
}: LoyaltyRewardCardProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <Animated.View
      key={reward.id}
      entering={FadeInDown.delay(index * 50).duration(300)}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={() => onPress(reward)}
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          opacity: reward.is_active ? 1 : 0.6,
        }}
      >
        <View className="flex-row items-center">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15` }}
          >
            {reward.linked_service_id ? (
              <Gift size={28} color={primaryColor} />
            ) : reward.credit_amount ? (
              <DollarSign size={28} color={primaryColor} />
            ) : (
              <Star size={28} color={primaryColor} />
            )}
          </View>
          <View className="flex-1 ml-4">
            <View className="flex-row items-center">
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 15 }}>
                {reward.title}
              </Text>
              {!reward.is_active && (
                <View
                  style={{
                    backgroundColor: `${colors.textTertiary}20`,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                    marginLeft: 8,
                  }}
                >
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600' }}>
                    {t('loyaltyRewardInactive', language).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: primaryColor, fontSize: 15, fontWeight: '600', marginTop: 2 }}>
              {reward.points_required.toLocaleString()} {t('loyaltyPoints', language)}
            </Text>
            {reward.description && (
              <Text
                style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}
                numberOfLines={1}
              >
                {reward.description}
              </Text>
            )}
            {reward.credit_amount && (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                {formatCurrency(reward.credit_amount, currency)} {t('loyaltyCreditAmount', language).toLowerCase()}
              </Text>
            )}
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
