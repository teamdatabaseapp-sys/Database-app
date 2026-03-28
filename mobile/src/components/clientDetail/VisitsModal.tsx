import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  X,
  XCircle,
  Clock,
  Store as StoreIcon,
  User,
  Users,
  Briefcase,
  Gift,
  ChevronDown,
  Check,
  Calendar,
  Star,
  CalendarDays,
  Hash,
  Building2,
  Repeat,
  ArrowLeft,
  Tag,
  CalendarClock,
  AlertCircle,
} from 'lucide-react-native';
import { format, isToday } from 'date-fns';
import type { Locale } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language, Appointment, StaffMember, MarketingPromotion, Store } from '@/lib/types';
import type { GiftCard } from '@/lib/types';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { useClientGiftCards, useGiftCardRedemptionByAppointment } from '@/hooks/useGiftCards';
import { WheelDatePicker } from '@/components/WheelDatePicker';
import {
  convertToLocalAppointment,
  useUpdateAppointment,
  useCancelAppointment,
  useCheckAppointmentConflict,
  useCreateAppointmentSeries,
  useCreateAppointmentsFromSeries,
  useSeriesPreview,
} from '@/hooks/useAppointments';
import { useSyncAppointmentServices, useServices } from '@/hooks/useServices';
import { useStaffServiceSkills } from '@/hooks/useStaffServices';
import type { SupabaseAppointment } from '@/services/appointmentsService';
import { notifyAppointmentEmail } from '@/services/appointmentsService';
import type {
  RecurrenceFrequency,
  CreateSeriesInput,
  SeriesPreview,
} from '@/services/appointmentsService';
import type { ClientLoyalty } from '@/services/loyaltyService';
import { AppointmentListView } from '../appointments/AppointmentListView';
import type { LocalAppointment, LocalStaff } from '../appointments/appointmentsTypes';
import { calculateEndTime, formatTimeInput } from '../appointments/appointmentsUtils';
import { useStore } from '@/lib/store';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

export interface VisitsModalProps {
  visible: boolean;
  // The client whose appointments are shown — used for client info block in view panel
  client?: { name: string; email?: string | null } | null;
  // List view data
  clientUpcomingAppointments: SupabaseAppointment[];
  serviceTags: { id: string; name: string; color: string }[];
  marketingPromotions: { id: string; name: string; color: string | undefined; isActive: boolean }[];
  stores: { id: string; name: string }[];
  staffMembers: { id: string; name: string; color: string }[];
  filteredStaffForAppointment: { id: string; name: string; color: string }[];
  clientLoyaltyData: ClientLoyalty | null | undefined;
  language: Language;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    backgroundTertiary: string;
    inputBackground: string;
    inputText: string;
    inputPlaceholder: string;
    inputBorder: string;
    [key: string]: string;
  };
  isDark: boolean;
  primaryColor: string;
  currency: string;
  dateLocale?: Locale;
  // Edit appointment state values
  editingAppointment: LocalAppointment | null;
  editAppointmentDate: Date;
  editAppointmentTime: string;
  editAppointmentEndTime: string;
  editAppointmentNotes: string;
  editAppointmentAmount: string;
  editAppointmentStoreId: string | null;
  editAppointmentStaffId: string | null;
  editAppointmentServices: string[];
  editAppointmentPromotionId: string | null;
  editAppointmentCurrency: string;
  showEditAppointmentDatePicker: boolean;
  showEditAppointmentStorePicker: boolean;
  showEditAppointmentStaffPicker: boolean;
  showEditAppointmentPromotionPicker: boolean;
  showEditAppointmentCurrencyPicker: boolean;
  // Edit appointment setters
  onEditAppointmentDateChange: (date: Date) => void;
  onEditAppointmentTimeChange: (time: string) => void;
  onEditAppointmentEndTimeChange: (time: string) => void;
  onEditAppointmentNotesChange: (notes: string) => void;
  onEditAppointmentAmountChange: (amount: string) => void;
  onEditAppointmentStoreIdChange: (id: string | null) => void;
  onEditAppointmentStaffIdChange: (id: string | null) => void;
  onToggleEditAppointmentService: (tagId: string) => void;
  onEditAppointmentPromotionIdChange: (id: string | null) => void;
  onEditAppointmentCurrencyChange: (currency: string) => void;
  onShowEditAppointmentDatePickerChange: (show: boolean) => void;
  onShowEditAppointmentStorePickerChange: (show: boolean) => void;
  onShowEditAppointmentStaffPickerChange: (show: boolean) => void;
  onShowEditAppointmentPromotionPickerChange: (show: boolean) => void;
  onShowEditAppointmentCurrencyPickerChange: (show: boolean) => void;
  onSetEditingAppointment: (appointment: LocalAppointment | null) => void;
  // Handlers
  onClose: () => void;
  onSaveAppointmentEdit: () => void;
  onOpenEditAppointment: (appointment: LocalAppointment) => void;
}

