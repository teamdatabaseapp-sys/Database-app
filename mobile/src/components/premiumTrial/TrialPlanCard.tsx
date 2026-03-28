import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t, formatPrice } from '@/lib/i18n';
import { Language, SubscriptionPlanInfo } from '@/lib/types';
import { useStore } from '@/lib/store';

interface TrialPlanCardProps {
  plan: SubscriptionPlanInfo;
  isSelected: boolean;
  onSelect: () => void;
  language: Language;
}

export function TrialPlanCard({ plan, isSelected, onSelect, language }: TrialPlanCardProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const currency = useStore((s) => s.currency);

  const accentColor = isSelected ? primaryColor : colors.border;
  const bgColor = isSelected
    ? (isDark ? primaryColor + '18' : primaryColor + '0D')
    : colors.card;

  return (
    <Pressable
      onPress={onSelect}
      style={{
        backgroundColor: bgColor,
        borderRadius: 14,
        borderWidth: isSelected ? 2 : 1,
        borderColor: accentColor,
        padding: 16,
        marginBottom: 10,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Best Value badge */}
      {plan.isMostPopular && (
        <View style={{
          position: 'absolute',
          top: 0,
          right: 0,
          backgroundColor: '#10B981',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderBottomLeftRadius: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Sparkles size={10} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700', marginLeft: 4 }}>
              {t('bestValue', language)}
            </Text>
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: plan.isMostPopular ? 80 : 8 }}>
          <Text style={{
            color: colors.text,
            fontSize: 15,
            fontWeight: '700',
            marginBottom: 4,
          }}>
            {plan.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{
              color: isSelected ? primaryColor : colors.text,
              fontSize: 22,
              fontWeight: '800',
              letterSpacing: -0.5,
            }}>
              {formatPrice(plan.price, language, currency)}
            </Text>
            <Text style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginLeft: 4,
            }}>
              /{plan.period}
            </Text>
            {plan.savingsAmount && (
              <View style={{
                marginLeft: 8,
                backgroundColor: '#10B981' + '20',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}>
                <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>
                  {t('savePer', language)} {plan.savingsAmount}
                </Text>
              </View>
            )}
          </View>

          {plan.description && (
            <Text style={{
              color: colors.textTertiary,
              fontSize: 12,
              marginTop: 3,
            }}>
              {plan.description}
            </Text>
          )}
        </View>

        {/* Selection radio */}
        <View style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: isSelected ? primaryColor : colors.border,
          backgroundColor: isSelected ? primaryColor : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
        </View>
      </View>
    </Pressable>
  );
}
