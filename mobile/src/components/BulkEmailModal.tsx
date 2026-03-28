import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Mail,
  Users,
  Send,
  Check,
  ChevronDown,
  FileText,
  File,
  Filter,
  AlertTriangle,
  MailX,
  Info,
  Phone,
  Search,
  ImageIcon,
} from 'lucide-react-native';
import { useAllMemberships, useMembershipPlans } from '@/hooks/useMembership';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useBusinessId } from '@/hooks/useBusiness';
import Animated, {
  FadeIn,
  SlideInUp,
  useSharedValue,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '@/lib/store';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { getSupabase } from '@/lib/supabaseClient';
import { isThisMonth } from 'date-fns';
import { feedbackSuccess, feedbackError } from '@/lib/SoundManager';
import { useTheme } from '@/lib/ThemeContext';
import { sortClientsAlphabetically } from './ClientSearchItem';
import { getComplianceHelperMessage } from '@/lib/country-legal-compliance';
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor';
import { OptedOutWarningBanner } from './email/OptedOutWarningBanner';
import { EmailSuccessOverlay } from './email/EmailSuccessOverlay';
import { EmailConfirmOverlay } from './email/EmailConfirmOverlay';
import { FormattingToolbar } from './email/FormattingToolbar';
import { AttachmentsSection } from './email/AttachmentsSection';
import { ClientPickerDrawer } from './email/ClientPickerDrawer';
import { useClients, clientKeys } from '@/hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/services/clientsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStores } from '@/hooks/useStores';
import { useAnalyticsAppointments } from '@/hooks/useAppointments';
import { useServices } from '@/hooks/useServices';

interface BulkEmailModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Attachment {
  name: string;
  size: number;
  type: string;
  uri: string;
}

interface EmailImage {
  uri: string;
  name: string;
  size: number;
  optimized: boolean;
  error?: string;
}

// File size limits for email attachments
const MAX_FILE_SIZE_MB = 5;
const MAX_TOTAL_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

// Image upload constants
const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500 KB
const MAX_IMAGE_DIMENSION = 1200;

const AnimatedView = Animated.View;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BulkEmailModal({ visible, onClose }: BulkEmailModalProps) {
  // Supabase — canonical source of truth for all data
  const { data: supabaseClients = [], isLoading: clientsLoading } = useClients();
  const { data: supabaseStores = [] } = useStores();
  const { data: supabaseServices = [] } = useServices();

  // Fetch last 365 days of appointments for analytics-based filters
  const analyticsStartDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }, []);
  const analyticsEndDate = useMemo(() => new Date(), []);
  const { data: allAppointments = [] } = useAnalyticsAppointments(analyticsStartDate, analyticsEndDate);

  // Membership / Loyalty / Gift Card data
  const { data: allMemberships = [] } = useAllMemberships();
  const { data: membershipPlans = [] } = useMembershipPlans();
  const { data: allGiftCards = [] } = useGiftCards();
  const { data: allClientLoyalty = [] } = useAllClientLoyalty();

  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const language = useStore((s) => s.language) as Language;
  const user = useStore((s) => s.user);
  const getOptOutStatus = useStore((s) => s.getOptOutStatus);
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const insets = useSafeAreaInsets();
  const businessId = useBusinessId();

  // ─── Scoped one-time migration ──────────────────────────────────────────────
  // Runs only when THIS modal opens, Supabase has 0 clients, and local Zustand
  // clients exist. Never runs at app root or during bootstrap.
  const queryClient = useQueryClient();
  const migrationStartedRef = useRef(false);
  const zustandClients = useStore((s) => s.clients);
  const zustandClientsRef = useRef(zustandClients);
  zustandClientsRef.current = zustandClients;

  useEffect(() => {
    // Guard: modal must be open, clients query must be settled, Supabase must be empty
    if (!visible || clientsLoading || supabaseClients.length > 0) return;
    // Guard: must have business context and local clients to migrate
    if (!businessId || zustandClientsRef.current.length === 0) return;
    // Guard: only run once per modal session
    if (migrationStartedRef.current) return;

    migrationStartedRef.current = true;
    const MIGRATION_KEY = `clients_migrated_v1_${businessId}`;

    const runMigration = async () => {
      try {
        const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_KEY);
        if (alreadyMigrated === 'done') return;

        const localClients = zustandClientsRef.current;
        console.log('[BulkEmail] Migrating', localClients.length, 'local clients to Supabase');
        let migrated = 0;

        for (const c of localClients) {
          if (!c.name?.trim()) continue;
          const result = await createClient({
            business_id: businessId,
            name: c.name.trim(),
            email: c.email?.trim() || null,
            phone: c.phone?.trim() || null,
            notes: c.notes?.trim() || null,
          });
          if (result.error) {
            const code = (result.error as any)?.code;
            // Duplicate email/phone = already exists — not an error
            if (code !== 'CLIENT_EMAIL_DUPLICATE' && code !== 'CLIENT_PHONE_DUPLICATE') {
              console.log('[BulkEmail] Migration error for client:', c.name, result.error.message);
            }
          } else {
            migrated++;
          }
        }

        await AsyncStorage.setItem(MIGRATION_KEY, 'done');
        console.log('[BulkEmail] Migration done. Inserted', migrated, 'clients');
        // Refresh ONLY the BulkEmailModal client query — no global invalidation
        queryClient.invalidateQueries({ queryKey: clientKeys.list(businessId) });
      } catch (err) {
        migrationStartedRef.current = false; // Allow retry on next open
        console.log('[BulkEmail] Migration error:', err);
      }
    };

    runMigration();
  // Intentionally using primitive deps: visible (bool), clientsLoading (bool),
  // supabaseClients.length (number), businessId (string). The zustand clients
  // array is accessed via ref to avoid referential re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, clientsLoading, supabaseClients.length, businessId]);
  // ─── End scoped migration ───────────────────────────────────────────────────
  const clients = useMemo(() => {
    return supabaseClients.map((c) => ({
      id: c.id,
      userId: c.business_id,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      tags: [] as string[],
      visits: [] as { storeId?: string; promotionUsed?: string }[],
      promotionCount: 0,
      isArchived: false,
      createdAt: c.created_at,
    }));
  }, [supabaseClients]);

  // Convert Supabase stores to local format
  const stores = useMemo(() => {
    return supabaseStores.map((s) => ({
      id: s.id,
      userId: s.business_id,
      name: s.name,
    }));
  }, [supabaseStores]);

  const marketingPromotions = useMemo(() => {
    if (!user?.id) return [];
    return allMarketingPromotions.filter((p) => p.userId === user.id);
  }, [allMarketingPromotions, user?.id]);

  // Core form state
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [body, setBody] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [emailImages, setEmailImages] = useState<EmailImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'newThisMonth' | 'promotionParticipants' | 'atRisk' | 'topClients' | 'byService' | 'visitFrequency' | 'membership' | 'loyalty' | 'giftCard'>('all');
  const [selectedPromotionFilter, setSelectedPromotionFilter] = useState<string | null>(null);
  const [filterByStore, setFilterByStore] = useState<string | null>(null);
  // Analytics-based filter sub-options
  const [topClientsSortBy, setTopClientsSortBy] = useState<'revenue' | 'visits'>('revenue');
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string | null>(null);
  const [visitFrequency, setVisitFrequency] = useState<'frequent' | 'occasional' | 'oneTime'>('frequent');
  // Membership filter sub-options
  const [membershipStatus, setMembershipStatus] = useState<'active' | 'past_due'>('active');
  const [selectedMembershipPlan, setSelectedMembershipPlan] = useState<string | null>(null);
  // Loyalty filter sub-options
  const [loyaltySubFilter, setLoyaltySubFilter] = useState<'enrolled' | 'hasPoints' | 'redeemed' | 'topEarners'>('enrolled');
  // Gift card filter sub-options
  const [giftCardSubFilter, setGiftCardSubFilter] = useState<'any' | 'value' | 'service'>('any');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Send confirmation states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [subjectError, setSubjectError] = useState(false);
  const [messageError, setMessageError] = useState(false);
  const [recipientsError, setRecipientsError] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorToast, setErrorToast] = useState(false);

  // Formatting toolbar state
  const [bodySelection, setBodySelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDisplayText, setLinkDisplayText] = useState('');
  const [activeFmt, setActiveFmt] = useState<Set<string>>(new Set());
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const bodyInputRef = useRef<TextInput>(null);
  const richEditorRef = useRef<RichTextEditorRef>(null);
  const [editorHeight, setEditorHeight] = useState(180);
  const lastEditorHeightRef = useRef(180);
  const [editorHasContent, setEditorHasContent] = useState(false);

  // Shake animations
  const subjectShake = useSharedValue(0);
  const messageShake = useSharedValue(0);
  const recipientsShake = useSharedValue(0);

  const subjectAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: subjectShake.value }],
  }));
  const messageAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: messageShake.value }],
  }));
  const recipientsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: recipientsShake.value }],
  }));

  const triggerShake = (sharedVal: { value: number }) => {
    sharedVal.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  };

  // Build per-client analytics lookup from appointments data
  const clientAnalytics = useMemo(() => {
    const map = new Map<string, { lastVisitDate: Date | null; visitCount: number; totalRevenueCents: number; serviceIds: Set<string>; promoIds: Set<string> }>();
    const now = new Date();
    for (const appt of allAppointments) {
      if (!appt.client_id) continue;
      if (appt.lifecycle_status === 'cancelled' || appt.is_cancelled || appt.is_deleted) continue;
      // Respect store filter at analytics level
      if (filterByStore && appt.store_id !== filterByStore) continue;

      const existing = map.get(appt.client_id);
      const apptDate = new Date(appt.start_at);
      const revenue = appt.total_cents ?? appt.subtotal_cents ?? 0;

      if (!existing) {
        const serviceIdSet = new Set<string>();
        if (appt.service_id) serviceIdSet.add(appt.service_id);
        const promoIdSet = new Set<string>();
        if (appt.promo_id) promoIdSet.add(appt.promo_id);
        map.set(appt.client_id, {
          lastVisitDate: apptDate,
          visitCount: 1,
          totalRevenueCents: revenue,
          serviceIds: serviceIdSet,
          promoIds: promoIdSet,
        });
      } else {
        if (!existing.lastVisitDate || apptDate > existing.lastVisitDate) {
          existing.lastVisitDate = apptDate;
        }
        existing.visitCount += 1;
        existing.totalRevenueCents += revenue;
        if (appt.service_id) existing.serviceIds.add(appt.service_id);
        if (appt.promo_id) existing.promoIds.add(appt.promo_id);
      }
    }
    return map;
  }, [allAppointments, filterByStore]);

  // Pure function: compute which client IDs match a given set of filters.
  // Called directly inside onPress handlers — no useEffect, no memo side-effects.
  const computeFilteredIds = useCallback((opts: {
    filterType: typeof filterType;
    filterByStore: string | null;
    selectedPromotionFilter: string | null;
    selectedServiceFilter: string | null;
    topClientsSortBy: typeof topClientsSortBy;
    visitFrequency: typeof visitFrequency;
    membershipStatus: typeof membershipStatus;
    selectedMembershipPlan: string | null;
    loyaltySubFilter: typeof loyaltySubFilter;
    giftCardSubFilter: typeof giftCardSubFilter;
  }): string[] => {
    // Build analytics map for the given store filter
    const analyticsMap = new Map<string, { lastVisitDate: Date | null; visitCount: number; totalRevenueCents: number; serviceIds: Set<string>; promoIds: Set<string> }>();
    for (const appt of allAppointments) {
      if (!appt.client_id) continue;
      if (appt.lifecycle_status === 'cancelled' || appt.is_cancelled || appt.is_deleted) continue;
      if (opts.filterByStore && appt.store_id !== opts.filterByStore) continue;
      const existing = analyticsMap.get(appt.client_id);
      const apptDate = new Date(appt.start_at);
      const revenue = appt.total_cents ?? appt.subtotal_cents ?? 0;
      if (!existing) {
        const svcSet = new Set<string>(); if (appt.service_id) svcSet.add(appt.service_id);
        const promoSet = new Set<string>(); if (appt.promo_id) promoSet.add(appt.promo_id);
        analyticsMap.set(appt.client_id, { lastVisitDate: apptDate, visitCount: 1, totalRevenueCents: revenue, serviceIds: svcSet, promoIds: promoSet });
      } else {
        if (!existing.lastVisitDate || apptDate > existing.lastVisitDate) existing.lastVisitDate = apptDate;
        existing.visitCount += 1;
        existing.totalRevenueCents += revenue;
        if (appt.service_id) existing.serviceIds.add(appt.service_id);
        if (appt.promo_id) existing.promoIds.add(appt.promo_id);
      }
    }

    let filtered = clients.filter((c) => !c.isArchived);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Apply store filter for non-analytics-driven filter types
    if (opts.filterByStore && opts.filterType !== 'atRisk' && opts.filterType !== 'topClients' && opts.filterType !== 'byService' && opts.filterType !== 'promotionParticipants' && opts.filterType !== 'visitFrequency') {
      filtered = filtered.filter((c) => analyticsMap.has(c.id));
    }

    if (opts.filterType === 'newThisMonth') {
      filtered = filtered.filter((c) => isThisMonth(new Date(c.createdAt)));
    } else if (opts.filterType === 'atRisk') {
      filtered = filtered.filter((c) => {
        const a = analyticsMap.get(c.id);
        return !a || !a.lastVisitDate || a.lastVisitDate < thirtyDaysAgo;
      });
    } else if (opts.filterType === 'topClients') {
      filtered = filtered.filter((c) => analyticsMap.has(c.id));
      filtered = [...filtered].sort((a, b) =>
        opts.topClientsSortBy === 'revenue'
          ? (analyticsMap.get(b.id)?.totalRevenueCents ?? 0) - (analyticsMap.get(a.id)?.totalRevenueCents ?? 0)
          : (analyticsMap.get(b.id)?.visitCount ?? 0) - (analyticsMap.get(a.id)?.visitCount ?? 0)
      );
      filtered = filtered.slice(0, Math.max(20, Math.min(100, Math.ceil(filtered.length * 0.25))));
    } else if (opts.filterType === 'byService') {
      filtered = opts.selectedServiceFilter
        ? filtered.filter((c) => analyticsMap.get(c.id)?.serviceIds.has(opts.selectedServiceFilter!) ?? false)
        : filtered.filter((c) => analyticsMap.has(c.id));
    } else if (opts.filterType === 'promotionParticipants') {
      filtered = opts.selectedPromotionFilter
        ? filtered.filter((c) => analyticsMap.get(c.id)?.promoIds.has(opts.selectedPromotionFilter!) ?? false)
        : filtered.filter((c) => { const a = analyticsMap.get(c.id); return !!a && a.promoIds.size > 0; });
    } else if (opts.filterType === 'visitFrequency') {
      filtered = filtered.filter((c) => analyticsMap.has(c.id));
      if (opts.visitFrequency === 'frequent') filtered = filtered.filter((c) => (analyticsMap.get(c.id)?.visitCount ?? 0) >= 4);
      else if (opts.visitFrequency === 'occasional') filtered = filtered.filter((c) => { const vc = analyticsMap.get(c.id)?.visitCount ?? 0; return vc >= 2 && vc <= 3; });
      else filtered = filtered.filter((c) => (analyticsMap.get(c.id)?.visitCount ?? 0) === 1);
    } else if (opts.filterType === 'membership') {
      const ids = new Set<string>();
      for (const m of allMemberships) {
        if (m.clientId && m.status === opts.membershipStatus && (!opts.selectedMembershipPlan || m.planId === opts.selectedMembershipPlan)) ids.add(m.clientId);
      }
      filtered = filtered.filter((c) => ids.has(c.id));
    } else if (opts.filterType === 'loyalty') {
      const ids = new Set<string>();
      for (const lc of allClientLoyalty) {
        if (!lc.client_id) continue;
        if (opts.loyaltySubFilter === 'enrolled' && lc.is_enrolled) ids.add(lc.client_id);
        else if (opts.loyaltySubFilter === 'hasPoints' && lc.total_points > 0) ids.add(lc.client_id);
        else if (opts.loyaltySubFilter === 'topEarners' && lc.lifetime_points > 0) ids.add(lc.client_id);
        else if (opts.loyaltySubFilter === 'redeemed' && lc.lifetime_points > lc.total_points) ids.add(lc.client_id);
      }
      if (opts.loyaltySubFilter === 'topEarners') {
        const arr = filtered.filter((c) => ids.has(c.id)).sort((a, b) => {
          const pa = allClientLoyalty.find((lc) => lc.client_id === a.id)?.lifetime_points ?? 0;
          const pb = allClientLoyalty.find((lc) => lc.client_id === b.id)?.lifetime_points ?? 0;
          return pb - pa;
        });
        filtered = arr.slice(0, Math.max(10, Math.min(100, Math.ceil(arr.length * 0.25))));
      } else {
        filtered = filtered.filter((c) => ids.has(c.id));
      }
    } else if (opts.filterType === 'giftCard') {
      const ids = new Set<string>();
      for (const gc of allGiftCards) {
        if (!gc.clientId || gc.status !== 'active') continue;
        if (opts.giftCardSubFilter === 'any') ids.add(gc.clientId);
        else if (opts.giftCardSubFilter === 'value' && gc.type === 'value' && (gc.currentBalance ?? 0) > 0) ids.add(gc.clientId);
        else if (opts.giftCardSubFilter === 'service' && gc.type === 'service') ids.add(gc.clientId);
      }
      filtered = filtered.filter((c) => ids.has(c.id));
    }

    return filtered.map((c) => c.id);
  }, [clients, allAppointments, allMemberships, allClientLoyalty, allGiftCards]);

  // Filter clients based on selected filters
  const activeClients = useMemo(() => {
    let filtered = clients.filter((c) => !c.isArchived);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Apply store filter (for filters that don't use clientAnalytics directly)
    if (filterByStore && filterType !== 'atRisk' && filterType !== 'topClients' && filterType !== 'byService' && filterType !== 'promotionParticipants' && filterType !== 'visitFrequency') {
      filtered = filtered.filter((c) => {
        const analytics = clientAnalytics.get(c.id);
        return !!analytics;
      });
    }

    if (filterType === 'newThisMonth') {
      filtered = filtered.filter((c) => isThisMonth(new Date(c.createdAt)));
    } else if (filterType === 'atRisk') {
      // Clients with no completed visit in last 30 days
      filtered = filtered.filter((c) => {
        const analytics = clientAnalytics.get(c.id);
        if (!analytics || !analytics.lastVisitDate) return true; // never visited = at risk
        return analytics.lastVisitDate < thirtyDaysAgo;
      });
    } else if (filterType === 'topClients') {
      // Only clients who have appointments in analytics window
      filtered = filtered.filter((c) => clientAnalytics.has(c.id));
      if (topClientsSortBy === 'revenue') {
        filtered = filtered.sort((a, b) => {
          const ra = clientAnalytics.get(a.id)?.totalRevenueCents ?? 0;
          const rb = clientAnalytics.get(b.id)?.totalRevenueCents ?? 0;
          return rb - ra;
        });
      } else {
        filtered = filtered.sort((a, b) => {
          const va = clientAnalytics.get(a.id)?.visitCount ?? 0;
          const vb = clientAnalytics.get(b.id)?.visitCount ?? 0;
          return vb - va;
        });
      }
      // Take top 25% or at least top 20, max 100
      const topN = Math.max(20, Math.min(100, Math.ceil(filtered.length * 0.25)));
      filtered = filtered.slice(0, topN);
    } else if (filterType === 'byService') {
      if (selectedServiceFilter) {
        filtered = filtered.filter((c) => {
          const analytics = clientAnalytics.get(c.id);
          return analytics?.serviceIds.has(selectedServiceFilter) ?? false;
        });
      } else {
        // Any service: clients who have any appointment
        filtered = filtered.filter((c) => clientAnalytics.has(c.id));
      }
    } else if (filterType === 'promotionParticipants') {
      if (selectedPromotionFilter) {
        filtered = filtered.filter((c) => {
          const analytics = clientAnalytics.get(c.id);
          return analytics?.promoIds.has(selectedPromotionFilter) ?? false;
        });
      } else {
        // Any promotion used
        filtered = filtered.filter((c) => {
          const analytics = clientAnalytics.get(c.id);
          return analytics && analytics.promoIds.size > 0;
        });
      }
    } else if (filterType === 'visitFrequency') {
      filtered = filtered.filter((c) => clientAnalytics.has(c.id));
      if (visitFrequency === 'frequent') {
        // 4+ visits in the period
        filtered = filtered.filter((c) => (clientAnalytics.get(c.id)?.visitCount ?? 0) >= 4);
      } else if (visitFrequency === 'occasional') {
        // 2–3 visits
        filtered = filtered.filter((c) => {
          const vc = clientAnalytics.get(c.id)?.visitCount ?? 0;
          return vc >= 2 && vc <= 3;
        });
      } else if (visitFrequency === 'oneTime') {
        // Exactly 1 visit
        filtered = filtered.filter((c) => (clientAnalytics.get(c.id)?.visitCount ?? 0) === 1);
      }
    } else if (filterType === 'membership') {
      // Build a set of clientIds with matching memberships
      const membershipClientIds = new Set<string>();
      for (const m of allMemberships) {
        if (!m.clientId) continue;
        if (membershipStatus === 'active' && m.status === 'active') {
          if (!selectedMembershipPlan || m.planId === selectedMembershipPlan) {
            membershipClientIds.add(m.clientId);
          }
        } else if (membershipStatus === 'past_due' && m.status === 'past_due') {
          if (!selectedMembershipPlan || m.planId === selectedMembershipPlan) {
            membershipClientIds.add(m.clientId);
          }
        }
      }
      filtered = filtered.filter((c) => membershipClientIds.has(c.id));
    } else if (filterType === 'loyalty') {
      // Build a set of clientIds based on loyalty sub-filter
      const loyaltyClientIds = new Set<string>();
      for (const lc of allClientLoyalty) {
        if (!lc.client_id) continue;
        if (loyaltySubFilter === 'enrolled' && lc.is_enrolled) {
          loyaltyClientIds.add(lc.client_id);
        } else if (loyaltySubFilter === 'hasPoints' && lc.total_points > 0) {
          loyaltyClientIds.add(lc.client_id);
        } else if (loyaltySubFilter === 'topEarners' && lc.lifetime_points > 0) {
          loyaltyClientIds.add(lc.client_id);
        } else if (loyaltySubFilter === 'redeemed' && lc.lifetime_points > lc.total_points) {
          loyaltyClientIds.add(lc.client_id);
        }
      }
      if (loyaltySubFilter === 'topEarners') {
        // Sort by lifetime points desc, take top 25%
        const loyaltyArr = filtered.filter((c) => loyaltyClientIds.has(c.id));
        const sorted2 = loyaltyArr.sort((a, b) => {
          const pa = allClientLoyalty.find((lc) => lc.client_id === a.id)?.lifetime_points ?? 0;
          const pb = allClientLoyalty.find((lc) => lc.client_id === b.id)?.lifetime_points ?? 0;
          return pb - pa;
        });
        const topN = Math.max(10, Math.min(100, Math.ceil(sorted2.length * 0.25)));
        filtered = sorted2.slice(0, topN);
      } else {
        filtered = filtered.filter((c) => loyaltyClientIds.has(c.id));
      }
    } else if (filterType === 'giftCard') {
      // Build a set of clientIds with matching gift cards
      const gcClientIds = new Set<string>();
      for (const gc of allGiftCards) {
        if (!gc.clientId) continue;
        if (gc.status !== 'active') continue;
        if (giftCardSubFilter === 'any') {
          gcClientIds.add(gc.clientId);
        } else if (giftCardSubFilter === 'value' && gc.type === 'value' && (gc.currentBalance ?? 0) > 0) {
          gcClientIds.add(gc.clientId);
        } else if (giftCardSubFilter === 'service' && gc.type === 'service') {
          gcClientIds.add(gc.clientId);
        }
      }
      filtered = filtered.filter((c) => gcClientIds.has(c.id));
    }

    // Sort alphabetically unless topClients (already sorted by metric)
    const sorted = filterType === 'topClients' ? filtered : sortClientsAlphabetically(filtered);

    // Apply recipient search
    if (recipientSearch.trim()) {
      const q = recipientSearch.toLowerCase().trim();
      return sorted.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(recipientSearch.trim())
      );
    }

    return sorted;
  }, [clients, filterByStore, filterType, selectedPromotionFilter, marketingPromotions, visitFrequency, topClientsSortBy, selectedServiceFilter, clientAnalytics, recipientSearch, allMemberships, membershipStatus, selectedMembershipPlan, allClientLoyalty, loyaltySubFilter, allGiftCards, giftCardSubFilter]);

  // Calculate opted-out clients from selected (SYSTEM-ENFORCED CHECK)
  const { allowedClients, blockedClients } = useMemo(() => {
    if (!user?.id) return { allowedClients: [], blockedClients: [] };

    const allowed: typeof clients = [];
    const blocked: typeof clients = [];

    for (const clientId of selectedClientIds) {
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        const isOptedOut = getOptOutStatus(client.email, user.id);
        if (isOptedOut) {
          blocked.push(client);
        } else {
          allowed.push(client);
        }
      }
    }

    return { allowedClients: allowed, blockedClients: blocked };
  }, [selectedClientIds, clients, user?.id, getOptOutStatus]);

  const isClientOptedOut = (clientEmail: string): boolean => {
    if (!user?.id) return false;
    return getOptOutStatus(clientEmail, user.id);
  };

  const toggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
    if (recipientsError) setRecipientsError(false);
  };

  const selectAll = () => {
    const ids = computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter });
    setSelectedClientIds(ids);
    if (recipientsError) setRecipientsError(false);
  };

  const deselectAll = () => {
    setSelectedClientIds([]);
  };

  // Document picker
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const currentTotalSize = attachments.reduce((sum, a) => sum + a.size, 0);
        const validAttachments: Attachment[] = [];
        const oversizedFiles: string[] = [];
        let newTotalSize = currentTotalSize;

        for (const asset of result.assets) {
          const fileSize = asset.size || 0;

          if (fileSize > MAX_FILE_SIZE_BYTES) {
            oversizedFiles.push(`${asset.name} (${formatFileSize(fileSize)})`);
            continue;
          }

          if (newTotalSize + fileSize > MAX_TOTAL_SIZE_BYTES) {
            Alert.alert(
              t('fileSizeLimitExceeded', language),
              t('totalAttachmentSizeLimit', language).replace('{size}', `${MAX_TOTAL_SIZE_MB}MB`)
            );
            break;
          }

          validAttachments.push({
            name: asset.name,
            size: fileSize,
            type: asset.mimeType || 'application/octet-stream',
            uri: asset.uri,
          });
          newTotalSize += fileSize;
        }

        if (oversizedFiles.length > 0) {
          Alert.alert(
            t('fileTooLarge', language),
            t('maxFileSizeLimit', language).replace('{size}', `${MAX_FILE_SIZE_MB}MB`) +
              '\n\n' +
              oversizedFiles.join('\n')
          );
        }

        if (validAttachments.length > 0) {
          setAttachments((prev) => [...prev, ...validAttachments]);
        }
      }
    } catch (error) {
      console.log('Document picker error:', error);
    }
  };

  // Image picker with compression
  const pickImage = async () => {
    setImageError(null);

    if (emailImages.length >= MAX_IMAGES) {
      setImageError(t('imageTooManyError', language));
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      // Compress using ImageManipulator
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [
          {
            resize: {
              width: MAX_IMAGE_DIMENSION,
            },
          },
        ],
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Estimate size from dimensions (rough estimate: we fetch the blob info)
      // For a real size check we use the response info
      const response = await fetch(manipResult.uri);
      const blob = await response.blob();
      const sizeBytes = blob.size;

      if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
        setImageError(t('imageTooBig', language));
        return;
      }

      const timestamp = Date.now();
      const newImage: EmailImage = {
        uri: manipResult.uri,
        name: `email_image_${timestamp}.jpg`,
        size: sizeBytes,
        optimized: true,
      };

      setEmailImages((prev) => [...prev, newImage]);
    } catch (error) {
      console.log('Image picker error:', error);
      setImageError(t('imageOptimizeFailed', language));
    }
  };

  const removeImage = (index: number) => {
    setEmailImages((prev) => prev.filter((_, i) => i !== index));
    setImageError(null);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={16} color="#8B5CF6" />;
    if (type.includes('pdf')) return <FileText size={16} color="#EF4444" />;
    return <File size={16} color="#64748B" />;
  };

  // Formatting toolbar actions — send execCommand to the WebView editor.
  // The WebView owns the format state and broadcasts it back via onFmtStateChange.
  // Do NOT optimistically toggle activeFmt here — wait for the WebView's authoritative reply.
  const applyFormatting = (type: 'bold' | 'italic' | 'bullets' | 'spacing') => {
    if (type === 'bold') {
      richEditorRef.current?.sendCommand('bold');
    } else if (type === 'italic') {
      richEditorRef.current?.sendCommand('italic');
    } else if (type === 'bullets') {
      richEditorRef.current?.sendCommand('insertUnorderedList');
    } else if (type === 'spacing') {
      richEditorRef.current?.sendCommand('insertHTML', '<br><br>');
    }
  };

  const applyAlignment = (align: 'left' | 'center' | 'right') => {
    setTextAlign(align);
    const cmd = align === 'left' ? 'justifyLeft' : align === 'center' ? 'justifyCenter' : 'justifyRight';
    richEditorRef.current?.sendCommand(cmd);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const text = linkDisplayText.trim() || fullUrl;
    richEditorRef.current?.sendCommand('insertLink', JSON.stringify({ url: fullUrl, text }));
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkDisplayText('');
  };

  // Validate and show confirm modal
  const handleSend = () => {
    let hasError = false;

    if (!subject.trim()) {
      setSubjectError(true);
      triggerShake(subjectShake);
      hasError = true;
    }
    if (!editorHasContent) {
      setMessageError(true);
      triggerShake(messageShake);
      hasError = true;
    }
    if (selectedClientIds.length === 0) {
      setRecipientsError(true);
      triggerShake(recipientsShake);
      hasError = true;
    }

    if (hasError) return;

    if (!user?.id) {
      Alert.alert('Error', 'Please log in to send emails.');
      return;
    }

    if (!businessId) {
      Alert.alert('Error', 'Business not configured. Please try again.');
      return;
    }

    if (allowedClients.length === 0) {
      Alert.alert(
        'Cannot Send Email',
        'All selected recipients have opted out of receiving emails. No emails will be sent.'
      );
      return;
    }

    setShowConfirmModal(true);
  };

  // Execute the actual send — real async API call
  const executeSend = async () => {
    setShowConfirmModal(false);
    setIsSending(true);

    const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

    console.log('[BulkEmail] executeSend called');
    console.log('[BulkEmail] Recipients:', allowedClients.length);
    console.log('[BulkEmail] Backend URL:', backendUrl);

    try {
      // Convert images to base64
      const imageAttachments = await Promise.all(emailImages.map(async (img) => {
        const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: FileSystem.EncodingType.Base64 });
        return { filename: img.name, content: base64, content_type: 'image/jpeg' };
      }));

      // Convert file attachments to base64
      const fileAttachments = await Promise.all(attachments.map(async (att) => {
        const base64 = await FileSystem.readAsStringAsync(att.uri, { encoding: FileSystem.EncodingType.Base64 });
        return { filename: att.name, content: base64, content_type: att.type };
      }));

      const allAttachments = [...imageAttachments, ...fileAttachments];

      // Get HTML directly from the rich text editor WebView
      const bodyAsHtml = await richEditorRef.current?.getHtml() ?? '';

      const payload: {
        business_id: string;
        emails: Array<{
          recipient_email: string;
          recipient_name: string;
          subject: string;
          body: string;
          preview_text?: string;
          text_align?: 'left' | 'center' | 'right';
        }>;
        attachments?: Array<{ filename: string; content: string; content_type: string }>;
      } = {
        business_id: businessId!,
        emails: allowedClients.map((client) => ({
          recipient_email: client.email,
          recipient_name: client.name,
          subject: subject.trim(),
          body: bodyAsHtml,
          preview_text: previewText.trim() || undefined,
          text_align: textAlign,
        })),
        ...(allAttachments.length > 0 ? { attachments: allAttachments } : {}),
      };

      console.log('[BulkEmail] Sending POST to:', `${backendUrl}/api/bulk-email/send`);

      const { data: sessionData } = await getSupabase().auth.getSession();
      const token = sessionData?.session?.access_token;
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${backendUrl}/api/bulk-email/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      console.log('[BulkEmail] Response status:', response.status);

      const result = await response.json() as { success: boolean; sent?: number; failed?: number; error?: string };

      console.log('[BulkEmail] Result:', JSON.stringify(result));

      if (response.ok && (result.success || (result.sent && result.sent > 0))) {
        // At least some emails sent successfully
        feedbackSuccess();
        setShowSuccessModal(true);
      } else {
        const errorMsg = result.error || `Failed to send emails. Sent: ${result.sent ?? 0}, Failed: ${result.failed ?? 0}`;
        console.error('[BulkEmail] Send failed:', errorMsg);
        feedbackError();
        Alert.alert(
          'Send Failed',
          errorMsg,
          [{ text: 'OK' }]
        );
        setIsSending(false);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error — please check your connection and try again.';
      console.error('[BulkEmail] Send exception:', errorMsg);
      feedbackError();
      Alert.alert(
        'Send Failed',
        errorMsg,
        [{ text: 'OK' }]
      );
      setIsSending(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setIsSending(false);
    resetAndClose();
  };

  const resetAndClose = () => {
    // Always clear ALL state before closing — prevents backdrop freeze
    setIsSending(false);
    setShowConfirmModal(false);
    setShowSuccessModal(false);
    setShowSuccessToast(false);
    setErrorToast(false);
    setSubject('');
    setPreviewText('');
    setBody('');
    setSelectedClientIds([]);
    setAttachments([]);
    setEmailImages([]);
    setImageError(null);
    setShowClientPicker(false);
    setShowFilterOptions(false);
    setFilterType('all');
    setSelectedPromotionFilter(null);
    setFilterByStore(null);
    setTopClientsSortBy('revenue');
    setSelectedServiceFilter(null);
    setVisitFrequency('frequent');
    setRecipientSearch('');
    setSubjectError(false);
    setMessageError(false);
    setRecipientsError(false);
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkDisplayText('');
    setActiveFmt(new Set());
    onClose();
  };

  const canSend = allowedClients.length > 0 && subject.trim() && editorHasContent && !isSending;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetAndClose}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
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
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Mail size={22} color={primaryColor} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                  {t('bulkEmail', language)}
                </Text>
              </View>
              <Pressable
                onPress={resetAndClose}
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
            </Animated.View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 160 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={false}
              automaticallyAdjustContentInsets={false}
            >
              {/* Opted Out Warning Banner */}
              <OptedOutWarningBanner
                blockedClients={blockedClients}
                isDark={isDark}
                language={language}
              />

              {/* RECIPIENTS */}
              <AnimatedView style={recipientsAnimStyle}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                      {t('recipients', language)} *
                    </Text>
                    {selectedClientIds.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {allowedClients.length > 0 && (
                          <View style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}18`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, marginRight: 6 }}>
                            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '500' }}>
                              {allowedClients.length} will receive
                            </Text>
                          </View>
                        )}
                        {blockedClients.length > 0 && (
                          <View style={{ backgroundColor: isDark ? '#7F1D1D40' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '500' }}>
                              {blockedClients.length} blocked
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <Pressable
                    onPress={() => setShowClientPicker(!showClientPicker)}
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: recipientsError ? colors.error ?? '#EF4444' : colors.border,
                      borderRadius: 12,
                      padding: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Users size={20} color={colors.textSecondary} />
                      <Text
                        style={{
                          marginLeft: 12,
                          fontSize: 16,
                          color: selectedClientIds.length > 0 ? colors.text : colors.textTertiary,
                        }}
                      >
                        {selectedClientIds.length > 0
                          ? t('selectedCount', language).replace('{count}', selectedClientIds.length.toString())
                          : t('selectRecipients', language)}
                      </Text>
                    </View>
                    <ChevronDown
                      size={20}
                      color={colors.textTertiary}
                      style={{ transform: [{ rotate: showClientPicker ? '180deg' : '0deg' }] }}
                    />
                  </Pressable>

                  {recipientsError && (
                    <Text style={{ color: colors.error ?? '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                      {t('recipientsRequired', language)}
                    </Text>
                  )}

                  {/* Client Picker Drawer */}
                  {showClientPicker && (
                    <ClientPickerDrawer
                      activeClients={activeClients}
                      clientsLoading={clientsLoading}
                      selectedClientIds={selectedClientIds}
                      recipientSearch={recipientSearch}
                      showFilterOptions={showFilterOptions}
                      filterType={filterType}
                      filterByStore={filterByStore}
                      selectedPromotionFilter={selectedPromotionFilter}
                      selectedServiceFilter={selectedServiceFilter}
                      topClientsSortBy={topClientsSortBy}
                      visitFrequency={visitFrequency}
                      membershipStatus={membershipStatus}
                      selectedMembershipPlan={selectedMembershipPlan}
                      loyaltySubFilter={loyaltySubFilter}
                      giftCardSubFilter={giftCardSubFilter}
                      supabaseServices={supabaseServices}
                      marketingPromotions={marketingPromotions}
                      membershipPlans={membershipPlans}
                      stores={stores}
                      isDark={isDark}
                      primaryColor={primaryColor}
                      colors={colors}
                      language={language}
                      setShowFilterOptions={setShowFilterOptions}
                      setRecipientSearch={setRecipientSearch}
                      setFilterType={setFilterType}
                      setFilterByStore={setFilterByStore}
                      setSelectedPromotionFilter={setSelectedPromotionFilter}
                      setSelectedServiceFilter={setSelectedServiceFilter}
                      setTopClientsSortBy={setTopClientsSortBy}
                      setVisitFrequency={setVisitFrequency}
                      setMembershipStatus={setMembershipStatus}
                      setSelectedMembershipPlan={setSelectedMembershipPlan}
                      setLoyaltySubFilter={setLoyaltySubFilter}
                      setGiftCardSubFilter={setGiftCardSubFilter}
                      setSelectedClientIds={setSelectedClientIds}
                      toggleClient={toggleClient}
                      selectAll={selectAll}
                      deselectAll={deselectAll}
                      isClientOptedOut={isClientOptedOut}
                      computeFilteredIds={computeFilteredIds}
                    />
                  )}
                </AnimatedView>

              {/* SUBJECT */}
              <Animated.View entering={SlideInUp.delay(100).duration(300)} style={{ marginTop: 20 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                  {t('subject', language)} *
                </Text>
                <AnimatedView style={subjectAnimStyle}>
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: subjectError ? (colors.error ?? '#EF4444') : colors.border,
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <TextInput
                      value={subject}
                      onChangeText={(text) => {
                        setSubject(text);
                        if (subjectError) setSubjectError(false);
                      }}
                      placeholder={t('enterSubjectPlaceholder', language)}
                      style={{ fontSize: 16, color: colors.text }}
                      placeholderTextColor={colors.textTertiary}
                      cursorColor={primaryColor}
                      selectionColor={`${primaryColor}40`}
                    />
                  </View>
                  {subjectError && (
                    <Text style={{ color: colors.error ?? '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                      {t('subjectRequired', language)}
                    </Text>
                  )}
                </AnimatedView>
              </Animated.View>

              {/* PREVIEW TEXT */}
              <Animated.View entering={SlideInUp.delay(120).duration(300)} style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                    {t('previewTextLabel', language)}
                  </Text>
                  <Text style={{ color: previewText.length >= 100 ? '#F59E0B' : colors.textTertiary, fontSize: 12 }}>
                    {t('previewTextCounter', language).replace('{count}', previewText.length.toString())}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <TextInput
                    value={previewText}
                    onChangeText={setPreviewText}
                    placeholder={t('previewTextPlaceholder', language)}
                    style={{ fontSize: 15, color: colors.text }}
                    placeholderTextColor={colors.textTertiary}
                    cursorColor={primaryColor}
                    selectionColor={`${primaryColor}40`}
                    maxLength={120}
                  />
                </View>
              </Animated.View>

              {/* MESSAGE BODY */}
              <Animated.View entering={SlideInUp.delay(150).duration(300)} style={{ marginTop: 20 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                  {t('message', language)} *
                </Text>

                {/* Formatting Toolbar */}
                <FormattingToolbar
                  activeFmt={activeFmt}
                  textAlign={textAlign}
                  showLinkModal={showLinkModal}
                  linkUrl={linkUrl}
                  linkDisplayText={linkDisplayText}
                  isDark={isDark}
                  primaryColor={primaryColor}
                  colors={colors}
                  language={language}
                  onFormat={applyFormatting}
                  onAlign={applyAlignment}
                  onOpenLinkModal={() => setShowLinkModal(true)}
                  onLinkUrlChange={setLinkUrl}
                  onLinkDisplayTextChange={setLinkDisplayText}
                  onInsertLink={applyLink}
                  onCancelLink={() => { setShowLinkModal(false); setLinkUrl(''); setLinkDisplayText(''); }}
                />

                <AnimatedView style={messageAnimStyle}>
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: messageError ? (colors.error ?? '#EF4444') : colors.border,
                      borderRadius: 12,
                      overflow: 'hidden',
                      height: 296,
                      padding: 8,
                    }}
                  >
                    <RichTextEditor
                      ref={richEditorRef}
                      placeholder={t('writeMessagePlaceholder', language)}
                      minHeight={150}
                      maxHeight={280}
                      primaryColor={primaryColor}
                      textColor={colors.text}
                      backgroundColor={colors.card}
                      placeholderColor={colors.textTertiary ?? '#94a3b8'}
                      onHeightChange={(h) => {
                        const newH = h + 16;
                        if (lastEditorHeightRef.current !== newH) {
                          lastEditorHeightRef.current = newH;
                          setEditorHeight(newH);
                        }
                      }}
                      onContentChange={(has) => {
                        setEditorHasContent(has);
                        if (has && messageError) setMessageError(false);
                      }}
                      onFmtStateChange={(state) => {
                        setActiveFmt((prev) => {
                          const s = new Set(prev);
                          state.bold ? s.add('bold') : s.delete('bold');
                          state.italic ? s.add('italic') : s.delete('italic');
                          state.insertUnorderedList ? s.add('bullets') : s.delete('bullets');
                          return s;
                        });
                      }}
                      onFocus={() => { if (messageError) setMessageError(false); }}
                    />
                  </View>
                  {messageError && (
                    <Text style={{ color: colors.error ?? '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                      {t('messageRequired', language)}
                    </Text>
                  )}
                </AnimatedView>
              </Animated.View>

              {/* ATTACHMENTS */}
              <AttachmentsSection
                emailImages={emailImages}
                attachments={attachments}
                imageError={imageError}
                maxImages={MAX_IMAGES}
                maxFileSizeMb={MAX_FILE_SIZE_MB}
                isDark={isDark}
                primaryColor={primaryColor}
                colors={colors}
                language={language}
                onPickImage={pickImage}
                onPickDocument={pickDocument}
                onRemoveImage={removeImage}
                onRemoveAttachment={removeAttachment}
                formatFileSize={formatFileSize}
                getFileIcon={getFileIcon}
              />
            </ScrollView>

            {/* Send Button Area */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingTop: 20,
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 8) + 20,
                backgroundColor: colors.card,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              {/* Success Toast */}
              {showSuccessToast && (
                <Animated.View
                  entering={FadeIn.duration(250)}
                  style={{
                    position: 'absolute',
                    top: -72,
                    left: 20,
                    right: 20,
                    backgroundColor: '#10B981',
                    borderRadius: 16,
                    paddingHorizontal: 24,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <Check size={18} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {t('campaignQueued', language)}
                  </Text>
                </Animated.View>
              )}

              {/* Error Toast */}
              {errorToast && (
                <Animated.View
                  entering={FadeIn.duration(250)}
                  style={{
                    position: 'absolute',
                    top: -72,
                    left: 20,
                    right: 20,
                    backgroundColor: '#EF4444',
                    borderRadius: 16,
                    paddingHorizontal: 24,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <AlertTriangle size={18} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {t('unableToQueueCampaign', language)}
                  </Text>
                </Animated.View>
              )}

              {/* Compliance Notice */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                <Info size={12} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 6, flex: 1 }}>
                  {getComplianceHelperMessage(user?.businessCountry, language, user?.businessState)}
                </Text>
              </View>

              <Pressable
                onPress={isSending ? undefined : handleSend}
                style={{
                  paddingVertical: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSending
                    ? buttonColor
                    : canSend
                      ? buttonColor
                      : (isDark ? colors.backgroundTertiary : '#E2E8F0'),
                  opacity: isSending ? 0.85 : 1,
                }}
              >
                {isSending ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>
                      {t('sending', language)}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Send size={18} color={canSend ? '#fff' : colors.textTertiary} />
                    <Text
                      style={{
                        fontWeight: '600',
                        fontSize: 16,
                        marginLeft: 8,
                        color: canSend ? '#fff' : colors.textTertiary,
                      }}
                      adjustsFontSizeToFit
                      numberOfLines={1}
                      minimumFontScale={0.7}
                    >
                      {allowedClients.length > 0
                        ? `${t('send', language)} (${allowedClients.length})`
                        : t('send', language)}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {/* Confirm Send Overlay — rendered inside the modal to avoid iOS stacking bugs */}
          {showConfirmModal && (
            <EmailConfirmOverlay
              subject={subject}
              previewText={previewText}
              allowedClientsCount={allowedClients.length}
              blockedClients={blockedClients}
              attachmentsCount={attachments.length}
              emailImagesCount={emailImages.length}
              isDark={isDark}
              primaryColor={primaryColor}
              buttonColor={buttonColor}
              colors={colors}
              language={language}
              onCancel={() => setShowConfirmModal(false)}
              onConfirm={executeSend}
            />
          )}

          {/* Success Overlay — rendered inside the modal */}
          {showSuccessModal && (
            <EmailSuccessOverlay
              allowedClientsCount={allowedClients.length}
              buttonColor={buttonColor}
              colors={colors}
              language={language}
              onClose={handleSuccessModalClose}
            />
          )}

        </SafeAreaView>
      </Modal>
    </>
  );
}
