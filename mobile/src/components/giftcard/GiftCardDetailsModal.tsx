import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Gift,
  CreditCard,
  Calendar,
  User,
  Clock,
  Store,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, GiftCard, GiftCardTransaction } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useGiftCardTransactions } from '@/hooks/useGiftCards';
import { useStores } from '@/hooks/useStores';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { GiftCardPreview } from './GiftCardPreview';

// ============================================
// Gift Card Details Modal
// ============================================

export interface GiftCardDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  giftCard: GiftCard | null;
}

export function GiftCardDetailsModal({ visible, onClose, giftCard }: GiftCardDetailsModalProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { data: stores = [] } = useStores();
  const { data: transactions = [] } = useGiftCardTransactions(giftCard?.id);

  const statusColors: Record<string, string> = {
    active: primaryColor,
    fully_used: primaryColor,
    expired: primaryColor,
    cancelled: primaryColor,
  };

  const statusLabels: Record<string, string> = {
    active: t('statusActive', language),
    fully_used: t('statusFullyUsed', language),
    expired: t('statusExpired', language),
    cancelled: t('statusCancelled', language),
  };

  const storeName = giftCard?.storeId
    ? (stores.find(s => s.id === giftCard.storeId)?.name ?? t('unknownStore', language))
    : '—';

  const statusColor = giftCard ? (statusColors[giftCard.status] ?? primaryColor) : primaryColor;

  // Transactions sorted newest-first
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [transactions]
  );

  if (!giftCard) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
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
              <Gift size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
              {t('giftCardDetails', language)}
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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* A. Large Gift Card Preview */}
          <Animated.View entering={FadeInDown.delay(0).duration(350)}>
            <GiftCardPreview
              type={giftCard.type}
              value={giftCard.type === 'value' ? (giftCard.currentBalance ?? giftCard.originalValue) : undefined}
              services={giftCard.type === 'service' ? giftCard.services : undefined}
              recipientName={giftCard.recipientName}
              code={giftCard.code}
              expiresAt={giftCard.expiresAt ?? undefined}
            />
          </Animated.View>

          {/* B. Status section */}
          <Animated.View
            entering={FadeInDown.delay(60).duration(350)}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginTop: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              {/* Status badge */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${statusColor}18`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor, marginRight: 7 }} />
                <Text style={{ color: statusColor, fontWeight: '700', fontSize: 13 }}>
                  {statusLabels[giftCard.status] ?? giftCard.status}
                </Text>
              </View>
              {/* Type badge */}
              <View
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 12 }}>
                  {giftCard.type === 'value' ? t('valueBased', language) : t('serviceBased', language)}
                </Text>
              </View>
            </View>

            {/* Code */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CreditCard size={14} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 6 }}>
                {t('giftCardCode', language)}
              </Text>
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: '700',
                fontFamily: 'monospace',
                letterSpacing: 2,
                marginTop: 4,
              }}
              selectable
            >
              {giftCard.code}
            </Text>
          </Animated.View>

          {/* C. Balance / Services section */}
          <Animated.View entering={FadeInDown.delay(120).duration(350)}>
            {giftCard.type === 'value' ? (
              <View
                style={{
                  backgroundColor: isDark ? `${primaryColor}18` : `${primaryColor}10`,
                  borderRadius: 16,
                  padding: 20,
                  marginTop: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
                  {t('remainingBalance', language)}
                </Text>
                <Text style={{ color: primaryColor, fontSize: 36, fontWeight: '800' }}>
                  {formatCurrency(giftCard.currentBalance ?? 0, currency)}
                </Text>
                {giftCard.originalValue != null && giftCard.originalValue !== giftCard.currentBalance && (
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4 }}>
                    {t('originalValue', language)}: {formatCurrency(giftCard.originalValue, currency)}
                  </Text>
                )}
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 12,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>
                  {t('giftCardServices', language)}
                </Text>
                {(giftCard.services ?? []).map((svc, idx) => {
                  const remaining = svc.quantity - svc.usedQuantity;
                  return (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 10,
                        borderTopWidth: idx > 0 ? 1 : 0,
                        borderTopColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: remaining > 0 ? primaryColor : colors.textTertiary,
                            marginRight: 10,
                          }}
                        />
                        <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                          {svc.serviceName}
                        </Text>
                      </View>
                      <Text style={{ color: remaining > 0 ? primaryColor : colors.textTertiary, fontWeight: '700', fontSize: 14, marginLeft: 8 }}>
                        {remaining}/{svc.quantity}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* D. Details section */}
          <Animated.View
            entering={FadeInDown.delay(180).duration(350)}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              overflow: 'hidden',
              marginTop: 12,
            }}
          >
            {/* Recipient */}
            {(giftCard.recipientName || giftCard.recipientEmail) && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <User size={15} color={colors.textTertiary} style={{ marginTop: 1, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', marginBottom: 2 }}>
                    {t('recipientName', language)}
                  </Text>
                  {giftCard.recipientName ? (
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                      {giftCard.recipientName}
                    </Text>
                  ) : null}
                  {giftCard.recipientEmail ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 1 }}>
                      {giftCard.recipientEmail}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Issued Store */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Store size={15} color={colors.textTertiary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', marginBottom: 2 }}>
                  {t('issuedAtStore', language)}
                </Text>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  {storeName}
                </Text>
              </View>
            </View>

            {/* Created On */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Calendar size={15} color={colors.textTertiary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', marginBottom: 2 }}>
                  {t('createdOn', language)}
                </Text>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  {format(giftCard.createdAt, 'MMM d, yyyy \u2022 h:mm a')}
                </Text>
              </View>
            </View>

            {/* Expires */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Clock size={15} color={colors.textTertiary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500', marginBottom: 2 }}>
                  {t('expiresLabel', language)}
                </Text>
                <Text
                  style={{
                    color: giftCard.status === 'expired' ? primaryColor : colors.text,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  {giftCard.expiresAt
                    ? format(giftCard.expiresAt, 'MMM d, yyyy')
                    : t('noExpiration', language)}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* E. Activity Timeline */}
          <Animated.View entering={FadeInDown.delay(240).duration(350)} style={{ marginTop: 20 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 14 }}>
              {t('activityTimeline', language)}
            </Text>

            {sortedTransactions.length === 0 ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 32,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <Clock size={22} color={primaryColor} />
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                  {t('noActivityYet', language)}
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
                {sortedTransactions.map((tx: GiftCardTransaction, idx: number) => {
                  const isPurchase = tx.type === 'purchase' || tx.type === 'sale';
                  const isRedemption = tx.type === 'redemption';
                  const isRefund = tx.type === 'refund';

                  let dotColor = primaryColor;
                  let label = '';
                  let sublabel = '';
                  let description = '';

                  if (isPurchase) {
                    dotColor = primaryColor;
                    label = t('giftCardIssued', language);
                    sublabel = tx.amount != null ? formatCurrency(tx.amount, currency) : '';
                    description = `${t('activityCodeLabel', language)}: ${giftCard.code}`;
                  } else if (isRedemption) {
                    dotColor = primaryColor;
                    label = t('giftCardRedeemed', language);
                    sublabel = tx.serviceName
                      ? tx.amount != null
                        ? `${tx.serviceName} · −${formatCurrency(tx.amount, currency)}`
                        : tx.serviceName
                      : tx.amount != null
                        ? `−${formatCurrency(tx.amount, currency)}`
                        : '';
                    description = `${t('activityCodeLabel', language)}: ${giftCard.code}`;
                  } else if (isRefund) {
                    dotColor = primaryColor;
                    label = t('refund', language);
                    sublabel = tx.amount != null ? `+${formatCurrency(tx.amount, currency)}` : '';
                    description = `${t('activityCodeLabel', language)}: ${giftCard.code}`;
                  } else {
                    dotColor = colors.textTertiary;
                    label = tx.type === 'adjustment'
                      ? t('adjustmentActivity', language)
                      : giftCard.status === 'expired'
                        ? t('expiredActivity', language)
                        : tx.type;
                    sublabel = tx.amount != null ? formatCurrency(tx.amount, currency) : '';
                    description = `${t('activityCodeLabel', language)}: ${giftCard.code}`;
                  }

                  const isLast = idx === sortedTransactions.length - 1;

                  return (
                    <View
                      key={tx.id}
                      style={{
                        flexDirection: 'row',
                        paddingHorizontal: 16,
                        paddingTop: 14,
                        paddingBottom: isLast ? 14 : 0,
                      }}
                    >
                      {/* Timeline line + dot */}
                      <View style={{ width: 28, alignItems: 'center', marginRight: 12 }}>
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: dotColor,
                            marginTop: 2,
                            shadowColor: dotColor,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.5,
                            shadowRadius: 4,
                          }}
                        />
                        {!isLast && (
                          <View
                            style={{
                              width: 1.5,
                              flex: 1,
                              backgroundColor: colors.border,
                              marginTop: 4,
                              marginBottom: -14,
                            }}
                          />
                        )}
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, flex: 1 }} numberOfLines={1}>
                            {label}
                          </Text>
                          {sublabel ? (
                            <Text
                              style={{
                                color: isRedemption ? primaryColor : isRefund ? primaryColor : isPurchase ? primaryColor : colors.textSecondary,
                                fontWeight: '700',
                                fontSize: 13,
                                marginLeft: 8,
                              }}
                            >
                              {sublabel}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                          {format(tx.createdAt, 'MMM d, yyyy \u2022 h:mm a')}
                        </Text>
                        {description ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                            {description}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