export function VisitsModal({
  visible,
  client,
  clientUpcomingAppointments,
  serviceTags,
  marketingPromotions,
  stores,
  staffMembers,
  filteredStaffForAppointment,
  clientLoyaltyData,
  language,
  colors,
  isDark,
  primaryColor,
  currency,
  dateLocale,
  editingAppointment,
  editAppointmentDate,
  editAppointmentTime,
  editAppointmentEndTime,
  editAppointmentNotes,
  editAppointmentAmount,
  editAppointmentStoreId,
  editAppointmentStaffId,
  editAppointmentServices,
  editAppointmentPromotionId,
  editAppointmentCurrency,
  showEditAppointmentDatePicker,
  showEditAppointmentStorePicker,
  showEditAppointmentStaffPicker,
  showEditAppointmentPromotionPicker,
  showEditAppointmentCurrencyPicker,
  onEditAppointmentDateChange,
  onEditAppointmentTimeChange,
  onEditAppointmentEndTimeChange,
  onEditAppointmentNotesChange,
  onEditAppointmentAmountChange,
  onEditAppointmentStoreIdChange,
  onEditAppointmentStaffIdChange,
  onToggleEditAppointmentService,
  onEditAppointmentPromotionIdChange,
  onEditAppointmentCurrencyChange,
  onShowEditAppointmentDatePickerChange,
  onShowEditAppointmentStorePickerChange,
  onShowEditAppointmentStaffPickerChange,
  onShowEditAppointmentPromotionPickerChange,
  onShowEditAppointmentCurrencyPickerChange,
  onSetEditingAppointment,
  onClose,
  onSaveAppointmentEdit,
  onOpenEditAppointment,
}: VisitsModalProps) {
  const insets = useSafeAreaInsets();

  // ─── Source-of-truth hooks for service pricing and staff filtering ────────
  // React Query deduplicates these — no extra network requests are made.
  const { data: allSupabaseServices = [] } = useServices();
  const { data: staffServiceSkills = [] } = useStaffServiceSkills(editAppointmentStaffId);

  // Services filtered to only what the selected staff member can perform.
  // Falls back to all services when no staff is selected or staff has no configured skills.
  const filteredEditServiceTags = useMemo(() => {
    if (!editAppointmentStaffId || staffServiceSkills.length === 0) return serviceTags;
    const validIds = new Set(staffServiceSkills.map((sk) => sk.service_id));
    return serviceTags.filter((tag) => validIds.has(tag.id));
  }, [editAppointmentStaffId, staffServiceSkills, serviceTags]);

  // Helper: compute total from service price_cents for selected service IDs.
  const calcAmountFromServices = (serviceIds: string[]): string => {
    if (serviceIds.length === 0) return '';
    const total = serviceIds.reduce((sum: number, id: string) => {
      const svc = allSupabaseServices.find((s) => s.id === id);
      return sum + ((svc as { price_cents?: number })?.price_cents ?? 0) / 100;
    }, 0);
    return total > 0 ? total.toFixed(2) : '';
  };

  // Ref so the staff-change effect always sees the latest selected services
  // without adding them to the dependency array (avoids infinite loops).
  const editAppointmentServicesRef = useRef(editAppointmentServices);
  editAppointmentServicesRef.current = editAppointmentServices;

  // When the selected staff changes AND skills have loaded, remove services
  // that the new staff member cannot perform, then recalculate the amount.
  useEffect(() => {
    if (!editAppointmentStaffId || staffServiceSkills.length === 0) return;
    const validIds = new Set(staffServiceSkills.map((sk) => sk.service_id));
    const current = editAppointmentServicesRef.current;
    const valid = current.filter((id) => validIds.has(id));
    if (valid.length !== current.length) {
      // Remove each invalid service via the parent toggle callback
      current.filter((id) => !validIds.has(id)).forEach((id) => onToggleEditAppointmentService(id));
      const newAmount = calcAmountFromServices(valid);
      onEditAppointmentAmountChange(newAmount);
    }
  }, [editAppointmentStaffId, staffServiceSkills]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrapper: toggle service AND immediately update the amount field.
  const handleToggleEditServiceWithAmount = (tagId: string) => {
    const newServices = editAppointmentServices.includes(tagId)
      ? editAppointmentServices.filter((id) => id !== tagId)
      : [...editAppointmentServices, tagId];
    onToggleEditAppointmentService(tagId);
    const newAmount = calcAmountFromServices(newServices);
    if (newAmount) onEditAppointmentAmountChange(newAmount);
  };

  // Local state for the read-only view panel (matching AppointmentsScreen view modal)
  const [viewingLocalAppointment, setViewingLocalAppointment] = useState<LocalAppointment | null>(null);

  // Cancel appointment state (matching AppointmentsScreen)
  const [showViewCancelConfirm, setShowViewCancelConfirm] = useState(false);
  const [cancellingFromView, setCancellingFromView] = useState(false);
  const cancelAppointmentMutation = useCancelAppointment();

  const handleViewCancelAppointment = async () => {
    if (!viewingLocalAppointment) return;
    setCancellingFromView(true);
    try {
      await cancelAppointmentMutation.mutateAsync(viewingLocalAppointment.id);
      notifyAppointmentEmail(viewingLocalAppointment.id, 'cancelled', language);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowViewCancelConfirm(false);
      setTimeout(() => {
        setViewingLocalAppointment(null);
      }, 300);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowViewCancelConfirm(false);
    } finally {
      setCancellingFromView(false);
    }
  };

  // Currency symbol (same as AppointmentsScreen)
  const currencySymbol = getCurrencySymbol(currency);

  // Live gift card data for the viewed appointment (same hooks as AppointmentsScreen)
  const { data: viewClientGiftCardsRaw, refetch: refetchViewClientGiftCards } = useClientGiftCards(viewingLocalAppointment?.clientId ?? undefined);
  const viewClientGiftCards: GiftCard[] = viewClientGiftCardsRaw ?? [];

  // Redemption transaction for viewed appointment (source of truth for deducted amount)
  const { data: viewAppointmentRedemption, isLoading: redemptionLoading, refetch: refetchViewAppointmentRedemption } = useGiftCardRedemptionByAppointment(
    viewingLocalAppointment?.giftCardId ?? null,
    viewingLocalAppointment?.id ?? null
  );

  // Refetch gift card + redemption data whenever the viewed appointment changes
  const prevViewingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = viewingLocalAppointment?.id ?? null;
    if (id && id !== prevViewingIdRef.current) {
      prevViewingIdRef.current = id;
      refetchViewClientGiftCards();
      refetchViewAppointmentRedemption();
    }
    if (!id) prevViewingIdRef.current = null;
  }, [viewingLocalAppointment?.id]);

  // Convert SupabaseAppointment[] to LocalAppointment[] for AppointmentListView
  const localAppointments: LocalAppointment[] = useMemo(
    () => clientUpcomingAppointments.map(convertToLocalAppointment),
    [clientUpcomingAppointments]
  );

  // Helper: format "HH:mm" using locale's preferred clock format
  const formatTime = (timeStr: string): string => {
    if (!timeStr || timeStr.length < 4) return timeStr;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    const d = new Date(2000, 0, 1, hours, minutes, 0);
    return format(d, 'p', { locale: dateLocale });
  };

  // Helper: format date with locale + capitalize
  const formatWithLocale = (date: Date, formatStr: string): string => {
    const formatted = format(date, formatStr, { locale: dateLocale });
    return formatted.replace(/(^|\s)(\S)/g, (_: string, space: string, letter: string) => space + letter.toUpperCase());
  };

  // Helper: client lookup — customerName is already denormalized in LocalAppointment
  const getClient = (_clientId: string) => undefined;

  // ── Edit-panel local state (mirrors AppointmentsScreen's edit modal state) ──────────────────
  const [editDuration, setEditDuration] = useState<number>(60);
  const [editGiftCardId, setEditGiftCardId] = useState<string | null>(null);
  const [showEditGiftCardPicker, setShowEditGiftCardPicker] = useState(false);
  const [editConflictError, setEditConflictError] = useState<string | null>(null);
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrenceFrequency, setEditRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [editRecurrenceEndType, setEditRecurrenceEndType] = useState<'occurrence_count' | 'until_date'>('occurrence_count');
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState<Date | null>(null);
  const [editRecurrenceCount, setEditRecurrenceCount] = useState<string>('4');
  const [editCustomIntervalWeeks, setEditCustomIntervalWeeks] = useState<string>('3');
  const [editSeriesPreviewData, setEditSeriesPreviewData] = useState<SeriesPreview | null>(null);

  // ── Edit-panel mutations (same hooks as AppointmentsScreen) ──────────────────────────────────
  const updateAppointmentMutation = useUpdateAppointment();
  const syncServicesMutation = useSyncAppointmentServices();
  const checkConflictMutation = useCheckAppointmentConflict();
  const createSeriesMutation = useCreateAppointmentSeries();
  const createAppointmentsFromSeriesMutation = useCreateAppointmentsFromSeries();
  const seriesPreviewMutation = useSeriesPreview();

  // Gift cards for the appointment being edited (same as AppointmentsScreen's editClientActiveGiftCards)
  const { data: editClientGiftCardsRaw } = useClientGiftCards(editingAppointment?.clientId ?? undefined);
  const editClientActiveGiftCards: GiftCard[] = (editClientGiftCardsRaw ?? []).filter((gc: GiftCard) => gc.status === 'active');

  // Zustand updater + save confirmation toast (same as AppointmentsScreen)
  const updateAppointment = useStore((s) => s.updateAppointment);
  const { showSaveConfirmation } = useSaveConfirmation();

  // Initialize/reset local edit state whenever a new appointment is opened for editing
  useEffect(() => {
    if (!editingAppointment) return;
    setEditDuration(editingAppointment.duration || 60);
    setEditGiftCardId(editingAppointment.giftCardId || null);
    setShowEditGiftCardPicker(false);
    setEditConflictError(null);
    setEditIsRecurring(false);
    setEditRecurrenceFrequency('weekly');
    setEditRecurrenceEndType('occurrence_count');
    setEditRecurrenceEndDate(null);
    setEditRecurrenceCount('4');
    setEditCustomIntervalWeeks('3');
    setEditSeriesPreviewData(null);
  }, [editingAppointment?.id]);

  // Duration chip handler — also updates end time (same as AppointmentsScreen's handleEditDurationChange)
  const handleEditDurationChange = (minutes: number) => {
    setEditDuration(minutes);
    setEditConflictError(null);
    if (editAppointmentTime && editAppointmentTime.length === 5) {
      const newEndTime = calculateEndTime(editAppointmentTime, minutes);
      if (newEndTime) onEditAppointmentEndTimeChange(newEndTime);
    }
  };

  // Full save logic — exact parity with AppointmentsScreen's handleSaveEdit
  const handleSave = async () => {
    if (!editingAppointment) return;

    const storeId = editAppointmentStoreId || editingAppointment.storeId;

    // Conflict check (same as AppointmentsScreen)
    if (storeId) {
      try {
        const [startHour, startMin] = editAppointmentTime.split(':').map(Number);
        const startAt = new Date(editAppointmentDate);
        startAt.setHours(startHour ?? 9, startMin ?? 0, 0, 0);
        const endAt = new Date(startAt.getTime() + editDuration * 60 * 1000);
        const conflicts = await checkConflictMutation.mutateAsync({
          storeId,
          staffId: editAppointmentStaffId || null,
          startAt,
          endAt,
          excludeAppointmentId: editingAppointment.id,
        });
        if (conflicts && conflicts.length > 0) {
          const staffName = editAppointmentStaffId
            ? (staffMembers.find((s) => s.id === editAppointmentStaffId)?.name ?? t('staffMember', language))
            : t('staffMember', language);
          setEditConflictError(t('staffConflictError', language).replace('{staffName}', staffName));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      } catch {
        // Continue without blocking if conflict check fails
      }
    }

    const selectedTagNames = editAppointmentServices
      .map((id) => serviceTags.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const finalTitle = selectedTagNames || editingAppointment.title;

    const [startHour, startMin] = editAppointmentTime.split(':').map(Number);
    const startAt = new Date(editAppointmentDate);
    startAt.setHours(startHour ?? 9, startMin ?? 0, 0, 0);
    const endAt = new Date(startAt.getTime() + editDuration * 60 * 1000);

    try {
      await updateAppointmentMutation.mutateAsync({
        appointmentId: editingAppointment.id,
        updates: {
          title: finalTitle,
          start_at: startAt,
          end_at: endAt,
          notes: editAppointmentNotes || undefined,
          staff_id: editAppointmentStaffId || null,
          duration_minutes: editDuration,
          amount: editAppointmentAmount ? parseFloat(editAppointmentAmount) : undefined,
          total_cents: editAppointmentAmount ? Math.round(parseFloat(editAppointmentAmount) * 100) : undefined,
          promo_id: editAppointmentPromotionId ?? undefined,
          gift_card_id: editGiftCardId ?? undefined,
        },
      });

      if (editAppointmentServices.length > 0) {
        await syncServicesMutation.mutateAsync({
          appointmentId: editingAppointment.id,
          serviceIds: editAppointmentServices,
        });
      }

      // Create recurring series if toggled on and not already in a series
      if (editIsRecurring && !editingAppointment.seriesId) {
        try {
          const seriesInput: CreateSeriesInput = {
            business_id: editingAppointment.userId,
            store_id: storeId,
            staff_id: editAppointmentStaffId || editingAppointment.staffId || null,
            client_id: editingAppointment.clientId,
            service_ids: editAppointmentServices.length > 0 ? editAppointmentServices : (editingAppointment.serviceTags ?? []),
            frequency_type: editRecurrenceFrequency,
            interval_value: editRecurrenceFrequency === 'custom' ? parseInt(editCustomIntervalWeeks) || 1 : 1,
            start_date: editAppointmentDate,
            end_type: editRecurrenceEndType,
            end_date: editRecurrenceEndType === 'until_date' ? editRecurrenceEndDate : null,
            occurrence_count: editRecurrenceEndType === 'occurrence_count' ? parseInt(editRecurrenceCount) || 4 : null,
            start_time: editAppointmentTime,
            duration_minutes: editDuration,
            amount: editAppointmentAmount ? parseFloat(editAppointmentAmount) : (editingAppointment.amount ?? 0),
            currency: editingAppointment.currency ?? 'USD',
            notes: editAppointmentNotes || undefined,
          };
          let occurrences = editSeriesPreviewData?.occurrences;
          if (!occurrences || occurrences.length === 0) {
            const preview = await seriesPreviewMutation.mutateAsync({ input: seriesInput });
            occurrences = preview.occurrences;
          }
          if (occurrences && occurrences.length > 0) {
            const series = await createSeriesMutation.mutateAsync(seriesInput);
            await createAppointmentsFromSeriesMutation.mutateAsync({ series, occurrences, skipConflicts: true });
          }
        } catch {
          // Series creation failure doesn't block the base appointment save
        }
      }

      // Update Zustand for immediate UI
      updateAppointment(editingAppointment.id, {
        date: editAppointmentDate,
        startTime: editAppointmentTime,
        endTime: editAppointmentEndTime || undefined,
        notes: editAppointmentNotes || undefined,
        amount: editAppointmentAmount ? parseFloat(editAppointmentAmount) : undefined,
        storeId: storeId,
        staffId: editAppointmentStaffId || undefined,
        promotionId: editAppointmentPromotionId || undefined,
        title: finalTitle,
      });

      notifyAppointmentEmail(editingAppointment.id, 'updated');
      showSaveConfirmation();
    } catch {
      // DB write failed — Zustand already updated for UI responsiveness
    }

    // Clear editingAppointment to return to list view
    onSetEditingAppointment(null);
  };

  // Start time change handler — auto-formats with colon + auto-updates end time (identical to AppointmentsScreen's handleEditStartTimeChange)
  const handleStartTimeChange = (text: string) => {
    const formattedTime = formatTimeInput(text);
    onEditAppointmentTimeChange(formattedTime);
    if (formattedTime.length === 5) {
      const newEnd = calculateEndTime(formattedTime, editDuration);
      if (newEnd) onEditAppointmentEndTimeChange(newEnd);
    }
  };

  // End time change handler — auto-formats with colon (identical to AppointmentsScreen's handleEditEndTimeChange)
  const handleEndTimeChange = (text: string) => {
    const formattedTime = formatTimeInput(text);
    onEditAppointmentEndTimeChange(formattedTime);
  };

  // Helper: staff lookup from staffMembers prop
  const getStaffMember = (staffId: string | undefined): LocalStaff | undefined => {
    if (!staffId) return undefined;
    const found = staffMembers.find((s) => s.id === staffId);
    if (!found) return undefined;
    return { id: found.id, name: found.name, color: found.color, storeIds: [] };
  };

  // Helper: appointment status (same logic as AppointmentsScreen)
  type ApptStatus = 'ongoing' | 'next' | 'upcoming' | 'past' | null;
  const getAppointmentStatus = (appointment: LocalAppointment, allDayAppointments: LocalAppointment[]): ApptStatus => {
    const appointmentDate = new Date(appointment.date);
    if (new Date(appointmentDate).setHours(23, 59, 59, 999) < new Date().setHours(0, 0, 0, 0)) {
      return 'past';
    }
    if (!isToday(appointmentDate)) return null;
    const now = new Date();
    const [startHour, startMin] = appointment.startTime.split(':').map(Number);
    const start = new Date(appointment.date);
    start.setHours(startHour, startMin, 0, 0);
    let end: Date;
    if (appointment.endTime) {
      const [endHour, endMin] = appointment.endTime.split(':').map(Number);
      end = new Date(appointment.date);
      end.setHours(endHour, endMin, 0, 0);
    } else {
      end = new Date(start.getTime() + (appointment.duration || 60) * 60 * 1000);
    }
    if (now >= start && now <= end) return 'ongoing';
    if (now < start) {
      const todayFuture = allDayAppointments.filter((a) => {
        const [h, m] = a.startTime.split(':').map(Number);
        const s = new Date(a.date);
        s.setHours(h, m, 0, 0);
        return s > now;
      });
      if (todayFuture.length > 0 && todayFuture[0].id === appointment.id) return 'next';
      return 'upcoming';
    }
    return 'past';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Conditional rendering: Edit View or List View */}
        {editingAppointment ? (
          /* Edit Appointment View */
          <View style={{ flex: 1 }}>
            {/* Edit Header — matches AppointmentsScreen exactly: [← back + CalendarClock + title] [X close] */}
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
                <Pressable
                  onPress={() => {
                    onSetEditingAppointment(null);
                    onShowEditAppointmentDatePickerChange(false);
                    onShowEditAppointmentStorePickerChange(false);
                    onShowEditAppointmentStaffPickerChange(false);
                    onShowEditAppointmentPromotionPickerChange(false);
                    onShowEditAppointmentCurrencyPickerChange(false);
                  }}
                  style={{ padding: 4, marginRight: 10 }}
                >
                  <ArrowLeft size={24} color={primaryColor} />
                </Pressable>
                <CalendarClock size={18} color={primaryColor} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{t('editAppointment', language)}</Text>
              </View>
              {/* Right: X to dismiss */}
              <Pressable
                onPress={() => {
                  onSetEditingAppointment(null);
                  onShowEditAppointmentDatePickerChange(false);
                  onShowEditAppointmentStorePickerChange(false);
                  onShowEditAppointmentStaffPickerChange(false);
                  onShowEditAppointmentPromotionPickerChange(false);
                  onShowEditAppointmentCurrencyPickerChange(false);
                }}
                style={{ padding: 4 }}
              >
                <X size={24} color={primaryColor} />
              </Pressable>
            </View>

            {/* Edit Form — identical to AppointmentsScreen edit modal */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Appointment Time (Date Picker) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <WheelDatePicker
                  label={t('appointmentTime', language)}
                  value={editAppointmentDate}
                  onChange={onEditAppointmentDateChange}
                  isOpen={showEditAppointmentDatePicker}
                  onToggle={() => onShowEditAppointmentDatePickerChange(!showEditAppointmentDatePicker)}
                />
              </View>

              {/* 2 & 3. Start Time / End Time — side by side in one card (identical to AppointmentsScreen) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                  {t('timeLabel', language)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>
                      {t('startLabel', language)}
                    </Text>
                    <TextInput
                      value={editAppointmentTime}
                      onChangeText={handleStartTimeChange}
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
                      value={editAppointmentEndTime}
                      onChangeText={handleEndTimeChange}
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

              {/* 4. Select Store */}
              {stores.length > 0 && (
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <StoreIcon size={16} color={colors.textTertiary} />
                    <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginLeft: 6 }}>
                      {t('selectStore', language).toUpperCase()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onShowEditAppointmentStorePickerChange(!showEditAppointmentStorePicker)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <Text style={{ color: editAppointmentStoreId ? colors.text : colors.textTertiary, fontSize: 15, flex: 1 }} numberOfLines={1}>
                      {editAppointmentStoreId ? stores.find((s) => s.id === editAppointmentStoreId)?.name ?? t('selectStore', language) : t('noStoreSelected', language)}
                    </Text>
                    <ChevronDown size={16} color={colors.textTertiary} />
                  </Pressable>
                  {showEditAppointmentStorePicker && (
                    <View style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                      <Pressable
                        onPress={() => { onEditAppointmentStoreIdChange(null); onEditAppointmentStaffIdChange(null); onShowEditAppointmentStorePickerChange(false); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: !editAppointmentStoreId ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={{ color: !editAppointmentStoreId ? primaryColor : colors.textSecondary, fontSize: 14, fontWeight: !editAppointmentStoreId ? '600' : '400' }}>{t('noStoreSelected', language)}</Text>
                      </Pressable>
                      {stores.map((store) => (
                        <Pressable
                          key={store.id}
                          onPress={() => { onEditAppointmentStoreIdChange(store.id); onShowEditAppointmentStorePickerChange(false); }}
                          style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: editAppointmentStoreId === store.id ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border }}
                        >
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primaryColor, marginRight: 10 }} />
                          <Text style={{ color: editAppointmentStoreId === store.id ? primaryColor : colors.text, fontSize: 14, fontWeight: editAppointmentStoreId === store.id ? '600' : '400', flex: 1 }}>{getLocalizedStoreName(store.name as string, language)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* 5. Staff Member — horizontal chips (identical to AppointmentsScreen) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Users size={16} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginLeft: 6 }}>
                    {t('staffMemberLabel', language)}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4, flexGrow: 0 }}>
                  {/* Unassigned option removed per design spec */}
                  {filteredStaffForAppointment.map((staff) => (
                    <Pressable
                      key={staff.id}
                      onPress={() => { onEditAppointmentStaffIdChange(staff.id); setEditConflictError(null); }}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                        backgroundColor: editAppointmentStaffId === staff.id ? primaryColor : isDark ? colors.backgroundTertiary : '#F1F5F9',
                        marginHorizontal: 4, flexDirection: 'row', alignItems: 'center',
                      }}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: editAppointmentStaffId === staff.id ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: editAppointmentStaffId === staff.id ? '#fff' : primaryColor, fontWeight: '600', fontSize: 10 }}>
                          {staff.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: editAppointmentStaffId === staff.id ? '#fff' : colors.text, fontWeight: '500', fontSize: 14, marginLeft: 8 }}>
                        {staff.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Conflict Error */}
              {editConflictError && (
                <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <AlertCircle size={20} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontSize: 14, marginLeft: 10, flex: 1 }}>{editConflictError}</Text>
                </View>
              )}

              {/* 6. Services — with Briefcase icon header (identical to AppointmentsScreen) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Briefcase size={16} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginLeft: 6 }}>
                    {t('services', language).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {filteredEditServiceTags.map((service) => {
                    const isSelected = editAppointmentServices.includes(service.id);
                    return (
                      <Pressable
                        key={service.id}
                        onPress={() => handleToggleEditServiceWithAmount(service.id)}
                        style={{
                          marginRight: 8, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 8,
                          borderRadius: 20, flexDirection: 'row', alignItems: 'center',
                          backgroundColor: isSelected ? primaryColor : isDark ? colors.backgroundTertiary : `${primaryColor}10`,
                          borderWidth: 1, borderColor: isSelected ? primaryColor : colors.border,
                        }}
                      >
                        <Text style={{ fontWeight: '500', fontSize: 14, color: isSelected ? '#FFFFFF' : primaryColor }}>
                          {service.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {filteredEditServiceTags.length === 0 && (
                    <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>
                      {t('noServicesYet', language)}
                    </Text>
                  )}
                </View>
              </View>

              {/* 7. Duration — preset chips with Clock icon (identical to AppointmentsScreen) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Clock size={16} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginLeft: 6 }}>
                    {t('durationLabel', language)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                  {[30, 45, 60, 90, 120].map((mins) => (
                    <Pressable
                      key={mins}
                      onPress={() => handleEditDurationChange(mins)}
                      style={{
                        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                        backgroundColor: editDuration === mins ? primaryColor : isDark ? colors.backgroundTertiary : '#F1F5F9',
                        margin: 4,
                      }}
                    >
                      <Text style={{ color: editDuration === mins ? '#fff' : colors.text, fontWeight: '500', fontSize: 14 }}>
                        {mins < 60 ? `${mins} ${t('minLabel', language)}` : mins === 60 ? `1 ${t('hrLabel', language)}` : `${mins / 60} ${t('hrLabel', language)}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 8. Promotion (identical to AppointmentsScreen) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 10 }}>
                  {t('selectPromoOptional', language)}
                </Text>
                <Pressable
                  onPress={() => onShowEditAppointmentPromotionPickerChange(!showEditAppointmentPromotionPicker)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
                >
                  <Text style={{ color: editAppointmentPromotionId ? colors.text : colors.textTertiary, fontSize: 15, flex: 1 }} numberOfLines={1}>
                    {editAppointmentPromotionId ? (marketingPromotions.find((p) => p.id === editAppointmentPromotionId)?.name ?? t('selectPromotion', language)) : t('noPromotionSelected', language)}
                  </Text>
                  <ChevronDown size={16} color={colors.textTertiary} />
                </Pressable>
                {showEditAppointmentPromotionPicker && (
                  <View style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                    <Pressable
                      onPress={() => { onEditAppointmentPromotionIdChange(null); onShowEditAppointmentPromotionPickerChange(false); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: !editAppointmentPromotionId ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Text style={{ color: !editAppointmentPromotionId ? primaryColor : colors.textSecondary, fontSize: 14, fontWeight: !editAppointmentPromotionId ? '600' : '400' }}>{t('noPromotionSelected', language)}</Text>
                    </Pressable>
                    {marketingPromotions.filter((p) => p.isActive).map((promo) => (
                      <Pressable
                        key={promo.id}
                        onPress={() => { onEditAppointmentPromotionIdChange(promo.id); onShowEditAppointmentPromotionPickerChange(false); }}
                        style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: editAppointmentPromotionId === promo.id ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border }}
                      >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primaryColor, marginRight: 10 }} />
                        <Text style={{ color: editAppointmentPromotionId === promo.id ? primaryColor : colors.text, fontSize: 14, fontWeight: editAppointmentPromotionId === promo.id ? '600' : '400', flex: 1 }}>{promo.name as string}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* 9. Gift Cards (identical to AppointmentsScreen) */}
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
                    <Pressable
                      onPress={() => { setEditGiftCardId(null); setShowEditGiftCardPicker(false); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: !editGiftCardId ? `${primaryColor}12` : colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Text style={{ color: !editGiftCardId ? primaryColor : colors.textSecondary, fontSize: 14, fontWeight: !editGiftCardId ? '600' : '400' }}>
                        {t('noGiftCardOption', language)}
                      </Text>
                      {!editGiftCardId && <Check size={16} color={primaryColor} />}
                    </Pressable>
                    {editClientActiveGiftCards.map((gc: GiftCard) => {
                      const isSelected = editGiftCardId === gc.id;
                      const isValue = gc.type === 'value';
                      const formattedBalance = gc.currentBalance != null ? `${currencySymbol}${gc.currentBalance.toFixed(2)}` : null;
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

              {/* 10. Amount (identical to AppointmentsScreen — currency symbol prefix, no selector dropdown) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                  {t('appointmentAmount', language)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, padding: 14 }}>
                  <Text style={{ fontSize: 18, color: colors.textSecondary, fontWeight: '500' }}>
                    {currencySymbol}
                  </Text>
                  <TextInput
                    value={editAppointmentAmount}
                    onChangeText={onEditAppointmentAmountChange}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, marginLeft: 12, fontSize: 16, color: colors.text }}
                  />
                </View>
              </View>

              {/* 11. Notes (identical to AppointmentsScreen) */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                  {t('notesLabel', language)}
                </Text>
                <TextInput
                  value={editAppointmentNotes}
                  onChangeText={onEditAppointmentNotesChange}
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

              {/* Save Button (identical to AppointmentsScreen — uses full handleSave with conflict check + service sync) */}
              <Pressable
                onPress={handleSave}
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
            </ScrollView>
          </View>
        ) : viewingLocalAppointment ? (
          /* ── View Appointment Panel — exact same design as AppointmentsScreen view modal ── */
          <View style={{ flex: 1 }}>
            {/* Header — matches AppointmentsScreen exactly: [CalendarDays icon+circle | title ..flex 1..] [X close] */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <CalendarDays size={18} color={primaryColor} />
                </View>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{t('viewAppointment', language)}</Text>
              </View>
              <Pressable
                onPress={() => setViewingLocalAppointment(null)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
              {/* 1. Status */}
              {(() => {
                const lc = viewingLocalAppointment.lifecycleStatus ?? 'scheduled';
                const isLogVisit = viewingLocalAppointment.isLogVisit === true;
                const now = Date.now();
                const apptDate = new Date(viewingLocalAppointment.date);
                const [sh, sm] = viewingLocalAppointment.startTime.split(':').map(Number);
                const apptStart = new Date(apptDate); apptStart.setHours(sh, sm, 0, 0);
                let apptEnd: Date;
                if (viewingLocalAppointment.endTime) {
                  const [eh, em] = viewingLocalAppointment.endTime.split(':').map(Number);
                  apptEnd = new Date(apptDate); apptEnd.setHours(eh, em, 0, 0);
                } else {
                  apptEnd = new Date(apptStart.getTime() + (viewingLocalAppointment.duration ?? 60) * 60 * 1000);
                }
                const isOngoing = lc === 'scheduled' && now >= apptStart.getTime() && now < apptEnd.getTime();
                const effectiveLc = isLogVisit && lc === 'scheduled' ? 'log_visit' : isOngoing ? 'ongoing' : lc;
                const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                  scheduled:            { label: t('statusScheduled', language),          color: primaryColor, bg: `${primaryColor}15` },
                  log_visit:            { label: t('visitTitle', language),               color: primaryColor, bg: `${primaryColor}15` },
                  ongoing:              { label: t('visitOngoing', language),             color: primaryColor, bg: `${primaryColor}15` },
                  checked_in:           { label: t('statusCheckedIn', language),          color: primaryColor, bg: `${primaryColor}15` },
                  pending_confirmation: { label: t('statusPendingConfirmation', language),color: primaryColor, bg: `${primaryColor}15` },
                  completed:            { label: t('statusCompleted', language),          color: primaryColor, bg: `${primaryColor}15` },
                  no_show:              { label: t('statusNoShow', language),             color: primaryColor, bg: `${primaryColor}15` },
                  cancelled:            { label: t('outcomeCancelled', language),         color: primaryColor, bg: `${primaryColor}12` },
                };
                const cfg = statusConfig[effectiveLc] ?? statusConfig.scheduled;
                return (
                  <View style={{ backgroundColor: cfg.bg, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: `${cfg.color}30` }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>STATUS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.color }} />
                      <Text style={{ color: cfg.color, fontSize: 16, fontWeight: '700' }}>{cfg.label}</Text>
                    </View>
                    {viewingLocalAppointment.checkedInAt && (
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                        {`${t('checkedInAt', language)}: ${formatWithLocale(viewingLocalAppointment.checkedInAt, 'h:mm a')}`}
                      </Text>
                    )}
                    {viewingLocalAppointment.completedAt && (
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                        {`${t('completedAt', language)}: ${formatWithLocale(viewingLocalAppointment.completedAt, 'h:mm a')}`}
                      </Text>
                    )}
                  </View>
                );
              })()}

              {/* 2. Confirmation Code */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>{t('confirmationCodeLabel', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Hash size={16} color={primaryColor} />
                  </View>
                  <Text style={{ color: viewingLocalAppointment.confirmationCode ? colors.text : colors.textTertiary, fontSize: 17, fontWeight: '700', letterSpacing: 1.5 }}>
                    {viewingLocalAppointment.confirmationCode ?? '—'}
                  </Text>
                </View>
              </View>

              {/* 3. Client — same rendering path as AppointmentsScreen: prefer client prop, fall back to customerName, then clientId */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('clientLabel', language).toUpperCase()}</Text>
                {(() => {
                  const resolvedClient = client;
                  const fallbackName = viewingLocalAppointment.customerName;
                  return resolvedClient ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 16 }}>{resolvedClient.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{resolvedClient.name}</Text>
                        {resolvedClient.email ? <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{resolvedClient.email}</Text> : null}
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
                    <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{viewingLocalAppointment.clientId}</Text>
                  );
                })()}
              </View>

              {/* 4. Repeat / Recurring — same as AppointmentsScreen */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('repeatAppointment', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: viewingLocalAppointment.seriesId ? `${primaryColor}18` : (isDark ? colors.backgroundTertiary : '#F1F5F9'), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Repeat size={16} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{t('repeatAppointment', language)}</Text>
                      {viewingLocalAppointment.seriesId ? (
                        <Text style={{ color: primaryColor, fontSize: 12, marginTop: 2 }}>
                          {t('recurringAppointmentBadge', language)}{viewingLocalAppointment.seriesOccurrenceIndex != null ? `  ·  ${t('occurrenceLabel', language)} #${viewingLocalAppointment.seriesOccurrenceIndex}` : ''}
                        </Text>
                      ) : (
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{t('repeatDescription', language)}</Text>
                      )}
                    </View>
                  </View>
                  {/* Toggle display (read-only) */}
                  <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: viewingLocalAppointment.seriesId ? primaryColor : (isDark ? '#374151' : '#D1D5DB'), justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2, alignSelf: viewingLocalAppointment.seriesId ? 'flex-end' : 'flex-start' }} />
                  </View>
                </View>
              </View>

              {/* 5. Date */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('dateLabel', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <CalendarDays size={16} color={primaryColor} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>
                    {formatWithLocale(new Date(viewingLocalAppointment.date), 'EEEE, MMMM d, yyyy')}
                  </Text>
                </View>
              </View>

              {/* 6. Time */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('timeLabel', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={16} color={primaryColor} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>
                    {viewingLocalAppointment.startTime ? formatTime(viewingLocalAppointment.startTime) : ''}
                    {viewingLocalAppointment.endTime ? ` — ${formatTime(viewingLocalAppointment.endTime)}` : ''}
                  </Text>
                </View>
              </View>

              {/* 7. Staff */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('staffMember', language).toUpperCase()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {(() => {
                    const s = staffMembers.find((m) => m.id === viewingLocalAppointment.staffId);
                    const name = s?.name || viewingLocalAppointment.staffName;
                    if (name) {
                      return (
                        <>
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${s?.color || primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ color: s?.color || primaryColor, fontWeight: '700', fontSize: 16 }}>{name.charAt(0).toUpperCase()}</Text>
                          </View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{name}</Text>
                        </>
                      );
                    }
                    return (
                      <>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <User size={18} color={colors.textTertiary} />
                        </View>
                        <Text style={{ color: colors.textTertiary, fontSize: 15, fontStyle: 'italic' }}>{t('noStaffAssigned', language)}</Text>
                      </>
                    );
                  })()}
                </View>
              </View>

              {/* 8. Services */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('services', language).toUpperCase()}</Text>
                {viewingLocalAppointment.serviceName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Tag size={15} color={primaryColor} style={{ marginRight: 8 }} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{viewingLocalAppointment.serviceName}</Text>
                  </View>
                ) : viewingLocalAppointment.serviceTags && viewingLocalAppointment.serviceTags.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {viewingLocalAppointment.serviceTags.map((sid) => {
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

              {/* 9. Duration — same as AppointmentsScreen */}
              {viewingLocalAppointment.duration != null && viewingLocalAppointment.duration > 0 && (
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('durationLabel', language).toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={16} color={primaryColor} />
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500', marginLeft: 10 }}>
                      {viewingLocalAppointment.duration} {t('minLabel', language)}
                    </Text>
                  </View>
                </View>
              )}

              {/* 10. Store */}
              {(viewingLocalAppointment.storeName || viewingLocalAppointment.storeId) && (
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('storesLabel', language).toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Building2 size={16} color={primaryColor} />
                    <Text style={{ color: colors.text, fontSize: 15, marginLeft: 10 }}>
                      {viewingLocalAppointment.storeName || stores.find((s) => s.id === viewingLocalAppointment.storeId)?.name || '—'}
                    </Text>
                  </View>
                </View>
              )}

              {/* 11. Promotion */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('promotionLabel', language).toUpperCase()}</Text>
                {viewingLocalAppointment.promotionId ? (() => {
                  const promo = marketingPromotions.find((p) => p.id === viewingLocalAppointment.promotionId);
                  return promo ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: promo.color || primaryColor, marginRight: 10 }} />
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{promo.name as string}</Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>{t('noPromotionSelected', language)}</Text>
                  );
                })() : (
                  <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>{t('noPromotionSelected', language)}</Text>
                )}
              </View>

              {/* 12. Loyalty Points */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>LOYALTY POINTS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Star size={16} color={primaryColor} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                    {(clientLoyaltyData?.total_points ?? 0).toLocaleString()} points
                  </Text>
                </View>
              </View>

              {/* 13. Gift Card — exact same logic as AppointmentsScreen view modal */}
              {(viewingLocalAppointment.giftCardIntent || viewingLocalAppointment.giftCardId || viewingLocalAppointment.giftCardCodeFromNotes) ? (() => {
                const gc = viewingLocalAppointment.giftCardId
                  ? viewClientGiftCards.find(g => g.id === viewingLocalAppointment.giftCardId)
                  : viewingLocalAppointment.giftCardCodeFromNotes
                    ? viewClientGiftCards.find(g =>
                        g.code.replace(/-/g, '').toUpperCase() === viewingLocalAppointment.giftCardCodeFromNotes!.replace(/-/g, '').toUpperCase()
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
                              {viewingLocalAppointment.giftCardDebited && (
                                <View style={{ backgroundColor: `${primaryColor}12`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 6 }}>
                                  <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>Debited</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        {/* Details grid */}
                        {(() => {
                          const redemption = viewAppointmentRedemption;
                          const deductedAmount = redemption?.amount != null
                            ? redemption.amount
                            : (viewingLocalAppointment?.giftCardDebited ? (viewingLocalAppointment?.amount ?? null) : null);
                          const originalCredit = gc.type === 'value' ? (gc.originalValue ?? null) : null;
                          const currentBalance = gc.type === 'value' ? (gc.currentBalance ?? null) : null;
                          const gcServices = gc.services ?? [];
                          const apptLc = viewingLocalAppointment.lifecycleStatus ?? 'scheduled';
                          const debited = apptLc === 'completed' || viewingLocalAppointment.giftCardDebited === true;
                          const deductedServiceName = redemption?.serviceName ?? null;
                          const deductedServiceQty = redemption?.quantityUsed ?? 1;
                          const apptServiceIds: string[] = viewingLocalAppointment.serviceTags ?? [];
                          const inferredMatchedServices = gcServices.filter(s => apptServiceIds.includes(s.serviceId));
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
                                  <View style={{ marginBottom: 4 }}>
                                    <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 }}>
                                      {debited ? t('serviceDeducted', language) : t('serviceToDeduct', language)}
                                    </Text>
                                    {debited ? (
                                      redemptionLoading ? (
                                        <ActivityIndicator size="small" color={primaryColor} />
                                      ) : deductedServiceName ? (
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                                          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{deductedServiceName}</Text>
                                          <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>×{deductedServiceQty}</Text>
                                          </View>
                                        </View>
                                      ) : inferredMatchedServices.length > 0 ? (
                                        inferredMatchedServices.map(s => (
                                          <View key={s.serviceId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
                                            <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{s.serviceName}</Text>
                                            <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>×1</Text>
                                            </View>
                                          </View>
                                        ))
                                      ) : gcServices.length > 0 ? (
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

                                  {/* Services Remaining */}
                                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2 }}>
                                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 }}>
                                      {debited ? t('servicesRemainingAfter', language) : t('servicesRemainingBefore', language)}
                                    </Text>
                                    {remainingFromDB.map(s => (
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

                              {/* Issued / Expires */}
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
                          {viewingLocalAppointment.giftCardCodeFromNotes ?? (viewingLocalAppointment.giftCardId ? viewingLocalAppointment.giftCardId.slice(0, 8).toUpperCase() : 'Loading...')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })() : null}

              {/* 14. Amount */}
              {(() => {
                const apt = viewingLocalAppointment;
                const displayAmount =
                  (apt.totalCents != null && apt.totalCents > 0) ? apt.totalCents / 100
                  : (apt.subtotalCents != null && apt.subtotalCents > 0) ? apt.subtotalCents / 100
                  : (apt.servicePrice != null && apt.servicePrice > 0) ? apt.servicePrice
                  : (apt.amount != null && apt.amount > 0) ? apt.amount
                  : null;
                return (
                  <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('appointmentAmount', language).toUpperCase()}</Text>
                    <Text style={{ color: displayAmount ? colors.text : colors.textTertiary, fontSize: 22, fontWeight: '700' }}>
                      {displayAmount != null
                        ? formatCurrency(displayAmount, apt.currency || currency)
                        : formatCurrency(0, apt.currency || currency)}
                    </Text>
                  </View>
                );
              })()}

              {/* 15. Notes */}
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>{t('notesLabel', language).toUpperCase()}</Text>
                <Text style={{ color: viewingLocalAppointment.notes ? colors.text : colors.textTertiary, fontSize: 15, lineHeight: 22, fontStyle: viewingLocalAppointment.notes ? 'normal' : 'italic' }}>
                  {viewingLocalAppointment.notes || t('anyAdditionalNotes', language)}
                </Text>
              </View>

              {/* Edit Appointment CTA — same rules as AppointmentsScreen: hidden for terminal states (completed, no_show, cancelled) */}
              {(() => {
                const lc = viewingLocalAppointment.lifecycleStatus ?? 'scheduled';
                const isLogVisitFlag = viewingLocalAppointment.isLogVisit === true;
                const effectiveLc = isLogVisitFlag && lc === 'scheduled' ? 'checked_in' : lc;
                const isTerminal = effectiveLc === 'completed' || effectiveLc === 'no_show' || effectiveLc === 'cancelled';
                if (isTerminal) return null;
                return (
                  <>
                    <Pressable
                      onPress={() => {
                        const appt = viewingLocalAppointment;
                        setViewingLocalAppointment(null);
                        setTimeout(() => onOpenEditAppointment(appt as unknown as Parameters<typeof onOpenEditAppointment>[0]), 350);
                      }}
                      style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('editAppointment', language)}</Text>
                    </Pressable>
                    {/* Cancel Appointment button — same style as Dashboard */}
                    <Pressable
                      onPress={() => setShowViewCancelConfirm(true)}
                      style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('cancelAppointment', language)}</Text>
                    </Pressable>
                  </>
                );
              })()}
            </ScrollView>

            {/* Cancel Confirmation Overlay — rendered inside the View panel, matching Dashboard */}
            {showViewCancelConfirm && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, zIndex: 100 }}>
                <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 380 }}>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center' }}>
                      <XCircle size={28} color={primaryColor} />
                    </View>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 }}>
                    {t('cancelAppointmentConfirmTitle', language)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 }}>
                    {t('cancelAppointmentConfirmMessage', language)}
                  </Text>
                  <Pressable
                    onPress={handleViewCancelAppointment}
                    disabled={cancellingFromView}
                    style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    {cancellingFromView ? <ActivityIndicator color="#fff" size="small" /> : null}
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('cancelAppointment', language)}</Text>
                  </Pressable>
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
          </View>
        ) : (
          /* Appointments List View */
          <View style={{ flex: 1 }}>
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: colors.card,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Calendar size={18} color={primaryColor} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{t('upcomingAppointments', language)}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{clientUpcomingAppointments.length} {t('appointments', language).toLowerCase()}</Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: insets.bottom }}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              <AppointmentListView
                currentAppointments={localAppointments}
                dateRangeMode="month"
                serviceTags={serviceTags}
                language={language}
                getClient={getClient}
                getStaffMember={getStaffMember}
                getAppointmentStatus={getAppointmentStatus}
                formatTime={formatTime}
                formatWithLocale={formatWithLocale}
                dateLabel=""
                onView={(appt) => setViewingLocalAppointment(appt)}
                onEdit={(appt) => onOpenEditAppointment(appt as unknown as Parameters<typeof onOpenEditAppointment>[0])}
              />
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}
