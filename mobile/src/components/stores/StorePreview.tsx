import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
} from 'react-native';
import {
  Edit3,
  Store as StoreIcon,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Crown,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { RowActionButtons } from './RowActionButtons';

interface StorePreviewStore {
  id: string;
  name: string;
  is_primary: boolean;
  photo_url: string | null;
  photo_thumb_url: string | null;
}

export interface StorePreviewProps {
  store: StorePreviewStore;
  staffCount: number;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canReorder: boolean;
  reorderIsPending: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const PRIMARY_STORE_COLOR = '#F59E0B'; // Golden amber color

export function StorePreview({
  store,
  staffCount,
  index,
  isFirst,
  isLast,
  canReorder,
  reorderIsPending,
  onPress,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: StorePreviewProps) {
  const { colors, primaryColor, isDark } = useTheme();
  const language = useStore((s) => s.language) as Language;

  // Primary store uses Staff Access Owner card style (exact same visual)
  if (store.is_primary) {
    return (
      <Pressable
        key={store.id}
        onPress={onPress}
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: `${PRIMARY_STORE_COLOR}40`,
        }}
      >
        {/* Store Photo (circular) or Crown icon */}
        {store.photo_thumb_url || store.photo_url ? (
          <Image
            source={{ uri: store.photo_thumb_url || store.photo_url || '' }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: `${PRIMARY_STORE_COLOR}40`,
            }}
          />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: `${PRIMARY_STORE_COLOR}20`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Crown size={20} color={PRIMARY_STORE_COLOR} />
          </View>
        )}
        {/* Store name + staff count - matches Staff Access typography */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontWeight: '500' }}>
            {getLocalizedStoreName(store.name, language)}
          </Text>
          <Text style={{ color: PRIMARY_STORE_COLOR, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
            {staffCount} {t('staff', language)}
          </Text>
        </View>
        {/* Edit button */}
        <Pressable
          onPress={(e) => { e.stopPropagation(); onEdit(); }}
          hitSlop={8}
          style={{
            width: 34, height: 34, borderRadius: 9,
            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Edit3 size={15} color={colors.textSecondary} />
        </Pressable>
        {/* Chevron to view store details */}
        <ChevronRight size={18} color={colors.textTertiary} />
      </Pressable>
    );
  }

  // Non-primary stores use standard styling
  return (
    <Pressable
      key={store.id}
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      }}
    >
      <View
        style={{
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Reorder Controls */}
        {canReorder && (
          <View
            style={{
              flexDirection: 'column',
              marginRight: 8,
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={isFirst || reorderIsPending}
              style={{
                padding: 4,
                opacity: isFirst ? 0.3 : 1,
              }}
            >
              <ChevronUp size={16} color={isFirst ? colors.textTertiary : primaryColor} />
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={isLast || reorderIsPending}
              style={{
                padding: 4,
                opacity: isLast ? 0.3 : 1,
              }}
            >
              <ChevronDown size={16} color={isLast ? colors.textTertiary : primaryColor} />
            </Pressable>
          </View>
        )}
        {/* Circular Store photo or icon */}
        {store.photo_thumb_url || store.photo_url ? (
          <Image
            source={{ uri: store.photo_thumb_url || store.photo_url || '' }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
            }}
          />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <StoreIcon size={20} color={primaryColor} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '500' }}>
            {getLocalizedStoreName(store.name, language)}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
            {staffCount} {staffCount === 1 ? (t('staffMember', language) || 'staff member') : (t('staffMembers', language) || 'staff members')}
          </Text>
        </View>
        <RowActionButtons onEdit={onEdit} onDelete={onDelete} stopPropagation />
        <ChevronRight size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}
