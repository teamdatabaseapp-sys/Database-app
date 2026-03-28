import { Audio, AVPlaybackStatus } from 'expo-av';
import { Platform } from 'react-native';
import { useStore } from './store';
import { hapticSuccess, hapticToggle, hapticError } from './HapticManager';

/**
 * SoundManager - Global sound management singleton
 *
 * Plays subtle UI sounds for key actions.
 * Uses bundled WAV assets for reliable cross-platform playback.
 *
 * IMPORTANT: Sounds are preloaded on app start for instant playback.
 * Call feedbackSuccess(), feedbackToggle(), or feedbackError() for
 * combined sound + haptic feedback that plays synchronously with actions.
 */

// Sound types
export type SoundType = 'success' | 'toggle' | 'error';

// Use bundled sound assets for reliable playback
const SOUND_FILES: Record<SoundType, number> = {
  success: require('@/assets/sounds/success.wav'),
  toggle: require('@/assets/sounds/toggle.wav'),
  error: require('@/assets/sounds/error.wav'),
};

// Audio state - singleton pattern
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;
const soundInstances: Map<SoundType, Audio.Sound> = new Map();

/**
 * Initialize audio mode once - ensures proper iOS audio session
 * Uses Ambient category which mixes with other audio and respects silent switch
 */
async function ensureAudioInitialized(): Promise<boolean> {
  if (isInitialized) return true;

  // Prevent multiple simultaneous init calls
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Configure audio session for UI sounds
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        allowsRecordingIOS: false,
      });

      isInitialized = true;
      console.log('[SoundManager] Audio mode configured');
      return true;
    } catch (e) {
      console.log('[SoundManager] Audio init error:', e);
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Load a sound and cache it for instant playback
 */
async function loadSound(type: SoundType): Promise<Audio.Sound | null> {
  // Return cached sound if available and loaded
  const cached = soundInstances.get(type);
  if (cached) {
    try {
      const status = await cached.getStatusAsync();
      if (status.isLoaded) {
        return cached;
      }
    } catch {
      soundInstances.delete(type);
    }
  }

  try {
    // Create sound with shouldPlay: false so we control when it plays
    // Volume set to 0.0135 (1.35%) for elegant, soft, subtle feedback
    const { sound, status } = await Audio.Sound.createAsync(
      SOUND_FILES[type],
      {
        volume: 0.0135,
        shouldPlay: false,
        isLooping: false,
      }
    );

    if (status.isLoaded) {
      console.log(`[SoundManager] Loaded ${type} sound`);
      soundInstances.set(type, sound);
      return sound;
    }
    return null;
  } catch (err) {
    console.log(`[SoundManager] Failed to load ${type}:`, err);
    return null;
  }
}

/**
 * Play a sound immediately
 * This is an async function but fires immediately - don't await in UI code
 */
export async function playSound(type: SoundType): Promise<void> {
  // Check if sounds are enabled in settings
  const soundsEnabled = useStore.getState().soundsEnabled;
  if (!soundsEnabled) {
    return;
  }

  try {
    // Ensure audio is initialized
    const initialized = await ensureAudioInitialized();
    if (!initialized) return;

    // Get or load the sound
    const sound = await loadSound(type);
    if (!sound) return;

    // Get current status
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    // If sound is currently playing, stop it first
    if (status.isPlaying) {
      await sound.stopAsync();
    }

    // Reset position and play immediately
    await sound.setPositionAsync(0);
    await sound.playAsync();

    console.log(`[SoundManager] Playing ${type}`);
  } catch (err) {
    console.log(`[SoundManager] Play error for ${type}:`, err);
  }
}

/**
 * Preload all sounds on app start for instant playback
 * Call this in _layout.tsx useEffect
 */
export async function preloadSounds(): Promise<void> {
  try {
    await ensureAudioInitialized();

    // Load all sounds in parallel
    await Promise.all([
      loadSound('success'),
      loadSound('toggle'),
      loadSound('error'),
    ]);

    console.log('[SoundManager] All sounds preloaded');
  } catch (err) {
    console.log('[SoundManager] Preload error:', err);
  }
}

// ============================================================
// CONVENIENCE FUNCTIONS - Sound only
// ============================================================

export function playSuccessSound(): void {
  playSound('success');
}

export function playToggleSound(): void {
  playSound('toggle');
}

export function playErrorSound(): void {
  playSound('error');
}

// ============================================================
// COMBINED FEEDBACK FUNCTIONS - Sound + Haptic (RECOMMENDED)
// These trigger SYNCHRONOUSLY with your action
// ============================================================

/**
 * Success feedback - for Save, Update, Create, Confirm actions
 * Triggers haptic + sound simultaneously when called
 *
 * Usage:
 *   onSave={() => {
 *     feedbackSuccess();  // <-- Call at exact moment of action
 *     showToast('Saved');
 *   }}
 */
export function feedbackSuccess(): void {
  // Haptic fires instantly (synchronous)
  hapticSuccess();
  // Sound fires async but starts immediately
  playSound('success');
}

/**
 * Toggle feedback - for Switch ON/OFF, checkbox toggle
 * Triggers haptic + sound simultaneously when called
 *
 * Usage:
 *   onValueChange={(value) => {
 *     feedbackToggle();  // <-- Call at exact moment of toggle
 *     setEnabled(value);
 *   }}
 */
export function feedbackToggle(): void {
  hapticToggle();
  playSound('toggle');
}

/**
 * Error feedback - for validation errors, failed actions
 * Triggers haptic + sound simultaneously when called
 */
export function feedbackError(): void {
  hapticError();
  playSound('error');
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Unload all sounds (call on app background/unmount if needed)
 */
export async function unloadAllSounds(): Promise<void> {
  for (const [type, sound] of soundInstances) {
    try {
      await sound.unloadAsync();
    } catch {
      // Ignore cleanup errors
    }
  }
  soundInstances.clear();
  isInitialized = false;
}
