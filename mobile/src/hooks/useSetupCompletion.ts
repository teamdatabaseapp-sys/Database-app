/**
 * useSetupCompletion Hook
 *
 * Computes real setup completion state by checking actual Supabase data.
 * Uses React Query for server state and Zustand for local store state.
 *
 * ARCHITECTURE: Foundation + Enhancement groups with individual per-step cards.
 *
 * Foundation (9 applicable steps for appointments businesses):
 *   Identity:         businessDetails (name+address+phone combined), country
 *   Locations & Hours: primaryStore, hours, additionalLocations
 *   Services & Team:  services, staff, serviceAssign, staffCalendar
 *
 * Enhancement (10 steps):
 *   Booking:          bookingLink, bookingBranding, bookingLanguage
 *   Brand:            logo, brandColors, businessLinks
 *   Programs:         loyalty, membership, giftCards
 *   First Client:     firstClient
 */

import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import { TranslationStrings } from '@/lib/i18n/types';

import { getStores } from '@/services/storesService';
import { getServices } from '@/services/servicesService';
import { getStaffMembers } from '@/services/staffService';
import { getBusinessHours } from '@/services/businessHoursService';
import { getLoyaltySettings } from '@/services/loyaltyService';
import { getMembershipPlans } from '@/services/membershipService';
import { getBusinessBranding } from '@/services/businessBrandingService';
import { getClients } from '@/services/clientsService';
import { getBookingPageSettings } from '@/services/bookingPageSettingsService';
import { hasStaffCalendarShifts } from '@/services/staffCalendarService';

// ============================================
// Types
// ============================================

export interface SetupStep {
  id: string;
  groupId: string;
  titleKey: keyof TranslationStrings;
  descKey: keyof TranslationStrings;
  isComplete: boolean;
  isOptional: boolean;
  isApplicable: boolean;
  navigateTo: string;
}

export interface SetupGroup {
  id: string;
  titleKey: keyof TranslationStrings;
  descKey: keyof TranslationStrings;
  steps: SetupStep[];
  groupType: 'foundation' | 'enhancement';
}

export interface SetupCompletion {
  groups: SetupGroup[];
  totalApplicable: number;
  totalComplete: number;
  allFoundationComplete: boolean;
  isLoading: boolean;
}

// ============================================
// Hook
// ============================================

