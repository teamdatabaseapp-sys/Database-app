import React from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import {
  Store as StoreIcon,
  Check,
  AlertCircle,
  ChevronDown,
  Users,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useStore } from '@/lib/store';

export interface StoreItem {
  id: string;
  name: string;
}

export interface StaffMember {
  id: string;
  name: string;
  color: string;
  storeIds: string[];
  avatar_url: string | null;
  avatar_thumb_url: string | null;
}

export interface StoreStaffRowProps {
  // Store section
  stores: StoreItem[];
  activeStoreId: string | null;
  storesStillLoading: boolean;
  storesTableMissing: boolean | null | undefined | false;
  hasNoStores: boolean;
  isSingleStore: boolean;
  hasMultipleStores: boolean;
  showStorePicker: boolean;
  onToggleStorePicker: () => void;
  onSelectStore: (storeId: string) => void;
  // Staff section
  staffMembers: StaffMember[];
  selectedStaffId: string | null;
  conflictError: string | null;
  onSelectStaff: (staffId: string) => void;
  onManageStaff: () => void;
}

export function StoreStaffRow({
  stores,
  activeStoreId,
  storesStillLoading,
  storesTableMissing,
  hasNoStores,
  isSingleStore,
  hasMultipleStores,
  showStorePicker,
  onToggleStorePicker,
  onSelectStore,
  staffMembers,
  selectedStaffId,
  conflictError,
  onSelectStaff,
  onManageStaff,
}: StoreStaffRowProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  return (
    <>
      {/* Store Selection Section - ALWAYS visible */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
          {hasMultipleStores ? t('storeRequired', language) : t('store', language)}
        </Text>

        {/* Loading stores */}
        {storesStillLoading && stores.length === 0 && !storesTableMissing && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <StoreIcon size={18} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, marginLeft: 10, flex: 1, fontSize: 14 }}>
              {t('loading', language)}
            </Text>
          </View>
        )}

        {/* Stores table missing - database setup needed */}
        {storesTableMissing && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <StoreIcon size={18} color={primaryColor} />
            <Text style={{ color: colors.text, marginLeft: 10, flex: 1, fontSize: 15 }}>
              {t('defaultStore', language)}
            </Text>
            <Check size={16} color={primaryColor} />
          </View>
        )}

        {/* No stores - show message */}
        {hasNoStores && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FEF3C7',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <AlertCircle size={18} color="#D97706" />
            <Text style={{ color: '#92400E', marginLeft: 10, flex: 1, fontSize: 14 }}>
              {t('createStoreToBook', language)}
            </Text>
          </View>
        )}

        {/* Single store - show selected store (auto-selected) */}
        {isSingleStore && stores[0] && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <StoreIcon size={18} color={primaryColor} />
            <Text style={{ marginLeft: 10, fontSize: 15, color: colors.text, flex: 1 }}>
              {getLocalizedStoreName(stores[0].name, language)}
            </Text>
            <Check size={16} color={primaryColor} />
          </View>
        )}

        {/* Multiple stores - show picker */}
        {hasMultipleStores && (
          <>
            <Pressable
              onPress={onToggleStorePicker}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderWidth: 1,
                borderColor: !activeStoreId ? '#EF4444' : colors.border,
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <StoreIcon size={18} color={activeStoreId ? primaryColor : colors.textTertiary} />
                <Text
                  style={{ marginLeft: 10, fontSize: 15, color: activeStoreId ? colors.text : colors.textTertiary, flex: 1 }}
                  numberOfLines={1}
                >
                  {activeStoreId
                    ? getLocalizedStoreName(stores.find((s) => s.id === activeStoreId)?.name, language)
                    : t('selectStore', language)}
                </Text>
              </View>
              <ChevronDown size={18} color={colors.textTertiary} />
            </Pressable>

            {/* Store Dropdown */}
            {showStorePicker && (
              <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginTop: 8, maxHeight: 200, overflow: 'hidden' }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {stores.map((store) => (
                    <Pressable
                      key={store.id}
                      onPress={() => onSelectStore(store.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <View
                        style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${primaryColor}15` }}
                      >
                        <StoreIcon size={16} color={primaryColor} />
                      </View>
                      <Text style={{ marginLeft: 10, color: colors.text, fontWeight: '500', flex: 1 }}>{getLocalizedStoreName(store.name, language)}</Text>
                      {activeStoreId === store.id && <Check size={16} color={primaryColor} />}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </View>

      {/* Staff Selection - Disabled until store is selected (only for multi-store) or no stores */}
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          opacity: (hasNoStores && !storesTableMissing) || (hasMultipleStores && !activeStoreId) ? 0.6 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>
            {t('staffMemberOptional', language)}
          </Text>
          <Pressable onPress={onManageStaff} disabled={(hasNoStores && !storesTableMissing) || (hasMultipleStores && !activeStoreId)}>
            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '500' }}>{t('manageStaff', language)}</Text>
          </Pressable>
        </View>

        {/* Show message if no stores exist (but only if table exists) */}
        {hasNoStores && !storesTableMissing ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <StoreIcon size={18} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, marginLeft: 10, flex: 1 }}>
              {t('createStoreToBook', language)}
            </Text>
          </View>
        ) : hasMultipleStores && !activeStoreId ? (
          /* Show message if store not selected yet (only for multi-store businesses) */
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <StoreIcon size={18} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, marginLeft: 10, flex: 1 }}>
              {t('selectStoreToSeeStaff', language)}
            </Text>
          </View>
        ) : staffMembers.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {/* Staff members */}
            {staffMembers.map((staff) => {
              const isSelected = selectedStaffId === staff.id;
              // Use thumbnail for faster loading
              const avatarUrl = staff.avatar_thumb_url || staff.avatar_url;
              return (
                <Pressable
                  key={staff.id}
                  onPress={() => onSelectStaff(staff.id)}
                  style={{
                    marginRight: 10,
                    marginBottom: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? staff.color : `${staff.color}15`,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: staff.color,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: avatarUrl ? 'transparent' : (isSelected ? '#fff' : `${staff.color}30`),
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={{ width: 24, height: 24, borderRadius: 12 }}
                      />
                    ) : (
                      <Text style={{ color: isSelected ? staff.color : staff.color, fontSize: 10, fontWeight: '700' }}>
                        {staff.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      marginLeft: 6,
                      fontWeight: '500',
                      fontSize: 14,
                      color: isSelected ? '#fff' : staff.color,
                    }}
                  >
                    {staff.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Pressable
            onPress={onManageStaff}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Users size={18} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, marginLeft: 10, flex: 1 }}>
              {t('addStaffMembersToAssign', language)}
            </Text>
          </Pressable>
        )}

        {/* Conflict Error */}
        {conflictError && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FEE2E2',
              borderRadius: 10,
              padding: 12,
              marginTop: 12,
            }}
          >
            <AlertCircle size={18} color="#EF4444" />
            <Text style={{ color: '#EF4444', fontSize: 13, marginLeft: 8, flex: 1 }}>
              {conflictError}
            </Text>
          </View>
        )}
      </View>
    </>
  );
}
