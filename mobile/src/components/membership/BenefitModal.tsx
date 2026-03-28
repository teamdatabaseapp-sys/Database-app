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
import { X, Percent, Gift, CreditCard, Sparkles, Check } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useServices } from '@/hooks/useServices';
import { EditingBenefit, BenefitType } from './BenefitItem';

// ============================================
// Add/Edit Benefit Modal
// ============================================

export interface BenefitModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (benefit: EditingBenefit) => void;
  editingBenefit: EditingBenefit | null;
}

export function BenefitModal({ visible, onClose, onSave, editingBenefit }: BenefitModalProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { data: services = [] } = useServices();

  const [type, setType] = useState<BenefitType>(editingBenefit?.type || 'discount');
  const [discountPercent, setDiscountPercent] = useState(String(editingBenefit?.discountPercent || ''));
  const [selectedServiceId, setSelectedServiceId] = useState(editingBenefit?.freeServiceId || '');
  const [selectedServiceName, setSelectedServiceName] = useState(editingBenefit?.freeServiceName || '');
  const [serviceQuantity, setServiceQuantity] = useState(String(editingBenefit?.freeServiceQuantity || '1'));
  const [creditAmount, setCreditAmount] = useState(String(editingBenefit?.creditAmount || ''));
  const [customPerkText, setCustomPerkText] = useState(editingBenefit?.customPerkText || '');

  // Reset form when modal opens with new benefit
  React.useEffect(() => {
    if (visible) {
      setType(editingBenefit?.type || 'discount');
      setDiscountPercent(String(editingBenefit?.discountPercent || ''));
      setSelectedServiceId(editingBenefit?.freeServiceId || '');
      setSelectedServiceName(editingBenefit?.freeServiceName || '');
      setServiceQuantity(String(editingBenefit?.freeServiceQuantity || '1'));
      setCreditAmount(String(editingBenefit?.creditAmount || ''));
      setCustomPerkText(editingBenefit?.customPerkText || '');
    }
  }, [visible, editingBenefit]);

  const handleSave = () => {
    const benefit: EditingBenefit = {
      id: editingBenefit?.id || `benefit_${Date.now()}`,
      type,
      isActive: true,
    };

    switch (type) {
      case 'discount':
        benefit.discountPercent = parseFloat(discountPercent) || 0;
        break;
      case 'free_service':
        benefit.freeServiceId = selectedServiceId;
        benefit.freeServiceName = selectedServiceName;
        benefit.freeServiceQuantity = parseInt(serviceQuantity) || 1;
        break;
      case 'monthly_credit':
        benefit.creditAmount = parseFloat(creditAmount) || 0;
        break;
      case 'custom_perk':
        benefit.customPerkText = customPerkText;
        break;
    }

    onSave(benefit);
    onClose();
  };

  const isValid = () => {
    switch (type) {
      case 'discount':
        return discountPercent && parseFloat(discountPercent) > 0;
      case 'free_service':
        return selectedServiceId && serviceQuantity;
      case 'monthly_credit':
        return creditAmount && parseFloat(creditAmount) > 0;
      case 'custom_perk':
        return customPerkText.trim().length > 0;
    }
  };

  const benefitTypes: { value: BenefitType; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'discount', label: t('membershipBenefitTypeDiscount', language), icon: <Percent size={20} color={primaryColor} />, color: primaryColor },
    { value: 'free_service', label: t('membershipBenefitTypeFreeService', language), icon: <Gift size={20} color="#10B981" />, color: '#10B981' },
    { value: 'monthly_credit', label: t('membershipBenefitTypeMonthlyCredit', language), icon: <CreditCard size={20} color="#8B5CF6" />, color: '#8B5CF6' },
    { value: 'custom_perk', label: t('membershipBenefitTypeCustomPerk', language), icon: <Sparkles size={20} color="#F59E0B" />, color: '#F59E0B' },
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
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
            {editingBenefit ? t('membershipEditBenefit', language) : t('membershipAddBenefit', language)}
          </Text>
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
            {/* Benefit Type Selector */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
              {t('membershipBenefitType', language)}
            </Text>
            <View style={{ marginBottom: 24 }}>
              {benefitTypes.map((benefitType) => (
                <Pressable
                  key={benefitType.value}
                  onPress={() => setType(benefitType.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: type === benefitType.value ? `${benefitType.color}15` : colors.card,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 2,
                    borderColor: type === benefitType.value ? benefitType.color : colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: type === benefitType.value ? `${benefitType.color}20` : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {benefitType.icon}
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '500', fontSize: 15, flex: 1 }}>
                    {benefitType.label}
                  </Text>
                  {type === benefitType.value && (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: benefitType.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Type-specific Fields */}
            {type === 'discount' && (
              <View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
                  {t('membershipDiscountPercent', language)}
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
                    value={discountPercent}
                    onChangeText={setDiscountPercent}
                    placeholder="10"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 18, marginLeft: 8 }}>%</Text>
                </View>
              </View>
            )}

            {type === 'free_service' && (
              <View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
                  {t('membershipSelectService', language)}
                </Text>
                <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                  {services.map((service, index) => {
                    const isSelected = selectedServiceId === service.id;
                    return (
                      <Pressable
                        key={service.id}
                        onPress={() => {
                          setSelectedServiceId(service.id);
                          setSelectedServiceName(service.name);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          borderBottomWidth: index < services.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                          backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: isSelected ? primaryColor : colors.border,
                            backgroundColor: isSelected ? primaryColor : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          {isSelected && <Check size={14} color="#fff" />}
                        </View>
                        <Text style={{ color: colors.text, fontWeight: '500', flex: 1 }}>{service.name}</Text>
                      </Pressable>
                    );
                  })}
                  {services.length === 0 && (
                    <View className="py-8 items-center">
                      <Text style={{ color: colors.textTertiary }}>{t('noServicesYet', language)}</Text>
                    </View>
                  )}
                </View>

                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
                  {t('membershipServiceQuantity', language)}
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
                    value={serviceQuantity}
                    onChangeText={setServiceQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipPerCycle', language)}</Text>
                </View>
              </View>
            )}

            {type === 'monthly_credit' && (
              <View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
                  {t('membershipCreditAmount', language)}
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
                  <Text style={{ color: colors.textSecondary, fontSize: 18, marginRight: 4 }}>$</Text>
                  <TextInput
                    style={{ flex: 1, paddingVertical: 14, fontSize: 18, color: colors.text }}
                    value={creditAmount}
                    onChangeText={setCreditAmount}
                    placeholder="50"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            {type === 'custom_perk' && (
              <View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
                  {t('membershipCustomPerkDescription', language)}
                </Text>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <TextInput
                    style={{ padding: 16, fontSize: 16, color: colors.text, minHeight: 100 }}
                    value={customPerkText}
                    onChangeText={setCustomPerkText}
                    placeholder={t('membershipCustomPerkPlaceholder', language)}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Save Button */}
          <View style={{ padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handleSave}
              disabled={!isValid()}
              style={{
                backgroundColor: isValid() ? buttonColor : colors.border,
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                {t('save', language)}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
