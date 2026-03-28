import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Edit3, ChevronRight, Camera } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import type { StoreHoursDay } from '@/services/storesService';
import { RowActionButtons } from '@/components/stores/RowActionButtons';

export interface StoreListItemStore {
  id: string;
  name: string;
  is_primary?: boolean | null;
  photo_url?: string | null;
  photo_thumb_url?: string | null;
  address?: string | null;
  phone?: string | null;
  hours?: StoreHoursDay[] | null;
  blackout_dates?: string[] | null;
}

export interface StoreListItemProps {
  store: StoreListItemStore;
  index: number;
  staffCount: number;
  onPress: (store: StoreListItemStore) => void;
  onEdit: (store: StoreListItemStore) => void;
  onDelete: (store: StoreListItemStore) => void;
}

export function StoreListItem({
  store,
  index,
  staffCount,
  onPress,
  onEdit,
  onDelete,
}: StoreListItemProps) {
  const { colors, primaryColor, isDark } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const isPrimary = store.is_primary === true;
  const primaryStoreColor = '#F59E0B';
  const storeThumb = store.photo_thumb_url || store.photo_url;

  return (
    <Animated.View
      key={store.id}
      entering={FadeInDown.delay(index * 50).duration(300)}
    >
      <Pressable
        onPress={() => onPress(store)}
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          marginBottom: 10,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: isPrimary ? `${primaryStoreColor}40` : colors.border,
        }}
      >
        {/* Store photo thumbnail or placeholder */}
        {storeThumb ? (
          <Image
            source={{ uri: storeThumb }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              marginRight: 12,
            }}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: isPrimary ? `${primaryStoreColor}20` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Camera size={20} color={isPrimary ? primaryStoreColor : primaryColor} />
          </View>
        )}
        {/* Store name + staff count */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '500' }}>
            {getLocalizedStoreName(store.name, language)}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
            {staffCount} {t('staff', language)}
          </Text>
        </View>
        {/* Edit-only for primary, Edit+Delete for non-primary */}
        {isPrimary ? (
          <Pressable
            onPress={(e) => { e.stopPropagation(); onEdit(store); }}
            hitSlop={8}
            style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
          >
            <Edit3 size={15} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <RowActionButtons
            onEdit={() => onEdit(store)}
            onDelete={() => onDelete(store)}
            stopPropagation
          />
        )}
        <ChevronRight size={18} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}
