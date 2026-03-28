import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Eye } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// ============================================
// PromoStatsGrid
// Presentational 2×2 metric cards grid for AssignManageView.
// All logic (counts, selection state) lives in the parent.
// ============================================

export type StatCategory = 'active' | 'inProgress' | 'completed' | 'total';

export interface PromoStatItem {
  label: string;
  count: number;
  icon: React.ReactNode;
  cat: StatCategory;
}

interface PromoStatsGridProps {
  row1: [PromoStatItem, PromoStatItem];
  row2: [PromoStatItem];
  viewingStatCategory: StatCategory | null;
  onSelect: (cat: StatCategory) => void;
  primaryColor: string;
  textTertiaryColor: string;
}

function StatCard({
  stat,
  viewingStatCategory,
  onSelect,
  primaryColor,
  textTertiaryColor,
}: {
  stat: PromoStatItem;
  viewingStatCategory: StatCategory | null;
  onSelect: (cat: StatCategory) => void;
  primaryColor: string;
  textTertiaryColor: string;
}) {
  const isSelected = viewingStatCategory === stat.cat;
  return (
    <Pressable
      key={stat.cat}
      onPress={() => onSelect(stat.cat)}
      style={{
        flex: 1,
        backgroundColor: isSelected ? `${primaryColor}22` : `${primaryColor}10`,
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: isSelected ? primaryColor : `${primaryColor}20`,
      }}
    >
      {stat.icon}
      <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '700', marginTop: 4 }}>{stat.count}</Text>
      <Text style={{ color: textTertiaryColor, fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 2 }} numberOfLines={2}>{stat.label}</Text>
      <Eye size={10} color={isSelected ? primaryColor : textTertiaryColor} style={{ marginTop: 3 }} />
    </Pressable>
  );
}

export function PromoStatsGrid({
  row1,
  row2,
  viewingStatCategory,
  onSelect,
  primaryColor,
  textTertiaryColor,
}: PromoStatsGridProps) {
  return (
    <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {row1.map((stat) => (
          <StatCard
            key={stat.cat}
            stat={stat}
            viewingStatCategory={viewingStatCategory}
            onSelect={onSelect}
            primaryColor={primaryColor}
            textTertiaryColor={textTertiaryColor}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {row2.map((stat) => (
          <StatCard
            key={stat.cat}
            stat={stat}
            viewingStatCategory={viewingStatCategory}
            onSelect={onSelect}
            primaryColor={primaryColor}
            textTertiaryColor={textTertiaryColor}
          />
        ))}
      </View>
    </Animated.View>
  );
}
