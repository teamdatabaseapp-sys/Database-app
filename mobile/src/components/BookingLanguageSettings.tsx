import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Globe,
  Check,
  ChevronDown,
  Smartphone,
  Lock,
  Info,
  CheckCircle,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { useBusinessId } from '@/hooks/useBusiness';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import {
  getBookingPageSettings,
  upsertBookingPageSettings,
  AVAILABLE_BOOKING_LOCALES,
  DEFAULT_BOOKING_PAGE_SETTINGS,
  type BookingPageSettingsInput,
} from '@/services/bookingPageSettingsService';

interface BookingLanguageSettingsProps {
  visible: boolean;
  onClose: () => void;
  appointmentsEnabled: boolean;
  embedded?: boolean;
}

export function BookingLanguageSettings({
  visible,
  onClose,
  appointmentsEnabled,
  embedded,
}: BookingLanguageSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Persisted settings from server
  const [savedSettings, setSavedSettings] = useState<BookingPageSettingsInput>(DEFAULT_BOOKING_PAGE_SETTINGS);
  // Local draft settings (unsaved changes)
  const [draftSettings, setDraftSettings] = useState<BookingPageSettingsInput>(DEFAULT_BOOKING_PAGE_SETTINGS);
  const [showDefaultPicker, setShowDefaultPicker] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showLocalSuccess, setShowLocalSuccess] = useState(false);

  // Local success overlay animation values
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const successAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));

  const hideLocalSuccess = useCallback(() => {
    setShowLocalSuccess(false);
  }, []);

  const triggerLocalSuccess = useCallback(() => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setShowLocalSuccess(true);
    successOpacity.value = 0;
    successScale.value = 0.8;
    requestAnimationFrame(() => {
      successOpacity.value = withSpring(1, { damping: 15, stiffness: 300 });
      successScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    successTimeoutRef.current = setTimeout(() => {
      successOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) runOnJS(hideLocalSuccess)();
      });
      successScale.value = withTiming(0.9, { duration: 250 });
    }, 1000);
  }, [successOpacity, successScale, hideLocalSuccess]);

  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const businessId = useBusinessId();
  const { showSaveConfirmation } = useSaveConfirmation();

  // Track if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(savedSettings) !== JSON.stringify(draftSettings);
  }, [savedSettings, draftSettings]);

  // Load settings when modal opens or when businessId becomes available
  useEffect(() => {
    if (visible && businessId) {
      loadSettings();
    } else if (visible && !businessId) {
      // businessId not yet available — will re-fire when businessId arrives
      // Nothing to do here
    }
  }, [visible, businessId]);

  const loadSettings = async () => {
    if (!businessId) {
      // No businessId yet — fall back to defaults immediately so page renders
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Safety timeout: never stay in loading state longer than 8s
    const timeout = setTimeout(() => {
      console.warn('[BookingLanguageSettings] Load timed out, using defaults');
      setIsLoading(false);
    }, 8000);

    try {
      const { data, error } = await getBookingPageSettings(businessId);
      clearTimeout(timeout);
      if (error) {
        console.error('[BookingLanguageSettings] Error loading settings:', error);
        // Fall back to defaults on error — never leave page blank
      } else if (data) {
        const loadedSettings = {
          enabled_locales: data.enabled_locales ?? ['en'],
          default_locale: data.default_locale ?? 'en',
          smart_language_detection: data.smart_language_detection ?? true,
        };
        setSavedSettings(loadedSettings);
        setDraftSettings(loadedSettings);
      }
      // If data is null (no settings yet), defaults are already set — page renders fine
    } catch (err) {
      clearTimeout(timeout);
      console.error('[BookingLanguageSettings] Unexpected error:', err);
      // Fall back to defaults so page always renders
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const saveSettings = async (): Promise<boolean> => {
    if (!businessId) return false;

    setIsSaving(true);
    try {
      console.log('[BookingLanguageSettings] Saving settings:', draftSettings);
      const { error } = await upsertBookingPageSettings(businessId, draftSettings);
      if (error) {
        console.error('[BookingLanguageSettings] Save error:', error.message);
        setErrorMessage(error.message || 'Failed to save settings');
        setShowErrorToast(true);
        return false;
      }
      // Update saved settings to match draft
      setSavedSettings(draftSettings);
      // Trigger local success overlay (works inside modal stacking context)
      triggerLocalSuccess();
      // Also trigger global confirmation (works when not inside modal)
      showSaveConfirmation(t('successSaved', language));
      // Auto-close after confirmation animation (1s show + 250ms fade out)
      setTimeout(() => onClose(), 1300);
      console.log('[BookingLanguageSettings] Settings saved successfully');
      return true;
    } catch (err) {
      console.error('[BookingLanguageSettings] Unexpected save error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to save settings';
      setErrorMessage(errMsg);
      setShowErrorToast(true);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLanguage = useCallback((localeCode: Language) => {
    // English cannot be toggled off
    if (localeCode === 'en') return;

    const enabledLocales = draftSettings.enabled_locales ?? ['en'];
    const isEnabled = enabledLocales.includes(localeCode);
    let newEnabledLocales: Language[];

    if (isEnabled) {
      // Remove the locale
      newEnabledLocales = enabledLocales.filter((l) => l !== localeCode);
    } else {
      // Add the locale
      newEnabledLocales = [...enabledLocales, localeCode];
    }

    // If default locale is being removed, reset to English
    const currentDefault = draftSettings.default_locale ?? 'en';
    const newDefaultLocale = newEnabledLocales.includes(currentDefault)
      ? currentDefault
      : 'en';

    setDraftSettings({
      ...draftSettings,
      enabled_locales: newEnabledLocales,
      default_locale: newDefaultLocale,
    });
  }, [draftSettings]);

  const setDefaultLocale = useCallback((localeCode: Language) => {
    const enabledLocales = draftSettings.enabled_locales ?? ['en'];
    if (!enabledLocales.includes(localeCode)) return;

    setDraftSettings({
      ...draftSettings,
      default_locale: localeCode,
    });
    setShowDefaultPicker(false);
  }, [draftSettings]);

  const toggleSmartDetection = useCallback(() => {
    setDraftSettings({
      ...draftSettings,
      smart_language_detection: !draftSettings.smart_language_detection,
    });
  }, [draftSettings]);

  // Handle close - discard unsaved changes
  const handleClose = useCallback(() => {
    // Reset draft to saved settings (discard changes)
    setDraftSettings(savedSettings);
    onClose();
  }, [savedSettings, onClose]);

  // Filter enabled locales for default picker
  const enabledLocalesForPicker = useMemo(() => {
    return AVAILABLE_BOOKING_LOCALES.filter((l) => (draftSettings.enabled_locales ?? ['en']).includes(l.code));
  }, [draftSettings.enabled_locales]);

  if (!visible && !embedded) return null;

  const bodyContent = (
    <>
      {/* Info Banner when Appointments is OFF */}
      {!appointmentsEnabled && (
        <Animated.View
          entering={FadeIn}
          style={{
            margin: 16,
            padding: 16,
            backgroundColor: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.1)',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.3)',
            flexDirection: 'row',
            alignItems: 'flex-start',
          }}
        >
          <Info size={20} color="#F59E0B" style={{ marginRight: 12, marginTop: 2 }} />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              color: isDark ? '#FCD34D' : '#B45309',
              lineHeight: 18,
            }}
          >
            {t('bookingPageLanguageDisabledNote', language)}
          </Text>
        </Animated.View>
      )}

      {/* Description */}
      <View style={{ padding: 16 }}>
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 20,
          }}
        >
          {t('bookingPageLanguageInfo', language)}
        </Text>
      </View>

      {/* SECTION 1: DETECTION (moved to top) */}
      <Animated.View entering={FadeInDown.delay(100)}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('detection', language)}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            marginHorizontal: 16,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Smartphone size={18} color={primaryColor} style={{ marginRight: 8 }} />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: colors.text,
                  }}
                >
                  {t('smartLanguageDetection', language)}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textTertiary,
                  marginTop: 6,
                  lineHeight: 18,
                }}
              >
                {t('smartLanguageDetectionDescription', language)}
              </Text>
            </View>

            <Switch
              value={draftSettings.smart_language_detection}
              onValueChange={toggleSmartDetection}
              trackColor={{
                false: isDark ? '#3A3A3C' : '#E5E5EA',
                true: primaryColor,
              }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </Animated.View>

      {/* SECTION 2: ENABLED LANGUAGES */}
      <Animated.View entering={FadeInDown.delay(200)} style={{ marginTop: 24 }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('enabledLanguages', language)}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            marginHorizontal: 16,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {AVAILABLE_BOOKING_LOCALES.map((locale, index) => {
            const isEnabled = (draftSettings.enabled_locales ?? ['en']).includes(locale.code);
            const isEnglish = locale.code === 'en';
            const isLast = index === AVAILABLE_BOOKING_LOCALES.length - 1;

            return (
              <Pressable
                key={locale.code}
                onPress={() => !isEnglish && toggleLanguage(locale.code)}
                disabled={isEnglish}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                {/* Language Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: colors.text,
                      }}
                    >
                      {locale.nativeName}
                    </Text>
                    {isEnglish && (
                      <View
                        style={{
                          marginLeft: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          backgroundColor: `${primaryColor}20`,
                          borderRadius: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Lock size={10} color={primaryColor} />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '600',
                            color: primaryColor,
                            marginLeft: 4,
                            textTransform: 'uppercase',
                          }}
                        >
                          {t('requiredLabel', language)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    {locale.name}
                  </Text>
                  {isEnglish && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textTertiary,
                        marginTop: 4,
                        fontStyle: 'italic',
                        lineHeight: 15,
                      }}
                    >
                      {t('englishRequiredExplanation', language)}
                    </Text>
                  )}
                </View>

                {/* Checkmark */}
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: isEnabled ? primaryColor : 'transparent',
                    borderWidth: 2,
                    borderColor: isEnabled ? primaryColor : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isEnglish ? 0.6 : 1,
                  }}
                >
                  {isEnabled && <Check size={14} color="#FFFFFF" />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* SECTION 3: DEFAULT BOOKING LANGUAGE */}
      <Animated.View entering={FadeInDown.delay(300)} style={{ marginTop: 24 }}>
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('defaultLanguage', language)}
          </Text>
        </View>

        <Pressable
          onPress={() => setShowDefaultPicker(true)}
          style={{
            backgroundColor: colors.card,
            marginHorizontal: 16,
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Globe size={18} color={primaryColor} style={{ marginRight: 8 }} />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                {t('defaultBookingLanguage', language)}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: colors.textTertiary,
                marginTop: 6,
                lineHeight: 18,
              }}
            >
              {t('defaultBookingLanguageDescription', language)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 15,
                color: primaryColor,
                fontWeight: '500',
                marginRight: 4,
              }}
            >
              {AVAILABLE_BOOKING_LOCALES.find((l) => l.code === (draftSettings.default_locale ?? 'en'))?.nativeName || 'English'}
            </Text>
            <ChevronDown size={18} color={primaryColor} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Error Toast */}
      {showErrorToast && (
        <Animated.View
          entering={FadeIn}
          style={{
            position: 'absolute',
            bottom: 100,
            left: 20,
            right: 20,
            backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Text
            style={{
              flex: 1,
              color: isDark ? '#FECACA' : '#991B1B',
              fontSize: 14,
              fontWeight: '500',
            }}
          >
            {errorMessage || 'Failed to save settings'}
          </Text>
          <Pressable
            onPress={() => setShowErrorToast(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={isDark ? '#FECACA' : '#991B1B'} />
          </Pressable>
        </Animated.View>
      )}

      {/* Local success overlay — renders inside this modal's stacking context */}
      {showLocalSuccess && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <Animated.View
            style={[
              successAnimatedStyle,
              {
                backgroundColor: isDark ? '#1a2a1a' : '#1a2a1a',
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 10,
              },
            ]}
          >
            <View
              style={{
                backgroundColor: primaryColor,
                borderRadius: 20,
                padding: 6,
                marginRight: 12,
              }}
            >
              <CheckCircle size={22} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {t('successSaved', language)}
            </Text>
          </Animated.View>
        </View>
      )}
    </>
  );

  const languagePicker = (
    <>
      {/* Default Language Picker Modal */}
      <Modal
        visible={showDefaultPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDefaultPicker(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowDefaultPicker(false)}
        >
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 34,
              }}
            >
              {/* Handle */}
              <View
                style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  backgroundColor: colors.border,
                  borderRadius: 2,
                  marginTop: 12,
                  marginBottom: 8,
                }}
              />

              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: colors.text,
                  textAlign: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                {t('defaultLanguage', language)}
              </Text>

              <ScrollView style={{ maxHeight: 400 }}>
                {enabledLocalesForPicker.map((locale, index) => {
                  const isSelected = (draftSettings.default_locale ?? 'en') === locale.code;
                  const isLast = index === enabledLocalesForPicker.length - 1;

                  return (
                    <Pressable
                      key={locale.code}
                      onPress={() => setDefaultLocale(locale.code)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: colors.border,
                        backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: isSelected ? '600' : '400',
                            color: isSelected ? primaryColor : colors.text,
                          }}
                        >
                          {locale.nativeName}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: colors.textTertiary,
                            marginTop: 2,
                          }}
                        >
                          {locale.name}
                        </Text>
                      </View>

                      {isSelected && (
                        <Check size={20} color={primaryColor} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  // Embedded mode
  if (embedded) {
    return (
      <>
        <View style={{ paddingBottom: 8 }}>
          {isLoading ? (
            <View style={{ minHeight: 200, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : (
            <>
              {bodyContent}
              {/* Full-width Save button at bottom — matches Business Branding style */}
              <Animated.View entering={FadeInDown.delay(200)} style={{ marginHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                <Pressable
                  onPress={saveSettings}
                  disabled={isSaving || !hasUnsavedChanges}
                  style={{
                    backgroundColor: isSaving || !hasUnsavedChanges ? colors.backgroundTertiary : buttonColor,
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSaving
                    ? <ActivityIndicator size="small" color={colors.textSecondary} />
                    : <Text style={{ color: isSaving || !hasUnsavedChanges ? colors.textSecondary : '#fff', fontWeight: '700', fontSize: 15 }}>{t('save', language)}</Text>
                  }
                </Pressable>
              </Animated.View>
            </>
          )}
        </View>
        {languagePicker}
      </>
    );
  }

  // Standalone modal mode
  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header — title + close only, no Save in header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Globe size={20} color={primaryColor} />
            </View>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
              {t('bookingPageLanguage', language)}
            </Text>
            <Pressable onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <View style={{ minHeight: 200, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
                <ActivityIndicator size="large" color={primaryColor} />
              </View>
            ) : (
              <>
                {bodyContent}
                {/* Full-width Save button at bottom — matches Business Branding style */}
                <Animated.View entering={FadeInDown.delay(200)} style={{ marginHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
                  <Pressable
                    onPress={saveSettings}
                    disabled={isSaving || !hasUnsavedChanges}
                    style={{
                      backgroundColor: isSaving || !hasUnsavedChanges ? colors.backgroundTertiary : buttonColor,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSaving
                      ? <ActivityIndicator size="small" color={colors.textSecondary} />
                      : <Text style={{ color: isSaving || !hasUnsavedChanges ? colors.textSecondary : '#fff', fontWeight: '700', fontSize: 15 }}>{t('save', language)}</Text>
                    }
                  </Pressable>
                </Animated.View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {languagePicker}
    </>
  );
}
