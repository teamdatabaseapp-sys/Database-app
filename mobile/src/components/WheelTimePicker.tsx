import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface WheelTimePickerProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  isOpen: boolean;
  onToggle: () => void;
}

// Format time for display (e.g., "9:00 AM")
const formatTimeForDisplay = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function WheelTimePicker({
  label,
  value,
  onChange,
  isOpen,
  onToggle,
}: WheelTimePickerProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const handleTimeChange = (event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      onToggle(); // Close picker on Android after selection
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <View>
      {label ? (
        <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{label}</Text>
      ) : null}
      <Pressable
        onPress={onToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => ({
          backgroundColor: colors.card,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Clock size={18} color={primaryColor} />
          <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
            {formatTimeForDisplay(value)}
          </Text>
        </View>
        <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>{t('edit', language)}</Text>
      </Pressable>

      {isOpen && (
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
            value={value}
            mode="time"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={handleTimeChange}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={onToggle}
              style={{ marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: buttonColor, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>{t('done', language)}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
