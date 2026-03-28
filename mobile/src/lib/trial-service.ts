import { User, SubscriptionPlanInfo } from './types';
import { t } from './i18n';
import { Language } from './i18n/types';
import { convertFromUSD, formatCurrency } from './currency';

// Trial duration in days
export const TRIAL_DURATION_DAYS = 3;

// Countdown banner appears this many hours before trial ends
export const COUNTDOWN_BANNER_HOURS_BEFORE_END = 48;

/**
 * Trial Status information
 */
export interface TrialStatus {
  isInTrial: boolean;
  isTrialExpired: boolean;
  hasActiveSubscription: boolean;
  hasStaffAccess: boolean; // User is a staff member of another business
  canAccessApp: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  trialEndDate: Date | null;
  showCountdownBanner: boolean;
}

/**
 * Get available subscription plans
 * Prices are converted from USD base prices to the target currency
 */
export function getSubscriptionPlans(language: Language = 'en', currencyCode: string = 'USD'): SubscriptionPlanInfo[] {
  // Base prices in USD
  const monthlyPriceUSD = 25;
  const yearlyPriceUSD = 250;
  const yearlySavingsUSD = 50; // Save 2 months ($25 x 2 = $50)

  // Convert to target currency
  const monthlyPrice = convertFromUSD(monthlyPriceUSD, currencyCode);
  const yearlyPrice = convertFromUSD(yearlyPriceUSD, currencyCode);
  const yearlySavings = convertFromUSD(yearlySavingsUSD, currencyCode);

  return [
    {
      id: 'monthly',
      name: t('monthlyPlan', language),
      price: monthlyPrice,
      period: t('perMonth', language).replace('/', ''),
      description: t('cancelAnytime', language),
    },
    {
      id: 'yearly',
      name: t('yearlyPlan', language),
      price: yearlyPrice,
      period: t('perYear', language).replace('/', ''),
      savings: undefined, // Removed 20% off badge
      savingsAmount: formatCurrency(yearlySavings, currencyCode),
      description: `${t('billedAnnually', language)}, ${t('nonRefundable', language)}`,
      isMostPopular: true,
    },
  ];
}

/**
 * Calculate trial status for a user
 * @param user - The user to check trial status for
 * @param hasStaffAccess - Optional: if true, user has staff access to another business (bypasses paywall)
 */
export function getTrialStatus(user: User | null, hasStaffAccess: boolean = false): TrialStatus {
  // Default status for non-authenticated users
  if (!user) {
    return {
      isInTrial: false,
      isTrialExpired: false,
      hasActiveSubscription: false,
      hasStaffAccess: false,
      canAccessApp: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      trialEndDate: null,
      showCountdownBanner: false,
    };
  }

  const now = new Date();
  const trialStartDate = user.trialStartDate ? new Date(user.trialStartDate) : null;
  const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
  const hasActiveSubscription = user.hasActivePaidSubscription === true;

  // User has staff access to another business - full access without subscription
  if (hasStaffAccess) {
    return {
      isInTrial: false,
      isTrialExpired: false,
      hasActiveSubscription: false,
      hasStaffAccess: true,
      canAccessApp: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      trialEndDate,
      showCountdownBanner: false,
    };
  }

  // User has paid subscription - full access
  if (hasActiveSubscription) {
    return {
      isInTrial: false,
      isTrialExpired: false,
      hasActiveSubscription: true,
      hasStaffAccess: false,
      canAccessApp: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      trialEndDate,
      showCountdownBanner: false,
    };
  }

  // Trial not yet started (trialStartDate is null) OR no end date — show paywall, no access
  if (!trialStartDate || !trialEndDate) {
    return {
      isInTrial: false,
      isTrialExpired: false,
      hasActiveSubscription: false,
      hasStaffAccess: false,
      canAccessApp: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      trialEndDate: null,
      showCountdownBanner: false,
    };
  }

  // Calculate time remaining
  const msRemaining = trialEndDate.getTime() - now.getTime();
  const hoursRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60)));
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  const isTrialExpired = msRemaining <= 0;
  const isInTrial = !isTrialExpired;

  // Show countdown banner if within COUNTDOWN_BANNER_HOURS_BEFORE_END hours of trial end
  const showCountdownBanner = isInTrial && hoursRemaining <= COUNTDOWN_BANNER_HOURS_BEFORE_END;

  return {
    isInTrial,
    isTrialExpired,
    hasActiveSubscription: false,
    hasStaffAccess: false,
    canAccessApp: isInTrial,
    daysRemaining,
    hoursRemaining,
    trialEndDate,
    showCountdownBanner,
  };
}

/**
 * Format remaining trial time for display
 */
export function formatTrialTimeRemaining(hoursRemaining: number): string {
  if (hoursRemaining <= 0) {
    return 'expired';
  }

  if (hoursRemaining < 24) {
    return `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}`;
  }

  const days = Math.ceil(hoursRemaining / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Check if a high-value action should trigger the paywall
 * Called when trial is expired but user attempts certain actions
 */
export function shouldTriggerPaywallForAction(
  trialStatus: TrialStatus,
  action: 'createClient' | 'addVisit' | 'exportData' | 'createCampaign' | 'sendEmail'
): boolean {
  // If user has access, don't trigger paywall
  if (trialStatus.canAccessApp) {
    return false;
  }

  // All these actions require a subscription
  const paywallTriggerActions = [
    'createClient',
    'addVisit',
    'exportData',
    'createCampaign',
    'sendEmail',
  ];

  return paywallTriggerActions.includes(action);
}

/**
 * Get contextual message for feature-triggered upsell
 */
export function getFeatureBlockedMessage(
  action: 'createClient' | 'addVisit' | 'exportData' | 'createCampaign' | 'sendEmail',
  language: Language = 'en'
): string {
  const messages: Record<string, string> = {
    createClient: t('createClientRequiresSubscription', language),
    addVisit: t('addVisitRequiresSubscription', language),
    exportData: t('exportDataRequiresSubscription', language),
    createCampaign: t('createCampaignRequiresSubscription', language),
    sendEmail: t('sendEmailRequiresSubscription', language),
  };

  return messages[action] || t('featureRequiresSubscription', language);
}
