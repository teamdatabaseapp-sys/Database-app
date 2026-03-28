import { Language } from './types';
import { TranslationStrings } from './i18n/types';
import {
  loadLanguage,
  getCachedTranslations,
  isLanguageLoaded,
  translate as translateFromCache,
  translateSync,
} from './i18n/translation-manager';
import { getDateFnsLocale, getCachedDateFnsLocale } from './i18n/index';

// Re-export for backwards compatibility
export type TranslationKey = keyof TranslationStrings;
export type { TranslationStrings };
export { getDateFnsLocale, getCachedDateFnsLocale };

// Import English only for synchronous fallback (always bundled)
import { en } from './i18n/translations/en';

/**
 * Synchronous translation function
 *
 * Performance notes:
 * - Uses direct lookup from statically imported translations
 * - No async overhead - all translations available instantly
 * - Cache is updated in background for consistency
 */
export function t(key: TranslationKey, language: Language): string {
  // Direct synchronous lookup - all translations are statically imported
  // This ensures instant translations regardless of cache state
  return translateSync(key, language);
}

/**
 * Async translation function for cases where you can await
 * Ensures the language is loaded before translating
 */
export async function tAsync(key: TranslationKey, language: Language): Promise<string> {
  const translations = await loadLanguage(language);
  return translations[key] ?? '';
}

/**
 * Initialize/preload a language
 * Call this when language is selected to ensure instant translations
 */
export async function initializeLanguage(language: Language): Promise<void> {
  await loadLanguage(language);
}

/**
 * Get all translations for a language (async)
 */
export async function getTranslations(language: Language): Promise<TranslationStrings> {
  return loadLanguage(language);
}

// Legacy export - deprecated, use loadLanguage instead
// Kept for backwards compatibility but now only returns cached/English
export const translations: Record<Language, TranslationStrings> = new Proxy(
  {} as Record<Language, TranslationStrings>,
  {
    get: (_target, prop: Language) => {
      if (prop === 'en') return en;
      // Return cached or English for other languages
      // This maintains sync access pattern for existing code
      return getCachedTranslations();
    },
  }
);

/**
 * Language to locale mapping for Intl API
 */
const languageToLocale: Record<Language, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-BR',
  de: 'de-DE',
  ht: 'ht-HT',
  ru: 'ru-RU',
  ko: 'ko-KR',
  ja: 'ja-JP',
  zh: 'zh-CN',
  tr: 'tr-TR',
  sv: 'sv-SE',
  no: 'nb-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  is: 'is-IS',
  nl: 'nl-NL',
  it: 'it-IT',
};

/**
 * Format a price according to the user's language/locale
 * Uses the Intl.NumberFormat API for proper localization
 */
export function formatPrice(
  amount: number,
  language: Language,
  currency: string = 'USD'
): string {
  const locale = languageToLocale[language] || 'en-US';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback to simple format if Intl fails
    return `$${amount}`;
  }
}

/**
 * Get the locale string for a language
 */
export function getLocaleForLanguage(language: Language): string {
  return languageToLocale[language] || 'en-US';
}

/**
 * Capitalize the first letter of each word that should be capitalized in a date string.
 * This ensures month names are properly capitalized according to formal grammar rules.
 * For example: "25 de enero de 2026" → "25 de Enero de 2026"
 */
export function capitalizeMonthInDate(dateStr: string, language: Language): string {
  // Languages where months should be capitalized (most languages capitalize months in formal writing)
  // Note: Some languages like Spanish traditionally lowercase months, but formal/business contexts often capitalize them

  // Common month patterns to capitalize (works across most languages)
  // This regex finds words that are likely month names (4+ letters, not prepositions)
  const prepositions = ['de', 'du', 'di', 'von', 'van', 'af', 'av', 'of', 'в', 'من'];

  const words = dateStr.split(' ');
  const capitalizedWords = words.map((word, index) => {
    // Skip numbers, short prepositions, and punctuation
    if (/^\d+[.,]?$/.test(word) || prepositions.includes(word.toLowerCase()) || word.length < 3) {
      return word;
    }

    // For most languages, capitalize the first letter of month names
    // Month names are typically the longest word in the date string (excluding year)
    if (word.length >= 3 && !/^\d{4}$/.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }

    return word;
  });

  return capitalizedWords.join(' ');
}

/**
 * Known default store names in all supported languages.
 * When a store name matches any of these, we should display the translated version.
 * This handles legacy stores created with hardcoded "Main Store" in the database.
 */
const DEFAULT_STORE_NAMES: Record<Language, string> = {
  en: 'Main Store',
  es: 'Tienda Principal',
  fr: 'Magasin Principal',
  de: 'Hauptgeschäft',
  pt: 'Loja Principal',
  it: 'Negozio Principale',
  nl: 'Hoofdwinkel',
  ru: 'Главный магазин',
  ja: 'メインストア',
  ko: '본점',
  zh: '主店',
  tr: 'Ana Mağaza',
  sv: 'Huvudbutik',
  no: 'Hovedbutikk',
  da: 'Hovedbutik',
  fi: 'Pääkauppa',
  is: 'Aðalverslun',
  ht: 'Boutik Prensipal',
};

/**
 * Get the localized store name.
 * If the store name matches any known default store name (in any language),
 * returns the translated version for the current language.
 * Otherwise, returns the original store name.
 *
 * This ensures that legacy stores created with "Main Store" in English
 * are properly displayed in the user's selected language.
 */
export function getLocalizedStoreName(storeName: string | null | undefined, language: Language): string {
  if (!storeName) {
    return t('mainStore', language);
  }

  // Check if the store name matches any known default store name
  const lowerStoreName = storeName.toLowerCase().trim();
  const isDefaultStoreName = Object.values(DEFAULT_STORE_NAMES).some(
    (defaultName) => defaultName.toLowerCase() === lowerStoreName
  );

  if (isDefaultStoreName) {
    return t('mainStore', language);
  }

  // Return original name if not a default store name
  return storeName;
}
