// Currency & Regional Number Formatting System

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  region: string;
  locale: string; // For number formatting
  decimalSeparator: string;
  thousandsSeparator: string;
  decimalPlaces: number;
  symbolPosition: 'before' | 'after';
}

// Exchange rates relative to USD (1 USD = X currency)
// These are approximate rates for display purposes
export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.12,
  MXN: 17.15,
  BRL: 4.97,
  KRW: 1320,
  SEK: 10.42,
  NOK: 10.65,
  DKK: 6.87,
  RUB: 89.50,
  TRY: 32.15,
  AED: 3.67,
  SAR: 3.75,
  PLN: 3.98,
  ISK: 137.50,
  NZD: 1.64,
  SGD: 1.34,
  HKD: 7.82,
  ZAR: 18.75,
  ARS: 875,
  COP: 3950,
  CLP: 925,
  PEN: 3.72,
  EGP: 30.90,
  MAD: 10.05,
  TWD: 31.50,
};

/**
 * Convert an amount from USD to another currency
 */
export function convertFromUSD(amountUSD: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES[targetCurrency] ?? 1;
  return amountUSD * rate;
}

/**
 * Convert an amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) return amount;

  // Convert to USD first, then to target currency
  const fromRate = EXCHANGE_RATES[fromCurrency] ?? 1;
  const toRate = EXCHANGE_RATES[toCurrency] ?? 1;

  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}

// Supported currencies with regional formatting
export const CURRENCIES: CurrencyInfo[] = [
  {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    region: 'United States',
    locale: 'en-US',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    region: 'Eurozone',
    locale: 'de-DE',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    region: 'United Kingdom',
    locale: 'en-GB',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    region: 'Japan',
    locale: 'ja-JP',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 0,
    symbolPosition: 'before',
  },
  {
    code: 'CAD',
    symbol: '$',
    name: 'Canadian Dollar',
    region: 'Canada',
    locale: 'en-CA',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'AUD',
    symbol: '$',
    name: 'Australian Dollar',
    region: 'Australia',
    locale: 'en-AU',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    region: 'Switzerland',
    locale: 'de-CH',
    decimalSeparator: '.',
    thousandsSeparator: "'",
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    region: 'China',
    locale: 'zh-CN',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    region: 'India',
    locale: 'en-IN',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'MXN',
    symbol: '$',
    name: 'Mexican Peso',
    region: 'Mexico',
    locale: 'es-MX',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    region: 'Brazil',
    locale: 'pt-BR',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'KRW',
    symbol: '₩',
    name: 'South Korean Won',
    region: 'South Korea',
    locale: 'ko-KR',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 0,
    symbolPosition: 'before',
  },
  {
    code: 'SEK',
    symbol: 'kr',
    name: 'Swedish Krona',
    region: 'Sweden',
    locale: 'sv-SE',
    decimalSeparator: ',',
    thousandsSeparator: ' ',
    decimalPlaces: 2,
    symbolPosition: 'after',
  },
  {
    code: 'NOK',
    symbol: 'kr',
    name: 'Norwegian Krone',
    region: 'Norway',
    locale: 'nb-NO',
    decimalSeparator: ',',
    thousandsSeparator: ' ',
    decimalPlaces: 2,
    symbolPosition: 'after',
  },
  {
    code: 'DKK',
    symbol: 'kr',
    name: 'Danish Krone',
    region: 'Denmark',
    locale: 'da-DK',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 2,
    symbolPosition: 'after',
  },
  {
    code: 'RUB',
    symbol: '₽',
    name: 'Russian Ruble',
    region: 'Russia',
    locale: 'ru-RU',
    decimalSeparator: ',',
    thousandsSeparator: ' ',
    decimalPlaces: 2,
    symbolPosition: 'after',
  },
  {
    code: 'TRY',
    symbol: '₺',
    name: 'Turkish Lira',
    region: 'Turkey',
    locale: 'tr-TR',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    region: 'United Arab Emirates',
    locale: 'ar-AE',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'SAR',
    symbol: '﷼',
    name: 'Saudi Riyal',
    region: 'Saudi Arabia',
    locale: 'ar-SA',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'PLN',
    symbol: 'zł',
    name: 'Polish Zloty',
    region: 'Poland',
    locale: 'pl-PL',
    decimalSeparator: ',',
    thousandsSeparator: ' ',
    decimalPlaces: 2,
    symbolPosition: 'after',
  },
  {
    code: 'ISK',
    symbol: 'kr',
    name: 'Icelandic Króna',
    region: 'Iceland',
    locale: 'is-IS',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 0,
    symbolPosition: 'after',
  },
  {
    code: 'NZD',
    symbol: '$',
    name: 'New Zealand Dollar',
    region: 'New Zealand',
    locale: 'en-NZ',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'SGD',
    symbol: '$',
    name: 'Singapore Dollar',
    region: 'Singapore',
    locale: 'en-SG',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'HKD',
    symbol: 'HK$',
    name: 'Hong Kong Dollar',
    region: 'Hong Kong',
    locale: 'zh-HK',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    region: 'South Africa',
    locale: 'en-ZA',
    decimalSeparator: ',',
    thousandsSeparator: ' ',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  // Additional currencies for comprehensive language coverage
  {
    code: 'ARS',
    symbol: '$',
    name: 'Argentine Peso',
    region: 'Argentina',
    locale: 'es-AR',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'COP',
    symbol: '$',
    name: 'Colombian Peso',
    region: 'Colombia',
    locale: 'es-CO',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 0,
    symbolPosition: 'before',
  },
  {
    code: 'CLP',
    symbol: '$',
    name: 'Chilean Peso',
    region: 'Chile',
    locale: 'es-CL',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 0,
    symbolPosition: 'before',
  },
  {
    code: 'PEN',
    symbol: 'S/',
    name: 'Peruvian Sol',
    region: 'Peru',
    locale: 'es-PE',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'EGP',
    symbol: 'E£',
    name: 'Egyptian Pound',
    region: 'Egypt',
    locale: 'ar-EG',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  {
    code: 'MAD',
    symbol: 'د.م.',
    name: 'Moroccan Dirham',
    region: 'Morocco',
    locale: 'ar-MA',
    decimalSeparator: ',',
    thousandsSeparator: '.',
    decimalPlaces: 2,
    symbolPosition: 'after',
  },
  {
    code: 'TWD',
    symbol: 'NT$',
    name: 'Taiwan Dollar',
    region: 'Taiwan',
    locale: 'zh-TW',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    decimalPlaces: 0,
    symbolPosition: 'before',
  },
];

// Simplified currency type for language mapping (no region/locale info)
export interface SimpleCurrency {
  code: string;
  symbol: string;
  name: string;
}

// Language to currencies mapping - currencies commonly used in countries where the language is spoken
import { Language } from './types';

export const LANGUAGE_CURRENCIES: Record<Language, SimpleCurrency[]> = {
  en: [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
    { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
    { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' },
    { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  ],
  es: [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
    { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
    { code: 'COP', symbol: '$', name: 'Colombian Peso' },
    { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
    { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
  ],
  fr: [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
    { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
    { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham' },
  ],
  pt: [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  ],
  de: [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  ],
  ht: [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ],
  it: [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  ],
  nl: [
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ],
  sv: [
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ],
  no: [
    { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ],
  da: [
    { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ],
  fi: [
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ],
  is: [
    { code: 'ISK', symbol: 'kr', name: 'Icelandic Króna' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
  ],
  ru: [
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
  ],
  tr: [
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
  ],
  zh: [
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
    { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar' },
    { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
  ],
  ja: [
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  ],
  ko: [
    { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  ],
};

// Get currencies for a specific language
export function getCurrenciesForLanguage(language: Language): SimpleCurrency[] {
  return LANGUAGE_CURRENCIES[language] || LANGUAGE_CURRENCIES.en;
}

// Get default currency for a language
export function getDefaultCurrencyForLanguage(language: Language): string {
  const currencies = LANGUAGE_CURRENCIES[language];
  return currencies && currencies.length > 0 ? currencies[0].code : 'USD';
}

// Default currency
export const DEFAULT_CURRENCY_CODE = 'USD';

// Get currency info by code
export function getCurrencyByCode(code: string): CurrencyInfo {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

/**
 * Format a number according to regional formatting rules
 */
