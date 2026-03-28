import React, { useState } from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Crown, Trash2, Sparkles } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import {
  Language,
  MembershipPlan,
  MembershipBenefit,
  MembershipRenewalCycle,
} from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import {
  useCreateMembershipPlan,
  useUpdateMembershipPlan,
  useDeleteMembershipPlan,
} from '@/hooks/useMembership';
import { ToggleSwitch } from './ToggleSwitch';
import { BenefitItem, EditingBenefit } from './BenefitItem';
import { BenefitModal } from './BenefitModal';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';

// ============================================
// Create/Edit Plan Modal
// ============================================

export interface PlanModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingPlan: MembershipPlan | null;
}

export function PlanModal({ visible, onClose, onSuccess, editingPlan }: PlanModalProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { showSaveConfirmation } = useSaveConfirmation();

  const createPlan = useCreateMembershipPlan();
  const updatePlan = useUpdateMembershipPlan();
  const deletePlan = useDeleteMembershipPlan();

  const [name, setName] = useState(editingPlan?.name || '');
  const [description, setDescription] = useState(editingPlan?.description || '');
  const [displayPrice, setDisplayPrice] = useState(String(editingPlan?.displayPrice || ''));
  const [renewalCycle, setRenewalCycle] = useState<MembershipRenewalCycle>(editingPlan?.renewalCycle || 'monthly');
  const [customIntervalDays, setCustomIntervalDays] = useState(String(editingPlan?.customIntervalDays || ''));
  const [autoRenewTracking, setAutoRenewTracking] = useState(editingPlan?.autoRenewTracking ?? true);
  const [isActive, setIsActive] = useState(editingPlan?.isActive ?? true);
  const [benefits, setBenefits] = useState<EditingBenefit[]>(
    editingPlan?.benefits?.map((b) => ({
      id: b.id,
      type: b.type,
      discountPercent: b.discountPercent,
      freeServiceId: b.freeServiceId,
      freeServiceName: b.freeServiceName,
      freeServiceQuantity: b.freeServiceQuantity,
      creditAmount: b.creditAmount,
      customPerkText: b.customPerkText,
      isActive: b.isActive,
    })) || []
  );

  const [showBenefitModal, setShowBenefitModal] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<EditingBenefit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      setName(editingPlan?.name || '');
      setDescription(editingPlan?.description || '');
      setDisplayPrice(String(editingPlan?.displayPrice || ''));
      setRenewalCycle(editingPlan?.renewalCycle || 'monthly');
      setCustomIntervalDays(String(editingPlan?.customIntervalDays || ''));
      setAutoRenewTracking(editingPlan?.autoRenewTracking ?? true);
      setIsActive(editingPlan?.isActive ?? true);
      setBenefits(
        editingPlan?.benefits?.map((b) => ({
          id: b.id,
          type: b.type,
          discountPercent: b.discountPercent,
          freeServiceId: b.freeServiceId,
          freeServiceName: b.freeServiceName,
          freeServiceQuantity: b.freeServiceQuantity,
          creditAmount: b.creditAmount,
          customPerkText: b.customPerkText,
          isActive: b.isActive,
        })) || []
      );
    }
  }, [visible, editingPlan]);

  const handleSaveBenefit = (benefit: EditingBenefit) => {
    const existingIndex = benefits.findIndex((b) => b.id === benefit.id);
    if (existingIndex >= 0) {
      const newBenefits = [...benefits];
      newBenefits[existingIndex] = benefit;
      setBenefits(newBenefits);
    } else {
      setBenefits([...benefits, benefit]);
    }
  };

  const handleDeleteBenefit = (benefitId: string) => {
    setBenefits(benefits.filter((b) => b.id !== benefitId));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!name.trim() || !displayPrice) return;

    setIsSubmitting(true);
    try {
      const planData = {
        name: name.trim(),
        description: description.trim() || undefined,
        displayPrice: parseFloat(displayPrice),
        currency,
        renewalCycle,
        customIntervalDays: renewalCycle === 'custom' ? parseInt(customIntervalDays) || 30 : undefined,
        autoRenewTracking,
        benefits: benefits.map((b) => ({
          id: b.id,
          type: b.type,
          discountPercent: b.discountPercent,
          freeServiceId: b.freeServiceId,
          freeServiceName: b.freeServiceName,
          freeServiceQuantity: b.freeServiceQuantity,
          creditAmount: b.creditAmount,
          customPerkText: b.customPerkText,
          isActive: b.isActive,
        } as MembershipBenefit)),
        isActive,
        sortOrder: editingPlan?.sortOrder ?? 0,
      };

      if (editingPlan) {
        await updatePlan.mutateAsync({ planId: editingPlan.id, updates: planData });
      } else {
        await createPlan.mutateAsync(planData);
      }

      showSaveConfirmation();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save membership plan:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPlan) return;
    setIsSubmitting(true);
    try {
      await deletePlan.mutateAsync(editingPlan.id);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to delete membership plan:', error);
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const renewalCycles: { value: MembershipRenewalCycle; label: string }[] = [
    { value: 'monthly', label: t('membershipCycleMonthly', language) },
    { value: 'yearly', label: t('membershipCycleYearly', language) },
    { value: 'custom', label: t('membershipCycleCustom', language) },
  ];

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
          <View className="flex-row items-center">
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
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
              {editingPlan ? t('membershipEditPlan', language) : t('membershipCreatePlan', language)}
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

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Plan Name */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
              {t('membershipPlanName', language)}
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
            >
              <TextInput
                style={{ padding: 14, fontSize: 16, color: colors.text }}
                value={name}
                onChangeText={setName}
                placeholder={t('membershipPlanNamePlaceholder', language)}
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            {/* Description */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
              {t('membershipPlanDescription', language)}
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
            >
              <TextInput
                style={{ padding: 14, fontSize: 16, color: colors.text, minHeight: 80 }}
                value={description}
                onChangeText={setDescription}
                placeholder={t('membershipPlanDescriptionPlaceholder', language)}
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Display Price */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
              {t('membershipDisplayPrice', language)}
            </Text>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 18, marginRight: 4 }}>$</Text>
              <TextInput
                style={{ flex: 1, paddingVertical: 14, fontSize: 18, color: colors.text }}
                value={displayPrice}
                onChangeText={setDisplayPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Renewal Cycle */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
              {t('membershipRenewalCycle', language)}
            </Text>
            <View className="flex-row mb-4" style={{ gap: 8 }}>
              {renewalCycles.map((cycle) => (
                <Pressable
                  key={cycle.value}
                  onPress={() => setRenewalCycle(cycle.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: renewalCycle === cycle.value ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: renewalCycle === cycle.value ? '#fff' : colors.text,
                      fontWeight: '600',
                      fontSize: 14,
                    }}
                  >
                    {cycle.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Custom Interval Days */}
            {renewalCycle === 'custom' && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
                  {t('membershipCustomIntervalDays', language)}
                </Text>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                  }}
                >
                  <TextInput
                    style={{ flex: 1, paddingVertical: 14, fontSize: 18, color: colors.text }}
                    value={customIntervalDays}
                    onChangeText={setCustomIntervalDays}
                    placeholder="30"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('days', language)}</Text>
                </View>
              </View>
            )}

            {/* Auto-Renew Tracking */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                  {t('membershipAutoRenewTracking', language)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                  {t('membershipAutoRenewTrackingDescription', language)}
                </Text>
              </View>
              <ToggleSwitch value={autoRenewTracking} onValueChange={setAutoRenewTracking} />
            </View>

            {/* Benefits Section */}
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                {t('membershipBenefits', language)}
              </Text>
              <Pressable
                onPress={() => {
                  setEditingBenefit(null);
                  setShowBenefitModal(true);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${primaryColor}15`,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                }}
              >
                <Plus size={16} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 13, marginLeft: 4 }}>
                  {t('membershipAddBenefit', language)}
                </Text>
              </Pressable>
            </View>

            {benefits.length > 0 ? (
              <View style={{ marginBottom: 20 }}>
                {benefits.map((benefit) => (
                  <BenefitItem
                    key={benefit.id}
                    benefit={benefit}
                    onEdit={() => {
                      setEditingBenefit(benefit);
                      setShowBenefitModal(true);
                    }}
                    onDelete={() => handleDeleteBenefit(benefit.id)}
                  />
                ))}
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
                  borderRadius: 12,
                  padding: 20,
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                <Sparkles size={32} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, marginTop: 8, textAlign: 'center' }}>
                  {t('membershipNoBenefits', language)}
                </Text>
              </View>
            )}

            {/* Active Status */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                  {t('membershipPlanActive', language)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                  {t('membershipPlanActiveDescription', language)}
                </Text>
              </View>
              <ToggleSwitch value={isActive} onValueChange={setIsActive} />
            </View>

            {/* Delete Button (for editing) */}
            {editingPlan && (
              <Pressable
                onPress={() => setShowDeleteConfirm(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FEE2E2',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15, marginLeft: 8 }}>
                  {t('membershipDeletePlan', language)}
                </Text>
              </Pressable>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Save Button */}
          <View style={{ padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting || !name.trim() || !displayPrice}
              style={{
                backgroundColor: (!name.trim() || !displayPrice) ? colors.border : buttonColor,
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                {isSubmitting ? t('loading', language) : editingPlan ? t('membershipUpdatePlan', language) : t('membershipCreatePlan', language)}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* Benefit Modal */}
        <BenefitModal
          visible={showBenefitModal}
          onClose={() => {
            setShowBenefitModal(false);
            setEditingBenefit(null);
          }}
          onSave={handleSaveBenefit}
          editingBenefit={editingBenefit}
        />

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirm(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20,
            }}
          >
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 24,
                width: '100%',
                maxWidth: 340,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: '#FEE2E2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'center',
                  marginBottom: 16,
                }}
              >
                <Trash2 size={28} color="#EF4444" />
              </View>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
                {t('membershipDeletePlanTitle', language)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 24 }}>
                {t('membershipDeletePlanMessage', language)}
              </Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <Pressable
                  onPress={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{t('cancel', language)}</Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#EF4444',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {isSubmitting ? t('loading', language) : t('delete', language)}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
