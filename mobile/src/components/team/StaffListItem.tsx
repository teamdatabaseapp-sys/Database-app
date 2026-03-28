import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { getStaffInitials } from './teamServicesUtils';
import { RowActionButtons } from '@/components/stores/RowActionButtons';

export interface StaffListItemStaff {
  id: string;
  full_name: string;
  email?: string | null;
  color: string;
  store_ids: string[];
  service_ids?: string[];
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
}

export interface StaffListItemProps {
  staff: StaffListItemStaff;
  index: number;
  storeNames: string;
  onEdit: (staff: StaffListItemStaff) => void;
  onDelete: (staff: StaffListItemStaff) => void;
}

export function StaffListItem({
  staff,
  index,
  storeNames,
  onEdit,
  onDelete,
}: StaffListItemProps) {
  const { colors } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const avatarUrl = staff.avatar_thumb_url || staff.avatar_url;

  return (
    <Animated.View
      key={staff.id}
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 10,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: avatarUrl ? 'transparent' : staff.color,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 44, height: 44, borderRadius: 22 }}
          />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{getStaffInitials(staff.full_name)}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{staff.full_name}</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
          {storeNames || t('noStores', language)}
        </Text>
      </View>
      <RowActionButtons onEdit={() => onEdit(staff)} onDelete={() => onDelete(staff)} />
    </Animated.View>
  );
}
