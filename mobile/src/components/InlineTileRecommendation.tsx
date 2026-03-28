import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight, Zap } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n/types';

interface InlineTileRecommendationProps {
  messageKey: TranslationKey;
  onPress: (e: { stopPropagation: () => void }) => void;
}

/**
 * Compact recommendation strip for embedding inside analytics tile cards.
 * Must be placed inside the tile's Pressable, after the metric content.
 * Stops event propagation so it doesn't trigger the tile's own drill-down.
 */
export function InlineTileRecommendation({ messageKey, onPress }: InlineTileRecommendationProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: isDark ? `${primaryColor}25` : `${primaryColor}18`,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}18`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
          flexShrink: 0,
        }}
      >
        <Zap size={11} color={primaryColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 9,
            fontWeight: '700',
            color: primaryColor,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 1,
          }}
          numberOfLines={1}
        >
          {t('smartRecommendation', language)}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '500',
            color: isDark ? colors.textSecondary : colors.textSecondary,
            lineHeight: 14,
          }}
          numberOfLines={2}
        >
          {t(messageKey, language)}
        </Text>
      </View>

      <ChevronRight size={13} color={primaryColor} style={{ flexShrink: 0, marginLeft: 4 }} />
    </Pressable>
  );
}
