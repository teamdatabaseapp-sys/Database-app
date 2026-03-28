import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput, Linking, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  User,
  UserPlus,
  Search,
  Check,
  Calendar,
  Phone,
  Send,
  Mail,
  MessageCircle,
  AlertCircle,
  ChevronDown,
  Gift,
  Hash,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { SendEmailModal } from './SendEmailModal';
import { StaffManagementScreen } from './StaffManagementScreen';
import { LocalSuccessToast } from './LocalSuccessToast';
import { t, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/currency';
import type { Locale } from 'date-fns';
import { enUS } from 'date-fns/locale';
// Supabase hooks
import {
  useCreateAppointment,
  useCheckAppointmentConflict,
  useCreateAppointmentSeries,
  useCreateAppointmentsFromSeries,
  type CreateSeriesInput,
} from '@/hooks/useAppointments';
import { useStores } from '@/hooks/useStores';
import { useStaffMembers, useStaffForStore } from '@/hooks/useStaff';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { useClients } from '@/hooks/useClients';
import { useBusiness } from '@/hooks/useBusiness';
import { useServices, useSyncAppointmentServices, type SupabaseService } from '@/hooks/useServices';
import { useStaffServiceSkills } from '@/hooks/useStaffServices';
import { useEnsurePromotion } from '@/hooks/usePromotions';
// useLoyalty import removed — points are awarded at completion, not booking
import { useClientPromotionCounters } from '@/hooks/usePromotionCounters';
import { useClientGiftCards } from '@/hooks/useGiftCards';
import type { SupabaseClient } from '@/services/clientsService';
import { notifyAppointmentEmail } from '@/services/appointmentsService';
import type { Client, GiftCard } from '@/lib/types';
import { convertToLegacyClient, isValidUUID } from './book/bookAppointmentUtils';
import { ClientSearchModal } from './book/ClientSearchModal';
import { AddClientForm } from './book/AddClientForm';
import { AppointmentCalendar } from './book/AppointmentCalendar';
import { RecurringSettings, type RecurrenceConfig } from './book/RecurringSettings';
import { StoreStaffRow } from './book/StoreStaffRow';
import { ServiceDurationTime } from './book/ServiceDurationTime';
import { BusinessHoursAlertModal } from './BusinessHoursAlertModal';
import { isWithinBusinessHours } from '@/lib/businessHoursValidation';

interface BookAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  selectedStoreId?: string | null;
}

