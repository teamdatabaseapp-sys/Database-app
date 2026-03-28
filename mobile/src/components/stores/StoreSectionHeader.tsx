import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

export interface StoreSectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  onAdd: () => void;
}

export function StoreSectionHeader({
  icon,
  title,
  count,
  onAdd,
}: StoreSectionHeaderProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: `${primaryColor}20`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          {icon}
        </View>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
          {title}
        </Text>
        <View
          style={{
            backgroundColor: isDark ? colors.backgroundTertiary : '#E2E8F0',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
            marginLeft: 8,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
            {count}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onAdd}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: primaryColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={20} color="#fff" />
      </Pressable>
    </View>
  );
}
