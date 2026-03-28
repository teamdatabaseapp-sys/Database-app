import React, { useState, useEffect } from 'react';
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
  Check,
  Store as StoreIcon,
  Camera,
  Clock,
  DollarSign,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { STAFF_COLORS, getStaffInitials } from './storesManagementUtils';
import { useStaffMembers, useCreateStaffMember, useUpdateStaffMember } from '@/hooks/useStaff';
import { useServices, useCreateService } from '@/hooks/useServices';
import { useStores } from '@/hooks/useStores';
import { useBusiness } from '@/hooks/useBusiness';
import { validatePhoto, uploadStaffPhoto, removeStaffPhoto } from '@/services/staffPhotoService';

export interface AddEditStaffModalProps {
  visible: boolean;
  editingStaff: {
    id: string;
    name: string;
    storeIds?: string[];
    storeId?: string;
    serviceIds?: string[];
    avatar_url?: string | null;
    avatar_thumb_url?: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddEditStaffModal({ visible, editingStaff, onClose, onSaved }: AddEditStaffModalProps) {
  const [staffName, setStaffName] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Photo state
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
  const [newServiceColor, setNewServiceColor] = useState(STAFF_COLORS[0]);

  const { colors, isDark, primaryColor } = useTheme();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;

  const { businessId } = useBusiness();
  const { data: supabaseStores = [] } = useStores();
  const { data: supabaseStaff = [] } = useStaffMembers();
  const createStaffMutation = useCreateStaffMember();
  const updateStaffMutation = useUpdateStaffMember();
  const { data: services = [] } = useServices();
  const createServiceMutation = useCreateService();

  // Convert stores to usable format
  const stores = supabaseStores.map((s, index) => ({
    id: s.id,
    name: s.name,
    sort_order: s.sort_order ?? index + 1,
    is_primary: s.is_primary ?? false,
    photo_url: s.photo_url ?? null,
    photo_thumb_url: s.photo_thumb_url ?? null,
  }));

  // Populate form when modal opens
  useEffect(() => {
    if (visible) {
      if (editingStaff) {
        setStaffName(editingStaff.name);
        const storeIds = editingStaff.storeIds && editingStaff.storeIds.length > 0
          ? editingStaff.storeIds
          : (editingStaff.storeId ? [editingStaff.storeId] : []);
        setSelectedStoreIds(storeIds);
        setSelectedServiceIds(editingStaff.serviceIds || []);
        setExistingAvatarUrl(editingStaff.avatar_url || null);
        setExistingThumbUrl(editingStaff.avatar_thumb_url || null);
        setPhotoUri(null);
      } else {
        // Adding new staff
        setStaffName('');
        setSelectedStoreIds(stores.length === 1 ? [stores[0].id] : []);
        setSelectedServiceIds([]);
        setPhotoUri(null);
        setExistingAvatarUrl(null);
        setExistingThumbUrl(null);
        setIsUploadingPhoto(false);
        setPhotoUploadProgress('');
        setShowAddServiceForm(false);
        setNewServiceName('');
        setNewServiceDuration('60');
        setNewServicePrice('');
        setNewServiceColor(STAFF_COLORS[0]);
      }
    }
  }, [visible, editingStaff]);

  const resetForm = () => {
    setStaffName('');
    setSelectedStoreIds([]);
    setSelectedServiceIds([]);
    setPhotoUri(null);
    setExistingAvatarUrl(null);
    setExistingThumbUrl(null);
    setIsUploadingPhoto(false);
    setPhotoUploadProgress('');
    setShowAddServiceForm(false);
    setNewServiceName('');
    setNewServiceDuration('60');
    setNewServicePrice('');
    setNewServiceColor(STAFF_COLORS[0]);
  };

  const resetAddServiceForm = () => {
    setNewServiceName('');
    setNewServiceDuration('60');
    setNewServicePrice('');
    setNewServiceColor(STAFF_COLORS[0]);
    setShowAddServiceForm(false);
  };

  const toggleStoreSelection = (storeId: string) => {
    console.log('[AddEditStaffModal] Toggle store selection:', storeId);
    setSelectedStoreIds((prev) => {
      const newIds = prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId];
      console.log('[AddEditStaffModal] New selectedStoreIds:', newIds);
      return newIds;
    });
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handlePickPhoto = async () => {
    console.log('[AddEditStaffModal] handlePickPhoto called - opening image picker...');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      console.log('[AddEditStaffModal] Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        console.log('[AddEditStaffModal] Image picker cancelled');
        return;
      }

      const selectedUri = result.assets[0].uri;
      console.log('[AddEditStaffModal] Image selected:', selectedUri);

      const validation = await validatePhoto(selectedUri);
      if (!validation.valid) {
        Alert.alert(t('error', language) || 'Error', validation.error || 'Invalid photo');
        return;
      }

      console.log('[AddEditStaffModal] Photo validated, setting preview');
      setPhotoUri(selectedUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.log('[AddEditStaffModal] Photo picker error:', err);
      Alert.alert(t('error', language) || 'Error', 'Failed to select photo');
    }
  };

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
            console.log('[AddEditStaffModal] Removing photo');
            setPhotoUri(null);
            setExistingAvatarUrl(null);
            setExistingThumbUrl(null);
          },
        },
      ]
    );
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
        color: newServiceColor,
        duration_minutes: durationMinutes,
        price_cents: priceCents,
        currency_code: 'USD',
        service_type: 'service',
      });

      if (newService?.id) {
        setSelectedServiceIds((prev) => [...prev, newService.id]);
      }

      showSaveConfirmation();
      resetAddServiceForm();
    } catch (err) {
      console.log('[AddEditStaffModal] Error creating service:', err);
      Alert.alert(
        t('error', language) || 'Error',
        err instanceof Error ? err.message : 'Failed to create service'
      );
    }
  };

  const handleSaveStaff = async () => {
    console.log('[AddEditStaffModal] handleSaveStaff called');
    console.log('[AddEditStaffModal] staffName:', staffName);
    console.log('[AddEditStaffModal] selectedStoreIds:', selectedStoreIds);
    console.log('[AddEditStaffModal] selectedServiceIds:', selectedServiceIds);
    console.log('[AddEditStaffModal] photoUri:', photoUri);
    console.log('[AddEditStaffModal] existingAvatarUrl:', existingAvatarUrl);

    if (!staffName.trim()) {
      Alert.alert(t('error', language), t('staffNameRequired', language) || 'Staff name is required');
      return;
    }

    if (selectedStoreIds.length === 0) {
      console.log('[AddEditStaffModal] ERROR: No store selected');
      Alert.alert(t('error', language), t('selectAtLeastOneStore', language) || 'Please select at least one store');
      return;
    }

    if (!businessId) {
      Alert.alert(t('error', language) || 'Error', 'Business not initialized');
      return;
    }

    try {
      let photoUrl: string | null | undefined = undefined;
      let avatarUrl: string | null | undefined = undefined;
      let avatarThumbUrl: string | null | undefined = undefined;

      if (editingStaff) {
        const editingStaffId = editingStaff.id;

        if (photoUri) {
          console.log('[AddEditStaffModal] Starting photo upload for existing staff:', editingStaffId);
          setIsUploadingPhoto(true);
          setPhotoUploadProgress('Uploading...');

          const uploadResult = await uploadStaffPhoto(
            businessId,
            editingStaffId,
            photoUri,
            existingAvatarUrl,
            existingThumbUrl
          );

          setIsUploadingPhoto(false);
          setPhotoUploadProgress('');

          if (!uploadResult.success) {
            Alert.alert(t('error', language) || 'Error', uploadResult.error || 'Failed to upload photo');
            return;
          }

          console.log('[AddEditStaffModal] Photo uploaded successfully:', uploadResult);
          photoUrl = uploadResult.photoUrl;
          avatarUrl = uploadResult.avatarUrl;
          avatarThumbUrl = uploadResult.avatarThumbUrl;
        } else if (existingAvatarUrl === null && supabaseStaff.find(s => s.id === editingStaffId)?.avatar_url) {
          console.log('[AddEditStaffModal] Photo was removed, clearing URLs');
          const originalStaff = supabaseStaff.find(s => s.id === editingStaffId);
          photoUrl = null;
          avatarUrl = null;
          avatarThumbUrl = null;
          await removeStaffPhoto(originalStaff?.avatar_url, originalStaff?.avatar_thumb_url);
        }

        console.log('[AddEditStaffModal] Updating staff:', editingStaffId);
        const updates: {
          full_name: string;
          color: string;
          store_ids: string[];
          service_ids: string[];
          photo_url?: string | null;
          avatar_url?: string | null;
          avatar_thumb_url?: string | null;
        } = {
          full_name: staffName.trim(),
          color: primaryColor,
          store_ids: selectedStoreIds,
          service_ids: selectedServiceIds,
        };

        if (photoUrl !== undefined) {
          updates.photo_url = photoUrl;
          updates.avatar_url = avatarUrl ?? null;
          updates.avatar_thumb_url = avatarThumbUrl ?? null;
        }

        await updateStaffMutation.mutateAsync({
          staffId: editingStaffId,
          updates,
        });
      } else {
        console.log('[AddEditStaffModal] Creating staff with storeIds:', selectedStoreIds, 'serviceIds:', selectedServiceIds);
        const newStaff = await createStaffMutation.mutateAsync({
          full_name: staffName.trim(),
          color: primaryColor,
          store_ids: selectedStoreIds,
          service_ids: selectedServiceIds,
        });

        if (photoUri && newStaff?.id) {
          console.log('[AddEditStaffModal] Starting photo upload for new staff:', newStaff.id);
          setIsUploadingPhoto(true);
          setPhotoUploadProgress('Uploading...');

          const uploadResult = await uploadStaffPhoto(
            businessId,
            newStaff.id,
            photoUri,
            null,
            null
          );

          setIsUploadingPhoto(false);
          setPhotoUploadProgress('');

          if (uploadResult.success) {
            console.log('[AddEditStaffModal] Photo uploaded, updating staff with URLs');
            await updateStaffMutation.mutateAsync({
              staffId: newStaff.id,
              updates: {
                photo_url: uploadResult.photoUrl,
                avatar_url: uploadResult.avatarUrl,
                avatar_thumb_url: uploadResult.avatarThumbUrl,
              },
            });
          } else {
            console.log('[AddEditStaffModal] Photo upload failed:', uploadResult.error);
          }
        }
      }

      showSaveConfirmation();
      onSaved();
      resetForm();
    } catch (err) {
      setIsUploadingPhoto(false);
      setPhotoUploadProgress('');
      console.log('[AddEditStaffModal] Error saving staff:', err);
      const errorMessage = err instanceof Error ? err.message : t('failedToSaveStaff', language) || 'Failed to save staff member';
      Alert.alert(t('error', language), errorMessage);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        onClose();
        resetForm();
      }}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}
        edges={['top']}
      >
        <View
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
          <Pressable
            onPress={() => {
              onClose();
              resetForm();
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel', language)}</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
            {editingStaff ? (t('editStaff', language) || 'Edit Staff') : (t('addStaff', language) || 'Add Staff')}
          </Text>
          <Pressable
            onPress={handleSaveStaff}
            disabled={createStaffMutation.isPending || updateStaffMutation.isPending}
            style={{ opacity: (createStaffMutation.isPending || updateStaffMutation.isPending) ? 0.5 : 1 }}
          >
            {(createStaffMutation.isPending || updateStaffMutation.isPending) ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{t('save', language)}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* ========== PHOTO UPLOAD SECTION - AT THE TOP ========== */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            {/* Large Circular Avatar - Tap to Upload */}
            <Pressable
              onPress={() => {
                console.log('[AddEditStaffModal] Avatar tapped - opening picker');
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
                staffName.trim() ? (
                  <Text style={{ fontSize: 48, fontWeight: '700', color: '#FFFFFF' }}>
                    {getStaffInitials(staffName)}
                  </Text>
                ) : (
                  <Camera size={40} color="#FFFFFF" />
                )
              )}
            </Pressable>

            {/* Upload/Change/Remove buttons */}
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
              <Pressable
                onPress={() => {
                  console.log('[AddEditStaffModal] Add Photo button tapped');
                  handlePickPhoto();
                }}
                disabled={isUploadingPhoto}
                style={{
                  backgroundColor: primaryColor,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
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
                    paddingHorizontal: 20,
                    paddingVertical: 10,
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
          {/* ========== END PHOTO UPLOAD SECTION ========== */}

          {/* Store Selection - Multi-select */}
          {stores.length > 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: 12,
                  fontWeight: '500',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                }}
              >
                {t('assignToStore', language) || 'ASSIGN TO STORE'} *
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {stores.map((store) => {
                  const isSelected = selectedStoreIds.includes(store.id);
                  return (
                    <Pressable
                      key={store.id}
                      onPress={() => toggleStoreSelection(store.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 20,
                        backgroundColor: isSelected ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                        marginRight: 8,
                        marginBottom: 8,
                      }}
                    >
                      {isSelected && (
                        <Check size={14} color="#fff" style={{ marginRight: 6 }} />
                      )}
                      <Text
                        style={{
                          color: isSelected ? '#fff' : colors.text,
                          fontSize: 14,
                          fontWeight: '500',
                        }}
                      >
                        {getLocalizedStoreName(store.name, language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedStoreIds.length === 0 && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>
                  Please select at least one store
                </Text>
              )}
              {selectedStoreIds.length > 1 && (
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }}>
                  {t('staffAssignedToMultipleStores', language) || 'This staff member will work at multiple stores'}
                </Text>
              )}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <StoreIcon size={18} color="#D97706" />
              <Text style={{ color: '#92400E', fontSize: 13, marginLeft: 10, flex: 1 }}>
                {t('createStoreFirst', language) || 'Please create a store first before adding staff members.'}
              </Text>
            </View>
          )}

          {/* Name Input */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 12,
                fontWeight: '500',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              {t('nameLabel', language) || 'NAME'} *
            </Text>
            <TextInput
              value={staffName}
              onChangeText={setStaffName}
              placeholder={t('staffNamePlaceholder', language) || 'Enter staff member name'}
              placeholderTextColor={colors.textTertiary}
              autoFocus={stores.length > 0}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </View>

          {/* Services (Skills) Selection */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginTop: 16,
            }}
          >
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 12,
                fontWeight: '500',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              {t('servicesSkillsLabel', language)}
            </Text>
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 13,
                marginBottom: 12,
                lineHeight: 18,
              }}
              numberOfLines={2}
            >
              {t('servicesSkillsHelper', language)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {services.map((service) => {
                const isSelected = selectedServiceIds.includes(service.id);
                return (
                  <Pressable
                    key={service.id}
                    onPress={() => toggleServiceSelection(service.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: isSelected ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    {isSelected && (
                      <Check size={14} color="#fff" style={{ marginRight: 6 }} />
                    )}
                    <Text
                      style={{
                        color: isSelected ? '#fff' : colors.text,
                        fontSize: 14,
                        fontWeight: '500',
                      }}
                    >
                      {service.name}
                    </Text>
                  </Pressable>
                );
              })}

              {/* + Add Service Button (chip style) */}
              {!showAddServiceForm && (
                <Pressable
                  onPress={() => {
                    setShowAddServiceForm(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: `${primaryColor}15`,
                    borderWidth: 1,
                    borderColor: `${primaryColor}40`,
                    borderStyle: 'dashed',
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Plus size={14} color={primaryColor} style={{ marginRight: 4 }} />
                  <Text
                    style={{
                      color: primaryColor,
                      fontSize: 14,
                      fontWeight: '500',
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {t('addService', language)}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Inline Add Service Form */}
            {showAddServiceForm && (
              <View
                style={{
                  marginTop: 12,
                  padding: 14,
                  backgroundColor: isDark ? colors.backgroundSecondary : '#F8FAFC',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: primaryColor,
                  borderStyle: 'dashed',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Sparkles size={16} color={primaryColor} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 8, flex: 1 }} numberOfLines={1}>
                    {t('newServiceTitle', language)}
                  </Text>
                  <Pressable onPress={resetAddServiceForm} hitSlop={8} style={{ padding: 4 }}>
                    <X size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>

                {/* Service Name */}
                <TextInput
                  value={newServiceName}
                  onChangeText={setNewServiceName}
                  placeholder={t('serviceNameInputPlaceholder', language)}
                  placeholderTextColor={colors.textTertiary}
                  selectionColor={primaryColor}
                  cursorColor={primaryColor}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: colors.text,
                    marginBottom: 10,
                  }}
                  autoCapitalize="words"
                />

                {/* Duration & Price Row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={14} color={colors.textTertiary} style={{ position: 'absolute', left: 10, zIndex: 1 }} />
                    <TextInput
                      value={newServiceDuration}
                      onChangeText={setNewServiceDuration}
                      placeholder="60"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingLeft: 32,
                        paddingRight: 36,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: colors.text,
                      }}
                    />
                    <Text style={{ position: 'absolute', right: 10, color: colors.textTertiary, fontSize: 12 }}>{t('minuteShort', language)}</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <DollarSign size={14} color={colors.textTertiary} style={{ position: 'absolute', left: 10, zIndex: 1 }} />
                    <TextInput
                      value={newServicePrice}
                      onChangeText={setNewServicePrice}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingLeft: 32,
                        paddingRight: 12,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: colors.text,
                      }}
                    />
                  </View>
                </View>

                {/* Color picker (compact) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginRight: 8 }}>{t('color', language)}:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {STAFF_COLORS.slice(0, 10).map((color) => (
                      <Pressable
                        key={color}
                        onPress={() => setNewServiceColor(color)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: color,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: newServiceColor === color ? 2 : 0,
                          borderColor: isDark ? '#fff' : '#000',
                        }}
                      >
                        {newServiceColor === color && <Check size={12} color="#fff" />}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Create Button */}
                <Pressable
                  onPress={handleCreateService}
                  disabled={createServiceMutation.isPending || !newServiceName.trim()}
                  style={{
                    backgroundColor: !newServiceName.trim() ? colors.border : primaryColor,
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    opacity: createServiceMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {createServiceMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Plus size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 4 }} numberOfLines={1}>
                        {t('createServiceBtn', language)}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* Preview */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginTop: 16,
            }}
          >
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 12,
                fontWeight: '500',
                marginBottom: 12,
                textTransform: 'uppercase',
              }}
            >
              {t('preview', language) || 'PREVIEW'}
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
                  {staffName || (t('staffNamePlaceholder', language) || 'Staff Name')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: primaryColor,
                      marginRight: 6,
                    }}
                  />
                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                    {t('staffMember', language) || 'Staff Member'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
