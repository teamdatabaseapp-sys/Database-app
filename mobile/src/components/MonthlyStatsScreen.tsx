import React, { useState, useMemo, useEffect } from 'react';

// React Native global for development mode
declare const __DEV__: boolean;

import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Gift,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Trophy,
  Scissors,
  Settings,
  Check,
  Crown,
  Layers,
  Award,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t, getDateFnsLocale, getCachedDateFnsLocale, getLocalizedStoreName } from '@/lib/i18n';
import { StoreCompareMode } from '@/components/StoreCompareMode';
import { Language } from '@/lib/types';
import { useClients } from '@/hooks/useClients';
import { useStores } from '@/hooks/useStores';
import { useServices } from '@/hooks/useServices';
import { useAnalyticsOverview, useStoreBreakdownAnalytics } from '@/hooks/useAnalytics';
import { useAnalyticsAppointments } from '@/hooks/useAppointments';
import { usePromotionsRedeemedCount, usePromotionsRedeemedRows } from '@/hooks/usePromotionRedemptions';
import { useLoyaltyAnalytics, useLoyaltySettings } from '@/hooks/useLoyalty';
import type { SupabaseClient } from '@/services/clientsService';
import type { SupabaseStore } from '@/services/storesService';
import { AlertTriangle } from 'lucide-react-native';
import { type AIAdvisorContext } from '@/components/AIAdvisorModal';

// Local display type for Analytics - adapted from Supabase data
interface AnalyticsClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: Date;
  visitsCount: number;
  lastVisitAt: Date | null; // From supabaseClient.last_visit_at
  storeId?: string; // First store they visited (from appointments)
}

// Local display type for appointments in Analytics
interface AnalyticsAppointment {
  id: string;
  clientId: string;
  storeId: string;
  staffId?: string;
  date: Date;
  amount: number;
  currency: string;
  isCancelled: boolean;
  serviceTags?: string[];
  promoId?: string;
}
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
} from 'date-fns';
import type { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { MonthlyRevenueChart } from './monthlystats/MonthlyRevenueChart';
import { TimeFilterTabs } from './monthlystats/TimeFilterTabs';
import { PeriodSelector } from './monthlystats/PeriodSelector';
import { StoreFilter } from './monthlystats/StoreFilter';
import { StatsGrid } from './monthlystats/StatsGrid';
import { InsightCards } from './monthlystats/InsightCards';
import { AnalyticsHeader } from './monthlystats/AnalyticsHeader';
import { ClientsDrillDown } from './monthlystats/ClientsDrillDown';
import { AppointmentsDrillDown } from './monthlystats/AppointmentsDrillDown';
import { PromotionsDrillDown } from './monthlystats/PromotionsDrillDown';
import { ServicesDrillDown } from './monthlystats/ServicesDrillDown';
import { BestMonthDrillDown } from './monthlystats/BestMonthDrillDown';
import { BusyTimesDrillDown } from './monthlystats/BusyTimesDrillDown';
import { BestClientsDrillDown } from './monthlystats/BestClientsDrillDown';
import { AtRiskDrillDown } from './monthlystats/AtRiskDrillDown';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

// Helper to capitalize first letter only
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

// Helper to get initials from first and last name
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
};

const getMonths = (language: Language) => [
  capitalize(t('january', language)), capitalize(t('february', language)), capitalize(t('march', language)),
  capitalize(t('april', language)), capitalize(t('may', language)), capitalize(t('june', language)),
  capitalize(t('july', language)), capitalize(t('august', language)), capitalize(t('september', language)),
  capitalize(t('october', language)), capitalize(t('november', language)), capitalize(t('december', language)),
];

const getPeriodText = (timeFilter: TimeFilterType, language: Language): string => {
  switch (timeFilter) {
    case 'daily': return t('thisDay', language);
    case 'weekly': return t('thisWeekPeriod', language);
    case 'yearly': return t('thisYearPeriod', language);
    default: return t('thisMonthPeriod', language);
  }
};

type TimeFilterType = 'daily' | 'weekly' | 'monthly' | 'yearly';
type DrillDownType = 'totalClients' | 'newClients' | 'totalAppointments' | 'revenue' | 'promotions' | 'topServices' | 'bestMonth' | 'whatsWorking' | 'whatsWorkingService' | 'whatsWorkingPromo' | 'busiestTimes' | 'clientsAtRisk' | 'bestClients' | null;

// Monthly short names for chart - localized with capitalization
const getMonthShortNames = (language: Language) => [
  capitalize(t('janShort', language)), capitalize(t('febShort', language)), capitalize(t('marShort', language)),
  capitalize(t('aprShort', language)), capitalize(t('mayShort', language)), capitalize(t('junShort', language)),
  capitalize(t('julShort', language)), capitalize(t('augShort', language)), capitalize(t('sepShort', language)),
  capitalize(t('octShort', language)), capitalize(t('novShort', language)), capitalize(t('decShort', language)),
];

// Appointment with client info for Analytics display
interface AppointmentWithClient {
  appointment: AnalyticsAppointment;
  client: AnalyticsClient | null;
}

interface MonthlyStatsScreenProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToClient?: (clientId: string) => void;
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
  onOpenMarketing?: (prefill?: {
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string;
    contextLabel?: string;
  }) => void;
  onOpenAIAdvisor?: (context: AIAdvisorContext) => void;
  asTab?: boolean;
}

