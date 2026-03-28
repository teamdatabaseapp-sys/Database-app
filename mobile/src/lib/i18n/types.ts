// Translation key type - all possible translation keys
export interface TranslationStrings {
  // Navigation
  dashboard: string;
  clients: string;
  campaigns: string;
  settings: string;

  // Auth
  welcome: string;
  signIn: string;
  signUp: string;
  email: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  fullName: string;
  createAccount: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  forgotPassword: string;
  heroCreateAccount: string;
  heroSignInSubtitle: string;
  heroSignUpSubtitle: string;
  orContinueWith: string;
  socialConnecting: string;
  continueWithGoogle: string;
  continueWithApple: string;
  resetPasswordTitle: string;
  forgotPasswordQuestion: string;
  forgotPasswordDescription: string;
  sendResetLink: string;
  checkYourEmail: string;
  resetInstructionsSent: string;
  emailNotFoundHint: string;
  backToLogin: string;
  tryDifferentEmail: string;
  networkErrorSignIn: string;
  invalidCredentials: string;
  signInFailed: string;
  termsAcceptanceRequired: string;
  emailAlreadyInUse: string;
  networkErrorSignUp: string;
  signUpFailed: string;
  emailConfirmationRequired: string;
  emailRequiredForReset: string;
  invalidEmailForReset: string;
  resetEmailFailed: string;
  // Password recovery (auth/callback screen)
  setNewPasswordTitle: string;
  setNewPasswordDescription: string;
  setNewPasswordButton: string;
  passwordResetSuccess: string;
  passwordResetSuccessDescription: string;
  invalidRecoveryLink: string;
  verifyingResetLink: string;
  linkExpired: string;

  // Dashboard
  totalClients: string;
  activeClients: string;
  newThisMonth: string;
  promotionsUsed: string;
  recentActivity: string;
  quickActions: string;
  viewAll: string;

  // Clients
  searchClients: string;
  addClient: string;
  newClient: string;
  editClient: string;
  clientDetails: string;
  name: string;
  phone: string;
  notes: string;
  visitHistory: string;
  noVisits: string;
  addVisit: string;
  archive: string;
  unarchive: string;
  delete: string;
  save: string;
  cancel: string;
  lastVisit: string;
  promotions: string;

  // Tags
  serviceTags: string;
  addTag: string;
  editTag: string;
  tagName: string;
  tagColor: string;
  tags: string;
  allColorsUsed: string;
  colorUnavailable: string;

  // Campaigns
  emailCampaigns: string;
  dripCampaigns: string;
  createCampaign: string;
  sendEmail: string;
  subject: string;
  message: string;
  recipients: string;
  allClients: string;
  selectedTags: string;
  send: string;
  schedule: string;
  campaignName: string;
  emailSequence: string;
  sendFrequency: string;
  weekly: string;
  biweekly: string;
  monthly: string;
  custom: string;
  activate: string;
  campaignActivated: string;
  pause: string;
  edit: string;
  assignedClients: string;

  // Settings
  profile: string;
  membership: string;
  exportData: string;
  language: string;
  english: string;
  spanish: string;
  french: string;
  portuguese: string;
  german: string;
  russian: string;
  korean: string;
  japanese: string;
  chinese: string;
  turkish: string;
  swedish: string;
  norwegian: string;
  danish: string;
  finnish: string;
  icelandic: string;
  dutch: string;
  italian: string;
  logout: string;
  logoutConfirmation: string;
  deleteAccount: string;
  deleteAccountTitle: string;
  deleteAccountWarning: string;
  deleteAccountConfirmLabel: string;
  deleteAccountConfirmPlaceholder: string;
  deleteAccountConfirmButton: string;
  deleteAccountError: string;
  deleteAccountSuccess: string;

  // Membership
  yearlyPlan: string;
  monthlyPlan: string;
  perYear: string;
  perMonth: string;
  subscribe: string;
  currentPlan: string;
  memberSince: string;

  // Export
  exportToEmail: string;
  enterEmail: string;
  exportSuccess: string;

  // Common
  loading: string;
  error: string;
  success: string;
  successSaved: string;
  confirm: string;
  today: string;
  tomorrow: string;
  yesterday: string;
  thisWeek: string;
  thisMonth: string;
  noResults: string;
  tryAgain: string;

  // Marketing Promotions
  marketingPromo: string;
  monthlyStats: string;
  createPromotion: string;
  activePromotion: string;
  loyaltyCounter: string;
  loyaltyProgram: string;
  programs: string;
  addCount: string;
  progress: string;
  completed: string;
  inProgress: string;
  noPromotion: string;
  selectPromotion: string;
  discountPercentage: string;
  discountFixed: string;
  discountLoyalty: string;

  // Analytics / Monthly Stats
  analytics: string;
  totalVisits: string;
  revenue: string;
  promotionsRedeemed: string;
  topServices: string;
  bestMonth: string;
  bestBadge: string;
  whatsWorking: string;
  bestPromo: string;
  topService: string;
  noActivityRecorded: string;
  noActivityThisPeriod: string;
  noActivityThisYear: string;
  daily: string;
  yearly: string;
  back: string;
  allClientsCount: string;
  newClientsCount: string;
  allVisitsCount: string;
  allAppointmentsCount: string;
  revenueDetails: string;
  noClientsFound: string;
  noClientsMatchFilters: string;
  noNewClients: string;
  noVisitsThisPeriod: string;
  noAppointmentsThisPeriod: string;
  noRevenueRecorded: string;
  noPromotionsRedeemed: string;
  noServicesRecorded: string;
  added: string;
  usedTimes: string;
  usedTimesPlural: string;
  thisDay: string;
  thisWeekPeriod: string;
  thisMonthPeriod: string;
  thisYearPeriod: string;
  weekOf: string;
  visit: string;
  visits: string;

  // Insights
  insights: string;
  returnRate: string;
  returnRateDesc: string;
  outOf: string;
  clientsReturned: string;
  smartRecommendation: string;
  aiSmartRecommendation: string;
  tipLoyaltyBonus: string;
  tipPromotions: string;
  tipServices: string;
  tipNewClients: string;
  peakDays: string;
  peakHoursToday: string;
  peakDaysWeek: string;
  tipSchedulePromotions: string;
  inactiveClients: string;
  inactiveClientsDuring: string;
  tipSendDiscount: string;
  notEnoughData: string;
  whatsBringingClientsBack: string;
  avgRevenuePerClient: string;
  avgRevenueDesc: string;
  yourBusiestTimes: string;
  clientsAtRisk: string;
  clientsHaventReturned: string;
  allClientsActive: string;
  cameBackDuringPeriod: string;

  // Analytics Additional
  yourBestClients: string;
  generatedHighestRevenue: string;
  noClientDataYet: string;
  topClientLabel: string;
  mostVisits: string;
  byRevenue: string;
  sortedByVisits: string;
  sortedByRevenue: string;
  generatedHighestRevenueShort: string;

  // Marketing Promo Screen
  marketingPromos: string;
  createNewPromotion: string;
  activePromotions: string;
  inactivePromotions: string;
  noPromotionsYet: string;
  editPromotion: string;
  newPromotion: string;
  promotionName: string;
  description: string;
  discountType: string;
  percentage: string;
  fixed: string;
  counter: string;
  other: string;
  startDate: string;
  setEndDate: string;
  endDate: string;
  color: string;
  deactivatePromotion: string;
  activatePromotion: string;
  deletePromotion: string;
  active: string;
  paused: string;
  inactive: string;

  // Marketing Promo Additional
  discountDescription: string;
  freeServiceAfter: string;
  discountPercentageLabel: string;
  discountAmountLabel: string;
  servicesLabel: string;
  createFirstPromotion: string;
  deleteConfirmMessage: string;
  promotionNamePlaceholder: string;
  descriptionPlaceholder: string;
  discountDescriptionPlaceholder: string;
  discountDescriptionHint: string;
  freeServiceHint: string;
  percentageOff: string;
  amountOff: string;
  freeAfterServices: string;

  // Bulk Email Modal
  bulkEmail: string;
  recipientsOptedOut: string;
  quickFilters: string;
  newThisMonthFilter: string;
  promotionUsers: string;
  filterByPromotion: string;
  filterByStore: string;
  anyPromotion: string;
  allTags: string;
  selectAll: string;
  deselectAll: string;
  noClientsFoundFilter: string;
  enterEmailSubject: string;
  writeYourMessage: string;
  attachments: string;
  addFile: string;
  noAttachments: string;
  tapAddFileHint: string;
  missingInformation: string;
  fillCampaignFields: string;
  sendAnyway: string;
  sending: string;
  emailSent: string;
  emailFailed: string;
  pleaseAddSubject: string;
  pleaseAddMessage: string;
  pleaseSelectRecipients: string;
  recipientCount: string;
  recipientCountPlural: string;
  selected: string;
  selectRecipients: string;

  // Drip Campaigns
  dripCampaignsTitle: string;
  newCampaign: string;
  editCampaignTitle: string;
  createNewCampaign: string;
  deleteCampaign: string;
  businessAddressRequired: string;
  businessAddressRequiredMessage: string;
  goToSettings: string;
  activateCampaign: string;
  campaignColor: string;
  euRecipients: string;
  euRecipientsDescription: string;
  addEmail: string;
  mandatoryEmailFooter: string;
  saveChanges: string;
  noCampaignsYet: string;
  createFirstCampaign: string;
  emailNumber: string;
  days: string;
  daysAfterPrevious: string;
  daysAfterSignup: string;
  removeEmail: string;
  emailSubject: string;
  emailContent: string;
  delayDays: string;

  // Legal Content
  termsAndConditions: string;
  privacyPolicy: string;
  legalDisclaimer: string;
  limitationOfLiability: string;
  arbitrationAgreement: string;
  indemnification: string;
  tableOfContents: string;
  section: string;
  acceptTerms: string;
  declineTerms: string;
  iAgreeToTerms: string;
  mustAcceptTerms: string;
  termsOfService: string;
  dripCampaignTerms: string;
  euComplianceAddendum: string;
  consentAcknowledgment: string;
  euLawfulBasis: string;
  // New legal sections
  dataStoragePolicy: string;
  deviceLimitPolicy: string;
  maximumLiabilityPolicy: string;
  useAtOwnRiskPolicy: string;
  dataStorageTitle: string;
  deviceLimitTitle: string;
  maximumLiabilityTitle: string;
  useAtOwnRiskTitle: string;
  // TermsAcceptanceModal UI strings
  updatedTerms: string;
  legalAndDisclaimer: string;
  termsUpdatedFrom: string;
  readAndUnderstandTerms: string;
  tapToReadFull: string;
  importantAcknowledgments: string;
  ackToolOnly: string;
  ackUseAtOwnRisk: string;
  ackDataThirdParty: string;
  ackMaxLiability: string;
  ackDeviceLimit: string;
  ackWaiverJuryTrial: string;
  ackWaiverClassAction: string;
  ackIndemnify: string;
  iHaveReadAndAgree: string;
  andConjunction: string;
  acceptanceRecorded: string;

  // Visit / Add Visit
  visitDate: string;
  visitAmount: string;
  visitNotes: string;
  visitServices: string;
  selectServices: string;
  enterAmount: string;
  enterNotes: string;
  promotionUsed: string;
  noPromotionSelected: string;

  // Form Validation
  required: string;
  invalidEmail: string;
  invalidPhone: string;
  passwordTooShort: string;
  passwordsDoNotMatch: string;
  duplicateEmail: string;
  duplicatePhone: string;
  failedToSaveClient: string;

  // Notifications / Alerts
  deleteConfirmation: string;
  archiveConfirmation: string;
  unarchiveConfirmation: string;
  cannotUndo: string;
  // Archive client modal
  archiveClientTitle: string;
  archiveClientMessage: string;
  archiveClientFutureApptWarning: string;
  archiveClientNoFutureAppts: string;
  archiveClientButton: string;
  yes: string;
  no: string;
  ok: string;
  close: string;
  done: string;
  next: string;
  previous: string;
  skip: string;
  continue: string;
  getStarted: string;
  started: string;
  editVisit: string;
  lastEdited: string;
  edited: string;

  // Empty States
  noDataAvailable: string;
  noItemsFound: string;
  startByAdding: string;

  // Onboarding
  welcomeToApp: string;
  onboardingStep1Title: string;
  onboardingStep1Description: string;
  onboardingStep2Title: string;
  onboardingStep2Description: string;
  onboardingStep3Title: string;
  onboardingStep3Description: string;

  // Months
  january: string;
  february: string;
  march: string;
  april: string;
  may: string;
  june: string;
  july: string;
  august: string;
  september: string;
  october: string;
  november: string;
  december: string;

  // Short month names
  janShort: string;
  febShort: string;
  marShort: string;
  aprShort: string;
  mayShort: string;
  junShort: string;
  julShort: string;
  augShort: string;
  sepShort: string;
  octShort: string;
  novShort: string;
  decShort: string;

  // Analytics labels
  clientsIn: string;
  totalSpentIn: string;
  clientsWhoUsePromo: string;
  clientsWhoUseService: string;
  clientDetail: string;
  visitSingular: string;
  totalLabel: string;
  monthlyRevenue: string;
  highestRevenueDays: string;
  revenueByDay: string;
  lastVisitShort: string;
  bestLabel: string;

