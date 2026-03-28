import React from 'react';
import {
  UserPlus,
  TrendingUp,
  AlertCircle,
  Tag,
  DollarSign,
  Target,
  Heart,
  Star,
  Calendar,
  MessageSquare,
  Mail,
} from 'lucide-react-native';
import { TranslationKey } from '@/lib/i18n';

// ============================================
// File size limits for email attachments
// ============================================

export const MAX_FILE_SIZE_MB = 5; // 5MB per file
export const MAX_TOTAL_SIZE_MB = 10; // 10MB total for all attachments
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;
export const MAX_IMAGES = 3;
export const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500 KB post-compression
export const MAX_IMAGE_DIMENSION = 1200;

// ============================================
// Frequency
// ============================================

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export const FREQUENCY_OPTIONS: { value: Frequency; labelKey: 'weekly' | 'biweekly' | 'monthly' | 'custom'; days: number }[] = [
  { value: 'weekly', labelKey: 'weekly', days: 7 },
  { value: 'biweekly', labelKey: 'biweekly', days: 14 },
  { value: 'monthly', labelKey: 'monthly', days: 30 },
  { value: 'custom', labelKey: 'custom', days: 0 },
];

// Note: Using dynamic primaryColor for teal
export const getCampaignColors = (primaryColor: string) => [
  primaryColor, // teal (dynamic)
  '#F97316', // orange
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#10B981', // green
  '#3B82F6', // blue
  '#EF4444', // red
  '#F59E0B', // amber
];

// ============================================
// SmartTrips Advanced Types
// ============================================

export type TargetFilterType = 'all' | 'newThisMonth' | 'atRisk' | 'topClients' | 'byService' | 'visitFrequency' | 'membership' | 'loyalty' | 'giftCard' | 'promotionParticipants';
export type TriggerType = 'manual' | 'onClientAdded' | 'afterAppointment' | 'daysAfterLastVisit' | 'birthday' | 'membershipExpiring' | 'loyaltyThreshold' | 'noVisitXDays';

export interface SmartTripsTargeting {
  filterType: TargetFilterType;
  filterLogic: 'AND' | 'OR';
  consentRequired: boolean;
  topClientsSortBy: 'revenue' | 'visits';
  visitFrequency: 'frequent' | 'occasional' | 'oneTime';
  membershipStatus: 'active' | 'past_due';
  loyaltySubFilter: 'enrolled' | 'hasPoints' | 'redeemed' | 'topEarners';
  giftCardSubFilter: 'any' | 'value' | 'service';
  selectedServiceId: string | null;
  selectedStoreId: string | null;
}

export interface SmartTripsTrigger {
  triggerType: TriggerType;
  delayDays: number;
  quietHoursEnabled: boolean;
  quietHoursFrom: string;
  quietHoursTo: string;
}

// ============================================
// Smart Drip Template System
// ============================================

export type SendFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type AutomationTrigger = 'new_client' | 'active_monthly' | 'at_risk' | 'promotion_users' | 'high_spend' | 'custom';

export interface SmartDripTemplate {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  category: 'official' | 'custom';
  isLocked: boolean; // Official templates are locked
  icon: 'UserPlus' | 'TrendingUp' | 'AlertCircle' | 'Tag' | 'DollarSign' | 'Target' | 'Mail' | 'Heart' | 'Star' | 'Calendar' | 'MessageSquare';
  color: string;
  defaultTrigger: AutomationTrigger;
  defaultFrequency?: SendFrequency;
  defaultCustomDays?: number;
  emails: Array<{
    subjectKey: TranslationKey;
    bodyKey: TranslationKey;
    delayDays: number;
  }>;
}

