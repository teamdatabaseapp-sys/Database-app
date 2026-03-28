/**
 * Gift Card Legal Compliance Engine
 *
 * Enforces mandatory gift card expiration rules based on business country.
 * This is system-enforced and NOT user-configurable.
 *
 * USA (Federal — CARD Act of 2009):
 *   Gift cards may not expire earlier than 5 years from activation date.
 *   15 U.S.C. § 1693l-1
 *
 * EU / EEA (EU Consumer Rights Directive + national laws):
 *   No pan-EU minimum, but Directive 2011/83/EU requires fair terms.
 *   We enforce a 2-year minimum (conservative, covers most national laws).
 *   Some countries have stricter rules (e.g., Ireland: indefinite for balance).
 *
 * UK (Consumer Rights Act 2015):
 *   No statutory minimum, but 2-year minimum is standard safe practice.
 *
 * Canada:
 *   Federal FCAC regulations: no expiry on most gift cards sold after
 *   November 1, 2013. We enforce 5-year minimum as a safe default.
 *
 * Australia (ACCC):
 *   As of 1 November 2019: gift cards must be valid for at least 3 years.
 */

import { CountryCode } from './types';

export type GiftCardComplianceRegion =
  | 'us'
  | 'canada'
  | 'australia'
  | 'eu'
  | 'uk'
  | 'generic';

export interface GiftCardExpirationRule {
  region: GiftCardComplianceRegion;
  /** Minimum months allowed. null = no expiration is the only valid legal option (Canada) */
  minMonths: number | null;
  /** Allowed expiration options in months, or null to force no-expiry only */
  allowedMonths: number[] | null;
  /** Whether "no expiration" is always required (no finite expiry allowed) */
  noExpiryOnly: boolean;
  /** Whether "no expiration" option is available */
  noExpiryAllowed: boolean;
}

/** EU/EEA member states */
export const EU_COUNTRIES: CountryCode[] = [
  'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'AT', 'IE', 'LU',
  'SE', 'DK', 'FI', 'PL', 'IS', 'NO',
];

/** Countries with strict no-expiry rules (Canada federal) */
const NO_EXPIRY_REQUIRED_COUNTRIES: CountryCode[] = ['CA'];

/**
 * Returns the compliance region for a given country code.
 */
export function getGiftCardComplianceRegion(
  countryCode: CountryCode | string | undefined | null
): GiftCardComplianceRegion {
  if (!countryCode) return 'generic';
  const code = countryCode as CountryCode;
  if (code === 'US') return 'us';
  if (code === 'GB') return 'uk';
  if (NO_EXPIRY_REQUIRED_COUNTRIES.includes(code)) return 'canada';
  if (code === 'AU' || code === 'NZ') return 'australia';
  if (EU_COUNTRIES.includes(code)) return 'eu';
  return 'generic';
}

/**
 * Returns the expiration rule for a given compliance region.
 */
export function getExpirationRule(region: GiftCardComplianceRegion): GiftCardExpirationRule {
  switch (region) {
    case 'us':
      // CARD Act: minimum 5 years. Options: no expiry or 5 years only.
      return {
        region: 'us',
        minMonths: 60,
        allowedMonths: [60],
        noExpiryOnly: false,
        noExpiryAllowed: true,
      };

    case 'canada':
      // FCAC: most gift cards cannot expire. Enforce no-expiry only.
      return {
        region: 'canada',
        minMonths: null,
        allowedMonths: null,
        noExpiryOnly: true,
        noExpiryAllowed: true,
      };

    case 'australia':
      // ACCC: minimum 3 years.
      return {
        region: 'australia',
        minMonths: 36,
        allowedMonths: [36, 48, 60],
        noExpiryOnly: false,
        noExpiryAllowed: true,
      };

    case 'eu':
      // Conservative 2-year minimum for EU consumer protection compliance.
      return {
        region: 'eu',
        minMonths: 24,
        allowedMonths: [24, 36, 60],
        noExpiryOnly: false,
        noExpiryAllowed: true,
      };

    case 'uk':
      // Conservative 2-year minimum under Consumer Rights Act 2015.
      return {
        region: 'uk',
        minMonths: 24,
        allowedMonths: [24, 36, 60],
        noExpiryOnly: false,
        noExpiryAllowed: true,
      };

    default:
      // No legal constraint. Use original options.
      return {
        region: 'generic',
        minMonths: null,
        allowedMonths: [3, 6, 12, 24],
        noExpiryOnly: false,
        noExpiryAllowed: true,
      };
  }
}

/**
 * Returns the full rule for a given business country.
 */
export function getGiftCardRuleForCountry(
  countryCode: CountryCode | string | undefined | null
): GiftCardExpirationRule {
  const region = getGiftCardComplianceRegion(countryCode);
  return getExpirationRule(region);
}

/**
 * Validates an expiration date (or null = no expiry) against the rule.
 * Returns null if valid, or an error key if invalid.
 */
export function validateGiftCardExpiration(
  expiresAt: Date | null | undefined,
  countryCode: CountryCode | string | undefined | null,
  activationDate: Date = new Date()
): 'giftCardExpirationTooShort' | 'giftCardMustNotExpire' | null {
  const rule = getGiftCardRuleForCountry(countryCode);

  // No expiry chosen — always valid unless noExpiryOnly means we force no-expiry
  // but that's still no-expiry, so it's always valid.
  if (!expiresAt) return null;

  // Canada: no expiry only — any finite date is illegal
  if (rule.noExpiryOnly) {
    return 'giftCardMustNotExpire';
  }

  // Check minimum duration
  if (rule.minMonths !== null) {
    const minMs = rule.minMonths * 30.44 * 24 * 60 * 60 * 1000; // approximate
    const durationMs = expiresAt.getTime() - activationDate.getTime();
    if (durationMs < minMs) {
      return 'giftCardExpirationTooShort';
    }
  }

  return null;
}

/**
 * Clamps an expiresAt to the legal minimum for a country.
 * If the proposed date is before the minimum, returns the minimum date.
 * If country requires no-expiry, returns null.
 */
export function clampExpirationToLegalMinimum(
  proposedExpiresAt: Date | null | undefined,
  countryCode: CountryCode | string | undefined | null,
  activationDate: Date = new Date()
): Date | null {
  const rule = getGiftCardRuleForCountry(countryCode);

  // Canada: must be no-expiry
  if (rule.noExpiryOnly) return null;

  // No expiry chosen — always allowed
  if (!proposedExpiresAt) return null;

  // Clamp to minimum
  if (rule.minMonths !== null) {
    const minDate = new Date(activationDate);
    minDate.setMonth(minDate.getMonth() + rule.minMonths);
    if (proposedExpiresAt < minDate) return minDate;
  }

  return proposedExpiresAt;
}
