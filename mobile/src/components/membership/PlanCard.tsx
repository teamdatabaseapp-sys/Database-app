import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Crown, ChevronRight } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, MembershipPlan } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/currency';

// ============================================
// Plan Card Component
// ============================================

export interface PlanCardProps {
  plan: MembershipPlan;
  onPress: () => void;
}

export function PlanCard({ plan, onPress }: PlanCardProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);

  const getRenewalLabel = () => {
    switch (plan.renewalCycle) {
      case 'monthly':
        return t('membershipCycleMonthly', language);
      case 'yearly':
        return t('membershipCycleYearly', language);
      case 'custom':
        return `${plan.customIntervalDays || 30} ${t('days', language)}`;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="flex-row items-start">
        {/* Icon */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: plan.isActive ? `${primaryColor}20` : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <Crown size={24} color={plan.isActive ? primaryColor : colors.textTertiary} />
        </View>

        {/* Details */}
        <View style={{ flex: 1 }}>
          <View className="flex-row items-center justify-between mb-1">
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{plan.name}</Text>
            <View
              style={{
                backgroundColor: plan.isActive ? '#10B98120' : '#EF444420',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  color: plan.isActive ? '#10B981' : '#EF4444',
                  fontSize: 11,
                  fontWeight: '600',
                }}
              >
                {plan.isActive ? t('statusActive', language) : t('membershipInactive', language)}
              </Text>
            </View>
          </View>

          <Text style={{ color: primaryColor, fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
            {formatCurrency(plan.displayPrice, currency)}
            <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '500' }}>
              {' '}/ {getRenewalLabel()}
            </Text>
          </Text>

          {plan.benefits.length > 0 && (
            <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
              {plan.benefits.slice(0, 3).map((benefit, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {benefit.type === 'discount' && `${benefit.discountPercent}% ${t('membershipBenefitOff', language)}`}
                    {benefit.type === 'free_service' && `${benefit.freeServiceQuantity}x ${benefit.freeServiceName}`}
                    {benefit.type === 'monthly_credit' && `$${benefit.creditAmount} ${t('membershipBenefitCredit', language)}`}
                    {benefit.type === 'custom_perk' && benefit.customPerkText?.slice(0, 20)}
                  </Text>
                </View>
              ))}
              {plan.benefits.length > 3 && (
                <Text style={{ color: colors.textTertiary, fontSize: 11, alignSelf: 'center' }}>
                  +{plan.benefits.length - 3} {t('membershipMoreBenefits', language)}
                </Text>
              )}
            </View>
          )}
        </View>

        <ChevronRight size={18} color={colors.textTertiary} style={{ marginLeft: 8 }} />
      </View>
    </Pressable>
  );
}