export function formatNumber(
  value: number,
  currency: CurrencyInfo,
  includeSymbol: boolean = true
): string {
  // Handle invalid values
  if (value === null || value === undefined || isNaN(value)) {
    value = 0;
  }

  // Round to specified decimal places
  const roundedValue = currency.decimalPlaces > 0
    ? value.toFixed(currency.decimalPlaces)
    : Math.round(value).toString();

  // Split into integer and decimal parts
  const [integerPart, decimalPart] = roundedValue.split('.');

  // Format integer part with thousands separators
  const formattedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    currency.thousandsSeparator
  );

  // Combine parts
  let formattedNumber = currency.decimalPlaces > 0 && decimalPart
    ? `${formattedInteger}${currency.decimalSeparator}${decimalPart}`
    : formattedInteger;

  // Add symbol if requested
  if (includeSymbol) {
    if (currency.symbolPosition === 'before') {
      formattedNumber = `${currency.symbol}${formattedNumber}`;
    } else {
      formattedNumber = `${formattedNumber} ${currency.symbol}`;
    }
  }

  return formattedNumber;
}

/**
 * Format a currency value with full regional formatting
 */
export function formatCurrency(
  value: number | undefined | null,
  currencyCode: string
): string {
  const currency = getCurrencyByCode(currencyCode);
  return formatNumber(value || 0, currency, true);
}

