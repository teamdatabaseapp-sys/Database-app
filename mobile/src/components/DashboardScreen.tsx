import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  UserPlus,
  CalendarPlus,
  CalendarDays,
  Send,
  Tag,
  Mail,
  Gift,
  Crown,
  Star,
  Search,
  X,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { format } from 'date-fns';
import { StatDetailModal, StatType } from './StatDetailModal';
import { AddVisitModal } from './AddVisitModal';
import { BulkEmailModal } from './BulkEmailModal';
import { MarketingPromoScreen } from './MarketingPromoScreen';
import { DripCampaignScreen } from './DripCampaignScreen';
import { BookAppointmentModal } from './BookAppointmentModal';
import { AppointmentsScreen } from './AppointmentsScreen';
import { ClientEditScreen } from './ClientEditScreen';
import { GiftCardScreen } from './GiftCardScreen';
import { MembershipProgramScreen } from './MembershipProgramScreen';
import { LoyaltyProgramScreen } from './LoyaltyProgramScreen';
import { useTheme } from '@/lib/ThemeContext';
import { useBusiness } from '@/hooks/useBusiness';
import { usePrefetchAnalytics } from '@/hooks/useAnalytics';
import { clientKeys, useClients } from '@/hooks/useClients';
import { useGiftCards } from '@/hooks/useGiftCards';
import { getClients } from '@/services/clientsService';

type SmartDripPrefill = {
  name?: string;
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  emailSubject?: string;
  emailBody?: string;
  contextLabel?: string;
};

type MarketingPrefill = {
  discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
  name?: string;
  contextLabel?: string;
};

interface DashboardScreenProps {
  onNavigateToClients: () => void;
  onNavigateToClient: (id: string) => void;
  onAddClient: () => void;
  onFeatureBlocked?: () => void;
  canAccessApp?: boolean;
}

