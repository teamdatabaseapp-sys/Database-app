/**
 * HighlightWrapper
 *
 * Wraps any UI element with a contextual highlight overlay — used by screens
 * opened from the Business Setup hub to guide user attention to the relevant
 * element.
 *
 * Design principles:
 * - Premium, calm, intentional (Stripe-style)
 * - Subtle border + light background tint, no flashing or blocking overlays
 * - Soft pulse (1 cycle) then auto-fades — no infinite loops
 * - pointerEvents="none" overlay — NEVER blocks interaction
 * - Theme-aware (primaryColor + dark/light)
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';

interface HighlightWrapperProps {
  /** Activates the highlight + scroll cue */
  active: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Border radius of the highlight ring — should match inner card radius */
  borderRadius?: number;
  /** onLayout forwarded to outer View, used by parent for scroll offset */
  onLayout?: (e: LayoutChangeEvent) => void;
}

export function HighlightWrapper({
  active,
  children,
  style,
  borderRadius = 12,
  onLayout,
}: HighlightWrapperProps) {
  const { primaryColor, isDark } = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Fail-open: if Reanimated throws for any reason (e.g. view not yet in
    // native hierarchy, interrupted animation), catch silently so the host
    // screen is never crashed by an optional highlight effect.
    try {
      if (!active) {
        opacity.value = withTiming(0, { duration: 500 });
        return;
      }

      // Sequence: fade-in → 1 soft pulse cycle
      opacity.value = withSequence(
        withTiming(1, { duration: 350 }),                                   // fade in
        withDelay(500, withTiming(0.45, { duration: 380 })),                // pulse dim
        withTiming(1, { duration: 380 }),                                   // pulse bright
      );
    } catch (e) {
      console.warn('[HighlightWrapper] animation skipped safely:', e);
    }
  }, [active]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={[style]} onLayout={onLayout}>
      {children}
      {/* Overlay ring — pointerEvents none so it NEVER blocks touch */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth: 1.5,
            borderColor: primaryColor,
            backgroundColor: isDark
              ? `${primaryColor}18`
              : `${primaryColor}0E`,
          },
          overlayStyle,
        ]}
      />
    </View>
  );
}
