import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Gift, User } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, GiftCard } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useStores } from '@/hooks/useStores';
import { formatCurrency } from '@/lib/currency';

// ============================================
// Active Clients Modal
// ============================================

export interface ActiveClientsModalProps {
  visible: boolean;
  onClose: () => void;
  activeGiftCards: GiftCard[];
  initialStoreId?: string | null;
}

export function ActiveClientsModal({ visible, onClose, activeGiftCards, initialStoreId }: ActiveClientsModalProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const [sortOrder, setSortOrder] = useState<'alpha' | 'recent'>('alpha');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(initialStoreId ?? null);
  const { data: stores = [] } = useStores();
  const activeStores = stores.filter(s => !s.is_archived);

  // Update selectedStoreId when initialStoreId changes (e.g. parent store filter changes)
  const [prevInitial, setPrevInitial] = useState(initialStoreId);
  if (prevInitial !== initialStoreId) {
    setPrevInitial(initialStoreId);
    setSelectedStoreId(initialStoreId ?? null);
  }

  const storeFiltered = useMemo(() => {
    if (!selectedStoreId) return activeGiftCards;
    return activeGiftCards.filter(gc => gc.storeId === selectedStoreId);
  }, [activeGiftCards, selectedStoreId]);

  const sorted = useMemo(() => {
    return [...storeFiltered].sort((a, b) => {
      if (sortOrder === 'alpha') {
        const nameA = (a.recipientName || a.purchaserName || a.code).toLowerCase();
        const nameB = (b.recipientName || b.purchaserName || b.code).toLowerCase();
        return nameA.localeCompare(nameB);
      } else {
        return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
      }
    });
  }, [storeFiltered, sortOrder]);

  const initials = (card: GiftCard) => {
    const name = card.recipientName || card.purchaserName || '';
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header — title only, no subtitle */}
        <View
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
                backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <User size={20} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
              {t('activeGiftCards', language)}
            </Text>
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
        </View>

        {/* List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Subtitle */}
          <Text style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 14 }}>
            {sorted.length} {t('clientsWithActiveCards', language)}
          </Text>

          {/* Store filter */}
          {activeStores.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setSelectedStoreId(null)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedStoreId === null ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                  }}
                >
                  <Text style={{ color: selectedStoreId === null ? '#fff' : colors.textSecondary, fontWeight: '500', fontSize: 13 }}>
                    {t('allStores', language)}
                  </Text>
                </Pressable>
                {activeStores.map(store => (
                  <Pressable
                    key={store.id}
                    onPress={() => setSelectedStoreId(store.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: selectedStoreId === store.id ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                    }}
                  >
                    <Text style={{ color: selectedStoreId === store.id ? '#fff' : colors.textSecondary, fontWeight: '500', fontSize: 13 }}>
                      {store.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Sort filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['alpha', 'recent'] as const).map((key) => {
                const label = key === 'alpha' ? t('alphabetical', language) : t('mostRecent', language);
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSortOrder(key)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: sortOrder === key ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                    }}
                  >
                    <Text style={{ color: sortOrder === key ? '#fff' : colors.textSecondary, fontWeight: '500', fontSize: 13 }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {sorted.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Gift size={32} color={primaryColor} />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', marginBottom: 6 }}>
                {t('noGiftCards', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 14 }}>
                {t('giftCardsWillAppearHere', language)}
              </Text>
            </View>
          ) : (
            sorted.map((card, index) => {
              const name = card.recipientName || card.purchaserName || 'Unknown';
              const hasEmail = !!card.recipientEmail;
              const valueLabel =
                card.type === 'value'
                  ? formatCurrency(card.currentBalance || 0, currency)
                  : `${card.services?.length || 0} Service${(card.services?.length || 0) !== 1 ? 's' : ''}`;
              const typeLabel = card.type === 'value' ? t('valueBased', language) : t('serviceBased', language);

              return (
                <Animated.View key={card.id} entering={FadeInDown.delay(40 * index).duration(280)}>
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    {/* Avatar */}
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}18`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ color: primaryColor, fontSize: 15, fontWeight: '700' }}>
                        {initials(card)}
                      </Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 }}>
                        {name}
                      </Text>
                      {hasEmail && (
                        <Text
                          style={{ color: colors.textTertiary, fontSize: 11, marginBottom: 3 }}
                          numberOfLines={1}
                        >
                          {card.recipientEmail}
                        </Text>
                      )}
                      <Text
                        style={{ color: colors.textTertiary, fontSize: 11, fontFamily: 'monospace' }}
                        numberOfLines={1}
                      >
                        {card.code}
                      </Text>
                      {card.storeId && (
                        <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: 'monospace', marginTop: 2 }} numberOfLines={1}>
                          {t('issuedAtStore', language)}: {activeStores.find(s => s.id === card.storeId)?.name ?? t('unknownStore', language)}
                        </Text>
                      )}
                    </View>

                    {/* Balance */}
                    <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                      <Text
                        style={{ color: primaryColor, fontSize: 15, fontWeight: '700' }}
                        adjustsFontSizeToFit
                        numberOfLines={1}
                      >
                        {valueLabel}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
                        {typeLabel}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
