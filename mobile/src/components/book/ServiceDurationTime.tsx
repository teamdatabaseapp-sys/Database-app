import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Tag } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useStore } from '@/lib/store';
import type { SupabaseService } from '@/hooks/useServices';

export interface ServiceDurationTimeProps {
  // Service section
  services: SupabaseService[];
  servicesLoading: boolean;
  selectedServices: string[];
  onToggleService: (serviceId: string) => void;
  // Duration section
  selectedDuration: number;
  customDuration: string;
  onSelectDuration: (value: number) => void;
  onCustomDurationChange: (text: string) => void;
  // Time section
  appointmentTime: string;
  appointmentEndTime: string;
  onStartTimeChange: (text: string) => void;
  onEndTimeChange: (text: string) => void;
}

export function ServiceDurationTime({
  services,
  servicesLoading,
  selectedServices,
  onToggleService,
  selectedDuration,
  customDuration,
  onSelectDuration,
  onCustomDurationChange,
  appointmentTime,
  appointmentEndTime,
  onStartTimeChange,
  onEndTimeChange,
}: ServiceDurationTimeProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  return (
    <>
      {/* Service Tags */}
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
        <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
          {t('servicesRequired', language)}
        </Text>
        {servicesLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
            <ActivityIndicator size="small" color={primaryColor} />
            <Text style={{ color: colors.textTertiary, marginLeft: 8, fontSize: 14 }}>
              {t('loading', language)}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {services.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              return (
                <Pressable
                  key={service.id}
                  onPress={() => onToggleService(service.id)}
                  style={{
                    marginRight: 8,
                    marginBottom: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isSelected ? primaryColor : `${primaryColor}15`,
                    borderWidth: 1,
                    borderColor: primaryColor,
                  }}
                >
                  <Tag size={14} color={isSelected ? '#fff' : primaryColor} />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontWeight: '500',
                      fontSize: 14,
                      color: isSelected ? '#fff' : primaryColor,
                    }}
                  >
                    {service.name}
                  </Text>
                </Pressable>
              );
            })}
            {services.length === 0 && (
              <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>
                {t('noServiceTagsYet', language)}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Duration Selection */}
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
        <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
          {t('durationLabel', language)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {[
            { label: t('thirtyMin', language), value: 30 },
            { label: t('fortyFiveMin', language), value: 45 },
            { label: t('oneHour', language), value: 60 },
            { label: t('oneAndHalfHours', language), value: 90 },
            { label: t('twoHours', language), value: 120 },
            { label: t('customDuration', language), value: 0 },
          ].map((option) => {
            const isSelected = selectedDuration === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelectDuration(option.value)}
                style={{
                  marginRight: 10,
                  marginBottom: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: isSelected
                    ? primaryColor
                    : isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderWidth: 1,
                  borderColor: isSelected ? primaryColor : colors.border,
                }}
              >
                <Text
                  style={{
                    fontWeight: '500',
                    fontSize: 14,
                    color: isSelected ? '#fff' : colors.text,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom duration input */}
        {selectedDuration === 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput
              value={customDuration}
              onChangeText={onCustomDurationChange}
              placeholder="60"
              keyboardType="number-pad"
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                color: colors.text,
                fontSize: 16,
                width: 80,
                textAlign: 'center',
              }}
            />
            <Text style={{ color: colors.textSecondary, marginLeft: 10, fontSize: 14 }}>
              {t('minutesUnit', language)}
            </Text>
          </View>
        )}
      </View>

      {/* Time Selection */}
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
        <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
          {t('timeSection', language)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>{t('startLabel', language)}</Text>
            <TextInput
              value={appointmentTime}
              onChangeText={onStartTimeChange}
              placeholder="09:00"
              keyboardType="number-pad"
              maxLength={5}
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </View>
          <Text style={{ color: colors.textTertiary, marginHorizontal: 12 }}>{t('toLabel', language)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>{t('endLabel', language)}</Text>
            <TextInput
              value={appointmentEndTime}
              onChangeText={onEndTimeChange}
              placeholder="10:00"
              keyboardType="number-pad"
              maxLength={5}
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </View>
        </View>
      </View>
    </>
  );
}
