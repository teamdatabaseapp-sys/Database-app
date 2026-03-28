import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/useLanguage';
import { t } from '@/lib/i18n';

interface SuccessToastProps {
  visible: boolean;
  message?: string;
  onHide: () => void;
  duration?: number;
}

export function SuccessToast({
  visible,
  message,
  onHide,
  duration = 1000,
}: SuccessToastProps) {
  const { primaryColor } = useTheme();
  const language = useLanguage();
  const displayMessage = message || t('successSaved', language);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(20);

  // Create darker version of primary color for background
  const getDarkerShade = (hex: string): string => {
    // Convert hex to RGB, darken, then back to hex
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Darken by 40%
    const factor = 0.4;
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (visible) {
      // Reset values first
      opacity.value = 0;
      scale.value = 0.8;
      translateY.value = 20;

      // Animate in
      opacity.value = withSpring(1);
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 12, stiffness: 200 });

      // Auto hide after duration
      const timeout = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });
        translateY.value = withDelay(
          100,
          withTiming(20, { duration: 200 }, () => {
            runOnJS(onHide)();
          })
        );
      }, duration);

      return () => clearTimeout(timeout);
    }
  }, [visible, duration, onHide, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
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
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
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
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
