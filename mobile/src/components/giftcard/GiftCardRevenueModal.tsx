import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, BarChart2, Check, ChevronDown } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, GiftCard } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useStores } from '@/hooks/useStores';
import { formatCurrency } from '@/lib/currency';

// ============================================
// Gift Card Revenue Insights Modal
// ============================================

export interface GiftCardRevenueModalProps {
  visible: boolean;
  onClose: () => void;
  allGiftCards: GiftCard[];
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
}

export function GiftCardRevenueModal({ visible, onClose, allGiftCards, onOpenSmartDrip }: GiftCardRevenueModalProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const { data: stores = [] } = useStores();
  const activeStores = stores.filter(s => !s.is_archived);

  // Filter to value-based, active gift cards only for balance insights
  const valueCards = useMemo(() => {
    const cards = allGiftCards.filter(gc => gc.type === 'value' && gc.originalValue != null);
    if (!selectedStoreId) return cards;
    return cards.filter(gc => gc.storeId === selectedStoreId);
  }, [allGiftCards, selectedStoreId]);

  // Group by month — always produce 12 entries for the current year (Jan–Dec), like the Analytics chart
  const currentYear = new Date().getFullYear();

  // Locale-aware short month names derived from the selected language
  const localeMonths = useMemo(() => {
    // Map app language codes to BCP 47 locale tags
    const localeMap: Record<string, string> = {
      en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-PT',
      it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', ja: 'ja-JP', ko: 'ko-KR',
      zh: 'zh-CN', tr: 'tr-TR', sv: 'sv-SE', no: 'nb-NO', da: 'da-DK',
      fi: 'fi-FI', is: 'is-IS', ht: 'ht-HT',
    };
    const locale = localeMap[language] ?? 'en-US';
    return Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleString(locale, { month: 'short' })
    );
  }, [language]);

  const monthlyData = useMemo(() => {
    // Build a 12-slot array for the current year
    const slots: { month: number; label: string; value: number }[] = localeMonths.map((lbl, i) => ({
      month: i,
      label: lbl,
      value: 0,
    }));
    valueCards.forEach(gc => {
      const d = gc.issuedAt;
      if (d.getFullYear() === currentYear) {
        slots[d.getMonth()].value += gc.originalValue || 0;
      }
    });
    return slots;
  }, [valueCards, currentYear, localeMonths]);

  const maxValue = useMemo(() => Math.max(...monthlyData.map(m => m.value), 1), [monthlyData]);

  const bestMonth = useMemo(() => {
    if (!monthlyData.length) return null;
    return monthlyData.reduce((best, m) => m.value > best.value ? m : best, monthlyData[0]);
  }, [monthlyData]);

  const totalRevenue = useMemo(() => valueCards.reduce((sum, gc) => sum + (gc.originalValue || 0), 0), [valueCards]);
  const totalCount = valueCards.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
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
              <BarChart2 size={20} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
              {t('giftCardRevenue', language)}
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

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>

          {/* Store filter — compact dropdown */}
          {activeStores.length > 1 && (
            <View style={{ marginBottom: 20, zIndex: 50 }}>
              <Pressable
                onPress={() => setShowStoreDropdown(v => !v)}
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
                  alignSelf: 'flex-start',
                  minWidth: 140,
                }}
              >
                <Text style={{ color: selectedStoreId !== null ? '#fff' : colors.text, fontWeight: '500', fontSize: 13, marginRight: 6 }} numberOfLines={1}>
                  {selectedStoreId ? (activeStores.find(s => s.id === selectedStoreId)?.name ?? t('allStores', language)) : t('allStores', language)}
                </Text>
                <ChevronDown size={14} color={selectedStoreId !== null ? '#fff' : colors.textSecondary} />
              </Pressable>
              {showStoreDropdown && (
                <View style={{
                  position: 'absolute',
                  top: 44,
                  left: 0,
                  minWidth: 180,
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
                    onPress={() => { setSelectedStoreId(null); setShowStoreDropdown(false); }}
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
                      onPress={() => { setSelectedStoreId(store.id); setShowStoreDropdown(false); }}
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

          {/* Summary KPIs */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>{t('totalIssued', language)}</Text>
              <Text style={{ color: primaryColor, fontSize: 22, fontWeight: 'bold' }}>{formatCurrency(totalRevenue, currency)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{totalCount} {t('cardsLabel', language)}</Text>
            </View>
            {bestMonth && (
              <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>{t('bestMonth', language)}</Text>
                <Text style={{ color: primaryColor, fontSize: 22, fontWeight: 'bold' }}>{formatCurrency(bestMonth.value, currency)}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{bestMonth.label}</Text>
              </View>
            )}
          </View>

          {/* Monthly Revenue Chart */}
          {monthlyData.length > 0 ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>{t('monthlyRevenue', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 20 }}>{t('valueBasedIssued', language)}</Text>

              {/* Bar chart — matches Analytics Monthly Revenue style */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120 }}>
                {monthlyData.map((m) => {
                  const barHeight = maxValue > 0 ? Math.max((m.value / maxValue) * 100, m.value > 0 ? 8 : 2) : 2;
                  const isBest = bestMonth?.month === m.month && m.value > 0;
                  return (
                    <View key={m.month} style={{ flex: 1, alignItems: 'center', marginHorizontal: 2 }}>
                      {/* Value label above bar */}
                      {m.value > 0 && (
                        <Text
                          style={{ fontSize: 8, marginBottom: 4, fontWeight: '500', color: isBest ? primaryColor : colors.textSecondary }}
                          numberOfLines={1}
                        >
                        {m.value >= 1000 ? formatCurrency(Math.round(m.value / 100) * 100, currency).replace(/\s+/g, '') : formatCurrency(m.value, currency)}
                        </Text>
                      )}
                      {/* Bar */}
                      <View
                        style={{
                          width: '100%',
                          height: barHeight,
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                          backgroundColor: isBest
                            ? primaryColor
                            : m.value > 0
                              ? (isDark ? `${primaryColor}60` : `${primaryColor}40`)
                              : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                        }}
                      />
                    </View>
                  );
                })}
              </View>

              {/* Month labels */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                {monthlyData.map((m) => {
                  const isBest = bestMonth?.month === m.month && m.value > 0;
                  return (
                    <View key={m.month} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, color: isBest ? primaryColor : colors.textTertiary, fontWeight: isBest ? '600' : '400' }}>
                        {m.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <BarChart2 size={28} color={primaryColor} />
              </View>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 6 }}>{t('noRevenueData', language)}</Text>
              <Text style={{ color: colors.textTertiary, textAlign: 'center', fontSize: 13 }}>
                {t('noRevenueDataDesc', language)}
              </Text>
            </View>
          )}

          {/* Monthly breakdown list */}
          {monthlyData.length > 0 && (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{t('monthlyBreakdown', language)}</Text>
              </View>
              {monthlyData.map((m, idx, arr) => {
                const isBest = bestMonth?.month === m.month && m.value > 0;
                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{m.label}</Text>
                    {isBest && (
                      <View style={{ backgroundColor: `${primaryColor}18`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginRight: 10 }}>
                        <Text style={{ color: primaryColor, fontSize: 10, fontWeight: '700' }}>{t('bestBadge', language)}</Text>
                      </View>
                    )}
                    <Text style={{ color: isBest ? primaryColor : colors.text, fontWeight: isBest ? '700' : '600', fontSize: 14 }}>
                      {formatCurrency(m.value, currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
