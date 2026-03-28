import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Users,
  Store as StoreIcon,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { type StoresManagementScreenProps } from './stores/storesManagementUtils';
export type { StoresManagementScreenProps } from './stores/storesManagementUtils';
import { ViewStoreStaffModal } from './stores/ViewStoreStaffModal';
import { StorePreview } from './stores/StorePreview';
import { StaffPreview } from './stores/StaffPreview';
import { StoreSectionHeader } from './stores/StoreSectionHeader';
import { EmptyStoreState, EmptyStaffState } from './stores/EmptyStates';
import { AddEditStoreModal } from './stores/AddEditStoreModal';
import { AddEditStaffModal } from './stores/AddEditStaffModal';

// Supabase hooks
import { useStores, useArchiveStore, useReorderStores } from '@/hooks/useStores';
import { useStaffMembers, useCreateStaffMember, useUpdateStaffMember, useDeleteStaffMember } from '@/hooks/useStaff';
import { useServices, useCreateService } from '@/hooks/useServices';
import { useBusiness } from '@/hooks/useBusiness';

// Photo service
import { validatePhoto, uploadStaffPhoto, removeStaffPhoto } from '@/services/staffPhotoService';

export function StoresManagementScreen({ visible, onClose }: StoresManagementScreenProps) {
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [editingStore, setEditingStore] = useState<{ id: string; name: string; photo_url?: string | null; photo_thumb_url?: string | null } | null>(null);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<{ id: string; name: string; storeIds?: string[]; storeId?: string; serviceIds?: string[]; avatar_url?: string | null; avatar_thumb_url?: string | null } | null>(null);
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  // View Store Staff Modal state
  const [showViewStoreStaffModal, setShowViewStoreStaffModal] = useState(false);
  const [viewingStore, setViewingStore] = useState<{ id: string; name: string } | null>(null);

  const { colors, isDark, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;

  // Supabase hooks for stores
  const { businessId, isInitialized } = useBusiness();
  const { data: supabaseStores = [], isLoading: storesLoading, error: storesError } = useStores();
  const archiveStoreMutation = useArchiveStore();
  const reorderStoresMutation = useReorderStores();

  // Supabase hooks for staff
  const { data: supabaseStaff = [], isLoading: staffLoading } = useStaffMembers();
  const deleteStaffMutation = useDeleteStaffMember();

  // Supabase hooks for services
  const { data: services = [] } = useServices();

  // Convert Supabase stores to usable format (already sorted by is_primary, created_at from service)
  const stores = useMemo(() => {
    return supabaseStores.map((s, index) => ({
      id: s.id,
      name: s.name,
      businessId: s.business_id,
      sort_order: s.sort_order ?? index + 1,
      is_primary: s.is_primary ?? false,
      photo_url: s.photo_url ?? null,
      photo_thumb_url: s.photo_thumb_url ?? null,
    }));
  }, [supabaseStores]);

  // Move store up in order
  const handleMoveStoreUp = async (storeIndex: number) => {
    if (storeIndex <= 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newOrders = stores.map((store, idx) => {
      if (idx === storeIndex) {
        return { id: store.id, sort_order: stores[storeIndex - 1].sort_order };
      }
      if (idx === storeIndex - 1) {
        return { id: store.id, sort_order: stores[storeIndex].sort_order };
      }
      return { id: store.id, sort_order: store.sort_order };
    });

    try {
      await reorderStoresMutation.mutateAsync(newOrders);
      showSuccess(t('toastStoreOrderUpdated', language));
    } catch (err) {
      console.log('[StoresManagementScreen] Error reordering stores:', err);
    }
  };

  // Move store down in order
  const handleMoveStoreDown = async (storeIndex: number) => {
    if (storeIndex >= stores.length - 1) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newOrders = stores.map((store, idx) => {
      if (idx === storeIndex) {
        return { id: store.id, sort_order: stores[storeIndex + 1].sort_order };
      }
      if (idx === storeIndex + 1) {
        return { id: store.id, sort_order: stores[storeIndex].sort_order };
      }
      return { id: store.id, sort_order: store.sort_order };
    });

    try {
      await reorderStoresMutation.mutateAsync(newOrders);
      showSuccess(t('toastStoreOrderUpdated', language));
    } catch (err) {
      console.log('[StoresManagementScreen] Error reordering stores:', err);
    }
  };

  // Convert Supabase staff to usable format
  const staffMembers = useMemo(() => {
    return supabaseStaff.map((s) => ({
      id: s.id,
      name: s.full_name,
      color: s.color,
      storeIds: s.store_ids || [],
      storeId: s.store_ids?.[0],
      serviceIds: s.service_ids || [],
      // Photo URLs
      photo_url: s.photo_url || null,
      avatar_url: s.avatar_url || null,
      avatar_thumb_url: s.avatar_thumb_url || null,
    }));
  }, [supabaseStaff]);

  // Debug logging
  useEffect(() => {
    if (visible) {
      console.log('[StoresManagementScreen] ========== SCREEN OPENED ==========');
      console.log('[StoresManagementScreen] businessId:', businessId);
      console.log('[StoresManagementScreen] isInitialized:', isInitialized);
      console.log('[StoresManagementScreen] storesLoading:', storesLoading);
      console.log('[StoresManagementScreen] stores count:', stores.length);
      console.log('[StoresManagementScreen] stores:', JSON.stringify(stores.map(s => ({ id: s.id, name: s.name }))));
      console.log('[StoresManagementScreen] staffMembers count:', staffMembers.length);
      // Debug: log each staff member's storeIds and resolved store names
      staffMembers.forEach(staff => {
        const resolvedNames = getStoreNamesForStaff(staff);
        console.log(`[StoresManagementScreen] Staff "${staff.name}": storeIds=${JSON.stringify(staff.storeIds)}, resolved="${resolvedNames}"`);
      });
      if (storesError) {
        console.log('[StoresManagementScreen] storesError:', (storesError as Error).message);
      }
      console.log('[StoresManagementScreen] ================================');
    }
  }, [visible, businessId, isInitialized, storesLoading, stores, staffMembers, storesError]);

  // Get staff members for a specific store
  const getStaffForStore = (storeId: string) => {
    return staffMembers.filter((s) => {
      if (s.storeIds && s.storeIds.length > 0) {
        return s.storeIds.includes(storeId);
      }
      return s.storeId === storeId;
    });
  };

  // Get store names for a staff member
  const getStoreNamesForStaff = (staff: { storeIds?: string[]; storeId?: string }): string => {
    const storeIds = staff.storeIds && staff.storeIds.length > 0 ? staff.storeIds : (staff.storeId ? [staff.storeId] : []);
    if (storeIds.length === 0) return t('notAssignedToStore', language) || 'Not assigned';
    const storeNames = storeIds
      .map((id) => stores.find((s) => s.id === id)?.name)
      .filter(Boolean);
    return storeNames.join(', ') || t('notAssignedToStore', language) || 'Not assigned';
  };

  const toggleStoreExpanded = (storeId: string) => {
    setExpandedStores((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(storeId)) {
        newSet.delete(storeId);
      } else {
        newSet.add(storeId);
      }
      return newSet;
    });
  };

  // Open view-only store staff modal
  const openViewStoreStaffModal = (store: { id: string; name: string }) => {
    setViewingStore(store);
    setShowViewStoreStaffModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openAddStoreModal = () => {
    setEditingStore(null);
    setShowAddStoreModal(true);
  };

  const openEditStoreModal = (store: { id: string; name: string; photo_url?: string | null; photo_thumb_url?: string | null }) => {
    console.log('[StoresManagementScreen] openEditStoreModal called for store:', store.id, store.name);
    setEditingStore(store);
    setShowAddStoreModal(true);
  };

  const openAddStaffModal = () => {
    console.log('[StoresManagementScreen] openAddStaffModal called');
    setEditingStaff(null);
    setShowAddStaffModal(true);
  };

  const openEditStaffModal = (staff: { id: string; name: string; color: string; storeIds?: string[]; storeId?: string; serviceIds?: string[]; avatar_url?: string | null; avatar_thumb_url?: string | null }) => {
    console.log('[StoresManagementScreen] openEditStaffModal called for staff:', staff.id, staff.name);
    setEditingStaff(staff);
    setShowAddStaffModal(true);
  };

  const handleDeleteStore = (store: { id: string; name: string; is_primary?: boolean }) => {
    // Primary stores cannot be deleted
    if (store.is_primary) {
      Alert.alert(
        t('error', language) || 'Error',
        t('primaryStoreCannotBeDeleted', language) || 'Primary store cannot be deleted.'
      );
      return;
    }

    const storeStaff = getStaffForStore(store.id);
    const localizedName = getLocalizedStoreName(store.name, language);
    const message = storeStaff.length > 0
      ? (t('deleteStoreConfirmWithStaff', language) || `Delete "{name}"? {count} staff member(s) will be unassigned.`)
        .replace('{name}', localizedName)
        .replace('{count}', storeStaff.length.toString())
      : (t('deleteStoreConfirmBody', language) || 'This cannot be undone.');

    Alert.alert(
      t('deleteStoreTitle', language) || 'Delete Store?',
      message,
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[StoresManagementScreen] Archiving store:', store.id);
              await archiveStoreMutation.mutateAsync(store.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              showSuccess(t('storeDeleted', language) || 'Store deleted.');
            } catch (err) {
              console.log('[StoresManagementScreen] Error deleting store:', err);
              // Handle primary store error from backend
              const errorMessage = err instanceof Error && err.message === 'PRIMARY_STORE_CANNOT_BE_DELETED'
                ? (t('primaryStoreCannotBeDeleted', language) || 'Primary store cannot be deleted.')
                : (err instanceof Error ? err.message : t('failedToDeleteStore', language) || 'Failed to delete store');
              Alert.alert(t('error', language), errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleDeleteStaff = (staff: { id: string; name: string }) => {
    Alert.alert(
      t('deleteStaffMember', language) || 'Delete Staff Member',
      (t('deleteStaffMemberConfirm', language) || 'Are you sure you want to delete {name}?').replace('{name}', staff.name),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStaffMutation.mutateAsync(staff.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              showSuccess(t('staffDeleted', language) || 'Staff deleted.');
            } catch (err) {
              console.log('[StoresManagementScreen] Error deleting staff:', err);
              const errorMessage = err instanceof Error ? err.message : t('failedToDeleteStaff', language) || 'Failed to delete staff member';
              Alert.alert(t('error', language), errorMessage);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}
        edges={['top']}
      >
        {/* Header */}
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
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={24} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
            {t('storesAndStaffMembers', language) || 'Stores & Staff Members'}
          </Text>
          <View style={{ width: 32 }} />
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Loading State */}
          {storesLoading && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={primaryColor} />
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading stores...</Text>
            </View>
          )}

          {/* ============ STORES SECTION ============ */}
          {!storesLoading && (
            <Animated.View entering={FadeInDown.delay(50).duration(300)}>
              {/* Section Header */}
              <StoreSectionHeader
                icon={<StoreIcon size={18} color={primaryColor} />}
                title={t('stores', language) || 'Stores'}
                count={stores.length}
                onAdd={openAddStoreModal}
              />

              {/* Stores List */}
              {stores.length > 0 ? (
                stores.map((store, index) => {
                  const storeStaff = getStaffForStore(store.id);
                  const isFirst = index === 0;
                  const isLast = index === stores.length - 1;
                  const canReorder = stores.length > 1;

                  return (
                    <StorePreview
                      key={store.id}
                      store={store}
                      staffCount={storeStaff.length}
                      index={index}
                      isFirst={isFirst}
                      isLast={isLast}
                      canReorder={canReorder}
                      reorderIsPending={reorderStoresMutation.isPending}
                      onPress={() => openViewStoreStaffModal(store)}
                      onEdit={() => openEditStoreModal(store)}
                      onDelete={() => handleDeleteStore(store)}
                      onMoveUp={() => handleMoveStoreUp(index)}
                      onMoveDown={() => handleMoveStoreDown(index)}
                    />
                  );
                })
              ) : (
                <EmptyStoreState language={language} />
              )}
            </Animated.View>
          )}

          {/* ============ STAFF MEMBERS SECTION ============ */}
          {!storesLoading && (
            <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ marginTop: 24 }}>
              {/* Section Header */}
              <StoreSectionHeader
                icon={<Users size={18} color={primaryColor} />}
                title={t('staffMembers', language) || 'Staff Members'}
                count={staffMembers.length}
                onAdd={openAddStaffModal}
              />

              {/* Staff Members List */}
              {staffMembers.length > 0 ? (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                  }}
                >
                  {staffMembers.map((staff, index) => {
                    const assignedStores = getStoreNamesForStaff(staff);
                    const storeIds = staff.storeIds && staff.storeIds.length > 0 ? staff.storeIds : (staff.storeId ? [staff.storeId] : []);
                    const hasStores = storeIds.length > 0;

                    return (
                      <StaffPreview
                        key={staff.id}
                        staff={staff}
                        index={index}
                        assignedStores={assignedStores}
                        hasStores={hasStores}
                        onEdit={() => openEditStaffModal(staff)}
                        onDelete={() => handleDeleteStaff(staff)}
                      />
                    );
                  })}
                </View>
              ) : (
                <EmptyStaffState language={language} />
              )}
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      <AddEditStoreModal
        visible={showAddStoreModal}
        editingStore={editingStore}
        onClose={() => setShowAddStoreModal(false)}
        onSaved={() => setShowAddStoreModal(false)}
      />

      {/* Add/Edit Staff Modal */}
      <AddEditStaffModal
        visible={showAddStaffModal}
        editingStaff={editingStaff}
        onClose={() => setShowAddStaffModal(false)}
        onSaved={() => setShowAddStaffModal(false)}
      />

      {/* View Store Staff Modal (Read-Only) */}
      <ViewStoreStaffModal
        visible={showViewStoreStaffModal}
        onClose={() => {
          setShowViewStoreStaffModal(false);
          setViewingStore(null);
        }}
        viewingStore={viewingStore}
        staffMembers={staffMembers}
        services={services}
      />
    </Modal>
  );
}
