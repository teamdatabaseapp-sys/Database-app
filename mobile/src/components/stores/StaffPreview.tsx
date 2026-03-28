import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
} from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import { RowActionButtons } from './RowActionButtons';
import { getStaffInitials } from './storesManagementUtils';

interface StaffPreviewStaff {
  id: string;
  name: string;
  color: string | null | undefined;
  avatar_url: string | null;
}

export interface StaffPreviewProps {
  staff: StaffPreviewStaff;
  index: number;
  assignedStores: string;
  hasStores: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function StaffPreview({
  staff,
  index,
  assignedStores,
  hasStores,
  onEdit,
  onDelete,
}: StaffPreviewProps) {
  const { colors, primaryColor } = useTheme();
  const initials = getStaffInitials(staff.name);

  return (
    <View
      key={staff.id}
      style={{
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: index > 0 ? 1 : 0,
        borderTopColor: colors.border,
      }}
    >
      {/* Avatar - show image if available, else colored circle with initials */}
      {staff.avatar_url ? (
        <Image
          source={{ uri: staff.avatar_url }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            marginRight: 12,
          }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: staff.color || `${primaryColor}20`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ color: staff.color ? '#fff' : primaryColor, fontWeight: '700', fontSize: 16 }}>
            {initials}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
          {staff.name}
        </Text>
        <Text
          style={{
            color: hasStores ? colors.textTertiary : '#F59E0B',
            fontSize: 12,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {assignedStores}
        </Text>
      </View>
      <RowActionButtons onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}
