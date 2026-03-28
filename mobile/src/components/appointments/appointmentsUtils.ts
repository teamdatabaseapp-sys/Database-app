import { isSameDay, startOfWeek, endOfWeek, isSameMonth, addDays, subDays, isToday } from 'date-fns';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

export type DateRangeMode = 'day' | 'week' | 'month';

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/** Capitalize the first letter of a string. */
export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

/** Capitalize the first letter of every word (space-separated) in a string. */
export const capitalizeDate = (str: string): string =>
  str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Auto-format a raw numeric string into HH:MM by inserting a colon after
 * the first two digits.
 */
export const formatTimeInput = (text: string): string => {
  const digits = text.replace(/[^0-9]/g, '');
  const limitedDigits = digits.slice(0, 4);
  if (limitedDigits.length > 2) {
    return `${limitedDigits.slice(0, 2)}:${limitedDigits.slice(2)}`;
  }
  return limitedDigits;
};

/**
 * Given a start time string ("HH:MM") and a duration in minutes, return the
 * resulting end time string ("HH:MM"). Returns '' if startTime is invalid.
 */
export const calculateEndTime = (startTime: string, durationMinutes: number): string => {
  if (!startTime || startTime.length < 5) return '';
  const [hours, minutes] = startTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '';

  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Date label helpers
// ---------------------------------------------------------------------------

/**
 * Return a human-readable label for the current date or date range.
 * Equivalent to the inline `getDateLabel` in AppointmentsScreen.
 */
export const getDateLabel = ({
  dateRangeMode,
  selectedDate,
  formatWithLocale,
  language,
}: {
  dateRangeMode: DateRangeMode;
  selectedDate: Date;
  formatWithLocale: (date: Date, formatStr: string) => string;
  language: Language;
}): string => {
  if (dateRangeMode === 'week') {
    const weekStart = startOfWeek(selectedDate);
    const weekEnd = endOfWeek(selectedDate);
    if (isSameMonth(weekStart, weekEnd)) {
      return `${formatWithLocale(weekStart, 'MMM d')} - ${formatWithLocale(weekEnd, 'd')}`;
    }
    return `${formatWithLocale(weekStart, 'MMM d')} - ${formatWithLocale(weekEnd, 'MMM d')}`;
  }
  if (dateRangeMode === 'month') {
    return formatWithLocale(selectedDate, 'MMMM yyyy');
  }
  if (isToday(selectedDate)) return t('today', language);
  if (isSameDay(selectedDate, addDays(new Date(), 1))) return t('tomorrow', language);
  if (isSameDay(selectedDate, subDays(new Date(), 1))) return t('yesterday', language);
  return formatWithLocale(selectedDate, 'EEEE');
};

/**
 * Return a translated label for the current date range mode
 * ('Day', 'Week', 'Month').
 */
export const getDateRangeModeLabel = ({
  dateRangeMode,
  language,
}: {
  dateRangeMode: DateRangeMode;
  language: Language;
}): string => {
  switch (dateRangeMode) {
    case 'day':
      return t('dayLabel', language);
    case 'week':
      return t('weekLabel', language);
    case 'month':
      return t('monthLabel', language);
    default:
      return t('dayLabel', language);
  }
};

// ---------------------------------------------------------------------------
// Appointment helpers
// ---------------------------------------------------------------------------

/**
 * Return true if any appointment in the list falls on the given date.
 */
export const dateHasAppointments = (
  date: Date,
  appointments: { date: Date }[]
): boolean => appointments.some((a) => isSameDay(new Date(a.date), date));
