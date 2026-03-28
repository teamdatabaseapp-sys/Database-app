// Client Management Types

export interface Store {
  id: string;
  userId: string; // Owner user ID for data isolation
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffMember {
  id: string;
  userId: string; // Owner user ID for data isolation
  storeId?: string; // Reference to store - staff are store-specific (optional for migration) - DEPRECATED, use storeIds
  storeIds?: string[]; // Array of store IDs - staff can work at multiple stores
  name: string;
  color: string; // For visual identification in calendar
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  userId: string; // Owner user ID for data isolation
  storeId?: string; // Reference to store - appointments are store-specific
  clientId: string; // Reference to client
  staffId?: string; // Reference to staff member (optional for backward compatibility)
  promotionId?: string; // Reference to marketing promotion (optional)
  date: Date;
  startTime: string; // "HH:mm" format
  endTime?: string; // "HH:mm" format
  duration?: number; // Duration in minutes
  title: string;
  notes?: string;
  amount?: number; // Service amount/price for revenue tracking
  currency?: string; // Currency code for the amount (e.g., 'USD', 'EUR')
  cancelled?: boolean; // Whether appointment was cancelled (removed from revenue)
  cancelledAt?: Date; // Timestamp when appointment was cancelled
  deleted?: boolean; // Whether appointment was deleted (soft delete)
  deletedAt?: Date; // Timestamp when appointment was deleted
  createdAt: Date;
  updatedAt: Date;
}

export interface Visit {
  id: string;
  date: Date;
  services: string[]; // tag IDs
  serviceNames?: string[]; // fallback display names when service IDs don't match local serviceTags
  notes: string;
  amount?: number;
  promotionUsed?: string;
  storeId?: string; // optional store assignment
  staffId?: string; // optional staff member assignment
  staffName?: string; // fallback display name when staffId doesn't match local staffMembers
  storeName?: string; // fallback display name when storeId doesn't match local stores
  modifiedAt?: Date; // timestamp when the entry was last modified
  // Pricing breakdown (cents) — from persisted appointment columns
  subtotal_cents?: number | null;
  discount_cents?: number | null;
  total_cents?: number | null;
  promo_name?: string | null;
  // Appointment metadata
  confirmationCode?: string | null;
  giftCardCode?: string | null;
}

export interface Client {
  id: string;
  userId: string; // Owner user ID for data isolation
  name: string;
  email: string;
  phone: string;
  notes: string;
  visits: Visit[];
  promotionCount: number;
  tags: string[]; // tag IDs
  dripCampaignId?: string;
  activePromotionId?: string; // current marketing promotion client is using
  clientPromotions?: ClientPromotion[]; // loyalty program tracking
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DripEmailAttachment {
  name: string;
  size: number;
  type: string;
  uri: string;
}

export interface DripEmailImage {
  uri: string;
  name: string;
  size: number;
}

export interface DripEmail {
  id: string;
  subject: string;
  body: string;
  delayDays: number; // days after previous email
  attachments?: DripEmailAttachment[];
  images?: DripEmailImage[];
}

export type DripTriggerType =
  | 'manual'
  | 'onClientAdded'
  | 'afterAppointment'
  | 'daysAfterLastVisit'
  | 'birthday'
  | 'membershipExpiring'
  | 'loyaltyThreshold'
  | 'noVisitXDays';

export interface DripTriggerConfig {
  triggerType: DripTriggerType;
  delayDays: number;
  quietHoursEnabled: boolean;
  quietHoursFrom: string; // "HH:MM"
  quietHoursTo: string;   // "HH:MM"
}

export interface DripCampaign {
  id: string;
  userId: string; // Owner user ID for data isolation
  name: string;
  color: string;
  emails: DripEmail[];
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  customDays?: number;
  isActive: boolean;
  createdAt: Date;
  // Trigger configuration
  triggerType?: DripTriggerType;
  triggerConfig?: DripTriggerConfig;
  // EU GDPR Extension - Additive fields
  isEuEnabled?: boolean;
  euLawfulBasisAccepted?: boolean;
  euAcceptedAt?: Date;
}

export interface EmailCampaign {
  id: string;
  userId: string; // Owner user ID for data isolation
  name: string;
  subject: string;
  body: string;
  recipients: 'all' | 'segment';
  segmentTags?: string[];
  sentAt?: Date;
  status: 'draft' | 'sent' | 'scheduled';
  scheduledFor?: Date;
}

// Appointment notification settings
export interface AppointmentNotificationSettings {
  // Appointments
  enableConfirmationEmail: boolean;
  enableUpdateEmail: boolean;
  enableCancellationEmail: boolean;
  enableReminderEmail: boolean;
  reminderTiming: '24h' | '2h' | 'custom';
  customReminderHours?: number;
  // Other communications
  enableGiftCardEmail: boolean;
  enableLoyaltyEmail: boolean;
  enableMembershipEmail: boolean;
  enableGeneralCommsEmail: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'business' | 'admin';
  businessName?: string;
  businessAddress?: string; // Required for CAN-SPAM compliant email drip campaigns
  businessPhoneNumber?: string; // Business phone number for email signature
  businessCountry?: CountryCode; // Country for legal compliance in emails
  businessState?: string; // US state code for state-specific laws (e.g., 'FL', 'CA')
  emailFooterLanguage?: Language; // Language for email footer text (defaults to country's language)
  businessTimezone?: string; // IANA timezone string, e.g. 'America/New_York'
  membershipPlan?: 'yearly' | 'monthly';
  membershipStartDate?: Date;
  membershipActive: boolean;
  // Trial system fields — null means the user has not yet started a trial
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  hasActivePaidSubscription: boolean; // True when user has paid
  subscriptionPurchaseDate?: Date; // When user purchased subscription
  // Appointment notification settings
  appointmentNotificationSettings?: AppointmentNotificationSettings;
}

// Subscription plan type for paywall
export type SubscriptionPlan = 'monthly' | 'yearly';

export interface SubscriptionPlanInfo {
  id: SubscriptionPlan;
  name: string;
  price: number;
  period: string;
  savings?: string;
  savingsAmount?: string;
  description?: string;
  isMostPopular?: boolean;
}

// ============================================
// Email Drip Campaign Legal Compliance
// ============================================

/**
 * Drip Campaign Consent Acceptance - logged before campaign activation
 * Required for CAN-SPAM compliance and legal audit protection
 */
export interface DripCampaignAcceptance {
  id: string;
  userId: string;
  campaignId: string;
  acceptedAt: Date;
  appVersion: string;
  consentText: string; // The exact text the user agreed to
}

/**
 * Drip Campaign Activation Log - tracks all activation/deactivation events
 */
export interface DripCampaignActivationLog {
  id: string;
  userId: string;
  campaignId: string;
  action: 'activated' | 'deactivated' | 'blocked_no_address';
  timestamp: Date;
  acceptanceId?: string; // Reference to DripCampaignAcceptance if activated
}

export interface AnalyticsData {
  newClients: number;
  returningClients: number;
  promotionsRedeemed: number;
  topServices: { tagId: string; count: number }[];
  topPromotions: { name: string; count: number }[];
}

// Marketing Promotions
export interface MarketingPromotion {
  id: string;
  userId: string; // Owner user ID for data isolation
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
  discountValue: number; // percentage or fixed amount
  freeServiceAfter?: number; // for loyalty programs (e.g., 5 services = 1 free)
  otherDiscountDescription?: string; // custom discount description for 'other' type
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  color: string;
  createdAt: Date;
}

// Client-specific promotion tracking (loyalty counters)
export interface ClientPromotion {
  id: string;
  promotionId: string;
  currentCount: number; // current progress toward goal
  targetCount: number; // goal (e.g., 5 haircuts)
  isCompleted: boolean;
  history: ClientPromotionUsage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientPromotionUsage {
  id: string;
  date: Date;
  serviceId: string;
  notes?: string;
}

// Monthly business stats
export interface MonthlyStats {
  month: number; // 1-12
  year: number;
  totalClients: number;
  newClients: number;
  totalVisits: number;
  totalRevenue: number;
  promotionId?: string; // which promotion was active that month
  promotionsRedeemed: number;
}

export type Language = 'en' | 'es' | 'fr' | 'pt' | 'de' | 'ru' | 'ko' | 'ja' | 'zh' | 'tr' | 'sv' | 'no' | 'da' | 'fi' | 'is' | 'nl' | 'it' | 'ht';

// Country code type for legal compliance
export type CountryCode =
  // North America
  | 'US' | 'CA' | 'MX'
  // Europe - Western
  | 'GB' | 'IE' | 'DE' | 'AT' | 'CH' | 'FR' | 'BE' | 'NL' | 'ES' | 'PT' | 'IT' | 'LU' | 'MC'
  // Europe - Nordic
  | 'SE' | 'NO' | 'DK' | 'FI' | 'IS'
  // Europe - Eastern
  | 'PL' | 'RU' | 'TR' | 'BY' | 'KZ' | 'UA'
  // Asia Pacific
  | 'AU' | 'NZ' | 'JP' | 'KR' | 'CN' | 'TW' | 'SG' | 'HK' | 'IN'
  // Central America & Caribbean
  | 'GT' | 'CU' | 'DO' | 'HN' | 'SV' | 'NI' | 'CR' | 'PA' | 'HT' | 'PR'
  // South America
  | 'BR' | 'AR' | 'CL' | 'CO' | 'PE' | 'VE' | 'EC' | 'BO' | 'PY' | 'UY'
  // Middle East
  | 'AE' | 'SA' | 'EG' | 'MA' | 'DZ' | 'TN' | 'JO' | 'LB' | 'KW' | 'QA' | 'BH' | 'OM' | 'IQ' | 'SY' | 'LY'
  // Africa
  | 'ZA' | 'CI' | 'SN' | 'CM' | 'CD' | 'SD';

// Currency code type
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CHF' | 'CNY' | 'INR' | 'MXN' | 'BRL' | 'KRW' | 'SEK' | 'NOK' | 'DKK' | 'RUB' | 'TRY' | 'AED' | 'SAR' | 'PLN' | 'ISK' | 'NZD' | 'SGD' | 'HKD' | 'ZAR' | 'ARS' | 'COP' | 'CLP' | 'PEN' | 'EGP' | 'MAD' | 'TWD';

// Theme customization
export interface ThemeSettings {
  primaryColor: string;
  buttonColor: string;
  darkMode: boolean;
}

// ============================================
// CAN-SPAM Compliant Email Opt-Out System
// ============================================

/**
 * Email opt-out record - stores opt-out status per recipient per business
 * This is a SYSTEM-ENFORCED record that cannot be modified by business users
 */
export interface EmailOptOut {
  id: string;
  recipientEmail: string;
  businessId: string;
  emailOptOut: boolean;
  optOutTimestamp?: Date;
  optInTimestamp?: Date; // For re-subscription tracking
  registrationTimestamp: Date;
  registrationSource: 'client_creation' | 'manual_add' | 'import' | 'form';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit log entry for tracking opt-out and opt-in events
 * Required for CAN-SPAM compliance documentation
 */
export interface EmailOptOutAuditLog {
  id: string;
  recipientEmail: string;
  businessId: string;
  action: 'opt_out' | 'opt_in';
  timestamp: Date;
  source: 'unsubscribe_link' | 'manual_resubscribe' | 'registration';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Email send request - internal structure for email service
 */
export interface EmailSendRequest {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  businessId: string;
  businessName: string;
  businessAddress?: string;
  businessPhoneNumber?: string;
  businessCountry?: CountryCode;
  businessState?: string;
  emailFooterLanguage?: Language;
  attachments?: EmailAttachment[];
  // EU GDPR Extension - Additive field
  isEuRecipient?: boolean;
}

/**
 * Email attachment structure
 */
export interface EmailAttachment {
  name: string;
  size: number;
  type: string;
  uri: string;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  recipientEmail: string;
  error?: string;
  blockedByOptOut?: boolean;
}

/**
 * Bulk email send result
 */
export interface BulkEmailSendResult {
  totalRequested: number;
  sent: number;
  blocked: number;
  failed: number;
  results: EmailSendResult[];
}

// ============================================
// Legal Terms Acceptance System
// ============================================

/**
 * Terms acceptance record - stores when and how user accepted legal terms
 * Required for App Store compliance and legal audits
 */
export interface TermsAcceptance {
  id: string;
  userId: string;
  termsVersion: string;
  acceptedAt: Date;
  appVersion: string;
  deviceOS: string;
  deviceModel?: string;
  ipAddress?: string;
  /**
   * true = user explicitly checked the checkbox and tapped Continue
   */
  explicitConsent: boolean;
}

/**
 * Terms acceptance status for determining if user needs to accept
 */
export interface TermsAcceptanceStatus {
  hasAccepted: boolean;
  acceptedVersion?: string;
  currentVersion: string;
  needsReacceptance: boolean;
  lastAcceptedAt?: Date;
}

// ============================================
// EU GDPR Compliance Types
// ADDITIVE - Does NOT replace US federal types
// ============================================

/**
 * EU Lawful Basis Acceptance - logged before EU campaign activation
 * Required for GDPR compliance and legal audit protection
 */
export interface EULawfulBasisAcceptance {
  id: string;
  userId: string;
  campaignId: string;
  acceptedAt: Date;
  appVersion: string;
  consentText: string; // The exact EU lawful basis text the user agreed to
  ipAddress?: string; // Optional IP for audit
}

/**
 * EU Campaign Activation Log - tracks EU-specific activation events
 */
export interface EUCampaignActivationLog {
  id: string;
  userId: string;
  campaignId: string;
  action: 'eu_activated' | 'eu_deactivated';
  timestamp: Date;
  acceptanceId?: string; // Reference to EULawfulBasisAcceptance if activated
  euIndicatorFlag: boolean;
}

/**
 * Extended DripCampaign with EU fields
 * isEuEnabled indicates if campaign may target EU recipients
 */
export interface DripCampaignEUExtension {
  isEuEnabled?: boolean;
  euLawfulBasisAccepted?: boolean;
  euAcceptedAt?: Date;
}

// ============================================
// Enterprise Electronic Gift Card System
// ============================================

/**
 * Gift Card Type - determines how the card works
 */
export type GiftCardType = 'value' | 'service';

/**
 * Gift Card Status
 */
export type GiftCardStatus = 'active' | 'fully_used' | 'expired' | 'cancelled';

/**
 * Gift Card Settings - Business-level configuration
 */
export interface GiftCardSettings {
  enabled: boolean;
  allowValueBased: boolean;
  allowServiceBased: boolean;
  defaultExpirationMonths?: number; // null = no expiration
  presetAmounts: number[]; // e.g., [25, 50, 100, 150, 200]
  allowCustomAmount: boolean;
  minCustomAmount?: number;
  maxCustomAmount?: number;
}

/**
 * Gift Card - Main gift card record
 */
export interface GiftCard {
  id: string;
  userId: string; // Business owner
  code: string; // Unique secure code (e.g., "GC-XXXX-XXXX-XXXX")
  type: GiftCardType;
  status: GiftCardStatus;

