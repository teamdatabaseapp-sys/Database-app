/**
 * StaffCalendarScreen — Roster View Only
 *
 * All Staff Roster — scrollable roster list (name, hours, daily breakdown)
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Share,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Share2,
  Clock,
  Check,
  Trash2,
  FileText,
  FileSpreadsheet,
  Printer,
  Wand2,
  Users,
  Plus,
  Eye,
  Pencil,
} from 'lucide-react-native';
import { StaffProfileModal } from '@/components/StaffProfileModal';
import ReAnimated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { format, addDays, addWeeks, subWeeks, isSameDay, startOfMonth, addMonths, subMonths } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { Language } from '@/lib/i18n/types';
import { t } from '@/lib/i18n';
import { useBusiness } from '@/hooks/useBusiness';
import { useStore } from '@/lib/store';
import { getNowInBusinessTz, getDayOfWeekMonZero, formatDateISO as formatDateISOTz } from '@/lib/businessTimezone';
import { useStores, useStoreOverrides } from '@/hooks/useStores';
import type { SupabaseStore, StoreHoursOverride } from '@/services/storesService';
import {
  useStaffCalendarShifts,
  useStaffCalendarMonthShifts,
  useUpsertStaffCalendarShifts,
  useDeleteStaffCalendarShift,
  useApplyDefaultSchedule,
} from '@/hooks/useStaffCalendar';
import { useStaffForStore } from '@/hooks/useStaff';
import type { StaffMemberWithAssignments } from '@/services/staffService';
import {
  getWeekStart,
  formatTime,
  formatDateISO,
  getCalendarSummary,
  formatSummaryAsText,
  getStaffCalendarShifts,
  type StaffCalendarShift,
  type StaffCalendarData,
  type StaffForCalendar,
  type ShiftInput,
} from '@/services/staffCalendarService';
import { useBusinessTimeOff } from '@/hooks/useStaffTimeOff';
import { isDateTimeOff } from '@/services/staffTimeOffService';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

type WeekRange = 1 | 2 | 3 | 'month';

const DAY_NAMES_FULL = (lang: Language) => [
  t('mondayFull', lang), t('tuesdayFull', lang), t('wednesdayFull', lang),
  t('thursdayFull', lang), t('fridayFull', lang), t('saturdayFull', lang), t('sundayFull', lang),
];
const WEEK_RANGE_OPTIONS = (lang: Language): { value: WeekRange; label: string }[] => [
  { value: 1, label: t('thisWeek', lang) },
  { value: 2, label: t('twoWeeks', lang) },
  { value: 3, label: t('threeWeeks', lang) },
  { value: 'month', label: t('thisMonthOption', lang) },
];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DayHoursStatus {
  isClosed: boolean;
  isSpecialHours: boolean;
  openTime: string | null;
  closeTime: string | null;
  note?: string | null;
}

interface StaffCalendarScreenProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
  embedded?: boolean;
}

// ─────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────

const toMins = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

// Locale-aware short date with capitalized day + month
function formatShiftDateShort(date: Date, lang: Language): string {
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : lang === 'ko' ? 'ko-KR' : lang === 'ru' ? 'ru-RU' : lang;
  const raw = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  return raw.replace(/(^\w|\s\w|,\s*\w)/g, (m) => m.toUpperCase());
}

// Locale-aware short weekday names (Mon–Sun order), capitalized
function getShortWeekdays(lang: Language): string[] {
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : lang === 'ko' ? 'ko-KR' : lang === 'ru' ? 'ru-RU' : lang;
  return Array.from({ length: 7 }, (_, i) => {
    // 2024-01-01 was a Monday
    const date = new Date(2024, 0, 1 + i);
    const raw = date.toLocaleDateString(locale, { weekday: 'short' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  });
}

// ─────────────────────────────────────────────
// ShiftProgressBar — segmented + real-time
// ─────────────────────────────────────────────
function ShiftProgressBar({
  shiftStart,
  shiftEnd,
  breakStart,
  breakEnd,
  primaryColor,
  language,
  businessNowMinutes,
  tzLoaded,
}: {
  shiftStart: string;
  shiftEnd: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  primaryColor: string;
  language: Language;
  businessNowMinutes?: number;
  // Hard gate: only show live status labels when business timezone is confirmed loaded
  tzLoaded: boolean;
}) {
  const startM = toMins(shiftStart);
  const endM = toMins(shiftEnd);
  const shiftDuration = Math.max(1, endM - startM);
  const bsM = breakStart ? toMins(breakStart) : null;
  const beM = breakEnd ? toMins(breakEnd) : null;
  const hasBreak = bsM !== null && beM !== null && beM > bsM;

  const getStatus = (nowM: number): 'before' | 'working' | 'on_break' | 'done' => {
    if (nowM < startM) return 'before';
    if (nowM >= endM) return 'done';
    if (hasBreak && bsM !== null && beM !== null && nowM >= bsM && nowM < beM) return 'on_break';
    return 'working';
  };

  // businessNowMinutes is always provided (parent passes it for today rows).
  // We keep a device fallback only so the bar fill animates on non-today rows,
  // but we NEVER show the "Working Now" text label without tzLoaded.
  const getDeviceNowMins = () => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  };
  const [deviceNowM, setDeviceNowM] = React.useState(getDeviceNowMins);
  React.useEffect(() => {
    if (businessNowMinutes !== undefined) return;
    const id = setInterval(() => setDeviceNowM(getDeviceNowMins()), 30_000);
    return () => clearInterval(id);
  }, [businessNowMinutes]);

  const nowM = businessNowMinutes !== undefined ? businessNowMinutes : deviceNowM;
  const status = getStatus(nowM);

  // Compute filled % of the bar (0–1)
  const filledFraction = status === 'before' ? 0
    : status === 'done' ? 1
    : Math.min(1, (nowM - startM) / shiftDuration);

  // Compute break segment as a fraction of bar width
  const breakStartFrac = hasBreak && bsM !== null ? (bsM - startM) / shiftDuration : 0;
  const breakEndFrac = hasBreak && beM !== null ? (beM - startM) / shiftDuration : 0;

  // Only show live status label when business timezone is confirmed loaded
  const showStatus = tzLoaded && (status === 'working' || status === 'on_break');

  return (
    <View style={{ flex: 1, marginHorizontal: 8 }}>
      {/* Bar */}
      <View style={{ height: 5, borderRadius: 3, backgroundColor: `${primaryColor}15`, overflow: 'hidden', position: 'relative' }}>
        {/* Filled (worked) segment */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.min(filledFraction * 100, 100)}%`,
            backgroundColor: primaryColor,
            borderRadius: 3,
          }}
        />
        {/* Break overlay segment */}
        {hasBreak && (
          <View
            style={{
              position: 'absolute',
              left: `${breakStartFrac * 100}%`,
              top: 0,
              bottom: 0,
              width: `${(breakEndFrac - breakStartFrac) * 100}%`,
              backgroundColor: `${primaryColor}55`,
              borderRadius: 0,
            }}
          />
        )}
      </View>
      {/* Status label */}
      {showStatus && (
        <Text style={{ fontSize: 9, fontWeight: '600', color: status === 'on_break' ? `${primaryColor}aa` : primaryColor, marginTop: 2 }}>
          {status === 'on_break' ? t('onBreak', language) : t('workingNow', language)}
        </Text>
      )}
    </View>
  );
}

const getStoreHoursForDate = (
  date: Date,
  store: SupabaseStore | undefined,
  overrides: StoreHoursOverride[],
): DayHoursStatus => {
  if (!store) return { isClosed: true, isSpecialHours: false, openTime: null, closeTime: null };
  const dateStr = format(date, 'yyyy-MM-dd');
  const override = overrides.find(o => dateStr >= o.start_date && dateStr <= o.end_date);
  if (override) return { isClosed: override.is_closed, isSpecialHours: true, openTime: override.open_time, closeTime: override.close_time, note: override.note };
  if (store.blackout_dates?.includes(dateStr)) return { isClosed: true, isSpecialHours: false, openTime: null, closeTime: null };
  const dow = date.getDay();
  const wh = store.hours?.find(h => h.day_of_week === dow);
  if (!wh || wh.is_closed) return { isClosed: true, isSpecialHours: false, openTime: null, closeTime: null };
  return { isClosed: false, isSpecialHours: false, openTime: wh.open_time, closeTime: wh.close_time };
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function StaffCalendarScreen({ visible, onClose, language, embedded = false }: StaffCalendarScreenProps) {
  console.log('[StaffCalendarScreen] STAFF CALENDAR SCREEN LOADED');
  const { colors, primaryColor, isDark } = useTheme();
  const { showSuccess } = useToast();
  const { businessId } = useBusiness();
  const storesQuery = useStores();
  // Stable reference: prevents new [] on every pre-data render, which was causing
  // useEffect([stores, selectedStoreId]) to fire on every render before data loaded.
  const stores = useMemo(() => storesQuery.data ?? [], [storesQuery.data]);
  const storesLoading = storesQuery.isLoading;

  // Business timezone — authoritative source for "today" and "now"
  // This MUST be a real IANA string before any schedule calculations run.
  const businessTimezone = useStore((s) => s.user?.businessTimezone);

  // Refresh tzNow every minute so all time-dependent labels stay live
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((prev) => prev + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Re-derive on every tick AND on businessTimezone change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tzNow = React.useMemo(() => getNowInBusinessTz(businessTimezone), [businessTimezone, tick]);
  const todayISO = React.useMemo(() => formatDateISOTz(tzNow), [tzNow]);
  const businessNowMinutes = React.useMemo(
    () => tzNow.getHours() * 60 + tzNow.getMinutes(),
    [tzNow],
  );

  // Debug log — confirms timezone is applied correctly at runtime
  React.useEffect(() => {
    const dow = getDayOfWeekMonZero(tzNow);
    console.log('[StaffCalendar][TZ] businessTimezone:', businessTimezone);
    console.log('[StaffCalendar][TZ] tzNow:', tzNow.toString());
    console.log('[StaffCalendar][TZ] todayISO:', todayISO);
    console.log('[StaffCalendar][TZ] weekday (0=Mon):', dow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessTimezone, todayISO]);

  // ── Core state ──
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(undefined);
  // Initialize week/month from business TZ; will be corrected by the effect below once tz loads
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [weekRange, setWeekRange] = useState<WeekRange>(1);
  const isMonthMode = weekRange === 'month';

  // Correct currentWeekStart / currentMonth whenever businessTimezone changes so the
  // initial view always reflects the business's "today", not the device's "today".
  // Uses functional updaters with ISO-string comparison so the state setter bails out
  // (returns the same reference) when the week/month hasn't actually changed.
  // This prevents the spurious extra re-render that occurred on every mount when
  // businessTimezone was already loaded and the week was already correct.
  React.useEffect(() => {
    const newStart = getWeekStart(tzNow);
    const newStartISO = formatDateISO(newStart);
    setCurrentWeekStart(prev => formatDateISO(prev) === newStartISO ? prev : newStart);
    const newMonth = startOfMonth(tzNow);
    setCurrentMonth(prev =>
      prev.getFullYear() === newMonth.getFullYear() && prev.getMonth() === newMonth.getMonth()
        ? prev
        : newMonth
    );
  // Only run when businessTimezone changes (tzNow is intentionally captured via closure)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessTimezone]);

  // Dropdowns
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showWeekRangeDropdown, setShowWeekRangeDropdown] = useState(false);

  // Share/Export
  const [showShareModal, setShowShareModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'image' | 'csv' | 'print' | null>(null);

  // Smart Export state
  const [exportScope, setExportScope] = useState<'store' | 'staff'>('store');
  const [exportStoreId, setExportStoreId] = useState<string | undefined>(undefined);
  const [exportStaffId, setExportStaffId] = useState<string | undefined>(undefined);
  const [exportFromDate, setExportFromDate] = useState<Date>(() => getWeekStart(new Date()));
  const [exportToDate, setExportToDate] = useState<Date>(() => addDays(getWeekStart(new Date()), 6));
  const [showExportStoreDropdown, setShowExportStoreDropdown] = useState(false);
  const [showExportStaffDropdown, setShowExportStaffDropdown] = useState(false);
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [customFromDateText, setCustomFromDateText] = useState('');
  const [customToDateText, setCustomToDateText] = useState('');

  // Auto-schedule
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  const [autoScheduleStaffIds, setAutoScheduleStaffIds] = useState<string[]>([]);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);

  // Staff profile
  const [profileStaff, setProfileStaff] = useState<StaffForCalendar | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Shift editor
  const [showShiftEditor, setShowShiftEditor] = useState(false);
  const [editingShift, setEditingShift] = useState<StaffCalendarShift | null>(null);
  const [shiftStaffId, setShiftStaffId] = useState<string>('');
  const [shiftDayOfWeek, setShiftDayOfWeek] = useState<number>(0);
  const [shiftStartTime, setShiftStartTime] = useState('09:00');
  const [shiftEndTime, setShiftEndTime] = useState('17:00');
  const [breakStartTime, setBreakStartTime] = useState('');
  const [breakEndTime, setBreakEndTime] = useState('');

  // ── Auto-select first store ──
  React.useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      const active = stores.filter(s => !s.is_archived);
      if (active.length > 0) setSelectedStoreId(active[0].id);
    }
  }, [stores, selectedStoreId]);

  // ── Reset shift editor on store change ──
  React.useEffect(() => {
    setShiftStaffId('');
    console.log('[StaffCalendar] Store changed to:', selectedStoreId);
  }, [selectedStoreId]);

  // ── Data queries ──
  const { data: calendarData, isLoading: shiftsLoading, refetch: refetchShifts } =
    useStaffCalendarShifts(businessId ?? undefined, selectedStoreId, currentWeekStart);
  const {
    allShifts: monthShifts,
    staff: monthStaff,
    isLoading: monthLoading,
    monthStart,
    monthEnd,
    refetch: refetchMonth,
  } = useStaffCalendarMonthShifts(businessId ?? undefined, selectedStoreId, currentMonth);
  const { data: storeOverrides = [] } = useStoreOverrides(selectedStoreId ?? null);

  // ── Time off data for the visible week/month ──
  const weekStartISO = formatDateISO(currentWeekStart);
  const weekEndISO = formatDateISO(addDays(currentWeekStart, 6));
  const { data: businessTimeOff = [] } = useBusinessTimeOff(
    businessId ?? undefined,
    isMonthMode ? formatDateISO(monthStart) : weekStartISO,
    isMonthMode ? formatDateISO(monthEnd) : weekEndISO,
  );

  React.useEffect(() => {
    // Only force-refetch when visible becomes true and there is no cached data yet.
    // React Query handles background refresh via staleTime; forcing a refetch on
    // every modal open causes the 2-3s spinner because the data is re-fetched even
    // when it is still fresh in the cache.
    if (visible && businessId && selectedStoreId && !calendarData) {
      refetchShifts();
      refetchMonth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const upsertShiftsMutation = useUpsertStaffCalendarShifts();
  const deleteShiftMutation = useDeleteStaffCalendarShift();
  const applyDefaultsMutation = useApplyDefaultSchedule();

  // Use month data in month mode, week data otherwise
  const allShifts = isMonthMode ? monthShifts : (calendarData?.shifts || []);
  const staff = isMonthMode ? monthStaff : (calendarData?.staff || []);
  const activeStores = useMemo(() => stores.filter(s => !s.is_archived), [stores]);
  const selectedStore = useMemo(() => stores.find(s => s.id === selectedStoreId), [stores, selectedStoreId]);

  // ── Sorted staff list (alphabetical A–Z, locale-aware) ──
  const sortedStaff = useMemo(
    () => [...staff].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [staff],
  );

  // ── Export store staff (for the export modal store-filtered staff dropdown) ──
  const exportStoreIdResolved = exportStoreId ?? selectedStoreId ?? null;
  const { data: exportStoreStaffRaw = [] } = useStaffForStore(exportStoreIdResolved);
  const exportStoreStaff = useMemo(
    () => [...exportStoreStaffRaw]
      .filter(s => s.is_active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [exportStoreStaffRaw],
  );

  React.useEffect(() => {
    console.log('[StaffCalendar] Staff data updated:', {
      storeId: selectedStoreId,
      staffCount: staff.length,
      staffNames: staff.map(s => s.name),
    });
  }, [staff, selectedStoreId]);

  const weekDays = weekRange === 'month' ? 7 : weekRange * 7;

  const weekDates = useMemo(
    () => Array.from({ length: weekDays }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart, weekDays],
  );

  const dayHoursStatuses = useMemo(
    () => weekDates.map(d => getStoreHoursForDate(d, selectedStore, storeOverrides)),
    [weekDates, selectedStore, storeOverrides],
  );

  const currentStoreName = useMemo(
    () => activeStores.find(s => s.id === selectedStoreId)?.name || t('allStores', language),
    [activeStores, selectedStoreId, language],
  );

  // ── Date range label for staff card subtitle ──
  const dateRangeLabel = useMemo(() => {
    if (isMonthMode) {
      return format(monthStart, 'MMM d') + '–' + format(monthEnd, 'MMM d');
    }
    const rangeEnd = addDays(currentWeekStart, weekDays - 1);
    const fromStr = format(currentWeekStart, 'MMM d');
    const toStr = format(rangeEnd, 'MMM d');
    return `${fromStr}–${toStr}`;
  }, [isMonthMode, monthStart, monthEnd, currentWeekStart, weekDays]);

  // ── Navigation ──
  const handlePrevWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isMonthMode) setCurrentMonth(prev => subMonths(prev, 1));
    else setCurrentWeekStart(prev => subWeeks(prev, 1));
  }, [isMonthMode]);
  const handleNextWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isMonthMode) setCurrentMonth(prev => addMonths(prev, 1));
    else setCurrentWeekStart(prev => addWeeks(prev, 1));
  }, [isMonthMode]);

  // ── Add shift ──
  const isOpeningModal = React.useRef(false);
  const handleAddShift = useCallback((dayIndex: number, staffId?: string) => {
    if (isOpeningModal.current || showShiftEditor) return;
    isOpeningModal.current = true;
    setTimeout(() => { isOpeningModal.current = false; }, 500);

    const dayStatus = dayHoursStatuses[dayIndex];
    if (dayStatus?.isClosed) {
      isOpeningModal.current = false;
      Alert.alert(t('storeClosed', language), dayStatus.isSpecialHours ? t('storeClosedSpecialHours', language) : t('storeClosedOnDay', language), [{ text: 'OK' }]);
      return;
    }
    if (staff.length === 0) {
      isOpeningModal.current = false;
      Alert.alert(t('noStaffAvailable', language), t('noStaffAvailableMessage', language), [{ text: 'OK' }]);
      return;
    }

    setEditingShift(null);
    const pre = staffId && staff.some(s => s.id === staffId) ? staffId : staff[0].id;
    setShiftStaffId(pre);
    setShiftDayOfWeek(dayIndex % 7);
    setShiftStartTime(dayStatus?.openTime || '09:00');
    setShiftEndTime(dayStatus?.closeTime || '17:00');
    setBreakStartTime('');
    setBreakEndTime('');
    setShowShiftEditor(true);
  }, [staff, showShiftEditor, dayHoursStatuses]);

  const handleEditShift = useCallback((shift: StaffCalendarShift) => {
    setShowShiftEditor(true);
    setEditingShift(shift);
    setShiftStaffId(shift.staff_id);
    setShiftDayOfWeek(shift.day_of_week);
    setShiftStartTime(shift.shift_start.substring(0, 5));
    setShiftEndTime(shift.shift_end.substring(0, 5));
    setBreakStartTime(shift.break_start?.substring(0, 5) ?? '');
    setBreakEndTime(shift.break_end?.substring(0, 5) ?? '');
  }, []);

  const handleSaveShift = useCallback(async () => {
    if (!businessId || !selectedStoreId || !shiftStaffId) {
      Alert.alert(t('validationError', language), t('pleaseSelectStaffMember', language)); return;
    }
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(shiftStartTime)) { Alert.alert(t('validationError', language), t('pleaseEnterValidStartTime', language)); return; }
    if (!timeRegex.test(shiftEndTime)) { Alert.alert(t('validationError', language), t('pleaseEnterValidEndTime', language)); return; }
    const startM = toMins(shiftStartTime), endM = toMins(shiftEndTime);
    if (endM <= startM) { Alert.alert(t('validationError', language), t('endTimeMustBeAfterStartTime', language)); return; }

    const hasBreakStart = breakStartTime.trim() !== '';
    const hasBreakEnd = breakEndTime.trim() !== '';
    if (hasBreakStart !== hasBreakEnd) { Alert.alert(t('validationError', language), t('pleaseEnterBothBreakTimes', language)); return; }
    if (hasBreakStart && hasBreakEnd) {
      if (!timeRegex.test(breakStartTime) || !timeRegex.test(breakEndTime)) { Alert.alert(t('validationError', language), t('pleaseEnterValidBreakStartTime', language)); return; }
      const bsM = toMins(breakStartTime), beM = toMins(breakEndTime);
      if (beM <= bsM) { Alert.alert(t('validationError', language), t('breakEndMustBeAfterStart', language)); return; }
      if (bsM < startM || beM > endM) { Alert.alert(t('validationError', language), t('breakTimesMustBeWithinShift', language)); return; }
    }

    const conflict = allShifts.find(s =>
      s.staff_id === shiftStaffId && s.day_of_week === shiftDayOfWeek &&
      (!editingShift || s.id !== editingShift.id) &&
      startM < toMins(s.shift_end) && endM > toMins(s.shift_start)
    );
    if (conflict) {
      const name = staff.find(s => s.id === shiftStaffId)?.name ?? t('unknownStaff', language);
      Alert.alert(t('overlappingShift', language), `${name} ${t('overlappingShiftMessage', language)} ${formatTime(conflict.shift_start)} – ${formatTime(conflict.shift_end)}`);
      return;
    }

    try {
      await upsertShiftsMutation.mutateAsync({
        businessId, storeId: selectedStoreId, weekStartDate: currentWeekStart,
        shifts: [{ staff_id: shiftStaffId, day_of_week: shiftDayOfWeek, shift_start: shiftStartTime, shift_end: shiftEndTime, break_start: hasBreakStart ? breakStartTime : null, break_end: hasBreakEnd ? breakEndTime : null }],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(editingShift ? t('shiftUpdated', language) : t('shiftCreated', language));
      setShowShiftEditor(false);
      refetchShifts();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('error', language), t('failedToSaveShift', language));
    }
  }, [businessId, selectedStoreId, shiftStaffId, shiftDayOfWeek, shiftStartTime, shiftEndTime, breakStartTime, breakEndTime, currentWeekStart, editingShift, allShifts, staff, upsertShiftsMutation, showSuccess, refetchShifts]);

  const handleDeleteShift = useCallback(async () => {
    if (!editingShift || !businessId || !selectedStoreId) return;
    try {
      await deleteShiftMutation.mutateAsync({ shiftId: editingShift.id, businessId, storeId: selectedStoreId, weekStartDate: currentWeekStart });
      showSuccess(t('shiftDeleted', language));
      setShowShiftEditor(false);
      refetchShifts();
    } catch {
      Alert.alert(t('error', language), t('failedToDeleteShift', language));
    }
  }, [editingShift, businessId, selectedStoreId, currentWeekStart, deleteShiftMutation, showSuccess, refetchShifts, language]);

  // ── Apply defaults ──
  const handleApplyDefaults = useCallback(async (staffId: string) => {
    if (!businessId || !selectedStoreId) return;
    try {
      const result = await applyDefaultsMutation.mutateAsync({ businessId, storeId: selectedStoreId, staffId, weekStartDate: currentWeekStart });
      if (result.success) { showSuccess(t('toastDefaultScheduleApplied', language).replace('{count}', String(result.applied))); refetchShifts(); }
      else Alert.alert(t('error', language), result.error || t('failedToApplyDefaults', language));
    } catch { Alert.alert(t('error', language), t('failedToApplyDefaults', language)); }
  }, [businessId, selectedStoreId, currentWeekStart, applyDefaultsMutation, showSuccess, refetchShifts, language]);

  // ── Auto-schedule ──
  const handleAutoSchedule = useCallback(async () => {
    if (!businessId || !selectedStoreId || autoScheduleStaffIds.length === 0) {
      Alert.alert(t('selectionRequired', language), t('pleaseSelectAtLeastOneStaff', language)); return;
    }
    setIsAutoScheduling(true);
    try {
      const shiftsToCreate: ShiftInput[] = [];
      for (let di = 0; di < weekDates.length; di++) {
        const ds = dayHoursStatuses[di];
        if (ds.isClosed) continue;
        const open = ds.openTime || '09:00', close = ds.closeTime || '17:00';
        for (const sid of autoScheduleStaffIds) {
          const dow = di % 7;
          if (!allShifts.find(s => s.staff_id === sid && s.day_of_week === dow))
            shiftsToCreate.push({ staff_id: sid, day_of_week: dow, shift_start: open, shift_end: close, break_start: null, break_end: null });
        }
      }
      if (shiftsToCreate.length === 0) { Alert.alert(t('noShiftsCreated', language), t('noShiftsCreatedMessage', language)); return; }
      await upsertShiftsMutation.mutateAsync({ businessId, storeId: selectedStoreId, weekStartDate: currentWeekStart, shifts: shiftsToCreate });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(t('toastShiftsCreated', language).replace('{count}', String(shiftsToCreate.length)));
      setShowAutoScheduleModal(false);
      setAutoScheduleStaffIds([]);
      refetchShifts();
    } catch (err) {
      console.error('[StaffCalendar] Auto-schedule error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('error', language), t('failedToSaveShift', language));
    } finally { setIsAutoScheduling(false); }
  }, [businessId, selectedStoreId, autoScheduleStaffIds, weekDates, dayHoursStatuses, allShifts, currentWeekStart, upsertShiftsMutation, showSuccess, refetchShifts]);

  // ── Export helpers ──
  const generatePDFHTML = useCallback(() => {
    const weekRangeStr = `${format(currentWeekStart, 'MMM d')} – ${format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}`;
    const staffSchedules = staff.map(sm => ({ staff: sm, shifts: allShifts.filter(s => s.staff_id === sm.id).sort((a, b) => a.day_of_week - b.day_of_week) })).filter(s => s.shifts.length > 0);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;padding:40px;color:#1a1a1a}.header{margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #e5e5e5}.title{font-size:28px;font-weight:700;color:#111;margin-bottom:4px}.store{font-size:18px;color:#666;margin-bottom:8px}.week{font-size:16px;color:${primaryColor};font-weight:600}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#f8f9fa;padding:12px 16px;text-align:left;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#555;border-bottom:2px solid #e5e5e5}td{padding:14px 16px;border-bottom:1px solid #eee;vertical-align:top}tr:nth-child(even){background:#fafafa}.avatar{width:36px;height:36px;border-radius:18px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:14px;margin-right:10px}.footer{margin-top:30px;padding-top:20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}</style></head><body>
    <div class="header"><div class="title">Staff Schedule</div><div class="store">${currentStoreName}</div><div class="week">${weekRangeStr}</div></div>
    <table><thead><tr><th style="width:180px">Staff</th>${DAY_NAMES_FULL(language).map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>
    ${staffSchedules.map(({ staff: s, shifts: ss }) => `<tr><td><span class="avatar" style="background:${s.color || primaryColor}">${s.name.charAt(0)}</span>${s.name}</td>${DAY_NAMES_FULL(language).map((_, di) => { const sh = ss.find(x => x.day_of_week === di); return sh ? `<td style="border-left:3px solid ${s.color || primaryColor}">${formatTime(sh.shift_start)} – ${formatTime(sh.shift_end)}</td>` : '<td style="color:#ccc">—</td>'; }).join('')}</tr>`).join('')}
    </tbody></table>${staffSchedules.length === 0 ? '<p style="text-align:center;padding:40px;color:#999">No shifts this week</p>' : ''}
    <div class="footer">Generated ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</div></body></html>`;
  }, [currentWeekStart, staff, allShifts, primaryColor, currentStoreName]);

  const handleExportPDF = useCallback(async () => {
    if (!businessId || !selectedStoreId) return;
    setIsExporting(true); setExportType('pdf');
    try {
      const { uri } = await Print.printToFileAsync({ html: generatePDFHTML(), base64: false });
      const fn = `Staff-Schedule-${currentStoreName.replace(/\s+/g, '-')}-${format(currentWeekStart, 'MMM-d')}.pdf`;
      const dest = `${FileSystem.cacheDirectory}${fn}`;
      await FileSystem.moveAsync({ from: uri, to: dest });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      else Alert.alert(t('success', language), t('pdfSavedSuccess', language));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(t('toastPdfExported', language));
      setShowShareModal(false);
    } catch (e) { console.error(e); Alert.alert(t('exportFailed', language), t('exportFailedMessage', language)); }
    finally { setIsExporting(false); setExportType(null); }
  }, [businessId, selectedStoreId, generatePDFHTML, currentWeekStart, currentStoreName, showSuccess, language]);

  const handleExportCSV = useCallback(async () => {
    if (!businessId || !selectedStoreId) return;
    setIsExporting(true); setExportType('csv');
    try {
      const headers = ['Name', 'Email', ...DAY_NAMES_FULL(language)];
      const rows = staff.map(s => {
        const ss = allShifts.filter(sh => sh.staff_id === s.id);
        return [s.name, s.email || '', ...DAY_NAMES_FULL(language).map((_, di) => { const sh = ss.find(x => x.day_of_week === di); return sh ? `${formatTime(sh.shift_start)}-${formatTime(sh.shift_end)}` : ''; })];
      });
      const csv = [`Staff Schedule - ${currentStoreName}`, `Week: ${format(currentWeekStart, 'MMM d')} - ${format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}`, '', headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const fp = `${FileSystem.cacheDirectory}schedule.csv`;
      await FileSystem.writeAsStringAsync(fp, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fp, { mimeType: 'text/csv' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(t('toastCsvExported', language));
      setShowShareModal(false);
    } catch (e) { console.error(e); Alert.alert(t('exportFailed', language), t('exportFailedMessage', language)); }
    finally { setIsExporting(false); setExportType(null); }
  }, [businessId, selectedStoreId, staff, allShifts, currentWeekStart, currentStoreName, showSuccess, language]);

  const handlePrint = useCallback(async () => {
    if (!businessId || !selectedStoreId) return;
    setIsExporting(true); setExportType('print');
    try { await Print.printAsync({ html: generatePDFHTML() }); setShowShareModal(false); }
    catch (e) { console.error(e); Alert.alert(t('printFailed', language), t('printFailedMessage', language)); }
    finally { setIsExporting(false); setExportType(null); }
  }, [businessId, selectedStoreId, generatePDFHTML, language]);

  const handleShareText = useCallback(async () => {
    if (!businessId || !selectedStoreId) return;
    setIsExporting(true); setExportType('image');
    try {
      const summary = await getCalendarSummary(businessId, selectedStoreId, currentWeekStart, undefined);
      await Share.share({ message: formatSummaryAsText(summary), title: `Staff Schedule – ${format(currentWeekStart, 'MMM d')}` });
      setShowShareModal(false);
    } catch (e) { console.error(e); }
    finally { setIsExporting(false); setExportType(null); }
  }, [businessId, selectedStoreId, currentWeekStart]);

  // ── Smart Export ──
  const generateSmartPDFHTML = useCallback((exportShifts: StaffCalendarShift[], exportStaff: StaffForCalendar[]) => {
    const fromStr = format(exportFromDate, 'MMM d, yyyy');
    const toStr = format(exportToDate, 'MMM d, yyyy');
    const rangeStr = `${fromStr} – ${toStr}`;
    const targetStore = activeStores.find(s => s.id === exportStoreId);
    const storeName = targetStore?.name ?? currentStoreName;

    let bodyContent = '';

    if (exportScope === 'staff' && exportStaffId) {
      const targetStaff = exportStaff.find(s => s.id === exportStaffId) ?? staff.find(s => s.id === exportStaffId);
      const staffShifts = exportShifts.filter(sh => sh.staff_id === exportStaffId).sort((a, b) => {
        const aDate = new Date(a.week_start_date + 'T00:00:00').getTime() + a.day_of_week * 86400000;
        const bDate = new Date(b.week_start_date + 'T00:00:00').getTime() + b.day_of_week * 86400000;
        return aDate - bDate;
      });
      const name = targetStaff?.name ?? '';
      const initial = name.charAt(0).toUpperCase();
      const color = targetStaff?.color ?? primaryColor;
      bodyContent = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding:20px;background:#f8f9fa;border-radius:12px">
          <div style="width:52px;height:52px;border-radius:26px;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px;flex-shrink:0">${initial}</div>
          <div>
            <div style="font-size:20px;font-weight:700;color:#111">${name}</div>
            <div style="font-size:14px;color:#666;margin-top:2px">${storeName}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="background:#f8f9fa;padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:#555;border-bottom:2px solid #e5e5e5;text-transform:uppercase;letter-spacing:.5px">Date</th>
              <th style="background:#f8f9fa;padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:#555;border-bottom:2px solid #e5e5e5;text-transform:uppercase;letter-spacing:.5px">Hours</th>
              <th style="background:#f8f9fa;padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:#555;border-bottom:2px solid #e5e5e5;text-transform:uppercase;letter-spacing:.5px">Break</th>
            </tr>
          </thead>
          <tbody>
            ${staffShifts.length === 0 ? `<tr><td colspan="3" style="padding:20px;text-align:center;color:#999">No shifts in this period</td></tr>` : staffShifts.map((sh, i) => {
              const shiftDate = new Date(new Date(sh.week_start_date + 'T00:00:00').getTime() + sh.day_of_week * 86400000);
              const dayLabel = shiftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const breakStr = sh.break_start && sh.break_end ? `${formatTime(sh.break_start)} – ${formatTime(sh.break_end)}` : '—';
              return `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
                <td style="padding:12px 16px;border-bottom:1px solid #eee;font-weight:500">${dayLabel}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #eee;border-left:3px solid ${color}">${formatTime(sh.shift_start)} – ${formatTime(sh.shift_end)}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #eee;color:#888">${breakStr}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      // Store schedule — group by staff
      const scheduleByStaff = exportStaff.map(sm => ({
        staff: sm,
        shifts: exportShifts.filter(sh => sh.staff_id === sm.id).sort((a, b) => {
          const aDate = new Date(a.week_start_date + 'T00:00:00').getTime() + a.day_of_week * 86400000;
          const bDate = new Date(b.week_start_date + 'T00:00:00').getTime() + b.day_of_week * 86400000;
          return aDate - bDate;
        }),
      })).filter(s => s.shifts.length > 0);

      // If range spans just 1 week, show classic grid; otherwise show per-date list
      const diffDays = Math.ceil((exportToDate.getTime() - exportFromDate.getTime()) / 86400000) + 1;
      const isMultiWeek = diffDays > 7;

      if (!isMultiWeek) {
        // Single-week grid layout
        bodyContent = `
          <table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead>
              <tr>
                <th style="background:#f8f9fa;padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:#555;border-bottom:2px solid #e5e5e5;text-transform:uppercase;letter-spacing:.5px;min-width:140px">Staff</th>
                ${DAY_NAMES_FULL(language).map(d => `<th style="background:#f8f9fa;padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:#555;border-bottom:2px solid #e5e5e5;text-transform:uppercase;letter-spacing:.5px">${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${scheduleByStaff.length === 0 ? `<tr><td colspan="${1 + DAY_NAMES_FULL(language).length}" style="padding:40px;text-align:center;color:#999">No shifts scheduled</td></tr>` : scheduleByStaff.map(({ staff: s, shifts: ss }) => `
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #eee;vertical-align:middle">
                    <span style="display:inline-flex;width:32px;height:32px;border-radius:16px;background:${s.color || primaryColor};align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;margin-right:10px;vertical-align:middle">${s.name.charAt(0)}</span>
                    <span style="font-weight:500">${s.name}</span>
                  </td>
                  ${DAY_NAMES_FULL(language).map((_, di) => { const sh = ss.find(x => x.day_of_week === di); return sh ? `<td style="padding:12px 16px;border-bottom:1px solid #eee;border-left:3px solid ${s.color || primaryColor};font-size:12px">${formatTime(sh.shift_start)} – ${formatTime(sh.shift_end)}</td>` : '<td style="padding:12px 16px;border-bottom:1px solid #eee;color:#ccc">—</td>'; }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else {
        // Multi-week: per-staff sections with date rows
        bodyContent = scheduleByStaff.length === 0
          ? `<p style="text-align:center;padding:40px;color:#999">No shifts scheduled</p>`
          : scheduleByStaff.map(({ staff: s, shifts: ss }) => `
            <div style="margin-bottom:24px">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid ${s.color || primaryColor}">
                <span style="width:36px;height:36px;border-radius:18px;background:${s.color || primaryColor};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">${s.name.charAt(0)}</span>
                <span style="font-size:17px;font-weight:700;color:#111">${s.name}</span>
                <span style="font-size:13px;color:#888;margin-left:auto">${ss.length} ${(() => { const raw = ss.length === 1 ? (t('shiftSingular', language) || 'shift') : (t('shiftPlural', language) || 'shifts'); return raw.charAt(0).toUpperCase() + raw.slice(1); })()}</span>
              </div>
              <table style="width:100%;border-collapse:collapse">
                <thead><tr>
                  <th style="background:#f8f9fa;padding:10px 14px;text-align:left;font-weight:600;font-size:12px;color:#555;border-bottom:1px solid #e5e5e5">Date</th>
                  <th style="background:#f8f9fa;padding:10px 14px;text-align:left;font-weight:600;font-size:12px;color:#555;border-bottom:1px solid #e5e5e5">Hours</th>
                </tr></thead>
                <tbody>
                  ${ss.map((sh, i) => {
                    const shiftDate = new Date(new Date(sh.week_start_date + 'T00:00:00').getTime() + sh.day_of_week * 86400000);
                    const dayLabel = shiftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
                      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-size:13px;font-weight:500">${dayLabel}</td>
                      <td style="padding:10px 14px;border-bottom:1px solid #eee;border-left:3px solid ${s.color || primaryColor};font-size:13px">${formatTime(sh.shift_start)} – ${formatTime(sh.shift_end)}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `).join('');
      }
    }

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      * { margin:0; padding:0; box-sizing:border-box }
      body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; padding:40px; color:#1a1a1a; background:#fff }
      .header { margin-bottom:28px; padding-bottom:20px; border-bottom:2px solid ${primaryColor} }
      .title { font-size:26px; font-weight:700; color:#111; margin-bottom:4px }
      .meta { font-size:15px; color:#666; margin-bottom:4px }
      .range { font-size:15px; font-weight:600; color:${primaryColor} }
      .footer { margin-top:32px; padding-top:16px; border-top:1px solid #eee; font-size:11px; color:#aaa; text-align:center }
    </style></head><body>
      <div class="header">
        <div class="title">${t('shareSchedule', language)}</div>
        <div class="meta">${storeName}</div>
        <div class="range">${rangeStr}</div>
      </div>
      ${bodyContent}
      <div class="footer">${t('generatedOn', language)} ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</div>
    </body></html>`;
  }, [exportFromDate, exportToDate, exportScope, exportStoreId, exportStaffId, activeStores, currentStoreName, staff, primaryColor, language]);

  const handleSmartExport = useCallback(async () => {
    if (!businessId) return;
    const targetStoreId = exportStoreId ?? selectedStoreId;
    if (!targetStoreId) return;

    setIsExporting(true);
    setExportType('pdf');

    // Yield to the UI thread so the loading state renders before heavy work begins
    await new Promise<void>(resolve => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    const TIMEOUT_MS = 30_000;
    let didTimeout = false;
    const timeoutId = setTimeout(() => { didTimeout = true; }, TIMEOUT_MS);

    try {
      // Fetch shifts for ALL weeks that overlap the selected date range
      const weekStarts: Date[] = [];
      let cursor = getWeekStart(exportFromDate);
      while (cursor <= exportToDate) {
        weekStarts.push(new Date(cursor));
        cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      // Fetch each week's data using the typed service function
      const weekResults = await Promise.all(
        weekStarts.map(ws => getStaffCalendarShifts(businessId, targetStoreId, ws))
      );

      if (didTimeout) throw new Error('timeout');

      // Merge and filter to date range
      const fromISO = formatDateISO(exportFromDate);
      const toISO = formatDateISO(exportToDate);
      const exportShifts: StaffCalendarShift[] = weekResults.flatMap((d: StaffCalendarData) => {
        if (!d?.shifts) return [];
        return d.shifts.filter((sh: StaffCalendarShift) => {
          const weekDate = new Date(sh.week_start_date + 'T00:00:00');
          const shiftDate = new Date(weekDate.getTime() + sh.day_of_week * 86400000);
          const shiftISO = formatDateISO(shiftDate);
          return shiftISO >= fromISO && shiftISO <= toISO;
        });
      });

      // Use export store staff list (filtered + sorted for the selected export store)
      // Map StaffMemberWithAssignments to StaffForCalendar shape
      const exportStaff: StaffForCalendar[] = exportStoreStaff.length > 0
        ? exportStoreStaff.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
            photo_url: s.photo_url ?? s.avatar_url ?? null,
            color: s.color,
            is_active: s.is_active ?? true,
          }))
        : (weekResults[0]?.staff ?? []);

      const html = generateSmartPDFHTML(exportShifts, exportStaff);
      const storeName = activeStores.find(s => s.id === targetStoreId)?.name ?? currentStoreName;
      const staffMember = exportScope === 'staff' ? exportStoreStaff.find(s => s.id === exportStaffId) : null;
      const nameSlug = staffMember ? staffMember.name.replace(/\s+/g, '-') : storeName.replace(/\s+/g, '-');
      const fn = `Schedule-${nameSlug}-${format(exportFromDate, 'MMM-d')}.pdf`;
      const dest = `${FileSystem.cacheDirectory}${fn}`;

      if (didTimeout) throw new Error('timeout');

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await FileSystem.moveAsync({ from: uri, to: dest });

      if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dest, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        } else {
          Alert.alert(t('success', language), t('pdfSavedSuccess', language));
        }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(t('exportScheduleTitle', language) || 'Exported');
      setShowShareModal(false);
    } catch (e) {
      console.error('[SmartExport]', e);
      Alert.alert(t('exportFailed', language), t('exportFailedMessage', language));
    } finally {
      clearTimeout(timeoutId);
      setIsExporting(false);
      setExportType(null);
    }
  }, [businessId, selectedStoreId, exportStoreId, generateSmartPDFHTML, exportFromDate, exportToDate, exportStaffId, exportScope, currentStoreName, staff, showSuccess, language]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  const isLoading = storesLoading || (isMonthMode ? monthLoading : shiftsLoading);

  if (!visible && !embedded) return null;

  // ── Header ──
  const header = !embedded ? (
    <ReAnimated.View entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Calendar size={22} color={primaryColor} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{t('staffCalendar', language)}</Text>
      </View>
      <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.text}10`, alignItems: 'center', justifyContent: 'center' }}>
        <X size={20} color={colors.textSecondary} />
      </Pressable>
    </ReAnimated.View>
  ) : null;

  // ── Store + Week Range row ──
  const controlsRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {activeStores.length > 1 && (
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowStoreDropdown(p => !p); setShowWeekRangeDropdown(false); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text }} numberOfLines={1}>{currentStoreName}</Text>
            <ChevronDown size={14} color={colors.textSecondary} />
          </Pressable>
          {showStoreDropdown && (
            <View style={{ position: 'absolute', top: 42, left: 0, right: 0, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, zIndex: 200, elevation: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 }}>
              {activeStores.map((store, i) => (
                <Pressable key={store.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedStoreId(store.id); setShowStoreDropdown(false); }} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: i < activeStores.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: selectedStoreId === store.id ? `${primaryColor}10` : 'transparent' }}>
                  <Text style={{ fontSize: 14, color: selectedStoreId === store.id ? primaryColor : colors.text, fontWeight: selectedStoreId === store.id ? '600' : '400' }}>{store.name}</Text>
                  {selectedStoreId === store.id && <Check size={14} color={primaryColor} strokeWidth={3} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      <View>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowWeekRangeDropdown(p => !p); setShowStoreDropdown(false); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginRight: 4 }}>{WEEK_RANGE_OPTIONS(language).find(o => o.value === weekRange)?.label ?? t('thisWeek', language)}</Text>
          <ChevronDown size={14} color={colors.textSecondary} />
        </Pressable>
        {showWeekRangeDropdown && (
          <View style={{ position: 'absolute', top: 42, right: 0, minWidth: 140, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, zIndex: 200, elevation: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 }}>
            {WEEK_RANGE_OPTIONS(language).map((opt, i) => (
              <Pressable key={opt.value} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWeekRange(opt.value); setShowWeekRangeDropdown(false); }} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: i < WEEK_RANGE_OPTIONS(language).length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: weekRange === opt.value ? `${primaryColor}10` : 'transparent' }}>
                <Text style={{ fontSize: 14, color: weekRange === opt.value ? primaryColor : colors.text, fontWeight: weekRange === opt.value ? '600' : '400' }}>{opt.label}</Text>
                {weekRange === opt.value && <Check size={14} color={primaryColor} strokeWidth={3} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  // ── Week navigator ──
  const weekNav = (
    <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {/* Row 1: week navigation with Share on the right */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6 }}>
        <Pressable onPress={handlePrevWeek} hitSlop={12} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>

        <Pressable
          onPress={() => { if (isMonthMode) setCurrentMonth(startOfMonth(tzNow)); else setCurrentWeekStart(getWeekStart(tzNow)); }}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
        >
          {isMonthMode ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {format(currentMonth, 'MMMM yyyy')}
              </Text>
              {currentMonth.getFullYear() === tzNow.getFullYear() && currentMonth.getMonth() === tzNow.getMonth() && (
                <Text style={{ fontSize: 11, color: primaryColor, marginTop: 2 }}>Current month</Text>
              )}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {format(currentWeekStart, 'MMM d')} – {format(addDays(currentWeekStart, weekDays - 1), 'MMM d, yyyy')}
              </Text>
              {isSameDay(getWeekStart(tzNow), currentWeekStart) && (
                <Text style={{ fontSize: 11, color: primaryColor, marginTop: 2 }}>{t('currentWeekLabel', language)}</Text>
              )}
            </>
          )}
        </Pressable>

        <Pressable onPress={handleNextWeek} hitSlop={12} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Row 2: action toolbar — Auto | spacer | Share */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 8 }}>
        {/* Auto */}
        <Pressable
          onPress={() => {
            if (staff.length === 0) { Alert.alert(t('noStaff', language), t('noStaffMessage', language)); return; }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAutoScheduleModal(true);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: primaryColor, minHeight: 36 }}
          hitSlop={4}
        >
          <Wand2 size={14} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{t('autoButton', language)}</Text>
        </Pressable>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Share — right-aligned, pill style */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExportScope('store');
            setExportStoreId(selectedStoreId);
            setExportStaffId(undefined);
            setShowExportStoreDropdown(false);
            setShowExportStaffDropdown(false);
            if (isMonthMode) {
              setExportFromDate(currentMonth);
              setExportToDate(addDays(addMonths(currentMonth, 1), -1));
            } else {
              setExportFromDate(currentWeekStart);
              setExportToDate(addDays(currentWeekStart, weekDays - 1));
            }
            setShowShareModal(true);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: primaryColor, minHeight: 36 }}
          hitSlop={4}
        >
          <Share2 size={14} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{t('exportButtonLabel', language) || 'Export'}</Text>
        </Pressable>
      </View>
    </View>
  );

  // ── Toolbar (now merged into weekNav above) ──
  const toolbar = null;

  // ── All staff roster view ──
  const rosterView = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* Summary bar */}
      <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row', gap: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('summaryStaff', language)}</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 }}>{staff.length}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('summaryShifts', language)}</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 }}>{allShifts.length}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('summaryTotalHrs', language)}</Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: primaryColor, marginTop: 2 }}>
            {(() => {
              const total = allShifts.reduce((acc, s) => acc + (toMins(s.shift_end) - toMins(s.shift_start)) / 60, 0);
              return total % 1 === 0 ? `${total}` : total.toFixed(1);
            })()}
          </Text>
        </View>
      </View>

      {staff.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <Users size={48} color={`${colors.textTertiary}60`} />
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12 }}>{t('noStaffAssignedToStoreEmpty', language)}</Text>
        </View>
      )}

      {sortedStaff.map(member => {
        const memberShifts = allShifts.filter(s => s.staff_id === member.id);
        const totalH = memberShifts.reduce((acc, s) => acc + (toMins(s.shift_end) - toMins(s.shift_start)) / 60, 0);
        const totalHStr = totalH % 1 === 0 ? `${totalH}h` : `${totalH.toFixed(1)}h`;
        const hasShifts = memberShifts.length > 0;

        return (
          <View
            key={member.id}
            style={{ backgroundColor: colors.card, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}
          >
            {/* Card header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: hasShifts ? 1 : 0, borderBottomColor: colors.border }}>
              {/* Clickable left section: Avatar + Name + Subtitle + Eye icon */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setProfileStaff(member);
                  setShowProfileModal(true);
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                hitSlop={4}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: member.color || primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  {member.photo_url ? (
                    <Image source={{ uri: member.photo_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{member.name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{member.name}</Text>
                    <Eye size={13} color={colors.textTertiary} strokeWidth={2} />
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {dateRangeLabel}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {(() => {
                      const rawWord = memberShifts.length === 1 ? t('shiftSingular', language) : t('shiftPlural', language);
                      const word = rawWord ? rawWord.charAt(0).toUpperCase() + rawWord.slice(1) : (memberShifts.length === 1 ? 'Shift' : 'Shifts');
                      return `${memberShifts.length} ${word}`;
                    })()}
                  </Text>
                </View>
              </Pressable>
              {hasShifts && (
                <View style={{ backgroundColor: `${primaryColor}15`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: primaryColor }}>{totalHStr}</Text>
                </View>
              )}
              {/* Edit button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setProfileStaff(member);
                  setShowProfileModal(true);
                }}
                style={{ alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)', marginRight: 6 }}
                hitSlop={6}
              >
                <Pencil size={14} color={colors.textSecondary} strokeWidth={2} />
              </Pressable>
              {/* Add shift button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Use business timezone for today's day-of-week
                  const dow = getDayOfWeekMonZero(tzNow);
                  handleAddShift(dow, member.id);
                }}
                style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)', alignItems: 'center', justifyContent: 'center' }}
                hitSlop={6}
              >
                <Plus size={15} color={colors.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>

            {/* Daily breakdown */}
            {hasShifts && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 4 }}>
                {isMonthMode ? (
                  // Month mode: one row per actual shift date, sorted by date
                  (() => {
                    const rows = memberShifts.map(sh => {
                      const weekDate = new Date(sh.week_start_date + 'T00:00:00');
                      const shiftDate = new Date(weekDate.getTime() + sh.day_of_week * 24 * 60 * 60 * 1000);
                      return { sh, shiftDate };
                    }).sort((a, b) => a.shiftDate.getTime() - b.shiftDate.getTime());
                    return rows.map(({ sh, shiftDate }) => {
                      const shiftDateISO = formatDateISO(shiftDate);
                      const isToday = shiftDateISO === todayISO;
                      return (
                        <View key={sh.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ flexShrink: 0, marginRight: 4, fontSize: 12, fontWeight: isToday ? '700' : '500', color: isToday ? primaryColor : colors.textSecondary }}>
                            {formatShiftDateShort(shiftDate, language)}
                          </Text>
                          <ShiftProgressBar
                            shiftStart={sh.shift_start}
                            shiftEnd={sh.shift_end}
                            breakStart={sh.break_start}
                            breakEnd={sh.break_end}
                            primaryColor={primaryColor}
                            language={language}
                            businessNowMinutes={isToday ? businessNowMinutes : undefined}
                            tzLoaded={!!businessTimezone}
                          />
                          <View style={{ width: 72, alignItems: 'flex-end', gap: 1 }}>
                            {[sh.shift_start, sh.shift_end].map((timeVal, ti) => {
                              const full = formatTime(timeVal);
                              const spaceIdx = full.lastIndexOf(' ');
                              const hhmm = full.slice(0, spaceIdx);
                              const period = full.slice(spaceIdx + 1);
                              return (
                                <View key={ti} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: isToday ? primaryColor : colors.text, lineHeight: 15 }}>{hhmm}</Text>
                                  <Text style={{ fontSize: 9, fontWeight: '500', color: isToday ? primaryColor : colors.textSecondary, marginLeft: 2, lineHeight: 15 }}>{period}</Text>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    });
                  })()
                ) : (
                  // Week mode: one slot per day-of-week
                  getShortWeekdays(language).map((shortDay, di) => {
                    const sh = memberShifts.find(s => s.day_of_week === di);
                    const date = weekDates[di];
                    // Use business timezone for today detection
                    const dateISO = date ? formatDateISO(date) : '';
                    const isToday = dateISO === todayISO;
                    const hasTimeOff = dateISO ? isDateTimeOff(businessTimeOff, member.id, dateISO) : false;

                    if (!sh) {
                      if (!hasTimeOff) return null;
                      // Show "Off" pill when time off exists but no shift
                      return (
                        <View key={di} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ flexShrink: 0, marginRight: 4, fontSize: 12, fontWeight: isToday ? '700' : '500', color: isToday ? primaryColor : colors.textSecondary }}>
                            {shortDay}
                          </Text>
                          <View style={{ marginLeft: 8 }}>
                            <View style={{ backgroundColor: `${colors.error}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.error }}>{t('offLabel', language)}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    }

                    return (
                      <View key={di} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ flexShrink: 0, marginRight: 4, fontSize: 12, fontWeight: isToday ? '700' : '500', color: isToday ? primaryColor : colors.textSecondary }}>
                          {shortDay}
                        </Text>
                        <ShiftProgressBar
                          shiftStart={sh.shift_start}
                          shiftEnd={sh.shift_end}
                          breakStart={sh.break_start}
                          breakEnd={sh.break_end}
                          primaryColor={primaryColor}
                          language={language}
                          businessNowMinutes={isToday ? businessNowMinutes : undefined}
                          tzLoaded={!!businessTimezone}
                        />
                        <View style={{ width: 72, alignItems: 'flex-end', gap: 1 }}>
                          {[sh.shift_start, sh.shift_end].map((timeVal, ti) => {
                            const full = formatTime(timeVal);
                            const spaceIdx = full.lastIndexOf(' ');
                            const hhmm = full.slice(0, spaceIdx);
                            const period = full.slice(spaceIdx + 1);
                            return (
                              <View key={ti} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: isToday ? primaryColor : colors.text, lineHeight: 15 }}>{hhmm}</Text>
                                <Text style={{ fontSize: 9, fontWeight: '500', color: isToday ? primaryColor : colors.textSecondary, marginLeft: 2, lineHeight: 15 }}>{period}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {!hasShifts && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                  {isMonthMode ? t('noShiftsThisMonth', language) : t('noShiftsThisWeek', language)}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );

  // ─── Modals ───────────────────────────────────

  // Shift editor modal
  const shiftEditorModal = (
    <Modal visible={showShiftEditor} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { Keyboard.dismiss(); setShowShiftEditor(false); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => { Keyboard.dismiss(); setShowShiftEditor(false); }} />
          <View style={{ width: '92%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', maxHeight: '88%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Clock size={18} color={primaryColor} />
                </View>
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{editingShift ? t('editShift', language) : t('newShift', language)}</Text>
              </View>
              <Pressable onPress={() => { Keyboard.dismiss(); setShowShiftEditor(false); }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {/* Staff selector */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('staffMemberRequired', language)}</Text>
                {staff.length === 0 ? (
                  <View style={{ backgroundColor: '#FEF3C7', padding: 14, borderRadius: 12 }}>
                    <Text style={{ fontSize: 13, color: '#92400E' }}>{t('noStaffMembersAssignedTo', language)} {currentStoreName}. {t('assignStaffInSettingsHint', language)}</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {staff.map(s => {
                      const sel = shiftStaffId === s.id;
                      return (
                        <Pressable key={s.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShiftStaffId(s.id); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: sel ? primaryColor : colors.background, borderWidth: 2, borderColor: sel ? primaryColor : 'transparent' }}>
                          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: sel ? 'rgba(255,255,255,0.3)' : primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 7 }}>
                            {s.photo_url ? <Image source={{ uri: s.photo_url }} style={{ width: 26, height: 26, borderRadius: 13 }} /> : <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{s.name.charAt(0).toUpperCase()}</Text>}
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: sel ? '#fff' : colors.text }}>{s.name.split(' ')[0]}</Text>
                          {sel && <Check size={13} color="#fff" strokeWidth={3} style={{ marginLeft: 5 }} />}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Day selector */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('dayOfWeekRequired', language)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DAY_NAMES_FULL(language).map((day, idx) => {
                    const sel = shiftDayOfWeek === idx;
                    return (
                      <Pressable key={idx} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShiftDayOfWeek(idx); }} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: sel ? primaryColor : colors.background, alignItems: 'center', minWidth: 46 }}>
                        <Text style={{ fontSize: 11, fontWeight: '500', color: sel ? '#fff' : colors.textSecondary }}>{day.slice(0, 3)}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: sel ? '#fff' : colors.text, marginTop: 2 }}>{format(weekDates[idx], 'd')}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Time inputs */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('shiftHoursRequired', language)}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    { label: t('shiftStartLabel', language), value: shiftStartTime, setter: setShiftStartTime, ph: '09:00' },
                    { label: t('shiftEndLabel', language), value: shiftEndTime, setter: setShiftEndTime, ph: '17:00' },
                  ].map(({ label, value, setter, ph }) => (
                    <View key={label} style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>{label}</Text>
                      <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                        <TextInput
                          value={value}
                          onChangeText={text => {
                            const c = text.replace(/[^0-9:]/g, '');
                            setter(c.length === 2 && !c.includes(':') && value.length < c.length ? c + ':' : c.slice(0, 5));
                          }}
                          placeholder={ph}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={{ padding: 14, fontSize: 18, fontWeight: '500', color: colors.text, textAlign: 'center' }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8, textAlign: 'center' }}>{t('use24HourFormatHint', language)}</Text>
              </View>

              {/* Break inputs */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('lunchBreakOptional', language)}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    { label: t('breakStartLabel', language), value: breakStartTime, setter: setBreakStartTime, ph: '13:00' },
                    { label: t('breakEndLabel', language), value: breakEndTime, setter: setBreakEndTime, ph: '14:00' },
                  ].map(({ label, value, setter, ph }) => (
                    <View key={label} style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>{label}</Text>
                      <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                        <TextInput
                          value={value}
                          onChangeText={text => {
                            const c = text.replace(/[^0-9:]/g, '');
                            setter(c.length === 2 && !c.includes(':') && value.length < c.length ? c + ':' : c.slice(0, 5));
                          }}
                          placeholder={ph}
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={{ padding: 14, fontSize: 18, fontWeight: '500', color: colors.text, textAlign: 'center' }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Footer actions */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              {editingShift && (
                <Pressable onPress={() => Alert.alert(t('deleteConfirmation', language), t('deleteConfirmMessage', language), [{ text: t('cancel', language), style: 'cancel' }, { text: t('delete', language), style: 'destructive', onPress: handleDeleteShift }])} disabled={deleteShiftMutation.isPending} style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                  {deleteShiftMutation.isPending ? <ActivityIndicator size="small" color="#EF4444" /> : <Trash2 size={22} color="#EF4444" />}
                </Pressable>
              )}
              <Pressable onPress={handleSaveShift} disabled={upsertShiftsMutation.isPending || !shiftStaffId} style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: !shiftStaffId ? colors.textTertiary : primaryColor, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: upsertShiftsMutation.isPending ? 0.7 : 1 }}>
                {upsertShiftsMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <><Check size={20} color="#fff" strokeWidth={2.5} /><Text style={{ fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 }}>{editingShift ? t('updateShift', language) : t('createShift', language)}</Text></>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  // Auto-schedule modal
  const autoScheduleModal = (
    <Modal visible={showAutoScheduleModal} transparent animationType="fade" onRequestClose={() => setShowAutoScheduleModal(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '90%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Wand2 size={18} color={primaryColor} /></View>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{t('autoSchedule', language)}</Text>
            </View>
            <Pressable onPress={() => setShowAutoScheduleModal(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={colors.textSecondary} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ padding: 20 }}>
            <View style={{ backgroundColor: `${primaryColor}10`, padding: 14, borderRadius: 12, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>Auto-create shifts based on store hours. Existing shifts won't be overwritten.</Text>
            </View>
            <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{format(currentWeekStart, 'MMM d')} – {format(addDays(currentWeekStart, weekDays - 1), 'MMM d, yyyy')}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{dayHoursStatuses.filter(d => !d.isClosed).length} open days</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>{t('selectStaff', language)}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAutoScheduleStaffIds(staff.map(s => s.id)); }}><Text style={{ fontSize: 12, color: primaryColor, fontWeight: '500' }}>{t('selectAllStaff', language)}</Text></Pressable>
                <Pressable onPress={() => setAutoScheduleStaffIds([])}><Text style={{ fontSize: 12, color: colors.textSecondary }}>{t('clearSelection', language)}</Text></Pressable>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {staff.map(s => {
                const sel = autoScheduleStaffIds.includes(s.id);
                const cnt = allShifts.filter(sh => sh.staff_id === s.id).length;
                return (
                  <Pressable key={s.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAutoScheduleStaffIds(prev => sel ? prev.filter(id => id !== s.id) : [...prev, s.id]); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: sel ? `${primaryColor}15` : colors.background, borderWidth: 2, borderColor: sel ? primaryColor : 'transparent' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: s.color || primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      {s.photo_url ? <Image source={{ uri: s.photo_url }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>{s.name.charAt(0).toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>{s.name}</Text>
                      {cnt > 0 && <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{cnt} shift{cnt !== 1 ? 's' : ''} scheduled</Text>}
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: sel ? primaryColor : colors.background, borderWidth: 2, borderColor: sel ? primaryColor : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                      {sel && <Check size={14} color="#fff" strokeWidth={3} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable onPress={() => setShowAutoScheduleModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleAutoSchedule} disabled={isAutoScheduling || autoScheduleStaffIds.length === 0} style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: autoScheduleStaffIds.length === 0 ? colors.textTertiary : primaryColor, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', opacity: isAutoScheduling ? 0.7 : 1 }}>
              {isAutoScheduling ? <ActivityIndicator size="small" color="#fff" /> : <><Wand2 size={18} color="#fff" /><Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', marginLeft: 8 }}>Apply ({autoScheduleStaffIds.length})</Text></>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── Smart Export / Share Modal ────────────────────────────────────────
  const selectedExportStaff = exportStoreStaff.find(s => s.id === exportStaffId);

  const shareModal = (
    <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => !isExporting && setShowShareModal(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => !isExporting && setShowShareModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            height: '82%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.18,
            shadowRadius: 20,
            elevation: 24,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center' }}>
                <Share2 size={17} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{t('exportScheduleTitle', language)}</Text>
            </View>
            <Pressable onPress={() => !isExporting && setShowShareModal(false)} disabled={isExporting} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', opacity: isExporting ? 0.4 : 1 }}>
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 48 : 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ── Section 1: What to export ── */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{t('exportScope', language)}</Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 3, marginBottom: 20 }}>
              {(['store', 'staff'] as const).map((scope) => {
                const isActive = exportScope === scope;
                const label = scope === 'store' ? t('storeSchedule', language) : t('staffScheduleOption', language);
                return (
                  <Pressable
                    key={scope}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExportScope(scope); setExportStaffId(undefined); }}
                    style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: isActive ? colors.card : 'transparent' }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: isActive ? '700' : '500', color: isActive ? primaryColor : colors.textSecondary }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Section 2a: Store dropdown ── */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{t('store', language)}</Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExportStoreDropdown(!showExportStoreDropdown); setShowExportStaffDropdown(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: showExportStoreDropdown ? primaryColor : colors.border, paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primaryColor }} />
                  <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600', flex: 1 }}>
                    {activeStores.find(s => s.id === exportStoreIdResolved)?.name ?? currentStoreName}
                  </Text>
                </View>
                <ChevronDown size={16} color={colors.textTertiary} />
              </Pressable>
              {showExportStoreDropdown && (
                <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: 'hidden', zIndex: 200 }}>
                  {activeStores.map((s, idx) => (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setExportStoreId(s.id);
                        setExportStaffId(undefined);
                        setShowExportStoreDropdown(false);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: idx < activeStores.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: exportStoreIdResolved === s.id ? `${primaryColor}10` : 'transparent' }}
                    >
                      <Text style={{ fontSize: 15, color: colors.text, fontWeight: exportStoreIdResolved === s.id ? '600' : '500' }}>{s.name}</Text>
                      {exportStoreIdResolved === s.id && <Check size={16} color={primaryColor} />}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* ── Section 2b: Staff selector (when scope=staff) ── */}
            {exportScope === 'staff' && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{t('staffMember', language)}</Text>
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExportStaffDropdown(!showExportStaffDropdown); setShowExportStoreDropdown(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: showExportStaffDropdown ? primaryColor : colors.border, paddingHorizontal: 14, paddingVertical: 13 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {selectedExportStaff && (
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: (selectedExportStaff as StaffMemberWithAssignments).color || primaryColor, alignItems: 'center', justifyContent: 'center' }}>
                        {selectedExportStaff.photo_url ? (
                          <Image source={{ uri: selectedExportStaff.photo_url }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                        ) : (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{selectedExportStaff.name.charAt(0)}</Text>
                        )}
                      </View>
                    )}
                    <Text style={{ fontSize: 15, color: selectedExportStaff ? colors.text : colors.textTertiary, fontWeight: selectedExportStaff ? '500' : '400', flex: 1 }}>
                      {selectedExportStaff?.name ?? (t('selectStaff', language))}
                    </Text>
                  </View>
                  <ChevronDown size={16} color={colors.textTertiary} />
                </Pressable>
                {showExportStaffDropdown && (
                  <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: 'hidden', zIndex: 100 }}>
                    {exportStoreStaff.length === 0 ? (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 16 }}>
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>No staff found for this store.</Text>
                      </View>
                    ) : (
                      exportStoreStaff.map((s, idx) => (
                        <Pressable key={s.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExportStaffId(s.id); setShowExportStaffDropdown(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: idx < exportStoreStaff.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: exportStaffId === s.id ? `${primaryColor}10` : 'transparent' }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: s.color || primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            {s.photo_url ? <Image source={{ uri: s.photo_url }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{s.name.charAt(0)}</Text>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, color: colors.text, fontWeight: exportStaffId === s.id ? '600' : '500' }}>{s.name}</Text>
                            {s.email ? <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>{s.email}</Text> : null}
                          </View>
                          {exportStaffId === s.id && <Check size={16} color={primaryColor} />}
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
                {/* Staff email pill */}
                {selectedExportStaff?.email && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                    <View style={{ backgroundColor: `${primaryColor}14`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, color: primaryColor, fontWeight: '500' }}>{selectedExportStaff.email}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── Section 3: Date Range ── */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{t('dateRange', language)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {[
                { labelKey: 'exportWeekly', from: getWeekStart(currentWeekStart), to: addDays(getWeekStart(currentWeekStart), 6) },
                { labelKey: 'exportBiWeekly', from: getWeekStart(currentWeekStart), to: addDays(getWeekStart(currentWeekStart), 13) },
                { labelKey: 'exportMonthly', from: startOfMonth(currentWeekStart), to: addDays(addMonths(startOfMonth(currentWeekStart), 1), -1) },
              ].map((opt) => {
                const isActive = !useCustomDateRange && exportFromDate.getTime() === opt.from.getTime() && exportToDate.getTime() === opt.to.getTime();
                return (
                  <Pressable
                    key={opt.labelKey}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUseCustomDateRange(false); setExportFromDate(opt.from); setExportToDate(opt.to); }}
                    style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: isActive ? primaryColor : colors.border, backgroundColor: isActive ? `${primaryColor}10` : colors.background }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: isActive ? '700' : '500', color: isActive ? primaryColor : colors.textSecondary }}>{t(opt.labelKey as any, language)}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setUseCustomDateRange(true);
                  setCustomFromDateText(format(exportFromDate, 'yyyy-MM-dd'));
                  setCustomToDateText(format(exportToDate, 'yyyy-MM-dd'));
                }}
                style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: useCustomDateRange ? primaryColor : colors.border, backgroundColor: useCustomDateRange ? `${primaryColor}10` : colors.background }}
              >
                <Text style={{ fontSize: 12, fontWeight: useCustomDateRange ? '700' : '500', color: useCustomDateRange ? primaryColor : colors.textSecondary }}>{t('exportCustom', language)}</Text>
              </Pressable>
            </View>
            {useCustomDateRange ? (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 5 }}>From (YYYY-MM-DD)</Text>
                  <TextInput
                    value={customFromDateText}
                    onChangeText={(text) => {
                      setCustomFromDateText(text);
                      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                        const d = new Date(text + 'T00:00:00');
                        if (!isNaN(d.getTime())) setExportFromDate(d);
                      }
                    }}
                    placeholder="2025-01-01"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                    style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 5 }}>To (YYYY-MM-DD)</Text>
                  <TextInput
                    value={customToDateText}
                    onChangeText={(text) => {
                      setCustomToDateText(text);
                      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                        const d = new Date(text + 'T00:00:00');
                        if (!isNaN(d.getTime())) setExportToDate(d);
                      }
                    }}
                    placeholder="2025-01-31"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                    style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text }}
                  />
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>
                  {format(exportFromDate, 'MMM d, yyyy')} → {format(exportToDate, 'MMM d, yyyy')}
                </Text>
              </View>
            )}


            {/* ── Export CTA ── */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleSmartExport(); }}
              disabled={isExporting || (exportScope === 'staff' && !exportStaffId)}
              style={{
                height: 54,
                borderRadius: 16,
                backgroundColor: (isExporting || (exportScope === 'staff' && !exportStaffId)) ? colors.textTertiary : primaryColor,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 10,
                marginBottom: 12,
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FileText size={18} color="#fff" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.2 }}>{t('exportButtonLabel', language)}</Text>
                </>
              )}
            </Pressable>

            {/* Cancel */}
            <Pressable onPress={() => !isExporting && setShowShareModal(false)} disabled={isExporting} style={{ paddingVertical: 12, alignItems: 'center', opacity: isExporting ? 0.4 : 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>{t('cancel', language)}</Text>
            </Pressable>

          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  // ─── Assemble ────────────────────────────────

  const innerContent = (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      {controlsRow}
      {weekNav}
      {toolbar}

      {(isLoading || !selectedStoreId) && !calendarData && !monthShifts.length ? (
        /* Skeleton placeholders — shown when:
           (a) no cached data exists yet, OR
           (b) selectedStoreId not yet resolved (auto-select effect hasn't run).
           Without (b), the query is disabled (enabled=false returns data=undefined)
           and isLoading=false, so the skeleton never fired — causing a "No staff
           assigned" empty-state flash for one paint cycle on every mount. */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} pointerEvents="none">
          {/* Summary bar skeleton */}
          <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row', gap: 20 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ flex: 1 }}>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: `${colors.text}10`, marginBottom: 8, width: '60%' }} />
                <View style={{ height: 22, borderRadius: 6, backgroundColor: `${colors.text}08`, width: '80%' }} />
              </View>
            ))}
          </View>
          {/* Staff card skeletons */}
          {[0, 1, 2].map(i => (
            <View key={i} style={{ backgroundColor: colors.card, borderRadius: 14, marginBottom: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.text}10`, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <View style={{ height: 14, borderRadius: 5, backgroundColor: `${colors.text}10`, marginBottom: 8, width: '50%' }} />
                <View style={{ height: 10, borderRadius: 4, backgroundColor: `${colors.text}06`, width: '35%' }} />
              </View>
              <View style={{ width: 60, height: 30, borderRadius: 10, backgroundColor: `${colors.text}07` }} />
            </View>
          ))}
        </ScrollView>
      ) : (
        rosterView
      )}

      {/* Global FAB — opens New Shift modal without pre-selected staff */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const dow = getDayOfWeekMonZero(tzNow);
          handleAddShift(dow);
        }}
        style={{
          position: 'absolute',
          bottom: 28,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: primaryColor,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.22,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Plus size={26} color="#fff" strokeWidth={2.5} />
      </Pressable>

      {shiftEditorModal}
      {autoScheduleModal}
      {shareModal}

      {/* Staff Profile Modal */}
      <StaffProfileModal
        visible={showProfileModal}
        onClose={() => { setShowProfileModal(false); setProfileStaff(null); }}
        staff={profileStaff}
        storeId={selectedStoreId}
        allShifts={allShifts}
        language={language}
      />
    </View>
  );

  if (embedded) return innerContent;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {innerContent}
      </SafeAreaView>
    </Modal>
  );
}
