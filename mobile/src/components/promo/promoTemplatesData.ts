import React from 'react';
import { Percent, Gift, Star, Zap, Users, Repeat, Package, Megaphone, Tag } from 'lucide-react-native';
import type { TranslationKey } from '@/lib/i18n';

// ============================================
// PromoTemplate type
// ============================================

export interface PromoTemplate {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  discountType: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
  discountValue: number;
  freeServiceAfter?: number;
  otherDescKey?: TranslationKey;
  icon: 'percent' | 'gift' | 'star' | 'zap' | 'users' | 'repeat' | 'package' | 'megaphone';
  color: string;
  badgeKey: TranslationKey;
}

// ============================================
// PROMO_TEMPLATES data
// ============================================

export const PROMO_TEMPLATES: PromoTemplate[] = [
  {
    id: 'tpl_loyalty',
    nameKey: 'promoTplLoyaltyName',
    descKey: 'promoTplLoyaltyDesc',
    discountType: 'free_service',
    discountValue: 100,
    freeServiceAfter: 5,
    icon: 'gift',
    color: '',
    badgeKey: 'promoTplBadgeMostPopular',
  },
  {
    id: 'tpl_welcome',
    nameKey: 'promoTplWelcomeName',
    descKey: 'promoTplWelcomeDesc',
    discountType: 'percentage',
    discountValue: 15,
    icon: 'star',
    color: '',
    badgeKey: 'promoTplBadgeNewClients',
  },
  {
    id: 'tpl_referral_promo',
    nameKey: 'promoTplReferralPromoName',
    descKey: 'promoTplReferralPromoDesc',
    discountType: 'fixed',
    discountValue: 10,
    icon: 'users',
    color: '',
    badgeKey: 'promoTplBadgeReferrals',
  },
  {
    id: 'tpl_seasonal',
    nameKey: 'promoTplSeasonalName',
    descKey: 'promoTplSeasonalDesc',
    discountType: 'percentage',
    discountValue: 20,
    icon: 'zap',
    color: '',
    badgeKey: 'promoTplBadgeLimitedTime',
  },
  {
    id: 'tpl_bundle',
    nameKey: 'promoTplBundleName',
    descKey: 'promoTplBundleDesc',
    discountType: 'fixed',
    discountValue: 5,
    icon: 'repeat',
    color: '',
    badgeKey: 'promoTplBadgeRetention',
  },
  {
    id: 'tpl_flash_sale',
    nameKey: 'promoTplFlashSaleName',
    descKey: 'promoTplFlashSaleDesc',
    discountType: 'flash_sale',
    discountValue: 0,
    otherDescKey: 'promoTplFlashSaleOtherDesc',
    icon: 'zap',
    color: '',
    badgeKey: 'promoTplBadgeUrgency',
  },
  {
    id: 'tpl_service_bundle',
    nameKey: 'promoTplServiceBundleName',
    descKey: 'promoTplServiceBundleDesc',
    discountType: 'bundle',
    discountValue: 0,
    otherDescKey: 'promoTplServiceBundleOtherDesc',
    icon: 'package',
    color: '',
    badgeKey: 'promoTplBadgeUpsell',
  },
  {
    id: 'tpl_refer_friend',
    nameKey: 'promoTplReferFriendName',
    descKey: 'promoTplReferFriendDesc',
    discountType: 'referral',
    discountValue: 0,
    otherDescKey: 'promoTplReferFriendOtherDesc',
    icon: 'users',
    color: '',
    badgeKey: 'promoTplBadgeGrowth',
  },
  {
    id: 'tpl_birthday',
    nameKey: 'promoTplBirthdayName',
    descKey: 'promoTplBirthdayDesc',
    discountType: 'percentage',
    discountValue: 10,
    icon: 'gift',
    color: '',
    badgeKey: 'promoTplBadgeLoyalty',
  },
  {
    id: 'tpl_vip',
    nameKey: 'promoTplVipName',
    descKey: 'promoTplVipDesc',
    discountType: 'percentage',
    discountValue: 15,
    icon: 'star',
    color: '',
    badgeKey: 'promoTplBadgeVip',
  },
];

// ============================================
// getTemplateIcon helper
// ============================================

export function getTemplateIcon(icon: PromoTemplate['icon'], color: string, size = 22): React.ReactElement {
  switch (icon) {
    case 'percent': return React.createElement(Percent, { size, color });
    case 'gift': return React.createElement(Gift, { size, color });
    case 'star': return React.createElement(Star, { size, color });
    case 'zap': return React.createElement(Zap, { size, color });
    case 'users': return React.createElement(Users, { size, color });
    case 'repeat': return React.createElement(Repeat, { size, color });
    case 'package': return React.createElement(Package, { size, color });
    case 'megaphone': return React.createElement(Megaphone, { size, color });
    default: return React.createElement(Tag, { size, color });
  }
}
