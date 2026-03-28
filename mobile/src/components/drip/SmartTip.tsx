import React from 'react';
import { View, Text } from 'react-native';
import { Brain } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

export function SmartTip({ text }: { text: string }) {
  const { colors, isDark, primaryColor } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: isDark ? `${primaryColor}12` : `${primaryColor}08`, borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: isDark ? `${primaryColor}25` : `${primaryColor}15` }}>
      <Brain size={13} color={primaryColor} style={{ marginTop: 1, marginRight: 7, flexShrink: 0 }} />
      <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}BB`, fontSize: 12, lineHeight: 17, flex: 1 }}>{text}</Text>
    </View>
  );
}
