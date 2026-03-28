import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  ChevronRight,
  ChevronDown,
  Check,
  Search,
  Filter,
  UserMinus,
  Activity,
  Users,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useAllMemberships } from '@/hooks/useMembership';
import { useClients } from '@/hooks/useClients';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useStores } from '@/hooks/useStores';

// ============================================
// Membership Assign View
// ============================================

export function MembershipAssignView() {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const { data: rawClients = [], isLoading: clientsLoading } = useClients();
  const { data: allMemberships = [] } = useAllMemberships();
  const { data: allClientLoyalty = [] } = useAllClientLoyalty();
  const { data: allGiftCards = [] } = useGiftCards();
  const { data: supabaseStores = [] } = useStores();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showTargeting, setShowTargeting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targeting, setTargeting] = useState<{
    filterType: 'all' | 'newThisMonth' | 'atRisk' | 'topClients' | 'visitFrequency' | 'membership' | 'loyalty' | 'giftCard';
    visitFrequency: 'frequent' | 'occasional' | 'oneTime';
    membershipStatus: 'active' | 'past_due';
    selectedStoreId: string | null;
  }>({
    filterType: 'all',
    visitFrequency: 'frequent',
    membershipStatus: 'active',
    selectedStoreId: null,
  });
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const clients = useMemo(() => {
    return rawClients
      .filter((c) => !(c as any).is_archived)
      .map((c) => ({
        id: c.id,
        name: c.name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        visitsCount: (c as any).visits_count ?? 0,
        lastVisitAt: (c as any).last_visit_at ? new Date((c as any).last_visit_at) : null,
      }));
  }, [rawClients]);

  const enrolledClientIds = useMemo(
    () => new Set(allMemberships.filter((m) => m.status === 'active').map((m) => m.clientId)),
    [allMemberships]
  );

  const filteredClients = useMemo(() => {
    let list = clients;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.replace(/[\s\-\(\)\+]/g, '').includes(q.replace(/[\s\-\(\)\+]/g, ''))
      );
    }
    if (targeting.filterType === 'newThisMonth') {
      const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      list = list.filter((c) => c.createdAt >= start);
    } else if (targeting.filterType === 'atRisk') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      list = list.filter((c) => !c.lastVisitAt || c.lastVisitAt < cutoff);
    } else if (targeting.filterType === 'topClients') {
      const sorted = [...list].sort((a, b) => b.visitsCount - a.visitsCount);
      list = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.2)));
    } else if (targeting.filterType === 'membership') {
      const ids = new Set(allMemberships.filter((m) => m.status === targeting.membershipStatus).map((m) => m.clientId));
      list = list.filter((c) => ids.has(c.id));
    } else if (targeting.filterType === 'loyalty') {
      const loyaltyIds = new Set(allClientLoyalty.filter((lc) => lc.is_enrolled).map((lc) => lc.client_id));
      list = list.filter((c) => loyaltyIds.has(c.id));
    } else if (targeting.filterType === 'giftCard') {
      const gcIds = new Set(allGiftCards.filter((gc) => gc.status === 'active').map((gc) => gc.clientId).filter(Boolean));
      list = list.filter((c) => gcIds.has(c.id));
    } else if (targeting.filterType === 'visitFrequency') {
      if (targeting.visitFrequency === 'frequent') list = list.filter((c) => c.visitsCount >= 5);
      else if (targeting.visitFrequency === 'occasional') list = list.filter((c) => c.visitsCount >= 2 && c.visitsCount <= 4);
      else list = list.filter((c) => c.visitsCount === 1);
    }
    return list;
  }, [clients, debouncedSearch, targeting, allMemberships, allClientLoyalty, allGiftCards]);

  const unenrolledFiltered = useMemo(() => filteredClients.filter((c) => !enrolledClientIds.has(c.id)), [filteredClients, enrolledClientIds]);
  const enrolledFiltered = useMemo(() => filteredClients.filter((c) => enrolledClientIds.has(c.id)), [filteredClients, enrolledClientIds]);

  // Auto-expand both groups when search or filter is active so results are immediately visible
  useEffect(() => {
    const isFiltering = debouncedSearch.trim() !== '' || targeting.filterType !== 'all';
    if (isFiltering) {
      setExpandedGroupId('unenrolled');
    }
  }, [debouncedSearch, targeting.filterType]);

  const getClientInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const filterBadgeLabel = useMemo((): string | undefined => {
    if (targeting.filterType === 'all') return undefined;
    type FilterType = 'all' | 'newThisMonth' | 'atRisk' | 'topClients' | 'visitFrequency' | 'membership' | 'loyalty' | 'giftCard';
    const map: Record<FilterType, string> = {
      all: t('allClients', language),
      newThisMonth: t('newThisMonthFilter', language),
      atRisk: t('atRiskFilter', language),
      topClients: t('topClientsFilter', language),
      visitFrequency: t('visitFrequencyFilter', language),
      membership: t('membership', language),
      loyalty: t('loyaltyFilter', language),
      giftCard: t('giftCardFilter', language),
    };
    return map[targeting.filterType];
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
              value={search}
              onChangeText={setSearch}
              onFocus={() => { setSearchFocused(true); setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100); }}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('searchClientsPlaceholder', language)}
              placeholderTextColor={colors.inputPlaceholder}
              style={{ flex: 1, fontSize: 14, color: colors.inputText }}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Stats Cards */}
        <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {([
              { label: t('enrolledInMembership', language), count: enrolledFiltered.length, icon: <Activity size={14} color={primaryColor} />, key: 'enrolled' },
              { label: t('notEnrolledInMembership', language), count: unenrolledFiltered.length, icon: <UserMinus size={14} color={primaryColor} />, key: 'unenrolled' },
            ]).map((stat) => (
              <View key={stat.key} style={{ flex: 1, backgroundColor: `${primaryColor}10`, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: `${primaryColor}20` }}>
                {stat.icon}
                <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '700', marginTop: 4 }}>{stat.count}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 2 }} numberOfLines={2}>{stat.label}</Text>
              </View>
            ))}
            <View style={{ flex: 1, backgroundColor: `${primaryColor}10`, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: `${primaryColor}20` }}>
              <Users size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '700', marginTop: 4 }}>{filteredClients.length}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 2 }} numberOfLines={2}>{t('allClients', language)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Advanced Targeting */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={{ marginBottom: 16 }}>
          <Pressable
            onPress={() => setShowTargeting((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: showTargeting ? `${primaryColor}40` : colors.border }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Filter size={15} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t('advancedTargeting', language)}</Text>
                {filterBadgeLabel && (
                  <View style={{ marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: `${primaryColor}20` }}>
                    <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>{filterBadgeLabel}</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{t('advancedTargetingDesc', language)}</Text>
            </View>
            <ChevronDown size={16} color={colors.textSecondary} style={{ transform: [{ rotate: showTargeting ? '180deg' : '0deg' }] }} />
          </Pressable>
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
                ] as { key: typeof targeting.filterType; labelKey: string }[]).map(({ key, labelKey }) => (
                  <Pressable
                    key={key}
                    onPress={() => setTargeting((prev) => ({ ...prev, filterType: key }))}
                    style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: targeting.filterType === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: targeting.filterType === key ? primaryColor : colors.border }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '500', color: targeting.filterType === key ? '#fff' : colors.textSecondary }}>{t(labelKey as any, language)}</Text>
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
                  {([{ key: 'frequent', labelKey: 'frequentClients' }, { key: 'occasional', labelKey: 'occasionalClients' }, { key: 'oneTime', labelKey: 'oneTimeClients' }] as { key: 'frequent' | 'occasional' | 'oneTime'; labelKey: string }[]).map(({ key, labelKey }) => (
                    <Pressable key={key} onPress={() => setTargeting((prev) => ({ ...prev, visitFrequency: key }))} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: targeting.visitFrequency === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: targeting.visitFrequency === key ? primaryColor : colors.border }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: targeting.visitFrequency === key ? '#fff' : colors.textSecondary }}>{t(labelKey as any, language)}</Text>
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
            {(targeting.filterType === 'all' || unenrolledFiltered.length > 0) && (
              <Animated.View entering={FadeInDown.delay(0).duration(300)} style={{ marginBottom: 16 }}>
                <Pressable
                  onPress={() => setExpandedGroupId(expandedGroupId === 'unenrolled' ? null : 'unenrolled')}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: expandedGroupId === 'unenrolled' ? `${primaryColor}0D` : colors.card, borderRadius: 14, borderBottomLeftRadius: expandedGroupId === 'unenrolled' ? 0 : 14, borderBottomRightRadius: expandedGroupId === 'unenrolled' ? 0 : 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: expandedGroupId === 'unenrolled' ? primaryColor : colors.border, borderBottomWidth: expandedGroupId === 'unenrolled' ? 0 : 1 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <UserMinus size={18} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{t('unassignedClientsCard', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{t('notEnrolledInMembership', language)}</Text>
                  </View>
                  {selectedIds.length > 0 && (
                    <View style={{ backgroundColor: `${primaryColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6 }}>
                      <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>{selectedIds.length}</Text>
                    </View>
                  )}
                  <View style={{ backgroundColor: unenrolledFiltered.length > 0 ? '#F59E0B20' : `${primaryColor}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 8 }}>
                    <Text style={{ color: unenrolledFiltered.length > 0 ? '#F59E0B' : primaryColor, fontWeight: '700', fontSize: 14 }}>{unenrolledFiltered.length}</Text>
                  </View>
                  <View style={{ transform: [{ rotate: expandedGroupId === 'unenrolled' ? '90deg' : '0deg' }] }}>
                    <ChevronRight size={16} color={expandedGroupId === 'unenrolled' ? primaryColor : colors.textTertiary} />
                  </View>
                </Pressable>
                {expandedGroupId === 'unenrolled' && (
                  <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: primaryColor, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', backgroundColor: isDark ? `${primaryColor}05` : `${primaryColor}03` }}>
                    {unenrolledFiltered.length === 0 ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('noClientsFound', language)}</Text>
                      </View>
                    ) : (
                      unenrolledFiltered.map((client, ci) => {
                        const isSelected = selectedIds.includes(client.id);
                        return (
                          <Animated.View key={client.id} entering={FadeInDown.delay(ci * 20).duration(180)}>
                            <Pressable
                              onPress={() => toggleSelect(client.id)}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: ci < unenrolledFiltered.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: isSelected ? `${primaryColor}08` : 'transparent' }}
                            >
                              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? primaryColor : colors.border, backgroundColor: isSelected ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                                {isSelected && <Check size={12} color="#fff" />}
                              </View>
                              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 11 }}>{getClientInitials(client.name)}</Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
                                {client.email ? <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>{client.email}</Text> : null}
                              </View>
                              <View style={{ backgroundColor: '#F59E0B18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '600' }}>{t('notEnrolledInMembership', language)}</Text>
                              </View>
                            </Pressable>
                          </Animated.View>
                        );
                      })
                    )}
                  </View>
                )}
              </Animated.View>
            )}

            {enrolledFiltered.length > 0 && (
              <>
                <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }}>
                    <Activity size={12} color={primaryColor} />
                    <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {t('membershipAssignActiveSection', language)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </Animated.View>
                <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ marginBottom: 8 }}>
                  <Pressable
                    onPress={() => setExpandedGroupId(expandedGroupId === 'enrolled' ? null : 'enrolled')}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: expandedGroupId === 'enrolled' ? `${primaryColor}0A` : colors.card, borderRadius: 14, borderBottomLeftRadius: expandedGroupId === 'enrolled' ? 0 : 14, borderBottomRightRadius: expandedGroupId === 'enrolled' ? 0 : 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: expandedGroupId === 'enrolled' ? primaryColor : colors.border, borderBottomWidth: expandedGroupId === 'enrolled' ? 0 : 1 }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: primaryColor, marginRight: 10, flexShrink: 0 }} />
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }}>{t('enrolledInMembership', language)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${primaryColor}15`, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginRight: 6 }}>
                      <Activity size={10} color={primaryColor} />
                      <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>{enrolledFiltered.length}</Text>
                    </View>
                    <View style={{ transform: [{ rotate: expandedGroupId === 'enrolled' ? '90deg' : '0deg' }] }}>
                      <ChevronRight size={16} color={expandedGroupId === 'enrolled' ? primaryColor : colors.textTertiary} />
                    </View>
                  </Pressable>
                  {expandedGroupId === 'enrolled' && (
                    <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: primaryColor, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden', backgroundColor: isDark ? `${primaryColor}05` : `${primaryColor}03` }}>
                      {enrolledFiltered.map((client, ci) => (
                        <Animated.View key={client.id} entering={FadeInDown.delay(ci * 22).duration(180)}>
                          <View style={{ borderBottomWidth: ci < enrolledFiltered.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
                              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                                <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 11 }}>{getClientInitials(client.name)}</Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
                                {client.email ? <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>{client.email}</Text> : null}
                              </View>
                              <View style={{ backgroundColor: '#10B98115', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                                <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>{t('enrolledInMembership', language)}</Text>
                              </View>
                            </View>
                          </View>
                        </Animated.View>
                      ))}
                    </View>
                  )}
                </Animated.View>
              </>
            )}

            {debouncedSearch.trim() !== '' && filteredClients.length === 0 && (
              <Animated.View entering={FadeIn.delay(60).duration(300)} style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>{t('noClientsFound', language)}</Text>
              </Animated.View>
            )}
            {debouncedSearch.trim() === '' && unenrolledFiltered.length === 0 && enrolledFiltered.length === 0 && !clientsLoading && (
              <Animated.View entering={FadeIn.delay(60).duration(300)} style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>{t('noClientsInMembership', language)}</Text>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {/* Assign Button */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 8) + 8, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: buttonColor, borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: selectedIds.length > 0 ? 1 : 0.85 }}
        >
          <Plus size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
            {selectedIds.length > 0
              ? `${t('assignMembershipPlans', language)} (${selectedIds.length})`
              : t('assignMembershipPlans', language)}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
