import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Download,
  LogOut,
  ChevronRight,
  Check,
  X,
  Crown,
  Calendar,
  AlertCircle,
  Palette,
  KeyRound,
  RotateCcw,
  Sparkles,
  FileText,
  Volume2,
  Vibrate,
  ScanFace,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { feedbackToggle } from '@/lib/SoundManager';
import { t, getDateFnsLocale, getCachedDateFnsLocale, formatPrice, capitalizeMonthInDate } from '@/lib/i18n';
import { Language, CurrencyCode, CountryCode } from '@/lib/types';
import { COUNTRIES, US_STATES, getEmailFooterPreview, getCurrencyForCountry, formatPhoneForEmailFooter } from '@/lib/country-legal-compliance';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { getCurrencyByCode } from '@/lib/currency';
import { ServicesProductsScreen } from '@/components/ServicesProductsScreen';
import { HelpCenterScreen } from '@/components/HelpCenterScreen';
import { LegalHelpHubScreen } from '@/components/LegalHelpHubScreen';
import { StoresStaffCalendarHub } from '@/components/StoresStaffCalendarHub';
import { BookingLanguageSettings } from '@/components/BookingLanguageSettings';
import { BookingLinkQR } from '@/components/BookingLinkQR';
import { BookingBrandingSettings } from '@/components/BookingBrandingSettings';
import { BookingCombinedSettings } from '@/components/BookingCombinedSettings';
import { BusinessBrandingSettings } from '@/components/BusinessBrandingSettings';
import { TeamAccessPermissionsScreen } from '@/components/TeamAccessPermissionsScreen';
import { GiftCardScreen } from '@/components/GiftCardScreen';
import { MembershipProgramScreen } from '@/components/MembershipProgramScreen';
import { LoyaltyProgramScreen } from '@/components/LoyaltyProgramScreen';
import { DEFAULT_BOOKING_PAGE_SETTINGS } from '@/services/bookingPageSettingsService';
import {
  CURRENT_TERMS_VERSION,
  TERMS_LAST_UPDATED,
  COMPANY_INFO,
  getTermsOfService,
  getLegalDisclaimer,
  getLimitationOfLiability,
  getArbitrationAgreement,
  getIndemnification,
  getPrivacyPolicy,
  getCookiePolicy,
  getPrivacyPolicySection,
  getCookiePolicySection,
  getOnlineBookingTerms,
  getGiftCardTerms,
  getGiftCardTermsTitle,
  getAIInsightsDisclaimer,
  getAIInsightsDisclaimerTitle,
} from '@/lib/legal-content';
import { cn } from '@/lib/cn';
import { WheelDatePicker } from '@/components/WheelDatePicker';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays, subWeeks, subMonths, subQuarters } from 'date-fns';
import type { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { getSubscriptionPlans } from '@/lib/trial-service';
import {
  isBiometricAvailable,
  getBiometricDisplayName,
  isFaceIdEnabledForUser,
  enableFaceIdForUser,
  disableFaceIdForUser,
} from '@/lib/face-id-service';
import { useBusiness } from '@/hooks/useBusiness';
import { updateBusinessInfo } from '@/services/authService';
import { deleteAccount } from '@/services/authService';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { syncMainStoreFromSettings, getStores } from '@/services/storesService';
import { storeKeys } from '@/hooks/useStores';
import { staffCalendarKeys } from '@/hooks/useStaffCalendar';
import { getStaffCalendarShifts, getWeekStart, formatDateISO } from '@/services/staffCalendarService';
import { SettingsHeader } from './settings/SettingsHeader';
import { PreferencesSection } from './settings/PreferencesSection';
import { LanguageSelector } from './settings/LanguageSelector';
import { MembershipCard } from './settings/MembershipCard';
import { BusinessInfoSection } from './settings/BusinessInfoSection';
import { BusinessSetupModal } from './BusinessSetupModal';

interface SettingsScreenProps {
  onLogout: () => void;
}

const THEME_COLORS = [
  { nameKey: 'colorTeal' as const, color: '#0D9488' },
  { nameKey: 'colorBlue' as const, color: '#3B82F6' },
  { nameKey: 'colorPurple' as const, color: '#8B5CF6' },
  { nameKey: 'colorPink' as const, color: '#EC4899' },
  { nameKey: 'colorRed' as const, color: '#EF4444' },
  { nameKey: 'colorOrange' as const, color: '#F97316' },
  { nameKey: 'colorAmber' as const, color: '#F59E0B' },
  { nameKey: 'colorEmerald' as const, color: '#10B981' },
  { nameKey: 'colorIndigo' as const, color: '#6366F1' },
  { nameKey: 'colorSlate' as const, color: '#64748B' },
];

export function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const queryClient = useQueryClient();
  const { signOut } = useSupabaseAuth();
  const user = useStore((s) => s.user);
  const language = useStore((s) => s.language) as Language;
  const setLanguage = useStore((s) => s.setLanguage);
  const updateMembershipPlan = useStore((s) => s.updateMembershipPlan);
  const cancelMembership = useStore((s) => s.cancelMembership);
  const renewMembership = useStore((s) => s.renewMembership);
  const activateSubscription = useStore((s) => s.activateSubscription);

  const themeSettings = useStore((s) => s.themeSettings);
  const setThemeSettings = useStore((s) => s.setThemeSettings);
  const currency = useStore((s) => s.currency);
  const setCurrency = useStore((s) => s.setCurrency);
  const updateUserInfo = useStore((s) => s.updateUserInfo);
  const calendarEnabled = useStore((s) => s.featureToggles.calendarEnabled);
  const setCalendarEnabled = useStore((s) => s.setCalendarEnabled);
  const businessTypeSelection = useStore((s) => s.businessTypeSelection);
  const soundsEnabled = useStore((s) => s.soundsEnabled);
  const setSoundsEnabled = useStore((s) => s.setSoundsEnabled);
  const vibrationsEnabled = useStore((s) => s.vibrationsEnabled);
  const setVibrationsEnabled = useStore((s) => s.setVibrationsEnabled);

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportEmail, setExportEmail] = useState('');
  const [exportTimeframe, setExportTimeframe] = useState<'day' | 'week' | 'month' | 'quarter' | 'custom'>('month');
  const [exportCustomStartDate, setExportCustomStartDate] = useState<Date>(subMonths(new Date(), 1));
  const [exportCustomEndDate, setExportCustomEndDate] = useState<Date>(new Date());
  const [showExportStartDatePicker, setShowExportStartDatePicker] = useState(false);
  const [showExportEndDatePicker, setShowExportEndDatePicker] = useState(false);
  // Export Content Filters - all selected by default
  const [exportContentClients, setExportContentClients] = useState(true);
  const [exportContentVisits, setExportContentVisits] = useState(true);
  const [exportContentAppointments, setExportContentAppointments] = useState(true);
  const [exportContentRevenue, setExportContentRevenue] = useState(true);
  const [exportContentAnalytics, setExportContentAnalytics] = useState(true);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedPrimaryColor, setSelectedPrimaryColor] = useState(themeSettings.primaryColor);
  const [selectedButtonColor, setSelectedButtonColor] = useState(themeSettings.buttonColor);
  const [showBusinessNameModal, setShowBusinessNameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showBusinessAddressModal, setShowBusinessAddressModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [selectedLegalSection, setSelectedLegalSection] = useState<'terms' | 'pricing' | 'email' | 'privacy' | 'cookies'>('terms');
  const [showSoundHapticsModal, setShowSoundHapticsModal] = useState(false);
  const [showHelpCenterModal, setShowHelpCenterModal] = useState(false);
  const [showLegalHelpHubModal, setShowLegalHelpHubModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountSuccess, setDeleteAccountSuccess] = useState(false);
  const [showTeamServicesModal, setShowTeamServicesModal] = useState(false);
  const [showServicesProductsModal, setShowServicesProductsModal] = useState(false);
  const [showBookingCombinedModal, setShowBookingCombinedModal] = useState(false);
  const [showBusinessBrandingModal, setShowBusinessBrandingModal] = useState(false);
  const [showTeamAccessModal, setShowTeamAccessModal] = useState(false);
  const [showGiftCardModal, setShowGiftCardModal] = useState(false);
  const [showBusinessSetupModal, setShowBusinessSetupModal] = useState(false);
  const [showMembershipProgramModal, setShowMembershipProgramModal] = useState(false);
  const [showLoyaltyProgramModal, setShowLoyaltyProgramModal] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState(user?.businessName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editBusinessAddress, setEditBusinessAddress] = useState(user?.businessAddress || '');
  const [editBusinessPhoneNumber, setEditBusinessPhoneNumber] = useState(user?.businessPhoneNumber || '');
  const [editBusinessCountry, setEditBusinessCountry] = useState<CountryCode | undefined>(user?.businessCountry);
  const [editBusinessState, setEditBusinessState] = useState(user?.businessState || '');
  const [editEmailFooterLanguage, setEditEmailFooterLanguage] = useState<Language>(user?.emailFooterLanguage || 'en');
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [dateLocale, setDateLocale] = useState<Locale | undefined>(undefined);

  // Face ID state
  const [faceIdAvailable, setFaceIdAvailable] = useState(false);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [biometricName, setBiometricName] = useState('Face ID');
  const [showFaceIdPasswordModal, setShowFaceIdPasswordModal] = useState(false);
  const [faceIdPassword, setFaceIdPassword] = useState('');
  const [faceIdLoading, setFaceIdLoading] = useState(false);

  const { isDark, colors, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();

  // Business data from Supabase
  const { businessId, business, refetch: refetchBusiness } = useBusiness();
  const [isSavingBusinessInfo, setIsSavingBusinessInfo] = useState(false);

  // Prefetch stores + current-week shifts so Staff Calendar opens instantly
  const prefetchStaffCalendar = React.useCallback(() => {
    if (!businessId) return;
    const weekStart = formatDateISO(getWeekStart(new Date()));
    // Prefetch stores list
    queryClient.prefetchQuery({
      queryKey: storeKeys.list(businessId),
      queryFn: () => getStores(businessId),
      staleTime: 30 * 1000,
    });
    // Prefetch shifts for first store if we already have stores cached
    const cachedStores = queryClient.getQueryData<{ id: string }[]>(storeKeys.list(businessId));
    if (cachedStores && cachedStores.length > 0) {
      const firstStoreId = cachedStores[0].id;
      queryClient.prefetchQuery({
        queryKey: staffCalendarKeys.shifts(businessId, firstStoreId, weekStart),
        queryFn: () => getStaffCalendarShifts(businessId, firstStoreId, new Date(weekStart + 'T00:00:00')),
        staleTime: 30 * 1000,
      });
    }
  }, [businessId, queryClient]);

  // Sync edit states when business data loads from Supabase (PRIMARY source of truth)
  // This ensures values persist across sign out/sign in
  useEffect(() => {
    // Hydrate from Supabase business data (highest priority - persisted data)
    if (business) {
      if (business.name && editBusinessName === '') {
        setEditBusinessName(business.name);
      }
      if (business.business_address) {
        setEditBusinessAddress(business.business_address);
      }
      if (business.business_phone_number) {
        setEditBusinessPhoneNumber(business.business_phone_number);
      }
      if (business.business_country) {
        setEditBusinessCountry(business.business_country as CountryCode);
      }
      if (business.business_state) {
        setEditBusinessState(business.business_state);
      }
      if (business.email_footer_language) {
        setEditEmailFooterLanguage(business.email_footer_language as Language);
      }
      // Sync timezone from DB into store (in case it was set in a previous session)
      const dbTimezone = (business as unknown as Record<string, unknown>)?.timezone as string | undefined;
      if (dbTimezone && !user?.businessTimezone) {
        updateUserInfo({ businessTimezone: dbTimezone });
      }
    }
    // Fallback to local store if business not loaded yet (for backwards compatibility)
    else if (user) {
      if (user.businessName && editBusinessName === '') {
        setEditBusinessName(user.businessName);
      }
      if (user.businessAddress && editBusinessAddress === '') {
        setEditBusinessAddress(user.businessAddress);
      }
      if (user.businessPhoneNumber && editBusinessPhoneNumber === '') {
        setEditBusinessPhoneNumber(user.businessPhoneNumber);
      }
      if (user.businessCountry && !editBusinessCountry) {
        setEditBusinessCountry(user.businessCountry);
      }
      if (user.businessState && editBusinessState === '') {
        setEditBusinessState(user.businessState);
      }
      if (user.emailFooterLanguage) {
        setEditEmailFooterLanguage(user.emailFooterLanguage);
      }
    }
    // Also sync email from user (email is on auth user, not business)
    if (user?.email && editEmail === '') {
      setEditEmail(user.email);
    }
  }, [business, user]);

  // Check Face ID availability and status on mount (iOS only)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const checkFaceId = async () => {
      const available = await isBiometricAvailable();
      setFaceIdAvailable(available);

      if (available) {
        const name = await getBiometricDisplayName();
        setBiometricName(name);

        if (user?.id) {
          const enabled = await isFaceIdEnabledForUser(user.id);
          setFaceIdEnabled(enabled);
        }
      }
    };

    checkFaceId();
  }, [user?.id]);

  // Load date-fns locale when language changes
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  // Generate terms and conditions sections with language-aware content
  const termsAndConditionsSections = useMemo(() => [
    {
      sectionNumber: 1,
      title: t('termsOfService', language),
      content: getTermsOfService(language),
    },
    {
      sectionNumber: 2,
      title: t('legalDisclaimer', language),
      content: getLegalDisclaimer(language),
    },
    {
      sectionNumber: 3,
      title: t('limitationOfLiability', language),
      content: getLimitationOfLiability(language),
    },
    {
      sectionNumber: 4,
      title: t('arbitrationAgreement', language),
      content: getArbitrationAgreement(language),
    },
    {
      sectionNumber: 5,
      title: t('indemnification', language),
      content: getIndemnification(language),
    },
    {
      sectionNumber: 6,
      title: t('privacyPolicy', language),
      content: getPrivacyPolicy(language),
    },
    {
      sectionNumber: 7,
      title: t('onlineBookingTermsTitle', language),
      content: getOnlineBookingTerms(language),
    },
    {
      sectionNumber: 8,
      title: getGiftCardTermsTitle(language),
      content: getGiftCardTerms(language),
    },
    {
      sectionNumber: 9,
      title: getAIInsightsDisclaimerTitle(language),
      content: getAIInsightsDisclaimer(language),
    },
  ], [language]);

  // Generate Privacy Policy sections
  const privacyPolicySections = useMemo(() => [
    {
      sectionNumber: 1,
      title: t('dataWeCollect', language),
      content: getPrivacyPolicySection(language, 1),
    },
    {
      sectionNumber: 2,
      title: t('howWeUseData', language),
      content: getPrivacyPolicySection(language, 2),
    },
    {
      sectionNumber: 3,
      title: t('dataStorageSecurity', language),
      content: getPrivacyPolicySection(language, 3),
    },
    {
      sectionNumber: 4,
      title: t('yourRights', language),
      content: getPrivacyPolicySection(language, 4),
    },
    {
      sectionNumber: 5,
      title: t('legalCompliance', language),
      content: getPrivacyPolicySection(language, 5),
    },
    {
      sectionNumber: 6,
      title: t('contactUs', language),
      content: getPrivacyPolicySection(language, 6),
    },
  ], [language]);

  // Generate Cookie Policy sections
  const cookiePolicySections = useMemo(() => [
    {
      sectionNumber: 1,
      title: t('aboutThisPolicy', language),
      content: getCookiePolicySection(language, 1),
    },
    {
      sectionNumber: 2,
      title: t('cookieUsage', language),
      content: getCookiePolicySection(language, 2),
    },
    {
      sectionNumber: 3,
      title: t('noCookiesUsed', language),
      content: getCookiePolicySection(language, 3),
    },
    {
      sectionNumber: 4,
      title: t('whatWeStorLocally', language),
      content: getCookiePolicySection(language, 4),
    },
    {
      sectionNumber: 5,
      title: t('yourControl', language),
      content: getCookiePolicySection(language, 5),
    },
    {
      sectionNumber: 6,
      title: t('thirdPartyServices', language),
      content: getCookiePolicySection(language, 6),
    },
    {
      sectionNumber: 7,
      title: t('changesToThisPolicy', language),
      content: getCookiePolicySection(language, 7),
    },
    {
      sectionNumber: 8,
      title: t('contactUs', language),
      content: getCookiePolicySection(language, 8),
    },
  ], [language]);

  const versionText = language === 'es'
    ? 'Versión'
    : language === 'fr'
    ? 'Version'
    : language === 'pt'
    ? 'Versão'
    : language === 'de'
    ? 'Version'
    : language === 'it'
    ? 'Versione'
    : language === 'ru'
    ? 'Версия'
    : language === 'tr'
    ? 'Sürüm'
    : language === 'zh'
    ? '版本'
    : language === 'ko'
    ? '버전'
    : language === 'ja'
    ? 'バージョン'
    : language === 'sv'
    ? 'Version'
    : language === 'no'
    ? 'Versjon'
    : language === 'da'
    ? 'Version'
    : language === 'fi'
    ? 'Versio'
    : language === 'is'
    ? 'Útgáfa'
    : language === 'nl'
    ? 'Versie'
    : 'Version';

  const lastUpdatedText = language === 'es'
    ? 'Última actualización'
    : language === 'fr'
    ? 'Dernière mise à jour'
    : language === 'pt'
    ? 'Última atualização'
    : language === 'de'
    ? 'Letzte Aktualisierung'
    : language === 'it'
    ? 'Ultimo aggiornamento'
    : language === 'ru'
    ? 'Последнее обновление'
    : language === 'tr'
    ? 'Son Güncelleme'
    : language === 'zh'
    ? '最后更新'
    : language === 'ko'
    ? '최근 업데이트'
    : language === 'ja'
    ? '最終更新'
    : language === 'sv'
    ? 'Senast uppdaterad'
    : language === 'no'
    ? 'Sist oppdatert'
    : language === 'da'
    ? 'Sidst opdateret'
    : language === 'fi'
    ? 'Viimeksi päivitetty'
    : language === 'is'
    ? 'Síðast uppfært'
    : language === 'nl'
    ? 'Laatst bijgewerkt'
    : 'Last Updated';

  // Calculate expiration date based on membership plan
  const getExpirationDate = () => {
    if (!user?.membershipStartDate) return null;
    const startDate = new Date(user.membershipStartDate);
    const expirationDate = new Date(startDate);
    if (user.membershipPlan === 'yearly') {
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    } else {
      expirationDate.setMonth(expirationDate.getMonth() + 1);
    }
    return expirationDate;
  };

  const handleChangePlan = (plan: 'monthly' | 'yearly') => {
    Alert.alert(
      'Change Plan',
      `Are you sure you want to switch to the ${plan} plan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            updateMembershipPlan(plan);
            Alert.alert('Success', `Your plan has been changed to ${plan}.`);
          },
        },
      ]
    );
  };

  const handleCancelMembership = () => {
    Alert.alert(
      'Cancel Membership',
      'Are you sure you want to cancel your membership? You will lose access to premium features.',
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Membership',
          style: 'destructive',
          onPress: () => {
            cancelMembership();
            setShowMembershipModal(false);
            Alert.alert('Membership Cancelled', 'Your membership has been cancelled.');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      t('logout', language),
      'Are you sure you want to sign out?',
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('logout', language),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            onLogout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    setDeleteAccountLoading(true);
    setDeleteAccountError('');
    const { error } = await deleteAccount();
    setDeleteAccountLoading(false);
    if (error) {
      setDeleteAccountError(t('deleteAccountError', language));
      return;
    }
    // Show success state briefly, then sign out
    setDeleteAccountSuccess(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setShowDeleteAccountModal(false);
    setDeleteAccountSuccess(false);
    await signOut();
    onLogout();
  };

  const handleExport = () => {
    // Calculate date range based on selected timeframe
    let startDate: Date;
    let endDate: Date;
    const now = new Date();

    switch (exportTimeframe) {
      case 'day':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 0 });
        endDate = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'custom':
        startDate = startOfDay(exportCustomStartDate);
        endDate = endOfDay(exportCustomEndDate);
        break;
    }

    const timeframeLabel = exportTimeframe === 'custom'
      ? `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
      : exportTimeframe.charAt(0).toUpperCase() + exportTimeframe.slice(1);

    // In a real app, this would send data to the backend to email
    Alert.alert(
      t('success', language),
      `Client data for ${timeframeLabel} will be sent to ${exportEmail || user?.email}`,
      [{ text: 'OK' }]
    );
    setShowExportModal(false);
    setExportEmail('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <SettingsHeader language={language} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <MembershipCard
          language={language}
          membershipPlan={user?.membershipPlan}
          membershipStartDate={user?.membershipStartDate}
          dateLocale={dateLocale}
          onPress={() => setShowMembershipModal(true)}
        />

        <BusinessInfoSection
          language={language}
          calendarEnabled={calendarEnabled}
          onCalendarToggle={() => { setCalendarEnabled(!calendarEnabled); feedbackToggle(); }}
          onQrLinkPress={() => setShowBookingCombinedModal(true)}
          onBrandingPress={() => setShowBusinessBrandingModal(true)}
          onStoresStaffPress={() => { prefetchStaffCalendar(); setShowTeamServicesModal(true); }}
          onTeamAccessPress={() => setShowTeamAccessModal(true)}
          onServicesProductsPress={() => setShowServicesProductsModal(true)}
          businessTypeSelection={businessTypeSelection}
          onBusinessSetupPress={() => setShowBusinessSetupModal(true)}
        />
        <PreferencesSection
          language={language}
          themeSettings={themeSettings}
          faceIdAvailable={faceIdAvailable}
          faceIdEnabled={faceIdEnabled}
          onLanguagePress={() => setShowLanguageModal(true)}
          onThemeColorsPress={() => { setSelectedPrimaryColor(themeSettings.primaryColor); setSelectedButtonColor(themeSettings.buttonColor); setShowThemeModal(true); }}
          onDarkModePress={() => { setThemeSettings({ darkMode: !isDark }); feedbackToggle(); }}
          onFaceIdPress={async () => { if (!faceIdEnabled) { setFaceIdPassword(''); setShowFaceIdPasswordModal(true); } else { if (user?.id) { await disableFaceIdForUser(user.id); setFaceIdEnabled(false); feedbackToggle(); showSuccess(t('faceIdDisabled', language)); } } }}
          onSoundHapticsPress={() => setShowSoundHapticsModal(true)}
          onExportDataPress={() => setShowExportModal(true)}
          onEmailPasswordPress={() => { setEditEmail(user?.email || ''); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setShowChangePasswordModal(true); }}
          onLegalPress={() => setShowLegalHelpHubModal(true)}
          onLogoutPress={() => setShowLogoutModal(true)}
          onDeleteAccountPress={() => { setDeleteAccountConfirm(''); setDeleteAccountError(''); setShowDeleteAccountModal(true); }}
        />
      </ScrollView>

      {/* Language Modal */}
      <LanguageSelector
        visible={showLanguageModal}
        language={language}
        onClose={() => setShowLanguageModal(false)}
        onSelectLanguage={async (lang) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await setLanguage(lang);
          setShowLanguageModal(false);
        }}
      />

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExportModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Download size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('exportData', language)}</Text>
            </View>
            <Pressable
              onPress={() => setShowExportModal(false)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Timeframe Selector */}
            <Animated.View
              entering={FadeInDown.delay(50).duration(300)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 12 }}>{t('exportTimeframe', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 16 }}>
                {t('exportTimeframeDescription', language)}
              </Text>

              {/* Timeframe Options */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['day', 'week', 'month', 'quarter', 'custom'] as const).map((timeframe) => (
                  <Pressable
                    key={timeframe}
                    onPress={() => setExportTimeframe(timeframe)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: exportTimeframe === timeframe ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '500',
                        color: exportTimeframe === timeframe ? '#fff' : colors.textSecondary,
                      }}
                    >
                      {timeframe === 'day' ? t('exportDay', language) :
                       timeframe === 'week' ? t('exportWeek', language) :
                       timeframe === 'month' ? t('exportMonth', language) :
                       timeframe === 'quarter' ? t('exportQuarter', language) : t('exportCustom', language)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Show date range info */}
              {exportTimeframe !== 'custom' && (
                <View style={{ marginTop: 12, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {exportTimeframe === 'day' && `${t('exportTodayLabel', language)}: ${format(new Date(), 'PPP', { locale: dateLocale })}`}
                    {exportTimeframe === 'week' && `${t('exportThisWeekLabel', language)}: ${format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'MMM d', { locale: dateLocale })} - ${format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'PPP', { locale: dateLocale })}`}
                    {exportTimeframe === 'month' && `${t('exportThisMonthLabel', language)}: ${format(startOfMonth(new Date()), 'MMM d', { locale: dateLocale })} - ${format(endOfMonth(new Date()), 'PPP', { locale: dateLocale })}`}
                    {exportTimeframe === 'quarter' && `${t('exportThisQuarterLabel', language)}: ${format(startOfQuarter(new Date()), 'MMM d', { locale: dateLocale })} - ${format(endOfQuarter(new Date()), 'PPP', { locale: dateLocale })}`}
                  </Text>
                </View>
              )}

              {/* Custom Date Range */}
              {exportTimeframe === 'custom' && (
                <View style={{ marginTop: 16 }}>
                  <View style={{ marginBottom: 16 }}>
                    <WheelDatePicker
                      label={t('exportStartDateLabel', language)}
                      value={exportCustomStartDate}
                      onChange={setExportCustomStartDate}
                      isOpen={showExportStartDatePicker}
                      onToggle={() => {
                        setShowExportStartDatePicker(!showExportStartDatePicker);
                        setShowExportEndDatePicker(false);
                      }}
                      maximumDate={exportCustomEndDate}
                    />
                  </View>
                  <View>
                    <WheelDatePicker
                      label={t('exportEndDateLabel', language)}
                      value={exportCustomEndDate}
                      onChange={setExportCustomEndDate}
                      isOpen={showExportEndDatePicker}
                      onToggle={() => {
                        setShowExportEndDatePicker(!showExportEndDatePicker);
                        setShowExportStartDatePicker(false);
                      }}
                      minimumDate={exportCustomStartDate}
                      maximumDate={new Date()}
                    />
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Export Content Filters */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(300)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 12 }}>{t('exportContent', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, marginBottom: 16 }}>
                {t('exportContentDescription', language)}
              </Text>

              {/* Content Filter Checkboxes */}
              <View style={{ gap: 12 }}>
                {/* Clients */}
                <Pressable
                  onPress={() => setExportContentClients(!exportContentClients)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: exportContentClients ? primaryColor : colors.border,
                    backgroundColor: exportContentClients ? primaryColor : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {exportContentClients && <Check size={16} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16 }}>{t('exportContentClients', language)}</Text>
                </Pressable>

                {/* Visits */}
                <Pressable
                  onPress={() => setExportContentVisits(!exportContentVisits)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: exportContentVisits ? primaryColor : colors.border,
                    backgroundColor: exportContentVisits ? primaryColor : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {exportContentVisits && <Check size={16} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16 }}>{t('exportContentVisits', language)}</Text>
                </Pressable>

                {/* Appointments */}
                <Pressable
                  onPress={() => setExportContentAppointments(!exportContentAppointments)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: exportContentAppointments ? primaryColor : colors.border,
                    backgroundColor: exportContentAppointments ? primaryColor : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {exportContentAppointments && <Check size={16} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16 }}>{t('exportContentAppointments', language)}</Text>
                </Pressable>

                {/* Revenue */}
                <Pressable
                  onPress={() => setExportContentRevenue(!exportContentRevenue)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: exportContentRevenue ? primaryColor : colors.border,
                    backgroundColor: exportContentRevenue ? primaryColor : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {exportContentRevenue && <Check size={16} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16 }}>{t('exportContentRevenue', language)}</Text>
                </Pressable>

                {/* Analytics */}
                <Pressable
                  onPress={() => setExportContentAnalytics(!exportContentAnalytics)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: exportContentAnalytics ? primaryColor : colors.border,
                    backgroundColor: exportContentAnalytics ? primaryColor : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {exportContentAnalytics && <Check size={16} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16 }}>{t('exportContentAnalytics', language)}</Text>
                </Pressable>
              </View>

              {/* Warning if none selected */}
              {!exportContentClients && !exportContentVisits && !exportContentAppointments && !exportContentRevenue && !exportContentAnalytics && (
                <View style={{ marginTop: 12, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12 }}>
                  <Text style={{ color: '#DC2626', fontSize: 14 }}>{t('exportSelectAtLeastOne', language)}</Text>
                </View>
              )}
            </Animated.View>

            {/* Email Input */}
            <Animated.View
              entering={FadeInDown.delay(150).duration(300)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 12 }}>{t('exportDestination', language)}</Text>
              <Input
                label={t('email', language)}
                placeholder={user?.email || 'your@email.com'}
                value={exportEmail}
                onChangeText={setExportEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                containerClassName="mb-2"
              />
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {t('exportDestinationHint', language)}
              </Text>
            </Animated.View>

            {/* Export Info */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(300)}
              style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}30` }}
            >
              <Text style={{ color: isDark ? '#5EEAD4' : '#0F766E', fontWeight: '600', marginBottom: 4 }}>{t('exportWhatsIncluded', language)}</Text>
              <Text style={{ color: isDark ? '#5EEAD4' : primaryColor, fontSize: 14 }}>
                {exportContentClients && `• ${t('exportClientsIncluded', language)}\n`}
                {exportContentVisits && `• ${t('exportVisitsIncluded', language)}\n`}
                {exportContentAppointments && `• ${t('exportAppointmentsIncluded', language)}\n`}
                {exportContentRevenue && `• ${t('exportRevenueIncluded', language)}\n`}
                {exportContentAnalytics && `• ${t('exportAnalyticsIncluded', language)}`}
              </Text>
            </Animated.View>

            {/* Export Button */}
            <Button
              title={t('exportData', language)}
              onPress={handleExport}
              disabled={!exportContentClients && !exportContentVisits && !exportContentAppointments && !exportContentRevenue && !exportContentAnalytics}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Membership Modal */}
      <Modal
        visible={showMembershipModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembershipModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <Animated.View
            entering={FadeIn.duration(300)}
            className="flex-row items-center justify-between px-5 py-4"
            style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center">
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? '#F59E0B30' : '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Crown size={22} color="#F59E0B" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('membership', language)}</Text>
            </View>
            <Pressable
              onPress={() => setShowMembershipModal(false)}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
            {/* Renewal Banner for Cancelled Users */}
            {!user?.membershipActive && user?.membershipPlan && (
              <Animated.View
                entering={FadeInDown.delay(50).duration(400)}
                className="rounded-2xl p-4 mb-4 border border-teal-200"
                style={{ backgroundColor: isDark ? '#0F766E20' : '#F0FDFB' }}
              >
                <View className="flex-row items-center mb-2">
                  <RotateCcw size={18} color="#0D9488" />
                  <Text className="font-semibold ml-2" style={{ color: isDark ? '#5EEAD4' : '#0F766E' }}>{t('welcomeBack', language)}</Text>
                </View>
                <Text className="text-sm mb-3" style={{ color: isDark ? '#99F6E4' : '#0F766E' }}>
                  {t('renewNowMessage', language)}
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert(
                      t('renewMembership', language),
                      `${t('renew', language)} ${user.membershipPlan === 'yearly' ? t('yearlyPlan', language) : t('monthlyPlan', language)}?`,
                      [
                        { text: t('cancel', language), style: 'cancel' },
                        {
                          text: t('renew', language),
                          onPress: () => {
                            renewMembership();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          },
                        },
                      ]
                    );
                  }}
                  className="rounded-xl py-3 items-center active:opacity-80"
                  style={{ backgroundColor: '#0D9488' }}
                >
                  <Text className="text-white font-bold">{t('renewMembership', language)}</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Current Plan Card */}
            <View
              className="rounded-2xl p-5 mb-4"
              style={{
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '500', marginBottom: 4 }}>{t('currentPlan', language)}</Text>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
                {user?.membershipPlan === 'yearly' ? t('yearlyPlan', language) : t('monthlyPlan', language)}
              </Text>

              {/* Start Date */}
              <View className="flex-row items-center mb-3">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15` }}
                >
                  <Calendar size={16} color={primaryColor} />
                </View>
                <View className="ml-3">
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('startDate', language)}</Text>
                  <Text style={{ color: colors.text, fontWeight: '500' }}>
                    {user?.membershipStartDate
                      ? capitalizeMonthInDate(format(new Date(user.membershipStartDate), 'PPP', { locale: dateLocale }), language)
                      : 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Expiration Date */}
              <View className="flex-row items-center">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15` }}
                >
                  <AlertCircle size={16} color={primaryColor} />
                </View>
                <View className="ml-3">
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('expirationDate', language)}</Text>
                  <Text style={{ color: primaryColor, fontWeight: 'bold' }}>
                    {getExpirationDate()
                      ? capitalizeMonthInDate(format(getExpirationDate()!, 'PPP', { locale: dateLocale }), language)
                      : 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Status Badge */}
              {user?.membershipActive ? (
                <View
                  className="mt-4 rounded-lg p-3 flex-row items-center"
                  style={{ backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }}
                >
                  <Check size={16} color={isDark ? '#6EE7B7' : '#10B981'} />
                  <Text style={{ color: isDark ? '#6EE7B7' : '#059669', fontWeight: '500', marginLeft: 8 }}>{t('membershipActive', language)}</Text>
                </View>
              ) : (
                <View
                  className="mt-4 rounded-lg p-3 flex-row items-center"
                  style={{ backgroundColor: isDark ? '#450A0A' : '#FEF2F2' }}
                >
                  <AlertCircle size={16} color={isDark ? '#FCA5A5' : '#EF4444'} />
                  <Text style={{ color: isDark ? '#FCA5A5' : '#EF4444', fontWeight: '500', marginLeft: 8 }}>{t('membershipCancelled', language)}</Text>
                </View>
              )}
            </View>

            {/* Subscription Plans Section */}
            <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 12 }}>
              {user?.membershipActive ? t('changePlan', language) : t('selectPlan', language)}
            </Text>

            {/* Monthly Plan Option */}
            {(() => {
              const plans = getSubscriptionPlans(language, currency);
              const monthlyPlan = plans.find(p => p.id === 'monthly');
              const yearlyPlan = plans.find(p => p.id === 'yearly');
              const isMonthlySelected = user?.membershipPlan === 'monthly';
              const isYearlySelected = user?.membershipPlan === 'yearly';
              const wasPreviouslyMonthly = !user?.membershipActive && isMonthlySelected;
              const wasPreviouslyYearly = !user?.membershipActive && isYearlySelected;

              return (
                <>
                  {/* Monthly Plan */}
                  <Pressable
                    onPress={() => {
                      if (!user?.membershipActive) {
                        // User is renewing
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Alert.alert(
                          t('subscribe', language) + ' - ' + t('monthlyPlan', language),
                          `${formatPrice(monthlyPlan?.price ?? 25, language, currency)}${t('perMonthBilled', language)} – ${t('cancelAnytime', language)}`,
                          [
                            { text: t('cancel', language), style: 'cancel' },
                            {
                              text: t('subscribe', language),
                              onPress: () => {
                                activateSubscription('monthly');
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              },
                            },
                          ]
                        );
                      } else if (!isMonthlySelected) {
                        handleChangePlan('monthly');
                      }
                    }}
                    className="rounded-xl p-4 mb-3"
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 2,
                      borderColor: isMonthlySelected ? '#10B981' : 'transparent',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 18 }}>{t('monthly', language)}</Text>
                          {wasPreviouslyMonthly && (
                            <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? '#0F766E30' : '#CCFBF1' }}>
                              <Text className="text-xs font-medium" style={{ color: isDark ? '#5EEAD4' : '#0F766E' }}>{t('yourPlan', language)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>
                          {formatPrice(monthlyPlan?.price ?? 25, language, currency)}
                          <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: 'normal' }}>{t('perMonthBilled', language)}</Text>
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>
                          {t('cancelAnytime', language)}
                        </Text>
                      </View>
                      {isMonthlySelected && user?.membershipActive && (
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: '#10B981' }}>
                          <Check size={14} color="#fff" />
                        </View>
                      )}
                      {wasPreviouslyMonthly && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            renewMembership('monthly');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }}
                          className="rounded-lg px-4 py-2 active:opacity-80"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Text className="text-white font-semibold text-sm">{t('renew', language)}</Text>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>

                  {/* Yearly Plan */}
                  <Pressable
                    onPress={() => {
                      if (!user?.membershipActive) {
                        // User is renewing
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Alert.alert(
                          t('subscribe', language) + ' - ' + t('yearlyPlan', language),
                          `${formatPrice(yearlyPlan?.price ?? 200, language, currency)}${t('perYearBilled', language)} (${t('savingAmount', language)} ${yearlyPlan?.savingsAmount ?? '$40'}) – ${t('billedAnnually', language)}, ${t('nonRefundable', language)}`,
                          [
                            { text: t('cancel', language), style: 'cancel' },
                            {
                              text: t('subscribe', language),
                              onPress: () => {
                                activateSubscription('yearly');
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              },
                            },
                          ]
                        );
                      } else if (!isYearlySelected) {
                        handleChangePlan('yearly');
                      }
                    }}
                    className="rounded-xl p-4 mb-6 relative overflow-hidden"
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 2,
                      borderColor: isYearlySelected ? primaryColor : 'transparent',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                    }}
                  >
                    {/* Best Value Badge */}
                    {yearlyPlan?.isMostPopular && (
                      <View className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl" style={{ backgroundColor: '#0D9488' }}>
                        <View className="flex-row items-center">
                          <Sparkles size={10} color="#FFF" />
                          <Text className="text-white text-xs font-bold ml-1">{t('bestValue', language)}</Text>
                        </View>
                      </View>
                    )}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 18 }}>{t('yearly', language)}</Text>
                          {wasPreviouslyYearly && (
                            <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? '#0F766E30' : '#CCFBF1' }}>
                              <Text className="text-xs font-medium" style={{ color: isDark ? '#5EEAD4' : '#0F766E' }}>{t('yourPlan', language)}</Text>
                            </View>
                          )}
                        </View>
                        <View className="flex-row items-baseline mt-1">
                          <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold' }}>
                            {formatPrice(yearlyPlan?.price ?? 200, language, currency)}
                            <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: 'normal' }}>{t('perYearBilled', language)}</Text>
                          </Text>
                          {yearlyPlan?.savingsAmount && (
                            <Text className="text-emerald-600 text-xs ml-2">({t('savingAmount', language)} {yearlyPlan.savingsAmount})</Text>
                          )}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>
                          {t('billedAnnually', language)}, {t('nonRefundable', language)}
                        </Text>
                      </View>
                      {isYearlySelected && user?.membershipActive && (
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: primaryColor }}>
                          <Check size={14} color="#fff" />
                        </View>
                      )}
                      {wasPreviouslyYearly && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            renewMembership('yearly');
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }}
                          className="rounded-lg px-4 py-2 active:opacity-80"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Text className="text-white font-semibold text-sm">{t('renew', language)}</Text>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                </>
              );
            })()}

            {/* Cancel Membership */}
            {user?.membershipActive && (
              <Pressable
                onPress={handleCancelMembership}
                className="rounded-xl p-4 flex-row items-center justify-center"
                style={{ backgroundColor: isDark ? '#450A0A' : '#FEF2F2' }}
              >
                <X size={18} color={isDark ? '#FCA5A5' : '#EF4444'} />
                <Text style={{ color: isDark ? '#FCA5A5' : '#EF4444', fontWeight: '600', marginLeft: 8 }}>{t('cancelMembership', language)}</Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Theme Colors Modal */}
      <Modal
        visible={showThemeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <Animated.View
            entering={FadeIn.duration(300)}
            className="flex-row items-center justify-between px-4 py-3"
            style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center">
              <View
                className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9' }}
              >
                <Palette size={20} color={colors.textSecondary} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: 'bold', color: colors.text }}>{t('themeColors', language)}</Text>
            </View>
            <Pressable
              onPress={() => setShowThemeModal(false)}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9' }}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            {/* Primary Color Section */}
            <View
              className="rounded-xl p-4 mb-3"
              style={{
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 4 }}>{t('primaryColorLabel', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 12 }}>
                {t('primaryColorDescription', language)}
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {THEME_COLORS.map((item) => (
                  <Pressable
                    key={`primary-${item.color}`}
                    onPress={() => setSelectedPrimaryColor(item.color)}
                    className="mb-2 items-center"
                    style={{ width: '20%' }}
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: item.color,
                        borderWidth: selectedPrimaryColor === item.color ? 2 : 0,
                        borderColor: isDark ? '#FFFFFF' : '#1E293B',
                      }}
                    >
                      {selectedPrimaryColor === item.color && (
                        <Check size={18} color="#fff" />
                      )}
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>{t(item.nameKey, language)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Button Color Section */}
            <View
              className="rounded-xl p-4 mb-3"
              style={{
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 4 }}>{t('buttonColorLabel', language)}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 12 }}>
                {t('buttonColorDescription', language)}
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {THEME_COLORS.map((item) => (
                  <Pressable
                    key={`button-${item.color}`}
                    onPress={() => setSelectedButtonColor(item.color)}
                    className="mb-2 items-center"
                    style={{ width: '20%' }}
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: item.color,
                        borderWidth: selectedButtonColor === item.color ? 2 : 0,
                        borderColor: isDark ? '#FFFFFF' : '#1E293B',
                      }}
                    >
                      {selectedButtonColor === item.color && (
                        <Check size={18} color="#fff" />
                      )}
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>{t(item.nameKey, language)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Preview Section */}
            <View
              className="rounded-xl p-4 mb-4"
              style={{
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>{t('preview', language)}</Text>

              {/* Preview Header */}
              <View
                className="rounded-lg p-3 mb-2 items-center"
                style={{ backgroundColor: selectedPrimaryColor }}
              >
                <Text className="text-white font-semibold text-base">{t('headerPreview', language)}</Text>
                <Text className="text-white font-semibold text-sm mt-1">{t('headerPreviewDescription', language)}</Text>
              </View>

              {/* Preview Button */}
              <Pressable
                className="rounded-lg py-2.5 items-center"
                style={{ backgroundColor: selectedButtonColor }}
              >
                <Text className="text-white font-semibold text-base">{t('buttonPreview', language)}</Text>
              </Pressable>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={() => {
                setThemeSettings({
                  primaryColor: selectedPrimaryColor,
                  buttonColor: selectedButtonColor,
                });
                setShowThemeModal(false);
                Alert.alert(t('success', language), t('themeUpdatedSuccess', language));
              }}
              className="rounded-xl py-3.5 items-center mb-3"
              style={{ backgroundColor: selectedButtonColor }}
            >
              <Text className="text-white font-bold text-base">{t('saveTheme', language)}</Text>
            </Pressable>

            {/* Reset Button */}
            <Pressable
              onPress={() => {
                setSelectedPrimaryColor('#0D9488');
                setSelectedButtonColor('#0D9488');
              }}
              className="rounded-xl py-3.5 items-center"
              style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9' }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('resetToDefault', language)}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <Animated.View
            entering={FadeIn.duration(300)}
            className="flex-row items-center px-5 py-4"
            style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            {/* Left: key icon + title */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <KeyRound size={22} color={primaryColor} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('emailAndChangePassword', language)}</Text>
            </View>
            {/* Right: X close button */}
            <Pressable
              onPress={() => setShowChangePasswordModal(false)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Email Address Section */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 8 }}>{t('emailAddressLabel', language)}</Text>
            <TextInput
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder={t('enterEmailPlaceholder', language)}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
                marginBottom: 8,
              }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Pressable
              onPress={() => {
                if (editEmail.trim() && editEmail.includes('@')) {
                  updateUserInfo({ email: editEmail.trim() });
                  Alert.alert(t('success', language), 'Email address updated successfully!');
                } else {
                  Alert.alert('Invalid Email', 'Please enter a valid email address.');
                }
              }}
              style={{
                backgroundColor: primaryColor,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
                marginBottom: 28,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Update Email</Text>
            </Pressable>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 24 }} />

            {/* Change Password Section */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginBottom: 16 }}>{t('changePassword', language)}</Text>

            <Text style={{ color: colors.text, fontWeight: '500', marginBottom: 8 }}>{t('currentPassword', language)}</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={t('currentPasswordPlaceholder', language)}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
                marginBottom: 16,
              }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              secureTextEntry
            />

            <Text style={{ color: colors.text, fontWeight: '500', marginBottom: 8 }}>{t('newPassword', language)}</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('newPasswordPlaceholder', language)}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
                marginBottom: 16,
              }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              secureTextEntry
            />

            <Text style={{ color: colors.text, fontWeight: '500', marginBottom: 8 }}>{t('confirmNewPassword', language)}</Text>
            <TextInput
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              placeholder={t('confirmPasswordPlaceholder', language)}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
              }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              secureTextEntry
            />

            <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 16 }}>
              {t('passwordMinLength', language)}
            </Text>

            {/* Save Button */}
            {(() => {
              const canSavePassword =
                !!currentPassword &&
                currentPassword.length >= 4 &&
                newPassword.length >= 4 &&
                newPassword === confirmNewPassword;
              return (
                <Pressable
                  onPress={() => {
                    if (!currentPassword) {
                      Alert.alert(t('error', language), t('pleaseEnterCurrentPassword', language));
                      return;
                    }
                    if (currentPassword.length < 4) {
                      Alert.alert(t('error', language), t('currentPasswordMinLength', language));
                      return;
                    }
                    if (newPassword.length < 4) {
                      Alert.alert(t('error', language), t('newPasswordMinLength', language));
                      return;
                    }
                    if (newPassword !== confirmNewPassword) {
                      Alert.alert(t('error', language), t('newPasswordsDoNotMatch', language));
                      return;
                    }
                    if (user?.id) {
                      disableFaceIdForUser(user.id).catch(() => {});
                      setFaceIdEnabled(false);
                    }
                    setShowChangePasswordModal(false);
                    Alert.alert(t('success', language), t('passwordChangedSuccess', language));
                  }}
                  disabled={!canSavePassword}
                  style={{
                    marginTop: 24,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: canSavePassword ? themeSettings.buttonColor : (isDark ? colors.backgroundTertiary : '#E2E8F0'),
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 16, color: canSavePassword ? '#fff' : colors.textTertiary }}>
                    {t('save', language)}
                  </Text>
                </Pressable>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Face ID Password Confirmation Modal */}
      <Modal
        visible={showFaceIdPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFaceIdPasswordModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <Animated.View
            entering={FadeIn.duration(300)}
            className="flex-row items-center px-5 py-4"
            style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            {/* Left: FaceID icon + title */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <ScanFace size={22} color={primaryColor} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('enableFaceId', language)}</Text>
            </View>
            {/* Right: X close button */}
            <Pressable
              onPress={() => {
                setShowFaceIdPasswordModal(false);
                setFaceIdPassword('');
              }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <View className="p-5">
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <ScanFace size={48} color={primaryColor} />
              <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center', marginTop: 16 }}>
                {t('faceIdEnableConfirm', language)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
                {t('faceIdConsentDescription', language)}
              </Text>
            </View>

            <Text style={{ color: colors.text, fontWeight: '500', marginBottom: 8 }}>{t('password', language)}</Text>
            <TextInput
              value={faceIdPassword}
              onChangeText={setFaceIdPassword}
              placeholder={t('currentPasswordPlaceholder', language)}
              style={{
                backgroundColor: colors.inputBackground,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                color: colors.inputText,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                fontSize: 16,
              }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
              secureTextEntry
              autoFocus
            />

            {/* Save Button */}
            <Pressable
              onPress={async () => {
                if (!faceIdPassword || faceIdPassword.length < 4) return;
                setFaceIdLoading(true);
                try {
                  if (user?.id && user?.email) {
                    const authToken = `token_${user.id}_${Date.now()}`;
                    const success = await enableFaceIdForUser(user.id, user.email, authToken);
                    if (success) {
                      setFaceIdEnabled(true);
                      setShowFaceIdPasswordModal(false);
                      setFaceIdPassword('');
                      feedbackToggle();
                      showSuccess(t('faceIdEnabled', language));
                    } else {
                      Alert.alert(t('error', language), t('biometricAuthFailed', language));
                    }
                  }
                } catch {
                  Alert.alert(t('error', language), t('biometricAuthFailed', language));
                } finally {
                  setFaceIdLoading(false);
                }
              }}
              disabled={!faceIdPassword || faceIdPassword.length < 4 || faceIdLoading}
              style={{
                marginTop: 20,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: (faceIdPassword && faceIdPassword.length >= 4 && !faceIdLoading)
                  ? themeSettings.buttonColor
                  : (isDark ? colors.backgroundTertiary : '#E2E8F0'),
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: 16, color: (faceIdPassword && faceIdPassword.length >= 4 && !faceIdLoading) ? '#fff' : colors.textTertiary }}>
                {faceIdLoading ? t('processing', language) : t('save', language)}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>


      {/* Legal Documents Modal (unified) */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }} edges={['top']}>
          {/* Header */}
          <View
            className="flex-row items-center px-5 py-4"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <FileText size={22} color={primaryColor} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, flex: 1 }}>
              {t('legalDocuments', language)}
            </Text>
            <Pressable
              onPress={() => setShowTermsModal(false)}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Version subtitle below header */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
              {versionText} {CURRENT_TERMS_VERSION} • {lastUpdatedText} {TERMS_LAST_UPDATED}
            </Text>
          </View>

          {/* Content */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
          >
            {/* Terms and Conditions Section */}
            {selectedLegalSection === 'terms' && (
              <>
                {/* Table of Contents */}
                <View
                  className="rounded-xl p-4 mb-6"
                  style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC' }}
                >
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
                    {t('tableOfContents', language)}
                  </Text>
                  {termsAndConditionsSections.map((section) => (
                    <Text
                      key={section.sectionNumber}
                      style={{ color: colors.textSecondary, fontSize: 14, paddingVertical: 4 }}
                    >
                      {t('section', language)} {section.sectionNumber}: {section.title}
                    </Text>
                  ))}
                  {/* Additional legal documents — alphabetical order */}
                  <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                    {[
                      { key: 'cookies' as const, label: t('cookiePolicyTitle', language) },
                      { key: 'email' as const, label: t('emailLegalDisclaimerTitle', language) },
                      { key: 'pricing' as const, label: t('pricingDisclaimerTitle', language) },
                      { key: 'privacy' as const, label: t('privacyPolicyTitle', language) },
                    ].map((item) => (
                      <Pressable
                        key={item.key}
                        onPress={() => setSelectedLegalSection(item.key)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                      >
                        <ChevronRight size={14} color={primaryColor} style={{ marginRight: 6 }} />
                        <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '500' }}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* All Sections */}
                {termsAndConditionsSections.map((section, index) => (
                  <View key={section.sectionNumber} className={index > 0 ? 'mt-8' : ''}>
                    {/* Section Header */}
                    <View
                      className="rounded-xl p-4 mb-4"
                      style={{ backgroundColor: isDark ? '#134E4A' : '#F0FDFA' }}
                    >
                      <Text style={{ color: isDark ? '#5EEAD4' : '#0F766E', fontWeight: 'bold', fontSize: 16 }}>
                        {t('section', language)} {section.sectionNumber}: {section.title.toUpperCase()}
                      </Text>
                    </View>

                    {/* Section Content */}
                    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}>
                      {section.content}
                    </Text>

                    {/* Section Divider */}
                    {index < termsAndConditionsSections.length - 1 && (
                      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 32 }} />
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Pricing Notice Section */}
            {selectedLegalSection === 'pricing' && (
              <View
                style={{
                  backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}08`,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: isDark ? `${primaryColor}30` : `${primaryColor}20`,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24 }}>
                  {t('pricingDisclaimer', language)}
                </Text>
              </View>
            )}

            {/* Email Compliance Section */}
            {selectedLegalSection === 'email' && (
              <>
                <View
                  style={{
                    backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}08`,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: isDark ? `${primaryColor}30` : `${primaryColor}20`,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24 }}>
                    {t('emailLegalDisclaimer', language)}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: isDark ? `${primaryColor}10` : `${primaryColor}05`,
                    padding: 16,
                    borderRadius: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: primaryColor,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22, fontStyle: 'italic' }}>
                    {t('emailLegalRegionNote', language)}
                  </Text>
                </View>
              </>
            )}

            {/* Privacy Policy Section */}
            {selectedLegalSection === 'privacy' && (
              <>
                {/* Table of Contents */}
                <View
                  className="rounded-xl p-4 mb-6"
                  style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC' }}
                >
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
                    {t('tableOfContents', language)}
                  </Text>
                  {privacyPolicySections.map((section) => (
                    <Text
                      key={section.sectionNumber}
                      style={{ color: colors.textSecondary, fontSize: 14, paddingVertical: 4 }}
                    >
                      {t('section', language)} {section.sectionNumber}: {section.title}
                    </Text>
                  ))}
                </View>

                {/* All Sections */}
                {privacyPolicySections.map((section, index) => (
                  <View key={section.sectionNumber} className={index > 0 ? 'mt-8' : ''}>
                    {/* Section Header */}
                    <View
                      className="rounded-xl p-4 mb-4"
                      style={{ backgroundColor: isDark ? '#134E4A' : '#F0FDFA' }}
                    >
                      <Text style={{ color: isDark ? '#5EEAD4' : '#0F766E', fontWeight: 'bold', fontSize: 16 }}>
                        {t('section', language)} {section.sectionNumber}: {section.title.toUpperCase()}
                      </Text>
                    </View>

                    {/* Section Content */}
                    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}>
                      {section.content}
                    </Text>

                    {/* Section Divider */}
                    {index < privacyPolicySections.length - 1 && (
                      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 32 }} />
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Cookie Policy Section */}
            {selectedLegalSection === 'cookies' && (
              <>
                {/* Table of Contents */}
                <View
                  className="rounded-xl p-4 mb-6"
                  style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC' }}
                >
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
                    {t('tableOfContents', language)}
                  </Text>
                  {cookiePolicySections.map((section) => (
                    <Text
                      key={section.sectionNumber}
                      style={{ color: colors.textSecondary, fontSize: 14, paddingVertical: 4 }}
                    >
                      {t('section', language)} {section.sectionNumber}: {section.title}
                    </Text>
                  ))}
                </View>

                {/* All Sections */}
                {cookiePolicySections.map((section, index) => (
                  <View key={section.sectionNumber} className={index > 0 ? 'mt-8' : ''}>
                    {/* Section Header */}
                    <View
                      className="rounded-xl p-4 mb-4"
                      style={{ backgroundColor: isDark ? '#134E4A' : '#F0FDFA' }}
                    >
                      <Text style={{ color: isDark ? '#5EEAD4' : '#0F766E', fontWeight: 'bold', fontSize: 16 }}>
                        {t('section', language)} {section.sectionNumber}: {section.title.toUpperCase()}
                      </Text>
                    </View>

                    {/* Section Content */}
                    <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22 }}>
                      {section.content}
                    </Text>

                    {/* Section Divider */}
                    {index < cookiePolicySections.length - 1 && (
                      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 32 }} />
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Footer with Logo */}
            <View style={{ marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' }}>
              <Image
                source={require('../../public/image-1769784304.png')}
                fadeDuration={0}
                style={{
                  width: 280,
                  height: 84,
                  resizeMode: 'contain',
                  tintColor: colors.textTertiary,
                }}
              />
              <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                2026 {COMPANY_INFO.name}, Miami, United States
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                {t('forSupport', language)}: {COMPANY_INFO.email}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Sound & Haptics Modal */}
      <Modal
        visible={showSoundHapticsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSoundHapticsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Volume2 size={20} color={primaryColor} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 17,
                fontWeight: '600',
                color: colors.text,
              }}
            >
              {t('soundAndHaptics', language)}
            </Text>
            <Pressable
              onPress={() => setShowSoundHapticsModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
          >
            {/* Description */}
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              {t('soundAndHapticsDescription', language)}
            </Text>

            {/* Sounds Toggle */}
            <Pressable
              onPress={() => {
                setSoundsEnabled(!soundsEnabled);
                if (!soundsEnabled) {
                  feedbackToggle();
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: colors.card,
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: soundsEnabled ? `${primaryColor}30` : `${primaryColor}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Volume2 size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                  {t('sounds', language)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                  {soundsEnabled ? t('soundsEnabled', language) : t('soundsDisabled', language)}
                </Text>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: soundsEnabled ? primaryColor : 'transparent',
                  borderWidth: 2,
                  borderColor: soundsEnabled ? primaryColor : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {soundsEnabled && <Check size={14} color="#FFFFFF" />}
              </View>
            </Pressable>

            {/* Vibrations Toggle */}
            <Pressable
              onPress={() => {
                setVibrationsEnabled(!vibrationsEnabled);
                if (!vibrationsEnabled) {
                  feedbackToggle();
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: colors.card,
                borderRadius: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: vibrationsEnabled ? `${primaryColor}30` : `${primaryColor}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Vibrate size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                  {t('vibrations', language)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                  {vibrationsEnabled ? t('vibrationsEnabled', language) : t('vibrationsDisabled', language)}
                </Text>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: vibrationsEnabled ? primaryColor : 'transparent',
                  borderWidth: 2,
                  borderColor: vibrationsEnabled ? primaryColor : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {vibrationsEnabled && <Check size={14} color="#FFFFFF" />}
              </View>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Legal Documents & Help Center Hub Modal */}
      <LegalHelpHubScreen
        visible={showLegalHelpHubModal}
        onClose={() => setShowLegalHelpHubModal(false)}
        language={language}
      />

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowLogoutModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.modal,
              borderRadius: 20,
              marginHorizontal: 20,
              width: '90%',
              maxWidth: 360,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            }}
            onPress={() => {}}
          >
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <LogOut size={22} color="#EF4444" />
                <Text style={{
                  color: colors.text,
                  fontWeight: 'bold',
                  fontSize: 20,
                  marginLeft: 12,
                }}>
                  {t('logout', language)}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowLogoutModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark ? colors.border : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Modal Content */}
            <View style={{ padding: 20 }}>
              <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center', marginBottom: 24 }}>
                {t('logoutConfirmation', language)}
              </Text>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => setShowLogoutModal(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                    {t('cancel', language)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowLogoutModal(false);
                    handleLogout();
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#EF4444',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                    {t('logout', language)}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Stores, Staff & Calendar Hub */}
      <StoresStaffCalendarHub
        visible={showTeamServicesModal}
        onClose={() => setShowTeamServicesModal(false)}
      />

      {/* Services & Products Screen */}
      <ServicesProductsScreen
        visible={showServicesProductsModal}
        onClose={() => setShowServicesProductsModal(false)}
      />

      {/* Booking Combined Settings (QR & Link) */}
      <BookingCombinedSettings
        visible={showBookingCombinedModal}
        onClose={() => setShowBookingCombinedModal(false)}
        appointmentsEnabled={calendarEnabled}
      />

      {/* Business Branding Settings */}
      <BusinessBrandingSettings
        visible={showBusinessBrandingModal}
        onClose={() => setShowBusinessBrandingModal(false)}
      />

      {/* Business Setup Modal */}
      <BusinessSetupModal
        visible={showBusinessSetupModal}
        onClose={() => setShowBusinessSetupModal(false)}
      />

      {/* Team Access & Permissions Modal */}
      <Modal
        visible={showTeamAccessModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTeamAccessModal(false)}
      >
        <TeamAccessPermissionsScreen onClose={() => setShowTeamAccessModal(false)} />
      </Modal>

      {/* Gift Card Screen */}
      <GiftCardScreen
        visible={showGiftCardModal}
        onClose={() => setShowGiftCardModal(false)}
      />

      {/* Membership Program Screen */}
      <MembershipProgramScreen
        visible={showMembershipProgramModal}
        onClose={() => setShowMembershipProgramModal(false)}
      />

      {/* Loyalty Program Screen */}
      <LoyaltyProgramScreen
        visible={showLoyaltyProgramModal}
        onClose={() => setShowLoyaltyProgramModal(false)}
      />

      {/* Delete Account Confirmation Modal */}
      <Modal visible={showDeleteAccountModal} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => !deleteAccountLoading && setShowDeleteAccountModal(false)}
        >
          <Pressable
            style={{
              width: '88%',
              backgroundColor: isDark ? colors.card : '#FFFFFF',
              borderRadius: 20,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? colors.border : '#F1F5F9',
              backgroundColor: isDark ? colors.backgroundTertiary : '#FEF2F2',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <AlertCircle size={18} color="#EF4444" />
                </View>
                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 17 }}>
                  {t('deleteAccountTitle', language)}
                </Text>
              </View>
              <Pressable
                onPress={() => !deleteAccountLoading && setShowDeleteAccountModal(false)}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? colors.card : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} color="#64748B" />
              </Pressable>
            </View>

            {/* Body */}
            <View style={{ padding: 20 }}>
              {deleteAccountSuccess ? (
                /* ── Success state ── */
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Check size={26} color="#10B981" />
                  </View>
                  <Text style={{ color: isDark ? colors.text : '#1E293B', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                    {t('deleteAccountSuccess', language)}
                  </Text>
                </View>
              ) : (
                <>
              <Text style={{ color: isDark ? colors.text : '#1E293B', fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
                {t('deleteAccountWarning', language)}
              </Text>

              <Text style={{ color: isDark ? colors.textSecondary : '#374151', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                {t('deleteAccountConfirmLabel', language)}
              </Text>
              <TextInput
                value={deleteAccountConfirm}
                onChangeText={(v) => { setDeleteAccountConfirm(v); setDeleteAccountError(''); }}
                placeholder={t('deleteAccountConfirmPlaceholder', language)}
                placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{
                  backgroundColor: isDark ? colors.background : '#F8FAFC',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: isDark ? colors.text : '#1E293B',
                  borderWidth: 1,
                  borderColor: deleteAccountError ? '#EF4444' : (isDark ? colors.border : '#E2E8F0'),
                  fontSize: 15,
                  marginBottom: 4,
                  fontWeight: '600',
                  letterSpacing: 1,
                }}
              />

              {deleteAccountError ? (
                <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12, marginTop: 4 }}>{deleteAccountError}</Text>
              ) : <View style={{ marginBottom: 16 }} />}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setShowDeleteAccountModal(false)}
                  disabled={deleteAccountLoading}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: isDark ? colors.text : '#374151', fontWeight: '600', fontSize: 15 }}>
                    {t('cancel', language)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDeleteAccount}
                  disabled={deleteAccountConfirm.toUpperCase() !== 'DELETE' || deleteAccountLoading}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: deleteAccountConfirm.toUpperCase() === 'DELETE' && !deleteAccountLoading ? '#EF4444' : '#FCA5A5',
                    alignItems: 'center',
                  }}
                >
                  {deleteAccountLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                      {t('deleteAccountConfirmButton', language)}
                    </Text>
                  )}
                </Pressable>
              </View>
              </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
