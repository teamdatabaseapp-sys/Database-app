import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Archive, ArchiveRestore } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

export interface ClientActionButtonsProps {
  isArchived: boolean;
  language: Language;
  colors: {
    card: string;
    text: string;
    textSecondary: string;
    [key: string]: string;
  };
  isDark: boolean;
  primaryColor: string;
  onArchive: () => void;
}

export function ClientActionButtons({
  isArchived,
  language,
  colors,
  isDark,
  primaryColor,
  onArchive,
}: ClientActionButtonsProps) {
  return (
    <View className="mx-4 mt-6 mb-6">
      <Pressable
        onPress={onArchive}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isArchived ? undefined : (isDark ? '#7F1D1D30' : '#FEF2F2'),
          borderRadius: 12,
          padding: 16,
        }}
      >
        {isArchived ? (
          <>
            <ArchiveRestore size={20} color={primaryColor} />
            <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 12 }}>
              {t('unarchive', language)}
            </Text>
          </>
        ) : (
          <>
            <Archive size={20} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontWeight: '500', marginLeft: 12 }}>
              {t('archive', language)}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
