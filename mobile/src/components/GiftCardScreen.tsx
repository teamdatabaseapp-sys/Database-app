import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Gift,
  Plus,
  CreditCard,
  Scissors,
  DollarSign,
  Search,
  Lock,
  Check,
  Calendar,
  User,
  UserPlus,
  Mail,
  Phone,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Clock,
  Store,
  TrendingUp,
  BarChart2,
  ChevronDown,
  Zap,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, GiftCard, GiftCardType, GiftCardService, GiftCardTransaction } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useGiftCards, useCreateGiftCard, useDeleteGiftCard, useGiftCardTransactions } from '@/hooks/useGiftCards';
import { useClients, useCreateClient } from '@/hooks/useClients';
import { useServices } from '@/hooks/useServices';
import { useStores } from '@/hooks/useStores';
import { useBusiness } from '@/hooks/useBusiness';
import { formatCurrency } from '@/lib/currency';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/phone-utils';
import { format } from 'date-fns';
import { isGiftCardUsable, getGiftCardSummary } from '@/services/giftCardService';
import { ClientSearchItem, getClientInitials, sortClientsAlphabetically } from './ClientSearchItem';
import { LocalSuccessToast } from './LocalSuccessToast';
import { getGiftCardRuleForCountry,
  getGiftCardComplianceRegion,
} from '@/lib/giftCardCompliance';
import { GiftCardPreview } from './giftcard/GiftCardPreview';
import { ColorPickerGrid } from './giftcard/ColorPickerGrid';
import { GiftCardListItem } from './giftcard/GiftCardListItem';
import { ActiveClientsModal } from './giftcard/ActiveClientsModal';
import { GiftCardRevenueModal } from './giftcard/GiftCardRevenueModal';
import { GiftCardDetailsModal } from './giftcard/GiftCardDetailsModal';
import { GiftCardAnalyticsView } from './giftcard/GiftCardAnalyticsView';
import { CreateGiftCardModal } from './giftcard/CreateGiftCardModal';
import { SetupHint } from '@/components/SetupHint';
import { HighlightWrapper } from '@/components/HighlightWrapper';

// ============================================
// Main Gift Card Screen
// ============================================

interface GiftCardScreenProps {
  visible: boolean;
  onClose: () => void;
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
  setupHint?: string;
}

