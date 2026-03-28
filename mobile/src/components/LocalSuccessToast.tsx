import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { feedbackSuccess } from '@/lib/SoundManager';
import { useLanguage } from '@/lib/useLanguage';
import { t } from '@/lib/i18n';

interface LocalSuccessToastProps {
  visible: boolean;
  message?: string;
  onHide: () => void;
  duration?: number;
}

export function LocalSuccessToast({
  visible,
  message,
  onHide,
  duration = 1000,
}: LocalSuccessToastProps) {
  const { primaryColor } = useTheme();
  const language = useLanguage();
  const displayMessage = message || t('successSaved', language);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlayedHaptic = useRef(false);
  // Stabilize onHide so the effect doesn't re-run on every parent re-render
  const stableOnHide = useRef(onHide);
  useEffect(() => { stableOnHide.current = onHide; });
  const handleHide = useCallback(() => { stableOnHide.current(); }, []);

  // Create darker version of primary color for background
  const getDarkerShade = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const factor = 0.4;
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Play haptic feedback and sound once
      if (!hasPlayedHaptic.current) {
        feedbackSuccess();
        hasPlayedHaptic.current = true;
      }

      // Reset and animate in
      opacity.value = 0;
      scale.value = 0.8;

      // Small delay to ensure reset takes effect
      requestAnimationFrame(() => {
        opacity.value = withSpring(1, { damping: 15, stiffness: 300 });
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      });

      // Auto hide after duration
      timeoutRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(handleHide)();
          }
        });
        scale.value = withTiming(0.9, { duration: 250 });
      }, duration);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      hasPlayedHaptic.current = false;
    }
  }, [visible, duration, handleHide, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          animatedStyle,
          {
            backgroundColor: getDarkerShade(primaryColor),
            paddingHorizontal: 24,
            paddingVertical: 16,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 10,
          },
        ]}
      >
        <View
          style={{
            backgroundColor: primaryColor,
            borderRadius: 20,
            padding: 6,
            marginRight: 12,
          }}
        >
          <CheckCircle size={22} color="#fff" strokeWidth={2.5} />
        </View>
        <Text style={styles.text}>{displayMessage}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
