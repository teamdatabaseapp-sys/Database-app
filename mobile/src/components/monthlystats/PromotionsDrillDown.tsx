import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Mail,
  Zap,
  Gift,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import type { PromotionRedemptionRow } from '@/services/promotionRedemptionsService';
import { StoreFilter } from './StoreFilter';

// ============================================
// PromotionsDrillDown — promotions case
// ============================================

export interface PromotionsDrillDownProps {
  rows: PromotionRedemptionRow[];
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  language: Language;
  dateLocale: Locale | undefined;
  currency: string;
  onClientPress: (clientId: string) => void;
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
  onOpenMarketing?: (prefill?: {
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string;
    contextLabel?: string;
  }) => void;
}

function capitalizeDate(str: string): string {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
}

export function PromotionsDrillDown({
  rows,
  stores,
  selectedStoreId,
  onSelectStore,
  language,
  dateLocale,
  currency,
  onClientPress,
  onOpenSmartDrip,
  onOpenMarketing,
}: PromotionsDrillDownProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View>
      <StoreFilter
        stores={stores}
        selectedStoreId={selectedStoreId}
        onSelect={onSelectStore}
        language={language}
      />
      <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
        {t('promotionsRedeemed', language)} ({rows.length})
      </Text>
      {onOpenSmartDrip && (
        <Pressable
          onPress={() => onOpenSmartDrip({ name: t('smartTripPromoUpsellName', language), frequency: 'weekly', contextLabel: t('smartRecommendationPromoUpsell', language) })}
          style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiSmartDripCampaign', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecPromotionsDrip', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {onOpenMarketing && (
        <Pressable
          onPress={() => onOpenMarketing({ discountType: 'percentage', name: '', contextLabel: t('aiRecPromotionsPromo', language) })}
          style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiMarketingPromotion', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecPromotionsPromo', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {rows.map((row, index) => {
        const promoName  = row.promo_name  || 'Unknown Promotion';
        const promoColor = row.promo_color || primaryColor;
        return (
          <Pressable
            key={`${row.id}-${index}`}
            onPress={() => row.client_id && onClientPress(row.client_id)}
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
            <View className="flex-row items-center">
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${promoColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Gift size={18} color={promoColor} />
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ color: colors.text, fontWeight: '500' }}>{row.client_name || 'Unknown Client'}</Text>
                <Text style={{ color: promoColor, fontSize: 14, fontWeight: '600' }}>
                  {promoName}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                  {capitalizeDate(format(new Date(row.redeemed_at), 'MMM d, yyyy', { locale: dateLocale }))}
                  {row.store_name ? ` · ${getLocalizedStoreName(row.store_name, language)}` : ''}
                  {row.amount != null ? ` · ${formatCurrency(row.amount, currency)}` : ''}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </View>
          </Pressable>
        );
      })}
      {rows.length === 0 && (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('noPromotionsRedeemed', language)}</Text>
      )}
    </View>
  );
}
