import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Phone,
  Mail,
  Edit3,
  Archive,
  ArchiveRestore,
  Trash2,
  Plus,
  Calendar,
  Gift,
  Tag,
  MessageCircle,
  ChevronRight,
  Check,
  X,
  Zap,
  Send,
  Award,
  Target,
  Clock,
  Store as StoreIcon,
  User,
  DollarSign,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t, getDateFnsLocale, getCachedDateFnsLocale, getLocalizedStoreName } from '@/lib/i18n';
import { Language, Client, Visit, ClientPromotion, Appointment, Store, StaffMember, GiftCardTransaction } from '@/lib/types';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { formatCurrency, getCurrencySymbol, getCurrenciesForLanguage } from '@/lib/currency';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Button } from '@/components/Button';
import { SendEmailModal } from './SendEmailModal';
import { AddVisitModal } from './AddVisitModal';
import { Input } from '@/components/Input';
import { WheelDatePicker } from '@/components/WheelDatePicker';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { useDeleteClient, useClient } from '@/hooks/useClients';
import { useClientAppointments, convertToLocalAppointment, useUpdateAppointment } from '@/hooks/useAppointments';
import type { LocalAppointment } from '@/components/appointments/appointmentsTypes';
import { useServices, useSyncAppointmentServices } from '@/hooks/useServices';
import { useStores } from '@/hooks/useStores';
import { useStaffMembers } from '@/hooks/useStaff';
import { useClientPromotionsUsed } from '@/hooks/usePromotionRedemptions';
import { usePromotionAssignments, usePromotionAssignmentActions } from '@/hooks/usePromotionAssignments';
import {
  useClientPromotionCounters,
  useCounterRedemptions,
  useCreatePromotionCounter,
  useAddCounterRedemption,
  useEditCounterRedemption,
  useDeletePromotionCounter,
} from '@/hooks/usePromotionCounters';
import type { PromotionCounter, PromotionCounterRedemption } from '@/services/promotionCountersService';
import { useHydratePromotionsFromSupabase } from '@/hooks/usePromotions';
import { useHydrateDripCampaigns } from '@/hooks/useDripCampaigns';
import { syncCampaignToSupabase } from '@/hooks/useDripCampaigns';
import { useBusiness } from '@/hooks/useBusiness';
import { createPromotion } from '@/services/promotionsService';
import { persistClientDripAssignment } from '@/services/dripCampaignsService';
import { OFFICIAL_TEMPLATES, SmartDripTemplate } from './drip/constants';
import {
  useClientLoyalty,
  useLoyaltySettings,
  useLoyaltyRewards,
  useClientLoyaltyTransactions,
  useClientRedemptions,
  useToggleClientLoyaltyEnrollment,
  useCreateRedemption,
  useAvailableRewardsForClient,
} from '@/hooks/useLoyalty';
import { useClientGiftCards, useClientGiftCardTransactionsByCards } from '@/hooks/useGiftCards';
import { notifyAppointmentEmail } from '@/services/appointmentsService';
import { notifyTransactionalEmail } from '@/services/transactionalEmailService';
import { useClientMembership, useMembershipPlan, useMembershipSettings, useEnrollClientInMembership, useMarkPaymentReceived, useCancelMembership, usePauseMembership, useResumeMembership, useMembershipPlans, useMembershipCredits, useMembershipPayments } from '@/hooks/useMembership';
import { getMembershipStatusInfo, calculateNextRenewalDate } from '@/services/membershipService';
import { MembershipPaymentMethod, MembershipStatus } from '@/lib/types';
import { Star, Crown, TrendingUp, Users as UsersIcon, Sparkles, Shield, UserPlus, AlertCircle, Heart, MessageSquare } from 'lucide-react-native';
import { ClientProfileCard } from './clientDetail/ClientProfileCard';
import { ClientStatsCards } from './clientDetail/ClientStatsCards';
import { ClientFeatureCards } from './clientDetail/ClientFeatureCards';
import { ClientVisitHistorySection } from './clientDetail/ClientVisitHistorySection';
import { ClientActionButtons } from './clientDetail/ClientActionButtons';
import { VisitsModal } from './clientDetail/VisitsModal';
import { PromotionsUsedModal } from './clientDetail/PromotionsUsedModal';
import { LoyaltyPointsModal } from './clientDetail/LoyaltyPointsModal';
import { GiftCardModal } from './clientDetail/GiftCardModal';
import { AppointmentsModal } from './clientDetail/AppointmentsModal';
import { ClientPromotionsModal } from './clientDetail/ClientPromotionsModal';
import { ClientTimelineModal } from './clientDetail/ClientTimelineModal';
import { useRealtimeClientSummary } from '@/hooks/useRealtimeClientSummary';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

interface ClientDetailScreenProps {
  clientId: string;
  onBack: () => void;
  onEdit: () => void;
}

