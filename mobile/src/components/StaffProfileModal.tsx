import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/i18n/types';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Image,
  Animated,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  UserCircle2,
  X,
  Briefcase,
  Clock3,
  History,
  BarChart3,
  CalendarOff,
  Plus,
  Trash2,
  Pencil,
  Check,
  Wand2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { format, addDays } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { useStores } from '@/hooks/useStores';
import { useBusiness } from '@/hooks/useBusiness';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabaseClient';
import { useStaffTimeOff, useCreateTimeOff, useDeleteTimeOff } from '@/hooks/useStaffTimeOff';
import { isDateTimeOff, type TimeOffType } from '@/services/staffTimeOffService';
import {
  getWeekStart,
  formatTime,
  formatDateISO,
  type StaffForCalendar,
  type StaffCalendarShift,
} from '@/services/staffCalendarService';
import { StaffScheduleEditor } from '@/components/StaffScheduleEditor';
import { useUpsertStaffCalendarShifts } from '@/hooks/useStaffCalendar';
import { useStore } from '@/lib/store';
import { getNowInBusinessTz } from '@/lib/businessTimezone';

// ============================================
// Types
// ============================================

interface StaffProfileModalProps {
  visible: boolean;
  onClose: () => void;
  staff: StaffForCalendar | null;
  storeId: string | undefined;
  allShifts: StaffCalendarShift[];
  language: Language;
}

// ============================================
// Helpers
// ============================================

function timeToMinutes(time: string): number {
  const parts = time.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return h * 60 + m;
}

function shiftHours(shift: StaffCalendarShift): number {
  const start = timeToMinutes(shift.shift_start);
  const end = timeToMinutes(shift.shift_end);
  return Math.max(0, (end - start) / 60);
}

function getShiftDate(shift: StaffCalendarShift): Date {
  const weekDate = new Date(shift.week_start_date + 'T00:00:00');
  return new Date(weekDate.getTime() + shift.day_of_week * 24 * 60 * 60 * 1000);
}

function formatShiftDateLocale(shift: StaffCalendarShift, lang: string): string {
  const date = getShiftDate(shift);
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : lang === 'ko' ? 'ko-KR' : lang === 'ru' ? 'ru-RU' : lang;
  const raw = date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  // Capitalize first letter of each word (handles "lun, 3 mar" → "Lun, 3 Mar")
  return raw.replace(/(^\w|\s\w|,\s*\w)/g, (m) => m.toUpperCase());
}

const SHORT_DAYS_LOCALE = (lang: string): string[] => {
  // Use locale-aware weekday names (Mon-Sun order)
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : lang === 'ko' ? 'ko-KR' : lang === 'ru' ? 'ru-RU' : lang;
  return Array.from({ length: 7 }, (_, i) => {
    // i=0 → Monday … i=6 → Sunday (using a known Monday as anchor: 2024-01-01 was a Monday)
    const date = new Date(2024, 0, 1 + i);
    const raw = date.toLocaleDateString(locale, { weekday: 'short' });
    // Capitalize first letter
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  });
};
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Stable no-op for StaffScheduleEditor onSaved — avoids re-mount loop from inline arrow
const noop = () => {};
// Stable sections array — avoids re-mount loop from inline array literal
const SCHEDULE_EDITOR_SECTIONS: ('hours' | 'specialDays' | 'blackoutDates')[] = ['specialDays', 'blackoutDates'];

// ============================================
// Skeleton Component
// ============================================

function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const animValue = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [animValue]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#CBD5E1',
          opacity: animValue,
        },
        style,
      ]}
    />
  );
}

// ============================================
// Section Header
// ============================================

