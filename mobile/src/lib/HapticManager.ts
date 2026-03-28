import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useStore } from './store';

/**
 * HapticManager - Lightweight singleton for micro-haptic feedback
 *
 * Uses expo-haptics for cross-platform haptic feedback.
 * Provides subtle, non-disruptive tactile responses for key actions.
 * Respects user's vibrationsEnabled setting.
 */

// Haptic feedback types
export type HapticType = 'success' | 'toggle' | 'error' | 'light' | 'medium';

/**
 * Check if vibrations are enabled in settings
 */
function isVibrationsEnabled(): boolean {
  return useStore.getState().vibrationsEnabled;
}

/**
 * Trigger a success haptic - light tactile confirmation
 * Use for: Save, Update, Create, Confirm actions
 */
export function hapticSuccess(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!isVibrationsEnabled()) return;

  try {
    // NotificationFeedbackType.Success gives a satisfying "done" feel
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silently fail - haptics are non-critical
  }
}

/**
 * Trigger a toggle haptic - micro tap/tick
 * Use for: Switch ON/OFF, checkbox toggle
 */
export function hapticToggle(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!isVibrationsEnabled()) return;

  try {
    // ImpactFeedbackStyle.Light gives a subtle click feel
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silently fail
  }
}

/**
 * Trigger an error haptic - warning feedback
 * Use for: Validation errors, failed actions
 */
export function hapticError(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!isVibrationsEnabled()) return;

  try {
    // NotificationFeedbackType.Error gives a "something went wrong" feel
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Silently fail
  }
}

/**
 * Trigger a light tap haptic
 * Use for: Button presses, selections
 */
export function hapticLight(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!isVibrationsEnabled()) return;

  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silently fail
  }
}

/**
 * Trigger a medium tap haptic
 * Use for: More significant interactions
 */
export function hapticMedium(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!isVibrationsEnabled()) return;

  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silently fail
  }
}

/**
 * Trigger a selection changed haptic
 * Use for: Picker changes, segment control changes
 */
export function hapticSelection(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (!isVibrationsEnabled()) return;

  try {
    Haptics.selectionAsync();
  } catch {
    // Silently fail
  }
}

/**
 * Generic haptic trigger based on type
 */
export function triggerHaptic(type: HapticType): void {
  switch (type) {
    case 'success':
      hapticSuccess();
      break;
    case 'toggle':
      hapticToggle();
      break;
    case 'error':
      hapticError();
      break;
    case 'light':
      hapticLight();
      break;
    case 'medium':
      hapticMedium();
      break;
  }
}
