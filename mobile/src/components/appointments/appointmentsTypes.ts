import type { AppointmentLifecycleStatus } from '@/hooks/useAppointments';

// Local appointment type for UI compatibility
export interface LocalAppointment {
  id: string;
  userId: string;
  clientId: string;
  storeId: string;
  staffId?: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number;
  title: string;
  notes?: string;
  amount?: number;
  currency?: string;
  promotionId?: string;
  serviceTags?: string[];
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number; // In dollars (converted from cents)
  serviceColor?: string;
  // Joined data from related tables
  storeName?: string;
  staffName?: string;
  // Denormalized customer name (for online bookings where client may not be in loaded clients list)
  customerName?: string;
  // Recurring appointment fields
  seriesId?: string;
  seriesOccurrenceIndex?: number;
  cancelled: boolean;
  deleted: boolean;
  // Lifecycle
  lifecycleStatus: AppointmentLifecycleStatus;
  checkedInAt?: Date;
  completedAt?: Date;
  outcomeConfirmedAt?: Date;
  // Gift card
  giftCardIntent: boolean;
  giftCardId?: string;
  giftCardDebited: boolean;
  // Log Visit — true when logged retroactively (not a scheduled booking)
  isLogVisit: boolean;
  // Confirmation code (from DB)
  confirmationCode?: string;
  // Gift card code parsed from notes (online bookings)
  giftCardCodeFromNotes?: string;
  // Cents-based pricing (most accurate for online bookings)
  subtotalCents?: number | null;
  totalCents?: number | null;
}

// Local staff type for UI compatibility
export interface LocalStaff {
  id: string;
  name: string;
  color: string;
  storeIds: string[];
  photoUrl?: string | null;
}

// Local store type for UI compatibility
export interface LocalStore {
  id: string;
  name: string;
}

// Extended appointment type with denormalized search metadata
export interface SearchableAppointment extends LocalAppointment {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}
