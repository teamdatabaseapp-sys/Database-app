import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  Users,
  UserPlus,
  ShieldAlert,
  Trophy,
  Scissors,
  Gift,
  BarChart2,
  CreditCard,
  Star,
  Sparkles,
  ChevronRight,
  Lock,
  Store as StoreIcon,
} from 'lucide-react-native';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';

type FilterType = 'all' | 'newThisMonth' | 'promotionParticipants' | 'atRisk' | 'topClients' | 'byService' | 'visitFrequency' | 'membership' | 'loyalty' | 'giftCard';

interface ServiceItem {
  id: string;
  name: string;
  color?: string;
}

interface PromotionItem {
  id: string;
  name: string;
  color: string;
}

interface MembershipPlanItem {
  id: string;
  name: string;
}

interface StoreItem {
  id: string;
  name: string;
}

interface RecipientFilterCardsProps {
  // Current filter state (read)
  filterType: FilterType;
  filterByStore: string | null;
  selectedPromotionFilter: string | null;
  selectedServiceFilter: string | null;
  topClientsSortBy: 'revenue' | 'visits';
  visitFrequency: 'frequent' | 'occasional' | 'oneTime';
  membershipStatus: 'active' | 'past_due';
  selectedMembershipPlan: string | null;
  loyaltySubFilter: 'enrolled' | 'hasPoints' | 'redeemed' | 'topEarners';
  giftCardSubFilter: 'any' | 'value' | 'service';

  // Data
  supabaseServices: ServiceItem[];
  marketingPromotions: PromotionItem[];
  membershipPlans: MembershipPlanItem[];
  stores: StoreItem[];

  // Theme
  isDark: boolean;
  primaryColor: string;
  colors: {
    card: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    backgroundTertiary: string;
    background: string;
    border: string;
  };
  language: Language;

  // Filter state setters
  setFilterType: (v: FilterType) => void;
  setFilterByStore: (v: string | null) => void;
  setSelectedPromotionFilter: (v: string | null) => void;
  setSelectedServiceFilter: (v: string | null) => void;
  setTopClientsSortBy: (v: 'revenue' | 'visits') => void;
  setVisitFrequency: (v: 'frequent' | 'occasional' | 'oneTime') => void;
  setMembershipStatus: (v: 'active' | 'past_due') => void;
  setSelectedMembershipPlan: (v: string | null) => void;
  setLoyaltySubFilter: (v: 'enrolled' | 'hasPoints' | 'redeemed' | 'topEarners') => void;
  setGiftCardSubFilter: (v: 'any' | 'value' | 'service') => void;
  setSelectedClientIds: (ids: string[]) => void;

  // Stable compute callback (stays in parent)
  computeFilteredIds: (opts: {
    filterType: FilterType;
    filterByStore: string | null;
    selectedPromotionFilter: string | null;
    selectedServiceFilter: string | null;
    topClientsSortBy: 'revenue' | 'visits';
    visitFrequency: 'frequent' | 'occasional' | 'oneTime';
    membershipStatus: 'active' | 'past_due';
    selectedMembershipPlan: string | null;
    loyaltySubFilter: 'enrolled' | 'hasPoints' | 'redeemed' | 'topEarners';
    giftCardSubFilter: 'any' | 'value' | 'service';
  }) => string[];
}

