import { Language, TranslationStrings, SUPPORTED_LANGUAGES, isRTL } from './types';
import type { Locale } from 'date-fns';

// Cache for loaded translations
const translationCache: Partial<Record<Language, TranslationStrings>> = {};

// Dynamic imports for each language
const languageLoaders: Record<Language, () => Promise<{ default?: TranslationStrings; [key: string]: TranslationStrings | undefined }>> = {
  en: () => import('./translations/en'),
  es: () => import('./translations/es'),
  fr: () => import('./translations/fr'),
  pt: () => import('./translations/pt'),
  de: () => import('./translations/de'),
  ht: () => import('./translations/ht'),
  ru: () => import('./translations/ru'),
  ko: () => import('./translations/ko'),
  ja: () => import('./translations/ja'),
  zh: () => import('./translations/zh'),
  tr: () => import('./translations/tr'),
  sv: () => import('./translations/sv'),
  no: () => import('./translations/no'),
  da: () => import('./translations/da'),
  fi: () => import('./translations/fi'),
  is: () => import('./translations/is'),
  nl: () => import('./translations/nl'),
  it: () => import('./translations/it'),
};

// English translations are always loaded as fallback
let englishTranslations: TranslationStrings | null = null;

/**
 * Load English translations (used as fallback)
 */
export async function loadEnglishTranslations(): Promise<TranslationStrings> {
  if (englishTranslations) {
    return englishTranslations;
  }
  const module = await languageLoaders.en();
  englishTranslations = module.en || (module.default as TranslationStrings);
  translationCache.en = englishTranslations;
  return englishTranslations;
}

/**
 * Load translations for a specific language
 * Falls back to English if the language is not available
 */
export async function loadTranslations(language: Language): Promise<TranslationStrings> {
  // Return from cache if already loaded
  if (translationCache[language]) {
    return translationCache[language]!;
  }

  // Ensure English is loaded as fallback
  const english = await loadEnglishTranslations();

  // If requesting English, return it
  if (language === 'en') {
    return english;
  }

  try {
    const loader = languageLoaders[language];
    if (!loader) {
      console.warn(`Language loader not found for: ${language}, falling back to English`);
      return english;
    }

    const module = await loader();
    // Handle both named exports (e.g., { es: ... }) and default exports
    const translations = module[language] || module.default;

    if (!translations) {
      console.warn(`Translations not found for: ${language}, falling back to English`);
      return english;
    }

    // Cache the loaded translations
    translationCache[language] = translations as TranslationStrings;
    return translations as TranslationStrings;
  } catch (error) {
    console.error(`Error loading translations for ${language}:`, error);
    return english;
  }
}

/**
 * Get a translation for a specific key
 * Returns the key itself if translation is not found
 */
export function getTranslation(
  translations: TranslationStrings,
  key: keyof TranslationStrings,
  fallback?: TranslationStrings
): string {
  const value = translations[key];
  if (value) {
    return value;
  }

  // Try fallback translations (English)
  if (fallback && fallback[key]) {
    return fallback[key];
  }

  // Return key as last resort
  return key;
}

/**
 * Preload a language (useful for anticipated language switches)
 */
export async function preloadLanguage(language: Language): Promise<void> {
  if (!translationCache[language]) {
    await loadTranslations(language);
  }
}

/**
 * Clear the translation cache (useful for memory management)
 * Keeps English loaded as it's the fallback
 */
export function clearTranslationCache(keepLanguages: Language[] = ['en']): void {
  const languagesToClear = (Object.keys(translationCache) as Language[]).filter(
    (lang) => !keepLanguages.includes(lang)
  );

  for (const lang of languagesToClear) {
    delete translationCache[lang];
  }
}

/**
 * Check if a language is currently cached
 */
export function isLanguageCached(language: Language): boolean {
  return language in translationCache;
}

/**
 * Get all currently cached languages
 */
export function getCachedLanguages(): Language[] {
  return Object.keys(translationCache) as Language[];
}

// Re-export types and utilities
export { SUPPORTED_LANGUAGES, isRTL };
export type { Language, TranslationStrings };

// ─── Synchronous date-fns locale map ───────────────────────────────────────
// Static imports so every locale is available instantly (no async gap).
// This mirrors how translation-manager.ts loads all 18 translation files.
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { pt } from 'date-fns/locale/pt';
import { de } from 'date-fns/locale/de';
import { ru } from 'date-fns/locale/ru';
import { ko } from 'date-fns/locale/ko';
import { ja } from 'date-fns/locale/ja';
import { zhCN } from 'date-fns/locale/zh-CN';
import { tr } from 'date-fns/locale/tr';
import { sv } from 'date-fns/locale/sv';
import { nb } from 'date-fns/locale/nb';
import { da } from 'date-fns/locale/da';
import { fi } from 'date-fns/locale/fi';
import { is } from 'date-fns/locale/is';
import { nl } from 'date-fns/locale/nl';
import { it } from 'date-fns/locale/it';

const staticDateLocales: Record<Language, Locale> = {
  en: enUS,
  es,
  fr,
  pt,
  de,
  ht: fr, // Haitian Creole uses French locale for dates
  ru,
  ko,
  ja,
  zh: zhCN,
  tr,
  sv,
  no: nb,
  da,
  fi,
  is,
  nl,
  it,
};

// Cache for date-fns locales (kept for backwards compatibility with async callers)
const localeCache: Partial<Record<Language, Locale>> = {};

/**
 * Get date-fns locale for a language (async, kept for backwards compat)
 * Now backed by static imports — always resolves instantly, never undefined.
 */
export async function getDateFnsLocale(language: Language): Promise<Locale> {
  const locale = staticDateLocales[language] ?? staticDateLocales.en;
  localeCache[language] = locale;
  return locale;
}

/**
 * Get date-fns locale synchronously — always returns a valid locale.
 * Falls back to English only if language is unrecognised (never happens in practice).
 */
export function getCachedDateFnsLocale(language: Language): Locale {
  return staticDateLocales[language] ?? staticDateLocales.en;
}

/**
 * Preload date-fns locale for a language
 */
export async function preloadDateFnsLocale(language: Language): Promise<void> {
  if (!localeCache[language]) {
    await getDateFnsLocale(language);
  }
}