// Official Templates - Pre-written by Database (locked, non-editable)
export const OFFICIAL_TEMPLATES: SmartDripTemplate[] = [
  {
    id: 'official_welcome',
    nameKey: 'dripTplWelcomeName',
    descKey: 'dripTplWelcomeDesc',
    category: 'official',
    isLocked: true,
    icon: 'UserPlus',
    color: '',
    defaultTrigger: 'new_client',
    defaultFrequency: 'once',
    emails: [
      {
        subjectKey: 'dripTplWelcomeSubject1',
        bodyKey: 'dripTplWelcomeBody1',
        delayDays: 1,
      },
    ],
  },
  {
    id: 'official_monthly_loyal',
    nameKey: 'dripTplMonthlyLoyalName',
    descKey: 'dripTplMonthlyLoyalDesc',
    category: 'official',
    isLocked: true,
    icon: 'TrendingUp',
    color: '',
    defaultTrigger: 'active_monthly',
    defaultFrequency: 'monthly',
    emails: [
      {
        subjectKey: 'dripTplMonthlyLoyalSubject1',
        bodyKey: 'dripTplMonthlyLoyalBody1',
        delayDays: 0,
      },
    ],
  },
  {
    id: 'official_at_risk',
    nameKey: 'dripTplAtRiskName',
    descKey: 'dripTplAtRiskDesc',
    category: 'official',
    isLocked: true,
    icon: 'AlertCircle',
    color: '',
    defaultTrigger: 'at_risk',
    defaultFrequency: 'once',
    emails: [
      {
        subjectKey: 'dripTplAtRiskSubject1',
        bodyKey: 'dripTplAtRiskBody1',
        delayDays: 0,
      },
      {
        subjectKey: 'dripTplAtRiskSubject2',
        bodyKey: 'dripTplAtRiskBody2',
        delayDays: 14,
      },
    ],
  },
  {
    id: 'official_promo_follow_up',
    nameKey: 'dripTplPromoFollowUpName',
    descKey: 'dripTplPromoFollowUpDesc',
    category: 'official',
    isLocked: true,
    icon: 'Tag',
    color: '',
    defaultTrigger: 'promotion_users',
    defaultFrequency: 'biweekly',
    emails: [
      {
        subjectKey: 'dripTplPromoFollowUpSubject1',
        bodyKey: 'dripTplPromoFollowUpBody1',
        delayDays: 0,
      },
    ],
  },
  {
    id: 'official_high_value',
    nameKey: 'dripTplHighValueName',
    descKey: 'dripTplHighValueDesc',
    category: 'official',
    isLocked: true,
    icon: 'DollarSign',
    color: '',
    defaultTrigger: 'high_spend',
    defaultFrequency: 'custom',
    defaultCustomDays: 90,
    emails: [
      {
        subjectKey: 'dripTplHighValueSubject1',
        bodyKey: 'dripTplHighValueBody1',
        delayDays: 0,
      },
    ],
  },
  {
    id: 'official_post_visit_thankyou',
    nameKey: 'dripTplPostVisitName',
    descKey: 'dripTplPostVisitDesc',
    category: 'official',
    isLocked: true,
    icon: 'Heart',
    color: '',
    defaultTrigger: 'active_monthly',
    defaultFrequency: 'once',
    emails: [
      {
        subjectKey: 'dripTplPostVisitSubject1',
        bodyKey: 'dripTplPostVisitBody1',
        delayDays: 1,
      },
    ],
  },
  {
    id: 'official_birthday',
    nameKey: 'dripTplBirthdayName',
    descKey: 'dripTplBirthdayDesc',
    category: 'official',
    isLocked: true,
    icon: 'Star',
    color: '',
    defaultTrigger: 'custom',
    defaultFrequency: 'once',
    emails: [
      {
        subjectKey: 'dripTplBirthdaySubject1',
        bodyKey: 'dripTplBirthdayBody1',
        delayDays: 0,
      },
    ],
  },
  {
    id: 'official_care_tips',
    nameKey: 'dripTplCareTipsName',
    descKey: 'dripTplCareTipsDesc',
    category: 'official',
    isLocked: true,
    icon: 'MessageSquare',
    color: '',
    defaultTrigger: 'active_monthly',
    defaultFrequency: 'once',
    emails: [
      {
        subjectKey: 'dripTplCareTipsSubject1',
        bodyKey: 'dripTplCareTipsBody1',
        delayDays: 1,
      },
    ],
  },
  {
    id: 'official_rebooking_reminder',
    nameKey: 'dripTplRebookingName',
    descKey: 'dripTplRebookingDesc',
    category: 'official',
    isLocked: true,
    icon: 'Calendar',
    color: '',
    defaultTrigger: 'active_monthly',
    defaultFrequency: 'custom',
    defaultCustomDays: 30,
    emails: [
      {
        subjectKey: 'dripTplRebookingSubject1',
        bodyKey: 'dripTplRebookingBody1',
        delayDays: 0,
      },
      {
        subjectKey: 'dripTplRebookingSubject2',
        bodyKey: 'dripTplRebookingBody2',
        delayDays: 14,
      },
    ],
  },
  {
    id: 'official_long_term_nurture',
    nameKey: 'dripTplLongTermName',
    descKey: 'dripTplLongTermDesc',
    category: 'official',
    isLocked: true,
    icon: 'TrendingUp',
    color: '',
    defaultTrigger: 'high_spend',
    defaultFrequency: 'custom',
    defaultCustomDays: 60,
    emails: [
      {
        subjectKey: 'dripTplLongTermSubject1',
        bodyKey: 'dripTplLongTermBody1',
        delayDays: 0,
      },
    ],
  },
];

