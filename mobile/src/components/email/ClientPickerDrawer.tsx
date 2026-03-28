import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  AlertTriangle,
  Filter,
  Search,
  Check,
  Mail,
  Phone,
  MailX,
  X,
} from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { getClientInitials } from '@/components/ClientSearchItem';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { RecipientFilterCards } from './RecipientFilterCards';

type FilterType = 'all' | 'newThisMonth' | 'promotionParticipants' | 'atRisk' | 'topClients' | 'byService' | 'visitFrequency' | 'membership' | 'loyalty' | 'giftCard';

interface ClientItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

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

interface ClientPickerDrawerProps {
  // Client list
  activeClients: ClientItem[];
  clientsLoading: boolean;
  selectedClientIds: string[];
  recipientSearch: string;

  // Filter state (read)
  showFilterOptions: boolean;
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

  // Data for filter cards
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

  // Callbacks
  setShowFilterOptions: (v: boolean) => void;
  setRecipientSearch: (v: string) => void;
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
  toggleClient: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  isClientOptedOut: (email: string) => boolean;
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

export function ClientPickerDrawer({
  activeClients,
  clientsLoading,
  selectedClientIds,
  recipientSearch,
  showFilterOptions,
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
  setShowFilterOptions,
  setRecipientSearch,
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
  toggleClient,
  selectAll,
  deselectAll,
  isClientOptedOut,
  computeFilteredIds,
}: ClientPickerDrawerProps) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        marginTop: 8,
        overflow: 'hidden',
      }}
    >
      {/* Selected Count Header */}
      <View
        style={{
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
          {t('selectedCount', language).replace('{count}', selectedClientIds.length.toString())}
        </Text>
        {selectedClientIds.length > 5000 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FEF3C7',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 9999,
              marginTop: 8,
              alignSelf: 'flex-start',
            }}
          >
            <AlertTriangle size={14} color="#92400E" style={{ marginRight: 6 }} />
            <Text style={{ color: '#92400E', fontSize: 13, fontWeight: '500' }}>
              {t('largeSendWarning', language).replace('{count}', selectedClientIds.length.toString())}
            </Text>
          </View>
        )}
      </View>

      {/* Filter Options Toggle */}
      <Pressable
        onPress={() => setShowFilterOptions(!showFilterOptions)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Filter size={16} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 8, flex: 1 }}>
          {t('filterRecipients', language)}
        </Text>
        <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>
          {filterType === 'all'
            ? t('allClientsFilter', language)
            : filterType === 'newThisMonth'
            ? t('newThisMonthFilter', language)
            : filterType === 'atRisk'
            ? t('atRiskFilter', language)
            : filterType === 'topClients'
            ? t('topClientsFilter', language)
            : filterType === 'byService'
            ? t('byServiceFilter', language)
            : filterType === 'visitFrequency'
            ? t('visitFrequencyFilter', language)
            : filterType === 'membership'
            ? t('membershipFilter', language)
            : filterType === 'loyalty'
            ? t('loyaltyFilter', language)
            : filterType === 'giftCard'
            ? t('giftCardFilter', language)
            : t('promotionUsersFilter', language)}
        </Text>
      </Pressable>

      {/* Filter Options Expanded */}
      {showFilterOptions && (
        <RecipientFilterCards
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
          computeFilteredIds={computeFilteredIds}
        />
      )}

      {/* Recipient Search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: isDark ? colors.backgroundTertiary : '#FAFAFA',
        }}
      >
        <Search size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
        <TextInput
          value={recipientSearch}
          onChangeText={setRecipientSearch}
          placeholder={t('searchRecipientsPlaceholder', language)}
          placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, fontSize: 14, color: colors.text, height: 32 }}
          returnKeyType="search"
          clearButtonMode="never"
          cursorColor={primaryColor}
        />
        {recipientSearch.length > 0 && (
          <Pressable onPress={() => setRecipientSearch('')} style={{ padding: 4 }}>
            <X size={14} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Select All / Deselect All */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={selectAll} style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: primaryColor, fontWeight: '500', fontSize: 14 }}>
            {t('selectAllBtn', language)}
          </Text>
        </Pressable>
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Pressable onPress={deselectAll} style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 14 }}>
            {t('deselectAllBtn', language)}
          </Text>
        </Pressable>
      </View>

      {/* Client List — nestedScrollEnabled preserves scroll behavior inside the parent ScrollView */}
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
        {clientsLoading ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={primaryColor} />
            <Text style={{ color: colors.textTertiary, marginTop: 12 }}>{t('loading', language)}</Text>
          </View>
        ) : activeClients.length === 0 ? (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary }}>{t('noClientsFoundFilter', language)}</Text>
          </View>
        ) : (
          activeClients.map((client) => {
            const clientOptedOut = isClientOptedOut(client.email);
            return (
              <Pressable
                key={client.id}
                onPress={() => toggleClient(client.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: clientOptedOut ? (isDark ? '#7F1D1D20' : '#FEF2F2') : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 1,
                    marginRight: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selectedClientIds.includes(client.id)
                      ? clientOptedOut ? '#F87171' : primaryColor
                      : 'transparent',
                    borderColor: selectedClientIds.includes(client.id)
                      ? clientOptedOut ? '#F87171' : primaryColor
                      : colors.border,
                  }}
                >
                  {selectedClientIds.includes(client.id) && <Check size={14} color="#fff" />}
                </View>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: clientOptedOut ? '#EF444420' : `${primaryColor}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <Text style={{ color: clientOptedOut ? '#EF4444' : primaryColor, fontWeight: 'bold', fontSize: 14 }}>
                    {getClientInitials(client.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '600', color: clientOptedOut ? '#DC2626' : colors.text }}>
                      {client.name}
                    </Text>
                    {clientOptedOut && (
                      <View style={{ backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '500' }}>
                          {t('optedOut', language)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Mail size={12} color={clientOptedOut ? '#F87171' : colors.textTertiary} />
                    <Text style={{ fontSize: 13, color: clientOptedOut ? '#F87171' : colors.textTertiary, marginLeft: 4 }} numberOfLines={1}>
                      {client.email}
                    </Text>
                  </View>
                  {client.phone && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                      <Phone size={12} color={clientOptedOut ? '#F87171' : colors.textTertiary} />
                      <Text style={{ fontSize: 13, color: clientOptedOut ? '#F87171' : colors.textTertiary, marginLeft: 4 }}>
                        {formatPhoneDisplay(client.phone)}
                      </Text>
                    </View>
                  )}
                </View>
                {clientOptedOut && <MailX size={16} color="#EF4444" />}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
