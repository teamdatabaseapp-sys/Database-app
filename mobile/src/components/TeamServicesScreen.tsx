/**
 * TeamServicesScreen (renamed to Stores & Staff)
 *
 * Unified screen with 2 tabs: Stores | Staff
 * Manages store locations and team members for business setup.
 */

import React, { useState, useMemo } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Edit3,
  Trash2,
  Users,
  User,
  Check,
  Store as StoreIcon,
  Clock,
  ChevronRight,
  Sparkles,
  DollarSign,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';

// Supabase hooks
import { useStores, useArchiveStore } from '@/hooks/useStores';
import { useStaffMembers, useArchiveStaffMember } from '@/hooks/useStaff';
import { useBusiness } from '@/hooks/useBusiness';
import type { StoreHoursDay } from '@/services/storesService';

// Photo service
import {
  STAFF_COLORS,
  DAY_KEYS,
  getDefaultStoreHours,
  parseTimeToDate,
  formatDateToTime,
  formatTimeForDisplay,
  formatPhoneNumber,
  formatPhoneAsTyped,
  formatBlackoutDate,
  getStaffInitials,
  type TabType,
  type TeamServicesScreenProps,
} from './team/teamServicesUtils';
import { ViewStoreStaffModal } from './team/ViewStoreStaffModal';
import { StoreListItem } from './team/StoreListItem';
import { StaffListItem } from './team/StaffListItem';
import { AddEditStaffModal, type AddEditStaffModalEditingStaff } from './team/AddEditStaffModal';
import { AddEditStoreModal, type AddEditStoreModalEditingStore } from './team/AddEditStoreModal';
import { HighlightWrapper } from '@/components/HighlightWrapper';

// ============================================
// Main Component
// ============================================

