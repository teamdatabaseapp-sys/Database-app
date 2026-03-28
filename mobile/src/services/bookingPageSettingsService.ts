/**
 * Booking Page Settings Service
 *
 * Manages language configuration for public booking pages.
 * Uses backend API for persistence to avoid direct Supabase schema issues.
 */

import { Language } from '@/lib/i18n/types';

// ============================================
// Types
// ============================================

export interface SocialLinks {
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  custom?: string;
}

export interface BookingPageSettings {
  business_id: string;
  enabled_locales: Language[];
  default_locale: Language;
  smart_language_detection: boolean;
  social_links: SocialLinks;
  updated_at: string;
}

export interface BookingPageSettingsInput {
  enabled_locales: Language[];
  default_locale: Language;
  smart_language_detection: boolean;
  social_links?: SocialLinks;
}

interface ServiceResult<T> {
  data: T | null;
  error: Error | null;
}

// ============================================
// Constants
// ============================================

export const DEFAULT_BOOKING_PAGE_SETTINGS: BookingPageSettingsInput = {
  enabled_locales: ['en'],
  default_locale: 'en',
  smart_language_detection: true,
  social_links: {},
};

// All available locales for booking page (English first, then sorted alphabetically by nativeName)
export const AVAILABLE_BOOKING_LOCALES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
];

// ============================================
// Backend API URL
// ============================================

function getBackendUrl(): string {
  // Use Vibecode backend URL for API calls
  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    // Remove trailing slash if present
    return backendUrl.replace(/\/$/, '');
  }
  // Fallback for local development
  return 'http://localhost:3000';
}

// ============================================
// Service Operations
// ============================================

/**
 * Get booking page settings for a business
 * Returns default settings if none exist
 */
