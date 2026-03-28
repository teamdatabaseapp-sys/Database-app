import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  Plus,
  ChevronRight,
  Phone,
  Mail,
  ArrowDownAZ,
  Clock,
  Users,
} from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { getClientInitials } from './ClientSearchItem';
import { useClients } from '@/hooks/useClients';
import { useBusiness } from '@/hooks/useBusiness';
import type { SupabaseClient } from '@/services/clientsService';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

type SortOption = 'recent' | 'alphabetical';

interface ClientListScreenProps {
  onAddClient: () => void;
  onSelectClient: (id: string) => void;
  hideHeader?: boolean;
}

interface ClientItemProps {
  client: SupabaseClient;
  onPress: () => void;
}

const ClientItem = React.memo(function ClientItem({ client, onPress }: ClientItemProps) {
  const language = useStore((s) => s.language) as Language;
  const { colors, primaryColor } = useTheme();

  // Load date-fns locale for current language
  const [dateLocale, setDateLocale] = useState<Locale | undefined>(undefined);
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

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
          {/* Avatar */}
          <View
            className="w-14 h-14 rounded-full items-center justify-center"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 20 }}>
              {getClientInitials(client.name)}
            </Text>
          </View>

          {/* Info */}
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

          {/* Right side */}
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
});

// Skeleton placeholder for first-ever load
function ClientSkeleton({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.border,
          opacity: 0.4,
        }}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ height: 14, width: '55%', borderRadius: 7, backgroundColor: colors.border, opacity: 0.4, marginBottom: 8 }} />
        <View style={{ height: 11, width: '75%', borderRadius: 6, backgroundColor: colors.border, opacity: 0.25 }} />
      </View>
    </View>
  );
}

export function ClientListScreen({
  onAddClient,
  onSelectClient,
  hideHeader,
}: ClientListScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');

  // useDeferredValue defers the expensive filter recomputation until the UI is idle,
  // keeping the TextInput responsive even with large client lists.
  const deferredQuery = useDeferredValue(searchQuery);

  const language = useStore((s) => s.language) as Language;
  const { colors, isDark, primaryColor } = useTheme();

  // Use Supabase clients via React Query
  const { businessId, isInitialized: businessInitialized } = useBusiness();
  const { data: supabaseClients, isLoading, refetch, isRefetching } = useClients();

  // useDeferredValue handles search responsiveness — setSearchQuery updates TextInput immediately
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'recent' ? 'alphabetical' : 'recent'));
  };

  const filteredClients = useMemo(() => {
    const allClients = supabaseClients ?? [];

    if (allClients.length === 0) return [];

    let filtered = allClients;
    const trimmedQuery = deferredQuery.trim().toLowerCase();

    if (trimmedQuery.length > 0) {
      filtered = allClients.filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(trimmedQuery) ?? false;
        const emailMatch = c.email?.toLowerCase().includes(trimmedQuery) ?? false;
        const phoneDigits = c.phone?.replace(/\D/g, '') ?? '';
        const queryDigits = trimmedQuery.replace(/\D/g, '');
        const phoneMatch = queryDigits.length > 0 && phoneDigits.includes(queryDigits);
        return nameMatch || emailMatch || phoneMatch;
      });
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return (a.name ?? '').localeCompare(b.name ?? '');
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [supabaseClients, deferredQuery, sortBy]);

  const onRefresh = useCallback(async () => {
    console.log('[ClientListScreen] Manual refresh triggered');
    await refetch();
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: SupabaseClient }) => (
      <ClientItem client={item} onPress={() => onSelectClient(item.id)} />
    ),
    [onSelectClient]
  );

  const keyExtractor = useCallback((item: SupabaseClient) => item.id, []);

  // Block only on business context init — never on data loading
  if (!businessInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        {[...Array(6)].map((_, i) => <ClientSkeleton key={i} colors={colors} />)}
      </View>
    );
  }

  // First-ever load (no cached data): show skeleton rows
  const isFirstLoad = isLoading && !supabaseClients;

  // Show message if no business exists
  if (!businessId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Users size={32} color={colors.textTertiary} />
        </View>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
          No Business Found
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
          Please log out and sign in again to set up your business.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <SafeAreaView
        edges={hideHeader ? [] : ['top']}
        style={{ backgroundColor: colors.headerBackground }}
      >
        <Animated.View entering={FadeInDown.duration(400)} className="px-4 pt-4 pb-3">
          {!hideHeader && (
            <View className="flex-row items-center justify-between mb-4">
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
                  <Users size={22} color={primaryColor} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                  {t('clients', language)}
                </Text>
              </View>
              <Pressable
                onPress={onAddClient}
                className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={22} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* Search Bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.inputBackground,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: colors.inputBorder,
            }}
          >
            <Search size={20} color={colors.textTertiary} />
            <TextInput
              style={{ flex: 1, marginLeft: 12, color: colors.inputText, fontSize: 16 }}
              placeholder={t('searchClients', language)}
              placeholderTextColor={colors.inputPlaceholder}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
            />
          </View>

          {/* Filter Toggle */}
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 8 }}>
              {filteredClients.length}{' '}
              {filteredClients.length === 1 ? t('client', language) : t('clientsCount', language)}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              {/* Sort Button */}
              <Pressable
                onPress={toggleSort}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                }}
              >
                {sortBy === 'alphabetical' ? (
                  <ArrowDownAZ size={14} color={primaryColor} />
                ) : (
                  <Clock size={14} color={primaryColor} />
                )}
                <Text
                  style={{ marginLeft: 6, fontSize: 14, fontWeight: '500', color: primaryColor }}
                  numberOfLines={1}
                >
                  {sortBy === 'alphabetical' ? t('alphabetical', language) : t('recent', language)}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </Animated.View>
      </SafeAreaView>

      {/* Client List */}
      <Animated.View entering={FadeInDown.delay(50).duration(350)} style={{ flex: 1 }}>
        {isFirstLoad ? (
          // First-ever load: skeleton placeholders instead of spinner
          <View style={{ padding: 16 }}>
            {[...Array(6)].map((_, i) => <ClientSkeleton key={i} colors={colors} />)}
          </View>
        ) : (
        <FlatList
          data={filteredClients}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 24,
            flexGrow: filteredClients.length === 0 ? 1 : undefined,
          }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={primaryColor}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              {searchQuery.trim() ? (
                // Search returned no results
                <>
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      borderRadius: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <Search size={32} color={colors.textTertiary} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
                    {t('noResults', language)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
                    {t('tryDifferentSearch', language)}
                  </Text>
                  <Pressable
                    onPress={() => { setSearchQuery(''); }}
                    style={{
                      marginTop: 20,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: `${primaryColor}15`,
                    }}
                  >
                    <Text style={{ color: primaryColor, fontWeight: '600' }}>
                      {t('clearSearch', language)}
                    </Text>
                  </Pressable>
                </>
              ) : (
                // No clients at all
                <>
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                      borderRadius: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 20,
                    }}
                  >
                    <Users size={32} color={primaryColor} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
                    {t('noClientsYet', language)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32, marginBottom: 20 }}>
                    {t('addFirstClient', language)}
                  </Text>
                  <Pressable
                    onPress={onAddClient}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: primaryColor,
                    }}
                  >
                    <Plus size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
                      {t('addClient', language)}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          }
        />
        )}
      </Animated.View>
    </View>
  );
}
