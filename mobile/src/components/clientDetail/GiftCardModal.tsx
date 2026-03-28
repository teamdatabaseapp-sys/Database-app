import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import {
  CreditCard,
  DollarSign,
  Gift,
  Check,
  X,
  Clock,
  Calendar,
  Plus,
  Minus,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { isGiftCardUsable } from '@/services/giftCardService';
import type { GiftCard, GiftCardTransaction } from '@/lib/types';

export interface GiftCardModalProps {
  visible: boolean;
  clientName: string;
  giftCards: GiftCard[];
  activeGiftCards: GiftCard[];
  giftCardTransactions: GiftCardTransaction[];
  totalGiftCardBalance: number;
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

export function GiftCardModal({
  visible,
  clientName,
  giftCards,
  activeGiftCards,
  giftCardTransactions,
  totalGiftCardBalance,
  language,
  colors,
  isDark,
  primaryColor,
  currency,
  dateLocale,
  onClose,
}: GiftCardModalProps) {
  const insets = useSafeAreaInsets();

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
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
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
              <CreditCard size={22} color={primaryColor} />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('giftCardCredit', language)}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {clientName || 'Client'}
              </Text>
            </View>
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
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
        >
          {/* Balance Summary Card */}
          {totalGiftCardBalance > 0 && (
            <View
              style={{
                backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                borderRadius: 20,
                padding: 24,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '600' }}>
                {t('totalBalance', language)}
              </Text>
              <Text style={{ color: primaryColor, fontSize: 40, fontWeight: 'bold', marginTop: 4 }}>
                {formatCurrency(totalGiftCardBalance, currency)}
              </Text>
              <Text style={{ color: primaryColor, fontSize: 16, opacity: 0.8 }}>{t('available', language).toLowerCase()}</Text>

              <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: `${primaryColor}30` }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: primaryColor, fontSize: 12, opacity: 0.7 }}>{t('valueCards', language)}</Text>
                  <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '600' }}>
                    {activeGiftCards.filter(gc => gc.type === 'value').length}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: primaryColor, fontSize: 12, opacity: 0.7 }}>{t('serviceCards', language)}</Text>
                  <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '600' }}>
                    {activeGiftCards.filter(gc => gc.type === 'service').length}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Gift Cards */}
          {giftCards.length > 0 && (() => {
            const activeCards = giftCards.filter(gc => gc.status === 'active');
            const inactiveCards = giftCards.filter(gc => gc.status !== 'active');

            // Capitalize first letter only (for "Remaining" / "Redeemed" labels)
            const capFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

            const renderCard = (giftCard: GiftCard) => {
              const usability = isGiftCardUsable(giftCard);
              const totalServices = giftCard.services?.reduce((sum, s) => sum + s.quantity, 0) || 0;
              const usedServices = giftCard.services?.reduce((sum, s) => sum + s.usedQuantity, 0) || 0;
              const isFullyUsed = giftCard.status === 'fully_used';
              const isExpired = giftCard.status === 'expired';
              const isInactive = !usability.usable;

              // Badge pill — shared style, no word wrap ever
              const badgePill = (bg: string, textColor: string, label: string) => (
                <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexShrink: 0, alignSelf: 'flex-start' }}>
                  <Text style={{ color: textColor, fontWeight: '700', fontSize: 11, letterSpacing: 0.3 }} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              );

              return (
                <View
                  key={giftCard.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 10,
                    borderWidth: 2,
                    borderColor: isInactive ? colors.border : `${primaryColor}30`,
                    opacity: isInactive ? 0.75 : 1,
                  }}
                >
                  {/* Top row: icon + text. Badge sits below text on its own line to prevent mid-word wrap */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: isInactive ? (isDark ? colors.backgroundTertiary : '#F1F5F9') : `${primaryColor}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {giftCard.type === 'value' ? (
                        <DollarSign size={22} color={isInactive ? colors.textTertiary : primaryColor} />
                      ) : (
                        <Gift size={22} color={isInactive ? colors.textTertiary : primaryColor} />
                      )}
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <Text style={{ color: isInactive ? colors.textSecondary : colors.text, fontWeight: '600', fontSize: 16, flexShrink: 1 }}>
                          {giftCard.type === 'value'
                            ? `${formatCurrency(giftCard.currentBalance || 0, currency)} ${capFirst(t('remaining', language))}`
                            : `${usedServices}/${totalServices} ${capFirst(t('redeemed', language))}`
                          }
                        </Text>
                        {isFullyUsed
                          ? badgePill(isDark ? '#1F2937' : '#F1F5F9', colors.textSecondary, t('fullyRedeemed', language).toUpperCase())
                          : isExpired
                          ? badgePill('#FEF2F2', '#EF4444', t('statusExpired', language))
                          : usability.usable
                          ? badgePill(`${primaryColor}20`, primaryColor, t('active', language))
                          : badgePill(colors.border, colors.textSecondary, usability.reason ?? '')
                        }
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: 'monospace', marginTop: 2 }}>
                        {giftCard.code}
                      </Text>
                    </View>
                  </View>

                  {/* Show services for service-type cards */}
                  {giftCard.type === 'service' && giftCard.services && giftCard.services.length > 0 && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                      {giftCard.services.map((service, index) => {
                        const remaining = service.quantity - service.usedQuantity;
                        return (
                          <View
                            key={index}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              marginBottom: index < giftCard.services!.length - 1 ? 8 : 0,
                            }}
                          >
                            <View
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: remaining > 0 ? `${primaryColor}20` : `${primaryColor}10`,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 8,
                              }}
                            >
                              {remaining > 0 ? (
                                <Check size={12} color={primaryColor} />
                              ) : (
                                <X size={12} color={colors.textTertiary} />
                              )}
                            </View>
                            <Text style={{ color: remaining > 0 ? colors.text : colors.textTertiary, flex: 1, fontSize: 14 }}>{service.serviceName}</Text>
                            <Text style={{ color: remaining > 0 ? colors.textSecondary : colors.textTertiary, fontSize: 13 }}>
                              {service.usedQuantity}/{service.quantity}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Expiration */}
                  {giftCard.expiresAt && (
                    <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                      <Clock size={12} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                        {t('expiresOn', language)} {format(new Date(giftCard.expiresAt), 'MMM d, yyyy', { locale: dateLocale })}
                      </Text>
                    </View>
                  )}

                  {/* Issued date */}
                  <View style={{ marginTop: giftCard.expiresAt ? 4 : 10, flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={12} color={colors.textTertiary} />
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                      {t('issuedOn', language)} {format(new Date(giftCard.issuedAt), 'MMM d, yyyy', { locale: dateLocale })}
                    </Text>
                  </View>
                </View>
              );
            };

            return (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                  {t('giftCards', language)}
                </Text>

                {/* Active Gift Cards */}
                {activeCards.length > 0 && (
                  <>
                    {inactiveCards.length > 0 && (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>
                        {t('activeGiftCards', language).toUpperCase()}
                      </Text>
                    )}
                    {activeCards.map(renderCard)}
                  </>
                )}

                {/* Divider + Inactive section */}
                {inactiveCards.length > 0 && (
                  <>
                    {activeCards.length > 0 && (
                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
                    )}
                    <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 }}>
                      {t('inactiveGiftCards', language).toUpperCase()}
                    </Text>
                    {inactiveCards.map(renderCard)}
                  </>
                )}
              </View>
            );
          })()}

          {/* Recent Activity — always shown when client has gift cards */}
          {(giftCards.length > 0 || giftCardTransactions.length > 0) && (
            <View>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                {t('recentActivity', language)}
              </Text>
              {giftCardTransactions.length === 0 ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No recent activity yet.</Text>
                </View>
              ) : (
                giftCardTransactions.slice(0, 20).map((transaction) => {
                  // Look up the gift card to get its code
                  const relatedGiftCard = giftCards.find(gc => gc.id === transaction.giftCardId);
                  const gcCode = relatedGiftCard?.code ?? null;
                  return (
                    <View
                      key={transaction.id}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: `${primaryColor}15`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {transaction.type === 'refund' || transaction.type === 'purchase' ? (
                          <Plus size={18} color={primaryColor} />
                        ) : transaction.serviceId ? (
                          <Gift size={18} color={primaryColor} />
                        ) : (
                          <Minus size={18} color={primaryColor} />
                        )}
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '500' }}>
                          {transaction.type === 'refund'
                            ? t('refund', language)
                            : transaction.type === 'purchase'
                            ? t('activityGiftCardIssued', language)
                            : transaction.type === 'redemption'
                            ? t('activityGiftCardUsed', language)
                            : transaction.serviceId
                            ? t('serviceRedeemed', language)
                            : t('amountRedeemed', language)}
                        </Text>
                        {gcCode && (
                          <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600', fontFamily: 'monospace', marginTop: 1 }}>
                            {gcCode}
                          </Text>
                        )}
                        {/* Service name line — shown for service-based gift card redemptions */}
                        {transaction.serviceName != null && (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                            {t('activityServiceUsed', language)}: {transaction.serviceName} x{transaction.quantityUsed ?? 1}
                          </Text>
                        )}
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
                          {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                        </Text>
                      </View>
                      {transaction.amount != null ? (
                        <Text
                          style={{
                            color: transaction.type === 'refund' || transaction.type === 'purchase' ? primaryColor : '#EF4444',
                            fontWeight: 'bold',
                            fontSize: 16,
                          }}
                        >
                          {transaction.type === 'refund' || transaction.type === 'purchase' ? '+' : '-'}{formatCurrency(transaction.amount, currency)}
                        </Text>
                      ) : transaction.serviceName != null ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>
                            -{transaction.quantityUsed ?? 1}
                          </Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 1 }}>
                            {(transaction.quantityUsed ?? 1) !== 1 ? t('activitySessions', language) : t('activitySession', language)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Empty State */}
          {activeGiftCards.length === 0 && giftCardTransactions.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <CreditCard size={40} color={colors.textTertiary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>
                {t('noGiftCards', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                {t('giftCardsWillAppearHere', language)}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
