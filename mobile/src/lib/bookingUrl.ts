/**
 * Booking URL Utilities
 *
 * Handles generation of clean, branded booking URLs.
 * Uses environment-based configuration with proper fallbacks.
 *
 * URL Priority:
 * 1. PUBLIC_BOOKING_BASE_URL env var (if set and DNS confirmed working)
 * 2. EXPO_PUBLIC_VIBECODE_BACKEND_URL (preview/dev URL - always works)
 *
 * Rules:
 * - Business slug is derived from business name
 * - Lowercase, spaces replaced with hyphens
 * - No random IDs, no platform names, no query parameters visible to users
 */

// Environment-based URL configuration
const CUSTOM_BOOKING_BASE_URL = process.env.EXPO_PUBLIC_BOOKING_BASE_URL || '';
const VIBECODE_BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || '';

// Fallback preview URL (always works)
const FALLBACK_PREVIEW_URL = 'https://preview-ypsonjcyjtpn.dev.vibecode.run';

// The branded booking domain (production - only use if explicitly configured)
export const BOOKING_DOMAIN = 'rsvdatabase.com';
export const BOOKING_BASE_URL = `https://${BOOKING_DOMAIN}`;

/**
 * Get the public booking base URL.
 * This is the SINGLE source of truth for all booking URL generation.
 *
 * Priority:
 * 1. EXPO_PUBLIC_BOOKING_BASE_URL env var (custom/production domain if DNS is working)
 * 2. EXPO_PUBLIC_VIBECODE_BACKEND_URL (Vibecode backend URL - preview mode)
 * 3. FALLBACK_PREVIEW_URL (hardcoded fallback - always works)
 *
 * NEVER defaults to rsvdatabase.com unless explicitly set via env.
 *
 * @returns The base URL for booking pages
 */
export function getPublicBookingBaseUrl(): string {
  // Priority 1: Explicit custom domain (only if confirmed working via env)
  if (CUSTOM_BOOKING_BASE_URL) {
    return CUSTOM_BOOKING_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  }

  // Priority 2: Vibecode backend URL (preview mode)
  if (VIBECODE_BACKEND_URL) {
    return VIBECODE_BACKEND_URL.replace(/\/$/, '');
  }

  // Priority 3: Hardcoded fallback (always works)
  return FALLBACK_PREVIEW_URL;
}

/**
 * Check if we're currently using preview mode (not custom domain).
 * @returns True if using preview URL (not custom domain)
 */
export function isUsingPreviewMode(): boolean {
  const baseUrl = getPublicBookingBaseUrl();
  // If base URL is NOT the custom booking domain, we're in preview mode
  return !baseUrl.includes(BOOKING_DOMAIN);
}

/**
 * Get the preview URL for display/warning purposes.
 * @returns The preview URL being used
 */
export function getPreviewUrl(): string {
  if (VIBECODE_BACKEND_URL) {
    return VIBECODE_BACKEND_URL.replace(/\/$/, '');
  }
  return FALLBACK_PREVIEW_URL;
}

/**
 * Generate a clean, human-readable slug from a business name.
 *
 * Examples:
 * - "McDowell's" → "mcdowells"
 * - "Barber Love" → "barber-love"
 * - "Ismael Miami Realtor" → "ismael-miami-realtor"
 * - "Joe's Café & Bar" → "joes-cafe-bar"
 *
 * @param businessName - The business name to convert
 * @returns A clean, URL-safe slug
 */
export function generateBusinessSlug(businessName: string): string {
  if (!businessName || typeof businessName !== 'string') {
    return '';
  }

  return businessName
    .toLowerCase()
    .trim()
    // Replace accented characters with their ASCII equivalents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove apostrophes completely (McDowell's → mcdowells)
    .replace(/['`'']/g, '')
    // Replace ampersands with nothing (or could use 'and')
    .replace(/&/g, '')
    // Replace any non-alphanumeric characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Collapse multiple hyphens into one
    .replace(/-+/g, '-');
}

/**
 * Generate the public booking URL for a business.
 * Uses getPublicBookingBaseUrl() as single source of truth.
 *
 * IMPORTANT: Uses businessId (UUID) as the identifier because:
 * 1. The booking_slug may not be set in the database
 * 2. The backend SQL function can look up by UUID via public_booking_token or id
 * 3. Slugs derived from business name may not match what's stored
 *
 * @param businessName - The business name (kept for API compatibility but not used)
 * @param businessId - The business ID (UUID - used as the identifier)
 * @returns The full booking URL (e.g., https://preview-xxx.dev.vibecode.run/5238ceb7-4ced-4524-b347-df4683ab9047)
 */
export function getPublicBookingUrl(
  businessName: string,
  businessId: string
): string {
  // Use businessId directly since booking_slug may not be set in database
  // The backend SQL function supports UUID lookup
  const baseUrl = getPublicBookingBaseUrl();

  return `${baseUrl}/${businessId}`;
}

/**
 * @deprecated Use getPublicBookingBaseUrl() instead
 */
export function getActiveBookingBaseUrl(): string {
  return getPublicBookingBaseUrl();
}

/**
 * Get the booking URL with language preference (internal use only).
 * Note: The language parameter is used internally but should NOT be displayed
 * to users in the UI. The URL shown to users should always be clean.
 *
 * @param businessName - The business name
 * @param businessId - The business ID
 * @param langCode - Optional language code (e.g., 'es', 'fr')
 * @returns The booking URL with optional internal language parameter
 */
export function getBookingUrlWithLanguage(
  businessName: string,
  businessId: string,
  langCode?: string
): string {
  const baseUrl = getPublicBookingUrl(businessName, businessId);

  if (langCode) {
    return `${baseUrl}?lang=${langCode}`;
  }

  return baseUrl;
}

/**
 * Get the display-friendly booking URL (without any query parameters).
 * This is what should be shown to users in the UI.
 *
 * @param businessName - The business name
 * @param businessId - The business ID
 * @returns The clean booking URL for display
 */
export function getDisplayBookingUrl(
  businessName: string,
  businessId: string
): string {
  return getPublicBookingUrl(businessName, businessId);
}

/**
 * Format the booking domain for display.
 * Returns the currently active domain (preview or custom).
 *
 * @returns The domain string
 */
export function getBookingDomain(): string {
  const baseUrl = getPublicBookingBaseUrl();
  try {
    const url = new URL(baseUrl);
    return url.hostname;
  } catch {
    return BOOKING_DOMAIN;
  }
}

/**
 * Generate a shareable booking URL.
 * Includes language parameter if specified (for sharing specific language links).
 *
 * @param businessName - The business name
 * @param businessId - The business ID
 * @param langCode - Optional language code
 * @returns The shareable booking URL
 */
export function getShareableBookingUrl(
  businessName: string,
  businessId: string,
  langCode?: string
): string {
  return getBookingUrlWithLanguage(businessName, businessId, langCode);
}

// Export constants for legacy compatibility
export const PREVIEW_BOOKING_BASE_URL = getPreviewUrl();
export const USE_PREVIEW_MODE = isUsingPreviewMode();
