import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X, Plus, ChevronRight,
  Activity, Clock, Filter, UserMinus, Search,
  PauseCircle, Users,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useBusiness } from '@/hooks/useBusiness';
import { useClients } from '@/hooks/useClients';
import { useAllMemberships } from '@/hooks/useMembership';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useStores } from '@/hooks/useStores';
import { usePromotionAssignments, usePromotionAssignmentActions } from '@/hooks/usePromotionAssignments';
import { PromoSectionHeader as SectionHeader } from '@/components/promo/PromoSectionHeader';
import { PromoStatsGrid } from '@/components/promo/PromoStatsGrid';
import { UnassignedClientRow } from '@/components/promo/UnassignedClientRow';
import { AssignedClientRow } from '@/components/promo/AssignedClientRow';

// ============================================
// Types (local to AssignManageView)
// ============================================

export type TargetFilterType = 'all' | 'newThisMonth' | 'atRisk' | 'topClients' | 'visitFrequency' | 'membership' | 'loyalty' | 'giftCard';

export interface PromoTargeting {
  filterType: TargetFilterType;
  visitFrequency: 'frequent' | 'occasional' | 'oneTime';
  membershipStatus: 'active' | 'past_due';
  selectedStoreId: string | null;
}

// ============================================
// AssignManageView
// Tab 2 of MarketingPromoScreen — client assignment & management.
// ============================================

