import React from 'react';
import { View, Text } from 'react-native';
import { Percent, Gift, CreditCard, Sparkles } from 'lucide-react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { RowActionButtons } from '@/components/stores/RowActionButtons';

// ============================================
// Benefit Item Component
// ============================================

export type BenefitType = 'discount' | 'free_service' | 'monthly_credit' | 'custom_perk';

export interface EditingBenefit {
  id: string;
  type: BenefitType;
  discountPercent?: number;
  freeServiceId?: string;
  freeServiceName?: string;
  freeServiceQuantity?: number;
  creditAmount?: number;
  customPerkText?: string;
  isActive: boolean;
}

export interface BenefitItemProps {
  benefit: EditingBenefit;
  onEdit: () => void;
  onDelete: () => void;
}

export function BenefitItem({ benefit, onEdit, onDelete }: BenefitItemProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const getBenefitIcon = () => {
    switch (benefit.type) {
      case 'discount':
        return <Percent size={18} color={primaryColor} />;
      case 'free_service':
        return <Gift size={18} color="#10B981" />;
      case 'monthly_credit':
        return <CreditCard size={18} color="#8B5CF6" />;
      case 'custom_perk':
        return <Sparkles size={18} color="#F59E0B" />;
    }
  };

  const getBenefitDescription = () => {
    switch (benefit.type) {
      case 'discount':
        return `${benefit.discountPercent || 0}% ${t('membershipBenefitDiscount', language)}`;
      case 'free_service':
        return `${benefit.freeServiceQuantity || 1}x ${benefit.freeServiceName || t('membershipBenefitFreeService', language)}`;
      case 'monthly_credit':
        return `$${benefit.creditAmount || 0} ${t('membershipBenefitMonthlyCredit', language)}`;
      case 'custom_perk':
        return benefit.customPerkText || t('membershipBenefitCustomPerk', language);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: isDark ? colors.card : '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {getBenefitIcon()}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
          {getBenefitDescription()}
        </Text>
      </View>
      <RowActionButtons onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}