export function DashboardScreen({ onNavigateToClients, onNavigateToClient, onAddClient, onFeatureBlocked, canAccessApp = true }: DashboardScreenProps) {
  const { businessId, isInitialized } = useBusiness();

  // Prefetch analytics in the background so the Analytics tab feels instant
  usePrefetchAnalytics();

  // Prefetch client list so the Clients tab opens instantly
  const queryClient = useQueryClient();
  const prefetchedClientsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isInitialized || !businessId) return;
    if (prefetchedClientsRef.current === businessId) return;
    const key = clientKeys.list(businessId);
    if (queryClient.getQueryData(key)) {
      prefetchedClientsRef.current = businessId;
      return;
    }
    prefetchedClientsRef.current = businessId;
    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const result = await getClients(businessId);
        return result.data || [];
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [isInitialized, businessId, queryClient]);

  // Zustand store
  const user = useStore((s) => s.user);
  const language = useStore((s) => s.language) as Language;
  const themeSettings = useStore((s) => s.themeSettings);
  const calendarEnabled = useStore((s) => s.featureToggles.calendarEnabled);

  // Real client data from Supabase via React Query (same source as Clients tab)
  const { data: supabaseClients = [] } = useClients();
  // Gift cards for code search in Quick Actions search bar
  const { data: allGiftCards = [] } = useGiftCards();
  const [selectedStat, setSelectedStat] = useState<StatType | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [addVisitVisible, setAddVisitVisible] = useState(false);
  const [bookAppointmentVisible, setBookAppointmentVisible] = useState(false);
  const [appointmentsVisible, setAppointmentsVisible] = useState(false);
  const [bulkEmailVisible, setBulkEmailVisible] = useState(false);
  const [marketingPromoVisible, setMarketingPromoVisible] = useState(false);
  const [dripCampaignVisible, setDripCampaignVisible] = useState(false);
  const [addClientVisible, setAddClientVisible] = useState(false);
  const [giftCardVisible, setGiftCardVisible] = useState(false);
  const [membershipProgramVisible, setMembershipProgramVisible] = useState(false);
  const [loyaltyProgramVisible, setLoyaltyProgramVisible] = useState(false);
  const [smartDripPrefill, setSmartDripPrefill] = useState<SmartDripPrefill | undefined>(undefined);
  const [marketingPrefill, setMarketingPrefill] = useState<MarketingPrefill | undefined>(undefined);
  const [dashboardSearch, setDashboardSearch] = useState('');

  const dashboardSearchResults = useMemo(() => {
    const q = dashboardSearch.trim().toLowerCase();
    if (!q) return { clients: [], giftCards: [] };
    const qDigits = q.replace(/\D/g, '');
    // Normalize code: strip hyphens and spaces for flexible matching
    const qNorm = q.replace(/[-\s]/g, '');

    const clients = supabaseClients.filter((c) => {
      const nameLower = (c.name ?? '').toLowerCase();
      if (nameLower.includes(q)) return true;
      if (c.email?.toLowerCase().includes(q)) return true;
      if (qDigits.length > 0 && (c.phone ?? '').replace(/\D/g, '').includes(qDigits)) return true;
      return false;
    }).slice(0, 5);

    const giftCards = allGiftCards.filter((gc) => {
      const codeNorm = gc.code.toLowerCase().replace(/[-\s]/g, '');
      if (codeNorm.includes(qNorm)) return true;
      if (gc.code.toLowerCase().includes(q)) return true;
      return false;
    }).slice(0, 3);

    return { clients, giftCards };
  }, [dashboardSearch, supabaseClients, allGiftCards]);

  // Lazy mount: only mount a modal's subtree after it has been opened at least once.
  // This eliminates the cost of mounting 11 heavy screens on Dashboard first render.

  const everOpened = useRef({
    modal: false,
    addVisit: false,
    bookAppointment: false,
    appointments: false,
    bulkEmail: false,
    marketingPromo: false,
    dripCampaign: false,
    addClient: false,
    giftCard: false,
    membershipProgram: false,
    loyaltyProgram: false,
  });
  if (modalVisible)            everOpened.current.modal = true;
  if (addVisitVisible)         everOpened.current.addVisit = true;
  if (bookAppointmentVisible)  everOpened.current.bookAppointment = true;
  if (appointmentsVisible)     everOpened.current.appointments = true;
  if (bulkEmailVisible)        everOpened.current.bulkEmail = true;
  if (marketingPromoVisible)   everOpened.current.marketingPromo = true;
  if (dripCampaignVisible)     everOpened.current.dripCampaign = true;
  if (addClientVisible)        everOpened.current.addClient = true;
  if (giftCardVisible)         everOpened.current.giftCard = true;
  if (membershipProgramVisible) everOpened.current.membershipProgram = true;
  if (loyaltyProgramVisible)   everOpened.current.loyaltyProgram = true;

  const handleOpenSmartDrip = (prefill?: SmartDripPrefill) => {
    setSmartDripPrefill(prefill);
    setDripCampaignVisible(true);
  };

  const handleOpenMarketing = (prefill?: MarketingPrefill) => {
    setMarketingPrefill(prefill);
    setMarketingPromoVisible(true);
  };

  // Map app language codes to BCP 47 locale tags for Intl.DateTimeFormat
  const languageToLocale: Record<string, string> = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', de: 'de-DE',
    ht: 'fr-HT', ru: 'ru-RU', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN',
    tr: 'tr-TR', sv: 'sv-SE', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI',
    is: 'is-IS', nl: 'nl-NL', it: 'it-IT',
  };

  // Format date synchronously using Intl — always matches selected language, no async needed
  const formattedDate = useMemo(() => {
    const localeTag = languageToLocale[language] ?? 'en-US';
    try {
      const now = new Date();
      const weekday = new Intl.DateTimeFormat(localeTag, { weekday: 'long' }).format(now);
      const rest = new Intl.DateTimeFormat(localeTag, { year: 'numeric', month: 'long', day: 'numeric' }).format(now);
      const result = `${weekday}, ${rest}`;
      return result.replace(/(^|\s)(\S)/g, (m) => m.toUpperCase());
    } catch (e) {
      console.warn('[DashboardScreen] Intl date formatting failed, using fallback:', e);
      try {
        const now = new Date();
        return new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
      } catch {
        return format(new Date(), 'EEEE, MMMM d, yyyy');
      }
    }
  }, [language]);

  const { colors, primaryColor } = useTheme();
  const insets = useSafeAreaInsets();

  const closeStatDetail = () => {
    setModalVisible(false);
    setSelectedStat(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeSettings.buttonColor }}>
      {/* ── HEADER ── */}
      <LinearGradient
        colors={[
          `rgba(${hexToRgbStr(themeSettings.buttonColor)}, 0.92)`,
          themeSettings.buttonColor,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 16, paddingBottom: 88, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CalendarDays size={14} color="rgba(255,255,255,0.82)" />
          <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: '500', letterSpacing: 0.2 }}>
            {formattedDate}
          </Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
          {t('welcome', language)} {user?.businessName || 'Your Business'}
        </Text>
      </LinearGradient>

      {/* ── BODY ── rounded card floats over gradient, stable and clean */}
      <View style={{ flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', marginTop: -56 }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 10, paddingBottom: 20 }}
      >

        {/* PROGRAMS ROW — 3 cards, formerly KPI area */}
        <Animated.View style={{ flexDirection: 'row', gap: 10, marginBottom: 18, marginTop: 0 }}>
          {/* Gift Cards */}
          <Pressable
            onPress={() => setGiftCardVisible(true)}
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 16,
              alignItems: 'center',
              paddingVertical: 18,
              paddingHorizontal: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Gift size={20} color={primaryColor} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center', lineHeight: 16, alignSelf: 'stretch' }}>
              {t('giftCards', language)}
            </Text>
          </Pressable>

          {/* Membership Program */}
          <Pressable
            onPress={() => setMembershipProgramVisible(true)}
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 16,
              alignItems: 'center',
              paddingVertical: 18,
              paddingHorizontal: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Crown size={20} color={primaryColor} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center', lineHeight: 16, alignSelf: 'stretch' }}>
              {t('membershipProgram', language)}
            </Text>
          </Pressable>

          {/* Loyalty Program */}
          <Pressable
            onPress={() => setLoyaltyProgramVisible(true)}
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 16,
              alignItems: 'center',
              paddingVertical: 18,
              paddingHorizontal: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Star size={20} color={primaryColor} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center', lineHeight: 16, alignSelf: 'stretch' }}>
              {t('loyaltyProgramTitle', language)}
            </Text>
          </Pressable>
        </Animated.View>

        {/* QUICK ACTIONS LABEL */}
        <Animated.View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 10 }}>
            {t('quickActions', language)}
          </Text>
        </Animated.View>

        {/* SEARCH BAR */}
        <Animated.View style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }}>
            <Search size={16} color={colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search recipient by code, name, or email"
              placeholderTextColor={colors.textSecondary}
              style={{ flex: 1, color: colors.text, fontSize: 14 }}
              value={dashboardSearch}
              onChangeText={setDashboardSearch}
              autoCorrect={false}
              autoCapitalize="none"
              cursorColor={primaryColor}
              selectionColor={primaryColor}
            />
            {dashboardSearch.length > 0 && (
              <Pressable onPress={() => setDashboardSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
          {dashboardSearch.trim().length > 0 && (
            <View style={{ backgroundColor: colors.card, borderRadius: 14, marginTop: 6, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
              {dashboardSearchResults.clients.length === 0 && dashboardSearchResults.giftCards.length === 0 ? (
                <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No matching clients or gift cards found</Text>
                </View>
              ) : (
                <>
                  {dashboardSearchResults.clients.map((client, idx) => (
                    <Pressable
                      key={client.id}
                      onPress={() => { setDashboardSearch(''); onNavigateToClient(client.id); }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{client.name}</Text>
                        {(client.email || client.phone) && (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{client.email || client.phone}</Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                  {dashboardSearchResults.giftCards.map((gc, idx) => (
                    <Pressable
                      key={gc.id}
                      onPress={() => { setDashboardSearch(''); setGiftCardVisible(true); }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: (dashboardSearchResults.clients.length > 0 || idx > 0) ? 1 : 0, borderTopColor: colors.border }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', fontFamily: 'monospace' }}>{gc.code}</Text>
                        {gc.recipientName && (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{gc.recipientName}</Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          )}
        </Animated.View>

        {/* QUICK ACTIONS GRID */}
        <Animated.View style={{ marginTop: 24, marginBottom: 4 }}>
          {(() => {
            const row1 = calendarEnabled
              ? [
                  { key: 'addClient',      icon: UserPlus,     onPress: () => { if (!canAccessApp && onFeatureBlocked) { onFeatureBlocked(); } else { setAddClientVisible(true); } } },
                  { key: 'appointments',   icon: CalendarPlus, onPress: () => setAppointmentsVisible(true) },
                  { key: 'logVisit',       icon: CalendarDays, onPress: () => setAddVisitVisible(true) },
                ]
              : [
                  { key: 'addClient',      icon: UserPlus,     onPress: () => { if (!canAccessApp && onFeatureBlocked) { onFeatureBlocked(); } else { setAddClientVisible(true); } } },
                  { key: 'logVisit',       icon: CalendarDays, onPress: () => setAddVisitVisible(true) },
                ];
            const row2 = [
              { key: 'marketingPromo', icon: Tag,           onPress: () => setMarketingPromoVisible(true) },
              { key: 'bulkEmail',      icon: Send,          onPress: () => setBulkEmailVisible(true) },
              { key: 'dripCampaigns',  icon: Mail,          onPress: () => setDripCampaignVisible(true) },
            ];
            return (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  {row1.map(({ key, icon, onPress }) => (
                    <PremiumActionCard
                      key={key}
                      label={t(key as any, language)}
                      icon={icon}
                      onPress={onPress}
                      buttonColor={themeSettings.buttonColor}
                      numInRow={row1.length}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {row2.map(({ key, icon, onPress }) => (
                    <PremiumActionCard
                      key={key}
                      label={t(key as any, language)}
                      icon={icon}
                      onPress={onPress}
                      buttonColor={themeSettings.buttonColor}
                      numInRow={3}
                    />
                  ))}
                </View>
              </>
            );
          })()}
        </Animated.View>

      </ScrollView>
      </View>

      {/* ── MODALS (lazy mount: only rendered after first open) ── */}
      {everOpened.current.modal && <StatDetailModal visible={modalVisible} statType={selectedStat} onClose={closeStatDetail} onSelectClient={onNavigateToClient} />}
      {everOpened.current.addVisit && <AddVisitModal visible={addVisitVisible} onClose={() => setAddVisitVisible(false)} />}
      {everOpened.current.bookAppointment && <BookAppointmentModal visible={bookAppointmentVisible} onClose={() => setBookAppointmentVisible(false)} />}
      {everOpened.current.bulkEmail && <BulkEmailModal visible={bulkEmailVisible} onClose={() => setBulkEmailVisible(false)} />}
      {everOpened.current.marketingPromo && <MarketingPromoScreen visible={marketingPromoVisible} onClose={() => { setMarketingPromoVisible(false); setMarketingPrefill(undefined); }} prefill={marketingPrefill} />}
      {everOpened.current.dripCampaign && (
        <DripCampaignScreen
          visible={dripCampaignVisible}
          onClose={() => { setDripCampaignVisible(false); setSmartDripPrefill(undefined); }}
          prefill={smartDripPrefill}
        />
      )}
      {everOpened.current.appointments && <AppointmentsScreen visible={appointmentsVisible} onClose={() => setAppointmentsVisible(false)} />}
      {everOpened.current.addClient && <ClientEditScreen visible={addClientVisible} onBack={() => setAddClientVisible(false)} onSave={() => setAddClientVisible(false)} />}
      {everOpened.current.giftCard && <GiftCardScreen visible={giftCardVisible} onClose={() => setGiftCardVisible(false)} onOpenSmartDrip={handleOpenSmartDrip} />}
      {everOpened.current.membershipProgram && <MembershipProgramScreen visible={membershipProgramVisible} onClose={() => setMembershipProgramVisible(false)} onOpenSmartDrip={handleOpenSmartDrip} />}
      {everOpened.current.loyaltyProgram && <LoyaltyProgramScreen visible={loyaltyProgramVisible} onClose={() => setLoyaltyProgramVisible(false)} onOpenSmartDrip={handleOpenSmartDrip} onOpenMarketing={handleOpenMarketing} />}
    </View>
  );
}

// ─── Premium Action Card ─────────────────────────────────────────────────────

interface PremiumActionCardProps {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
  buttonColor: string;
  numInRow?: number;
}

function hexToRgbStr(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function PremiumActionCard({ label, icon: Icon, onPress, buttonColor, numInRow = 3 }: PremiumActionCardProps) {
  const rgb = hexToRgbStr(buttonColor);
  const { width: screenWidth } = useWindowDimensions();
  // 2-card row: 1 gap of 16; 3-card row: 2 gaps totalling 32
  const totalGap = numInRow === 2 ? 16 : 32;
  const cardWidth = Math.floor((screenWidth - 20 - totalGap) / numInRow);
  const cardHeight = 145;

  return (
    <View
      style={{
        width: cardWidth,
        height: cardHeight,
        borderRadius: 28,
        ...Platform.select({
          ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6 },
          android: { elevation: 4 },
        }),
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          width: cardWidth,
          height: cardHeight,
          borderRadius: 28,
          overflow: 'hidden',
          opacity: pressed ? 0.82 : 1,
        })}
      >
        {/* Gradient layers — purely visual, behind content */}
        <LinearGradient
          colors={[`rgba(${rgb}, 0.72)`, buttonColor]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.00)', 'rgba(0,0,0,0.20)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.00)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
        />
        {/* Content — normal flow, fills card, centers icon+label */}
        <View style={{ width: cardWidth, height: cardHeight, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Icon size={28} color="#FFFFFF" strokeWidth={1.8} />
          <Text style={{
            color: '#FFFFFF', fontSize: 12, fontWeight: '600',
            textAlign: 'center', marginTop: 10, lineHeight: 16,
            letterSpacing: 0.1, paddingHorizontal: 6,
            textShadowColor: 'rgba(0,0,0,0.18)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
          }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
            {label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
