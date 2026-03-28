import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Mail,
  Users,
  Filter,
  Check,
  Activity,
  Target,
  Eye,
  Pause,
  ChevronRight,
  UserPlus,
  MoreHorizontal,
  PlayCircle,
  PauseCircle,
  UserMinus,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t, TranslationKey } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { persistClientDripAssignment, updateEnrollmentStatus } from '@/services/dripCampaignsService';
import { useEnrollments, enrollmentKeys } from '@/hooks/useDripCampaigns';
import { useBusiness } from '@/hooks/useBusiness';
import { useClients } from '@/hooks/useClients';
import { useAllMemberships } from '@/hooks/useMembership';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useSearchableAppointments } from '@/hooks/useAppointments';
import { useStores } from '@/hooks/useStores';
import { useQueryClient } from '@tanstack/react-query';
import { SectionHeader } from './SectionHeader';
import { SmartTripsTargeting, TargetFilterType } from './constants';

// ============================================
// AssignManageView — Enterprise Client Assignment Dashboard
// ============================================

export function AssignManageView({ onOpenAssignWizard }: { onOpenAssignWizard: (preSelectedIds?: string[]) => void }) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const user = useStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const allDripCampaigns = useStore((s) => s.dripCampaigns);
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();

  // Use React Query (real Supabase data) instead of the Zustand store which is always empty
  const { data: rawClients = [], isLoading: clientsLoading } = useClients();

  // SOURCE OF TRUTH: enrollments from drip_campaign_enrollments table
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useEnrollments();

  const { data: allMemberships = [] } = useAllMemberships();
  const { data: allClientLoyalty = [] } = useAllClientLoyalty();
  const { data: allGiftCards = [] } = useGiftCards();
  const { data: supabaseStores = [] } = useStores();
  const { data: allAppointments = [] } = useSearchableAppointments();

  const [assignSearch, setAssignSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAssignTargeting, setShowAssignTargeting] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [viewingStatCategory, setViewingStatCategory] = useState<'active' | 'paused' | 'unassigned' | 'total' | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  // key = `${clientId}:${campaignId}`, tracks which client row's menu is open
  const [clientMenuOpenKey, setClientMenuOpenKey] = useState<string | null>(null);
  const [assignTargeting, setAssignTargeting] = useState<SmartTripsTargeting>({
    filterType: 'all',
    filterLogic: 'AND',
    consentRequired: true,
    topClientsSortBy: 'revenue',
    visitFrequency: 'frequent',
    membershipStatus: 'active',
    loyaltySubFilter: 'enrolled',
    giftCardSubFilter: 'any',
    selectedServiceId: null,
    selectedStoreId: null,
  });

  // Debounce search input 200ms for smooth typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(assignSearch), 200);
    return () => clearTimeout(timer);
  }, [assignSearch]);

  // Build a fast lookup: clientId → enrollment row (active + paused)
  // We include ALL enrollments so paused clients are visible in their own filter category.
  const enrollmentByCientId = useMemo(() => {
    const map = new Map<string, { campaignId: string; isActive: boolean }>();
    for (const e of enrollments) {
      map.set(e.client_id, { campaignId: e.campaign_id, isActive: e.is_active });
    }
    return map;
  }, [enrollments]);

  // Map raw Supabase clients — dripCampaignId comes from enrollments table (source of truth)
  const clients = useMemo(() => {
    return rawClients.map((c) => {
      const enr = enrollmentByCientId.get(c.id);
      return {
        id: c.id,
        name: c.name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        isArchived: (c as any).is_archived === true,
        // dripCampaignId is set for ALL enrollments (active OR paused)
        dripCampaignId: enr?.campaignId ?? undefined,
        // enrollmentIsActive: true = active, false = paused, undefined = not enrolled
        enrollmentIsActive: enr ? enr.isActive : undefined,
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        visitsCount: (c as any).visits_count ?? 0,
        lastVisitAt: (c as any).last_visit_at ? new Date((c as any).last_visit_at) : null,
        visits: [] as { date: string }[],
      };
    });
  }, [rawClients, enrollmentByCientId]);

  const dripCampaigns = useMemo(() => {
    if (!user?.id) return allDripCampaigns;
    const filtered = allDripCampaigns.filter((c) => c.userId === user.id);
    return filtered.length > 0 ? filtered : allDripCampaigns;
  }, [allDripCampaigns, user?.id]);

  const activeClients = useMemo(() => clients.filter((c) => !c.isArchived), [clients]);

  // Apply search + targeting filter — SINGLE SOURCE OF TRUTH for tiles AND list
  const filteredClients = useMemo(() => {
    let list = activeClients;

    // ── 1. Search filter ──────────────────────────────────────
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      // Normalize phone: strip spaces, dashes, parentheses, plus signs
      const normalizePhone = (p: string) => p.replace(/[\s\-\(\)\+]/g, '');
      const qPhone = normalizePhone(q);
      list = list.filter((c) => {
        const fullName = c.name?.toLowerCase() ?? '';
        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts[0] ?? '';
        const lastName = nameParts[nameParts.length - 1] ?? '';
        const phone = normalizePhone(c.phone?.toLowerCase() ?? '');
        const email = c.email?.toLowerCase() ?? '';
        return (
          fullName.includes(q) ||
          firstName.includes(q) ||
          lastName.includes(q) ||
          phone.includes(qPhone) ||
          email.includes(q)
        );
      });
    }

    // ── 2. Audience filter ────────────────────────────────────
    if (assignTargeting.filterType === 'newThisMonth') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((c) => c.createdAt >= start);
    } else if (assignTargeting.filterType === 'atRisk') {
      // At risk: no visit in last 30 days — uses last_visit_at from DB
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      list = list.filter((c) => !c.lastVisitAt || c.lastVisitAt < cutoff);
    } else if (assignTargeting.filterType === 'topClients') {
      // Top 20% by visit count (sorted descending)
      const sorted = [...list].sort((a, b) => (b.visitsCount ?? 0) - (a.visitsCount ?? 0));
      list = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.2)));
    } else if (assignTargeting.filterType === 'membership') {
      const enrolledIds = new Set(
        allMemberships
          .filter((m) => m.status === assignTargeting.membershipStatus)
          .map((m) => m.clientId)
      );
      list = list.filter((c) => enrolledIds.has(c.id));
    } else if (assignTargeting.filterType === 'loyalty') {
      const enrolledIds = new Set(
        allClientLoyalty.filter((lc) => lc.is_enrolled).map((lc) => lc.client_id)
      );
      list = list.filter((c) => enrolledIds.has(c.id));
    } else if (assignTargeting.filterType === 'giftCard') {
      const gcClientIds = new Set(
        allGiftCards
          .filter((gc) => gc.status === 'active')
          .map((gc) => gc.clientId)
          .filter(Boolean)
      );
      list = list.filter((c) => gcClientIds.has(c.id));
    } else if (assignTargeting.filterType === 'visitFrequency') {
      // frequent: 5+ visits, occasional: 2–4, oneTime: exactly 1
      if (assignTargeting.visitFrequency === 'frequent') {
        list = list.filter((c) => (c.visitsCount ?? 0) >= 5);
      } else if (assignTargeting.visitFrequency === 'occasional') {
        list = list.filter((c) => { const v = c.visitsCount ?? 0; return v >= 2 && v <= 4; });
      } else if (assignTargeting.visitFrequency === 'oneTime') {
        list = list.filter((c) => (c.visitsCount ?? 0) === 1);
      }
    }

    // ── 3. Store filter ───────────────────────────────────────
    if (assignTargeting.selectedStoreId) {
      const clientIdsAtStore = new Set(
        allAppointments
          .filter((a: any) => a.store_id === assignTargeting.selectedStoreId)
          .map((a: any) => a.client_id)
          .filter(Boolean)
      );
      list = list.filter((c) => clientIdsAtStore.has(c.id));
    }

    return list;
  }, [
    activeClients,
    debouncedSearch,
    assignTargeting,
    allMemberships,
    allClientLoyalty,
    allGiftCards,
    allAppointments,
  ]);

  // Stats derived from filteredClients (single source of truth — tiles + list stay in sync)
  // Active = enrolled AND is_active=true; Paused = enrolled AND is_active=false
  const activeEnrolled = useMemo(() =>
    filteredClients.filter((c) => c.dripCampaignId && c.enrollmentIsActive === true).length,
    [filteredClients]
  );
  const pausedEnrolled = useMemo(() =>
    filteredClients.filter((c) => c.dripCampaignId && c.enrollmentIsActive === false).length,
    [filteredClients]
  );
  const unassigned = useMemo(() =>
    filteredClients.filter((c) => !c.dripCampaignId).length,
    [filteredClients]
  );
  const totalEnrolled = useMemo(() =>
    filteredClients.filter((c) => !!c.dripCampaignId).length,
    [filteredClients]
  );

  // Whether any non-default filter is active
  const isFiltered = assignTargeting.filterType !== 'all' || !!assignTargeting.selectedStoreId || debouncedSearch.trim().length > 0;

  // Group clients by campaign — only enrolled clients (dripCampaignId set), no unassigned here
  const groupedByCampaign = useMemo(() => {
    const groups: {
      campaignId: string | null;
      campaignName: string;
      isActive: boolean;
      clients: typeof filteredClients;
      activeCount: number;
      pausedCount: number;
    }[] = [];
    dripCampaigns.forEach((camp) => {
      const campClients = filteredClients.filter((c) => c.dripCampaignId === camp.id);
      if (campClients.length > 0) {
        // Use enrollmentIsActive on each client (populated from DB enrollments)
        const activeCount = campClients.filter((c) => c.enrollmentIsActive !== false).length;
        groups.push({
          campaignId: camp.id,
          campaignName: camp.name,
          isActive: camp.isActive,
          clients: campClients,
          activeCount,
          pausedCount: campClients.length - activeCount,
        });
      }
    });
    return groups;
  }, [filteredClients, dripCampaigns]);

  const getClientInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 8) + 90 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.inputBackground,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: searchFocused ? primaryColor : colors.inputBorder,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 12,
            }}
          >
            <Filter size={16} color={searchFocused ? primaryColor : colors.textTertiary} style={{ marginRight: 10 }} />
            <TextInput
              value={assignSearch}
              onChangeText={setAssignSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('searchClientsPlaceholder', language)}
              placeholderTextColor={colors.inputPlaceholder}
              style={{ flex: 1, fontSize: 14, color: colors.inputText }}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
            />
            {assignSearch.length > 0 && (
              <Pressable onPress={() => setAssignSearch('')}>
                <X size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* ── Summary Stats Row ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([
              { label: t('activeEnrollments', language), count: activeEnrolled, icon: <Activity size={14} color={primaryColor} />, cat: 'active' as const },
              { label: t('pausedEnrollments', language), count: pausedEnrolled, icon: <Pause size={14} color={primaryColor} />, cat: 'paused' as const },
              { label: t('unassignedClients', language), count: unassigned, icon: <Users size={14} color={primaryColor} />, cat: 'unassigned' as const },
              { label: t('totalEnrolled', language), count: totalEnrolled, icon: <Mail size={14} color={primaryColor} />, cat: 'total' as const },
            ]).map((stat) => (
              <Pressable
                key={stat.cat}
                onPress={() => setViewingStatCategory(viewingStatCategory === stat.cat ? null : stat.cat)}
                style={{
                  flex: 1,
                  backgroundColor: viewingStatCategory === stat.cat ? `${primaryColor}22` : `${primaryColor}10`,
                  borderRadius: 12,
                  padding: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: viewingStatCategory === stat.cat ? primaryColor : `${primaryColor}20`,
                }}
              >
                {stat.icon}
                <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '700', marginTop: 4 }}>{stat.count}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 2 }} numberOfLines={2}>{stat.label}</Text>
                <Eye size={10} color={viewingStatCategory === stat.cat ? primaryColor : colors.textTertiary} style={{ marginTop: 3 }} />
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Advanced Targeting Filters */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={{ marginBottom: 16 }}>
          <SectionHeader
            icon={<Target size={15} color={primaryColor} />}
            title={t('advancedTargeting', language)}
            subtitle={t('advancedTargetingDesc', language)}
            expanded={showAssignTargeting}
            onToggle={() => setShowAssignTargeting((v) => !v)}
            badge={assignTargeting.filterType !== 'all' ? t(({ all: 'allClients', newThisMonth: 'newThisMonthFilter', atRisk: 'atRiskFilter', topClients: 'topClientsFilter', byService: 'byServiceFilter', visitFrequency: 'visitFrequencyFilter', membership: 'membership', loyalty: 'loyaltyFilter', giftCard: 'giftCardFilter', promotionParticipants: 'filterByPromotion' } as const)[assignTargeting.filterType] ?? 'allClients', language) : undefined}
          />
          {showAssignTargeting && (
            <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: `${primaryColor}30`, borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 14 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                {([
                  { key: 'all', labelKey: 'allClients' },
                  { key: 'newThisMonth', labelKey: 'newThisMonthFilter' },
                  { key: 'atRisk', labelKey: 'atRiskFilter' },
                  { key: 'topClients', labelKey: 'topClientsFilter' },
                  { key: 'visitFrequency', labelKey: 'visitFrequencyFilter' },
                  { key: 'membership', labelKey: 'membership' },
                  { key: 'loyalty', labelKey: 'loyaltyFilter' },
                  { key: 'giftCard', labelKey: 'giftCardFilter' },
                ] as { key: TargetFilterType; labelKey: TranslationKey }[]).map(({ key, labelKey }) => (
                  <Pressable
                    key={key}
                    onPress={() => setAssignTargeting((prev) => ({ ...prev, filterType: key }))}
                    style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: assignTargeting.filterType === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: assignTargeting.filterType === key ? primaryColor : colors.border }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '500', color: assignTargeting.filterType === key ? '#fff' : colors.textSecondary }}>{t(labelKey, language)}</Text>
                  </Pressable>
                ))}
              </View>
              {assignTargeting.filterType === 'membership' && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {(['active', 'past_due'] as const).map((status) => (
                    <Pressable key={status} onPress={() => setAssignTargeting((prev) => ({ ...prev, membershipStatus: status }))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: assignTargeting.membershipStatus === status ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: assignTargeting.membershipStatus === status ? primaryColor : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: assignTargeting.membershipStatus === status ? '#fff' : colors.textSecondary }}>{status === 'active' ? t('membershipActive', language) : t('membershipPastDue', language)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {assignTargeting.filterType === 'visitFrequency' && (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {([{ key: 'frequent', label: t('frequentClients', language) }, { key: 'occasional', label: t('occasionalClients', language) }, { key: 'oneTime', label: t('oneTimeClients', language) }] as { key: 'frequent' | 'occasional' | 'oneTime'; label: string }[]).map(({ key, label }) => (
                    <Pressable key={key} onPress={() => setAssignTargeting((prev) => ({ ...prev, visitFrequency: key }))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: assignTargeting.visitFrequency === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: assignTargeting.visitFrequency === key ? primaryColor : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: assignTargeting.visitFrequency === key ? '#fff' : colors.textSecondary }}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {supabaseStores.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  <Pressable onPress={() => setAssignTargeting((prev) => ({ ...prev, selectedStoreId: null }))} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: !assignTargeting.selectedStoreId ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: !assignTargeting.selectedStoreId ? primaryColor : colors.border }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: !assignTargeting.selectedStoreId ? '#fff' : colors.textSecondary }}>{t('allStores', language)}</Text>
                  </Pressable>
                  {supabaseStores.map((store: { id: string; name: string }) => (
                    <Pressable key={store.id} onPress={() => setAssignTargeting((prev) => ({ ...prev, selectedStoreId: store.id }))} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: assignTargeting.selectedStoreId === store.id ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: assignTargeting.selectedStoreId === store.id ? primaryColor : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: assignTargeting.selectedStoreId === store.id ? '#fff' : colors.textSecondary }}>{store.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* ── Loading ─────────────────────────────────────────── */}
        {(clientsLoading || enrollmentsLoading) ? (
          <Animated.View entering={FadeIn.delay(100).duration(300)} style={{ paddingTop: 8 }}>
            {[...Array(4)].map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, opacity: 0.35 }} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ height: 13, width: '50%', borderRadius: 6, backgroundColor: colors.border, opacity: 0.35, marginBottom: 6 }} />
                  <View style={{ height: 11, width: '70%', borderRadius: 5, backgroundColor: colors.border, opacity: 0.25 }} />
                </View>
              </View>
            ))}
          </Animated.View>
        ) : (
          <>
            {/* ── PART 1: Unassigned Clients Card ──────────────── */}
            {(() => {
              const unassignedClients = filteredClients.filter((c) => !c.dripCampaignId);
              const isViewingUnassigned = viewingStatCategory === 'unassigned';
              const showUnassigned = !viewingStatCategory || isViewingUnassigned;
              if (!showUnassigned) return null;
              return (
                <Animated.View entering={FadeInDown.delay(0).duration(300)} style={{ marginBottom: 16 }}>
                  <Pressable
                    onPress={() => setExpandedGroupId(expandedGroupId === 'unassigned' ? null : 'unassigned')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: expandedGroupId === 'unassigned' ? `${primaryColor}0D` : colors.card,
                      borderRadius: 14,
                      borderBottomLeftRadius: expandedGroupId === 'unassigned' ? 0 : 14,
                      borderBottomRightRadius: expandedGroupId === 'unassigned' ? 0 : 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderWidth: 1,
                      borderColor: expandedGroupId === 'unassigned' ? primaryColor : colors.border,
                      borderBottomWidth: expandedGroupId === 'unassigned' ? 0 : 1,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Users size={18} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t('unassignedClientsCard', language)}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{t('noClientsInDrip', language)}</Text>
                    </View>
                    <View style={{ backgroundColor: `${primaryColor}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 8 }}>
                      <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14 }}>{unassignedClients.length}</Text>
                    </View>
                    <View style={{ transform: [{ rotate: expandedGroupId === 'unassigned' ? '90deg' : '0deg' }] }}>
                      <ChevronRight size={16} color={expandedGroupId === 'unassigned' ? primaryColor : colors.textTertiary} />
                    </View>
                  </Pressable>

                  {expandedGroupId === 'unassigned' && (
                    <View style={{
                      borderWidth: 1, borderTopWidth: 0, borderColor: primaryColor,
                      borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden',
                      backgroundColor: isDark ? `${primaryColor}05` : `${primaryColor}03`,
                    }}>
                      {unassignedClients.length === 0 ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('noClientsFound', language)}</Text>
                        </View>
                      ) : (
                        unassignedClients.map((client, ci) => {
                          const isSelected = selectedClientIds.includes(client.id);
                          return (
                            <Animated.View key={client.id} entering={FadeInDown.delay(ci * 20).duration(180)}>
                              <Pressable
                                onPress={() => setSelectedClientIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== client.id) : [...prev, client.id]
                                )}
                                style={{
                                  flexDirection: 'row', alignItems: 'center',
                                  paddingHorizontal: 14, paddingVertical: 12,
                                  backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                                  borderBottomWidth: ci < unassignedClients.length - 1 ? 1 : 0,
                                  borderBottomColor: colors.border,
                                }}
                              >
                                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: isSelected ? primaryColor : colors.border, backgroundColor: isSelected ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                  {isSelected && <Check size={11} color="#fff" />}
                                </View>
                                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                  <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 11 }}>{getClientInitials(client.name)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
                                  {client.email ? <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>{client.email}</Text> : null}
                                </View>
                                <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                  <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>{t('unassignedClients', language)}</Text>
                                </View>
                              </Pressable>
                            </Animated.View>
                          );
                        })
                      )}
                    </View>
                  )}
                </Animated.View>
              );
            })()}

            {/* ── PART 2: "Drip Campaigns Active" section ──────── */}
            {(!viewingStatCategory || viewingStatCategory === 'active' || viewingStatCategory === 'paused' || viewingStatCategory === 'total') && (() => {
              // Which groups to show given the active filter
              const dripsToShow = viewingStatCategory
                ? (() => {
                    const categoryClients = filteredClients.filter((c) => {
                      if (viewingStatCategory === 'total') return !!c.dripCampaignId;
                      if (viewingStatCategory === 'active') return c.dripCampaignId !== undefined && c.enrollmentIsActive === true;
                      if (viewingStatCategory === 'paused') return c.dripCampaignId !== undefined && c.enrollmentIsActive === false;
                      return false;
                    });
                    return groupedByCampaign
                      .map((g) => ({ ...g, clients: g.clients.filter((c) => categoryClients.some((cc) => cc.id === c.id)) }))
                      .filter((g) => g.clients.length > 0);
                  })()
                : groupedByCampaign;

              if (dripsToShow.length === 0) {
                return (
                  <Animated.View entering={FadeIn.delay(60).duration(300)} style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>
                      {isFiltered ? t('noCampaignsMatchFilter', language) : t('noCampaignsYet', language)}
                    </Text>
                  </Animated.View>
                );
              }

              return (
                <>
                  {/* Section divider */}
                  <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }}>
                      <Activity size={12} color={primaryColor} />
                      <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        {t('dripCampaignsActiveSection', language)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  </Animated.View>

                  {/* Drip accordion cards */}
                  {dripsToShow.map((group, gi) => {
                    const groupKey = group.campaignId ?? 'unassigned';
                    const isExpanded = expandedGroupId === groupKey;
                    return (
                      <Animated.View key={groupKey} entering={FadeInDown.delay(60 + gi * 35).duration(300)} style={{ marginBottom: 8 }}>
                        {/* Accordion Header */}
                        <Pressable
                          onPress={() => {
                            setExpandedGroupId(isExpanded ? null : groupKey);
                            setClientMenuOpenKey(null);
                          }}
                          style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: isExpanded ? `${primaryColor}0A` : colors.card,
                            borderRadius: 14,
                            borderBottomLeftRadius: isExpanded ? 0 : 14,
                            borderBottomRightRadius: isExpanded ? 0 : 14,
                            paddingHorizontal: 14, paddingVertical: 13,
                            borderWidth: 1,
                            borderColor: isExpanded ? primaryColor : colors.border,
                            borderBottomWidth: isExpanded ? 0 : 1,
                          }}
                        >
                          {/* Status dot */}
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: group.isActive ? primaryColor : colors.textTertiary, marginRight: 10, flexShrink: 0 }} />
                          {/* Name */}
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>{group.campaignName}</Text>
                          {/* Breakdown pills */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${primaryColor}15`, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                              <Activity size={10} color={primaryColor} />
                              <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>{group.activeCount}</Text>
                            </View>
                            {group.pausedCount > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: isDark ? colors.backgroundTertiary ?? '#1E293B' : '#F1F5F9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                                <Pause size={10} color={colors.textTertiary} />
                                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700' }}>{group.pausedCount}</Text>
                              </View>
                            )}
                            <View style={{ backgroundColor: isDark ? colors.backgroundTertiary ?? '#1E293B' : '#F8FAFC', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{group.clients.length}</Text>
                            </View>
                          </View>
                          {/* Campaign status badge */}
                          <View style={{ backgroundColor: group.isActive ? `${primaryColor}15` : (isDark ? colors.backgroundTertiary ?? '#1E293B' : '#F1F5F9'), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 6 }}>
                            <Text style={{ color: group.isActive ? primaryColor : colors.textTertiary, fontSize: 11, fontWeight: '600' }}>
                              {group.isActive ? t('active', language) : t('paused', language)}
                            </Text>
                          </View>
                          {/* Chevron */}
                          <View style={{ marginLeft: 6, transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}>
                            <ChevronRight size={16} color={isExpanded ? primaryColor : colors.textTertiary} />
                          </View>
                        </Pressable>

                        {/* Accordion Body */}
                        {isExpanded && (
                          <View style={{
                            borderWidth: 1, borderTopWidth: 0, borderColor: primaryColor,
                            borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden',
                            backgroundColor: isDark ? `${primaryColor}05` : `${primaryColor}03`,
                          }}>
                            {group.clients.length === 0 ? (
                              <View style={{ padding: 20, alignItems: 'center' }}>
                                <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('noClientsInDrip', language)}</Text>
                              </View>
                            ) : (
                              group.clients.map((client, ci) => {
                                const isSelected = selectedClientIds.includes(client.id);
                                // Use enrollmentIsActive from the client object (already derived from DB)
                                const isClientActive = client.enrollmentIsActive !== false;
                                const menuKey = `${client.id}:${group.campaignId}`;
                                const isMenuOpen = clientMenuOpenKey === menuKey;

                                return (
                                  <Animated.View key={client.id} entering={FadeInDown.delay(ci * 22).duration(180)}>
                                    <View
                                      style={{
                                        borderBottomWidth: ci < group.clients.length - 1 ? 1 : 0,
                                        borderBottomColor: colors.border,
                                      }}
                                    >
                                      {/* Client row */}
                                      <Pressable
                                        onPress={() => {
                                          setClientMenuOpenKey(null);
                                          setSelectedClientIds((prev) =>
                                            isSelected ? prev.filter((id) => id !== client.id) : [...prev, client.id]
                                          );
                                        }}
                                        style={{
                                          flexDirection: 'row', alignItems: 'center',
                                          paddingHorizontal: 14, paddingVertical: 12,
                                          backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                                        }}
                                      >
                                        {/* Select circle */}
                                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: isSelected ? primaryColor : colors.border, backgroundColor: isSelected ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                                          {isSelected && <Check size={11} color="#fff" />}
                                        </View>
                                        {/* Avatar */}
                                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                                          <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 11 }}>{getClientInitials(client.name)}</Text>
                                        </View>
                                        {/* Name + campaign */}
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isClientActive ? '#22C55E' : colors.textTertiary }} />
                                            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                                              {isClientActive ? t('active', language) : t('paused', language)}
                                            </Text>
                                          </View>
                                        </View>
                                        {/* Three-dot menu button */}
                                        <Pressable
                                          onPress={(e) => {
                                            e.stopPropagation?.();
                                            setClientMenuOpenKey(isMenuOpen ? null : menuKey);
                                          }}
                                          style={{ padding: 8 }}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                          <MoreHorizontal size={18} color={isMenuOpen ? primaryColor : colors.textTertiary} />
                                        </Pressable>
                                      </Pressable>

                                      {/* Inline action menu */}
                                      {isMenuOpen && (
                                        <Animated.View entering={FadeInDown.delay(0).duration(150)} style={{
                                          flexDirection: 'row', gap: 8,
                                          paddingHorizontal: 14, paddingBottom: 12,
                                          backgroundColor: 'transparent',
                                        }}>
                                          {/* Pause / Resume */}
                                          <Pressable
                                            onPress={() => {
                                              if (!businessId || !group.campaignId) return;
                                              const newActive = !isClientActive;
                                              setClientMenuOpenKey(null);
                                              queryClient.setQueryData<import('@/services/dripCampaignsService').EnrollmentRow[]>(
                                                enrollmentKeys.list(businessId),
                                                (old) => (old ?? []).map((en) =>
                                                  en.client_id === client.id && en.campaign_id === group.campaignId
                                                    ? { ...en, is_active: newActive }
                                                    : en
                                                )
                                              );
                                              updateEnrollmentStatus(client.id, group.campaignId!, businessId, newActive)
                                                .then(() => queryClient.invalidateQueries({ queryKey: enrollmentKeys.list(businessId) }))
                                                .catch(() => queryClient.invalidateQueries({ queryKey: enrollmentKeys.list(businessId) }));
                                            }}
                                            style={{
                                              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                                              paddingVertical: 9, borderRadius: 10,
                                              backgroundColor: isClientActive ? (isDark ? '#1E293B' : '#F1F5F9') : `${primaryColor}15`,
                                              borderWidth: 1,
                                              borderColor: isClientActive ? colors.border : `${primaryColor}30`,
                                            }}
                                          >
                                            {isClientActive
                                              ? <PauseCircle size={14} color={colors.textSecondary} />
                                              : <PlayCircle size={14} color={primaryColor} />
                                            }
<Text style={{ color: isClientActive ? colors.textSecondary : primaryColor, fontSize: 12, fontWeight: '600' }}>
                                              {isClientActive ? t('pauseEnrollment', language) : t('resumeEnrollment', language)}
                                            </Text>
                                          </Pressable>
                                          {/* Remove */}
                                          <Pressable
                                            onPress={() => {
                                              if (!businessId || !group.campaignId) return;
                                              setClientMenuOpenKey(null);
                                              queryClient.setQueryData<import('@/services/dripCampaignsService').EnrollmentRow[]>(
                                                enrollmentKeys.list(businessId),
                                                (old) => (old ?? []).filter((en) =>
                                                  !(en.client_id === client.id && en.campaign_id === group.campaignId)
                                                )
                                              );
                                              persistClientDripAssignment(client.id, null, businessId, group.campaignId!)
                                                .then(() => queryClient.invalidateQueries({ queryKey: enrollmentKeys.list(businessId) }))
                                                .catch(() => queryClient.invalidateQueries({ queryKey: enrollmentKeys.list(businessId) }));
                                            }}
                                            style={{
                                              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                                              paddingVertical: 9, borderRadius: 10,
                                              backgroundColor: '#FEE2E2',
                                              borderWidth: 1, borderColor: '#FECACA',
                                            }}
                                          >
                                            <UserMinus size={14} color="#DC2626" />
                                            <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>
                                              {t('removeFromCampaign', language)}
                                            </Text>
                                          </Pressable>
                                        </Animated.View>
                                      )}
                                    </View>
                                  </Animated.View>
                                );
                              })
                            )}
                          </View>
                        )}
                      </Animated.View>
                    );
                  })}
                </>
              );
            })()}

            {/* Empty state when filters produce nothing at all */}
            {!clientsLoading && !enrollmentsLoading && filteredClients.length === 0 && (
              <Animated.View entering={FadeIn.delay(100).duration(300)} style={{ alignItems: 'center', paddingVertical: 40 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${primaryColor}12`, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Users size={26} color={colors.textTertiary} />
                </View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                  {isFiltered ? t('noClientsMatchFilters', language) : t('noClientsFound', language)}
                </Text>
                {isFiltered && (
                  <Pressable
                    onPress={() => {
                      setAssignSearch('');
                      setViewingStatCategory(null);
                      setAssignTargeting((prev) => ({ ...prev, filterType: 'all', selectedStoreId: null }));
                    }}
                    style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: `${primaryColor}15`, borderWidth: 1, borderColor: `${primaryColor}30` }}
                  >
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600' }}>{t('clearFilter', language)}</Text>
                  </Pressable>
                )}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky Assign Button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 8) + 8, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        {selectedClientIds.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>
              {selectedClientIds.length} {t('selected', language)}
            </Text>
            <Pressable onPress={() => setSelectedClientIds([])}>
              <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600' }}>{t('clearFilter', language)}</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          onPress={() => onOpenAssignWizard(selectedClientIds.length > 0 ? selectedClientIds : undefined)}
          style={{ backgroundColor: buttonColor, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
        >
          <UserPlus size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
            {selectedClientIds.length > 0
              ? `${t('assignNewCampaign', language)} (${selectedClientIds.length})`
              : t('assignNewCampaign', language)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
