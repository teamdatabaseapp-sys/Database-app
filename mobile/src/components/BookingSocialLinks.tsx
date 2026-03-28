import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Globe,
  Instagram,
  Facebook,
  Youtube,
  MessageCircle,
  CheckCircle,
  Music2,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { useBusinessId } from '@/hooks/useBusiness';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import {
  getBookingPageSettings,
  upsertBookingPageSettings,
  type SocialLinks,
} from '@/services/bookingPageSettingsService';

interface SocialField {
  key: keyof SocialLinks;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  prefix?: string;
}

interface BookingSocialLinksProps {
  visible: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export function BookingSocialLinks({ visible, onClose, embedded }: BookingSocialLinksProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLinks, setSavedLinks] = useState<SocialLinks>({});
  const [draftLinks, setDraftLinks] = useState<SocialLinks>({});
  const [showLocalSuccess, setShowLocalSuccess] = useState(false);

  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const successAnimatedStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ scale: successScale.value }],
  }));

  const hideLocalSuccess = useCallback(() => setShowLocalSuccess(false), []);

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

  const hasUnsavedChanges = JSON.stringify(savedLinks) !== JSON.stringify(draftLinks);

  useEffect(() => {
    if (visible && businessId) {
      loadSettings();
    }
  }, [visible, businessId]);

  const loadSettings = async () => {
    if (!businessId) { setIsLoading(false); return; }
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 8000);
    try {
      const { data } = await getBookingPageSettings(businessId);
      clearTimeout(timeout);
      if (data) {
        const links = data.social_links ?? {};
        setSavedLinks(links);
        setDraftLinks(links);
      }
    } catch {
      clearTimeout(timeout);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!businessId) return;
    setIsSaving(true);
    try {
      const { data: current } = await getBookingPageSettings(businessId);
      const { error } = await upsertBookingPageSettings(businessId, {
        enabled_locales: current?.enabled_locales ?? ['en'],
        default_locale: current?.default_locale ?? 'en',
        smart_language_detection: current?.smart_language_detection ?? true,
        social_links: draftLinks,
      });
      if (error) return;
      setSavedLinks(draftLinks);
      triggerLocalSuccess();
      showSaveConfirmation(t('successSaved', language));
      setTimeout(() => onClose(), 1300);
    } catch {
      // silent
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = useCallback((key: keyof SocialLinks, value: string) => {
    setDraftLinks((prev) => ({ ...prev, [key]: value }));
  }, []);

  const socialFields: SocialField[] = [
    {
      key: 'website',
      label: 'Website',
      placeholder: 'yourbusiness.com',
      icon: <Globe size={18} color={primaryColor} />,
    },
    {
      key: 'instagram',
      label: 'Instagram',
      placeholder: 'instagram.com/yourbusiness',
      icon: <Instagram size={18} color={primaryColor} />,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      placeholder: 'facebook.com/yourbusiness',
      icon: <Facebook size={18} color={primaryColor} />,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      placeholder: 'tiktok.com/@yourbusiness',
      icon: <Music2 size={18} color={primaryColor} />,
    },
    {
      key: 'youtube',
      label: 'YouTube',
      placeholder: 'youtube.com/@yourbusiness',
      icon: <Youtube size={18} color={primaryColor} />,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      placeholder: '+1 (555) 000-0000',
      icon: <MessageCircle size={18} color={primaryColor} />,
    },
  ];

  if (!visible && !embedded) return null;

  const bodyContent = (
    <>
      {/* Description */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
          Add your social media links and website. They'll appear in the footer of all emails sent to your clients.
        </Text>
      </View>

      {/* Social Link Fields */}
      <Animated.View entering={FadeInDown.delay(100)} style={{ marginTop: 8 }}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Links
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
          {socialFields.map((field, index) => {
            const isLast = index === socialFields.length - 1;
            return (
              <View
                key={field.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                {/* Icon + Label */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    backgroundColor: `${primaryColor}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  {field.icon}
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: colors.textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                      marginBottom: 4,
                    }}
                  >
                    {field.label}
                  </Text>
                  <TextInput
                    value={draftLinks[field.key] ?? ''}
                    onChangeText={(v) => updateField(field.key, v)}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={{
                      fontSize: 14,
                      color: colors.text,
                      padding: 0,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </Animated.View>

      {/* Local success overlay */}
      {showLocalSuccess && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
        >
          <Animated.View
            style={[
              successAnimatedStyle,
              {
                backgroundColor: '#1a2a1a',
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

  if (embedded) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ paddingBottom: 8 }}>
          {isLoading ? (
            <View style={{ minHeight: 200, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : (
            <>
              {bodyContent}
              <Animated.View
                entering={FadeInDown.delay(200)}
                style={{ marginHorizontal: 16, marginTop: 24, marginBottom: 8 }}
              >
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
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Text
                      style={{
                        color: isSaving || !hasUnsavedChanges ? colors.textSecondary : '#fff',
                        fontWeight: '700',
                        fontSize: 15,
                      }}
                    >
                      {t('save', language)}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return null;
}
