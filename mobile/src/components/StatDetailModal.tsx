import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Users, UserPlus, Gift, TrendingUp, Calendar, Store as StoreIcon, Mail, Phone, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t, getDateFnsLocale, getCachedDateFnsLocale, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { format, isThisMonth, subMonths, Locale } from 'date-fns';
import { useClients } from '@/hooks/useClients';
import { useStores } from '@/hooks/useStores';
import type { SupabaseClient } from '@/services/clientsService';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { getClientInitials } from './ClientSearchItem';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

export type StatType = 'total' | 'newThisMonth' | 'promotions' | 'active';

interface StatDetailModalProps {
  visible: boolean;
  statType: StatType | null;
  onClose: () => void;
  onSelectClient: (id: string) => void;
}

interface ClientRowProps {
  client: SupabaseClient;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  primaryColor: string;
  dateLocale?: Locale;
  language: Language;
}

function ClientRow({ client, onPress, colors, isDark, primaryColor, dateLocale, language }: ClientRowProps) {
  // Match ClientItem from ClientListScreen exactly
  return (
    <Animated.View layout={Layout.springify()}>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        <View className="flex-row items-start">
          {/* Avatar - same as ClientItem: w-14 h-14 (56px) */}
          <View
            className="w-14 h-14 rounded-full items-center justify-center"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 20 }}>
              {getClientInitials(client.name)}
            </Text>
          </View>

          {/* Info - same structure as ClientItem */}
          <View className="flex-1 ml-3">
            <View className="flex-row items-center">
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, flex: 1 }}>
                {client.name}
              </Text>
            </View>

            {client.email && (
              <View className="flex-row items-center mt-1">
                <Mail size={12} color={colors.textTertiary} />
                <Text
                  style={{ color: colors.textTertiary, fontSize: 14, marginLeft: 6, flex: 1 }}
                  numberOfLines={1}
                >
                  {client.email}
                </Text>
              </View>
            )}

            {client.phone && (
              <View className="flex-row items-center mt-0.5">
                <Phone size={12} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, fontSize: 14, marginLeft: 6 }}>
                  {formatPhoneDisplay(client.phone)}
                </Text>
              </View>
            )}
          </View>

          {/* Right side - same structure as ClientItem */}
          <View className="items-end ml-2">
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              {capitalizeDate(format(new Date(client.created_at), 'MMM d', { locale: dateLocale }))}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '500' }}>
                {client.visits_count}{' '}
                {client.visits_count === 1 ? t('visit', language) : t('visits', language)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} className="mt-2" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function StatDetailModal({ visible, statType, onClose, onSelectClient }: StatDetailModalProps) {
  // Supabase data
  const { data: supabaseClients = [] } = useClients();
  const { data: supabaseStores = [] } = useStores();

  // Zustand store - for non-Supabase data only
  const language = useStore((s) => s.language) as Language;
  const { colors, isDark, primaryColor } = useTheme();

  // Store filter state (only for total and newThisMonth)
  const [storeFilter, setStoreFilter] = useState<string | null>(null);

  // Reset store filter when modal closes or stat type changes
  useEffect(() => {
    if (!visible) {
      setStoreFilter(null);
    }
  }, [visible, statType]);

  // Load date-fns locale for the selected language
  const [dateLocale, setDateLocale] = useState<Locale | undefined>(undefined);
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  // Use Supabase clients directly
  const clients = useMemo(() => supabaseClients, [supabaseClients]);

  // Get stores from Supabase
  const stores = useMemo(() => {
    return supabaseStores.map((s) => ({
      id: s.id,
      name: s.name,
    }));
  }, [supabaseStores]);

  const { title, subtitle, icon, color, filteredClients } = useMemo(() => {
    // SupabaseClient doesn't have isArchived, so all clients are active
    const activeClients = clients;

    switch (statType) {
      case 'total':
        // Store filter not supported for Supabase clients yet (would need home_store_id)
        const totalFiltered = activeClients;
        return {
          title: t('totalClients', language),
          subtitle: (t('clientsInDatabase', language) || '{count} clients in your database').replace('{count}', String(totalFiltered.length)),
          icon: <Users size={24} color={primaryColor} />,
          color: primaryColor,
          filteredClients: totalFiltered.sort((a, b) => a.name.localeCompare(b.name)),
        };

      case 'newThisMonth':
        const newClients = activeClients.filter((c) => isThisMonth(new Date(c.created_at)));
        return {
          title: t('newThisMonth', language),
          subtitle: (t('newClientsThisMonth', language) || '{count} new clients added this month').replace('{count}', String(newClients.length)),
          icon: <UserPlus size={24} color={primaryColor} />,
          color: primaryColor,
          filteredClients: newClients.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
        };

      case 'promotions':
        // SupabaseClient doesn't have promotionCount - show clients with visits instead
        const activeVisitClients = activeClients
          .filter((c) => c.visits_count > 0)
          .sort((a, b) => b.visits_count - a.visits_count);
        const totalVisits = activeClients.reduce((sum, c) => sum + c.visits_count, 0);
        return {
          title: t('promotionsUsed', language),
          subtitle: `${totalVisits} visits by ${activeVisitClients.length} clients`,
          icon: <Gift size={24} color="#8B5CF6" />,
          color: '#8B5CF6',
          filteredClients: activeVisitClients,
        };

      case 'active':
        // Show clients with visits
        const recentlyActive = activeClients
          .filter((c) => c.visits_count > 0)
          .sort((a, b) => b.visits_count - a.visits_count);
        return {
          title: t('activeClients', language),
          subtitle: `${recentlyActive.length} clients with visit history`,
          icon: <TrendingUp size={24} color="#10B981" />,
          color: '#10B981',
          filteredClients: recentlyActive,
        };

      default:
        return {
          title: '',
          subtitle: '',
          icon: null,
          color: primaryColor,
          filteredClients: [] as SupabaseClient[],
        };
    }
  }, [statType, clients, language, primaryColor]);

  // Render store filter (only for total and newThisMonth)
  const renderStoreFilter = () => {
    if (stores.length === 0 || (statType !== 'total' && statType !== 'newThisMonth')) return null;

    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
          {t('filterByStore', language)}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            onPress={() => setStoreFilter(null)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              marginRight: 8,
              backgroundColor: !storeFilter ? primaryColor : (isDark ? colors.backgroundTertiary : colors.card),
              borderWidth: !storeFilter ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: !storeFilter ? '#fff' : colors.textSecondary }}>
              {t('allStores', language)}
            </Text>
          </Pressable>
          {stores.map((store) => (
            <Pressable
              key={store.id}
              onPress={() => setStoreFilter(store.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 8,
                backgroundColor: storeFilter === store.id ? primaryColor : (isDark ? colors.backgroundTertiary : colors.card),
                borderWidth: storeFilter === store.id ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <StoreIcon size={14} color={storeFilter === store.id ? '#fff' : colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 14, fontWeight: '500', color: storeFilter === store.id ? '#fff' : colors.textSecondary }}>
                {getLocalizedStoreName(store.name, language)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (!statType) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
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
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: `${color}15` }}
            >
              {icon}
            </View>
            <View className="flex-1">
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{subtitle}</Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
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

        {/* Store Filter */}
        {renderStoreFilter()}

        {/* Client List */}
        {filteredClients.length > 0 ? (
          <FlatList
            data={filteredClients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ClientRow
                client={item}
                onPress={() => {
                  onClose();
                  onSelectClient(item.id);
                }}
                colors={colors}
                isDark={isDark}
                primaryColor={primaryColor}
                dateLocale={dateLocale}
                language={language}
              />
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: `${color}15` }}
            >
              {icon}
            </View>
            <Text style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 16 }}>
              {t('noResults', language)}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