export function TeamServicesScreen({ visible, onClose, embedded = false, layout = 'tabbed', setupHint, highlightActive = false }: TeamServicesScreenProps) {
  const isUnified = layout === 'unified';
  const [activeTab, setActiveTab] = useTabPersistence<TabType>('team_services', 'stores');

  // Store modal state
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [editingStore, setEditingStore] = useState<AddEditStoreModalEditingStore | null>(null);

  // Staff modal state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AddEditStaffModalEditingStaff | null>(null);

  const { colors, isDark, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;

  // Supabase hooks
  const { businessId } = useBusiness();

  const { data: supabaseStores = [], isLoading: storesLoading } = useStores();
  const archiveStoreMutation = useArchiveStore();


  const { data: staffMembers = [], isLoading: staffLoading } = useStaffMembers();
  const archiveStaffMutation = useArchiveStaffMember();

  // Convert stores to usable format (including is_primary and photo fields)
  const stores = useMemo(() => {
    return supabaseStores.map((s) => ({
      id: s.id,
      name: s.name,
      businessId: s.business_id,
      address: s.address,
      phone: s.phone,
      hours: s.hours,
      blackout_dates: s.blackout_dates,
      is_primary: s.is_primary,
      photo_url: s.photo_url ?? null,
      photo_thumb_url: s.photo_thumb_url ?? null,
    }));
  }, [supabaseStores]);

  // Get staff count for a store
  const getStaffCountForStore = (storeId: string) => {
    return staffMembers.filter((s) => s.store_ids?.includes(storeId)).length;
  };

  // ============================================
  // Store Handlers
  // ============================================

  const openAddStoreModal = () => {
    setEditingStore(null);
    setShowStoreModal(true);
  };

  const openEditStoreModal = (store: AddEditStoreModalEditingStore) => {
    setEditingStore(store);
    setShowStoreModal(true);
  };

  const handleDeleteStore = (store: { id: string; name: string; is_primary?: boolean }) => {
    // Primary stores cannot be deleted - safety check
    if (store.is_primary) {
      Alert.alert(
        t('error', language),
        t('primaryStoreCannotBeDeleted', language) || 'Primary store cannot be deleted.'
      );
      return;
    }

    const staffCount = getStaffCountForStore(store.id);
    const message = staffCount > 0
      ? t('deleteStoreConfirmWithStaff', language).replace('{name}', store.name).replace('{count}', String(staffCount))
      : t('deleteStoreConfirmBody', language) || 'This cannot be undone.';

    Alert.alert(t('deleteStoreTitle', language), message, [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('delete', language),
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveStoreMutation.mutateAsync(store.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showSuccess(t('storeDeleted', language));
          } catch (err) {
            // Handle primary store error from backend
            const errorMessage = err instanceof Error && err.message === 'PRIMARY_STORE_CANNOT_BE_DELETED'
              ? (t('primaryStoreCannotBeDeleted', language) || 'Primary store cannot be deleted.')
              : t('failedToDeleteStore', language);
            Alert.alert(t('error', language), errorMessage);
          }
        },
      },
    ]);
  };
  // ============================================
  // View Store Staff Modal
  // ============================================

  const [showViewStoreStaffModal, setShowViewStoreStaffModal] = useState(false);
  const [viewingStore, setViewingStore] = useState<{ id: string; name: string } | null>(null);

  const openViewStoreStaffModal = (store: { id: string; name: string }) => {
    setViewingStore(store);
    setShowViewStoreStaffModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };


  // ============================================
  // Staff Handlers
  // ============================================

  const openAddStaffModal = () => {
    setEditingStaff(null);
    setShowStaffModal(true);
  };

  const openEditStaffModal = (staff: AddEditStaffModalEditingStaff) => {
    setEditingStaff(staff);
    setShowStaffModal(true);
  };

  const handleDeleteStaff = (staff: { id: string; full_name: string }) => {
    Alert.alert(
      t('deleteStaffTitle', language),
      t('deleteStaffConfirm', language).replace('{name}', staff.full_name),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveStaffMutation.mutateAsync(staff.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              showSuccess(t('staffDeleted', language));
            } catch (err) {
              Alert.alert(t('error', language), t('failedToDeleteStaff', language));
            }
          },
        },
      ]
    );
  };

  // ============================================
  // Render
  // ============================================

  if (!visible && !embedded) return null;

  const isLoading = storesLoading || staffLoading;

  const innerContent = (
    <View style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}>
        {/* Header — hidden when embedded */}
        {!embedded && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <StoreIcon size={18} color={primaryColor} />
            </View>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
              {t('storesAndStaff', language)}
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={24} color={colors.text} />
          </Pressable>
        </Animated.View>
        )}

        {/* Tab Bar — only shown in tabbed layout */}
        {!isUnified && (
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingHorizontal: 16,
          }}
        >
          {(['stores', 'staff'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'stores' ? (t('stores', language) || 'Stores') : (t('staff', language) || 'Staff');
            const count = tab === 'stores' ? stores.length : staffMembers.length;

            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? primaryColor : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: isActive ? primaryColor : colors.textSecondary,
                    fontWeight: isActive ? '600' : '500',
                    fontSize: 14,
                  }}
                >
                  {label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {isLoading && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          )}

          {/* ============================================ */}
          {/* STORES TAB / UNIFIED STORES SECTION */}
          {/* ============================================ */}
          {!isLoading && (activeTab === 'stores' || isUnified) && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Section title in unified mode */}
              {isUnified && (
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 }}>
                  {t('stores', language)}
                </Text>
              )}
              {/* Add Button — hidden when at 3-store limit */}
              <HighlightWrapper active={highlightActive && setupHint === 'additionalLocations'} borderRadius={12}>
              {stores.length < 3 ? (
                <Pressable
                  onPress={openAddStoreModal}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: `${primaryColor}10`,
                    marginBottom: 16,
                  }}
                >
                  <Plus size={20} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>{t('addStore', language)}</Text>
                </Pressable>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? `${primaryColor}10` : `${primaryColor}08`,
                    borderWidth: 1,
                    borderColor: `${primaryColor}25`,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <StoreIcon size={16} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 13 }}>{t('storeLimitReachedTitle', language)}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {t('storeLimitReachedDesc', language)}
                    </Text>
                  </View>
                </View>
              )}
              </HighlightWrapper>

              <HighlightWrapper active={highlightActive && setupHint === 'hours'} borderRadius={12}>
              {stores.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <StoreIcon size={48} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginTop: 12 }}>{t('noStores', language)}</Text>
                </View>
              ) : (
                stores.map((store, index) => {
                  const staffCount = getStaffCountForStore(store.id);
                  return (
                    <StoreListItem
                      key={store.id}
                      store={store}
                      index={index}
                      staffCount={staffCount}
                      onPress={(s) => openViewStoreStaffModal({ id: s.id, name: s.name })}
                      onEdit={(s) => openEditStoreModal(s)}
                      onDelete={(s) => handleDeleteStore({ id: s.id, name: s.name, is_primary: s.is_primary ?? undefined })}
                    />
                  );
                })
              )}
              </HighlightWrapper>
            </Animated.View>
          )}

          {/* ============================================ */}
          {/* STAFF TAB / UNIFIED STAFF SECTION */}
          {/* ============================================ */}
          {!isLoading && (activeTab === 'staff' || isUnified) && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Section title + separator in unified mode */}
              {isUnified && (
                <View style={{ marginTop: 24, marginBottom: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    {t('staff', language)}
                  </Text>
                </View>
              )}
              {/* Add Button */}
              <Pressable
                onPress={openAddStaffModal}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: `${primaryColor}10`,
                  marginBottom: 16,
                }}
              >
                <Plus size={20} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>{t('addStaffMember', language)}</Text>
              </Pressable>

              {staffMembers.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Users size={48} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginTop: 12 }}>{t('noStaffMembers', language)}</Text>
                </View>
              ) : (
                (() => {
                  // Sort staff by store creation order (same order as Stores list),
                  // then by staff created_at within each store group.
                  const storeIndexMap = new Map<string, number>(
                    stores.map((s, i) => [s.id, i])
                  );
                  const getPrimaryStoreIndex = (staff: typeof staffMembers[0]) => {
                    const ids = staff.store_ids || [];
                    if (ids.length === 0) return Infinity;
                    return Math.min(...ids.map((id) => storeIndexMap.get(id) ?? Infinity));
                  };
                  const sortedStaff = [...staffMembers].sort((a, b) => {
                    const storeA = getPrimaryStoreIndex(a);
                    const storeB = getPrimaryStoreIndex(b);
                    if (storeA !== storeB) return storeA - storeB;
                    // Within the same store group, sort by created_at ascending
                    return (a.created_at || '').localeCompare(b.created_at || '');
                  });
                  return sortedStaff.map((staff, index) => {
                  const storeNames = (staff.store_ids || [])
                    .map((id) => stores.find((s) => s.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <StaffListItem
                      key={staff.id}
                      staff={staff}
                      index={index}
                      storeNames={storeNames}
                      onEdit={(s) => openEditStaffModal(s)}
                      onDelete={(s) => handleDeleteStaff({ id: s.id, full_name: s.full_name })}
                    />
                  );
                });
                })()
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* ============================================ */}
        {/* STORE MODAL */}
        {/* ============================================ */}
        <AddEditStoreModal
          visible={showStoreModal}
          editingStore={editingStore}
          onClose={() => setShowStoreModal(false)}
          onSaved={() => setShowStoreModal(false)}
          storesCount={stores.length}
        />
        {/* ============================================ */}
        {/* STAFF MODAL */}
        {/* ============================================ */}
        <AddEditStaffModal
          visible={showStaffModal}
          editingStaff={editingStaff}
          onClose={() => setShowStaffModal(false)}
          onSaved={() => setShowStaffModal(false)}
        />

        {/* ============================================ */}
        {/* VIEW STORE STAFF MODAL (Read-Only) */}
        {/* ============================================ */}
        <ViewStoreStaffModal
          visible={showViewStoreStaffModal}
          viewingStore={viewingStore}
          onClose={() => {
            setShowViewStoreStaffModal(false);
            setViewingStore(null);
          }}
        />
      </View>
  );

  if (embedded) return innerContent;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {innerContent}
      </SafeAreaView>
    </Modal>
  );
}
