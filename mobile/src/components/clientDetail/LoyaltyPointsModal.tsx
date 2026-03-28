import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import {
  Crown,
  X,
  Check,
  Gift,
  Star,
  DollarSign,
  TrendingUp,
  ChevronRight,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import type { ClientLoyalty, LoyaltyReward, LoyaltyTransaction } from '@/services/loyaltyService';

export interface LoyaltyPointsModalProps {
  visible: boolean;
  clientName: string;
  clientLoyaltyData: ClientLoyalty | null | undefined;
  loyaltyRewards: LoyaltyReward[];
  availableRewards: LoyaltyReward[];
  loyaltyTransactions: LoyaltyTransaction[];
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
  onClose: () => void;
  onToggleEnrollment: () => void;
  onRedeemReward: (reward: LoyaltyReward) => void;
}

export function LoyaltyPointsModal({
  visible,
  clientName,
  clientLoyaltyData,
  loyaltyRewards,
  availableRewards,
  loyaltyTransactions,
  language,
  colors,
  isDark,
  primaryColor,
  currency,
  onClose,
  onToggleEnrollment,
  onRedeemReward,
}: LoyaltyPointsModalProps) {
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
              <Crown size={22} color={primaryColor} />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('loyaltyProgramTitle', language)}</Text>
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
          {/* Points Balance Card */}
          <View
            style={{
              backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
              borderRadius: 20,
              padding: 24,
              marginBottom: 20,
            }}
          >
            <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '600' }}>
              {t('loyaltyCurrentBalance', language)}
            </Text>
            <Text style={{ color: primaryColor, fontSize: 40, fontWeight: 'bold', marginTop: 4 }}>
              {(clientLoyaltyData?.total_points ?? 0).toLocaleString()}
            </Text>
            <Text style={{ color: primaryColor, fontSize: 16 }}>{t('loyaltyPoints', language)}</Text>

            <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: `${primaryColor}40` }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: `${primaryColor}99`, fontSize: 12 }}>{t('loyaltyLifetimeEarned', language)}</Text>
                <Text style={{ color: primaryColor, fontSize: 18, fontWeight: '600' }}>
                  {(clientLoyaltyData?.lifetime_points ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: `${primaryColor}99`, fontSize: 12 }}>{t('loyaltyStatus', language)}</Text>
                <Text style={{ color: clientLoyaltyData?.is_enrolled === true ? primaryColor : '#EF4444', fontSize: 18, fontWeight: '600' }}>
                  {clientLoyaltyData?.is_enrolled === true ? t('loyaltyActive', language) : t('loyaltyNotEnrolled', language)}
                </Text>
              </View>
            </View>
          </View>

          {/* Toggle Enrollment */}
          <Pressable
            onPress={onToggleEnrollment}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: clientLoyaltyData?.is_enrolled === true ? `${primaryColor}15` : '#EF444415',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {clientLoyaltyData?.is_enrolled === true ? (
                <Check size={20} color={primaryColor} />
              ) : (
                <X size={20} color="#EF4444" />
              )}
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {clientLoyaltyData?.is_enrolled === true ? t('loyaltyEnrolledInLoyalty', language) : t('loyaltyNotEnrolled', language)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {clientLoyaltyData?.is_enrolled === true
                  ? t('loyaltyEarnsPointsOnPurchases', language)
                  : t('loyaltyTapToEnroll', language)}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          {/* Available Rewards */}
          {availableRewards.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                {t('loyaltyAvailableRewards', language)}
              </Text>
              {availableRewards.map((reward) => (
                <Pressable
                  key={reward.id}
                  onPress={() => onRedeemReward(reward)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: `${primaryColor}30`,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: `${primaryColor}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Gift size={22} color={primaryColor} />
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{reward.title}</Text>
                    <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '600' }}>
                      {reward.points_required.toLocaleString()} {t('loyaltyPoints', language)}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: primaryColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('loyaltyRedeemReward', language)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* All Rewards */}
          {loyaltyRewards.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                {t('loyaltyAllRewards', language)}
              </Text>
              {loyaltyRewards
                .filter((r) => r.is_active)
                .map((reward) => {
                  const canRedeem = (clientLoyaltyData?.total_points ?? 0) >= reward.points_required;
                  const progress = Math.min(100, ((clientLoyaltyData?.total_points ?? 0) / reward.points_required) * 100);

                  return (
                    <View
                      key={reward.id}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 14,
                        padding: 16,
                        marginBottom: 10,
                        opacity: canRedeem ? 1 : 0.7,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            backgroundColor: `${primaryColor}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {reward.credit_amount ? (
                            <DollarSign size={20} color={primaryColor} />
                          ) : (
                            <Star size={20} color={primaryColor} />
                          )}
                        </View>
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '600' }}>{reward.title}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                            {reward.points_required.toLocaleString()} {t('loyaltyPoints', language)}
                            {reward.credit_amount && ` • ${formatCurrency(reward.credit_amount, currency)} credit`}
                          </Text>
                        </View>
                        {canRedeem && (
                          <Check size={20} color={primaryColor} />
                        )}
                      </View>
                      {!canRedeem && (
                        <View style={{ marginTop: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('loyaltyProgress', language)}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                              {(reward.points_required - (clientLoyaltyData?.total_points ?? 0)).toLocaleString()} {t('loyaltyPtsToGo', language)}
                            </Text>
                          </View>
                          <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
                            <View
                              style={{
                                height: '100%',
                                width: `${progress}%`,
                                backgroundColor: primaryColor,
                                borderRadius: 2,
                              }}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
            </View>
          )}

          {/* Recent Transactions */}
          {loyaltyTransactions.length > 0 && (
            <View>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>
                {t('loyaltyRecentActivity', language)}
              </Text>
              {loyaltyTransactions.slice(0, 10).map((transaction) => (
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
                      backgroundColor: transaction.points > 0 ? `${primaryColor}15` : '#EF444415',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {transaction.points > 0 ? (
                      <TrendingUp size={18} color={primaryColor} />
                    ) : (
                      <Gift size={18} color="#EF4444" />
                    )}
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '500' }}>
                      {transaction.transaction_type === 'earned'
                        ? t('loyaltyPointsEarned', language)
                        : transaction.transaction_type === 'redeemed'
                        ? t('loyaltyRewardRedeemed', language)
                        : transaction.transaction_type === 'bonus'
                        ? t('loyaltyBonusPoints', language)
                        : transaction.transaction_type === 'adjustment'
                        ? t('loyaltyAdjustment', language)
                        : t('loyaltyPointsExpired', language)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: transaction.points > 0 ? primaryColor : '#EF4444',
                      fontWeight: 'bold',
                      fontSize: 16,
                    }}
                  >
                    {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {loyaltyRewards.length === 0 && loyaltyTransactions.length === 0 && (
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
                <Crown size={40} color={colors.textTertiary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center' }}>
                {t('loyaltyNoActivity', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                {t('loyaltyPointsAppearOnPurchases', language)}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
