/**
 * Legal Content Lazy Loader
 *
 * Optimizes memory usage by:
 * - Loading legal content only when needed (e.g., when Terms modal opens)
 * - Caching loaded content in memory
 * - Supporting language-specific content
 */

import { Language } from './types';

// Cache for loaded legal content
const legalContentCache = new Map<string, string>();

// Available legal document types
export type LegalDocumentType =
  | 'termsOfService'
  | 'legalDisclaimer'
  | 'limitationOfLiability'
  | 'arbitrationAgreement'
  | 'indemnification'
  | 'privacyPolicy'
  | 'dripCampaignTerms'
  | 'euComplianceAddendum';

/**
 * Lazy load legal content for a specific language
 * Caches result for instant subsequent access
 */
export async function loadLegalContent(
  documentType: LegalDocumentType,
  language: Language
): Promise<string> {
  const cacheKey = `${documentType}_${language}`;

  // Return from cache if available
  if (legalContentCache.has(cacheKey)) {
    return legalContentCache.get(cacheKey)!;
  }

  // Dynamic import of legal content
  const legalModule = await import('./legal-content');

  // Get the appropriate content based on type and language
  let content: string;

  switch (documentType) {
    case 'termsOfService':
      content = getLocalizedContent(legalModule, 'TERMS_OF_SERVICE', language);
      break;
    case 'legalDisclaimer':
      content = getLocalizedContent(legalModule, 'LEGAL_DISCLAIMER', language);
      break;
    case 'limitationOfLiability':
      content = getLocalizedContent(legalModule, 'LIMITATION_OF_LIABILITY', language);
      break;
    case 'arbitrationAgreement':
      content = getLocalizedContent(legalModule, 'ARBITRATION_AGREEMENT', language);
      break;
    case 'indemnification':
      content = getLocalizedContent(legalModule, 'INDEMNIFICATION', language);
      break;
    case 'privacyPolicy':
      content = getLocalizedContent(legalModule, 'PRIVACY_POLICY', language);
      break;
    case 'dripCampaignTerms':
      content = legalModule.DRIP_CAMPAIGN_TERMS || '';
      break;
    case 'euComplianceAddendum':
      content = legalModule.EU_DRIP_CAMPAIGN_TERMS_ADDENDUM || '';
      break;
    default:
      content = '';
  }

  // Cache the result
  legalContentCache.set(cacheKey, content);

  return content;
}

/**
 * Get localized content with fallback to English
 */
function getLocalizedContent(
  module: Record<string, unknown>,
  baseKey: string,
  language: Language
): string {
  // Language suffix mapping
  const languageSuffixes: Partial<Record<Language, string>> = {
    es: '_ES',
    fr: '_FR',
    pt: '_PT',
    de: '_DE',
    it: '_IT',
    nl: '_NL',
    sv: '_SV',
    no: '_NO',
    da: '_DA',
    fi: '_FI',
    is: '_IS',
    ru: '_RU',
    tr: '_TR',
    zh: '_ZH',
    ko: '_KO',
    ja: '_JA',
  };

  // Try localized version first
  if (language !== 'en') {
    const suffix = languageSuffixes[language];
    if (suffix) {
      const localizedKey = `${baseKey}${suffix}`;
      if (typeof module[localizedKey] === 'string') {
        return module[localizedKey] as string;
      }
    }
  }

  // Fallback to English
  return (module[baseKey] as string) || '';
}

/**
 * Clear legal content cache (for memory management)
 */
export function clearLegalContentCache(): void {
  legalContentCache.clear();
}

/**
 * Preload all legal content for a language (useful before opening Terms modal)
 */
export async function preloadLegalContent(language: Language): Promise<void> {
  const documentTypes: LegalDocumentType[] = [
    'termsOfService',
    'legalDisclaimer',
    'limitationOfLiability',
    'arbitrationAgreement',
    'indemnification',
    'privacyPolicy',
  ];

  await Promise.all(documentTypes.map((type) => loadLegalContent(type, language)));
}
