/**
 * SaveConfirmationContext
 *
 * Global context for showing a consistent "Saved" confirmation overlay
 * with checkmark, sound, and haptic feedback across the entire app.
 *
 * Usage:
 * 1. Wrap your app with <SaveConfirmationProvider>
 * 2. Use the useSaveConfirmation() hook to get showSaveConfirmation()
 * 3. Call showSaveConfirmation() after a successful save operation
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
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

// ============================================
// Types
// ============================================

interface SaveConfirmationContextType {
  showSaveConfirmation: (message?: string) => void;
}

// ============================================
// Context
// ============================================

const SaveConfirmationContext = createContext<SaveConfirmationContextType | null>(null);

// ============================================
// Hook
// ============================================

export function useSaveConfirmation() {
  const context = useContext(SaveConfirmationContext);
  if (!context) {
    throw new Error('useSaveConfirmation must be used within a SaveConfirmationProvider');
  }
  return context;
}

// ============================================
// Provider Component
// ============================================

interface SaveConfirmationProviderProps {
  children: React.ReactNode;
}

export function SaveConfirmationProvider({ children }: SaveConfirmationProviderProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const { primaryColor } = useTheme();
  const language = useLanguage();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlayedFeedback = useRef(false);

  // Get the default translated message
  const defaultMessage = t('successSaved', language);

  // Create darker version of primary color for background
  const getDarkerShade = (hex: string): string => {
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const factor = 0.4;
      const newR = Math.round(r * factor);
      const newG = Math.round(g * factor);
      const newB = Math.round(b * factor);
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    } catch {
      return '#1a1a1a';
    }
  };

  const hideOverlay = useCallback(() => {
    setVisible(false);
    hasPlayedFeedback.current = false;
  }, []);

  const showSaveConfirmation = useCallback((customMessage?: string) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set message and show - use custom message or translated default
    setMessage(customMessage || t('successSaved', language));
    setVisible(true);

    // Play haptic feedback and sound
    if (!hasPlayedFeedback.current) {
      feedbackSuccess();
      hasPlayedFeedback.current = true;
    }

    // Reset animation values
    opacity.value = 0;
    scale.value = 0.8;

    // Animate in
    requestAnimationFrame(() => {
      opacity.value = withSpring(1, { damping: 15, stiffness: 300 });
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });

    // Auto hide after 1 second
    timeoutRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(hideOverlay)();
        }
      });
      scale.value = withTiming(0.9, { duration: 250 });
    }, 1000);
  }, [opacity, scale, hideOverlay, language]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const contextValue = { showSaveConfirmation };

  return (
    <SaveConfirmationContext.Provider value={contextValue}>
      {children}
      {visible && (
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
            <Text style={styles.text}>{message}</Text>
          </Animated.View>
        </View>
      )}
    </SaveConfirmationContext.Provider>
  );
}

// ============================================
// Styles
// ============================================

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