  // Trial & Subscription
  trialEndingSoon: string;
  freeTrialEnding: string;
  trialEnded: string;
  subscriptionRequired: string;
  choosePlanToContinue: string;
  upgradeNow: string;
  restorePurchase: string;
  processing: string;
  restoring: string;
  bestValue: string;
  mostPopular: string;
  whatYouGet: string;
  unlimitedClientManagement: string;
  emailMarketingCampaigns: string;
  analyticsInsights: string;
  dripCampaignAutomation: string;
  prioritySupport: string;
  remaining: string;
  upgradeToAvoidInterruption: string;
  featureRequiresSubscription: string;
  createClientRequiresSubscription: string;
  addVisitRequiresSubscription: string;
  exportDataRequiresSubscription: string;
  createCampaignRequiresSubscription: string;
  sendEmailRequiresSubscription: string;
  savePer: string;
  savingAmount: string;
  cancelAnytime: string;
  billedAnnually: string;
  nonRefundable: string;
  twentyPercentOff: string;
  freeTrial3Days: string;
  trialStartsToday: string;
  trialIntroSubtitle: string;
  trialTimelineTitle: string;
  trialDay1Label: string;
  trialDay1Desc: string;
  trialDay2Label: string;
  trialDay2Desc: string;
  trialReminderLabel: string;
  trialReminderDesc: string;
  trialBillingLabel: string;
  trialBillingDesc: string;
  trialPlanSectionTitle: string;
  trialBenefitsTitle: string;
  trialBenefitClients: string;
  trialBenefitAppointments: string;
  trialBenefitCampaigns: string;
  trialBenefitPromotions: string;
  trialBenefitGiftCards: string;
  trialBenefitLoyalty: string;
  trialBenefitMembership: string;
  trialBenefitAnalytics: string;
  trialBenefitStores: string;
  trialBenefitMultilingual: string;
  trialBenefitSupport: string;
  // Trial benefit category headings
  trialCategoryCore: string;
  trialCategoryMarketing: string;
  trialCategoryRevenue: string;
  trialCategoryAI: string;
  trialCategoryAnalytics: string;
  trialCategoryGlobal: string;
  // Trial benefit new items
  trialBenefitBooking: string;
  trialBenefitStaffCalendar: string;
  trialBenefitTeamRoles: string;
  trialBenefitRevTracking: string;
  trialBenefitAIPromo: string;
  trialBenefitAICampaigns: string;
  trialBenefitAIInsights: string;
  trialBenefitAIDrip: string;
  trialBenefitRetention: string;
  trialBenefitServices: string;
  trialBenefitSocialShare: string;
  trialBenefitSegmentation: string;
  trialBenefitTemplates: string;
  trialBenefitBranding: string;
  trialBenefitRevenuePerf: string;
  trialBenefitBestServices: string;
  trialBenefitClientActivity: string;
  trialCtaStartTrial: string;
  trialCtaNoChargeToday: string;
  trialLegalNote: string;
  trialAlreadySubscribed: string;
  trialRestoreAccess: string;
  trialActivationError: string;

  // Subscription Paywall — feature sections
  paywallEverythingIncluded: string;
  paywallSectionBizPlatform: string;
  paywallSectionMarketing: string;
  paywallSectionAI: string;
  paywallSectionGlobal: string;
  paywallFeatureCRM: string;
  paywallFeatureBooking: string;
  paywallFeatureStaff: string;
  paywallFeatureServices: string;
  paywallFeatureEmailCampaigns: string;
  paywallFeatureDrip: string;
  paywallFeaturePromotions: string;
  paywallFeatureSocial: string;
  paywallFeatureGiftLoyalty: string;
  paywallFeatureAIPromo: string;
  paywallFeatureAICampaigns: string;
  paywallFeatureAIInsights: string;
  paywallFeatureRevenue: string;
  paywallFeature18Lang: string;

  ratingPromptTitle: string;
  ratingPromptSubtitle: string;
  ratingPromptRateNow: string;
  ratingPromptNotNow: string;
  ratingPromptNeverAsk: string;
  ratingThankYouTitle: string;
  ratingThankYouSubtitle: string;

  // Client List & Filters
  client: string;
  clientsCount: string;
  recent: string;
  alphabetical: string;
  filter: string;
  tagsCount: string;
  showArchived: string;
  hideArchived: string;
  clearAll: string;
  archived: string;
  filterByTags: string;
  sortBy: string;

  // Quick Actions (Dashboard)
  appointments: string;
  appointmentSingular: string;
  logVisit: string;

  // Settings Features
  features: string;
  darkMode: string;
  legalDocuments: string;
  version: string;
  themeCustomization: string;
  primaryColorLabel: string;
  buttonColorLabel: string;

  // Appointments
  bookAppointment: string;
  appointmentDetails: string;
  noAppointments: string;
  startTime: string;
  endTime: string;
  selectClient: string;
  selectDate: string;
  appointmentNotes: string;
  staff: string;
  allStaff: string;
  listView: string;
  scheduleView: string;
  calendarView: string;
  viewAppointments: string;
  nextWeek: string;
  useBookAppointmentButton: string;

  // Appointments Additional
  appointmentsTitle: string;
  noAppointmentsScheduled: string;
  appointmentsThisMonth: string;
  noAppointmentsThisMonth: string;
  noAppointmentsFor: string;
  editAppointment: string;
  deleteAppointment: string;
  deleteAppointmentConfirmTitle: string;
  deleteAppointmentConfirmMessage: string;
  cancelAppointment: string;
  cancelAppointmentConfirmTitle: string;
  cancelAppointmentConfirmMessage: string;
  appointmentCancelled: string;
  appointmentAmount: string;
  addToCalendar: string;
  googleCalendar: string;
  outlookCalendar: string;
  downloadIcs: string;
  otherCalendarsCaption: string;
  anyStaff: string;
  unassigned: string;
  clientLabel: string;
  dateLabel: string;
  timeLabel: string;
  startLabel: string;
  endLabel: string;
  toLabel: string;
  staffMemberLabel: string;
  durationLabel: string;
  priceLabel: string;
  freeLabel: string;
  serviceTitleLabel: string;
  notesLabel: string;
  appointmentTitlePlaceholderText: string;
  clientNotFound: string;
  clientRemoved: string;
  minLabel: string;
  hrLabel: string;
  dayLabel: string;
  weekLabel: string;
  monthLabel: string;

  // Appointment Status Indicators
  visitOngoing: string;
  nextVisit: string;
  upcomingVisit: string;
  pastAppointment: string;
  restoreAppointment: string;
  appointmentRestored: string;
  totalAppointments: string;
  appointmentsCount: string;
  restorePreviousAppointment: string;
  cancelledAppointments: string;
  noCancelledAppointments: string;
  appointmentRestoredMessage: string;
  selectAppointmentToRestore: string;
  selectAppointmentToEdit: string;
  noAppointmentsToEdit: string;
  tapToEditAppointment: string;

  // Book Appointment Modal
  bookAppointmentTitle: string;
  clientRequired: string;
  changeClient: string;
  searchForClient: string;
  emailAction: string;
  clientNotes: string;
  clientTags: string;
  staffMemberOptional: string;
  manageStaff: string;
  anyStaffOption: string;
  addStaffMembersToAssign: string;
  // Staff Management
  staffMembers: string;
  addStaff: string;
  editStaff: string;
  staffMember: string;
  noStaffMembers: string;
  noStaffForStore: string;
  noStaffForStoreDescription: string;
  showAllStaff: string;
  addStaffMembersDescription: string;
  staffInfoBanner: string;
  deleteStaffMember: string;
  deleteStaffMemberConfirm: string;
  staffNameRequired: string;
  nameLabel: string;
  colorLabel: string;
  thirtyMin: string;
  fortyFiveMin: string;
  oneHour: string;
  oneAndHalfHours: string;
  twoHours: string;
  customDuration: string;
  minutesUnit: string;
  timeSection: string;
  serviceTagsOptional: string;
  servicesRequired: string;
  pleaseSelectService: string;
  pleaseSelectStaff: string;
  noServiceTagsYet: string;
  notesOptional: string;
  anyAdditionalNotes: string;
  alreadyBookedDuringTime: string;
  staffConflictError: string;
  serviceTagsLabel: string;
  revenueWarning: string;
  trueLabel: string;

  // Appointment Notifications Settings
  notificationSettings: string;
  appointmentNotifications: string;
  notificationInfoBanner: string;
  confirmationEmailDesc: string;
  updateEmail: string;
  updateEmailDesc: string;
  cancellationEmailDesc: string;
  reminderEmailDesc: string;
  reminderTiming: string;
  twentyFourHoursBefore: string;
  twoHoursBefore: string;
  customTiming: string;
  hoursBefore: string;
  notificationComplianceNote: string;
  settingsSaved: string;

  // Recurring Appointments
  repeatAppointment: string;
  repeatDescription: string;
  frequency: string;
  everyTwoWeeks: string;
  customFrequency: string;
  weeks: string;
  endCondition: string;
  afterOccurrences: string;
  onDate: string;
  repeatTimes: string;
  times: string;
  selectEndDate: string;
  previewSeries: string;
  conflictsFound: string;
  scheduledDates: string;
  recurring: string;
  viewSeries: string;
  editThisOnly: string;
  editAllFuture: string;
  cancelThisOnly: string;
  cancelAllFuture: string;
  seriesAppointment: string;
  appointmentsInSeries: string;
  viewAppointment: string;
  editThisAppointment: string;
  promotionLabel: string;
  recurringAppointmentBadge: string;
  occurrenceLabel: string;
  counterTotal: string;
  counterUsingToday: string;
  counterRemaining: string;
  counterCreditApplied: string;

  // Multi-Store Compare Mode
  compareMode: string;
  compareModeDescription: string;
  selectStoresToCompare: string;
  storePerformance: string;
  topPerformingStore: string;
  fastestGrowingStore: string;
  biggestRevenueDrop: string;
  highestReturningRate: string;
  storeInsights: string;
  revenueByStore: string;
  topStoreThisMonth: string;
  appointmentsByStore: string;
  newClientsByStore: string;
  returningClientsByStore: string;
  returningClients: string;
  returningRate: string;
  noStoreDataAvailable: string;
  compareStores: string;
  storeRankings: string;
  vsLastPeriod: string;
  growthRate: string;
  selectAtLeastTwoStores: string;
  performanceOverview: string;

  // Services Management
  servicesTitle: string;
  servicesInfoBanner: string;
  noServicesYet: string;
  noServicesDescription: string;
  createFirstService: string;
  addService: string;
  editService: string;
  serviceName: string;
  serviceColor: string;
  createService: string;
  serviceNameRequired: string;
  serviceNameExists: string;
  serviceCreated: string;
  serviceUpdated: string;
  failedToSaveService: string;
  failedToDeleteService: string;
  serviceDeleted: string;

  // Staff form localization
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailOptional: string;
  storesLabel: string;
  servicesSkillsLabel: string;
  servicesSkillsHelper: string;
  noServicesAvailable: string;
  selectAtLeastOneStore: string;
  createStaffBtn: string;

  // Inline Add Service form (Edit Staff modal)
  newServiceTitle: string;
  serviceNameInputPlaceholder: string;
  minuteShort: string;
  createServiceBtn: string;
  staffCreated: string;
  staffUpdated: string;
  staffDeleted: string;
  failedToSaveStaff: string;
  failedToDeleteStaff: string;
  deleteStaffTitle: string;
  deleteStaffConfirm: string;

  // Store form localization
  enterStoreName: string;
  createStoreBtn: string;
  storeCreated: string;
  storeUpdated: string;
  storeDeleted: string;
  failedToSaveStore: string;
  failedToDeleteStore: string;
  deleteStoreTitle: string;
  deleteStoreConfirmBody: string;
  deleteStoreConfirmWithStaff: string;
  storeLimitReachedTitle: string;
  storeLimitReachedDesc: string;

  // Bulk Email Modal
  sendingStatus: string;
  sendToRecipients: string;
  filterRecipients: string;
  allClientsFilter: string;
  promotionUsersFilter: string;
  allTagsFilter: string;
  selectAllBtn: string;
  deselectAllBtn: string;
  optedOut: string;
  willReceive: string;
  blockedStatus: string;
  cannotSendEmail: string;
  optedOutMessage: string;

  // Bulk Email Enterprise Features
  previewTextLabel: string;
  previewTextPlaceholder: string;
  previewTextCounter: string;
  addImageOptimized: string;
  imageOptimizedBadge: string;
  imageTooBig: string;
  imageTooManyError: string;
  imageOptimizeFailed: string;
  imagesCounter: string;
  formattingBold: string;
  formattingItalic: string;
  formattingLink: string;
  formattingBullets: string;
  formattingSpacing: string;
  insertLinkLabel: string;
  insertLinkPlaceholder: string;
  lastVisitFilter: string;
  lastVisitAny: string;
  lastVisit7Days: string;
  lastVisit30Days: string;
  lastVisit90Plus: string;
  emailConsentFilter: string;
  emailConsentLocked: string;
  searchRecipientsPlaceholder: string;
  selectedCount: string;
  largeSendWarning: string;
  sendCampaignBtn: string;
  campaignQueued: string;
  emailsSentSuccessfully: string;
  processingStatus: string;
  unableToQueueCampaign: string;
  sendConfirmTitle: string;
  sendConfirmSubject: string;
  sendConfirmPreviewText: string;
  sendConfirmRecipients: string;
  sendConfirmAttachments: string;
  sendConfirmImages: string;
  sendConfirmBatchNote: string;
  subjectRequired: string;
  messageRequired: string;
  recipientsRequired: string;

