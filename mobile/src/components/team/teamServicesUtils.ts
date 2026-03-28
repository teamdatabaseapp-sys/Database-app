import { format } from 'date-fns';
import type { StoreHoursDay } from '@/services/storesService';

// ============================================
// Constants
// ============================================

export const STAFF_COLORS = [
  '#0D9488', '#F97316', '#8B5CF6', '#EC4899', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#84CC16', '#A855F7',
];

// Day names indexed by day_of_week (0=Sunday)
export const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// Default store hours: Mon-Fri 9-5, Sat 10-4, Sun closed
export const getDefaultStoreHours = (): StoreHoursDay[] => [
  { day_of_week: 0, open_time: '09:00', close_time: '17:00', is_closed: true },  // Sunday
  { day_of_week: 1, open_time: '09:00', close_time: '17:00', is_closed: false }, // Monday
  { day_of_week: 2, open_time: '09:00', close_time: '17:00', is_closed: false }, // Tuesday
  { day_of_week: 3, open_time: '09:00', close_time: '17:00', is_closed: false }, // Wednesday
  { day_of_week: 4, open_time: '09:00', close_time: '17:00', is_closed: false }, // Thursday
  { day_of_week: 5, open_time: '09:00', close_time: '17:00', is_closed: false }, // Friday
  { day_of_week: 6, open_time: '10:00', close_time: '16:00', is_closed: false }, // Saturday
];

// Parse time string (HH:MM) to Date for picker
export const parseTimeToDate = (timeStr: string): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 9, minutes || 0, 0, 0);
  return date;
};

// Format Date to time string (HH:MM)
export const formatDateToTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Format time for display (e.g., "9:00 AM")
export const formatTimeForDisplay = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Format phone number for display (US format: (XXX) XXX-XXXX)
// If exactly 10 digits, formats as US number; otherwise keeps as-is for international
export const formatPhoneNumber = (phone: string): string => {
  // Strip all non-numeric characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with + or has more than 10 digits, treat as international
  if (cleaned.startsWith('+') || cleaned.replace(/\D/g, '').length > 10) {
    return phone;
  }

  // Strip to just digits
  const digits = cleaned.replace(/\D/g, '');

  // If exactly 10 digits, format as US phone number
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Otherwise, return the original input
  return phone;
};

// Instant phone formatting as user types
export const formatPhoneAsTyped = (text: string, previousText: string): string => {
  // If user is deleting, just return the text as-is
  if (text.length < previousText.length) {
    return text;
  }

  // If starts with + treat as international, no formatting
  if (text.startsWith('+')) {
    return text;
  }

  // Strip to just digits
  const digits = text.replace(/\D/g, '');

  // If more than 10 digits, treat as international
  if (digits.length > 10) {
    return text;
  }

  // Format as US phone as user types
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Format date for blackout display
export const formatBlackoutDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
};

export type TabType = 'stores' | 'staff';

// ============================================
// Helper Functions
// ============================================

export const getStaffInitials = (name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName) return '?';
  const parts = trimmedName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase();
};

// ============================================
// Types
// ============================================

export interface TeamServicesScreenProps {
  visible: boolean;
  onClose: () => void;
  embedded?: boolean;
  layout?: 'tabbed' | 'unified';
  setupHint?: string;
  highlightActive?: boolean;
}
