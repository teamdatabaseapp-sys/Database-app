import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  icon,
  containerClassName,
  className,
  ...props
}: InputProps) {
  const { colors, isDark } = useTheme();

  return (
    <View className={cn('mb-4', containerClassName)}>
      {label && (
        <Text style={{ color: colors.text, fontWeight: '500', marginBottom: 8, fontSize: 14 }}>
          {label}
        </Text>
      )}
      <View className="relative">
        {icon && (
          <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
            {icon}
          </View>
        )}
        <TextInput
          className={cn(
            'rounded-xl px-4 py-3.5 text-base',
            icon && 'pl-12',
            className
          )}
          style={{
            backgroundColor: colors.inputBackground,
            borderWidth: 1,
            borderColor: error ? '#EF4444' : colors.inputBorder,
            color: colors.inputText,
          }}
          placeholderTextColor={colors.inputPlaceholder}
          cursorColor="#0D9488"
          selectionColor="#0D948840"
          {...props}
        />
      </View>
      {error && (
        <Text style={{ color: '#EF4444', fontSize: 14, marginTop: 4 }}>{error}</Text>
      )}
    </View>
  );
}
