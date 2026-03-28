import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Clock } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';

interface BusinessHoursAlertModalProps {
  visible: boolean;
  onDismiss: () => void;
  language: Language;
}

/**
 * Absolutely-positioned overlay — NOT a React Native <Modal>.
 * Must be rendered as the LAST child inside the parent Modal so it
 * sits above all modal content without triggering the iOS nested-Modal bug.
 */
export function BusinessHoursAlertModal({
  visible,
  onDismiss,
  language,
}: BusinessHoursAlertModalProps) {
  const { isDark, primaryColor } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex: 9999,
      }}
    >
      {/* Backdrop tap to dismiss */}
      <Pressable
        onPress={onDismiss}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Card */}
      <Animated.View
        entering={ZoomIn.duration(220).springify()}
        style={{
          width: '100%',
          maxWidth: 340,
          borderRadius: 24,
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          overflow: 'hidden',
          // Raise above backdrop pressable
          zIndex: 1,
        }}
      >
        <View style={{ padding: 28, alignItems: 'center' }}>
          {/* Icon badge */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              backgroundColor: isDark ? '#0F172A' : '#F1F5F9',
            }}
          >
            <Clock size={26} color={primaryColor} />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 10,
              color: isDark ? '#F8FAFC' : '#0F172A',
            }}
          >
            {t('outsideBusinessHoursTitle', language)}
          </Text>

          {/* Body */}
          <Text
            style={{
              fontSize: 14,
              lineHeight: 22,
              textAlign: 'center',
              paddingHorizontal: 8,
              marginBottom: 24,
              color: isDark ? '#94A3B8' : '#475569',
            }}
          >
            {t('outsideBusinessHoursBody', language)}
          </Text>

          {/* OK button */}
          <Pressable
            onPress={onDismiss}
            style={{
              width: '100%',
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              backgroundColor: primaryColor,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {t('outsideBusinessHoursOk', language)}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
