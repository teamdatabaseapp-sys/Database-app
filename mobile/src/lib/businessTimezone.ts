/**
 * Business Timezone Utilities
 *
 * All schedule-related logic MUST use these helpers instead of `new Date()`
 * so that "today", "current time", and date comparisons always reflect
 * the business's IANA timezone, not the device's local timezone.
 *
 * CRITICAL: When businessTimezone is undefined/null, we use UTC as a safe
 * fallback — NOT device local time — to avoid silent bugs where a device
 * in a different timezone contaminates schedule calculations.
 */

const SAFE_FALLBACK_TZ = 'UTC';

/**
 * Given an IANA timezone string, return a Date whose *local* fields
 * (getFullYear, getMonth, getDate, getHours, getMinutes) equal what
 * that timezone says "right now" is.
 *
 * Example: if businessTimezone = 'America/New_York' and the UTC clock is
 * 01:15 AM UTC (= 9:15 PM ET), this returns a Date with .getHours() === 21.
 *
 * Falls back to UTC (NOT device time) when timezone is missing.
 */
export function getNowInBusinessTz(businessTimezone: string | undefined | null): Date {
  const tz = businessTimezone || SAFE_FALLBACK_TZ;
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    const year = parseInt(get('year'), 10);
    const month = parseInt(get('month'), 10) - 1;
    const day = parseInt(get('day'), 10);
    let hour = parseInt(get('hour'), 10);
    // Intl sometimes returns 24 for midnight — normalize to 0
    if (hour === 24) hour = 0;
    const minute = parseInt(get('minute'), 10);
    const second = parseInt(get('second'), 10);
    return new Date(year, month, day, hour, minute, second, 0);
  } catch {
    // Last-resort fallback: use UTC fields manually
    const utc = new Date();
    return new Date(
      utc.getUTCFullYear(),
      utc.getUTCMonth(),
      utc.getUTCDate(),
      utc.getUTCHours(),
      utc.getUTCMinutes(),
      utc.getUTCSeconds(),
      0,
    );
  }
}

/**
 * Returns the number of minutes since midnight for a given Date,
 * treating its local fields as the business-tz fields.
 */
export function getMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Returns YYYY-MM-DD for a Date whose local fields represent the business TZ.
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert a day_of_week (0=Mon … 6=Sun) from a Date in business timezone.
 * JS getDay() returns 0=Sun … 6=Sat, so we remap.
 */
export function getDayOfWeekMonZero(date: Date): number {
  const jsDay = date.getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Map country code + US state code to an IANA timezone string.
 * For non-US countries we use the most common/canonical timezone.
 * For US states we use the correct timezone for that state.
 */
export function getTimezoneForCountryState(
  countryCode: string | undefined | null,
  stateCode?: string | undefined | null,
): string | null {
  if (!countryCode) return null;

  const country = countryCode.toUpperCase();

  if (country === 'US') {
    const stateTimezones: Record<string, string> = {
      CT: 'America/New_York',
      DE: 'America/New_York',
      FL: 'America/New_York',
      GA: 'America/New_York',
      ME: 'America/New_York',
      MD: 'America/New_York',
      MA: 'America/New_York',
      MI: 'America/Detroit',
      NH: 'America/New_York',
      NJ: 'America/New_York',
      NY: 'America/New_York',
      NC: 'America/New_York',
      OH: 'America/New_York',
      PA: 'America/New_York',
      RI: 'America/New_York',
      SC: 'America/New_York',
      VT: 'America/New_York',
      VA: 'America/New_York',
      WV: 'America/New_York',
      DC: 'America/New_York',
      IN: 'America/Indiana/Indianapolis',
      KY: 'America/Kentucky/Louisville',
      AL: 'America/Chicago',
      AR: 'America/Chicago',
      IL: 'America/Chicago',
      IA: 'America/Chicago',
      KS: 'America/Chicago',
      LA: 'America/Chicago',
      MN: 'America/Chicago',
      MS: 'America/Chicago',
      MO: 'America/Chicago',
      NE: 'America/Chicago',
      ND: 'America/Chicago',
      OK: 'America/Chicago',
      SD: 'America/Chicago',
      TN: 'America/Chicago',
      TX: 'America/Chicago',
      WI: 'America/Chicago',
      AZ: 'America/Phoenix',
      CO: 'America/Denver',
      ID: 'America/Denver',
      MT: 'America/Denver',
      NM: 'America/Denver',
      UT: 'America/Denver',
      WY: 'America/Denver',
      CA: 'America/Los_Angeles',
      NV: 'America/Los_Angeles',
      OR: 'America/Los_Angeles',
      WA: 'America/Los_Angeles',
      AK: 'America/Anchorage',
      HI: 'Pacific/Honolulu',
    };
    if (stateCode) {
      const tz = stateTimezones[stateCode.toUpperCase()];
      if (tz) return tz;
    }
    return 'America/New_York';
  }

  const countryTimezones: Record<string, string> = {
    CA: 'America/Toronto',
    MX: 'America/Mexico_City',
    GB: 'Europe/London',
    FR: 'Europe/Paris',
    DE: 'Europe/Berlin',
    IT: 'Europe/Rome',
    ES: 'Europe/Madrid',
    PT: 'Europe/Lisbon',
    NL: 'Europe/Amsterdam',
    BE: 'Europe/Brussels',
    CH: 'Europe/Zurich',
    AT: 'Europe/Vienna',
    SE: 'Europe/Stockholm',
    NO: 'Europe/Oslo',
    DK: 'Europe/Copenhagen',
    FI: 'Europe/Helsinki',
    PL: 'Europe/Warsaw',
    RU: 'Europe/Moscow',
    UA: 'Europe/Kiev',
    TR: 'Europe/Istanbul',
    GR: 'Europe/Athens',
    AU: 'Australia/Sydney',
    NZ: 'Pacific/Auckland',
    JP: 'Asia/Tokyo',
    KR: 'Asia/Seoul',
    CN: 'Asia/Shanghai',
    IN: 'Asia/Kolkata',
    SG: 'Asia/Singapore',
    HK: 'Asia/Hong_Kong',
    TW: 'Asia/Taipei',
    TH: 'Asia/Bangkok',
    VN: 'Asia/Ho_Chi_Minh',
    ID: 'Asia/Jakarta',
    PH: 'Asia/Manila',
    MY: 'Asia/Kuala_Lumpur',
    AE: 'Asia/Dubai',
    SA: 'Asia/Riyadh',
    IL: 'Asia/Jerusalem',
    EG: 'Africa/Cairo',
    ZA: 'Africa/Johannesburg',
    NG: 'Africa/Lagos',
    KE: 'Africa/Nairobi',
    BR: 'America/Sao_Paulo',
    AR: 'America/Argentina/Buenos_Aires',
    CL: 'America/Santiago',
    CO: 'America/Bogota',
    PE: 'America/Lima',
    VE: 'America/Caracas',
    IS: 'Atlantic/Reykjavik',
    HT: 'America/Port-au-Prince',
  };

  return countryTimezones[country] ?? null;
}
