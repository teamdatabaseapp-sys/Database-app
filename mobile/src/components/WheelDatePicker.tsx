import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, Locale } from 'date-fns';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t, getDateFnsLocale, getCachedDateFnsLocale, getLocaleForLanguage } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface WheelDatePickerProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  isOpen: boolean;
  onToggle: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function WheelDatePicker({
  label,
  value,
  onChange,
  isOpen,
  onToggle,
  minimumDate,
  maximumDate,
}: WheelDatePickerProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  // Get the locale string for the native date picker (e.g., "en-US", "es-ES")
  const nativeLocale = getLocaleForLanguage(language);

  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setLocale(cached);
    getDateFnsLocale(language).then(setLocale);
  }, [language]);

  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      onToggle(); // Close picker on Android after selection
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  // Use PPP format for full localized date display
  const formattedDate = locale
    ? format(value, 'PPP', { locale })
    : format(value, 'MMMM d, yyyy');

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
        <View className="flex-row items-center">
          <Calendar size={18} color={primaryColor} />
          <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
            {formattedDate}
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
            <Text className="text-white font-semibold text-center">{t('selectDate', language)}</Text>
          </View>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleDateChange}
            locale={nativeLocale}
          />
          {Platform.OS === 'ios' && (
            <Pressable
              onPress={onToggle}
              style={{ marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: buttonColor, borderRadius: 8 }}
            >
              <Text className="text-white font-semibold">{t('done', language)}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