  // Bulk Email Analytics Filters
  atRiskFilter: string;
  atRiskFilterDesc: string;
  topClientsFilter: string;
  topClientsFilterDesc: string;
  topClientsBy: string;
  topClientsByRevenue: string;
  topClientsByVisits: string;
  byServiceFilter: string;
  byServiceFilterDesc: string;
  visitFrequencyFilter: string;
  visitFrequencyFilterDesc: string;
  frequentClients: string;
  occasionalClients: string;
  oneTimeClients: string;
  filterByService: string;
  allServicesOption: string;
  noServicesFound: string;

  // Bulk Email Membership Filters
  membershipFilter: string;
  hasActiveMembership: string;
  membershipPastDue: string;
  membershipCancelledMembers: string;
  membershipTotalMembers: string;
  membershipPlanFilter: string;
  membershipCreditsUsed: string;
  membershipFreeServicesRedeemed: string;
  membershipMonthly: string;
  membershipYearly: string;
  membershipAnyPlan: string;

  // Bulk Email Loyalty Filters
  loyaltyFilter: string;
  hasLoyaltyPoints: string;
  activeLoyaltyMembers: string;
  rewardsRedeemed: string;
  highLoyaltyPoints: string;

  // Bulk Email Gift Card Filters
  giftCardFilter: string;
  hasActiveGiftCard: string;
  giftCardValueBased: string;
  giftCardServiceBased: string;
  giftCardBalance: string;
  giftCardAnyType: string;

  // Weekday abbreviations
  sunShort: string;
  monShort: string;
  tueShort: string;
  wedShort: string;
  thuShort: string;
  friShort: string;
  satShort: string;

  // Full weekday names
  sunday: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;

  // Client List Additional
  tryDifferentSearch: string;
  addFirstClient: string;
  clearSearch: string;
  noClientsYet: string;
  selectTagsToFilter: string;
  noTagsYet: string;
  createTagsInSettings: string;
  applyFilter: string;

  // Settings Page Additional
  addBusinessName: string;
  emailAddressLabel: string;
  addEmailAddress: string;
  businessAddressLabel: string;
  businessInformationLabel: string;
  businessPhoneNumberLabel: string;
  businessPhoneNumberPlaceholder: string;
  requiredForEmailCampaigns: string;
  schedulingFeaturesEnabled: string;
  tapToEnableScheduling: string;
  appointmentsOffDescription: string;
  enableBookAppointmentFeatures: string;
  darkThemeEnabled: string;
  lightThemeEnabled: string;
  darkModeDescription: string;
  soundAndHaptics: string;
  soundAndHapticsDescription: string;
  sounds: string;
  soundsEnabled: string;
  soundsDisabled: string;
  vibrations: string;
  vibrationsEnabled: string;
  vibrationsDisabled: string;
  noTagsYetCreateFirst: string;

  // File size limits
  fileTooLarge: string;
  fileSizeLimitExceeded: string;
  maxFileSizeLimit: string;
  totalAttachmentSizeLimit: string;
  attachmentHelperText: string;

  changePassword: string;
  emailAndChangePassword: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  passwordChangedSuccess: string;
  passwordsDoNotMatchError: string;
  currentPasswordIncorrect: string;

  // Theme Modal
  themeColors: string;
  resetToDefault: string;
  primaryColorDescription: string;
  buttonColorDescription: string;
  preview: string;
  headerPreview: string;
  headerPreviewDescription: string;
  buttonPreview: string;
  saveTheme: string;
  themeUpdatedSuccess: string;
  // Theme Color Names
  colorTeal: string;
  colorBlue: string;
  colorPurple: string;
  colorPink: string;
  colorRed: string;
  colorOrange: string;
  colorAmber: string;
  colorEmerald: string;
  colorIndigo: string;
  colorSlate: string;

  // Export Modal
  exportClientData: string;
  exportDescription: string;
  exportInstructions: string;
  exporting: string;
  exportSuccessMessage: string;
  exportFailedMessage: string;
  exportTimeframe: string;
  exportTimeframeDescription: string;
  exportDestination: string;
  exportDestinationHint: string;
  exportWhatsIncluded: string;
  exportClientsIncluded: string;
  exportVisitsIncluded: string;
  exportAppointmentsIncluded: string;
  exportRevenueIncluded: string;
  exportAnalyticsIncluded: string;
  exportContent: string;
  exportContentDescription: string;
  exportContentClients: string;
  exportContentVisits: string;
  exportContentAppointments: string;
  exportContentRevenue: string;
  exportContentAnalytics: string;
  exportSelectAtLeastOne: string;
  exportDay: string;
  exportWeek: string;
  exportMonth: string;
  exportQuarter: string;
  exportCustom: string;
  exportWeekly: string;
  exportBiWeekly: string;
  exportMonthly: string;
  exportTodayLabel: string;
  exportThisWeekLabel: string;
  exportThisMonthLabel: string;
  exportThisQuarterLabel: string;
  exportStartDateLabel: string;
  exportEndDateLabel: string;

  // Business Name Modal
  editBusinessName: string;
  businessShopNameLabel: string;
  businessNameDisplayDescription: string;
  enterBusinessName: string;
  updating: string;

  // Email Modal
  editEmailAddress: string;
  enterEmailAddress: string;

  // Business Address Modal
  editBusinessAddress: string;
  enterBusinessAddress: string;
  businessAddressHint: string;

  // Membership Modal
  manageMembership: string;
  activeSubscription: string;
  manageSubscription: string;
  membershipActive: string;
  membershipCancelled: string;
  cancelMembership: string;
  renewMembership: string;
  changePlan: string;
  selectPlan: string;
  expirationDate: string;
  welcomeBack: string;
  renewNowMessage: string;
  renew: string;
  yourPlan: string;
  freeTrialEnded: string;
  unlimitedClients: string;
  emailMarketing: string;
  dripAutomation: string;
  save20Percent: string;
  perYearBilled: string;
  perMonthBilled: string;

  // Call & Message
  call: string;
  messageAction: string;

  // Client Details
  promotionCounter: string;
  percentOff: string;
  fixedOff: string;
  programsCount: string;
  noPromotionCounters: string;
  recentHistory: string;
  countHistory: string;
  noHistoryYet: string;
  addCountRequired: string;
  selectServiceForCount: string;
  editCount: string;
  countAdded: string;
  countUpdated: string;
  originalValues: string;
  editedBadge: string;
  editedBy: string;
  serviceRequired: string;
  storeOptional: string;
  staffOptional: string;
  noteOptional: string;
  countsRecorded: string;
  countsRecordedPlural: string;
  noEntriesYet: string;
  noneLabel: string;
  countNumber: string;
  addPromoCounter: string;
  customProgram: string;
  counterTrackerDesc: string;
  newPromoCounter: string;
  pleaseSelectPromo: string;
  noCounterPromos: string;
  createCounterPromoHint: string;
  targetCount: string;
  targetCountHint: string;
  addCountsToSeeHere: string;
  noPromotionsUsedYet: string;
  promotionsWillAppearHere: string;

  // Log Visit Modal (new keys only)
  selectPromoOptional: string;
  noPromotionsAvailable: string;
  createPromotionsHint: string;
  searchClientsPlaceholder: string;
  noClientsAvailable: string;
  addNotesPlaceholder: string;

  // Currency
  currency: string;
  selectCurrency: string;

  // At Risk Settings
  atRiskSettings: string;
  atRiskSettingsDescription: string;
  daysWithoutVisit: string;
  daysLabel: string;
  atRiskExamples: string;
  apply: string;
  showingClientsNoVisits: string;
  noVisitInDays: string;
  lastVisitDate: string;
  noVisitsRecorded: string;
  noClientsWithVisitsYet: string;

  // Pricing Disclaimer
  pricingDisclaimer: string;
  pricingDisclaimerTitle: string;

  // Email & Campaign Legal Disclaimer
  emailLegalDisclaimerTitle: string;
  emailLegalDisclaimer: string;
  emailLegalRegionNote: string;

  // Country Selection
  selectCountry: string;
  countryForLegalCompliance: string;
  selectState: string;
  searchCountries: string;
  searchStates: string;
  countryLegalHelper: string;
  emailFooterLanguage: string;
  emailFooterLanguageHelper: string;
  legalRequirementsHelper: string;
  physicalBusinessAddress: string;
  countryRequired: string;
  stateRequired: string;

  // Drip Campaigns Additional
  sentImmediately: string;
  sentAfterDays: string;
  deleteCampaignConfirm: string;
  canSpamAddressRequired: string;
  every: string;
  everyXDays: string;
  dripClientsCount: string;
  emailsInSequence: string;
  moreEmailsCount: string;
  gdprComplianceNotice: string;
  confirmLawfulBasisBeforeActivate: string;
  mayIncludeEuRecipients: string;
  enableIfEuRecipients: string;
  euDataProtection: string;
  termsAcceptanceNote: string;
  termsAcceptanceNoteEu: string;
  beforeActivatingConfirm: string;
  footerAddedAutomatically: string;
  sentOnBehalf: string;
  unsubscribeLink: string;
  addBusinessAddressHint: string;
  yourBusinessName: string;
  businessAddressNotSet: string;
  emailSubjectPlaceholder: string;
  emailBodyPlaceholder: string;
  welcomeSeriesPlaceholder: string;
  createCampaignButton: string;
  templates: string;
  templateActivated: string;
  startSmartDripForAtRisk: string;

  // Email Footer Preview
  emailFooterPreview: string;

  // Form Placeholders
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  notesPlaceholder: string;
  businessNamePlaceholder: string;
  businessNameRequired: string;
  enterEmailPlaceholder: string;
  currentPasswordPlaceholder: string;
  newPasswordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  passwordMinLength: string;
  pleaseEnterCurrentPassword: string;
  currentPasswordMinLength: string;
  newPasswordMinLength: string;
  newPasswordsDoNotMatch: string;
  appointmentTitlePlaceholder: string;
  additionalNotesPlaceholder: string;
  visitNotesPlaceholder: string;
  staffNamePlaceholder: string;
  serviceNamePlaceholder: string;
  enterSubjectPlaceholder: string;
  writeMessagePlaceholder: string;
  clientInformation: string;
  businessAddressPlaceholder: string;
  tagNamePlaceholder: string;
  timePlaceholder: string;

  // Dashboard Stats subtitles
  clientsInDatabase: string;
  newClientsThisMonth: string;
  promotionsRedeemedByClients: string;
  clientsWithVisitHistory: string;
  promotionsUsedCount: string;

  // Client Details - Campaign Assignment
  clientSince: string;
  selectCampaign: string;
  noCampaign: string;
  removeFromAllCampaigns: string;
  noCampaignAssigned: string;
  createCampaignFromDashboard: string;

  // Privacy Policy & Cookie Policy
  cookiePolicy: string;
  privacyPolicyTitle: string;
  cookiePolicyTitle: string;
  dataWeCollect: string;
  howWeUseData: string;
  dataStorageSecurity: string;
  yourRights: string;
  legalCompliance: string;
  cookieUsage: string;
  noCookiesUsed: string;
  contactForPrivacy: string;
  lastUpdatedLabel: string;
  versionLabel: string;
  madeInUSA: string;
  companyAddress: string;
  forSupport: string;
  // LegalDisclaimerBox UI strings
  legalDisclaimerTitle: string;
  readFullTerms: string;
  iAcceptThe: string;
  termsAndConditionsLink: string;
  keyPointsToKnow: string;
  kpSoftwarePlatformOnly: string;
  kpBusinessOperatorResponsibility: string;
  kpGiftCardResponsibility: string;
  kpMaxLiabilityLimit: string;
  kpMarketingConsent: string;
  kpDataStorageSecurity: string;
  kpArbitrationDisputes: string;
  kpNoPartnership: string;
  kpAIInsightsOnly: string;
  socialSignInFailed: string;
  iUnderstandAndAccept: string;
  legalEmailComplianceContent: string;
  legalPricingContent: string;
  aboutThisPolicy: string;
  whatWeStorLocally: string;
  yourControl: string;
  thirdPartyServices: string;
  changesToThisPolicy: string;
  contactUs: string;

  // Stores Management
  mainStore: string;
  store: string;
  defaultStore: string;
  storesAndStaffMembers: string;
  teamAndServices: string;
  storesAndStaff: string;
  storesAndStaffDescription: string;
  storesStaffCalendar: string;
  storesStaffCalendarDescription: string;
  servicesAndProducts: string;
  servicesAndProductsDescription: string;
  service: string;
  product: string;
  addProduct: string;
  editProduct: string;
  createProduct: string;
  noProductsYet: string;
  productName: string;
  productNamePlaceholder: string;
  storesInfoBanner: string;
  addStore: string;
  editStore: string;
  addStaffMember: string;
  deleteStore: string;
  noStores: string;
  addStoresDescription: string;
  storeNameLabel: string;
  storeNamePlaceholder: string;
  storeNameRequired: string;
  deleteStoreConfirm: string;
  deleteStoreWithStaffConfirm: string;
  primaryStore: string;
  primaryStoreCannotBeDeleted: string;
  noStaffInStore: string;
  unassignedStaff: string;
  notAssignedToStore: string;
  assignToStore: string;
  selectStoreFirst: string;
  allStores: string;
  selectStore: string;
  createStoreFirst: string;
  createStoreToBook: string;
  stores: string;
  staffAssignedToMultipleStores: string;
  optional: string;
  noStoreSelected: string;
  storeRequired: string;
  pleaseSelectStoreForAppointment: string;
  selectStoreToSeeStaff: string;
  selectStaffMember: string;
  noStaffSelected: string;