function SectionHeader({
  icon,
  title,
  colors,
  primaryColor,
}: {
  icon: React.ReactNode;
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
  primaryColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: `${primaryColor}18`,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: colors.textSecondary,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

// ============================================
// Mini Metric Card
// ============================================

function MiniMetricCard({
  label,
  value,
  colors,
  primaryColor,
}: {
  label: string;
  value: string | number;
  colors: ReturnType<typeof useTheme>['colors'];
  primaryColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: primaryColor,
          lineHeight: 26,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: colors.textSecondary,
          marginTop: 3,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

// ============================================
// Snapshot Card
// ============================================

function SnapshotCard({
  label,
  value,
  subValue,
  colors,
  primaryColor,
}: {
  label: string;
  value: string;
  subValue?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  primaryColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: colors.textTertiary,
          fontWeight: '600',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: colors.text,
          lineHeight: 18,
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
      {subValue ? (
        <Text
          style={{
            fontSize: 12,
            color: primaryColor,
            marginTop: 3,
            fontWeight: '500',
          }}
        >
          {subValue}
        </Text>
      ) : null}
    </View>
  );
}

// ============================================
// Skeleton Loading View
// ============================================

function SkeletonContent({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
      {/* Hero skeleton */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <SkeletonBlock width={80} height={80} borderRadius={40} />
        <SkeletonBlock width={160} height={22} borderRadius={6} style={{ marginTop: 12 }} />
        <SkeletonBlock width={100} height={18} borderRadius={6} style={{ marginTop: 8 }} />
      </View>
      {/* Metrics row skeleton */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <SkeletonBlock width="31%" height={72} borderRadius={14} />
        <SkeletonBlock width="31%" height={72} borderRadius={14} />
        <SkeletonBlock width="31%" height={72} borderRadius={14} />
      </View>
      {/* Section skeleton */}
      <SkeletonBlock width={120} height={16} borderRadius={6} style={{ marginBottom: 10 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <SkeletonBlock width="48%" height={80} borderRadius={14} />
        <SkeletonBlock width="48%" height={80} borderRadius={14} />
      </View>
      <SkeletonBlock width={120} height={16} borderRadius={6} style={{ marginBottom: 10 }} />
      <SkeletonBlock width="100%" height={100} borderRadius={14} style={{ marginBottom: 20 }} />
      <SkeletonBlock width={120} height={16} borderRadius={6} style={{ marginBottom: 10 }} />
      <SkeletonBlock width="100%" height={150} borderRadius={14} />
    </View>
  );
}

// ============================================
// Main Component
// ============================================

export function StaffProfileModal({
  visible,
  onClose,
  staff,
  storeId,
  allShifts,
  language,
}: StaffProfileModalProps) {
  const { colors, primaryColor, isDark } = useTheme();
  const { businessId } = useBusiness();
  const { data: stores } = useStores();
  const queryClient = useQueryClient();
  const businessTimezone = useStore((s) => s.user?.businessTimezone);

  // Refresh "now" every minute so Working Now / Next Shift / Last Shift stay live
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch 3 months of historical + 4 weeks of future shift data for this staff member
  const { data: historyShifts, isLoading: historyLoading } = useQuery({
    queryKey: ['staff-shift-history', businessId, storeId, staff?.id, businessTimezone],
    queryFn: async (): Promise<StaffCalendarShift[]> => {
      if (!businessId || !storeId || !staff?.id) return [];

      // Use business timezone for date range boundaries
      const tzToday = getNowInBusinessTz(businessTimezone);
      // 3 months back from start of current month
      const threeMonthsAgo = new Date(tzToday.getFullYear(), tzToday.getMonth() - 3, 1);
      const startStr = formatDateISO(getWeekStart(threeMonthsAgo));
      // Include 4 future weeks so nextShift can look ahead
      const fourWeeksAhead = new Date(tzToday.getFullYear(), tzToday.getMonth(), tzToday.getDate() + 28);
      const endStr = formatDateISO(getWeekStart(fourWeeksAhead));

      const { data, error } = await getSupabase()
        .from('staff_calendar_shifts')
        .select('*')
        .eq('business_id', businessId)
        .eq('store_id', storeId)
        .eq('staff_id', staff.id)
        .gte('week_start_date', startStr)
        .lte('week_start_date', endStr)
        .order('week_start_date', { ascending: false });

      if (error) {
        console.error('[StaffProfileModal] Error fetching shift history:', error);
        return [];
      }

      return (data ?? []) as StaffCalendarShift[];
    },
    enabled: !!businessId && !!storeId && !!staff?.id && visible,
    staleTime: 60 * 1000,
  });

  // Merge allShifts (current view) + historyShifts, deduplicating by id
  const staffShifts = useMemo((): StaffCalendarShift[] => {
    if (!staff) return [];

    const currentFiltered = allShifts.filter((s) => s.staff_id === staff.id);
    const historical = historyShifts ?? [];

    const seen = new Set<string>();
    const merged: StaffCalendarShift[] = [];

    for (const shift of [...historical, ...currentFiltered]) {
      if (!seen.has(shift.id)) {
        seen.add(shift.id);
        merged.push(shift);
      }
    }

    // Sort descending by date
    return merged.sort((a, b) => {
      const dateA = getShiftDate(a).getTime();
      const dateB = getShiftDate(b).getTime();
      return dateB - dateA;
    });
  }, [staff, allShifts, historyShifts]);

  const isLoading = historyLoading && !historyShifts;

  // ── Time Off ──
  const { data: timeOffData = [], refetch: refetchTimeOff } = useStaffTimeOff(
    businessId ?? undefined,
    staff?.id,
  );
  const createTimeOffMutation = useCreateTimeOff();
  const deleteTimeOffMutation = useDeleteTimeOff();

  const [showAddTimeOff, setShowAddTimeOff] = useState(false);
  const [timeOffType, setTimeOffType] = useState<TimeOffType>('days_off');
  const [timeOffStartDate, setTimeOffStartDate] = useState('');
  const [timeOffEndDate, setTimeOffEndDate] = useState('');
  const [timeOffNote, setTimeOffNote] = useState('');
  const [timeOffSaving, setTimeOffSaving] = useState(false);

  // ── Day schedule editing ──
  const upsertShiftsMutation = useUpsertStaffCalendarShifts();
  const [showDayEditor, setShowDayEditor] = useState(false);
  const [editingDow, setEditingDow] = useState<number>(0);
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('17:00');
  const [editIsOff, setEditIsOff] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  // Optimistic overrides: dow → shift or null (null = day off)
  const [optimisticOverrides, setOptimisticOverrides] = useState<Map<number, StaffCalendarShift | null>>(new Map());

  // ── Auto Schedule ──
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);

  // Format raw digit input into HH:MM
  const formatTimeInput = useCallback((raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }, []);

  const openDayEditor = useCallback((dow: number, shift: StaffCalendarShift | undefined) => {
    setEditingDow(dow);
    // DB returns HH:MM:SS — strip to HH:MM for display
    const stripSeconds = (t: string) => t ? t.slice(0, 5) : t;
    setEditStart(stripSeconds(shift?.shift_start ?? '09:00'));
    setEditEnd(stripSeconds(shift?.shift_end ?? '17:00'));
    setEditIsOff(!shift);
    setShowDayEditor(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSaveDaySchedule = useCallback(async () => {
    if (!businessId || !storeId || !staff?.id) return;
    setEditSaving(true);
    try {
      if (editIsOff) {
        const weekStartStr = formatDateISO(getWeekStart(getNowInBusinessTz(businessTimezone)));
        const existing = staffShifts.find(s => s.day_of_week === editingDow && s.week_start_date === weekStartStr);
        if (existing) {
          await getSupabase().from('staff_calendar_shifts').delete().eq('id', existing.id);
        }
        // Optimistic: mark this day as off immediately
        setOptimisticOverrides(prev => new Map(prev).set(editingDow, null));
      } else {
        await upsertShiftsMutation.mutateAsync({
          businessId,
          storeId,
          weekStartDate: getWeekStart(getNowInBusinessTz(businessTimezone)),
          shifts: [{
            staff_id: staff.id,
            day_of_week: editingDow,
            shift_start: editStart,
            shift_end: editEnd,
          }],
        });
        // Optimistic: reflect new shift immediately
        const weekStartStr = formatDateISO(getWeekStart(getNowInBusinessTz(businessTimezone)));
        const fakeShift: StaffCalendarShift = {
          id: `optimistic-${editingDow}`,
          business_id: businessId,
          store_id: storeId,
          staff_id: staff.id,
          week_start_date: weekStartStr,
          day_of_week: editingDow,
          shift_start: editStart,
          shift_end: editEnd,
        };
        setOptimisticOverrides(prev => new Map(prev).set(editingDow, fakeShift));
      }
      setShowDayEditor(false);
      queryClient.invalidateQueries({ queryKey: ['staff-shift-history', businessId, storeId, staff?.id, businessTimezone] });
    } catch {
      Alert.alert('Error', 'Failed to save schedule.');
    } finally {
      setEditSaving(false);
    }
  }, [businessId, storeId, staff, editIsOff, editingDow, editStart, editEnd, staffShifts, upsertShiftsMutation, queryClient, businessTimezone]);

  // Clear optimistic overrides when fresh data arrives
  useEffect(() => {
    if (optimisticOverrides.size > 0) {
      setOptimisticOverrides(new Map());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffShifts]);

  // Store name lookup
  const storeName = useMemo(() => {
    if (!storeId || !stores) return 'Store';
    const found = stores.find((s) => s.id === storeId);
    return found?.name ?? 'Store';
  }, [storeId, stores]);

  // Get the current date/time in the business timezone.
  // Falls back to UTC (never device time) when timezone is missing.
  // Depends on `tick` to refresh every minute.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tzNow = useMemo(() => getNowInBusinessTz(businessTimezone), [businessTimezone, tick]);
  const todayISO = formatDateISO(tzNow);
  const currentMinutes = tzNow.getHours() * 60 + tzNow.getMinutes();

  // Debug — confirms correct timezone is applied at runtime
  useEffect(() => {
    const dow = tzNow.getDay() === 0 ? 6 : tzNow.getDay() - 1;
    console.log('[StaffProfile][TZ] businessTimezone:', businessTimezone);
    console.log('[StaffProfile][TZ] tzNow:', tzNow.toString());
    console.log('[StaffProfile][TZ] todayISO:', todayISO);
    console.log('[StaffProfile][TZ] weekday (0=Mon):', dow);
    console.log('[StaffProfile][TZ] currentMinutes:', currentMinutes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessTimezone, todayISO]);

  // Today's day_of_week (0=Mon)
  const todayDow = useMemo(() => {
    const day = tzNow.getDay(); // 0=Sun
    return day === 0 ? 6 : day - 1;
  }, [tzNow]);

  // Current week bounds (Mon–Sun, inclusive) — same logic as StaffCalendarScreen
  const weekStartISO = useMemo(() => formatDateISO(getWeekStart(tzNow)), [tzNow]);
  const weekEndISO = useMemo(() => {
    const end = new Date(getWeekStart(tzNow).getTime() + 6 * 24 * 60 * 60 * 1000);
    return formatDateISO(end);
  }, [tzNow]);

  // Current month bounds
  const monthStart = useMemo(
    () => formatDateISO(new Date(tzNow.getFullYear(), tzNow.getMonth(), 1)),
    [tzNow]
  );
  const monthEnd = useMemo(
    () => formatDateISO(new Date(tzNow.getFullYear(), tzNow.getMonth() + 1, 0)),
    [tzNow]
  );

  // This week's shifts — filtered by ACTUAL computed shift date, not the DB week_start_date field
  const thisWeekShifts = useMemo(
    () =>
      staffShifts.filter((s) => {
        const shiftDateStr = formatDateISO(getShiftDate(s));
        return shiftDateStr >= weekStartISO && shiftDateStr <= weekEndISO;
      }),
    [staffShifts, weekStartISO, weekEndISO]
  );

  // ── Auto Schedule for this staff member only ──
  const handleAutoScheduleProfile = useCallback(async () => {
    if (!businessId || !storeId || !staff?.id) return;
    setIsAutoScheduling(true);
    try {
      const currentStore = stores?.find((s) => s.id === storeId);
      const weekStart = getWeekStart(tzNow);
      const shiftsToCreate: Array<{
        staff_id: string;
        day_of_week: number;
        shift_start: string;
        shift_end: string;
        break_start: null;
        break_end: null;
      }> = [];

      for (let di = 0; di < 7; di++) {
        const date = addDays(weekStart, di);
        // store.hours uses JS day-of-week (0=Sun); shifts use Mon=0
        const jsDow = date.getDay();
        const wh = currentStore?.hours?.find((h) => h.day_of_week === jsDow);
        if (!wh || wh.is_closed) continue;
        // di is already Mon=0 (weekStart is Monday)
        const alreadyHasShift = thisWeekShifts.some((s) => s.day_of_week === di);
        if (!alreadyHasShift) {
          shiftsToCreate.push({
            staff_id: staff.id,
            day_of_week: di,
            shift_start: wh.open_time ?? '09:00',
            shift_end: wh.close_time ?? '17:00',
            break_start: null,
            break_end: null,
          });
        }
      }

      if (shiftsToCreate.length === 0) {
        Alert.alert(t('noShiftsCreated', language), t('noShiftsCreatedMessage', language));
        return;
      }

      await upsertShiftsMutation.mutateAsync({
        businessId,
        storeId,
        weekStartDate: weekStart,
        shifts: shiftsToCreate,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['staff-shift-history', businessId, storeId, staff.id, businessTimezone] });
      setShowAutoScheduleModal(false);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('error', language), t('failedToSaveShift', language));
    } finally {
      setIsAutoScheduling(false);
    }
  }, [businessId, storeId, staff, stores, tzNow, thisWeekShifts, upsertShiftsMutation, queryClient, businessTimezone, language]);

  // This month's shifts
  const thisMonthShifts = useMemo(
    () =>
      staffShifts.filter((s) => {
        const shiftDateStr = formatDateISO(getShiftDate(s));
        return shiftDateStr >= monthStart && shiftDateStr <= monthEnd;
      }),
    [staffShifts, monthStart, monthEnd]
  );

  // Hours this month
  const hoursThisMonth = useMemo(
    () => thisMonthShifts.reduce((acc, s) => acc + shiftHours(s), 0),
    [thisMonthShifts]
  );

  // HARD GUARD: do not compute any time-sensitive values until businessTimezone is loaded.
  // This prevents the device timezone from contaminating todayISO/currentMinutes on first render.
  const tzReady = !!businessTimezone;

  // Next upcoming shift — earliest shift start strictly AFTER now
  // If a shift is currently active, skip it (show the next one after it)
  const nextShift = useMemo(() => {
    if (!tzReady) return null;
    const future = staffShifts.filter((s) => {
      const shiftDateStr = formatDateISO(getShiftDate(s));
      if (shiftDateStr > todayISO) return true;
      if (shiftDateStr === todayISO) {
        return timeToMinutes(s.shift_start) > currentMinutes;
      }
      return false;
    });
    // staffShifts is sorted descending; future[future.length - 1] = earliest future shift
    return future.length > 0 ? future[future.length - 1] : null;
  }, [tzReady, staffShifts, todayISO, currentMinutes]);

  // Last past shift — most recent shift whose end time is strictly BEFORE now
  const lastShift = useMemo(() => {
    if (!tzReady) return null;
    const past = staffShifts.filter((s) => {
      const shiftDateStr = formatDateISO(getShiftDate(s));
      if (shiftDateStr < todayISO) return true;
      if (shiftDateStr === todayISO) {
        return timeToMinutes(s.shift_end) <= currentMinutes;
      }
      return false;
    });
    // staffShifts is sorted descending; past[0] = most recent past shift
    return past.length > 0 ? past[0] : null;
  }, [tzReady, staffShifts, todayISO, currentMinutes]);

  // Days this week — count unique actual shift dates (not day_of_week index)
  const daysThisWeek = useMemo(
    () => new Set(thisWeekShifts.map((s) => formatDateISO(getShiftDate(s)))).size,
    [thisWeekShifts]
  );

  // Working now check — requires timezone loaded, shift window, AND no time-off for today
  const isWorkingNow = useMemo(() => {
    if (!tzReady) return false;
    // If staff has time-off covering today (business TZ), they are NOT working now
    if (timeOffData.some(to => todayISO >= to.start_date && todayISO <= to.end_date)) return false;

    return staffShifts.some((s) => {
      const shiftDateStr = formatDateISO(getShiftDate(s));
      if (shiftDateStr !== todayISO) return false;
      const start = timeToMinutes(s.shift_start);
      const end = timeToMinutes(s.shift_end);
      return currentMinutes >= start && currentMinutes < end;
    });
  }, [tzReady, staffShifts, todayISO, currentMinutes, timeOffData]);

  // Availability: derive from this week's shifts (Mon-Sun grid), merged with optimistic overrides
  const weekAvailability = useMemo(() => {
    const map = new Map<number, StaffCalendarShift>();
    for (const s of thisWeekShifts) {
      if (!map.has(s.day_of_week)) {
        map.set(s.day_of_week, s);
      }
    }
    // Apply optimistic overrides on top
    for (const [dow, shift] of optimisticOverrides.entries()) {
      if (shift === null) {
        map.delete(dow);
      } else {
        map.set(dow, shift);
      }
    }
    return map;
  }, [thisWeekShifts, optimisticOverrides]);

  // Last 20 past shifts for history
  const recentHistory = useMemo(() => {
    return staffShifts
      .filter((s) => {
        const shiftDateStr = formatDateISO(getShiftDate(s));
        return shiftDateStr <= todayISO;
      })
      .slice(0, 20);
  }, [staffShifts, todayISO]);

  // Hours bar chart: last 4 distinct week_start_dates
  const weeklyHours = useMemo(() => {
    const weekMap = new Map<string, number>();
    for (const s of staffShifts) {
      const wk = s.week_start_date;
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + shiftHours(s));
    }
    // Sort descending
    const sorted = Array.from(weekMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4)
      .reverse(); // ascending for display left→right

    return sorted.map(([weekStart, hours], i) => {
      const d = new Date(weekStart + 'T00:00:00');
      const label = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return { weekStart, hours, label };
    });
  }, [staffShifts]);

  const maxHours = useMemo(
    () => Math.max(...weeklyHours.map((w) => w.hours), 1),
    [weeklyHours]
  );

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!staff) return null;

  const initial = staff.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={['top', 'left', 'right']}
      >
        {/* Header Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
            <UserCircle2 size={24} color={primaryColor} />
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: colors.text,
              }}
            >
              {t('staffProfile', language)}
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={{ padding: 4 }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <SkeletonContent colors={colors} />
          ) : (
            <>
              {/* ================================================
                  SECTION 1 — Hero Header
              ================================================ */}
              <View
                style={{
                  alignItems: 'center',
                  paddingTop: 24,
                  paddingHorizontal: 16,
                  paddingBottom: 20,
                }}
              >
                {/* Avatar */}
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: staff.color,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    shadowColor: staff.color,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  {staff.photo_url ? (
                    <Image
                      source={{ uri: staff.photo_url }}
                      style={{ width: 80, height: 80, borderRadius: 40 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={{
                        fontSize: 32,
                        fontWeight: '700',
                        color: '#FFFFFF',
                      }}
                    >
                      {initial}
                    </Text>
                  )}
                </View>

                {/* Name */}
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: colors.text,
                    marginTop: 12,
                    textAlign: 'center',
                  }}
                >
                  {staff.name}
                </Text>

                {/* Badges row */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {/* Role badge */}
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      backgroundColor: `${primaryColor}18`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: primaryColor,
                      }}
                    >
                      {t('teamMemberRole', language)}
                    </Text>
                  </View>

                  {/* Status badge */}
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                      backgroundColor: staff.is_active
                        ? `${colors.success}18`
                        : `${colors.error}18`,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: staff.is_active ? colors.success : colors.error,
                      }}
                    >
                      {staff.is_active ? t('activeStatus', language) : t('inactiveStatus', language)}
                    </Text>
                  </View>
                </View>

                {/* Store name */}
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginTop: 6,
                  }}
                >
                  {storeName}
                </Text>

                {/* Mini metrics row */}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    marginTop: 20,
                    width: '100%',
                  }}
                >
                  <MiniMetricCard
                    label={t('thisWeek', language)}
                    value={thisWeekShifts.length}
                    colors={colors}
                    primaryColor={primaryColor}
                  />
                  <MiniMetricCard
                    label={t('thisMonth', language)}
                    value={thisMonthShifts.length}
                    colors={colors}
                    primaryColor={primaryColor}
                  />
                  <MiniMetricCard
                    label={t('hoursPerMonth', language)}
                    value={`${Math.round(hoursThisMonth)}h`}
                    colors={colors}
                    primaryColor={primaryColor}
                  />
                </View>
              </View>

              {/* ================================================
                  SECTION 2 — Work Snapshot
              ================================================ */}
              <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                <SectionHeader
                  icon={<Briefcase size={14} color={primaryColor} />}
                  title={t('workSnapshot', language)}
                  colors={colors}
                  primaryColor={primaryColor}
                />

                {/* 2x2 grid */}
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <SnapshotCard
                      label={t('nextShift', language)}
                      value={
                        nextShift
                          ? formatShiftDateLocale(nextShift, language)
                          : t('notScheduled', language)
                      }
                      subValue={
                        nextShift
                          ? `${formatTime(nextShift.shift_start)} – ${formatTime(nextShift.shift_end)}`
                          : undefined
                      }
                      colors={colors}
                      primaryColor={primaryColor}
                    />
                    <SnapshotCard
                      label={t('lastShift', language)}
                      value={
                        lastShift
                          ? formatShiftDateLocale(lastShift, language)
                          : t('noShiftHistory', language)
                      }
                      subValue={
                        lastShift
                          ? `${formatTime(lastShift.shift_start)} – ${formatTime(lastShift.shift_end)}`
                          : undefined
                      }
                      colors={colors}
                      primaryColor={primaryColor}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <SnapshotCard
                      label={t('daysThisWeekLabel', language)}
                      value={`${daysThisWeek} ${daysThisWeek !== 1 ? t('daysPlural', language) : t('daysSingular', language)}`}
                      colors={colors}
                      primaryColor={primaryColor}
                    />
                    <SnapshotCard
                      label={t('shiftsThisMonthLabel', language)}
                      value={`${thisMonthShifts.length} ${thisMonthShifts.length !== 1 ? t('shiftPlural', language) : t('shiftSingular', language)}`}
                      colors={colors}
                      primaryColor={primaryColor}
                    />
                  </View>
                </View>

                {/* Working Now indicator */}
                <View
                  style={{
                    marginTop: 10,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isWorkingNow
                      ? `${primaryColor}14`
                      : `${colors.textTertiary}10`,
                    borderWidth: 1,
                    borderColor: isWorkingNow
                      ? `${primaryColor}30`
                      : `${colors.border}`,
                  }}
                >
                  {/* Pulsing dot */}
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: isWorkingNow
                        ? primaryColor
                        : colors.textTertiary,
                      marginRight: 10,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isWorkingNow ? primaryColor : colors.textSecondary,
                    }}
                  >
                    {isWorkingNow ? t('workingNow', language) : t('offToday', language)}
                  </Text>
                </View>
              </View>

              {/* ================================================
                  SECTION 3 — Availability
              ================================================ */}
              <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                {/* Section header row: title left, Auto Schedule button right */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                      <Clock3 size={14} color={primaryColor} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {t('thisWeeksSchedule', language)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAutoScheduleModal(true); }}
                    hitSlop={8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: `${primaryColor}15` }}
                  >
                    <Wand2 size={13} color={primaryColor} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: primaryColor }}>{t('autoSchedule', language)}</Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 14,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  {SHORT_DAYS_LOCALE(language).map((dayLabel: string, dow: number) => {
                    const shift = weekAvailability.get(dow);
                    const isToday = dow === todayDow;
                    // Compute the actual date for this dow
                    const rowDate = new Date(getWeekStart(tzNow).getTime() + dow * 86400000);
                    const locale = language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : language === 'ko' ? 'ko-KR' : language === 'ru' ? 'ru-RU' : language;
                    const shortDateLabel = rowDate.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });

                    return (
                      <Pressable
                        key={dow}
                        onPress={() => openDayEditor(dow, shift)}
                        style={({ pressed }) => ({
                          paddingVertical: 10,
                          borderBottomWidth: dow < 6 ? 1 : 0,
                          borderBottomColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        {/* Header row: date left — edit button right */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: shift ? 6 : 0 }}>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: isToday ? '700' : '600',
                              color: isToday ? primaryColor : colors.text,
                            }}
                          >
                            {shortDateLabel}
                          </Text>
                          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)', alignItems: 'center', justifyContent: 'center' }}>
                            <Pencil size={15} color={colors.textSecondary} strokeWidth={2} />
                          </View>
                        </View>

                        {/* Content row: shift pill / off badge */}
                        {shift ? (
                          <View
                            style={{
                              backgroundColor: `${primaryColor}14`,
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '600',
                                  color: primaryColor,
                                  flex: 1,
                                }}
                              >
                                {formatTime(shift.shift_start)} – {formatTime(shift.shift_end)}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: `${primaryColor}99`,
                                  fontWeight: '600',
                                }}
                              >
                                {shiftHours(shift).toFixed(1)}h
                              </Text>
                            </View>
                            {shift.break_start && shift.break_end && (
                              <Text style={{ fontSize: 10, color: `${primaryColor}88`, marginTop: 2 }}>
                                {t('breakLabel', language)}: {formatTime(shift.break_start)} – {formatTime(shift.break_end)}
                              </Text>
                            )}
                          </View>
                        ) : isDateTimeOff(timeOffData, staff?.id ?? '', formatDateISO(new Date(getWeekStart(tzNow).getTime() + dow * 86400000))) ? (
                          <View style={{ backgroundColor: `${colors.error}14`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.error }}>{t('offLabel', language)}</Text>
                          </View>
                        ) : (
                          <View style={{ backgroundColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
                            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textTertiary }}>Off</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* ================================================
                  SECTION 3.2 — Special Days & Blackout Dates (via StaffScheduleEditor)
              ================================================ */}
              {staff?.id && (
                <View style={{ marginBottom: 20 }}>
                  <StaffScheduleEditor
                    staffId={staff.id}
                    language={language}
                    onSaved={noop}
                    sections={SCHEDULE_EDITOR_SECTIONS}
                    containerPadding={16}
                  />
                </View>
              )}

              {/* ================================================
                  SECTION 3.5 — Time Off
              ================================================ */}
              <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                {/* Header row with Add button */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <CalendarOff size={14} color={primaryColor} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>
                    {t('timeOffSection', language)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTimeOffType('days_off');
                      setTimeOffStartDate('');
                      setTimeOffEndDate('');
                      setTimeOffNote('');
                      setShowAddTimeOff(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: `${primaryColor}14` }}
                  >
                    <Plus size={12} color={primaryColor} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: primaryColor }}>{t('addTimeOff', language)}</Text>
                  </Pressable>
                </View>

                <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                  {/* Type summary rows */}
                  {(['days_off', 'sick', 'vacation'] as TimeOffType[]).map((type, idx) => {
                    const count = timeOffData.filter(e => e.type === type).length;
                    const label = type === 'days_off' ? t('daysOff', language) : type === 'sick' ? t('sickDays', language) : t('vacationDays', language);
                    const dotColor = type === 'sick' ? '#F97316' : type === 'vacation' ? '#14B8A6' : primaryColor;
                    return (
                      <View key={type} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, marginRight: 10 }} />
                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text }}>{label}</Text>
                        {count > 0 && (
                          <View style={{ backgroundColor: `${primaryColor}20`, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: primaryColor }}>{count}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Entries list */}
                  {timeOffData.length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: colors.textTertiary }}>{t('noTimeOffRecorded', language)}</Text>
                    </View>
                  ) : (
                    timeOffData.slice(0, 5).map((entry, idx) => {
                      const dotColor = entry.type === 'sick' ? '#F97316' : entry.type === 'vacation' ? '#14B8A6' : primaryColor;
                      const dateStr = entry.start_date === entry.end_date
                        ? entry.start_date
                        : `${entry.start_date} – ${entry.end_date}`;
                      return (
                        <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor, flexShrink: 0 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{dateStr}</Text>
                            {entry.note ? <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{entry.note}</Text> : null}
                          </View>
                          <Pressable
                            onPress={() => {
                              Alert.alert(t('delete', language), t('timeOffDeleteConfirm', language), [
                                { text: t('cancel', language), style: 'cancel' },
                                {
                                  text: t('delete', language),
                                  style: 'destructive',
                                  onPress: async () => {
                                    if (!businessId) return;
                                    await deleteTimeOffMutation.mutateAsync({ id: entry.id, businessId });
                                    refetchTimeOff();
                                  },
                                },
                              ]);
                            }}
                            hitSlop={8}
                            style={{ padding: 4 }}
                          >
                            <Trash2 size={14} color={colors.textTertiary} />
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>

              {/* ================================================
                  SECTION 4 — Hours Chart (moved above Shift History)
              ================================================ */}
              <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                <SectionHeader
                  icon={<BarChart3 size={14} color={primaryColor} />}
                  title={t('hoursDistribution', language)}
                  colors={colors}
                  primaryColor={primaryColor}
                />

                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  {weeklyHours.length === 0 ? (
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.textTertiary,
                        textAlign: 'center',
                        paddingVertical: 20,
                      }}
                    >
                      {t('noDataAvailable', language)}
                    </Text>
                  ) : (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        justifyContent: 'space-around',
                        height: 120,
                        gap: 8,
                      }}
                    >
                      {weeklyHours.map((week, i) => {
                        const barHeightRatio = week.hours / maxHours;
                        const barHeight = Math.max(4, barHeightRatio * 80);
                        const isCurrentWeek =
                          week.weekStart === weekStartISO;

                        return (
                          <View
                            key={week.weekStart}
                            style={{
                              flex: 1,
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              height: 120,
                            }}
                          >
                            {/* Hour value label */}
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: isCurrentWeek
                                  ? primaryColor
                                  : colors.textSecondary,
                                marginBottom: 4,
                              }}
                            >
                              {week.hours % 1 === 0
                                ? `${week.hours}h`
                                : `${week.hours.toFixed(1)}h`}
                            </Text>

                            {/* Bar */}
                            <View
                              style={{
                                width: '100%',
                                height: barHeight,
                                borderRadius: 6,
                                backgroundColor: isCurrentWeek
                                  ? primaryColor
                                  : `${primaryColor}50`,
                              }}
                            />

                            {/* Week label */}
                            <Text
                              style={{
                                fontSize: 10,
                                color: isCurrentWeek
                                  ? primaryColor
                                  : colors.textTertiary,
                                fontWeight: isCurrentWeek ? '700' : '500',
                                marginTop: 6,
                                textAlign: 'center',
                              }}
                              numberOfLines={1}
                            >
                              {week.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>

              {/* ================================================
                  SECTION 5 — Shift History (moved below Hours Distribution)
              ================================================ */}
              <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                <SectionHeader
                  icon={<History size={14} color={primaryColor} />}
                  title={t('shiftHistoryLabel', language)}
                  colors={colors}
                  primaryColor={primaryColor}
                />

                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                >
                  {recentHistory.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.textTertiary,
                        }}
                      >
                        {t('noShiftHistoryFound', language)}
                      </Text>
                    </View>
                  ) : (
                    recentHistory.map((shift, index) => {
                      const isEven = index % 2 === 0;
                      const hrs = shiftHours(shift);
                      return (
                        <View
                          key={shift.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 11,
                            paddingHorizontal: 16,
                            backgroundColor: isEven
                              ? 'transparent'
                              : isDark
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(0,0,0,0.02)',
                            borderBottomWidth: index < recentHistory.length - 1 ? 1 : 0,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '600',
                                color: colors.text,
                              }}
                            >
                              {formatShiftDateLocale(shift, language)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                                marginTop: 2,
                              }}
                            >
                              {formatTime(shift.shift_start)} – {formatTime(shift.shift_end)}
                            </Text>
                          </View>
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 10,
                              backgroundColor: `${primaryColor}14`,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: primaryColor,
                              }}
                            >
                              {hrs % 1 === 0 ? `${hrs}h` : `${hrs.toFixed(1)}h`}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ================================================
          Day Schedule Editor Modal
      ================================================ */}
      <Modal
        visible={showDayEditor}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => { Keyboard.dismiss(); setShowDayEditor(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
            onPress={() => { Keyboard.dismiss(); setShowDayEditor(false); }}
          >
            <Pressable onPress={e => e.stopPropagation()}>
              <View style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Platform.OS === 'ios' ? 36 : 20,
              }}>
                {/* Handle */}
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 }} />

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                      {(() => {
                        const d = new Date(getWeekStart(tzNow).getTime() + editingDow * 86400000);
                        const locale = language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : language === 'ko' ? 'ko-KR' : language === 'ru' ? 'ru-RU' : language;
                        return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
                      })()}
                    </Text>
                  </View>
                  <Pressable onPress={() => { Keyboard.dismiss(); setShowDayEditor(false); }} hitSlop={12}>
                    <X size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {/* Day Off toggle */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 16,
                }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>Day Off</Text>
                  <Switch
                    value={editIsOff}
                    onValueChange={v => { setEditIsOff(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    trackColor={{ false: colors.border, true: `${primaryColor}80` }}
                    thumbColor={editIsOff ? primaryColor : '#fff'}
                    ios_backgroundColor={colors.border}
                  />
                </View>

                {/* Time inputs */}
                {!editIsOff && (
                  <View style={{ gap: 12, marginBottom: 24 }}>
                    <View style={{
                      backgroundColor: colors.background,
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, flexShrink: 0, marginRight: 8 }}>Start time</Text>
                      <TextInput
                        value={editStart}
                        onChangeText={v => setEditStart(formatTimeInput(v))}
                        placeholder="09:00"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        selectTextOnFocus
                        returnKeyType="next"
                        blurOnSubmit={false}
                        maxLength={5}
                        style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'right' }}
                      />
                    </View>
                    <View style={{
                      backgroundColor: colors.background,
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, flexShrink: 0, marginRight: 8 }}>End time</Text>
                      <TextInput
                        value={editEnd}
                        onChangeText={v => setEditEnd(formatTimeInput(v))}
                        placeholder="17:00"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                        selectTextOnFocus
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        maxLength={5}
                        style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'right' }}
                      />
                    </View>
                  </View>
                )}

                {/* Save button */}
                <Pressable
                  onPress={() => { Keyboard.dismiss(); handleSaveDaySchedule(); }}
                  disabled={editSaving}
                  style={{
                    backgroundColor: primaryColor,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    opacity: editSaving ? 0.7 : 1,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {editSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Check size={16} color="#fff" strokeWidth={2.5} />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>Save</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================
          Add Time Off Modal
      ================================================ */}
      <Modal
        visible={showAddTimeOff}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowAddTimeOff(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => { Keyboard.dismiss(); setShowAddTimeOff(false); }} />
            <View style={{ width: '92%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden' }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <CalendarOff size={18} color={primaryColor} />
                  <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{t('addTimeOffTitle', language)}</Text>
                </View>
                <Pressable onPress={() => setShowAddTimeOff(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
                {/* Type selector */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('timeOffType', language)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {(['days_off', 'sick', 'vacation'] as TimeOffType[]).map(type => {
                    const sel = timeOffType === type;
                    const label = type === 'days_off' ? t('daysOff', language) : type === 'sick' ? t('sickDays', language) : t('vacationDays', language);
                    const dotColor = type === 'sick' ? '#F97316' : type === 'vacation' ? '#14B8A6' : primaryColor;
                    return (
                      <Pressable key={type} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTimeOffType(type); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: sel ? dotColor : colors.background, borderWidth: 1.5, borderColor: sel ? dotColor : colors.border }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: sel ? '#fff' : colors.textSecondary, textAlign: 'center' }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Date inputs */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: t('timeOffStartDate', language), value: timeOffStartDate, setter: setTimeOffStartDate },
                    { label: t('timeOffEndDate', language), value: timeOffEndDate, setter: setTimeOffEndDate },
                  ].map(({ label, value, setter }) => (
                    <View key={label} style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>{label}</Text>
                      <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                        <TextInput
                          value={value}
                          onChangeText={setter}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="numbers-and-punctuation"
                          style={{ padding: 12, fontSize: 15, fontWeight: '500', color: colors.text }}
                        />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Note input */}
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>{t('timeOffNote', language)}</Text>
                <View style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}>
                  <TextInput
                    value={timeOffNote}
                    onChangeText={setTimeOffNote}
                    placeholder={t('timeOffNotePlaceholder', language)}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                    style={{ padding: 12, fontSize: 14, color: colors.text, minHeight: 72, textAlignVertical: 'top' }}
                  />
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable onPress={() => setShowAddTimeOff(false)} style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>{t('cancel', language)}</Text>
                  </Pressable>
                  <Pressable
                    disabled={timeOffSaving}
                    onPress={async () => {
                      if (!businessId || !staff?.id) return;
                      // Validate dates
                      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                      if (!dateRegex.test(timeOffStartDate)) {
                        Alert.alert(t('validationError', language), t('timeOffStartDate', language) + ': YYYY-MM-DD');
                        return;
                      }
                      const endDate = timeOffEndDate || timeOffStartDate;
                      if (!dateRegex.test(endDate)) {
                        Alert.alert(t('validationError', language), t('timeOffEndDate', language) + ': YYYY-MM-DD');
                        return;
                      }
                      if (endDate < timeOffStartDate) {
                        Alert.alert(t('validationError', language), 'End date must be after start date');
                        return;
                      }
                      setTimeOffSaving(true);
                      try {
                        await createTimeOffMutation.mutateAsync({
                          businessId,
                          input: {
                            staff_id: staff.id,
                            type: timeOffType,
                            start_date: timeOffStartDate,
                            end_date: endDate,
                            note: timeOffNote.trim() || null,
                          },
                        });
                        setShowAddTimeOff(false);
                        refetchTimeOff();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      } catch {
                        Alert.alert(t('error', language), t('failedToSaveShift', language));
                      } finally {
                        setTimeOffSaving(false);
                      }
                    }}
                    style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center', opacity: timeOffSaving ? 0.7 : 1 }}
                  >
                    {timeOffSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{t('save', language)}</Text>}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Auto Schedule Modal ── */}
      <Modal visible={showAutoScheduleModal} transparent animationType="fade" onRequestClose={() => setShowAutoScheduleModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Wand2 size={18} color={primaryColor} />
                </View>
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{t('autoSchedule', language)}</Text>
              </View>
              <Pressable onPress={() => setShowAutoScheduleModal(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            {/* Body */}
            <View style={{ padding: 20 }}>
              <View style={{ backgroundColor: `${primaryColor}10`, padding: 14, borderRadius: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
                  {t('autoScheduleDescription', language)}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                  {format(getWeekStart(tzNow), 'MMM d')} – {format(addDays(getWeekStart(tzNow), 6), 'MMM d, yyyy')}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  {stores?.find((s) => s.id === storeId)?.hours?.filter((h) => !h.is_closed).length ?? 0} {t('openDays', language) ?? 'open days'}
                </Text>
              </View>
            </View>
            {/* Footer */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 20 }}>
              <Pressable onPress={() => setShowAutoScheduleModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>{t('cancel', language)}</Text>
              </Pressable>
              <Pressable
                onPress={handleAutoScheduleProfile}
                disabled={isAutoScheduling}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: primaryColor, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', opacity: isAutoScheduling ? 0.7 : 1 }}
              >
                {isAutoScheduling
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Wand2 size={17} color="#fff" /><Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', marginLeft: 8 }}>{t('apply', language)}</Text></>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