export function useSetupCompletion(): SetupCompletion {
  const { businessId } = useBusiness();

  // Zustand store selectors
  const user = useStore((s) => s.user);
  const businessTypeSelection = useStore((s) => s.businessTypeSelection);

  const enabled = !!businessId;

  // Stores
  const { data: storesResult, isLoading: storesLoading } = useQuery({
    queryKey: ['setup_completion', 'stores', businessId],
    queryFn: () => getStores(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Business Hours
  const { data: hoursResult, isLoading: hoursLoading } = useQuery({
    queryKey: ['setup_completion', 'business_hours', businessId],
    queryFn: () => getBusinessHours(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Services
  const { data: servicesResult, isLoading: servicesLoading } = useQuery({
    queryKey: ['setup_completion', 'services', businessId],
    queryFn: () => getServices(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Staff
  const { data: staffResult, isLoading: staffLoading } = useQuery({
    queryKey: ['setup_completion', 'staff', businessId],
    queryFn: () => getStaffMembers(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Loyalty
  const { data: loyaltyResult, isLoading: loyaltyLoading } = useQuery({
    queryKey: ['setup_completion', 'loyalty', businessId],
    queryFn: () => getLoyaltySettings(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Membership
  const { data: membershipPlans, isLoading: membershipLoading } = useQuery({
    queryKey: ['setup_completion', 'membership', businessId],
    queryFn: () => getMembershipPlans(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Branding
  const { data: brandingResult, isLoading: brandingLoading } = useQuery({
    queryKey: ['setup_completion', 'branding', businessId],
    queryFn: () => getBusinessBranding(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Clients
  const { data: clientsResult, isLoading: clientsLoading } = useQuery({
    queryKey: ['setup_completion', 'clients', businessId],
    queryFn: () => getClients(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Booking page settings
  const { data: bookingSettingsResult, isLoading: bookingSettingsLoading } = useQuery({
    queryKey: ['setup_completion', 'booking_settings', businessId],
    queryFn: () => getBookingPageSettings(businessId!),
    enabled,
    staleTime: 60_000,
  });

  // Staff calendar shifts — has at least one shift been configured?
  const { data: staffCalendarShiftsExist, isLoading: staffCalendarLoading } = useQuery({
    queryKey: ['setup_completion', 'staff_calendar_shifts', businessId],
    queryFn: () => hasStaffCalendarShifts(businessId!),
    enabled,
    staleTime: 60_000,
  });

  const isLoading =
    storesLoading ||
    hoursLoading ||
    servicesLoading ||
    staffLoading ||
    loyaltyLoading ||
    membershipLoading ||
    brandingLoading ||
    clientsLoading ||
    bookingSettingsLoading ||
    staffCalendarLoading;

  // ── Derived data ────────────────────────────────────────────────────────────

  const stores = storesResult?.data ?? [];
  const businessHours = hoursResult?.data ?? [];
  const services = servicesResult?.data ?? [];
  const staff = staffResult?.data ?? [];
  const loyaltyData = loyaltyResult?.data ?? null;
  const plans = Array.isArray(membershipPlans) ? membershipPlans : [];
  const branding = brandingResult?.data ?? null;
  const clients = clientsResult?.data ?? [];
  const bookingSettings = bookingSettingsResult?.data ?? null;

  const isWalkIns = businessTypeSelection === 'walkIns';

  // ── Step completion checks ──────────────────────────────────────────────────

  // Identity — businessDetails (name + address + phone combined)
  const businessNameComplete =
    !!user?.businessName && user.businessName.trim() !== '' && user.businessName.trim() !== 'My Business';
  const addressComplete = !!user?.businessAddress?.trim();
  const phoneComplete = !!user?.businessPhoneNumber?.trim();
  const businessDetailsComplete = businessNameComplete && addressComplete && phoneComplete;

  // Identity — country
  const countryComplete = !!user?.businessCountry;

  // Locations & Hours
  const primaryStoreComplete = stores.length > 0;
  const hoursComplete = businessHours.length > 0 && businessHours.some((h) => !h.is_closed);
  const additionalLocationsComplete = stores.length > 1;

  // Services & Team
  const servicesComplete = services.length > 0;
  const staffComplete = staff.length > 0;
  const serviceAssignComplete = staff.some((s) => (s.service_ids ?? []).length > 0);
  const staffCalendarComplete = staffCalendarShiftsExist === true;

  // Team access — completion proxy: team has been set up (staff exist)
  const teamAccessComplete = staff.length > 0;

  // Booking
  const bookingLinkComplete = bookingSettings !== null;
  const bookingBrandingComplete = bookingSettings !== null;
  const bookingLanguageComplete = bookingSettings !== null;

  // Brand
  const logoComplete = branding?.logo_url !== null && branding?.logo_url !== undefined;
  const brandColorsComplete =
    branding?.brand_primary_color !== null && branding?.brand_primary_color !== undefined;
  // businessLinks — no queryable field in branding; mark complete conservatively as false
  const businessLinksComplete = false;

  // Programs
  const loyaltyComplete = loyaltyData !== null;
  const membershipComplete = plans.length > 0;
  const giftCardsComplete = false; // gift cards enabled check — service-side

  // First Client
  const firstClientComplete = clients.length > 0;

  // ── Build groups ────────────────────────────────────────────────────────────

  const groups: SetupGroup[] = [
    // ── FOUNDATION ───────────────────────────────────────────────────────────

    {
      id: 'identity',
      titleKey: 'setupGroupIdentityTitle',
      descKey: 'setupGroupIdentityDesc',
      groupType: 'foundation',
      steps: [
        {
          id: 'businessDetails',
          groupId: 'identity',
          titleKey: 'setupStepBusinessDetailsTitle',
          descKey: 'setupStepBusinessDetailsDesc',
          isComplete: businessDetailsComplete,
          isOptional: false,
          isApplicable: true,
          navigateTo: 'businessDetails',
        },
        {
          id: 'country',
          groupId: 'identity',
          titleKey: 'setupStepCountryTitle',
          descKey: 'setupStepCountryDesc',
          isComplete: countryComplete,
          isOptional: false,
          isApplicable: true,
          navigateTo: 'country',
        },
      ],
    },

    {
      id: 'locationsHours',
      titleKey: 'setupGroupLocationsTitle',
      descKey: 'setupGroupLocationsDesc',
      groupType: 'foundation',
      steps: [
        {
          id: 'primaryStore',
          groupId: 'locationsHours',
          titleKey: 'setupStepPrimaryStoreTitle',
          descKey: 'setupStepPrimaryStoreDesc',
          isComplete: primaryStoreComplete,
          isOptional: false,
          isApplicable: true,
          navigateTo: 'primaryStore',
        },
        {
          id: 'hours',
          groupId: 'locationsHours',
          titleKey: 'setupStepHoursTitle',
          descKey: 'setupStepHoursDesc',
          isComplete: hoursComplete,
          isOptional: false,
          isApplicable: true,
          navigateTo: 'hours',
        },
        {
          id: 'additionalLocations',
          groupId: 'locationsHours',
          titleKey: 'setupStepAdditionalLocationsTitle',
          descKey: 'setupStepAdditionalLocationsDesc',
          isComplete: additionalLocationsComplete,
          isOptional: false,
          isApplicable: true,
          navigateTo: 'additionalLocations',
        },
      ],
    },

    {
      id: 'services',
      titleKey: 'setupGroupServicesTitle',
      descKey: 'setupGroupServicesDesc',
      groupType: 'foundation',
      steps: [
        {
          id: 'services',
          groupId: 'services',
          titleKey: 'setupStepServicesTitle',
          descKey: 'setupStepServicesDesc',
          isComplete: servicesComplete,
          isOptional: false,
          isApplicable: true,
          navigateTo: 'services',
        },
        {
          id: 'staff',
          groupId: 'services',
          titleKey: 'setupStepStaffTitle',
          descKey: 'setupStepStaffDesc',
          isComplete: staffComplete,
          isOptional: false,
          isApplicable: !isWalkIns,
          navigateTo: 'staff',
        },
        {
          id: 'serviceAssign',
          groupId: 'services',
          titleKey: 'setupStepServiceAssignTitle',
          descKey: 'setupStepServiceAssignDesc',
          isComplete: serviceAssignComplete,
          isOptional: false,
          isApplicable: !isWalkIns,
          navigateTo: 'serviceAssign',
        },
        {
          id: 'staffCalendar',
          groupId: 'services',
          titleKey: 'setupStepStaffCalendarTitle',
          descKey: 'setupStepStaffCalendarDesc',
          isComplete: staffCalendarComplete,
          isOptional: false,
          isApplicable: !isWalkIns,
          navigateTo: 'staffCalendar',
        },
      ],
    },

    // ── BUSINESS OPERATIONS ────────────────────────────────────────────────────

    {
      id: 'operations',
      titleKey: 'setupGroupOperationsTitle',
      descKey: 'setupGroupOperationsDesc',
      groupType: 'foundation',
      steps: [
        {
          id: 'teamAccess',
          groupId: 'operations',
          titleKey: 'setupStepTeamAccessTitle',
          descKey: 'setupStepTeamAccessDesc',
          isComplete: teamAccessComplete,
          isOptional: false,
          isApplicable: true,
          navigateTo: 'teamAccess',
        },
      ],
    },

    // ── ENHANCEMENTS ─────────────────────────────────────────────────────────

    {
      id: 'booking',
      titleKey: 'setupGroupBookingTitle',
      descKey: 'setupGroupBookingDesc',
      groupType: 'enhancement',
      steps: [
        {
          id: 'bookingLink',
          groupId: 'booking',
          titleKey: 'setupStepBookingLinkTitle',
          descKey: 'setupStepBookingLinkDesc',
          isComplete: bookingLinkComplete,
          isOptional: true,
          isApplicable: !isWalkIns,
          navigateTo: 'bookingLink',
        },
        {
          id: 'bookingBranding',
          groupId: 'booking',
          titleKey: 'setupStepBookingBrandingTitle',
          descKey: 'setupStepBookingBrandingDesc',
          isComplete: bookingBrandingComplete,
          isOptional: true,
          isApplicable: !isWalkIns,
          navigateTo: 'bookingBranding',
        },
        {
          id: 'bookingLanguage',
          groupId: 'booking',
          titleKey: 'setupStepBookingLanguageTitle',
          descKey: 'setupStepBookingLanguageDesc',
          isComplete: bookingLanguageComplete,
          isOptional: true,
          isApplicable: !isWalkIns,
          navigateTo: 'bookingLanguage',
        },
      ],
    },

    {
      id: 'brand',
      titleKey: 'setupGroupBrandTitle',
      descKey: 'setupGroupBrandDesc',
      groupType: 'enhancement',
      steps: [
        {
          id: 'logo',
          groupId: 'brand',
          titleKey: 'setupStepLogoTitle',
          descKey: 'setupStepLogoDesc',
          isComplete: logoComplete,
          isOptional: true,
          isApplicable: true,
          navigateTo: 'logo',
        },
        {
          id: 'brandColors',
          groupId: 'brand',
          titleKey: 'setupStepBrandColorsTitle',
          descKey: 'setupStepBrandColorsDesc',
          isComplete: brandColorsComplete,
          isOptional: true,
          isApplicable: true,
          navigateTo: 'brandColors',
        },
        {
          id: 'businessLinks',
          groupId: 'brand',
          titleKey: 'setupStepBusinessLinksTitle',
          descKey: 'setupStepBusinessLinksDesc',
          isComplete: businessLinksComplete,
          isOptional: true,
          isApplicable: true,
          navigateTo: 'businessLinks',
        },
      ],
    },

    {
      id: 'programs',
      titleKey: 'setupGroupProgramsTitle',
      descKey: 'setupGroupProgramsDesc',
      groupType: 'enhancement',
      steps: [
        {
          id: 'loyalty',
          groupId: 'programs',
          titleKey: 'setupStepLoyaltyTitle',
          descKey: 'setupStepLoyaltyDesc',
          isComplete: loyaltyComplete,
          isOptional: true,
          isApplicable: true,
          navigateTo: 'loyalty',
        },
        {
          id: 'membership',
          groupId: 'programs',
          titleKey: 'setupStepMembershipTitle',
          descKey: 'setupStepMembershipDesc',
          isComplete: membershipComplete,
          isOptional: true,
          isApplicable: true,
          navigateTo: 'membership',
        },
        {
          id: 'giftCards',
          groupId: 'programs',
          titleKey: 'setupStepGiftCardsTitle',
          descKey: 'setupStepGiftCardsDesc',
          isComplete: giftCardsComplete,
          isOptional: true,
          isApplicable: true,
          navigateTo: 'giftCards',
        },
      ],
    },

    {
      id: 'firstClient',
      titleKey: 'setupGroupFirstClientTitle',
      descKey: 'setupGroupFirstClientDesc',
      groupType: 'enhancement',
      steps: [
        {
          id: 'firstClient',
          groupId: 'firstClient',
          titleKey: 'setupStepFirstClientTitle',
          descKey: 'setupStepFirstClientDesc',
          isComplete: firstClientComplete,
          isOptional: true,
          isApplicable: true,
          navigateTo: 'firstClient',
        },
      ],
    },
  ];

  // ── Compute totals ──────────────────────────────────────────────────────────

  // Required applicable steps = foundation && applicable && !optional
  const requiredApplicableSteps = groups
    .filter((g) => g.groupType === 'foundation')
    .flatMap((g) => g.steps)
    .filter((s) => s.isApplicable && !s.isOptional);

  const totalApplicable = requiredApplicableSteps.length;
  const totalComplete = requiredApplicableSteps.filter((s) => s.isComplete).length;
  const allFoundationComplete = totalApplicable > 0 && totalComplete === totalApplicable;

  return {
    groups,
    totalApplicable,
    totalComplete,
    allFoundationComplete,
    isLoading,
  };
}