  // Value-based fields
  originalValue?: number;
  currentBalance?: number;
  currency?: string;

  // Service-based fields
  services?: GiftCardService[];

  // Recipient info
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  purchaserName?: string;
  personalMessage?: string;

  // Client assignment (if redeemed/assigned to a client)
  clientId?: string;

  // Store assignment
  storeId?: string;

  // Audit
  createdByUserId?: string; // user_id of staff/owner who issued the card

  // Dates
  issuedAt: Date;
  expiresAt?: Date;
  firstUsedAt?: Date;
  fullyUsedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Gift Card Service - For service-based gift cards
 */
export interface GiftCardService {
  serviceId: string; // Reference to service/tag
  serviceName: string;
  quantity: number;
  usedQuantity: number;
}

/**
 * Gift Card Transaction - Track all redemptions
 */
export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  userId: string; // Business owner
  clientId?: string;

  // Transaction type
  type: 'redemption' | 'refund' | 'adjustment' | 'purchase' | 'sale';

  // Value-based transaction
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;

  // Service-based transaction
  serviceId?: string;
  serviceName?: string;
  quantityUsed?: number;

  // Context
  appointmentId?: string;
  visitId?: string;
  notes?: string;

  createdAt: Date;
}

/**
 * Gift Card Template - For quick creation
 */
export interface GiftCardTemplate {
  id: string;
  userId: string;
  name: string;
  type: GiftCardType;
  value?: number;
  services?: { serviceId: string; serviceName: string; quantity: number }[];
  defaultMessage?: string;
  isActive: boolean;
  createdAt: Date;
}

// ============================================
// Membership Program Types
// Offline Payment Tracking System
// ============================================

/**
 * Membership renewal cycle types
 */
export type MembershipRenewalCycle = 'monthly' | 'yearly' | 'custom';

/**
 * Membership status types
 */
export type MembershipStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'paused';

/**
 * Payment method tracking (display/record only - no processing)
 */
export type MembershipPaymentMethod = 'cash' | 'card' | 'external' | 'other';

/**
 * Membership Plan Benefit - Fully configurable
 */
export interface MembershipBenefit {
  id: string;
  type: 'discount' | 'free_service' | 'monthly_credit' | 'custom_perk';