export async function getBookingPageSettings(
  businessId: string
): Promise<ServiceResult<BookingPageSettings>> {
  try {
    console.log('[BookingPageSettings] getBookingPageSettings called:', { businessId });

    if (!businessId) {
      console.log('[BookingPageSettings] No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    const backendUrl = getBackendUrl();
    console.log('[BookingPageSettings] Fetching from:', `${backendUrl}/api/booking/settings/${businessId}`);

    const response = await fetch(`${backendUrl}/api/booking/settings/${businessId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.log('[BookingPageSettings] API error:', result.error || 'Unknown error');
      // Return defaults on error
      return {
        data: {
          business_id: businessId,
          ...DEFAULT_BOOKING_PAGE_SETTINGS,
          social_links: DEFAULT_BOOKING_PAGE_SETTINGS.social_links ?? {},
          updated_at: new Date().toISOString(),
        },
        error: null,
      };
    }

    if (result.data) {
      console.log('[BookingPageSettings] Settings fetched successfully');
      return { data: result.data as BookingPageSettings, error: null };
    }

    // Return defaults if no data
    return {
      data: {
        business_id: businessId,
        ...DEFAULT_BOOKING_PAGE_SETTINGS,
        social_links: DEFAULT_BOOKING_PAGE_SETTINGS.social_links ?? {},
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  } catch (err) {
    console.log('[BookingPageSettings] Unexpected error:', err);
    // Return defaults on network error
    return {
      data: {
        business_id: businessId,
        ...DEFAULT_BOOKING_PAGE_SETTINGS,
        social_links: DEFAULT_BOOKING_PAGE_SETTINGS.social_links ?? {},
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  }
}

/**
 * Create or update booking page settings for a business
 * Uses backend API for persistence
 */
export async function upsertBookingPageSettings(
  businessId: string,
  settings: BookingPageSettingsInput
): Promise<ServiceResult<BookingPageSettings>> {
  try {
    console.log('[BookingPageSettings] upsertBookingPageSettings called:', { businessId, settings });

    if (!businessId) {
      console.log('[BookingPageSettings] No businessId provided');
      return { data: null, error: new Error('No business ID provided') };
    }

    // Apply defaults for undefined values
    const enabledLocales = settings.enabled_locales ?? ['en'];
    const defaultLocale = settings.default_locale ?? 'en';
    const smartLanguageDetection = settings.smart_language_detection ?? true;
    const socialLinks = settings.social_links ?? {};

    // Validate: enabled_locales must contain 'en'
    if (!enabledLocales.includes('en')) {
      return { data: null, error: new Error('English must always be enabled') };
    }

    // Validate: default_locale must be in enabled_locales
    if (!enabledLocales.includes(defaultLocale)) {
      return { data: null, error: new Error('Default language must be one of the enabled languages') };
    }

    const backendUrl = getBackendUrl();
    console.log('[BookingPageSettings] Saving to:', `${backendUrl}/api/booking/settings/${businessId}`);

    const response = await fetch(`${backendUrl}/api/booking/settings/${businessId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enabled_locales: enabledLocales,
        default_locale: defaultLocale,
        smart_language_detection: smartLanguageDetection,
        social_links: socialLinks,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.log('[BookingPageSettings] API error:', result.error || 'Unknown error', result.code);

      // Return specific error messages
      if (result.code === 'TABLE_NOT_FOUND') {
        return {
          data: null,
          error: new Error('Booking settings not configured. Please contact support.'),
        };
      }
      if (result.code === 'SCHEMA_MISMATCH') {
        return {
          data: null,
          error: new Error('Database needs updating. Please contact support.'),
        };
      }

      return {
        data: null,
        error: new Error(result.error || 'Failed to save settings'),
      };
    }

    if (result.data) {
      console.log('[BookingPageSettings] Settings saved successfully');
      return { data: result.data as BookingPageSettings, error: null };
    }

    // Construct response if API didn't return data
    return {
      data: {
        business_id: businessId,
        enabled_locales: enabledLocales,
        default_locale: defaultLocale,
        smart_language_detection: smartLanguageDetection,
        social_links: settings.social_links ?? {},
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  } catch (err) {
    console.log('[BookingPageSettings] Unexpected error:', err);
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to save booking page settings'),
    };
  }
}

/**
 * Update only enabled locales
 */
export async function updateEnabledLocales(
  businessId: string,
  enabledLocales: Language[]
): Promise<ServiceResult<BookingPageSettings>> {
  try {
    // First get current settings
    const { data: currentSettings, error: fetchError } = await getBookingPageSettings(businessId);

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    // Validate: must contain 'en'
    if (!enabledLocales.includes('en')) {
      return { data: null, error: new Error('English must always be enabled') };
    }

    // If current default is no longer enabled, reset to 'en'
    const newDefaultLocale = enabledLocales.includes(currentSettings?.default_locale ?? 'en')
      ? (currentSettings?.default_locale ?? 'en')
      : 'en';

    return upsertBookingPageSettings(businessId, {
      enabled_locales: enabledLocales,
      default_locale: newDefaultLocale,
      smart_language_detection: currentSettings?.smart_language_detection ?? true,
      social_links: currentSettings?.social_links ?? {},
    });
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update enabled locales'),
    };
  }
}

/**
 * Update default locale
 */
export async function updateDefaultLocale(
  businessId: string,
  defaultLocale: Language
): Promise<ServiceResult<BookingPageSettings>> {
  try {
    // First get current settings
    const { data: currentSettings, error: fetchError } = await getBookingPageSettings(businessId);

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    // Validate: default must be in enabled
    const enabledLocales = currentSettings?.enabled_locales ?? ['en'];
    if (!enabledLocales.includes(defaultLocale)) {
      return { data: null, error: new Error('Default language must be one of the enabled languages') };
    }

    return upsertBookingPageSettings(businessId, {
      enabled_locales: enabledLocales,
      default_locale: defaultLocale,
      smart_language_detection: currentSettings?.smart_language_detection ?? true,
      social_links: currentSettings?.social_links ?? {},
    });
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update default locale'),
    };
  }
}

/**
 * Update smart language detection setting
 */
export async function updateSmartLanguageDetection(
  businessId: string,
  enabled: boolean
): Promise<ServiceResult<BookingPageSettings>> {
  try {
    // First get current settings
    const { data: currentSettings, error: fetchError } = await getBookingPageSettings(businessId);

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    return upsertBookingPageSettings(businessId, {
      enabled_locales: currentSettings?.enabled_locales ?? ['en'],
      default_locale: currentSettings?.default_locale ?? 'en',
      smart_language_detection: enabled,
      social_links: currentSettings?.social_links ?? {},
    });
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update smart language detection'),
    };
  }
}

/**
 * Determine the best locale for the booking page based on settings
 * Used on the public booking page
 */
export function resolveBookingPageLocale(
  settings: BookingPageSettings,
  deviceLocale?: string,
  urlLocale?: string
): Language {
  // Priority 1: URL parameter (if enabled)
  if (urlLocale) {
    const normalizedUrlLocale = normalizeLocale(urlLocale);
    if (settings.enabled_locales.includes(normalizedUrlLocale)) {
      return normalizedUrlLocale;
    }
  }

  // Priority 2: Smart language detection (device/browser locale)
  if (settings.smart_language_detection && deviceLocale) {
    const normalizedDeviceLocale = normalizeLocale(deviceLocale);
    if (settings.enabled_locales.includes(normalizedDeviceLocale)) {
      return normalizedDeviceLocale;
    }
  }

  // Priority 3: Default locale
  if (settings.enabled_locales.includes(settings.default_locale)) {
    return settings.default_locale;
  }

  // Final fallback: English
  return 'en';
}

/**
 * Normalize a locale string to base language code
 * e.g., 'es-ES' -> 'es', 'en-US' -> 'en'
 */
function normalizeLocale(locale: string): Language {
  const baseLocale = locale.split('-')[0].toLowerCase();
  // Check if it's a valid Language type
  const validLanguages: Language[] = ['en', 'es', 'fr', 'pt', 'de', 'ht', 'it', 'nl', 'sv', 'no', 'da', 'fi', 'is', 'ru', 'tr', 'zh', 'ko', 'ja'];
  return validLanguages.includes(baseLocale as Language) ? (baseLocale as Language) : 'en';
}
