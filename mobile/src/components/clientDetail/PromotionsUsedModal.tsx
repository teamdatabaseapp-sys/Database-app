import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Gift, X, Store as StoreIcon } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import type { ClientPromotionUsed } from '@/services/promotionRedemptionsService';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

export interface PromotionsUsedModalProps {
  visible: boolean;
  promotionsUsed: ClientPromotionUsed[];
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

export function PromotionsUsedModal({
  visible,
  promotionsUsed,
  language,
  colors,
  isDark,
  primaryColor,
  currency,
  dateLocale,
  onClose,
}: PromotionsUsedModalProps) {
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
              <Gift size={22} color={primaryColor} />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('promotions', language)} Used</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{promotionsUsed.length} promotions redeemed</Text>
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
          {promotionsUsed.length > 0 ? (
            promotionsUsed.map((redemption) => {
              const promoColor = redemption.promotion_color || primaryColor;
              return (
                <View
                  key={redemption.id}
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
                  {/* Promotion Name */}
                  <View className="flex-row items-center mb-3">
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${promoColor}30` : `${promoColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                      <Gift size={20} color={promoColor} />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>
                        {redemption.promotion_name || t('promotionUsed', language)}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                        {capitalizeDate(format(new Date(redemption.redeemed_at), 'MMMM d, yyyy', { locale: dateLocale }))}
                      </Text>
                    </View>
                  </View>

                  {/* Redemption Details */}
                  <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 8, padding: 12 }}>
                    {/* Discount Type Badge */}
                    <View className="flex-row items-center mb-2">
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${promoColor}20` }}
                      >
                        <Text className="text-xs font-medium" style={{ color: promoColor }}>
                          {redemption.discount_type === 'percentage'
                            ? `${redemption.discount_value}${t('percentOff', language)}`
                            : redemption.discount_type === 'fixed'
                            ? `${formatCurrency(redemption.discount_value, redemption.currency || currency)} ${t('fixedOff', language)}`
                            : redemption.discount_type === 'free_service'
                            ? t('counter', language)
                            : t('counter', language)}
                        </Text>
                      </View>
                      {redemption.store_name && (
                        <View className="flex-row items-center ml-2">
                          <StoreIcon size={12} color={colors.textTertiary} />
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                            {redemption.store_name}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Amount if available */}
                    {redemption.final_amount != null && redemption.final_amount > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Amount paid</Text>
                        <Text style={{ color: primaryColor, fontWeight: '600' }}>{formatCurrency(redemption.final_amount, redemption.currency || currency)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View className="items-center py-12">
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Gift size={32} color={colors.textTertiary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>{t('noPromotionsUsedYet', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                {t('promotionsWillAppearHere', language)}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
