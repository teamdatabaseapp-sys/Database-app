import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

// Secure storage keys
const FACE_ID_ENABLED_PREFIX = 'faceid_enabled_';
const AUTH_TOKEN_PREFIX = 'auth_token_';
const AUTH_EMAIL_KEY = 'auth_email';

/**
 * Face ID / Biometric Authentication Service
 * Uses iOS Keychain via expo-secure-store for secure credential storage
 */

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  errorType?: 'user_cancel' | 'not_available' | 'not_enrolled' | 'auth_failed' | 'not_installed' | 'unknown';
}

/**
 * Check if the local authentication module is available
 */
export function isLocalAuthModuleAvailable(): boolean {
  return true;
}

/**
 * Check if biometric authentication is available on this device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
}

/**
 * Get the type of biometric authentication available
 */
export async function getBiometricType(): Promise<'face' | 'fingerprint' | 'iris' | 'none'> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'face';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'fingerprint';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'iris';
    }
    return 'none';
  } catch {
    return 'none';
  }
}

/**
 * Get display name for the biometric type (Face ID, Touch ID, etc.)
 */
export async function getBiometricDisplayName(): Promise<string> {
  const type = await getBiometricType();

  if (Platform.OS === 'ios') {
    switch (type) {
      case 'face': return 'Face ID';
      case 'fingerprint': return 'Touch ID';
      default: return 'Biometrics';
    }
  }

  // Android
  switch (type) {
    case 'face': return 'Face Recognition';
    case 'fingerprint': return 'Fingerprint';
    case 'iris': return 'Iris Scan';
    default: return 'Biometrics';
  }
}

/**
 * Prompt for biometric authentication
 */
export async function authenticateWithBiometrics(
  promptMessage?: string
): Promise<BiometricAuthResult> {
  try {
    const isAvailable = await isBiometricAvailable();
    if (!isAvailable) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return {
          success: false,
          error: 'Biometric authentication not available on this device',
          errorType: 'not_available'
        };
      }
      return {
        success: false,
        error: 'No biometrics enrolled. Please set up Face ID in Settings.',
        errorType: 'not_enrolled'
      };
    }

    const biometricName = await getBiometricDisplayName();
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || `Authenticate with ${biometricName}`,
      fallbackLabel: 'Use Password',
      cancelLabel: 'Cancel',
      disableDeviceFallback: true, // We handle fallback ourselves
    });

    if (result.success) {
      return { success: true };
    }

    // Handle different error types
    if (result.error === 'user_cancel') {
      return {
        success: false,
        error: 'Authentication cancelled',
        errorType: 'user_cancel'
      };
    }

    return {
      success: false,
      error: 'Authentication failed',
      errorType: 'auth_failed'
    };
  } catch {
    return {
      success: false,
      error: 'An error occurred during authentication',
      errorType: 'unknown'
    };
  }
}

/**
 * Check if Face ID is enabled for a specific user
 */
export async function isFaceIdEnabledForUser(userId: string): Promise<boolean> {
  try {
    const key = `${FACE_ID_ENABLED_PREFIX}${userId}`;
    const value = await SecureStore.getItemAsync(key);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable Face ID for a user - stores auth token securely
 */
export async function enableFaceIdForUser(
  userId: string,
  email: string,
  authToken: string
): Promise<boolean> {
  try {
    // Store the Face ID enabled flag
    await SecureStore.setItemAsync(
      `${FACE_ID_ENABLED_PREFIX}${userId}`,
      'true',
      { keychainAccessible: SecureStore.WHEN_UNLOCKED }
    );

    // Store the auth token securely
    await SecureStore.setItemAsync(
      `${AUTH_TOKEN_PREFIX}${userId}`,
      authToken,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED }
    );

    // Store the email for this user
    await SecureStore.setItemAsync(
      AUTH_EMAIL_KEY,
      email,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED }
    );

    return true;
  } catch {
    return false;
  }
}

/**
 * Disable Face ID for a user - removes all stored credentials
 */
export async function disableFaceIdForUser(userId: string): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(`${FACE_ID_ENABLED_PREFIX}${userId}`);
    await SecureStore.deleteItemAsync(`${AUTH_TOKEN_PREFIX}${userId}`);
    // Don't delete email - we might need it for other purposes
    return true;
  } catch {
    return false;
  }
}

/**
 * Get stored auth token for a user (after biometric authentication)
 */
export async function getStoredAuthToken(userId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(`${AUTH_TOKEN_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

/**
 * Get the last logged-in email (used for Face ID login)
 */
export async function getStoredEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(AUTH_EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * Store the last logged-in email
 */
export async function storeEmail(email: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(
      AUTH_EMAIL_KEY,
      email,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all Face ID data (used on logout or password change)
 */
export async function clearAllFaceIdData(): Promise<boolean> {
  try {
    // We can't enumerate SecureStore keys, so we just clear the email
    // The per-user keys will be cleared when the user disables Face ID
    await SecureStore.deleteItemAsync(AUTH_EMAIL_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if there's a stored Face ID session that can be used for quick login
 */
export async function hasStoredFaceIdSession(): Promise<{
  hasSession: boolean;
  email?: string;
  userId?: string;
}> {
  try {
    const email = await getStoredEmail();
    if (!email) {
      return { hasSession: false };
    }

    // Generate the user ID from email (same logic as in store.ts)
    const userId = generateUserIdFromEmail(email);

    const isEnabled = await isFaceIdEnabledForUser(userId);
    if (!isEnabled) {
      return { hasSession: false };
    }

    const hasToken = await getStoredAuthToken(userId);
    if (!hasToken) {
      return { hasSession: false };
    }

    return { hasSession: true, email, userId };
  } catch {
    return { hasSession: false };
  }
}

// Helper function to generate user ID from email (matches store.ts)
function generateUserIdFromEmail(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalizedEmail.length; i++) {
    const char = normalizedEmail.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'user_' + Math.abs(hash).toString(36);
}
