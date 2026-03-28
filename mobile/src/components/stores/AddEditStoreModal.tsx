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
  Plus,
  Edit3,
  Trash2,
  Store as StoreIcon,
  Camera,
  Calendar,
  Clock,
  CalendarOff,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO } from 'date-fns';
import { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t, getLocalizedStoreName, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { mapStorePhotoError } from './storesManagementUtils';
import { SpecialHoursModal, formatTimeForDisplay } from './SpecialHoursModal';
import {
  useStoreOverrides,
  useUpsertStoreOverride,
  useDeleteStoreOverride,
  type StoreHoursOverride,
} from '@/hooks/useStores';
import { useBusiness } from '@/hooks/useBusiness';
import { validatePhoto as validateStorePhoto, uploadStorePhoto, removeStorePhoto } from '@/services/storePhotoService';
import { useCreateStore, useUpdateStore } from '@/hooks/useStores';

export interface AddEditStoreModalProps {
  visible: boolean;
  editingStore: {
    id: string;
    name: string;
    photo_url?: string | null;
    photo_thumb_url?: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddEditStoreModal({
  visible,
  editingStore,
  onClose,
  onSaved,
}: AddEditStoreModalProps) {
  const [storeName, setStoreName] = useState('');
  const [storePhotoUri, setStorePhotoUri] = useState<string | null>(null);
  const [existingStorePhotoUrl, setExistingStorePhotoUrl] = useState<string | null>(null);
  const [existingStoreThumbUrl, setExistingStoreThumbUrl] = useState<string | null>(null);
  const [isUploadingStorePhoto, setIsUploadingStorePhoto] = useState(false);
  const [storePhotoUploadError, setStorePhotoUploadError] = useState<string | null>(null);

  // Special Hours state
  const [showSpecialHoursModal, setShowSpecialHoursModal] = useState(false);
  const [editingSpecialHoursOverride, setEditingSpecialHoursOverride] = useState<StoreHoursOverride | null>(null);
  const [dateFnsLocale, setDateFnsLocale] = useState<Locale | undefined>(undefined);

  const { colors, isDark, primaryColor } = useTheme();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;
  const { businessId } = useBusiness();

  const createStoreMutation = useCreateStore();
  const updateStoreMutation = useUpdateStore();
  const { data: storeOverrides = [], refetch: refetchOverrides } = useStoreOverrides(editingStore?.id ?? null);
  const upsertOverrideMutation = useUpsertStoreOverride();
  const deleteOverrideMutation = useDeleteStoreOverride();

  // Load date-fns locale
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateFnsLocale(cached);
    getDateFnsLocale(language).then(setDateFnsLocale);
  }, [language]);

  // Populate form when modal opens or editingStore changes
  useEffect(() => {
    if (visible) {
      if (editingStore) {
        setStoreName(editingStore.name);
        setExistingStorePhotoUrl(editingStore.photo_url ?? null);
        setExistingStoreThumbUrl(editingStore.photo_thumb_url ?? null);
      } else {
        setStoreName('');
        setExistingStorePhotoUrl(null);
        setExistingStoreThumbUrl(null);
      }
      setStorePhotoUri(null);
      setIsUploadingStorePhoto(false);
      setStorePhotoUploadError(null);
    }
  }, [visible, editingStore]);

  const handleClose = () => {
    onClose();
  };

  // Special Hours helpers
  const openAddSpecialHoursModal = () => {
    setEditingSpecialHoursOverride(null);
    setShowSpecialHoursModal(true);
  };

  const openEditSpecialHoursModal = (override: StoreHoursOverride) => {
    setEditingSpecialHoursOverride(override);
    setShowSpecialHoursModal(true);
  };

  const handleDeleteSpecialHours = (override: StoreHoursOverride) => {
    Alert.alert(
      'Delete Special Hours',
      'Are you sure you want to delete this special hours entry?',
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOverrideMutation.mutateAsync({
                overrideId: override.id,
                storeId: override.store_id,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              refetchOverrides();
            } catch (err) {
              console.log('[AddEditStoreModal] Error deleting special hours:', err);
              Alert.alert(t('error', language) || 'Error', 'Failed to delete special hours');
            }
          },
        },
      ]
    );
  };

  // Store photo picker function
  const handlePickStorePhoto = async () => {
    console.log('[AddEditStoreModal] handlePickStorePhoto called - opening image picker...');
    setStorePhotoUploadError(null);
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

      console.log('[AddEditStoreModal] Launching image picker for store photo...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        console.log('[AddEditStoreModal] Image picker cancelled');
        return;
      }

      const selectedUri = result.assets[0].uri;
      console.log('[AddEditStoreModal] Store image selected:', selectedUri);

      // Validate before accepting
      const validation = await validateStorePhoto(selectedUri);
      if (!validation.valid) {
        setStorePhotoUploadError(mapStorePhotoError(validation.error, language));
        return;
      }

      console.log('[AddEditStoreModal] Store photo validated, setting preview');
      setStorePhotoUri(selectedUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.log('[AddEditStoreModal] Store photo picker error:', err);
      setStorePhotoUploadError(t('storePhotoUploadGenericError', language));
    }
  };

  // Remove store photo function
  const handleRemoveStorePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this store photo?',
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            console.log('[AddEditStoreModal] Removing store photo');
            setStorePhotoUri(null);
            setExistingStorePhotoUrl(null);
            setExistingStoreThumbUrl(null);
            setStorePhotoUploadError(null);
          },
        },
      ]
    );
  };

  const handleSaveStore = async () => {
    if (!storeName.trim()) {
      Alert.alert(t('error', language), t('storeNameRequired', language) || 'Store name is required');
      return;
    }

    if (!businessId) {
      Alert.alert(t('error', language) || 'Error', 'Business not initialized');
      return;
    }

    try {
      // Prepare photo URLs
      let photoUrl: string | null | undefined = undefined;
      let photoThumbUrl: string | null | undefined = undefined;

      if (editingStore) {
        // Handle photo upload for existing store
        if (storePhotoUri) {
          console.log('[AddEditStoreModal] Starting photo upload for existing store:', editingStore.id);
          setIsUploadingStorePhoto(true);

          const uploadResult = await uploadStorePhoto(
            businessId,
            editingStore.id,
            storePhotoUri,
            existingStorePhotoUrl,
            existingStoreThumbUrl
          );

          setIsUploadingStorePhoto(false);

          if (!uploadResult.success) {
            setIsUploadingStorePhoto(false);
            setStorePhotoUploadError(mapStorePhotoError(uploadResult.error, language));
            return;
          }

          console.log('[AddEditStoreModal] Store photo uploaded successfully:', uploadResult);
          photoUrl = uploadResult.photoUrl;
          photoThumbUrl = uploadResult.photoThumbUrl;
        } else if (existingStorePhotoUrl === null && editingStore.photo_url) {
          // Photo was explicitly removed
          console.log('[AddEditStoreModal] Store photo was removed, clearing URLs');
          photoUrl = null;
          photoThumbUrl = null;
          // Clean up old files
          await removeStorePhoto(editingStore.photo_url, editingStore.photo_thumb_url);
        }

        console.log('[AddEditStoreModal] Updating store:', editingStore.id, storeName);
        const updates: {
          name: string;
          photo_url?: string | null;
          photo_thumb_url?: string | null;
        } = {
          name: storeName.trim(),
        };

        // Only include photo fields if they changed
        if (photoUrl !== undefined) {
          updates.photo_url = photoUrl;
          updates.photo_thumb_url = photoThumbUrl ?? null;
        }

        await updateStoreMutation.mutateAsync({
          storeId: editingStore.id,
          updates,
        });
      } else {
        // Create new store first, then upload photo if provided
        console.log('[AddEditStoreModal] Creating store:', storeName);
        const newStore = await createStoreMutation.mutateAsync({
          name: storeName.trim(),
        });

        // If photo was selected, upload it now
        if (storePhotoUri && newStore?.id) {
          console.log('[AddEditStoreModal] Starting photo upload for new store:', newStore.id);
          setIsUploadingStorePhoto(true);

          const uploadResult = await uploadStorePhoto(
            businessId,
            newStore.id,
            storePhotoUri,
            null,
            null
          );

          setIsUploadingStorePhoto(false);

          if (uploadResult.success) {
            console.log('[AddEditStoreModal] Store photo uploaded, updating store with URLs');
            await updateStoreMutation.mutateAsync({
              storeId: newStore.id,
              updates: {
                photo_url: uploadResult.photoUrl,
                photo_thumb_url: uploadResult.photoThumbUrl,
              },
            });
          } else {
            console.log('[AddEditStoreModal] Store photo upload failed:', uploadResult.error);
            setStorePhotoUploadError(mapStorePhotoError(uploadResult.error, language));
            // Store was created successfully, photo upload failed — do not block save
          }
        }
      }

      showSaveConfirmation();
      onSaved();
      handleClose();
    } catch (err) {
      setIsUploadingStorePhoto(false);
      console.log('[AddEditStoreModal] Error saving store:', err);
      const errorMessage = err instanceof Error ? err.message : t('failedToSaveStore', language) || 'Failed to save store';
      Alert.alert(t('error', language), errorMessage);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
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
          <Pressable onPress={handleClose}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel', language)}</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
            {editingStore ? (t('editStore', language) || 'Edit Store') : (t('addStore', language) || 'Add Store')}
          </Text>
          <Pressable
            onPress={handleSaveStore}
            disabled={createStoreMutation.isPending || updateStoreMutation.isPending}
            style={{ opacity: (createStoreMutation.isPending || updateStoreMutation.isPending) ? 0.5 : 1 }}
          >
            <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{t('save', language)}</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* Store Photo Upload Section */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: colors.textTertiary,
                fontSize: 12,
                fontWeight: '500',
                marginBottom: 12,
                textTransform: 'uppercase',
                alignSelf: 'flex-start',
              }}
            >
              STORE PHOTO
            </Text>

            {/* Photo Preview / Upload Area */}
            <Pressable
              onPress={handlePickStorePhoto}
              disabled={isUploadingStorePhoto}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: `${primaryColor}30`,
                borderStyle: 'dashed',
              }}
            >
              {storePhotoUri ? (
                <Image
                  source={{ uri: storePhotoUri }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                />
              ) : existingStorePhotoUrl ? (
                <Image
                  source={{ uri: existingStorePhotoUrl }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Camera size={28} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontSize: 11, marginTop: 4 }}>
                    {t('add', language)}
                  </Text>
                </View>
              )}
              {isUploadingStorePhoto && (
                <View
                  style={{
                    position: 'absolute',
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </Pressable>

            {/* Photo Action Buttons */}
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
              <Pressable
                onPress={handlePickStorePhoto}
                disabled={isUploadingStorePhoto}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: `${primaryColor}15`,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600' }}>
                  {(storePhotoUri || existingStorePhotoUrl) ? t('edit', language) : t('add', language)}
                </Text>
              </Pressable>
              {(storePhotoUri || existingStorePhotoUrl) && (
                <Pressable
                  onPress={handleRemoveStorePhoto}
                  disabled={isUploadingStorePhoto}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: '#FEE2E2',
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>
                    {t('delete', language)}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Store Photo Upload Error */}
          {storePhotoUploadError && (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                borderWidth: 1,
                borderColor: '#FECACA',
              }}
            >
              <AlertCircle size={16} color="#EF4444" style={{ marginTop: 1 }} />
              <Text style={{ color: '#EF4444', fontSize: 13, flex: 1, lineHeight: 18 }}>
                {storePhotoUploadError}
              </Text>
            </View>
          )}

          {/* Store Name Input */}
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
              {t('storeNameLabel', language) || 'STORE NAME'} *
            </Text>
            <TextInput
              value={storeName}
              onChangeText={setStoreName}
              placeholder={t('storeNamePlaceholder', language) || 'e.g., Downtown Location'}
              placeholderTextColor={colors.textTertiary}
              autoFocus={!storePhotoUri && !existingStorePhotoUrl}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </View>

          {/* Preview */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
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
              {t('preview', language)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Store Photo Preview (left of name) */}
              {(storePhotoUri || existingStorePhotoUrl) ? (
                <Image
                  source={{ uri: storePhotoUri || existingStorePhotoUrl || '' }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    marginRight: 14,
                  }}
                />
              ) : (
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
                  <StoreIcon size={22} color={primaryColor} />
                </View>
              )}
              <View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                  {storeName || (t('storeNamePlaceholder', language) || 'Store Name')}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                  0 {t('staffMembers', language) || 'staff members'}
                </Text>
              </View>
            </View>
          </View>

          {/* ============ SPECIAL HOURS SECTION (Only show when editing) ============ */}
          {editingStore && (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginTop: 16,
              }}
            >
              {/* Section Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <CalendarOff size={18} color={primaryColor} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                    Special Hours (Date Exceptions)
                  </Text>
                </View>
                <Pressable
                  onPress={openAddSpecialHoursModal}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: `${primaryColor}15`,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                  }}
                >
                  <Plus size={14} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                    Add
                  </Text>
                </Pressable>
              </View>

              <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 12 }}>
                Set date-specific hours or closures (holidays, special events, etc.)
              </Text>

              {/* List of existing overrides */}
              {storeOverrides.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {storeOverrides.map((override) => {
                    const startDate = dateFnsLocale
                      ? format(parseISO(override.start_date), 'MMM d', { locale: dateFnsLocale })
                      : format(parseISO(override.start_date), 'MMM d');
                    const endDate = dateFnsLocale
                      ? format(parseISO(override.end_date), 'MMM d, yyyy', { locale: dateFnsLocale })
                      : format(parseISO(override.end_date), 'MMM d, yyyy');
                    const isSameDay = override.start_date === override.end_date;
                    const dateRange = isSameDay ? endDate : `${startDate} - ${endDate}`;

                    return (
                      <View
                        key={override.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: override.is_closed ? '#FEE2E2' : `${primaryColor}20`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                          }}
                        >
                          {override.is_closed ? (
                            <CalendarOff size={16} color="#EF4444" />
                          ) : (
                            <Clock size={16} color={primaryColor} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                            {dateRange}
                          </Text>
                          <Text style={{ color: override.is_closed ? '#EF4444' : colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                            {override.is_closed
                              ? 'Closed'
                              : `${formatTimeForDisplay(override.open_time || '09:00')} - ${formatTimeForDisplay(override.close_time || '17:00')}`}
                          </Text>
                          {override.note && (
                            <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>
                              {override.note}
                            </Text>
                          )}
                        </View>
                        <Pressable
                          onPress={() => openEditSpecialHoursModal(override)}
                          style={{ padding: 6 }}
                        >
                          <Edit3 size={16} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteSpecialHours(override)}
                          style={{ padding: 6 }}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
                    borderRadius: 12,
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  <Calendar size={24} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                    No special hours set
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <SpecialHoursModal
        visible={showSpecialHoursModal}
        editingOverride={editingSpecialHoursOverride}
        editingStoreId={editingStore?.id ?? null}
        businessId={businessId ?? null}
        upsertOverrideMutation={upsertOverrideMutation}
        onClose={() => setShowSpecialHoursModal(false)}
        onSaved={() => refetchOverrides()}
      />
    </Modal>
  );
}
