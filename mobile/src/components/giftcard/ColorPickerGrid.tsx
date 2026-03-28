import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';

// ============================================
// Color Picker Grid – fixed 3 rows × 7 columns
// ============================================

// 20 fixed, visually distinct swatches. The business primary color is prepended
// at runtime as slot 0, giving 21 total (3 rows × 7). These are chosen to be
// clearly distinct from one another — no near-duplicates.
export const GIFT_CARD_SWATCHES_BASE = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F43F5E', // rose
  '#0F172A', // slate-950 (near black)
  '#64748B', // slate (gray)
  '#D97706', // amber
  '#7C3AED', // purple
  '#0369A1', // sky-700 (deep sky — distinct from cyan)
  '#065F46', // emerald-800 (deep green — distinct from emerald-500)
  '#9A3412', // orange-800 (burnt sienna — distinct from orange-500)
  '#BE185D', // pink-700 (deep pink — distinct from pink-500)
  '#1D4ED8', // blue-700 (deep blue — distinct from blue-500)
];

export interface ColorPickerGridProps {
  selectedColor: string;
  primaryColor: string;
  onSelect: (color: string) => void;
  colors: { text: string };
  label: string;
}

export function ColorPickerGrid({ selectedColor, primaryColor, onSelect, colors, label }: ColorPickerGridProps) {
  const { width } = useWindowDimensions();
  // Modal has 24px padding each side = 48px total horizontal padding
  const gridWidth = width - 48;
  const COLS = 7;
  // Prepend business primary color; deduplicate so no swatch appears twice,
  // then keep exactly 21 (fill with extras if primary was already in base list)
  const EXTRAS = ['#7F1D1D', '#134E4A', '#1E3A5F']; // fallback replacements
  const primaryNorm = primaryColor.toUpperCase();
  const baseFiltered = GIFT_CARD_SWATCHES_BASE.filter(c => c.toUpperCase() !== primaryNorm);
  // If primary was already in base, we have 19 — pad with EXTRAS
  const padded = baseFiltered.length < 20
    ? [...baseFiltered, ...EXTRAS.slice(0, 20 - baseFiltered.length)]
    : baseFiltered.slice(0, 20);
  const allSwatches = [primaryColor, ...padded]; // exactly 21
  const rowData: string[][] = [
    allSwatches.slice(0, 7),
    allSwatches.slice(7, 14),
    allSwatches.slice(14, 21),
  ];

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 14 }}>
        {label}
      </Text>
      <View style={{ gap: 12 }}>
        {rowData.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {row.map((swatch) => {
              const isSelected = selectedColor === swatch;
              return (
                <Pressable
                  key={swatch}
                  onPress={() => onSelect(swatch)}
                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                >
                  {/* Outer ring – only visible when selected */}
                  {isSelected && (
                    <View
                      style={{
                        position: 'absolute',
                        top: -4, left: -4, right: -4, bottom: -4,
                        borderRadius: 22,
                        borderWidth: 2,
                        borderColor: primaryColor,
                      }}
                    />
                  )}
                  {/* Swatch circle */}
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: swatch,
                      borderWidth: isSelected ? 2.5 : 0,
                      borderColor: '#fff',
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
