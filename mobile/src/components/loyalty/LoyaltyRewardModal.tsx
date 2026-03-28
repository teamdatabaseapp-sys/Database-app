import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Star,
  Gift,
  Check,
  Trash2,
  DollarSign,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { LoyaltyReward } from '@/services/loyaltyService';

interface Service {
  id: string;
  name: string;
}

interface SaveMutation {
  isPending: boolean;
}

interface LoyaltyRewardModalProps {
  visible: boolean;
  onClose: () => void;
  editingReward: LoyaltyReward | null;
  // Reward form state
  rewardTitle: string;
  setRewardTitle: (v: string) => void;
  rewardDescription: string;
  setRewardDescription: (v: string) => void;
  rewardPoints: string;
  setRewardPoints: (v: string) => void;
  rewardCreditAmount: string;
  setRewardCreditAmount: (v: string) => void;
  rewardServiceId: string | null;
  setRewardServiceId: (v: string | null) => void;
  rewardNotification: string;
  setRewardNotification: (v: string) => void;
  rewardType: 'service' | 'credit' | 'other';
  setRewardType: (v: 'service' | 'credit' | 'other') => void;
  // Services list
  services: Service[];
  // Currency
  currencySymbol: string;
  // Localization
  language: Language;
  // Handlers
  handleSaveReward: () => void;
  handleDeleteReward: (reward: LoyaltyReward) => void;
  handleToggleRewardActive: (reward: LoyaltyReward) => void;
  // Mutation pending states
  createRewardMutation: SaveMutation;
  updateRewardMutation: SaveMutation;
}

