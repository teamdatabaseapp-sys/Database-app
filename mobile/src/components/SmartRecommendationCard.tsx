import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight, Zap } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n/types';

export interface SmartRecommendationCardProps {
  messageKey: TranslationKey;
  onPress: () => void;
  delayMs?: number;
}

export function SmartRecommendationCard({ messageKey, onPress, delayMs = 0 }: SmartRecommendationCardProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  return (
    <Animated.View entering={FadeInDown.delay(delayMs).duration(350)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? `${primaryColor}18` : `${primaryColor}0E`,
          borderWidth: 1,
          borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`,
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {/* Icon square */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            backgroundColor: isDark ? `${primaryColor}35` : `${primaryColor}20`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            flexShrink: 0,
          }}
        >
          <Zap size={16} color={primaryColor} />
        </View>

        {/* Text content */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: primaryColor,
              letterSpacing: 0.5,
              marginBottom: 2,
              textTransform: 'uppercase',
            }}
          >
            {t('smartRecommendation', language)}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: colors.text,
              lineHeight: 18,
            }}
          >
            {t(messageKey, language)}
          </Text>
        </View>

        {/* Arrow */}
        <ChevronRight size={16} color={primaryColor} style={{ flexShrink: 0, marginLeft: 8 }} />
      </Pressable>
    </Animated.View>
  );
}
