import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Clock,
  User,
  Users,
  Briefcase,
  Gift,
  Check,
  AlertCircle,
  Calendar,
  Repeat,
  ArrowLeft,
  CalendarClock,
} from 'lucide-react-native';
import { format, Locale } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t, getCachedDateFnsLocale, getDateFnsLocale } from '@/lib/i18n';
import { getCurrencySymbol } from '@/lib/currency';
import { WheelDatePicker } from '@/components/WheelDatePicker';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import {
  useUpdateAppointment,
  useCheckAppointmentConflict,
  useCreateAppointmentSeries,
  useCreateAppointmentsFromSeries,
  useSeriesPreview,
} from '@/hooks/useAppointments';
import { useStores } from '@/hooks/useStores';
import { useStaffMembers } from '@/hooks/useStaff';
import { useClient } from '@/hooks/useClients';
import { useServices, useSyncAppointmentServices } from '@/hooks/useServices';
import { useStaffServiceSkills } from '@/hooks/useStaffServices';
import { useClientGiftCards } from '@/hooks/useGiftCards';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { notifyAppointmentEmail } from '@/services/appointmentsService';
import type {
  RecurrenceFrequency,
  RecurrenceEndType,
  SeriesPreview,
  CreateSeriesInput,
} from '@/services/appointmentsService';
import type { GiftCard } from '@/lib/types';
import type { LocalAppointment, LocalStaff } from './appointmentsTypes';
import { formatTimeInput, calculateEndTime, capitalizeDate } from './appointmentsUtils';
import { BusinessHoursAlertModal } from '@/components/BusinessHoursAlertModal';
import { isWithinBusinessHours } from '@/lib/businessHoursValidation';

export interface EditAppointmentModalProps {
  appointment: LocalAppointment | null;
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function EditAppointmentModal({
  appointment,
  visible,
  onClose,
  onSaved,
}: EditAppointmentModalProps) {
  // ─── Theme / App State ────────────────────────────────────────────────────
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language);
  const currency = useStore((s) => s.currency);
  const marketingPromotions = useStore((s) => s.marketingPromotions);
  const currencySymbol = getCurrencySymbol(currency);
  const { showSaveConfirmation } = useSaveConfirmation();

  // Locale for date formatting (same pattern as AppointmentsScreen)
  const [locale, setLocale] = useState<Locale>(() => getCachedDateFnsLocale(language));
  useEffect(() => {
    getDateFnsLocale(language).then(setLocale);
  }, [language]);
  const formatWithLocale = useCallback(
    (date: Date, formatStr: string) => {
      const formatted = format(date, formatStr, { locale });
      return capitalizeDate(formatted);
    },
    [locale]
  );

