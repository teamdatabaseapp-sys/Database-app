import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Star,
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { LocalSuccessToast } from '@/components/LocalSuccessToast';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/currency';
import {
  useLoyaltySettings,
  useUpdateLoyaltySettings,
  useLoyaltyRewards,
  useCreateLoyaltyReward,
  useUpdateLoyaltyReward,
  useDeleteLoyaltyReward,
  useLoyaltyAnalytics,
  useAllClientLoyalty,
  useBusinessAllRedemptions,
} from '@/hooks/useLoyalty';
import { useServices } from '@/hooks/useServices';
import { LoyaltyReward } from '@/services/loyaltyService';
import { useClients } from '@/hooks/useClients';
import { DripCampaignScreen } from './DripCampaignScreen';
import { MarketingPromoScreen } from './MarketingPromoScreen';
import { LoyaltyAssignView } from './loyalty/LoyaltyAssignView';
import { LoyaltyAnalyticsView } from './loyalty/LoyaltyAnalyticsView';
import { LoyaltyProgramTab } from './loyalty/LoyaltyProgramTab';
import { LoyaltyRewardModal } from './loyalty/LoyaltyRewardModal';
import { SetupHint } from '@/components/SetupHint';
import { HighlightWrapper } from '@/components/HighlightWrapper';

interface LoyaltyProgramScreenProps {
  visible: boolean;
  onClose: () => void;
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
  onOpenMarketing?: (prefill?: {
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string;
    contextLabel?: string;
  }) => void;
  setupHint?: string;
}


