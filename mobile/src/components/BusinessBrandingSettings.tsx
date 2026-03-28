/**
 * BusinessBrandingSettings
 *
 * Combined modal: "Business Branding" tab (logo + business info + colors) and "Notifications" tab
 * (compliance/footer settings + notification toggles).
 * These settings apply globally to ALL customer-facing communications.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Camera,
  Trash2,
  Check,
  Image as ImageIcon,
  Paintbrush,
  ChevronRight,
  Eye,
  ExternalLink,
  RotateCcw,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t } from '@/lib/i18n';
import { Language, CountryCode } from '@/lib/types';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import {
  getBusinessBranding,
  updateBusinessBranding,
  uploadBusinessLogo,
  removeBusinessLogo,
  BRAND_COLOR_PALETTE,
  DEFAULT_PRIMARY_COLOR,
  type BusinessBranding,
} from '@/services/businessBrandingService';
import { updateBusinessInfo } from '@/services/authService';
import { syncMainStoreFromSettings } from '@/services/storesService';
import {
  COUNTRIES,
  US_STATES,
  getEmailFooterPreview,
  getCurrencyForCountry,
  formatPhoneForEmailFooter,
} from '@/lib/country-legal-compliance';
import { getTimezoneForCountryState } from '@/lib/businessTimezone';
import { AppointmentNotificationSettings } from './AppointmentNotificationSettings';
import { BookingPreviewModal } from './BookingPreviewModal';
import { getDisplayBookingUrl } from '@/lib/bookingUrl';
import { SetupHint } from '@/components/SetupHint';
import { HighlightWrapper } from '@/components/HighlightWrapper';

type TabKey = 'branding' | 'notifications';

// US timezones shown first in picker
const US_TIMEZONES = [
  { label: 'Eastern Time (ET)', value: 'America/New_York' },
  { label: 'Central Time (CT)', value: 'America/Chicago' },
  { label: 'Mountain Time (MT)', value: 'America/Denver' },
  { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
  { label: 'Alaska Time (AKT)', value: 'America/Anchorage' },
  { label: 'Hawaii Time (HT)', value: 'Pacific/Honolulu' },
];

const OTHER_TIMEZONES = [
  { label: 'Atlantic Time (AT)', value: 'America/Halifax' },
  { label: 'Newfoundland Time (NT)', value: 'America/St_Johns' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris / Berlin (CET)', value: 'Europe/Paris' },
  { label: 'Helsinki (EET)', value: 'Europe/Helsinki' },
  { label: 'Moscow (MSK)', value: 'Europe/Moscow' },
  { label: 'Dubai (GST)', value: 'Asia/Dubai' },
  { label: 'Mumbai (IST)', value: 'Asia/Kolkata' },
  { label: 'Bangkok (ICT)', value: 'Asia/Bangkok' },
  { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Seoul (KST)', value: 'Asia/Seoul' },
  { label: 'Sydney (AEST)', value: 'Australia/Sydney' },
  { label: 'Melbourne (AEST)', value: 'Australia/Melbourne' },
  { label: 'Auckland (NZST)', value: 'Pacific/Auckland' },
  { label: 'São Paulo (BRT)', value: 'America/Sao_Paulo' },
  { label: 'Mexico City (CST)', value: 'America/Mexico_City' },
  { label: 'Toronto (ET)', value: 'America/Toronto' },
  { label: 'Vancouver (PT)', value: 'America/Vancouver' },
  { label: 'Johannesburg (SAST)', value: 'Africa/Johannesburg' },
  { label: 'Cairo (EET)', value: 'Africa/Cairo' },
  { label: 'Nairobi (EAT)', value: 'Africa/Nairobi' },
];

const ALL_TIMEZONES = [...US_TIMEZONES, ...OTHER_TIMEZONES];

interface BusinessBrandingSettingsProps {
  visible: boolean;
  onClose: () => void;
  setupHint?: string;
}

export function BusinessBrandingSettings({ visible, onClose, setupHint }: BusinessBrandingSettingsProps) {
  const [activeTab, setActiveTab] = useTabPersistence<TabKey>('business_branding', 'branding');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [branding, setBranding] = useState<BusinessBranding | null>(null);
  const [showPrimaryColorPicker, setShowPrimaryColorPicker] = useState(false);
  const [showSecondaryColorPicker, setShowSecondaryColorPicker] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Business info fields (Brand tab)
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editBusinessAddress, setEditBusinessAddress] = useState('');
  const [editBusinessPhoneNumber, setEditBusinessPhoneNumber] = useState('');
  const [editBusinessTimezone, setEditBusinessTimezone] = useState('America/New_York');
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [timezoneSearchQuery, setTimezoneSearchQuery] = useState('');
  const [isSavingBusinessInfo, setIsSavingBusinessInfo] = useState(false);

  // Compliance fields (Notifications tab)
  const [editBusinessCountry, setEditBusinessCountry] = useState<CountryCode | undefined>(undefined);
  const [editBusinessState, setEditBusinessState] = useState('');
  const [editEmailFooterLanguage, setEditEmailFooterLanguage] = useState<Language>('en');
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isSavingCompliance, setIsSavingCompliance] = useState(false);

  // Initial compliance values — used for hasChanges comparison
  const [initialComplianceValues, setInitialComplianceValues] = useState<{
    country: CountryCode | undefined;
    state: string;
    language: Language;
  }>({ country: undefined, state: '', language: 'en' });

  // Local color state for live preview (not saved until Save Theme is pressed)
  const [localPrimaryColor, setLocalPrimaryColor] = useState<string | null>(null);
  const [localSecondaryColor, setLocalSecondaryColor] = useState<string | null | undefined>(undefined);
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightY, setHighlightY] = useState(0);

  // Tab-switch effect: runs only when setupHint changes (not highlightY)
  useEffect(() => {
    if (!setupHint) return;
    if (setupHint === 'country') {
      setActiveTab('notifications');
    } else if (setupHint === 'businessName' || setupHint === 'address' || setupHint === 'phone') {
      setActiveTab('branding');
    }
  }, [setupHint, visible]);

  // Scroll + highlight effect: runs when setupHint or highlightY settles
  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] BusinessBrandingSettings hint:', setupHint);
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(0, highlightY - 80), animated: true });
        }
      } catch (e) {
        console.warn('[SetupHint] scroll failed safely', e);
      }
      setHighlightActive(true);
      fadeTimer = setTimeout(() => {
        if (mounted) setHighlightActive(false);
      }, 2500);
    }, 450);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (fadeTimer !== null) clearTimeout(fadeTimer);
    };
  }, [setupHint, highlightY, visible]);

  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;
  const user = useStore((s) => s.user);
  const updateUserInfo = useStore((s) => s.updateUserInfo);
  const setCurrency = useStore((s) => s.setCurrency);
  const { businessId, business, refetch: refetchBusiness } = useBusiness();
  const queryClient = useQueryClient();

  const bookingUrl = business?.name && businessId
    ? getDisplayBookingUrl(business.name, businessId)
    : '';

  const handlePreviewBookingPage = useCallback(() => {
    if (!business?.name || !businessId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPreviewModal(true);
  }, [business?.name, businessId]);

  // Sync local state from store when modal opens
  useEffect(() => {
    if (visible) {
      setEditBusinessName(user?.businessName || '');
      setEditBusinessAddress(user?.businessAddress || '');
      setEditBusinessPhoneNumber(user?.businessPhoneNumber || '');
      setEditBusinessTimezone(user?.businessTimezone || 'America/New_York');

      const initialCountry = user?.businessCountry as CountryCode | undefined;
      const initialState = user?.businessState || '';
      const initialLang = (user?.emailFooterLanguage as Language) || 'en';

      setEditBusinessCountry(initialCountry);
      setEditBusinessState(initialState);
      setEditEmailFooterLanguage(initialLang);

      const initials = { country: initialCountry, state: initialState, language: initialLang };
      setInitialComplianceValues(initials);
      console.log('[Notifications] Initial compliance values:', JSON.stringify(initials));

      if (businessId) loadBranding();
    }
  }, [visible, businessId]);

  const loadBranding = async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const { data, error } = await getBusinessBranding(businessId);
      if (error) {
        console.error('[BusinessBrandingSettings] Error loading branding:', error);
      } else if (data) {
        setBranding(data);
        // Sync local color state to loaded values
        setLocalPrimaryColor(data.brand_primary_color || DEFAULT_PRIMARY_COLOR);
        setLocalSecondaryColor(data.brand_secondary_color ?? null);
      }
    } catch (err) {
      console.error('[BusinessBrandingSettings] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute whether compliance fields differ from initially loaded values
  const hasComplianceChanges =
    editBusinessCountry !== initialComplianceValues.country ||
    editBusinessState !== initialComplianceValues.state ||
    editEmailFooterLanguage !== initialComplianceValues.language;

  const handleUploadLogo = useCallback(async () => {
    if (!businessId) return;
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('error', language), t('photoPermissionRequired', language));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uri = asset.uri.toLowerCase();
      const mimeType = asset.mimeType?.toLowerCase() || '';

      // Reject SVG explicitly
      if (mimeType.includes('svg') || uri.endsWith('.svg')) {
        Alert.alert(t('error', language), 'SVG files are not supported. Please use PNG, JPG, or WebP.');
        return;
      }
      // Allow PNG, JPEG, WebP
      const isValidType = uri.endsWith('.png') || uri.endsWith('.jpg') || uri.endsWith('.jpeg') || uri.endsWith('.webp');
      const isValidMime = mimeType.includes('png') || mimeType.includes('jpeg') || mimeType.includes('jpg') || mimeType.includes('webp');
      if (!isValidType && !isValidMime) {
        Alert.alert(t('error', language), 'Invalid image type. Please use PNG, JPG, or WebP.');
        return;
      }
      // 5MB limit — matches backend
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert(t('error', language), 'Image must be under 5MB.');
        return;
      }
      setIsUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { data, error } = await uploadBusinessLogo(businessId, asset.uri, asset.mimeType || undefined);
      if (error) {
        Alert.alert(t('error', language), error.message);
        return;
      }
      if (data) {
        setBranding(data);
        // Invalidate any React Query caches that may render the business logo
        queryClient.invalidateQueries({ queryKey: ['business'] });
        queryClient.invalidateQueries({ queryKey: ['businesses'] });
        showSuccess(t('logoUploaded', language));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      Alert.alert(t('error', language), t('tryAgain', language));
    } finally {
      setIsUploading(false);
    }
  }, [businessId, language, showSuccess]);

  const handleRemoveLogo = useCallback(async () => {
    if (!businessId) return;
    Alert.alert(
      t('removeLogo', language),
      t('removeLogoConfirmation', language),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            setIsUploading(true);
            try {
              const { data, error } = await removeBusinessLogo(businessId);
              if (error) {
                Alert.alert(t('error', language), error.message);
                return;
              }
              if (data) {
                setBranding(data);
                showSuccess(t('logoRemoved', language));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch {
              Alert.alert(t('error', language), t('tryAgain', language));
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  }, [businessId, language, showSuccess]);

  // Only update local state for live preview — no DB save until Save Theme is pressed
  const handleSelectPrimaryColor = useCallback(
    (colorHex: string) => {
      setShowPrimaryColorPicker(false);
      setLocalPrimaryColor(colorHex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const handleSelectSecondaryColor = useCallback(
    (colorHex: string | null) => {
      setShowSecondaryColorPicker(false);
      setLocalSecondaryColor(colorHex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  // Safe close — collapses all open dropdowns and resets saving flags before dismissing
  const handleClose = useCallback(() => {
    setShowTimezoneDropdown(false);
    setShowCountryDropdown(false);
    setShowStateDropdown(false);
    setShowLanguageDropdown(false);
    setShowPrimaryColorPicker(false);
    setShowSecondaryColorPicker(false);
    setShowPreviewModal(false);
    setIsSavingBusinessInfo(false);
    setIsSavingCompliance(false);
    setIsSaving(false);
    setIsSavingTheme(false);
    onClose();
  }, [onClose]);

  // Save Theme — saves business info (name, address, phone, timezone) + brand colors together.
  const handleSaveTheme = useCallback(async () => {
    if (!businessId) return;
    if (isSavingTheme) return;
    if (!editBusinessName.trim()) {
      Alert.alert(t('error', language), t('businessNameRequired', language));
      return;
    }
    const primaryToSave = localPrimaryColor || DEFAULT_PRIMARY_COLOR;
    const secondaryToSave = localSecondaryColor === undefined ? null : localSecondaryColor;
    setIsSavingTheme(true);
    try {
      // Save business info (name, address, phone, timezone) and brand colors in parallel
      const [infoResult, brandingResult] = await Promise.all([
        updateBusinessInfo(businessId, {
          name: editBusinessName.trim(),
          business_address: editBusinessAddress.trim(),
          business_phone_number: editBusinessPhoneNumber.trim(),
          timezone: editBusinessTimezone,
        }),
        updateBusinessBranding(businessId, {
          brand_primary_color: primaryToSave,
          brand_secondary_color: secondaryToSave,
        }),
      ]);
      if (infoResult.error) {
        Alert.alert(t('error', language), infoResult.error.message);
        return;
      }
      if (brandingResult.error) {
        Alert.alert(t('error', language), brandingResult.error.message);
        return;
      }
      // Sync address/phone to stores table
      await syncMainStoreFromSettings(businessId, {
        address: editBusinessAddress.trim(),
        phone: editBusinessPhoneNumber.trim(),
      });
      // Update Zustand store immediately
      updateUserInfo({
        businessName: editBusinessName.trim(),
        businessAddress: editBusinessAddress.trim(),
        businessPhoneNumber: editBusinessPhoneNumber.trim(),
        businessTimezone: editBusinessTimezone,
      });
      queryClient.invalidateQueries({ queryKey: ['business'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      refetchBusiness().catch(() => null);
      // Close modal first so the global overlay (rendered in app root layer) is visible above it
      handleClose();
      showSaveConfirmation();
    } catch {
      Alert.alert(t('error', language), t('tryAgain', language));
    } finally {
      setIsSavingTheme(false);
    }
  }, [businessId, editBusinessName, editBusinessAddress, editBusinessPhoneNumber, editBusinessTimezone, localPrimaryColor, localSecondaryColor, language, showSaveConfirmation, queryClient, isSavingTheme, updateUserInfo, refetchBusiness, handleClose]);

  // Reset to defaults — resets local state only (user must press Save Theme to persist)
  const handleResetThemeToDefault = useCallback(() => {
    setLocalPrimaryColor(DEFAULT_PRIMARY_COLOR);
    setLocalSecondaryColor(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Save business name + address + phone (Brand tab)
  const handleSaveBusinessInfo = async () => {
    if (!businessId) return;
    if (isSavingBusinessInfo) return;
    if (!editBusinessName.trim()) {
      Alert.alert(t('error', language), t('businessNameRequired', language));
      return;
    }
    setIsSavingBusinessInfo(true);
    try {
      const result = await updateBusinessInfo(businessId, {
        name: editBusinessName.trim(),
        business_address: editBusinessAddress.trim(),
        business_phone_number: editBusinessPhoneNumber.trim(),
        timezone: editBusinessTimezone,
      });
      if (result.error) {
        Alert.alert(t('error', language), result.error.message);
        return;
      }
      // Sync to stores table
      await syncMainStoreFromSettings(businessId, {
        address: editBusinessAddress.trim(),
        phone: editBusinessPhoneNumber.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['business'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      // Update business name in local Zustand store immediately
      updateUserInfo({
        businessName: editBusinessName.trim(),
        businessAddress: editBusinessAddress.trim(),
        businessPhoneNumber: editBusinessPhoneNumber.trim(),
        businessTimezone: editBusinessTimezone,
      });
      handleClose();
      showSaveConfirmation();
      refetchBusiness().catch(() => null);
    } catch (err) {
      Alert.alert(t('error', language), t('tryAgain', language));
    } finally {
      setIsSavingBusinessInfo(false);
    }
  };

  // Save compliance info (Notifications tab)
  const handleSaveCompliance = async () => {
    const current = { country: editBusinessCountry, state: editBusinessState, language: editEmailFooterLanguage };
    console.log('[Notifications] handleSaveCompliance called');
    console.log('[Notifications] Initial values:', JSON.stringify(initialComplianceValues));
    console.log('[Notifications] Current values:', JSON.stringify(current));
    console.log('[Notifications] hasComplianceChanges:', hasComplianceChanges);

    if (!businessId) return;
    if (!editBusinessCountry) {
      Alert.alert(t('countryRequired', language), t('countryLegalHelper', language));
      return;
    }
    if (editBusinessCountry === 'US' && !editBusinessState) {
      Alert.alert(t('stateRequired', language), t('legalRequirementsHelper', language));
      return;
    }
    if (isSavingCompliance) return;
    setIsSavingCompliance(true);
    try {
      // Auto-derive business timezone from country/state selection
      const derivedTimezone = getTimezoneForCountryState(editBusinessCountry, editBusinessState);
      const updatePayload: Record<string, string | undefined> = {
        business_country: editBusinessCountry,
        business_state: editBusinessState,
        email_footer_language: editEmailFooterLanguage,
      };
      if (derivedTimezone) {
        updatePayload.timezone = derivedTimezone;
      }
      const result = await updateBusinessInfo(businessId, updatePayload);
      console.log('[Notifications] Save API response:', JSON.stringify(result));
      if (result.error) {
        console.error('[Notifications] Save API error:', result.error);
        Alert.alert(t('error', language), result.error.message || 'Failed to save. Please try again.');
        return;
      }
      updateUserInfo({
        businessCountry: editBusinessCountry,
        businessState: editBusinessState,
        emailFooterLanguage: editEmailFooterLanguage,
        ...(derivedTimezone ? { businessTimezone: derivedTimezone } : {}),
      });
      // Update initial values so hasChanges resets to false
      const saved = { country: editBusinessCountry, state: editBusinessState, language: editEmailFooterLanguage };
      setInitialComplianceValues(saved);
      console.log('[Notifications] Saved successfully, new initial values:', JSON.stringify(saved));

      setShowCountryDropdown(false);
      setShowStateDropdown(false);
      setShowLanguageDropdown(false);
      queryClient.invalidateQueries({ queryKey: ['business'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      showSaveConfirmation();
      // Refresh business data in background
      refetchBusiness().catch(() => null);
    } catch (err) {
      console.error('[Notifications] Save unexpected error:', err);
      Alert.alert(t('error', language), t('tryAgain', language));
    } finally {
      setIsSavingCompliance(false);
    }
  };

  // Use local state for live preview; fall back to saved branding or default
  const displayPrimaryColor = localPrimaryColor ?? branding?.brand_primary_color ?? DEFAULT_PRIMARY_COLOR;
  const displaySecondaryColor = localSecondaryColor !== undefined ? localSecondaryColor : (branding?.brand_secondary_color ?? null);

  // Section label helper
  const SectionLabel = ({ label }: { label: string }) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );

  // ── Branding tab content ──
  const brandingContent = isLoading ? (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <ActivityIndicator size="large" color={primaryColor} />
    </View>
  ) : (
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Description */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
          Manage your business logo and brand colors for all online pages and communications.
        </Text>
      </View>

      {/* Business Logo */}
      <HighlightWrapper active={highlightActive && (setupHint === 'logo' || setupHint === 'branding')} borderRadius={12} onLayout={(e) => { if (setupHint === 'logo' || setupHint === 'branding') setHighlightY(e.nativeEvent.layout.y); }}>
      <Animated.View entering={FadeInDown.delay(80)} style={{ marginTop: 8 }}>
        <SectionLabel label={t('businessLogo', language)} />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, padding: 20, alignItems: 'center' }}>
          <View
            style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, overflow: 'hidden',
              borderWidth: 2, borderColor: colors.border,
            }}
          >
            {isUploading ? (
              <ActivityIndicator size="large" color={primaryColor} />
            ) : branding?.logo_url ? (
              <Image source={{ uri: branding.logo_url }} style={{ width: 96, height: 96, borderRadius: 48 }} resizeMode="cover" />
            ) : (
              <ImageIcon size={40} color={colors.textTertiary} />
            )}
          </View>
          <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginBottom: 16, lineHeight: 18 }}>
            Your logo appears on your public booking page, booking emails, gift card emails, loyalty emails, membership emails, and all customer communications.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleUploadLogo}
              disabled={isUploading}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: primaryColor, borderRadius: 10, opacity: isUploading ? 0.6 : 1 }}
            >
              <Camera size={18} color="#FFFFFF" />
              <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                {branding?.logo_url ? t('replaceLogo', language) : t('uploadLogo', language)}
              </Text>
            </Pressable>
            {branding?.logo_url && (
              <Pressable
                onPress={handleRemoveLogo}
                disabled={isUploading}
                style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)', borderRadius: 10, opacity: isUploading ? 0.6 : 1 }}
              >
                <Trash2 size={18} color="#EF4444" />
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>
      </HighlightWrapper>

      {/* Business Information */}
      <HighlightWrapper active={highlightActive && (setupHint === 'businessName' || setupHint === 'address' || setupHint === 'phone')} borderRadius={12} onLayout={(e) => { if (setupHint === 'businessName' || setupHint === 'address' || setupHint === 'phone') setHighlightY(e.nativeEvent.layout.y); }}>
      <Animated.View entering={FadeInDown.delay(120)} style={{ marginTop: 8 }}>
        <SectionLabel label={t('businessName', language)} />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, padding: 16 }}>
          {/* Business Name */}
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
            {t('businessShopNameLabel', language)}
          </Text>
          <TextInput
            value={editBusinessName}
            onChangeText={setEditBusinessName}
            placeholder={t('businessNamePlaceholder', language)}
            style={{
              backgroundColor: colors.inputBackground,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.inputText,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              fontSize: 15,
              marginBottom: 14,
            }}
            placeholderTextColor={colors.inputPlaceholder}
            cursorColor={primaryColor}
            selectionColor={`${primaryColor}40`}
          />

          {/* Physical Address */}
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
            {t('physicalBusinessAddress', language)}
          </Text>
          <TextInput
            value={editBusinessAddress}
            onChangeText={setEditBusinessAddress}
            placeholder="123 Main St, Suite 100, City, State 12345"
            style={{
              backgroundColor: colors.inputBackground,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.inputText,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              fontSize: 15,
              textAlignVertical: 'top',
              minHeight: 70,
              marginBottom: 14,
            }}
            placeholderTextColor={colors.inputPlaceholder}
            cursorColor={primaryColor}
            selectionColor={`${primaryColor}40`}
            multiline
            numberOfLines={2}
          />

          {/* Business Phone */}
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
            {t('businessPhoneNumberLabel', language)}
          </Text>
          <TextInput
            value={editBusinessPhoneNumber}
            onChangeText={(text) => {
              const digitsOnly = text.replace(/\D/g, '');
              const isUSNumber = (digitsOnly.length <= 10 && !text.startsWith('+')) ||
                                 (digitsOnly.length === 11 && digitsOnly.startsWith('1'));
              if (isUSNumber && digitsOnly.length <= 10) {
                let formatted = '';
                const digits = digitsOnly.slice(0, 10);
                if (digits.length > 0) formatted = digits.slice(0, 3);
                if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
                if (digits.length > 6) formatted += ' ' + digits.slice(6, 10);
                setEditBusinessPhoneNumber(formatted);
              } else {
                setEditBusinessPhoneNumber(text);
              }
            }}
            placeholder={t('businessPhoneNumberPlaceholder', language)}
            style={{
              backgroundColor: colors.inputBackground,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.inputText,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              fontSize: 15,
              marginBottom: 14,
            }}
            placeholderTextColor={colors.inputPlaceholder}
            cursorColor={primaryColor}
            selectionColor={`${primaryColor}40`}
            keyboardType="phone-pad"
          />

          {/* Business Timezone */}
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 }}>
            Business Timezone
          </Text>
          <Pressable
            onPress={() => {
              setShowTimezoneDropdown(!showTimezoneDropdown);
              setTimezoneSearchQuery('');
            }}
            style={{
              backgroundColor: colors.inputBackground,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: showTimezoneDropdown ? primaryColor : colors.inputBorder,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: showTimezoneDropdown ? 0 : 16,
            }}
          >
            <Text style={{ color: colors.inputText, fontSize: 15, flex: 1 }}>
              {ALL_TIMEZONES.find(tz => tz.value === editBusinessTimezone)?.label ?? editBusinessTimezone}
            </Text>
            <ChevronRight size={18} color={colors.textSecondary} style={{ transform: [{ rotate: showTimezoneDropdown ? '90deg' : '0deg' }] }} />
          </Pressable>

          {showTimezoneDropdown && (
            <View style={{ backgroundColor: colors.card, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: colors.border, maxHeight: 260, marginTop: 2 }}>
              {/* Search */}
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TextInput
                  value={timezoneSearchQuery}
                  onChangeText={setTimezoneSearchQuery}
                  placeholder="Search timezone..."
                  placeholderTextColor={colors.inputPlaceholder}
                  style={{ color: colors.text, fontSize: 14, paddingVertical: 4 }}
                  autoFocus
                  cursorColor={primaryColor}
                />
              </View>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {/* US Timezones header */}
                {(!timezoneSearchQuery || US_TIMEZONES.some(tz => tz.label.toLowerCase().includes(timezoneSearchQuery.toLowerCase()) || tz.value.toLowerCase().includes(timezoneSearchQuery.toLowerCase()))) && (
                  <View>
                    {!timezoneSearchQuery && (
                      <Text style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        United States
                      </Text>
                    )}
                    {US_TIMEZONES
                      .filter(tz => !timezoneSearchQuery || tz.label.toLowerCase().includes(timezoneSearchQuery.toLowerCase()) || tz.value.toLowerCase().includes(timezoneSearchQuery.toLowerCase()))
                      .map(tz => (
                        <Pressable
                          key={tz.value}
                          onPress={() => {
                            setEditBusinessTimezone(tz.value);
                            setShowTimezoneDropdown(false);
                            setTimezoneSearchQuery('');
                            Haptics.selectionAsync();
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
                        >
                          <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{tz.label}</Text>
                          {editBusinessTimezone === tz.value && <Check size={16} color={primaryColor} />}
                        </Pressable>
                      ))
                    }
                  </View>
                )}
                {/* Other Timezones */}
                {OTHER_TIMEZONES
                  .filter(tz => !timezoneSearchQuery || tz.label.toLowerCase().includes(timezoneSearchQuery.toLowerCase()) || tz.value.toLowerCase().includes(timezoneSearchQuery.toLowerCase()))
                  .length > 0 && (
                  <View>
                    {!timezoneSearchQuery && (
                      <Text style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4, fontSize: 11, fontWeight: '600', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Other Regions
                      </Text>
                    )}
                    {OTHER_TIMEZONES
                      .filter(tz => !timezoneSearchQuery || tz.label.toLowerCase().includes(timezoneSearchQuery.toLowerCase()) || tz.value.toLowerCase().includes(timezoneSearchQuery.toLowerCase()))
                      .map(tz => (
                        <Pressable
                          key={tz.value}
                          onPress={() => {
                            setEditBusinessTimezone(tz.value);
                            setShowTimezoneDropdown(false);
                            setTimezoneSearchQuery('');
                            Haptics.selectionAsync();
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: colors.border }}
                        >
                          <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{tz.label}</Text>
                          {editBusinessTimezone === tz.value && <Check size={16} color={primaryColor} />}
                        </Pressable>
                      ))
                    }
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </Animated.View>
      </HighlightWrapper>

      {/* Theme Colors */}
      <HighlightWrapper active={highlightActive && setupHint === 'brandColors'} borderRadius={12} onLayout={(e) => { if (setupHint === 'brandColors') setHighlightY(e.nativeEvent.layout.y); }}>
      <Animated.View entering={FadeInDown.delay(160)} style={{ marginTop: 8 }}>
        <SectionLabel label={t('themeColors', language)} />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
          {/* Primary Color */}
          <Pressable
            onPress={() => setShowPrimaryColorPicker(true)}
            disabled={isSavingTheme}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: isSavingTheme ? 0.6 : 1 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: displayPrimaryColor, marginRight: 14, borderWidth: 3, borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{t('primaryColor', language)}</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
                Used for buttons and highlights across your booking page and all emails.
              </Text>
            </View>
          </Pressable>
          {/* Secondary Color */}
          <Pressable
            onPress={() => setShowSecondaryColorPicker(true)}
            disabled={isSavingTheme}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, opacity: isSavingTheme ? 0.6 : 1 }}
          >
            <View
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: displaySecondaryColor || 'transparent',
                marginRight: 14,
                borderWidth: displaySecondaryColor ? 3 : 2,
                borderColor: displaySecondaryColor ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : colors.border,
                borderStyle: displaySecondaryColor ? 'solid' : 'dashed',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {!displaySecondaryColor && <X size={18} color={colors.textTertiary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{t('secondaryColorOptional', language)}</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
                {displaySecondaryColor ? 'Optional accent color for additional branding.' : t('noColor', language)}
              </Text>
            </View>
          </Pressable>
        </View>
      </Animated.View>
      </HighlightWrapper>

      {/* Live Preview */}
      <Animated.View entering={FadeInDown.delay(190)} style={{ marginTop: 8 }}>
        <SectionLabel label={t('livePreview', language)} />
        <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, padding: 20 }}>
          <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            {/* Logo */}
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' }}>
              {branding?.logo_url ? (
                <Image source={{ uri: branding.logo_url }} style={{ width: 56, height: 56, borderRadius: 28 }} resizeMode="cover" />
              ) : (
                <ImageIcon size={24} color={colors.textTertiary} />
              )}
            </View>
            {/* Business Name */}
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }} numberOfLines={1}>
              {business?.name || 'Your Business'}
            </Text>
            {/* Book Now Button — uses branding primary color (not app button color) */}
            <View style={{ backgroundColor: displayPrimaryColor, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>{t('bookNow', language)}</Text>
            </View>
          </View>
          {/* Preview Booking Page row */}
          <Pressable
            onPress={handlePreviewBookingPage}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 10 }}
          >
            <Eye size={18} color={primaryColor} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: primaryColor }}>{t('previewBookingPage', language)}</Text>
            <ExternalLink size={14} color={primaryColor} style={{ marginLeft: 6 }} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Save — single primary action for Business Branding */}
      <Animated.View entering={FadeInDown.delay(200)} style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
        <Pressable
          onPress={handleSaveTheme}
          disabled={isSavingTheme}
          style={{
            backgroundColor: isSavingTheme ? colors.backgroundTertiary : buttonColor,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isSavingTheme
            ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save</Text>
          }
        </Pressable>
      </Animated.View>
    </ScrollView>
  );

  // ── Notifications tab compliance block ──
  const complianceBlock = (
    <HighlightWrapper active={highlightActive && setupHint === 'country'} borderRadius={12} onLayout={(e) => { if (setupHint === 'country') setHighlightY(e.nativeEvent.layout.y); }}>
    <View style={{ paddingBottom: 12 }}>
      {/* Country Selection */}
      <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, fontSize: 15 }}>{t('selectCountry', language)}</Text>
      <Pressable
        onPress={() => {
          setShowCountryDropdown(!showCountryDropdown);
          setShowStateDropdown(false);
          setShowLanguageDropdown(false);
        }}
        style={{
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: showCountryDropdown ? primaryColor : colors.inputBorder,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {editBusinessCountry ? (
            <>
              <Text style={{ fontSize: 20, marginRight: 10 }}>
                {COUNTRIES.find(c => c.code === editBusinessCountry)?.flag}
              </Text>
              <Text style={{ color: colors.inputText, fontSize: 16 }}>
                {COUNTRIES.find(c => c.code === editBusinessCountry)?.name}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.inputPlaceholder, fontSize: 16 }}>{t('selectCountry', language)}</Text>
          )}
        </View>
        <ChevronRight size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showCountryDropdown ? '90deg' : '0deg' }] }} />
      </Pressable>

      {/* Country Dropdown */}
      {showCountryDropdown && (
        <View style={{ backgroundColor: colors.card, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: colors.border, maxHeight: 280 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TextInput
              value={countrySearchQuery}
              onChangeText={setCountrySearchQuery}
              placeholder={t('searchCountries', language)}
              style={{ backgroundColor: colors.inputBackground, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.inputText, fontSize: 15 }}
              placeholderTextColor={colors.inputPlaceholder}
              autoFocus
              cursorColor={primaryColor}
            />
          </View>
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
            {COUNTRIES.filter(country =>
              country.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) ||
              country.nativeName.toLowerCase().includes(countrySearchQuery.toLowerCase())
            ).sort((a, b) => {
              if (a.code === 'US') return -1;
              if (b.code === 'US') return 1;
              return a.name.localeCompare(b.name);
            }).map(country => (
              <Pressable
                key={country.code}
                onPress={() => {
                  setEditBusinessCountry(country.code as CountryCode);
                  setShowCountryDropdown(false);
                  setCountrySearchQuery('');
                  if (country.code !== 'US') setEditBusinessState('');
                  const countryCurrency = getCurrencyForCountry(country.code);
                  setCurrency(countryCurrency);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: editBusinessCountry === country.code ? `${primaryColor}15` : 'transparent' }}
              >
                <Text style={{ fontSize: 20, marginRight: 12 }}>{country.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{country.name}</Text>
                  {country.nativeName !== country.name && (
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{country.nativeName}</Text>
                  )}
                </View>
                {editBusinessCountry === country.code && <Check size={18} color={primaryColor} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 6, marginBottom: 16 }}>
        {t('countryLegalHelper', language)}
      </Text>

      {/* State Selection (USA only) */}
      {editBusinessCountry === 'US' && (
        <>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, fontSize: 15 }}>{t('selectState', language)}</Text>
          <Pressable
            onPress={() => {
              setShowStateDropdown(!showStateDropdown);
              setShowCountryDropdown(false);
              setShowLanguageDropdown(false);
            }}
            style={{
              backgroundColor: colors.inputBackground,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: showStateDropdown ? primaryColor : colors.inputBorder,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: editBusinessState ? colors.inputText : colors.inputPlaceholder, fontSize: 16 }}>
              {editBusinessState ? US_STATES.find(s => s.code === editBusinessState)?.name : t('selectState', language)}
            </Text>
            <ChevronRight size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showStateDropdown ? '90deg' : '0deg' }] }} />
          </Pressable>
          {showStateDropdown && (
            <View style={{ backgroundColor: colors.card, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: colors.border, maxHeight: 280 }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TextInput
                  value={stateSearchQuery}
                  onChangeText={setStateSearchQuery}
                  placeholder={t('searchStates', language)}
                  style={{ backgroundColor: colors.inputBackground, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.inputText, fontSize: 15 }}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoFocus
                  cursorColor={primaryColor}
                />
              </View>
              <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                {US_STATES.filter(state =>
                  state.name.toLowerCase().includes(stateSearchQuery.toLowerCase()) ||
                  state.code.toLowerCase().includes(stateSearchQuery.toLowerCase())
                ).sort((a, b) => a.name.localeCompare(b.name)).map(state => (
                  <Pressable
                    key={state.code}
                    onPress={() => {
                      setEditBusinessState(state.code);
                      setShowStateDropdown(false);
                      setStateSearchQuery('');
                      Haptics.selectionAsync();
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: editBusinessState === state.code ? `${primaryColor}15` : 'transparent' }}
                  >
                    <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{state.name}</Text>
                    {editBusinessState === state.code && <Check size={18} color={primaryColor} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ height: 16 }} />
        </>
      )}

      {/* Email Footer Language */}
      <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, fontSize: 15 }}>{t('emailFooterLanguage', language)}</Text>
      <Pressable
        onPress={() => {
          setShowLanguageDropdown(!showLanguageDropdown);
          setShowCountryDropdown(false);
          setShowStateDropdown(false);
        }}
        style={{
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: showLanguageDropdown ? primaryColor : colors.inputBorder,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: colors.inputText, fontSize: 16 }}>
          {SUPPORTED_LANGUAGES.find(l => l.code === editEmailFooterLanguage)?.nativeName || 'English'}
        </Text>
        <ChevronRight size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showLanguageDropdown ? '90deg' : '0deg' }] }} />
      </Pressable>
      {showLanguageDropdown && (
        <View style={{ backgroundColor: colors.card, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: colors.border, maxHeight: 280 }}>
          <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
            {[
              SUPPORTED_LANGUAGES.find(l => l.code === 'en')!,
              ...SUPPORTED_LANGUAGES.filter(l => l.code !== 'en').sort((a, b) => a.nativeName.localeCompare(b.nativeName))
            ].map(lang => (
              <Pressable
                key={lang.code}
                onPress={() => {
                  setEditEmailFooterLanguage(lang.code as Language);
                  setShowLanguageDropdown(false);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: editEmailFooterLanguage === lang.code ? `${primaryColor}15` : 'transparent' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{lang.nativeName}</Text>
                  {lang.nativeName !== lang.name && (
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{lang.name}</Text>
                  )}
                </View>
                {editEmailFooterLanguage === lang.code && <Check size={18} color={primaryColor} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 6 }}>
        {t('emailFooterLanguageHelper', language)}
      </Text>

      {/* Footer Preview */}
      {editBusinessAddress.trim() && editBusinessCountry && (
        <View style={{ marginTop: 20, padding: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 12, fontSize: 14 }}>
            Footer Preview
          </Text>
          {(() => {
            const preview = getEmailFooterPreview(
              user?.businessName || 'Your Business',
              editBusinessAddress.trim(),
              editBusinessCountry,
              editBusinessState,
              editEmailFooterLanguage,
              editBusinessPhoneNumber.trim()
            );
            return (
              <View>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginBottom: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{preview.businessName}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{preview.businessAddress}</Text>
                  {editBusinessPhoneNumber.trim() && (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{formatPhoneForEmailFooter(editBusinessPhoneNumber.trim())}</Text>
                  )}
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>{preview.receivingText}</Text>
                <Text style={{ color: primaryColor, fontSize: 12, marginBottom: 4 }}>{preview.unsubscribeText}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontStyle: 'italic' }}>{preview.linkActiveText}</Text>
                {preview.legalNotice && (
                  <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>{preview.legalNotice}</Text>
                )}
              </View>
            );
          })()}
        </View>
      )}

      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 16, marginBottom: 4, textAlign: 'center' }}>
        {t('legalRequirementsHelper', language)}
      </Text>
    </View>
    </HighlightWrapper>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: `${primaryColor}15`,
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}
          >
            <Paintbrush size={20} color={primaryColor} />
          </View>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
            {t('settingsBrandingTitle', language)}
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Segmented Tab Control */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 16, marginTop: 12, marginBottom: 4,
            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            borderRadius: 12, padding: 4,
          }}
        >
          {([
            { key: 'branding' as TabKey, label: 'Business Branding' },
            { key: 'notifications' as TabKey, label: 'Notifications' },
          ] as const).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.key); }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: activeTab === tab.key ? colors.card : 'transparent',
                shadowColor: activeTab === tab.key ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === tab.key ? 0.08 : 0,
                shadowRadius: 2,
                elevation: activeTab === tab.key ? 2 : 0,
              }}
            >
              <Text
                style={{
                  fontWeight: activeTab === tab.key ? '600' : '500',
                  fontSize: 14,
                  color: activeTab === tab.key ? colors.text : colors.textSecondary,
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={{ flex: 1 }}>
          <SetupHint hintKey={setupHint} />
          {activeTab === 'branding' && brandingContent}
          {activeTab === 'notifications' && (
            <AppointmentNotificationSettings
              visible={visible}
              onClose={onClose}
              embedded
              headerContent={complianceBlock}
              onSave={handleSaveCompliance}
              isSavingExternal={isSavingCompliance}
              externalHasChanges={hasComplianceChanges}
            />
          )}

          {/* Primary Color Picker — full-screen inline sheet */}
          {showPrimaryColorPicker && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }}>
              <Pressable style={{ flex: 1 }} onPress={() => setShowPrimaryColorPicker(false)} />
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '97%' }}>
                {/* Handle */}
                <View style={{ alignSelf: 'center', width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 12, marginBottom: 4 }} />
                {/* Title — fixed at top */}
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  {t('primaryColor', language)}
                </Text>
                {/* Color grid — scrolls freely in remaining space */}
                <ScrollView
                  contentContainerStyle={{ padding: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {BRAND_COLOR_PALETTE.map((colorOption) => {
                    const isSelected = displayPrimaryColor === colorOption.hex;
                    return (
                      <Pressable
                        key={colorOption.hex}
                        onPress={() => handleSelectPrimaryColor(colorOption.hex)}
                        style={{
                          width: 52, height: 52, borderRadius: 26,
                          backgroundColor: colorOption.hex,
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: isSelected ? 3 : 1.5,
                          borderColor: isSelected ? (isDark ? '#FFFFFF' : '#000000') : 'rgba(0,0,0,0.12)',
                          shadowColor: colorOption.hex,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.35,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        {isSelected && <Check size={20} color="#FFFFFF" />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {/* Action buttons — fixed at bottom */}
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Pressable
                    onPress={handleSaveTheme}
                    disabled={isSavingTheme}
                    style={{
                      backgroundColor: isSavingTheme ? colors.backgroundTertiary : buttonColor,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSavingTheme
                      ? <ActivityIndicator size="small" color={colors.textSecondary} />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Theme</Text>
                    }
                  </Pressable>
                  <Pressable
                    onPress={handleResetThemeToDefault}
                    disabled={isSavingTheme}
                    style={{
                      borderRadius: 12,
                      paddingVertical: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: isSavingTheme ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Reset to Default</Text>
                  </Pressable>
                </View>
                <View style={{ height: 24 }} />
              </View>
            </View>
          )}

          {/* Secondary Color Picker — full-screen inline sheet */}
          {showSecondaryColorPicker && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' }}>
              <Pressable style={{ flex: 1 }} onPress={() => setShowSecondaryColorPicker(false)} />
              <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '97%' }}>
                {/* Handle */}
                <View style={{ alignSelf: 'center', width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 12, marginBottom: 4 }} />
                {/* Title — fixed at top */}
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  {t('secondaryColor', language)}
                </Text>
                {/* Color grid — scrolls freely in remaining space */}
                <ScrollView
                  contentContainerStyle={{ padding: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* None option */}
                  <Pressable
                    onPress={() => handleSelectSecondaryColor(null)}
                    style={{
                      width: 52, height: 52, borderRadius: 26,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: displaySecondaryColor === null ? 3 : 1.5,
                      borderColor: displaySecondaryColor === null ? (isDark ? '#FFFFFF' : '#000000') : colors.border,
                      borderStyle: displaySecondaryColor === null ? 'solid' : 'dashed',
                    }}
                  >
                    {displaySecondaryColor === null
                      ? <Check size={20} color={isDark ? '#FFFFFF' : '#000000'} />
                      : <X size={18} color={colors.textTertiary} />
                    }
                  </Pressable>
                  {BRAND_COLOR_PALETTE.map((colorOption) => {
                    const isSelected = displaySecondaryColor === colorOption.hex;
                    return (
                      <Pressable
                        key={colorOption.hex}
                        onPress={() => handleSelectSecondaryColor(colorOption.hex)}
                        style={{
                          width: 52, height: 52, borderRadius: 26,
                          backgroundColor: colorOption.hex,
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: isSelected ? 3 : 1.5,
                          borderColor: isSelected ? (isDark ? '#FFFFFF' : '#000000') : 'rgba(0,0,0,0.12)',
                          shadowColor: colorOption.hex,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.35,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        {isSelected && <Check size={20} color="#FFFFFF" />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {/* Action buttons — fixed at bottom */}
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Pressable
                    onPress={handleSaveTheme}
                    disabled={isSavingTheme}
                    style={{
                      backgroundColor: isSavingTheme ? colors.backgroundTertiary : buttonColor,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSavingTheme
                      ? <ActivityIndicator size="small" color={colors.textSecondary} />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Theme</Text>
                    }
                  </Pressable>
                  <Pressable
                    onPress={handleResetThemeToDefault}
                    disabled={isSavingTheme}
                    style={{
                      borderRadius: 12,
                      paddingVertical: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: isSavingTheme ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Reset to Default</Text>
                  </Pressable>
                </View>
                <View style={{ height: 24 }} />
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Booking Preview Modal */}
      <BookingPreviewModal
        visible={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        bookingUrl={bookingUrl}
        businessName={business?.name || ''}
        businessLogoUrl={branding?.logo_url}
        primaryColor={displayPrimaryColor}
      />
    </Modal>
  );
}
