import React from 'react';
import { View, Pressable, GestureResponderEvent } from 'react-native';
import { Edit3, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

interface RowActionButtonsProps {
  onEdit: () => void;
  onDelete: () => void;
  /** Set true when inside a parent Pressable to stop event bubbling */
  stopPropagation?: boolean;
}

/**
 * Unified Edit + Delete action button pair.
 * Used across Stores, Staff, Services, and Products list rows.
 */
export function RowActionButtons({ onEdit, onDelete, stopPropagation }: RowActionButtonsProps) {
  const { colors, isDark } = useTheme();

  const editBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)';

  const handleEdit = (e: GestureResponderEvent) => {
    if (stopPropagation) e.stopPropagation();
    onEdit();
  };

  const handleDelete = (e: GestureResponderEvent) => {
    if (stopPropagation) e.stopPropagation();
    onDelete();
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable
        onPress={handleEdit}
        hitSlop={8}
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          backgroundColor: editBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Edit3 size={15} color={colors.textSecondary} />
      </Pressable>
      <Pressable
        onPress={handleDelete}
        hitSlop={8}
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          backgroundColor: '#EF444414',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Trash2 size={15} color="#EF4444" />
      </Pressable>
    </View>
  );
}
