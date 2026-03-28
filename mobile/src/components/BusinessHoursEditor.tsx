/**
 * BusinessHoursEditor Component
 *
 * A reusable component for editing business hours for 7 days of the week.
 * Supports different hours per day and closed day toggles.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Switch, ActivityIndicator } from 'react-native';
import { AppText } from '@/components/AppText';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { ChevronDown, Clock } from 'lucide-react-native';
import { useBusinessHours, useSetBusinessHours, BusinessHoursInput } from '@/hooks/useBusinessHours';

// Day names indexed by day_of_week (0=Sunday)
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface BusinessHoursEditorProps {
  language: Language;
  storeId?: string | null; // If provided, edit store-specific hours; null = default hours
  onSaved?: () => void;
}

interface DayHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
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

export function BusinessHoursEditor({ language, storeId, onSaved }: BusinessHoursEditorProps) {
  const { colors, isDark, primaryColor } = useTheme();

  // Fetch existing hours
  const { data: existingHours, isLoading } = useBusinessHours(storeId);
  const setHoursMutation = useSetBusinessHours();

  // Local state for editing
  const [hours, setHours] = useState<DayHours[]>(getDefaultHours());
  const [hasChanges, setHasChanges] = useState(false);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'open' | 'close' | null>(null);

  // Load existing hours when data is available
  useEffect(() => {
    if (existingHours && existingHours.length > 0) {
      const loadedHours = getDefaultHours().map(day => {
        const existing = existingHours.find(h => h.day_of_week === day.dayOfWeek);
        if (existing) {
          return {
            dayOfWeek: existing.day_of_week,
            openTime: existing.open_time,
            closeTime: existing.close_time,
            isClosed: existing.is_closed,
          };
        }
        return day;
      });
      setHours(loadedHours);
    }
  }, [existingHours]);

  // Update day hours
  const updateDayHours = useCallback((dayOfWeek: number, updates: Partial<DayHours>) => {
    setHours(prev => prev.map(day =>
      day.dayOfWeek === dayOfWeek ? { ...day, ...updates } : day
    ));
    setHasChanges(true);
  }, []);

  // Handle time picker change
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

  // Open time picker for a specific day/field
  const openTimePicker = (dayOfWeek: number, field: 'open' | 'close') => {
    setEditingDay(dayOfWeek);
    setEditingField(field);
    setShowTimePicker(true);
  };

  // Apply current day's hours to all days
  const applyToAllDays = (sourceDayOfWeek: number) => {
    const sourceDay = hours.find(d => d.dayOfWeek === sourceDayOfWeek);
    if (sourceDay) {
      setHours(prev => prev.map(day => ({
        ...day,
        openTime: sourceDay.openTime,
        closeTime: sourceDay.closeTime,
        isClosed: sourceDay.isClosed,
      })));
      setHasChanges(true);
    }
  };

  // Save hours
  const handleSave = async () => {
    const hoursInput: BusinessHoursInput[] = hours.map(day => ({
      day_of_week: day.dayOfWeek,
      open_time: day.openTime,
      close_time: day.closeTime,
      is_closed: day.isClosed,
    }));

    try {
      await setHoursMutation.mutateAsync({ hours: hoursInput, storeId });
      setHasChanges(false);
      onSaved?.();
    } catch (err) {
      console.log('[BusinessHoursEditor] Save error:', err);
    }
  };

  // Get current time for picker
  const getCurrentPickerTime = (): Date => {
    if (editingDay === null || !editingField) return new Date();
    const day = hours.find(d => d.dayOfWeek === editingDay);
    if (!day) return new Date();
    return parseTimeToDate(editingField === 'open' ? day.openTime : day.closeTime);
  };

  if (isLoading) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={primaryColor} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 24 }}>
      {/* Section Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Clock size={18} color={primaryColor} />
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
          {t('businessHours', language)}
        </Text>
      </View>

      <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 16 }}>
        {t('businessHoursHelper', language)}
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
                  {t('closed', language)}
                </Text>
              ) : (
                <>
                  {/* Open Time */}
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

                  {/* Close Time */}
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

            {/* Closed Toggle */}
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
        onPress={() => applyToAllDays(1)} // Apply Monday's hours to all
        style={{
          marginTop: 12,
          paddingVertical: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>
          {t('applyToAllDays', language)}
        </Text>
      </Pressable>

      {/* Save Button (only show if changes) */}
      {hasChanges && (
        <Pressable
          onPress={handleSave}
          disabled={setHoursMutation.isPending}
          style={{
            marginTop: 16,
            backgroundColor: primaryColor,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            opacity: setHoursMutation.isPending ? 0.7 : 1,
          }}
        >
          {setHoursMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
              {t('saveChanges', language)}
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
  );
}
