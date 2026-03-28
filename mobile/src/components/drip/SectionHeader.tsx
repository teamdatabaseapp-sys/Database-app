import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

export function SectionHeader({
  icon,
  title,
  subtitle,
  expanded,
  onToggle,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  const { colors, isDark, primaryColor } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: expanded ? `${primaryColor}40` : colors.border,
        marginBottom: expanded ? 0 : 0,
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{title}</Text>
          {badge && (
            <View style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: `${primaryColor}20` }}>
              <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{subtitle}</Text>
        )}
      </View>
      <ChevronDown
        size={16}
        color={colors.textSecondary}
        style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
      />
    </Pressable>
  );
}
