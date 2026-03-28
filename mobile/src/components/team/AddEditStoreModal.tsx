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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Edit3,
  Trash2,
  Store as StoreIcon,
  Camera,
  MapPin,
  Phone,
  Clock,
  ChevronDown,
  CalendarOff,
  Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';

import {
  useCreateStore,
  useUpdateStore,
  useStoreOverrides,
  useUpsertStoreOverride,
  useDeleteStoreOverride,
  type StoreHoursOverride,
} from '@/hooks/useStores';
import { useBusiness } from '@/hooks/useBusiness';
import type { StoreHoursDay } from '@/services/storesService';

import {
  uploadStorePhoto,
  removeStorePhoto,
  validatePhoto as validateStorePhoto,
} from '@/services/storePhotoService';
import {
  DAY_KEYS,
  getDefaultStoreHours,
  parseTimeToDate,
  formatDateToTime,
  formatTimeForDisplay,
  formatPhoneNumber,
  formatPhoneAsTyped,
  formatBlackoutDate,
} from './teamServicesUtils';

export interface AddEditStoreModalEditingStore {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  hours?: StoreHoursDay[] | null;
  blackout_dates?: string[] | null;
  photo_url?: string | null;
  photo_thumb_url?: string | null;
}

export interface AddEditStoreModalProps {
  visible: boolean;
  editingStore: AddEditStoreModalEditingStore | null;
  onClose: () => void;
  onSaved: () => void;
  storesCount: number;
}