  // For discount type
  discountPercent?: number;
  discountAppliesTo?: 'all' | 'services' | 'products';

  // For free_service type
  freeServiceId?: string;
  freeServiceName?: string;
  freeServiceQuantity?: number; // How many per renewal cycle
  freeServiceUsed?: number; // Tracking usage

  // For monthly_credit type
  creditAmount?: number;
  creditCurrency?: string;

  // For custom_perk type
  customPerkText?: string;

  isActive: boolean;
}

/**
 * Membership Plan - Business-level configuration
 */
export interface MembershipPlan {
  id: string;
  userId: string; // Business owner ID

  // Plan details
  name: string;
  description?: string;
  displayPrice: number; // Display only - not for processing
  currency: string;

  // Renewal configuration
  renewalCycle: MembershipRenewalCycle;
  customIntervalDays?: number; // For custom cycle
  autoRenewTracking: boolean; // Tracking flag only, not actual auto-charge

  // Benefits (fully configurable)
  benefits: MembershipBenefit[];

  // Status
  isActive: boolean;
  sortOrder: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client Membership - Individual client enrollment
 */
export interface ClientMembership {
  id: string;
  userId: string; // Business owner ID
  clientId: string;
  planId: string;

  // Status
  status: MembershipStatus;

  // Dates
  startDate: Date;
  nextRenewalDate: Date;
  lastPaymentDate?: Date;
  cancelledDate?: Date;
  pausedDate?: Date;
  pauseEndDate?: Date;

