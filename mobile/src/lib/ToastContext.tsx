import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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

interface ToastContextType {
  showSuccess: (message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Inline toast component using absolute positioning instead of Modal
// This prevents screen flashes that occur when Modal visibility changes
function InlineSuccessToast({
  visible,
  message,
  onHide,
  duration,
}: {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration: number;
}) {
  const { primaryColor } = useTheme();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            runOnJS(onHide)();
          }
        });
        scale.value = withTiming(0.9, { duration: 250 });
      }, duration);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [visible, duration, onHide, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastBox,
        animatedStyle,
        { backgroundColor: getDarkerShade(primaryColor) },
      ]}
      pointerEvents="none"
    >
      <View
        style={[styles.iconContainer, { backgroundColor: primaryColor }]}
      >
        <CheckCircle size={22} color="#fff" strokeWidth={2.5} />
      </View>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState(1000);
  const [key, setKey] = useState(0); // Force re-render on each show
  const language = useLanguage();

  const showSuccess = useCallback((msg?: string, dur?: number) => {
    // If already visible, hide first then show again
    setVisible(false);

    // Use setTimeout to ensure state updates are batched correctly
    setTimeout(() => {
      setMessage(msg || t('successSaved', language));
      setDuration(dur || 1000);
      setKey(k => k + 1); // Force new instance
      setVisible(true);
      // Play haptic feedback and sound for success confirmation
      feedbackSuccess();
    }, 50);
  }, [language]);

  const handleHide = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <ToastContext.Provider value={{ showSuccess }}>
      <View style={styles.container}>
        {children}
        {/* Absolute positioned toast overlay - no Modal to avoid screen flash */}
        <View style={styles.overlay} pointerEvents="box-none">
          <InlineSuccessToast
            key={key}
            visible={visible}
            message={message}
            onHide={handleHide}
            duration={duration}
          />
        </View>
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  toastBox: {
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
  iconContainer: {
    borderRadius: 20,
    padding: 6,
    marginRight: 12,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
