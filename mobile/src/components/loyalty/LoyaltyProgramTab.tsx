import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Check,
  Target,
  Sparkles,
  Settings2,
  Layers,
  Star,
  Plus,
  RotateCcw,
  Pencil,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatCurrency } from '@/lib/currency';
import { LoyaltyReward } from '@/services/loyaltyService';
import { LoyaltyRewardCard } from './LoyaltyRewardCard';

interface LoyaltySettings {
  is_enabled: boolean;
  points_per_dollar: number;
}

interface UpdateSettingsMutation {
  isPending: boolean;
  mutateAsync: (data: { is_enabled: boolean; points_per_dollar: number }) => Promise<unknown>;
}

interface LoyaltyProgramTabProps {
  // Settings form state
  isEnabled: boolean;
  setIsEnabled: (v: boolean) => void;
  isDirty: boolean;
  setIsDirty: (v: boolean) => void;
  pointsPerDollar: string;
  setPointsPerDollar: (v: string) => void;
  settings: LoyaltySettings | null | undefined;
  updateSettingsMutation: UpdateSettingsMutation;
  // Edit points modal triggers
  setShowEditPointsModal: (v: boolean) => void;
  setEditPointsValue: (v: string) => void;
  // Save handler (for sticky save bar)
  handleSaveSettings: () => Promise<void>;
  // Rewards
  sortedRewards: LoyaltyReward[];
  openCreateReward: () => void;
  openEditReward: (reward: LoyaltyReward) => void;
  // Shared
  currency: string;
  currencySymbol: string;
  language: Language;
}

