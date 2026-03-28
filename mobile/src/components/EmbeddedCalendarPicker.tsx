import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language } from '@/lib/types';
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
  Locale,
} from 'date-fns';

interface EmbeddedCalendarPickerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function EmbeddedCalendarPicker({
  selectedDate,
  onDateSelect,
  isExpanded,
  onToggleExpand,
}: EmbeddedCalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const { colors, isDark } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setLocale(cached);
    getDateFnsLocale(language).then(setLocale);
  }, [language]);

  // Get translated weekdays
  const weekdays = useMemo(() => [
    t('sunShort', language),
    t('monShort', language),
    t('tueShort', language),
    t('wedShort', language),
    t('thuShort', language),
    t('friShort', language),
    t('satShort', language),
  ], [language]);

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
  };

  // Handle day press
  const handleDayPress = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDateSelect(date);
  };

  // Format dates with locale
  const formatWithLocale = (date: Date, formatStr: string) => {
    return locale ? format(date, formatStr, { locale }) : format(date, formatStr);
  };

  // Render calendar day
  const renderDay = (date: Date, index: number) => {
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = isSameDay(date, selectedDate);
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
            ? '#0D9488'
            : isTodayDate
            ? isDark ? '#0D948820' : '#0D948815'
            : 'transparent',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: isSelected || isTodayDate ? '600' : '400',
            color: isSelected
              ? '#FFFFFF'
              : !isCurrentMonth
              ? colors.textTertiary
              : isTodayDate
              ? '#0D9488'
              : colors.text,
          }}
        >
          {format(date, 'd')}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header - always visible, acts as toggle */}
      <Pressable
        onPress={onToggleExpand}
        className="flex-row items-center justify-between p-4 active:bg-slate-50"
      >
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-lg bg-teal-50 items-center justify-center mr-3">
            <Text className="text-teal-600 font-bold text-xs">
              {format(selectedDate, 'd')}
            </Text>
          </View>
          <View>
            <Text className="text-xs text-slate-400 font-medium">{t('calendarView', language).toUpperCase()}</Text>
            <Text className="text-slate-800 font-medium">
              {formatWithLocale(selectedDate, 'EEEE, MMMM d, yyyy')}
            </Text>
          </View>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color="#94A3B8" />
        ) : (
          <ChevronDown size={20} color="#94A3B8" />
        )}
      </Pressable>

      {/* Expanded Calendar */}
      {isExpanded && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={{ borderTopWidth: 1, borderTopColor: isDark ? colors.border : '#E2E8F0' }}
        >
          {/* Month Navigation */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <Pressable
              onPress={goToPreviousMonth}
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
            >
              <ChevronLeft size={18} color="#64748B" />
            </Pressable>
            <Pressable onPress={goToToday}>
              <Text style={{ color: colors.text }} className="text-base font-semibold">
                {formatWithLocale(currentMonth, 'MMMM yyyy')}
              </Text>
            </Pressable>
            <Pressable
              onPress={goToNextMonth}
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
            >
              <ChevronRight size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View className="flex-row px-2 pb-2">
            {weekdays.map((day, index) => (
              <View key={index} className="flex-1 items-center">
                <Text className="text-slate-400 text-xs font-medium">{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View className="px-2 pb-3">
            <View className="flex-row flex-wrap">
              {calendarDays.map((date, index) => (
                <View key={index} style={{ width: '14.28%' }}>
                  {renderDay(date, index)}
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
