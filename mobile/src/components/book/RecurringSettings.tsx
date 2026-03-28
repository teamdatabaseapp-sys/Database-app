import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Calendar, Repeat, AlertCircle, Eye } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useStore } from '@/lib/store';
import {
  useSeriesPreview,
  type CreateSeriesInput,
  type RecurrenceFrequency,
  type RecurrenceEndType,
  type SeriesPreview,
} from '@/hooks/useAppointments';

export interface RecurrenceConfig {
  isRecurring: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceEndType: RecurrenceEndType;
  recurrenceEndDate: Date | null;
  recurrenceCount: string;
  customIntervalWeeks: string;
  seriesPreviewData: SeriesPreview | null;
}

export interface RecurringSettingsProps {
  selectedDate: Date | null;
  appointmentTime: string;
  selectedClientId: string | null;
  selectedStaffId: string | null;
  activeStoreId: string | null;
  selectedServices: string[];
  businessId: string | null | undefined;
  dateLocale: Locale;
  durationMinutes: number;
  onChange: (config: RecurrenceConfig) => void;
  /** Increment this value to trigger an internal reset of all recurring state */
  resetKey: number;
}

export function RecurringSettings({
  selectedDate,
  appointmentTime,
  selectedClientId,
  selectedStaffId,
  activeStoreId,
  selectedServices,
  businessId,
  dateLocale,
  durationMinutes,
  onChange,
  resetKey,
}: RecurringSettingsProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const seriesPreviewMutation = useSeriesPreview();

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [recurrenceEndType, setRecurrenceEndType] = useState<RecurrenceEndType>('occurrence_count');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [recurrenceCount, setRecurrenceCount] = useState('4');
  const [customIntervalWeeks, setCustomIntervalWeeks] = useState('3');
  const [showSeriesPreview, setShowSeriesPreview] = useState(false);
  const [seriesPreviewData, setSeriesPreviewData] = useState<SeriesPreview | null>(null);

  // Reset all state when resetKey changes
  useEffect(() => {
    if (resetKey === 0) return; // skip initial mount
    setIsRecurring(false);
    setRecurrenceFrequency('weekly');
    setRecurrenceEndType('occurrence_count');
    setRecurrenceEndDate(null);
    setRecurrenceCount('4');
    setCustomIntervalWeeks('3');
    setShowSeriesPreview(false);
    setSeriesPreviewData(null);
  }, [resetKey]);

  // Notify parent whenever config changes
  const notifyChange = useCallback(
    (overrides: Partial<RecurrenceConfig>) => {
      const config: RecurrenceConfig = {
        isRecurring,
        recurrenceFrequency,
        recurrenceEndType,
        recurrenceEndDate,
        recurrenceCount,
        customIntervalWeeks,
        seriesPreviewData,
        ...overrides,
      };
      onChange(config);
    },
    [
      isRecurring,
      recurrenceFrequency,
      recurrenceEndType,
      recurrenceEndDate,
      recurrenceCount,
      customIntervalWeeks,
      seriesPreviewData,
      onChange,
    ]
  );

  const handleToggleRecurring = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isRecurring;
    setIsRecurring(next);
    setSeriesPreviewData(null);
    notifyChange({ isRecurring: next, seriesPreviewData: null });
  }, [isRecurring, notifyChange]);

  const handleSetFrequency = useCallback(
    (value: RecurrenceFrequency) => {
      setRecurrenceFrequency(value);
      setSeriesPreviewData(null);
      notifyChange({ recurrenceFrequency: value, seriesPreviewData: null });
    },
    [notifyChange]
  );

  const handleSetEndType = useCallback(
    (value: RecurrenceEndType) => {
      setRecurrenceEndType(value);
      setSeriesPreviewData(null);
      notifyChange({ recurrenceEndType: value, seriesPreviewData: null });
    },
    [notifyChange]
  );

  const handleSetRecurrenceCount = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9]/g, '');
      setRecurrenceCount(cleaned);
      setSeriesPreviewData(null);
      notifyChange({ recurrenceCount: cleaned, seriesPreviewData: null });
    },
    [notifyChange]
  );

  const handleSetCustomIntervalWeeks = useCallback(
    (text: string) => {
      const cleaned = text.replace(/[^0-9]/g, '');
      setCustomIntervalWeeks(cleaned);
      setSeriesPreviewData(null);
      notifyChange({ customIntervalWeeks: cleaned, seriesPreviewData: null });
    },
    [notifyChange]
  );

  const handleSetEndDate = useCallback(
    (date: Date) => {
      setRecurrenceEndDate(date);
      setSeriesPreviewData(null);
      notifyChange({ recurrenceEndDate: date, seriesPreviewData: null });
    },
    [notifyChange]
  );

  const handlePreview = useCallback(async () => {
    if (!selectedDate || !activeStoreId || !businessId) return;

    const input: CreateSeriesInput = {
      business_id: businessId,
      store_id: activeStoreId,
      staff_id: selectedStaffId,
      client_id: selectedClientId || '',
      service_ids: selectedServices,
      frequency_type: recurrenceFrequency,
      interval_value: recurrenceFrequency === 'custom' ? parseInt(customIntervalWeeks) || 1 : 1,
      start_date: selectedDate,
      end_type: recurrenceEndType,
      end_date: recurrenceEndType === 'until_date' ? recurrenceEndDate : null,
      occurrence_count: recurrenceEndType === 'occurrence_count' ? parseInt(recurrenceCount) || 4 : null,
      start_time: appointmentTime,
      duration_minutes: durationMinutes,
    };

    try {
      const preview = await seriesPreviewMutation.mutateAsync({ input });
      setSeriesPreviewData(preview);
      setShowSeriesPreview(true);
      notifyChange({ seriesPreviewData: preview });
    } catch (error) {
      console.error('Preview generation failed:', error);
    }
  }, [
    selectedDate,
    activeStoreId,
    businessId,
    selectedStaffId,
    selectedClientId,
    selectedServices,
    recurrenceFrequency,
    customIntervalWeeks,
    recurrenceEndType,
    recurrenceEndDate,
    recurrenceCount,
    appointmentTime,
    durationMinutes,
    seriesPreviewMutation,
    notifyChange,
  ]);

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
      {/* Toggle Row */}
      <Pressable
        onPress={handleToggleRecurring}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: isRecurring ? `${primaryColor}20` : colors.backgroundTertiary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Repeat size={18} color={isRecurring ? primaryColor : colors.textSecondary} />
          </View>
          <View>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
              {t('repeatAppointment', language) || 'Repeat'}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
              {t('repeatDescription', language) || 'Create recurring appointments'}
            </Text>
          </View>
        </View>
        {/* Toggle Switch */}
        <View
          style={{
            width: 50,
            height: 30,
            borderRadius: 15,
            backgroundColor: isRecurring ? primaryColor : colors.backgroundTertiary,
            justifyContent: 'center',
            padding: 2,
          }}
        >
          <Animated.View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: '#fff',
              alignSelf: isRecurring ? 'flex-end' : 'flex-start',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
            }}
          />
        </View>
      </Pressable>

      {/* Recurrence Options (shown when toggle is on) */}
      {isRecurring && (
        <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16 }}>
          {/* Frequency Selection */}
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
            {t('frequency', language) || 'Frequency'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { value: 'weekly' as RecurrenceFrequency, label: t('weekly', language) || 'Weekly' },
              { value: 'biweekly' as RecurrenceFrequency, label: t('everyTwoWeeks', language) || 'Every 2 Weeks' },
              { value: 'monthly' as RecurrenceFrequency, label: t('monthly', language) || 'Monthly' },
              { value: 'custom' as RecurrenceFrequency, label: t('customFrequency', language) || 'Custom' },
            ].map((option) => {
              const isSelected = recurrenceFrequency === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleSetFrequency(option.value)}
                  style={{
                    marginRight: 8,
                    marginBottom: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: isSelected ? primaryColor : colors.backgroundTertiary,
                    borderWidth: 1,
                    borderColor: isSelected ? primaryColor : colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: isSelected ? '#fff' : colors.text,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Custom interval input */}
          {recurrenceFrequency === 'custom' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginRight: 8 }}>
                {t('every', language) || 'Every'}
              </Text>
              <TextInput
                value={customIntervalWeeks}
                onChangeText={handleSetCustomIntervalWeeks}
                keyboardType="number-pad"
                maxLength={2}
                style={{
                  backgroundColor: colors.backgroundTertiary,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: colors.text,
                  fontSize: 14,
                  width: 50,
                  textAlign: 'center',
                }}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 8 }}>
                {t('weeks', language) || 'weeks'}
              </Text>
            </View>
          )}

          {/* End Condition */}
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
            {t('endCondition', language) || 'Ends'}
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <Pressable
              onPress={() => handleSetEndType('occurrence_count')}
              style={{
                flex: 1,
                marginRight: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: recurrenceEndType === 'occurrence_count' ? `${primaryColor}15` : colors.backgroundTertiary,
                borderWidth: 1,
                borderColor: recurrenceEndType === 'occurrence_count' ? primaryColor : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: recurrenceEndType === 'occurrence_count' ? primaryColor : colors.text,
                  textAlign: 'center',
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t('afterOccurrences', language) || 'After # times'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleSetEndType('until_date')}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: recurrenceEndType === 'until_date' ? `${primaryColor}15` : colors.backgroundTertiary,
                borderWidth: 1,
                borderColor: recurrenceEndType === 'until_date' ? primaryColor : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: recurrenceEndType === 'until_date' ? primaryColor : colors.text,
                  textAlign: 'center',
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t('onDate', language) || 'On date'}
              </Text>
            </Pressable>
          </View>

          {/* Occurrence Count Input */}
          {recurrenceEndType === 'occurrence_count' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginRight: 8 }}>
                {t('repeatTimes', language) || 'Repeat'}
              </Text>
              <TextInput
                value={recurrenceCount}
                onChangeText={handleSetRecurrenceCount}
                keyboardType="number-pad"
                maxLength={2}
                style={{
                  backgroundColor: colors.backgroundTertiary,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: colors.text,
                  fontSize: 14,
                  width: 50,
                  textAlign: 'center',
                }}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 8 }}>
                {t('times', language) || 'times'}
              </Text>
            </View>
          )}

          {/* End Date Picker (simplified - shows selected date) */}
          {recurrenceEndType === 'until_date' && (
            <View style={{ marginBottom: 12 }}>
              <Pressable
                onPress={() => {
                  // For now, set end date to 3 months from start
                  if (selectedDate) {
                    const endDate = new Date(selectedDate);
                    endDate.setMonth(endDate.getMonth() + 3);
                    handleSetEndDate(endDate);
                  }
                }}
                style={{
                  backgroundColor: colors.backgroundTertiary,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Calendar size={18} color={colors.textSecondary} />
                <Text style={{ color: colors.text, fontSize: 14, marginLeft: 10 }}>
                  {recurrenceEndDate
                    ? format(recurrenceEndDate, 'MMM d, yyyy', { locale: dateLocale })
                    : t('selectEndDate', language) || 'Select end date (tap to set 3 months)'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Preview Button */}
          <Pressable
            onPress={handlePreview}
            disabled={seriesPreviewMutation.isPending}
            style={{
              backgroundColor: `${primaryColor}15`,
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {seriesPreviewMutation.isPending ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <>
                <Eye size={18} color={primaryColor} />
                <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                  {t('previewSeries', language) || 'Preview appointments'}
                </Text>
              </>
            )}
          </Pressable>

          {/* Preview Results */}
          {seriesPreviewData && (
            <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 12 }}>
              <View
                style={{
                  backgroundColor: colors.backgroundTertiary,
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                    {t('totalAppointments', language) || 'Total appointments'}
                  </Text>
                  <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '600' }}>
                    {seriesPreviewData.totalCount}
                  </Text>
                </View>
                {seriesPreviewData.conflictCount > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AlertCircle size={14} color="#F59E0B" />
                    <Text style={{ color: '#F59E0B', fontSize: 13, marginLeft: 6 }}>
                      {seriesPreviewData.conflictCount} {t('conflictsFound', language) || 'conflicts (will be skipped)'}
                    </Text>
                  </View>
                )}
                {seriesPreviewData.occurrences.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 6 }}>
                      {t('scheduledDates', language) || 'Scheduled dates:'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {seriesPreviewData.occurrences.slice(0, 8).map((occ, idx) => (
                        <View
                          key={idx}
                          style={{
                            backgroundColor: occ.hasConflict ? '#FEF3C7' : `${primaryColor}10`,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: occ.hasConflict ? '#D97706' : primaryColor,
                            }}
                          >
                            {format(occ.date, 'MMM d', { locale: dateLocale })}
                          </Text>
                        </View>
                      ))}
                      {seriesPreviewData.occurrences.length > 8 && (
                        <View
                          style={{
                            backgroundColor: colors.backgroundTertiary,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            +{seriesPreviewData.occurrences.length - 8} more
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
}