export function LoyaltyProgramTab({
  isEnabled,
  setIsEnabled,
  isDirty,
  setIsDirty,
  pointsPerDollar,
  setPointsPerDollar,
  settings,
  updateSettingsMutation,
  setShowEditPointsModal,
  setEditPointsValue,
  handleSaveSettings,
  sortedRewards,
  openCreateReward,
  openEditReward,
  currency,
  currencySymbol,
  language,
}: LoyaltyProgramTabProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();

  const renderSettingsTab = () => (
    <Animated.View entering={FadeInDown.delay(0).duration(300)}>
      {/* Section header — outside the card, matches Membership Global Settings style */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Settings2 size={14} color={primaryColor} style={{ marginRight: 8 }} />
        <Text style={{ color: colors.textTertiary, fontWeight: '700', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Program Settings
        </Text>
      </View>

      {/* Unified settings card */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isEnabled ? `${primaryColor}30` : colors.border }}>
        {/* Row 1 — Enable toggle */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsEnabled(!isEnabled);
            setIsDirty(true);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
              {t('loyaltyEnableProgram', language)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 3, lineHeight: 18 }}>
              {t('loyaltyEnableProgramDescription', language)}
            </Text>
          </View>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: isEnabled ? primaryColor : colors.border,
              backgroundColor: isEnabled ? primaryColor : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isEnabled && <Check size={14} color="#fff" />}
          </View>
        </Pressable>

        {/* Row 2 — Points per dollar */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Target size={18} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                {t('loyaltyPointsPerDollar', language)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                {t('loyaltyPointsPerDollarDescription', language).replace('$1', `${currencySymbol}1`)}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              value={pointsPerDollar}
              onChangeText={(v) => { setPointsPerDollar(v); setIsDirty(true); }}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: isDirty ? primaryColor : colors.inputBorder,
                fontSize: 17,
                fontWeight: '600',
              }}
              placeholderTextColor={colors.inputPlaceholder}
            />
              <Text style={{ color: colors.textSecondary, marginLeft: 12, fontSize: 14 }}>
              {t('loyaltyPointsAbbr', language)} / {currencySymbol}1
            </Text>
          </View>

          {/* Saved value indicator with Edit / Reset controls */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
            {/* Saved badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Check size={11} color={primaryColor} style={{ marginRight: 4 }} />
              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '700' }}>
                {t('loyaltySaved', language)}: {(settings?.points_per_dollar ?? 1).toString()} {t('loyaltyPointsAbbr', language)} / {currencySymbol}1
              </Text>
            </View>

            {/* Edit button */}
            <Pressable
              onPress={() => {
                setEditPointsValue((settings?.points_per_dollar ?? 1).toString());
                setShowEditPointsModal(true);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 5,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Pencil size={10} color={colors.textSecondary} />
            </Pressable>

            {/* Reset button — only when value differs from default (1) */}
            {(settings?.points_per_dollar ?? 1) !== 1 && (
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPointsPerDollar('1');
                  setIsDirty(false);
                  try {
                    await updateSettingsMutation.mutateAsync({
                      is_enabled: isEnabled,
                      points_per_dollar: 1,
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch {
                    setPointsPerDollar((settings?.points_per_dollar ?? 1).toString());
                  }
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 8,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <RotateCcw size={10} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('loyaltyReset', language)}</Text>
              </Pressable>
            )}
          </View>

          <View
            style={{
              marginTop: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}08`,
            }}
          >
            <Sparkles size={13} color={primaryColor} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 7, flex: 1 }}>
              {formatCurrency(100, currency)} = {Math.floor(100 * (parseFloat(pointsPerDollar) || 1)).toLocaleString()} {t('loyaltyPoints', language).toLowerCase()}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderRewardsTab = () => (
    <View>
      {/* Header row — title left, button right */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
              flexShrink: 0,
            }}
          >
            <Layers size={20} color={primaryColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
              {t('loyaltyRewards', language)}
            </Text>
            {sortedRewards.length > 0 && (
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {sortedRewards.length} {t('loyaltyRewards', language).toLowerCase()}
              </Text>
            )}
          </View>
        </View>
        <Pressable
          onPress={openCreateReward}
          style={{
            flexShrink: 0,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: primaryColor,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 12,
            marginLeft: 12,
          }}
        >
          <Plus size={15} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 5 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
            {t('loyaltyCreateReward', language)}
          </Text>
        </Pressable>
      </View>

      {/* Reward list */}
      {sortedRewards.length > 0 ? (
        <View>
          {sortedRewards.map((reward, index) => (
            <LoyaltyRewardCard
              key={reward.id}
              reward={reward}
              index={index}
              language={language}
              currency={currency}
              onPress={openEditReward}
            />
          ))}
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: isDark ? `${primaryColor}30` : `${primaryColor}20`,
            }}
          >
            <Star size={32} color={primaryColor} />
          </View>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17, marginBottom: 8, textAlign: 'center' }}>
            No Reward Tiers Yet
          </Text>
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 14,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            Create tiers to reward your best customers and increase retention
          </Text>
          <Pressable
            onPress={openCreateReward}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: primaryColor,
              paddingHorizontal: 20,
              paddingVertical: 13,
              borderRadius: 14,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Plus size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 7 }}>
              Create First Tier
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
        {/* SECTION 1 — Program Settings */}
        {renderSettingsTab()}

        {/* SECTION 2 — Reward Tiers */}
        <View style={{ marginTop: 28 }}>
          {/* Subtle section divider */}
          <View style={{ height: 1, backgroundColor: isDark ? `${colors.border}80` : `${colors.border}60`, marginBottom: 24 }} />
          {renderRewardsTab()}
        </View>
      </ScrollView>

      {/* Sticky Save Bar — visible only when settings have been changed */}
      {isDirty && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 16,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 10 }}>
            {t('unsavedChanges', language)}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Pressable
              onPress={() => {
                if (settings) {
                  setIsEnabled(settings.is_enabled);
                  setPointsPerDollar(settings.points_per_dollar.toString());
                }
                setIsDirty(false);
              }}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 20,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                {t('cancel', language)}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 24,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: buttonColor,
                opacity: updateSettingsMutation.isPending ? 0.6 : 1,
              }}
            >
              {updateSettingsMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  {t('saveChanges', language)}
                </Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
