import type { BusinessHours } from '@/services/businessHoursService';

/**
 * Returns true if the given time on the given date falls within the
 * configured business hours for that day. Returns true (permissive) when
 * no hours are configured, so the gate never fires on a misconfigured store.
 */
export function isWithinBusinessHours(
  date: Date,
  time: string, // 'HH:MM' 24-hour format
  businessHours: BusinessHours[]
): boolean {
  // Defensive: empty array / no hours = allow all
  if (!businessHours || businessHours.length === 0) return true;

  // Defensive: invalid date
  if (!date || isNaN(date.getTime())) return true;

  // Defensive: empty or malformed time string — allow rather than block
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return true;

  const dayOfWeek = date.getDay(); // 0 = Sunday … 6 = Saturday
  const dayHours = businessHours.find((h) => h.day_of_week === dayOfWeek);

  if (!dayHours) return true; // day not configured — allow
  if (dayHours.is_closed) return false;

  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const apptMinutes = toMinutes(time);
  const openMinutes = toMinutes(dayHours.open_time);
  const closeMinutes = toMinutes(dayHours.close_time);

  // Guard against NaN from malformed DB values
  if (isNaN(openMinutes) || isNaN(closeMinutes) || isNaN(apptMinutes)) return true;

  return apptMinutes >= openMinutes && apptMinutes < closeMinutes;
}
