import React from 'react';
import { View, Text } from 'react-native';
import { Check, Eye, Bell, CreditCard } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { TranslationKey } from '@/lib/i18n';

interface TrialTimelineProps {
  language: Language;
}

interface TimelineStep {
  labelKey: TranslationKey;
  descKey: TranslationKey;
  Icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  isLast: boolean;
}

const STEPS: TimelineStep[] = [
  { labelKey: 'trialDay1Label', descKey: 'trialDay1Desc', Icon: Check, color: '#10B981', isLast: false },
  { labelKey: 'trialDay2Label', descKey: 'trialDay2Desc', Icon: Eye, color: '#3B82F6', isLast: false },
  { labelKey: 'trialReminderLabel', descKey: 'trialReminderDesc', Icon: Bell, color: '#F59E0B', isLast: false },
  { labelKey: 'trialBillingLabel', descKey: 'trialBillingDesc', Icon: CreditCard, color: '#94A3B8', isLast: true },
];

export function TrialTimeline({ language }: TrialTimelineProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 4,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.04,
        shadowRadius: 8,
      }}
    >
      <Text style={{
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 18,
        opacity: 0.5,
      }}>
        {t('trialTimelineTitle', language)}
      </Text>

      {STEPS.map(({ labelKey, descKey, Icon, color, isLast }, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Left column: icon + connector line */}
          <View style={{ alignItems: 'center', width: 36, marginRight: 14 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: color + (isDark ? '25' : '15'),
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: color + '40',
            }}>
              <Icon size={15} color={color} />
            </View>
            {!isLast && (
              <View style={{
                width: 1,
                height: 24,
                backgroundColor: colors.border,
                marginTop: 4,
              }} />
            )}
          </View>

          {/* Right column: text */}
          <View style={{ flex: 1, paddingBottom: isLast ? 0 : 20, paddingTop: 5 }}>
            <Text style={{
              color: colors.text,
              fontSize: 14,
              fontWeight: '600',
              marginBottom: 2,
            }}>
              {t(labelKey, language)}
            </Text>
            <Text style={{
              color: colors.textSecondary,
              fontSize: 13,
              lineHeight: 18,
            }}>
              {t(descKey, language)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
