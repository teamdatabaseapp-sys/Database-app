import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Store as StoreIcon } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';

// ============================================
// StoreFilter Component
// ============================================

export interface StoreFilterProps {
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelect: (storeId: string | null) => void;
  language: Language;
}

export function StoreFilter({ stores, selectedStoreId, onSelect, language }: StoreFilterProps) {
  const { colors, isDark, primaryColor } = useTheme();

  if (stores.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
        {t('filterByStore', language)}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <Pressable
          onPress={() => onSelect(null)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 9999,
            marginRight: 8,
            backgroundColor: !selectedStoreId ? primaryColor : (isDark ? colors.backgroundTertiary : colors.card),
            borderWidth: !selectedStoreId ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '500', color: !selectedStoreId ? '#fff' : colors.textSecondary }}>
            {t('allStores', language)}
          </Text>
        </Pressable>
        {stores.map((store) => (
          <Pressable
            key={store.id}
            onPress={() => onSelect(store.id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 9999,
              marginRight: 8,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: selectedStoreId === store.id ? primaryColor : (isDark ? colors.backgroundTertiary : colors.card),
              borderWidth: selectedStoreId === store.id ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <StoreIcon size={14} color={selectedStoreId === store.id ? '#fff' : colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 14, fontWeight: '500', color: selectedStoreId === store.id ? '#fff' : colors.textSecondary }}>
              {getLocalizedStoreName(store.name, language)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
