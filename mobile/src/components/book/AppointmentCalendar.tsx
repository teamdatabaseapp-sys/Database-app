import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { capitalize } from './bookAppointmentUtils';

export interface AppointmentCalendarProps {
  selectedDate: Date | null;
  onDateChange: (date: Date) => void;
  onClearConflict: () => void;
}

export function AppointmentCalendar({
  selectedDate,
  onDateChange,
  onClearConflict,
}: AppointmentCalendarProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateLocale, setDateLocale] = useState<Locale>(enUS);

  // Load locale when language changes
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  // Generate localized weekday abbreviations with proper capitalization
  const localizedWeekdays = useMemo(() => {
    // Create a week starting from Sunday to get all weekday names
    const startDate = new Date(2024, 0, 7); // Sunday, Jan 7, 2024
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      // Use 'EEE' for 3-letter weekday and capitalize
      const weekday = format(day, 'EEE', { locale: dateLocale });
      return capitalize(weekday);
    });
  }, [dateLocale]);

  // Format month with proper capitalization
  const formattedMonth = useMemo(() => {
    const monthYear = format(currentMonth, 'MMMM yyyy', { locale: dateLocale });
    return capitalize(monthYear);
  }, [currentMonth, dateLocale]);

  // Get calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Navigation
  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(new Date());
    onDateChange(new Date());
  };

  // Handle day press
  const handleDayPress = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDateChange(date);
    onClearConflict(); // Clear conflict error when date changes
  };

  // Render calendar day
  const renderDay = (date: Date, index: number) => {
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);

    return (
      <Pressable
        key={index}
        onPress={() => handleDayPress(date)}
        style={{
          flex: 1,
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 2,
          borderRadius: 12,
          backgroundColor: isSelected
            ? primaryColor
            : isTodayDate
            ? isDark ? `${primaryColor}20` : `${primaryColor}15`
            : 'transparent',
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: isSelected || isTodayDate ? '600' : '400',
            color: isSelected
              ? '#FFFFFF'
              : !isCurrentMonth
              ? colors.textTertiary
              : isTodayDate
              ? primaryColor
              : colors.text,
          }}
        >
          {format(date, 'd')}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      }}
    >
      {/* Month Navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Pressable
          onPress={goToPreviousMonth}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={goToToday}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
            {formattedMonth}
          </Text>
        </Pressable>
        <Pressable
          onPress={goToNextMonth}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {localizedWeekdays.map((day, index) => (
          <View key={index} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {calendarDays.map((date, index) => (
          <View key={index} style={{ width: '14.28%' }}>
            {renderDay(date, index)}
          </View>
        ))}
      </View>
    </View>
  );
}
