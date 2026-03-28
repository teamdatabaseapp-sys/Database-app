import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import {
  Edit3, Plus, Share2, Percent, Tag, Zap, Package, Users, Gift,
  Shield, Sparkles, ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language, MarketingPromotion } from '@/lib/types';
import { formatCurrency, getCurrencySymbol } from '@/lib/currency';
import { PROMO_TEMPLATES, PromoTemplate, getTemplateIcon } from '@/components/promo/promoTemplatesData';

// ============================================
// PromoTemplatesView
// Tab 1 of MarketingPromoScreen — shows existing promos + template cards.
// All mutations and modal state live in the parent (MarketingPromoScreen).
// ============================================

interface PromoTemplatesViewProps {
  onUseTemplate: (template: PromoTemplate) => void;
  onCreateNew: () => void;
  onEditPromo: (promo: MarketingPromotion) => void;
  onShareList: () => void;
}

export function PromoTemplatesView({ onUseTemplate, onCreateNew, onEditPromo, onShareList }: PromoTemplatesViewProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const currencySymbol = getCurrencySymbol(currency);
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const userId = useStore((s) => s.user?.id);

  const marketingPromotions = useMemo(() => {
    if (!userId) return [];
    return allMarketingPromotions.filter((p) => p.userId === userId);
  }, [allMarketingPromotions, userId]);

  const activePromotions = useMemo(() => marketingPromotions.filter((p) => p.isActive), [marketingPromotions]);
  const inactivePromotions = useMemo(() => marketingPromotions.filter((p) => !p.isActive), [marketingPromotions]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Create Button */}
      <Animated.View entering={FadeInDown.delay(40).duration(300)}>
        <Pressable
          onPress={onCreateNew}
          style={{ backgroundColor: buttonColor, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}
        >
          <Plus size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: 8 }}>{t('createNewPromotion', language)}</Text>
        </Pressable>
      </Animated.View>

      {/* Active Promotions */}
      {activePromotions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(40).duration(300)} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t('activePromotions', language)}</Text>
            <Pressable
              onPress={onShareList}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: isDark ? `${primaryColor}18` : `${primaryColor}0F`,
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9,
                borderWidth: 1, borderColor: isDark ? `${primaryColor}28` : `${primaryColor}18`,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Share2 size={13} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 12, letterSpacing: 0.1, includeFontPadding: false }}>{t('promoSocialMedia', language)}</Text>
              </View>
            </Pressable>
          </View>
          {activePromotions.map((promo) => (
            <Pressable
              key={promo.id}
              onPress={() => onEditPromo(promo)}
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: 12,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', flexShrink: 0, flexGrow: 0 }}>
                  {promo.discountType === 'percentage' ? <Percent size={18} color={primaryColor} /> :
                   promo.discountType === 'fixed' ? <Tag size={18} color={primaryColor} /> :
                   promo.discountType === 'flash_sale' ? <Zap size={18} color={primaryColor} /> :
                   promo.discountType === 'bundle' ? <Package size={18} color={primaryColor} /> :
                   promo.discountType === 'referral' ? <Users size={18} color={primaryColor} /> :
                   <Gift size={18} color={primaryColor} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{promo.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {promo.discountType === 'percentage' ? `${promo.discountValue}${t('percentageOff', language)}` :
                     promo.discountType === 'fixed' ? `${formatCurrency(promo.discountValue, currency)} ${t('amountOff', language)}` :
                     (promo.discountType === 'other' || promo.discountType === 'bundle' || promo.discountType === 'flash_sale' || promo.discountType === 'referral') ? promo.otherDiscountDescription :
                     t('freeAfterServices', language).replace('{count}', String(promo.freeServiceAfter))}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#10B98115', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 8, flexShrink: 0 }}>
                  <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>{t('active', language)}</Text>
                </View>
                <View style={{ flexShrink: 0 }}>
                  <ChevronRight size={16} color={colors.textTertiary} />
                </View>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      )}

      {/* Inactive Promotions */}
      {inactivePromotions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 16, marginBottom: 10 }}>{t('inactivePromotions', language)}</Text>
          {inactivePromotions.map((promo) => (
            <Pressable
              key={promo.id}
              onPress={() => onEditPromo(promo)}
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: 12,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.5 : 0.7,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}10`, alignItems: 'center', justifyContent: 'center', flexShrink: 0, flexGrow: 0 }}>
                  <Tag size={18} color={colors.textTertiary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{promo.name}</Text>
                </View>
                <View style={{ backgroundColor: colors.backgroundTertiary ?? '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 8, flexShrink: 0 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600' }}>{t('inactive', language)}</Text>
                </View>
                <View style={{ flexShrink: 0 }}>
                  <ChevronRight size={16} color={colors.textTertiary} />
                </View>
              </View>
            </Pressable>
          ))}
        </Animated.View>
      )}

      {/* Empty state */}
      {marketingPromotions.length === 0 && (
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 20 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Tag size={30} color={colors.textTertiary} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500', textAlign: 'center' }}>{t('noPromotionsYet', language)}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 24 }}>{t('createFirstPromotion', language)}</Text>
        </Animated.View>
      )}

      {/* Templates Section Header */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)}>
        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }}>
            <Shield size={12} color={primaryColor} />
            <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {t('readyMadeTemplates', language)}
            </Text>
          </View>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        {/* Subtitle */}
        <View style={{ backgroundColor: isDark ? `${primaryColor}15` : '#F0FDF9', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: isDark ? `${primaryColor}25` : '#D1FAE5' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Sparkles size={15} color={primaryColor} />
            <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 13, marginLeft: 8 }}>{t('readyMadeTemplates', language)}</Text>
          </View>
          <Text style={{ color: isDark ? colors.textSecondary : '#047857', fontSize: 12, lineHeight: 17 }}>
            {t('promoTemplatesSubtitle', language)}
          </Text>
        </View>
      </Animated.View>

      {/* Template Cards */}
      {PROMO_TEMPLATES.map((template, index) => (
        <Animated.View key={template.id} entering={FadeInDown.delay(100 + index * 50).duration(300)}>
          <Pressable
            onPress={() => onUseTemplate(template)}
            style={({ pressed }) => ({
              backgroundColor: colors.card,
              borderRadius: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            {/* Row layout lives on inner View — NOT on Pressable style function */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              {/* LEFT: icon — fixed 44×44, never compressed */}
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                flexGrow: 0,
              }}>
                {getTemplateIcon(template.icon, primaryColor)}
              </View>

              {/* CENTER: title + description to the RIGHT of icon */}
              <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, lineHeight: 20 }} numberOfLines={1}>
                  {t(template.nameKey, language)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>
                  {t(template.descKey, language)}
                </Text>
              </View>

              {/* FAR RIGHT: chevron — fixed, always vertically centered */}
              <View style={{ marginLeft: 10, flexShrink: 0, flexGrow: 0 }}>
                <ChevronRight size={18} color={colors.textTertiary} />
              </View>
            </View>
          </Pressable>
        </Animated.View>
      ))}

    </ScrollView>
  );
}