  // Client Appointments
  upcomingAppointments: string;
  appointmentTime: string;
  noUpcomingAppointments: string;
  appointmentTimeLabel: string;
  noStoreAssigned: string;
  noStaffAssigned: string;
  noServicesSelected: string;
  noAmountSet: string;
  noPromotionApplied: string;
  noNotesAdded: string;
  services: string;
  promotion: string;
  amount: string;
  tapToEdit: string;

  // Face ID / Biometric Authentication
  faceId: string;
  enableFaceId: string;
  faceIdEnabled: string;
  faceIdDisabled: string;
  faceIdDescription: string;
  faceIdNotAvailable: string;
  faceIdNotEnrolled: string;
  faceIdLoginPrompt: string;
  faceIdEnableConfirm: string;
  faceIdDisableConfirm: string;
  faceIdRequiresPassword: string;
  usePasswordInstead: string;
  authenticateWithFaceId: string;
  biometricAuthFailed: string;
  security: string;

  // Face ID Legal & Privacy
  faceIdConsentDescription: string;
  faceIdPrivacyNotice: string;
  faceIdDataNotice: string;
  biometricAuthSection: string;
  biometricDataUsage: string;
  biometricDataStorage: string;
  biometricDataControl: string;
  biometricPrivacyCompliance: string;

  // Help Center / FAQ
  helpCenter: string;
  helpCenterDescription: string;
  searchHelp: string;
  searchHelpPlaceholder: string;
  noResultsFoundHelp: string;
  tryDifferentKeywords: string;
  searchResultsCount: string;
  contactSupport: string;
  contactSupportDescription: string;
  sendUsEmail: string;
  gettingStarted: string;
  accountSecurity: string;
  appFeatures: string;
  dataPrivacy: string;
  troubleshooting: string;

  // Help Center - Getting Started
  helpSignUpTitle: string;
  helpSignUpContent: string;
  helpLoginTitle: string;
  helpLoginContent: string;
  helpNavigationTitle: string;
  helpNavigationContent: string;

  // Help Center - Account & Security
  helpFaceIdTitle: string;
  helpFaceIdContent: string;
  helpChangePasswordTitle: string;
  helpChangePasswordContent: string;
  helpLogoutTitle: string;
  helpLogoutContent: string;

  // Help Center - App Features
  helpAppointmentsTitle: string;
  helpAppointmentsContent: string;
  helpClientsTitle: string;
  helpClientsContent: string;
  helpPromotionsTitle: string;
  helpPromotionsContent: string;
  helpAnalyticsTitle: string;
  helpAnalyticsContent: string;
  helpExportDataTitle: string;
  helpExportDataContent: string;
  helpDripCampaignsTitle: string;
  helpDripCampaignsContent: string;
  helpBulkEmailTitle: string;
  helpBulkEmailContent: string;

  // Help Center - Customization
  helpThemeColorsTitle: string;
  helpThemeColorsContent: string;
  helpDarkModeTitle: string;
  helpDarkModeContent: string;
  helpLanguageTitle: string;
  helpLanguageContent: string;
  helpSoundsVibrationsTitle: string;
  helpSoundsVibrationsContent: string;

  // Help Center - Data & Privacy
  helpPrivacyPolicyTitle: string;
  helpPrivacyPolicyContent: string;
  helpTermsTitle: string;
  helpTermsContent: string;
  helpCookiesTitle: string;
  helpCookiesContent: string;
  helpDataStorageTitle: string;
  helpDataStorageContent: string;

  // Help Center - Troubleshooting
  helpAppNotWorkingTitle: string;
  helpAppNotWorkingContent: string;
  helpDataSyncTitle: string;
  helpDataSyncContent: string;
  helpContactSupportTitle: string;
  helpContactSupportContent: string;

  // Help Center - Roles & Permissions FAQ
  faqRolesPermissions: string;
  helpWhatAreRolesTitle: string;
  helpWhatAreRolesContent: string;
  helpOwnerRoleTitle: string;
  helpOwnerRoleContent: string;
  helpManagerStaffRolesTitle: string;
  helpManagerStaffRolesContent: string;
  helpPermissionsControlTitle: string;
  helpPermissionsControlContent: string;
  helpPreviewModeTitle: string;
  helpPreviewModeContent: string;
  helpStaffInvitationTitle: string;
  helpStaffInvitationContent: string;
  helpInvitedNoSubscriptionTitle: string;
  helpInvitedNoSubscriptionContent: string;
  helpAccessManagementTitle: string;
  helpAccessManagementContent: string;
  helpSecurityDisclaimerTitle: string;
  helpSecurityDisclaimerContent: string;

  // Tags Management Section
  tagsTitle: string;
  tagsInfoBanner: string;
  tagsInfoBannerLong: string;
  noTagsDescription: string;
  createFirstTag: string;
  createTag: string;
  tagCreated: string;
  tagUpdated: string;
  tagDeleted: string;
  deleteTag: string;
  deleteTagConfirmation: string;
  tagNameRequired: string;

  // Appointment Date
  appointmentDateRequired: string;

  // Booking Page Language Settings
  bookingPageLanguage: string;
  bookingPageLanguageDescription: string;
  bookingPageLanguageInfo: string;
  bookingPageLanguageDisabledNote: string;
  enabledLanguages: string;
  smartLanguageDetection: string;
  smartLanguageDetectionDescription: string;
  defaultBookingLanguage: string;
  defaultBookingLanguageDescription: string;
  detection: string;
  defaultLanguage: string;
  requiredLabel: string;
  saving: string;
  englishRequiredExplanation: string;
  bookingLinkAndQr: string;
  bookingLinkAndQrDescription: string;
  settingsQrLinkTitle: string;
  settingsQrLinkSubtitle: string;
  settingsBrandingTitle: string;
  settingsBrandingSubtitle: string;
  copyLink: string;
  shareLink: string;
  downloadQr: string;
  downloadFlyer: string;
  emailToMe: string;
  linkCopied: string;
  qrDownloaded: string;
  flyerDownloaded: string;
  emailSentSuccess: string;
  yourBookingLink: string;
  languageLinkBuilder: string;
  languageLinkBuilderDescription: string;
  defaultLinkNoLang: string;
  forcedLanguageLink: string;
  businessLinksTitle: string;
  businessLinksDescription: string;
  businessLinkWebsite: string;
  businessLinkInstagram: string;
  businessLinkFacebook: string;
  businessLinkTikTok: string;
  businessLinkYouTube: string;
  businessLinkLinkedIn: string;
  businessLinkWhatsApp: string;
  businessLinkCustom: string;
  saveLinks: string;
  previewModeNotice: string;
  couldNotOpenBookingPage: string;
  couldNotCopyLink: string;
  sharingNotAvailable: string;
  addEmailInSettings: string;
  emailContentCopied: string;
  noMailAppCopied: string;
  emailFailedNetwork: string;
  emailFailedPermission: string;

  // Booking Link Email Content
  bookingLinkEmailSubject: string;
  bookingLinkEmailHeading: string;
  bookingLinkEmailIntro: string;
  bookingLinkEmailHowToUse: string;
  bookingLinkEmailTip1: string;
  bookingLinkEmailTip2: string;
  bookingLinkEmailTip3: string;
  bookingLinkEmailFooter: string;

  // Booking Branding Settings
  bookingCombined: string;
  bookingCombinedDescription: string;
  brandingAndLinks: string;
  bookingBranding: string;
  bookingBrandingDescription: string;
  businessLogo: string;
  logoHelperText: string;
  uploadLogo: string;
  replaceLogo: string;
  removeLogo: string;
  removeLogoConfirmation: string;
  logoUploaded: string;
  logoRemoved: string;
  primaryBrandColor: string;
  primaryColor: string;
  secondaryColor: string;
  secondaryColorOptional: string;
  brandPrimaryColorDescription: string;
  secondaryColorDescription: string;
  colorUpdated: string;
  livePreview: string;
  previewBookingPage: string;
  bookNow: string;
  noColor: string;
  photoPermissionRequired: string;
  invalidImageType: string;
  imageTooLarge: string;

  // Store photo upload errors
  storePhotoUploadUnsupportedFormat: string;
  storePhotoUploadTooLarge: string;
  storePhotoUploadFileNotFound: string;
  storePhotoUploadValidationFailed: string;
  storePhotoUploadCompressionFailed: string;
  storePhotoUploadNetworkError: string;
  storePhotoUploadServerError: string;
  storePhotoUploadGenericError: string;

  // Booking Email Templates
  bookingEmails: string;
  bookingEmailsDescription: string;
  confirmationEmail: string;
  cancellationEmail: string;
  rescheduledEmail: string;
  reminderEmail: string;
  emailEnabled: string;
  emailDisabled: string;
  customizeTemplate: string;
  resetTemplateToDefault: string;
  testEmail: string;
  sendTestEmail: string;
  testEmailSent: string;
  emailSubjectLabel: string;
  emailBodyLabel: string;
  reminderHours: string;
  reminderHoursDescription: string;
  placeholdersAvailable: string;
  templateSaved: string;
  templateReset: string;

  // Primary Location / Business Hours
  primaryLocation: string;
  primaryLocationSubtitle: string;
  businessHours: string;
  businessHoursHelper: string;
  openTime: string;
  closeTime: string;
  closed: string;
  hoursNotSet: string;
  applyToAllDays: string;

  // Online Booking Terms & FAQ (New Legal Sections)
  onlineBookingTerms: string;
  onlineBookingTermsTitle: string;
  staffPhotosIdentity: string;
  brandingLogosCustomization: string;
  onlineBookingSystem: string;
  businessHoursSpecialHours: string;
  qrCodesPublicLinks: string;
  comprehensiveLiabilityLimit: string;
  acknowledgmentSection: string;

  // FAQ - Online Booking Category
  faqOnlineBooking: string;
  faqStaffManagement: string;
  faqServicesProducts: string;
  faqBusinessConfiguration: string;

  // FAQ - How Online Booking Works
  helpOnlineBookingTitle: string;
  helpOnlineBookingContent: string;

  // FAQ - Staff Management
  helpAddStaffTitle: string;
  helpAddStaffContent: string;
  helpAssignStaffToStoresTitle: string;
  helpAssignStaffToStoresContent: string;
  helpAssignServicesToStaffTitle: string;
  helpAssignServicesToStaffContent: string;

  // FAQ - Services & Products
  helpServicesWorkTitle: string;
  helpServicesWorkContent: string;
  helpProductsWorkTitle: string;
  helpProductsWorkContent: string;

  // FAQ - Business Hours Configuration
  helpBusinessHoursTitle: string;
  helpBusinessHoursContent: string;
  helpSpecialHoursTitle: string;
  helpSpecialHoursContent: string;
  helpBlackoutDaysTitle: string;
  helpBlackoutDaysContent: string;

  // FAQ - Booking Availability
  helpBookingAvailabilityTitle: string;
  helpBookingAvailabilityContent: string;
  helpNoStaffForServiceTitle: string;
  helpNoStaffForServiceContent: string;
  helpDoubleBookingPreventionTitle: string;
  helpDoubleBookingPreventionContent: string;

  // FAQ - QR Codes & Links
  helpQrCodesTitle: string;
  helpQrCodesContent: string;
  helpPublicBookingLinksTitle: string;
  helpPublicBookingLinksContent: string;

  // FAQ - Branding
  helpBrandingLogosTitle: string;
  helpBrandingLogosContent: string;
  helpBrandingColorsTitle: string;
  helpBrandingColorsContent: string;

  // FAQ - Configuration Errors
  helpConfigurationErrorsTitle: string;
  helpConfigurationErrorsContent: string;

  // Staff Schedule
  staffHours: string;
  staffHoursHelper: string;
  weeklySchedule: string;
  staffWeeklyScheduleHelper: string;
  off: string;
  specialDays: string;
  specialDaysHelper: string;
  noSpecialDays: string;
  addSpecialDay: string;
  editSpecialDay: string;
  deleteSpecialDay: string;
  deleteSpecialDayConfirm: string;
  blackoutDates: string;
  blackoutDatesHelper: string;
  noBlackoutDates: string;
  addBlackout: string;
  editBlackout: string;
  deleteBlackout: string;
  deleteBlackoutConfirm: string;
  dayOff: string;
  dayOffHelper: string;
  workingHours: string;
  startDateTime: string;
  endDateTime: string;
  note: string;
  addNotePlaceholder: string;
  date: string;
  add: string;

  // RBAC - Roles & Permissions
  rolesAndPermissions: string;
  rolesAndPermissionsDescription: string;
  owner: string;
  manager: string;
  staffRole: string;
  ownerDescription: string;
  managerDescription: string;
  staffRoleDescription: string;
  permissions: string;
  permissionsFor: string;
  allPermissionsEnabled: string;
  ownerCannotBeModified: string;
  savePermissions: string;
  permissionsSaved: string;
  resetToDefaults: string;
  permissionsReset: string;
  shadowModeNotice: string;
  shadowModeDescription: string;

  // RBAC - Permission Categories
  rbacCategoryClients: string;
  rbacCategoryAppointments: string;
  rbacCategoryStaffManagement: string;
  rbacCategoryStores: string;
  rbacCategoryServices: string;
  rbacCategoryCampaigns: string;
  rbacCategoryPromotions: string;
  rbacCategoryAnalytics: string;
  rbacCategorySettings: string;
  rbacCategoryBilling: string;