/**
 * Format a number without currency symbol (for inputs)
 */
export function formatCurrencyNumber(
  value: number | undefined | null,
  currencyCode: string
): string {
  const currency = getCurrencyByCode(currencyCode);
  return formatNumber(value || 0, currency, false);
}

/**
 * Get just the currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  const currency = getCurrencyByCode(currencyCode);
  return currency.symbol;
}

/**
 * Parse a formatted currency string back to a number
 */
export function parseCurrencyInput(
  input: string,
  currencyCode: string
): number {
  if (!input || input.trim() === '') return 0;

  const currency = getCurrencyByCode(currencyCode);

  // Remove currency symbol and spaces
  let cleaned = input
    .replace(currency.symbol, '')
    .replace(/\s/g, '')
    .trim();

  // Handle regional formatting
  if (currency.decimalSeparator === ',') {
    // European format: 1.234,56 -> 1234.56
    cleaned = cleaned
      .replace(/\./g, '') // Remove thousands separators
      .replace(',', '.'); // Convert decimal separator
  } else {
    // US format: 1,234.56 -> 1234.56
    cleaned = cleaned.replace(/,/g, ''); // Remove thousands separators
  }

  // Also handle other thousands separators
  cleaned = cleaned.replace(/[']/g, ''); // Swiss format

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format input value for display in a text field
 * Returns the symbol and formatted display value
 */
export function formatInputDisplay(
  value: string | number,
  currencyCode: string
): { displayValue: string; symbol: string } {
  const currency = getCurrencyByCode(currencyCode);

  if (typeof value === 'number') {
    return {
      displayValue: formatNumber(value, currency, false),
      symbol: currency.symbol,
    };
  }

  // For string input, just return as-is with symbol
  return {
    displayValue: value,
    symbol: currency.symbol,
  };
}

/**
 * Get display string for currency picker
 */
export function getCurrencyDisplayString(currency: CurrencyInfo): string {
  return `${currency.region} – ${currency.code} (${currency.symbol})`;
}

/**
 * Get all available currencies as a unified list (sorted alphabetically by name)
 * This provides a single, organized list independent of language or country
 */
export function getAllCurrencies(): SimpleCurrency[] {
  // Create unique list from CURRENCIES array, sorted by name
  const uniqueCurrencies = CURRENCIES.map(c => ({
    code: c.code,
    symbol: c.symbol,
    name: c.name,
  }));

  // Sort alphabetically by currency name
  return uniqueCurrencies.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all currencies with full info (for API endpoint structure)
 * Returns JSON-compatible structure: { name, code, symbol }[]
 */
export function getCurrencyListForAPI(): Array<{ name: string; code: string; symbol: string }> {
  return getAllCurrencies().map(c => ({
    name: c.name,
    code: c.code,
    symbol: c.symbol,
  }));
}