  // Payment tracking (offline only)
  paymentMethod: MembershipPaymentMethod;
  paymentNotes?: string;

  // Credits (if plan includes monthly credits)
  creditBalance: number;
  creditCurrency?: string;

  // Free service tracking (if plan includes free services)
  freeServicesUsed: { serviceId: string; usedCount: number; cycleStart: Date }[];

  // Notes
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Membership Payment Record - Manual payment tracking
 */
export interface MembershipPayment {
  id: string;
  userId: string;
  membershipId: string;
  clientId: string;
  planId: string;

  // Payment details (tracking only)
  amount: number;
  currency: string;
  paymentMethod: MembershipPaymentMethod;
  paymentDate: Date;

  // What this payment covers
  periodStart: Date;
  periodEnd: Date;

  // Notes
  notes?: string;
  receivedBy?: string; // Staff name who received payment

  // Timestamps
  createdAt: Date;
}

/**
 * Membership Credit Transaction - Credit ledger entry
 */
export interface MembershipCreditTransaction {
  id: string;
  userId: string;
  membershipId: string;
  clientId: string;

  // Transaction type
  type: 'credit_added' | 'credit_used' | 'credit_expired' | 'credit_adjustment';

  // Amounts
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;

  // Context
  reason: string;
  appointmentId?: string;
  visitId?: string;
  serviceId?: string;
  serviceName?: string;