export const AUTOMATION_TRIGGERS: { value: AutomationTrigger; labelKey: TranslationKey; descKey: TranslationKey; icon: typeof UserPlus }[] = [
  { value: 'new_client', labelKey: 'dripTriggerNewClient', descKey: 'dripTriggerNewClientDesc', icon: UserPlus },
  { value: 'active_monthly', labelKey: 'dripTriggerActiveMonthly', descKey: 'dripTriggerActiveMonthlyDesc', icon: TrendingUp },
  { value: 'at_risk', labelKey: 'dripTriggerAtRisk', descKey: 'dripTriggerAtRiskDesc', icon: AlertCircle },
  { value: 'promotion_users', labelKey: 'dripTriggerPromotionUsers', descKey: 'dripTriggerPromotionUsersDesc', icon: Tag },
  { value: 'high_spend', labelKey: 'dripTriggerHighSpend', descKey: 'dripTriggerHighSpendDesc', icon: DollarSign },
  { value: 'custom', labelKey: 'dripTriggerCustom', descKey: 'dripTriggerCustomDesc', icon: Target },
];

export const SEND_FREQUENCY_OPTIONS: { value: SendFrequency; labelKey: TranslationKey }[] = [
  { value: 'once', labelKey: 'dripFreqOnce' },
  { value: 'weekly', labelKey: 'dripFreqWeekly' },
  { value: 'biweekly', labelKey: 'dripFreqBiweekly' },
  { value: 'monthly', labelKey: 'dripFreqMonthly' },
  { value: 'custom', labelKey: 'dripFreqCustom' },
];

// Helper function to get icon component
export const getTemplateIcon = (iconName: SmartDripTemplate['icon'], color: string, size = 22) => {
  switch (iconName) {
    case 'UserPlus': return <UserPlus size={size} color={color} />;
    case 'TrendingUp': return <TrendingUp size={size} color={color} />;
    case 'AlertCircle': return <AlertCircle size={size} color={color} />;
    case 'Tag': return <Tag size={size} color={color} />;
    case 'DollarSign': return <DollarSign size={size} color={color} />;
    case 'Target': return <Target size={size} color={color} />;
    case 'Heart': return <Heart size={size} color={color} />;
    case 'Star': return <Star size={size} color={color} />;
    case 'Calendar': return <Calendar size={size} color={color} />;
    case 'MessageSquare': return <MessageSquare size={size} color={color} />;
    case 'Mail': return <Mail size={size} color={color} />;
    default: return <Mail size={size} color={color} />;
  }
};
