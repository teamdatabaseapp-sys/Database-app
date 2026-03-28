import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

// ============================================
// Toggle Switch Component
// ============================================

export interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ value, onValueChange, disabled }: ToggleSwitchProps) {
  const { colors, primaryColor, isDark } = useTheme();

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      style={{
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: value ? primaryColor : (isDark ? colors.backgroundTertiary : '#E2E8F0'),
        justifyContent: 'center',
        paddingHorizontal: 2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: '#fff',
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}