  // Timestamps
  createdAt: Date;
}

/**
 * Membership Benefit Usage - Audit log
 */
export interface MembershipBenefitUsage {
  id: string;
  userId: string;
  membershipId: string;
  clientId: string;
  benefitId: string;

  // Usage details
  benefitType: MembershipBenefit['type'];

  // For discounts
  discountAmount?: number;
  originalAmount?: number;
  finalAmount?: number;

  // For free services
  serviceId?: string;
  serviceName?: string;

  // For credits
  creditUsed?: number;

  // Context
  appointmentId?: string;
  visitId?: string;

  // Timestamps
  usedAt: Date;
}

/**
 * Membership Program Settings - Business-level configuration
 */
export interface MembershipSettings {
  userId: string;
  isEnabled: boolean;

  // Notification settings (for manual follow-up)
  notifyBeforeRenewalDays: number;
  notifyPastDueDays: number;

  // Grace period before marking as expired
  gracePeriodDays: number;

  // Updated
  updatedAt: Date;
}

// ============================================
// LOYALTY PROGRAM TYPES
// ============================================

/**
 * Loyalty Program Status
 */
export type LoyaltyStatus = 'active' | 'disabled';

/**
 * Loyalty Transaction Type
 */
export type LoyaltyTransactionType =
  | 'points_earned'      // From revenue/visits
  | 'points_redeemed'    // Used for reward
  | 'points_adjusted'    // Manual adjustment
  | 'points_expired';    // Expired (future)

/**
 * Loyalty Reward - A configurable reward tier
 */
export interface LoyaltyReward {
  id: string;
  userId: string;