export function LoyaltyProgramScreen({ visible, onClose, onOpenSmartDrip, onOpenMarketing, setupHint }: LoyaltyProgramScreenProps) {
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const currencySymbol = getCurrencySymbol(currency);

  // Data fetching
  const { data: settings, isLoading: settingsLoading } = useLoyaltySettings();
  const { data: rewards = [], isLoading: rewardsLoading } = useLoyaltyRewards();
  const { data: analytics } = useLoyaltyAnalytics();
  const { data: allClientLoyalty = [] } = useAllClientLoyalty();
  const { data: services = [] } = useServices();
  const { data: allClientsData = [] } = useClients();
  const { data: businessRedemptions = [] } = useBusinessAllRedemptions();

  // Mutations
  const updateSettingsMutation = useUpdateLoyaltySettings();
  const createRewardMutation = useCreateLoyaltyReward();
  const updateRewardMutation = useUpdateLoyaltyReward();
  const deleteRewardMutation = useDeleteLoyaltyReward();

  // UI State
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [activeTab, setActiveTab] = useTabPersistence<'program' | 'analytics' | 'assign'>('loyalty_program', 'assign');
  const [showActiveMembersDetail, setShowActiveMembersDetail] = useState(false);
  const [showRewardsRedeemedDetail, setShowRewardsRedeemedDetail] = useState(false);
  const [internalDripVisible, setInternalDripVisible] = useState(false);
  const [internalMarketingVisible, setInternalMarketingVisible] = useState(false);
  const [internalDripPrefill, setInternalDripPrefill] = useState<{
    name?: string; frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string; emailBody?: string; contextLabel?: string;
  } | undefined>(undefined);
  const [internalMarketingPrefill, setInternalMarketingPrefill] = useState<{
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string; contextLabel?: string;
  } | undefined>(undefined);

  // Settings form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [pointsPerDollar, setPointsPerDollar] = useState('1');
  const [isDirty, setIsDirty] = useState(false);
  const [showEditPointsModal, setShowEditPointsModal] = useState(false);
  const [editPointsValue, setEditPointsValue] = useState('1');

  // Reward form state
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardCreditAmount, setRewardCreditAmount] = useState('');
  const [rewardServiceId, setRewardServiceId] = useState<string | null>(null);
  const [rewardNotification, setRewardNotification] = useState('');
  const [rewardType, setRewardType] = useState<'service' | 'credit' | 'other'>('other');

  // Load settings when data arrives
  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.is_enabled);
      setPointsPerDollar(settings.points_per_dollar.toString());
      setIsDirty(false);
    }
  }, [settings]);

  // Highlight / auto-scroll for setupHint
  const scrollRef = useRef<ScrollView>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightY, setHighlightY] = useState(0);

  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] LoyaltyProgramScreen hint:', setupHint);
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(0, highlightY - 80), animated: true });
        }
      } catch (e) {
        console.warn('[SetupHint] scroll failed safely', e);
      }
      setHighlightActive(true);
      fadeTimer = setTimeout(() => {
        if (mounted) setHighlightActive(false);
      }, 2500);
    }, 450);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (fadeTimer !== null) clearTimeout(fadeTimer);
    };
  }, [setupHint, highlightY, visible]);

  // Sort rewards by points required
  const sortedRewards = useMemo(() => {
    return [...rewards].sort((a, b) => a.points_required - b.points_required);
  }, [rewards]);

  // Active loyalty members count
  const activeMembersCount = useMemo(() => {
    return allClientLoyalty.filter(c => c.is_enrolled).length;
  }, [allClientLoyalty]);

  const clientIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allClientsData) {
      if (c.name) map.set(c.id, c.name);
    }
    return map;
  }, [allClientsData]);

  // Active members with their names and point balances for detail view
  const activeMembersList = useMemo(() => {
    return allClientLoyalty
      .filter(c => c.is_enrolled)
      .map(c => ({
        client_id: c.client_id,
        name: clientIdToName.get(c.client_id) ?? `#${c.client_id.slice(0, 8)}`,
        total_points: c.total_points,
      }))
      .sort((a, b) => b.total_points - a.total_points);
  }, [allClientLoyalty, clientIdToName]);

  // Redeemed rewards enriched with client names and reward titles for detail view
  const rewardsRedeemedList = useMemo(() => {
    const rewardIdToTitle = new Map<string, string>();
    for (const r of rewards) {
      rewardIdToTitle.set(r.id, r.title);
    }
    return businessRedemptions.map(rd => ({
      id: rd.id,
      client_id: rd.client_id,
      reward_id: rd.reward_id,
      points_used: rd.points_used,
      redeemed_at: rd.redeemed_at,
      status: rd.status,
      clientName: clientIdToName.get(rd.client_id) ?? null,
      rewardTitle: rewardIdToTitle.get(rd.reward_id) ?? null,
    }));
  }, [businessRedemptions, clientIdToName, rewards]);

  const resetRewardForm = () => {
    setRewardTitle('');
    setRewardDescription('');
    setRewardPoints('');
    setRewardCreditAmount('');
    setRewardServiceId(null);
    setRewardNotification('');
    setRewardType('other');
    setEditingReward(null);
  };

  const openCreateReward = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetRewardForm();
    setShowRewardModal(true);
  };

  const openEditReward = (reward: LoyaltyReward) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingReward(reward);
    setRewardTitle(reward.title);
    setRewardDescription(reward.description || '');
    setRewardPoints(reward.points_required.toString());
    setRewardCreditAmount(reward.credit_amount?.toString() || '');
    setRewardServiceId(reward.linked_service_id);
    setRewardNotification(reward.notification_message || '');

    if (reward.linked_service_id) {
      setRewardType('service');
    } else if (reward.credit_amount) {
      setRewardType('credit');
    } else {
      setRewardType('other');
    }

    setShowRewardModal(true);
  };

  const handleSaveSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateSettingsMutation.mutateAsync({
        is_enabled: isEnabled,
        points_per_dollar: parseFloat(pointsPerDollar) || 1,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsDirty(false);
      setSuccessMessage(t('settingsSaved', language));
      setShowSuccessToast(true);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('error', language), t('failedToSaveService', language).replace('service', 'settings'));
    }
  };

  const handleSaveReward = async () => {
    if (!rewardTitle.trim()) {
      Alert.alert(t('error', language), t('loyaltyRewardTitle', language));
      return;
    }

    if (!rewardPoints || parseInt(rewardPoints) <= 0) {
      Alert.alert(t('error', language), t('loyaltyPointsRequired', language));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const rewardData = {
      title: rewardTitle.trim(),
      description: rewardDescription.trim() || null,
      points_required: parseInt(rewardPoints),
      linked_service_id: rewardType === 'service' ? rewardServiceId : null,
      credit_amount: rewardType === 'credit' ? parseFloat(rewardCreditAmount) || null : null,
      notification_message: rewardNotification.trim() || null,
      is_active: editingReward?.is_active ?? true,
      sort_order: editingReward?.sort_order ?? rewards.length,
    };

    try {
      if (editingReward) {
        await updateRewardMutation.mutateAsync({
          rewardId: editingReward.id,
          updates: rewardData,
        });
        setSuccessMessage(t('success', language));
      } else {
        await createRewardMutation.mutateAsync(rewardData);
        setSuccessMessage(t('loyaltyCreateReward', language));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRewardModal(false);
      resetRewardForm();
      setShowSuccessToast(true);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('error', language), t('failedToSaveService', language));
    }
  };

  const handleDeleteReward = (reward: LoyaltyReward) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('loyaltyDeleteReward', language),
      `${t('deleteConfirmation', language)} "${reward.title}"?`,
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRewardMutation.mutateAsync(reward.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setSuccessMessage(t('success', language));
              setShowSuccessToast(true);
            } catch (err) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t('error', language), t('failedToDeleteService', language));
            }
          },
        },
      ]
    );
  };

  const handleToggleRewardActive = async (reward: LoyaltyReward) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateRewardMutation.mutateAsync({
        rewardId: reward.id,
        updates: { is_active: !reward.is_active },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('error', language), t('failedToSaveService', language));
    }
  };

  const isLoading = settingsLoading || rewardsLoading;


  return (
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                flexShrink: 0,
              }}
            >
              <Star size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, flexShrink: 1, minWidth: 0 }}>{t('loyaltyProgramTitle', language)}</Text>
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
        </Animated.View>

        {/* Tabs — pill-style two-line tab bar */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 14,
              padding: 4,
            }}
          >
            {([
              {
                key: 'assign' as const,
                line1: t('loyaltyTabAssignLine1', language),
                line2: t('loyaltyTabAssignLine2', language),
              },
              {
                key: 'program' as const,
                line1: t('loyaltyTabProgramLine1', language),
                line2: t('loyaltyTabProgramLine2', language),
              },
              {
                key: 'analytics' as const,
                line1: t('loyaltyTabAnalyticsLine1', language),
                line2: t('loyaltyTabAnalyticsLine2', language),
              },
            ]).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveTab(tab.key);
                    setShowActiveMembersDetail(false);
                    setShowRewardsRedeemedDetail(false);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive ? (isDark ? colors.card : '#fff') : 'transparent',
                    shadowColor: isActive ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isActive ? 0.08 : 0,
                    shadowRadius: isActive ? 4 : 0,
                    elevation: isActive ? 2 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '500',
                      color: isActive ? primaryColor : colors.textSecondary,
                      textAlign: 'center',
                      lineHeight: 15,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {tab.line1}
                  </Text>
                  {tab.line2 ? (
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '500',
                        color: isActive ? primaryColor : colors.textSecondary,
                        textAlign: 'center',
                        lineHeight: 15,
                      }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {tab.line2}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <SetupHint hintKey={setupHint} />
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : activeTab === 'assign' ? (
          <LoyaltyAssignView />
        ) : activeTab === 'program' ? (
          <HighlightWrapper
            active={highlightActive}
            borderRadius={12}
            onLayout={(e) => setHighlightY(e.nativeEvent.layout.y)}
            style={{ flex: 1 }}
          >
            <LoyaltyProgramTab
            isEnabled={isEnabled}
            setIsEnabled={setIsEnabled}
            isDirty={isDirty}
            setIsDirty={setIsDirty}
            pointsPerDollar={pointsPerDollar}
            setPointsPerDollar={setPointsPerDollar}
            settings={settings}
            updateSettingsMutation={updateSettingsMutation}
            setShowEditPointsModal={setShowEditPointsModal}
            setEditPointsValue={setEditPointsValue}
            handleSaveSettings={handleSaveSettings}
            sortedRewards={sortedRewards}
            openCreateReward={openCreateReward}
            openEditReward={openEditReward}
            currency={currency}
            currencySymbol={currencySymbol}
            language={language}
          />
          </HighlightWrapper>
        ) : (
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <LoyaltyAnalyticsView
              analytics={analytics}
              activeMembersCount={activeMembersCount}
              activeMembersList={activeMembersList}
              rewardsRedeemedList={rewardsRedeemedList}
              showActiveMembersDetail={showActiveMembersDetail}
              showRewardsRedeemedDetail={showRewardsRedeemedDetail}
              onShowActiveMembersDetail={() => setShowActiveMembersDetail(true)}
              onHideActiveMembersDetail={() => setShowActiveMembersDetail(false)}
              onShowRewardsRedeemedDetail={() => setShowRewardsRedeemedDetail(true)}
              onHideRewardsRedeemedDetail={() => setShowRewardsRedeemedDetail(false)}
              language={language}
              onOpenSmartDrip={onOpenSmartDrip ? () => {
                const prefill = {
                  name: t('smartTripLoyaltyGrowthName', language),
                  frequency: 'monthly' as const,
                  contextLabel: t('smartRecommendationLoyaltyBoost', language),
                };
                setInternalDripPrefill(prefill);
                setInternalDripVisible(true);
              } : undefined}
              onOpenMarketing={onOpenMarketing ? () => {
                const prefill = { discountType: 'percentage' as const, name: '', contextLabel: t('smartRecommendationLoyaltyPoints', language) };
                setInternalMarketingPrefill(prefill);
                setInternalMarketingVisible(true);
              } : undefined}
            />
          </ScrollView>
        )}

        {/* Success Toast */}
        <LocalSuccessToast
          visible={showSuccessToast}
          message={successMessage}
          onHide={() => setShowSuccessToast(false)}
        />
      </SafeAreaView>

      {/* Edit Points Per Dollar Modal */}
      <Modal
        visible={showEditPointsModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditPointsModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}
          onPress={() => setShowEditPointsModal(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 24,
              width: '100%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 6 }}>
              {t('loyaltyEditPointsPerCurrency', language)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>
              {t('loyaltyEditPointsDescription', language)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput
                value={editPointsValue}
                onChangeText={setEditPointsValue}
                keyboardType="decimal-pad"
                autoFocus
                style={{
                  flex: 1,
                  backgroundColor: colors.inputBackground,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  color: colors.inputText,
                  borderWidth: 1.5,
                  borderColor: primaryColor,
                  fontSize: 20,
                  fontWeight: '700',
                }}
                placeholderTextColor={colors.inputPlaceholder}
                placeholder="1"
              />
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {t('loyaltyPointsAbbr', language)} / {currencySymbol}1
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={() => setShowEditPointsModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>{t('cancel', language)}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const val = parseFloat(editPointsValue) || 1;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setPointsPerDollar(val.toString());
                  setShowEditPointsModal(false);
                  try {
                    await updateSettingsMutation.mutateAsync({
                      is_enabled: isEnabled,
                      points_per_dollar: val,
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setIsDirty(false);
                  } catch {
                    setPointsPerDollar((settings?.points_per_dollar ?? 1).toString());
                  }
                }}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: primaryColor,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('save', language)}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create/Edit Reward Modal */}
      <LoyaltyRewardModal
        visible={showRewardModal}
        onClose={() => {
          setShowRewardModal(false);
          resetRewardForm();
        }}
        editingReward={editingReward}
        rewardTitle={rewardTitle}
        setRewardTitle={setRewardTitle}
        rewardDescription={rewardDescription}
        setRewardDescription={setRewardDescription}
        rewardPoints={rewardPoints}
        setRewardPoints={setRewardPoints}
        rewardCreditAmount={rewardCreditAmount}
        setRewardCreditAmount={setRewardCreditAmount}
        rewardServiceId={rewardServiceId}
        setRewardServiceId={setRewardServiceId}
        rewardNotification={rewardNotification}
        setRewardNotification={setRewardNotification}
        rewardType={rewardType}
        setRewardType={setRewardType}
        services={services}
        currencySymbol={currencySymbol}
        language={language}
        handleSaveReward={handleSaveReward}
        handleDeleteReward={handleDeleteReward}
        handleToggleRewardActive={handleToggleRewardActive}
        createRewardMutation={createRewardMutation}
        updateRewardMutation={updateRewardMutation}
      />
    </Modal>
    <DripCampaignScreen
      visible={internalDripVisible}
      onClose={() => { setInternalDripVisible(false); setInternalDripPrefill(undefined); }}
      prefill={internalDripPrefill}
    />
    <MarketingPromoScreen
      visible={internalMarketingVisible}
      onClose={() => { setInternalMarketingVisible(false); setInternalMarketingPrefill(undefined); }}
      prefill={internalMarketingPrefill}
    />
    </>
  );
}
