import React, { useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
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
  ChevronDown,
  Camera,
  Sparkles,
  Clock,
  DollarSign,
  Palette,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import {
  useStaffMembers,
  useCreateStaffMember,
  useUpdateStaffMember,
  useArchiveStaffMember,
  useUpdateStaffAssignments,
} from '@/hooks/useStaff';
import { useStores } from '@/hooks/useStores';
import { useServices, useCreateService } from '@/hooks/useServices';
import { useBusiness } from '@/hooks/useBusiness';
import { type StaffMemberWithAssignments } from '@/services/staffService';
import {
  uploadStaffPhoto,
  removeStaffPhoto,
  validatePhoto,
} from '@/services/staffPhotoService';
import { StaffScheduleEditor } from '@/components/StaffScheduleEditor';

// Helper to get staff initials (first + last name initials, or just first name initial if no last name)
const getStaffInitials = (name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName) return '?';

  const parts = trimmedName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';

  if (parts.length === 1) {
    // Only first name - use first letter
    return parts[0].charAt(0).toUpperCase();
  }

  // First + last name initials
  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return firstInitial + lastInitial;
};

interface StaffManagementScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function StaffManagementScreen({ visible, onClose }: StaffManagementScreenProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMemberWithAssignments | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [showServicesPicker, setShowServicesPicker] = useState(false);

  // Store filter for the staff list (separate from edit modal's selectedStoreId)
  const [filterStoreId, setFilterStoreId] = useState<string | null>(null);

  // Photo upload state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);
  const [existingThumbUrl, setExistingThumbUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState('');

  // Inline Add Service state
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('60');
  const [newServicePrice, setNewServicePrice] = useState('');

  const { colors, isDark, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;

  // Supabase hooks
  const { data: staffMembers = [], isLoading, error } = useStaffMembers();
  const { data: stores = [] } = useStores();
  const { data: allServices = [] } = useServices();
  const { businessId } = useBusiness();
  const createStaffMutation = useCreateStaffMember();
  const updateStaffMutation = useUpdateStaffMember();
  const archiveStaffMutation = useArchiveStaffMember();
  const updateStaffAssignmentsMutation = useUpdateStaffAssignments();
  const createServiceMutation = useCreateService();

  // Filter out products - only show actual services (service_type !== 'product')
  const services = allServices.filter((s) => {
    const svcType = (s as unknown as { service_type?: string }).service_type;
    return svcType !== 'product';
  });

  // Get selected store name
  const selectedStore = stores.find(s => s.id === selectedStoreId);
  const selectedStoreName = selectedStore
    ? getLocalizedStoreName(selectedStore.name, language)
    : t('selectStore', language) || 'Select Store';

  // Get selected services summary text
  const selectedServicesText = selectedServiceIds.length === 0
    ? 'All Services'
    : selectedServiceIds.length === 1
      ? services.find(s => s.id === selectedServiceIds[0])?.name || '1 Service'
      : `${selectedServiceIds.length} ${t('servicesTitle', language) || 'Services'}`;

  // Get filter store name for display
  const filterStore = stores.find(s => s.id === filterStoreId);
  const filterStoreName = filterStore
    ? getLocalizedStoreName(filterStore.name, language)
    : t('allStores', language) || 'All Stores';

  // Filter staff members based on selected store filter
  const filteredStaffMembers = filterStoreId
    ? staffMembers.filter(staff => staff.store_ids?.includes(filterStoreId))
    : staffMembers;

  const resetForm = () => {
    setStaffName('');
    setStaffEmail('');
    setEmailError('');
    setSelectedStoreId(null);
    setSelectedServiceIds([]);
    setEditingStaff(null);
    setPhotoUri(null);
    setExistingAvatarUrl(null);
    setExistingThumbUrl(null);
    setIsUploadingPhoto(false);
    setPhotoUploadProgress('');
  };

  const resetAddServiceForm = () => {
    setNewServiceName('');
    setNewServiceDuration('60');
    setNewServicePrice('');
    setShowAddServiceForm(false);
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Empty is OK
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleCreateService = async () => {
    const trimmedName = newServiceName.trim();
    if (!trimmedName) {
      Alert.alert(
        t('error', language) || 'Error',
        t('serviceNameRequired', language) || 'Please enter a service name'
      );
      return;
    }

    try {
      const durationMinutes = parseInt(newServiceDuration, 10) || 60;
      const priceCents = newServicePrice ? Math.round(parseFloat(newServicePrice) * 100) : 0;

      const newService = await createServiceMutation.mutateAsync({
        name: trimmedName,
        color: primaryColor, // Always use theme primary color
        duration_minutes: durationMinutes,
        price_cents: priceCents,
        currency_code: 'USD',
        service_type: 'service',
      });

      // Auto-select the newly created service
      if (newService?.id) {
        setSelectedServiceIds((prev) => [...prev, newService.id]);
      }

      showSaveConfirmation();
      resetAddServiceForm();
    } catch (err) {
      console.log('[StaffManagementScreen] Error creating service:', err);
      Alert.alert(
        t('error', language) || 'Error',
        err instanceof Error ? err.message : 'Failed to create service'
      );
    }
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (staff: StaffMemberWithAssignments) => {
    setEditingStaff(staff);
    setStaffName(staff.full_name);
    setStaffEmail(staff.email || '');
    setEmailError('');
    // Set the first assigned store if any
    setSelectedStoreId(staff.store_ids?.[0] || null);
    // Set assigned services
    setSelectedServiceIds(staff.service_ids || []);
    // Set existing photo URLs
    setExistingAvatarUrl(staff.avatar_url || null);
    setExistingThumbUrl(staff.avatar_thumb_url || null);
    setPhotoUri(null); // Reset new photo selection
    setShowAddModal(true);
  };

  // Photo picker function
  const handlePickPhoto = async () => {
    console.log('[StaffManagementScreen] Opening image picker...');
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library.'
        );
        return;
      }

      console.log('[StaffManagementScreen] Launching image picker...');
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        console.log('[StaffManagementScreen] Image picker cancelled');
        return;
      }

      const selectedUri = result.assets[0].uri;
      console.log('[StaffManagementScreen] Image selected:', selectedUri);

      // Validate before accepting
      const validation = await validatePhoto(selectedUri);
      if (!validation.valid) {
        Alert.alert(
          t('error', language) || 'Error',
          validation.error || 'Invalid photo'
        );
        return;
      }

      console.log('[StaffManagementScreen] Photo validated, setting preview');
      setPhotoUri(selectedUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.log('[StaffManagementScreen] Photo picker error:', err);
      Alert.alert(
        t('error', language) || 'Error',
        'Failed to select photo'
      );
    }
  };

  // Remove photo function
  const handleRemovePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPhotoUri(null);
            // Mark existing photos for removal by clearing them
            setExistingAvatarUrl(null);
            setExistingThumbUrl(null);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    const trimmedName = staffName.trim();
    if (!trimmedName) {
      Alert.alert(
        t('error', language) || 'Error',
        t('staffNameRequired', language) || 'Please enter a staff name'
      );
      return;
    }

    if (staffEmail.trim() && !validateEmail(staffEmail)) {
      setEmailError(t('invalidEmail', language) || 'Invalid email address');
      return;
    }
    setEmailError('');

    if (!businessId) {
      Alert.alert(t('error', language) || 'Error', 'Business not initialized');
      return;
    }

    try {
      // Build store_ids array from selected store
      const storeIds = selectedStoreId ? [selectedStoreId] : [];

      // Prepare avatar URLs
      let photoUrl: string | null | undefined = undefined;
      let avatarUrl: string | null | undefined = undefined;
      let avatarThumbUrl: string | null | undefined = undefined;

      // Handle photo upload if a new photo was selected
      if (photoUri) {
        console.log('[StaffManagementScreen] Starting photo upload for URI:', photoUri);
        setIsUploadingPhoto(true);
        setPhotoUploadProgress('Uploading...');

        // For new staff, we need to create first then upload photo
        // For existing staff, we can upload immediately
        const staffIdForUpload = editingStaff?.id;

        if (staffIdForUpload) {
          // Upload photo for existing staff
          const uploadResult = await uploadStaffPhoto(
            businessId,
            staffIdForUpload,
            photoUri,
            editingStaff?.avatar_url,
            editingStaff?.avatar_thumb_url
          );

          if (!uploadResult.success) {
            setIsUploadingPhoto(false);
            setPhotoUploadProgress('');
            Alert.alert(t('error', language) || 'Error', uploadResult.error || 'Failed to upload photo');
            return;
          }

          photoUrl = uploadResult.photoUrl;
          avatarUrl = uploadResult.avatarUrl;
          avatarThumbUrl = uploadResult.avatarThumbUrl;
        }
        // For new staff, we'll handle photo after creation
      } else if (existingAvatarUrl === null && editingStaff?.avatar_url) {
        // Photo was explicitly removed
        photoUrl = null;
        avatarUrl = null;
        avatarThumbUrl = null;
        // Clean up old files
        await removeStaffPhoto(editingStaff.avatar_url, editingStaff.avatar_thumb_url);
      }

      if (editingStaff) {
        // Update existing staff
        const updates: {
          full_name: string;
          store_ids: string[];
          service_ids: string[];
          photo_url?: string | null;
          avatar_url?: string | null;
          avatar_thumb_url?: string | null;
          email?: string;
        } = {
          full_name: trimmedName,
          store_ids: storeIds,
          service_ids: selectedServiceIds,
          email: staffEmail.trim() || undefined,
        };

        // Only include photo/avatar fields if they were changed
        if (photoUrl !== undefined) {
          updates.photo_url = photoUrl;
          updates.avatar_url = avatarUrl ?? null;
          updates.avatar_thumb_url = avatarThumbUrl ?? null;
        }

        await updateStaffMutation.mutateAsync({
          staffId: editingStaff.id,
          updates,
        });
      } else {
        // Create new staff with store and service assignments
        const newStaff = await createStaffMutation.mutateAsync({
          full_name: trimmedName,
          store_ids: storeIds,
          service_ids: selectedServiceIds,
          email: staffEmail.trim() || undefined,
        });

        // If we have a photo and the staff was created successfully, upload it now
        if (photoUri && newStaff?.id) {
          setPhotoUploadProgress('Uploading photo...');
          const uploadResult = await uploadStaffPhoto(
            businessId,
            newStaff.id,
            photoUri,
            null,
            null
          );

          if (uploadResult.success) {
            // Update the staff with photo URLs
            await updateStaffMutation.mutateAsync({
              staffId: newStaff.id,
              updates: {
                photo_url: uploadResult.photoUrl,
                avatar_url: uploadResult.avatarUrl,
                avatar_thumb_url: uploadResult.avatarThumbUrl,
              },
            });
          } else {
            console.log('[StaffManagementScreen] Photo upload failed for new staff:', uploadResult.error);
            // Staff was created, just log the photo error
          }
        }
      }

      setIsUploadingPhoto(false);
      setPhotoUploadProgress('');

      showSaveConfirmation();
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      setIsUploadingPhoto(false);
      setPhotoUploadProgress('');
      console.log('[StaffManagementScreen] Error saving staff:', err);
      Alert.alert(
        t('error', language) || 'Error',
        err instanceof Error ? err.message : t('failedToSaveStaff', language) || 'Failed to save staff member'
      );
    }
  };

  const handleDelete = (staff: StaffMemberWithAssignments) => {
    Alert.alert(
      t('deleteStaffMember', language) || 'Delete Staff Member',
      (t('deleteStaffMemberConfirm', language) || 'Are you sure you want to delete {name}?').replace('{name}', staff.full_name),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveStaffMutation.mutateAsync(staff.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSuccess(t('staffDeleted', language) || 'Staff member deleted');
            } catch (err) {
              console.log('[StaffManagementScreen] Error deleting staff:', err);
              Alert.alert(
                t('error', language) || 'Error',
                err instanceof Error ? err.message : t('failedToDeleteStaff', language) || 'Failed to delete staff member'
              );
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

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
            {t('staffMembers', language)}
          </Text>
          <Pressable
            onPress={openAddModal}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: primaryColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={20} color="#fff" />
          </Pressable>
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Banner */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(300)}
            style={{
              backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Users size={20} color={primaryColor} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 10, flex: 1 }}>
              {t('staffInfoBanner', language)}
            </Text>
          </Animated.View>

          {/* Store Filter - Only show if there are stores */}
          {stores.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(75).duration(300)}
              style={{ marginBottom: 16 }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {/* All Stores pill */}
                <Pressable
                  onPress={() => {
                    setFilterStoreId(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: filterStoreId === null
                      ? primaryColor
                      : isDark ? colors.card : '#FFFFFF',
                    borderWidth: filterStoreId === null ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <StoreIcon
                    size={14}
                    color={filterStoreId === null ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 13,
                      fontWeight: '600',
                      color: filterStoreId === null ? '#FFFFFF' : colors.text,
                    }}
                  >
                    {t('allStores', language) || 'All Stores'}
                  </Text>
                </Pressable>

                {/* Individual store pills */}
                {stores.map((store) => {
                  const isSelected = filterStoreId === store.id;
                  const storeName = getLocalizedStoreName(store.name, language);
                  return (
                    <Pressable
                      key={store.id}
                      onPress={() => {
                        setFilterStoreId(store.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: isSelected
                          ? primaryColor
                          : isDark ? colors.card : '#FFFFFF',
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <StoreIcon
                        size={14}
                        color={isSelected ? '#FFFFFF' : colors.textSecondary}
                      />
                      <Text
                        style={{
                          marginLeft: 6,
                          fontSize: 13,
                          fontWeight: '600',
                          color: isSelected ? '#FFFFFF' : colors.text,
                        }}
                      >
                        {storeName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          {/* Loading State */}
          {isLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ color: colors.textTertiary, marginTop: 12 }}>
                {t('loading', language)}
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: '#EF4444', fontSize: 14, textAlign: 'center' }}>
                {error instanceof Error ? error.message : 'Failed to load staff members'}
              </Text>
            </View>
          )}

          {/* Staff List */}
          {!isLoading && !error && filteredStaffMembers.length > 0 ? (
            filteredStaffMembers.map((staff, index) => {
              const initials = getStaffInitials(staff.full_name);
              // Use thumbnail URL for list display (faster loading)
              const avatarUrl = staff.avatar_thumb_url || staff.avatar_url;
              return (
                <Animated.View
                  key={staff.id}
                  entering={FadeInDown.delay(100 + index * 50).duration(300)}
                >
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                    }}
                  >
                    {/* Avatar */}
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: avatarUrl ? 'transparent' : `${staff.color || primaryColor}20`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                        overflow: 'hidden',
                      }}
                    >
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={{ width: 48, height: 48, borderRadius: 24 }}
                        />
                      ) : (
                        <Text style={{ color: staff.color || primaryColor, fontWeight: '700', fontSize: 18 }}>
                          {initials}
                        </Text>
                      )}
                    </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                          {staff.full_name}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                          {t('staffMember', language)}
                        </Text>
                      </View>

                    {/* Actions */}
                    <Pressable
                      onPress={() => openEditModal(staff)}
                      style={{ padding: 8, marginRight: 4 }}
                    >
                      <Edit3 size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(staff)} style={{ padding: 8 }}>
                      <Trash2 size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                </Animated.View>
              );
            })
          ) : !isLoading && !error && (
            <Animated.View
              entering={FadeInDown.delay(100).duration(300)}
              style={{ alignItems: 'center', paddingVertical: 60 }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <User size={36} color={colors.textTertiary} />
              </View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>
                {filterStoreId && staffMembers.length > 0
                  ? t('noStaffForStore', language) || 'No Staff at This Store'
                  : t('noStaffMembers', language)}
              </Text>
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: 14,
                  textAlign: 'center',
                  maxWidth: 260,
                }}
              >
                {filterStoreId && staffMembers.length > 0
                  ? (t('noStaffForStoreDescription', language) || 'No staff members are assigned to {storeName}. Assign staff to this store or select a different filter.').replace('{storeName}', filterStoreName)
                  : t('addStaffMembersDescription', language)}
              </Text>
              {filterStoreId && staffMembers.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setFilterStoreId(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    marginTop: 20,
                    backgroundColor: colors.card,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <StoreIcon size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 8 }}>
                    {t('showAllStaff', language) || 'Show All Staff'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={openAddModal}
                  style={{
                    marginTop: 20,
                    backgroundColor: primaryColor,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Plus size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
                    {t('addStaff', language)}
                  </Text>
                </Pressable>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add/Edit Staff Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Pressable
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} color={colors.text} />
              </Pressable>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                {editingStaff ? t('editStaff', language) : t('addStaff', language)}
              </Text>
              <Pressable
                onPress={handleSave}
                hitSlop={8}
                disabled={createStaffMutation.isPending || updateStaffMutation.isPending || isUploadingPhoto}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: createStaffMutation.isPending || updateStaffMutation.isPending || isUploadingPhoto ? 0.5 : 1,
                }}
              >
                {createStaffMutation.isPending || updateStaffMutation.isPending || isUploadingPhoto ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Check size={24} color={primaryColor} />
                )}
              </Pressable>
            </View>
          </SafeAreaView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* PHOTO UPLOAD SECTION - AT THE TOP */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              {/* Large Circular Avatar - Tap to Upload */}
              <Pressable
                onPress={() => {
                  console.log('[StaffManagementScreen] Avatar tapped - opening picker');
                  handlePickPhoto();
                }}
                disabled={isUploadingPhoto}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: photoUri || existingAvatarUrl
                    ? 'transparent'
                    : `${primaryColor}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderWidth: 3,
                  borderColor: primaryColor,
                }}
              >
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: 120, height: 120, borderRadius: 60 }}
                  />
                ) : existingAvatarUrl ? (
                  <Image
                    source={{ uri: existingAvatarUrl }}
                    style={{ width: 120, height: 120, borderRadius: 60 }}
                  />
                ) : (
                  // Show initials or camera icon
                  staffName.trim() ? (
                    <Text style={{ fontSize: 48, fontWeight: '700', color: '#FFFFFF' }}>
                      {staffName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  ) : (
                    <Camera size={40} color="#FFFFFF" />
                  )
                )}
              </Pressable>

              {/* Upload/Change/Remove buttons */}
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
                <Pressable
                  onPress={() => {
                    console.log('[StaffManagementScreen] Upload button tapped');
                    handlePickPhoto();
                  }}
                  disabled={isUploadingPhoto}
                  style={{
                    backgroundColor: primaryColor,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    opacity: isUploadingPhoto ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                    {photoUri || existingAvatarUrl ? 'Change' : 'Add Photo'}
                  </Text>
                </Pressable>

                {(photoUri || existingAvatarUrl) && (
                  <Pressable
                    onPress={handleRemovePhoto}
                    disabled={isUploadingPhoto}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: '#EF4444',
                      opacity: isUploadingPhoto ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14 }}>
                      Remove
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Upload Progress */}
              {isUploadingPhoto && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  <ActivityIndicator size="small" color={primaryColor} />
                  <Text style={{ color: colors.textSecondary, marginLeft: 8, fontSize: 13 }}>
                    {photoUploadProgress || 'Processing...'}
                  </Text>
                </View>
              )}
            </View>

            {/* Staff Name Input */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: colors.textSecondary,
                  marginBottom: 8,
                }}
              >
                {t('nameLabel', language)} *
              </Text>
              <TextInput
                value={staffName}
                onChangeText={setStaffName}
                placeholder={t('staffNamePlaceholder', language) || 'Enter staff name'}
                placeholderTextColor={colors.textTertiary}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: colors.text,
                }}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            {/* Email Field */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: colors.textSecondary,
                  marginBottom: 8,
                }}
              >
                {t('staffEmailFieldLabel', language) || 'Email'}
              </Text>
              <TextInput
                value={staffEmail}
                onChangeText={(text) => {
                  setStaffEmail(text);
                  if (emailError) setEmailError('');
                }}
                placeholder="name@email.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: emailError ? '#EF4444' : colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: colors.text,
                }}
              />
              {emailError ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: '#EF4444',
                    marginTop: 6,
                    marginLeft: 4,
                    lineHeight: 18,
                  }}
                >
                  {emailError}
                </Text>
              ) : (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginTop: 6,
                    marginLeft: 4,
                    lineHeight: 18,
                  }}
                >
                  {t('staffEmailHelperText', language) || 'This email is used to send staff schedules.'}
                </Text>
              )}
            </View>

            {/* Store Assignment */}
            {stores.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  {t('assignToStore', language) || 'Assign to Store'}
                </Text>
                <Pressable
                  onPress={() => setShowStorePicker(true)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <StoreIcon size={18} color={selectedStoreId ? primaryColor : colors.textTertiary} />
                    <Text
                      style={{
                        fontSize: 16,
                        color: selectedStoreId ? colors.text : colors.textTertiary,
                        marginLeft: 10,
                      }}
                    >
                      {selectedStoreName}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={colors.textTertiary} />
                </Pressable>
              </View>
            )}

            {/* Services Assignment (Skills) */}
            {services.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  {t('servicesTitle', language) || 'Services'}
                </Text>
                <Pressable
                  onPress={() => setShowServicesPicker(true)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Sparkles size={18} color={selectedServiceIds.length > 0 ? primaryColor : colors.textTertiary} />
                    <Text
                      style={{
                        fontSize: 16,
                        color: selectedServiceIds.length > 0 ? colors.text : colors.textTertiary,
                        marginLeft: 10,
                      }}
                    >
                      {selectedServicesText}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={colors.textTertiary} />
                </Pressable>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textTertiary,
                    marginTop: 6,
                    marginLeft: 4,
                  }}
                >
                  Select services this staff member can perform
                </Text>
              </View>
            )}

            {/* Preview */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginTop: 24,
              }}
            >
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: 12,
                  fontWeight: '500',
                  marginBottom: 12,
                }}
              >
                {(t('preview', language) || 'Preview').toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: `${primaryColor}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 18 }}>
                    {getStaffInitials(staffName)}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                    {staffName || 'Staff Name'}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                    {t('staffMember', language)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Save Button */}
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
            <View style={{ padding: 16 }}>
              <Pressable
                onPress={handleSave}
                disabled={createStaffMutation.isPending || updateStaffMutation.isPending || isUploadingPhoto}
                style={{
                  backgroundColor: primaryColor,
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: createStaffMutation.isPending || updateStaffMutation.isPending || isUploadingPhoto ? 0.7 : 1,
                }}
              >
                {createStaffMutation.isPending || updateStaffMutation.isPending || isUploadingPhoto ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator color="#FFFFFF" />
                    {isUploadingPhoto && (
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                        {photoUploadProgress || 'Uploading...'}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                    {editingStaff ? t('saveChanges', language) : t('createStaffBtn', language)}
                  </Text>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Store Picker Modal */}
      <Modal
        visible={showStorePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStorePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Pressable
                onPress={() => setShowStorePicker(false)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} color={colors.text} />
              </Pressable>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                {t('selectStore', language) || 'Select Store'}
              </Text>
              <View style={{ width: 36 }} />
            </View>
          </SafeAreaView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* No Store Option */}
            <Pressable
              onPress={() => {
                setSelectedStoreId(null);
                setShowStorePicker(false);
              }}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: selectedStoreId === null ? 2 : 1,
                borderColor: selectedStoreId === null ? primaryColor : colors.border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.backgroundSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <StoreIcon size={20} color={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                  {t('noStoreAssigned', language) || 'No Store Assigned'}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                  {t('allStores', language) || 'All Stores'}
                </Text>
              </View>
              {selectedStoreId === null && (
                <Check size={20} color={primaryColor} />
              )}
            </Pressable>

            {/* Store Options */}
            {stores.map((store) => {
              const isSelected = selectedStoreId === store.id;
              const storeName = getLocalizedStoreName(store.name, language);

              return (
                <Pressable
                  key={store.id}
                  onPress={() => {
                    setSelectedStoreId(store.id);
                    setShowStorePicker(false);
                  }}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? primaryColor : colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: `${primaryColor}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <StoreIcon size={20} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                      {storeName}
                    </Text>
                  </View>
                  {isSelected && (
                    <Check size={20} color={primaryColor} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Services Picker Modal (Multi-select) */}
      <Modal
        visible={showServicesPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowServicesPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Pressable
                onPress={() => setShowServicesPicker(false)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={24} color={colors.text} />
              </Pressable>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                {t('servicesTitle', language) || 'Services'}
              </Text>
              <Pressable
                onPress={() => setShowServicesPicker(false)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={24} color={primaryColor} />
              </Pressable>
            </View>
          </SafeAreaView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Clear All / Select All Options */}
            <View style={{ flexDirection: 'row', marginBottom: 16, gap: 12 }}>
              <Pressable
                onPress={() => setSelectedServiceIds([])}
                style={{
                  flex: 1,
                  backgroundColor: selectedServiceIds.length === 0 ? `${primaryColor}20` : colors.card,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: selectedServiceIds.length === 0 ? primaryColor : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: selectedServiceIds.length === 0 ? primaryColor : colors.text,
                  }}
                >
                  All Services
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedServiceIds(services.map(s => s.id))}
                style={{
                  flex: 1,
                  backgroundColor: selectedServiceIds.length === services.length ? `${primaryColor}20` : colors.card,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: selectedServiceIds.length === services.length ? primaryColor : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: selectedServiceIds.length === services.length ? primaryColor : colors.text,
                  }}
                >
                  Select All
                </Text>
              </Pressable>
            </View>

            {/* Service Options */}
            {services.map((service) => {
              const isSelected = selectedServiceIds.includes(service.id);

              return (
                <Pressable
                  key={service.id}
                  onPress={() => {
                    if (isSelected) {
                      setSelectedServiceIds(selectedServiceIds.filter(id => id !== service.id));
                    } else {
                      setSelectedServiceIds([...selectedServiceIds, service.id]);
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    backgroundColor: isSelected ? `${primaryColor}15` : colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? primaryColor : colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: `${primaryColor}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Sparkles size={20} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                      {service.name}
                    </Text>
                    {service.duration_minutes && (
                      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                        {service.duration_minutes} {t('minutesUnit', language) || 'min'}
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <Check size={20} color={primaryColor} />
                  )}
                </Pressable>
              );
            })}

            {services.length === 0 && !showAddServiceForm && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Sparkles size={40} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, marginTop: 12, textAlign: 'center' }}>
                  No services available
                </Text>
              </View>
            )}

            {/* Inline Add Service Form */}
            {showAddServiceForm ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 8,
                  borderWidth: 2,
                  borderColor: primaryColor,
                  borderStyle: 'dashed',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: `${primaryColor}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}
                  >
                    <Plus size={18} color={primaryColor} />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 }}>
                    New Service
                  </Text>
                  <Pressable
                    onPress={resetAddServiceForm}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <X size={20} color={colors.textTertiary} />
                  </Pressable>
                </View>

                {/* Service Name */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
                    Service Name *
                  </Text>
                  <TextInput
                    value={newServiceName}
                    onChangeText={setNewServiceName}
                    placeholder="e.g. Haircut, Massage, Consultation"
                    placeholderTextColor={colors.textTertiary}
                    style={{
                      backgroundColor: isDark ? colors.backgroundSecondary : '#F8FAFC',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 15,
                      color: colors.text,
                    }}
                    autoCapitalize="words"
                    autoFocus
                  />
                </View>

                {/* Duration & Price Row */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                  {/* Duration */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
                      Duration
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Clock size={16} color={colors.textTertiary} style={{ position: 'absolute', left: 12, zIndex: 1 }} />
                      <TextInput
                        value={newServiceDuration}
                        onChangeText={setNewServiceDuration}
                        placeholder="60"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        style={{
                          flex: 1,
                          backgroundColor: isDark ? colors.backgroundSecondary : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingLeft: 36,
                          paddingRight: 40,
                          paddingVertical: 12,
                          fontSize: 15,
                          color: colors.text,
                        }}
                      />
                      <Text style={{ position: 'absolute', right: 12, color: colors.textTertiary, fontSize: 13 }}>
                        min
                      </Text>
                    </View>
                  </View>

                  {/* Price */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
                      Price (optional)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <DollarSign size={16} color={colors.textTertiary} style={{ position: 'absolute', left: 12, zIndex: 1 }} />
                      <TextInput
                        value={newServicePrice}
                        onChangeText={setNewServicePrice}
                        placeholder="0.00"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        style={{
                          flex: 1,
                          backgroundColor: isDark ? colors.backgroundSecondary : '#F8FAFC',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingLeft: 36,
                          paddingRight: 14,
                          paddingVertical: 12,
                          fontSize: 15,
                          color: colors.text,
                        }}
                      />
                    </View>
                  </View>
                </View>

                {/* Create Button */}
                <Pressable
                  onPress={handleCreateService}
                  disabled={createServiceMutation.isPending || !newServiceName.trim()}
                  style={{
                    backgroundColor: !newServiceName.trim() ? colors.border : primaryColor,
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    opacity: createServiceMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {createServiceMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Plus size={18} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15, marginLeft: 6 }}>
                        Create Service
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              /* + Add Service Button */
              <Pressable
                onPress={() => {
                  setShowAddServiceForm(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}08`,
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: `${primaryColor}30`,
                  borderStyle: 'dashed',
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: primaryColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <Plus size={16} color="#FFFFFF" />
                </View>
                <Text style={{ color: primaryColor, fontSize: 15, fontWeight: '600' }}>
                  Add New Service
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Modal>
  );
}