  // RBAC - Client Permissions
  rbacPermissionClientsCreate: string;
  rbacPermissionClientsCreateDesc: string;
  rbacPermissionClientsEdit: string;
  rbacPermissionClientsEditDesc: string;
  rbacPermissionClientsDelete: string;
  rbacPermissionClientsDeleteDesc: string;
  rbacPermissionClientsArchive: string;
  rbacPermissionClientsArchiveDesc: string;
  rbacPermissionClientsExport: string;
  rbacPermissionClientsExportDesc: string;
  rbacPermissionClientsSendEmail: string;
  rbacPermissionClientsSendEmailDesc: string;

  // RBAC - Appointment Permissions
  rbacPermissionAppointmentsCreate: string;
  rbacPermissionAppointmentsCreateDesc: string;
  rbacPermissionAppointmentsEdit: string;
  rbacPermissionAppointmentsEditDesc: string;
  rbacPermissionAppointmentsDelete: string;
  rbacPermissionAppointmentsDeleteDesc: string;
  rbacPermissionAppointmentsCancel: string;
  rbacPermissionAppointmentsCancelDesc: string;

  // RBAC - Staff Management Permissions
  rbacPermissionStaffCreate: string;
  rbacPermissionStaffCreateDesc: string;
  rbacPermissionStaffEdit: string;
  rbacPermissionStaffEditDesc: string;
  rbacPermissionStaffDelete: string;
  rbacPermissionStaffDeleteDesc: string;
  rbacPermissionStaffAssignStores: string;
  rbacPermissionStaffAssignStoresDesc: string;
  rbacPermissionStaffManageSchedule: string;
  rbacPermissionStaffManageScheduleDesc: string;

  // RBAC - Store Permissions
  rbacPermissionStoresCreate: string;
  rbacPermissionStoresCreateDesc: string;
  rbacPermissionStoresEdit: string;
  rbacPermissionStoresEditDesc: string;
  rbacPermissionStoresDelete: string;
  rbacPermissionStoresDeleteDesc: string;
  rbacPermissionStoresManageHours: string;
  rbacPermissionStoresManageHoursDesc: string;

  // RBAC - Service Permissions
  rbacPermissionServicesCreate: string;
  rbacPermissionServicesCreateDesc: string;
  rbacPermissionServicesEdit: string;
  rbacPermissionServicesEditDesc: string;
  rbacPermissionServicesDelete: string;
  rbacPermissionServicesDeleteDesc: string;

  // RBAC - Campaign Permissions
  rbacPermissionCampaignsCreate: string;
  rbacPermissionCampaignsCreateDesc: string;
  rbacPermissionCampaignsEdit: string;
  rbacPermissionCampaignsEditDesc: string;
  rbacPermissionCampaignsDelete: string;
  rbacPermissionCampaignsDeleteDesc: string;
  rbacPermissionCampaignsActivate: string;
  rbacPermissionCampaignsActivateDesc: string;
  rbacPermissionCampaignsSend: string;
  rbacPermissionCampaignsSendDesc: string;

  // RBAC - Promotion Permissions
  rbacPermissionPromotionsCreate: string;
  rbacPermissionPromotionsCreateDesc: string;
  rbacPermissionPromotionsEdit: string;
  rbacPermissionPromotionsEditDesc: string;
  rbacPermissionPromotionsDelete: string;
  rbacPermissionPromotionsDeleteDesc: string;
  rbacPermissionPromotionsActivate: string;
  rbacPermissionPromotionsActivateDesc: string;

  // RBAC - Analytics Permissions
  rbacPermissionAnalyticsViewRevenue: string;
  rbacPermissionAnalyticsViewRevenueDesc: string;
  rbacPermissionAnalyticsExport: string;
  rbacPermissionAnalyticsExportDesc: string;

  // RBAC - Settings Permissions
  rbacPermissionSettingsBusinessInfo: string;
  rbacPermissionSettingsBusinessInfoDesc: string;
  rbacPermissionSettingsTheme: string;
  rbacPermissionSettingsThemeDesc: string;
  rbacPermissionSettingsBookingPage: string;
  rbacPermissionSettingsBookingPageDesc: string;
  rbacPermissionSettingsRolesPermissions: string;
  rbacPermissionSettingsRolesPermissionsDesc: string;

  // RBAC - Billing Permissions
  rbacPermissionBillingView: string;
  rbacPermissionBillingViewDesc: string;
  rbacPermissionBillingManage: string;
  rbacPermissionBillingManageDesc: string;
  rbacPermissionBillingCancelSubscription: string;
  rbacPermissionBillingCancelSubscriptionDesc: string;

  // Team Access & Permissions (unified section)
  teamAccessPermissions: string;
  teamAccessPermissionsDescription: string;

  // Staff Invites
  staffAccess: string;
  staffAccessDescription: string;
  inviteTeamMember: string;
  inviteByEmail: string;
  selectRole: string;
  assignToStores: string;
  allStoresAccess: string;
  specificStores: string;
  sendInvite: string;
  pendingInvites: string;
  noPendingInvites: string;
  inviteSent: string;
  inviteExpires: string;
  resendInvite: string;
  cancelInvite: string;
  inviteCancelled: string;
  inviteResent: string;
  teamMembers: string;
  noTeamMembers: string;
  invitedBy: string;
  joinedOn: string;
  removeMember: string;
  memberRemoved: string;
  cannotRemoveOwner: string;
  ownerCannotBeRemoved: string;
  inviteAlreadyExists: string;
  ownerRole: string;
  managerRole: string;
  staffMemberRole: string;
  ownerRoleDescription: string;
  managerRoleDescription: string;
  staffMemberRoleDescription: string;
  inviteExpiresIn: string;
  copyInviteLink: string;

  // Gift Cards
  giftCards: string;
  giftCardsDescription: string;
  createGiftCard: string;
  editGiftCard: string;
  giftCardDetails: string;
  giftCardCode: string;
  giftCardType: string;
  valueBased: string;
  serviceBased: string;
  valueBasedDescription: string;
  serviceBasedDescription: string;
  giftCardValue: string;
  remainingBalance: string;
  giftCardServices: string;
  selectGiftCardServices: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  purchaserName: string;
  personalMessage: string;
  personalMessagePlaceholder: string;
  giftCardExpiration: string;
  noExpiration: string;
  setExpiration: string;
  // Legal compliance keys
  giftCardLegalNoticeUS: string;
  giftCardLegalNoticeCA: string;
  giftCardLegalNoticeAU: string;
  giftCardLegalNoticeEU: string;
  giftCardLegalNoticeUK: string;
  giftCardExpirationMinimumLabel: string;
  giftCardNoExpiryLabel: string;
  giftCardFiveYearLabel: string;
  giftCardTwoYearLabel: string;
  giftCardThreeYearLabel: string;
  giftCardExpirationTooShortWarning: string;
  giftCardMustNotExpireWarning: string;
  giftCardStatus: string;
  statusActive: string;
  statusFullyUsed: string;
  statusExpired: string;
  statusCancelled: string;
  giftCardPreview: string;
  issueGiftCard: string;
  redeemGiftCard: string;
  applyGiftCard: string;
  enterGiftCardCode: string;
  giftCardNotFound: string;
  giftCardExpired: string;
  giftCardFullyUsed: string;
  giftCardCancelled: string;
  insufficientBalance: string;
  insufficientServices: string;
  giftCardApplied: string;
  giftCardCreated: string;
  giftCardHistory: string;
  giftCardTransactions: string;
  redemptionDate: string;
  amountRedeemed: string;
  serviceRedeemed: string;
  noGiftCards: string;
  noGiftCardAvailable: string;
  noGiftCardSelected: string;
  noGiftCardsDescription: string;
  createFirstGiftCard: string;
  giftCardSettings: string;
  enableGiftCards: string;
  allowValueBased: string;
  allowServiceBased: string;
  presetAmounts: string;
  customAmount: string;
  allowCustomAmount: string;
  minAmount: string;
  maxAmount: string;
  defaultExpiration: string;
  monthsLabel: string;
  giftCardCredit: string;
  assignToClient: string;
  giftCardAssigned: string;
  lookupGiftCard: string;
  scanOrEnterCode: string;
  available: string;
  usedLabel: string;
  originalValue: string;
  issuedOn: string;
  expiresOn: string;
  neverExpires: string;
  serviceQuantity: string;
  quantityRemaining: string;
  redeemValue: string;
  redeemService: string;
  enterRedemptionAmount: string;
  selectServiceToRedeem: string;
  confirmRedemption: string;
  redemptionSuccess: string;
  cancelGiftCard: string;
  cancelGiftCardConfirm: string;
  // Gift Card Modal - Client Details
  totalBalance: string;
  valueCards: string;
  serviceCards: string;
  activeGiftCards: string;
  redeemed: string;
  giftCardPurchased: string;
  valueRedeemed: string;
  giftCardsWillAppearHere: string;
  // Gift Card UI – store, filtering, revenue
  cardColor: string;
  selectStoreForGiftCard: string;
  storeForGiftCard: string;
  tapToView: string;
  viewInsights: string;
  mostRecent: string;
  clientsWithActiveCards: string;
  giftCardRevenue: string;
  totalIssued: string;
  valueBasedIssued: string;
  monthlyBreakdown: string;
  noRevenueData: string;
  noRevenueDataDesc: string;
  cardsLabel: string;
  issuedAtStore: string;
  createdOn: string;
  expiresLabel: string;
  activityTimeline: string;
  noActivityYet: string;
  giftCardIssued: string;
  unknownStore: string;
  giftCardSalesByStore: string;
  // Gift Card preview image labels
  servicesIncluded: string;
  yourGiftCardCode: string;
  forRecipientLabel: string;
  moreServicesCount: string;
  giftCardAvailableLabel: string;
  giftCardRedeemed: string;
  refund: string;
  giftCardIssuedCode: string;
  giftCardRedeemedCode: string;
  refundCode: string;
  adjustmentActivity: string;
  adjustmentActivityCode: string;
  expiredActivity: string;
  activityCodeLabel: string;
  // Recent Activity row labels (Client Details → Gift Card Credit)
  activityGiftCardUsed: string;
  activityGiftCardIssued: string;
  activityServiceUsed: string;
  activitySession: string;
  activitySessions: string;
  inactiveGiftCards: string;
  fullyRedeemed: string;

  // Membership Program
  membershipProgram: string;
  membershipProgramDescription: string;
  membershipGlobalSettings: string;
  membershipEnableProgram: string;
  membershipProgramEnabled: string;
  membershipProgramDisabled: string;
  membershipNotifyBeforeRenewal: string;
  membershipNotifyBeforeRenewalDescription: string;
  membershipNotifyPastDue: string;
  membershipNotifyPastDueDescription: string;
  membershipGracePeriod: string;
  membershipGracePeriodDescription: string;
  membershipPlans: string;
  membershipNoPlans: string;
  membershipNoPlansDescription: string;
  membershipCreateNewPlan: string;
  membershipCreatePlan: string;
  membershipEditPlan: string;
  membershipUpdatePlan: string;
  membershipDeletePlan: string;
  membershipDeletePlanTitle: string;
  membershipDeletePlanMessage: string;
  membershipPlanName: string;
  membershipPlanNamePlaceholder: string;
  membershipPlanDescription: string;
  membershipPlanDescriptionPlaceholder: string;
  membershipDisplayPrice: string;
  membershipRenewalCycle: string;
  membershipCycleMonthly: string;
  membershipCycleYearly: string;
  membershipCycleCustom: string;
  membershipCustomIntervalDays: string;
  membershipAutoRenewTracking: string;
  membershipAutoRenewTrackingDescription: string;
  membershipBenefits: string;
  membershipAddBenefit: string;
  membershipEditBenefit: string;
  membershipNoBenefits: string;
  membershipBenefitType: string;
  membershipBenefitTypeDiscount: string;
  membershipBenefitTypeFreeService: string;
  membershipBenefitTypeMonthlyCredit: string;
  membershipBenefitTypeCustomPerk: string;
  membershipBenefitDiscount: string;
  membershipBenefitFreeService: string;
  membershipBenefitMonthlyCredit: string;
  membershipBenefitCustomPerk: string;
  membershipDiscountPercent: string;
  membershipSelectService: string;
  membershipServiceQuantity: string;
  membershipPerCycle: string;
  membershipCreditAmount: string;
  membershipCustomPerkDescription: string;
  membershipCustomPerkPlaceholder: string;
  membershipPlanActive: string;
  membershipPlanActiveDescription: string;
  membershipInactive: string;
  membershipInformation: string;
  membershipPurchaseDate: string;
  membershipActiveSince: string;
  membershipInactivePlans: string;
  membershipActiveMembers: string;
  membershipEstimatedRevenue: string;
  membershipRevenueNote: string;
  membershipTopPlans: string;
  membershipMembers: string;
  membershipNoAnalyticsData: string;
  membershipNoAnalyticsDataDescription: string;
  membershipNoActiveMembers: string;
  membershipNoPastDueMembers: string;
  membershipPromoName: string;
  membershipPromoContext: string;
  membershipBenefitOff: string;
  membershipBenefitCredit: string;
  membershipBenefitUsage: string;
  membershipMoreBenefits: string;

