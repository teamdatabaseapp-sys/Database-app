import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Users, Store as StoreIcon } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { useStaffMembers } from '@/hooks/useStaff';
import { useStores } from '@/hooks/useStores';
import { getStaffInitials } from './teamServicesUtils';

export interface ViewStoreStaffModalProps {
  visible: boolean;
  onClose: () => void;
  viewingStore: { id: string; name: string } | null;
}

export function ViewStoreStaffModal({
  visible,
  onClose,
  viewingStore,
}: ViewStoreStaffModalProps) {
  const { colors, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const { data: staffMembers = [] } = useStaffMembers();
  const { data: supabaseStores = [] } = useStores();
  const stores = supabaseStores.map((s) => ({ id: s.id, name: s.name }));

  const getStaffForStore = (storeId: string) => {
    return staffMembers.filter((s) => s.store_ids?.includes(storeId));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        onClose();
      }}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={['top']}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {/* Store Icon + Name on the left */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <StoreIcon size={18} color={primaryColor} />
            </View>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {viewingStore ? getLocalizedStoreName(viewingStore.name, language) : ''}
            </Text>
          </View>
          {/* Close button on the right */}
          <Pressable
            onPress={() => {
              onClose();
            }}
            style={{ padding: 4 }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Staff List */}
          {viewingStore && (() => {
            const storeStaff = getStaffForStore(viewingStore.id);

            if (storeStaff.length === 0) {
              return (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 32,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Users size={40} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
                    No staff assigned to this store yet.
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
                    Add staff members and assign them to this store to see them here.
                  </Text>
                </View>
              );
            }

            return (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {storeStaff.map((staff, index) => {
                  const initials = getStaffInitials(staff.full_name);
                  const avatarUrl = staff.avatar_thumb_url || staff.avatar_url;
                  const storeNames = (staff.store_ids || [])
                    .map((id) => stores.find((s) => s.id === id)?.name)
                    .filter(Boolean);

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
                      {/* Avatar */}
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
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
                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                          {staff.full_name}
                        </Text>
                        {storeNames.length > 1 && (
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            {storeNames.length} stores
                          </Text>
                        )}
                      </View>
                      {/* Color dot */}
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: staff.color || primaryColor,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