export function GiftCardScreen({ visible, onClose, onOpenSmartDrip, setupHint }: GiftCardScreenProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { data: giftCards = [], isLoading, refetch } = useGiftCards();
  const { data: stores = [] } = useStores();
  const activeStores = stores.filter(s => !s.is_archived);

  type GiftCardTab = 'cards' | 'analytics';
  const [activeTab, setActiveTab] = useTabPersistence<GiftCardTab>('GiftCardScreen', 'cards');

  const scrollRef = useRef<ScrollView>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightY, setHighlightY] = useState(0);

  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] GiftCardScreen hint:', setupHint);
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(0, highlightY - 80), animated: true });
        }
      } catch (e) {
        console.warn('[SetupHint] scroll failed safely', e);
      }
      setHighlightActive(true);
      fadeTimer = setTimeout(() => {
        if (mounted) setHighlightActive(false);
      }, 2500);
    }, 450);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (fadeTimer !== null) clearTimeout(fadeTimer);
    };
  }, [setupHint, highlightY, visible]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActiveClients, setShowActiveClients] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGiftCard, setSelectedGiftCard] = useState<GiftCard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'expired'>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showStoreFilterDropdown, setShowStoreFilterDropdown] = useState(false);
  const [showStatusFilterDropdown, setShowStatusFilterDropdown] = useState(false);

  // Update search query instantly for real-time filtering
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  // Normalize a string for code matching: lowercase, strip hyphens and spaces
  const normalizeCode = (s: string) => s.toLowerCase().replace(/[-\s]/g, '');

  const storeMap = useMemo(() => {
    const m: Record<string, string> = {};
    stores.forEach(s => { m[s.id] = s.name; });
    return m;
  }, [stores]);

  // Store-filtered gift cards (applies store filter)
  const storeFilteredCards = useMemo(() => {
    if (!selectedStoreId) return giftCards;
    return giftCards.filter(gc => gc.storeId === selectedStoreId);
  }, [giftCards, selectedStoreId]);

  // Filter gift cards for the list (applies store + status + search)
  const filteredGiftCards = useMemo(() => {
    // Always apply store filter first, then search within it
    let base = storeFilteredCards;

    // Status filter
    if (statusFilter === 'active') {
      base = base.filter(gc => gc.status === 'active');
    } else if (statusFilter === 'used') {
      base = base.filter(gc => gc.status === 'fully_used');
    } else if (statusFilter === 'expired') {
      base = base.filter(gc => gc.status === 'expired');
    }

    // Search filter — normalized code match + recipient name/email
    const rawSearch = searchQuery.trim();
    if (rawSearch) {
      const normalizedQuery = normalizeCode(rawSearch);
      const lowerQuery = rawSearch.toLowerCase();
      base = base.filter(gc => {
        // Normalized code match (handles with/without hyphens, case-insensitive)
        if (normalizeCode(gc.code).includes(normalizedQuery)) return true;
        // Recipient name / email plain match
        if (gc.recipientName?.toLowerCase().includes(lowerQuery)) return true;
        if (gc.recipientEmail?.toLowerCase().includes(lowerQuery)) return true;
        return false;
      });
    }

    return base;
  }, [storeFilteredCards, statusFilter, searchQuery]);

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
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <View className="flex-row items-center">
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Gift size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('giftCards', language)}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Tab Bar */}
        <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 14, padding: 4 }}>
            {([
              { key: 'cards' as const, line1: t('giftCardTabCardsLine1', language), line2: t('giftCardTabCardsLine2', language) },
              { key: 'analytics' as const, line1: t('giftCardTabAnalyticsLine1', language), line2: t('giftCardTabAnalyticsLine2', language) },
            ]).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive ? (isDark ? colors.card : '#fff') : 'transparent',
                    shadowColor: isActive ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isActive ? 0.08 : 0,
                    shadowRadius: isActive ? 4 : 0,
                    elevation: isActive ? 2 : 0,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '500', color: isActive ? primaryColor : colors.textSecondary, textAlign: 'center', lineHeight: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {tab.line1}
                  </Text>
                  {tab.line2 ? (
                    <Text style={{ fontSize: 11, fontWeight: '500', color: isActive ? primaryColor : colors.textSecondary, textAlign: 'center', lineHeight: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                      {tab.line2}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Search — cards tab only */}
        <SetupHint hintKey={setupHint} />
        {activeTab === 'cards' && (
          <View style={{ paddingHorizontal: 20, marginBottom: 10, marginTop: 10 }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
              <Search size={18} color={colors.textTertiary} />
              <TextInput
                style={{ flex: 1, paddingVertical: 12, paddingLeft: 10, fontSize: 15, color: colors.text }}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder={t('scanOrEnterCode', language)}
                placeholderTextColor={colors.textTertiary}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => { setSearchQuery(''); }}
                  style={{ padding: 4 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Filters Row — cards tab only */}
        {activeTab === 'cards' && <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12, gap: 8, zIndex: 50 }}>
          {/* Store Filter — only show when > 1 store */}
          {activeStores.length > 1 && (
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={() => {
                  setShowStoreFilterDropdown(v => !v);
                  setShowStatusFilterDropdown(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: selectedStoreId !== null ? primaryColor : colors.card,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderWidth: 1,
                  borderColor: selectedStoreId !== null ? primaryColor : colors.border,
                }}
              >
                <Text style={{ color: selectedStoreId !== null ? '#fff' : colors.text, fontWeight: '500', fontSize: 13, flex: 1 }} numberOfLines={1}>
                  {selectedStoreId ? (activeStores.find(s => s.id === selectedStoreId)?.name ?? t('allStores', language)) : t('allStores', language)}
                </Text>
                <ChevronDown size={14} color={selectedStoreId !== null ? '#fff' : colors.textSecondary} style={{ marginLeft: 4 }} />
              </Pressable>
              {showStoreFilterDropdown && (
                <View style={{
                  position: 'absolute',
                  top: 42,
                  left: 0,
                  right: 0,
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  zIndex: 100,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  elevation: 8,
                  overflow: 'hidden',
                }}>
                  <Pressable
                    onPress={() => { setSelectedStoreId(null); setShowStoreFilterDropdown(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ color: selectedStoreId === null ? primaryColor : colors.text, fontWeight: selectedStoreId === null ? '600' : '400', fontSize: 14 }}>
                      {t('allStores', language)}
                    </Text>
                    {selectedStoreId === null && <Check size={15} color={primaryColor} />}
                  </Pressable>
                  {activeStores.map((store, idx) => (
                    <Pressable
                      key={store.id}
                      onPress={() => { setSelectedStoreId(store.id); setShowStoreFilterDropdown(false); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: idx < activeStores.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
                    >
                      <Text style={{ color: selectedStoreId === store.id ? primaryColor : colors.text, fontWeight: selectedStoreId === store.id ? '600' : '400', fontSize: 14 }} numberOfLines={1}>
                        {store.name}
                      </Text>
                      {selectedStoreId === store.id && <Check size={15} color={primaryColor} />}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Status Filter */}
          <View style={{ flex: 1 }}>
            <Pressable
              onPress={() => {
                setShowStatusFilterDropdown(v => !v);
                setShowStoreFilterDropdown(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: statusFilter !== 'all' ? primaryColor : colors.card,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderWidth: 1,
                borderColor: statusFilter !== 'all' ? primaryColor : colors.border,
              }}
            >
              <Text style={{ color: statusFilter !== 'all' ? '#fff' : colors.text, fontWeight: '500', fontSize: 13, flex: 1 }} numberOfLines={1}>
                {statusFilter === 'all' ? t('viewAll', language) : statusFilter === 'active' ? t('statusActive', language) : statusFilter === 'used' ? t('statusFullyUsed', language) : t('statusExpired', language)}
              </Text>
              <ChevronDown size={14} color={statusFilter !== 'all' ? '#fff' : colors.textSecondary} style={{ marginLeft: 4 }} />
            </Pressable>
            {showStatusFilterDropdown && (
              <View style={{
                position: 'absolute',
                top: 42,
                left: 0,
                right: 0,
                backgroundColor: colors.card,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                zIndex: 100,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 8,
                overflow: 'hidden',
              }}>
                {(['all', 'active', 'used', 'expired'] as const).map((status, idx) => {
                  const label = status === 'all' ? t('viewAll', language) : status === 'active' ? t('statusActive', language) : status === 'used' ? t('statusFullyUsed', language) : t('statusExpired', language);
                  return (
                    <Pressable
                      key={status}
                      onPress={() => { setStatusFilter(status); setShowStatusFilterDropdown(false); }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: idx < 3 ? 1 : 0, borderBottomColor: colors.border }}
                    >
                      <Text style={{ color: statusFilter === status ? primaryColor : colors.text, fontWeight: statusFilter === status ? '600' : '400', fontSize: 14 }}>
                        {label}
                      </Text>
                      {statusFilter === status && <Check size={15} color={primaryColor} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>}

        {/* Gift Card List — cards tab only */}
        {activeTab === 'cards' && (
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingTop: 8 }}>
            {filteredGiftCards.length > 0 ? (
              filteredGiftCards.map((giftCard, index) => (
                <Animated.View key={giftCard.id} entering={searchQuery ? undefined : FadeInDown.delay(50 * index).duration(300)}>
                  <GiftCardListItem
                    giftCard={giftCard}
                    storeName={giftCard.storeId ? storeMap[giftCard.storeId] : undefined}
                    onPress={() => {
                      setSelectedGiftCard(giftCard);
                      setShowDetailsModal(true);
                    }}
                  />
                </Animated.View>
              ))
            ) : (
              <View className="items-center py-16">
                <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Gift size={36} color={primaryColor} />
                </View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
                  {t('noGiftCards', language)}
                </Text>
                <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 40 }}>
                  {t('noGiftCardsDescription', language)}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <GiftCardAnalyticsView giftCards={giftCards} currency={currency} language={language} />
          </ScrollView>
        )}

        {/* Create Button */}
        <View style={{ padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
          <HighlightWrapper
            active={highlightActive}
            borderRadius={14}
            onLayout={(e) => setHighlightY(e.nativeEvent.layout.y)}
          >
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={{
              backgroundColor: buttonColor,
              paddingVertical: 16,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
              {t('createGiftCard', language)}
            </Text>
          </Pressable>
          </HighlightWrapper>
        </View>

        {/* Create Gift Card Modal */}
        <CreateGiftCardModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => refetch()}
        />

        {/* Active Clients Modal */}
        <ActiveClientsModal
          visible={showActiveClients}
          onClose={() => setShowActiveClients(false)}
          activeGiftCards={giftCards.filter(gc => gc.status === 'active')}
          initialStoreId={selectedStoreId}
        />

        {/* Gift Card Revenue Insights Modal */}
        <GiftCardRevenueModal
          visible={showRevenueModal}
          onClose={() => setShowRevenueModal(false)}
          allGiftCards={giftCards}
          onOpenSmartDrip={onOpenSmartDrip}
        />

        {/* Gift Card Details Modal */}
        <GiftCardDetailsModal
          visible={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          giftCard={selectedGiftCard}
        />
      </SafeAreaView>
    </Modal>
  );
}
