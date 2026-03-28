import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Clock, Edit3, User, Store as StoreIcon, Hash, Gift } from 'lucide-react-native';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { t } from '@/lib/i18n';
import { Language, Visit } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';

// Helper to capitalize first letter of each word in date strings
const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

export interface VisitCardProps {
  visit: Visit;
  index: number;
  serviceTags: { id: string; name: string; color: string }[];
  promotions: { id: string; name: string; color: string }[];
  onEdit?: (visit: Visit) => void;
  colors: {
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    card: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    [key: string]: string;
  };
  isDark: boolean;
  primaryColor: string;
  currency: string;
  language: Language;
  dateLocale?: Locale;
}

export function VisitCard({ visit, index, serviceTags, promotions, onEdit, colors, isDark, primaryColor, currency, language, dateLocale }: VisitCardProps) {
  const visitTags = serviceTags.filter((tag) => visit.services.includes(tag.id));

  // Look up promotion by ID to get the name and color
  const promotion = visit.promotionUsed ? promotions.find((p) => p.id === visit.promotionUsed) : null;
  const promotionName = promotion?.name || visit.promo_name || null;
  const promotionColor = promotion?.color || '#F97316';

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 8 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
            {capitalizeDate(format(new Date(visit.date), 'EEEE, MMM d, yyyy', { locale: dateLocale }))}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Clock size={11} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
              {format(new Date(visit.date), 'h:mm a', { locale: dateLocale })}
            </Text>
          </View>
          {visit.modifiedAt && (
            <View className="flex-row items-center mt-0.5">
              <Clock size={10} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                {t('edited', language)} {capitalizeDate(format(new Date(visit.modifiedAt), 'MMM d, yyyy h:mm a', { locale: dateLocale }))}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center">
          {visit.amount != null && visit.amount > 0 && (
            <Text style={{ color: primaryColor, fontWeight: '600', marginRight: 8 }}>{formatCurrency(visit.amount, currency)}</Text>
          )}
          {onEdit && (
            <Pressable
              onPress={() => onEdit(visit)}
              className="p-2 -mr-2 active:opacity-60"
            >
              <Edit3 size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Services: matched tags first, fallback to stored service names */}
      {visitTags.length > 0 ? (
        <View className="flex-row flex-wrap mt-2">
          {visitTags.map((tag) => (
            <View
              key={tag.id}
              className="px-2 py-0.5 rounded-full mr-1.5 mb-1"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Text className="text-xs font-medium" style={{ color: primaryColor }}>
                {tag.name}
              </Text>
            </View>
          ))}
        </View>
      ) : visit.serviceNames && visit.serviceNames.length > 0 ? (
        <View className="flex-row flex-wrap mt-2">
          {visit.serviceNames.map((name, i) => (
            <View
              key={i}
              className="px-2 py-0.5 rounded-full mr-1.5 mb-1"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Text className="text-xs font-medium" style={{ color: primaryColor }}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Staff / Store info */}
      {(visit.staffName || visit.storeName) && (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
          {visit.staffName && (
            <View className="flex-row items-center" style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <User size={11} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>{visit.staffName}</Text>
            </View>
          )}
          {visit.storeName && (
            <View className="flex-row items-center" style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <StoreIcon size={11} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>{visit.storeName}</Text>
            </View>
          )}
        </View>
      )}

      {visit.notes ? (
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>{visit.notes}</Text>
      ) : null}

      {/* Confirmation code + gift card row */}
      {(visit.confirmationCode || visit.giftCardCode) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 }}>
          {visit.confirmationCode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Hash size={11} color={primaryColor} />
              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700', marginLeft: 3, fontFamily: 'monospace', letterSpacing: 0.5 }}>{visit.confirmationCode}</Text>
            </View>
          )}
          {visit.giftCardCode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: `${primaryColor}12`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Gift size={11} color={primaryColor} />
              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600', marginLeft: 3, fontFamily: 'monospace' }}>{visit.giftCardCode}</Text>
            </View>
          )}
        </View>
      )}

      {visit.promotionUsed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: `${promotionColor}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
          <Gift size={12} color={promotionColor} />
          <Text style={{ color: promotionColor, fontSize: 12, fontWeight: '500', marginLeft: 4 }}>
            {promotionName || t('promotionUsed', language)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