export function AssignManageView({ onOpenAssignWizard }: { onOpenAssignWizard: (preSelectedIds?: string[]) => void }) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const user = useStore((s) => s.user);
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const assignClientToPromotion = useStore((s) => s.assignClientToPromotion);
  const storeClients = useStore((s) => s.clients);
  const { businessId } = useBusiness();
  const insets = useSafeAreaInsets();

  const { data: rawClients = [], isLoading: clientsLoading } = useClients();
  const { data: allMemberships = [] } = useAllMemberships();
  const { data: allClientLoyalty = [] } = useAllClientLoyalty();
  const { data: allGiftCards = [] } = useGiftCards();
  const { data: supabaseStores = [] } = useStores();

  // DB-persisted assignment statuses
  const { data: dbAssignments = [], isLoading: assignmentsLoading } = usePromotionAssignments();
  const { pause: pauseAssignment, resume: resumeAssignment, remove: removeAssignment } = usePromotionAssignmentActions();

  const scrollRef = useRef<ScrollView>(null);

  const [assignSearch, setAssignSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showTargeting, setShowTargeting] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [clientMenuOpenKey, setClientMenuOpenKey] = useState<string | null>(null);
  const [viewingStatCategory, setViewingStatCategory] = useState<'active' | 'inProgress' | 'completed' | 'total' | null>(null);
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<string[]>([]);
  const [targeting, setTargeting] = useState<PromoTargeting>({
    filterType: 'all',
    visitFrequency: 'frequent',
    membershipStatus: 'active',
    selectedStoreId: null,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(assignSearch), 200);
    return () => clearTimeout(timer);
  }, [assignSearch]);

  // My promotions
  const marketingPromotions = useMemo(() => {
    if (!user?.id) return [];
    const filtered = allMarketingPromotions.filter((p) => p.userId === user.id);
    return filtered.length > 0 ? filtered : allMarketingPromotions;
  }, [allMarketingPromotions, user?.id]);

  // Build a lookup: clientId -> activePromotionId from store clients (source of truth for assignment)
  const promotionByClientId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of storeClients) {
      if (c.activePromotionId) map.set(c.id, c.activePromotionId);
    }
    return map;
  }, [storeClients]);

  // Build a lookup: clientId -> clientPromotions from store
  const clientPromotionsByClientId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof storeClients[0]['clientPromotions']>>();
    for (const c of storeClients) {
      if (c.clientPromotions && c.clientPromotions.length > 0) {
        map.set(c.id, c.clientPromotions);
      }
    }
    return map;
  }, [storeClients]);

  // Map raw clients with promotion data
  const clients = useMemo(() => {
    return rawClients.map((c) => ({
      id: c.id,
      name: c.name ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      isArchived: (c as any).is_archived === true,
      activePromotionId: promotionByClientId.get(c.id) ?? undefined,
      clientPromotions: clientPromotionsByClientId.get(c.id) ?? [],
      createdAt: c.created_at ? new Date(c.created_at) : new Date(),
      visitsCount: (c as any).visits_count ?? 0,
      lastVisitAt: (c as any).last_visit_at ? new Date((c as any).last_visit_at) : null,
    }));
  }, [rawClients, promotionByClientId, clientPromotionsByClientId]);

  const activeClients = useMemo(() => clients.filter((c) => !c.isArchived), [clients]);

  // Apply search + targeting filters
  const filteredClients = useMemo(() => {
    let list = activeClients;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      const normalizePhone = (p: string) => p.replace(/[\s\-\(\)\+]/g, '');
      const qPhone = normalizePhone(q);
      list = list.filter((c) => {
        const fullName = c.name?.toLowerCase() ?? '';
        const phone = normalizePhone(c.phone?.toLowerCase() ?? '');
        const email = c.email?.toLowerCase() ?? '';
        return fullName.includes(q) || phone.includes(qPhone) || email.includes(q);
      });
    }

    if (targeting.filterType === 'newThisMonth') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((c) => c.createdAt >= start);
    } else if (targeting.filterType === 'atRisk') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      list = list.filter((c) => !c.lastVisitAt || c.lastVisitAt < cutoff);
    } else if (targeting.filterType === 'topClients') {
      const sorted = [...list].sort((a, b) => (b.visitsCount ?? 0) - (a.visitsCount ?? 0));
      list = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.2)));
    } else if (targeting.filterType === 'membership') {
      const enrolledIds = new Set(
        allMemberships.filter((m) => m.status === targeting.membershipStatus).map((m) => m.clientId)
      );
      list = list.filter((c) => enrolledIds.has(c.id));
    } else if (targeting.filterType === 'loyalty') {
      const enrolledIds = new Set(allClientLoyalty.filter((lc) => lc.is_enrolled).map((lc) => lc.client_id));
      list = list.filter((c) => enrolledIds.has(c.id));
    } else if (targeting.filterType === 'giftCard') {
      const gcClientIds = new Set(
        allGiftCards.filter((gc) => gc.status === 'active').map((gc) => gc.clientId).filter(Boolean)
      );
      list = list.filter((c) => gcClientIds.has(c.id));
    } else if (targeting.filterType === 'visitFrequency') {
      if (targeting.visitFrequency === 'frequent') {
        list = list.filter((c) => (c.visitsCount ?? 0) >= 5);
      } else if (targeting.visitFrequency === 'occasional') {
        list = list.filter((c) => { const v = c.visitsCount ?? 0; return v >= 2 && v <= 4; });
      } else {
        list = list.filter((c) => (c.visitsCount ?? 0) === 1);
      }
    }

    if (targeting.selectedStoreId) {
      // No appointment data available here; store filter is best-effort via membership/loyalty lookup
    }

    return list;
  }, [activeClients, debouncedSearch, targeting, allMemberships, allClientLoyalty, allGiftCards]);

  // Build lookup: clientId -> DB assignment (status, promotionId)
  // Source of truth: dbAssignments from React Query (backend JSON store)
  const dbAssignmentByClientId = useMemo(() => {
    const map = new Map<string, { promotionId: string; status: 'active' | 'paused' }>();
    for (const a of dbAssignments) {
      map.set(a.client_id, { promotionId: a.promotion_id, status: a.status as 'active' | 'paused' });
    }
    return map;
  }, [dbAssignments]);

  // Stats — computed directly from dbAssignments (DB truth), NOT from filteredClients
  // This ensures stats are always accurate regardless of targeting/search filters
  const activeCount = useMemo(() =>
    dbAssignments.filter((a) => a.status === 'active').length,
    [dbAssignments]
  );

  const pausedCount = useMemo(() =>
    dbAssignments.filter((a) => a.status === 'paused').length,
    [dbAssignments]
  );

  const totalAssigned = useMemo(() =>
    dbAssignments.length,
    [dbAssignments]
  );

  // Unassigned = active clients NOT present in any DB assignment
  const unassignedClients = useMemo(() =>
    filteredClients.filter((c) => !dbAssignmentByClientId.has(c.id)),
    [filteredClients, dbAssignmentByClientId]
  );

  // Group by promotion using DB assignments
  const groupedByPromo = useMemo(() => {
    const groups: {
      promoId: string;
      promoName: string;
      isActive: boolean;
      clients: (typeof filteredClients[0] & { assignmentStatus: 'active' | 'paused' })[];
      activeCount: number;
      pausedCount: number;
      inProgressCount: number;
    }[] = [];
    marketingPromotions.forEach((promo) => {
      const promoClients = filteredClients
        .filter((c) => dbAssignmentByClientId.get(c.id)?.promotionId === promo.id)
        .map((c) => ({ ...c, assignmentStatus: dbAssignmentByClientId.get(c.id)!.status }));
      if (promoClients.length > 0) {
        const activeC = promoClients.filter((c) => c.assignmentStatus === 'active').length;
        const pausedC = promoClients.filter((c) => c.assignmentStatus === 'paused').length;
        const inProgressC = promoClients.filter((c) =>
          c.clientPromotions.some((cp) => cp.promotionId === promo.id && cp.currentCount > 0 && !cp.isCompleted)
        ).length;
        groups.push({
          promoId: promo.id,
          promoName: promo.name,
          isActive: promo.isActive,
          clients: promoClients,
          activeCount: activeC,
          pausedCount: pausedC,
          inProgressCount: inProgressC,
        });
      }
    });
    return groups;
  }, [filteredClients, marketingPromotions, dbAssignmentByClientId]);

  const getClientInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleRemoveFromPromo = useCallback(async (clientId: string, promotionId: string) => {
    setClientMenuOpenKey(null);
    // Persist removal to DB + update Zustand local state
    await removeAssignment(clientId, promotionId);
    assignClientToPromotion(clientId, undefined);
  }, [removeAssignment, assignClientToPromotion]);

  const handlePausePromo = useCallback(async (clientId: string, promotionId: string) => {
    setClientMenuOpenKey(null);
    await pauseAssignment(clientId, promotionId);
  }, [pauseAssignment]);

  const handleResumePromo = useCallback(async (clientId: string, promotionId: string) => {
    setClientMenuOpenKey(null);
    await resumeAssignment(clientId, promotionId);
  }, [resumeAssignment]);

  const toggleSelectUnassigned = useCallback((clientId: string) => {
    setSelectedUnassignedIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  }, []);

  // Stable set of current unassigned IDs — only recomputes when IDs actually change
  const unassignedIdSet = useMemo(
    () => new Set(unassignedClients.map((c) => c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unassignedClients.map((c) => c.id).join(',')]
  );

  // Clear stale selections when the unassigned list shrinks (e.g. after assigning).
  const unassignedIdsKey = unassignedClients.map((c) => c.id).join(',');
  useEffect(() => {
    setSelectedUnassignedIds((prev) => {
      const next = prev.filter((id) => unassignedIdSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unassignedIdsKey]);

  const filterBadgeLabel = useMemo((): string | undefined => {
    if (targeting.filterType === 'all') return undefined;
    const map: Record<TargetFilterType, TranslationKey> = {
      all: 'allClients',
      newThisMonth: 'newThisMonthFilter',
      atRisk: 'atRiskFilter',
      topClients: 'topClientsFilter',
      visitFrequency: 'visitFrequencyFilter',
      membership: 'membership',
      loyalty: 'loyaltyFilter',
      giftCard: 'giftCardFilter',
    };
    return t(map[targeting.filterType], language);
  }, [targeting.filterType, language]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 14, borderWidth: 1, borderColor: searchFocused ? primaryColor : colors.inputBorder, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 }}>
            <Search size={16} color={searchFocused ? primaryColor : colors.textTertiary} style={{ marginRight: 10 }} />
            <TextInput
              value={assignSearch}
              onChangeText={setAssignSearch}
              onFocus={() => {
                setSearchFocused(true);
                // Scroll to top so search bar + first results are always visible
                setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
              }}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('searchClientsPlaceholder', language)}
              placeholderTextColor={colors.inputPlaceholder}
              style={{ flex: 1, fontSize: 14, color: colors.inputText }}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="never"
            />
            {assignSearch.length > 0 && (
              <Pressable onPress={() => setAssignSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Metric Cards 2x2 grid */}
        <PromoStatsGrid
          row1={[
            { label: t('promoActiveCount', language), count: activeCount, icon: <Activity size={14} color={primaryColor} />, cat: 'active' },
            { label: t('paused', language), count: pausedCount, icon: <PauseCircle size={14} color={primaryColor} />, cat: 'inProgress' },
          ]}
          row2={[
            { label: t('promoTotalAssigned', language), count: totalAssigned, icon: <Users size={14} color={primaryColor} />, cat: 'total' },
          ]}
          viewingStatCategory={viewingStatCategory}
          onSelect={(cat) => setViewingStatCategory(viewingStatCategory === cat ? null : cat)}
          primaryColor={primaryColor}
          textTertiaryColor={colors.textTertiary}
        />

        {/* Advanced Targeting */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={{ marginBottom: 16 }}>
          <SectionHeader
            icon={<Filter size={15} color={primaryColor} />}
            title={t('advancedTargeting', language)}
            subtitle={t('advancedTargetingDesc', language)}
            expanded={showTargeting}
            onToggle={() => setShowTargeting((v) => !v)}
            badge={filterBadgeLabel}
          />
          {showTargeting && (
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
                    onPress={() => setTargeting((prev) => ({ ...prev, filterType: key }))}
                    style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: targeting.filterType === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: targeting.filterType === key ? primaryColor : colors.border }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '500', color: targeting.filterType === key ? '#fff' : colors.textSecondary }}>{t(labelKey, language)}</Text>
                  </Pressable>
                ))}
              </View>
              {targeting.filterType === 'membership' && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {(['active', 'past_due'] as const).map((status) => (
                    <Pressable key={status} onPress={() => setTargeting((prev) => ({ ...prev, membershipStatus: status }))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: targeting.membershipStatus === status ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: targeting.membershipStatus === status ? primaryColor : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: targeting.membershipStatus === status ? '#fff' : colors.textSecondary }}>{status === 'active' ? t('membershipActive', language) : t('membershipPastDue', language)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {targeting.filterType === 'visitFrequency' && (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {([{ key: 'frequent', labelKey: 'frequentClients' }, { key: 'occasional', labelKey: 'occasionalClients' }, { key: 'oneTime', labelKey: 'oneTimeClients' }] as { key: 'frequent' | 'occasional' | 'oneTime'; labelKey: TranslationKey }[]).map(({ key, labelKey }) => (
                    <Pressable key={key} onPress={() => setTargeting((prev) => ({ ...prev, visitFrequency: key }))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: targeting.visitFrequency === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: targeting.visitFrequency === key ? primaryColor : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: targeting.visitFrequency === key ? '#fff' : colors.textSecondary }}>{t(labelKey, language)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {supabaseStores.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  <Pressable onPress={() => setTargeting((prev) => ({ ...prev, selectedStoreId: null }))} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: !targeting.selectedStoreId ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: !targeting.selectedStoreId ? primaryColor : colors.border }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: !targeting.selectedStoreId ? '#fff' : colors.textSecondary }}>{t('allStores', language)}</Text>
                  </Pressable>
                  {supabaseStores.map((store: { id: string; name: string }) => (
                    <Pressable key={store.id} onPress={() => setTargeting((prev) => ({ ...prev, selectedStoreId: store.id }))} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: targeting.selectedStoreId === store.id ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: targeting.selectedStoreId === store.id ? primaryColor : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: targeting.selectedStoreId === store.id ? '#fff' : colors.textSecondary }}>{store.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {clientsLoading ? (
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
            {/* Unassigned Clients Card */}
            {(!viewingStatCategory) && (debouncedSearch.trim() === '' || unassignedClients.length > 0) && (
              <Animated.View entering={FadeInDown.delay(0).duration(300)} style={{ marginBottom: 16 }}>
                <Pressable
                  onPress={() => setExpandedGroupId(expandedGroupId === 'unassigned' ? null : 'unassigned')}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: expandedGroupId === 'unassigned' ? `${primaryColor}0D` : colors.card, borderRadius: 14, borderBottomLeftRadius: expandedGroupId === 'unassigned' ? 0 : 14, borderBottomRightRadius: expandedGroupId === 'unassigned' ? 0 : 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: expandedGroupId === 'unassigned' ? primaryColor : colors.border, borderBottomWidth: expandedGroupId === 'unassigned' ? 0 : 1 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <UserMinus size={18} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t('unassignedClientsCard', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{t('noClientsInPromo', language)}</Text>
                  </View>
                  {selectedUnassignedIds.length > 0 && (
                    <View style={{ backgroundColor: `${primaryColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6 }}>
                      <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>{selectedUnassignedIds.length}</Text>
                    </View>
                  )}
                  <View style={{ backgroundColor: unassignedClients.length > 0 ? '#F59E0B20' : `${primaryColor}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 8 }}>
                    <Text style={{ color: unassignedClients.length > 0 ? '#F59E0B' : primaryColor, fontWeight: '700', fontSize: 14 }}>{unassignedClients.length}</Text>
                  </View>
                  <View style={{ transform: [{ rotate: expandedGroupId === 'unassigned' ? '90deg' : '0deg' }] }}>
                    <ChevronRight size={16} color={expandedGroupId === 'unassigned' ? primaryColor : colors.textTertiary} />
                  </View>
                </Pressable>
                {expandedGroupId === 'unassigned' && (
                  <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: primaryColor, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', backgroundColor: isDark ? `${primaryColor}05` : `${primaryColor}03` }}>
                    {unassignedClients.length === 0 ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('noClientsFound', language)}</Text>
                      </View>
                    ) : (
                      unassignedClients.map((client, ci) => {
                        const isSelected = selectedUnassignedIds.includes(client.id);
                        return (
                          <UnassignedClientRow
                            key={client.id}
                            client={client}
                            index={ci}
                            isSelected={isSelected}
                            isLastItem={ci >= unassignedClients.length - 1}
                            onPress={toggleSelectUnassigned}
                            primaryColor={primaryColor}
                            borderColor={colors.border}
                            textColor={colors.text}
                            textTertiaryColor={colors.textTertiary}
                            initials={getClientInitials(client.name)}
                            unassignedLabel={t('unassignedClients', language)}
                          />
                        );
                      })
                    )}
                  </View>
                )}
              </Animated.View>
            )}

            {/* Marketing Promo Active section */}
            {groupedByPromo.length > 0 && (
              <>
                <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }}>
                    <Activity size={12} color={primaryColor} />
                    <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {t('marketingPromoActiveSection', language)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </Animated.View>

                {groupedByPromo.map((group, gi) => {
                  const groupKey = group.promoId;
                  const isExpanded = expandedGroupId === groupKey;
                  return (
                    <Animated.View key={groupKey} entering={FadeInDown.delay(60 + gi * 35).duration(300)} style={{ marginBottom: 8 }}>
                      <Pressable
                        onPress={() => { setExpandedGroupId(isExpanded ? null : groupKey); setClientMenuOpenKey(null); }}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isExpanded ? `${primaryColor}0A` : colors.card, borderRadius: 14, borderBottomLeftRadius: isExpanded ? 0 : 14, borderBottomRightRadius: isExpanded ? 0 : 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: isExpanded ? primaryColor : colors.border, borderBottomWidth: isExpanded ? 0 : 1 }}
                      >
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: group.isActive ? primaryColor : colors.textTertiary, marginRight: 10, flexShrink: 0 }} />
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>{group.promoName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${primaryColor}15`, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                            <Activity size={10} color={primaryColor} />
                            <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>{group.activeCount}</Text>
                          </View>
                          {group.inProgressCount > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: isDark ? colors.backgroundTertiary ?? '#1E293B' : '#F1F5F9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                              <Clock size={10} color={colors.textTertiary} />
                              <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700' }}>{group.inProgressCount}</Text>
                            </View>
                          )}
                          <View style={{ backgroundColor: isDark ? colors.backgroundTertiary ?? '#1E293B' : '#F8FAFC', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{group.clients.length}</Text>
                          </View>
                        </View>
                        <View style={{ backgroundColor: group.isActive ? `${primaryColor}15` : (isDark ? colors.backgroundTertiary ?? '#1E293B' : '#F1F5F9'), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 6 }}>
                          <Text style={{ color: group.isActive ? primaryColor : colors.textTertiary, fontSize: 11, fontWeight: '600' }}>
                            {group.isActive ? t('active', language) : t('inactive', language)}
                          </Text>
                        </View>
                        <View style={{ marginLeft: 6, transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}>
                          <ChevronRight size={16} color={isExpanded ? primaryColor : colors.textTertiary} />
                        </View>
                      </Pressable>

                      {isExpanded && (
                        <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: primaryColor, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', backgroundColor: isDark ? `${primaryColor}05` : `${primaryColor}03` }}>
                          {group.clients.length === 0 ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('noClientsInPromo', language)}</Text>
                            </View>
                          ) : (
                            group.clients.map((client, ci) => {
                              const menuKey = `${client.id}:${group.promoId}`;
                              const isMenuOpen = clientMenuOpenKey === menuKey;
                              const cpEntry = client.clientPromotions.find((cp) => cp.promotionId === group.promoId);
                              const isInProgress = !!(cpEntry && cpEntry.currentCount > 0 && !cpEntry.isCompleted);
                              const isCompleted = cpEntry?.isCompleted ?? false;

                              return (
                                <AssignedClientRow
                                  key={client.id}
                                  client={client}
                                  index={ci}
                                  isLastItem={ci >= group.clients.length - 1}
                                  isMenuOpen={isMenuOpen}
                                  isInProgress={isInProgress}
                                  isCompleted={isCompleted}
                                  onMenuToggle={() => setClientMenuOpenKey(isMenuOpen ? null : menuKey)}
                                  onPause={() => handlePausePromo(client.id, group.promoId)}
                                  onResume={() => handleResumePromo(client.id, group.promoId)}
                                  onRemove={() => handleRemoveFromPromo(client.id, group.promoId)}
                                  initials={getClientInitials(client.name)}
                                  primaryColor={primaryColor}
                                  borderColor={colors.border}
                                  textColor={colors.text}
                                  textSecondaryColor={colors.textSecondary}
                                  textTertiaryColor={colors.textTertiary}
                                  isDark={isDark}
                                  pausedLabel={t('paused', language)}
                                  completedLabel={t('promoCompletedCount', language)}
                                  inProgressLabel={t('promoInProgressCount', language)}
                                  activeLabel={t('promoActiveCount', language)}
                                  pauseLabel={t('pause', language)}
                                  resumeLabel={t('resumeEnrollment', language)}
                                  removeLabel={t('removeFromPromotion', language)}
                                />
                              );
                            })
                          )}
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
              </>
            )}

            {debouncedSearch.trim() !== '' && filteredClients.length === 0 && !clientsLoading && (
              <Animated.View entering={FadeIn.delay(60).duration(300)} style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>No matches found</Text>
              </Animated.View>
            )}

            {debouncedSearch.trim() === '' && groupedByPromo.length === 0 && unassignedClients.length === 0 && !clientsLoading && (
              <Animated.View entering={FadeIn.delay(60).duration(300)} style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>{t('noPromotionsToAssign', language)}</Text>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* Assign Button — sibling to ScrollView so KAV pushes it up with the keyboard */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 8) + 8, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={() => {
            if (selectedUnassignedIds.length > 0) {
              onOpenAssignWizard(selectedUnassignedIds);
            } else {
              onOpenAssignWizard();
            }
          }}
          style={{
            backgroundColor: selectedUnassignedIds.length > 0 ? buttonColor : buttonColor,
            borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            opacity: selectedUnassignedIds.length > 0 ? 1 : 0.85,
          }}
        >
          <Plus size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
            {selectedUnassignedIds.length > 0
              ? `${t('assignMarketingPromotion', language)} (${selectedUnassignedIds.length})`
              : t('assignMarketingPromotion', language)}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
