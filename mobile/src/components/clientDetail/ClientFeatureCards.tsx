import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Users as UsersIcon,
  CreditCard,
  Tag,
  Zap,
  Sparkles,
  Crown,
  Gift,
  ChevronRight,
  Check,
} from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language, ClientMembership, DripCampaign, CurrencyCode } from '@/lib/types';
import { LoyaltySettings, LoyaltyReward, ClientLoyalty } from '@/services/loyaltyService';
import { formatCurrency } from '@/lib/currency';

export interface ClientFeatureCardsProps {
  // Membership
  clientMembership: ClientMembership | undefined | null;
  // Gift Card
  totalGiftCardBalance: number;
  currency: CurrencyCode;
  // Marketing Promo (non-counter assigned promos for the summary card)
  assignedPromoNames: string[];
  // Drip Campaign
  assignedCampaign: DripCampaign | undefined;
  // Loyalty
  loyaltySettings: LoyaltySettings | undefined | null;
  clientLoyaltyData: ClientLoyalty | undefined | null;
  availableRewards: LoyaltyReward[];
  loyaltyRewards: LoyaltyReward[];
  // Theme
  language: Language;
  colors: {
    card: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    [key: string]: string;
  };
  isDark: boolean;
  primaryColor: string;
  // Callbacks
  onOpenMembership: () => void;
  onOpenGiftCard: () => void;
  onOpenPromo: () => void;
  onOpenCampaign: () => void;
  onOpenLoyaltyEnroll: () => void;
  onOpenLoyalty: () => void;
  onSetLoyaltyConfirmPending: (value: boolean) => void;
}

export function ClientFeatureCards({
  clientMembership,
  totalGiftCardBalance,
  currency,
  assignedPromoNames,
  assignedCampaign,
  loyaltySettings,
  clientLoyaltyData,
  availableRewards,
  loyaltyRewards,
  language,
  colors,
  isDark,
  primaryColor,
  onOpenMembership,
  onOpenGiftCard,
  onOpenPromo,
  onOpenCampaign,
  onOpenLoyaltyEnroll,
  onOpenLoyalty,
  onSetLoyaltyConfirmPending,
}: ClientFeatureCardsProps) {
  return (
    <>
      {/* Membership Summary */}
      <View className="mx-4 mt-4">
        <Pressable
          onPress={onOpenMembership}
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UsersIcon size={20} color={primaryColor} />
          </View>
          <View className="flex-1 ml-3">
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('membership', language)}</Text>
            <View style={{ marginTop: 4 }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: `${primaryColor}18`,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>
                  {clientMembership && clientMembership.status === 'active'
                    ? t('active', language)
                    : t('membershipInactive', language)}
                </Text>
              </View>
            </View>
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Gift Card Credit */}
      <View className="mx-4 mt-4">
        <Pressable
          onPress={onOpenGiftCard}
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CreditCard size={20} color={primaryColor} />
          </View>
          <View className="flex-1 ml-3">
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('giftCardCredit', language)}</Text>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginTop: 2 }}>
              {formatCurrency(totalGiftCardBalance, currency)}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Marketing Promo (unified — assignments + punch cards) */}
      <View className="mx-4 mt-4">
        <Pressable
          onPress={onOpenPromo}
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Tag size={20} color={primaryColor} />
          </View>
          <View className="flex-1 ml-3">
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('marketingPromo', language)}</Text>
            {assignedPromoNames.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                {assignedPromoNames.map((name, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: idx > 0 ? 5 : 0 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: primaryColor, marginRight: 6, flexShrink: 0 }} />
                    <Text style={{ color: colors.text, fontWeight: '500', flex: 1 }} numberOfLines={1}>{name}</Text>
                  </View>
                ))}
                <View style={{ backgroundColor: `${primaryColor}18`, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 }}>
                  <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>
                    {assignedPromoNames.length === 1 ? t('active', language) : `${assignedPromoNames.length} ${t('active', language).toLowerCase()}`}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{t('noPromotion', language)}</Text>
            )}
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Drip Campaign */}
      <View className="mx-4 mt-4">
        <Pressable
          onPress={onOpenCampaign}
          style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={20} color={assignedCampaign?.color || primaryColor} />
          </View>
          <View className="flex-1 ml-3">
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('dripCampaigns', language)}</Text>
            {assignedCampaign ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <View
                  style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: assignedCampaign.color, marginRight: 6 }}
                />
                <Text style={{ color: colors.text, fontWeight: '500' }}>{assignedCampaign.name}</Text>
                {assignedCampaign.isActive && (
                  <View className="bg-emerald-100 px-1.5 py-0.5 rounded ml-2">
                    <Text className="text-emerald-600 text-xs font-medium">{t('active', language)}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{t('noCampaignAssigned', language)}</Text>
            )}
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Loyalty Points (Points-based rewards program) */}
      {loyaltySettings?.is_enabled && (
        <>
          {/* Activate Loyalty Program toggle */}
          <View className="mx-4 mt-4">
            <Pressable
              onPress={() => {
                const newValue = clientLoyaltyData?.is_enrolled !== true ? true : false;
                onSetLoyaltyConfirmPending(newValue);
                onOpenLoyaltyEnroll();
              }}
              style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={20} color={primaryColor} />
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('loyaltyActivateProgram', language)}</Text>
                <Text style={{ color: colors.text, fontWeight: '500', marginTop: 2 }}>
                  {clientLoyaltyData?.is_enrolled === true ? t('loyaltyActive', language) : t('loyaltyNotEnrolled', language)}
                </Text>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: clientLoyaltyData?.is_enrolled === true ? primaryColor : 'transparent',
                  borderWidth: 2,
                  borderColor: clientLoyaltyData?.is_enrolled === true ? primaryColor : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {clientLoyaltyData?.is_enrolled === true && <Check size={14} color="#FFFFFF" />}
              </View>
            </Pressable>
          </View>

          {/* Loyalty Program — points balance card */}
          <View className="mx-4 mt-4">
            <Pressable
              onPress={onOpenLoyalty}
              style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Crown size={20} color={primaryColor} />
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>
                  {t('loyaltyProgramTitle', language)}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Text style={{ color: colors.text, fontWeight: '500' }}>
                    {(clientLoyaltyData?.total_points ?? 0).toLocaleString()} {t('loyaltyPoints', language)}
                  </Text>
                  {clientLoyaltyData?.is_enrolled !== true && (
                    <View style={{ backgroundColor: '#EF444415', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 }}>
                      <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600' }}>{t('loyaltyNotEnrolled', language).toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                {availableRewards.length > 0 && (
                  <View className="flex-row items-center mt-1">
                    <Gift size={12} color={primaryColor} />
                    <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                      {availableRewards.length} {availableRewards.length !== 1 ? t('loyaltyAvailableRewards', language) : t('loyaltyRewardAvailable', language)}
                    </Text>
                  </View>
                )}
                {loyaltyRewards.length > 0 && clientLoyaltyData && (() => {
                  const nextReward = loyaltyRewards
                    .filter(r => r.is_active && r.points_required > (clientLoyaltyData?.total_points ?? 0))
                    .sort((a, b) => a.points_required - b.points_required)[0];
                  if (!nextReward) return null;
                  const progress = Math.min(100, ((clientLoyaltyData?.total_points ?? 0) / nextReward.points_required) * 100);
                  return (
                    <View style={{ marginTop: 8 }}>
                      <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${progress}%`, backgroundColor: primaryColor, borderRadius: 2 }} />
                      </View>
                    </View>
                  );
                })()}
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        </>
      )}
    </>
  );
}