  // Reward details
  title: string;
  description?: string;
  pointsRequired: number;

  // Optional linked service/product
  linkedServiceId?: string;
  linkedServiceName?: string;
  linkedProductId?: string;
  linkedProductName?: string;

  // Notification message when unlocked
  unlockMessage?: string;

  // Status
  isActive: boolean;
  sortOrder: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Loyalty Settings - Business-level configuration
 */
export interface LoyaltySettings {
  userId: string;
  isEnabled: boolean;

  // Points configuration
  pointsPerDollar: number;       // e.g., 1 point = $1 spent
  pointsRoundingMode: 'floor' | 'round' | 'ceil';

  // Notification settings
  notifyOnRewardUnlocked: boolean;

  // Updated
  updatedAt: Date;
}

/**
 * Client Loyalty - Per-client loyalty status
 */
export interface ClientLoyalty {
  id: string;
  userId: string;          // Business owner
  clientId: string;

  // Status
  isActive: boolean;       // Participates in loyalty program

  // Points
  currentPoints: number;
  lifetimePoints: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Loyalty Transaction - Point ledger entry (auditable)
 */
export interface LoyaltyTransaction {
  id: string;
  userId: string;          // Business owner
  clientId: string;

  // Transaction type
  type: LoyaltyTransactionType;

  // Points
  points: number;          // Always positive, type indicates direction
  pointsBefore: number;
  pointsAfter: number;

  // Context
  reason: string;

  // Source info
  appointmentId?: string;
  visitId?: string;
  revenueAmount?: number;  // Revenue that generated points
  currency?: string;

  // For redemptions
  rewardId?: string;
  rewardTitle?: string;

  // Timestamps
  createdAt: Date;
}

/**
 * Loyalty Redemption - Record of reward redemptions
 */
export interface LoyaltyRedemption {
  id: string;
  userId: string;          // Business owner
  clientId: string;
  rewardId: string;
  transactionId: string;   // Link to loyalty transaction

  // Reward snapshot (in case reward changes)
  rewardTitle: string;
  rewardDescription?: string;
  pointsUsed: number;

  // Optional linked service/product
  linkedServiceId?: string;
  linkedServiceName?: string;

  // Context
  appointmentId?: string;
  visitId?: string;
  redeemedBy?: string;     // Staff name
  notes?: string;

  // Timestamps
  redeemedAt: Date;
}

/**
 * Loyalty Analytics Summary
 */
export interface LoyaltyAnalytics {
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalRewardsRedeemed: number;
  activeLoyaltyMembers: number;
  totalLoyaltyMembers: number;
  revenueInfluenced: number;     // Total revenue from loyalty members
  averagePointsPerMember: number;
  topRewards: { rewardId: string; rewardTitle: string; redemptionCount: number }[];
  topClients: { clientId: string; clientName?: string; totalPoints: number }[];
}
