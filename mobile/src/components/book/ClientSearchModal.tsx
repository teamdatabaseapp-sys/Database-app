import React from 'react';
import { View, Text, Pressable, Modal, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, User } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useStore } from '@/lib/store';
import { ClientSearchItem } from '../ClientSearchItem';
import { convertToLegacyClient } from './bookAppointmentUtils';
import type { SupabaseClient } from '@/services/clientsService';

export interface ClientSearchModalProps {
  visible: boolean;
  clients: SupabaseClient[];
  searchQuery: string;
  onQueryChange: (value: string) => void;
  selectedClientId: string | null;
  clientsWithConflicts: Set<string>;
  onSelect: (clientId: string) => void;
  onConflict: (message: string) => void;
  onClose: () => void;
}

export function ClientSearchModal({
  visible,
  clients,
  searchQuery,
  onQueryChange,
  selectedClientId,
  clientsWithConflicts,
  onSelect,
  onConflict,
  onClose,
}: ClientSearchModalProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 12,
              paddingHorizontal: 12,
            }}
          >
            <Search size={18} color={colors.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={onQueryChange}
              placeholder={t('searchClients', language)}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              cursorColor={primaryColor}
              style={{
                flex: 1,
                padding: 12,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </View>
          <Pressable onPress={onClose} style={{ marginLeft: 12 }}>
            <Text style={{ color: primaryColor, fontSize: 16 }}>{t('cancel', language)}</Text>
          </Pressable>
        </Animated.View>

        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item, index }) => {
            const hasConflict = clientsWithConflicts.has(item.id);
            return (
              <ClientSearchItem
                client={convertToLegacyClient(item)}
                index={index}
                onPress={() => {
                  if (hasConflict) {
                    // Show conflict message via haptic feedback and don't select
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    onConflict('This client already has another appointment during this time.');
                    return;
                  }
                  onSelect(item.id);
                }}
                isSelected={selectedClientId === item.id}
                disabled={hasConflict}
                disabledReason={hasConflict ? t('alreadyBookedDuringTime', language) : undefined}
                showEmail={true}
                showPhone={true}
                compact={true}
              />
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <User size={40} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 12 }}>
                {t('noClientsFound', language)}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
