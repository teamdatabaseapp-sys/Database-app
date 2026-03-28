import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { Client, User, DripCampaign, EmailCampaign, Language, Visit, MarketingPromotion, ClientPromotion, ClientPromotionUsage, ThemeSettings, EmailOptOut, EmailOptOutAuditLog, TermsAcceptance, TermsAcceptanceStatus, DripCampaignAcceptance, DripCampaignActivationLog, EULawfulBasisAcceptance, EUCampaignActivationLog, Appointment, StaffMember, Store, CurrencyCode, CountryCode } from './types';
import { COUNTRIES } from './country-legal-compliance';
import { CURRENT_TERMS_VERSION, DRIP_CAMPAIGN_CONSENT_ACKNOWLEDGMENT, EU_LAWFUL_BASIS_ACKNOWLEDGMENT } from './legal-content';
import { DEFAULT_CURRENCY_CODE } from './currency';
import { disableFaceIdForUser, clearAllFaceIdData } from './face-id-service';
import { loadLanguage } from './i18n/translation-manager';

// RTL languages - empty since RTL support is disabled
const RTL_LANGUAGES: Language[] = [];

// Valid languages for fallback validation
const VALID_LANGUAGES: Language[] = ['en', 'es', 'fr', 'pt', 'de', 'ht', 'it', 'nl', 'sv', 'no', 'da', 'fi', 'is', 'ru', 'tr', 'zh', 'ko', 'ja'];

// Valid currency codes for fallback validation
const VALID_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'KRW', 'SEK', 'NOK', 'DKK', 'RUB', 'TRY', 'AED', 'SAR', 'PLN', 'ISK', 'NZD', 'SGD', 'HKD', 'ZAR', 'ARS', 'COP', 'CLP', 'PEN', 'EGP', 'MAD', 'TWD'];

// Valid country codes for fallback validation
const VALID_COUNTRIES: CountryCode[] = COUNTRIES.map(c => c.code);

// Check if a language is RTL
export const isRTLLanguage = (lang: Language): boolean => RTL_LANGUAGES.includes(lang);

// Validate and return a valid language or default to 'en'
const validateLanguage = (lang: unknown): Language => {
  if (typeof lang === 'string' && VALID_LANGUAGES.includes(lang as Language)) {
    return lang as Language;
  }
  return 'en';
};

// Validate and return a valid currency or default
const validateCurrency = (curr: unknown): CurrencyCode => {
  if (typeof curr === 'string' && VALID_CURRENCIES.includes(curr as CurrencyCode)) {
    return curr as CurrencyCode;
  }
  return DEFAULT_CURRENCY_CODE as CurrencyCode;
};

// Validate and return a valid country or default to 'US'
const validateCountry = (country: unknown): CountryCode => {
  if (typeof country === 'string' && VALID_COUNTRIES.includes(country as CountryCode)) {
    return country as CountryCode;
  }
  return 'US';
};

