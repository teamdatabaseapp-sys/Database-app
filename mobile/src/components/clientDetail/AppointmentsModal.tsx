import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Calendar, X, Gift, User } from 'lucide-react-native';
import { StoreIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { t } from '@/lib/i18n';
import { Language, Visit } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

// Capitalize first letter of each word in date strings
const capitalizeDate = (str: string) =>
  str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());

interface ServiceTag {
  id: string;
  name: string;
  color: string;
}

interface MarketingPromotion {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  name: string;
}

export interface AppointmentsModalProps {
  visible: boolean;
  visits: Visit[];
  serviceTags: ServiceTag[];
  marketingPromotions: MarketingPromotion[];
  stores: Store[];
  staffMembers: StaffMember[];
  language: Language;
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    backgroundTertiary: string;
    [key: string]: string;
  };
  isDark: boolean;
  primaryColor: string;
  currency: string;
  dateLocale?: Locale;
  onClose: () => void;
}

export function AppointmentsModal({
  visible,
  visits,
  serviceTags,
  marketingPromotions,
  stores,
  staffMembers,
  language,
  colors,
  isDark,
  primaryColor,
  currency,
  dateLocale,
  onClose,
}: AppointmentsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Modal Header */}
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
          <View className="flex-row items-center">
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Calendar size={22} color={primaryColor} />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('visitHistory', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{visits.length} total visits</Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
          {visits.length > 0 ? (
            visits
              .slice()
              .reverse()
              .map((visit, index) => {
                const visitTags = serviceTags.filter((tag) => visit.services.includes(tag.id));
                // Look up promotion name from promo_id
                const visitPromotion = visit.promotionUsed
                  ? marketingPromotions.find((p) => p.id === visit.promotionUsed)
                  : null;
                return (
                  <View
                    key={visit.id}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                    }}
                  >
                    {/* Date Header */}
                    <View className="flex-row items-center justify-between mb-3">
                      <View>
                        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>
                          {capitalizeDate(format(new Date(visit.date), 'MMMM d, yyyy', { locale: dateLocale }))}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                          {capitalizeDate(format(new Date(visit.date), 'EEEE', { locale: dateLocale }))}
                          {' · '}{format(new Date(visit.date), 'h:mm a')}
                        </Text>
                      </View>
                      {/* Show total_cents if persisted, else fall back to amount */}
                      {(visit.total_cents != null && visit.total_cents > 0) ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          {visit.discount_cents != null && visit.discount_cents > 0 && visit.subtotal_cents != null && (
                            <Text style={{ color: colors.textTertiary, fontSize: 12, textDecorationLine: 'line-through' }}>
                              {formatCurrency(visit.subtotal_cents / 100, currency)}
                            </Text>
                          )}
                          <View style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                            <Text style={{ color: primaryColor, fontWeight: 'bold' }}>{formatCurrency(visit.total_cents / 100, currency)}</Text>
                          </View>
                          {visit.discount_cents != null && visit.discount_cents > 0 && (
                            <Text style={{ color: '#10B981', fontSize: 11, marginTop: 2 }}>
                              −{formatCurrency(visit.discount_cents / 100, currency)} discount
                            </Text>
                          )}
                        </View>
                      ) : visit.amount ? (
                        <View style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                          <Text style={{ color: primaryColor, fontWeight: 'bold' }}>{formatCurrency(visit.amount, currency)}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Services */}
                    {visitTags.length > 0 ? (
                      <View className="flex-row flex-wrap mb-2">
                        {visitTags.map((tag) => (
                          <View
                            key={tag.id}
                            className="px-3 py-1 rounded-full mr-2 mb-1"
                            style={{ backgroundColor: `${tag.color}15` }}
                          >
                            <Text className="text-sm font-medium" style={{ color: tag.color }}>
                              {tag.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : visit.serviceNames && visit.serviceNames.length > 0 ? (
                      <View className="flex-row flex-wrap mb-2">
                        {visit.serviceNames.map((name, i) => (
                          <View
                            key={i}
                            className="px-3 py-1 rounded-full mr-2 mb-1"
                            style={{ backgroundColor: `${primaryColor}15` }}
                          >
                            <Text className="text-sm font-medium" style={{ color: primaryColor }}>
                              {name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {/* Notes */}
                    {visit.notes && (
                      <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 8, padding: 12, marginTop: 8 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{visit.notes}</Text>
                      </View>
                    )}

                    {/* Store & Staff */}
                    {(visit.storeName || visit.staffName || visit.storeId || visit.staffId) && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
                        {(visit.storeName || (visit.storeId && stores.find(s => s.id === visit.storeId))) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <StoreIcon size={12} color={colors.textTertiary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>
                              {visit.storeName || stores.find(s => s.id === visit.storeId)?.name}
                            </Text>
                          </View>
                        )}
                        {(visit.staffName || (visit.staffId && staffMembers.find(s => s.id === visit.staffId))) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <User size={12} color={colors.textTertiary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>
                              {visit.staffName || staffMembers.find(s => s.id === visit.staffId)?.name}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Promotion Used */}
                    {visit.promotionUsed && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: isDark ? '#F9731620' : '#FFF7ED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                        <Gift size={16} color="#F97316" />
                        <Text className="text-orange-600 font-medium ml-2">
                          {visitPromotion?.name || visit.promo_name || t('promotionUsed', language)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
          ) : (
            <View className="items-center py-12">
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Calendar size={32} color={colors.textTertiary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>{t('noVisits', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                Add a visit to start tracking
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
