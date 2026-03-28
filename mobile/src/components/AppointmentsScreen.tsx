import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  CalendarDays,
  Tag,
  Briefcase,
  Edit3,
  Trash2,
  Calendar,
  CalendarPlus,
  Users,
  AlertCircle,
  Filter,
  LayoutGrid,
  List,
  ChevronDown,
  RotateCcw,
  XCircle,
  Building2,
  Repeat,
  Search,
  Hash,
  CheckCircle,
  CreditCard,
  UserX,
  ClipboardCheck,
  Ban,
  Gift,
  Check,
  ArrowLeft,
  CalendarClock,
  Eye,
  Scissors,
  Sparkles,
  Star,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t, getDateFnsLocale, getCachedDateFnsLocale, getLocalizedStoreName } from '@/lib/i18n';
import { Client, Language } from '@/lib/types';
import {
  format,
  isSameDay,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  addWeeks,
  subWeeks,
  isWithinInterval,
  Locale,
} from 'date-fns';
import { BookAppointmentModal } from './BookAppointmentModal';
import { WheelDatePicker } from './WheelDatePicker';
import { getCurrencySymbol } from '@/lib/currency';
import { getServiceIconColor } from '@/lib/serviceColors';
import { LocalSuccessToast } from './LocalSuccessToast';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { getSupabase } from '@/lib/supabaseClient';
import {
  capitalize,
  capitalizeDate,
  formatTimeInput,
  calculateEndTime,
  getDateLabel as getDateLabelUtil,
  dateHasAppointments as dateHasAppointmentsUtil,
} from './appointments/appointmentsUtils';
// Supabase hooks
import {
  useAppointments,
  useDeletedAppointments,
  useUpdateAppointment,
  useCancelAppointment,
  useRestoreAppointment,
  useCheckAppointmentConflict,
  useSearchableAppointments,
  useSearchAppointments,
  useCreateAppointmentSeries,
  useCreateAppointmentsFromSeries,
  useSeriesPreview,
  useCheckInAppointment,
  useCompleteAppointment,
  useSetAppointmentOutcome,
  convertToLocalAppointment,
  type DateRangeMode as AppointmentsDateRangeMode,
  type AppointmentLifecycleStatus,
} from '@/hooks/useAppointments';
import { useStores } from '@/hooks/useStores';
import { useStaffMembers } from '@/hooks/useStaff';
import { useClients, useClient } from '@/hooks/useClients';
import { useServices, useSyncAppointmentServices } from '@/hooks/useServices';
import { useBusiness } from '@/hooks/useBusiness';
import type { SupabaseAppointment } from '@/services/appointmentsService';
import { notifyAppointmentEmail, transitionOverdueAppointments } from '@/services/appointmentsService';
import type {
  RecurrenceFrequency,
  RecurrenceEndType,
  SeriesPreview,
  CreateSeriesInput,
} from '@/services/appointmentsService';
import type { SupabaseStore } from '@/services/storesService';
import type { StaffMemberWithAssignments } from '@/services/staffService';
import type { SupabaseClient } from '@/services/clientsService';
import { useClientGiftCards, useGiftCardRedemptionByAppointment } from '@/hooks/useGiftCards';
import { useClientLoyalty } from '@/hooks/useLoyalty';
import type { GiftCard } from '@/lib/types';

import type { LocalAppointment, LocalStaff, LocalStore, SearchableAppointment } from './appointments/appointmentsTypes';
import { RestoreCancelledModal } from './appointments/RestoreCancelledModal';
import { EditAppointmentSelectorModal } from './appointments/EditAppointmentSelectorModal';
import { AppointmentSearchResults } from './appointments/AppointmentSearchResults';
import { AppointmentFilterBar } from './appointments/AppointmentFilterBar';
import { AppointmentListView } from './appointments/AppointmentListView';
import { AppointmentScheduleView } from './appointments/AppointmentScheduleView';

// View modes for appointments
type ViewMode = 'list' | 'schedule';

// Date range modes
type DateRangeMode = 'day' | 'week' | 'month';