export function AddEditStoreModal({
  visible,
  editingStore,
  onClose,
  onSaved,
  storesCount,
}: AddEditStoreModalProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;
  const { businessId } = useBusiness();

  // Store form state
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeHours, setStoreHours] = useState<StoreHoursDay[]>(getDefaultStoreHours());
  const [storeBlackoutDates, setStoreBlackoutDates] = useState<string[]>([]);

  // Store photo state
  const [storePhotoUri, setStorePhotoUri] = useState<string | null>(null);
  const [existingStorePhotoUrl, setExistingStorePhotoUrl] = useState<string | null>(null);
  const [existingStoreThumbUrl, setExistingStoreThumbUrl] = useState<string | null>(null);
  const [isUploadingStorePhoto, setIsUploadingStorePhoto] = useState(false);

  // Time picker modal state (iOS-style wheel picker)
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [editingStoreDay, setEditingStoreDay] = useState<number | null>(null);
  const [editingStoreTimeField, setEditingStoreTimeField] = useState<'open' | 'close' | null>(null);
  const [tempPickerTime, setTempPickerTime] = useState<Date>(new Date());

  // Blackout date picker state
  const [showBlackoutDatePicker, setShowBlackoutDatePicker] = useState(false);
  const [tempBlackoutDate, setTempBlackoutDate] = useState<Date>(new Date());

  // Special Hours state
  const [showSpecialHoursModal, setShowSpecialHoursModal] = useState(false);
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);
  const [overrideStartDate, setOverrideStartDate] = useState(new Date());
  const [overrideEndDate, setOverrideEndDate] = useState(new Date());
  const [overrideIsClosed, setOverrideIsClosed] = useState(false);
  const [overrideOpenTime, setOverrideOpenTime] = useState('09:00');
  const [overrideCloseTime, setOverrideCloseTime] = useState('17:00');
  const [overrideNote, setOverrideNote] = useState('');
  const [showOverrideStartDatePicker, setShowOverrideStartDatePicker] = useState(false);
  const [showOverrideEndDatePicker, setShowOverrideEndDatePicker] = useState(false);
  const [showOverrideOpenTimePicker, setShowOverrideOpenTimePicker] = useState(false);
  const [showOverrideCloseTimePicker, setShowOverrideCloseTimePicker] = useState(false);

  // Mutations
  const createStoreMutation = useCreateStore();
  const updateStoreMutation = useUpdateStore();

  // Store overrides — parametrized by the current editing store id
  const editingStoreId = editingStore?.id ?? null;
  const { data: storeOverrides = [], refetch: refetchOverrides } = useStoreOverrides(editingStoreId);
  const upsertOverrideMutation = useUpsertStoreOverride();
  const deleteOverrideMutation = useDeleteStoreOverride();

  // Populate form when modal opens
  useEffect(() => {
    if (!visible) return;

    if (editingStore) {
      setStoreName(editingStore.name);
      setStoreAddress(editingStore.address || '');
      setStorePhone(editingStore.phone ? formatPhoneNumber(editingStore.phone) : '');
      if (editingStore.hours && editingStore.hours.length > 0) {
        const loadedHours = getDefaultStoreHours().map((day) => {
          const existing = editingStore.hours?.find((h) => h.day_of_week === day.day_of_week);
          return existing || day;
        });
        setStoreHours(loadedHours);
      } else {
        setStoreHours(getDefaultStoreHours());
      }
      setStoreBlackoutDates(editingStore.blackout_dates || []);
      setExistingStorePhotoUrl(editingStore.photo_url || null);
      setExistingStoreThumbUrl(editingStore.photo_thumb_url || null);
      setStorePhotoUri(null);
    } else {
      setStoreName('');
      setStoreAddress('');
      setStorePhone('');
      setStoreHours(getDefaultStoreHours());
      setStoreBlackoutDates([]);
      setStorePhotoUri(null);
      setExistingStorePhotoUrl(null);
      setExistingStoreThumbUrl(null);
    }
    setShowTimePickerModal(false);
    setEditingStoreDay(null);
    setEditingStoreTimeField(null);
    setShowBlackoutDatePicker(false);
  }, [visible, editingStore]);

  // ============================================
  // Store Hours Handlers
  // ============================================

  const updateStoreHoursDay = (dayOfWeek: number, updates: Partial<StoreHoursDay>) => {
    setStoreHours((prev) =>
      prev.map((day) => (day.day_of_week === dayOfWeek ? { ...day, ...updates } : day))
    );
  };

  const handleTimePickerChange = (_event: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      setTempPickerTime(selectedDate);
    }
  };

  const confirmTimeSelection = () => {
    if (editingStoreDay !== null && editingStoreTimeField) {
      const timeStr = formatDateToTime(tempPickerTime);
      updateStoreHoursDay(editingStoreDay, {
        [editingStoreTimeField === 'open' ? 'open_time' : 'close_time']: timeStr,
      });
    }
    setShowTimePickerModal(false);
    setEditingStoreDay(null);
    setEditingStoreTimeField(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const cancelTimeSelection = () => {
    setShowTimePickerModal(false);
    setEditingStoreDay(null);
    setEditingStoreTimeField(null);
  };

  const openStoreTimePicker = (dayOfWeek: number, field: 'open' | 'close') => {
    const day = storeHours.find((d) => d.day_of_week === dayOfWeek);
    if (day) {
      const currentTime = parseTimeToDate(field === 'open' ? day.open_time : day.close_time);
      setTempPickerTime(currentTime);
    }
    setEditingStoreDay(dayOfWeek);
    setEditingStoreTimeField(field);
    setShowTimePickerModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ============================================
  // Blackout Date Handlers
  // ============================================

  const openBlackoutDatePicker = () => {
    setTempBlackoutDate(new Date());
    setShowBlackoutDatePicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlackoutDateChange = (_event: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      setTempBlackoutDate(selectedDate);
    }
  };

  const confirmBlackoutDate = () => {
    const dateStr = format(tempBlackoutDate, 'yyyy-MM-dd');
    if (!storeBlackoutDates.includes(dateStr)) {
      setStoreBlackoutDates((prev) => [...prev, dateStr].sort());
    }
    setShowBlackoutDatePicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeBlackoutDate = (dateStr: string) => {
    setStoreBlackoutDates((prev) => prev.filter((d) => d !== dateStr));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const applyStoreHoursToAllDays = (sourceDayOfWeek: number) => {
    const sourceDay = storeHours.find((d) => d.day_of_week === sourceDayOfWeek);
    if (sourceDay) {
      setStoreHours((prev) =>
        prev.map((day) => ({
          ...day,
          open_time: sourceDay.open_time,
          close_time: sourceDay.close_time,
          is_closed: sourceDay.is_closed,
        }))
      );
    }
  };

  // ============================================
  // Special Hours Handlers
  // ============================================

  const resetSpecialHoursForm = () => {
    setEditingOverrideId(null);
    setOverrideStartDate(new Date());
    setOverrideEndDate(new Date());
    setOverrideIsClosed(false);
    setOverrideOpenTime('09:00');
    setOverrideCloseTime('17:00');
    setOverrideNote('');
    setShowOverrideStartDatePicker(false);
    setShowOverrideEndDatePicker(false);
    setShowOverrideOpenTimePicker(false);
    setShowOverrideCloseTimePicker(false);
  };

  const openAddSpecialHoursModal = () => {
    resetSpecialHoursForm();
    setShowSpecialHoursModal(true);
  };

  const openEditSpecialHoursModal = (override: StoreHoursOverride) => {
    setEditingOverrideId(override.id);
    setOverrideStartDate(parseISO(override.start_date));
    setOverrideEndDate(parseISO(override.end_date));
    setOverrideIsClosed(override.is_closed);
    setOverrideOpenTime(override.open_time || '09:00');
    setOverrideCloseTime(override.close_time || '17:00');
    setOverrideNote(override.note || '');
    setShowSpecialHoursModal(true);
  };

  const handleSaveSpecialHours = async () => {
    if (!editingStoreId || !businessId) {
      Alert.alert(t('error', language), 'Store not selected');
      return;
    }

    if (overrideEndDate < overrideStartDate) {
      Alert.alert(t('error', language), 'End date must be on or after start date');
      return;
    }

    if (!overrideIsClosed) {
      const [openH, openM] = overrideOpenTime.split(':').map(Number);
      const [closeH, closeM] = overrideCloseTime.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (closeMinutes <= openMinutes) {
        Alert.alert(t('error', language), 'Close time must be after open time');
        return;
      }
    }

    try {
      await upsertOverrideMutation.mutateAsync({
        id: editingOverrideId || undefined,
        business_id: businessId,
        store_id: editingStoreId,
        start_date: format(overrideStartDate, 'yyyy-MM-dd'),
        end_date: format(overrideEndDate, 'yyyy-MM-dd'),
        is_closed: overrideIsClosed,
        open_time: overrideIsClosed ? null : overrideOpenTime,
        close_time: overrideIsClosed ? null : overrideCloseTime,
        note: overrideNote.trim() || null,
      });

      showSaveConfirmation();
      setShowSpecialHoursModal(false);
      resetSpecialHoursForm();
      refetchOverrides();
    } catch (err) {
      console.log('[AddEditStoreModal] Error saving special hours:', err);
      Alert.alert(t('error', language), 'Failed to save special hours');
    }
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
              showSuccess(t('toastDeleted', language));
              refetchOverrides();
            } catch (err) {
              console.log('[AddEditStoreModal] Error deleting special hours:', err);
              Alert.alert(t('error', language), 'Failed to delete special hours');
            }
          },
        },
      ]
    );
  };

  // ============================================
  // Store Photo Handlers
  // ============================================

  const handlePickStorePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const selectedUri = result.assets[0].uri;
      const validation = await validateStorePhoto(selectedUri);
      if (!validation.valid) {
        Alert.alert(t('error', language) || 'Error', validation.error || 'Invalid photo');
        return;
      }

      setStorePhotoUri(selectedUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.log('[AddEditStoreModal] Store photo picker error:', err);
    }
  };

  const handleRemoveStorePhoto = () => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setStorePhotoUri(null);
          setExistingStorePhotoUrl(null);
          setExistingStoreThumbUrl(null);
        },
      },
    ]);
  };

  // ============================================
  // Save Store Handler
  // ============================================

  const handleSaveStore = async () => {
    if (!storeName.trim()) {
      Alert.alert(t('error', language), t('storeNameRequired', language));
      return;
    }

    // Enforce 3-store limit when creating a new store
    if (!editingStoreId && storesCount >= 3) {
      Alert.alert(
        'Store Limit Reached',
        'You can only have Main Store + 2 additional stores (max 3 total).'
      );
      return;
    }

    try {
      const rawPhone = storePhone.trim();
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const cleanPhone = phoneDigits.length === 10 ? phoneDigits : rawPhone;

      if (editingStoreId) {
        let photoUpdates: { photo_url?: string | null; photo_thumb_url?: string | null } = {};
        if (storePhotoUri && businessId) {
          setIsUploadingStorePhoto(true);
          const uploadResult = await uploadStorePhoto(
            businessId,
            editingStoreId,
            storePhotoUri,
            existingStorePhotoUrl,
            existingStoreThumbUrl
          );
          setIsUploadingStorePhoto(false);
          if (!uploadResult.success) {
            Alert.alert(t('error', language) || 'Error', uploadResult.error || 'Failed to upload photo');
            return;
          }
          photoUpdates = { photo_url: uploadResult.photoUrl, photo_thumb_url: uploadResult.photoThumbUrl };
        } else if (existingStorePhotoUrl === null) {
          // Photo was removed — clean up storage only if the original had a photo
          // (we pass in the original URLs via props but they may have changed; use best effort)
          const origPhotoUrl = editingStore?.photo_url;
          const origThumbUrl = editingStore?.photo_thumb_url;
          if (origPhotoUrl) {
            await removeStorePhoto(origPhotoUrl, origThumbUrl ?? null);
            photoUpdates = { photo_url: null, photo_thumb_url: null };
          }
        }

        await updateStoreMutation.mutateAsync({
          storeId: editingStoreId,
          updates: {
            name: storeName.trim(),
            address: storeAddress.trim() || null,
            phone: cleanPhone || null,
            hours: storeHours,
            blackout_dates: storeBlackoutDates,
            ...photoUpdates,
          },
        });
        showSaveConfirmation();
      } else {
        const newStore = await createStoreMutation.mutateAsync({
          name: storeName.trim(),
          address: storeAddress.trim() || null,
          phone: cleanPhone || null,
          hours: storeHours,
          blackout_dates: storeBlackoutDates,
        });
        if (storePhotoUri && newStore?.id && businessId) {
          setIsUploadingStorePhoto(true);
          const uploadResult = await uploadStorePhoto(businessId, newStore.id, storePhotoUri, null, null);
          setIsUploadingStorePhoto(false);
          if (uploadResult.success) {
            await updateStoreMutation.mutateAsync({
              storeId: newStore.id,
              updates: { photo_url: uploadResult.photoUrl, photo_thumb_url: uploadResult.photoThumbUrl },
            });
          }
        }
        showSaveConfirmation();
      }
      onSaved();
    } catch (err) {
      setIsUploadingStorePhoto(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('[AddEditStoreModal] Error saving store:', errorMessage, err);
      if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
        const columnMatch = errorMessage.match(/column[s]?\s+[\w.]*\.?(\w+)/i);
        const columnName = columnMatch ? columnMatch[1] : 'unknown';
        Alert.alert(
          t('error', language),
          `Database column "${columnName}" is missing. Please run the SQL migration in Supabase to add the required columns.`
        );
      } else {
        Alert.alert(t('error', language), t('failedToSaveStore', language) + '\n\n' + errorMessage);
      }
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => { onClose(); }}
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
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                {editingStoreId ? t('editStore', language) : t('addStore', language)}
              </Text>
            </View>
            <Pressable onPress={() => { onClose(); }} style={{ padding: 4 }}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Store Photo Section - FIRST */}
          <View style={{ alignItems: 'center', marginBottom: 28, paddingTop: 8 }}>
            <Pressable
              onPress={handlePickStorePhoto}
              disabled={isUploadingStorePhoto}
              style={{
                width: 100,
                height: 100,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: storePhotoUri || existingStorePhotoUrl
                  ? 'transparent'
                  : `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: storePhotoUri || existingStorePhotoUrl ? primaryColor : colors.border,
                borderStyle: storePhotoUri || existingStorePhotoUrl ? 'solid' : 'dashed',
              }}
            >
              {storePhotoUri ? (
                <Image source={{ uri: storePhotoUri }} style={{ width: 100, height: 100 }} />
              ) : existingStorePhotoUrl ? (
                <Image source={{ uri: existingStorePhotoUrl }} style={{ width: 100, height: 100 }} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Camera size={32} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontSize: 11, marginTop: 4, fontWeight: '500' }}>Add Photo</Text>
                </View>
              )}
            </Pressable>
            {isUploadingStorePhoto && (
              <ActivityIndicator size="small" color={primaryColor} style={{ marginTop: 8 }} />
            )}
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
              <Pressable
                onPress={handlePickStorePhoto}
                disabled={isUploadingStorePhoto}
                style={{
                  backgroundColor: primaryColor,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  opacity: isUploadingStorePhoto ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  {storePhotoUri || existingStorePhotoUrl ? 'Change' : 'Add Photo'}
                </Text>
              </Pressable>
              {(storePhotoUri || existingStorePhotoUrl) && (
                <Pressable
                  onPress={handleRemoveStorePhoto}
                  disabled={isUploadingStorePhoto}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#EF4444',
                    opacity: isUploadingStorePhoto ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 14 }}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Store Name */}
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 }}>
            {t('storeNameLabel', language)}
          </Text>
          <TextInput
            value={storeName}
            onChangeText={setStoreName}
            placeholder={t('enterStoreName', language)}
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
          />

          {/* Store Address */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MapPin size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginLeft: 6 }}>
              {t('businessAddressLabel', language)}
            </Text>
          </View>
          <TextInput
            value={storeAddress}
            onChangeText={setStoreAddress}
            placeholder={t('businessAddressPlaceholder', language)}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={2}
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
              minHeight: 60,
              textAlignVertical: 'top',
            }}
          />

          {/* Store Phone */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Phone size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginLeft: 6 }}>
              {t('phone', language)}
            </Text>
          </View>
          <TextInput
            value={storePhone}
            onChangeText={(text) => setStorePhone(formatPhoneAsTyped(text, storePhone))}
            placeholder={t('phonePlaceholder', language) || '(555) 123-4567'}
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            style={{
              backgroundColor: colors.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: colors.text,
              marginBottom: 24,
            }}
          />

          {/* Business Hours Section */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Clock size={16} color={primaryColor} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 6 }}>
              {t('businessHours', language) || 'Business Hours'}
            </Text>
          </View>
          <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 12 }}>
            {t('businessHoursHelper', language) || 'Set operating hours for this location'}
          </Text>

          {/* Hours List */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {storeHours.map((day, index) => (
              <View
                key={day.day_of_week}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: index < storeHours.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                  backgroundColor: day.is_closed ? (isDark ? '#1F1F1F' : '#F9FAFB') : 'transparent',
                }}
              >
                {/* Day Name — flex:2 proportional column so ALL rows break at the same X.
                    adjustsFontSizeToFit lets the text shrink (not wrap) when the
                    translated name is long. No pixel widths — works in all languages. */}
                <View style={{ flex: 2, marginRight: 6 }}>
                  <Text
                    style={{
                      color: day.is_closed ? colors.textTertiary : colors.text,
                      fontWeight: '500',
                      fontSize: 13,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {t(DAY_KEYS[day.day_of_week], language)}
                  </Text>
                </View>

                {/* Times or Closed — flex:5 proportional column; always starts at same X */}
                <View style={{ flex: 5, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
                  {day.is_closed ? (
                    <Text style={{ color: colors.textTertiary, fontSize: 13, fontStyle: 'italic' }}>
                      {t('closed', language)}
                    </Text>
                  ) : (
                    <>
                      {/* Open Time */}
                      <Pressable
                        onPress={() => openStoreTimePicker(day.day_of_week, 'open')}
                        style={{
                          backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12 }}>
                          {formatTimeForDisplay(day.open_time)}
                        </Text>
                        <ChevronDown size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                      </Pressable>

                      <Text style={{ color: colors.textTertiary, marginHorizontal: 6, fontSize: 12 }}>–</Text>

                      {/* Close Time */}
                      <Pressable
                        onPress={() => openStoreTimePicker(day.day_of_week, 'close')}
                        style={{
                          backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 12 }}>
                          {formatTimeForDisplay(day.close_time)}
                        </Text>
                        <ChevronDown size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                      </Pressable>
                    </>
                  )}
                </View>

                {/* Closed Toggle */}
                <Pressable
                  onPress={() => updateStoreHoursDay(day.day_of_week, { is_closed: !day.is_closed })}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 4,
                    backgroundColor: day.is_closed ? '#EF444420' : '#10B98120',
                  }}
                >
                  <Text
                    style={{
                      color: day.is_closed ? '#EF4444' : '#10B981',
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {day.is_closed ? t('closed', language) : t('openTime', language)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Apply to All Button */}
          <Pressable
            onPress={() => applyStoreHoursToAllDays(1)}
            style={{ marginTop: 10, paddingVertical: 8, alignItems: 'center' }}
          >
            <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '500' }}>
              {t('applyToAllDays', language) || 'Apply Monday hours to all days'}
            </Text>
          </Pressable>

          {/* ============================================ */}
          {/* SPECIAL HOURS SECTION (Date Exceptions) */}
          {/* ============================================ */}
          {editingStoreId && (
            <View style={{ marginTop: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Clock size={16} color={primaryColor} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 6 }}>
                  Special Hours
                </Text>
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 12 }}>
                Set custom hours for a specific date or date range (vacations, events, etc.)
              </Text>

              {/* Add Special Hours Button */}
              <Pressable
                onPress={openAddSpecialHoursModal}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: `${primaryColor}10`,
                  borderWidth: 1,
                  borderColor: `${primaryColor}30`,
                  borderStyle: 'dashed',
                  marginBottom: 12,
                }}
              >
                <Plus size={18} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 6 }}>
                  Add Special Hours
                </Text>
              </Pressable>

              {/* Special Hours List */}
              {storeOverrides.length > 0 && (
                <View style={{ gap: 8 }}>
                  {storeOverrides
                    .slice()
                    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                    .map((override) => {
                      const startDate = format(parseISO(override.start_date), 'MMM d');
                      const endDate = format(parseISO(override.end_date), 'MMM d, yyyy');
                      const isSameDay = override.start_date === override.end_date;
                      const dateRange = isSameDay ? endDate : `${startDate} - ${endDate}`;

                      return (
                        <View
                          key={override.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
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
                            <Text
                              style={{
                                color: override.is_closed ? '#EF4444' : colors.textTertiary,
                                fontSize: 12,
                                marginTop: 2,
                              }}
                            >
                              {override.is_closed
                                ? 'Closed'
                                : `${formatTimeForDisplay(override.open_time || '09:00')} - ${formatTimeForDisplay(override.close_time || '17:00')}`}
                            </Text>
                            {override.note && (
                              <Text
                                style={{
                                  color: colors.textTertiary,
                                  fontSize: 11,
                                  marginTop: 2,
                                  fontStyle: 'italic',
                                }}
                                numberOfLines={1}
                              >
                                {override.note}
                              </Text>
                            )}
                          </View>
                          <Pressable
                            onPress={() => openEditSpecialHoursModal(override)}
                            style={{ padding: 6 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Edit3 size={16} color={colors.textSecondary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteSpecialHours(override)}
                            style={{ padding: 6 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </Pressable>
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          )}

          {/* ============================================ */}
          {/* BLACKOUT DATES SECTION */}
          {/* ============================================ */}
          <View style={{ marginTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <CalendarOff size={16} color={primaryColor} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 6 }}>
                Blackout Dates
              </Text>
            </View>
            <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 12 }}>
              Select dates when this location is closed (holidays, vacations, etc.)
            </Text>

            {/* Add Blackout Date Button */}
            <Pressable
              onPress={openBlackoutDatePicker}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                borderRadius: 10,
                backgroundColor: `${primaryColor}10`,
                borderWidth: 1,
                borderColor: `${primaryColor}30`,
                borderStyle: 'dashed',
                marginBottom: 12,
              }}
            >
              <Plus size={18} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '500', marginLeft: 6 }}>
                Add Blackout Date
              </Text>
            </Pressable>

            {/* Blackout Dates List (Chips) */}
            {storeBlackoutDates.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {storeBlackoutDates.map((dateStr) => (
                  <View
                    key={dateStr}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>
                      {formatBlackoutDate(dateStr)}
                    </Text>
                    <Pressable
                      onPress={() => removeBlackoutDate(dateStr)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginLeft: 8 }}
                    >
                      <X size={14} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* iOS-Style Time Picker Modal */}
        <Modal
          visible={showTimePickerModal}
          transparent
          animationType="fade"
          onRequestClose={cancelTimeSelection}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={cancelTimeSelection}
          >
            <Pressable
              onPress={() => {}}
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Pressable onPress={cancelTimeSelection} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel', language)}</Text>
                </Pressable>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                  {editingStoreTimeField === 'open'
                    ? (t('openTime', language) || 'Open Time')
                    : (t('closeTime', language) || 'Close Time')}
                </Text>
                <Pressable onPress={confirmTimeSelection} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{t('done', language)}</Text>
                </Pressable>
              </View>
              {/* Picker */}
              <DateTimePicker
                value={tempPickerTime}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={handleTimePickerChange}
                themeVariant={isDark ? 'dark' : 'light'}
                style={{ height: 200 }}
              />
              <SafeAreaView edges={['bottom']} />
            </Pressable>
          </Pressable>
        </Modal>

        {/* iOS-Style Blackout Date Picker Modal */}
        <Modal
          visible={showBlackoutDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBlackoutDatePicker(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
            onPress={() => setShowBlackoutDatePicker(false)}
          >
            <Pressable
              onPress={() => {}}
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Pressable
                  onPress={() => setShowBlackoutDatePicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel', language)}</Text>
                </Pressable>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Select Date</Text>
                <Pressable
                  onPress={confirmBlackoutDate}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{t('done', language)}</Text>
                </Pressable>
              </View>
              {/* Picker */}
              <DateTimePicker
                value={tempBlackoutDate}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={handleBlackoutDateChange}
                themeVariant={isDark ? 'dark' : 'light'}
                style={{ height: 200 }}
              />
              <SafeAreaView edges={['bottom']} />
            </Pressable>
          </Pressable>
        </Modal>

        {/* ============================================ */}
        {/* SPECIAL HOURS ADD/EDIT MODAL */}
        {/* ============================================ */}
        <Modal
          visible={showSpecialHoursModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowSpecialHoursModal(false);
            resetSpecialHoursForm();
          }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {/* Header */}
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
              <Pressable onPress={() => { setShowSpecialHoursModal(false); resetSpecialHoursForm(); }}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{t('cancel', language)}</Text>
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
                {editingOverrideId ? 'Edit Special Hours' : 'Add Special Hours'}
              </Text>
              <Pressable onPress={handleSaveSpecialHours} disabled={upsertOverrideMutation.isPending}>
                {upsertOverrideMutation.isPending ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{t('done', language)}</Text>
                )}
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {/* Start Date */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>Start Date</Text>
                <Pressable
                  onPress={() => setShowOverrideStartDatePicker(!showOverrideStartDatePicker)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={18} color={primaryColor} />
                    <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                      {format(overrideStartDate, 'MMMM d, yyyy')}
                    </Text>
                  </View>
                  <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>{t('edit', language)}</Text>
                </Pressable>

                {showOverrideStartDatePicker && (
                  <View
                    style={{
                      marginTop: 12,
                      backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: primaryColor,
                    }}
                  >
                    <View style={{ backgroundColor: buttonColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                      <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>
                        {t('selectDate', language)}
                      </Text>
                    </View>
                    <DateTimePicker
                      value={overrideStartDate}
                      mode="date"
                      display="spinner"
                      themeVariant={isDark ? 'dark' : 'light'}
                      onChange={(event, date) => {
                        if (date) {
                          setOverrideStartDate(date);
                          if (overrideEndDate < date) {
                            setOverrideEndDate(date);
                          }
                        }
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        setShowOverrideStartDatePicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        marginHorizontal: 16,
                        marginBottom: 16,
                        paddingVertical: 12,
                        alignItems: 'center',
                        backgroundColor: buttonColor,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* End Date */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>End Date</Text>
                <Pressable
                  onPress={() => setShowOverrideEndDatePicker(!showOverrideEndDatePicker)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={18} color={primaryColor} />
                    <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                      {format(overrideEndDate, 'MMMM d, yyyy')}
                    </Text>
                  </View>
                  <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>{t('edit', language)}</Text>
                </Pressable>

                {showOverrideEndDatePicker && (
                  <View
                    style={{
                      marginTop: 12,
                      backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: primaryColor,
                    }}
                  >
                    <View style={{ backgroundColor: buttonColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                      <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>
                        {t('selectDate', language)}
                      </Text>
                    </View>
                    <DateTimePicker
                      value={overrideEndDate}
                      mode="date"
                      display="spinner"
                      themeVariant={isDark ? 'dark' : 'light'}
                      minimumDate={overrideStartDate}
                      onChange={(event, date) => {
                        if (date) setOverrideEndDate(date);
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        setShowOverrideEndDatePicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        marginHorizontal: 16,
                        marginBottom: 16,
                        paddingVertical: 12,
                        alignItems: 'center',
                        backgroundColor: buttonColor,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Closed Toggle */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <CalendarOff size={20} color={overrideIsClosed ? '#EF4444' : colors.textSecondary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>Closed</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                      Mark store as closed for these dates
                    </Text>
                  </View>
                </View>
                <Switch
                  value={overrideIsClosed}
                  onValueChange={(value) => {
                    setOverrideIsClosed(value);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  trackColor={{ false: isDark ? '#3E3E3E' : '#E5E5EA', true: '#EF4444' }}
                  thumbColor="#fff"
                />
              </View>

              {/* Open/Close Times (only show if not closed) */}
              {!overrideIsClosed && (
                <>
                  {/* Open Time */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>Open Time</Text>
                    <Pressable
                      onPress={() => setShowOverrideOpenTimePicker(!showOverrideOpenTimePicker)}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Clock size={18} color={primaryColor} />
                        <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                          {formatTimeForDisplay(overrideOpenTime)}
                        </Text>
                      </View>
                      <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>{t('edit', language)}</Text>
                    </Pressable>

                    {showOverrideOpenTimePicker && (
                      <View
                        style={{
                          marginTop: 12,
                          backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                          borderRadius: 12,
                          overflow: 'hidden',
                          borderWidth: 2,
                          borderColor: primaryColor,
                        }}
                      >
                        <View style={{ backgroundColor: buttonColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                          <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Select Time</Text>
                        </View>
                        <DateTimePicker
                          value={parseTimeToDate(overrideOpenTime)}
                          mode="time"
                          display="spinner"
                          themeVariant={isDark ? 'dark' : 'light'}
                          onChange={(event, date) => {
                            if (date) setOverrideOpenTime(formatDateToTime(date));
                          }}
                        />
                        <Pressable
                          onPress={() => {
                            setShowOverrideOpenTimePicker(false);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          style={{
                            marginHorizontal: 16,
                            marginBottom: 16,
                            paddingVertical: 12,
                            alignItems: 'center',
                            backgroundColor: buttonColor,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Close Time */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>Close Time</Text>
                    <Pressable
                      onPress={() => setShowOverrideCloseTimePicker(!showOverrideCloseTimePicker)}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Clock size={18} color={primaryColor} />
                        <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                          {formatTimeForDisplay(overrideCloseTime)}
                        </Text>
                      </View>
                      <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>{t('edit', language)}</Text>
                    </Pressable>

                    {showOverrideCloseTimePicker && (
                      <View
                        style={{
                          marginTop: 12,
                          backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                          borderRadius: 12,
                          overflow: 'hidden',
                          borderWidth: 2,
                          borderColor: primaryColor,
                        }}
                      >
                        <View style={{ backgroundColor: buttonColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                          <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Select Time</Text>
                        </View>
                        <DateTimePicker
                          value={parseTimeToDate(overrideCloseTime)}
                          mode="time"
                          display="spinner"
                          themeVariant={isDark ? 'dark' : 'light'}
                          onChange={(event, date) => {
                            if (date) setOverrideCloseTime(formatDateToTime(date));
                          }}
                        />
                        <Pressable
                          onPress={() => {
                            setShowOverrideCloseTimePicker(false);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          style={{
                            marginHorizontal: 16,
                            marginBottom: 16,
                            paddingVertical: 12,
                            alignItems: 'center',
                            backgroundColor: buttonColor,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Note (Optional) */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>
                    Note (Optional)
                  </Text>
                </View>
                <TextInput
                  value={overrideNote}
                  onChangeText={setOverrideNote}
                  placeholder="e.g., Holiday closure, Special event hours"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: colors.text,
                    minHeight: 60,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Save Button */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
          <View style={{ padding: 16 }}>
            <Pressable
              onPress={handleSaveStore}
              disabled={createStoreMutation.isPending || updateStoreMutation.isPending}
              style={{
                backgroundColor: primaryColor,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                opacity: createStoreMutation.isPending || updateStoreMutation.isPending ? 0.7 : 1,
              }}
            >
              {createStoreMutation.isPending || updateStoreMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                  {editingStoreId ? t('saveChanges', language) : t('createStoreBtn', language)}
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
