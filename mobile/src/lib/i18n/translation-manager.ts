/**
 * Optimized Translation Manager
 *
 * Performance optimizations:
 * - All languages are statically imported (required due to Metro bundler config)
 * - Caches loaded translations in memory
 * - Language preference is persisted via AsyncStorage (handled by Zustand store)
 *
 * Note: Dynamic imports are broken by Metro config with unstable_enablePackageExports,
 * so we use static imports for all languages.
 */

import { Language } from '../types';
import { TranslationStrings } from './types';

// In-memory cache for active translations — pre-populated with English so isLanguageLoaded
// returns true immediately on cold start and the loading spinner never blocks the app.
let cachedLanguage: Language = 'en';
let cachedTranslations: TranslationStrings | null = null; // populated after static imports load below

// Static imports for all languages
import { en } from './translations/en';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { pt } from './translations/pt';
import { de } from './translations/de';
import { ht } from './translations/ht';
import { it } from './translations/it';
import { nl } from './translations/nl';
import { sv } from './translations/sv';
import { no } from './translations/no';
import { da } from './translations/da';
import { fi } from './translations/fi';
import { is } from './translations/is';
import { ru } from './translations/ru';
import { tr } from './translations/tr';
import { zh } from './translations/zh';
import { ko } from './translations/ko';
import { ja } from './translations/ja';

// Static map of all translations
const allTranslations: Record<Language, TranslationStrings> = {
  en, es, fr, pt, de, ht, it, nl, sv, no, da, fi, is, ru, tr, zh, ko, ja,
};

// Eagerly populate the cache with English so the very first isLanguageLoaded('en') call
// returns true — this prevents the loading spinner from ever blocking the app on cold start.
cachedTranslations = en;

/**
 * Get translations for a specific language (synchronous)
 * Since all translations are statically imported, this is always instant
 */
export function getTranslationsForLanguage(language: Language): TranslationStrings {
  return allTranslations[language] || en;
}

/**
 * Translate a key for a specific language (synchronous)
 * This bypasses the cache and gets translations directly from the static map
 */
export function translateSync(key: keyof TranslationStrings, language: Language): string {
  const translations = allTranslations[language] || en;
  return translations[key] ?? '';
}

/**
 * Load translations for a specific language
 * With static imports, this is synchronous but returns a Promise for API consistency
 */
export async function loadLanguage(language: Language): Promise<TranslationStrings> {
  // Return cached if already loaded
  if (cachedLanguage === language && cachedTranslations) {
    return cachedTranslations;
  }

  // Get translations from static map
  const translations = allTranslations[language];

  if (!translations) {
    // Fallback to English for unknown languages
    console.warn(`[TranslationManager] No translations for language: ${language}`);
    cachedLanguage = 'en';
    cachedTranslations = en;
    return en;
  }

  // Cache the new language
  cachedLanguage = language;
  cachedTranslations = translations;

  return translations;
}

/**
 * Get currently cached translations (synchronous)
 * Returns English if nothing cached yet
 */
export function getCachedTranslations(): TranslationStrings {
  return cachedTranslations || en;
}

/**
 * Get currently cached language
 */
export function getCachedLanguage(): Language {
  return cachedLanguage;
}

/**
 * Synchronous translation function that uses cached translations
 * For use in render functions where async is not possible
 */
export function translate(key: keyof TranslationStrings): string {
  const translations = getCachedTranslations();
  return translations[key] ?? '';
}

/**
 * Check if a language is currently loaded
 */
export function isLanguageLoaded(language: Language): boolean {
  return cachedLanguage === language && cachedTranslations !== null;
}

/**
 * Preload a language in the background (for smoother UX)
 * With static imports, this is a no-op since all languages are already loaded
 */
export async function preloadLanguage(language: Language): Promise<void> {
  // No-op with static imports - all languages already available
}

/**
 * Clear the translation cache (for memory management)
 * Resets to English
 */
export function clearCache(): void {
  cachedLanguage = 'en';
  cachedTranslations = en;
}
