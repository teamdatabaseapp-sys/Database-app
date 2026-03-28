import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

// ============================================
// Time Filter Tabs
// ============================================

export type TimeFilterType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface TimeFilterTabsProps {
  timeFilter: TimeFilterType;
  onSelect: (filter: TimeFilterType) => void;
  language: Language;
}

export function TimeFilterTabs({ timeFilter, onSelect, language }: TimeFilterTabsProps) {
  const { colors, primaryColor } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(50).duration(300)}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 8,
        marginBottom: 16,
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      }}
    >
      {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((filter) => (
        <Pressable
          key={filter}
          onPress={() => onSelect(filter)}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 6,
            borderRadius: 8,
            alignItems: 'center',
            backgroundColor: timeFilter === filter ? primaryColor : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: timeFilter === filter ? '#fff' : colors.textSecondary,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {filter === 'daily' ? t('daily', language) : filter === 'weekly' ? t('weekly', language) : filter === 'monthly' ? t('monthly', language) : t('yearly', language)}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}