export function RecipientFilterCards({
  filterType,
  filterByStore,
  selectedPromotionFilter,
  selectedServiceFilter,
  topClientsSortBy,
  visitFrequency,
  membershipStatus,
  selectedMembershipPlan,
  loyaltySubFilter,
  giftCardSubFilter,
  supabaseServices,
  marketingPromotions,
  membershipPlans,
  stores,
  isDark,
  primaryColor,
  colors,
  language,
  setFilterType,
  setFilterByStore,
  setSelectedPromotionFilter,
  setSelectedServiceFilter,
  setTopClientsSortBy,
  setVisitFrequency,
  setMembershipStatus,
  setSelectedMembershipPlan,
  setLoyaltySubFilter,
  setGiftCardSubFilter,
  setSelectedClientIds,
  computeFilteredIds,
}: RecipientFilterCardsProps) {
  return (
    <View
      style={{
        padding: 12,
        backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Filter Cards — 2 columns */}
      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 10, letterSpacing: 0.8 }}>
        {t('quickFilters', language)}
      </Text>

      {/* Row 1: All Clients | New This Month */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {/* All Clients */}
        <Pressable
          onPress={() => { setFilterType('all'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'all', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: filterType === 'all' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'all' ? primaryColor : colors.border,
          }}
        >
          <Users size={14} color={filterType === 'all' ? '#fff' : colors.textSecondary} />
          <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'all' ? '#fff' : colors.text }} numberOfLines={1}>
            {t('allClientsFilter', language)}
          </Text>
        </Pressable>
        {/* New This Month */}
        <Pressable
          onPress={() => { setFilterType('newThisMonth'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'newThisMonth', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: filterType === 'newThisMonth' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'newThisMonth' ? primaryColor : colors.border,
          }}
        >
          <UserPlus size={14} color={filterType === 'newThisMonth' ? '#fff' : colors.textSecondary} />
          <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'newThisMonth' ? '#fff' : colors.text }} numberOfLines={1}>
            {t('newThisMonthFilter', language)}
          </Text>
        </Pressable>
      </View>

      {/* Row 2: Clients at Risk | Top Clients */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {/* Clients at Risk */}
        <Pressable
          onPress={() => { setFilterType('atRisk'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'atRisk', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: filterType === 'atRisk' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'atRisk' ? primaryColor : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <ShieldAlert size={14} color={filterType === 'atRisk' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'atRisk' ? '#fff' : colors.text }}>
              {t('atRiskFilter', language)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: filterType === 'atRisk' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
            {t('atRiskFilterDesc', language)}
          </Text>
        </Pressable>
        {/* Top Clients */}
        <Pressable
          onPress={() => { setFilterType('topClients'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'topClients', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: filterType === 'topClients' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'topClients' ? primaryColor : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Trophy size={14} color={filterType === 'topClients' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'topClients' ? '#fff' : colors.text }}>
              {t('topClientsFilter', language)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: filterType === 'topClients' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
            {t('topClientsFilterDesc', language)}
          </Text>
        </Pressable>
      </View>

      {/* Row 3: By Service | Promotion Users */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {/* By Service */}
        <Pressable
          onPress={() => { setFilterType('byService'); setSelectedPromotionFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'byService', filterByStore, selectedPromotionFilter: null, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: filterType === 'byService' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'byService' ? primaryColor : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Scissors size={14} color={filterType === 'byService' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'byService' ? '#fff' : colors.text }}>
              {t('byServiceFilter', language)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: filterType === 'byService' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
            {t('byServiceFilterDesc', language)}
          </Text>
        </Pressable>
        {/* Promotion Users */}
        <Pressable
          onPress={() => { setFilterType('promotionParticipants'); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'promotionParticipants', filterByStore, selectedPromotionFilter, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: filterType === 'promotionParticipants' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'promotionParticipants' ? primaryColor : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Gift size={14} color={filterType === 'promotionParticipants' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'promotionParticipants' ? '#fff' : colors.text }}>
              {t('promotionUsersFilter', language)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: filterType === 'promotionParticipants' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
            {t('filterByPromotion', language)}
          </Text>
        </Pressable>
      </View>

      {/* Row 4: Visit Frequency (full width) */}
      <Pressable
        onPress={() => { setFilterType('visitFrequency'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'visitFrequency', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderRadius: 10,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: filterType === 'visitFrequency' ? primaryColor : colors.card,
          borderWidth: 1,
          borderColor: filterType === 'visitFrequency' ? primaryColor : colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <BarChart2 size={14} color={filterType === 'visitFrequency' ? '#fff' : colors.textSecondary} />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: filterType === 'visitFrequency' ? '#fff' : colors.text }}>
              {t('visitFrequencyFilter', language)}
            </Text>
            <Text style={{ fontSize: 11, color: filterType === 'visitFrequency' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
              {t('visitFrequencyFilterDesc', language)}
            </Text>
          </View>
        </View>
        <ChevronRight size={14} color={filterType === 'visitFrequency' ? '#fff' : colors.textTertiary} />
      </Pressable>

      {/* Row 5: Membership | Loyalty */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {/* Membership */}
        <Pressable
          onPress={() => { setFilterType('membership'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'membership', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: filterType === 'membership' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'membership' ? primaryColor : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <CreditCard size={14} color={filterType === 'membership' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'membership' ? '#fff' : colors.text }}>
              {t('membershipFilter', language)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: filterType === 'membership' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
            {t('hasActiveMembership', language)}
          </Text>
        </Pressable>
        {/* Loyalty */}
        <Pressable
          onPress={() => { setFilterType('loyalty'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'loyalty', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
          style={{
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: filterType === 'loyalty' ? primaryColor : colors.card,
            borderWidth: 1,
            borderColor: filterType === 'loyalty' ? primaryColor : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Star size={14} color={filterType === 'loyalty' ? '#fff' : colors.textSecondary} />
            <Text style={{ fontSize: 13, fontWeight: '600', marginLeft: 6, color: filterType === 'loyalty' ? '#fff' : colors.text }}>
              {t('loyaltyFilter', language)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: filterType === 'loyalty' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
            {t('hasLoyaltyPoints', language)}
          </Text>
        </Pressable>
      </View>

      {/* Row 6: Gift Cards (full width) */}
      <Pressable
        onPress={() => { setFilterType('giftCard'); setSelectedPromotionFilter(null); setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType: 'giftCard', filterByStore, selectedPromotionFilter: null, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderRadius: 10,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: filterType === 'giftCard' ? primaryColor : colors.card,
          borderWidth: 1,
          borderColor: filterType === 'giftCard' ? primaryColor : colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Sparkles size={14} color={filterType === 'giftCard' ? '#fff' : colors.textSecondary} />
          <View style={{ marginLeft: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: filterType === 'giftCard' ? '#fff' : colors.text }}>
              {t('giftCardFilter', language)}
            </Text>
            <Text style={{ fontSize: 11, color: filterType === 'giftCard' ? 'rgba(255,255,255,0.8)' : colors.textTertiary }}>
              {t('hasActiveGiftCard', language)}
            </Text>
          </View>
        </View>
        <ChevronRight size={14} color={filterType === 'giftCard' ? '#fff' : colors.textTertiary} />
      </Pressable>

      {/* === Sub-options for Top Clients === */}
      {filterType === 'topClients' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            {t('topClientsBy', language).toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.background : '#F1F5F9', borderRadius: 10, padding: 3 }}>
            {(['revenue', 'visits'] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => { setTopClientsSortBy(key); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy: key, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: topClientsSortBy === key ? (isDark ? colors.card : '#fff') : 'transparent',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: topClientsSortBy === key ? '700' : '500', color: topClientsSortBy === key ? primaryColor : colors.textTertiary }}>
                  {key === 'revenue' ? t('topClientsByRevenue', language) : t('topClientsByVisits', language)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* === Sub-options for By Service === */}
      {filterType === 'byService' && supabaseServices.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            {t('filterByService', language).toUpperCase()}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Pressable
              onPress={() => { setSelectedServiceFilter(null); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter: null, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 9999,
                marginRight: 8,
                backgroundColor: !selectedServiceFilter ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                borderWidth: !selectedServiceFilter ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: !selectedServiceFilter ? '#fff' : colors.textSecondary }}>
                {t('allServicesOption', language)}
              </Text>
            </Pressable>
            {supabaseServices.map((svc) => (
              <Pressable
                key={svc.id}
                onPress={() => { setSelectedServiceFilter(svc.id); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter: svc.id, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 9999,
                  marginRight: 8,
                  backgroundColor: selectedServiceFilter === svc.id ? (svc.color || '#06B6D4') : `${svc.color || '#06B6D4'}18`,
                  borderWidth: selectedServiceFilter === svc.id ? 0 : 1,
                  borderColor: `${svc.color || '#06B6D4'}40`,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedServiceFilter === svc.id ? '#fff' : (svc.color || '#06B6D4') }}>
                  {svc.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* === Sub-options for Promotion Users === */}
      {filterType === 'promotionParticipants' && marketingPromotions.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            {t('filterByPromotion', language).toUpperCase()}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Pressable
              onPress={() => { setSelectedPromotionFilter(null); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter: null, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 9999,
                marginRight: 8,
                backgroundColor: !selectedPromotionFilter ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                borderWidth: !selectedPromotionFilter ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: !selectedPromotionFilter ? '#fff' : colors.textSecondary }}>
                {t('anyPromotion', language)}
              </Text>
            </Pressable>
            {marketingPromotions.map((promo) => (
              <Pressable
                key={promo.id}
                onPress={() => { setSelectedPromotionFilter(promo.id); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter: promo.id, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 9999,
                  marginRight: 8,
                  backgroundColor: selectedPromotionFilter === promo.id ? promo.color : `${promo.color}18`,
                  borderWidth: selectedPromotionFilter === promo.id ? 0 : 1,
                  borderColor: `${promo.color}40`,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedPromotionFilter === promo.id ? '#fff' : promo.color }}>
                  {promo.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* === Sub-options for Visit Frequency === */}
      {filterType === 'visitFrequency' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            {t('visitFrequencyFilter', language).toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.background : '#F1F5F9', borderRadius: 10, padding: 3 }}>
            {([
              { key: 'frequent', label: t('frequentClients', language) },
              { key: 'occasional', label: t('occasionalClients', language) },
              { key: 'oneTime', label: t('oneTimeClients', language) },
            ] as const).map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => { setVisitFrequency(key); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency: key, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: visitFrequency === key ? (isDark ? colors.card : '#fff') : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: visitFrequency === key ? '700' : '500', color: visitFrequency === key ? primaryColor : colors.textTertiary }} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* === Sub-options for Membership === */}
      {filterType === 'membership' && (
        <View style={{ marginBottom: 12 }}>
          {/* Status toggle: Active / Past Due */}
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            STATUS
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.background : '#F1F5F9', borderRadius: 10, padding: 3, marginBottom: 10 }}>
            {([
              { key: 'active' as const, label: t('hasActiveMembership', language) },
              { key: 'past_due' as const, label: t('membershipPastDue', language) },
            ]).map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => { setMembershipStatus(key); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus: key, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: membershipStatus === key ? (isDark ? colors.card : '#fff') : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: membershipStatus === key ? '700' : '500', color: membershipStatus === key ? primaryColor : colors.textTertiary }} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {/* Plan filter (optional) */}
          {membershipPlans.length > 0 && (
            <>
              <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
                {t('membershipPlanFilter', language).toUpperCase()}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <Pressable
                  onPress={() => { setSelectedMembershipPlan(null); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan: null, loyaltySubFilter, giftCardSubFilter })); }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 9999,
                    marginRight: 8,
                    backgroundColor: !selectedMembershipPlan ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                    borderWidth: !selectedMembershipPlan ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: !selectedMembershipPlan ? '#fff' : colors.textSecondary }}>
                    {t('membershipAnyPlan', language)}
                  </Text>
                </Pressable>
                {membershipPlans.map((plan) => (
                  <Pressable
                    key={plan.id}
                    onPress={() => { setSelectedMembershipPlan(plan.id); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan: plan.id, loyaltySubFilter, giftCardSubFilter })); }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 9999,
                      marginRight: 8,
                      backgroundColor: selectedMembershipPlan === plan.id ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                      borderWidth: selectedMembershipPlan === plan.id ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: selectedMembershipPlan === plan.id ? '#fff' : colors.textSecondary }}>
                      {plan.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* === Sub-options for Loyalty === */}
      {filterType === 'loyalty' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            {t('loyaltyFilter', language).toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {([
              { key: 'enrolled' as const, label: t('activeLoyaltyMembers', language) },
              { key: 'hasPoints' as const, label: t('hasLoyaltyPoints', language) },
              { key: 'redeemed' as const, label: t('rewardsRedeemed', language) },
              { key: 'topEarners' as const, label: t('highLoyaltyPoints', language) },
            ]).map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => { setLoyaltySubFilter(key); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter: key, giftCardSubFilter })); }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 9999,
                  backgroundColor: loyaltySubFilter === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                  borderWidth: loyaltySubFilter === key ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: loyaltySubFilter === key ? '#fff' : colors.textSecondary }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* === Sub-options for Gift Cards === */}
      {filterType === 'giftCard' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            {t('giftCardFilter', language).toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.background : '#F1F5F9', borderRadius: 10, padding: 3 }}>
            {([
              { key: 'any' as const, label: t('giftCardAnyType', language) },
              { key: 'value' as const, label: t('giftCardValueBased', language) },
              { key: 'service' as const, label: t('giftCardServiceBased', language) },
            ]).map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => { setGiftCardSubFilter(key); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter: key })); }}
                style={{
                  flex: 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: giftCardSubFilter === key ? (isDark ? colors.card : '#fff') : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: giftCardSubFilter === key ? '700' : '500', color: giftCardSubFilter === key ? primaryColor : colors.textTertiary }} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Filter by Store */}
      {stores.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 0.6 }}>
            {t('filterByStore', language).toUpperCase()}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Pressable
              onPress={() => { setFilterByStore(null); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore: null, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                marginRight: 8,
                backgroundColor: !filterByStore ? primaryColor : (isDark ? colors.backgroundTertiary : colors.card),
                borderWidth: !filterByStore ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: !filterByStore ? '#fff' : colors.textSecondary }}>
                {t('allStores', language)}
              </Text>
            </Pressable>
            {stores.map((store) => (
              <Pressable
                key={store.id}
                onPress={() => { setFilterByStore(store.id); setSelectedClientIds(computeFilteredIds({ filterType, filterByStore: store.id, selectedPromotionFilter, selectedServiceFilter, topClientsSortBy, visitFrequency, membershipStatus, selectedMembershipPlan, loyaltySubFilter, giftCardSubFilter })); }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  marginRight: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: filterByStore === store.id ? primaryColor : (isDark ? colors.backgroundTertiary : colors.card),
                  borderWidth: filterByStore === store.id ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <StoreIcon size={14} color={filterByStore === store.id ? '#fff' : colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: filterByStore === store.id ? '#fff' : colors.textSecondary }}>
                  {getLocalizedStoreName(store.name, language)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Email Consent (locked/informational) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: isDark ? '#064E3B40' : '#D1FAE5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, borderWidth: 1, borderColor: isDark ? '#065F4640' : '#A7F3D0' }}>
        <Lock size={13} color={isDark ? '#6EE7B7' : '#065F46'} style={{ marginRight: 6 }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#6EE7B7' : '#065F46' }}>
          {t('emailConsentLocked', language)}
        </Text>
      </View>
    </View>
  );
}