export function ClientDetailScreen({ clientId, onBack, onEdit }: ClientDetailScreenProps) {
  // Supabase data - primary source
  const { data: supabaseClient, isLoading: isLoadingClient } = useClient(clientId);
  const deleteClientMutation = useDeleteClient();

  // Fetch client's appointments from Supabase (these are the "visits" for Visit History)
  const { data: supabaseAppointments = [], isLoading: isLoadingAppointments } = useClientAppointments(clientId);

  // Supabase mutations for updating appointments/visits
  const updateAppointmentMutation = useUpdateAppointment();
  const syncServicesMutation = useSyncAppointmentServices();

  // Supabase data for stores and staff (single source of truth)
  const { data: supabaseStores = [] } = useStores();
  const { data: supabaseStaff = [] } = useStaffMembers();

  // Fetch client's promotion redemptions from Supabase (single source of truth for "Promotions Used")
  const { data: clientPromotionsUsed = [] } = useClientPromotionsUsed(clientId);

  // Loyalty Program data
  const { data: loyaltySettings } = useLoyaltySettings();
  const { data: clientLoyaltyData } = useClientLoyalty(clientId);
  const { data: loyaltyRewards = [] } = useLoyaltyRewards();
  const { data: loyaltyTransactions = [] } = useClientLoyaltyTransactions(clientId);
  const { data: loyaltyRedemptions = [] } = useClientRedemptions(clientId);
  const availableRewards = useAvailableRewardsForClient(clientId);
  const toggleEnrollmentMutation = useToggleClientLoyaltyEnrollment();
  const createRedemptionMutation = useCreateRedemption();

  // Gift Card data
  const { data: clientGiftCards = [] } = useClientGiftCards(clientId);
  const { data: clientGiftCardTransactions = [] as GiftCardTransaction[] } = useClientGiftCardTransactionsByCards(clientId);
  const activeGiftCards = useMemo(() =>
    clientGiftCards.filter(gc => gc.status === 'active'),
    [clientGiftCards]
  );
  const totalGiftCardBalance = useMemo(() =>
    activeGiftCards
      .filter(gc => gc.type === 'value')
      .reduce((sum, gc) => sum + (gc.currentBalance || 0), 0),
    [activeGiftCards]
  );

  // Membership Program data
  const { data: clientMembership, isLoading: membershipLoading } = useClientMembership(clientId);
  const { data: membershipPlan } = useMembershipPlan(clientMembership?.planId);
  const { data: membershipSettings } = useMembershipSettings();
  const { data: membershipPlans = [] } = useMembershipPlans();
  const { data: membershipCredits = [] } = useMembershipCredits(clientMembership?.id);
  const { data: membershipPayments = [] } = useMembershipPayments(clientMembership?.id);
  const enrollMembershipMutation = useEnrollClientInMembership();
  const markPaymentReceivedMutation = useMarkPaymentReceived();
  const cancelMembershipMutation = useCancelMembership();
  const pauseMembershipMutation = usePauseMembership();
  const resumeMembershipMutation = useResumeMembership();

  // Zustand store data (for visits, promotions etc.)
  const allClients = useStore((s) => s.clients);
  const allDripCampaigns = useStore((s) => s.dripCampaigns);
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const allAppointments = useStore((s) => s.appointments);
  const userId = useStore((s) => s.user?.id);
  const archiveClient = useStore((s) => s.archiveClient);
  const unarchiveClient = useStore((s) => s.unarchiveClient);

  // Realtime: surgically invalidate summary queries on live DB changes.
  // No-ops gracefully until migration 20260325000001 enables the publication.
  useRealtimeClientSummary(clientId, userId);
  const deleteClientLocal = useStore((s) => s.deleteClient);
  const assignClientToDrip = useStore((s) => s.assignClientToDrip);
  const addDripCampaign = useStore((s) => s.addDripCampaign);
  const assignClientToPromotion = useStore((s) => s.assignClientToPromotion);
  const { assign: assignPromoToDB, pause: pausePromoInDB, resume: resumePromoInDB, remove: removePromoFromDB } = usePromotionAssignmentActions();
  const addClientPromotion = useStore((s) => s.addClientPromotion);
  const updateClientPromotionCounter = useStore((s) => s.updateClientPromotionCounter);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const insets = useSafeAreaInsets();

  // Hydrate promotions and drip campaigns from Supabase on every screen open
  useHydratePromotionsFromSupabase();
  useHydrateDripCampaigns();

  // DB-backed promotion counter hooks — useBusiness() is available immediately (no sequential dep)
  const { businessId } = useBusiness();
  const { data: dbCounters = [] } = useClientPromotionCounters(clientId);
  const createCounterMutation = useCreatePromotionCounter(clientId);
  const addCounterRedemptionMutation = useAddCounterRedemption(clientId);
  const deleteCounterMutation = useDeletePromotionCounter(clientId);

  // Active counter for redemption details (null = none selected)
  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  const { data: activeCounterRedemptions = [], isLoading: isLoadingRedemptions } = useCounterRedemptions(activeCounterId);
  const editCounterRedemptionMutation = useEditCounterRedemption(clientId, activeCounterId ?? '');

  // Add Count modal state
  const [showAddCountModal, setShowAddCountModal] = useState(false);
  const [pendingCounterId, setPendingCounterId] = useState<string | null>(null);
  const [addCountServiceId, setAddCountServiceId] = useState<string | null>(null);
  const [addCountStoreId, setAddCountStoreId] = useState<string | null>(null);
  const [addCountStaffId, setAddCountStaffId] = useState<string | null>(null);
  const [addCountDate, setAddCountDate] = useState<Date>(new Date());
  const [addCountNote, setAddCountNote] = useState('');
  const [isSavingAddCount, setIsSavingAddCount] = useState(false);

  // Redemption details / edit modal state
  const [showRedemptionDetailsModal, setShowRedemptionDetailsModal] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<PromotionCounterRedemption | null>(null);
  const [showEditRedemptionModal, setShowEditRedemptionModal] = useState(false);
  const [editRedServiceId, setEditRedServiceId] = useState<string | null>(null);
  const [editRedStoreId, setEditRedStoreId] = useState<string | null>(null);
  const [editRedStaffId, setEditRedStaffId] = useState<string | null>(null);
  const [editRedDate, setEditRedDate] = useState<Date>(new Date());
  const [editRedNote, setEditRedNote] = useState('');
  const [isSavingEditRedemption, setIsSavingEditRedemption] = useState(false);
  const [addCountDatePickerOpen, setAddCountDatePickerOpen] = useState(false);
  const [editRedDatePickerOpen, setEditRedDatePickerOpen] = useState(false);

  // Filter data by current user
  const clients = useMemo(() => {
    if (!userId) return [];
    return allClients.filter((c: Client) => c.userId === userId);
  }, [allClients, userId]);

  // Find Zustand client for additional data (visits, tags, etc.)
  const zustandClient = useMemo(() => {
    return clients.find((c: Client) => c.id === clientId);
  }, [clients, clientId]);

  // Load services from Supabase for displaying service tags in visit history
  const { data: supabaseServices = [] } = useServices();
  const serviceTags = useMemo(() => {
    return supabaseServices.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    }));
  }, [supabaseServices]);

  const dripCampaigns = useMemo(() => {
    if (!userId) return allDripCampaigns;
    const filtered = allDripCampaigns.filter((c) => c.userId === userId);
    return filtered.length > 0 ? filtered : allDripCampaigns;
  }, [allDripCampaigns, userId]);

  const marketingPromotions = useMemo(() => {
    if (!userId) return allMarketingPromotions;
    const filtered = allMarketingPromotions.filter((p) => p.userId === userId);
    return filtered.length > 0 ? filtered : allMarketingPromotions;
  }, [allMarketingPromotions, userId]);

  // Convert Supabase stores to the format expected by the UI
  const stores = useMemo(() => {
    return supabaseStores.map((s) => ({
      id: s.id,
      userId: userId || '',
      name: s.name,
    }));
  }, [supabaseStores, userId]);

  // Convert Supabase staff to the format expected by the UI
  const staffMembers = useMemo(() => {
    return supabaseStaff.map((s) => ({
      id: s.id,
      userId: userId || '',
      name: s.full_name,
      storeId: s.store_ids?.[0] || undefined,
      storeIds: s.store_ids || [],
      color: s.color || '#0D9488',
    }));
  }, [supabaseStaff, userId]);

  // Get upcoming appointments for this client (future appointments only, sorted by date)
  // Use Supabase appointments (single source of truth)
  const clientUpcomingAppointments = useMemo(() => {
    if (!supabaseAppointments || supabaseAppointments.length === 0) return [];
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    return supabaseAppointments
      .filter((a) => !a.is_deleted && !a.is_cancelled) // Exclude deleted/cancelled
      .filter((a) => new Date(a.start_at) >= now) // Future only
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()); // Sort ASC (nearest first)
  }, [supabaseAppointments]);

  // Upcoming appointment count: same source of truth as the Upcoming Appointments modal
  const totalVisitCount = clientUpcomingAppointments.length;

  // Count of future active appointments that will be auto-cancelled on archive.
  // Matches backend definition: start_at > now, not deleted, not already in terminal state.
  const futureActiveAppointmentCount = useMemo(() => {
    if (!supabaseAppointments || supabaseAppointments.length === 0) return 0;
    const now = new Date();
    return supabaseAppointments.filter((a) => {
      if (a.is_deleted || a.is_cancelled) return false;
      const ls = a.lifecycle_status as string | null;
      if (ls === 'completed' || ls === 'no_show' || ls === 'cancelled') return false;
      return new Date(a.start_at) > now;
    }).length;
  }, [supabaseAppointments]);

  // Promotions used count: appointments that had a promo applied (promo_id at appointment OR service level)
  const promoAppointmentsCount = useMemo(() => {
    if (!supabaseAppointments || supabaseAppointments.length === 0) return 0;
    return supabaseAppointments.filter((a) => {
      if (a.is_deleted || a.is_cancelled) return false;
      return !!a.promo_id || (a.appointment_services?.some(s => !!s.promo_id) ?? false);
    }).length;
  }, [supabaseAppointments]);

  // Build promotions-used display list from two sources (whichever has data):
  // 1. clientPromotionsUsed — from promotion_redemptions table (accurate, requires migration)
  // 2. Derived from supabaseAppointments where promo_id or appointment_services.promo_id IS NOT NULL
  // Source 1 is used when the promotion_redemptions table is deployed; otherwise source 2.
  const promotionsUsedDisplay = useMemo((): import('@/services/promotionRedemptionsService').ClientPromotionUsed[] => {
    // Prefer source 1 if it returned data
    if (clientPromotionsUsed.length > 0) return clientPromotionsUsed;

    // Derive from appointments as fallback — check both appointment-level AND service-level promo_id
    if (!supabaseAppointments || supabaseAppointments.length === 0) return [];
    return supabaseAppointments
      .filter((a) => {
        if (a.is_deleted || a.is_cancelled) return false;
        // Has appointment-level promo OR any service-level promo
        return !!a.promo_id || (a.appointment_services?.some(s => !!s.promo_id) ?? false);
      })
      .map((a) => {
        // Resolve promo: appointment-level takes precedence, then first service-level
        const promoId = a.promo_id || a.appointment_services?.find(s => s.promo_id)?.promo_id || null;
        // Resolve via Zustand store (single source for promo metadata)
        const zustandPromo = promoId ? marketingPromotions.find((p) => p.id === promoId) : null;
        const store = stores.find((s) => s.id === a.store_id);
        return {
          id: a.id,
          promotion_id: promoId!,
          promotion_name: zustandPromo?.name || 'Promotion',
          promotion_color: '#6366F1',
          discount_type: zustandPromo?.discountType || 'other',
          discount_value: zustandPromo?.discountValue || 0,
          redeemed_at: a.start_at,
          store_id: a.store_id || null,
          store_name: store?.name || null,
          final_amount: a.amount ?? null,
          currency: a.currency || 'USD',
        };
      });
  }, [clientPromotionsUsed, supabaseAppointments, marketingPromotions, stores]);

  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [campaignPickerTab, setCampaignPickerTab] = useState<'campaigns' | 'templates'>('campaigns');
  const [showVisitsModal, setShowVisitsModal] = useState(false);
  const [showPromotionsModal, setShowPromotionsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPromoPicker, setShowPromoPicker] = useState(false);
  const [showAddPromotionCounterModal, setShowAddPromotionCounterModal] = useState(false);
  const [counterTargetCount, setCounterTargetCount] = useState('5');
  const [counterName, setCounterName] = useState('');
  const [isSavingCounter, setIsSavingCounter] = useState(false);
  const [counterSaveError, setCounterSaveError] = useState<string | null>(null);
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<LocalAppointment | null>(null);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showLoyaltyConfirmModal, setShowLoyaltyConfirmModal] = React.useState(false);
  const [loyaltyConfirmPending, setLoyaltyConfirmPending] = React.useState<boolean | null>(null);
  const [showGiftCardModal, setShowGiftCardModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showRedeemRewardModal, setShowRedeemRewardModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showMembershipInfoModal, setShowMembershipInfoModal] = useState(false);
  const [showEnrollMembershipModal, setShowEnrollMembershipModal] = useState(false);
  const [showMarkPaymentModal, setShowMarkPaymentModal] = useState(false);

  // Enrollment form state
  const [enrollPlanId, setEnrollPlanId] = useState<string>('');
  const [enrollStartDate, setEnrollStartDate] = useState<Date>(new Date());
  const [enrollNextRenewalDate, setEnrollNextRenewalDate] = useState<Date>(new Date());
  const [enrollPaymentMethod, setEnrollPaymentMethod] = useState<MembershipPaymentMethod>('cash');
  const [enrollPaymentNotes, setEnrollPaymentNotes] = useState('');
  const [enrollNotes, setEnrollNotes] = useState('');
  const [showEnrollStartDatePicker, setShowEnrollStartDatePicker] = useState(false);
  const [showEnrollRenewalDatePicker, setShowEnrollRenewalDatePicker] = useState(false);

  // Mark payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState<MembershipPaymentMethod>('cash');
  const [paymentPeriodStart, setPaymentPeriodStart] = useState<Date>(new Date());
  const [paymentPeriodEnd, setPaymentPeriodEnd] = useState<Date>(new Date());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentReceivedBy, setPaymentReceivedBy] = useState('');
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [showPeriodStartPicker, setShowPeriodStartPicker] = useState(false);
  const [showPeriodEndPicker, setShowPeriodEndPicker] = useState(false);

  // Edit appointment state
  const [editAppointmentDate, setEditAppointmentDate] = useState<Date>(new Date());
  const [editAppointmentTime, setEditAppointmentTime] = useState('09:00');
  const [editAppointmentEndTime, setEditAppointmentEndTime] = useState('10:00');
  const [editAppointmentNotes, setEditAppointmentNotes] = useState('');
  const [editAppointmentAmount, setEditAppointmentAmount] = useState('');
  const [editAppointmentStoreId, setEditAppointmentStoreId] = useState<string | null>(null);
  const [editAppointmentStaffId, setEditAppointmentStaffId] = useState<string | null>(null);
  const [editAppointmentServices, setEditAppointmentServices] = useState<string[]>([]);
  const [editAppointmentPromotionId, setEditAppointmentPromotionId] = useState<string | null>(null);
  const [showEditAppointmentDatePicker, setShowEditAppointmentDatePicker] = useState(false);
  const [showEditAppointmentStorePicker, setShowEditAppointmentStorePicker] = useState(false);
  const [showEditAppointmentStaffPicker, setShowEditAppointmentStaffPicker] = useState(false);
  const [showEditAppointmentPromotionPicker, setShowEditAppointmentPromotionPicker] = useState(false);
  const [editAppointmentCurrency, setEditAppointmentCurrency] = useState<string>(currency);
  const [showEditAppointmentCurrencyPicker, setShowEditAppointmentCurrencyPicker] = useState(false);

  // Edit visit state
  const [showEditVisitModal, setShowEditVisitModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [editVisitNotes, setEditVisitNotes] = useState('');
  const [editVisitAmount, setEditVisitAmount] = useState('');
  const [editVisitServices, setEditVisitServices] = useState<string[]>([]);
  const [editVisitDate, setEditVisitDate] = useState<Date>(new Date());
  const [showEditVisitDatePicker, setShowEditVisitDatePicker] = useState(false);
  const [editVisitStaffId, setEditVisitStaffId] = useState<string | null>(null);
  const [editVisitStoreId, setEditVisitStoreId] = useState<string | null>(null);

  // Convert Supabase appointments to Visit format for display in Visit History
  const visitsFromSupabase = useMemo((): Visit[] => {
    if (!supabaseAppointments || supabaseAppointments.length === 0) {
      return [];
    }

    // Filter and sort visits - newest first (by start_at DESC)
    const visits = supabaseAppointments
      .filter(apt => !apt.is_deleted && !apt.is_cancelled) // Exclude deleted/cancelled
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()) // Sort DESC
      .map(apt => {
        // Get service IDs from multiple sources (in priority order):
        // 1. Junction table (appointment_services) - for manually created appointments
        // 2. Direct service_id column - for online bookings
        // 3. service_tags TEXT[] column - legacy fallback
        // 4. Joined service data - from relational query
        let serviceIds = apt.appointment_services?.map(s => s.service_id) || [];

        // If no services from junction table, check direct service_id (online bookings)
        if (serviceIds.length === 0 && apt.service_id) {
          serviceIds = [apt.service_id];
        }

        // If still no services, check service_tags column (TEXT[] legacy column)
        if (serviceIds.length === 0 && apt.service_tags && Array.isArray(apt.service_tags) && apt.service_tags.length > 0) {
          serviceIds = apt.service_tags;
        }

        // If still no services but we have a joined service, use that
        if (serviceIds.length === 0 && apt.service?.id) {
          serviceIds = [apt.service.id];
        }

        // Build fallback service names for display when service IDs don't match local serviceTags
        // (e.g. service was deleted, or IDs don't align)
        const matchedServiceCount = serviceTags.filter(t => serviceIds.includes(t.id)).length;
        let serviceNames: string[] | undefined = undefined;
        if (matchedServiceCount === 0 && serviceIds.length > 0) {
          // Try to get names from direct columns / joined service
          const names: string[] = [];
          if (apt.service_name) names.push(apt.service_name);
          else if (apt.service?.name) names.push(apt.service.name);
          else if (apt.title && !apt.title.startsWith('Visit -')) names.push(apt.title);
          if (names.length > 0) serviceNames = names;
        }

        // Calculate amount from multiple sources
        // Priority: 1. total_cents (cents, most accurate), 2. amount (decimal), 3. service.price_cents (joined), 4. service_price
        let visitAmount: number | undefined = undefined;
        if (apt.total_cents != null && apt.total_cents > 0) {
          visitAmount = apt.total_cents / 100;
        } else if (apt.amount != null && apt.amount > 0) {
          visitAmount = apt.amount;
        } else if (apt.service?.price_cents != null && apt.service.price_cents > 0) {
          visitAmount = apt.service.price_cents / 100;
        } else if (apt.service_price != null && apt.service_price > 0) {
          visitAmount = apt.service_price / 100;
        }

        // Resolve staff and store names for display (fallback when IDs don't match loaded data)
        const resolvedStaffName = apt.staff?.full_name || apt.staff?.name ||
          staffMembers.find(s => s.id === apt.staff_id)?.name;
        const resolvedStoreName = apt.store?.name ||
          stores.find(s => s.id === apt.store_id)?.name;

        // Resolve promotion name via promo_id + Zustand store
        const resolvedPromoId =
          apt.promo_id ||
          apt.appointment_services?.find(s => s.promo_id)?.promo_id ||
          null;
        const zustandPromo = resolvedPromoId
          ? marketingPromotions.find(p => p.id === resolvedPromoId)
          : null;
        const resolvedPromoName = zustandPromo?.name || null;

        return {
          id: apt.id,
          date: new Date(apt.start_at),
          services: serviceIds,
          serviceNames,
          notes: apt.notes || '',
          amount: visitAmount,
          promotionUsed: resolvedPromoId || undefined,
          promo_name: resolvedPromoName,
          storeId: apt.store_id,
          staffId: apt.staff_id || undefined,
          staffName: resolvedStaffName,
          storeName: resolvedStoreName,
          modifiedAt: apt.updated_at ? new Date(apt.updated_at) : undefined,
          // Pricing breakdown from persisted columns
          subtotal_cents: apt.subtotal_cents ?? null,
          discount_cents: apt.discount_cents ?? null,
          total_cents: apt.total_cents ?? null,
          // Appointment metadata
          confirmationCode: apt.confirmation_code ?? null,
          // Gift card code: use joined gift_cards data first (from DB join), then fall back
          // to client gift cards list lookup, then finally a truncated UUID fallback
          giftCardCode: apt.gift_card_id
            ? (apt.gift_cards?.code ?? clientGiftCards.find(gc => gc.id === apt.gift_card_id)?.code ?? null)
            : null,
        };
      });

    return visits;
  }, [supabaseAppointments, isLoadingAppointments, serviceTags, staffMembers, stores, marketingPromotions, clientGiftCards]);

  // Create a merged client object: Supabase data as primary, Zustand for additional fields
  const client = useMemo<Client | undefined>(() => {
    if (supabaseClient) {
      // Combine Supabase appointments (converted to visits) with Zustand visits
      // Supabase visits take priority (they're the source of truth)
      const combinedVisits = visitsFromSupabase.length > 0
        ? visitsFromSupabase
        : (zustandClient?.visits || []);
      return {
        id: supabaseClient.id,
        userId: supabaseClient.business_id, // Map business_id to userId for compatibility
        name: supabaseClient.name,
        email: supabaseClient.email || '',
        phone: supabaseClient.phone || '',
        notes: supabaseClient.notes || '',
        // Use Supabase appointments as visits (single source of truth)
        visits: combinedVisits,
        promotionCount: zustandClient?.promotionCount || 0,
        tags: zustandClient?.tags || [],
        dripCampaignId: zustandClient?.dripCampaignId,
        activePromotionId: zustandClient?.activePromotionId,
        clientPromotions: zustandClient?.clientPromotions,
        isArchived: zustandClient?.isArchived || false,
        createdAt: new Date(supabaseClient.created_at),
        updatedAt: zustandClient?.updatedAt || new Date(supabaseClient.created_at),
      };
    }
    // Fall back to Zustand client if no Supabase data
    console.log('[ClientDetailScreen] Falling back to Zustand client for:', clientId);
    return zustandClient;
  }, [supabaseClient, zustandClient, clientId, visitsFromSupabase]);

  // Cache the last valid client to prevent flash during store updates
  // Use ref that updates synchronously during render (not in useEffect) to avoid flash
  const lastValidClientRef = useRef<Client | undefined>(client);

  // Update ref synchronously during render if we have a valid client
  // This prevents the flash that occurs when useEffect updates asynchronously
  if (client) {
    lastValidClientRef.current = client;
  }

  // Use cached client if current is temporarily undefined during store update
  const displayClient = client ?? lastValidClientRef.current;

  // Get date-fns locale for the current language
  // Initialize with cached value to prevent flash on re-render
  const [dateLocale, setDateLocale] = useState<Locale | undefined>(() => getCachedDateFnsLocale(language));

  // Load date-fns locale when language changes (only if not already cached)
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  // Get initials from first and last name
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const assignedCampaign = useMemo(
    () => dripCampaigns.find((c) => c.id === displayClient?.dripCampaignId),
    [dripCampaigns, displayClient?.dripCampaignId]
  );

  // Get active marketing promotion (Zustand legacy — kept for the picker modal only)
  const activePromotion = useMemo(
    () => marketingPromotions.find((p) => p.id === displayClient?.activePromotionId),
    [marketingPromotions, displayClient?.activePromotionId]
  );

  // DB-backed marketing promo assignment — authoritative source of truth
  const { data: allAssignments = [] } = usePromotionAssignments();

  // All non-removed assignments for this client (active + paused)
  const clientAssignments = useMemo(
    () => allAssignments.filter((a) => a.client_id === clientId && a.status !== 'removed'),
    [allAssignments, clientId]
  );

  // Single active assignment (used for the Zustand sync on remove)
  const activePromoFromDB = useMemo(() => {
    const activeAssignment = allAssignments.find(
      (a) => a.client_id === clientId && a.status === 'active'
    );
    if (!activeAssignment) return undefined;
    return marketingPromotions.find((p) => p.id === activeAssignment.promotion_id);
  }, [allAssignments, clientId, marketingPromotions]);

  // Get loyalty programs for this client — 100% DB-backed via promotion_counters table.
  const clientLoyaltyPrograms = useMemo(() => {
    return dbCounters.map((dc) => ({
      id: dc.id,
      promotionId: dc.promotion_id,
      currentCount: dc.current_count,
      targetCount: dc.required_count,
      isCompleted: dc.is_completed,
      createdAt: new Date(dc.started_at),
      history: [], // history loaded on-demand via useCounterRedemptions
      // Augment with promotion metadata from Zustand cache (hydrated from Supabase)
      promotion: marketingPromotions.find((p) => p.id === dc.promotion_id) ?? {
        id: dc.promotion_id ?? dc.id,
        name: dc.promotion_title,
        color: dc.promotion_color ?? '',
        discountType: 'free_service',
        discountValue: 0,
        isActive: true,
      },
      // Flag so the UI knows this is DB-backed
      _isDbBacked: true as const,
    }));
  }, [dbCounters, marketingPromotions]);

  // Unified promo summary for the feature card
  // Only show non-counter (non-free_service) assignments in the Marketing Promo card
  const assignedPromoNames = useMemo(() => {
    return clientAssignments
      .filter((a) => {
        const promo = marketingPromotions.find((p) => p.id === a.promotion_id);
        return promo?.discountType !== 'free_service';
      })
      .map((a) => marketingPromotions.find((p) => p.id === a.promotion_id)?.name)
      .filter((n): n is string => !!n);
  }, [clientAssignments, marketingPromotions]);

  // Get visits with promotions used
  const visitsWithPromotions = useMemo(() => {
    if (!displayClient) return [];
    return displayClient.visits.filter((v) => v.promotionUsed);
  }, [displayClient]);

  // Auto-populate service tags from visit history
  const clientTags = useMemo(() => {
    if (!displayClient) return [];
    // Get all unique service IDs from all visits
    const serviceIdsFromHistory = new Set<string>();
    displayClient.visits.forEach((visit) => {
      visit.services.forEach((serviceId) => {
        serviceIdsFromHistory.add(serviceId);
      });
    });
    // Return matching service tags
    return serviceTags.filter((tag) => serviceIdsFromHistory.has(tag.id));
  }, [displayClient, serviceTags]);

  // Get staff members filtered by selected store for appointment editing
  const filteredStaffForAppointment = useMemo(() => {
    if (!editAppointmentStoreId) return staffMembers;
    return staffMembers.filter((s) => {
      // Check both legacy storeId and new storeIds array
      if (s.storeIds && s.storeIds.length > 0) {
        return s.storeIds.includes(editAppointmentStoreId);
      }
      return s.storeId === editAppointmentStoreId;
    });
  }, [staffMembers, editAppointmentStoreId]);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Only block render if loading AND no cached data is available yet
  if (isLoadingClient && !displayClient) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  if (!displayClient) {
    console.log('[ClientDetailScreen] Client not found:', clientId);
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textTertiary }}>{t('noClientsFound', language)}</Text>
        <Button title={t('cancel', language)} onPress={onBack} variant="ghost" className="mt-4" />
      </View>
    );
  }

  const handleArchive = () => {
    if (displayClient.isArchived) {
      unarchiveClient(displayClient.id);
    } else {
      setShowArchiveModal(true);
    }
  };

  const handleConfirmArchive = async () => {
    if (!displayClient) return;
    setIsArchiving(true);
    try {
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayClient.id);
      if (isValidUUID) {
        await deleteClientMutation.mutateAsync(displayClient.id);
      }
      deleteClientLocal(displayClient.id);
      setShowArchiveModal(false);
      onBack();
    } catch (error) {
      console.error('[ClientDetailScreen] Error archiving client:', error);
      setIsArchiving(false);
    }
  };

  const openEditVisit = (visit: Visit) => {
    setEditingVisit(visit);
    setEditVisitNotes(visit.notes || '');
    setEditVisitAmount(visit.amount?.toString() || '');
    setEditVisitServices(visit.services);
    setEditVisitDate(new Date(visit.date));
    setShowEditVisitDatePicker(false);
    setEditVisitStaffId(visit.staffId || null);
    setEditVisitStoreId(visit.storeId || null);
    setShowEditVisitModal(true);
  };

  const handleSaveVisitEdit = async () => {
    if (!editingVisit) return;

    // Update visit in Supabase (visits are stored as appointments)
    // The visit ID is the appointment ID in Supabase
    try {
      console.log('[ClientDetailScreen] Updating visit in Supabase:', editingVisit.id);

      // Calculate new start_at and end_at from the edited date
      const startAt = new Date(editVisitDate);
      startAt.setHours(9, 0, 0, 0); // Default to 9 AM
      const endAt = new Date(startAt);
      endAt.setHours(10, 0, 0, 0); // 1 hour duration

      await updateAppointmentMutation.mutateAsync({
        appointmentId: editingVisit.id,
        updates: {
          start_at: startAt,
          end_at: endAt,
          notes: editVisitNotes || undefined,
          amount: editVisitAmount ? parseFloat(editVisitAmount) : undefined,
          staff_id: editVisitStaffId || undefined,
          store_id: editVisitStoreId || undefined,
          // Store service IDs in service_tags column as backup
          service_tags: editVisitServices.length > 0 ? editVisitServices : undefined,
        },
      });

      // Sync services to appointment_services junction table
      if (editVisitServices.length > 0) {
        console.log('[ClientDetailScreen] Syncing services for visit:', editingVisit.id, editVisitServices);
        try {
          await syncServicesMutation.mutateAsync({
            appointmentId: editingVisit.id,
            serviceIds: editVisitServices,
          });
        } catch (syncError) {
          console.log('[ClientDetailScreen] Service sync failed (non-blocking):', syncError);
        }
      }

      // Fire-and-forget: notify client of updated visit
      notifyAppointmentEmail(editingVisit.id, 'updated');
      showSaveConfirmation();
      setShowEditVisitModal(false);
      setEditingVisit(null);
    } catch (error) {
      console.error('[ClientDetailScreen] Error updating visit:', error);
      // Fallback to show error but still close modal
      showSuccess(t('toastUpdateFailed', language));
      setShowEditVisitModal(false);
      setEditingVisit(null);
    }
  };

  const toggleEditVisitService = (tagId: string) => {
    setEditVisitServices((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Appointment editing functions
  // Accept extended appointment type that includes serviceTags, serviceId, servicePrice from convertToLocalAppointment
  const openEditAppointment = (appointment: LocalAppointment) => {
    setEditingAppointment(appointment);
    setEditAppointmentDate(new Date(appointment.date));
    setEditAppointmentTime(appointment.startTime);
    setEditAppointmentEndTime(appointment.endTime || '');
    setEditAppointmentNotes(appointment.notes || '');
    setEditAppointmentCurrency(appointment.currency || currency);
    setEditAppointmentPromotionId(appointment.promotionId || null);

    // Auto-select Store using appointment.storeId
    // Fall back to first store if appointment has no store
    const storeToUse = appointment.storeId || (stores.length > 0 ? stores[0].id : null);
    setEditAppointmentStoreId(storeToUse);

    // Auto-select Staff Member using appointment.staffId
    setEditAppointmentStaffId(appointment.staffId || null);

    // Auto-select Services:
    // 1. Use serviceId if available (direct column)
    // 2. Fall back to serviceTags (from appointment_services junction)
    // 3. Fall back to matching by title
    let selectedServices: string[] = [];
    if (appointment.serviceId) {
      selectedServices = [appointment.serviceId];
    } else if (appointment.serviceTags && appointment.serviceTags.length > 0) {
      selectedServices = appointment.serviceTags;
    } else if (appointment.title) {
      // Fallback: parse services from title string
      selectedServices = serviceTags
        .filter((tag) => appointment.title?.includes(tag.name))
        .map((t) => t.id);
    }
    setEditAppointmentServices(selectedServices);

    // Auto-populate Amount:
    // 1. Use appointment.servicePrice if available (already converted from cents to dollars)
    // 2. Fall back to appointment.amount
    // 3. Fall back to sum of selected service prices (price_cents / 100)
    let amountToUse = '';
    if (appointment.servicePrice != null && appointment.servicePrice > 0) {
      // servicePrice is already in dollars (converted from cents in convertToLocalAppointment)
      amountToUse = appointment.servicePrice.toFixed(2);
    } else if (appointment.amount && appointment.amount > 0) {
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
    setEditAppointmentAmount(amountToUse);

    // Reset picker states
    setShowEditAppointmentDatePicker(false);
    setShowEditAppointmentStorePicker(false);
    setShowEditAppointmentStaffPicker(false);
    setShowEditAppointmentPromotionPicker(false);
    setShowEditAppointmentCurrencyPicker(false);
  };

  const handleSaveAppointmentEdit = async () => {
    if (!editingAppointment) return;

    // Build title from selected services
    const selectedTagNames = editAppointmentServices
      .map((id) => serviceTags.find((t) => t.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    // Use the selected store, or the first available store if none selected
    const storeIdToUse = editAppointmentStoreId || (stores.length > 0 ? stores[0].id : undefined);

    // Build start_at and end_at Date objects from edit state
    const [startHour, startMin] = editAppointmentTime.split(':').map(Number);
    const startAt = new Date(editAppointmentDate);
    startAt.setHours(startHour ?? 9, startMin ?? 0, 0, 0);

    const [endHour, endMin] = (editAppointmentEndTime || '10:00').split(':').map(Number);
    const endAt = new Date(editAppointmentDate);
    endAt.setHours(endHour ?? 10, endMin ?? 0, 0, 0);

    try {
      // 1. Write to Supabase DB first — ensures the backend reads fresh data when emailing
      await updateAppointmentMutation.mutateAsync({
        appointmentId: editingAppointment.id,
        updates: {
          title: selectedTagNames || editingAppointment.title,
          start_at: startAt,
          end_at: endAt,
          notes: editAppointmentNotes || undefined,
          amount: editAppointmentAmount ? parseFloat(editAppointmentAmount) : undefined,
          currency: editAppointmentCurrency || currency,
          staff_id: editAppointmentStaffId || null,
          promo_id: editAppointmentPromotionId || null,
        },
      });
    } catch {
      // DB write failed — still update local Zustand state for UI responsiveness
    }

    // 2. Update local Zustand state for immediate UI
    updateAppointment(editingAppointment.id, {
      date: editAppointmentDate,
      startTime: editAppointmentTime,
      endTime: editAppointmentEndTime || undefined,
      notes: editAppointmentNotes || undefined,
      amount: editAppointmentAmount ? parseFloat(editAppointmentAmount) : undefined,
      currency: editAppointmentCurrency || currency,
      storeId: storeIdToUse,
      staffId: editAppointmentStaffId || undefined,
      promotionId: editAppointmentPromotionId || undefined,
      title: selectedTagNames || editingAppointment.title,
    });

    // 3. Now safe to notify — DB write has committed
    notifyAppointmentEmail(editingAppointment.id, 'updated');
    showSaveConfirmation();
    // Reset all edit states first
    setShowEditAppointmentDatePicker(false);
    setShowEditAppointmentStorePicker(false);
    setShowEditAppointmentStaffPicker(false);
    setShowEditAppointmentPromotionPicker(false);
    setShowEditAppointmentCurrencyPicker(false);
    setEditingAppointment(null);
  };

  const handleCloseAppointmentsModal = () => {
    // Always reset the edit state when closing appointments modal
    // This ensures no stale state remains
    setShowEditAppointmentDatePicker(false);
    setShowEditAppointmentStorePicker(false);
    setShowEditAppointmentStaffPicker(false);
    setShowEditAppointmentPromotionPicker(false);
    setEditingAppointment(null);
    // Finally close the appointments modal
    setShowAppointmentsModal(false);
  };

  const toggleEditAppointmentService = (tagId: string) => {
    setEditAppointmentServices((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable onPress={onBack} className="p-2 -ml-2 active:opacity-60">
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '600', marginLeft: 8 }}>
            {t('clientDetails', language)}
          </Text>
          <Pressable onPress={onEdit} className="p-2 active:opacity-60">
            <Edit3 size={20} color={primaryColor} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <ClientProfileCard
          client={displayClient}
          initials={getInitials(displayClient.name)}
          language={language}
          colors={colors}
          isDark={isDark}
          primaryColor={primaryColor}
          buttonColor={buttonColor}
          dateLocale={dateLocale}
          onEmailPress={() => setShowEmailModal(true)}
        />

        {/* Stats */}
        <ClientStatsCards
          totalVisitCount={totalVisitCount}
          promotionsUsedCount={promotionsUsedDisplay.length}
          language={language}
          colors={colors}
          primaryColor={primaryColor}
          onAppointmentsPress={() => setShowAppointmentsModal(true)}
          onPromotionsPress={() => setShowPromotionsModal(true)}
        />

        {/* Feature Cards */}
        <ClientFeatureCards
          clientMembership={clientMembership}
          totalGiftCardBalance={totalGiftCardBalance}
          currency={currency}
          assignedPromoNames={assignedPromoNames}
          assignedCampaign={assignedCampaign}
          loyaltySettings={loyaltySettings}
          clientLoyaltyData={clientLoyaltyData}
          availableRewards={availableRewards}
          loyaltyRewards={loyaltyRewards}
          language={language}
          colors={colors}
          isDark={isDark}
          primaryColor={primaryColor}
          onOpenMembership={() => setShowMembershipInfoModal(true)}
          onOpenGiftCard={() => setShowGiftCardModal(true)}
          onOpenPromo={() => setShowPromoPicker(true)}
          onOpenCampaign={() => setShowCampaignPicker(true)}
          onOpenLoyaltyEnroll={() => setShowLoyaltyConfirmModal(true)}
          onOpenLoyalty={() => setShowLoyaltyModal(true)}
          onSetLoyaltyConfirmPending={(value) => setLoyaltyConfirmPending(value)}
        />

        {/* Visit History */}
        <ClientVisitHistorySection
          visits={displayClient.visits}
          serviceTags={serviceTags}
          promotions={marketingPromotions.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
          language={language}
          colors={colors}
          isDark={isDark}
          primaryColor={primaryColor}
          currency={currency}
          dateLocale={dateLocale}
          onEditVisit={openEditVisit}
          onAddVisit={() => setShowAddVisitModal(true)}
        />

        {/* Actions */}
        <ClientActionButtons
          isArchived={displayClient.isArchived}
          language={language}
          colors={colors}
          isDark={isDark}
          primaryColor={primaryColor}
          onArchive={handleArchive}
        />

        {/* View Full Timeline */}
        <Pressable
          onPress={() => setShowTimelineModal(true)}
          style={{
            marginHorizontal: 16,
            marginBottom: 16,
            marginTop: 0,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Clock size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
            View Full Timeline
          </Text>
        </Pressable>
      </ScrollView>

      {/* Campaign Picker Modal */}
      <Modal
        visible={showCampaignPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCampaignPicker(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Modal Header */}
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
            <View className="flex-row items-center">
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Zap size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('selectCampaign', language)}</Text>
            </View>
            <Pressable
              onPress={() => setShowCampaignPicker(false)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          {/* Tabs */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.background, gap: 8 }}>
            <Pressable
              onPress={() => setCampaignPickerTab('campaigns')}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: campaignPickerTab === 'campaigns' ? (isDark ? colors.card : '#fff') : 'transparent',
                borderWidth: campaignPickerTab === 'campaigns' ? 1 : 0,
                borderColor: campaignPickerTab === 'campaigns' ? colors.border : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: campaignPickerTab === 'campaigns' ? 0.08 : 0,
                shadowRadius: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Mail size={15} color={campaignPickerTab === 'campaigns' ? primaryColor : colors.textTertiary} />
                <Text style={{ marginLeft: 6, fontWeight: '600', fontSize: 14, color: campaignPickerTab === 'campaigns' ? primaryColor : colors.textTertiary }}>
                  {t('campaigns', language) || 'Campaigns'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setCampaignPickerTab('templates')}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: campaignPickerTab === 'templates' ? (isDark ? colors.card : '#fff') : 'transparent',
                borderWidth: campaignPickerTab === 'templates' ? 1 : 0,
                borderColor: campaignPickerTab === 'templates' ? colors.border : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: campaignPickerTab === 'templates' ? 0.08 : 0,
                shadowRadius: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Sparkles size={15} color={campaignPickerTab === 'templates' ? primaryColor : colors.textTertiary} />
                <Text style={{ marginLeft: 6, fontWeight: '600', fontSize: 14, color: campaignPickerTab === 'templates' ? primaryColor : colors.textTertiary }}>
                  {t('templates', language) || 'Templates'}
                </Text>
              </View>
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {campaignPickerTab === 'campaigns' ? (
              <>
                {/* No Campaign Option */}
                <Pressable
                  onPress={() => {
                    assignClientToDrip(clientId, undefined);
                    if (businessId) persistClientDripAssignment(clientId, null, businessId).catch(() => {});
                    setShowCampaignPicker(false);
                  }}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={20} color={colors.textSecondary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text style={{ color: colors.text, fontWeight: '500' }}>{t('noCampaign', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{t('removeFromAllCampaigns', language)}</Text>
                  </View>
                  {!displayClient.dripCampaignId && <Check size={20} color={primaryColor} />}
                </Pressable>

                {/* Campaign List */}
                {dripCampaigns.length > 0 ? (
                  dripCampaigns.map((campaign) => (
                    <Pressable
                      key={campaign.id}
                      onPress={() => {
                        assignClientToDrip(clientId, campaign.id);
                        if (businessId) persistClientDripAssignment(clientId, campaign.id, businessId).catch(() => {});
                        setShowCampaignPicker(false);
                      }}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                      }}
                    >
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: `${campaign.color}15` }}
                      >
                        <Mail size={20} color={campaign.color} />
                      </View>
                      <View className="flex-1 ml-3">
                        <View className="flex-row items-center">
                          <Text style={{ color: colors.text, fontWeight: '500' }}>{campaign.name}</Text>
                          {campaign.isActive ? (
                            <View className="bg-emerald-100 px-1.5 py-0.5 rounded ml-2">
                              <Text className="text-emerald-600 text-xs font-medium">{t('active', language)}</Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: isDark ? '#F9731630' : '#FFF7ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                              <Text className="text-orange-600 text-xs font-medium">{t('paused', language)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                          {t('emailsInSequence', language).replace('{count}', String(campaign.emails.length))}
                        </Text>
                      </View>
                      {displayClient.dripCampaignId === campaign.id && <Check size={20} color={primaryColor} />}
                    </Pressable>
                  ))
                ) : (
                  <View className="items-center py-8">
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <Mail size={32} color={colors.textTertiary} />
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>{t('noCampaignsYet', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                      {t('createCampaignFromDashboard', language)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Official Templates Header */}
                <Animated.View entering={FadeInDown.delay(50).duration(300)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Shield size={16} color={primaryColor} />
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                      {t('dripOfficialTemplates', language) || 'Official Templates'}
                    </Text>
                    <View style={{ marginLeft: 8, backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                      <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>
                        {OFFICIAL_TEMPLATES.length} {t('dripTemplatesAvailable', language) || 'available'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {OFFICIAL_TEMPLATES.map((template: SmartDripTemplate, index: number) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    UserPlus: <UserPlus size={20} color={primaryColor} />,
                    TrendingUp: <TrendingUp size={20} color={primaryColor} />,
                    AlertCircle: <AlertCircle size={20} color={primaryColor} />,
                    Tag: <Tag size={20} color={primaryColor} />,
                    DollarSign: <DollarSign size={20} color={primaryColor} />,
                    Target: <Target size={20} color={primaryColor} />,
                    Mail: <Mail size={20} color={primaryColor} />,
                    Heart: <Heart size={20} color={primaryColor} />,
                    Star: <Star size={20} color={primaryColor} />,
                    Calendar: <Calendar size={20} color={primaryColor} />,
                    MessageSquare: <MessageSquare size={20} color={primaryColor} />,
                  };

                  return (
                    <Animated.View
                      key={template.id}
                      entering={FadeInDown.delay(100 + index * 40).duration(300)}
                    >
                      <Pressable
                        onPress={() => {
                          // Create campaign from template
                          const dripFrequency = template.defaultFrequency === 'once' ? 'weekly' : (template.defaultFrequency ?? 'monthly');
                          const campaignData = {
                            name: t(template.nameKey, language),
                            color: template.color || primaryColor,
                            emails: template.emails.map((email: SmartDripTemplate['emails'][number], i: number) => ({
                              id: `${Date.now()}-${i}`,
                              subject: t(email.subjectKey, language),
                              body: t(email.bodyKey, language),
                              delayDays: email.delayDays,
                              attachments: [],
                            })),
                            frequency: dripFrequency as 'weekly' | 'biweekly' | 'monthly' | 'custom',
                            customDays: template.defaultCustomDays,
                            isActive: false,
                            isEuEnabled: false,
                          };
                          addDripCampaign(campaignData);
                          // Sync to Supabase then assign client
                          if (businessId) {
                            setTimeout(() => {
                              const newCampaign = useStore.getState().dripCampaigns.find(
                                (c) => c.name === campaignData.name
                              );
                              if (newCampaign) {
                                syncCampaignToSupabase(newCampaign, businessId).catch(() => {});
                                assignClientToDrip(clientId, newCampaign.id);
                                persistClientDripAssignment(clientId, newCampaign.id, businessId).catch(() => {});
                              }
                            }, 50);
                          }
                          setShowCampaignPicker(false);
                        }}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 14,
                          padding: 14,
                          marginBottom: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: colors.border,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 6,
                        }}
                      >
                        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`, alignItems: 'center', justifyContent: 'center' }}>
                          {iconMap[template.icon] ?? <Zap size={20} color={primaryColor} />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                            {t(template.nameKey, language)}
                          </Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            {t(template.descKey, language)}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>
                            {'Use'}
                          </Text>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Visits Modal */}
      <AppointmentsModal
        visible={showVisitsModal}
        visits={displayClient.visits}
        serviceTags={serviceTags}
        marketingPromotions={marketingPromotions}
        stores={stores}
        staffMembers={staffMembers}
        language={language}
        colors={colors}
        isDark={isDark}
        primaryColor={primaryColor}
        currency={currency}
        dateLocale={dateLocale}
        onClose={() => setShowVisitsModal(false)}
      />

      {/* Promotions Modal */}
      <PromotionsUsedModal
        visible={showPromotionsModal}
        promotionsUsed={promotionsUsedDisplay}
        language={language}
        colors={colors}
        isDark={isDark}
        primaryColor={primaryColor}
        currency={currency}
        dateLocale={dateLocale}
        onClose={() => setShowPromotionsModal(false)}
      />

      {/* Send Email Modal */}
      <SendEmailModal
        visible={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        client={displayClient}
      />

      {/* Unified Client Promotions Modal — replaces old PromoPicker + Counter List */}
      <ClientPromotionsModal
        visible={showPromoPicker}
        onClose={() => setShowPromoPicker(false)}
        clientId={clientId}
        language={language}
        colors={colors}
        isDark={isDark}
        primaryColor={primaryColor}
        currency={currency}
        clientAssignments={clientAssignments}
        marketingPromotions={marketingPromotions}
        clientLoyaltyPrograms={clientLoyaltyPrograms}
        clientPromotionsUsed={clientPromotionsUsed}
        onAssignPromo={(promoId) => {
          assignPromoToDB(clientId, promoId).then(() => showSaveConfirmation()).catch(() => {});
        }}
        onPausePromo={(promoId) => pausePromoInDB(clientId, promoId)}
        onResumePromo={(promoId) => resumePromoInDB(clientId, promoId)}
        onRemovePromo={(promoId) => {
          removePromoFromDB(clientId, promoId);
        }}
        onOpenAddCounter={() => {
          setShowPromoPicker(false);
          setShowAddPromotionCounterModal(true);
        }}
        onAddCount={(counterId) => {
          setPendingCounterId(counterId);
          setAddCountServiceId(null);
          setAddCountStoreId(null);
          setAddCountStaffId(null);
          setAddCountDate(new Date());
          setAddCountNote('');
          setShowPromoPicker(false);
          setTimeout(() => setShowAddCountModal(true), 350);
        }}
        onViewHistory={(counterId) => {
          setActiveCounterId(counterId);
          setShowRedemptionDetailsModal(true);
        }}
        onDeleteCounter={async (counterId) => {
          await deleteCounterMutation.mutateAsync(counterId);
        }}
      />

      {/* Add Promotion Counter Modal */}
      <Modal
        visible={showAddPromotionCounterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddPromotionCounterModal(false);
          setTimeout(() => setShowPromoPicker(true), 350);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Award size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
                {t('newPromoCounter', language)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setShowAddPromotionCounterModal(false);
                setTimeout(() => setShowPromoPicker(true), 350);
              }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {/* Counter Name */}
            <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
              {t('name', language)}
            </Text>
            <TextInput
              value={counterName}
              onChangeText={setCounterName}
              placeholder="e.g. Haircut Loyalty Card"
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                marginBottom: 20,
              }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              autoFocus
            />

            {/* Target Count */}
            <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('targetCount', language)}</Text>
            <TextInput
              value={counterTargetCount}
              onChangeText={setCounterTargetCount}
              placeholder="5"
              keyboardType="number-pad"
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                marginBottom: 8,
              }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
            />
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              {t('targetCountHint', language)}
            </Text>

            {/* Save Button */}
            <Pressable
              onPress={async () => {
                const name = counterName.trim();
                if (!name) return;
                const bId = businessId;
                if (!bId) return;
                setCounterSaveError(null);
                setIsSavingCounter(true);
                try {
                  const targetCount = parseInt(counterTargetCount) || 5;
                  // Backend creates the free_service promotion + counter atomically
                  const counterResult = await createCounterMutation.mutateAsync({
                    business_id: bId,
                    client_id: clientId,
                    promotion_name: name,
                    required_count: targetCount,
                  });
                  if (counterResult.error) {
                    setCounterSaveError(counterResult.error.message);
                    return;
                  }
                  // Success — show confirmation overlay, then return to Promotions
                  showSaveConfirmation();
                  setShowAddPromotionCounterModal(false);
                  setTimeout(() => setShowPromoPicker(true), 350);
                  setCounterName('');
                  setCounterTargetCount('5');
                } catch (err) {
                  setCounterSaveError(err instanceof Error ? err.message : 'Save failed');
                } finally {
                  setIsSavingCounter(false);
                }
              }}
              disabled={isSavingCounter || !counterName.trim()}
              style={{
                marginTop: 24,
                backgroundColor: counterName.trim() ? primaryColor : colors.border,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              {isSavingCounter
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('save', language)}</Text>
              }
            </Pressable>
            {counterSaveError ? (
              <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 10 }}>
                {counterSaveError}
              </Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ============================================================
          Add Count Modal — DB-backed, requires service selection
          ============================================================ */}
      <Modal
        visible={showAddCountModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddCountModal(false);
          setTimeout(() => setShowPromoPicker(true), 350);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Plus size={18} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('addCount', language)}</Text>
            </View>
            <Pressable
              onPress={() => {
                setShowAddCountModal(false);
                setTimeout(() => setShowPromoPicker(true), 350);
              }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {/* Store — optional */}
            {supabaseStores.length > 0 && (
              <>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('storeOptional', language)}</Text>
                <View style={{ marginBottom: 20 }}>
                  <Pressable
                    onPress={() => { setAddCountStoreId(null); setAddCountStaffId(null); }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: addCountStoreId === null ? 2 : 1, borderColor: addCountStoreId === null ? primaryColor : colors.border }}
                  >
                    <Text style={{ flex: 1, color: colors.textSecondary, fontWeight: '500' }}>—</Text>
                    {addCountStoreId === null && <Check size={18} color={primaryColor} />}
                  </Pressable>
                  {supabaseStores.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => { setAddCountStoreId(s.id); setAddCountStaffId(null); }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: addCountStoreId === s.id ? 2 : 1, borderColor: addCountStoreId === s.id ? primaryColor : colors.border }}
                    >
                      <StoreIcon size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
                      <Text style={{ flex: 1, color: colors.text, fontWeight: '500' }}>{s.name}</Text>
                      {addCountStoreId === s.id && <Check size={18} color={primaryColor} />}
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Service — REQUIRED */}
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('serviceRequired', language)} <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <View style={{ marginBottom: 20 }}>
              {serviceTags.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => { setAddCountServiceId(s.id); setAddCountStaffId(null); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: addCountServiceId === s.id ? 2 : 1, borderColor: addCountServiceId === s.id ? primaryColor : colors.border }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color || primaryColor, marginRight: 12 }} />
                  <Text style={{ flex: 1, color: colors.text, fontWeight: '500' }}>{s.name}</Text>
                  {addCountServiceId === s.id && <Check size={18} color={primaryColor} />}
                </Pressable>
              ))}
              {serviceTags.length === 0 && (
                <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>{t('noServicesAvailable', language)}</Text>
              )}
            </View>

            {/* Staff — optional, filtered by selected service (and store if set) */}
            {supabaseStaff.length > 0 && (
              <>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('staffOptional', language)}</Text>
                <View style={{ marginBottom: 20 }}>
                  <Pressable
                    onPress={() => setAddCountStaffId(null)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: addCountStaffId === null ? 2 : 1, borderColor: addCountStaffId === null ? primaryColor : colors.border }}
                  >
                    <Text style={{ flex: 1, color: colors.textSecondary, fontWeight: '500' }}>—</Text>
                    {addCountStaffId === null && <Check size={18} color={primaryColor} />}
                  </Pressable>
                  {(() => {
                    const filtered = supabaseStaff.filter((st) => {
                      const serviceMatch = !addCountServiceId || (st.service_ids ?? []).includes(addCountServiceId);
                      const storeMatch = !addCountStoreId || (st.store_ids ?? []).includes(addCountStoreId);
                      return serviceMatch && storeMatch;
                    });
                    if (filtered.length === 0 && (addCountServiceId || addCountStoreId)) {
                      return (
                        <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', paddingVertical: 12 }}>
                          {t('noStaffMembers', language)}
                        </Text>
                      );
                    }
                    return filtered.map((st) => (
                      <Pressable
                        key={st.id}
                        onPress={() => setAddCountStaffId(st.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: addCountStaffId === st.id ? 2 : 1, borderColor: addCountStaffId === st.id ? primaryColor : colors.border }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: st.color || primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
                          {st.avatar_url || st.photo_url ? (
                            <Image source={{ uri: st.avatar_url || st.photo_url || '' }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                          ) : (
                            <User size={16} color="#fff" />
                          )}
                        </View>
                        <Text style={{ flex: 1, color: colors.text, fontWeight: '500' }}>{st.full_name ?? t('staff', language)}</Text>
                        {addCountStaffId === st.id && <Check size={18} color={primaryColor} />}
                      </Pressable>
                    ));
                  })()}
                </View>
              </>
            )}

            {/* Date */}
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('date', language).toUpperCase()}</Text>
            <View style={{ marginBottom: 20 }}>
              <WheelDatePicker
                label={t('date', language)}
                value={addCountDate}
                onChange={(d) => setAddCountDate(d)}
                isOpen={addCountDatePickerOpen}
                onToggle={() => setAddCountDatePickerOpen((v) => !v)}
                maximumDate={new Date()}
              />
            </View>

            {/* Note — optional */}
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('noteOptional', language)}</Text>
            <TextInput
              value={addCountNote}
              onChangeText={setAddCountNote}
              placeholder={t('optional', language) + '...'}
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder, minHeight: 80, textAlignVertical: 'top' }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
            />

            {/* Save Button */}
            <Pressable
              onPress={async () => {
                if (!addCountServiceId) {
                  Alert.alert(t('addCountRequired', language), t('selectServiceForCount', language));
                  return;
                }
                if (!pendingCounterId || !supabaseClient?.business_id) return;
                setIsSavingAddCount(true);
                try {
                  const result = await addCounterRedemptionMutation.mutateAsync({
                    counterId: pendingCounterId,
                    input: {
                      business_id: supabaseClient.business_id,
                      client_id: clientId,
                      service_id: addCountServiceId,
                      store_id: addCountStoreId || null,
                      staff_id: addCountStaffId || null,
                      redeemed_at: addCountDate.toISOString(),
                      note: addCountNote.trim() || null,
                    },
                  });
                  if (result.error) {
                    Alert.alert(t('error', language), result.error.message);
                    return;
                  }
                  setShowAddCountModal(false);
                  setPendingCounterId(null);
                  setAddCountServiceId(null);
                  setAddCountStoreId(null);
                  setAddCountStaffId(null);
                  setAddCountDate(new Date());
                  setAddCountNote('');
                  setTimeout(() => setShowPromoPicker(true), 350);
                } finally {
                  setIsSavingAddCount(false);
                }
              }}
              style={{ marginTop: 24, backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: isSavingAddCount ? 0.7 : 1 }}
            >
              {isSavingAddCount ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('save', language)}</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ============================================================
          Redemption Details Modal — shows full history, tappable to edit
          ============================================================ */}
      <Modal
        visible={showRedemptionDetailsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowRedemptionDetailsModal(false); setActiveCounterId(null); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => { setShowRedemptionDetailsModal(false); setActiveCounterId(null); }}>
              <X size={22} color={colors.textSecondary} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('countHistory', language)}</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {isLoadingRedemptions ? (
              <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} />
            ) : activeCounterRedemptions.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Clock size={40} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 16 }}>{t('noHistoryYet', language)}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 4 }}>{t('addCountsToSeeHere', language)}</Text>
              </View>
            ) : (
              activeCounterRedemptions.map((r, idx) => {
                const service = serviceTags.find((s) => s.id === r.service_id);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setSelectedRedemption(r);
                      setEditRedServiceId(r.service_id);
                      setEditRedStoreId(r.store_id);
                      setEditRedStaffId(r.staff_id);
                      setEditRedDate(new Date(r.redeemed_at));
                      setEditRedNote(r.note ?? '');
                      setShowEditRedemptionModal(true);
                    }}
                    style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View style={{ flex: 1 }}>
                        <View className="flex-row items-center mb-1">
                          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                            {t('countNumber', language)}{activeCounterRedemptions.length - idx}
                          </Text>
                          {r.edited_at && (
                            <View style={{ backgroundColor: '#F59E0B20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 }}>
                              <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '600' }}>{t('editedBadge', language)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
                          {capitalizeDate(format(new Date(r.redeemed_at), 'MMM d, yyyy', { locale: dateLocale }))}
                        </Text>
                        {(r.service_name ?? service?.name) && (
                          <View className="flex-row items-center">
                            <Tag size={12} color={primaryColor} />
                            <Text style={{ color: primaryColor, fontSize: 13, marginLeft: 4 }}>{r.service_name ?? service?.name}</Text>
                          </View>
                        )}
                        {r.store_name && (
                          <View className="flex-row items-center mt-1">
                            <StoreIcon size={12} color={colors.textTertiary} />
                            <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 4 }}>{r.store_name}</Text>
                          </View>
                        )}
                        {r.staff_name && (
                          <View className="flex-row items-center mt-1">
                            <User size={12} color={colors.textTertiary} />
                            <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 4 }}>{r.staff_name}</Text>
                          </View>
                        )}
                        {r.note && (
                          <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, fontStyle: 'italic' }}>"{r.note}"</Text>
                        )}
                        {r.edited_at && r.edited_by_name && (
                          <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 6 }}>
                            {t('editedBy', language)} {r.edited_by_name} · {format(new Date(r.edited_at), 'MMM d, yyyy', { locale: dateLocale })}
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={16} color={colors.textTertiary} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ============================================================
          Edit Redemption Modal — audit trail preserved
          ============================================================ */}
      <Modal
        visible={showEditRedemptionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditRedemptionModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setShowEditRedemptionModal(false)} className="py-2">
              <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>{t('cancel', language)}</Text>
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('editCount', language)}</Text>
            <Pressable
              onPress={async () => {
                if (!selectedRedemption || !supabaseClient?.business_id) return;
                setIsSavingEditRedemption(true);
                try {
                  const result = await editCounterRedemptionMutation.mutateAsync({
                    redemptionId: selectedRedemption.id,
                    input: {
                      service_id: editRedServiceId,
                      store_id: editRedStoreId,
                      staff_id: editRedStaffId,
                      redeemed_at: editRedDate.toISOString(),
                      note: editRedNote.trim() || null,
                      edited_by_name: supabaseClient.name ?? t('owner', language),
                    },
                  });
                  if (result.error) {
                    Alert.alert(t('error', language), result.error.message);
                    return;
                  }
                  // Fire-and-forget correction email
                  notifyTransactionalEmail({
                    business_id: supabaseClient.business_id,
                    client_id: clientId,
                    event_type: 'promotion_counter_reward',
                    promo_title: clientLoyaltyPrograms.find((cp) => cp.id === activeCounterId)?.promotion?.name,
                    counter_current: dbCounters.find((c) => c.id === activeCounterId)?.current_count ?? 0,
                    counter_target: dbCounters.find((c) => c.id === activeCounterId)?.required_count ?? 5,
                    counter_service_name: serviceTags.find((s) => s.id === editRedServiceId)?.name,
                    counter_is_edit: true,
                  });
                  setShowEditRedemptionModal(false);
                  showSuccess(t('countUpdated', language));
                } finally {
                  setIsSavingEditRedemption(false);
                }
              }}
              disabled={isSavingEditRedemption}
              className="py-2"
            >
              {isSavingEditRedemption ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 16 }}>{t('save', language)}</Text>
              )}
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {/* Show audit trail if this has been edited before */}
            {selectedRedemption?.original_snapshot && (
              <View style={{ backgroundColor: '#F59E0B10', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#F59E0B30' }}>
                <Text style={{ color: '#F59E0B', fontWeight: '600', fontSize: 13, marginBottom: 6 }}>{t('originalValues', language)}</Text>
                {selectedRedemption.original_snapshot.service_id && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {t('service', language)}: {serviceTags.find((s) => s.id === selectedRedemption.original_snapshot?.service_id)?.name ?? '—'}
                  </Text>
                )}
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {t('date', language)}: {format(new Date(selectedRedemption.original_snapshot.redeemed_at), 'MMM d, yyyy', { locale: dateLocale })}
                </Text>
                {selectedRedemption.original_snapshot.note && (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('note', language)}: {selectedRedemption.original_snapshot.note}</Text>
                )}
              </View>
            )}

            {/* Service */}
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('serviceRequired', language)}</Text>
            <View style={{ marginBottom: 20 }}>
              <Pressable
                onPress={() => setEditRedServiceId(null)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: editRedServiceId === null ? 2 : 1, borderColor: editRedServiceId === null ? primaryColor : colors.border }}
              >
                <Text style={{ flex: 1, color: colors.textSecondary, fontWeight: '500' }}>{t('noneLabel', language)}</Text>
                {editRedServiceId === null && <Check size={18} color={primaryColor} />}
              </Pressable>
              {serviceTags.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setEditRedServiceId(s.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: editRedServiceId === s.id ? 2 : 1, borderColor: editRedServiceId === s.id ? primaryColor : colors.border }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color || primaryColor, marginRight: 12 }} />
                  <Text style={{ flex: 1, color: colors.text, fontWeight: '500' }}>{s.name}</Text>
                  {editRedServiceId === s.id && <Check size={18} color={primaryColor} />}
                </Pressable>
              ))}
            </View>

            {/* Store */}
            {supabaseStores.length > 0 && (
              <>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('storeOptional', language)}</Text>
                <View style={{ marginBottom: 20 }}>
                  <Pressable
                    onPress={() => setEditRedStoreId(null)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: editRedStoreId === null ? 2 : 1, borderColor: editRedStoreId === null ? primaryColor : colors.border }}
                  >
                    <Text style={{ flex: 1, color: colors.textSecondary, fontWeight: '500' }}>{t('noneLabel', language)}</Text>
                    {editRedStoreId === null && <Check size={18} color={primaryColor} />}
                  </Pressable>
                  {supabaseStores.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setEditRedStoreId(s.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: editRedStoreId === s.id ? 2 : 1, borderColor: editRedStoreId === s.id ? primaryColor : colors.border }}
                    >
                      <StoreIcon size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
                      <Text style={{ flex: 1, color: colors.text, fontWeight: '500' }}>{s.name}</Text>
                      {editRedStoreId === s.id && <Check size={18} color={primaryColor} />}
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Staff */}
            {supabaseStaff.length > 0 && (
              <>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('staffOptional', language)}</Text>
                <View style={{ marginBottom: 20 }}>
                  <Pressable
                    onPress={() => setEditRedStaffId(null)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: editRedStaffId === null ? 2 : 1, borderColor: editRedStaffId === null ? primaryColor : colors.border }}
                  >
                    <Text style={{ flex: 1, color: colors.textSecondary, fontWeight: '500' }}>{t('noneLabel', language)}</Text>
                    {editRedStaffId === null && <Check size={18} color={primaryColor} />}
                  </Pressable>
                  {supabaseStaff.map((st) => (
                    <Pressable
                      key={st.id}
                      onPress={() => setEditRedStaffId(st.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, borderWidth: editRedStaffId === st.id ? 2 : 1, borderColor: editRedStaffId === st.id ? primaryColor : colors.border }}
                    >
                      <User size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
                      <Text style={{ flex: 1, color: colors.text, fontWeight: '500' }}>{st.full_name ?? t('staff', language)}</Text>
                      {editRedStaffId === st.id && <Check size={18} color={primaryColor} />}
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Date */}
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('date', language).toUpperCase()}</Text>
            <View style={{ marginBottom: 20 }}>
              <WheelDatePicker
                label="Date"
                value={editRedDate}
                onChange={(d) => setEditRedDate(d)}
                isOpen={editRedDatePickerOpen}
                onToggle={() => setEditRedDatePickerOpen((v) => !v)}
                maximumDate={new Date()}
              />
            </View>

            {/* Note */}
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8, letterSpacing: 0.5 }}>{t('noteOptional', language)}</Text>
            <TextInput
              value={editRedNote}
              onChangeText={setEditRedNote}
              placeholder={t('optional', language) + '...'}
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder, minHeight: 80, textAlignVertical: 'top' }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Visit Modal */}
      <AddVisitModal
        visible={showAddVisitModal}
        onClose={() => setShowAddVisitModal(false)}
        preSelectedClientId={clientId}
      />

      {/* Edit Visit Modal */}
      <Modal
        visible={showEditVisitModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditVisitModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Pressable
              onPress={() => setShowEditVisitModal(false)}
              className="py-2"
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>{t('cancel', language)}</Text>
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('editVisit', language)}</Text>
            <Pressable
              onPress={handleSaveVisitEdit}
              className="py-2"
            >
              <Text style={{ color: primaryColor, fontWeight: '600' }}>{t('save', language)}</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {editingVisit && (
              <>
                {/* Visit Date */}
                <View className="mb-4">
                  <WheelDatePicker
                    label={t('visitDate', language)}
                    value={editVisitDate}
                    onChange={setEditVisitDate}
                    isOpen={showEditVisitDatePicker}
                    onToggle={() => setShowEditVisitDatePicker(!showEditVisitDatePicker)}
                  />
                </View>

                {/* Services */}
                <View className="mb-4">
                  <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('services', language)}</Text>
                  <View className="flex-row flex-wrap">
                    {serviceTags.map((tag) => (
                      <Pressable
                        key={tag.id}
                        onPress={() => toggleEditVisitService(tag.id)}
                        className="px-3 py-1.5 rounded-full mr-2 mb-2"
                        style={{
                          backgroundColor: editVisitServices.includes(tag.id) ? `${primaryColor}20` : colors.card,
                          borderWidth: editVisitServices.includes(tag.id) ? 2 : 1,
                          borderColor: editVisitServices.includes(tag.id) ? primaryColor : colors.border,
                        }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{ color: editVisitServices.includes(tag.id) ? primaryColor : colors.textSecondary }}
                        >
                          {tag.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Store */}
                <View className="mb-4">
                  <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('selectStore', language)}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row">
                      {stores.map((store) => (
                        <Pressable
                          key={store.id}
                          onPress={() => setEditVisitStoreId(store.id)}
                          className="px-3 py-2 rounded-full mr-2 flex-row items-center"
                          style={{
                            backgroundColor: editVisitStoreId === store.id ? `${primaryColor}20` : colors.card,
                            borderWidth: editVisitStoreId === store.id ? 2 : 1,
                            borderColor: editVisitStoreId === store.id ? primaryColor : colors.border,
                          }}
                        >
                          <StoreIcon size={14} color={editVisitStoreId === store.id ? primaryColor : colors.textSecondary} />
                          <Text
                            className="text-sm font-medium ml-1.5"
                            style={{ color: editVisitStoreId === store.id ? primaryColor : colors.textSecondary }}
                          >
                            {getLocalizedStoreName(store.name, language)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Staff */}
                <View className="mb-4">
                  <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('staffMember', language)}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row">
                      <Pressable
                        onPress={() => setEditVisitStaffId(null)}
                        className="px-3 py-2 rounded-full mr-2 flex-row items-center"
                        style={{
                          backgroundColor: !editVisitStaffId ? `${primaryColor}20` : colors.card,
                          borderWidth: !editVisitStaffId ? 2 : 1,
                          borderColor: !editVisitStaffId ? primaryColor : colors.border,
                        }}
                      >
                        <User size={14} color={!editVisitStaffId ? primaryColor : colors.textSecondary} />
                        <Text
                          className="text-sm font-medium ml-1.5"
                          style={{ color: !editVisitStaffId ? primaryColor : colors.textSecondary }}
                        >
                          {t('noStaffAssigned', language)}
                        </Text>
                      </Pressable>
                      {staffMembers.map((staff) => (
                        <Pressable
                          key={staff.id}
                          onPress={() => setEditVisitStaffId(staff.id)}
                          className="px-3 py-2 rounded-full mr-2 flex-row items-center"
                          style={{
                            backgroundColor: editVisitStaffId === staff.id ? `${primaryColor}20` : colors.card,
                            borderWidth: editVisitStaffId === staff.id ? 2 : 1,
                            borderColor: editVisitStaffId === staff.id ? primaryColor : colors.border,
                          }}
                        >
                          <User size={14} color={editVisitStaffId === staff.id ? primaryColor : colors.textSecondary} />
                          <Text
                            className="text-sm font-medium ml-1.5"
                            style={{ color: editVisitStaffId === staff.id ? primaryColor : colors.textSecondary }}
                          >
                            {staff.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Amount */}
                <View className="mb-4">
                  <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('visitAmount', language)}</Text>
                  <TextInput
                    value={editVisitAmount}
                    onChangeText={setEditVisitAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: colors.inputBackground,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      color: colors.inputText,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                    }}
                    placeholderTextColor={colors.inputPlaceholder}
                    cursorColor={primaryColor}
                    selectionColor={`${primaryColor}40`}
                  />
                </View>

                {/* Notes */}
                <View className="mb-4">
                  <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('notes', language)}</Text>
                  <TextInput
                    value={editVisitNotes}
                    onChangeText={setEditVisitNotes}
                    placeholder={t('addNotesPlaceholder', language)}
                    multiline
                    numberOfLines={4}
                    style={{
                      backgroundColor: colors.inputBackground,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      color: colors.inputText,
                      borderWidth: 1,
                      borderColor: colors.inputBorder,
                      textAlignVertical: 'top',
                      minHeight: 100,
                    }}
                    placeholderTextColor={colors.inputPlaceholder}
                    cursorColor={primaryColor}
                    selectionColor={`${primaryColor}40`}
                  />
                </View>

                {/* Modified timestamp info */}
                {editingVisit.modifiedAt && (
                  <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 8 }}>
                      {t('lastEdited', language)}: {capitalizeDate(format(new Date(editingVisit.modifiedAt), 'MMM d, yyyy h:mm a', { locale: dateLocale }))}
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Upcoming Appointments Modal */}
      <VisitsModal
        visible={showAppointmentsModal}
        client={displayClient ? { name: displayClient.name, email: displayClient.email } : null}
        clientUpcomingAppointments={clientUpcomingAppointments}
        serviceTags={serviceTags}
        marketingPromotions={marketingPromotions}
        stores={stores}
        staffMembers={staffMembers}
        filteredStaffForAppointment={filteredStaffForAppointment}
        clientLoyaltyData={clientLoyaltyData}
        language={language}
        colors={colors}
        isDark={isDark}
        primaryColor={primaryColor}
        currency={currency}
        dateLocale={dateLocale}
        editingAppointment={editingAppointment}
        editAppointmentDate={editAppointmentDate}
        editAppointmentTime={editAppointmentTime}
        editAppointmentEndTime={editAppointmentEndTime}
        editAppointmentNotes={editAppointmentNotes}
        editAppointmentAmount={editAppointmentAmount}
        editAppointmentStoreId={editAppointmentStoreId}
        editAppointmentStaffId={editAppointmentStaffId}
        editAppointmentServices={editAppointmentServices}
        editAppointmentPromotionId={editAppointmentPromotionId}
        editAppointmentCurrency={editAppointmentCurrency}
        showEditAppointmentDatePicker={showEditAppointmentDatePicker}
        showEditAppointmentStorePicker={showEditAppointmentStorePicker}
        showEditAppointmentStaffPicker={showEditAppointmentStaffPicker}
        showEditAppointmentPromotionPicker={showEditAppointmentPromotionPicker}
        showEditAppointmentCurrencyPicker={showEditAppointmentCurrencyPicker}
        onEditAppointmentDateChange={setEditAppointmentDate}
        onEditAppointmentTimeChange={setEditAppointmentTime}
        onEditAppointmentEndTimeChange={setEditAppointmentEndTime}
        onEditAppointmentNotesChange={setEditAppointmentNotes}
        onEditAppointmentAmountChange={setEditAppointmentAmount}
        onEditAppointmentStoreIdChange={setEditAppointmentStoreId}
        onEditAppointmentStaffIdChange={setEditAppointmentStaffId}
        onToggleEditAppointmentService={toggleEditAppointmentService}
        onEditAppointmentPromotionIdChange={setEditAppointmentPromotionId}
        onEditAppointmentCurrencyChange={setEditAppointmentCurrency}
        onShowEditAppointmentDatePickerChange={setShowEditAppointmentDatePicker}
        onShowEditAppointmentStorePickerChange={setShowEditAppointmentStorePicker}
        onShowEditAppointmentStaffPickerChange={setShowEditAppointmentStaffPicker}
        onShowEditAppointmentPromotionPickerChange={setShowEditAppointmentPromotionPicker}
        onShowEditAppointmentCurrencyPickerChange={setShowEditAppointmentCurrencyPicker}
        onSetEditingAppointment={setEditingAppointment}
        onClose={handleCloseAppointmentsModal}
        onSaveAppointmentEdit={handleSaveAppointmentEdit}
        onOpenEditAppointment={openEditAppointment}
      />

      {/* Loyalty Points Modal */}
      <LoyaltyPointsModal
        visible={showLoyaltyModal}
        clientName={displayClient?.name || 'Client'}
        clientLoyaltyData={clientLoyaltyData}
        loyaltyRewards={loyaltyRewards}
        availableRewards={availableRewards}
        loyaltyTransactions={loyaltyTransactions}
        language={language}
        colors={colors}
        isDark={isDark}
        primaryColor={primaryColor}
        currency={currency}
        onClose={() => setShowLoyaltyModal(false)}
        onToggleEnrollment={() => {
          const newStatus = clientLoyaltyData?.is_enrolled !== true ? true : false;
          setLoyaltyConfirmPending(newStatus);
          setShowLoyaltyConfirmModal(true);
        }}
        onRedeemReward={(reward) => {
          Alert.alert(
            t('loyaltyRedeemReward', language),
            `Redeem "${reward.title}" for ${reward.points_required.toLocaleString()} points?`,
            [
              { text: t('cancel', language), style: 'cancel' },
              {
                text: t('loyaltyRedeemReward', language),
                onPress: () => {
                  createRedemptionMutation.mutate({
                    clientId,
                    rewardId: reward.id,
                    pointsUsed: reward.points_required,
                  }, {
                    onSuccess: () => {
                      if (supabaseClient?.business_id) {
                        notifyTransactionalEmail({
                          business_id: supabaseClient.business_id,
                          client_id: clientId,
                          event_type: 'loyalty_points_redeemed',
                          reward_title: reward.title,
                          points_used: reward.points_required,
                        });
                      }
                    },
                  });
                },
              },
            ]
          );
        }}
      />

      {/* Gift Card Modal */}
      <GiftCardModal
        visible={showGiftCardModal}
        clientName={displayClient?.name || 'Client'}
        giftCards={clientGiftCards}
        activeGiftCards={activeGiftCards}
        giftCardTransactions={clientGiftCardTransactions}
        totalGiftCardBalance={totalGiftCardBalance}
        language={language}
        colors={colors}
        isDark={isDark}
        primaryColor={primaryColor}
        currency={currency}
        dateLocale={dateLocale}
        onClose={() => setShowGiftCardModal(false)}
      />

      {/* Client Timeline Modal */}
      <ClientTimelineModal
        clientId={clientId}
        clientName={displayClient?.name || 'Client'}
        isVisible={showTimelineModal}
        onClose={() => setShowTimelineModal(false)}
      />

      {/* Membership Information Modal */}
      <Modal
        visible={showMembershipInfoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembershipInfoModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
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
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <UsersIcon size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                {t('membershipInformation', language)}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowMembershipInfoModal(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {clientMembership && membershipPlan ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 20,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                }}
              >
                {/* Plan Name + Status Badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 20, flex: 1 }}>
                    {membershipPlan.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: getMembershipStatusInfo(clientMembership.status).bgColor,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: getMembershipStatusInfo(clientMembership.status).color,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {getMembershipStatusInfo(clientMembership.status).label.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Detail Rows */}
                {clientMembership.lastPaymentDate && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                      {t('membershipPurchaseDate', language)}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                      {format(new Date(clientMembership.lastPaymentDate), 'MMM d, yyyy')}
                    </Text>
                  </View>
                )}

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {t('membershipActiveSince', language)}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                    {format(new Date(clientMembership.startDate), 'MMM d, yyyy')}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {t('expirationDate', language)}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                    {format(new Date(clientMembership.nextRenewalDate), 'MMM d, yyyy')}
                  </Text>
                </View>

                {membershipPlan.displayPrice ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 14,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                      {t('membershipDisplayPrice', language)}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                      {membershipPlan.displayPrice}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <UsersIcon size={36} color={primaryColor} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 6 }}>
                  {t('membershipInactive', language)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                  {t('membershipInactive', language)}
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Membership Detail Modal */}
      <Modal
        visible={showMembershipModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembershipModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
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
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: clientMembership ? (
                    clientMembership.status === 'active' ? '#10B98130' :
                    clientMembership.status === 'paused' ? '#8B5CF630' :
                    clientMembership.status === 'past_due' ? '#F59E0B30' :
                    '#6B728030'
                  ) : (isDark ? '#6B728030' : '#F1F5F9'),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <UsersIcon size={22} color={
                  clientMembership ? (
                    clientMembership.status === 'active' ? '#10B981' :
                    clientMembership.status === 'paused' ? '#8B5CF6' :
                    clientMembership.status === 'past_due' ? '#F59E0B' :
                    '#6B7280'
                  ) : '#6B7280'
                } />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Membership</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {displayClient?.name || 'Client'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowMembershipModal(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
          >
            {clientMembership && membershipPlan ? (
              <>
                {/* Status Card */}
                <View
                  style={{
                    backgroundColor: clientMembership.status === 'active' ? (isDark ? '#10B98120' : '#D1FAE5') :
                      clientMembership.status === 'paused' ? (isDark ? '#8B5CF620' : '#EDE9FE') :
                      clientMembership.status === 'past_due' ? (isDark ? '#F59E0B20' : '#FEF3C7') :
                      (isDark ? '#6B728020' : '#F3F4F6'),
                    borderRadius: 20,
                    padding: 24,
                    marginBottom: 20,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{
                      color: clientMembership.status === 'active' ? (isDark ? '#6EE7B7' : '#065F46') :
                        clientMembership.status === 'paused' ? (isDark ? '#C4B5FD' : '#5B21B6') :
                        clientMembership.status === 'past_due' ? (isDark ? '#FCD34D' : '#92400E') :
                        (isDark ? '#9CA3AF' : '#374151'),
                      fontSize: 14,
                      fontWeight: '600'
                    }}>
                      {membershipPlan.name}
                    </Text>
                    <View
                      style={{
                        backgroundColor: getMembershipStatusInfo(clientMembership.status).bgColor,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: getMembershipStatusInfo(clientMembership.status).color,
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        {getMembershipStatusInfo(clientMembership.status).label.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={{
                    color: clientMembership.status === 'active' ? (isDark ? '#6EE7B7' : '#047857') :
                      clientMembership.status === 'paused' ? (isDark ? '#C4B5FD' : '#6D28D9') :
                      clientMembership.status === 'past_due' ? (isDark ? '#FCD34D' : '#B45309') :
                      (isDark ? '#9CA3AF' : '#4B5563'),
                    fontSize: 28,
                    fontWeight: 'bold',
                    marginTop: 12,
                  }}>
                    {formatCurrency(membershipPlan.displayPrice, currency)}
                    <Text style={{ fontSize: 16, fontWeight: '500' }}>
                      /{membershipPlan.renewalCycle === 'monthly' ? 'mo' : membershipPlan.renewalCycle === 'yearly' ? 'yr' : `${membershipPlan.customIntervalDays}d`}
                    </Text>
                  </Text>

                  <View style={{
                    flexDirection: 'row',
                    marginTop: 16,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: clientMembership.status === 'active' ? (isDark ? '#10B98140' : '#A7F3D0') :
                      clientMembership.status === 'paused' ? (isDark ? '#8B5CF640' : '#DDD6FE') :
                      clientMembership.status === 'past_due' ? (isDark ? '#F59E0B40' : '#FDE68A') :
                      (isDark ? '#6B728040' : '#E5E7EB')
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: clientMembership.status === 'active' ? (isDark ? '#6EE7B780' : '#065F46') :
                          clientMembership.status === 'paused' ? (isDark ? '#C4B5FD80' : '#5B21B6') :
                          clientMembership.status === 'past_due' ? (isDark ? '#FCD34D80' : '#92400E') :
                          (isDark ? '#9CA3AF80' : '#6B7280'),
                        fontSize: 12
                      }}>
                        Started
                      </Text>
                      <Text style={{
                        color: clientMembership.status === 'active' ? (isDark ? '#6EE7B7' : '#047857') :
                          clientMembership.status === 'paused' ? (isDark ? '#C4B5FD' : '#6D28D9') :
                          clientMembership.status === 'past_due' ? (isDark ? '#FCD34D' : '#B45309') :
                          (isDark ? '#9CA3AF' : '#4B5563'),
                        fontSize: 16,
                        fontWeight: '600'
                      }}>
                        {format(new Date(clientMembership.startDate), 'MMM d, yyyy')}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: clientMembership.status === 'active' ? (isDark ? '#6EE7B780' : '#065F46') :
                          clientMembership.status === 'paused' ? (isDark ? '#C4B5FD80' : '#5B21B6') :
                          clientMembership.status === 'past_due' ? (isDark ? '#FCD34D80' : '#92400E') :
                          (isDark ? '#9CA3AF80' : '#6B7280'),
                        fontSize: 12
                      }}>
                        {clientMembership.status === 'active' || clientMembership.status === 'past_due' ? 'Next Renewal' : clientMembership.status === 'paused' ? 'Paused Until' : 'Ended'}
                      </Text>
                      <Text style={{
                        color: clientMembership.status === 'active' ? (isDark ? '#6EE7B7' : '#047857') :
                          clientMembership.status === 'paused' ? (isDark ? '#C4B5FD' : '#6D28D9') :
                          clientMembership.status === 'past_due' ? (isDark ? '#FCD34D' : '#B45309') :
                          (isDark ? '#9CA3AF' : '#4B5563'),
                        fontSize: 16,
                        fontWeight: '600'
                      }}>
                        {clientMembership.status === 'paused' ? (
                          clientMembership.pauseEndDate ? format(new Date(clientMembership.pauseEndDate), 'MMM d, yyyy') : 'Indefinite'
                        ) : clientMembership.status === 'cancelled' || clientMembership.status === 'expired' ? (
                          clientMembership.cancelledDate ? format(new Date(clientMembership.cancelledDate), 'MMM d, yyyy') : '-'
                        ) : (
                          format(new Date(clientMembership.nextRenewalDate), 'MMM d, yyyy')
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Credit Balance Card (if has credits) */}
                {clientMembership.creditBalance > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 20,
                      borderWidth: 2,
                      borderColor: '#10B98130',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: '#10B98115',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <DollarSign size={22} color="#10B981" />
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Credit Balance</Text>
                        <Text style={{ color: '#10B981', fontSize: 24, fontWeight: 'bold' }}>
                          {formatCurrency(clientMembership.creditBalance, currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Benefits Summary */}
                {membershipPlan.benefits && membershipPlan.benefits.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                      Benefits
                    </Text>
                    {membershipPlan.benefits.map((benefit, index) => (
                      <View
                        key={index}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: `${primaryColor}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {benefit.type === 'discount' ? (
                            <Tag size={18} color={primaryColor} />
                          ) : benefit.type === 'monthly_credit' ? (
                            <DollarSign size={18} color={primaryColor} />
                          ) : benefit.type === 'free_service' ? (
                            <Gift size={18} color={primaryColor} />
                          ) : (
                            <Star size={18} color={primaryColor} />
                          )}
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '500' }}>
                            {benefit.type === 'discount' ? (
                              `${benefit.discountPercent}% off ${benefit.discountAppliesTo === 'all' ? 'all services' : benefit.discountAppliesTo === 'services' ? 'services' : 'products'}`
                            ) : benefit.type === 'monthly_credit' ? (
                              `${formatCurrency(benefit.creditAmount || 0, currency)} monthly credit`
                            ) : benefit.type === 'free_service' ? (
                              `${benefit.freeServiceQuantity || 1}x free ${benefit.freeServiceName || 'service'} per cycle`
                            ) : (
                              benefit.customPerkText || 'Custom benefit'
                            )}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Payment History */}
                {membershipPayments.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                      Payment History
                    </Text>
                    {membershipPayments.slice(0, 5).map((payment) => (
                      <View
                        key={payment.id}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#10B98115',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Check size={18} color="#10B981" />
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '500' }}>
                            {formatCurrency(payment.amount, currency)}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                            {format(new Date(payment.paymentDate), 'MMM d, yyyy')} - {payment.paymentMethod}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={{ marginTop: 10 }}>
                  {/* Mark Payment Received */}
                  {(clientMembership.status === 'active' || clientMembership.status === 'past_due') && (
                    <Pressable
                      onPress={() => {
                        // Pre-fill form values
                        setPaymentAmount(membershipPlan.displayPrice.toString());
                        setPaymentDate(new Date());
                        setPaymentMethod('cash');
                        setPaymentPeriodStart(new Date(clientMembership.nextRenewalDate));
                        const nextEnd = calculateNextRenewalDate(
                          new Date(clientMembership.nextRenewalDate),
                          membershipPlan.renewalCycle,
                          membershipPlan.customIntervalDays
                        );
                        setPaymentPeriodEnd(nextEnd);
                        setPaymentNotes('');
                        setPaymentReceivedBy('');
                        setShowMarkPaymentModal(true);
                      }}
                      style={{
                        backgroundColor: primaryColor,
                        borderRadius: 12,
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <DollarSign size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                        Mark Payment Received
                      </Text>
                    </Pressable>
                  )}

                  {/* Pause/Resume Membership */}
                  {clientMembership.status === 'active' && (
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          'Pause Membership',
                          'Are you sure you want to pause this membership? The client will not be charged and benefits will be suspended.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Pause',
                              onPress: () => {
                                pauseMembershipMutation.mutate({
                                  membershipId: clientMembership.id,
                                  clientId: clientId,
                                });
                              },
                            },
                          ]
                        );
                      }}
                      style={{
                        backgroundColor: '#8B5CF615',
                        borderRadius: 12,
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <Clock size={20} color="#8B5CF6" />
                      <Text style={{ color: '#8B5CF6', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                        Pause Membership
                      </Text>
                    </Pressable>
                  )}

                  {clientMembership.status === 'paused' && (
                    <Pressable
                      onPress={() => {
                        resumeMembershipMutation.mutate({
                          membershipId: clientMembership.id,
                          clientId: clientId,
                        });
                      }}
                      style={{
                        backgroundColor: '#10B98115',
                        borderRadius: 12,
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <TrendingUp size={20} color="#10B981" />
                      <Text style={{ color: '#10B981', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                        Resume Membership
                      </Text>
                    </Pressable>
                  )}

                  {/* Cancel Membership */}
                  {(clientMembership.status === 'active' || clientMembership.status === 'paused' || clientMembership.status === 'past_due') && (
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          'Cancel Membership',
                          'Are you sure you want to cancel this membership? This action cannot be undone.',
                          [
                            { text: 'Keep Membership', style: 'cancel' },
                            {
                              text: 'Cancel Membership',
                              style: 'destructive',
                              onPress: () => {
                                cancelMembershipMutation.mutate({
                                  membershipId: clientMembership.id,
                                  clientId: clientId,
                                  reason: 'Cancelled by business',
                                });
                              },
                            },
                          ]
                        );
                      }}
                      style={{
                        backgroundColor: '#EF444415',
                        borderRadius: 12,
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={20} color="#EF4444" />
                      <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                        Cancel Membership
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              /* No Membership - Show Enroll Option */
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <UsersIcon size={40} color={colors.textTertiary} />
                </View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
                  No Active Membership
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }}>
                  Enroll this client in a membership plan to offer exclusive benefits and recurring revenue.
                </Text>

                {membershipPlans.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      // Reset enrollment form
                      setEnrollPlanId(membershipPlans[0]?.id || '');
                      setEnrollStartDate(new Date());
                      const plan = membershipPlans[0];
                      if (plan) {
                        setEnrollNextRenewalDate(
                          calculateNextRenewalDate(new Date(), plan.renewalCycle, plan.customIntervalDays)
                        );
                      }
                      setEnrollPaymentMethod('cash');
                      setEnrollPaymentNotes('');
                      setEnrollNotes('');
                      setShowEnrollMembershipModal(true);
                    }}
                    style={{
                      backgroundColor: primaryColor,
                      borderRadius: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 24,
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 24,
                    }}
                  >
                    <Plus size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                      Enroll in Membership
                    </Text>
                  </Pressable>
                ) : (
                  <View style={{ marginTop: 24, backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
                    <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                      No membership plans available. Create plans in Settings to enroll clients.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Enroll Membership Modal */}
      <Modal
        visible={showEnrollMembershipModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEnrollMembershipModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
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
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: `${primaryColor}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Plus size={22} color={primaryColor} />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Enroll in Membership</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {displayClient?.name || 'Client'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowEnrollMembershipModal(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
          >
            {/* Plan Selector */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Select Plan
            </Text>
            <View style={{ marginBottom: 20 }}>
              {membershipPlans.filter(p => p.isActive).map((plan) => (
                <Pressable
                  key={plan.id}
                  onPress={() => {
                    setEnrollPlanId(plan.id);
                    setEnrollNextRenewalDate(
                      calculateNextRenewalDate(enrollStartDate, plan.renewalCycle, plan.customIntervalDays)
                    );
                  }}
                  style={{
                    backgroundColor: enrollPlanId === plan.id ? `${primaryColor}15` : colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 8,
                    borderWidth: 2,
                    borderColor: enrollPlanId === plan.id ? primaryColor : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{plan.name}</Text>
                      {plan.description && (
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{plan.description}</Text>
                      )}
                    </View>
                    <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 18 }}>
                      {formatCurrency(plan.displayPrice, currency)}
                      <Text style={{ fontSize: 12, fontWeight: '500' }}>
                        /{plan.renewalCycle === 'monthly' ? 'mo' : plan.renewalCycle === 'yearly' ? 'yr' : `${plan.customIntervalDays}d`}
                      </Text>
                    </Text>
                  </View>
                  {plan.benefits && plan.benefits.length > 0 && (
                    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
                      {plan.benefits.slice(0, 3).map((benefit, idx) => (
                        <View key={idx} style={{ backgroundColor: `${primaryColor}10`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 6, marginTop: 4 }}>
                          <Text style={{ color: primaryColor, fontSize: 11 }}>
                            {benefit.type === 'discount' ? `${benefit.discountPercent}% off` :
                              benefit.type === 'monthly_credit' ? `${formatCurrency(benefit.creditAmount || 0, currency)} credit` :
                              benefit.type === 'free_service' ? 'Free service' : 'Benefit'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Start Date */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Start Date
            </Text>
            <Pressable
              onPress={() => setShowEnrollStartDatePicker(true)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {format(enrollStartDate, 'MMMM d, yyyy')}
              </Text>
              <Calendar size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Next Renewal Date */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Next Renewal Date
            </Text>
            <Pressable
              onPress={() => setShowEnrollRenewalDatePicker(true)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {format(enrollNextRenewalDate, 'MMMM d, yyyy')}
              </Text>
              <Calendar size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Payment Method */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Payment Method
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              {(['cash', 'card', 'external', 'other'] as MembershipPaymentMethod[]).map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setEnrollPaymentMethod(method)}
                  style={{
                    flex: 1,
                    backgroundColor: enrollPaymentMethod === method ? primaryColor : colors.card,
                    borderRadius: 10,
                    padding: 12,
                    marginRight: method !== 'other' ? 8 : 0,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: enrollPaymentMethod === method ? '#fff' : colors.text,
                    fontWeight: '500',
                    fontSize: 13,
                    textTransform: 'capitalize',
                  }}>
                    {method}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Payment Notes */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Payment Notes (Optional)
            </Text>
            <TextInput
              value={enrollPaymentNotes}
              onChangeText={setEnrollPaymentNotes}
              placeholder="e.g., Paid via Venmo"
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                color: colors.text,
                fontSize: 16,
              }}
            />

            {/* Notes */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Notes (Optional)
            </Text>
            <TextInput
              value={enrollNotes}
              onChangeText={setEnrollNotes}
              placeholder="Internal notes about this membership"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                color: colors.text,
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </ScrollView>

          {/* Enroll Button */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.background,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: insets.bottom + 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => {
                if (!enrollPlanId) {
                  Alert.alert('Error', 'Please select a membership plan');
                  return;
                }
                const selectedPlan = membershipPlans.find(p => p.id === enrollPlanId);
                const creditBenefit = selectedPlan?.benefits?.find(b => b.type === 'monthly_credit');

                enrollMembershipMutation.mutate({
                  clientId,
                  planId: enrollPlanId,
                  enrollment: {
                    startDate: enrollStartDate,
                    nextRenewalDate: enrollNextRenewalDate,
                    paymentMethod: enrollPaymentMethod,
                    paymentNotes: enrollPaymentNotes || undefined,
                    notes: enrollNotes || undefined,
                    initialCreditBalance: creditBenefit?.creditAmount || 0,
                  },
                }, {
                  onSuccess: () => {
                    setShowEnrollMembershipModal(false);
                    showSaveConfirmation();
                  },
                  onError: () => {
                    Alert.alert('Error', 'Failed to enroll client in membership');
                  },
                });
              }}
              disabled={enrollMembershipMutation.isPending}
              style={{
                backgroundColor: enrollMembershipMutation.isPending ? colors.textTertiary : primaryColor,
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}
            >
              {enrollMembershipMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                  Enroll in Membership
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>

        {/* Start Date Picker */}
        {showEnrollStartDatePicker && (
          <View style={{ padding: 16 }}>
            <WheelDatePicker
              label="Start Date"
              value={enrollStartDate}
              onChange={(date: Date) => {
                setEnrollStartDate(date);
                const selectedPlan = membershipPlans.find(p => p.id === enrollPlanId);
                if (selectedPlan) {
                  setEnrollNextRenewalDate(
                    calculateNextRenewalDate(date, selectedPlan.renewalCycle, selectedPlan.customIntervalDays)
                  );
                }
              }}
              isOpen={showEnrollStartDatePicker}
              onToggle={() => setShowEnrollStartDatePicker(false)}
            />
          </View>
        )}

        {/* Renewal Date Picker */}
        {showEnrollRenewalDatePicker && (
          <View style={{ padding: 16 }}>
            <WheelDatePicker
              label="Next Renewal Date"
              value={enrollNextRenewalDate}
              onChange={(date: Date) => {
                setEnrollNextRenewalDate(date);
              }}
              isOpen={showEnrollRenewalDatePicker}
              onToggle={() => setShowEnrollRenewalDatePicker(false)}
            />
          </View>
        )}
      </Modal>

      {/* Mark Payment Modal */}
      <Modal
        visible={showMarkPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMarkPaymentModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
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
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: '#10B98120',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <DollarSign size={22} color="#10B981" />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Mark Payment Received</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {displayClient?.name || 'Client'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowMarkPaymentModal(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}
          >
            {/* Amount */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Amount
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 20, marginRight: 4 }}>
                {getCurrencySymbol(currency)}
              </Text>
              <TextInput
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  color: colors.text,
                  fontSize: 20,
                  fontWeight: '600',
                }}
              />
            </View>

            {/* Payment Date */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Payment Date
            </Text>
            <Pressable
              onPress={() => setShowPaymentDatePicker(true)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {format(paymentDate, 'MMMM d, yyyy')}
              </Text>
              <Calendar size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Payment Method */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Payment Method
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              {(['cash', 'card', 'external', 'other'] as MembershipPaymentMethod[]).map((method) => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={{
                    flex: 1,
                    backgroundColor: paymentMethod === method ? primaryColor : colors.card,
                    borderRadius: 10,
                    padding: 12,
                    marginRight: method !== 'other' ? 8 : 0,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: paymentMethod === method ? '#fff' : colors.text,
                    fontWeight: '500',
                    fontSize: 13,
                    textTransform: 'capitalize',
                  }}>
                    {method}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Period Start */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Period Start
            </Text>
            <Pressable
              onPress={() => setShowPeriodStartPicker(true)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {format(paymentPeriodStart, 'MMMM d, yyyy')}
              </Text>
              <Calendar size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Period End */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Period End
            </Text>
            <Pressable
              onPress={() => setShowPeriodEndPicker(true)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>
                {format(paymentPeriodEnd, 'MMMM d, yyyy')}
              </Text>
              <Calendar size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Notes */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Notes (Optional)
            </Text>
            <TextInput
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              placeholder="Payment notes"
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                color: colors.text,
                fontSize: 16,
              }}
            />

            {/* Received By */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 8 }}>
              Received By (Optional)
            </Text>
            <TextInput
              value={paymentReceivedBy}
              onChangeText={setPaymentReceivedBy}
              placeholder="Staff member name"
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </ScrollView>

          {/* Confirm Button */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.background,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: insets.bottom + 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => {
                if (!clientMembership) return;
                const amount = parseFloat(paymentAmount);
                if (isNaN(amount) || amount <= 0) {
                  Alert.alert('Error', 'Please enter a valid amount');
                  return;
                }

                markPaymentReceivedMutation.mutate({
                  membershipId: clientMembership.id,
                  clientId,
                  payment: {
                    amount,
                    currency,
                    paymentMethod,
                    paymentDate,
                    periodStart: paymentPeriodStart,
                    periodEnd: paymentPeriodEnd,
                    notes: paymentNotes || undefined,
                    receivedBy: paymentReceivedBy || undefined,
                  },
                }, {
                  onSuccess: () => {
                    setShowMarkPaymentModal(false);
                    showSuccess(t('toastPaymentRecorded', language));
                  },
                  onError: (error) => {
                    Alert.alert('Error', 'Failed to record payment');
                  },
                });
              }}
              disabled={markPaymentReceivedMutation.isPending}
              style={{
                backgroundColor: markPaymentReceivedMutation.isPending ? colors.textTertiary : '#10B981',
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}
            >
              {markPaymentReceivedMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                  Confirm Payment
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>

        {/* Date Pickers */}
        {showPaymentDatePicker && (
          <View style={{ padding: 16 }}>
            <WheelDatePicker
              label="Payment Date"
              value={paymentDate}
              onChange={(date: Date) => {
                setPaymentDate(date);
              }}
              isOpen={showPaymentDatePicker}
              onToggle={() => setShowPaymentDatePicker(false)}
            />
          </View>
        )}

        {showPeriodStartPicker && (
          <View style={{ padding: 16 }}>
            <WheelDatePicker
              label="Period Start"
              value={paymentPeriodStart}
              onChange={(date: Date) => {
                setPaymentPeriodStart(date);
              }}
              isOpen={showPeriodStartPicker}
              onToggle={() => setShowPeriodStartPicker(false)}
            />
          </View>
        )}

        {showPeriodEndPicker && (
          <View style={{ padding: 16 }}>
            <WheelDatePicker
              label="Period End"
              value={paymentPeriodEnd}
              onChange={(date: Date) => {
                setPaymentPeriodEnd(date);
              }}
              isOpen={showPeriodEndPicker}
              onToggle={() => setShowPeriodEndPicker(false)}
            />
          </View>
        )}
      </Modal>

      {/* Archive Client Confirmation Modal */}
      <Modal
        visible={showArchiveModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowArchiveModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              {t('archiveClientTitle', language)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 12, lineHeight: 22 }}>
              {t('archiveClientMessage', language)}
            </Text>
            {futureActiveAppointmentCount > 0 ? (
              <Text style={{ color: '#EF4444', fontSize: 14, marginBottom: 24, lineHeight: 20, fontWeight: '500' }}>
                {futureActiveAppointmentCount} {t('archiveClientFutureApptWarning', language)}
              </Text>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20 }}>
                {t('archiveClientNoFutureAppts', language)}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowArchiveModal(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>{t('cancel', language)}</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmArchive}
                disabled={isArchiving}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: isArchiving ? '#EF444480' : '#EF4444' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                  {isArchiving ? '...' : t('archiveClientButton', language)}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loyalty Confirmation Modal */}
      <Modal
        visible={showLoyaltyConfirmModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowLoyaltyConfirmModal(false);
          setLoyaltyConfirmPending(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              {t('loyaltyConfirmTitle', language)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 24, lineHeight: 22 }}>
              {loyaltyConfirmPending === true
                ? t('loyaltyEnrollConfirm', language)
                : t('loyaltyUnenrollConfirm', language)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => {
                  setShowLoyaltyConfirmModal(false);
                  setLoyaltyConfirmPending(null);
                }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>{t('cancel', language)}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (loyaltyConfirmPending !== null) {
                    toggleEnrollmentMutation.mutate({ clientId, isEnrolled: loyaltyConfirmPending });
                  }
                  setShowLoyaltyConfirmModal(false);
                  setLoyaltyConfirmPending(null);
                }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: primaryColor }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>{t('confirm', language)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </Animated.View>
  );
}

