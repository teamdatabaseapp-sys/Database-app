import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Crown, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { t, capitalizeMonthInDate } from '@/lib/i18n';
import { Language } from '@/lib/types';

// ============================================
// MembershipCard — membership plan display card
// ============================================

export interface MembershipCardProps {
  language: Language;
  membershipPlan: string | undefined;
  membershipStartDate: Date | undefined;
  dateLocale: Locale | undefined;
  onPress: () => void;
}

export function MembershipCard({
  language,
  membershipPlan,
  membershipStartDate,
  dateLocale,
  onPress,
}: MembershipCardProps) {
  const { colors, isDark } = useTheme();

  return (
    <>
      {/* Membership Section */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={{
          backgroundColor: colors.card,
          marginHorizontal: 16,
          marginTop: 16,
          borderRadius: 16,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        <Pressable
          onPress={onPress}
        >
          <View style={{ padding: 16, backgroundColor: isDark ? '#78350F20' : '#FFFBEB', borderBottomWidth: 1, borderBottomColor: isDark ? '#78350F40' : '#FDE68A' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Crown size={20} color="#F59E0B" />
                <Text style={{ color: isDark ? '#FCD34D' : '#B45309', fontWeight: '600', marginLeft: 8 }}>
                  {t('membership', language)}
                </Text>
              </View>
              <ChevronRight size={18} color="#F59E0B" />
            </View>
          </View>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.textSecondary }}>{t('currentPlan', language)}</Text>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {membershipPlan === 'yearly' ? t('yearlyPlan', language) : t('monthlyPlan', language)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ color: colors.textSecondary }}>{t('memberSince', language)}</Text>
              <Text style={{ color: colors.text, fontWeight: '500' }}>
                {membershipStartDate
                  ? capitalizeMonthInDate(format(membershipStartDate, 'PP', { locale: dateLocale }), language)
                  : 'N/A'}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}
