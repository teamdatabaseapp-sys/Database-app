import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, GiftCardType, GiftCardService } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { getGiftCardGradient } from '@/lib/giftCardColors';

export interface GiftCardPreviewProps {
  type: GiftCardType;
  value?: number;
  services?: GiftCardService[];
  recipientName?: string;
  personalMessage?: string;
  expiresAt?: Date;
  code?: string;
  compact?: boolean;
  overrideColor?: string;
}

export function GiftCardPreview({
  type,
  value,
  services,
  recipientName,
  personalMessage,
  expiresAt,
  code,
  compact = false,
  overrideColor,
}: GiftCardPreviewProps) {
  const user = useStore((s) => s.user);
  const language = useStore((s) => s.language) as Language;
  const { colors, isDark, primaryColor } = useTheme();
  const currency = useStore((s) => s.currency);

  // Use overrideColor if provided, else fall back to business primary color
  const baseColor = overrideColor || primaryColor;
  const { gradientStart, gradientEnd } = getGiftCardGradient(baseColor);

  if (compact) {
    const serviceCount = services?.length || 0;
    const valueLabel = type === 'value'
      ? formatCurrency(value || 0, currency)
      : `${serviceCount} ${serviceCount === 1 ? t('service', language) : t('services', language)}`;

    return (
      <View
        style={{
          backgroundColor: gradientStart,
          borderRadius: 12,
          padding: 10,
          minHeight: 90,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 4 }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '500' }}
            >
              {type === 'value' ? t('valueBased', language) : t('serviceBased', language)}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 3, lineHeight: 22 }}
            >
              {valueLabel}
            </Text>
          </View>
          <Gift size={20} color="rgba(255,255,255,0.6)" />
        </View>
        {code && (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: 'monospace', marginTop: 8 }}
          >
            {code}
          </Text>
        )}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[gradientStart, gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
      }}
    >
      {/* Header — business name only, no icon, no address (matches email) */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', letterSpacing: 1 }}>
          {(user?.businessName || t('giftCards', language)).toUpperCase()}
        </Text>
      </View>

      {/* Value / Services */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 0.5, marginBottom: 4 }}>
          {type === 'value' ? t('giftCardValue', language).toUpperCase() : t('servicesIncluded', language).toUpperCase()}
        </Text>
        {type === 'value' ? (
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '700', marginTop: 2 }}>
            {formatCurrency(value || 0, currency)}
          </Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            {services?.slice(0, 3).map((service, idx) => (
              <Text key={idx} style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                {service.quantity}x {service.serviceName}
              </Text>
            ))}
            {(services?.length || 0) > 3 && (
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                +{(services?.length || 0) - 3} {t('moreServicesCount', language)}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Recipient & Message block (matches email: "For: name", italic message) */}
      {(recipientName || personalMessage) && (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          {recipientName && (
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: personalMessage ? 4 : 0 }}>
              {t('forRecipientLabel', language)}: {recipientName}
            </Text>
          )}
          {personalMessage && (
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontStyle: 'italic' }}>
              "{personalMessage}"
            </Text>
          )}
        </View>
      )}

      {/* Gift Card Code block — separate block with rgba(255,255,255,0.15) bg (matches email) */}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>
          {t('yourGiftCardCode', language).toUpperCase()}
        </Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 3 }}>
          {code || '•••• •••• ••••'}
        </Text>
      </View>

      {/* Expiration — right-aligned (matches email table align="right") */}
      <View style={{ alignItems: 'flex-end' }}>
        {expiresAt ? (
          <>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('expiresOn', language)}
            </Text>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
              {format(expiresAt, 'MMM d, yyyy')}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('giftCardAvailableLabel', language)}
            </Text>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
              {t('noExpiration', language)}
            </Text>
          </>
        )}
      </View>
    </LinearGradient>
  );
}