  // Loyalty Program
  loyaltyProgramTitle: string;
  loyaltyProgramDescription: string;
  loyaltyProgramSettings: string;
  loyaltyEnableProgram: string;
  loyaltyEnableProgramDescription: string;
  loyaltyPointsPerDollar: string;
  loyaltyPointsPerDollarDescription: string;
  loyaltySaved: string;
  loyaltyReset: string;
  loyaltyEditPointsPerCurrency: string;
  loyaltyEditPointsDescription: string;
  loyaltyPointsAbbr: string;
  loyaltyNotifyOnReward: string;
  loyaltyNotifyOnRewardDescription: string;
  loyaltyRewards: string;
  loyaltyRewardsDescription: string;
  loyaltyNoRewards: string;
  loyaltyNoRewardsDescription: string;
  loyaltyCreateReward: string;
  loyaltyEditReward: string;
  loyaltyDeleteReward: string;
  loyaltyRewardTitle: string;
  loyaltyRewardTitlePlaceholder: string;
  loyaltyRewardDescription: string;
  loyaltyRewardDescriptionPlaceholder: string;
  loyaltyPointsRequired: string;
  loyaltyPointsRequiredPlaceholder: string;
  loyaltyLinkedService: string;
  loyaltyLinkedServiceDescription: string;
  loyaltyCreditAmount: string;
  loyaltyCreditAmountDescription: string;
  loyaltyUnlockMessage: string;
  loyaltyUnlockMessagePlaceholder: string;
  loyaltyRewardActive: string;
  loyaltyRewardActiveDescription: string;
  loyaltyRewardInactive: string;
  loyaltyAnalytics: string;
  loyaltyTotalPointsIssued: string;
  loyaltyTotalPointsRedeemed: string;
  loyaltyTotalRewardsRedeemed: string;
  loyaltyActiveMembers: string;
  loyaltyRevenueInfluenced: string;
  loyaltyAveragePoints: string;
  loyaltyTopRewards: string;
  loyaltyTopClients: string;
  loyaltyRedemptionRate: string;
  loyaltyAvgPointsPerMember: string;
  loyaltyPointsLiability: string;
  loyaltyNoAnalyticsData: string;
  loyaltyNoAnalyticsDataDescription: string;
  loyaltyStatus: string;
  loyaltyActive: string;
  loyaltyDisabled: string;
  loyaltyParticipates: string;
  loyaltyCurrentPoints: string;
  loyaltyLifetimePoints: string;
  loyaltyAvailableRewards: string;
  loyaltyRedemptionHistory: string;
  loyaltyNoRedemptions: string;
  loyaltyRewardAvailable: string;
  loyaltyPointsNeeded: string;
  loyaltyPoints: string;
  loyaltyRedeemReward: string;
  loyaltyConfirmRedemption: string;
  loyaltyRedemptionSuccess: string;
  loyaltyNotEnrolled: string;
  loyaltyEnrollClient: string;
  loyaltyDisableClient: string;
  loyaltyEnableClient: string;
  loyaltyTransactionHistory: string;
  loyaltyPointsEarned: string;
  loyaltyPointsUsed: string;
  loyaltyPointsAdjusted: string;
  loyaltyPointsExpired: string;
  loyaltyFromPurchase: string;
  loyaltyFromRedemption: string;
  loyaltyManualAdjustment: string;
  loyaltyEnrollConfirm: string;
  loyaltyUnenrollConfirm: string;
  loyaltyConfirmTitle: string;
  loyaltyActivateProgram: string;
  loyaltyCurrentBalance: string;
  loyaltyLifetimeEarned: string;
  loyaltyEnrolledInLoyalty: string;
  loyaltyEarnsPointsOnPurchases: string;
  loyaltyTapToEnroll: string;
  loyaltyAllRewards: string;
  loyaltyProgress: string;
  loyaltyPtsToGo: string;
  loyaltyRecentActivity: string;
  loyaltyRewardRedeemed: string;
  loyaltyBonusPoints: string;
  loyaltyAdjustment: string;
  loyaltyNoActivity: string;
  loyaltyPointsAppearOnPurchases: string;

  // Staff Calendar
  staffCalendar: string;
  staffCalendarSubtitle: string;
  twoWeeks: string;
  threeWeeks: string;
  autoSchedule: string;
  autoScheduleButton: string;
  copyWeek: string;
  shareSchedule: string;
  exportSchedule: string;
  scheduleRange: string;
  selectStaff: string;
  selectAllStaff: string;
  clearSelection: string;
  clearFilter: string;
  openDays: string;
  weeksLabel: string;
  newShift: string;
  editShift: string;
  createShift: string;
  updateShift: string;
  shiftCreated: string;
  shiftUpdated: string;
  shiftDeleted: string;
  failedToSaveShift: string;
  failedToDeleteShift: string;
  storeClosed: string;
  storeClosedOnDay: string;
  storeClosedSpecialHours: string;
  noStaffAvailable: string;
  noStaffAvailableMessage: string;
  validationError: string;
  pleaseSelectStaffMember: string;
  pleaseEnterValidStartTime: string;
  pleaseEnterValidEndTime: string;
  endTimeMustBeAfterStartTime: string;
  pleaseEnterBothBreakTimes: string;
  pleaseEnterValidBreakStartTime: string;
  pleaseEnterValidBreakEndTime: string;
  breakEndMustBeAfterStart: string;
  breakTimesMustBeWithinShift: string;
  overlappingShift: string;
  overlappingShiftMessage: string;
  overlappingShiftDetail: string;
  selectionRequired: string;
  pleaseSelectAtLeastOneStaff: string;
  noShiftsCreated: string;
  noShiftsCreatedMessage: string;
  shareStaffSchedule: string;
  pdfSavedSuccess: string;
  exportFailed: string;
  printFailed: string;
  printFailedMessage: string;
  failedToCopyShifts: string;
  failedToApplyDefaults: string;
  noStaff: string;
  noStaffMessage: string;
  staffNameLabel: string;
  staffEmailLabel: string;
  unknownStaff: string;
  shareAsText: string;
  mondayFull: string;
  tuesdayFull: string;
  wednesdayFull: string;
  thursdayFull: string;
  fridayFull: string;
  saturdayFull: string;
  sundayFull: string;
  staffSchedule: string;

  // Staff Calendar Additional (i18n)
  currentWeekLabel: string;
  thisWeekStaff: string;
  noStaffAssignedToStore: string;
  assignStaffToStoreInSettings: string;
  shiftsThisWeek: string;
  shiftThisWeek: string;
  noShiftsScheduled: string;
  noStaffAssignedToStoreEmpty: string;
  staffMemberRequired: string;
  noStaffAvailableTitle: string;
  noStaffMembersAssignedTo: string;
  assignStaffInSettingsHint: string;
  dayOfWeekRequired: string;
  shiftHoursRequired: string;
  shiftStartLabel: string;
  shiftEndLabel: string;
  toTimeLabel: string;
  use24HourFormatHint: string;
  lunchBreakOptional: string;
  staffUnavailableDuringBreak: string;
  breakStartLabel: string;
  breakEndLabel: string;
  enterBothBreakTimesHint: string;
  selectStaffMemberHint: string;
  applyCount: string;
  autoScheduleDescription: string;
  shiftsScheduled: string;
  shiftScheduled: string;
  exportScheduleTitle: string;
  exportAsPdf: string;
  professionalScheduleDocument: string;
  shareAsTextOption: string;
  quickShareViaMessages: string;
  exportAsCsv: string;
  spreadsheetFormatExcel: string;
  printOption: string;
  sendToNearbyPrinter: string;
  closedDayLabel: string;
  deleteCounter: string;
  deleteCounterConfirm: string;

  // AdBenefit
  adBenefit: string;
  adBenefitDescription: string;
  adBenefitOffers: string;
  adBenefitOffersDescription: string;
  adBenefitTemplates: string;
  adBenefitCreateOffer: string;
  adBenefitNewOffer: string;
  adBenefitEditOffer: string;
  adBenefitOfferName: string;
  adBenefitOfferNamePlaceholder: string;
  adBenefitOfferDetails: string;
  adBenefitOfferDetailsPlaceholder: string;
  adBenefitOfferType: string;
  adBenefitTypeDiscount: string;
  adBenefitTypeBundle: string;
  adBenefitTypeFlashSale: string;
  adBenefitTypeReferral: string;
  adBenefitDiscountValue: string;
  adBenefitDiscountValuePlaceholder: string;
  adBenefitStartDate: string;
  adBenefitEndDate: string;
  adBenefitSetEndDate: string;
  adBenefitActive: string;
  adBenefitInactive: string;
  adBenefitActiveOffers: string;
  adBenefitInactiveOffers: string;
  adBenefitNoOffers: string;
  adBenefitNoOffersDescription: string;
  adBenefitActivate: string;
  adBenefitDeactivate: string;
  adBenefitDelete: string;
  adBenefitDeleteConfirm: string;
  adBenefitSave: string;
  adBenefitCancel: string;
  adBenefitSaved: string;
  adBenefitShareOffer: string;
  adBenefitShareOfferDescription: string;
  adBenefitBoostedReach: string;
  adBenefitBoostedReachDescription: string;
  adBenefitTipTitle: string;
  adBenefitTipBody: string;
  adBenefitTplFlashTitle: string;
  adBenefitTplFlashDesc: string;
  adBenefitTplBundleTitle: string;
  adBenefitTplBundleDesc: string;
  adBenefitTplReferralTitle: string;
  adBenefitTplReferralDesc: string;
  adBenefitTplSeasonalTitle: string;
  adBenefitTplSeasonalDesc: string;
  adBenefitTplWelcomeTitle: string;
  adBenefitTplWelcomeDesc: string;
  adBenefitTemplatesSection: string;
  adBenefitTemplatesCount: string;
  adBenefitTemplateUse: string;
  adBenefitTemplateBadgeFlash: string;
  adBenefitTemplateBadgeBundle: string;
  adBenefitTemplateBadgeReferral: string;
  adBenefitTemplateBadgeSeasonal: string;
  adBenefitTemplateBadgeWelcome: string;
  adBenefitInfoTitle: string;
  adBenefitInfoBody: string;
  adBenefitEvolutionNote: string;
  adBenefitEditabilityTitle: string;
  adBenefitEditabilityBody: string;

  // ============================================================
  // Marketing Promo Templates — UI Labels
  // ============================================================
  promoTemplatesTitle: string;
  promoTemplatesSubtitle: string;
  promoTemplatesEvolvingLabel: string;
  promoTemplatesEvolvingBody: string;
  promoTemplatesReadyMade: string;
  promoTemplatesAvailable: string;
  promoTemplateTapToUse: string;
  promoTemplatesStartingPoint: string;
  promoTemplatesFullyEditable: string;
  promoTabPromos: string;
  promoTabTemplates: string;
  promosFreeAfterServices: string;
  promosOff: string;
  promosPercentOff: string;

  // Marketing Promo Template Names
  promoTplLoyaltyName: string;
  promoTplWelcomeName: string;
  promoTplReferralPromoName: string;
  promoTplSeasonalName: string;
  promoTplBundleName: string;
  promoTplFlashSaleName: string;
  promoTplServiceBundleName: string;
  promoTplReferFriendName: string;
  promoTplBirthdayName: string;
  promoTplVipName: string;

  // Marketing Promo Template Descriptions
  promoTplLoyaltyDesc: string;
  promoTplWelcomeDesc: string;
  promoTplReferralPromoDesc: string;
  promoTplSeasonalDesc: string;
  promoTplBundleDesc: string;
  promoTplFlashSaleDesc: string;
  promoTplServiceBundleDesc: string;
  promoTplReferFriendDesc: string;
  promoTplBirthdayDesc: string;
  promoTplVipDesc: string;

  // Marketing Promo Template otherDiscountDescriptions
  promoTplFlashSaleOtherDesc: string;
  promoTplServiceBundleOtherDesc: string;
  promoTplReferFriendOtherDesc: string;

  // Marketing Promo Template Badges
  promoTplBadgeMostPopular: string;
  promoTplBadgeNewClients: string;
  promoTplBadgeReferrals: string;
  promoTplBadgeLimitedTime: string;
  promoTplBadgeRetention: string;
  promoTplBadgeUrgency: string;
  promoTplBadgeUpsell: string;
  promoTplBadgeGrowth: string;
  promoTplBadgeLoyalty: string;
  promoTplBadgeVip: string;

  // ============================================================
  // Drip Campaign Templates — UI Labels
  // ============================================================
  dripTemplatesTitle: string;
  dripTemplatesSubtitle: string;
  dripOfficialTemplates: string;
  yourCampaigns: string;
  dripTemplatesAvailable: string;
  dripOfficialBadge: string;
  dripOfficialContentNote: string;
  dripCustomCampaignsTitle: string;
  dripCustomCampaignsHint: string;
  dripActivateTemplateTitle: string;
  dripActivateButton: string;
  dripSendFrequencyLabel: string;
  dripEvery: string;
  dripDays: string;
  dripAutomationTriggerLabel: string;
  dripPreviewEmails: string;
  dripEmailNumber: string;
  dripSentDaysAfterPrevious: string;
  dripBusinessInfoNote: string;

  // Drip Send Frequency Options
  dripFreqOnce: string;
  dripFreqWeekly: string;
  dripFreqBiweekly: string;
  dripFreqMonthly: string;
  dripFreqCustom: string;

  // Drip Automation Trigger Labels
  dripTriggerNewClient: string;
  dripTriggerNewClientDesc: string;
  dripTriggerActiveMonthly: string;
  dripTriggerActiveMonthlyDesc: string;
  dripTriggerAtRisk: string;
  dripTriggerAtRiskDesc: string;
  dripTriggerPromotionUsers: string;
  dripTriggerPromotionUsersDesc: string;
  dripTriggerHighSpend: string;
  dripTriggerHighSpendDesc: string;
  dripTriggerCustom: string;
  dripTriggerCustomDesc: string;

