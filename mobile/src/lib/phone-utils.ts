/**
 * Formats a phone number string with support for US and international formats
 * - US numbers (10 digits): formats as (XXX) XXX-XXXX
 * - International numbers (>10 digits or starts with +): raw digits only
 * @param value - The raw phone number string (may contain non-numeric characters)
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(value: string): string {
  // Check if user is typing an international number (starts with +)
  const startsWithPlus = value.startsWith('+');

  // Remove all non-numeric characters except leading +
  const digitsOnly = value.replace(/\D/g, '');

  // If starts with + or has more than 10 digits, treat as international
  if (startsWithPlus || digitsOnly.length > 10) {
    // For international: keep + prefix and digits only, no formatting
    const prefix = startsWithPlus ? '+' : '';
    return prefix + digitsOnly;
  }

  // US format: (XXX) XXX-XXXX for 10 or fewer digits
  if (digitsOnly.length === 0) {
    return '';
  } else if (digitsOnly.length <= 3) {
    return `(${digitsOnly}`;
  } else if (digitsOnly.length <= 6) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
  } else {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
}

/**
 * Formats a stored phone number for display
 * Handles US numbers, international numbers, and already-formatted numbers
 * @param phone - The phone number to format for display
 * @returns Formatted phone number string
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  // Check if it's an international number (starts with + or has more than 10 digits)
  const startsWithPlus = phone.startsWith('+');
  const digitsOnly = phone.replace(/\D/g, '');

  // International numbers: return with + prefix and raw digits
  if (startsWithPlus || digitsOnly.length > 10) {
    return startsWithPlus ? phone : `+${digitsOnly}`;
  }

  // If we have exactly 10 digits, format as US number
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }

  // If already formatted or different format, return as-is
  return phone;
}

/**
 * Validates a phone number
 * - Allows only digits and optional + prefix
 * - Minimum 7 digits required
 * - No maximum for international numbers
 * @param phone - The phone number to validate
 * @returns true if valid, false otherwise
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return false;

  // Extract digits only (ignore + and formatting characters)
  const digitsOnly = phone.replace(/\D/g, '');

  // Minimum 7 digits required
  return digitsOnly.length >= 7;
}

/**
 * Extracts raw digits from a phone number for dialing
 * @param phone - The formatted phone number
 * @returns Raw digits suitable for tel: URL
 */
export function getDialableNumber(phone: string): string {
  if (!phone) return '';

  // For international numbers starting with +, preserve it
  const startsWithPlus = phone.startsWith('+');
  const digitsOnly = phone.replace(/\D/g, '');

  return startsWithPlus ? `+${digitsOnly}` : digitsOnly;
}