export function BookAppointmentModal({ visible, onClose, selectedStoreId }: BookAppointmentModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [appointmentTime, setAppointmentTime] = useState('09:00');
  const [appointmentEndTime, setAppointmentEndTime] = useState('10:00');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [giftCardIntent, setGiftCardIntent] = useState(false);
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string | null>(null);
  const [showGiftCardPicker, setShowGiftCardPicker] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [internalSelectedStoreId, setInternalSelectedStoreId] = useState<string | null>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState('60');
  const [showStaffManagement, setShowStaffManagement] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [showBusinessHoursAlert, setShowBusinessHoursAlert] = useState(false);
  const [appointmentAmount, setAppointmentAmount] = useState('');
  const [selectedPromotionId, setSelectedPromotionId] = useState<string | null>(null);
  const [showPromotionPicker, setShowPromotionPicker] = useState(false);
  const [showLocalSuccessToast, setShowLocalSuccessToast] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [servicesRemovedToast, setServicesRemovedToast] = useState(false);

  // Recurring appointment state
  // Recurring config — owned by RecurringSettings, mirrored here for handleSaveAppointment
  const [recurringConfig, setRecurringConfig] = useState<RecurrenceConfig>({
    isRecurring: false,
    recurrenceFrequency: 'weekly',
    recurrenceEndType: 'occurrence_count',
    recurrenceEndDate: null,
    recurrenceCount: '4',
    customIntervalWeeks: '3',
    seriesPreviewData: null,
  });
  const [recurringResetKey, setRecurringResetKey] = useState(0);

  const { colors, isDark, primaryColor, buttonColor } = useTheme();

  // Store (Zustand) - only for non-Supabase data
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);

  // Locale for date formatting (used by recurring section)
  const [dateLocale, setDateLocale] = useState<Locale>(enUS);
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const addMarketingPromotion = useStore((s) => s.addMarketingPromotion);
  const userId = useStore((s) => s.user?.id);

  // Supabase hooks - use the same hooks as ClientListScreen
  const { businessId, isInitialized: businessInitialized } = useBusiness();
  const { data: supabaseClients = [], isLoading: clientsLoading } = useClients();
  const { data: supabaseStores = [], isLoading: storesLoading, isAutoCreating: storesAutoCreating, error: storesError } = useStores();
  const { data: allStaffData = [], isLoading: allStaffLoading, error: allStaffError } = useStaffMembers();

  // Services from Supabase (replaces legacy serviceTags)
  const { data: supabaseServices = [], isLoading: servicesLoading } = useServices();
  const syncAppointmentServicesMutation = useSyncAppointmentServices();

  // Staff-service skills: which services the selected staff member can perform
  const { data: staffServiceSkills = [] } = useStaffServiceSkills(selectedStaffId);

  // Loyalty settings are not needed at booking time — points are awarded on completion only.

  // Zustand staff as fallback when Supabase staff table doesn't exist
  const zustandStaffMembers = useStore((s) => s.staffMembers);
  const zustandUserId = useStore((s) => s.user?.id);
  const zustandStaff = useMemo(() => {
    if (!zustandUserId) return [];
    return zustandStaffMembers.filter((s) => s.userId === zustandUserId);
  }, [zustandStaffMembers, zustandUserId]);

  // Debug: Log client data when modal is visible (per user requirements)
  useEffect(() => {
    if (visible) {
      console.log('[BookAppointmentModal] ========== MODAL OPENED ==========');
      console.log('[BookAppointmentModal] Auth/Business context:');
      console.log('  - businessId:', businessId);
      console.log('  - businessInitialized:', businessInitialized);
      console.log('[BookAppointmentModal] Stores state:');
      console.log('  - storesLoading:', storesLoading);
      console.log('  - storesAutoCreating:', storesAutoCreating);
      console.log('  - supabaseStores count:', supabaseStores?.length ?? 0);
      console.log('  - supabaseStores:', JSON.stringify(supabaseStores?.map(s => ({ id: s.id, name: s.name, is_archived: s.is_archived })) ?? []));
      console.log('  - storesError:', storesError ? (storesError as Error).message : 'none');
      console.log('[BookAppointmentModal] Clients state:');
      console.log('  - clientsLoading:', clientsLoading);
      console.log('  - clients count:', supabaseClients?.length ?? 0);
      console.log('[BookAppointmentModal] Staff state:');
      console.log('  - allStaffLoading:', allStaffLoading);
      console.log('  - allStaffData count:', allStaffData?.length ?? 0);
      console.log('  - allStaffError:', allStaffError ? (allStaffError as Error).message : 'none');
      console.log('  - zustandStaff count:', zustandStaff?.length ?? 0);
      console.log('[BookAppointmentModal] ================================');
    }
  }, [visible, businessId, businessInitialized, supabaseClients, supabaseStores, storesLoading, storesAutoCreating, allStaffData, storesError, allStaffError, clientsLoading, allStaffLoading, zustandStaff]);

  // Mutations
  const createAppointmentMutation = useCreateAppointment();
  const checkConflictMutation = useCheckAppointmentConflict();
  const ensurePromotionMutation = useEnsurePromotion();

  // Promotion counter data — fetch counters for the selected client so we can show
  // accurate progress (current_count, required_count) in the Amount section.
  const { data: clientCounters } = useClientPromotionCounters(selectedClientId, !!selectedClientId);

  // Client gift cards — fetch active gift cards for the selected client
  const { data: clientGiftCards } = useClientGiftCards(selectedClientId ?? undefined);
  const activeClientGiftCards = (clientGiftCards ?? []).filter((gc: GiftCard) => gc.status === 'active');

  // Series mutations
  const createSeriesMutation = useCreateAppointmentSeries();
  const createAppointmentsFromSeriesMutation = useCreateAppointmentsFromSeries();

  const currencySymbol = getCurrencySymbol(currency);

  // Locale state for date-fns
  // Convert Supabase clients to sorted list (SupabaseClient doesn't have is_archived)
  const clients = useMemo(() => {
    // Supabase clients are already filtered by business via RLS
    // Sort alphabetically by name
    return [...supabaseClients].sort((a, b) => a.name.localeCompare(b.name));
  }, [supabaseClients]);

  // Services from Supabase - already filtered by business via RLS
  // Filter out products - only show appointment-based services
  // If a specific staff member is selected AND they have skill assignments, only show their services
  const services = useMemo(() => {
    const baseServices = supabaseServices.filter(s => {
      const serviceType = (s as unknown as { service_type?: string }).service_type;
      return serviceType !== 'product';
    });

    // If no staff selected yet, or staff has no skill assignments → show all
    if (!selectedStaffId || staffServiceSkills.length === 0) {
      console.log('[BookAppointmentModal] Staff filter: showing all services (', baseServices.length, ')');
      return baseServices;
    }

    // Filter to only services that staff member can perform
    const allowedServiceIds = new Set(staffServiceSkills.map(ss => ss.service_id));
    const filtered = baseServices.filter(s => allowedServiceIds.has(s.id));
    console.log('[BookAppointmentModal] Staff filter:', {
      selected_staff_id: selectedStaffId,
      returned_service_ids_count: filtered.length,
      excluded_services_count: baseServices.length - filtered.length,
    });
    return filtered;
  }, [supabaseServices, selectedStaffId, staffServiceSkills]);

  // Convert Supabase stores to local format
  const stores = useMemo(() => {
    const storesList = supabaseStores.map((s) => ({
      id: s.id,
      name: s.name,
    }));
    console.log('[BookAppointmentModal] Computed stores list:', storesList.length);
    return storesList;
  }, [supabaseStores]);

  // Store count logic - consider loading state AND auto-creation state
  // Don't show "no stores" error while stores are still loading or being auto-created
  const storesCount = stores.length;
  const storesStillLoading = storesLoading || !businessInitialized || storesAutoCreating;
  // Check if there's an error (likely table doesn't exist)
  const storesTableMissing = storesError && (
    (storesError as Error)?.message?.includes('Could not find the table') ||
    (storesError as Error)?.message?.includes('does not exist')
  );
  const hasNoStores = storesCount === 0 && !storesStillLoading && !storesTableMissing;
  const isSingleStore = storesCount === 1;
  const hasMultipleStores = storesCount > 1;

  // Filter active promotions by current user - match Marketing Promo screen parity
  // Only filter by: userId (business), isActive status
  // Do NOT filter by date range - let users select any active promo
  const marketingPromotions = useMemo(() => {
    if (!userId) return [];
    return allMarketingPromotions.filter((p) => {
      if (p.userId !== userId) return false;
      if (!p.isActive) return false;
      return true;
    });
  }, [allMarketingPromotions, userId]);

  // Auto-seed "Pay 4 Get 5" default promotion when user has no promotions
  useEffect(() => {
    if (visible && userId && allMarketingPromotions.filter((p) => p.userId === userId).length === 0) {
      addMarketingPromotion({
        name: 'Pay 4 Get 5',
        description: 'Book 4 appointments, get the 5th one free',
        discountType: 'free_service',
        discountValue: 0,
        freeServiceAfter: 5,
        isActive: true,
        startDate: new Date(),
        endDate: undefined,
        color: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  // Use the internal store selection or the prop, with internal taking priority when set
  const activeStoreId = internalSelectedStoreId ?? selectedStoreId ?? null;

  // When staff changes and filtered services no longer include currently selected services,
  // auto-remove invalid selections and show a toast
  useEffect(() => {
    if (selectedServices.length === 0) return;
    const validServiceIds = new Set(services.map(s => s.id));
    const invalidSelected = selectedServices.filter(id => !validServiceIds.has(id));
    if (invalidSelected.length > 0) {
      setSelectedServices(prev => prev.filter(id => validServiceIds.has(id)));
      setServicesRemovedToast(true);
      setTimeout(() => setServicesRemovedToast(false), 3500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  // ── Pricing computation (real, in cents) ────────────────────────────
  // Computed from services.price_cents (source of truth) + selected promo
  const computedPricing = useMemo(() => {
    // Sum price_cents for all selected services
    const subtotalCents = selectedServices.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      const pc = (svc as unknown as { price_cents?: number })?.price_cents ?? 0;
      return sum + pc;
    }, 0);
    // Find selected promotion and compute discount
    const promo = selectedPromotionId
      ? marketingPromotions.find((p) => p.id === selectedPromotionId)
      : null;

    // Counter/punch-card promos: 'free_service' (pay N get 1 free loyalty),
    // 'other' (custom counter), or freeServiceAfter explicitly set.
    // These must NOT apply a monetary discount — they track progress only.
    const isCounterPromo = !!promo && (
      promo.discountType === 'free_service' ||
      promo.discountType === 'other' ||
      promo.freeServiceAfter != null
    );

    let discountCents = 0;
    if (promo && subtotalCents > 0 && !isCounterPromo) {
      if (promo.discountType === 'percentage') {
        discountCents = Math.round(subtotalCents * (promo.discountValue / 100));
      } else if (promo.discountType === 'fixed') {
        // discountValue is in dollars — convert to cents
        discountCents = Math.min(Math.round(promo.discountValue * 100), subtotalCents);
      } else if (promo.discountType === 'free_service') {
        discountCents = subtotalCents; // entire order is free
      }
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);

    // Counter info — find the matching counter for the selected client + promo
    const matchingCounter = isCounterPromo && promo
      ? (clientCounters ?? []).find((c) => c.promotion_id === promo.id) ?? null
      : null;

    const requiredCount = matchingCounter?.required_count ?? promo?.freeServiceAfter ?? (promo?.discountType === 'free_service' ? 5 : 5);
    const currentCount = matchingCounter?.current_count ?? 0;
    const projectedCount = currentCount + 1;
    const remainingAfterBooking = Math.max(requiredCount - projectedCount, 0);

    return {
      subtotalCents,
      discountCents,
      totalCents,
      promo,
      isCounterPromo,
      counterInfo: isCounterPromo ? {
        requiredCount,
        currentCount,
        projectedCount,
        remainingAfterBooking,
      } : null,
    };
  }, [selectedServices, services, selectedPromotionId, marketingPromotions, clientCounters]);

  // Auto-fill appointmentAmount from computed total whenever services/promo change,
  // but only if the user has not manually edited the field (detected by comparing with prior auto value)
  const lastAutoAmount = React.useRef<string>('');
  useEffect(() => {
    if (computedPricing.totalCents > 0) {
      const autoValue = (computedPricing.totalCents / 100).toFixed(2);
      // Only update if the current value matches the last auto-set value (not manually edited)
      if (appointmentAmount === '' || appointmentAmount === lastAutoAmount.current) {
        lastAutoAmount.current = autoValue;
        setAppointmentAmount(autoValue);
      }
    }
  }, [computedPricing.totalCents]);
  // ─────────────────────────────────────────────────────────────────────
  // Auto-select store: select first available store when stores are loaded
  useEffect(() => {
    // Only auto-select when modal is visible, stores loaded, and no store is selected yet
    if (visible && !storesStillLoading && stores.length > 0 && !activeStoreId) {
      const firstStore = stores[0];
      console.log('[BookAppointmentModal] Auto-selecting store:', firstStore.id, firstStore.name, '(total:', stores.length, ')');
      setInternalSelectedStoreId(firstStore.id);
    }
  }, [visible, stores, activeStoreId, storesStillLoading]);

  // Get staff for the selected store from Supabase
  const { data: storeStaffData = [], error: storeStaffError } = useStaffForStore(activeStoreId);
  const { data: storeBusinessHours = [] } = useBusinessHours(activeStoreId);

  // Debug log for staff fetch
  useEffect(() => {
    if (visible && activeStoreId) {
      console.log('[BookAppointmentModal] Staff for store', activeStoreId, ':', storeStaffData?.length ?? 0);
      if (storeStaffError) {
        console.log('[BookAppointmentModal] STORE STAFF FETCH ERROR:', storeStaffError);
      }
    }
  }, [visible, activeStoreId, storeStaffData, storeStaffError]);

  // Convert staff to local format - use Zustand as fallback when Supabase has no data but Zustand does
  const staffMembers = useMemo(() => {
    // Use Zustand staff if Supabase has no data but Zustand does
    // This handles the case where staff table doesn't exist
    const useZustandFallback = allStaffData.length === 0 && zustandStaff.length > 0;

    if (useZustandFallback) {
      console.log('[BookAppointmentModal] Using Zustand staff fallback, count:', zustandStaff.length);
      // Filter by store if we have a store selected
      if (activeStoreId) {
        return zustandStaff.filter((s) => {
          const storeIds = s.storeIds && s.storeIds.length > 0 ? s.storeIds : (s.storeId ? [s.storeId] : []);
          return storeIds.includes(activeStoreId);
        }).map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          storeIds: s.storeIds || (s.storeId ? [s.storeId] : []),
          avatar_url: null as string | null,
          avatar_thumb_url: null as string | null,
        }));
      }
      // Return all Zustand staff
      return zustandStaff.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        storeIds: s.storeIds || (s.storeId ? [s.storeId] : []),
        avatar_url: null as string | null,
        avatar_thumb_url: null as string | null,
      }));
    }

    // Use Supabase staff - if a store is selected, use storeStaffData; otherwise use all staff
    const staffData = activeStoreId ? storeStaffData : allStaffData;
    return staffData.map((s) => ({
      id: s.id,
      name: s.full_name,
      color: s.color,
      storeIds: s.store_ids || [],
      avatar_url: s.avatar_url || null,
      avatar_thumb_url: s.avatar_thumb_url || null,
    }));
  }, [activeStoreId, storeStaffData, allStaffData, zustandStaff]);

  // Get selected staff member
  const selectedStaff = useMemo(() => {
    if (!selectedStaffId) return null;
    return staffMembers.find((s) => s.id === selectedStaffId) || null;
  }, [staffMembers, selectedStaffId]);

  // Clients with conflicts - simplified for now (will be checked on save)
  const clientsWithConflicts = useMemo(() => {
    // For now, return empty set - conflict checking happens on save via mutation
    return new Set<string>();
  }, []);

  // Filtered clients for search - maintain alphabetical order
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) {
      return clients;
    }
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.email?.toLowerCase().includes(query) ?? false) ||
        (c.phone?.includes(query) ?? false)
    );
  }, [clients, clientSearchQuery]);

  // Get actual duration value
  const getActualDuration = (): number => {
    if (selectedDuration === 0) {
      return parseInt(customDuration) || 60;
    }
    return selectedDuration;
  };

  // Calculate end time based on start time and duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const timeParts = startTime.split(':');
    if (timeParts.length !== 2) return startTime;

    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;

    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  // Update end time when duration or start time changes
  const updateEndTimeFromDuration = useCallback((startTime: string, duration: number) => {
    const newEndTime = calculateEndTime(startTime, duration);
    setAppointmentEndTime(newEndTime);
  }, []);

  // Auto-format time input with colon insertion
  const formatTimeInput = (text: string): string => {
    // Remove all non-numeric characters
    const digits = text.replace(/[^0-9]/g, '');

    // Limit to 4 digits
    const limitedDigits = digits.slice(0, 4);

    // Auto-insert colon after 2 digits
    if (limitedDigits.length > 2) {
      return `${limitedDigits.slice(0, 2)}:${limitedDigits.slice(2)}`;
    }

    return limitedDigits;
  };

  // Handle start time change with auto-colon and auto-fill end time
  const handleStartTimeChange = (text: string) => {
    const formattedTime = formatTimeInput(text);
    setAppointmentTime(formattedTime);

    // Auto-fill end time if we have a valid time format (HH:MM)
    if (formattedTime.length === 5 && formattedTime.includes(':')) {
      const duration = getActualDuration();
      updateEndTimeFromDuration(formattedTime, duration);
    }
  };

  // Handle end time change with auto-colon
  const handleEndTimeChange = (text: string) => {
    const formattedTime = formatTimeInput(text);
    setAppointmentEndTime(formattedTime);
  };

  // Check for conflicts when staff, date, time, or duration changes
  const validateConflict = useCallback(async (): Promise<boolean> => {
    if (!selectedDate || !activeStoreId) {
      setConflictError(null);
      return false;
    }

    const duration = getActualDuration();

    // Parse time to create Date objects
    const [startHour, startMin] = appointmentTime.split(':').map(Number);
    if (isNaN(startHour) || isNaN(startMin)) {
      return false;
    }

    const startAt = new Date(selectedDate);
    startAt.setHours(startHour, startMin, 0, 0);
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    try {
      const conflicts = await checkConflictMutation.mutateAsync({
        storeId: activeStoreId,
        staffId: selectedStaffId || null,
        startAt,
        endAt,
      });

      if (conflicts && conflicts.length > 0) {
        const staffName = selectedStaffId
          ? staffMembers.find((s) => s.id === selectedStaffId)?.name || 'This staff member'
          : 'This time slot';
        setConflictError(`${staffName} already has an appointment during this time.`);
        return true;
      }
    } catch (err) {
      console.log('[BookAppointmentModal] Error checking conflicts:', err);
      // Continue without blocking if conflict check fails
    }

    setConflictError(null);
    return false;
  }, [selectedStaffId, selectedDate, appointmentTime, selectedDuration, customDuration, activeStoreId, checkConflictMutation, staffMembers]);

  // Save appointment
  const handleSaveAppointment = async () => {
    console.log('[BookAppointmentModal] Save clicked - clientId:', selectedClientId, 'storeId:', activeStoreId);

    if (!selectedClientId) {
      console.log('[BookAppointmentModal] Missing client');
      return;
    }

    // Validate date is selected (should always be true since we default to today)
    if (!selectedDate) {
      console.log('[BookAppointmentModal] Missing date');
      setConflictError(t('appointmentDateRequired', language) || 'Please select a date');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) {
      console.log('[BookAppointmentModal] Client not found');
      return;
    }

    // Require a store to be selected
    if (!activeStoreId) {
      console.log('[BookAppointmentModal] No store selected');
      if (hasNoStores) {
        setConflictError('Please create a store in Settings first');
      } else if (hasMultipleStores) {
        setConflictError(t('pleaseSelectStoreForAppointment', language));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Require at least 1 service selected
    if (selectedServices.length === 0) {
      console.log('[BookAppointmentModal] No services selected');
      setConflictError(t('pleaseSelectService', language) || 'Please select at least one service');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Require a specific staff member to be selected
    if (!selectedStaffId) {
      console.log('[BookAppointmentModal] No staff selected');
      setConflictError(t('pleaseSelectStaff', language) || 'Please select a staff member');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Block if appointment time is outside the store's configured business hours
    if (selectedDate && !isWithinBusinessHours(selectedDate, appointmentTime, storeBusinessHours)) {
      setShowBusinessHoursAlert(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Check for staff conflicts before saving
    const hasConflict = await validateConflict();
    if (hasConflict) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // Build title from selected services
    const selectedServiceNames = selectedServices
      .map((id) => services.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    const duration = getActualDuration();

    // Parse time to create Date objects
    const [startHour, startMin] = appointmentTime.split(':').map(Number);
    const startAt = new Date(selectedDate);
    startAt.setHours(startHour, startMin, 0, 0);
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    try {
      console.log('[BookAppointmentModal] Creating appointment:', {
        client_id: selectedClientId,
        store_id: activeStoreId,
        staff_id: selectedStaffId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      });

      // Only send staff_id if it's a valid UUID (from Supabase staff table)
      // If using Zustand staff, the ID won't be a valid UUID
      const staffIdToSend = isValidUUID(selectedStaffId) ? selectedStaffId : null;

      if (selectedStaffId && !staffIdToSend) {
        console.log('[BookAppointmentModal] Staff ID is not a valid UUID (likely from Zustand), setting to null:', selectedStaffId);
      }

      // Only send promo_id if it's a valid UUID (promotions from Zustand use local IDs, not UUIDs)
      // First, ensure the promotion exists in Supabase before using its ID
      let promoIdToSend: string | null = null;
      if (selectedPromotionId && isValidUUID(selectedPromotionId)) {
        // Find the promotion in Zustand to sync it to Supabase
        const selectedPromo = marketingPromotions.find(p => p.id === selectedPromotionId);
        if (selectedPromo) {
          console.log('[BookAppointmentModal] Ensuring promotion exists in Supabase:', selectedPromotionId);
          try {
            await ensurePromotionMutation.mutateAsync(selectedPromo);
            promoIdToSend = selectedPromotionId;
            console.log('[BookAppointmentModal] Promotion synced to Supabase successfully');
          } catch (promoSyncError) {
            // If sync fails, log but continue without promo_id
            console.log('[BookAppointmentModal] Promotion sync failed (will save without promo_id):', promoSyncError);
          }
        }
      } else if (selectedPromotionId) {
        console.log('[BookAppointmentModal] Promo ID is not a valid UUID (likely from Zustand), setting to null:', selectedPromotionId);
      }

      // Validate all foreign key IDs are real Supabase UUIDs before insert
      // NOTE: service_id is required by DB constraint (appointments_service_id_nn_chk).
      // Use the first selected service as the primary service_id.
      // All selected services are also synced to appointment_services junction table.
      const primaryServiceId = selectedServices[0] ?? null;
      const payload = {
        client_id: selectedClientId,
        store_id: activeStoreId,
        staff_id: staffIdToSend,
        service_id: primaryServiceId,
        appointment_date: startAt, // Full timestamp: selectedDate + appointmentTime
        start_at: startAt,
        end_at: endAt,
        duration_minutes: duration,
        title: selectedServiceNames || `Appointment with ${client.name}`,
        notes: appointmentNotes || undefined,
        amount: appointmentAmount ? parseFloat(appointmentAmount) : 0,
        currency: currency,
        promo_id: promoIdToSend,
        // Persist real pricing breakdown (cents)
        subtotal_cents: computedPricing.subtotalCents > 0 ? computedPricing.subtotalCents : null,
        discount_cents: computedPricing.discountCents > 0 ? computedPricing.discountCents : null,
        total_cents: computedPricing.totalCents > 0 ? computedPricing.totalCents : null,
        gift_card_intent: giftCardIntent || !!selectedGiftCardId,
        gift_card_id: selectedGiftCardId ?? undefined,
      };

      // Debug: log full payload with UUID validity check before sending
      console.log('[BookAppointmentModal] ===== INSERT PAYLOAD (before businessId) =====');
      console.log('[BookAppointmentModal] client_id:', payload.client_id, '| valid UUID:', isValidUUID(payload.client_id));
      console.log('[BookAppointmentModal] store_id:', payload.store_id, '| valid UUID:', isValidUUID(payload.store_id));
      console.log('[BookAppointmentModal] staff_id:', payload.staff_id, '| valid UUID:', isValidUUID(payload.staff_id));
      console.log('[BookAppointmentModal] service_id:', payload.service_id, '| valid UUID:', isValidUUID(payload.service_id));
      console.log('[BookAppointmentModal] promo_id:', payload.promo_id, '| valid UUID:', isValidUUID(payload.promo_id));
      console.log('[BookAppointmentModal] appointment_date:', payload.appointment_date.toISOString());
      console.log('[BookAppointmentModal] start_at:', payload.start_at.toISOString());
      console.log('[BookAppointmentModal] end_at:', payload.end_at.toISOString());
      console.log('[BookAppointmentModal] duration_minutes:', payload.duration_minutes);
      console.log('[BookAppointmentModal] amount:', payload.amount);
      console.log('[BookAppointmentModal] currency:', payload.currency);
      console.log('[BookAppointmentModal] selectedServices (will sync to appointment_services):', JSON.stringify(selectedServices));
      console.log('[BookAppointmentModal] ============================================');

      // Handle recurring appointment series
      if (recurringConfig.isRecurring && recurringConfig.seriesPreviewData && recurringConfig.seriesPreviewData.occurrences.length > 0) {
        console.log('[BookAppointmentModal] Creating recurring appointment series...');

        try {
          // Create the series record
          const seriesInput: CreateSeriesInput = {
            business_id: businessId!,
            store_id: activeStoreId,
            staff_id: staffIdToSend,
            client_id: selectedClientId,
            service_ids: selectedServices,
            frequency_type: recurringConfig.recurrenceFrequency,
            interval_value: recurringConfig.recurrenceFrequency === 'custom' ? parseInt(recurringConfig.customIntervalWeeks) || 1 : 1,
            start_date: selectedDate,
            end_type: recurringConfig.recurrenceEndType,
            end_date: recurringConfig.recurrenceEndType === 'until_date' ? recurringConfig.recurrenceEndDate : null,
            occurrence_count: recurringConfig.recurrenceEndType === 'occurrence_count' ? parseInt(recurringConfig.recurrenceCount) || 4 : null,
            start_time: appointmentTime,
            duration_minutes: duration,
            amount: appointmentAmount ? parseFloat(appointmentAmount) : 0,
            currency: currency,
            notes: appointmentNotes || undefined,
          };

          const series = await createSeriesMutation.mutateAsync(seriesInput);
          console.log('[BookAppointmentModal] Series created:', series.id);

          // Create all appointments from the series
          const appointments = await createAppointmentsFromSeriesMutation.mutateAsync({
            series,
            occurrences: recurringConfig.seriesPreviewData.occurrences,
            skipConflicts: true,
          });

          console.log('[BookAppointmentModal] Created', appointments.length, 'recurring appointments');

          // NOTE: Points are NOT awarded at booking time for recurring series.
          // They are awarded only when each appointment is completed via
          // POST /api/appointments/complete.

          // Show success toast with count
          setShowLocalSuccessToast(true);
          setTimeout(() => {
            resetAndClose();
          }, 100);
          return;
        } catch (seriesErr) {
          console.log('[BookAppointmentModal] Error creating series:', seriesErr);
          setConflictError(seriesErr instanceof Error ? seriesErr.message : 'Failed to create recurring appointments');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      }

      // Single appointment - use existing logic
      const createdAppointment = await createAppointmentMutation.mutateAsync(payload);

      // Sync services to appointment_services junction table
      if (createdAppointment?.id && selectedServices.length > 0) {
        console.log('[BookAppointmentModal] Syncing services to appointment_services:', createdAppointment.id, selectedServices);
        try {
          await syncAppointmentServicesMutation.mutateAsync({
            appointmentId: createdAppointment.id,
            serviceIds: selectedServices,
          });
          console.log('[BookAppointmentModal] Services synced successfully');
        } catch (syncErr) {
          console.log('[BookAppointmentModal] Warning: Failed to sync services:', syncErr);
          // Don't fail the whole operation - appointment was created successfully
        }
      }

      // Award loyalty points if enabled and there's an amount
      // NOTE: Points are NOT awarded at booking time. They are awarded only when
      // the appointment is completed (completed_at is set via POST /api/appointments/complete).

      // Fire-and-forget: send confirmation email to client (non-blocking)
      if (createdAppointment?.id) {
        notifyAppointmentEmail(createdAppointment.id, 'created');
      }

      // NOTE: loyalty_points_earned email is intentionally NOT sent here.
      // Points are only awarded when a visit is completed. The email fires
      // from the backend when POST /api/appointments/complete is called.

      // NOTE: promotion_applied email is intentionally NOT sent here.
      // Promotions are only "used" when a visit is completed/logged.
      // Sending at booking time falsely says "applied to your recent visit"
      // for a future appointment. The email fires from AddVisitModal when
      // the visit is actually completed.

      // Show success toast then close
      setShowLocalSuccessToast(true);
      // Delay close slightly to let toast appear
      setTimeout(() => {
        resetAndClose();
      }, 100);
    } catch (err) {
      console.log('[BookAppointmentModal] Error creating appointment:', err);
      // Show the real error message from the service
      const errorMessage = err instanceof Error ? err.message : 'Failed to book appointment. Please try again.';
      setConflictError(errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Get client by ID
  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Get tags for selected client - simplified since SupabaseClient doesn't have visits
  const selectedClientTags = useMemo(() => {
    // SupabaseClient doesn't have visit history, so return empty array
    // This can be enhanced later if needed
    return [] as SupabaseService[];
  }, [selectedClient]);

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) => {
      const newSelection = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId];
      return newSelection;
    });
  };

  const resetAndClose = () => {
    setSelectedDate(new Date());
    setSelectedServices([]);
    setAppointmentTime('09:00');
    setAppointmentEndTime('10:00');
    setAppointmentNotes('');
    setGiftCardIntent(false);
    setSelectedGiftCardId(null);
    setShowGiftCardPicker(false);
    setAppointmentAmount('');
    setSelectedClientId(null);
    setClientSearchQuery('');
    setShowClientSearch(false);
    setSelectedStaffId(null);
    setInternalSelectedStoreId(null);
    setShowStorePicker(false);
    setSelectedDuration(60);
    setCustomDuration('60');
    setConflictError(null);
    setSelectedPromotionId(null);
    setShowPromotionPicker(false);
    // Reset recurring state via resetKey (RecurringSettings owns the actual state)
    setRecurringResetKey((k) => k + 1);
    setRecurringConfig({
      isRecurring: false,
      recurrenceFrequency: 'weekly',
      recurrenceEndType: 'occurrence_count',
      recurrenceEndDate: null,
      recurrenceCount: '4',
      customIntervalWeeks: '3',
      seriesPreviewData: null,
    });
    // Note: Don't reset showLocalSuccessToast here - let it auto-hide
    onClose();
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Calendar size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('bookAppointmentTitle', language)}</Text>
          </View>
          <Pressable
            onPress={resetAndClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Calendar Section */}
          <AppointmentCalendar
            selectedDate={selectedDate}
            onDateChange={(date) => setSelectedDate(date)}
            onClearConflict={() => setConflictError(null)}
          />

          {/* Client Selection */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>
                {t('clientRequired', language)}
              </Text>
              {selectedClientId && selectedClient && (
                <Pressable
                  onPress={() => {
                    setSelectedClientId(null);
                    setShowClientSearch(true);
                  }}
                >
                  <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '500' }}>{t('changeClient', language)}</Text>
                </Pressable>
              )}
            </View>

            {selectedClientId && selectedClient ? (
              <View>
                {/* Client Name Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: `${primaryColor}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 18 }}>
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
                      {selectedClient.name}
                    </Text>
                  </View>
                </View>

                {/* 1. Email */}
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Mail size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={{ color: colors.textSecondary, marginLeft: 12, flex: 1, fontSize: 15 }}>
                    {selectedClient.email}
                  </Text>
                </Pressable>

                {/* 2. Phone number */}
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Phone size={16} color={colors.textSecondary} />
                  </View>
                  <Text style={{ color: colors.textSecondary, marginLeft: 12, flex: 1, fontSize: 15 }}>
                    {formatPhoneDisplay(selectedClient.phone || '')}
                  </Text>
                </Pressable>

                {/* 3 & 4. Call & Email Buttons */}
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <Pressable
                    onPress={() => {
                      const phoneNumber = (selectedClient.phone || '').replace(/[^0-9+]/g, '');
                      Linking.openURL(`tel:${phoneNumber}`);
                    }}
                    style={{
                      flex: 1,
                      marginRight: 8,
                      backgroundColor: primaryColor,
                      borderRadius: 12,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Phone size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8, fontSize: 15 }}>{t('call', language)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowEmailModal(true)}
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      backgroundColor: primaryColor,
                      borderRadius: 12,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8, fontSize: 15 }}>{t('emailAction', language)}</Text>
                  </Pressable>
                </View>

                {/* 5. Notes */}
                {selectedClient.notes && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <MessageCircle size={14} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 6 }}>{t('clientNotes', language)}</Text>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
                      {selectedClient.notes}
                    </Text>
                  </View>
                )}

                {/* 6. Tags */}
                {selectedClientTags.length > 0 && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 8 }}>{t('clientTags', language)}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {selectedClientTags.map((tag) => (
                        <View
                          key={tag.id}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            marginRight: 8,
                            marginBottom: 6,
                            backgroundColor: `${tag.color}20`,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '500', color: tag.color }}>
                            {tag.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => setShowClientSearch(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <Search size={18} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginLeft: 10, flex: 1 }}>
                    {t('searchForClient', language)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowNewClientModal(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
                    marginTop: 8,
                  }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center' }}>
                    <User size={13} color="#fff" />
                  </View>
                  <Text style={{ color: primaryColor, marginLeft: 10, flex: 1, fontWeight: '600' }}>
                    {t('newClient', language)}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Store + Staff Selection */}
          <StoreStaffRow
            stores={stores}
            activeStoreId={activeStoreId}
            storesStillLoading={storesStillLoading}
            storesTableMissing={storesTableMissing}
            hasNoStores={hasNoStores}
            isSingleStore={isSingleStore}
            hasMultipleStores={hasMultipleStores}
            showStorePicker={showStorePicker}
            onToggleStorePicker={() => setShowStorePicker(!showStorePicker)}
            onSelectStore={(storeId) => {
              console.log('[BookAppointmentModal] Store selected:', storeId);
              setInternalSelectedStoreId(storeId);
              setSelectedStaffId(null);
              setShowStorePicker(false);
            }}
            staffMembers={staffMembers}
            selectedStaffId={selectedStaffId}
            conflictError={conflictError}
            onSelectStaff={(staffId) => {
              console.log('[BookAppointmentModal] Staff selected:', staffId);
              setSelectedStaffId(staffId);
              setConflictError(null);
            }}
            onManageStaff={() => setShowStaffManagement(true)}
          />

          {/* Service, Duration, Time */}
          <ServiceDurationTime
            services={services}
            servicesLoading={servicesLoading}
            selectedServices={selectedServices}
            onToggleService={toggleService}
            selectedDuration={selectedDuration}
            customDuration={customDuration}
            onSelectDuration={(value) => {
              setSelectedDuration(value);
              setConflictError(null);
              if (value > 0) {
                updateEndTimeFromDuration(appointmentTime, value);
              }
            }}
            onCustomDurationChange={(text) => {
              const cleanedText = text.replace(/[^0-9]/g, '');
              setCustomDuration(cleanedText);
              setConflictError(null);
              const duration = parseInt(cleanedText) || 60;
              updateEndTimeFromDuration(appointmentTime, duration);
            }}
            appointmentTime={appointmentTime}
            appointmentEndTime={appointmentEndTime}
            onStartTimeChange={handleStartTimeChange}
            onEndTimeChange={handleEndTimeChange}
          />

          {/* Recurring Appointment */}
          <RecurringSettings
            selectedDate={selectedDate}
            appointmentTime={appointmentTime}
            selectedClientId={selectedClientId}
            selectedStaffId={selectedStaffId}
            activeStoreId={activeStoreId}
            selectedServices={selectedServices}
            businessId={businessId}
            dateLocale={dateLocale}
            durationMinutes={getActualDuration()}
            onChange={setRecurringConfig}
            resetKey={recurringResetKey}
          />

          {/* Amount / Pricing */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
              {t('appointmentAmount', language)}
            </Text>

            {/* Pricing breakdown — shown when services have prices */}
            {computedPricing.subtotalCents > 0 && (
              <View style={{ marginBottom: 10 }}>
                {/* Line items */}
                {selectedServices.map((id) => {
                  const svc = services.find((s) => s.id === id);
                  const pc = (svc as unknown as { price_cents?: number })?.price_cents ?? 0;                  if (!svc || pc === 0) return null;
                  return (
                    <View key={id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{svc.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{currencySymbol}{(pc / 100).toFixed(2)}</Text>
                    </View>
                  );
                })}
                {/* Subtotal (only show if multiple services) */}
                {selectedServices.length > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Subtotal</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{currencySymbol}{(computedPricing.subtotalCents / 100).toFixed(2)}</Text>
                  </View>
                )}
                {/* Discount row — only for monetary promos, not counter/punch-card promos */}
                {computedPricing.discountCents > 0 && computedPricing.promo && !computedPricing.isCounterPromo && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#10B981', fontSize: 13 }}>
                      {computedPricing.promo.name}
                      {computedPricing.promo.discountType === 'percentage' ? ` (${computedPricing.promo.discountValue}% off)` : ''}
                    </Text>
                    <Text style={{ color: '#10B981', fontSize: 13 }}>−{currencySymbol}{(computedPricing.discountCents / 100).toFixed(2)}</Text>
                  </View>
                )}
                {/* Counter/punch-card promo — show progress row, never a monetary deduction */}
                {computedPricing.isCounterPromo && computedPricing.promo && computedPricing.counterInfo && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, backgroundColor: `${primaryColor}12`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Hash size={13} color={primaryColor} />
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                      {computedPricing.counterInfo.requiredCount} {t('counterTotal', language)}
                    </Text>
                    <Text style={{ color: primaryColor, fontSize: 13, marginLeft: 6 }}>
                      {'•  '}{t('counterUsingToday', language)}{'  •  '}{computedPricing.counterInfo.remainingAfterBooking} {t('counterRemaining', language)}
                    </Text>
                  </View>
                )}
                {/* Divider */}
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
              </View>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text style={{ fontSize: 18, color: colors.textSecondary, fontWeight: '500' }}>
                {currencySymbol}
              </Text>
              <TextInput
                value={appointmentAmount}
                onChangeText={(v) => {
                  lastAutoAmount.current = v; // treat manual edit as new baseline
                  setAppointmentAmount(v);
                }}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 16,
                  color: colors.text,
                }}
              />
            </View>
          </View>

          {/* Select Promotion */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
              {t('selectPromoOptional', language)}
            </Text>
            <Pressable
              onPress={() => setShowPromotionPicker(!showPromotionPicker)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Gift size={18} color={selectedPromotionId ? primaryColor : colors.textTertiary} />
                <Text
                  style={{
                    marginLeft: 12,
                    fontSize: 16,
                    color: selectedPromotionId ? colors.text : colors.textTertiary,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {selectedPromotionId
                    ? marketingPromotions.find((p) => p.id === selectedPromotionId)?.name
                    : t('selectPromotion', language)}
                </Text>
              </View>
              <ChevronDown size={18} color={colors.textTertiary} />
            </Pressable>
            {showPromotionPicker && (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  maxHeight: 200,
                  overflow: 'hidden',
                }}
              >
                <ScrollView nestedScrollEnabled>
                  <Pressable
                    onPress={() => {
                      setSelectedPromotionId(null);
                      setShowPromotionPicker(false);
                    }}
                    style={{
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <X size={16} color={colors.textTertiary} />
                    <Text style={{ marginLeft: 10, color: colors.textTertiary, fontStyle: 'italic' }}>
                      {t('noPromotionSelected', language)}
                    </Text>
                    {!selectedPromotionId && (
                      <Check size={16} color={primaryColor} style={{ marginLeft: 'auto' }} />
                    )}
                  </Pressable>
                  {marketingPromotions.length > 0 ? (
                    marketingPromotions.map((promo) => (
                      <Pressable
                        key={promo.id}
                        onPress={() => {
                          setSelectedPromotionId(promo.id);
                          setShowPromotionPicker(false);
                        }}
                        style={{
                          padding: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: promo.color || primaryColor,
                            marginRight: 10,
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '500' }}>{promo.name}</Text>
                          {promo.description ? (
                            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                              {promo.description}
                            </Text>
                          ) : null}
                        </View>
                        {selectedPromotionId === promo.id && (
                          <Check size={16} color={primaryColor} style={{ marginLeft: 8 }} />
                        )}
                      </Pressable>
                    ))
                  ) : (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                        {t('noPromotionsAvailable', language)}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Select Gift Card */}
          {selectedClientId && (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                {t('giftCards', language)} ({t('optional', language)})
              </Text>
              <Pressable
                onPress={() => setShowGiftCardPicker(!showGiftCardPicker)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: selectedGiftCardId ? 1.5 : 0,
                  borderColor: selectedGiftCardId ? primaryColor : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Gift size={18} color={selectedGiftCardId ? primaryColor : colors.textTertiary} />
                  <Text
                    style={{
                      marginLeft: 12,
                      fontSize: 16,
                      color: selectedGiftCardId ? colors.text : colors.textTertiary,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {selectedGiftCardId
                      ? (() => {
                          const gc = activeClientGiftCards.find((g: GiftCard) => g.id === selectedGiftCardId);
                          if (!gc) return t('redeemGiftCard', language);
                          if (gc.type === 'service') {
                            const hasUses = (gc.services ?? []).some(s => (s.quantity - s.usedQuantity) > 0);
                            return `${gc.code}${hasUses ? '' : ' · 0 left'}`;
                          }
                          return gc.currentBalance != null ? `${gc.code} · ${currencySymbol}${gc.currentBalance.toFixed(2)}` : gc.code;
                        })()
                      : activeClientGiftCards.length === 0
                        ? t('noGiftCardAvailable', language) ?? 'No active gift cards'
                        : t('redeemGiftCard', language)}
                  </Text>
                </View>
                {activeClientGiftCards.length > 0 && (
                  <ChevronDown size={18} color={colors.textTertiary} />
                )}
              </Pressable>
              {showGiftCardPicker && activeClientGiftCards.length > 0 && (
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    maxHeight: 200,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView nestedScrollEnabled>
                    <Pressable
                      onPress={() => {
                        setSelectedGiftCardId(null);
                        setShowGiftCardPicker(false);
                      }}
                      style={{
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <X size={16} color={colors.textTertiary} />
                      <Text style={{ marginLeft: 10, color: colors.textTertiary, fontStyle: 'italic' }}>
                        {t('noGiftCardSelected', language) ?? 'No gift card'}
                      </Text>
                      {!selectedGiftCardId && (
                        <Check size={16} color={primaryColor} style={{ marginLeft: 'auto' }} />
                      )}
                    </Pressable>
                    {(() => {
                      // Sort: service cards with remaining uses first, then value cards with balance, then rest
                      const sorted = [...activeClientGiftCards].sort((a: GiftCard, b: GiftCard) => {
                        const scoreA = a.type === 'service'
                          ? ((a.services ?? []).some(s => (s.quantity - s.usedQuantity) > 0) ? 2 : 0)
                          : ((a.currentBalance ?? 0) > 0 ? 1 : 0);
                        const scoreB = b.type === 'service'
                          ? ((b.services ?? []).some(s => (s.quantity - s.usedQuantity) > 0) ? 2 : 0)
                          : ((b.currentBalance ?? 0) > 0 ? 1 : 0);
                        return scoreB - scoreA;
                      });
                      return sorted.map((gc: GiftCard) => (
                        <Pressable
                          key={gc.id}
                          onPress={() => {
                            setSelectedGiftCardId(gc.id);
                            setShowGiftCardPicker(false);
                          }}
                          style={{
                            padding: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>{gc.code}</Text>
                            {gc.type === 'value' && gc.currentBalance != null && (
                              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                                {t('remainingBalance', language)}: {currencySymbol}{gc.currentBalance.toFixed(2)}
                              </Text>
                            )}
                            {gc.type === 'service' && (gc.services ?? []).length > 0 && (() => {
                              const svcs = gc.services!;
                              const visible = svcs.slice(0, 3);
                              const extra = svcs.length - visible.length;
                              return (
                                <View style={{ marginTop: 3 }}>
                                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', marginBottom: 2 }}>
                                    {t('servicesRemaining', language)}
                                  </Text>
                                  {visible.map((svc, i) => {
                                    const remaining = svc.quantity - svc.usedQuantity;
                                    return (
                                      <Text key={i} style={{ color: remaining > 0 ? colors.textSecondary : colors.textTertiary, fontSize: 12 }}>
                                        {svc.serviceName}  ({remaining}/{svc.quantity} {t('usesLeft', language)})
                                      </Text>
                                    );
                                  })}
                                  {extra > 0 && (
                                    <Text style={{ color: primaryColor, fontSize: 11, marginTop: 1 }}>
                                      {t('andMore', language).replace('{n}', String(extra))}
                                    </Text>
                                  )}
                                </View>
                              );
                            })()}
                          </View>
                          {selectedGiftCardId === gc.id && (
                            <Check size={16} color={primaryColor} />
                          )}
                        </Pressable>
                      ));
                    })()}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            }}
          >
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
              {t('notesOptional', language)}
            </Text>
            <TextInput
              value={appointmentNotes}
              onChangeText={setAppointmentNotes}
              placeholder={t('anyAdditionalNotes', language)}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                padding: 14,
                color: colors.text,
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </View>
        </ScrollView>

        {/* Bottom Save Button */}
        <View style={{ padding: 20, paddingBottom: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          {(() => {
            const canSave = !!(selectedClientId && (!hasNoStores || storesTableMissing) && (activeStoreId || isSingleStore || storesTableMissing));
            const isSaving = createAppointmentMutation.isPending || createSeriesMutation.isPending || createAppointmentsFromSeriesMutation.isPending;
            return (
              <Pressable
                onPress={handleSaveAppointment}
                disabled={!canSave || isSaving}
                style={{ paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: (canSave && !isSaving) ? buttonColor : (isDark ? colors.backgroundTertiary : '#E2E8F0') }}
              >
                <Text style={{ fontWeight: '600', fontSize: 16, color: (canSave && !isSaving) ? '#fff' : colors.textTertiary }}>
                  {isSaving ? t('saving', language) : t('save', language)}
                </Text>
              </Pressable>
            );
          })()}
        </View>

        {/* Services Removed Toast */}
        {servicesRemovedToast && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              position: 'absolute',
              bottom: 90,
              left: 20,
              right: 20,
              backgroundColor: isDark ? '#1E293B' : '#0F172A',
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 12,
              zIndex: 9999,
            }}
          >
            <AlertCircle size={18} color="#F59E0B" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500', flex: 1 }}>
              {t('someServicesRemovedMessage', language)}
            </Text>
          </Animated.View>
        )}

        {/* Inline Add Client overlay — avoids nested modal on iOS pageSheet */}
        <AddClientForm
          visible={showNewClientModal}
          onSaved={(clientId) => {
            setSelectedClientId(clientId);
            setShowNewClientModal(false);
          }}
          onClose={() => setShowNewClientModal(false)}
        />
      </SafeAreaView>

      {/* Client Search Modal */}
      <ClientSearchModal
        visible={showClientSearch}
        clients={filteredClients}
        searchQuery={clientSearchQuery}
        onQueryChange={setClientSearchQuery}
        selectedClientId={selectedClientId}
        clientsWithConflicts={clientsWithConflicts}
        onSelect={(clientId) => {
          setSelectedClientId(clientId);
          setShowClientSearch(false);
          setClientSearchQuery('');
          setConflictError(null);
        }}
        onConflict={(message) => setConflictError(message)}
        onClose={() => setShowClientSearch(false)}
      />

      {/* Send Email Modal */}
      {selectedClient && (
        <SendEmailModal
          visible={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          client={convertToLegacyClient(selectedClient)}
        />
      )}

      {/* Staff Management Screen */}
      <StaffManagementScreen
        visible={showStaffManagement}
        onClose={() => setShowStaffManagement(false)}
      />

      {/* Business Hours Overlay — must be last child to sit on top */}
      <BusinessHoursAlertModal
        visible={showBusinessHoursAlert}
        onDismiss={() => setShowBusinessHoursAlert(false)}
        language={language}
      />
    </Modal>

    {/* Local Success Toast - outside Modal so it persists after modal closes */}
    <LocalSuccessToast
      visible={showLocalSuccessToast}
      message={t('toastBooked', language)}
      onHide={() => setShowLocalSuccessToast(false)}
    />
  </>
  );
}