// Time slots for schedule view (8 AM to 8 PM)
const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => {
  const hour = i + 8;
  return {
    hour,
    label: format(new Date().setHours(hour, 0, 0, 0), 'h a'),
    time24: `${hour.toString().padStart(2, '0')}:00`,
  };
});

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AppointmentsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function AppointmentsScreen({ visible, onClose }: AppointmentsScreenProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showBookAppointment, setShowBookAppointment] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<LocalAppointment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingAppointment, setViewingAppointment] = useState<LocalAppointment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // New state for enhanced features
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('day');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string | null>(null);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);
  const [showStaffFilterDropdown, setShowStaffFilterDropdown] = useState(false);
  const [showStoreFilterDropdown, setShowStoreFilterDropdown] = useState(false);
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [showDateRangeDropdown, setShowDateRangeDropdown] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState(60);
  const [editConflictError, setEditConflictError] = useState<string | null>(null);
  const [editSelectedServices, setEditSelectedServices] = useState<string[]>([]);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [showRestoreCancelledModal, setShowRestoreCancelledModal] = useState(false);
  const [showRestoreSuccessMessage, setShowRestoreSuccessMessage] = useState(false);
  const [showEditAppointmentSelector, setShowEditAppointmentSelector] = useState(false);
  const [showLocalSuccessToast, setShowLocalSuccessToast] = useState(false);
  const [localToastMessage, setLocalToastMessage] = useState('');
  const [showViewCancelConfirm, setShowViewCancelConfirm] = useState(false);
  const [cancellingFromView, setCancellingFromView] = useState(false);
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [editPromotionId, setEditPromotionId] = useState<string | null>(null);
  const [showEditPromotionPicker, setShowEditPromotionPicker] = useState(false);
  const [editGiftCardId, setEditGiftCardId] = useState<string | null>(null);
  const [showEditGiftCardPicker, setShowEditGiftCardPicker] = useState(false);

  // Lifecycle state
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeAppointment, setOutcomeAppointment] = useState<LocalAppointment | null>(null);
  const [showOutcomeInline, setShowOutcomeInline] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

  // Edit modal — recurring state (for converting a single appointment into a series)
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrenceFrequency, setEditRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [editRecurrenceEndType, setEditRecurrenceEndType] = useState<RecurrenceEndType>('occurrence_count');
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState<Date | null>(null);
  const [editRecurrenceCount, setEditRecurrenceCount] = useState('4');
  const [editCustomIntervalWeeks, setEditCustomIntervalWeeks] = useState('3');
  const [editSeriesPreviewData, setEditSeriesPreviewData] = useState<SeriesPreview | null>(null);

  // Quick Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currency);
  const marketingPromotions = useStore((s) => s.marketingPromotions);
  const [locale, setLocale] = useState<Locale>(() => getCachedDateFnsLocale(language));

  // Get businessId for overdue transitions
  const { businessId: businessIdForPolling } = useBusiness();

  // Transition overdue appointments on mount and periodically
  useEffect(() => {
    // Fire immediately on mount
    transitionOverdueAppointments(businessIdForPolling ?? undefined);

    // Also fire when app comes back to foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        transitionOverdueAppointments(businessIdForPolling ?? undefined);
        // Invalidate appointments so online bookings (created externally) appear immediately
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
      }
    });

    // Poll every 2 minutes while screen is open to catch online bookings
    const interval = setInterval(() => {
      transitionOverdueAppointments(businessIdForPolling ?? undefined);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }, 2 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [businessIdForPolling, queryClient]);

  // ============================================
  // Cleanup: reset ALL overlay/modal state when the screen closes.
  // This prevents invisible gesture-capture layers from blocking
  // the Dashboard after the user dismisses the Appointments modal.
  // ============================================
  useEffect(() => {
    if (!visible) {
      // Close every nested modal/overlay immediately so nothing blocks touches
      setShowCalendarPicker(false);
      setShowBookAppointment(false);
      setShowEditModal(false);
      setEditingAppointment(null);
      setShowViewModal(false);
      setViewingAppointment(null);
      setShowViewCancelConfirm(false);
      setCancellingFromView(false);
      setShowOutcomeModal(false);
      setOutcomeAppointment(null);
      setShowOutcomeInline(false);
      setShowEditAppointmentSelector(false);
      setShowRestoreCancelledModal(false);
      setShowRestoreSuccessMessage(false);
      setShowEditDatePicker(false);
      setShowEditPromotionPicker(false);
      setShowEditGiftCardPicker(false);
      setShowDateFilterModal(false);
      setShowDateRangeDropdown(false);
      setShowStaffFilterDropdown(false);
      setShowStoreFilterDropdown(false);
      setShowLocalSuccessToast(false);
      setLifecycleError(null);
      setLifecycleLoading(false);
      setSearchQuery('');
      setIsSearchFocused(false);
    }
  }, [visible]);

  // Get translated weekdays with proper capitalization
  const weekdays = useMemo(() => [
    capitalize(t('sunShort', language)),
    capitalize(t('monShort', language)),
    capitalize(t('tueShort', language)),
    capitalize(t('wedShort', language)),
    capitalize(t('thuShort', language)),
    capitalize(t('friShort', language)),
    capitalize(t('satShort', language)),
  ], [language]);

  // Format dates with locale and proper capitalization
  const formatWithLocale = useCallback((date: Date, formatStr: string) => {
    const formatted = format(date, formatStr, { locale });
    return capitalizeDate(formatted);
  }, [locale]);

  // Format "HH:mm" time strings using the locale's preferred clock (12h/24h).
  // Uses date-fns `p` token which automatically selects the right format per locale.
  const formatTime = useCallback((timeStr: string): string => {
    if (!timeStr || timeStr.length < 4) return timeStr;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    const d = new Date(2000, 0, 1, hours, minutes, 0);
    return format(d, 'p', { locale });
  }, [locale]);

  // ============================================
  // Supabase Data Hooks
  // ============================================

  // Stores from Supabase
  const { data: supabaseStores = [], isLoading: storesLoading } = useStores();

  // Convert stores to local format
  const stores: LocalStore[] = useMemo(() => {
    return supabaseStores.map((s) => ({
      id: s.id,
      name: s.name,
    }));
  }, [supabaseStores]);

  // Auto-select default store on initial load only.
  // Rule: if business has >1 store → default to All Stores (null); if only 1 store → default to that store's id.
  const storeAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (stores.length > 0 && !storeAutoSelectedRef.current) {
      storeAutoSelectedRef.current = true;
      if (stores.length === 1) {
        setSelectedStoreFilter(stores[0].id);
      } else {
        setSelectedStoreFilter(null); // All Stores
      }
    }
  }, [stores]);

  // Staff members from Supabase
  const { data: allStaffData = [], isLoading: staffLoading } = useStaffMembers();

  // Convert staff to local format and filter by selected store
  const staffMembers: LocalStaff[] = useMemo(() => {
    // Always start with all staff data
    const allStaff = allStaffData.map((s) => ({
      id: s.id,
      name: s.full_name,
      color: s.color,
      storeIds: s.store_ids || [],
      photoUrl: s.photo_url ?? null,
    }));

    // If no store is selected, show all staff
    if (!selectedStoreFilter) {
      return allStaff;
    }

    // If a store is selected, show staff that:
    // 1. Are assigned to this store, OR
    // 2. Have no store assignments (available for all stores)
    return allStaff.filter((staff) =>
      staff.storeIds.length === 0 || staff.storeIds.includes(selectedStoreFilter)
    );
  }, [selectedStoreFilter, allStaffData]);

  // Staff members for the Edit Appointment modal (filtered by editStoreId, not selectedStoreFilter)
  const editStaffMembers: LocalStaff[] = useMemo(() => {
    const allStaff = allStaffData.map((s) => ({
      id: s.id,
      name: s.full_name,
      color: s.color,
      storeIds: s.store_ids || [],
      photoUrl: s.photo_url ?? null,
    }));

    // If no store is selected in edit modal, show all staff
    if (!editStoreId) {
      return allStaff;
    }

    // Filter by the edit modal's store
    return allStaff.filter((staff) =>
      staff.storeIds.length === 0 || staff.storeIds.includes(editStoreId)
    );
  }, [editStoreId, allStaffData]);

  // Appointments from Supabase
  const {
    data: supabaseAppointments = [],
    isLoading: appointmentsLoading,
  } = useAppointments({
    date: selectedDate,
    rangeMode: dateRangeMode as AppointmentsDateRangeMode,
    storeId: selectedStoreFilter || undefined,
    staffId: selectedStaffFilter || undefined,
  });

  // Deleted/cancelled appointments for restore feature
  const { data: deletedAppointmentsData = [] } = useDeletedAppointments(selectedStoreFilter || undefined);

  // Clients from Supabase
  const { data: supabaseClients = [] } = useClients();

  // Fetch the specific client for the editing appointment (handles deleted clients)
  const { data: editingAppointmentClient } = useClient(editingAppointment?.clientId);
  const { data: viewingAppointmentClient } = useClient(viewingAppointment?.clientId);

  // Fetch active gift cards for the client being edited
  const { data: editClientGiftCardsRaw } = useClientGiftCards(editingAppointment?.clientId ?? undefined);
  const editClientActiveGiftCards = (editClientGiftCardsRaw ?? []).filter((gc: GiftCard) => gc.status === 'active');

  // Fetch gift cards for the client being viewed (to show gift card code in view modal)
  const { data: viewClientGiftCardsRaw, refetch: refetchViewClientGiftCards } = useClientGiftCards(viewingAppointment?.clientId ?? undefined);
  const viewClientGiftCards: GiftCard[] = viewClientGiftCardsRaw ?? [];

  // Fetch loyalty points for the client being viewed
  const { data: viewClientLoyalty } = useClientLoyalty(viewingAppointment?.clientId ?? undefined);

  // Fetch the real redemption transaction for the viewed appointment (source of truth for deducted amount)
  const { data: viewAppointmentRedemption, isLoading: redemptionLoading, refetch: refetchViewAppointmentRedemption } = useGiftCardRedemptionByAppointment(
    viewingAppointment?.giftCardId ?? null,
    viewingAppointment?.id ?? null
  );

  // ScrollView ref for scroll-to-top on date/view change
  const mainScrollViewRef = useRef<ScrollView>(null);

  // When the viewed appointment changes (modal opened / appointment switched), force re-fetch
  // gift card and redemption data so completed appointments always show post-deduction state.
  const prevViewingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = viewingAppointment?.id ?? null;
    if (id && id !== prevViewingIdRef.current) {
      prevViewingIdRef.current = id;
      // Re-fetch immediately so we never show stale usedQuantity or missing redemption record
      refetchViewClientGiftCards();
      refetchViewAppointmentRedemption();
    }
    if (!id) prevViewingIdRef.current = null;
  }, [viewingAppointment?.id]);

  // Scroll to top whenever date or view mode changes
  const filterRowHeightRef = useRef<number>(0);
  const containerHeightRef = useRef<number>(0);
  useEffect(() => {
    const dateKey = selectedDate.toISOString().slice(0, 10);
    const windowH = Dimensions.get('window').height;
    console.log(`[LAYOUT] selectedDate=${dateKey}, filterRowHeight=${filterRowHeightRef.current}, containerHeight=${containerHeightRef.current}, windowHeight=${windowH}`);
    requestAnimationFrame(() => {
      if (mainScrollViewRef.current) {
        mainScrollViewRef.current.scrollTo({ y: 0, animated: false });
      }
    });
  }, [selectedDate, viewMode]);

  // Services from Supabase
  const { data: supabaseServices = [] } = useServices();
  const syncServicesMutation = useSyncAppointmentServices();

  // All searchable appointments (for quick search - past year + future 6 months)
  const { data: searchableAppointmentsRaw = [], isLoading: searchLoading } = useSearchableAppointments();

  // Server-side search for confirmation codes and term-based queries
  const isConfirmationCodeCandidate = /^[A-Z0-9]{6,12}$/i.test(searchQuery.trim());
  const { data: serverSearchRaw = [], isFetching: serverSearchLoading } = useSearchAppointments(searchQuery);

  // Convert appointments to local format, enriching serviceName from supabaseServices when missing
  const appointments: LocalAppointment[] = useMemo(() => {
    return supabaseAppointments.map((apt) => {
      const local = convertToLocalAppointment(apt);
      if (!local.serviceName && local.serviceId) {
        const svc = supabaseServices.find((s) => s.id === local.serviceId);
        if (svc) return { ...local, serviceName: svc.name };
      }
      return local;
    });
  }, [supabaseAppointments, supabaseServices]);

  // Cancelled appointments for restore
  const cancelledAppointments: LocalAppointment[] = useMemo(() => {
    return deletedAppointmentsData.map((apt) => convertToLocalAppointment(apt));
  }, [deletedAppointmentsData]);

  // Active appointments for edit feature
  const activeAppointments: LocalAppointment[] = useMemo(() => {
    return appointments
      .filter((a) => !a.cancelled && !a.deleted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [appointments]);

  // Clients mapping
  const clients = supabaseClients;

  // Services list from Supabase (replaces old serviceTags)
  const serviceTags = useMemo(() => {
    return supabaseServices.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    }));
  }, [supabaseServices]);

  // ============================================
  // Supabase Mutations
  // ============================================

  const updateAppointmentMutation = useUpdateAppointment();
  const cancelAppointmentMutation = useCancelAppointment();
  const restoreAppointmentMutation = useRestoreAppointment();
  const checkConflictMutation = useCheckAppointmentConflict();
  const createSeriesMutation = useCreateAppointmentSeries();
  const createAppointmentsFromSeriesMutation = useCreateAppointmentsFromSeries();
  const seriesPreviewMutation = useSeriesPreview();
  const checkInMutation = useCheckInAppointment();
  const completeMutation = useCompleteAppointment();
  const outcomeMutation = useSetAppointmentOutcome();

  // Auth token helper for lifecycle calls
  const getAuthToken = async (): Promise<string | undefined> => {
    try {
      const { data } = await getSupabase().auth.getSession();
      return data.session?.access_token;
    } catch {
      return undefined;
    }
  };

  // Loading state
  const isLoading = appointmentsLoading || storesLoading || staffLoading;

  // ============================================
  // Lifecycle Handlers
  // ============================================

  const handleCheckIn = async (appointment: LocalAppointment) => {
    setLifecycleLoading(true);
    setLifecycleError(null);
    try {
      const token = await getAuthToken();
      await checkInMutation.mutateAsync({ appointmentId: appointment.id, authToken: token });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocalToastMessage(t('toastClientCheckedIn', language));
      setShowLocalSuccessToast(true);
      setShowViewModal(false);
      setViewingAppointment(null);
    } catch (err) {
      setLifecycleError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleComplete = async (appointment: LocalAppointment) => {
    setLifecycleLoading(true);
    setLifecycleError(null);
    try {
      const token = await getAuthToken();
      await completeMutation.mutateAsync({ appointmentId: appointment.id, giftCardId: appointment.giftCardId, authToken: token });
      // Gift card debit is handled server-side in /complete endpoint.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLocalToastMessage(t('toastAppointmentCompleted', language));
      setShowLocalSuccessToast(true);
      setShowViewModal(false);
      setViewingAppointment(null);
    } catch (err) {
      setLifecycleError(err instanceof Error ? err.message : 'Complete failed');
    } finally {
      setLifecycleLoading(false);
    }
  };

  const handleOutcome = async (outcome: 'completed' | 'no_show' | 'cancelled', debitGiftCard?: boolean) => {
    if (!outcomeAppointment) return;
    setLifecycleLoading(true);
    setLifecycleError(null);
    try {
      const token = await getAuthToken();
      await outcomeMutation.mutateAsync({ appointmentId: outcomeAppointment.id, outcome, giftCardId: outcomeAppointment.giftCardId, authToken: token, debitGiftCard });
      // Gift card debit is now handled server-side in the /outcome endpoint.
      // No mobile-side redeemGiftCardMutation call needed here.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const msg = outcome === 'completed' ? t('toastAppointmentCompleted', language) : outcome === 'no_show' ? t('toastMarkedNoShow', language) : t('appointmentCanceledSuccess', language);
      setLocalToastMessage(msg);
      setShowLocalSuccessToast(true);
      setShowOutcomeModal(false);
      setShowOutcomeInline(false);
      setOutcomeAppointment(null);
      setShowViewModal(false);
      setViewingAppointment(null);
    } catch (err) {
      setLifecycleError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLifecycleLoading(false);
    }
  };

  // ============================================
  // Quick Search Logic - Enterprise Grade
  // ============================================

  // Searchable appointments with joined data
  // (SearchableAppointment type imported from ./appointments/appointmentsTypes)

  // Convert searchable appointments to extended format with all metadata
  // Enrich clientName/email/phone from the already-fetched clients list since
  // searchAllAppointments does not join the clients table
  const searchableAppointments: SearchableAppointment[] = useMemo(() => {
    return searchableAppointmentsRaw.map((apt) => {
      const base = convertToLocalAppointment(apt);
      // Access joined data using type assertion for the raw response
      const rawApt = apt as SupabaseAppointment & {
        clients?: { id: string; name: string; email?: string; phone?: string };
        stores?: { id: string; name: string };
        staff_members?: { id: string; full_name: string; color: string };
        services?: { id: string; name: string; color: string };
      };

      const client = rawApt.clients ?? (base.clientId ? clients.find(c => c.id === base.clientId) : undefined);
      const store = rawApt.stores;
      const staff = rawApt.staff_members;
      const service = rawApt.services;

      // Use real DB confirmation_code if present; fall back to ID prefix for legacy appointments
      const confirmationCode = apt.confirmation_code
        ? apt.confirmation_code.toUpperCase()
        : apt.id.substring(0, 8).toUpperCase();

      return {
        ...base,
        clientName: client?.name ?? base.customerName,
        clientEmail: client?.email || undefined,
        clientPhone: client?.phone || undefined,
        storeName: store?.name || base.storeName,
        staffName: staff?.full_name || base.staffName,
        serviceName: service?.name || base.serviceName,
        serviceColor: service?.color || base.serviceColor,
        confirmationCode,
      };
    });
  }, [searchableAppointmentsRaw, clients]);

  // Convert server-side search results into SearchableAppointment format
  const serverSearchResults: SearchableAppointment[] = useMemo(() => {
    return serverSearchRaw.map((apt) => {
      const base = convertToLocalAppointment(apt);
      const rawApt = apt as SupabaseAppointment & {
        clients?: { id: string; name: string; email?: string; phone?: string };
        stores?: { id: string; name: string };
        staff_members?: { id: string; full_name: string; color: string };
        services?: { id: string; name: string; color: string };
      };
      const confirmationCode = apt.confirmation_code
        ? apt.confirmation_code.toUpperCase()
        : apt.id.substring(0, 8).toUpperCase();
      return {
        ...base,
        clientName: rawApt.clients?.name || (apt as any).customer_name,
        clientEmail: rawApt.clients?.email || (apt as any).customer_email || undefined,
        clientPhone: rawApt.clients?.phone || (apt as any).customer_phone || undefined,
        storeName: rawApt.stores?.name || base.storeName,
        staffName: rawApt.staff_members?.full_name || base.staffName,
        serviceName: rawApt.services?.name || base.serviceName,
        serviceColor: rawApt.services?.color || base.serviceColor,
        confirmationCode,
      };
    });
  }, [serverSearchRaw]);

  // Helper: returns true if an appointment is upcoming (today or future, not past/completed/cancelled)
  const isUpcomingAppointment = useCallback((apt: SearchableAppointment): boolean => {
    // Exclude cancelled, completed, no-show, deleted
    if (apt.cancelled || apt.deleted) return false;
    if (apt.lifecycleStatus === 'completed' || apt.lifecycleStatus === 'no_show' || apt.lifecycleStatus === 'cancelled') return false;

    const now = new Date();
    const aptDate = new Date(apt.date);

    // Normalize to midnight for date comparison
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const aptMidnight = new Date(aptDate.getFullYear(), aptDate.getMonth(), aptDate.getDate(), 0, 0, 0, 0);

    // Future dates (not today) are always upcoming
    if (aptMidnight > todayMidnight) return true;

    // Past dates (before today) are never upcoming
    if (aptMidnight < todayMidnight) return false;

    // For today: check if the start time is >= now
    if (apt.startTime) {
      const [h, m] = apt.startTime.split(':').map(Number);
      const aptStart = new Date(aptDate.getFullYear(), aptDate.getMonth(), aptDate.getDate(), h, m, 0, 0);
      return aptStart >= now;
    }

    return true;
  }, []);

  // Merged search results: upcoming appointments only, sorted soonest first
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();
    const upperQuery = searchQuery.trim().toUpperCase();

    // For confirmation-code candidates, use server results first (they search all dates),
    // then supplement with client-side matches from the loaded list
    if (isConfirmationCodeCandidate) {
      const serverIds = new Set(serverSearchResults.map(r => r.id));
      const clientCodeMatches = searchableAppointments.filter(apt =>
        apt.confirmationCode?.toUpperCase().startsWith(upperQuery) && !serverIds.has(apt.id)
      );
      const merged = [...serverSearchResults, ...clientCodeMatches]
        .filter(isUpcomingAppointment)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 20);
      return merged;
    }

    // For non-code queries: use client-side filter across loaded searchable appointments
    const results = searchableAppointments.filter((apt) => {
      // Also check confirmation code in case they search a partial code
      if (apt.confirmationCode?.toLowerCase().includes(query)) {
        return true;
      }

      // Last name search (word boundary matching)
      if (apt.clientName) {
        const nameParts = apt.clientName.toLowerCase().split(/\s+/);
        if (nameParts.some(part => part.startsWith(query))) {
          return true;
        }
        if (apt.clientName.toLowerCase().includes(query)) {
          return true;
        }
      }

      // Phone number search (strip non-digits for comparison)
      if (apt.clientPhone) {
        const phoneDigits = apt.clientPhone.replace(/\D/g, '');
        const queryDigits = query.replace(/\D/g, '');
        if (queryDigits.length >= 3 && phoneDigits.includes(queryDigits)) {
          return true;
        }
      }

      // Email search
      if (apt.clientEmail?.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    });

    // Supplement with server results not already in client-side results
    const clientIds = new Set(results.map(r => r.id));
    const extraServerResults = serverSearchResults.filter(r => !clientIds.has(r.id));

    return [...results, ...extraServerResults]
      .filter(isUpcomingAppointment)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 20);
  }, [searchQuery, searchableAppointments, serverSearchResults, isConfirmationCodeCandidate, isUpcomingAppointment]);

  // Determine if we should show search results
  const showSearchResults = searchQuery.trim().length > 0;

  // Get appointments for selected date
  const appointmentsForDate = useMemo(() => {
    let filtered = appointments.filter((a) => isSameDay(new Date(a.date), selectedDate) && !a.deleted);

    // Apply store filter
    if (selectedStoreFilter) {
      filtered = filtered.filter((a) => a.storeId === selectedStoreFilter);
    }

    // Apply staff filter
    if (selectedStaffFilter) {
      filtered = filtered.filter((a) => a.staffId === selectedStaffFilter);
    }

    return filtered.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [appointments, selectedDate, selectedStoreFilter, selectedStaffFilter]);

  // Get appointments for a date range (week or month)
  const appointmentsForRange = useMemo(() => {
    let startDate: Date;
    let endDate: Date;

    if (dateRangeMode === 'week') {
      startDate = startOfWeek(selectedDate);
      endDate = endOfWeek(selectedDate);
    } else if (dateRangeMode === 'month') {
      startDate = startOfMonth(selectedDate);
      endDate = endOfMonth(selectedDate);
    } else {
      return appointmentsForDate;
    }

    let filtered = appointments.filter((a) => {
      const appointmentDate = new Date(a.date);
      return isWithinInterval(appointmentDate, { start: startDate, end: endDate }) && !a.deleted;
    });

    // Apply store filter
    if (selectedStoreFilter) {
      filtered = filtered.filter((a) => a.storeId === selectedStoreFilter);
    }

    // Apply staff filter
    if (selectedStaffFilter) {
      filtered = filtered.filter((a) => a.staffId === selectedStaffFilter);
    }

    return filtered.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [appointments, selectedDate, dateRangeMode, appointmentsForDate, selectedStoreFilter, selectedStaffFilter]);

  // Get current appointments based on mode
  const currentAppointments = useMemo(() => {
    return dateRangeMode === 'day' ? appointmentsForDate : appointmentsForRange;
  }, [dateRangeMode, appointmentsForDate, appointmentsForRange]);

  // Get client by ID
  const getClient = useCallback(
    (clientId: string): SupabaseClient | undefined => {
      return clients.find((c) => c.id === clientId);
    },
    [clients]
  );

  // Get staff member by ID
  const getStaffMember = useCallback(
    (staffId: string | undefined): LocalStaff | undefined => {
      if (!staffId) return undefined;
      return staffMembers.find((s) => s.id === staffId);
    },
    [staffMembers]
  );

  // Get store by ID
  const getStore = useCallback(
    (storeId: string | undefined): LocalStore | undefined => {
      if (!storeId) return undefined;
      return stores.find((s) => s.id === storeId);
    },
    [stores]
  );

  // Determine appointment status for visual indicators
  type AppointmentStatus = 'ongoing' | 'next' | 'upcoming' | 'past' | null;

  const getAppointmentStatus = useCallback(
    (appointment: LocalAppointment, allDayAppointments: LocalAppointment[]): AppointmentStatus => {
      const now = new Date();
      const appointmentDate = new Date(appointment.date);

      // For past dates (not today), mark all appointments as past
      if (appointmentDate.setHours(23, 59, 59, 999) < new Date().setHours(0, 0, 0, 0)) {
        return 'past';
      }

      // For future dates (not today), don't show special status
      if (!isToday(appointmentDate)) {
        return null;
      }

      // Parse appointment times
      const [startHour, startMin] = appointment.startTime.split(':').map(Number);
      const appointmentStart = new Date(new Date(appointment.date));
      appointmentStart.setHours(startHour, startMin, 0, 0);

      // Calculate end time based on duration or endTime
      let appointmentEnd: Date;
      if (appointment.endTime) {
        const [endHour, endMin] = appointment.endTime.split(':').map(Number);
        appointmentEnd = new Date(appointmentDate);
        appointmentEnd.setHours(endHour, endMin, 0, 0);
      } else if (appointment.duration) {
        appointmentEnd = new Date(appointmentStart.getTime() + appointment.duration * 60 * 1000);
      } else {
        // Default to 1 hour if no end time or duration
        appointmentEnd = new Date(appointmentStart.getTime() + 60 * 60 * 1000);
      }

      // Check if appointment is ongoing
      if (now >= appointmentStart && now < appointmentEnd) {
        return 'ongoing';
      }

      // Check if appointment is in the past
      if (now >= appointmentEnd) {
        return 'past';
      }

      // Appointment is in the future - check if it's the next one
      const futureAppointments = allDayAppointments.filter((apt) => {
        const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
        const aptStart = new Date(appointmentDate);
        aptStart.setHours(aptStartHour, aptStartMin, 0, 0);
        return aptStart > now;
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

      // Check if any appointment is currently ongoing
      const hasOngoing = allDayAppointments.some((apt) => {
        const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
        const aptStart = new Date(appointmentDate);
        aptStart.setHours(aptStartHour, aptStartMin, 0, 0);

        let aptEnd: Date;
        if (apt.endTime) {
          const [aptEndHour, aptEndMin] = apt.endTime.split(':').map(Number);
          aptEnd = new Date(appointmentDate);
          aptEnd.setHours(aptEndHour, aptEndMin, 0, 0);
        } else if (apt.duration) {
          aptEnd = new Date(aptStart.getTime() + apt.duration * 60 * 1000);
        } else {
          aptEnd = new Date(aptStart.getTime() + 60 * 60 * 1000);
        }

        return now >= aptStart && now < aptEnd;
      });

      // If this is the first future appointment and nothing is ongoing, it's "next"
      if (futureAppointments.length > 0 && futureAppointments[0].id === appointment.id && !hasOngoing) {
        return 'next';
      }

      // Otherwise it's just upcoming
      return 'upcoming';
    },
    []
  );

  // Get calendar days for picker
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Navigation helpers
  const goToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(new Date());
    setCurrentMonth(new Date());
    setDateRangeMode('day');
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  const goToYesterday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const yesterday = subDays(new Date(), 1);
    setSelectedDate(yesterday);
    setCurrentMonth(yesterday);
    setDateRangeMode('day');
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  const goToTomorrow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tomorrow = addDays(new Date(), 1);
    setSelectedDate(tomorrow);
    setCurrentMonth(tomorrow);
    setDateRangeMode('day');
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  // Week navigation
  const goToThisWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(new Date());
    setCurrentMonth(new Date());
    setDateRangeMode('week');
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  const goToNextWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextWeek = addWeeks(selectedDate, 1);
    setSelectedDate(nextWeek);
    if (!isSameMonth(nextWeek, currentMonth)) {
      setCurrentMonth(nextWeek);
    }
    setDateRangeMode('week');
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  const goToPreviousWeek = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevWeek = subWeeks(selectedDate, 1);
    setSelectedDate(prevWeek);
    if (!isSameMonth(prevWeek, currentMonth)) {
      setCurrentMonth(prevWeek);
    }
    setDateRangeMode('week');
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  // Month navigation for viewing
  const goToThisMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(new Date());
    setCurrentMonth(new Date());
    setDateRangeMode('month');
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  const goToPreviousDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevDay = subDays(selectedDate, 1);
    setSelectedDate(prevDay);
    if (!isSameMonth(prevDay, currentMonth)) {
      setCurrentMonth(prevDay);
    }
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  const goToNextDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextDay = addDays(selectedDate, 1);
    setSelectedDate(nextDay);
    if (!isSameMonth(nextDay, currentMonth)) {
      setCurrentMonth(nextDay);
    }
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  // Calendar navigation
  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Handle day selection from calendar picker
  const handleDayPress = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(date);
    setShowCalendarPicker(false);
    setShowStoreFilterDropdown(false);
    setShowStaffFilterDropdown(false);
  };

  // Open edit modal
  const openEditModal = (appointment: LocalAppointment) => {
    setEditingAppointment(appointment);
    setEditTitle(appointment.title);
    setEditStartTime(appointment.startTime);
    setEditEndTime(appointment.endTime || '');
    setEditNotes(appointment.notes || '');
    setEditStaffId(appointment.staffId || null);
    setEditStoreId(appointment.storeId || null);
    setEditDuration(appointment.duration || 60);
    setEditConflictError(null);
    setEditDate(new Date(appointment.date));
    setShowEditDatePicker(false);

    // Auto-select service from appointment.serviceId or serviceTags
    let selectedServices: string[] = [];
    if (appointment.serviceId) {
      selectedServices = [appointment.serviceId];
    } else if (appointment.serviceTags && appointment.serviceTags.length > 0) {
      selectedServices = appointment.serviceTags;
    }
    setEditSelectedServices(selectedServices);

    // Auto-fill Amount:
    // 1. Use appointment.servicePrice if available (already converted from cents to dollars)
    // 2. Fall back to appointment.amount
    // 3. Fall back to sum of selected service prices
    let amountToUse = '';
    if (appointment.servicePrice != null && appointment.servicePrice > 0) {
      // servicePrice is already in dollars (converted from cents in convertToLocalAppointment)
      amountToUse = appointment.servicePrice.toFixed(2);
    } else if (appointment.amount != null && appointment.amount > 0) {
      amountToUse = appointment.amount.toString();
    } else if (selectedServices.length > 0) {
      // Calculate total from selected services (price_cents is in cents, convert to dollars)
      const serviceTotal = selectedServices.reduce((total, serviceId) => {
        const service = supabaseServices.find((s) => s.id === serviceId);
        return total + ((service?.price_cents || 0) / 100);
      }, 0);
      if (serviceTotal > 0) {
        amountToUse = serviceTotal.toFixed(2);
      }
    }
    setEditAmount(amountToUse);
    setEditPromotionId(appointment.promotionId || null);
    setShowEditPromotionPicker(false);
    setEditGiftCardId(appointment.giftCardId || null);
    setShowEditGiftCardPicker(false);

    // Reset recurring state — only allow creating a new series if this appointment has no series yet
    setEditIsRecurring(false);
    setEditRecurrenceFrequency('weekly');
    setEditRecurrenceEndType('occurrence_count');
    setEditRecurrenceEndDate(null);
    setEditRecurrenceCount('4');
    setEditCustomIntervalWeeks('3');
    setEditSeriesPreviewData(null);

    setShowEditModal(true);
  };

  // Handle edit start time change with auto-colon and auto-update end time
  const handleEditStartTimeChange = (text: string) => {
    const formattedTime = formatTimeInput(text);
    setEditStartTime(formattedTime);
    // Auto-update end time when start time is complete (HH:MM format)
    if (formattedTime.length === 5) {
      const [hours, minutes] = formattedTime.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const totalMinutes = hours * 60 + minutes + editDuration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        setEditEndTime(`${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`);
      }
    }
  };

  // Handle edit end time change with auto-colon
  const handleEditEndTimeChange = (text: string) => {
    const formattedTime = formatTimeInput(text);
    setEditEndTime(formattedTime);
  };

  // Handle duration change and auto-update end time
  const handleEditDurationChange = (minutes: number) => {
    setEditDuration(minutes);
    setEditConflictError(null);
    // Auto-update end time based on start time and new duration
    if (editStartTime && editStartTime.length === 5) {
      const newEndTime = calculateEndTime(editStartTime, minutes);
      if (newEndTime) {
        setEditEndTime(newEndTime);
      }
    }
  };

  // Toggle edit service tag selection
  const toggleEditService = (tagId: string) => {
    setEditSelectedServices((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Save appointment edit
  const handleSaveEdit = async () => {
    if (!editingAppointment) return;

    // Get the store ID (use edit store or fall back to original)
    const storeId = editStoreId || editingAppointment.storeId;

    // Check for conflicts before saving using the mutation
    if (storeId) {
      try {
        // Parse time to create Date objects for conflict check
        const [startHour, startMin] = editStartTime.split(':').map(Number);
        const startAt = new Date(editDate);
        startAt.setHours(startHour, startMin, 0, 0);

        const endAt = new Date(startAt.getTime() + editDuration * 60 * 1000);

        const conflicts = await checkConflictMutation.mutateAsync({
          storeId,
          staffId: editStaffId || null,
          startAt,
          endAt,
          excludeAppointmentId: editingAppointment.id,
        });

        if (conflicts && conflicts.length > 0) {
          const staffName = editStaffId
            ? staffMembers.find((s) => s.id === editStaffId)?.name || t('staffMember', language)
            : t('staffMember', language);
          setEditConflictError(t('staffConflictError', language).replace('{staffName}', staffName));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      } catch (err) {
        console.log('[AppointmentsScreen] Error checking conflicts:', err);
        // Continue without blocking if conflict check fails
      }
    }

    // Build title from selected service tags or use existing title
    const selectedTagNames = editSelectedServices
      .map((id) => serviceTags.find((tag) => tag.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const client = getClient(editingAppointment.clientId);
    const finalTitle = selectedTagNames || editTitle || `Appointment with ${client?.name || ''}`;

    // Parse time to create Date objects
    const [startHour, startMin] = editStartTime.split(':').map(Number);
    const startAt = new Date(editDate);
    startAt.setHours(startHour, startMin, 0, 0);

    const endAt = new Date(startAt.getTime() + editDuration * 60 * 1000);

    try {
      const updatedSupabaseApt = await updateAppointmentMutation.mutateAsync({
        appointmentId: editingAppointment.id,
        updates: {
          title: finalTitle,
          start_at: startAt,
          end_at: endAt,
          notes: editNotes || undefined,
          staff_id: editStaffId || null,
          duration_minutes: editDuration,
          amount: editAmount ? parseFloat(editAmount) : undefined,
          total_cents: editAmount ? Math.round(parseFloat(editAmount) * 100) : undefined,
          promo_id: editPromotionId ?? undefined,
          gift_card_id: editGiftCardId ?? undefined,
        },
      });

      // Sync services to appointment_services junction table
      if (editSelectedServices.length > 0) {
        await syncServicesMutation.mutateAsync({
          appointmentId: editingAppointment.id,
          serviceIds: editSelectedServices,
        });
      }

      // If recurring was enabled and this appointment has no series yet → create a series
      // starting from this appointment's date/time onward (the saved appointment becomes occurrence #1)
      if (editIsRecurring && !editingAppointment.seriesId) {
        try {
          const businessId = editingAppointment.userId; // userId = business_id in LocalAppointment
          const storeId = editStoreId || editingAppointment.storeId;
          const seriesInput: CreateSeriesInput = {
            business_id: businessId,
            store_id: storeId,
            staff_id: editStaffId || editingAppointment.staffId || null,
            client_id: editingAppointment.clientId,
            service_ids: editSelectedServices.length > 0 ? editSelectedServices : (editingAppointment.serviceTags ?? []),
            frequency_type: editRecurrenceFrequency,
            interval_value: editRecurrenceFrequency === 'custom' ? parseInt(editCustomIntervalWeeks) || 1 : 1,
            start_date: editDate,
            end_type: editRecurrenceEndType,
            end_date: editRecurrenceEndType === 'until_date' ? editRecurrenceEndDate : null,
            occurrence_count: editRecurrenceEndType === 'occurrence_count' ? parseInt(editRecurrenceCount) || 4 : null,
            start_time: editStartTime,
            duration_minutes: editDuration,
            amount: editAmount ? parseFloat(editAmount) : (editingAppointment.amount ?? 0),
            currency: editingAppointment.currency ?? 'USD',
            notes: editNotes || undefined,
          };

          // Generate occurrences
          let occurrences = editSeriesPreviewData?.occurrences;
          if (!occurrences || occurrences.length === 0) {
            const preview = await seriesPreviewMutation.mutateAsync({ input: seriesInput });
            occurrences = preview.occurrences;
          }

          if (occurrences && occurrences.length > 0) {
            const series = await createSeriesMutation.mutateAsync(seriesInput);
            await createAppointmentsFromSeriesMutation.mutateAsync({
              series,
              occurrences,
              skipConflicts: true,
            });
          }
        } catch (seriesErr) {
          console.log('[AppointmentsScreen] Series creation failed (appointment itself was saved):', seriesErr);
          // Don't block — the base appointment was already saved
        }
      }

      const savedAppointmentId = editingAppointment.id;
      const wasViewingThisAppointment = viewingAppointment?.id === savedAppointmentId;

      setShowEditModal(false);
      setEditingAppointment(null);
      setEditConflictError(null);
      setShowEditPromotionPicker(false);
      setEditIsRecurring(false);
      setEditSeriesPreviewData(null);
      // Update viewingAppointment so the View modal immediately reflects the saved changes
      // Merge onto existing viewingAppointment to preserve joined fields (staffName, storeName)
      // that are not returned by the raw update response.
      if (updatedSupabaseApt && wasViewingThisAppointment && viewingAppointment) {
        const freshLocal = convertToLocalAppointment(updatedSupabaseApt);
        setViewingAppointment({
          ...viewingAppointment,
          ...freshLocal,
          // Preserve joined display fields that the raw update response lacks
          staffName: freshLocal.staffName ?? viewingAppointment.staffName,
          storeName: freshLocal.storeName ?? viewingAppointment.storeName,
          serviceName: freshLocal.serviceName ?? viewingAppointment.serviceName,
          serviceColor: freshLocal.serviceColor ?? viewingAppointment.serviceColor,
        });
      }
      // Fire-and-forget: notify client of rescheduled appointment
      notifyAppointmentEmail(savedAppointmentId, 'updated', language);
      // Show global save confirmation after modal closes
      setTimeout(() => {
        showSaveConfirmation(t('appointmentUpdated', language));
      }, 350);
    } catch (err) {
      console.log('[AppointmentsScreen] Error updating appointment:', err);
      setEditConflictError('Failed to update appointment. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Cancel appointment (immediate, no confirmation)
  const handleCancelAppointment = async () => {
    if (!editingAppointment) return;

    try {
      await cancelAppointmentMutation.mutateAsync(editingAppointment.id);
      // Fire-and-forget: notify client of cancellation
      notifyAppointmentEmail(editingAppointment.id, 'cancelled', language);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowEditModal(false);
      setEditingAppointment(null);
    } catch (err) {
      console.log('[AppointmentsScreen] Error cancelling appointment:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Cancel appointment from View Appointment modal (with confirmation modal)
  const handleViewCancelAppointment = async () => {
    if (!viewingAppointment) return;
    setCancellingFromView(true);
    try {
      await cancelAppointmentMutation.mutateAsync(viewingAppointment.id);
      // Fire-and-forget: send cancellation email
      notifyAppointmentEmail(viewingAppointment.id, 'cancelled', language);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Close confirm overlay immediately
      setShowViewCancelConfirm(false);
      // Show success toast (it lives outside all inner modals so renders correctly)
      setLocalToastMessage(t('appointmentCanceledSuccess', language));
      setShowLocalSuccessToast(true);
      // After toast, close the View Appointment modal and return to list
      setTimeout(() => {
        setShowViewModal(false);
        setViewingAppointment(null);
        setShowOutcomeInline(false);
        setOutcomeAppointment(null);
      }, 1500);
    } catch (err) {
      console.log('[AppointmentsScreen] Error cancelling appointment from view:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowViewCancelConfirm(false);
    } finally {
      setCancellingFromView(false);
    }
  };

  // Add to Calendar handler
  const handleAddToCalendar = useCallback((type: 'google' | 'outlook' | 'ics') => {
    if (!editingAppointment) return;

    const start = editingAppointment.date;
    const end = new Date(start.getTime() + editingAppointment.duration * 60000);
    const client = clients.find((c) => c.id === editingAppointment.clientId);
    const title = editingAppointment.title || `Appointment with ${client?.name || 'Client'}`;

    if (type === 'google') {
      // Google Calendar URL
      const startStr = start.toISOString().replace(/-|:|\.\d{3}/g, '');
      const endStr = end.toISOString().replace(/-|:|\.\d{3}/g, '');
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(editingAppointment.notes || '')}`;
      Linking.openURL(url);
    } else if (type === 'outlook') {
      // Outlook Web URL
      const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: title,
        body: editingAppointment.notes || '',
        startdt: start.toISOString(),
        enddt: end.toISOString(),
      });
      const url = `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
      Linking.openURL(url);
    } else if (type === 'ics') {
      // Download ICS file from backend
      const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';
      const icsUrl = `${backendUrl}/calendar/${editingAppointment.id}.ics`;
      Linking.openURL(icsUrl);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [editingAppointment, clients]);

  // Restore cancelled appointment
  const handleRestoreAppointment = async (appointmentId?: string) => {
    const idToRestore = appointmentId || editingAppointment?.id;
    if (!idToRestore) return;

    try {
      await restoreAppointmentMutation.mutateAsync(idToRestore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRestoreSuccessMessage(true);
      setTimeout(() => setShowRestoreSuccessMessage(false), 3000);
      setShowEditModal(false);
      setEditingAppointment(null);
      setShowRestoreCancelledModal(false);
    } catch (err) {
      console.log('[AppointmentsScreen] Error restoring appointment:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Get date label
  const getDateLabel = (): string =>
    getDateLabelUtil({ dateRangeMode, selectedDate, formatWithLocale, language });

  // Navigate based on current mode
  const goToPreviousRange = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (dateRangeMode === 'day') {
      goToPreviousDay();
    } else if (dateRangeMode === 'week') {
      goToPreviousWeek();
    } else {
      const prevMonth = subMonths(selectedDate, 1);
      setSelectedDate(prevMonth);
      setCurrentMonth(prevMonth);
    }
  };

  const goToNextRange = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (dateRangeMode === 'day') {
      goToNextDay();
    } else if (dateRangeMode === 'week') {
      goToNextWeek();
    } else {
      const nextMonth = addMonths(selectedDate, 1);
      setSelectedDate(nextMonth);
      setCurrentMonth(nextMonth);
    }
  };

  // Check if date has appointments
  const dateHasAppointments = (date: Date): boolean =>
    dateHasAppointmentsUtil(date, appointments);

  // Render calendar day
  const renderCalendarDay = (date: Date, index: number) => {
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = isSameDay(date, selectedDate);
    const isTodayDate = isToday(date);
    const hasAppointments = dateHasAppointments(date);

    return (
      <Pressable
        key={index}
        onPress={() => handleDayPress(date)}
        style={{
          flex: 1,
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 2,
          borderRadius: 12,
          backgroundColor: isSelected
            ? primaryColor
            : isTodayDate
            ? isDark
              ? `${primaryColor}20`
              : `${primaryColor}15`
            : 'transparent',
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: isSelected || isTodayDate ? '600' : '400',
            color: isSelected
              ? '#FFFFFF'
              : !isCurrentMonth
              ? colors.textTertiary
              : isTodayDate
              ? primaryColor
              : colors.text,
          }}
        >
          {format(date, 'd')}
        </Text>
        {hasAppointments && !isSelected && (
          <View
            style={{
              position: 'absolute',
              bottom: 4,
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: primaryColor,
            }}
          />
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}
        edges={['top']}
      >
        {/* Header */}
        <View
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
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <CalendarDays size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
              {t('appointmentsTitle', language)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Quick Search Bar */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: isSearchFocused ? 2 : 0,
              borderColor: isSearchFocused ? primaryColor : 'transparent',
            }}
          >
            <Search size={18} color={colors.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder={t('searchAppointmentsPlaceholder', language)}
              placeholderTextColor={colors.textTertiary}
              style={{
                flex: 1,
                marginLeft: 10,
                fontSize: 15,
                color: colors.text,
                paddingVertical: 2,
              }}
              autoCapitalize="none"
              autoCorrect={false}
              cursorColor={primaryColor}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <XCircle size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Search Results - Shows when searching */}
        {showSearchResults && (
          <AppointmentSearchResults
            searchResults={searchResults}
            isSearchLoading={searchLoading}
            isServerSearchLoading={serverSearchLoading}
            formatWithLocale={formatWithLocale}
            formatTime={formatTime}
            currencySymbol={currencySymbol}
            language={language}
            onSelectAppointment={(apt) => {
              setViewingAppointment(apt);
              setShowViewModal(true);
              setSearchQuery('');
            }}
          />
        )}

        {/* Main Scrollable Content - Entire page scrolls (hidden when searching) */}
        {!showSearchResults && (
        <ScrollView
          ref={mainScrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

        {/* Action Buttons - Three Main Actions */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {/* Primary Action: Book Appointment (full width) */}
          <Pressable
            onPress={() => setShowBookAppointment(true)}
            style={{
              backgroundColor: primaryColor,
              borderRadius: 12,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 56,
              marginBottom: 10,
            }}
          >
            <Plus size={22} color="#fff" style={{ marginRight: 10 }} />
            <Text
              style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}
              numberOfLines={1}
            >
              {t('bookAppointment', language)}
            </Text>
          </Pressable>

          {/* Restore Appointment Button (only if there are cancelled appointments) */}
          {cancelledAppointments.length > 0 && (
            <Pressable
              onPress={() => setShowRestoreCancelledModal(true)}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 46,
                marginTop: 10,
              }}
            >
              <RotateCcw size={18} color={primaryColor} style={{ marginRight: 6 }} />
              <Text
                style={{ color: colors.text, fontWeight: '600', fontSize: 14, flexShrink: 1 }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {t('restoreAppointment', language)}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Success Message for Restored Appointment */}
        {showRestoreSuccessMessage && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={{
              marginHorizontal: 16,
              marginTop: 12,
              backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <RotateCcw size={18} color={isDark ? '#34D399' : '#059669'} />
            <Text style={{ color: isDark ? '#A7F3D0' : '#059669', fontSize: 14, marginLeft: 10, flex: 1 }}>
              {t('appointmentRestoredMessage', language)}
            </Text>
          </Animated.View>
        )}

        {/* View Appointments Section Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
            backgroundColor: isDark ? colors.background : '#F8FAFC',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
              {t('viewAppointments', language)}
            </Text>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 2,
                minWidth: 26,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: isDark ? colors.textSecondary : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {currentAppointments.length}
              </Text>
            </View>
          </View>
          {/* View Mode Toggle */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setViewMode('list')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: viewMode === 'list' ? primaryColor : isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <List size={18} color={viewMode === 'list' ? '#fff' : colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('schedule')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: viewMode === 'schedule' ? primaryColor : isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LayoutGrid size={18} color={viewMode === 'schedule' ? '#fff' : colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Compact Filter Bar */}
        <AppointmentFilterBar
          stores={stores}
          staffMembers={staffMembers}
          selectedStoreFilter={selectedStoreFilter}
          selectedStaffFilter={selectedStaffFilter}
          dateRangeMode={dateRangeMode}
          selectedDate={selectedDate}
          showStoreFilterDropdown={showStoreFilterDropdown}
          showStaffFilterDropdown={showStaffFilterDropdown}
          onSelectStore={(storeId) => {
            setSelectedStoreFilter(storeId);
            setSelectedStaffFilter(null);
            setShowStoreFilterDropdown(false);
          }}
          onSelectStaff={(staffId) => {
            setSelectedStaffFilter(staffId);
            setShowStaffFilterDropdown(false);
          }}
          onToggleStoreDropdown={() => {
            setShowStoreFilterDropdown(!showStoreFilterDropdown);
            setShowStaffFilterDropdown(false);
            setShowDateFilterModal(false);
          }}
          onToggleStaffDropdown={() => {
            setShowStaffFilterDropdown(!showStaffFilterDropdown);
            setShowStoreFilterDropdown(false);
            setShowDateFilterModal(false);
          }}
          onOpenDateFilterModal={() => {
            setShowDateFilterModal(true);
            setShowStoreFilterDropdown(false);
            setShowStaffFilterDropdown(false);
          }}
          onOpenCalendarPicker={() => setShowCalendarPicker(true)}
          onPreviousRange={goToPreviousRange}
          onNextRange={goToNextRange}
          dateLabel={getDateLabel()}
          formatWithLocale={formatWithLocale}
          onContainerLayout={(height) => { containerHeightRef.current = height; }}
          onFilterRowLayout={(height) => { filterRowHeightRef.current = height; }}
        />

        {/* Appointments Content - List View or Schedule View */}
        {viewMode === 'list' ? (
          <AppointmentListView
            currentAppointments={currentAppointments}
            dateRangeMode={dateRangeMode}
            serviceTags={serviceTags}
            language={language}
            getClient={getClient}
            getStaffMember={getStaffMember}
            getAppointmentStatus={getAppointmentStatus}
            formatTime={formatTime}
            formatWithLocale={formatWithLocale}
            dateLabel={getDateLabel()}
            onView={(appointment) => {
              setViewingAppointment(appointment);
              setShowViewModal(true);
            }}
            onEdit={(appointment) => openEditModal(appointment)}
          />
        ) : (
          <AppointmentScheduleView
            dateRangeMode={dateRangeMode}
            selectedDate={selectedDate}
            selectedStaffFilter={selectedStaffFilter}
            staffMembers={staffMembers}
            currentAppointments={currentAppointments}
            appointments={appointments}
            weekdays={weekdays}
            language={language}
            getClient={getClient}
            getStaffMember={getStaffMember}
            getAppointmentStatus={getAppointmentStatus}
            formatTime={formatTime}
            formatWithLocale={formatWithLocale}
            dateLabel={getDateLabel()}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setDateRangeMode('day');
            }}
            onView={(appointment) => {
              setViewingAppointment(appointment);
              setShowViewModal(true);
            }}
            onEdit={(appointment) => openEditModal(appointment)}
          />
        )}
        </ScrollView>
        )}
      </SafeAreaView>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDateFilterModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{'Date Range'}</Text>
            <Pressable onPress={() => setShowDateFilterModal(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
            {[
              { label: t('yesterday', language), action: goToYesterday, active: dateRangeMode === 'day' && isSameDay(selectedDate, subDays(new Date(), 1)) },
              { label: t('today', language), action: goToToday, active: dateRangeMode === 'day' && isToday(selectedDate) },
              { label: t('tomorrow', language), action: goToTomorrow, active: dateRangeMode === 'day' && isSameDay(selectedDate, addDays(new Date(), 1)) },
              { label: t('thisWeek', language), action: goToThisWeek, active: dateRangeMode === 'week' && isSameDay(startOfWeek(selectedDate), startOfWeek(new Date())) },
              { label: t('nextWeek', language), action: goToNextWeek, active: dateRangeMode === 'week' && isSameDay(startOfWeek(selectedDate), startOfWeek(addWeeks(new Date(), 1))) },
              { label: t('thisMonth', language), action: goToThisMonth, active: dateRangeMode === 'month' && isSameMonth(selectedDate, new Date()) },
            ].map(({ label, action, active }) => (
              <Pressable
                key={label}
                onPress={() => { action(); setShowDateFilterModal(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderRadius: 14,
                  backgroundColor: active ? `${primaryColor}15` : isDark ? colors.card : '#F8FAFC',
                  borderWidth: active ? 1 : 0,
                  borderColor: active ? `${primaryColor}30` : 'transparent',
                  marginBottom: 2,
                }}
              >
                <Text style={{ color: active ? primaryColor : colors.text, fontSize: 16, fontWeight: active ? '700' : '500' }}>{label}</Text>
                {active && <Check size={18} color={primaryColor} />}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Calendar Picker Modal */}
      <Modal
        visible={showCalendarPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCalendarPicker(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}
          edges={['top']}
        >
          <View
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
            <Pressable onPress={() => setShowCalendarPicker(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
              Select Date
            </Text>
            <Pressable onPress={goToToday}>
              <Text style={{ color: primaryColor, fontSize: 16, fontWeight: '600' }}>Today</Text>
            </Pressable>
          </View>

          <View style={{ padding: 20 }}>
            {/* Month Navigation */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <Pressable
                  onPress={goToPreviousMonth}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronLeft size={20} color={colors.textSecondary} />
                </Pressable>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                  {formatWithLocale(currentMonth, 'MMMM yyyy')}
                </Text>
                <Pressable
                  onPress={goToNextMonth}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronRight size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Weekday headers */}
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {weekdays.map((day, index) => (
                  <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {calendarDays.map((date, index) => (
                  <View key={index} style={{ width: '14.28%' }}>
                    {renderCalendarDay(date, index)}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* View Appointment Modal */}
      <Modal
        visible={showViewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowViewModal(false); setViewingAppointment(null); setShowOutcomeInline(false); setOutcomeAppointment(null); }}
        onDismiss={() => { setShowViewModal(false); setViewingAppointment(null); setShowOutcomeInline(false); setOutcomeAppointment(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
          {/* Header — calendar icon + title + X close */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <CalendarDays size={18} color={primaryColor} />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{t('viewAppointment', language)}</Text>
            </View>
            <Pressable
              onPress={() => { setShowViewModal(false); setViewingAppointment(null); setShowOutcomeInline(false); setOutcomeAppointment(null); }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {viewingAppointment && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>

              {/* 1. Lifecycle Status Banner — FIRST */}
              {(() => {
                const lc = viewingAppointment.lifecycleStatus ?? 'scheduled';
                const isLogVisit = viewingAppointment.isLogVisit === true;
                // Compute time-based ongoing: same logic as getAppointmentStatus on the card
                const now = Date.now();
                const apptDate = new Date(viewingAppointment.date);
                const [sh, sm] = viewingAppointment.startTime.split(':').map(Number);
                const apptStart = new Date(apptDate);
                apptStart.setHours(sh, sm, 0, 0);
                let apptEnd: Date;
                if (viewingAppointment.endTime) {
                  const [eh, em] = viewingAppointment.endTime.split(':').map(Number);
                  apptEnd = new Date(apptDate);
                  apptEnd.setHours(eh, em, 0, 0);
                } else {
                  apptEnd = new Date(apptStart.getTime() + (viewingAppointment.duration ?? 60) * 60 * 1000);
                }
                const isCurrentlyOngoing = lc === 'scheduled' && now >= apptStart.getTime() && now < apptEnd.getTime();
                // Log visits skip the "scheduled/check-in" step — treat them as already checked-in for display
                const effectiveLc = isLogVisit && lc === 'scheduled'
                  ? 'log_visit'
                  : isCurrentlyOngoing ? 'ongoing' : lc;
                const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                  scheduled: { label: t('statusScheduled', language), color: primaryColor, bg: `${primaryColor}15` },
                  log_visit: { label: t('visitTitle', language), color: primaryColor, bg: `${primaryColor}15` },
                  ongoing: { label: t('visitOngoing', language), color: primaryColor, bg: `${primaryColor}15` },
                  checked_in: { label: t('statusCheckedIn', language), color: primaryColor, bg: `${primaryColor}15` },
                  pending_confirmation: { label: t('statusPendingConfirmation', language), color: primaryColor, bg: `${primaryColor}15` },
                  completed: { label: t('statusCompleted', language), color: primaryColor, bg: `${primaryColor}15` },
                  no_show: { label: t('statusNoShow', language), color: primaryColor, bg: `${primaryColor}15` },
                  cancelled: { label: t('outcomeCancelled', language), color: primaryColor, bg: `${primaryColor}12` },
                };
                const cfg = statusConfig[effectiveLc] ?? statusConfig.scheduled;
                return (
                  <View style={{ backgroundColor: cfg.bg, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: `${cfg.color}30` }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>STATUS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: (viewingAppointment.checkedInAt || viewingAppointment.completedAt) ? 8 : 0 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.color }} />
                      <Text style={{ color: cfg.color, fontSize: 16, fontWeight: '700' }}>{cfg.label}</Text>
                    </View>
                    {viewingAppointment.checkedInAt && (
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                        {`${t('checkedInAt', language)}: ${formatWithLocale(viewingAppointment.checkedInAt, 'h:mm a')}`}
                      </Text>
                    )}
                    {viewingAppointment.completedAt && (
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                        {`${t('completedAt', language)}: ${formatWithLocale(viewingAppointment.completedAt, 'h:mm a')}`}
                      </Text>
                    )}
                  </View>
                );
              })()}

              {/* 2. Confirmation Code — always shown, directly under Status */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>{t('confirmationCodeLabel', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Hash size={16} color={primaryColor} />
                  </View>
                  <Text style={{ color: viewingAppointment.confirmationCode ? colors.text : colors.textTertiary, fontSize: 17, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1.5 }}>
                    {viewingAppointment.confirmationCode ?? '—'}
                  </Text>
                </View>
              </View>

              {/* 3. Client */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('clientLabel', language).toUpperCase()}</Text>
                {(() => {
                  const client = getClient(viewingAppointment.clientId) || viewingAppointmentClient;
                  const fallbackName = viewingAppointment.customerName;
                  return client ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 16 }}>{client.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{client.name}</Text>
                        {client.email ? <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{client.email}</Text> : null}
                      </View>
                    </View>
                  ) : fallbackName ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 16 }}>{fallbackName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{fallbackName}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{viewingAppointment.clientId}</Text>
                  );
                })()}
              </View>

              {/* Repeat / Recurring — shown right under Client */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('repeatAppointment', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: viewingAppointment.seriesId ? `${primaryColor}18` : (isDark ? colors.backgroundTertiary : '#F1F5F9'), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Repeat size={16} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('repeatAppointment', language)}</Text>
                      {viewingAppointment.seriesId ? (
                        <Text style={{ color: primaryColor, fontSize: 12, marginTop: 2 }}>
                          {t('recurringAppointmentBadge', language)}{viewingAppointment.seriesOccurrenceIndex != null ? `  ·  ${t('occurrenceLabel', language)} #${viewingAppointment.seriesOccurrenceIndex}` : ''}
                        </Text>
                      ) : (
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{t('repeatDescription', language)}</Text>
                      )}
                    </View>
                  </View>
                  {/* Toggle display (read-only) */}
                  <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: viewingAppointment.seriesId ? primaryColor : (isDark ? '#374151' : '#D1D5DB'), justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2, alignSelf: viewingAppointment.seriesId ? 'flex-end' : 'flex-start' }} />
                  </View>
                </View>
              </View>

              {/* Date */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('dateLabel', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <CalendarDays size={16} color={primaryColor} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>
                    {formatWithLocale(new Date(viewingAppointment.date), 'EEEE, MMMM d, yyyy')}
                  </Text>
                </View>
              </View>

              {/* Time */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('timeLabel', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={16} color={primaryColor} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>
                    {viewingAppointment.startTime ? formatTime(viewingAppointment.startTime) : ''}{viewingAppointment.endTime ? ` — ${formatTime(viewingAppointment.endTime)}` : ''}
                  </Text>
                </View>
              </View>

              {/* Staff Member — resolved from allStaffData using staffId */}
              {(() => {
                const resolvedStaff = viewingAppointment.staffId
                  ? allStaffData.find((s) => s.id === viewingAppointment.staffId)
                  : null;
                const staffName = resolvedStaff?.full_name || viewingAppointment.staffName;
                const staffPhoto = resolvedStaff?.photo_url || resolvedStaff?.avatar_url;
                const staffColor = resolvedStaff?.color || primaryColor;
                return (
                  <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('staffMember', language).toUpperCase()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {staffName ? (
                        staffPhoto ? (
                          <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12 }}>
                            <Image
                              source={{ uri: staffPhoto }}
                              style={{ width: 40, height: 40, borderRadius: 20 }}
                            />
                          </View>
                        ) : (
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${staffColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ color: staffColor, fontWeight: '700', fontSize: 16 }}>{staffName.charAt(0).toUpperCase()}</Text>
                          </View>
                        )
                      ) : (
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <User size={18} color={colors.textTertiary} />
                        </View>
                      )}
                      <Text style={{ color: staffName ? colors.text : colors.textTertiary, fontSize: 15, fontWeight: staffName ? '500' : 'normal' }}>
                        {staffName || t('noStaffAssigned', language)}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Services */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('services', language).toUpperCase()}</Text>
                {viewingAppointment.serviceTags && viewingAppointment.serviceTags.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {viewingAppointment.serviceTags.map((sid) => {
                      const svc = serviceTags.find((s) => s.id === sid);
                      return svc ? (
                        <View key={sid} style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, marginBottom: 6 }}>
                          <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '500' }}>{svc.name}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                ) : (
                  <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>{t('noServicesYet', language)}</Text>
                )}
              </View>

              {/* Duration */}
              {viewingAppointment.duration != null && viewingAppointment.duration > 0 && (
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('durationLabel', language).toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={16} color={primaryColor} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>
                      {viewingAppointment.duration} {t('minLabel', language)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Store */}
              {viewingAppointment.storeName ? (
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('storesLabel', language).toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Building2 size={16} color={primaryColor} />
                    <Text style={{ color: colors.text, fontSize: 15, marginLeft: 10 }}>{viewingAppointment.storeName}</Text>
                  </View>
                </View>
              ) : null}

              {/* Promotion */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('promotionLabel', language).toUpperCase()}</Text>
                {viewingAppointment.promotionId ? (() => {
                  const promo = marketingPromotions.find((p) => p.id === viewingAppointment.promotionId);
                  return promo ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primaryColor, marginRight: 10 }} />
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{promo.name}</Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>{t('noPromotionSelected', language)}</Text>
                  );
                })() : (
                  <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>{t('noPromotionSelected', language)}</Text>
                )}
              </View>

              {/* Loyalty Points */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>LOYALTY POINTS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Star size={16} color={primaryColor} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                    {(viewClientLoyalty?.total_points ?? 0).toLocaleString()} points
                  </Text>
                </View>
              </View>

              {/* Gift Card — always shown when giftCardIntent, giftCardId, or giftCardCodeFromNotes is set */}
              {(viewingAppointment.giftCardIntent || viewingAppointment.giftCardId || viewingAppointment.giftCardCodeFromNotes) ? (() => {
                // Look up by UUID first, then by code from notes
                const gc = viewingAppointment.giftCardId
                  ? viewClientGiftCards.find(g => g.id === viewingAppointment.giftCardId)
                  : viewingAppointment.giftCardCodeFromNotes
                    ? viewClientGiftCards.find(g =>
                        g.code.replace(/-/g, '').toUpperCase() === viewingAppointment.giftCardCodeFromNotes!.replace(/-/g, '').toUpperCase()
                      )
                    : undefined;
                const statusLabels: Record<string, string> = {
                  active: t('statusActive', language),
                  fully_used: t('statusFullyUsed', language),
                  expired: t('statusExpired', language),
                  cancelled: t('statusCancelled', language),
                };
                return (
                  <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 }}>GIFT CARD</Text>
                    {gc ? (
                      <>
                        {/* Code row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Gift size={18} color={primaryColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 }}>{gc.code}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <View style={{ backgroundColor: `${primaryColor}18`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>{statusLabels[gc.status] ?? gc.status}</Text>
                              </View>
                              {viewingAppointment.giftCardDebited && (
                                <View style={{ backgroundColor: `${primaryColor}12`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 6 }}>
                                  <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>Debited</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        {/* Details grid */}
                        {(() => {
                          // SOURCE OF TRUTH: use actual redemption transaction record
                          const redemption = viewAppointmentRedemption;
                          // If no transaction row yet, fall back to appointment amount when debited flag is set
                          const deductedAmount = redemption?.amount != null
                            ? redemption.amount
                            : (viewingAppointment?.giftCardDebited ? (viewingAppointment?.amount ?? null) : null);
                          const originalCredit = gc.type === 'value' ? (gc.originalValue ?? null) : null;
                          const currentBalance = gc.type === 'value' ? (gc.currentBalance ?? null) : null;

                          // Service card state
                          const gcServices = gc.services ?? [];
                          // COMPLETED = show post-deduction state.
                          // Use lifecycleStatus=completed as the primary signal (always accurate after re-fetch).
                          // Also accept giftCardDebited=true as a secondary signal.
                          const apptLc = viewingAppointment.lifecycleStatus ?? 'scheduled';
                          const debited = apptLc === 'completed' || viewingAppointment.giftCardDebited === true;

                          // SOURCE OF TRUTH for deducted service: DB redemption transaction record
                          // Falls back to UI inference only when no transaction exists yet (pre-deduction)
                          const deductedServiceName = redemption?.serviceName ?? null;
                          const deductedServiceQty = redemption?.quantityUsed ?? 1;

                          // Pre-deduction: infer which service will be deducted (for label only, not math)
                          const apptServiceIds: string[] = viewingAppointment.serviceTags ?? [];
                          const inferredMatchedServices = gcServices.filter(s => apptServiceIds.includes(s.serviceId));

                          // DB-first remaining list: always derived directly from gc.services (live DB values).
                          // gc is re-fetched (staleTime:0 + cache invalidation) after every completion.
                          // NEVER add or subtract anything — usedQuantity in DB is the source of truth.
                          const remainingFromDB = gcServices.map(s => ({
                            serviceId: s.serviceId,
                            serviceName: s.serviceName,
                            remainingQty: s.quantity - s.usedQuantity,
                          }));

                          return (
                            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 6 }}>
                              {/* VALUE card rows */}
                              {gc.type === 'value' && originalCredit != null && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('originalCreditLabel', language)}</Text>
                                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{currencySymbol}{originalCredit.toFixed(2)}</Text>
                                </View>
                              )}
                              {gc.type === 'value' && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('deductedLabel', language)}</Text>
                                  {deductedAmount != null ? (
                                    <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>-{currencySymbol}{deductedAmount.toFixed(2)}</Text>
                                  ) : (
                                    <Text style={{ color: colors.textTertiary, fontSize: 13, fontStyle: 'italic' }}>{currencySymbol}0.00 ({t('notYetDebitedLabel', language)})</Text>
                                  )}
                                </View>
                              )}
                              {gc.type === 'value' && currentBalance != null && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('newBalanceLabel', language)}</Text>
                                  <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '700' }}>{currencySymbol}{currentBalance.toFixed(2)}</Text>
                                </View>
                              )}

                              {/* SERVICE card rows */}
                              {gc.type === 'service' && gcServices.length > 0 && (
                                <>
                                  {/* Service to Deduct / Service Deducted */}
                                  <View style={{ marginBottom: 4 }}>
                                    <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 }}>
                                      {debited ? t('serviceDeducted', language) : t('serviceToDeduct', language)}
                                    </Text>
                                    {debited ? (
                                      // POST-DEDUCTION: use DB transaction as source of truth
                                      redemptionLoading ? (
                                        // Brief spinner while transaction row loads
                                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                                          <ActivityIndicator size="small" color={primaryColor} style={{ marginRight: 8 }} />
                                          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('loading', language)}</Text>
                                        </View>
                                      ) : deductedServiceName ? (
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                                          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{deductedServiceName}</Text>
                                          <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>×{deductedServiceQty}</Text>
                                          </View>
                                        </View>
                                      ) : inferredMatchedServices.length > 0 ? (
                                        // Fallback: infer from gift card services + appointment service tags
                                        // (transaction row exists but service_name not yet written — legacy data)
                                        inferredMatchedServices.map(s => (
                                          <View key={s.serviceId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                                            <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{s.serviceName}</Text>
                                            <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>×1</Text>
                                            </View>
                                          </View>
                                        ))
                                      ) : gcServices.length > 0 ? (
                                        // Last resort: show all services on the gift card (can't determine which was used)
                                        gcServices.map(s => (
                                          <View key={s.serviceId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                                            <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{s.serviceName}</Text>
                                            <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>×1</Text>
                                            </View>
                                          </View>
                                        ))
                                      ) : (
                                        <Text style={{ color: colors.textTertiary, fontSize: 13, fontStyle: 'italic' }}>
                                          {t('noGiftCardDeductionRecorded', language)}
                                        </Text>
                                      )
                                    ) : (
                                      // PRE-DEDUCTION: infer from appointment services
                                      inferredMatchedServices.length > 0 ? inferredMatchedServices.map(s => (
                                        <View key={s.serviceId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                                          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{s.serviceName}</Text>
                                          <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>×1</Text>
                                          </View>
                                        </View>
                                      )) : (
                                        <Text style={{ color: '#EF4444', fontSize: 13, fontStyle: 'italic' }}>
                                          {t('serviceNotFoundOnGiftCard', language)}
                                        </Text>
                                      )
                                    )}
                                  </View>

                                  {/* Services Remaining (Before / After) */}
                                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2 }}>
                                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 }}>
                                      {debited ? t('servicesRemainingAfter', language) : t('servicesRemainingBefore', language)}
                                    </Text>
                                    {(remainingFromDB).map(s => (
                                      <View key={s.serviceId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                                        <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{s.serviceName}</Text>
                                        <Text style={{ color: s.remainingQty > 0 ? colors.text : colors.textTertiary, fontSize: 13, fontWeight: '600' }}>
                                          {s.remainingQty} {t('leftLabel', language)}
                                        </Text>
                                      </View>
                                    ))}
                                  </View>
                                </>
                              )}

                              {/* Issued / Expires — always shown */}
                              <View style={{ borderTopWidth: gc.type === 'service' ? 1 : 0, borderTopColor: colors.border, paddingTop: gc.type === 'service' ? 8 : 0, marginTop: gc.type === 'service' ? 2 : 0, gap: 6 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('issuedLabel', language)}</Text>
                                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>{formatWithLocale(gc.issuedAt, 'MMM d, yyyy')}</Text>
                                </View>
                                {gc.expiresAt && (
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('expiresLabel', language)}</Text>
                                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>{formatWithLocale(gc.expiresAt, 'MMM d, yyyy')}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })()}
                      </>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Gift size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>
                          {viewingAppointment.giftCardCodeFromNotes ?? (viewingAppointment.giftCardId ? viewingAppointment.giftCardId.slice(0, 8).toUpperCase() : 'Loading...')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })() : (
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>GIFT CARD</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Gift size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
                    <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>No gift card used</Text>
                  </View>
                </View>
              )}

              {/* Amount — priority: totalCents > subtotalCents > servicePrice > amount */}
              {(() => {
                const displayAmount =
                  (viewingAppointment.totalCents != null && viewingAppointment.totalCents > 0)
                    ? viewingAppointment.totalCents / 100
                  : (viewingAppointment.subtotalCents != null && viewingAppointment.subtotalCents > 0)
                    ? viewingAppointment.subtotalCents / 100
                  : (viewingAppointment.servicePrice != null && viewingAppointment.servicePrice > 0)
                    ? viewingAppointment.servicePrice
                  : (viewingAppointment.amount != null && viewingAppointment.amount > 0)
                    ? viewingAppointment.amount
                  : null;
                return (
                  <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('appointmentAmount', language).toUpperCase()}</Text>
                    <Text style={{ color: displayAmount ? colors.text : colors.textTertiary, fontSize: 22, fontWeight: '700' }}>
                      {displayAmount != null ? `${currencySymbol}${displayAmount.toFixed(2)}` : `${currencySymbol}0.00`}
                    </Text>
                  </View>
                );
              })()}

              {/* Notes */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('notesLabel', language).toUpperCase()}</Text>
                <Text style={{ color: viewingAppointment.notes ? colors.text : colors.textTertiary, fontSize: 15, lineHeight: 22, fontStyle: viewingAppointment.notes ? 'normal' : 'italic' }}>
                  {viewingAppointment.notes || t('anyAdditionalNotes', language)}
                </Text>
              </View>

              {/* Lifecycle Action Buttons */}
              {(() => {
                const lc = viewingAppointment.lifecycleStatus ?? 'scheduled';
                const isLogVisitFlag = viewingAppointment.isLogVisit === true;
                // Log visits start at "checked_in" equivalent — skip the Check In step
                const effectiveLcForButtons = isLogVisitFlag && lc === 'scheduled' ? 'checked_in' : lc;
                const isCheckedInBtn = effectiveLcForButtons === 'checked_in';
                const isPendingBtn = effectiveLcForButtons === 'pending_confirmation';
                const isTerminal = effectiveLcForButtons === 'completed' || effectiveLcForButtons === 'no_show' || effectiveLcForButtons === 'cancelled';
                return (
                  <View style={{ gap: 10, marginBottom: 12 }}>
                    {/* Check-In Button — shown for scheduled appointments ONLY (not log visits) */}
                    {effectiveLcForButtons === 'scheduled' && (
                      <Pressable
                        onPress={() => handleCheckIn(viewingAppointment)}
                        disabled={lifecycleLoading}
                        style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                      >
                        {lifecycleLoading ? <ActivityIndicator color="#fff" size="small" /> : null}
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('checkInClient', language)}</Text>
                      </Pressable>
                    )}
                    {/* Confirm Outcome — shown for pending_confirmation */}
                    {isPendingBtn && !showOutcomeInline && (
                      <Pressable
                        onPress={() => {
                          setOutcomeAppointment(viewingAppointment);
                          setShowOutcomeInline(true);
                        }}
                        disabled={lifecycleLoading}
                        style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                      >
                        <ClipboardCheck size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('confirmOutcome', language)}</Text>
                      </Pressable>
                    )}
                    {/* Inline Outcome Panel — expands in place instead of opening a second modal */}
                    {isPendingBtn && showOutcomeInline && (
                      <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: `${primaryColor}30` }}>
                        {/* Panel header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                            <ClipboardCheck size={18} color={primaryColor} />
                          </View>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{t('confirmOutcome', language)}</Text>
                          <Pressable
                            onPress={() => { setShowOutcomeInline(false); setOutcomeAppointment(null); }}
                            style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <X size={15} color={colors.textSecondary} />
                          </Pressable>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
                          {t('outcomeQuestionShort', language)}
                        </Text>
                        {/* Option A: Completed — Revenue only */}
                        <Pressable
                          onPress={() => handleOutcome('completed', false)}
                          disabled={lifecycleLoading}
                          style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: `${primaryColor}30` }}
                        >
                          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={20} color={primaryColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{t('outcomeCompleted', language)}</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>{t('outcomeCompletedNoGiftCardDesc', language)}</Text>
                          </View>
                        </Pressable>
                        {/* Option B: Completed + Gift Card */}
                        <Pressable
                          onPress={() => handleOutcome('completed', true)}
                          disabled={lifecycleLoading}
                          style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: `${primaryColor}30` }}
                        >
                          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={20} color={primaryColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{t('outcomeCompletedGiftCard', language)}</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>{t('outcomeCompletedGiftCardDesc', language)}</Text>
                          </View>
                        </Pressable>
                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
                        {/* No Show */}
                        <Pressable
                          onPress={() => handleOutcome('no_show')}
                          disabled={lifecycleLoading}
                          style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#EF444425' }}
                        >
                          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#EF444412', alignItems: 'center', justifyContent: 'center' }}>
                            <UserX size={20} color="#EF4444" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '700' }}>{t('outcomeNoShow', language)}</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>{t('outcomeNoRevenueNoDebit', language)}</Text>
                          </View>
                        </Pressable>
                        {/* Cancelled */}
                        <Pressable
                          onPress={() => handleOutcome('cancelled')}
                          disabled={lifecycleLoading}
                          style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border }}
                        >
                          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: isDark ? colors.background : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                            <Ban size={20} color={colors.textSecondary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '700' }}>{t('outcomeCancelled', language)}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{t('outcomeNoRevenueNoDebit', language)}</Text>
                          </View>
                        </Pressable>
                        {lifecycleLoading && <ActivityIndicator color={primaryColor} style={{ marginTop: 12 }} />}
                        {lifecycleError && (
                          <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 10 }}>{lifecycleError}</Text>
                        )}
                      </View>
                    )}
                    {/* Complete Button — shown for checked-in appointments */}
                    {isCheckedInBtn && (
                      <Pressable
                        onPress={() => handleComplete(viewingAppointment)}
                        disabled={lifecycleLoading}
                        style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                      >
                        {lifecycleLoading ? <ActivityIndicator color="#fff" size="small" /> : null}
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('markCompleted', language)}</Text>
                      </Pressable>
                    )}
                    {/* Error message */}
                    {lifecycleError && !showOutcomeInline && (
                      <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>{lifecycleError}</Text>
                    )}
                    {/* Edit Button — only if not in terminal state and not showing inline outcome */}
                    {!isTerminal && !showOutcomeInline && (
                      <Pressable
                        onPress={() => {
                          setShowViewModal(false);
                          setViewingAppointment(null);
                          setTimeout(() => openEditModal(viewingAppointment), 350);
                        }}
                        style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('editAppointment', language)}</Text>
                      </Pressable>
                    )}
                    {/* Cancel Button — same style as Edit button, only if not in terminal state */}
                    {!isTerminal && !showOutcomeInline && (
                      <Pressable
                        onPress={() => setShowViewCancelConfirm(true)}
                        style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10 }}
                      >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('cancelAppointment', language)}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })()}
              <View style={{ height: 28 }} />
            </ScrollView>
          )}

          {/* Cancel Confirmation Overlay — rendered inside the View Appointment sheet */}
          {showViewCancelConfirm && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, zIndex: 100 }}>
              <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 380 }}>
                {/* Icon */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={28} color={primaryColor} />
                  </View>
                </View>
                {/* Title */}
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 }}>
                  {t('cancelAppointmentConfirmTitle', language)}
                </Text>
                {/* Body */}
                <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 }}>
                  {t('cancelAppointmentConfirmMessage', language)}
                </Text>
                {/* Confirm button */}
                <Pressable
                  onPress={handleViewCancelAppointment}
                  disabled={cancellingFromView}
                  style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                >
                  {cancellingFromView ? <ActivityIndicator color="#fff" size="small" /> : null}
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('cancelAppointment', language)}</Text>
                </Pressable>
                {/* Keep button */}
                <Pressable
                  onPress={() => setShowViewCancelConfirm(false)}
                  disabled={cancellingFromView}
                  style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{t('keepAppointment', language)}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Confirm Outcome Modal */}
      <Modal
        visible={showOutcomeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowOutcomeModal(false); setOutcomeAppointment(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
          {/* Header — icon left, title left-aligned, X right */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <ClipboardCheck size={20} color={primaryColor} />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>{t('confirmOutcome', language)}</Text>
            </View>
            <Pressable onPress={() => { setShowOutcomeModal(false); setOutcomeAppointment(null); }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {outcomeAppointment && (
              <>
                <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
                  {t('outcomeQuestionShort', language)}
                </Text>

                {/* Option A: Completed — Revenue only */}
                <Pressable
                  onPress={() => handleOutcome('completed', false)}
                  disabled={lifecycleLoading}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    borderWidth: 1.5,
                    borderColor: `${primaryColor}40`,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={22} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>{t('outcomeCompleted', language)}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{t('outcomeCompletedNoGiftCardDesc', language)}</Text>
                  </View>
                </Pressable>

                {/* Option B: Completed — Gift card debited */}
                <Pressable
                  onPress={() => handleOutcome('completed', true)}
                  disabled={lifecycleLoading}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    borderWidth: 1.5,
                    borderColor: `${primaryColor}40`,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={22} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>{t('outcomeCompletedGiftCard', language)}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{t('outcomeCompletedGiftCardDesc', language)}</Text>
                  </View>
                </Pressable>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />

                {/* No Show */}
                <Pressable
                  onPress={() => handleOutcome('no_show')}
                  disabled={lifecycleLoading}
                  style={{ backgroundColor: colors.card, borderRadius: 16, padding: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#EF444430' }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#EF444412', alignItems: 'center', justifyContent: 'center' }}>
                    <UserX size={22} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>{t('outcomeNoShow', language)}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{t('outcomeNoShowDesc2', language)}</Text>
                  </View>
                </Pressable>

                {/* Cancelled */}
                <Pressable
                  onPress={() => handleOutcome('cancelled')}
                  disabled={lifecycleLoading}
                  style={{ backgroundColor: colors.card, borderRadius: 16, padding: 18, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: colors.border }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                    <Ban size={22} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '700', marginBottom: 2 }}>{t('outcomeCancelled', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 18 }}>{t('outcomeCancelledDesc2', language)}</Text>
                  </View>
                </Pressable>

                {lifecycleError && (
                  <Text style={{ color: '#EF4444', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{lifecycleError}</Text>
                )}

                {lifecycleLoading && <ActivityIndicator color={primaryColor} style={{ marginTop: 8 }} />}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Appointment Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}
          edges={['top']}
        >
          <View
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
            {/* Left: back arrow + icon + title */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Pressable onPress={() => setShowEditModal(false)} style={{ padding: 4, marginRight: 10 }}>
                <ArrowLeft size={24} color={primaryColor} />
              </Pressable>
              <CalendarClock size={18} color={primaryColor} style={{ marginRight: 8 }} />
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
                {t('editAppointment', language)}
              </Text>
            </View>
            {/* Right: X to dismiss */}
            <Pressable onPress={() => setShowEditModal(false)} style={{ padding: 4 }}>
              <X size={24} color={primaryColor} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {editingAppointment && (
              <>
                {/* Client Info (read-only) */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: 12,
                      fontWeight: '500',
                      marginBottom: 8,
                    }}
                  >
                    {t('clientLabel', language)}
                  </Text>
                  {(() => {
                    // First try to find client in the already-loaded clients list (RLS-approved)
                    // Fall back to editingAppointmentClient from useClient hook
                    const client = getClient(editingAppointment.clientId) || editingAppointmentClient;
                    const getInitials = (name: string) => {
                      const parts = name.trim().split(/\s+/);
                      if (parts.length >= 2) {
                        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
                      }
                      return name.charAt(0).toUpperCase();
                    };
                    return client ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: `${primaryColor}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          <Text style={{ color: primaryColor, fontWeight: '600' }}>
                            {getInitials(client.name)}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                            {client.name}
                          </Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                            {client.email || ''}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textTertiary, fontStyle: 'italic' }}>{t('clientRemoved', language)}</Text>
                    );
                  })()}
                </View>

                {/* Repeat / Recurring — tappable toggle + options when ON */}
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  {/* If already part of a series: show read-only badge */}
                  {editingAppointment?.seriesId ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <Repeat size={18} color={primaryColor} />
                        </View>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('repeatAppointment', language)}</Text>
                          <Text style={{ color: primaryColor, fontSize: 12, marginTop: 2 }}>
                            {t('recurringAppointmentBadge', language)}{editingAppointment.seriesOccurrenceIndex != null ? `  ·  ${t('occurrenceLabel', language)} #${editingAppointment.seriesOccurrenceIndex}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: primaryColor, justifyContent: 'center', paddingHorizontal: 2 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2, alignSelf: 'flex-end' }} />
                      </View>
                    </View>
                  ) : (
                    /* Not in a series yet — interactive toggle to create one */
                    <>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEditIsRecurring(!editIsRecurring);
                          setEditSeriesPreviewData(null);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: editIsRecurring ? `${primaryColor}20` : (isDark ? colors.backgroundTertiary : '#F1F5F9'), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Repeat size={18} color={editIsRecurring ? primaryColor : colors.textTertiary} />
                          </View>
                          <View>
                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('repeatAppointment', language)}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{t('repeatDescription', language)}</Text>
                          </View>
                        </View>
                        <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: editIsRecurring ? primaryColor : (isDark ? '#374151' : '#D1D5DB'), justifyContent: 'center', paddingHorizontal: 2 }}>
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2, alignSelf: editIsRecurring ? 'flex-end' : 'flex-start' }} />
                        </View>
                      </Pressable>

                      {editIsRecurring && (
                        <View style={{ marginTop: 16 }}>
                          {/* Frequency chips */}
                          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>{t('frequency', language)}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                            {([
                              { value: 'weekly' as RecurrenceFrequency, label: t('weekly', language) },
                              { value: 'biweekly' as RecurrenceFrequency, label: t('everyTwoWeeks', language) },
                              { value: 'monthly' as RecurrenceFrequency, label: t('monthly', language) },
                              { value: 'custom' as RecurrenceFrequency, label: t('customFrequency', language) },
                            ] as const).map((option) => {
                              const isSelected = editRecurrenceFrequency === option.value;
                              return (
                                <Pressable
                                  key={option.value}
                                  onPress={() => { setEditRecurrenceFrequency(option.value); setEditSeriesPreviewData(null); }}
                                  style={{ marginRight: 8, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: isSelected ? primaryColor : colors.backgroundTertiary, borderWidth: 1, borderColor: isSelected ? primaryColor : colors.border }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: '500', color: isSelected ? '#fff' : colors.text }}>{option.label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          {/* Custom interval */}
                          {editRecurrenceFrequency === 'custom' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                              <Text style={{ color: colors.textSecondary, fontSize: 14, marginRight: 8 }}>{t('every', language)}</Text>
                              <TextInput
                                value={editCustomIntervalWeeks}
                                onChangeText={(v) => { setEditCustomIntervalWeeks(v.replace(/[^0-9]/g, '')); setEditSeriesPreviewData(null); }}
                                keyboardType="number-pad"
                                maxLength={2}
                                style={{ backgroundColor: colors.backgroundTertiary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14, width: 50, textAlign: 'center' }}
                              />
                              <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 8 }}>{t('weeks', language)}</Text>
                            </View>
                          )}

                          {/* End condition */}
                          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>{t('endCondition', language)}</Text>
                          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                            <Pressable
                              onPress={() => { setEditRecurrenceEndType('occurrence_count'); setEditSeriesPreviewData(null); }}
                              style={{ flex: 1, marginRight: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: editRecurrenceEndType === 'occurrence_count' ? `${primaryColor}15` : colors.backgroundTertiary, borderWidth: 1, borderColor: editRecurrenceEndType === 'occurrence_count' ? primaryColor : colors.border }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '500', color: editRecurrenceEndType === 'occurrence_count' ? primaryColor : colors.text, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('afterOccurrences', language)}</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => { setEditRecurrenceEndType('until_date'); setEditSeriesPreviewData(null); }}
                              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: editRecurrenceEndType === 'until_date' ? `${primaryColor}15` : colors.backgroundTertiary, borderWidth: 1, borderColor: editRecurrenceEndType === 'until_date' ? primaryColor : colors.border }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '500', color: editRecurrenceEndType === 'until_date' ? primaryColor : colors.text, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('onDate', language)}</Text>
                            </Pressable>
                          </View>

                          {/* Count input */}
                          {editRecurrenceEndType === 'occurrence_count' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                              <Text style={{ color: colors.textSecondary, fontSize: 14, marginRight: 8 }}>{t('repeatTimes', language)}</Text>
                              <TextInput
                                value={editRecurrenceCount}
                                onChangeText={(v) => { setEditRecurrenceCount(v.replace(/[^0-9]/g, '')); setEditSeriesPreviewData(null); }}
                                keyboardType="number-pad"
                                maxLength={2}
                                style={{ backgroundColor: colors.backgroundTertiary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14, width: 50, textAlign: 'center' }}
                              />
                              <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 8 }}>{t('times', language)}</Text>
                            </View>
                          )}

                          {/* End date picker */}
                          {editRecurrenceEndType === 'until_date' && (
                            <Pressable
                              onPress={() => {
                                const endDate = new Date(editDate);
                                endDate.setMonth(endDate.getMonth() + 3);
                                setEditRecurrenceEndDate(endDate);
                                setEditSeriesPreviewData(null);
                              }}
                              style={{ backgroundColor: colors.backgroundTertiary, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                            >
                              <Calendar size={18} color={colors.textSecondary} />
                              <Text style={{ color: colors.text, fontSize: 14, marginLeft: 10 }}>
                                {editRecurrenceEndDate ? formatWithLocale(editRecurrenceEndDate, 'MMM d, yyyy') : t('selectEndDate', language)}
                              </Text>
                            </Pressable>
                          )}

                          {/* Preview button */}
                          <Pressable
                            onPress={async () => {
                              if (!editingAppointment) return;
                              const input: CreateSeriesInput = {
                                business_id: editingAppointment.userId,
                                store_id: editStoreId || editingAppointment.storeId,
                                staff_id: editStaffId || editingAppointment.staffId || null,
                                client_id: editingAppointment.clientId,
                                service_ids: editSelectedServices.length > 0 ? editSelectedServices : (editingAppointment.serviceTags ?? []),
                                frequency_type: editRecurrenceFrequency,
                                interval_value: editRecurrenceFrequency === 'custom' ? parseInt(editCustomIntervalWeeks) || 1 : 1,
                                start_date: editDate,
                                end_type: editRecurrenceEndType,
                                end_date: editRecurrenceEndType === 'until_date' ? editRecurrenceEndDate : null,
                                occurrence_count: editRecurrenceEndType === 'occurrence_count' ? parseInt(editRecurrenceCount) || 4 : null,
                                start_time: editStartTime,
                                duration_minutes: editDuration,
                              };
                              try {
                                const preview = await seriesPreviewMutation.mutateAsync({ input });
                                setEditSeriesPreviewData(preview);
                              } catch (e) {
                                console.log('[AppointmentsScreen] Series preview failed:', e);
                              }
                            }}
                            disabled={seriesPreviewMutation.isPending}
                            style={{ backgroundColor: `${primaryColor}15`, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {seriesPreviewMutation.isPending ? (
                              <ActivityIndicator size="small" color={primaryColor} />
                            ) : (
                              <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '600' }}>{t('previewSeries', language)}</Text>
                            )}
                          </Pressable>

                          {/* Preview result */}
                          {editSeriesPreviewData && (
                            <View style={{ marginTop: 12, padding: 12, backgroundColor: `${primaryColor}08`, borderRadius: 12 }}>
                              <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
                                {editSeriesPreviewData.totalCount} {t('appointmentsInSeries', language)}
                                {editSeriesPreviewData.conflictCount > 0 ? `  ·  ${editSeriesPreviewData.conflictCount} ${t('conflictsFound', language)}` : ''}
                              </Text>
                              {editSeriesPreviewData.occurrences.slice(0, 3).map((occ, i) => (
                                <Text key={i} style={{ color: colors.textSecondary, fontSize: 12 }}>
                                  {formatWithLocale(occ.date, 'EEE, MMM d, yyyy')}
                                </Text>
                              ))}
                              {editSeriesPreviewData.totalCount > 3 && (
                                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>+{editSeriesPreviewData.totalCount - 3} more</Text>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* Date Picker */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <WheelDatePicker
                    label={t('dateLabel', language)}
                    value={editDate}
                    onChange={setEditDate}
                    isOpen={showEditDatePicker}
                    onToggle={() => setShowEditDatePicker(!showEditDatePicker)}
                  />
                </View>

                {/* Time */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: 12,
                      fontWeight: '500',
                      marginBottom: 8,
                    }}
                  >
                    {t('timeLabel', language)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>
                        {t('startLabel', language)}
                      </Text>
                      <TextInput
                        value={editStartTime}
                        onChangeText={handleEditStartTimeChange}
                        placeholder={t('timePlaceholder', language)}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        maxLength={5}
                        style={{
                          backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                          borderRadius: 12,
                          padding: 14,
                          color: colors.text,
                          fontSize: 16,
                        }}
                      />
                    </View>
                    <Text style={{ color: colors.textTertiary, marginHorizontal: 12 }}>{t('toLabel', language)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>
                        {t('endLabel', language)}
                      </Text>
                      <TextInput
                        value={editEndTime}
                        onChangeText={handleEditEndTimeChange}
                        placeholder={t('timePlaceholder', language)}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        maxLength={5}
                        style={{
                          backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                          borderRadius: 12,
                          padding: 14,
                          color: colors.text,
                          fontSize: 16,
                        }}
                      />
                    </View>
                  </View>
                </View>

                {/* Staff Selection */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Users size={16} color={colors.textTertiary} />
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontSize: 12,
                        fontWeight: '500',
                        marginLeft: 6,
                      }}
                    >
                      {t('staffMemberLabel', language)}
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -4, flexGrow: 0 }}
                  >
                    {/* Unassigned Option removed per design spec */}
                    {editStaffMembers.map((staff) => (
                      <Pressable
                        key={staff.id}
                        onPress={() => {
                          setEditStaffId(staff.id);
                          setEditConflictError(null);
                        }}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 20,
                          backgroundColor:
                            editStaffId === staff.id
                              ? primaryColor
                              : isDark
                              ? colors.backgroundTertiary
                              : '#F1F5F9',
                          marginHorizontal: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor:
                              editStaffId === staff.id ? `${primaryColor}30` : `${primaryColor}20`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              color: editStaffId === staff.id ? '#fff' : primaryColor,
                              fontWeight: '600',
                              fontSize: 10,
                            }}
                          >
                            {staff.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: editStaffId === staff.id ? '#fff' : colors.text,
                            fontWeight: '500',
                            fontSize: 14,
                            marginLeft: 8,
                          }}
                        >
                          {staff.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Conflict Error */}
                {editConflictError && (
                  <View
                    style={{
                      backgroundColor: '#FEE2E2',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <AlertCircle size={20} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontSize: 14, marginLeft: 10, flex: 1 }}>
                      {editConflictError}
                    </Text>
                  </View>
                )}

                {/* Services */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Briefcase size={16} color={colors.textTertiary} />
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontSize: 12,
                        fontWeight: '500',
                        marginLeft: 6,
                      }}
                    >
                      {t('services', language).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {serviceTags.map((service) => {
                      const isSelected = editSelectedServices.includes(service.id);
                      return (
                        <Pressable
                          key={service.id}
                          onPress={() => toggleEditService(service.id)}
                          style={{
                            marginRight: 8,
                            marginBottom: 8,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isSelected ? primaryColor : (isDark ? colors.backgroundTertiary : `${primaryColor}10`),
                            borderWidth: 1,
                            borderColor: isSelected ? primaryColor : colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: '500',
                              fontSize: 14,
                              color: isSelected ? '#FFFFFF' : primaryColor,
                            }}
                          >
                            {service.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {serviceTags.length === 0 && (
                      <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>
                        {t('noServicesYet', language)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Duration Selection */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Clock size={16} color={colors.textTertiary} />
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontSize: 12,
                        fontWeight: '500',
                        marginLeft: 6,
                      }}
                    >
                      {t('durationLabel', language)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                    {[30, 45, 60, 90, 120].map((mins) => (
                      <Pressable
                        key={mins}
                        onPress={() => handleEditDurationChange(mins)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor:
                            editDuration === mins
                              ? primaryColor
                              : isDark
                              ? colors.backgroundTertiary
                              : '#F1F5F9',
                          margin: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: editDuration === mins ? '#fff' : colors.text,
                            fontWeight: '500',
                            fontSize: 14,
                          }}
                        >
                          {mins < 60 ? `${mins} ${t('minLabel', language)}` : mins === 60 ? `1 ${t('hrLabel', language)}` : `${mins / 60} ${t('hrLabel', language)}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Promotion (optional) */}
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 10 }}>{t('selectPromoOptional', language)}</Text>
                  <Pressable
                    onPress={() => setShowEditPromotionPicker(!showEditPromotionPicker)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <Text style={{ color: editPromotionId ? colors.text : colors.textTertiary, fontSize: 15, flex: 1 }} numberOfLines={1}>
                      {editPromotionId ? (marketingPromotions.find((p) => p.id === editPromotionId)?.name ?? t('selectPromotion', language)) : t('noPromotionSelected', language)}
                    </Text>
                    <ChevronDown size={16} color={colors.textTertiary} />
                  </Pressable>
                  {showEditPromotionPicker && (
                    <View style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                      <Pressable
                        onPress={() => { setEditPromotionId(null); setShowEditPromotionPicker(false); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: !editPromotionId ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={{ color: !editPromotionId ? primaryColor : colors.textSecondary, fontSize: 14, fontWeight: !editPromotionId ? '600' : '400' }}>{t('noPromotionSelected', language)}</Text>
                      </Pressable>
                      {marketingPromotions.filter((p) => p.isActive).map((promo) => (
                        <Pressable
                          key={promo.id}
                          onPress={() => { setEditPromotionId(promo.id); setShowEditPromotionPicker(false); }}
                          style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: editPromotionId === promo.id ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border }}
                        >
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primaryColor, marginRight: 10 }} />
                          <Text style={{ color: editPromotionId === promo.id ? primaryColor : colors.text, fontSize: 14, fontWeight: editPromotionId === promo.id ? '600' : '400', flex: 1 }}>{promo.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Gift Card (optional) */}
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 10 }}>
                    {t('giftCards', language)} ({t('optional', language)})
                  </Text>
                  <Pressable
                    onPress={() => editClientActiveGiftCards.length > 0 && setShowEditGiftCardPicker(!showEditGiftCardPicker)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: editGiftCardId ? 1.5 : 0, borderColor: editGiftCardId ? primaryColor : 'transparent' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Gift size={16} color={editGiftCardId ? primaryColor : colors.textTertiary} />
                      <Text style={{ color: editGiftCardId ? colors.text : colors.textTertiary, fontSize: 15, flex: 1, marginLeft: 10 }} numberOfLines={1}>
                        {editGiftCardId
                          ? (() => {
                              const gc = editClientActiveGiftCards.find((g: GiftCard) => g.id === editGiftCardId);
                              return gc ? `${gc.code}${gc.currentBalance != null ? ` · ${gc.currentBalance}` : ''}` : t('redeemGiftCard', language);
                            })()
                          : editClientActiveGiftCards.length === 0
                            ? t('noGiftCardAvailable', language)
                            : t('noGiftCardSelected', language)}
                      </Text>
                    </View>
                    {editClientActiveGiftCards.length > 0 && <ChevronDown size={16} color={colors.textTertiary} />}
                  </Pressable>
                  {showEditGiftCardPicker && editClientActiveGiftCards.length > 0 && (
                    <View style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                      {/* "No gift card" row */}
                      <Pressable
                        onPress={() => { setEditGiftCardId(null); setShowEditGiftCardPicker(false); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: !editGiftCardId ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <Text style={{ color: !editGiftCardId ? primaryColor : colors.textSecondary, fontSize: 14, fontWeight: !editGiftCardId ? '600' : '400' }}>
                          {t('noGiftCardOption', language)}
                        </Text>
                        {!editGiftCardId && <Check size={16} color={primaryColor} />}
                      </Pressable>
                      {/* Gift card rows */}
                      {editClientActiveGiftCards.map((gc: GiftCard) => {
                        const isSelected = editGiftCardId === gc.id;
                        const isValue = gc.type === 'value';
                        // Format balance with currency symbol
                        const formattedBalance = gc.currentBalance != null
                          ? `${currencySymbol}${gc.currentBalance.toFixed(2)}`
                          : null;
                        // Format services list for service-type cards
                        let servicesLine: string | null = null;
                        if (!isValue && gc.services && gc.services.length > 0) {
                          const MAX_SHOW = 2;
                          const shown = gc.services.slice(0, MAX_SHOW);
                          const extra = gc.services.length - MAX_SHOW;
                          const parts = shown.map((s) => {
                            const remaining = s.quantity - s.usedQuantity;
                            return `${s.serviceName} (${remaining}/${s.quantity})`;
                          });
                          servicesLine = parts.join(' • ') + (extra > 0 ? ` • +${extra} ${t('giftCardMoreServices', language)}` : '');
                        }
                        return (
                          <Pressable
                            key={gc.id}
                            onPress={() => { setEditGiftCardId(gc.id); setShowEditGiftCardPicker(false); }}
                            style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: isSelected ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border }}
                          >
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={{ color: isSelected ? primaryColor : colors.text, fontSize: 14, fontWeight: isSelected ? '600' : '400' }}>
                                {gc.code}
                              </Text>
                              {isValue && formattedBalance != null && (
                                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                                  {t('remainingBalance', language)}: {formattedBalance}
                                </Text>
                              )}
                              {!isValue && servicesLine && (
                                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                                  {t('giftCardIncludedServices', language)}: {servicesLine}
                                </Text>
                              )}
                            </View>
                            {isSelected && <Check size={16} color={primaryColor} />}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Amount */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: 12,
                      fontWeight: '500',
                      marginBottom: 8,
                    }}
                  >
                    {t('appointmentAmount', language)}
                  </Text>
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
                      value={editAmount}
                      onChangeText={setEditAmount}
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

                {/* Notes */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: 12,
                      fontWeight: '500',
                      marginBottom: 8,
                    }}
                  >
                    {t('notesLabel', language)}
                  </Text>
                  <TextInput
                    value={editNotes}
                    onChangeText={setEditNotes}
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

                {/* Save Button */}
                <Pressable
                  onPress={handleSaveEdit}
                  style={{
                    backgroundColor: primaryColor,
                    borderRadius: 12,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 40,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                    {t('save', language)}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Appointment Selector Modal */}
      <EditAppointmentSelectorModal
        visible={showEditAppointmentSelector}
        activeAppointments={activeAppointments}
        serviceTags={serviceTags}
        getClient={getClient}
        getStaffMember={getStaffMember}
        formatWithLocale={formatWithLocale}
        formatTime={formatTime}
        onSelect={(appointment) => {
          setShowEditAppointmentSelector(false);
          openEditModal(appointment);
        }}
        onClose={() => setShowEditAppointmentSelector(false)}
      />


      {/* Restore Cancelled Appointments Modal */}
      <RestoreCancelledModal
        visible={showRestoreCancelledModal}
        cancelledAppointments={cancelledAppointments}
        serviceTags={serviceTags}
        getClient={getClient}
        getStaffMember={getStaffMember}
        formatWithLocale={formatWithLocale}
        formatTime={formatTime}
        onRestore={(id) => handleRestoreAppointment(id)}
        onClose={() => setShowRestoreCancelledModal(false)}
      />


      {/* Book Appointment Modal */}
      <BookAppointmentModal
        visible={showBookAppointment}
        onClose={() => setShowBookAppointment(false)}
        selectedStoreId={selectedStoreFilter}
      />

      {/* Local Success Toast */}
      <LocalSuccessToast
        visible={showLocalSuccessToast}
        message={localToastMessage}
        onHide={() => setShowLocalSuccessToast(false)}
      />
    </Modal>
  );
}
