import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  User,
  Camera,
  Check,
  Plus,
  Sparkles,
  Clock,
  DollarSign,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { useStores } from '@/hooks/useStores';
import { useStaffMembers, useCreateStaffMember, useUpdateStaffMember } from '@/hooks/useStaff';
import { useServices, useCreateService } from '@/hooks/useServices';
import { useBusiness } from '@/hooks/useBusiness';
import { validatePhoto, uploadStaffPhoto, removeStaffPhoto } from '@/services/staffPhotoService';
import { STAFF_COLORS, getStaffInitials } from './teamServicesUtils';

export interface AddEditStaffModalEditingStaff {
  id: string;
  full_name: string;
  email?: string | null;
  color: string;
  store_ids: string[];
  service_ids?: string[];
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
}

export interface AddEditStaffModalProps {
  visible: boolean;
  editingStaff: AddEditStaffModalEditingStaff | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddEditStaffModal({
  visible,
  editingStaff,
  onClose,
  onSaved,
}: AddEditStaffModalProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;

  // Data hooks
  const { data: supabaseStores = [] } = useStores();
  const stores = supabaseStores.map((s) => ({ id: s.id, name: s.name }));
  const { data: allServices = [] } = useServices();
  const services = React.useMemo(() => {
    return allServices.filter((s) => {
      const svcType = (s as unknown as { service_type?: string }).service_type;
      return svcType !== 'product';
    });
  }, [allServices]);
  const { data: staffMembers = [] } = useStaffMembers();
  const { businessId } = useBusiness();

  // Mutations
  const createStaffMutation = useCreateStaffMember();
  const updateStaffMutation = useUpdateStaffMember();
  const createServiceMutation = useCreateService();

  // Staff form state
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffEmailError, setStaffEmailError] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Inline Add Service state
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('60');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceColor, setNewServiceColor] = useState(STAFF_COLORS[0]);

  // Photo upload state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null);
  const [existingThumbUrl, setExistingThumbUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState('');

  // Populate form when modal opens
  useEffect(() => {
    if (!visible) return;
    if (editingStaff) {
      setStaffName(editingStaff.full_name);
      setStaffEmail(editingStaff.email || '');
      setStaffEmailError('');
      setSelectedStoreIds(editingStaff.store_ids || []);
      setSelectedServiceIds(editingStaff.service_ids || []);
      setExistingAvatarUrl(editingStaff.avatar_url || null);
      setExistingThumbUrl(editingStaff.avatar_thumb_url || null);
      setPhotoUri(null);
    } else {
      // Add mode — reset and auto-select single store
      setStaffName('');
      setStaffEmail('');
      setStaffEmailError('');
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
    // Reset add service form whenever modal opens
    setShowAddServiceForm(false);
    setNewServiceName('');
    setNewServiceDuration('60');
    setNewServicePrice('');
    setNewServiceColor(STAFF_COLORS[0]);
  }, [visible]);

  const resetAddServiceForm = () => {
    setNewServiceName('');
    setNewServiceDuration('60');
    setNewServicePrice('');
    setNewServiceColor(STAFF_COLORS[0]);
    setShowAddServiceForm(false);
  };

  const handleCreateService = async () => {
    const trimmedName = newServiceName.trim();
    if (!trimmedName) {
      Alert.alert(
        t('error', language) || 'Error',
        'Please enter a service name'
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

      // Auto-select the newly created service
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

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  // Photo picker function
  const handlePickPhoto = async () => {
    console.log('[AddEditStaffModal] Opening image picker...');
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

      // Validate before accepting
      const validation = await validatePhoto(selectedUri);
      if (!validation.valid) {
        Alert.alert(
          t('error', language) || 'Error',
          validation.error || 'Invalid photo'
        );
        return;
      }

      console.log('[AddEditStaffModal] Photo validated, setting preview');
      setPhotoUri(selectedUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.log('[AddEditStaffModal] Photo picker error:', err);
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
            console.log('[AddEditStaffModal] Removing photo');
            setPhotoUri(null);
            setExistingAvatarUrl(null);
            setExistingThumbUrl(null);
          },
        },
      ]
    );
  };

  const handleSaveStaff = async () => {
    if (!staffName.trim()) {
      Alert.alert(t('error', language), t('staffNameRequired', language));
      return;
    }

    // Validate email if provided
    if (staffEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail.trim())) {
      setStaffEmailError(t('invalidEmail', language) || 'Invalid email address');
      return;
    }
    setStaffEmailError('');

    if (selectedStoreIds.length === 0) {
      Alert.alert(t('error', language), t('selectAtLeastOneStore', language));
      return;
    }

    // Check if business context is ready
    if (!businessId) {
      console.log('[AddEditStaffModal] Cannot save staff - no businessId');
      Alert.alert(t('error', language), t('failedToSaveStaff', language));
      return;
    }

    try {
      // Prepare photo URLs
      let photoUrl: string | null | undefined = undefined;
      let avatarUrl: string | null | undefined = undefined;
      let avatarThumbUrl: string | null | undefined = undefined;

      if (editingStaff) {
        // Handle photo upload for existing staff
        if (photoUri) {
          console.log('[AddEditStaffModal] Starting photo upload for existing staff:', editingStaff.id);
          setIsUploadingPhoto(true);
          setPhotoUploadProgress('Uploading...');

          const uploadResult = await uploadStaffPhoto(
            businessId,
            editingStaff.id,
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
        } else if (existingAvatarUrl === null && staffMembers.find(s => s.id === editingStaff.id)?.avatar_url) {
          // Photo was explicitly removed
          console.log('[AddEditStaffModal] Photo was removed, clearing URLs');
          const originalStaff = staffMembers.find(s => s.id === editingStaff.id);
          photoUrl = null;
          avatarUrl = null;
          avatarThumbUrl = null;
          // Clean up old files
          await removeStaffPhoto(originalStaff?.avatar_url, originalStaff?.avatar_thumb_url);
        }

        // Build updates object
        const updates: {
          full_name: string;
          color: string;
          store_ids: string[];
          service_ids: string[];
          email?: string;
          photo_url?: string | null;
          avatar_url?: string | null;
          avatar_thumb_url?: string | null;
        } = {
          full_name: staffName.trim(),
          color: primaryColor,
          store_ids: selectedStoreIds,
          service_ids: selectedServiceIds,
          email: staffEmail.trim() || undefined,
        };

        // Only include photo fields if they changed
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
        // Create new staff first, then upload photo
        console.log('[AddEditStaffModal] Creating staff member with businessId:', businessId);
        const newStaff = await createStaffMutation.mutateAsync({
          full_name: staffName.trim(),
          email: staffEmail.trim() || undefined,
          color: primaryColor,
          store_ids: selectedStoreIds,
          service_ids: selectedServiceIds,
        });

        // If photo was selected, upload it now
        if (photoUri && newStaff?.id) {
          console.log('[AddEditStaffModal] Starting photo upload for new staff:', newStaff.id);
          setIsUploadingPhoto(true);
          setPhotoUploadProgress('Uploading photo...');

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
            // Staff was created, just log the error
          }
        }
      }

      // Close modal first
      onClose();
      // Then show success feedback
      showSaveConfirmation();
      onSaved();
    } catch (err) {
      setIsUploadingPhoto(false);
      setPhotoUploadProgress('');
      console.log('[AddEditStaffModal] Error saving staff:', err);
      Alert.alert(t('error', language), t('failedToSaveStaff', language));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
                <User size={18} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                {editingStaff ? t('editStaff', language) : t('addStaff', language)}
              </Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
        </SafeAreaView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* ========== PHOTO UPLOAD SECTION - AT THE TOP ========== */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
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
                // Show initials or camera icon
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
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
              <Pressable
                onPress={() => {
                  console.log('[AddEditStaffModal] Add Photo button tapped');
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
          {/* ========== END PHOTO UPLOAD SECTION ========== */}

          {/* Name */}
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 }}>{t('fullNameLabel', language)}</Text>
          <TextInput
            value={staffName}
            onChangeText={setStaffName}
            placeholder={t('fullNamePlaceholder', language)}
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
              marginBottom: 20,
            }}
            autoFocus
          />

          {/* Email (optional) */}
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 }}>
            {t('staffEmailFieldLabel', language) || 'Email'}
          </Text>
          <TextInput
            value={staffEmail}
            onChangeText={(text) => {
              setStaffEmail(text);
              if (staffEmailError) setStaffEmailError('');
            }}
            placeholder="name@domain.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: colors.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: staffEmailError ? '#EF4444' : colors.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: colors.text,
              marginBottom: staffEmailError ? 4 : 4,
            }}
          />
          {staffEmailError ? (
            <Text style={{ fontSize: 12, color: '#EF4444', marginBottom: 16, marginLeft: 4 }}>{staffEmailError}</Text>
          ) : (
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 20, marginLeft: 4 }}>
              {t('staffEmailHelperText', language) || 'Used to send this staff member their schedule (optional).'}
            </Text>
          )}

          {/* Stores */}
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 12 }}>{t('storesLabel', language)}</Text>
          <View style={{ gap: 8 }}>
            {stores.map((store) => {
              const isSelected = selectedStoreIds.includes(store.id);
              return (
                <Pressable
                  key={store.id}
                  onPress={() => toggleStoreSelection(store.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderRadius: 10,
                    backgroundColor: isSelected ? `${primaryColor}15` : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? primaryColor : colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: isSelected ? primaryColor : colors.border,
                      backgroundColor: isSelected ? primaryColor : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {isSelected && <Check size={14} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{getLocalizedStoreName(store.name, language)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ========== SERVICES SECTION ========== */}
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginTop: 24, marginBottom: 8 }}>
            {t('servicesLabel', language) || 'Services'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 12 }}>
            Select services this staff member can perform
          </Text>

          {/* Services multi-select chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
                  }}
                >
                  {isSelected && <Check size={14} color="#fff" style={{ marginRight: 6 }} />}
                  <Text style={{ color: isSelected ? '#fff' : colors.text, fontSize: 14, fontWeight: '500' }}>
                    {service.name}
                  </Text>
                </Pressable>
              );
            })}

            {/* + Add Service Button */}
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
                }}
              >
                <Plus size={14} color={primaryColor} style={{ marginRight: 4 }} />
                <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>
                  Add Service
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
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 8, flex: 1 }}>
                  New Service
                </Text>
                <Pressable onPress={resetAddServiceForm} hitSlop={8} style={{ padding: 4 }}>
                  <X size={18} color={colors.textTertiary} />
                </Pressable>
              </View>

              {/* Service Name */}
              <TextInput
                value={newServiceName}
                onChangeText={setNewServiceName}
                placeholder="Service name"
                placeholderTextColor={colors.textTertiary}
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
                  <Text style={{ position: 'absolute', right: 10, color: colors.textTertiary, fontSize: 12 }}>min</Text>
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
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginRight: 8 }}>Color:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {STAFF_COLORS.map((color) => (
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
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 4 }}>
                      Create
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {services.length === 0 && !showAddServiceForm && (
            <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4 }}>
              No services yet. Tap "+ Add Service" to create one.
            </Text>
          )}
          {/* ========== END SERVICES SECTION ========== */}

        </ScrollView>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
          <View style={{ padding: 16 }}>
            <Pressable
              onPress={handleSaveStaff}
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
                  <ActivityIndicator color="#fff" />
                  {isUploadingPhoto && (
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                      {photoUploadProgress || 'Uploading...'}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                  {editingStaff ? t('saveChanges', language) : t('createStaffBtn', language)}
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