// Generate unique IDs (UUID v4 format for Supabase compatibility)
const generateId = (): string => {
  // Generate UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Generate deterministic user ID from email (ensures same email = same user ID)
const generateUserIdFromEmail = (email: string): string => {
  // Simple hash function to create deterministic ID from email
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'user_' + Math.abs(hash).toString(36);
};

// No sample data - each user starts fresh with their own data
const sampleClients: Client[] = [];

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;

  // Saved user data (persists across logout)
  savedBusinessNames: Record<string, string>; // email -> businessName
  savedUserProfiles: Record<string, Partial<User>>; // email -> user profile data

  // Data (raw - contains all users' data)
  clients: Client[];
  staffMembers: StaffMember[];
  stores: Store[];
  dripCampaigns: DripCampaign[];
  emailCampaigns: EmailCampaign[];
  marketingPromotions: MarketingPromotion[];
  appointments: Appointment[];

  // Feature toggles
  featureToggles: {
    calendarEnabled: boolean;
  };

  // Business setup / onboarding
  businessTypeSelection: 'appointments' | 'walkIns' | 'both' | 'skip' | null;

  // User-filtered data selectors (only returns current user's data)
  getUserClients: () => Client[];
  getUserStaffMembers: () => StaffMember[];
  getUserStores: () => Store[];
  getUserDripCampaigns: () => DripCampaign[];
  getUserMarketingPromotions: () => MarketingPromotion[];
  getUserEmailOptOuts: () => EmailOptOut[];
  getUserAppointments: () => Appointment[];

  // CAN-SPAM Compliance - Email Opt-Out System (SYSTEM-ENFORCED)
  emailOptOuts: EmailOptOut[];
  emailOptOutAuditLogs: EmailOptOutAuditLog[];

  // Legal Terms Acceptance
  termsAcceptances: TermsAcceptance[];

  // Email Drip Campaign Legal Compliance
  dripCampaignAcceptances: DripCampaignAcceptance[];
  dripCampaignActivationLogs: DripCampaignActivationLog[];

  // EU GDPR Compliance - Additive Layer
  euLawfulBasisAcceptances: EULawfulBasisAcceptance[];
  euCampaignActivationLogs: EUCampaignActivationLog[];

  // UI
  language: Language;
  currency: CurrencyCode;
  country: CountryCode;
  showArchived: boolean;
  soundsEnabled: boolean;
  vibrationsEnabled: boolean;
  themeSettings: ThemeSettings;
  hasSeenTrialOnboarding: boolean;
  isInPasswordRecovery: boolean;
  setIsInPasswordRecovery: (val: boolean) => void;

  // Auth actions
  login: (email: string, password: string) => boolean;
  logout: () => void;
  register: (user: Omit<User, 'id' | 'membershipActive'>) => void;

  // Client actions
  addClient: (client: Omit<Client, 'id' | 'userId' | 'visits' | 'promotionCount' | 'isArchived' | 'createdAt' | 'updatedAt'>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  archiveClient: (id: string) => void;
  unarchiveClient: (id: string) => void;
  deleteClient: (id: string) => void;
  addVisit: (clientId: string, visit: Omit<Visit, 'id'>) => void;
  updateVisit: (clientId: string, visitId: string, updates: Partial<Omit<Visit, 'id' | 'modifiedAt'>>) => void;
  assignClientToPromotion: (clientId: string, promotionId: string | undefined) => void;
  addClientPromotion: (clientId: string, promotionId: string, targetCount: number) => void;
  updateClientPromotionCounter: (clientId: string, clientPromotionId: string, serviceId: string, notes?: string) => void;

  // Drip Campaign actions
  addDripCampaign: (campaign: Omit<DripCampaign, 'id' | 'userId' | 'createdAt'>) => void;
  updateDripCampaign: (id: string, updates: Partial<DripCampaign>) => void;
  deleteDripCampaign: (id: string) => void;
  toggleDripCampaignActive: (id: string) => void;
  assignClientToDrip: (clientId: string, campaignId: string | undefined) => void;

  // Marketing Promotion actions
  addMarketingPromotion: (promo: Omit<MarketingPromotion, 'id' | 'userId' | 'createdAt'>) => void;
  updateMarketingPromotion: (id: string, updates: Partial<MarketingPromotion>) => void;
  deleteMarketingPromotion: (id: string) => void;
  toggleMarketingPromotionActive: (id: string) => void;

  // Appointment actions
  addAppointment: (appointment: Omit<Appointment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => { success: boolean; error?: string };
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  cancelAppointment: (id: string) => void;
  restoreAppointment: (id: string) => void;
  checkAppointmentConflict: (staffId: string, date: Date, startTime: string, duration: number, excludeAppointmentId?: string) => boolean;
  checkClientAppointmentConflict: (clientId: string, date: Date, startTime: string, endTime: string, excludeAppointmentId?: string) => boolean;
  getClientsWithConflicts: (date: Date, startTime: string, endTime: string, excludeAppointmentId?: string) => Set<string>;

  // Staff Member actions
  addStaffMember: (staff: Omit<StaffMember, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => void;
  deleteStaffMember: (id: string) => void;

  // Store actions
  addStore: (store: Omit<Store, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  updateStore: (id: string, updates: Partial<Store>) => void;
  deleteStore: (id: string) => void;

  // Feature toggle actions
  setCalendarEnabled: (enabled: boolean) => void;

  // Business setup actions
  setBusinessTypeSelection: (selection: 'appointments' | 'walkIns' | 'both' | 'skip' | null) => void;

  // CAN-SPAM Compliance - Email Opt-Out Actions (SYSTEM-ENFORCED - NOT ACCESSIBLE TO BUSINESS USERS)
  // These functions are called by the EMAIL SERVICE ONLY, not exposed to UI
  _systemCreateOptOutRecord: (recipientEmail: string, businessId: string, source: EmailOptOut['registrationSource']) => void;
  _systemProcessOptOut: (recipientEmail: string, businessId: string) => void;
  _systemProcessResubscribe: (recipientEmail: string, businessId: string) => void;
  getOptOutStatus: (recipientEmail: string, businessId: string) => boolean;
  getOptOutRecord: (recipientEmail: string, businessId: string) => EmailOptOut | undefined;
  getAuditLogs: (recipientEmail?: string, businessId?: string) => EmailOptOutAuditLog[];

  // Legal Terms Acceptance Actions
  recordTermsAcceptance: (acceptance: Omit<TermsAcceptance, 'id'>) => void;
  getTermsAcceptanceStatus: (userId: string) => TermsAcceptanceStatus;
  getTermsAcceptanceRecords: (userId?: string) => TermsAcceptance[];

  // Email Drip Campaign Legal Compliance Actions
  recordDripCampaignAcceptance: (campaignId: string, appVersion: string) => string; // Returns acceptance ID
  getDripCampaignAcceptanceStatus: (campaignId: string) => boolean;
  logDripCampaignActivation: (campaignId: string, action: 'activated' | 'deactivated' | 'blocked_no_address', acceptanceId?: string) => void;
  getDripCampaignActivationLogs: (campaignId?: string) => DripCampaignActivationLog[];
  canActivateDripCampaign: () => { canActivate: boolean; reason?: string };

  // EU GDPR Compliance Actions - Additive Layer
  recordEULawfulBasisAcceptance: (campaignId: string, appVersion: string) => string; // Returns acceptance ID
  getEULawfulBasisAcceptanceStatus: (campaignId: string) => boolean;
  logEUCampaignActivation: (campaignId: string, action: 'eu_activated' | 'eu_deactivated', acceptanceId?: string) => void;
  getEUCampaignActivationLogs: (campaignId?: string) => EUCampaignActivationLog[];
  toggleDripCampaignEuEnabled: (campaignId: string) => void;

  // Settings
  setLanguage: (lang: Language) => Promise<void>;
  setCurrency: (currency: CurrencyCode) => void;
  setCountry: (country: CountryCode) => void;
  toggleShowArchived: () => void;
  setSoundsEnabled: (enabled: boolean) => void;
  setVibrationsEnabled: (enabled: boolean) => void;
  setThemeSettings: (settings: Partial<ThemeSettings>) => void;

  // Membership actions
  updateMembershipPlan: (plan: 'monthly' | 'yearly') => void;
  cancelMembership: () => void;
  updateUserInfo: (updates: Partial<Pick<User, 'name' | 'email' | 'businessName' | 'businessAddress' | 'businessPhoneNumber' | 'businessCountry' | 'businessState' | 'emailFooterLanguage' | 'businessTimezone'>>) => void;

  // Subscription/Trial actions
  startTrial: (plan: 'monthly' | 'yearly') => void;
  markTrialOnboardingSeen: () => void;
  activateSubscription: (plan: 'monthly' | 'yearly') => void;
  restorePurchase: () => boolean;
  renewMembership: (plan?: 'monthly' | 'yearly') => void;

  // Appointment notification settings
  updateAppointmentNotificationSettings: (settings: Partial<import('./types').AppointmentNotificationSettings>) => void;
  getAppointmentNotificationSettings: () => import('./types').AppointmentNotificationSettings;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      savedBusinessNames: {},
      savedUserProfiles: {},
      clients: sampleClients,
      staffMembers: [],
      stores: [],
      dripCampaigns: [],
      emailCampaigns: [],
      marketingPromotions: [],
      appointments: [],
      emailOptOuts: [],
      emailOptOutAuditLogs: [],
      termsAcceptances: [],
      dripCampaignAcceptances: [],
      dripCampaignActivationLogs: [],
      euLawfulBasisAcceptances: [],
      euCampaignActivationLogs: [],
      language: 'en',
      currency: DEFAULT_CURRENCY_CODE as CurrencyCode,
      country: 'US' as CountryCode,
      showArchived: false,
      soundsEnabled: true,
      vibrationsEnabled: true,
      themeSettings: {
        primaryColor: '#0D9488',
        buttonColor: '#0D9488',
        darkMode: false,
      },
      hasSeenTrialOnboarding: false,
      isInPasswordRecovery: false,
      featureToggles: {
        calendarEnabled: true,
      },
      businessTypeSelection: null,

      // User-filtered data selectors
      getUserClients: () => {
        const userId = get().user?.id;
        if (!userId) return [];
        return get().clients.filter((c) => c.userId === userId);
      },
      getUserDripCampaigns: () => {
        const userId = get().user?.id;
        if (!userId) return [];
        return get().dripCampaigns.filter((c) => c.userId === userId);
      },
      getUserMarketingPromotions: () => {
        const userId = get().user?.id;
        if (!userId) return [];
        return get().marketingPromotions.filter((p) => p.userId === userId);
      },
      getUserEmailOptOuts: () => {
        const userId = get().user?.id;
        if (!userId) return [];
        return get().emailOptOuts.filter((o) => o.businessId === userId);
      },
      getUserAppointments: () => {
        const userId = get().user?.id;
        if (!userId) return [];
        return get().appointments.filter((a) => a.userId === userId);
      },
      getUserStaffMembers: () => {
        const userId = get().user?.id;
        if (!userId) return [];
        return get().staffMembers.filter((s) => s.userId === userId);
      },
      getUserStores: () => {
        const userId = get().user?.id;
        if (!userId) return [];
        return get().stores.filter((s) => s.userId === userId);
      },

      // Auth actions
      login: (email: string, password: string) => {
        // DEPRECATED: This function is no longer used.
        // All authentication goes through Supabase Auth.
        // This function always returns false to block fake logins.
        console.log('[Store] login() called - DEPRECATED. Use Supabase Auth instead.');
        return false;
      },

      logout: () => {
        // Get user ID before clearing state to disable Face ID
        const userId = get().user?.id;
        if (userId) {
          // Disable Face ID for this user on logout (async, fire and forget)
          disableFaceIdForUser(userId).catch(() => {});
          clearAllFaceIdData().catch(() => {});
        }
        set({ user: null, isAuthenticated: false });
      },

      register: (userData) => {
        const normalizedEmail = userData.email.toLowerCase().trim();
        const userId = generateUserIdFromEmail(normalizedEmail); // Deterministic user ID
        const newUser = {
          ...userData,
          email: normalizedEmail,
          id: userId,
          membershipActive: true,
        };
        set((state) => ({
          user: newUser,
          isAuthenticated: true,
          // Save business name for this email
          savedBusinessNames: {
            ...state.savedBusinessNames,
            [normalizedEmail]: userData.businessName || 'My Business',
          },
          // Save full user profile for this email
          savedUserProfiles: {
            ...state.savedUserProfiles,
            [normalizedEmail]: newUser,
          },
        }));
      },

      // Client actions
      addClient: (clientData) => {
        const userId = get().user?.id;
        if (!userId) return; // Cannot add without logged-in user
        const newClient: Client = {
          ...clientData,
          id: generateId(),
          userId,
          visits: [],
          promotionCount: 0,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ clients: [...state.clients, newClient] }));
      },

      updateClient: (id, updates) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          clients: state.clients.map((c) =>
            // Only update if user owns this client
            c.id === id && c.userId === userId ? { ...c, ...updates, updatedAt: new Date() } : c
          ),
        }));
      },

      archiveClient: (id) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          clients: state.clients.map((c) =>
            // Only archive if user owns this client
            c.id === id && c.userId === userId ? { ...c, isArchived: true, updatedAt: new Date() } : c
          ),
        }));
      },

      unarchiveClient: (id) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          clients: state.clients.map((c) =>
            // Only unarchive if user owns this client
            c.id === id && c.userId === userId ? { ...c, isArchived: false, updatedAt: new Date() } : c
          ),
        }));
      },

      deleteClient: (id) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          // Only delete if user owns this client
          clients: state.clients.filter((c) => !(c.id === id && c.userId === userId)),
        }));
      },

      addVisit: (clientId, visitData) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        const newVisit: Visit = {
          ...visitData,
          id: generateId(),
        };
        set((state) => ({
          clients: state.clients.map((c) => {
            // Only add visit if user owns this client
            if (c.id !== clientId || c.userId !== userId) return c;
            // Merge visit services into client's tags (deduplicated)
            const updatedTags = [...new Set([...c.tags, ...visitData.services])];
            return {
              ...c,
              visits: [...c.visits, newVisit],
              tags: updatedTags,
              promotionCount: visitData.promotionUsed
                ? c.promotionCount + 1
                : c.promotionCount,
              updatedAt: new Date(),
            };
          }),
        }));
      },

      updateVisit: (clientId, visitId, updates) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          clients: state.clients.map((c) => {
            // Only update if user owns this client
            if (c.id !== clientId || c.userId !== userId) return c;
            return {
              ...c,
              visits: c.visits.map((v) => {
                if (v.id !== visitId) return v;
                return {
                  ...v,
                  ...updates,
                  modifiedAt: new Date(),
                };
              }),
              updatedAt: new Date(),
            };
          }),
        }));
      },

      // Drip Campaign actions
      addDripCampaign: (campaignData) => {
        const userId = get().user?.id;
        if (!userId) return; // Cannot add without logged-in user
        const newCampaign: DripCampaign = {
          ...campaignData,
          id: generateId(),
          userId,
          createdAt: new Date(),
        };
        set((state) => ({ dripCampaigns: [...state.dripCampaigns, newCampaign] }));
      },

      updateDripCampaign: (id, updates) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          dripCampaigns: state.dripCampaigns.map((c) =>
            // Only update if user owns this campaign
            c.id === id && c.userId === userId ? { ...c, ...updates } : c
          ),
        }));
      },

      deleteDripCampaign: (id) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          // Only delete if user owns this campaign
          dripCampaigns: state.dripCampaigns.filter((c) => !(c.id === id && c.userId === userId)),
          // Also remove campaign assignment from user's clients only
          clients: state.clients.map((client) =>
            client.userId === userId && client.dripCampaignId === id
              ? { ...client, dripCampaignId: undefined }
              : client
          ),
        }));
      },

      toggleDripCampaignActive: (id) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          dripCampaigns: state.dripCampaigns.map((c) =>
            // Only toggle if user owns this campaign
            c.id === id && c.userId === userId ? { ...c, isActive: !c.isActive } : c
          ),
        }));
      },

      assignClientToDrip: (clientId, campaignId) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in

        const existingClient = get().clients.find((c) => c.id === clientId);

        if (existingClient) {
          // Update existing client
          set((state) => ({
            clients: state.clients.map((c) =>
              c.id === clientId && c.userId === userId
                ? { ...c, dripCampaignId: campaignId, updatedAt: new Date() }
                : c
            ),
          }));
        } else {
          // Create a minimal client entry to store the drip campaign assignment
          // This handles clients that exist in Supabase but not in Zustand
          const newClient: Client = {
            id: clientId,
            userId,
            name: '', // Will be overwritten by Supabase data when merged
            email: '',
            phone: '',
            notes: '',
            tags: [],
            visits: [],
            promotionCount: 0,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            dripCampaignId: campaignId,
          };
          set((state) => ({
            clients: [...state.clients, newClient],
          }));
        }
      },

      // Client Promotion actions
      assignClientToPromotion: (clientId, promotionId) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in

        const existingClient = get().clients.find((c) => c.id === clientId);

        if (existingClient) {
          // Update existing client
          set((state) => ({
            clients: state.clients.map((c) =>
              c.id === clientId && c.userId === userId
                ? { ...c, activePromotionId: promotionId, updatedAt: new Date() }
                : c
            ),
          }));
        } else {
          // Create a minimal client entry to store the promotion assignment
          // This handles clients that exist in Supabase but not in Zustand
          const newClient: Client = {
            id: clientId,
            userId,
            name: '', // Will be overwritten by Supabase data when merged
            email: '',
            phone: '',
            notes: '',
            tags: [],
            visits: [],
            promotionCount: 0,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            activePromotionId: promotionId,
          };
          set((state) => ({
            clients: [...state.clients, newClient],
          }));
        }
      },

      addClientPromotion: (clientId, promotionId, targetCount) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        const newClientPromotion: ClientPromotion = {
          id: generateId(),
          promotionId,
          currentCount: 0,
          targetCount,
          isCompleted: false,
          history: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const existingClient = get().clients.find((c) => c.id === clientId);

        if (existingClient) {
          // Update existing client
          set((state) => ({
            clients: state.clients.map((c) =>
              c.id === clientId && c.userId === userId
                ? {
                    ...c,
                    clientPromotions: [...(c.clientPromotions || []), newClientPromotion],
                    updatedAt: new Date(),
                  }
                : c
            ),
          }));
        } else {
          // Create a minimal client entry to store the promotion counter
          // This handles clients that exist in Supabase but not in Zustand
          const newClient: Client = {
            id: clientId,
            userId,
            name: '', // Will be overwritten by Supabase data when merged
            email: '',
            phone: '',
            notes: '',
            tags: [],
            visits: [],
            promotionCount: 0,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            clientPromotions: [newClientPromotion],
          };
          set((state) => ({
            clients: [...state.clients, newClient],
          }));
        }
      },

      updateClientPromotionCounter: (clientId, clientPromotionId, serviceId, notes) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        const newUsage: ClientPromotionUsage = {
          id: generateId(),
          date: new Date(),
          serviceId,
          notes,
        };
        set((state) => ({
          clients: state.clients.map((c) => {
            // Only update if user owns this client
            if (c.id !== clientId || c.userId !== userId) return c;
            const updatedPromotions = (c.clientPromotions || []).map((cp) => {
              if (cp.id !== clientPromotionId) return cp;
              const newCount = cp.currentCount + 1;
              return {
                ...cp,
                currentCount: newCount,
                isCompleted: newCount >= cp.targetCount,
                history: [...cp.history, newUsage],
                updatedAt: new Date(),
              };
            });
            return {
              ...c,
              clientPromotions: updatedPromotions,
              updatedAt: new Date(),
            };
          }),
        }));
      },

      // Marketing Promotion actions
      addMarketingPromotion: (promoData) => {
        const userId = get().user?.id;
        if (!userId) return; // Cannot add without logged-in user
        const newPromo: MarketingPromotion = {
          ...promoData,
          id: generateId(),
          userId,
          createdAt: new Date(),
        };
        set((state) => ({ marketingPromotions: [...state.marketingPromotions, newPromo] }));
      },

      updateMarketingPromotion: (id, updates) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          marketingPromotions: state.marketingPromotions.map((p) =>
            // Only update if user owns this promotion
            p.id === id && p.userId === userId ? { ...p, ...updates } : p
          ),
        }));
      },

      deleteMarketingPromotion: (id) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          // Only delete if user owns this promotion
          marketingPromotions: state.marketingPromotions.filter((p) => !(p.id === id && p.userId === userId)),
          // Remove promotion assignment from user's clients only
          clients: state.clients.map((client) =>
            client.userId === userId && client.activePromotionId === id
              ? { ...client, activePromotionId: undefined }
              : client
          ),
        }));
      },

      toggleMarketingPromotionActive: (id) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          marketingPromotions: state.marketingPromotions.map((p) =>
            // Only toggle if user owns this promotion
            p.id === id && p.userId === userId ? { ...p, isActive: !p.isActive } : p
          ),
        }));
      },

      // Appointment actions
      addAppointment: (appointmentData) => {
        const userId = get().user?.id;
        if (!userId) return { success: false, error: 'User not logged in' };

        // Backend validation failsafe: Check for client conflict before saving
        const clientId = appointmentData.clientId;
        const date = appointmentData.date;
        const startTime = appointmentData.startTime;
        const endTime = appointmentData.endTime || '';

        if (clientId && date && startTime && endTime) {
          const hasConflict = get().checkClientAppointmentConflict(
            clientId,
            date,
            startTime,
            endTime
          );
          if (hasConflict) {
            return { success: false, error: 'Client already booked for this time.' };
          }
        }

        const newAppointment: Appointment = {
          ...appointmentData,
          id: generateId(),
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ appointments: [...state.appointments, newAppointment] }));
        return { success: true };
      },

      updateAppointment: (id, updates) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id && a.userId === userId ? { ...a, ...updates, updatedAt: new Date() } : a
          ),
        }));
      },

      deleteAppointment: (id) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id && a.userId === userId
              ? { ...a, deleted: true, deletedAt: new Date(), updatedAt: new Date() }
              : a
          ),
        }));
      },

      cancelAppointment: (id) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id && a.userId === userId
              ? { ...a, cancelled: true, cancelledAt: new Date(), updatedAt: new Date() }
              : a
          ),
        }));
      },

      restoreAppointment: (id) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id && a.userId === userId
              ? { ...a, cancelled: false, cancelledAt: undefined, deleted: false, deletedAt: undefined, updatedAt: new Date() }
              : a
          ),
        }));
      },

      checkAppointmentConflict: (staffId, date, startTime, duration, excludeAppointmentId) => {
        const userId = get().user?.id;
        if (!userId || !staffId) return false;

        // Helper to convert "HH:mm" to minutes since midnight
        const timeToMinutes = (time: string): number => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const newStart = timeToMinutes(startTime);
        const newEnd = newStart + duration;

        // Get date string for comparison (YYYY-MM-DD)
        const dateStr = new Date(date).toISOString().split('T')[0];

        // Check all active appointments for this staff member on this date
        // Exclude cancelled and deleted appointments from conflict check
        const staffAppointments = get().appointments.filter((a) => {
          if (a.userId !== userId) return false;
          if (a.staffId !== staffId) return false;
          if (a.cancelled || a.deleted) return false; // Skip cancelled/deleted appointments
          if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
          const appointmentDateStr = new Date(a.date).toISOString().split('T')[0];
          return appointmentDateStr === dateStr;
        });

        // Check for time overlap
        for (const appointment of staffAppointments) {
          const existingStart = timeToMinutes(appointment.startTime);
          const existingDuration = appointment.duration || 60; // Default 1 hour if not set
          const existingEnd = existingStart + existingDuration;

          // Check if ranges overlap: (StartA < EndB) && (EndA > StartB)
          if (newStart < existingEnd && newEnd > existingStart) {
            return true; // Conflict found
          }
        }

        return false; // No conflict
      },

      // Check if a client has an overlapping appointment (prevents double-booking clients)
      checkClientAppointmentConflict: (clientId, date, startTime, endTime, excludeAppointmentId) => {
        const userId = get().user?.id;
        if (!userId || !clientId) return false;

        // Helper to convert "HH:mm" to minutes since midnight
        const timeToMinutes = (time: string): number => {
          const [hours, minutes] = time.split(':').map(Number);
          return (hours || 0) * 60 + (minutes || 0);
        };

        const newStart = timeToMinutes(startTime);
        const newEnd = timeToMinutes(endTime);

        // Get date string for comparison (YYYY-MM-DD)
        const dateStr = new Date(date).toISOString().split('T')[0];

        // Check all active appointments for this client on this date
        const clientAppointments = get().appointments.filter((a) => {
          if (a.userId !== userId) return false;
          if (a.clientId !== clientId) return false;
          if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
          const appointmentDateStr = new Date(a.date).toISOString().split('T')[0];
          return appointmentDateStr === dateStr;
        });

        // Check for time overlap: existing.start < new.end AND existing.end > new.start
        for (const appointment of clientAppointments) {
          const existingStart = timeToMinutes(appointment.startTime);
          const existingEnd = appointment.endTime
            ? timeToMinutes(appointment.endTime)
            : existingStart + (appointment.duration || 60);

          if (existingStart < newEnd && existingEnd > newStart) {
            return true; // Conflict found
          }
        }

        return false; // No conflict
      },

      // Get set of client IDs that have conflicts for the given time slot
      getClientsWithConflicts: (date, startTime, endTime, excludeAppointmentId) => {
        const userId = get().user?.id;
        const conflictingClientIds = new Set<string>();
        if (!userId) return conflictingClientIds;

        // Helper to convert "HH:mm" to minutes since midnight
        const timeToMinutes = (time: string): number => {
          const [hours, minutes] = time.split(':').map(Number);
          return (hours || 0) * 60 + (minutes || 0);
        };

        const newStart = timeToMinutes(startTime);
        const newEnd = timeToMinutes(endTime);

        // Get date string for comparison (YYYY-MM-DD)
        const dateStr = new Date(date).toISOString().split('T')[0];

        // Check all appointments on this date
        const dayAppointments = get().appointments.filter((a) => {
          if (a.userId !== userId) return false;
          if (excludeAppointmentId && a.id === excludeAppointmentId) return false;
          const appointmentDateStr = new Date(a.date).toISOString().split('T')[0];
          return appointmentDateStr === dateStr;
        });

        // Find all clients with overlapping appointments
        for (const appointment of dayAppointments) {
          const existingStart = timeToMinutes(appointment.startTime);
          const existingEnd = appointment.endTime
            ? timeToMinutes(appointment.endTime)
            : existingStart + (appointment.duration || 60);

          // Check if ranges overlap: existing.start < new.end AND existing.end > new.start
          if (existingStart < newEnd && existingEnd > newStart) {
            conflictingClientIds.add(appointment.clientId);
          }
        }

        return conflictingClientIds;
      },

      // Staff Member actions
      addStaffMember: (staffData) => {
        const userId = get().user?.id;
        if (!userId) return;
        const newStaff: StaffMember = {
          ...staffData,
          id: generateId(),
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ staffMembers: [...state.staffMembers, newStaff] }));
      },

      updateStaffMember: (id, updates) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          staffMembers: state.staffMembers.map((s) =>
            s.id === id && s.userId === userId ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        }));
      },

      deleteStaffMember: (id) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          staffMembers: state.staffMembers.filter((s) => !(s.id === id && s.userId === userId)),
        }));
      },

      // Store actions
      addStore: (storeData) => {
        const userId = get().user?.id;
        if (!userId) return;
        const newStore: Store = {
          ...storeData,
          id: generateId(),
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ stores: [...state.stores, newStore] }));
      },

      updateStore: (id, updates) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          stores: state.stores.map((s) =>
            s.id === id && s.userId === userId ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        }));
      },

      deleteStore: (id) => {
        const userId = get().user?.id;
        if (!userId) return;
        set((state) => ({
          stores: state.stores.filter((s) => !(s.id === id && s.userId === userId)),
          // Also remove storeId from staff members belonging to this store
          staffMembers: state.staffMembers.map((staff) =>
            staff.userId === userId && staff.storeId === id
              ? { ...staff, storeId: undefined }
              : staff
          ),
          // Also remove storeId from appointments belonging to this store
          appointments: state.appointments.map((apt) =>
            apt.userId === userId && apt.storeId === id
              ? { ...apt, storeId: undefined }
              : apt
          ),
        }));
      },

      // Feature toggle actions
      setCalendarEnabled: (enabled) => {
        set((state) => ({
          featureToggles: { ...state.featureToggles, calendarEnabled: enabled },
        }));
      },

      setBusinessTypeSelection: (selection) => {
        set({ businessTypeSelection: selection });
      },

      // Settings
      setLanguage: async (lang) => {
        // Load translations before switching for instant UI update
        await loadLanguage(lang);

        // Force LTR layout - RTL is disabled
        if (I18nManager.isRTL) {
          I18nManager.allowRTL(false);
          I18nManager.forceRTL(false);
        }
        set({ language: lang });
      },
      setCurrency: (currency) => set({ currency }),
      setCountry: (country) => set({ country }),
      toggleShowArchived: () => set((state) => ({ showArchived: !state.showArchived })),
      setSoundsEnabled: (enabled) => set({ soundsEnabled: enabled }),
      setVibrationsEnabled: (enabled) => set({ vibrationsEnabled: enabled }),
      setIsInPasswordRecovery: (val) => set({ isInPasswordRecovery: val }),
      setThemeSettings: (settings) => set((state) => ({
        themeSettings: { ...state.themeSettings, ...settings },
      })),

      // Membership actions
      updateMembershipPlan: (plan) => {
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                membershipPlan: plan,
                membershipStartDate: new Date(),
              }
            : null,
        }));
      },

      cancelMembership: () => {
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                membershipActive: false,
              }
            : null,
        }));
      },

      updateUserInfo: (updates) => {
        set((state) => {
          if (!state.user) return state;

          const updatedUser = {
            ...state.user,
            ...updates,
          };

          const userEmail = updatedUser.email.toLowerCase().trim();

          // If business name is being updated, save it for this email
          let updatedSavedBusinessNames = state.savedBusinessNames;
          if (updates.businessName) {
            updatedSavedBusinessNames = {
              ...state.savedBusinessNames,
              [userEmail]: updates.businessName,
            };
          }

          // Save full user profile for this email (preserves country, address, etc.)
          const updatedSavedUserProfiles = {
            ...state.savedUserProfiles,
            [userEmail]: updatedUser,
          };

          return {
            user: updatedUser,
            savedBusinessNames: updatedSavedBusinessNames,
            savedUserProfiles: updatedSavedUserProfiles,
          };
        });
      },

      // ============================================
      // Subscription/Trial System
      // ============================================

      // Start free trial — sets trialStartDate and trialEndDate on the user
      startTrial: (plan: 'monthly' | 'yearly') => {
        const { TRIAL_DURATION_DAYS } = require('./trial-service') as typeof import('./trial-service');
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                trialStartDate: new Date(),
                trialEndDate: trialEnd,
                membershipPlan: plan,
              }
            : null,
          hasSeenTrialOnboarding: true,
        }));
      },

      markTrialOnboardingSeen: () => {
        set({ hasSeenTrialOnboarding: true });
      },

      // Activate a paid subscription (called after successful payment)
      activateSubscription: (plan: 'monthly' | 'yearly') => {
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                hasActivePaidSubscription: true,
                membershipPlan: plan,
                membershipActive: true,
                subscriptionPurchaseDate: new Date(),
              }
            : null,
        }));
      },

      // Restore a previous purchase (returns true if restored, false if no purchase found)
      restorePurchase: (): boolean => {
        // In a real app, this would check with the App Store / Google Play
        // For demo purposes, we'll simulate a restore based on subscription state
        const user = get().user;
        if (!user) return false;

        // Check if user ever had a subscription (has a purchase date)
        if (user.subscriptionPurchaseDate) {
          set((state) => ({
            user: state.user
              ? {
                  ...state.user,
                  hasActivePaidSubscription: true,
                  membershipActive: true,
                }
              : null,
          }));
          return true;
        }
        return false;
      },

      // Renew a cancelled membership (reactivates with optional plan change)
      renewMembership: (plan?: 'monthly' | 'yearly') => {
        set((state) => {
          if (!state.user) return state;
          const renewPlan = plan || state.user.membershipPlan || 'monthly';
          return {
            user: {
              ...state.user,
              hasActivePaidSubscription: true,
              membershipPlan: renewPlan,
              membershipActive: true,
              membershipStartDate: new Date(),
              subscriptionPurchaseDate: new Date(),
            },
          };
        });
      },

      // ============================================
      // Appointment Notification Settings
      // ============================================

      updateAppointmentNotificationSettings: (settings) => {
        set((state) => {
          if (!state.user) return state;
          const currentSettings = state.user.appointmentNotificationSettings || {
            enableConfirmationEmail: true,
            enableUpdateEmail: true,
            enableCancellationEmail: true,
            enableReminderEmail: true,
            reminderTiming: '24h' as const,
            enableGiftCardEmail: true,
            enableLoyaltyEmail: true,
            enableMembershipEmail: true,
            enableGeneralCommsEmail: true,
          };
          return {
            user: {
              ...state.user,
              appointmentNotificationSettings: {
                ...currentSettings,
                ...settings,
              },
            },
          };
        });
      },

      getAppointmentNotificationSettings: () => {
        const user = get().user;
        return user?.appointmentNotificationSettings || {
          enableConfirmationEmail: true,
          enableUpdateEmail: true,
          enableCancellationEmail: true,
          enableReminderEmail: true,
          reminderTiming: '24h' as const,
          enableGiftCardEmail: true,
          enableLoyaltyEmail: true,
          enableMembershipEmail: true,
          enableGeneralCommsEmail: true,
        };
      },

      // ============================================
      // CAN-SPAM Compliance - Email Opt-Out System
      // SYSTEM-ENFORCED - These functions cannot be disabled by business users
      // ============================================

      // Create opt-out record when a client is added (soft opt-in by default)
      _systemCreateOptOutRecord: (recipientEmail: string, businessId: string, source: EmailOptOut['registrationSource']) => {
        const normalizedEmail = recipientEmail.toLowerCase().trim();
        const existing = get().emailOptOuts.find(
          (r) => r.recipientEmail === normalizedEmail && r.businessId === businessId
        );

        if (existing) return; // Record already exists

        const newRecord: EmailOptOut = {
          id: generateId(),
          recipientEmail: normalizedEmail,
          businessId,
          emailOptOut: false, // Soft opt-in: emails allowed by default
          registrationTimestamp: new Date(),
          registrationSource: source,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const auditLog: EmailOptOutAuditLog = {
          id: generateId(),
          recipientEmail: normalizedEmail,
          businessId,
          action: 'opt_in',
          timestamp: new Date(),
          source: 'registration',
        };

        set((state) => ({
          emailOptOuts: [...state.emailOptOuts, newRecord],
          emailOptOutAuditLogs: [...state.emailOptOutAuditLogs, auditLog],
        }));
      },

      // Process opt-out request - IMMEDIATE, no confirmation required (CAN-SPAM compliant)
      _systemProcessOptOut: (recipientEmail: string, businessId: string) => {
        const normalizedEmail = recipientEmail.toLowerCase().trim();
        const now = new Date();

        const auditLog: EmailOptOutAuditLog = {
          id: generateId(),
          recipientEmail: normalizedEmail,
          businessId,
          action: 'opt_out',
          timestamp: now,
          source: 'unsubscribe_link',
        };

        set((state) => {
          const existingIndex = state.emailOptOuts.findIndex(
            (r) => r.recipientEmail === normalizedEmail && r.businessId === businessId
          );

          if (existingIndex >= 0) {
            // Update existing record
            const updated = [...state.emailOptOuts];
            updated[existingIndex] = {
              ...updated[existingIndex],
              emailOptOut: true,
              optOutTimestamp: now,
              updatedAt: now,
            };
            return {
              emailOptOuts: updated,
              emailOptOutAuditLogs: [...state.emailOptOutAuditLogs, auditLog],
            };
          } else {
            // Create new record with opt-out
            const newRecord: EmailOptOut = {
              id: generateId(),
              recipientEmail: normalizedEmail,
              businessId,
              emailOptOut: true,
              optOutTimestamp: now,
              registrationTimestamp: now,
              registrationSource: 'manual_add',
              createdAt: now,
              updatedAt: now,
            };
            return {
              emailOptOuts: [...state.emailOptOuts, newRecord],
              emailOptOutAuditLogs: [...state.emailOptOutAuditLogs, auditLog],
            };
          }
        });
      },

      // Process re-subscribe request - requires EXPLICIT user action
      _systemProcessResubscribe: (recipientEmail: string, businessId: string) => {
        const normalizedEmail = recipientEmail.toLowerCase().trim();
        const now = new Date();

        const auditLog: EmailOptOutAuditLog = {
          id: generateId(),
          recipientEmail: normalizedEmail,
          businessId,
          action: 'opt_in',
          timestamp: now,
          source: 'manual_resubscribe',
        };

        set((state) => {
          const existingIndex = state.emailOptOuts.findIndex(
            (r) => r.recipientEmail === normalizedEmail && r.businessId === businessId
          );

          if (existingIndex >= 0) {
            const updated = [...state.emailOptOuts];
            updated[existingIndex] = {
              ...updated[existingIndex],
              emailOptOut: false,
              optInTimestamp: now,
              updatedAt: now,
            };
            return {
              emailOptOuts: updated,
              emailOptOutAuditLogs: [...state.emailOptOutAuditLogs, auditLog],
            };
          }
          return state;
        });
      },

      // Check if recipient has opted out - used before every email send
      getOptOutStatus: (recipientEmail: string, businessId: string): boolean => {
        const normalizedEmail = recipientEmail.toLowerCase().trim();
        const record = get().emailOptOuts.find(
          (r) => r.recipientEmail === normalizedEmail && r.businessId === businessId
        );
        return record?.emailOptOut ?? false;
      },

      // Get full opt-out record for a recipient
      getOptOutRecord: (recipientEmail: string, businessId: string): EmailOptOut | undefined => {
        const normalizedEmail = recipientEmail.toLowerCase().trim();
        return get().emailOptOuts.find(
          (r) => r.recipientEmail === normalizedEmail && r.businessId === businessId
        );
      },

      // Get audit logs with optional filtering
      getAuditLogs: (recipientEmail?: string, businessId?: string): EmailOptOutAuditLog[] => {
        let logs = get().emailOptOutAuditLogs;
        if (recipientEmail) {
          const normalizedEmail = recipientEmail.toLowerCase().trim();
          logs = logs.filter((l) => l.recipientEmail === normalizedEmail);
        }
        if (businessId) {
          logs = logs.filter((l) => l.businessId === businessId);
        }
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      // ============================================
      // Legal Terms Acceptance System
      // ============================================

      // Record a new terms acceptance
      recordTermsAcceptance: (acceptance: Omit<TermsAcceptance, 'id'>) => {
        const newAcceptance: TermsAcceptance = {
          ...acceptance,
          id: generateId(),
        };
        set((state) => ({
          termsAcceptances: [...state.termsAcceptances, newAcceptance],
        }));
      },

      // Get terms acceptance status for a user
      getTermsAcceptanceStatus: (userId: string): TermsAcceptanceStatus => {
        const acceptances = get().termsAcceptances.filter((a) => a.userId === userId);
        if (acceptances.length === 0) {
          return {
            hasAccepted: false,
            currentVersion: CURRENT_TERMS_VERSION,
            needsReacceptance: true,
          };
        }

        // Find the most recent acceptance
        const latestAcceptance = acceptances.sort(
          (a, b) => new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime()
        )[0];

        const needsReacceptance = latestAcceptance.termsVersion !== CURRENT_TERMS_VERSION;

        return {
          hasAccepted: true,
          acceptedVersion: latestAcceptance.termsVersion,
          currentVersion: CURRENT_TERMS_VERSION,
          needsReacceptance,
          lastAcceptedAt: new Date(latestAcceptance.acceptedAt),
        };
      },

      // Get all acceptance records (for audit purposes)
      getTermsAcceptanceRecords: (userId?: string): TermsAcceptance[] => {
        let records = get().termsAcceptances;
        if (userId) {
          records = records.filter((r) => r.userId === userId);
        }
        return records.sort((a, b) => new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime());
      },

      // ============================================
      // Email Drip Campaign Legal Compliance
      // ============================================

      // Record consent acceptance before campaign activation
      recordDripCampaignAcceptance: (campaignId: string, appVersion: string): string => {
        const userId = get().user?.id;
        if (!userId) return '';

        const acceptanceId = generateId();
        const newAcceptance: DripCampaignAcceptance = {
          id: acceptanceId,
          userId,
          campaignId,
          acceptedAt: new Date(),
          appVersion,
          consentText: DRIP_CAMPAIGN_CONSENT_ACKNOWLEDGMENT,
        };

        set((state) => ({
          dripCampaignAcceptances: [...state.dripCampaignAcceptances, newAcceptance],
        }));

        return acceptanceId;
      },

      // Check if campaign has been accepted
      getDripCampaignAcceptanceStatus: (campaignId: string): boolean => {
        const userId = get().user?.id;
        if (!userId) return false;

        return get().dripCampaignAcceptances.some(
          (a) => a.campaignId === campaignId && a.userId === userId
        );
      },

      // Log activation/deactivation events for audit
      logDripCampaignActivation: (
        campaignId: string,
        action: 'activated' | 'deactivated' | 'blocked_no_address',
        acceptanceId?: string
      ) => {
        const userId = get().user?.id;
        if (!userId) return;

        const log: DripCampaignActivationLog = {
          id: generateId(),
          userId,
          campaignId,
          action,
          timestamp: new Date(),
          acceptanceId,
        };

        set((state) => ({
          dripCampaignActivationLogs: [...state.dripCampaignActivationLogs, log],
        }));
      },

      // Get activation logs for audit
      getDripCampaignActivationLogs: (campaignId?: string): DripCampaignActivationLog[] => {
        let logs = get().dripCampaignActivationLogs;
        if (campaignId) {
          logs = logs.filter((l) => l.campaignId === campaignId);
        }
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      // Check if user can activate drip campaigns (requires business address)
      canActivateDripCampaign: (): { canActivate: boolean; reason?: string } => {
        const user = get().user;
        if (!user) {
          return { canActivate: false, reason: 'User not logged in' };
        }
        if (!user.businessAddress || user.businessAddress.trim().length === 0) {
          return {
            canActivate: false,
            reason: 'Business address is required. Please add your business address in Settings before activating email campaigns.'
          };
        }
        return { canActivate: true };
      },

      // ============================================
      // EU GDPR Compliance - Additive Layer
      // Does NOT replace US federal protections
      // ============================================

      // Record EU lawful basis acceptance before EU campaign activation
      recordEULawfulBasisAcceptance: (campaignId: string, appVersion: string): string => {
        const userId = get().user?.id;
        if (!userId) return '';

        const acceptanceId = generateId();
        const newAcceptance: EULawfulBasisAcceptance = {
          id: acceptanceId,
          userId,
          campaignId,
          acceptedAt: new Date(),
          appVersion,
          consentText: EU_LAWFUL_BASIS_ACKNOWLEDGMENT,
        };

        set((state) => ({
          euLawfulBasisAcceptances: [...state.euLawfulBasisAcceptances, newAcceptance],
          // Also update the campaign to mark EU lawful basis as accepted
          dripCampaigns: state.dripCampaigns.map((c) =>
            c.id === campaignId
              ? { ...c, euLawfulBasisAccepted: true, euAcceptedAt: new Date() }
              : c
          ),
        }));

        return acceptanceId;
      },

      // Check if EU lawful basis has been accepted for campaign
      getEULawfulBasisAcceptanceStatus: (campaignId: string): boolean => {
        const userId = get().user?.id;
        if (!userId) return false;

        return get().euLawfulBasisAcceptances.some(
          (a) => a.campaignId === campaignId && a.userId === userId
        );
      },

      // Log EU campaign activation/deactivation events for audit
      logEUCampaignActivation: (
        campaignId: string,
        action: 'eu_activated' | 'eu_deactivated',
        acceptanceId?: string
      ) => {
        const userId = get().user?.id;
        if (!userId) return;

        const log: EUCampaignActivationLog = {
          id: generateId(),
          userId,
          campaignId,
          action,
          timestamp: new Date(),
          acceptanceId,
          euIndicatorFlag: true,
        };

        set((state) => ({
          euCampaignActivationLogs: [...state.euCampaignActivationLogs, log],
        }));
      },

      // Get EU activation logs for audit
      getEUCampaignActivationLogs: (campaignId?: string): EUCampaignActivationLog[] => {
        let logs = get().euCampaignActivationLogs;
        if (campaignId) {
          logs = logs.filter((l) => l.campaignId === campaignId);
        }
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      // Toggle EU enabled status for a campaign
      toggleDripCampaignEuEnabled: (campaignId: string) => {
        const userId = get().user?.id;
        if (!userId) return; // Must be logged in
        set((state) => ({
          dripCampaigns: state.dripCampaigns.map((c) =>
            // Only toggle if user owns this campaign
            c.id === campaignId && c.userId === userId
              ? { ...c, isEuEnabled: !c.isEuEnabled }
              : c
          ),
        }));
      },
    }),
    {
      name: 'clientflow-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Auth state
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        savedBusinessNames: state.savedBusinessNames,
        savedUserProfiles: state.savedUserProfiles,
        // UI preferences only
        language: state.language,
        currency: state.currency,
        country: state.country,
        themeSettings: state.themeSettings,
        featureToggles: state.featureToggles,
        businessTypeSelection: state.businessTypeSelection,
        // Compliance/audit logs — persisted locally as backup (also synced to Supabase)
        emailOptOuts: state.emailOptOuts,
        emailOptOutAuditLogs: state.emailOptOutAuditLogs,
        termsAcceptances: state.termsAcceptances,
        dripCampaignAcceptances: state.dripCampaignAcceptances,
        dripCampaignActivationLogs: state.dripCampaignActivationLogs,
        euLawfulBasisAcceptances: state.euLawfulBasisAcceptances,
        euCampaignActivationLogs: state.euCampaignActivationLogs,
        // NOTE: clients, staffMembers, stores, dripCampaigns, marketingPromotions,
        // appointments are NOT persisted — they are always fetched fresh from Supabase.
      }),
      // Merge function to validate and sanitize loaded state
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState> | undefined;
        // Existing authenticated users should not see the trial onboarding screen
        const hasSeenTrialOnboarding =
          persisted?.hasSeenTrialOnboarding ??
          (persisted?.user ? true : false);
        return {
          ...currentState,
          ...persisted,
          // Validate and coerce UI preference fields in case of corruption
          language: validateLanguage(persisted?.language),
          currency: validateCurrency(persisted?.currency),
          country: validateCountry(persisted?.country),
          // Business data is always Supabase — never load from persisted state
          clients: currentState.clients,
          staffMembers: currentState.staffMembers,
          stores: currentState.stores,
          dripCampaigns: currentState.dripCampaigns,
          marketingPromotions: currentState.marketingPromotions,
          appointments: currentState.appointments,
          hasSeenTrialOnboarding,
        };
      },
    }
  )
);
