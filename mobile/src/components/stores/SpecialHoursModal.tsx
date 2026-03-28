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
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, CalendarOff } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, Locale } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t, getDateFnsLocale, getCachedDateFnsLocale, getLocaleForLanguage } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import {
  useUpsertStoreOverride,
  type StoreHoursOverride,
} from '@/hooks/useStores';

export interface SpecialHoursModalProps {
  visible: boolean;
  editingOverride: StoreHoursOverride | null;
  editingStoreId: string | null;
  businessId: string | null;
  upsertOverrideMutation: ReturnType<typeof useUpsertStoreOverride>;
  onClose: () => void;
  onSaved: () => void;
}

// Format time for display (HH:MM -> 9:00 AM format)
export const formatTimeForDisplay = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Convert time string to Date for picker
const timeStringToDate = (timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Convert Date from picker to time string
const dateToTimeString = (date: Date): string => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export function SpecialHoursModal({
  visible,
  editingOverride,
  editingStoreId,
  businessId,
  upsertOverrideMutation,
  onClose,
  onSaved,
}: SpecialHoursModalProps) {
  const [overrideStartDate, setOverrideStartDate] = useState(new Date());
  const [overrideEndDate, setOverrideEndDate] = useState(new Date());
  const [overrideIsClosed, setOverrideIsClosed] = useState(false);
  const [overrideOpenTime, setOverrideOpenTime] = useState('09:00');
  const [overrideCloseTime, setOverrideCloseTime] = useState('17:00');
  const [overrideNote, setOverrideNote] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showOpenTimePicker, setShowOpenTimePicker] = useState(false);
  const [showCloseTimePicker, setShowCloseTimePicker] = useState(false);
  const [dateFnsLocale, setDateFnsLocale] = useState<Locale | undefined>(undefined);

  const { colors, isDark, primaryColor } = useTheme();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;

  const nativeLocale = getLocaleForLanguage(language);

  // Load date-fns locale
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateFnsLocale(cached);
    getDateFnsLocale(language).then(setDateFnsLocale);
  }, [language]);

  // Populate form when editingOverride changes (or reset when null)
  useEffect(() => {
    if (visible) {
      if (editingOverride) {
        setOverrideStartDate(parseISO(editingOverride.start_date));
        setOverrideEndDate(parseISO(editingOverride.end_date));
        setOverrideIsClosed(editingOverride.is_closed);
        setOverrideOpenTime(editingOverride.open_time || '09:00');
        setOverrideCloseTime(editingOverride.close_time || '17:00');
        setOverrideNote(editingOverride.note || '');
      } else {
        setOverrideStartDate(new Date());
        setOverrideEndDate(new Date());
        setOverrideIsClosed(false);
        setOverrideOpenTime('09:00');
        setOverrideCloseTime('17:00');
        setOverrideNote('');
      }
      setShowStartDatePicker(false);
      setShowEndDatePicker(false);
      setShowOpenTimePicker(false);
      setShowCloseTimePicker(false);
    }
  }, [visible, editingOverride]);

  const handleClose = () => {
    onClose();
  };

  const handleSaveSpecialHours = async () => {
    if (!editingStoreId || !businessId) {
      Alert.alert(t('error', language) || 'Error', 'Store not selected');
      return;
    }

    // Validate dates
    if (overrideEndDate < overrideStartDate) {
      Alert.alert(t('error', language) || 'Error', 'End date must be on or after start date');
      return;
    }

    // Validate times: close time must be after open time (unless closed)
    if (!overrideIsClosed) {
      const [openH, openM] = overrideOpenTime.split(':').map(Number);
      const [closeH, closeM] = overrideCloseTime.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (closeMinutes <= openMinutes) {
        Alert.alert(t('error', language) || 'Error', 'Close time must be after open time');
        return;
      }
    }

    try {
      await upsertOverrideMutation.mutateAsync({
        id: editingOverride?.id || undefined,
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
      onClose();
      onSaved();
    } catch (err) {
      console.log('[SpecialHoursModal] Error saving special hours:', err);
      Alert.alert(t('error', language) || 'Error', 'Failed to save special hours');
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
        {/* Header */}
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
            {editingOverride ? 'Edit Special Hours' : 'Add Special Hours'}
          </Text>
          <Pressable
            onPress={handleSaveSpecialHours}
            disabled={upsertOverrideMutation.isPending}
            style={{ opacity: upsertOverrideMutation.isPending ? 0.5 : 1 }}
          >
            {upsertOverrideMutation.isPending ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>{t('save', language)}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* Start Date */}
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
              START DATE
            </Text>
            <Pressable
              onPress={() => setShowStartDatePicker(!showStartDatePicker)}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Calendar size={18} color={primaryColor} />
                <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                  {dateFnsLocale
                    ? format(overrideStartDate, 'PPP', { locale: dateFnsLocale })
                    : format(overrideStartDate, 'MMMM d, yyyy')}
                </Text>
              </View>
              <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>{t('edit', language)}</Text>
            </Pressable>

            {showStartDatePicker && (
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
                <View style={{ backgroundColor: primaryColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                  <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Select Date</Text>
                </View>
                <DateTimePicker
                  value={overrideStartDate}
                  mode="date"
                  display="spinner"
                  themeVariant={isDark ? 'dark' : 'light'}
                  onChange={(event, date) => {
                    if (Platform.OS === 'android') setShowStartDatePicker(false);
                    if (date) {
                      setOverrideStartDate(date);
                      // Auto-update end date if it's before start date
                      if (overrideEndDate < date) {
                        setOverrideEndDate(date);
                      }
                    }
                  }}
                  locale={nativeLocale}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => setShowStartDatePicker(false)}
                    style={{ marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: primaryColor, borderRadius: 8 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* End Date */}
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
              END DATE
            </Text>
            <Pressable
              onPress={() => setShowEndDatePicker(!showEndDatePicker)}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Calendar size={18} color={primaryColor} />
                <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                  {dateFnsLocale
                    ? format(overrideEndDate, 'PPP', { locale: dateFnsLocale })
                    : format(overrideEndDate, 'MMMM d, yyyy')}
                </Text>
              </View>
              <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>{t('edit', language)}</Text>
            </Pressable>

            {showEndDatePicker && (
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
                <View style={{ backgroundColor: primaryColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                  <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Select Date</Text>
                </View>
                <DateTimePicker
                  value={overrideEndDate}
                  mode="date"
                  display="spinner"
                  themeVariant={isDark ? 'dark' : 'light'}
                  minimumDate={overrideStartDate}
                  onChange={(event, date) => {
                    if (Platform.OS === 'android') setShowEndDatePicker(false);
                    if (date) setOverrideEndDate(date);
                  }}
                  locale={nativeLocale}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => setShowEndDatePicker(false)}
                    style={{ marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: primaryColor, borderRadius: 8 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Closed Toggle */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <CalendarOff size={20} color={overrideIsClosed ? '#EF4444' : colors.textSecondary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                  Closed
                </Text>
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
                  OPEN TIME
                </Text>
                <Pressable
                  onPress={() => setShowOpenTimePicker(!showOpenTimePicker)}
                  style={{
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
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

                {showOpenTimePicker && (
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
                    <View style={{ backgroundColor: primaryColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                      <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Select Time</Text>
                    </View>
                    <DateTimePicker
                      value={timeStringToDate(overrideOpenTime)}
                      mode="time"
                      display="spinner"
                      themeVariant={isDark ? 'dark' : 'light'}
                      onChange={(event, date) => {
                        if (Platform.OS === 'android') setShowOpenTimePicker(false);
                        if (date) setOverrideOpenTime(dateToTimeString(date));
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <Pressable
                        onPress={() => setShowOpenTimePicker(false)}
                        style={{ marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: primaryColor, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>

              {/* Close Time */}
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
                  CLOSE TIME
                </Text>
                <Pressable
                  onPress={() => setShowCloseTimePicker(!showCloseTimePicker)}
                  style={{
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
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

                {showCloseTimePicker && (
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
                    <View style={{ backgroundColor: primaryColor, paddingVertical: 8, paddingHorizontal: 16 }}>
                      <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Select Time</Text>
                    </View>
                    <DateTimePicker
                      value={timeStringToDate(overrideCloseTime)}
                      mode="time"
                      display="spinner"
                      themeVariant={isDark ? 'dark' : 'light'}
                      onChange={(event, date) => {
                        if (Platform.OS === 'android') setShowCloseTimePicker(false);
                        if (date) setOverrideCloseTime(dateToTimeString(date));
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <Pressable
                        onPress={() => setShowCloseTimePicker(false)}
                        style={{ marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: primaryColor, borderRadius: 8 }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

          {/* Note (Optional) */}
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
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              NOTE (OPTIONAL)
            </Text>
            <TextInput
              value={overrideNote}
              onChangeText={setOverrideNote}
              placeholder="e.g., Holiday closure, Special event hours"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={2}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                color: colors.text,
                fontSize: 16,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
