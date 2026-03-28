import React from 'react';
import { View, Text } from 'react-native';
import { Building2, User } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';

interface EmptyStateProps {
  language: Language;
}

export function EmptyStoreState({ language }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
      }}
    >
      <Building2 size={32} color={colors.textTertiary} />
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 10, textAlign: 'center' }}>
        {t('noStores', language) || 'No stores yet'}
      </Text>
    </View>
  );
}

export function EmptyStaffState({ language }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
      }}
    >
      <User size={32} color={colors.textTertiary} />
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 10, textAlign: 'center' }}>
        {t('noStaffMembers', language) || 'No staff members yet'}
      </Text>
      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: 'center', maxWidth: 240 }}>
        {t('addStaffMembersDescription', language) || 'Add staff members to assign them to stores and appointments.'}
      </Text>
    </View>
  );
}