  // Drip Template Names
  dripTplWelcomeName: string;
  dripTplMonthlyLoyalName: string;
  dripTplAtRiskName: string;
  dripTplPromoFollowUpName: string;
  dripTplHighValueName: string;
  dripTplPostVisitName: string;
  dripTplBirthdayName: string;
  dripTplCareTipsName: string;
  dripTplRebookingName: string;
  dripTplLongTermName: string;

  // Drip Template Descriptions
  dripTplWelcomeDesc: string;
  dripTplMonthlyLoyalDesc: string;
  dripTplAtRiskDesc: string;
  dripTplPromoFollowUpDesc: string;
  dripTplHighValueDesc: string;
  dripTplPostVisitDesc: string;
  dripTplBirthdayDesc: string;
  dripTplCareTipsDesc: string;
  dripTplRebookingDesc: string;
  dripTplLongTermDesc: string;

  // Drip Template Email Subjects
  dripTplWelcomeSubject1: string;
  dripTplMonthlyLoyalSubject1: string;
  dripTplAtRiskSubject1: string;
  dripTplAtRiskSubject2: string;
  dripTplPromoFollowUpSubject1: string;
  dripTplHighValueSubject1: string;
  dripTplPostVisitSubject1: string;
  dripTplBirthdaySubject1: string;
  dripTplCareTipsSubject1: string;
  dripTplRebookingSubject1: string;
  dripTplRebookingSubject2: string;
  dripTplLongTermSubject1: string;

  // Drip Template Email Bodies
  dripTplWelcomeBody1: string;
  dripTplMonthlyLoyalBody1: string;
  dripTplAtRiskBody1: string;
  dripTplAtRiskBody2: string;
  dripTplPromoFollowUpBody1: string;
  dripTplHighValueBody1: string;
  dripTplPostVisitBody1: string;
  dripTplBirthdayBody1: string;
  dripTplCareTipsBody1: string;
  dripTplRebookingBody1: string;
  dripTplRebookingBody2: string;
  dripTplLongTermBody1: string;

  // Book Appointment — Gift Card Row
  clientWillUseGiftCard: string;
  giftCardWillBeDebitedOnCompletion: string;
  noGiftCardForAppointment: string;
  servicesRemaining: string;
  usesLeft: string;
  andMore: string;

  // Book Appointment — Staff-Service Filter Toast
  someServicesRemovedTitle: string;
  someServicesRemovedMessage: string;

  // Appointment Lifecycle
  statusScheduled: string;
  statusCheckedIn: string;
  statusPendingConfirmation: string;
  statusCompleted: string;
  statusNoShow: string;
  confirmOutcome: string;
  logVisitPendingConfirmation: string;
  visitTitle: string;
  visitServiceSingular: string;
  visitServicesPlural: string;
  checkInClient: string;
  markCompleted: string;
  outcomeQuestion: string;
  outcomeCompleted: string;
  outcomeNoShow: string;
  outcomeCancelled: string;
  outcomeCompletedDesc: string;
  outcomeNoShowDesc: string;
  outcomeCancelledDesc: string;
  outcomeQuestionShort: string;
  outcomeCompletedGiftCard: string;
  outcomeCompletedNoGiftCardDesc: string;
  outcomeCompletedGiftCardDesc: string;
  outcomeNoRevenueNoDebit: string;
  outcomeNoShowDesc2: string;
  outcomeCancelledDesc2: string;
  checkedInAt: string;
  completedAt: string;
  searchAppointmentsPlaceholder: string;
  statusLabel: string;
  onlineBookingBadge: string;
  confirmationCodeLabel: string;
  selectDateLabel: string;
  atTimeConnector: string;
  cancelLabel: string;
  // Gift Card dropdown — Edit Appointment
  giftCardIncludedServices: string;
  giftCardMoreServices: string;
  giftCardStatusActive: string;
  giftCardStatusExpired: string;
  giftCardStatusInactive: string;
  noGiftCardOption: string;
  giftCardOptional: string;
  selectClientFirst: string;
  noGiftCardsAvailable: string;

  // View Appointment — Gift Card section labels
  serviceDeducted: string;
  serviceToDeduct: string;
  servicesRemainingBefore: string;
  servicesRemainingAfter: string;
  issuedLabel: string;
  newBalanceLabel: string;
  serviceNotFoundOnGiftCard: string;
  serviceRedeemedLoading: string;
  leftLabel: string;
  giftCardLabel: string;
  originalCreditLabel: string;
  deductedLabel: string;
  notYetDebitedLabel: string;
  debitedLabel: string;
  noGiftCardUsed: string;
  noGiftCardDeductionRecorded: string;
  keepAppointment: string;
  appointmentCanceledSuccess: string;
  appointmentUpdated: string;

  // Smart Recommendations
  smartRecommendationWinback: string;
  smartRecommendationMembershipRenewal: string;
  smartRecommendationMemberExclusive: string;
  smartRecommendationGiftcardReminder: string;
  smartRecommendationGiftcardBestMonth: string;
  smartRecommendationLoyaltyBoost: string;
  smartRecommendationLoyaltyPoints: string;
  smartRecommendationNewClientsConvert: string;
  smartRecommendationRevenueGrowth: string;
  smartRecommendationPromoFollowup: string;
  smartRecommendationTopServicePromote: string;
  // SmartTrip pre-fill campaign names
  smartTripWinbackName: string;
  smartTripWelcomeName: string;
  smartTripLoyaltyGrowthName: string;
  smartTripPromoFollowupName: string;
  smartTripTopServiceName: string;
  smartTripMemberRenewalName: string;
  smartTripMemberExclusiveName: string;
  smartTripGiftcardCampaignName: string;
  smartTripGiftcardReminderName: string;
  smartTripLoyaltyBoostName: string;
  smartTripLoyaltyPointsName: string;
  // Additional tile-specific recommendations
  smartRecommendationTotalClientsGrow: string;
  smartRecommendationAppointmentsBoost: string;
  smartRecommendationRevenueRecover: string;
  smartRecommendationPromoUpsell: string;
  smartRecommendationBestClientsVip: string;
  smartRecommendationBestMonthRepeat: string;
  smartRecommendationMemberSignup: string;
  smartRecommendationLoyaltyMemberSignup: string;
  smartRecommendationGiftcardIssuance: string;
  // Additional SmartTrip campaign names
  smartTripTotalClientsName: string;
  smartTripAppointmentsName: string;
  smartTripRevenueRecoverName: string;
  smartTripPromoUpsellName: string;
  smartTripBestClientsName: string;
  smartTripBestMonthName: string;
  smartTripMemberSignupName: string;
  smartTripLoyaltyMemberName: string;
  smartTripGiftcardIssuanceName: string;
  // SmartTrips Advanced Targeting
  advancedTargeting: string;
  advancedTargetingDesc: string;
  filterLogicAnd: string;
  filterLogicOr: string;
  filterLogicLabel: string;
  consentRequired: string;
  consentRequiredDesc: string;
  estimatedReach: string;
  estimatedReachClients: string;
  // SmartTrips Trigger Conditions
  triggerType: string;
  triggerManual: string;
  triggerOnClientAdded: string;
  triggerAfterAppointment: string;
  triggerDaysAfterLastVisit: string;
  triggerBirthday: string;
  triggerMembershipExpiring: string;
  triggerLoyaltyThreshold: string;
  triggerNoVisitXDays: string;
  sendDelay: string;
  sendImmediately: string;
  afterXDays: string;
  specificTimeWindow: string;
  quietHours: string;
  quietHoursDesc: string;
  quietHoursEnabled: string;
  quietHoursFrom: string;
  quietHoursTo: string;
  timeZoneAware: string;
  xDaysLabel: string;
  // SmartTrips Campaign Intelligence
  campaignIntelligence: string;
  suggestedSubjectLines: string;
  suggestedTiming: string;
  suggestedLength: string;
  estimatedOpenRate: string;
  steps3: string;
  steps5: string;
  steps7: string;
  intelligenceTip: string;
  // SmartTrips Email Builder Enhancement
  duplicateStep: string;
  delayPerStep: string;
  visualTimeline: string;
  timelineViewLabel: string;
  conditionalBranch: string;
  conditionalBranchDesc: string;
  ifClicked: string;
  ifNotClicked: string;
  sendFollowUpA: string;
  sendFollowUpB: string;
  branchComingSoon: string;
  dragToReorder: string;
  // SmartTrips Performance Panel
  performancePanel: string;
  smartTripEnrolledClients: string;
  smartTripActiveClients: string;
  smartTripCompletedClients: string;
  openRate: string;
  clickRate: string;
  revenueGenerated: string;
  unsubscribes: string;
  storeBreakdown: string;
  performanceTimeline: string;
  noPerformanceData: string;
  performanceNote: string;
  // Confirmation modal
  activateCampaignConfirm: string;
  activateCampaignConfirmDesc: string;
  smartTripRecipientCount: string;
  complianceFooterPreview: string;
  // Days labels
  day1: string;
  days3: string;
  days7: string;
  days14: string;
  days30: string;
  // listView already exists, use existing key
  // Assign & Manage tab
  dripTabCampaignsTemplates: string;
  dripTabCampaignsLine1: string;
  dripTabCampaignsLine2: string;
  dripTabAssignManage: string;
  dripTabAssignLine1: string;
  dripTabAssignLine2: string;
  assignManageTitle: string;
  assignNewCampaign: string;
  activeEnrollments: string;
  pausedEnrollments: string;
  unassignedClients: string;
  totalEnrolled: string;
  selectClients: string;
  confirmAssignment: string;
  assignClientsButton: string;
  groupByCampaign: string;
  groupByClient: string;
  dripCampaignsActiveSection: string;
  unassignedClientsCard: string;
  pauseEnrollment: string;
  resumeEnrollment: string;
  removeFromCampaign: string;
  noClientsInDrip: string;
  noCampaignsMatchFilter: string;
  // Marketing Promo Redesign — Assign & Manage
  promoTabAssignLine1: string;
  promoTabAssignLine2: string;
  promoTabPromosLine1: string;
  promoTabPromosLine2: string;
  assignMarketingPromotion: string;
  marketingPromoActiveSection: string;
  assignedPromos: string;
  promoActiveCount: string;
  promoInProgressCount: string;
  promoCompletedCount: string;
  promoTotalAssigned: string;
  selectPromoStep: string;
  yourPromotions: string;
  officialPromoTemplates: string;
  noPromotionsToAssign: string;
  createPromotionFirst: string;
  promoAssignConfirm: string;
  promoAssignedSuccess: string;
  removeFromPromotion: string;
  noClientsInPromo: string;
  promoSocialMedia: string;
  promoSaveFailed: string;
  promoErrorName: string;
  promoErrorDiscount: string;
  promoErrorServices: string;
  promoErrorDescription: string;
  promoClientCount: string;
  promoMoreClients: string;
  readyMadeTemplates: string;
  promoExpiresOn: string;
  promoUsageLimits: string;
  promoTypeLabel: string;
  // Loyalty Program — tab labels & assign button
  loyaltyTabProgramLine1: string;
  loyaltyTabProgramLine2: string;
  loyaltyTabAnalyticsLine1: string;
  loyaltyTabAnalyticsLine2: string;
  loyaltyTabAssignLine1: string;
  loyaltyTabAssignLine2: string;
  assignLoyaltyRewards: string;
  loyaltyAssignActiveSection: string;
  enrolledInLoyalty: string;
  notEnrolledInLoyalty: string;
  noClientsInLoyalty: string;
  // Membership Program — tab labels & assign button
  membershipTabAssignLine1: string;
  membershipTabAssignLine2: string;
  membershipTabPlansLine1: string;
  membershipTabPlansLine2: string;
  membershipTabAnalyticsLine1: string;
  membershipTabAnalyticsLine2: string;
  // Gift Cards tabs
  giftCardTabAssignLine1: string;
  giftCardTabAssignLine2: string;
  giftCardTabCardsLine1: string;
  giftCardTabCardsLine2: string;
  giftCardTabAnalyticsLine1: string;
  giftCardTabAnalyticsLine2: string;
  // Gift Cards analytics
  giftCardAnalyticsTotalIssued: string;
  giftCardAnalyticsTotalValue: string;
  giftCardAnalyticsActiveCards: string;
  giftCardAnalyticsRedeemedCards: string;
  giftCardAnalyticsOutstandingBalance: string;
  giftCardAnalyticsTotalRedeemed: string;
  giftCardAnalyticsAvgValue: string;
  giftCardAnalyticsLargestCard: string;
  giftCardAnalyticsRedemptionRate: string;
  giftCardAnalyticsBreakage: string;
  giftCardAnalyticsTopClients: string;
  giftCardAnalyticsNoData: string;
  giftCardAnalyticsNoDataDesc: string;
  assignMembershipPlans: string;
  membershipAssignActiveSection: string;
  enrolledInMembership: string;
  notEnrolledInMembership: string;
  noClientsInMembership: string;
  unsavedChanges: string;
  membershipNewPlan: string;