export function LoyaltyRewardModal({
  visible,
  onClose,
  editingReward,
  rewardTitle,
  setRewardTitle,
  rewardDescription,
  setRewardDescription,
  rewardPoints,
  setRewardPoints,
  rewardCreditAmount,
  setRewardCreditAmount,
  rewardServiceId,
  setRewardServiceId,
  rewardNotification,
  setRewardNotification,
  rewardType,
  setRewardType,
  services,
  currencySymbol,
  language,
  handleSaveReward,
  handleDeleteReward,
  handleToggleRewardActive,
  createRewardMutation,
  updateRewardMutation,
}: LoyaltyRewardModalProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Modal Header */}
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
          {/* Left — icon + title */}
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
              <Gift size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
              {editingReward ? t('loyaltyEditReward', language) : t('loyaltyCreateReward', language)}
            </Text>
          </View>

          {/* Right — close X */}
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

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
          {/* Title */}
          <View className="mb-4">
            <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
              {t('loyaltyRewardTitle', language)} *
            </Text>
            <TextInput
              value={rewardTitle}
              onChangeText={setRewardTitle}
              placeholder={t('loyaltyRewardTitlePlaceholder', language)}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
              }}
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>

          {/* Points Required */}
          <View className="mb-4">
            <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
              {t('loyaltyPointsRequired', language)} *
            </Text>
            <TextInput
              value={rewardPoints}
              onChangeText={setRewardPoints}
              placeholder={t('loyaltyPointsRequiredPlaceholder', language)}
              keyboardType="number-pad"
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
              }}
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>

          {/* Reward Type */}
          <View className="mb-4">
            <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
              {t('loyaltyRewards', language)}
            </Text>
            <View className="flex-row" style={{ marginHorizontal: -4 }}>
              {(['other', 'credit', 'service'] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRewardType(type);
                  }}
                  style={{
                    flex: 1,
                    marginHorizontal: 4,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    alignItems: 'center',
                    backgroundColor:
                      rewardType === type ? (isDark ? `${primaryColor}30` : `${primaryColor}10`) : colors.inputBackground,
                    borderColor: rewardType === type ? primaryColor : colors.inputBorder,
                  }}
                >
                  {type === 'other' && <Gift size={20} color={rewardType === type ? primaryColor : colors.textSecondary} />}
                  {type === 'credit' && <DollarSign size={20} color={rewardType === type ? primaryColor : colors.textSecondary} />}
                  {type === 'service' && <Star size={20} color={rewardType === type ? primaryColor : colors.textSecondary} />}
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: '500',
                      color: rewardType === type ? primaryColor : colors.textSecondary,
                    }}
                  >
                    {type === 'other' ? t('custom', language) : type === 'credit' ? t('loyaltyCreditAmount', language).split(' ')[0] : t('service', language)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Credit Amount (if credit type) */}
          {rewardType === 'credit' && (
            <View className="mb-4">
              <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
                {t('loyaltyCreditAmount', language)}
              </Text>
              <View className="flex-row items-center">
                <Text style={{ color: colors.textSecondary, marginRight: 8, fontSize: 18 }}>
                  {currencySymbol}
                </Text>
                <TextInput
                  value={rewardCreditAmount}
                  onChangeText={setRewardCreditAmount}
                  placeholder="25"
                  keyboardType="decimal-pad"
                  style={{
                    flex: 1,
                    backgroundColor: colors.inputBackground,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: colors.inputText,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                  }}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>
            </View>
          )}

          {/* Linked Service (if service type) */}
          {rewardType === 'service' && services.length > 0 && (
            <View className="mb-4">
              <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
                {t('loyaltyLinkedService', language)}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {services.map((service) => (
                  <Pressable
                    key={service.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRewardServiceId(rewardServiceId === service.id ? null : service.id);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      marginRight: 8,
                      backgroundColor:
                        rewardServiceId === service.id ? primaryColor : colors.inputBackground,
                      borderWidth: 1,
                      borderColor:
                        rewardServiceId === service.id ? primaryColor : colors.inputBorder,
                    }}
                  >
                    <Text
                      style={{
                        color: rewardServiceId === service.id ? '#fff' : colors.text,
                        fontWeight: '500',
                      }}
                    >
                      {service.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Description */}
          <View className="mb-4">
            <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
              {t('loyaltyRewardDescription', language)}
            </Text>
            <TextInput
              value={rewardDescription}
              onChangeText={setRewardDescription}
              placeholder={t('loyaltyRewardDescriptionPlaceholder', language)}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>

          {/* Notification Message */}
          <View className="mb-4">
            <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>
              {t('loyaltyUnlockMessage', language)}
            </Text>
            <TextInput
              value={rewardNotification}
              onChangeText={setRewardNotification}
              placeholder={t('loyaltyUnlockMessagePlaceholder', language)}
              multiline
              numberOfLines={2}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>

          {/* Edit Mode Actions */}
          {editingReward && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 16,
                marginTop: 16,
              }}
            >
              {/* Save button — above Inactive, inside scrollable content */}
              <Pressable
                onPress={handleSaveReward}
                disabled={
                  !rewardTitle.trim() ||
                  !rewardPoints.trim() ||
                  updateRewardMutation.isPending
                }
                style={{
                  backgroundColor:
                    rewardTitle.trim() && rewardPoints.trim() && !updateRewardMutation.isPending
                      ? buttonColor
                      : isDark ? colors.backgroundTertiary : '#E2E8F0',
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color:
                      rewardTitle.trim() && rewardPoints.trim() && !updateRewardMutation.isPending
                        ? '#fff'
                        : colors.textTertiary,
                    fontWeight: '600',
                    fontSize: 16,
                  }}
                >
                  {updateRewardMutation.isPending ? t('saving', language) : t('save', language)}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleToggleRewardActive(editingReward)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {editingReward.is_active ? (
                  <>
                    <X size={20} color="#F97316" />
                    <Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 12 }}>
                      {t('inactive', language)}
                    </Text>
                  </>
                ) : (
                  <>
                    <Check size={20} color="#22C55E" />
                    <Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 12 }}>
                      {t('activate', language)}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  handleDeleteReward(editingReward);
                  onClose();
                }}
                style={{
                  backgroundColor: isDark ? '#7F1D1D30' : '#FEF2F2',
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Trash2 size={20} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontWeight: '500', marginLeft: 12 }}>
                  {t('loyaltyDeleteReward', language)}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Bottom Save Button */}
        {!editingReward && (
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 16,
              backgroundColor: colors.card,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={handleSaveReward}
              disabled={
                !rewardTitle.trim() ||
                !rewardPoints.trim() ||
                createRewardMutation.isPending
              }
              style={{
                backgroundColor:
                  rewardTitle.trim() && rewardPoints.trim() && !createRewardMutation.isPending
                    ? buttonColor
                    : isDark ? colors.backgroundTertiary : '#E2E8F0',
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color:
                    rewardTitle.trim() && rewardPoints.trim() && !createRewardMutation.isPending
                      ? '#fff'
                      : colors.textTertiary,
                  fontWeight: '600',
                  fontSize: 16,
                }}
              >
                {createRewardMutation.isPending ? t('saving', language) : t('save', language)}
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
