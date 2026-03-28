import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/ThemeContext';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className,
}: ButtonProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();

  const baseStyles = 'flex-row items-center justify-center rounded-xl';

  // Primary uses buttonColor, outline uses primaryColor for border
  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: buttonColor };
      case 'secondary':
        return { backgroundColor: isDark ? '#334155' : '#1E293B' };
      case 'outline':
        return { backgroundColor: 'transparent', borderWidth: 2, borderColor: primaryColor };
      case 'ghost':
        return { backgroundColor: 'transparent' };
      default:
        return { backgroundColor: buttonColor };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'secondary':
        return '#fff';
      case 'outline':
        return isDark ? '#5EEAD4' : '#0D9488';
      case 'ghost':
        return colors.text;
      default:
        return '#fff';
    }
  };

  const sizes = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3.5',
    lg: 'px-8 py-4',
  };

  const textSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        baseStyles,
        sizes[size],
        disabled && 'opacity-50',
        className
      )}
      style={getVariantStyle()}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'secondary' ? '#fff' : '#0D9488'} />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text style={{ fontWeight: '600', color: getTextColor(), fontSize: textSizes[size] }}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
