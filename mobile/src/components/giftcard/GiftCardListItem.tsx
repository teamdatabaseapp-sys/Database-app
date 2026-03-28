import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight, Store, Calendar, Clock } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, GiftCard } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { isGiftCardUsable, getGiftCardSummary } from '@/services/giftCardService';
import { GiftCardPreview } from './GiftCardPreview';

// ============================================
// Gift Card List Item
// ============================================

export interface GiftCardListItemProps {
  giftCard: GiftCard;
  onPress: () => void;
  storeName?: string;
}

export function GiftCardListItem({ giftCard, onPress, storeName }: GiftCardListItemProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);

  const { usable, reason } = isGiftCardUsable(giftCard);

  const statusColors = {
    active: primaryColor,
    fully_used: primaryColor,
    expired: primaryColor,
    cancelled: primaryColor,
  };

  const statusLabels = {
    active: t('statusActive', language),
    fully_used: t('statusFullyUsed', language),
    expired: t('statusExpired', language),
    cancelled: t('statusCancelled', language),
  };

  return (
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
        elevation: 2,
      }}
    >
      <View className="flex-row items-start">
        {/* Mini Preview */}
        <View style={{ width: 100, marginRight: 14 }}>
          <GiftCardPreview
            type={giftCard.type}
            value={giftCard.currentBalance}
            services={giftCard.services}
            code={giftCard.code}
            compact
          />
        </View>

        {/* Details */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, flex: 1 }} numberOfLines={2}>
              {giftCard.type === 'value'
                ? formatCurrency(giftCard.currentBalance || 0, currency)
                : getGiftCardSummary(giftCard)
              }
            </Text>
            <View
              style={{
                backgroundColor: `${statusColors[giftCard.status]}20`,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                flexShrink: 0,
              }}
            >
              <Text style={{ color: statusColors[giftCard.status], fontSize: 11, fontWeight: '600' }}>
                {statusLabels[giftCard.status]}
              </Text>
            </View>
          </View>

          <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: 'monospace', marginBottom: 4 }}>
            {giftCard.code}
          </Text>

          {giftCard.recipientName && (
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {t('recipientName', language)}: {giftCard.recipientName}
            </Text>
          )}

          {storeName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Store size={11} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginLeft: 4 }}>
                {t('issuedAtStore', language)}: {storeName}
              </Text>
            </View>
          )}

          <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
            <View className="flex-row items-center">
              <Calendar size={12} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginLeft: 4 }}>
                {format(giftCard.issuedAt, 'MMM d, yyyy')}
              </Text>
            </View>
            {giftCard.expiresAt && (
              <View className="flex-row items-center">
                <Clock size={12} color={giftCard.status === 'expired' ? primaryColor : colors.textTertiary} />
                <Text style={{ color: giftCard.status === 'expired' ? primaryColor : colors.textTertiary, fontSize: 11, marginLeft: 4 }}>
                  {format(giftCard.expiresAt, 'MMM d, yyyy')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ChevronRight size={18} color={colors.textTertiary} style={{ marginLeft: 8 }} />
      </View>
    </Pressable>
  );
}