export function MonthlyStatsScreen({ visible, onClose, onNavigateToClient, onOpenSmartDrip, onOpenMarketing, onOpenAIAdvisor, asTab = false }: MonthlyStatsScreenProps) {
  // Settings from Zustand (these are user preferences, not analytics data)
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const userId = useStore((s) => s.user?.id);
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { colors, isDark, primaryColor } = useTheme();

  // ========== SUPABASE DATA (Single Source of Truth for Analytics) ==========
  const { data: supabaseClients = [] } = useClients();
  const { data: supabaseStores = [] } = useStores();
  const { data: supabaseServices = [] } = useServices();

  const currencySymbol = getCurrencySymbol(currency);

  // Service tags from Supabase services table
  const serviceTags = useMemo((): Array<{ id: string; name: string; color: string }> => {
    return supabaseServices.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    }));
  }, [supabaseServices]);

  // Marketing promotions from Zustand (metadata, not core analytics)
  const marketingPromotions = useMemo(() => {
    if (!userId) return [];
    return allMarketingPromotions.filter((p) => p.userId === userId);
  }, [allMarketingPromotions, userId]);

  // Stores from Supabase - convert to display format
  const stores = useMemo((): Array<{ id: string; name: string }> => {
    return supabaseStores.map((s) => ({
      id: s.id,
      name: s.name,
    }));
  }, [supabaseStores]);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('monthly');
  const [showPromoFilter, setShowPromoFilter] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [drillDownType, setDrillDownType] = useState<DrillDownType>(null);
  const [drillDownStoreFilter, setDrillDownStoreFilter] = useState<string | null>(null); // Store filter for drill-down views
  const [showAtRiskSettings, setShowAtRiskSettings] = useState(false);
  const [atRiskDays, setAtRiskDays] = useState(30); // Default 30 days
  const [bestClientsSortBy, setBestClientsSortBy] = useState<'score' | 'visits' | 'revenue'>('score');
  const [dateLocale, setDateLocale] = useState<Locale | undefined>(undefined);
  const [compareMode, setCompareMode] = useState(false); // Multi-store compare mode

  // Load date-fns locale when language changes
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  // Reset to today's date when modal opens or closes
  React.useEffect(() => {
    if (visible) {
      const today = new Date();
      setSelectedMonth(today.getMonth());
      setSelectedYear(today.getFullYear());
      setSelectedDay(today.getDate());
    }
  }, [visible]);

  // Calculate date range based on time filter
  const { periodStart, periodEnd } = useMemo(() => {
    const baseDate = new Date(selectedYear, selectedMonth, selectedDay);

    switch (timeFilter) {
      case 'daily':
        return {
          periodStart: startOfDay(baseDate),
          periodEnd: endOfDay(baseDate),
        };
      case 'weekly':
        return {
          periodStart: startOfWeek(baseDate, { weekStartsOn: 0 }),
          periodEnd: endOfWeek(baseDate, { weekStartsOn: 0 }),
        };
      case 'monthly':
        return {
          periodStart: startOfMonth(baseDate),
          periodEnd: endOfMonth(baseDate),
        };
      case 'yearly':
        return {
          periodStart: startOfYear(baseDate),
          periodEnd: endOfYear(baseDate),
        };
    }
  }, [selectedYear, selectedMonth, selectedDay, timeFilter]);

  // Calculate previous period for comparison (used in Compare Mode)
  const { previousPeriodStart, previousPeriodEnd } = useMemo(() => {
    const periodDuration = periodEnd.getTime() - periodStart.getTime();
    const prevEnd = new Date(periodStart.getTime() - 1); // One ms before current period start
    const prevStart = new Date(prevEnd.getTime() - periodDuration);

    return {
      previousPeriodStart: prevStart,
      previousPeriodEnd: prevEnd,
    };
  }, [periodStart, periodEnd]);

  const currentDate = useMemo(() => new Date(selectedYear, selectedMonth, 1), [selectedMonth, selectedYear]);
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);

  // ========== ANALYTICS DATA (RPC-ONLY) ==========
  // Single source of truth: get_monthly_analytics_overview RPC
  // NO direct table queries. NO fallbacks.
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isError: analyticsError,
    error: analyticsErrorMessage,
    errorType: analyticsErrorType,
    refetch: refetchAnalytics,
  } = useAnalyticsOverview({
    startDate: periodStart,
    endDate: periodEnd,
    storeId: drillDownStoreFilter, // Pass selected store filter to RPC
  });

  // Promotions redeemed count for the selected period + store filter
  // Source of truth: promotion_redemptions table
  const { data: promotionsRedeemedCount = 0 } = usePromotionsRedeemedCount(
    periodStart,
    periodEnd,
    { storeId: drillDownStoreFilter }
  );

  // Promotions redeemed rows for drilldown display
  // Source of truth: promotion_redemptions table (joined with promotions, clients, stores)
  const { data: promotionRedemptionRows = [] } = usePromotionsRedeemedRows(
    periodStart,
    periodEnd,
    { storeId: drillDownStoreFilter }
  );

  // Loyalty analytics data
  const { data: loyaltySettings } = useLoyaltySettings();
  const { data: loyaltyAnalytics } = useLoyaltyAnalytics(periodStart, periodEnd);

  // Convert Supabase clients to Analytics format (for client list display only, NOT for stats)
  const allAnalyticsClients = useMemo((): AnalyticsClient[] => {
    return supabaseClients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      notes: c.notes || '',
      createdAt: new Date(c.created_at),
      visitsCount: c.visits_count || 0,
      lastVisitAt: c.last_visit_at ? new Date(c.last_visit_at) : null,
    }));
  }, [supabaseClients]);

  // Fetch real appointments for the selected period + store filter
  // This powers: Top Services, Busiest Times, Best Month, What's Working, Revenue drilldown, Appointments drilldown
  const { data: rawAppointments = [] } = useAnalyticsAppointments(
    periodStart,
    periodEnd,
    drillDownStoreFilter // null = all stores, storeId = specific store
  );

  // Convert SupabaseAppointment → AnalyticsAppointment (the local display type)
  const allAnalyticsAppointments = useMemo((): AnalyticsAppointment[] => {
    return rawAppointments
      .filter((a) => !a.is_deleted && a.status !== 'deleted')
      .map((a) => ({
        id: a.id,
        clientId: a.client_id,
        storeId: a.store_id,
        staffId: a.staff_id ?? undefined,
        date: new Date(a.start_at),
        // Convert to dollars: service_price is in cents (e.g. 7500 = $75.00), a.amount is already dollars
        amount: a.service_price != null ? a.service_price / 100 : (a.amount || 0),
        currency: a.currency || 'USD',
        isCancelled: a.is_cancelled === true || a.status === 'cancelled',
        serviceTags: a.appointment_services?.map((s) => s.service_id) ?? a.service_tags ?? undefined,
        promoId: a.promo_id ?? undefined,
      }));
  }, [rawAppointments]);

  // Non-cancelled appointments within the selected period
  const appointmentsThisPeriod = useMemo((): AnalyticsAppointment[] => {
    return allAnalyticsAppointments.filter((a) => !a.isCancelled);
  }, [allAnalyticsAppointments]);

  // Client lists for UI display (NOT used for stats - stats come from RPC)
  const totalClientsByEndOfPeriod = useMemo(() => {
    return allAnalyticsClients.filter((c) => c.createdAt <= periodEnd);
  }, [allAnalyticsClients, periodEnd]);

  const newClientsThisPeriod = useMemo(() => {
    return allAnalyticsClients.filter((c) => {
      return isWithinInterval(c.createdAt, { start: periodStart, end: periodEnd });
    });
  }, [allAnalyticsClients, periodStart, periodEnd]);

  // Per-store breakdown — only active when "All Stores" is selected and there are multiple stores
  const {
    breakdown: storeBreakdown,
    topStore: topStoreFromRPC,
    isLoading: storeBreakdownLoading,
  } = useStoreBreakdownAnalytics({
    startDate: periodStart,
    endDate: periodEnd,
    previousStartDate: previousPeriodStart,
    previousEndDate: previousPeriodEnd,
    stores,
    enabled: !drillDownStoreFilter && stores.length > 1,
  });

  // topStore: map from StoreAnalyticsBreakdown to UI shape (revenue in dollars)
  const topStore = topStoreFromRPC
    ? {
        id: topStoreFromRPC.store_id,
        name: topStoreFromRPC.store_name,
        revenue: topStoreFromRPC.revenue_cents / 100, // cents → dollars
        appointments: topStoreFromRPC.appointments,
      }
    : null;

  // Appointments with client info (for display in drill-downs)
  const appointmentsWithClients = useMemo((): AppointmentWithClient[] => {
    return appointmentsThisPeriod.map((appointment) => {
      const client = allAnalyticsClients.find((c) => c.id === appointment.clientId) || null;
      return { appointment, client };
    });
  }, [appointmentsThisPeriod, allAnalyticsClients]);

  // Calculate stats for selected period - USE RPC DATA ONLY (NO FALLBACKS)
  // RPC provides: total_appointments, total_services, revenue_cents, top_clients
  // IMPORTANT: revenue_cents is in CENTS - convert to dollars here (divide by 100)
  const stats = useMemo(() => {
    if (analyticsData) {
      return {
        // These come from RPC
        totalAppointments: analyticsData.total_appointments,
        totalServices: analyticsData.total_services,
        revenue: analyticsData.revenue_cents / 100, // CONVERT CENTS TO DOLLARS
        revenueCents: analyticsData.revenue_cents, // Keep raw cents for debug
        // These are derived from client lists for UI compatibility (not core stats)
        totalClients: totalClientsByEndOfPeriod.length,
        newClients: newClientsThisPeriod.length,
        promotionsRedeemed: promotionsRedeemedCount,
      };
    }

    // Return zeros when RPC data is not available
    return {
      totalAppointments: 0,
      totalServices: 0,
      revenue: 0,
      revenueCents: 0,
      totalClients: totalClientsByEndOfPeriod.length,
      newClients: 0,
      promotionsRedeemed: promotionsRedeemedCount,
    };
  }, [analyticsData, totalClientsByEndOfPeriod.length, newClientsThisPeriod.length, promotionsRedeemedCount]);

  // DEV: log promotions + top store proof for quick verification
  if (__DEV__) {
    console.log('[Analytics] promotions_redeemed_count:', promotionsRedeemedCount,
      '| promotions_source: promotion_redemptions table',
      '| store_id:', drillDownStoreFilter || 'ALL',
      '| period:', periodStart.toISOString().slice(0, 10), '→', periodEnd.toISOString().slice(0, 10),
      '| sample_id:', promotionRedemptionRows[0]?.id ?? 'none');
    if (topStore) {
      console.log('[Analytics] top_store:', topStore.name,
        '| revenue:', topStore.revenue,
        '| appointments:', topStore.appointments,
        '| store_id:', topStore.id);
    } else if (!drillDownStoreFilter && stores.length > 1) {
      console.log('[Analytics] top_store: null (loading or no data)',
        '| stores_count:', stores.length,
        '| loading:', storeBreakdownLoading);
    }
  }

  // ========== STORE-FILTERED DATA FOR DRILL-DOWNS ==========
  // These filtered versions are used in drill-down views to show per-store data

  // Helper: Check if a client has any appointments at a specific store
  const clientHasAppointmentsAtStore = (clientId: string, storeId: string): boolean => {
    return allAnalyticsAppointments.some((a) => a.clientId === clientId && a.storeId === storeId);
  };

  // Filtered clients by store (for drill-down)
  const filteredTotalClients = useMemo(() => {
    if (!drillDownStoreFilter) return totalClientsByEndOfPeriod;
    // Filter to clients who have appointments at this store
    return totalClientsByEndOfPeriod.filter((c) => {
      return clientHasAppointmentsAtStore(c.id, drillDownStoreFilter);
    });
  }, [totalClientsByEndOfPeriod, drillDownStoreFilter, allAnalyticsAppointments]);

  // Filtered new clients by store (for drill-down)
  const filteredNewClients = useMemo(() => {
    if (!drillDownStoreFilter) return newClientsThisPeriod;
    // Filter to new clients who have appointments at this store
    return newClientsThisPeriod.filter((c) => {
      return clientHasAppointmentsAtStore(c.id, drillDownStoreFilter);
    });
  }, [newClientsThisPeriod, drillDownStoreFilter, allAnalyticsAppointments]);

  // Filtered appointments by store (for drill-down)
  const filteredAppointments = useMemo(() => {
    if (!drillDownStoreFilter) return appointmentsThisPeriod;
    return appointmentsThisPeriod.filter((a) => a.storeId === drillDownStoreFilter);
  }, [appointmentsThisPeriod, drillDownStoreFilter]);

  // Filtered appointments with clients (for drill-down display)
  const filteredAppointmentsWithClients = useMemo((): AppointmentWithClient[] => {
    return filteredAppointments.map((appointment) => {
      const client = allAnalyticsClients.find((c) => c.id === appointment.clientId) || null;
      return { appointment, client };
    });
  }, [filteredAppointments, allAnalyticsClients]);

  // Calculate filtered revenue
  const filteredRevenue = useMemo(() => {
    const appointmentRevenue = filteredAppointments.reduce((sum, a) => sum + (a.amount || 0), 0);
    return appointmentRevenue;
  }, [filteredAppointments]);

  // Filtered services with counts (for drill-down) - from appointments
  const filteredServicesWithCounts = useMemo((): Array<{ id: string; name: string; count: number; color: string }> => {
    const serviceCounts: Record<string, number> = {};
    filteredAppointments.forEach((a) => {
      a.serviceTags?.forEach((serviceId: string) => {
        serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
      });
    });

    const services: Array<{ id: string; name: string; count: number; color: string }> = [];
    Object.entries(serviceCounts).forEach(([serviceId, count]) => {
      const serviceTag = serviceTags.find((t) => t.id === serviceId);
      if (serviceTag) {
        services.push({
          id: serviceId,
          name: serviceTag.name,
          count,
          color: serviceTag.color,
        });
      }
    });

    return services.sort((a, b) => b.count - a.count);
  }, [filteredAppointments, serviceTags]);

  // Filtered service count total
  const filteredServiceCount = useMemo(() => {
    return filteredServicesWithCounts.reduce((sum, s) => sum + s.count, 0);
  }, [filteredServicesWithCounts]);

  // Get client's appointments for analytics
  const getClientAppointments = (clientId: string, storeId?: string) => {
    let appointments = allAnalyticsAppointments.filter((a) => a.clientId === clientId && !a.isCancelled);
    if (storeId) {
      appointments = appointments.filter((a) => a.storeId === storeId);
    }
    return appointments;
  };

  // Get client's last appointment date
  const getClientLastAppointmentDate = (clientId: string, storeId?: string): Date | null => {
    const appointments = getClientAppointments(clientId, storeId);
    if (appointments.length === 0) return null;
    return appointments.reduce((latest, apt) => {
      return apt.date > latest ? apt.date : latest;
    }, new Date(0));
  };

  // Get client's total revenue from appointments
  const getClientTotalRevenue = (clientId: string, storeId?: string): number => {
    const appointments = getClientAppointments(clientId, storeId);
    return appointments.reduce((sum, apt) => sum + (apt.amount || 0), 0);
  };

  // Filtered inactive clients insight (for clientsAtRisk drill-down)
  // Uses lastVisitAt from client record; when a store filter is active, further restricts
  // to clients who have at least one appointment at that store.
  const filteredInactiveClientsInsight = useMemo(() => {
    const now = new Date();
    const atRiskCutoff = new Date(now);
    atRiskCutoff.setDate(atRiskCutoff.getDate() - atRiskDays);

    let clientsToCheck = allAnalyticsClients;

    if (drillDownStoreFilter) {
      // Only clients who have visited this specific store
      const clientIdsAtStore = new Set(
        allAnalyticsAppointments
          .filter((a) => a.storeId === drillDownStoreFilter && !a.isCancelled)
          .map((a) => a.clientId)
      );
      clientsToCheck = allAnalyticsClients.filter((c) => clientIdsAtStore.has(c.id));
    }

    const inactiveClients = clientsToCheck.filter((client) => {
      if (!client.lastVisitAt) return true;
      return client.lastVisitAt < atRiskCutoff;
    });

    return { count: inactiveClients.length, clients: inactiveClients, atRiskDays };
  }, [allAnalyticsClients, allAnalyticsAppointments, atRiskDays, drillDownStoreFilter]);

  // Filtered best clients insight (for bestClients drill-down with store filter)
  // Uses RPC appointments data for computation - NO direct table queries
  const filteredBestClientsInsight = useMemo(() => {
    // Compute from RPC appointments data (allAnalyticsAppointments comes from analyticsData.appointments)
    // Filter by store if store filter is applied
    const relevantAppointments = drillDownStoreFilter
      ? allAnalyticsAppointments.filter((a) => a.storeId === drillDownStoreFilter && !a.isCancelled)
      : allAnalyticsAppointments.filter((a) => !a.isCancelled);

    if (relevantAppointments.length === 0) {
      return {
        count: 0,
        clients: [],
      };
    }

    // Group appointments by client
    const clientMap = new Map<string, { visits: number; revenue: number; lastVisit: Date | null }>();
    relevantAppointments.forEach((apt) => {
      const existing = clientMap.get(apt.clientId) || { visits: 0, revenue: 0, lastVisit: null };
      existing.visits += 1;
      existing.revenue += apt.amount || 0;
      if (!existing.lastVisit || apt.date > existing.lastVisit) {
        existing.lastVisit = apt.date;
      }
      clientMap.set(apt.clientId, existing);
    });

    // Convert to client stats format
    const clientStats = Array.from(clientMap.entries()).map(([clientId, data]) => {
      const client = allAnalyticsClients.find((c) => c.id === clientId) || {
        id: clientId,
        name: 'Unknown Client',
        email: '',
        phone: '',
        notes: '',
        createdAt: new Date(),
        visitsCount: data.visits,
      };

      const visitScore = data.visits * 10;
      const revenueScore = data.revenue * 0.1;
      const score = visitScore + revenueScore;

      return {
        client,
        totalVisits: data.visits,
        totalRevenue: data.revenue,
        lastVisit: data.lastVisit,
        score,
      };
    });

    // Sort based on selected option
    const sortedClients = [...clientStats].sort((a, b) => {
      if (bestClientsSortBy === 'visits') {
        return b.totalVisits - a.totalVisits;
      } else if (bestClientsSortBy === 'revenue') {
        return b.totalRevenue - a.totalRevenue;
      }
      return b.score - a.score;
    });

    return {
      count: sortedClients.length,
      clients: sortedClients,
    };
  }, [allAnalyticsAppointments, allAnalyticsClients, drillDownStoreFilter, bestClientsSortBy]);

  // Filtered peak days with revenue (for busiestTimes drill-down)
  const filteredPeakDaysWithRevenue = useMemo(() => {
    const relevantAppointments = drillDownStoreFilter ? filteredAppointments : appointmentsThisPeriod;

    if (relevantAppointments.length === 0) {
      return { days: [], hasData: false, topDayNames: [] };
    }

    const dayNames = [
      t('sunShort', language),
      t('monShort', language),
      t('tueShort', language),
      t('wedShort', language),
      t('thuShort', language),
      t('friShort', language),
      t('satShort', language),
    ];
    const fullDayNames = [
      t('sunday', language),
      t('monday', language),
      t('tuesday', language),
      t('wednesday', language),
      t('thursday', language),
      t('friday', language),
      t('saturday', language),
    ];
    const dayData: Record<number, { visits: number; revenue: number }> = {};

    for (let i = 0; i < 7; i++) {
      dayData[i] = { visits: 0, revenue: 0 };
    }

    relevantAppointments.forEach((a) => {
      const day = a.date.getDay();
      dayData[day].visits++;
      dayData[day].revenue += a.amount || 0;
    });

    const maxRevenue = Math.max(...Object.values(dayData).map((d) => d.revenue));
    const days = Object.entries(dayData).map(([dayIndex, data]) => ({
      name: dayNames[parseInt(dayIndex)],
      fullName: fullDayNames[parseInt(dayIndex)],
      visits: data.visits,
      revenue: data.revenue,
      percentage: maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0,
    }));

    const sortedByRevenue = [...days].sort((a, b) => b.revenue - a.revenue);
    const topDayNames = sortedByRevenue.slice(0, 2).filter((d) => d.revenue > 0).map((d) => d.fullName);

    return { days, hasData: true, topDayNames };
  }, [appointmentsThisPeriod, filteredAppointments, drillDownStoreFilter, language]);

  // Filtered best month of year (for bestMonth drill-down)
  const filteredBestMonthOfYear = useMemo((): { month: string; monthIndex: number; visits: number; revenue: number } | null => {
    const currentYear = selectedYear;
    const now = new Date();
    const relevantAppointments = drillDownStoreFilter
      ? allAnalyticsAppointments.filter((a) => a.storeId === drillDownStoreFilter && !a.isCancelled)
      : allAnalyticsAppointments.filter((a) => !a.isCancelled);

    const monthlyData: Array<{ month: number; visits: number; revenue: number }> = [];

    for (let month = 0; month < 12; month++) {
      if (currentYear === now.getFullYear() && month > now.getMonth()) continue;

      const monthStart = startOfMonth(new Date(currentYear, month, 1));
      const monthEnd = endOfMonth(new Date(currentYear, month, 1));

      let visits = 0;
      let revenue = 0;

      relevantAppointments.forEach((apt) => {
        if (isWithinInterval(apt.date, { start: monthStart, end: monthEnd })) {
          visits++;
          revenue += apt.amount || 0;
        }
      });

      monthlyData.push({ month, visits, revenue });
    }

    if (monthlyData.length === 0) return null;

    const bestMonth = monthlyData.reduce((best, current) => {
      const currentScore = current.visits * 10 + current.revenue * 0.1;
      const bestScore = best.visits * 10 + best.revenue * 0.1;
      return currentScore > bestScore ? current : best;
    }, monthlyData[0]);

    if (bestMonth.visits === 0 && bestMonth.revenue === 0) return null;

    const monthNames = [
      t('january', language), t('february', language), t('march', language),
      t('april', language), t('may', language), t('june', language),
      t('july', language), t('august', language), t('september', language),
      t('october', language), t('november', language), t('december', language),
    ];

    return {
      month: monthNames[bestMonth.month],
      monthIndex: bestMonth.month,
      visits: bestMonth.visits,
      revenue: bestMonth.revenue,
    };
  }, [allAnalyticsAppointments, selectedYear, drillDownStoreFilter, language]);

  // Filtered best month clients (for bestMonth drill-down client list)
  const filteredBestMonthClients = useMemo(() => {
    const bestMonth = filteredBestMonthOfYear;
    if (!bestMonth) return [];

    const currentYear = selectedYear;
    const monthStart = startOfMonth(new Date(currentYear, bestMonth.monthIndex, 1));
    const monthEnd = endOfMonth(new Date(currentYear, bestMonth.monthIndex, 1));

    // Get appointments in this month
    const appointmentsInMonth = allAnalyticsAppointments.filter((a) => {
      if (a.isCancelled) return false;
      if (drillDownStoreFilter && a.storeId !== drillDownStoreFilter) return false;
      return isWithinInterval(a.date, { start: monthStart, end: monthEnd });
    });

    // Group by client
    const clientAppointments: Record<string, { visits: number; revenue: number }> = {};
    appointmentsInMonth.forEach((apt) => {
      if (!clientAppointments[apt.clientId]) {
        clientAppointments[apt.clientId] = { visits: 0, revenue: 0 };
      }
      clientAppointments[apt.clientId].visits++;
      clientAppointments[apt.clientId].revenue += apt.amount || 0;
    });

    // Convert to array with client info
    const clientsInMonth: Array<{ client: AnalyticsClient; visits: number; revenue: number }> = [];
    Object.entries(clientAppointments).forEach(([clientId, data]) => {
      const client = allAnalyticsClients.find((c) => c.id === clientId);
      if (client) {
        clientsInMonth.push({
          client,
          visits: data.visits,
          revenue: data.revenue,
        });
      }
    });

    return clientsInMonth.sort((a, b) => b.revenue - a.revenue);
  }, [filteredBestMonthOfYear, allAnalyticsAppointments, allAnalyticsClients, selectedYear, drillDownStoreFilter]);

  // Get best-performing promotion for the period
  const bestPerformingPromotion = useMemo((): { id: string; name: string; count: number } | null => {
    const appointmentsWithPromo = appointmentsThisPeriod.filter((a) => a.promoId);
    if (appointmentsWithPromo.length === 0) return null;

    // Count how many times each promotion was used
    const promoCounts: Record<string, { id: string; name: string; count: number }> = {};
    appointmentsWithPromo.forEach((a) => {
      const promoId = a.promoId ?? '';
      if (promoId) {
        if (!promoCounts[promoId]) {
          // Look up promotion name from marketingPromotions array
          const promo = marketingPromotions.find((p) => p.id === promoId);
          const promoName = promo?.name || promoId;
          promoCounts[promoId] = { id: promoId, name: promoName, count: 0 };
        }
        promoCounts[promoId].count++;
      }
    });

    // Find the promotion with the highest count
    let best: { id: string; name: string; count: number } | null = null;
    Object.values(promoCounts).forEach((promo) => {
      if (!best || promo.count > best.count) {
        best = promo;
      }
    });

    return best;
  }, [appointmentsThisPeriod, marketingPromotions]);

  // Get all services with their counts for the period (based on appointment service tags)
  const allServicesWithCounts = useMemo((): Array<{ id: string; name: string; count: number; color: string }> => {
    // Count services from all appointments in the period
    const serviceCounts: Record<string, number> = {};
    appointmentsThisPeriod.forEach((a) => {
      a.serviceTags?.forEach((serviceId: string) => {
        serviceCounts[serviceId] = (serviceCounts[serviceId] || 0) + 1;
      });
    });

    // Map to service tag info and sort by count
    const services: Array<{ id: string; name: string; count: number; color: string }> = [];
    Object.entries(serviceCounts).forEach(([serviceId, count]) => {
      const serviceTag = serviceTags.find((t) => t.id === serviceId);
      if (serviceTag) {
        services.push({
          id: serviceId,
          name: serviceTag.name,
          count,
          color: serviceTag.color,
        });
      }
    });

    // Sort by count descending
    return services.sort((a, b) => b.count - a.count);
  }, [appointmentsThisPeriod, serviceTags]);

  // Total service count (sum of all service usages)
  const totalServiceCount = useMemo(() => {
    return allServicesWithCounts.reduce((sum, s) => sum + s.count, 0);
  }, [allServicesWithCounts]);

  // Get most-used service for the period (based on service tags)
  const mostUsedService = useMemo((): { id: string; name: string; count: number; color: string } | null => {
    if (allServicesWithCounts.length === 0) return null;
    return allServicesWithCounts[0];
  }, [allServicesWithCounts]);

  // Get best month of the year based on activity (appointments + revenue)
  const bestMonthOfYear = useMemo((): { month: string; monthIndex: number; visits: number; revenue: number } | null => {
    const currentYear = selectedYear;
    const now = new Date();

    // Calculate stats for each month of the year
    const monthlyData: Array<{ month: number; visits: number; revenue: number }> = [];

    for (let month = 0; month < 12; month++) {
      // Don't include future months
      if (currentYear === now.getFullYear() && month > now.getMonth()) continue;

      const monthStart = startOfMonth(new Date(currentYear, month, 1));
      const monthEnd = endOfMonth(new Date(currentYear, month, 1));

      let visits = 0;
      let revenue = 0;

      allAnalyticsAppointments.forEach((apt) => {
        if (apt.isCancelled) return;
        if (isWithinInterval(apt.date, { start: monthStart, end: monthEnd })) {
          visits++;
          revenue += apt.amount || 0;
        }
      });

      monthlyData.push({ month, visits, revenue });
    }

    if (monthlyData.length === 0) return null;

    // Find the best month (prioritize visits, then revenue)
    let best = monthlyData[0];
    monthlyData.forEach((data) => {
      if (data.visits > best.visits || (data.visits === best.visits && data.revenue > best.revenue)) {
        best = data;
      }
    });

    // Only return if there was activity
    if (best.visits === 0 && best.revenue === 0) return null;

    return {
      month: getMonths(language)[best.month],
      monthIndex: best.month,
      visits: best.visits,
      revenue: best.revenue,
    };
  }, [allAnalyticsAppointments, selectedYear, language]);

  // Get clients with spending during the best month
  const bestMonthClients = useMemo((): Array<{ client: AnalyticsClient; totalSpent: number }> => {
    if (!bestMonthOfYear) return [];

    const currentYear = selectedYear;
    const monthStart = startOfMonth(new Date(currentYear, bestMonthOfYear.monthIndex, 1));
    const monthEnd = endOfMonth(new Date(currentYear, bestMonthOfYear.monthIndex, 1));

    // Get appointments in this month grouped by client
    const clientSpendingMap: Record<string, number> = {};
    allAnalyticsAppointments.forEach((apt) => {
      if (apt.isCancelled) return;
      if (isWithinInterval(apt.date, { start: monthStart, end: monthEnd })) {
        clientSpendingMap[apt.clientId] = (clientSpendingMap[apt.clientId] || 0) + (apt.amount || 0);
      }
    });

    // Convert to array with client info
    const clientSpending: Array<{ client: AnalyticsClient; totalSpent: number }> = [];
    Object.entries(clientSpendingMap).forEach(([clientId, totalSpent]) => {
      const client = allAnalyticsClients.find((c) => c.id === clientId);
      if (client) {
        clientSpending.push({ client, totalSpent });
      }
    });

    // Sort by highest total spend to lowest
    return clientSpending.sort((a, b) => b.totalSpent - a.totalSpent);
  }, [allAnalyticsClients, allAnalyticsAppointments, selectedYear, bestMonthOfYear]);

  // Get previous month stats for comparison
  const previousMonthStats = useMemo(() => {
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const prevDate = new Date(prevYear, prevMonth, 1);
    const prevMonthStart = startOfMonth(prevDate);
    const prevMonthEnd = endOfMonth(prevDate);

    // Total clients by end of previous period
    const totalClientsPrev = allAnalyticsClients.filter((c) => {
      return c.createdAt <= prevMonthEnd;
    }).length;

    const newClientsPrev = allAnalyticsClients.filter((c) => {
      return isWithinInterval(c.createdAt, { start: prevMonthStart, end: prevMonthEnd });
    }).length;

    // Get appointments in previous period
    const appointmentsPrev = allAnalyticsAppointments.filter((a) => {
      if (a.isCancelled) return false;
      return isWithinInterval(a.date, { start: prevMonthStart, end: prevMonthEnd });
    });

    // Promotions redeemed in previous period
    const promotionsRedeemedPrev = appointmentsPrev.filter((a) => a.promoId).length;

    // Total services in previous period (count service tags used)
    const serviceCountsPrev: Record<string, number> = {};
    appointmentsPrev.forEach((a) => {
      a.serviceTags?.forEach((serviceId: string) => {
        serviceCountsPrev[serviceId] = (serviceCountsPrev[serviceId] || 0) + 1;
      });
    });
    const totalServicesPrev = Object.values(serviceCountsPrev).reduce((sum, count) => sum + count, 0);

    return {
      totalClients: totalClientsPrev,
      newClients: newClientsPrev,
      totalAppointments: appointmentsPrev.length,
      revenue: appointmentsPrev.reduce((sum, a) => sum + (a.amount || 0), 0),
      promotionsRedeemed: promotionsRedeemedPrev,
      totalServices: totalServicesPrev,
    };
  }, [allAnalyticsClients, allAnalyticsAppointments, selectedMonth, selectedYear]);

  // ========== INSIGHTS CALCULATIONS ==========

  // Return Rate: percentage of clients who returned (had more than one appointment) within the period
  const returnRateInsight = useMemo(() => {
    // Find clients who had at least one appointment in this period
    const clientsWithAppointmentsThisPeriod = new Set<string>();
    const clientsWithMultipleAppointments = new Set<string>();

    appointmentsThisPeriod.forEach((a) => {
      clientsWithAppointmentsThisPeriod.add(a.clientId);
    });

    // Check how many of those clients had appointments before this period (returning clients)
    clientsWithAppointmentsThisPeriod.forEach((clientId) => {
      // Count appointments in this period for this client
      const appointmentsInPeriod = appointmentsThisPeriod.filter((a) => a.clientId === clientId).length;

      // Check if they had appointments before this period
      const hadPreviousAppointments = allAnalyticsAppointments.some((a) => {
        if (a.clientId !== clientId || a.isCancelled) return false;
        return a.date < periodStart;
      });

      if (hadPreviousAppointments || appointmentsInPeriod > 1) {
        clientsWithMultipleAppointments.add(clientId);
      }
    });

    const totalClientsWithAppointments = clientsWithAppointmentsThisPeriod.size;
    const returningClients = clientsWithMultipleAppointments.size;
    const rate = totalClientsWithAppointments > 0 ? Math.round((returningClients / totalClientsWithAppointments) * 100) : 0;

    return {
      rate,
      totalClients: totalClientsWithAppointments,
      returningClients,
    };
  }, [allAnalyticsAppointments, appointmentsThisPeriod, periodStart]);

  // Smart Recommendation based on actual data
  const smartRecommendation = useMemo(() => {
    // Analyze data and provide relevant recommendations
    const hasPromotionUsage = appointmentsThisPeriod.some((a) => a.promoId);
    const hasServices = allServicesWithCounts.length > 0;
    const hasNewClients = newClientsThisPeriod.length > 0;

    if (hasPromotionUsage && bestPerformingPromotion) {
      return 'tipLoyaltyBonus' as const;
    } else if (hasServices && mostUsedService) {
      return 'tipServices' as const;
    } else if (hasNewClients) {
      return 'tipNewClients' as const;
    } else {
      return 'tipPromotions' as const;
    }
  }, [appointmentsThisPeriod, allServicesWithCounts, newClientsThisPeriod, bestPerformingPromotion, mostUsedService]);

  // Peak Days calculation
  const peakDaysInsight = useMemo(() => {
    if (appointmentsThisPeriod.length === 0) {
      return { peakDays: [], hasData: false };
    }

    // Count appointments by day of week (0 = Sunday, 6 = Saturday)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts: Record<number, number> = {};

    appointmentsThisPeriod.forEach((a) => {
      const dayOfWeek = a.date.getDay();
      dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
    });

    // Find days with the highest counts
    const maxCount = Math.max(...Object.values(dayCounts), 0);
    if (maxCount === 0) {
      return { peakDays: [], hasData: false };
    }

    const topDays = Object.entries(dayCounts)
      .filter(([_, count]) => count >= maxCount * 0.8) // Days with at least 80% of max
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => dayNames[parseInt(day)]);

    return { peakDays: topDays, hasData: true };
  }, [appointmentsThisPeriod]);

  // Inactive Clients: clients with no visit in the last atRiskDays days
  // Uses lastVisitAt from Supabase clients table (populated by client_visits view) — no appointment scan needed
  const inactiveClientsInsight = useMemo(() => {
    const now = new Date();
    const atRiskCutoff = new Date(now);
    atRiskCutoff.setDate(atRiskCutoff.getDate() - atRiskDays);

    const inactiveClients = allAnalyticsClients.filter((client) => {
      // No visit on record → at risk
      if (!client.lastVisitAt) return true;
      // Last visit was before the cutoff → at risk
      return client.lastVisitAt < atRiskCutoff;
    });

    return { count: inactiveClients.length, clients: inactiveClients, atRiskDays };
  }, [allAnalyticsClients, atRiskDays]);

  // Best Clients: derived from appointments data (same source as filteredBestClientsInsight)
  // This drives the card preview on the main Analytics screen.
  const bestClientsInsight = useMemo(() => {
    const { clients } = filteredBestClientsInsight;
    const topClient = clients[0] ?? null;
    return {
      count: clients.length,
      clients,
      topClient,
    };
  }, [filteredBestClientsInsight]);

  // Average Revenue per Client calculation
  const averageRevenuePerClient = useMemo(() => {
    // Get unique clients who had appointments this period
    const uniqueClientIds = new Set<string>();
    appointmentsThisPeriod.forEach((a) => {
      uniqueClientIds.add(a.clientId);
    });

    const appointmentRevenue = appointmentsThisPeriod.reduce((sum, a) => sum + (a.amount || 0), 0);
    const uniqueClients = uniqueClientIds.size;

    if (uniqueClients === 0) {
      return { average: 0, hasData: false };
    }

    return {
      average: Math.round(appointmentRevenue / uniqueClients),
      hasData: true,
    };
  }, [appointmentsThisPeriod]);

  // Peak Days with revenue data for mini-chart
  const peakDaysWithRevenue = useMemo(() => {
    if (appointmentsThisPeriod.length === 0) {
      return { days: [], hasData: false, topDayNames: [] };
    }

    // Use translated day names
    const dayNames = [
      t('sunShort', language),
      t('monShort', language),
      t('tueShort', language),
      t('wedShort', language),
      t('thuShort', language),
      t('friShort', language),
      t('satShort', language),
    ];
    const fullDayNames = [
      t('sunday', language),
      t('monday', language),
      t('tuesday', language),
      t('wednesday', language),
      t('thursday', language),
      t('friday', language),
      t('saturday', language),
    ];
    const dayData: Record<number, { visits: number; revenue: number }> = {};

    // Initialize all days
    for (let i = 0; i < 7; i++) {
      dayData[i] = { visits: 0, revenue: 0 };
    }

    // Add appointment data
    appointmentsThisPeriod.forEach((a) => {
      const dayOfWeek = a.date.getDay();
      dayData[dayOfWeek].visits++;
      dayData[dayOfWeek].revenue += a.amount || 0;
    });

    const maxRevenue = Math.max(...Object.values(dayData).map((d) => d.revenue), 1);

    const days = Object.entries(dayData).map(([day, data]) => ({
      name: dayNames[parseInt(day)],
      fullName: fullDayNames[parseInt(day)],
      visits: data.visits,
      revenue: data.revenue,
      percentage: Math.round((data.revenue / maxRevenue) * 100),
    }));

    // Find top performing days
    const sortedByRevenue = [...days].sort((a, b) => b.revenue - a.revenue);
    const topDayNames = sortedByRevenue
      .filter((d) => d.revenue > 0)
      .slice(0, 2)
      .map((d) => d.fullName);

    return { days, hasData: sortedByRevenue[0]?.revenue > 0, topDayNames };
  }, [appointmentsThisPeriod, language]);

  // ========== END INSIGHTS CALCULATIONS ==========

  // Get active promotion for this month
  const activePromoThisMonth = useMemo(() => {
    return marketingPromotions.find((p) => {
      const promoStart = new Date(p.startDate);
      const promoEnd = p.endDate ? new Date(p.endDate) : new Date(2099, 11, 31);
      return isWithinInterval(monthStart, { start: promoStart, end: promoEnd }) ||
             isWithinInterval(monthEnd, { start: promoStart, end: promoEnd }) ||
             (promoStart <= monthStart && promoEnd >= monthEnd);
    });
  }, [marketingPromotions, monthStart, monthEnd]);

  // Get days in current month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Navigate based on time filter
  const goToPrev = () => {
    const now = new Date();

    switch (timeFilter) {
      case 'daily':
        // Go to previous day within the month
        if (selectedDay > 1) {
          setSelectedDay(selectedDay - 1);
        } else {
          // Go to last day of previous month
          if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(selectedYear - 1);
            setSelectedDay(new Date(selectedYear - 1, 11 + 1, 0).getDate());
          } else {
            setSelectedMonth(selectedMonth - 1);
            setSelectedDay(new Date(selectedYear, selectedMonth, 0).getDate());
          }
        }
        break;
      case 'weekly':
        // Go to previous week within the month
        const newWeekDay = selectedDay - 7;
        if (newWeekDay >= 1) {
          setSelectedDay(newWeekDay);
        } else {
          // Go to previous month
          if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear(selectedYear - 1);
            const prevMonthDays = new Date(selectedYear - 1, 12, 0).getDate();
            setSelectedDay(Math.max(1, prevMonthDays + newWeekDay));
          } else {
            setSelectedMonth(selectedMonth - 1);
            const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();
            setSelectedDay(Math.max(1, prevMonthDays + newWeekDay));
          }
        }
        break;
      case 'monthly':
        if (selectedMonth === 0) {
          setSelectedMonth(11);
          setSelectedYear(selectedYear - 1);
        } else {
          setSelectedMonth(selectedMonth - 1);
        }
        setSelectedDay(1);
        break;
      case 'yearly':
        setSelectedYear(selectedYear - 1);
        break;
    }
  };

  const goToNext = () => {
    const now = new Date();
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    const isCurrentYear = selectedYear === now.getFullYear();
    const isToday = isCurrentMonth && selectedDay === now.getDate();

    switch (timeFilter) {
      case 'daily':
        // Don't go past today
        if (isToday) return;
        // Go to next day within the month
        if (selectedDay < daysInMonth) {
          // Check if next day would be in the future
          if (isCurrentMonth && selectedDay + 1 > now.getDate()) return;
          setSelectedDay(selectedDay + 1);
        } else {
          // Go to first day of next month
          if (selectedMonth === 11) {
            if (selectedYear + 1 > now.getFullYear()) return;
            setSelectedMonth(0);
            setSelectedYear(selectedYear + 1);
          } else {
            if (selectedYear === now.getFullYear() && selectedMonth + 1 > now.getMonth()) return;
            setSelectedMonth(selectedMonth + 1);
          }
          setSelectedDay(1);
        }
        break;
      case 'weekly':
        // Don't go past current week
        const nextWeekDay = selectedDay + 7;
        if (isCurrentMonth && nextWeekDay > now.getDate()) return;
        if (nextWeekDay <= daysInMonth) {
          setSelectedDay(nextWeekDay);
        } else {
          // Go to next month
          if (selectedMonth === 11) {
            if (selectedYear + 1 > now.getFullYear()) return;
            setSelectedMonth(0);
            setSelectedYear(selectedYear + 1);
          } else {
            if (selectedYear === now.getFullYear() && selectedMonth + 1 > now.getMonth()) return;
            setSelectedMonth(selectedMonth + 1);
          }
          setSelectedDay(Math.min(7, nextWeekDay - daysInMonth));
        }
        break;
      case 'monthly':
        if (isCurrentMonth) return;
        if (selectedMonth === 11) {
          setSelectedMonth(0);
          setSelectedYear(selectedYear + 1);
        } else {
          setSelectedMonth(selectedMonth + 1);
        }
        setSelectedDay(1);
        break;
      case 'yearly':
        if (isCurrentYear) return;
        setSelectedYear(selectedYear + 1);
        break;
    }
  };

  // Check if next button should be disabled
  const isNextDisabled = useMemo(() => {
    const now = new Date();
    switch (timeFilter) {
      case 'daily':
        return selectedYear === now.getFullYear() && selectedMonth === now.getMonth() && selectedDay === now.getDate();
      case 'weekly':
        return selectedYear === now.getFullYear() && selectedMonth === now.getMonth() && selectedDay + 7 > now.getDate();
      case 'monthly':
        return selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
      case 'yearly':
        return selectedYear === now.getFullYear();
    }
  }, [timeFilter, selectedYear, selectedMonth, selectedDay]);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const isCurrentMonth = selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth();
  const selectedPromo = selectedPromoId ? marketingPromotions.find((p) => p.id === selectedPromoId) : null;

  // Store filter selector component for drill-down views
  const handleClientPress = (clientId: string) => {
    if (onNavigateToClient) {
      setDrillDownType(null);
      setDrillDownStoreFilter(null);
      onClose();
      onNavigateToClient(clientId);
    }
  };

  const renderDrillDownContent = () => {
    switch (drillDownType) {
      case 'totalClients':
        return (
          <ClientsDrillDown
            mode="totalClients"
            clients={filteredTotalClients}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            dateLocale={dateLocale}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      case 'newClients':
        return (
          <ClientsDrillDown
            mode="newClients"
            clients={filteredNewClients}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            dateLocale={dateLocale}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );
      case 'totalAppointments':
        return (
          <AppointmentsDrillDown
            mode="totalAppointments"
            appointments={filteredAppointments}
            allClients={allAnalyticsClients}
            appointmentsWithClients={filteredAppointmentsWithClients}
            totalRevenue={stats.revenue}
            currencySymbol={currencySymbol}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            marketingPromotions={marketingPromotions}
            language={language}
            dateLocale={dateLocale}
            currency={currency}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      case 'revenue':
        return (
          <AppointmentsDrillDown
            mode="revenue"
            appointments={filteredAppointments}
            allClients={allAnalyticsClients}
            appointmentsWithClients={filteredAppointmentsWithClients}
            totalRevenue={stats.revenue}
            currencySymbol={currencySymbol}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            marketingPromotions={marketingPromotions}
            language={language}
            dateLocale={dateLocale}
            currency={currency}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );
      case 'promotions':
        return (
          <PromotionsDrillDown
            rows={promotionRedemptionRows}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            dateLocale={dateLocale}
            currency={currency}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      case 'topServices':
        return (
          <ServicesDrillDown
            services={filteredServicesWithCounts}
            totalServiceCount={filteredServiceCount}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            timeFilter={timeFilter}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      case 'bestMonth':
        return (
          <BestMonthDrillDown
            bestMonth={filteredBestMonthOfYear}
            bestMonthClients={filteredBestMonthClients}
            chartAppointments={drillDownStoreFilter ? allAnalyticsAppointments.filter((a) => a.storeId === drillDownStoreFilter && !a.isCancelled) : allAnalyticsAppointments.filter((a) => !a.isCancelled)}
            selectedYear={selectedYear}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            currency={currency}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      case 'whatsWorking':
        return (
          <View>
            <StoreFilter
              stores={stores}
              selectedStoreId={drillDownStoreFilter}
              onSelect={setDrillDownStoreFilter}
              language={language}
            />
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
              {t('whatsWorking', language)}
            </Text>
            {bestPerformingPromotion && (
              <Pressable
                onPress={() => setDrillDownType('whatsWorkingPromo')}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                }}
              >
                <View className="flex-row items-center">
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <Gift size={24} color={primaryColor} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>{bestPerformingPromotion.name}</Text>
                    <Text style={{ color: colors.textSecondary }}>
                      {t('bestPromo', language)} • {bestPerformingPromotion.count} {bestPerformingPromotion.count !== 1 ? t('usedTimesPlural', language) : t('usedTimes', language)}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textTertiary} />
                </View>
              </Pressable>
            )}
            {mostUsedService && (
              <Pressable
                onPress={() => setDrillDownType('whatsWorkingService')}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                }}
              >
                <View className="flex-row items-center">
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <Scissors size={24} color={primaryColor} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text, fontWeight: 'bold' }}>{mostUsedService.name}</Text>
                    <Text style={{ color: colors.textSecondary }}>
                      {t('topService', language)} • {mostUsedService.count} {mostUsedService.count !== 1 ? t('usedTimesPlural', language) : t('usedTimes', language)}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textTertiary} />
                </View>
              </Pressable>
            )}
            {!bestPerformingPromotion && !mostUsedService && (
              <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('noActivityThisPeriod', language)}</Text>
            )}
          </View>
        );

      case 'whatsWorkingService':
        return (
          <View>
            <StoreFilter
              stores={stores}
              selectedStoreId={drillDownStoreFilter}
              onSelect={setDrillDownStoreFilter}
              language={language}
            />
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
              {mostUsedService ? mostUsedService.name : t('topService', language)} - {t('clientDetail', language)}
            </Text>
            {mostUsedService ? (
              <>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                  }}
                >
                  <View className="flex-row items-center">
                    <View
                      style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}
                    >
                      <Scissors size={24} color={primaryColor} />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.text, fontWeight: 'bold' }}>{mostUsedService.name}</Text>
                      <Text style={{ color: colors.textSecondary }}>
                        {mostUsedService.count} {mostUsedService.count !== 1 ? t('usedTimesPlural', language) : t('usedTimes', language)} {getPeriodText(timeFilter, language)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 12 }}>{t('clientsWhoUseService', language)}</Text>
                {filteredAppointmentsWithClients
                  .filter((ac) => ac.appointment.serviceTags?.includes(mostUsedService.id))
                  .slice(0, 10)
                  .map((item: AppointmentWithClient, index: number) => (
                    <Pressable
                      key={`${item.client?.id || 'unknown'}-${item.appointment.id}-${index}`}
                      onPress={() => item.client && handleClientPress(item.client.id)}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                      }}
                    >
                      <View className="flex-row items-center">
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: primaryColor, fontWeight: 'bold' }}>
                            {getInitials(item.client?.name || '?')}
                          </Text>
                        </View>
                        <View className="flex-1 ml-3">
                          <Text style={{ color: colors.text, fontWeight: '500' }}>{item.client?.name || 'Unknown Client'}</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                            {capitalizeDate(format(item.appointment.date, 'MMM d, yyyy', { locale: dateLocale }))}
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.textTertiary} />
                      </View>
                    </Pressable>
                  ))}
              </>
            ) : (
              <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('notEnoughData', language)}</Text>
            )}
          </View>
        );

      case 'whatsWorkingPromo':
        return (
          <View>
            <StoreFilter
              stores={stores}
              selectedStoreId={drillDownStoreFilter}
              onSelect={setDrillDownStoreFilter}
              language={language}
            />
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
              {bestPerformingPromotion ? bestPerformingPromotion.name : t('bestPromo', language)} - {t('clientDetail', language)}
            </Text>
            {bestPerformingPromotion ? (
              <>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                  }}
                >
                  <View className="flex-row items-center">
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                      <Gift size={24} color={primaryColor} />
                    </View>
                    <View className="flex-1">
                      <Text style={{ color: colors.text, fontWeight: 'bold' }}>{bestPerformingPromotion.name}</Text>
                      <Text style={{ color: colors.textSecondary }}>
                        {bestPerformingPromotion.count} {bestPerformingPromotion.count !== 1 ? t('usedTimesPlural', language) : t('usedTimes', language)} {getPeriodText(timeFilter, language)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 12 }}>{t('clientsWhoUsePromo', language)}</Text>
                {filteredAppointmentsWithClients
                  .filter((ac) => ac.appointment.promoId === bestPerformingPromotion.id)
                  .slice(0, 10)
                  .map((item: AppointmentWithClient, index: number) => (
                    <Pressable
                      key={`${item.client?.id || 'unknown'}-${item.appointment.id}-${index}`}
                      onPress={() => item.client && handleClientPress(item.client.id)}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                      }}
                    >
                      <View className="flex-row items-center">
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: primaryColor, fontWeight: 'bold' }}>
                            {getInitials(item.client?.name || '?')}
                          </Text>
                        </View>
                        <View className="flex-1 ml-3">
                          <Text style={{ color: colors.text, fontWeight: '500' }}>{item.client?.name || 'Unknown Client'}</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                            {capitalizeDate(format(item.appointment.date, 'MMM d, yyyy', { locale: dateLocale }))} • {formatCurrency(item.appointment.amount, currency)}
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.textTertiary} />
                      </View>
                    </Pressable>
                  ))}
              </>
            ) : (
              <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('notEnoughData', language)}</Text>
            )}
          </View>
        );

      case 'busiestTimes':
        return (
          <BusyTimesDrillDown
            peakDays={filteredPeakDaysWithRevenue}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            currency={currency}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      case 'bestClients':
        return (
          <BestClientsDrillDown
            insight={filteredBestClientsInsight}
            sortBy={bestClientsSortBy}
            onSortByChange={setBestClientsSortBy}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            dateLocale={dateLocale}
            currency={currency}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      case 'clientsAtRisk':
        return (
          <AtRiskDrillDown
            insight={filteredInactiveClientsInsight}
            atRiskDays={atRiskDays}
            stores={stores}
            selectedStoreId={drillDownStoreFilter}
            onSelectStore={setDrillDownStoreFilter}
            language={language}
            dateLocale={dateLocale}
            onShowSettings={() => setShowAtRiskSettings(true)}
            onClientPress={handleClientPress}
            onOpenSmartDrip={onOpenSmartDrip}
            onOpenMarketing={onOpenMarketing}
          />
        );

      default:
        return null;
    }
  };

  const content = (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <AnalyticsHeader
        drillDownType={drillDownType}
        asTab={asTab}
        language={language}
        onBack={() => {
          setDrillDownType(null);
          setDrillDownStoreFilter(null);
        }}
        onClose={onClose}
        onAIPress={onOpenAIAdvisor ? () => {
          const topClient = bestClientsInsight.topClient;
          const slowestDay = filteredPeakDaysWithRevenue.hasData && filteredPeakDaysWithRevenue.days.length > 0
            ? [...filteredPeakDaysWithRevenue.days].sort((a, b) => (a.revenue ?? 0) - (b.revenue ?? 0))[0]?.fullName
            : undefined;
          const context: AIAdvisorContext = {
            revenue: stats.revenue,
            totalAppointments: stats.totalAppointments,
            totalClients: stats.totalClients,
            newClients: stats.newClients,
            promotionsRedeemed: stats.promotionsRedeemed,
            inactiveClientsCount: inactiveClientsInsight.count,
            atRiskDays: inactiveClientsInsight.atRiskDays,
            bestClientCount: bestClientsInsight.count,
            topClientName: topClient?.client.name ?? undefined,
            topClientRevenue: topClient?.totalRevenue ?? undefined,
            topClientVisits: topClient?.totalVisits ?? undefined,
            slowestDayName: slowestDay,
            busiestDayNames: peakDaysInsight.peakDays,
            mostUsedServiceName: mostUsedService?.name ?? undefined,
            bestPromoName: bestPerformingPromotion?.name ?? undefined,
            timeFilter,
            currency,
          };
          onOpenAIAdvisor(context);
        } : undefined}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
          {/* Analytics Error State - Different messages based on error type */}
          {analyticsError && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={{
                backgroundColor: analyticsErrorType === 'PERMISSION_DENIED' || analyticsErrorType === 'AUTH_REQUIRED'
                  ? (isDark ? '#78350F' : '#FFFBEB')  // Amber for auth/permission errors
                  : (isDark ? '#7F1D1D' : '#FEF2F2'), // Red for other errors
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: analyticsErrorType === 'PERMISSION_DENIED' || analyticsErrorType === 'AUTH_REQUIRED'
                  ? (isDark ? '#92400E' : '#FDE68A')
                  : (isDark ? '#991B1B' : '#FECACA'),
              }}
            >
              <AlertTriangle
                size={20}
                color={analyticsErrorType === 'PERMISSION_DENIED' || analyticsErrorType === 'AUTH_REQUIRED'
                  ? (isDark ? '#FCD34D' : '#D97706')
                  : (isDark ? '#FCA5A5' : '#DC2626')}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{
                  color: analyticsErrorType === 'PERMISSION_DENIED' || analyticsErrorType === 'AUTH_REQUIRED'
                    ? (isDark ? '#FCD34D' : '#D97706')
                    : (isDark ? '#FCA5A5' : '#DC2626'),
                  fontWeight: '600',
                  fontSize: 14
                }}>
                  {analyticsErrorType === 'PERMISSION_DENIED'
                    ? 'Permission Denied'
                    : analyticsErrorType === 'AUTH_REQUIRED'
                    ? 'Authentication Required'
                    : analyticsErrorType === 'RPC_NOT_FOUND'
                    ? 'Setup Required'
                    : 'Failed to load analytics'}
                </Text>
                <Text style={{
                  color: analyticsErrorType === 'PERMISSION_DENIED' || analyticsErrorType === 'AUTH_REQUIRED'
                    ? (isDark ? '#FDE68A' : '#92400E')
                    : (isDark ? '#FECACA' : '#7F1D1D'),
                  fontSize: 12,
                  marginTop: 2
                }}>
                  {analyticsErrorType === 'RPC_NOT_FOUND'
                    ? 'Run getSupabase()-analytics-appointments-rpc.sql'
                    : analyticsErrorMessage}
                </Text>
              </View>
              {/* Only show retry for non-auth/permission errors */}
              {analyticsErrorType !== 'PERMISSION_DENIED' && analyticsErrorType !== 'AUTH_REQUIRED' && (
                <Pressable
                  onPress={() => refetchAnalytics()}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: isDark ? '#991B1B' : '#DC2626',
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '500', fontSize: 12 }}>Retry</Text>
                </Pressable>
              )}
            </Animated.View>
          )}

          {/* Loading State — skeleton cards matching the real content layout */}
          {analyticsLoading && !analyticsData && (
            <Animated.View entering={FadeIn.duration(300)}>
              {/* KPI skeleton row */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {[...Array(3)].map((_, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 14 }}>
                    <View style={{ height: 11, width: '60%', borderRadius: 5, backgroundColor: colors.border, opacity: 0.35, marginBottom: 8 }} />
                    <View style={{ height: 22, width: '80%', borderRadius: 6, backgroundColor: colors.border, opacity: 0.4 }} />
                  </View>
                ))}
              </View>
              {/* Chart placeholder */}
              <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <View style={{ height: 13, width: '40%', borderRadius: 6, backgroundColor: colors.border, opacity: 0.35, marginBottom: 16 }} />
                <View style={{ height: 120, borderRadius: 8, backgroundColor: colors.border, opacity: 0.2 }} />
              </View>
              {/* List item skeletons */}
              {[...Array(3)].map((_, i) => (
                <View key={i} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, opacity: 0.3 }} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ height: 13, width: '55%', borderRadius: 6, backgroundColor: colors.border, opacity: 0.35, marginBottom: 6 }} />
                    <View style={{ height: 11, width: '35%', borderRadius: 5, backgroundColor: colors.border, opacity: 0.25 }} />
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Only render analytics content when NO error and NOT loading without data */}
          {!analyticsError && !(analyticsLoading && !analyticsData) && (
          drillDownType ? (
            renderDrillDownContent()
          ) : (
            <>
              {/* Time Filter Tabs */}
              <TimeFilterTabs
                timeFilter={timeFilter}
                onSelect={setTimeFilter}
                language={language}
              />

              {/* Compare Mode Toggle - only show when multiple stores */}
              {stores.length > 1 && (
                <Animated.View
                  entering={FadeInDown.delay(50).duration(300)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: compareMode ? `${primaryColor}15` : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Layers size={18} color={compareMode ? primaryColor : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                        {t('compareMode', language)}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
                        {t('compareModeDescription', language)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setCompareMode(!compareMode)}
                    style={{
                      width: 50,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: compareMode ? primaryColor : (isDark ? colors.backgroundTertiary : '#E2E8F0'),
                      justifyContent: 'center',
                      paddingHorizontal: 2,
                    }}
                  >
                    <Animated.View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: '#FFFFFF',
                        alignSelf: compareMode ? 'flex-end' : 'flex-start',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.15,
                        shadowRadius: 2,
                      }}
                    />
                  </Pressable>
                </Animated.View>
              )}

              {/* Month Selector */}
              <PeriodSelector
                timeFilter={timeFilter}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                selectedDay={selectedDay}
                periodStart={periodStart}
                dateLocale={dateLocale}
                language={language}
                onPrev={goToPrev}
                onNext={goToNext}
                isNextDisabled={isNextDisabled}
              />

              {/* Top Store This Month - Only show when multiple stores + All Stores selected */}
              {stores.length > 1 && !drillDownStoreFilter && (
                <View style={{ marginBottom: 16 }}>
                  <Pressable
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: `${primaryColor}15`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                        }}
                      >
                        <Award size={18} color={primaryColor} />
                      </View>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                        {t('topStoreThisMonth', language)}
                      </Text>
                    </View>
                    {storeBreakdownLoading ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
                        {t('loading', language)}...
                      </Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }} numberOfLines={1}>
                            {topStore ? getLocalizedStoreName(topStore.name, language) : '—'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <TrendingUp size={14} color="#22C55E" />
                            <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                              {topStore ? formatCurrency(topStore.revenue, currency) : '—'}
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 8 }}>
                              • {topStore ? topStore.appointments : 0} {t('appointments', language).toLowerCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Compare Mode View */}
              {compareMode && stores.length > 1 && (
                <StoreCompareMode
                  stores={stores}
                  periodStart={periodStart}
                  periodEnd={periodEnd}
                  previousPeriodStart={previousPeriodStart}
                  previousPeriodEnd={previousPeriodEnd}
                  language={language}
                  currency={currency}
                />
              )}

              {/* Regular Analytics View (when not in compare mode) */}
              {!compareMode && (
              <>
              {/* Stats Grid - 6 WHITE CARDS (APPEAR FIRST) */}
              <StatsGrid
                stats={stats}
                previousMonthStats={previousMonthStats}
                totalServiceCount={totalServiceCount}
                currency={currency}
                currencySymbol={currencySymbol}
                language={language}
                onDrillDown={setDrillDownType}
              />


              {/* Best Month of Year */}
              <Animated.View
                entering={FadeInDown.delay(170).duration(300)}
                className="mb-4"
              >
                <Pressable
                  onPress={() => setDrillDownType('bestMonth')}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                        <Trophy size={16} color={primaryColor} />
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 10, flex: 1 }} numberOfLines={1}>{t('bestMonth', language)} {selectedYear}</Text>
                    </View>
                    <ChevronRight size={16} color={colors.border} />
                  </View>
                  {bestMonthOfYear ? (
                    <>
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 2 }}>{bestMonthOfYear.month}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        {bestMonthOfYear.visits} {bestMonthOfYear.visits !== 1 ? t('visits', language) : t('visit', language)} • {formatCurrency(bestMonthOfYear.revenue, currency)} {t('revenue', language).toLowerCase()}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>{t('noActivityThisYear', language)}</Text>
                  )}
                </Pressable>
              </Animated.View>

              {/* What's Working For You - Best Promotion & Most Used Service */}
              <Animated.View
                entering={FadeInDown.delay(180).duration(300)}
                className="mb-4"
              >
                <Pressable
                  onPress={() => setDrillDownType('whatsWorking')}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={16} color={primaryColor} />
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 10, flex: 1 }} numberOfLines={1}>{t('whatsWorking', language)}</Text>
                    </View>
                    <ChevronRight size={16} color={colors.border} />
                  </View>
                  {bestPerformingPromotion || mostUsedService ? (
                    <>
                      {mostUsedService && (
                        <View style={{ marginBottom: bestPerformingPromotion ? 8 : 0 }}>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{mostUsedService.name}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                            {t('topService', language)} • {mostUsedService.count} {mostUsedService.count !== 1 ? t('usedTimesPlural', language) : t('usedTimes', language)} {getPeriodText(timeFilter, language)}
                          </Text>
                        </View>
                      )}
                      {bestPerformingPromotion && (
                        <View>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{bestPerformingPromotion.name}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                            {t('bestPromo', language)} • {bestPerformingPromotion.count} {bestPerformingPromotion.count !== 1 ? t('usedTimesPlural', language) : t('usedTimes', language)}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>{t('noActivityThisPeriod', language)}</Text>
                  )}
                </Pressable>
              </Animated.View>

              {/* ========== AI INSIGHT CARDS (Same style as KPI cards) ========== */}

              <InsightCards
                peakDaysWithRevenue={peakDaysWithRevenue}
                bestClientsInsight={bestClientsInsight}
                inactiveClientsInsight={inactiveClientsInsight}
                analyticsLoading={analyticsLoading}
                currency={currency}
                language={language}
                atRiskDays={atRiskDays}
                onDrillDown={setDrillDownType}
                onShowAtRiskSettings={() => setShowAtRiskSettings(true)}
                allAnalyticsClients={allAnalyticsClients}
                appointmentsThisPeriod={appointmentsThisPeriod}
                marketingPromotions={marketingPromotions}
                promotionRedemptionRows={promotionRedemptionRows}
                periodStart={periodStart}
              />

              {/* ========== END AI INSIGHT CARDS ========== */}
              </>
              )}
              {/* End Regular Analytics View */}

            </>
          ))}
        </ScrollView>

        {/* At Risk Settings Modal */}
        <Modal
          visible={showAtRiskSettings}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowAtRiskSettings(false)}
        >
          <Pressable
            className="flex-1 bg-black/50 justify-center items-center px-6"
            onPress={() => setShowAtRiskSettings(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 20,
                width: '100%',
                maxWidth: 384,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
              }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${primaryColor}20` }}>
                    <Settings size={20} color={primaryColor} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('atRiskSettings', language)}</Text>
                </View>
                <Pressable
                  onPress={() => setShowAtRiskSettings(false)}
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9' }}
                >
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
                {t('atRiskSettingsDescription', language)}
              </Text>

              <Text style={{ color: colors.text, fontWeight: '500', marginBottom: 8 }}>{t('daysWithoutVisit', language)}</Text>

              <View className="flex-row flex-wrap mb-4">
                {[7, 14, 21, 30, 45, 60, 90, 120, 180].map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => setAtRiskDays(days)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 9999,
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: atRiskDays === days ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '500',
                        color: atRiskDays === days ? '#FFFFFF' : colors.text,
                      }}
                    >
                      {days} {t('daysLabel', language)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 16 }}>
                {t('atRiskExamples', language)}
              </Text>

              <Pressable
                onPress={() => setShowAtRiskSettings(false)}
                style={{ backgroundColor: primaryColor, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <View className="flex-row items-center">
                  <Check size={18} color="white" />
                  <Text style={{ color: 'white', fontWeight: '600', marginLeft: 8, fontSize: 16 }}>{t('apply', language)}</Text>
                </View>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );

  // When used as a tab, render content directly without Modal wrapper
  if (asTab) {
    return content;
  }

  // When used as a modal, wrap in Modal component
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}