  // ─── Edit State ───────────────────────────────────────────────────────────
  const [editTitle, setEditTitle] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState(60);
  const [editConflictError, setEditConflictError] = useState<string | null>(null);
  const [showBusinessHoursAlert, setShowBusinessHoursAlert] = useState(false);
  const [editSelectedServices, setEditSelectedServices] = useState<string[]>([]);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editPromotionId, setEditPromotionId] = useState<string | null>(null);
  const [showEditPromotionPicker, setShowEditPromotionPicker] = useState(false);
  const [editGiftCardId, setEditGiftCardId] = useState<string | null>(null);
  const [showEditGiftCardPicker, setShowEditGiftCardPicker] = useState(false);
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurrenceFrequency, setEditRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [editRecurrenceEndType, setEditRecurrenceEndType] = useState<RecurrenceEndType>('occurrence_count');
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState<Date | null>(null);
  const [editRecurrenceCount, setEditRecurrenceCount] = useState('4');
  const [editCustomIntervalWeeks, setEditCustomIntervalWeeks] = useState('3');
  const [editSeriesPreviewData, setEditSeriesPreviewData] = useState<SeriesPreview | null>(null);

  // ─── Data Hooks ───────────────────────────────────────────────────────────
  const { data: allStaffData = [] } = useStaffMembers();
  const { data: supabaseStores = [] } = useStores();
  const { data: supabaseServices = [] } = useServices();
  const { data: staffServiceSkills = [] } = useStaffServiceSkills(editStaffId);
  const { data: appointmentClient } = useClient(appointment?.clientId);
  const { data: clientGiftCardsRaw } = useClientGiftCards(appointment?.clientId ?? undefined);
  const activeStoreId = editStoreId ?? appointment?.storeId ?? null;
  const { data: storeBusinessHours = [] } = useBusinessHours(activeStoreId);
  const clientActiveGiftCards = useMemo(
    () => (clientGiftCardsRaw ?? []).filter((gc: GiftCard) => gc.status === 'active'),
    [clientGiftCardsRaw]
  );

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const editStaffMembers: LocalStaff[] = useMemo(() => {
    const allStaff = allStaffData.map((s) => ({
      id: s.id,
      name: s.name,
      color: (s as { color?: string }).color ?? '#666',
      storeIds: (s as { storeIds?: string[] }).storeIds ?? [],
    }));
    if (!editStoreId) return allStaff;
    return allStaff.filter(
      (s) => s.storeIds.length === 0 || s.storeIds.includes(editStoreId)
    );
  }, [editStoreId, allStaffData]);

  const serviceTags = useMemo(
    () =>
      supabaseServices.map((s) => ({
        id: s.id,
        name: s.name,
        color: (s as { color?: string }).color ?? '#888',
      })),
    [supabaseServices]
  );

  // Filter services to only those the selected staff member can perform.
  // If no staff is selected or staff has no configured skills, show all services.
  const filteredServiceTags = useMemo(() => {
    if (!editStaffId || staffServiceSkills.length === 0) return serviceTags;
    const validIds = new Set(staffServiceSkills.map((sk) => sk.service_id));
    return serviceTags.filter((tag) => validIds.has(tag.id));
  }, [editStaffId, staffServiceSkills, serviceTags]);

  // Helper: resolve total amount from an array of service IDs using real price_cents
  const calculateAmountFromServices = useCallback(
    (serviceIds: string[]): string => {
      if (serviceIds.length === 0) return '';
      const total = serviceIds.reduce((sum: number, id: string) => {
        const svc = supabaseServices.find((s) => s.id === id);
        return sum + ((svc as { price_cents?: number })?.price_cents ?? 0) / 100;
      }, 0);
      return total > 0 ? total.toFixed(2) : '';
    },
    [supabaseServices]
  );

  // Ref to always have the latest editSelectedServices inside effects without
  // adding it as a dependency (avoids infinite loops).
  const editSelectedServicesRef = useRef(editSelectedServices);
  editSelectedServicesRef.current = editSelectedServices;

  // When the selected staff member changes AND skills have loaded, remove any
  // currently-selected services that the new staff member does not perform,
  // then recalculate the amount from the remaining valid services.
  useEffect(() => {
    if (!editStaffId || staffServiceSkills.length === 0) return;
    const validIds = new Set(staffServiceSkills.map((sk) => sk.service_id));
    const current = editSelectedServicesRef.current;
    const valid = current.filter((id) => validIds.has(id));
    if (valid.length !== current.length) {
      setEditSelectedServices(valid);
      const newAmount = calculateAmountFromServices(valid);
      setEditAmount(newAmount);
    }
  }, [editStaffId, staffServiceSkills]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mutations ────────────────────────────────────────────────────────────
  const updateAppointmentMutation = useUpdateAppointment();
  const syncServicesMutation = useSyncAppointmentServices();
  const checkConflictMutation = useCheckAppointmentConflict();
  const seriesPreviewMutation = useSeriesPreview();
  const createSeriesMutation = useCreateAppointmentSeries();
  const createAppointmentsFromSeriesMutation = useCreateAppointmentsFromSeries();

  // ─── Initialize State from Appointment ───────────────────────────────────
  useEffect(() => {
    if (!appointment) return;

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

    // Services
    let selectedServices: string[] = [];
    if (appointment.serviceId) {
      selectedServices = [appointment.serviceId];
    } else if (appointment.serviceTags && appointment.serviceTags.length > 0) {
      selectedServices = appointment.serviceTags;
    }
    setEditSelectedServices(selectedServices);

    // Amount
    let amountToUse = '';
    if (appointment.servicePrice != null && appointment.servicePrice > 0) {
      amountToUse = appointment.servicePrice.toFixed(2);
    } else if (appointment.amount != null && appointment.amount > 0) {
      amountToUse = appointment.amount.toString();
    } else if (selectedServices.length > 0) {
      const serviceTotal = selectedServices.reduce((total, serviceId) => {
        const service = supabaseServices.find((s) => s.id === serviceId);
        return total + (((s: typeof service) => (s as { price_cents?: number })?.price_cents ?? 0)(service) / 100);
      }, 0);
      if (serviceTotal > 0) amountToUse = serviceTotal.toFixed(2);
    }
    setEditAmount(amountToUse);
    setEditPromotionId(appointment.promotionId || null);
    setShowEditPromotionPicker(false);
    setEditGiftCardId(appointment.giftCardId || null);
    setShowEditGiftCardPicker(false);

    // Reset recurring
    setEditIsRecurring(false);
    setEditRecurrenceFrequency('weekly');
    setEditRecurrenceEndType('occurrence_count');
    setEditRecurrenceEndDate(null);
    setEditRecurrenceCount('4');
    setEditCustomIntervalWeeks('3');
    setEditSeriesPreviewData(null);
  }, [appointment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleEditStartTimeChange = (text: string) => {
    const formatted = formatTimeInput(text);
    setEditStartTime(formatted);
    if (formatted.length === 5) {
      const [hours, minutes] = formatted.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const totalMinutes = hours * 60 + minutes + editDuration;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        setEditEndTime(
          `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
        );
      }
    }
  };

  const handleEditEndTimeChange = (text: string) => {
    setEditEndTime(formatTimeInput(text));
  };

  const handleEditDurationChange = (minutes: number) => {
    setEditDuration(minutes);
    setEditConflictError(null);
    if (editStartTime && editStartTime.length === 5) {
      const newEndTime = calculateEndTime(editStartTime, minutes);
      if (newEndTime) setEditEndTime(newEndTime);
    }
  };

  const toggleEditService = (tagId: string) => {
    const newServices = editSelectedServices.includes(tagId)
      ? editSelectedServices.filter((id) => id !== tagId)
      : [...editSelectedServices, tagId];
    setEditSelectedServices(newServices);
    // Auto-populate amount from the real price_cents of the selected services
    const newAmount = calculateAmountFromServices(newServices);
    if (newAmount) setEditAmount(newAmount);
  };

  const handleClose = () => {
    setEditConflictError(null);
    setShowEditDatePicker(false);
    setShowEditPromotionPicker(false);
    setShowEditGiftCardPicker(false);
    onClose();
  };

  const handleSaveEdit = async () => {
    if (!appointment) return;

    const storeId = editStoreId || appointment.storeId;

    // Block if appointment time is outside the store's configured business hours
    if (!isWithinBusinessHours(editDate, editStartTime, storeBusinessHours)) {
      setShowBusinessHoursAlert(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Conflict check
    if (storeId) {
      try {
        const [startHour, startMin] = editStartTime.split(':').map(Number);
        const startAt = new Date(editDate);
        startAt.setHours(startHour, startMin, 0, 0);
        const endAt = new Date(startAt.getTime() + editDuration * 60 * 1000);
        const conflicts = await checkConflictMutation.mutateAsync({
          storeId,
          staffId: editStaffId || null,
          startAt,
          endAt,
          excludeAppointmentId: appointment.id,
        });
        if (conflicts && conflicts.length > 0) {
          const staffName = editStaffId
            ? editStaffMembers.find((s) => s.id === editStaffId)?.name ||
              t('staffMember', language)
            : t('staffMember', language);
          setEditConflictError(
            t('staffConflictError', language).replace('{staffName}', staffName)
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      } catch {
        // Continue without blocking if conflict check fails
      }
    }

    const selectedTagNames = editSelectedServices
      .map((id) => serviceTags.find((tag) => tag.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const finalTitle =
      selectedTagNames || editTitle || `Appointment with ${appointmentClient?.name || ''}`;

    const [startHour, startMin] = editStartTime.split(':').map(Number);
    const startAt = new Date(editDate);
    startAt.setHours(startHour, startMin, 0, 0);
    const endAt = new Date(startAt.getTime() + editDuration * 60 * 1000);

    try {
      await updateAppointmentMutation.mutateAsync({
        appointmentId: appointment.id,
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

      if (editSelectedServices.length > 0) {
        await syncServicesMutation.mutateAsync({
          appointmentId: appointment.id,
          serviceIds: editSelectedServices,
        });
      }

      // Create recurring series if toggled on and not already in a series
      if (editIsRecurring && !appointment.seriesId) {
        try {
          const seriesInput: CreateSeriesInput = {
            business_id: appointment.userId,
            store_id: storeId,
            staff_id: editStaffId || appointment.staffId || null,
            client_id: appointment.clientId,
            service_ids:
              editSelectedServices.length > 0
                ? editSelectedServices
                : (appointment.serviceTags ?? []),
            frequency_type: editRecurrenceFrequency,
            interval_value:
              editRecurrenceFrequency === 'custom' ? parseInt(editCustomIntervalWeeks) || 1 : 1,
            start_date: editDate,
            end_type: editRecurrenceEndType,
            end_date: editRecurrenceEndType === 'until_date' ? editRecurrenceEndDate : null,
            occurrence_count:
              editRecurrenceEndType === 'occurrence_count'
                ? parseInt(editRecurrenceCount) || 4
                : null,
            start_time: editStartTime,
            duration_minutes: editDuration,
            amount: editAmount ? parseFloat(editAmount) : (appointment.amount ?? 0),
            currency: appointment.currency ?? 'USD',
            notes: editNotes || undefined,
          };
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
        } catch {
          // Series creation failure doesn't block the base appointment save
        }
      }

      setEditConflictError(null);
      setEditIsRecurring(false);
      setEditSeriesPreviewData(null);
      notifyAppointmentEmail(appointment.id, 'updated', language);
      setTimeout(() => {
        showSaveConfirmation(t('appointmentUpdated', language));
      }, 350);
      onSaved?.();
      handleClose();
    } catch {
      setEditConflictError('Failed to update appointment. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Pressable onPress={handleClose} style={{ padding: 4, marginRight: 10 }}>
              <ArrowLeft size={24} color={primaryColor} />
            </Pressable>
            <CalendarClock size={18} color={primaryColor} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
              {t('editAppointment', language)}
            </Text>
          </View>
          <Pressable onPress={handleClose} style={{ padding: 4 }}>
            <X size={24} color={primaryColor} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {appointment && (
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
                  const client = appointmentClient;
                  const getInitials = (name: string) => {
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) {
                      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
                    }
                    return name.charAt(0).toUpperCase();
                  };
                  const clientName = client?.name ?? appointment.customerName;
                  const clientEmail = client?.email;
                  return clientName ? (
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
                          {getInitials(clientName)}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                          {clientName}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                          {clientEmail || ''}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: colors.textTertiary, fontStyle: 'italic' }}>
                      {t('clientRemoved', language)}
                    </Text>
                  );
                })()}
              </View>

              {/* Repeat / Recurring */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                {appointment?.seriesId ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: `${primaryColor}15`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Repeat size={18} color={primaryColor} />
                      </View>
                      <View>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                          {t('repeatAppointment', language)}
                        </Text>
                        <Text style={{ color: primaryColor, fontSize: 12, marginTop: 2 }}>
                          {t('recurringAppointmentBadge', language)}
                          {appointment.seriesOccurrenceIndex != null
                            ? `  ·  ${t('occurrenceLabel', language)} #${appointment.seriesOccurrenceIndex}`
                            : ''}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        width: 44,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: primaryColor,
                        justifyContent: 'center',
                        paddingHorizontal: 2,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: '#fff',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.15,
                          shadowRadius: 2,
                          elevation: 2,
                          alignSelf: 'flex-end',
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditIsRecurring(!editIsRecurring);
                        setEditSeriesPreviewData(null);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: editIsRecurring
                              ? `${primaryColor}20`
                              : isDark
                              ? colors.backgroundTertiary
                              : '#F1F5F9',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          <Repeat
                            size={18}
                            color={editIsRecurring ? primaryColor : colors.textTertiary}
                          />
                        </View>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                            {t('repeatAppointment', language)}
                          </Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                            {t('repeatDescription', language)}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          width: 44,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: editIsRecurring
                            ? primaryColor
                            : isDark
                            ? '#374151'
                            : '#D1D5DB',
                          justifyContent: 'center',
                          paddingHorizontal: 2,
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: '#fff',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.15,
                            shadowRadius: 2,
                            elevation: 2,
                            alignSelf: editIsRecurring ? 'flex-end' : 'flex-start',
                          }}
                        />
                      </View>
                    </Pressable>

                    {editIsRecurring && (
                      <View style={{ marginTop: 16 }}>
                        <Text
                          style={{
                            color: colors.textTertiary,
                            fontSize: 12,
                            fontWeight: '500',
                            marginBottom: 8,
                          }}
                        >
                          {t('frequency', language)}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                          {(
                            [
                              {
                                value: 'weekly' as RecurrenceFrequency,
                                label: t('weekly', language),
                              },
                              {
                                value: 'biweekly' as RecurrenceFrequency,
                                label: t('everyTwoWeeks', language),
                              },
                              {
                                value: 'monthly' as RecurrenceFrequency,
                                label: t('monthly', language),
                              },
                              {
                                value: 'custom' as RecurrenceFrequency,
                                label: t('customFrequency', language),
                              },
                            ] as const
                          ).map((option) => {
                            const isSelected = editRecurrenceFrequency === option.value;
                            return (
                              <Pressable
                                key={option.value}
                                onPress={() => {
                                  setEditRecurrenceFrequency(option.value);
                                  setEditSeriesPreviewData(null);
                                }}
                                style={{
                                  marginRight: 8,
                                  marginBottom: 8,
                                  paddingHorizontal: 14,
                                  paddingVertical: 8,
                                  borderRadius: 16,
                                  backgroundColor: isSelected
                                    ? primaryColor
                                    : colors.backgroundTertiary,
                                  borderWidth: 1,
                                  borderColor: isSelected ? primaryColor : colors.border,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '500',
                                    color: isSelected ? '#fff' : colors.text,
                                  }}
                                >
                                  {option.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        {editRecurrenceFrequency === 'custom' && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              marginBottom: 16,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 14,
                                marginRight: 8,
                              }}
                            >
                              {t('every', language)}
                            </Text>
                            <TextInput
                              value={editCustomIntervalWeeks}
                              onChangeText={(v) => {
                                setEditCustomIntervalWeeks(v.replace(/[^0-9]/g, ''));
                                setEditSeriesPreviewData(null);
                              }}
                              keyboardType="number-pad"
                              maxLength={2}
                              style={{
                                backgroundColor: colors.backgroundTertiary,
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                color: colors.text,
                                fontSize: 14,
                                width: 50,
                                textAlign: 'center',
                              }}
                            />
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 14,
                                marginLeft: 8,
                              }}
                            >
                              {t('weeks', language)}
                            </Text>
                          </View>
                        )}

                        <Text
                          style={{
                            color: colors.textTertiary,
                            fontSize: 12,
                            fontWeight: '500',
                            marginBottom: 8,
                          }}
                        >
                          {t('endCondition', language)}
                        </Text>
                        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                          <Pressable
                            onPress={() => {
                              setEditRecurrenceEndType('occurrence_count');
                              setEditSeriesPreviewData(null);
                            }}
                            style={{
                              flex: 1,
                              marginRight: 8,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              backgroundColor:
                                editRecurrenceEndType === 'occurrence_count'
                                  ? `${primaryColor}15`
                                  : colors.backgroundTertiary,
                              borderWidth: 1,
                              borderColor:
                                editRecurrenceEndType === 'occurrence_count'
                                  ? primaryColor
                                  : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '500',
                                color:
                                  editRecurrenceEndType === 'occurrence_count'
                                    ? primaryColor
                                    : colors.text,
                                textAlign: 'center',
                              }}
                            >
                              {t('afterOccurrences', language)}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setEditRecurrenceEndType('until_date');
                              setEditSeriesPreviewData(null);
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 12,
                              backgroundColor:
                                editRecurrenceEndType === 'until_date'
                                  ? `${primaryColor}15`
                                  : colors.backgroundTertiary,
                              borderWidth: 1,
                              borderColor:
                                editRecurrenceEndType === 'until_date'
                                  ? primaryColor
                                  : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '500',
                                color:
                                  editRecurrenceEndType === 'until_date' ? primaryColor : colors.text,
                                textAlign: 'center',
                              }}
                            >
                              {t('onDate', language)}
                            </Text>
                          </Pressable>
                        </View>

                        {editRecurrenceEndType === 'occurrence_count' && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              marginBottom: 12,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 14,
                                marginRight: 8,
                              }}
                            >
                              {t('repeatTimes', language)}
                            </Text>
                            <TextInput
                              value={editRecurrenceCount}
                              onChangeText={(v) => {
                                setEditRecurrenceCount(v.replace(/[^0-9]/g, ''));
                                setEditSeriesPreviewData(null);
                              }}
                              keyboardType="number-pad"
                              maxLength={2}
                              style={{
                                backgroundColor: colors.backgroundTertiary,
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                color: colors.text,
                                fontSize: 14,
                                width: 50,
                                textAlign: 'center',
                              }}
                            />
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 14,
                                marginLeft: 8,
                              }}
                            >
                              {t('times', language)}
                            </Text>
                          </View>
                        )}

                        {editRecurrenceEndType === 'until_date' && (
                          <Pressable
                            onPress={() => {
                              const endDate = new Date(editDate);
                              endDate.setMonth(endDate.getMonth() + 3);
                              setEditRecurrenceEndDate(endDate);
                              setEditSeriesPreviewData(null);
                            }}
                            style={{
                              backgroundColor: colors.backgroundTertiary,
                              borderRadius: 12,
                              padding: 14,
                              flexDirection: 'row',
                              alignItems: 'center',
                              marginBottom: 12,
                            }}
                          >
                            <Calendar size={18} color={colors.textSecondary} />
                            <Text style={{ color: colors.text, fontSize: 14, marginLeft: 10 }}>
                              {editRecurrenceEndDate
                                ? formatWithLocale(editRecurrenceEndDate, 'MMM d, yyyy')
                                : t('selectEndDate', language)}
                            </Text>
                          </Pressable>
                        )}

                        <Pressable
                          onPress={async () => {
                            if (!appointment) return;
                            const input: CreateSeriesInput = {
                              business_id: appointment.userId,
                              store_id: editStoreId || appointment.storeId,
                              staff_id: editStaffId || appointment.staffId || null,
                              client_id: appointment.clientId,
                              service_ids:
                                editSelectedServices.length > 0
                                  ? editSelectedServices
                                  : (appointment.serviceTags ?? []),
                              frequency_type: editRecurrenceFrequency,
                              interval_value:
                                editRecurrenceFrequency === 'custom'
                                  ? parseInt(editCustomIntervalWeeks) || 1
                                  : 1,
                              start_date: editDate,
                              end_type: editRecurrenceEndType,
                              end_date:
                                editRecurrenceEndType === 'until_date'
                                  ? editRecurrenceEndDate
                                  : null,
                              occurrence_count:
                                editRecurrenceEndType === 'occurrence_count'
                                  ? parseInt(editRecurrenceCount) || 4
                                  : null,
                              start_time: editStartTime,
                              duration_minutes: editDuration,
                            };
                            try {
                              const preview = await seriesPreviewMutation.mutateAsync({
                                input,
                              });
                              setEditSeriesPreviewData(preview);
                            } catch {
                              // ignore
                            }
                          }}
                          disabled={seriesPreviewMutation.isPending}
                          style={{
                            backgroundColor: `${primaryColor}15`,
                            borderRadius: 12,
                            padding: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {seriesPreviewMutation.isPending ? (
                            <ActivityIndicator size="small" color={primaryColor} />
                          ) : (
                            <Text
                              style={{ color: primaryColor, fontSize: 14, fontWeight: '600' }}
                            >
                              {t('previewSeries', language)}
                            </Text>
                          )}
                        </Pressable>

                        {editSeriesPreviewData && (
                          <View
                            style={{
                              marginTop: 12,
                              padding: 12,
                              backgroundColor: `${primaryColor}08`,
                              borderRadius: 12,
                            }}
                          >
                            <Text
                              style={{
                                color: primaryColor,
                                fontSize: 13,
                                fontWeight: '600',
                                marginBottom: 4,
                              }}
                            >
                              {editSeriesPreviewData.totalCount}{' '}
                              {t('appointmentsInSeries', language)}
                              {editSeriesPreviewData.conflictCount > 0
                                ? `  ·  ${editSeriesPreviewData.conflictCount} ${t('conflictsFound', language)}`
                                : ''}
                            </Text>
                            {editSeriesPreviewData.occurrences.slice(0, 3).map((occ, i) => (
                              <Text
                                key={i}
                                style={{ color: colors.textSecondary, fontSize: 12 }}
                              >
                                {formatWithLocale(occ.date, 'EEE, MMM d, yyyy')}
                              </Text>
                            ))}
                            {editSeriesPreviewData.totalCount > 3 && (
                              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                                +{editSeriesPreviewData.totalCount - 3} more
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Date */}
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

              {/* Time (Start + End side-by-side) */}
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
                    <Text
                      style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}
                    >
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
                  <Text style={{ color: colors.textTertiary, marginHorizontal: 12 }}>
                    {t('toLabel', language)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}
                    >
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
                  <Pressable
                    onPress={() => {
                      setEditStaffId(null);
                      setEditConflictError(null);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: !editStaffId
                        ? primaryColor
                        : isDark
                        ? colors.backgroundTertiary
                        : '#F1F5F9',
                      marginHorizontal: 4,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <User size={14} color={!editStaffId ? '#fff' : colors.textSecondary} />
                    <Text
                      style={{
                        color: !editStaffId ? '#fff' : colors.textSecondary,
                        fontWeight: '500',
                        fontSize: 14,
                        marginLeft: 6,
                      }}
                    >
                      {t('unassigned', language)}
                    </Text>
                  </Pressable>
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
                  {filteredServiceTags.map((service) => {
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
                          backgroundColor: isSelected
                            ? primaryColor
                            : isDark
                            ? colors.backgroundTertiary
                            : `${primaryColor}10`,
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
                  {filteredServiceTags.length === 0 && (
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontSize: 14,
                        fontStyle: 'italic',
                      }}
                    >
                      {t('noServicesYet', language)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Duration */}
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
                        {mins < 60
                          ? `${mins} ${t('minLabel', language)}`
                          : mins === 60
                          ? `1 ${t('hrLabel', language)}`
                          : `${mins / 60} ${t('hrLabel', language)}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Promotion */}
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
                    marginBottom: 10,
                  }}
                >
                  {t('selectPromoOptional', language)}
                </Text>
                <Pressable
                  onPress={() => setShowEditPromotionPicker(!showEditPromotionPicker)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Text
                    style={{
                      color: editPromotionId ? colors.text : colors.textTertiary,
                      fontSize: 15,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {editPromotionId
                      ? (marketingPromotions.find((p) => p.id === editPromotionId)?.name ??
                        t('selectPromotion', language))
                      : t('noPromotionSelected', language)}
                  </Text>
                </Pressable>
                {showEditPromotionPicker && (
                  <View
                    style={{
                      marginTop: 8,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setEditPromotionId(null);
                        setShowEditPromotionPicker(false);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        backgroundColor: !editPromotionId ? `${primaryColor}12` : colors.card,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: !editPromotionId ? primaryColor : colors.textSecondary,
                          fontSize: 14,
                          fontWeight: !editPromotionId ? '600' : '400',
                        }}
                      >
                        {t('noPromotionSelected', language)}
                      </Text>
                    </Pressable>
                    {marketingPromotions
                      .filter((p) => p.isActive)
                      .map((promo) => (
                        <Pressable
                          key={promo.id}
                          onPress={() => {
                            setEditPromotionId(promo.id);
                            setShowEditPromotionPicker(false);
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            backgroundColor:
                              editPromotionId === promo.id ? `${primaryColor}12` : colors.card,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: primaryColor,
                              marginRight: 10,
                            }}
                          />
                          <Text
                            style={{
                              color:
                                editPromotionId === promo.id ? primaryColor : colors.text,
                              fontSize: 14,
                              fontWeight: editPromotionId === promo.id ? '600' : '400',
                              flex: 1,
                            }}
                          >
                            {promo.name}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                )}
              </View>

              {/* Gift Card (optional) */}
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
                    marginBottom: 10,
                  }}
                >
                  {t('giftCards', language)} ({t('optional', language)})
                </Text>
                <Pressable
                  onPress={() =>
                    clientActiveGiftCards.length > 0 &&
                    setShowEditGiftCardPicker(!showEditGiftCardPicker)
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: editGiftCardId ? 1.5 : 0,
                    borderColor: editGiftCardId ? primaryColor : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Gift
                      size={16}
                      color={editGiftCardId ? primaryColor : colors.textTertiary}
                    />
                    <Text
                      style={{
                        color: editGiftCardId ? colors.text : colors.textTertiary,
                        fontSize: 15,
                        flex: 1,
                        marginLeft: 10,
                      }}
                      numberOfLines={1}
                    >
                      {editGiftCardId
                        ? (() => {
                            const gc = clientActiveGiftCards.find(
                              (g: GiftCard) => g.id === editGiftCardId
                            );
                            return gc
                              ? `${gc.code}${gc.currentBalance != null ? ` · ${gc.currentBalance}` : ''}`
                              : t('redeemGiftCard', language);
                          })()
                        : clientActiveGiftCards.length === 0
                        ? t('noGiftCardAvailable', language)
                        : t('noGiftCardSelected', language)}
                    </Text>
                  </View>
                  {clientActiveGiftCards.length > 0 && (
                    <Gift size={16} color={colors.textTertiary} />
                  )}
                </Pressable>
                {showEditGiftCardPicker && clientActiveGiftCards.length > 0 && (
                  <View
                    style={{
                      marginTop: 8,
                      borderRadius: 12,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setEditGiftCardId(null);
                        setShowEditGiftCardPicker(false);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        backgroundColor: !editGiftCardId ? `${primaryColor}12` : colors.card,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          color: !editGiftCardId ? primaryColor : colors.textSecondary,
                          fontSize: 14,
                          fontWeight: !editGiftCardId ? '600' : '400',
                        }}
                      >
                        {t('noGiftCardOption', language)}
                      </Text>
                      {!editGiftCardId && <Check size={16} color={primaryColor} />}
                    </Pressable>
                    {clientActiveGiftCards.map((gc: GiftCard) => {
                      const isSelected = editGiftCardId === gc.id;
                      const isValue = gc.type === 'value';
                      const formattedBalance =
                        gc.currentBalance != null
                          ? `${currencySymbol}${gc.currentBalance.toFixed(2)}`
                          : null;
                      let servicesLine: string | null = null;
                      if (!isValue && gc.services && gc.services.length > 0) {
                        const MAX_SHOW = 2;
                        const shown = gc.services.slice(0, MAX_SHOW);
                        const extra = gc.services.length - MAX_SHOW;
                        const parts = shown.map((s) => {
                          const remaining = s.quantity - s.usedQuantity;
                          return `${s.serviceName} (${remaining}/${s.quantity})`;
                        });
                        servicesLine =
                          parts.join(' • ') +
                          (extra > 0
                            ? ` • +${extra} ${t('giftCardMoreServices', language)}`
                            : '');
                      }
                      return (
                        <Pressable
                          key={gc.id}
                          onPress={() => {
                            setEditGiftCardId(gc.id);
                            setShowEditGiftCardPicker(false);
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            backgroundColor: isSelected ? `${primaryColor}12` : colors.card,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          }}
                        >
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text
                              style={{
                                color: isSelected ? primaryColor : colors.text,
                                fontSize: 14,
                                fontWeight: isSelected ? '600' : '400',
                              }}
                            >
                              {gc.code}
                            </Text>
                            {isValue && formattedBalance != null && (
                              <Text
                                style={{
                                  color: colors.textTertiary,
                                  fontSize: 12,
                                  marginTop: 2,
                                }}
                              >
                                {t('remainingBalance', language)}: {formattedBalance}
                              </Text>
                            )}
                            {!isValue && servicesLine && (
                              <Text
                                style={{
                                  color: colors.textTertiary,
                                  fontSize: 12,
                                  marginTop: 2,
                                }}
                                numberOfLines={2}
                              >
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
                  <Text
                    style={{ fontSize: 18, color: colors.textSecondary, fontWeight: '500' }}
                  >
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

      {/* Business Hours Overlay — must be last child to sit on top */}
      <BusinessHoursAlertModal
        visible={showBusinessHoursAlert}
        onDismiss={() => setShowBusinessHoursAlert(false)}
        language={language}
      />
    </Modal>
    </>
  );
}