  // Staff Profile & Calendar UI
  staffProfile: string;
  teamMemberRole: string;
  activeStatus: string;
  inactiveStatus: string;
  hoursPerMonth: string;
  workSnapshot: string;
  nextShift: string;
  lastShift: string;
  notScheduled: string;
  noShiftHistory: string;
  daysThisWeekLabel: string;
  shiftsThisMonthLabel: string;
  daysSingular: string;
  daysPlural: string;
  shiftSingular: string;
  shiftPlural: string;
  workingNow: string;
  offToday: string;
  thisWeeksSchedule: string;
  shiftHistoryLabel: string;
  hoursDistribution: string;
  noShiftHistoryFound: string;
  summaryStaff: string;
  summaryShifts: string;
  summaryTotalHrs: string;
  addShiftButton: string;
  autoButton: string;
  thisMonthOption: string;
  noShiftsThisWeek: string;
  noShiftsThisMonth: string;

  // Time Off
  timeOffSection: string;
  addTimeOff: string;
  daysOff: string;
  sickDays: string;
  vacationDays: string;
  timeOffType: string;
  timeOffStartDate: string;
  timeOffEndDate: string;
  timeOffNote: string;
  timeOffNotePlaceholder: string;
  noTimeOffRecorded: string;
  onBreak: string;
  offLabel: string;
  breakLabel: string;
  addTimeOffTitle: string;
  timeOffSaved: string;
  timeOffDeleted: string;
  timeOffDeleteConfirm: string;
  timeOffOverrideConfirm: string;
  timeOffOverrideTitle: string;
  tapToAddTimeOff: string;
  // Staff Export / Smart Share
  storeSchedule: string;
  staffScheduleOption: string;
  exportScope: string;
  dateRange: string;
  outputFormat: string;
  exportButtonLabel: string;
  sendToEmail: string;
  useStaffEmail: string;
  staffEmailFieldLabel: string;
  staffEmailHelperText: string;
  generatedOn: string;

  // Social Media Share — SharePromotionModal
  shareSocialMedia: string;
  shareAPromotion: string;
  shareThisPromotion: string;
  shareFormat: string;
  shareFormatHelper: string;
  shareBookingLink: string;
  shareBookingLinkDesc: string;
  shareQrCode: string;
  shareQrCodeDesc: string;
  shareWebsiteLink: string;
  shareWebsiteLinkDesc: string;
  shareCaption: string;
  shareCaptionHelper: string;
  sharePreviewPost: string;
  shareShare: string;
  sharePreview: string;
  shareSearchPromotions: string;
  shareSearchTemplates: string;
  shareNoActivePromos: string;
  shareNoActivePromosHint: string;
  shareNoResults: string;
  shareBookingPageQr: string;
  shareScanToBook: string;
  shareSpecialOffer: string;
  shareSpecialPromotion: string;
  shareTapToLearnMore: string;
  shareCardPreview: string;
  sharePreviewTip: string;

  // Growth Opportunities Section
  growthOpportunitiesTitle: string;
  growthOpportunitiesSubtitle: string;
  growthRecoverLostTitle: string;
  growthRecoverLostSubtitle: string;
  growthRecoverLostDesc: string;
  growthRecoverLostTip: string;
  growthRecoverLostCta: string;
  growthBoostSlowTitle: string;
  growthBoostSlowSubtitleSlowest: string;
  growthBoostSlowDesc: string;
  growthBoostSlowTip: string;
  growthBoostSlowCta: string;
  growthRewardTopTitle: string;
  growthRewardTopSubtitle: string;
  growthRewardTopDesc: string;
  growthRewardTopTip: string;
  growthRewardTopCta: string;
  growthInactiveClientSingular: string;
  growthInactiveClientPlural: string;
  growthInactiveClientDetectedSingular: string;
  growthInactiveClientDetectedPlural: string;
  growthClientHasSingular: string;
  growthClientHavePlural: string;
  growthNotVisitedInLast: string;
  growthDaysAgo: string;
  growthTopClientSingular: string;
  growthTopClientPlural: string;
  growthTopClientIdentifiedSingular: string;
  growthTopClientIdentifiedPlural: string;
  growthIsYourSlowest: string;
  growthGenerateLeastBookings: string;
  growthFlashPromotionCanDrive: string;
  growthTopClientGenerateRevenue: string;
  growthRewardingLoyaltyIncreases: string;

  // Embedded action buttons inside insight cards
  growthRunWithAI: string;
  growthCreateCampaignManually: string;
  growthCreatePromotionManually: string;
  growthWinBackRecommendation: string;
  growthBestClientsRecommendation: string;
  growthSlowDayRecommendation: string;
  aiSmartDripCampaign: string;
  aiMarketingPromotion: string;
  // AI rec card descriptions per section
  aiRecClientsAtRiskDrip: string;
  aiRecClientsAtRiskPromo: string;
  aiRecBestClientsDrip: string;
  aiRecBestClientsPromo: string;
  aiRecBusiestTimesDrip: string;
  aiRecBusiestTimesPromo: string;
  aiRecNewClientsDrip: string;
  aiRecNewClientsPromo: string;
  aiRecRevenueDrip: string;
  aiRecRevenuePromo: string;
  aiRecPromotionsDrip: string;
  aiRecPromotionsPromo: string;
  aiRecTopServicesDrip: string;
  aiRecTopServicesPromo: string;
  aiRecSlowDayDripContext: string;
  aiRecSlowDayPromoContext: string;
  aiRecVipDripContext: string;
  aiRecVipPromoContext: string;
  aiRecWinbackDripContext: string;
  aiRecWinbackPromoContext: string;
  // AI Business Advisor Modal
  aiBusinessAdvisor: string;
  aiAdvisorPoweredBy: string;
  aiAdvisorAskAnything: string;
  aiAdvisorDescription: string;
  aiAdvisorSuggestedQuestions: string;
  aiAdvisorQuickActions: string;
  aiAdvisorWhyClientsLeaving: string;
  aiAdvisorGrowRevenue: string;
  aiAdvisorFillSlowDays: string;
  aiAdvisorBestPromotion: string;
  aiAdvisorPlaceholder: string;
  aiAdvisorAnalyzing: string;
  aiAdvisorInsight: string;
  aiAdvisorWhyItMatters: string;
  aiAdvisorSuggestedAction: string;
  aiAdvisorErrorRetry: string;
  aiAdvisorErrorConnection: string;
  // AI Advisor expanded question pool
  aiAdvisorClientsAtRisk: string;
  aiAdvisorClientRetention: string;
  aiAdvisorNewClients: string;
  aiAdvisorTopClients: string;
  aiAdvisorRevenueHurting: string;
  aiAdvisorRevenueGrowth: string;
  aiAdvisorRevenuePerVisit: string;
  aiAdvisorPeakRevenue: string;
  aiAdvisorFillEmptySlots: string;
  aiAdvisorUnderperformingDays: string;
  aiAdvisorBusiestDays: string;
  aiAdvisorBookingTips: string;
  aiAdvisorBestPromoStrategy: string;
  aiAdvisorNextPromotion: string;
  aiAdvisorPromoResults: string;
  aiAdvisorFlashOffer: string;
  aiAdvisorTopService: string;
  aiAdvisorServiceRevenue: string;
  aiAdvisorPromoteTopService: string;
  aiAdvisorServiceMix: string;
  aiAdvisorLoyaltyGrowth: string;
  aiAdvisorLoyaltyRedemption: string;
  aiAdvisorMembershipGrowth: string;
  aiAdvisorMemberBenefits: string;
  aiAdvisorGiftCardRevenue: string;
  aiAdvisorGiftCardStrategy: string;
  aiAdvisorRetainBestClients: string;
  aiAdvisorRepeatVisits: string;
  // Ask AI button & Generate with AI
  askAI: string;
  generateWithAI: string;
  generatingWithAI: string;
  // Toast messages
  toastBooked: string;
  toastDeleted: string;
  toastUpdateFailed: string;
  toastClientCheckedIn: string;
  toastAppointmentCompleted: string;
  toastClientEnrolledMembership: string;
  toastPaymentRecorded: string;
  toastThemeSaved: string;
  toastStoreOrderUpdated: string;
  toastPdfExported: string;
  toastCsvExported: string;
  toastDefaultScheduleApplied: string;
  toastShiftsCreated: string;
  toastMarkedNoShow: string;

  // Business Setup / Onboarding
  businessSetup: string;
  businessSetupSubtitle: string;
  howDoYouRunYourBusiness: string;
  businessTypeAppointments: string;
  businessTypeAppointmentsDesc: string;
  businessTypeWalkIns: string;
  businessTypeWalkInsDesc: string;
  businessTypeBoth: string;
  businessTypeBothDesc: string;
  businessTypeSkip: string;
  businessTypeSkipDesc: string;
  setupProgressComplete: string;
  setupProgressPending: string;

  // Business Setup Hub — Enterprise Onboarding
  setupGroupIdentityTitle: string;
  setupGroupIdentityDesc: string;
  setupGroupModelTitle: string;
  setupGroupModelDesc: string;
  setupGroupLocationsTitle: string;
  setupGroupLocationsDesc: string;
  setupGroupServicesTitle: string;
  setupGroupServicesDesc: string;
  setupGroupBookingTitle: string;
  setupGroupBookingDesc: string;
  setupGroupBrandTitle: string;
  setupGroupBrandDesc: string;
  setupGroupProgramsTitle: string;
  setupGroupProgramsDesc: string;
  setupGroupOperationsTitle: string;
  setupGroupOperationsDesc: string;
  setupGroupFirstClientTitle: string;
  setupGroupFirstClientDesc: string;
  setupStepBusinessDetailsTitle: string;
  setupStepBusinessDetailsDesc: string;
  setupStepBusinessNameTitle: string;
  setupStepBusinessNameDesc: string;
  setupStepAddressTitle: string;
  setupStepAddressDesc: string;
  setupStepPhoneTitle: string;
  setupStepPhoneDesc: string;
  setupStepCountryTitle: string;
  setupStepCountryDesc: string;
  setupStepPrimaryStoreTitle: string;
  setupStepPrimaryStoreDesc: string;
  setupStepHoursTitle: string;
  setupStepHoursDesc: string;
  setupStepAdditionalLocationsTitle: string;
  setupStepAdditionalLocationsDesc: string;
  setupStepServicesTitle: string;
  setupStepServicesDesc: string;
  setupStepStaffTitle: string;
  setupStepStaffDesc: string;
  setupStepStaffSoloHint: string;
  setupStepServiceAssignTitle: string;
  setupStepServiceAssignDesc: string;
  setupStepStaffCalendarTitle: string;
  setupStepStaffCalendarDesc: string;
  // Combined / consolidated step keys (10-step architecture)
  setupStepBusinessProfileTitle: string;
  setupStepBusinessProfileDesc: string;
  setupStepLocationHoursTitle: string;
  setupStepLocationHoursDesc: string;
  setupStepServicesTeamTitle: string;
  setupStepServicesTeamDesc: string;
  setupStepTeamAccessTitle: string;
  setupStepTeamAccessDesc: string;
  setupStepOnlineBookingTitle: string;
  setupStepOnlineBookingDesc: string;
  setupStepBookingLanguageTitle: string;
  setupStepBookingLanguageDesc: string;
  setupStepBrandPresenceTitle: string;
  setupStepBrandPresenceDesc: string;
  setupStepRevenueProgramsTitle: string;
  setupStepRevenueProgramsDesc: string;
  setupStepBookingLinkTitle: string;
  setupStepBookingLinkDesc: string;
  setupStepBookingBrandingTitle: string;
  setupStepBookingBrandingDesc: string;
  setupStepLogoTitle: string;
  setupStepLogoDesc: string;
  setupStepBrandColorsTitle: string;
  setupStepBrandColorsDesc: string;
  setupStepLoyaltyTitle: string;
  setupStepLoyaltyDesc: string;
  setupStepMembershipTitle: string;
  setupStepMembershipDesc: string;
  setupStepGiftCardsTitle: string;
  setupStepGiftCardsDesc: string;
  setupStepFirstClientTitle: string;
  setupStepFirstClientDesc: string;
  setupStateNotStarted: string;
  setupStateInProgress: string;
  setupStateOperational: string;
  setupStateConfigured: string;
  setupProgressOf: string;
  setupOptionalBadge: string;
  setupActionConfigure: string;
  setupActionReview: string;
  setupHubSubtitle: string;
  setupFoundationLabel: string;
  setupEnhancementsLabel: string;
  setupStepComplete: string;
  setupHubDoneButton: string;
  setupBusinessTypeStepLabel: string;
  setupNextStepLabel: string;
  setupHintFirstClient: string;
  setupStepBusinessLinksTitle: string;
  setupStepBusinessLinksDesc: string;
  setupHintBusinessLinks: string;
  setupHintStaffCalendar: string;
  setupHintTeamAccess: string;
  setupHintBookingLanguage: string;
  outsideBusinessHoursTitle: string;
  outsideBusinessHoursBody: string;
  outsideBusinessHoursOk: string;
}

export type TranslationKey = keyof TranslationStrings;

// Supported languages
export type Language = 'en' | 'es' | 'fr' | 'pt' | 'de' | 'ru' | 'ko' | 'ja' | 'zh' | 'tr' | 'sv' | 'no' | 'da' | 'fi' | 'is' | 'nl' | 'it' | 'ht';

// Language metadata
export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  rtl: boolean;
}

// All supported languages with metadata (LTR only - RTL languages removed)
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', rtl: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', rtl: false },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk', rtl: false },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', rtl: false },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', rtl: false },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska', rtl: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', rtl: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', rtl: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', rtl: false },
];

// Helper to get language info
export function getLanguageInfo(code: Language): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

// Check if language is RTL - always returns false since RTL languages are removed
export function isRTL(code: Language): boolean {
  return false;
}
