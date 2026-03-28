/**
 * StaffScheduleEditor Component
 *
 * A component for editing staff schedules, matching the existing Store schedule design.
 * Includes:
 * - Weekly Schedule (7 days with start/end times and off toggle)
 * - Special Days (single-date overrides)
 * - Blackout Ranges (datetime ranges to block availability)
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  Switch,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { AppText } from '@/components/AppText';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import {
  ChevronDown,
  Clock,
  Calendar,
  CalendarOff,
  Plus,
  Edit3,
  Trash2,
  X,
  CalendarRange,
} from 'lucide-react-native';
import {
  useStaffWeeklySchedule,
  useSetStaffWeeklySchedule,
  useStaffSpecialDays,
  useUpsertStaffSpecialDay,
  useDeleteStaffSpecialDay,
  useStaffBlackoutRanges,
  useCreateStaffBlackoutRange,
  useUpdateStaffBlackoutRange,
  useDeleteStaffBlackoutRange,
  type WeeklyScheduleInput,
} from '@/hooks/useStaffSchedule';
import { format } from 'date-fns';

// Day names indexed by day_of_week (0=Sunday)
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// Export types for use in parent component
export interface DayHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface SpecialDayData {
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
  note: string | null;
}

export interface BlackoutRangeData {
  start_at: string;
  end_at: string;
  note: string | null;
}

export interface StaffScheduleData {
  weeklySchedule: DayHours[];
  specialDays: SpecialDayData[];
  blackoutRanges: BlackoutRangeData[];
}

interface StaffScheduleEditorProps {
  staffId?: string | null; // Optional - if null, works in "Add" mode (stores locally)
  language: Language;
  onSaved?: () => void;
  onScheduleChange?: (data: StaffScheduleData) => void; // Callback for Add mode
  initialData?: StaffScheduleData; // Initial data for Add mode
  sections?: ('hours' | 'specialDays' | 'blackoutDates')[]; // Which sections to show (default: all)
  containerPadding?: number; // Horizontal padding applied to each section (default: 0)
}

// Default hours: Mon-Fri 9-5, Sat 10-4, Sun closed
const getDefaultHours = (): DayHours[] => [
  { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isClosed: true },  // Sunday
  { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isClosed: false }, // Monday
  { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isClosed: false }, // Tuesday
  { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', isClosed: false }, // Wednesday
  { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', isClosed: false }, // Thursday
  { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', isClosed: false }, // Friday
  { dayOfWeek: 6, openTime: '10:00', closeTime: '16:00', isClosed: false }, // Saturday
];

// Parse time string (HH:MM) to Date for picker
const parseTimeToDate = (timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 9, minutes || 0, 0, 0);
  return date;
};

// Format Date to time string (HH:MM)
const formatDateToTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Format time for display (e.g., "9:00 AM")
const formatTimeForDisplay = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Format date for display
const formatDateForDisplay = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return format(date, 'MMM d, yyyy');
};

// Format datetime for display
const formatDateTimeForDisplay = (isoStr: string): string => {
  const date = new Date(isoStr);
  return format(date, 'MMM d, yyyy h:mm a');
};

export const StaffScheduleEditor = memo(function StaffScheduleEditor({ staffId, language, onSaved, sections, containerPadding = 0 }: StaffScheduleEditorProps) {
  const showHours = !sections || sections.includes('hours');
  const showSpecialDays = !sections || sections.includes('specialDays');
  const showBlackoutDates = !sections || sections.includes('blackoutDates');
  const ph = containerPadding; // shorthand
  const { colors, isDark, primaryColor } = useTheme();

  // ============================================
  // Weekly Schedule State & Hooks
  // ============================================
  const { data: existingWeeklySchedule, isLoading: isLoadingWeekly } = useStaffWeeklySchedule(staffId);
  const setWeeklyScheduleMutation = useSetStaffWeeklySchedule();

  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());
  const [hasWeeklyChanges, setHasWeeklyChanges] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'open' | 'close' | null>(null);

  // ============================================
  // Special Days State & Hooks
  // ============================================
  const { data: specialDays = [], isLoading: isLoadingSpecial } = useStaffSpecialDays(staffId);
  const upsertSpecialDayMutation = useUpsertStaffSpecialDay();
  const deleteSpecialDayMutation = useDeleteStaffSpecialDay();

  const [showSpecialDayModal, setShowSpecialDayModal] = useState(false);
  const [editingSpecialDayId, setEditingSpecialDayId] = useState<string | null>(null);
  const [specialDayDate, setSpecialDayDate] = useState(new Date());
  const [specialDayIsOff, setSpecialDayIsOff] = useState(false);
  const [specialDayStartTime, setSpecialDayStartTime] = useState('09:00');
  const [specialDayEndTime, setSpecialDayEndTime] = useState('17:00');
  const [specialDayNote, setSpecialDayNote] = useState('');
  const [showSpecialDayDatePicker, setShowSpecialDayDatePicker] = useState(false);
  const [showSpecialDayTimePicker, setShowSpecialDayTimePicker] = useState(false);
  const [specialDayTimeField, setSpecialDayTimeField] = useState<'start' | 'end'>('start');

  // ============================================
  // Blackout Ranges State & Hooks
  // ============================================
  const { data: blackoutRanges = [], isLoading: isLoadingBlackout } = useStaffBlackoutRanges(staffId);
  const createBlackoutMutation = useCreateStaffBlackoutRange();
  const updateBlackoutMutation = useUpdateStaffBlackoutRange();
  const deleteBlackoutMutation = useDeleteStaffBlackoutRange();

  const [showBlackoutModal, setShowBlackoutModal] = useState(false);
  const [editingBlackoutId, setEditingBlackoutId] = useState<string | null>(null);
  const [blackoutStartDate, setBlackoutStartDate] = useState(new Date());
  const [blackoutEndDate, setBlackoutEndDate] = useState(new Date());
  const [blackoutNote, setBlackoutNote] = useState('');
  const [showBlackoutDatePicker, setShowBlackoutDatePicker] = useState(false);
  const [blackoutDateField, setBlackoutDateField] = useState<'start' | 'end'>('start');

  // ============================================
  // Load existing weekly schedule
  // ============================================
  useEffect(() => {
    if (existingWeeklySchedule && existingWeeklySchedule.length > 0) {
      const loadedHours = getDefaultHours().map(day => {
        const existing = existingWeeklySchedule.find(h => h.day_of_week === day.dayOfWeek);
        if (existing) {
          return {
            dayOfWeek: existing.day_of_week,
            openTime: existing.start_time,
            closeTime: existing.end_time,
            isClosed: existing.is_off,
          };
        }
        return day;
      });
      setHours(loadedHours);
    }
  }, [existingWeeklySchedule]);

  // ============================================
  // Weekly Schedule Handlers
  // ============================================
  const updateDayHours = useCallback((dayOfWeek: number, updates: Partial<DayHours>) => {
    setHours(prev => prev.map(day =>
      day.dayOfWeek === dayOfWeek ? { ...day, ...updates } : day
    ));
    setHasWeeklyChanges(true);
  }, []);

  const handleTimeChange = (event: { type: string }, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowTimePicker(false);
      setEditingDay(null);
      setEditingField(null);
      return;
    }

    if (selectedDate && editingDay !== null && editingField) {
      const timeStr = formatDateToTime(selectedDate);
      updateDayHours(editingDay, {
        [editingField === 'open' ? 'openTime' : 'closeTime']: timeStr,
      });
    }

    setShowTimePicker(false);
    setEditingDay(null);
    setEditingField(null);
  };

  const openTimePicker = (dayOfWeek: number, field: 'open' | 'close') => {
    setEditingDay(dayOfWeek);
    setEditingField(field);
    setShowTimePicker(true);
  };

  const applyToAllDays = (sourceDayOfWeek: number) => {
    const sourceDay = hours.find(d => d.dayOfWeek === sourceDayOfWeek);
    if (sourceDay) {
      setHours(prev => prev.map(day => ({
        ...day,
        openTime: sourceDay.openTime,
        closeTime: sourceDay.closeTime,
        isClosed: sourceDay.isClosed,
      })));
      setHasWeeklyChanges(true);
    }
  };

  const handleSaveWeeklySchedule = async () => {
    // In Add mode (no staffId), don't save to DB - parent handles it
    if (!staffId) {
      setHasWeeklyChanges(false);
      return;
    }

    const scheduleInput: WeeklyScheduleInput[] = hours.map(day => ({
      day_of_week: day.dayOfWeek,
      start_time: day.openTime,
      end_time: day.closeTime,
      is_off: day.isClosed,
    }));

    try {
      await setWeeklyScheduleMutation.mutateAsync({ staffId, schedule: scheduleInput });
      setHasWeeklyChanges(false);
      onSaved?.();
    } catch (err) {
      console.log('[StaffScheduleEditor] Save weekly error:', err);
      Alert.alert('Error', 'Failed to save schedule. Please try again.');
    }
  };

  const getCurrentPickerTime = (): Date => {
    if (editingDay === null || !editingField) return new Date();
    const day = hours.find(d => d.dayOfWeek === editingDay);
    if (!day) return new Date();
    return parseTimeToDate(editingField === 'open' ? day.openTime : day.closeTime);
  };

  // ============================================
  // Special Day Handlers
  // ============================================
  const resetSpecialDayModal = () => {
    setEditingSpecialDayId(null);
    setSpecialDayDate(new Date());
    setSpecialDayIsOff(false);
    setSpecialDayStartTime('09:00');
    setSpecialDayEndTime('17:00');
    setSpecialDayNote('');
    setShowSpecialDayDatePicker(false);
    setShowSpecialDayTimePicker(false);
  };

  const openAddSpecialDay = () => {
    resetSpecialDayModal();
    setShowSpecialDayModal(true);
  };

  const openEditSpecialDay = (specialDay: typeof specialDays[0]) => {
    setEditingSpecialDayId(specialDay.id);
    setSpecialDayDate(new Date(specialDay.date + 'T00:00:00'));
    setSpecialDayIsOff(specialDay.is_off);
    setSpecialDayStartTime(specialDay.start_time || '09:00');
    setSpecialDayEndTime(specialDay.end_time || '17:00');
    setSpecialDayNote(specialDay.note || '');
    setShowSpecialDayModal(true);
  };

  const handleSaveSpecialDay = async () => {
    // In Add mode (no staffId), don't save to DB
    if (!staffId) {
      setShowSpecialDayModal(false);
      resetSpecialDayModal();
      return;
    }

    try {
      await upsertSpecialDayMutation.mutateAsync({
        staffId,
        specialDay: {
          date: format(specialDayDate, 'yyyy-MM-dd'),
          start_time: specialDayIsOff ? null : specialDayStartTime,
          end_time: specialDayIsOff ? null : specialDayEndTime,
          is_off: specialDayIsOff,
          note: specialDayNote || null,
        },
      });
      setShowSpecialDayModal(false);
      resetSpecialDayModal();
      onSaved?.();
    } catch (err) {
      console.log('[StaffScheduleEditor] Save special day error:', err);
      Alert.alert('Error', 'Failed to save special day. Please try again.');
    }
  };

  const handleDeleteSpecialDay = (specialDayId: string) => {
    if (!staffId) return; // Can't delete in Add mode

    Alert.alert(
      t('deleteSpecialDay', language) || 'Delete Special Day',
      t('deleteSpecialDayConfirm', language) || 'Are you sure you want to delete this special day?',
      [
        { text: t('cancel', language) || 'Cancel', style: 'cancel' },
        {
          text: t('delete', language) || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSpecialDayMutation.mutateAsync({ staffId, specialDayId });
              onSaved?.();
            } catch (err) {
              console.log('[StaffScheduleEditor] Delete special day error:', err);
            }
          },
        },
      ]
    );
  };

  // ============================================
  // Blackout Range Handlers
  // ============================================
  const resetBlackoutModal = () => {
    setEditingBlackoutId(null);
    setBlackoutStartDate(new Date());
    setBlackoutEndDate(new Date());
    setBlackoutNote('');
    setShowBlackoutDatePicker(false);
  };

  const openAddBlackout = () => {
    resetBlackoutModal();
    setShowBlackoutModal(true);
  };

  const openEditBlackout = (blackout: typeof blackoutRanges[0]) => {
    setEditingBlackoutId(blackout.id);
    setBlackoutStartDate(new Date(blackout.start_at));
    setBlackoutEndDate(new Date(blackout.end_at));
    setBlackoutNote(blackout.note || '');
    setShowBlackoutModal(true);
  };

  const handleSaveBlackout = async () => {
    if (blackoutEndDate <= blackoutStartDate) {
      Alert.alert('Error', 'End date must be after start date.');
      return;
    }

    // In Add mode (no staffId), don't save to DB
    if (!staffId) {
      setShowBlackoutModal(false);
      resetBlackoutModal();
      return;
    }

    try {
      if (editingBlackoutId) {
        await updateBlackoutMutation.mutateAsync({
          staffId,
          blackoutId: editingBlackoutId,
          updates: {
            start_at: blackoutStartDate.toISOString(),
            end_at: blackoutEndDate.toISOString(),
            note: blackoutNote || null,
          },
        });
      } else {
        await createBlackoutMutation.mutateAsync({
          staffId,
          blackout: {
            start_at: blackoutStartDate.toISOString(),
            end_at: blackoutEndDate.toISOString(),
            note: blackoutNote || null,
          },
        });
      }
      setShowBlackoutModal(false);
      resetBlackoutModal();
      onSaved?.();
    } catch (err) {
      console.log('[StaffScheduleEditor] Save blackout error:', err);
      Alert.alert('Error', 'Failed to save blackout period. Please try again.');
    }
  };

  const handleDeleteBlackout = (blackoutId: string) => {
    if (!staffId) return; // Can't delete in Add mode

    Alert.alert(
      t('deleteBlackout', language) || 'Delete Blackout',
      t('deleteBlackoutConfirm', language) || 'Are you sure you want to delete this blackout period?',
      [
        { text: t('cancel', language) || 'Cancel', style: 'cancel' },
        {
          text: t('delete', language) || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBlackoutMutation.mutateAsync({ staffId, blackoutId });
              onSaved?.();
            } catch (err) {
              console.log('[StaffScheduleEditor] Delete blackout error:', err);
            }
          },
        },
      ]
    );
  };

  // ============================================
  // Loading State
  // ============================================
  // In Add mode (no staffId), skip loading state since queries are disabled
  const isLoading = staffId ? (isLoadingWeekly || isLoadingSpecial || isLoadingBlackout) : false;

  if (isLoading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={primaryColor} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 0 }}>
      {/* ============================================ */}
      {/* STAFF HOURS SECTION */}
      {/* ============================================ */}
      {showHours && (
      <View style={{ paddingHorizontal: ph }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Clock size={18} color={primaryColor} />
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
          {t('staffHours', language) || 'Staff Hours'}
        </Text>
      </View>

      <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 16 }}>
        {t('staffHoursHelper', language) || 'Set the regular working hours for this staff member.'}
      </Text>

      {/* Days List */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}>
        {hours.map((day, index) => (
          <View
            key={day.dayOfWeek}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderBottomWidth: index < hours.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              backgroundColor: day.isClosed ? (isDark ? '#1F1F1F' : '#F9FAFB') : 'transparent',
            }}
          >
            {/* Day Name — flex:2 proportional column ensures all rows break at the
                same X, giving time controls a consistent left edge across all days.
                adjustsFontSizeToFit shrinks long translations rather than wrapping. */}
            <View style={{ flex: 2, marginRight: 8 }}>
              <AppText
                noShrink
                style={{
                  color: day.isClosed ? colors.textTertiary : colors.text,
                  fontWeight: '500',
                  fontSize: 14,
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {t(DAY_KEYS[day.dayOfWeek], language)}
              </AppText>
            </View>

            {/* Times or Closed — flex:5 proportional column; always starts at same X */}
            <View style={{ flex: 5, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
              {day.isClosed ? (
                <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>
                  {t('off', language) || 'Off'}
                </Text>
              ) : (
                <>
                  {/* Start Time */}
                  <Pressable
                    onPress={() => openTimePicker(day.dayOfWeek, 'open')}
                    style={{
                      backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 13 }}>
                      {formatTimeForDisplay(day.openTime)}
                    </Text>
                    <ChevronDown size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                  </Pressable>

                  <Text style={{ color: colors.textTertiary, marginHorizontal: 8 }}>–</Text>

                  {/* End Time */}
                  <Pressable
                    onPress={() => openTimePicker(day.dayOfWeek, 'close')}
                    style={{
                      backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 13 }}>
                      {formatTimeForDisplay(day.closeTime)}
                    </Text>
                    <ChevronDown size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
                  </Pressable>
                </>
              )}
            </View>

            {/* Off Toggle */}
            <Switch
              value={day.isClosed}
              onValueChange={(value) => updateDayHours(day.dayOfWeek, { isClosed: value })}
              trackColor={{ false: '#E5E7EB', true: '#EF4444' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E5E7EB"
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </View>
        ))}
      </View>

      {/* Apply to All Button */}
      <Pressable
        onPress={() => applyToAllDays(1)}
        style={{
          marginTop: 12,
          paddingVertical: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>
          {t('applyToAllDays', language) || 'Apply Monday to All Days'}
        </Text>
      </Pressable>

      {/* Save Weekly Button */}
      {hasWeeklyChanges && (
        <Pressable
          onPress={handleSaveWeeklySchedule}
          disabled={setWeeklyScheduleMutation.isPending}
          style={{
            marginTop: 16,
            backgroundColor: primaryColor,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            opacity: setWeeklyScheduleMutation.isPending ? 0.7 : 1,
          }}
        >
          {setWeeklyScheduleMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
              {t('saveChanges', language) || 'Save Changes'}
            </Text>
          )}
        </Pressable>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={getCurrentPickerTime()}
          mode="time"
          is24Hour={false}
          display="spinner"
          onChange={handleTimeChange}
        />
      )}
      </View>
      )}

      {/* ============================================ */}
      {/* SPECIAL DAYS SECTION */}
      {/* ============================================ */}
      {showSpecialDays && (
      <View style={{ marginTop: 32, paddingHorizontal: ph }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Calendar size={18} color={primaryColor} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
              {t('specialDays', language) || 'Special Days'}
            </Text>
          </View>
          <Pressable
            onPress={openAddSpecialDay}
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
            <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '500', marginLeft: 4 }}>
              {t('add', language) || 'Add'}
            </Text>
          </Pressable>
        </View>

        <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 16 }}>
          {t('specialDaysHelper', language) || 'Override hours for specific dates (holidays, events, etc.)'}
        </Text>

        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        }}>
          {specialDays.length > 0 ? (
            <View style={{ gap: 8 }}>
              {specialDays.map((specialDay) => (
                <View
                  key={specialDay.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  {/* Icon */}
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: specialDay.is_off ? '#FEE2E2' : `${primaryColor}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {specialDay.is_off ? (
                      <CalendarOff size={16} color="#EF4444" />
                    ) : (
                      <Clock size={16} color={primaryColor} />
                    )}
                  </View>

                  {/* Details */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
                      {formatDateForDisplay(specialDay.date)}
                    </Text>
                    <Text style={{
                      color: specialDay.is_off ? '#EF4444' : colors.textSecondary,
                      fontSize: 12,
                      marginTop: 2,
                    }}>
                      {specialDay.is_off
                        ? (t('off', language) || 'Off')
                        : `${formatTimeForDisplay(specialDay.start_time || '09:00')} - ${formatTimeForDisplay(specialDay.end_time || '17:00')}`}
                    </Text>
                    {specialDay.note && (
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>
                        {specialDay.note}
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <Pressable onPress={() => openEditSpecialDay(specialDay)} style={{ padding: 6 }}>
                    <Edit3 size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteSpecialDay(specialDay.id)} style={{ padding: 6 }}>
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Calendar size={24} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                {t('noSpecialDays', language) || 'No special days set'}
              </Text>
            </View>
          )}
        </View>
      </View>
      )}

      {/* ============================================ */}
      {/* BLACKOUT DATES SECTION */}
      {/* ============================================ */}
      {showBlackoutDates && (
      <View style={{ marginTop: 32, paddingHorizontal: ph }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CalendarRange size={18} color={primaryColor} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
              {t('blackoutDates', language) || 'Blackout Dates'}
            </Text>
          </View>
          <Pressable
            onPress={openAddBlackout}
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
            <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '500', marginLeft: 4 }}>
              {t('add', language) || 'Add'}
            </Text>
          </Pressable>
        </View>

        <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 16 }}>
          {t('blackoutDatesHelper', language) || 'Block date ranges when this staff member is unavailable (vacation, leave, etc.)'}
        </Text>

        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        }}>
          {blackoutRanges.length > 0 ? (
            <View style={{ gap: 8 }}>
              {blackoutRanges.map((blackout) => (
                <View
                  key={blackout.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  {/* Icon */}
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CalendarOff size={16} color="#EF4444" />
                  </View>

                  {/* Details */}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
                      {formatDateTimeForDisplay(blackout.start_at)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      to {formatDateTimeForDisplay(blackout.end_at)}
                    </Text>
                    {blackout.note && (
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>
                        {blackout.note}
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <Pressable onPress={() => openEditBlackout(blackout)} style={{ padding: 6 }}>
                    <Edit3 size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteBlackout(blackout.id)} style={{ padding: 6 }}>
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <CalendarRange size={24} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                {t('noBlackoutDates', language) || 'No blackout dates set'}
              </Text>
            </View>
          )}
        </View>
      </View>
      )}

      {/* ============================================ */}
      {/* SPECIAL DAY MODAL */}
      {/* ============================================ */}
      <Modal
        visible={showSpecialDayModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSpecialDayModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Pressable onPress={() => setShowSpecialDayModal(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                {t('cancel', language) || 'Cancel'}
              </Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
              {editingSpecialDayId ? (t('editSpecialDay', language) || 'Edit Special Day') : (t('addSpecialDay', language) || 'Add Special Day')}
            </Text>
            <Pressable
              onPress={handleSaveSpecialDay}
              disabled={upsertSpecialDayMutation.isPending}
            >
              {upsertSpecialDayMutation.isPending ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                  {t('save', language) || 'Save'}
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Date Picker */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8, textTransform: 'uppercase' }}>
                {t('date', language) || 'Date'}
              </Text>
              <Pressable
                onPress={() => setShowSpecialDayDatePicker(true)}
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {format(specialDayDate, 'MMMM d, yyyy')}
                </Text>
                <ChevronDown size={18} color={colors.textSecondary} />
              </Pressable>
              {showSpecialDayDatePicker && (
                <DateTimePicker
                  value={specialDayDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, date) => {
                    setShowSpecialDayDatePicker(Platform.OS === 'ios');
                    if (date) setSpecialDayDate(date);
                  }}
                />
              )}
            </View>

            {/* Off Toggle */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                    {t('dayOff', language) || 'Day Off'}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                    {t('dayOffHelper', language) || 'Mark this day as unavailable'}
                  </Text>
                </View>
                <Switch
                  value={specialDayIsOff}
                  onValueChange={setSpecialDayIsOff}
                  trackColor={{ false: '#E5E7EB', true: '#EF4444' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E7EB"
                />
              </View>
            </View>

            {/* Time Pickers (hidden if day off) */}
            {!specialDayIsOff && (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 12, textTransform: 'uppercase' }}>
                  {t('workingHours', language) || 'Working Hours'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable
                    onPress={() => {
                      setSpecialDayTimeField('start');
                      setShowSpecialDayTimePicker(true);
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      borderRadius: 12,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      {formatTimeForDisplay(specialDayStartTime)}
                    </Text>
                  </Pressable>
                  <Text style={{ color: colors.textTertiary, marginHorizontal: 12, fontSize: 16 }}>–</Text>
                  <Pressable
                    onPress={() => {
                      setSpecialDayTimeField('end');
                      setShowSpecialDayTimePicker(true);
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      borderRadius: 12,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 16 }}>
                      {formatTimeForDisplay(specialDayEndTime)}
                    </Text>
                  </Pressable>
                </View>
                {showSpecialDayTimePicker && (
                  <DateTimePicker
                    value={parseTimeToDate(specialDayTimeField === 'start' ? specialDayStartTime : specialDayEndTime)}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={(event, date) => {
                      setShowSpecialDayTimePicker(false);
                      if (date) {
                        const timeStr = formatDateToTime(date);
                        if (specialDayTimeField === 'start') {
                          setSpecialDayStartTime(timeStr);
                        } else {
                          setSpecialDayEndTime(timeStr);
                        }
                      }
                    }}
                  />
                )}
              </View>
            )}

            {/* Note */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8, textTransform: 'uppercase' }}>
                {t('note', language) || 'Note'} ({t('optional', language) || 'Optional'})
              </Text>
              <TextInput
                value={specialDayNote}
                onChangeText={setSpecialDayNote}
                placeholder={t('addNotePlaceholder', language) || 'Add a note...'}
                placeholderTextColor={colors.textTertiary}
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: colors.text,
                }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ============================================ */}
      {/* BLACKOUT MODAL */}
      {/* ============================================ */}
      <Modal
        visible={showBlackoutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBlackoutModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Pressable onPress={() => setShowBlackoutModal(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                {t('cancel', language) || 'Cancel'}
              </Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
              {editingBlackoutId ? (t('editBlackout', language) || 'Edit Blackout') : (t('addBlackout', language) || 'Add Blackout')}
            </Text>
            <Pressable
              onPress={handleSaveBlackout}
              disabled={createBlackoutMutation.isPending || updateBlackoutMutation.isPending}
            >
              {(createBlackoutMutation.isPending || updateBlackoutMutation.isPending) ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>
                  {t('save', language) || 'Save'}
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Start Date/Time */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8, textTransform: 'uppercase' }}>
                {t('startDateTime', language) || 'Start Date & Time'}
              </Text>
              <Pressable
                onPress={() => {
                  setBlackoutDateField('start');
                  setShowBlackoutDatePicker(true);
                }}
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {format(blackoutStartDate, 'MMM d, yyyy h:mm a')}
                </Text>
                <ChevronDown size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* End Date/Time */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8, textTransform: 'uppercase' }}>
                {t('endDateTime', language) || 'End Date & Time'}
              </Text>
              <Pressable
                onPress={() => {
                  setBlackoutDateField('end');
                  setShowBlackoutDatePicker(true);
                }}
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {format(blackoutEndDate, 'MMM d, yyyy h:mm a')}
                </Text>
                <ChevronDown size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {showBlackoutDatePicker && (
              <DateTimePicker
                value={blackoutDateField === 'start' ? blackoutStartDate : blackoutEndDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowBlackoutDatePicker(Platform.OS === 'ios');
                  if (date) {
                    if (blackoutDateField === 'start') {
                      setBlackoutStartDate(date);
                    } else {
                      setBlackoutEndDate(date);
                    }
                  }
                }}
              />
            )}

            {/* Note */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8, textTransform: 'uppercase' }}>
                {t('note', language) || 'Note'} ({t('optional', language) || 'Optional'})
              </Text>
              <TextInput
                value={blackoutNote}
                onChangeText={setBlackoutNote}
                placeholder={t('addNotePlaceholder', language) || 'Add a note (e.g., Vacation, Medical Leave)...'}
                placeholderTextColor={colors.textTertiary}
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: colors.text,
                }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
});
