import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// ============================================
// UnassignedClientRow
// Presentational row used inside the unassigned clients list.
// All selection state and logic lives in the parent (AssignManageView).
// ============================================

// Minimal shape — only the fields this component actually renders.
export interface UnassignedClient {
  id: string;
  name: string;
  email: string;
}

interface UnassignedClientRowProps {
  client: UnassignedClient;
  index: number;
  isSelected: boolean;
  isLastItem: boolean;
  onPress: (clientId: string) => void;
  primaryColor: string;
  borderColor: string;
  textColor: string;
  textTertiaryColor: string;
  initials: string;
  unassignedLabel: string;
}

export function UnassignedClientRow({
  client,
  index,
  isSelected,
  isLastItem,
  onPress,
  primaryColor,
  borderColor,
  textColor,
  textTertiaryColor,
  initials,
  unassignedLabel,
}: UnassignedClientRowProps) {
  return (
    <Animated.View key={client.id} entering={FadeInDown.delay(index * 20).duration(180)}>
      <Pressable
        onPress={() => onPress(client.id)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: isLastItem ? 0 : 1,
          borderBottomColor: borderColor,
          backgroundColor: isSelected ? `${primaryColor}08` : 'transparent',
        }}
      >
        {/* Selection circle */}
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? primaryColor : borderColor, backgroundColor: isSelected ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
          {isSelected && <Check size={12} color="#fff" />}
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 11 }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: textColor, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
          {client.email ? <Text style={{ color: textTertiaryColor, fontSize: 12 }} numberOfLines={1}>{client.email}</Text> : null}
        </View>
        <View style={{ backgroundColor: '#F59E0B18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
          <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '600' }}>{unassignedLabel}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
