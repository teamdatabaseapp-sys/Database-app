/**
 * Booking Link & QR Share Kit Component
 *
 * Displays the booking link with QR code and sharing options.
 * Features: Copy link, Share, Download QR, Download Flyer PDF, Email to me
 *
 * URL Format: https://rsvdatabase.com/{business-slug}
 * - Clean, branded URLs with human-readable slugs
 * - No technical query parameters shown to users
 * - Language selection uses native names only
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Copy,
  Share2,
  Download,
  FileText,
  Mail,
  Link as LinkIcon,
  QrCode,
  ChevronDown,
  Check,
  Globe,
  AlertCircle,
  ExternalLink,
  Instagram,
  Facebook,
  Youtube,
  MessageCircle,
  Music2,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as MailComposer from 'expo-mail-composer';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import {
  AVAILABLE_BOOKING_LOCALES,
  type BookingPageSettingsInput,
  type SocialLinks,
  getBookingPageSettings,
  upsertBookingPageSettings,
} from '@/services/bookingPageSettingsService';
import {
  getDisplayBookingUrl,
  getShareableBookingUrl,
} from '@/lib/bookingUrl';
import { BookingPreviewModal } from './BookingPreviewModal';

interface BookingLinkQRProps {
  visible: boolean;
  onClose: () => void;
  settings: BookingPageSettingsInput;
  embedded?: boolean;
  onSaveSuccess?: () => void;
}

export function BookingLinkQR({ visible, onClose, settings, embedded, onSaveSuccess }: BookingLinkQRProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [selectedLinkLanguage, setSelectedLinkLanguage] = useState<Language | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const qrRef = useRef<any>(null);

  // Social / Business Links state
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [savedSocialLinks, setSavedSocialLinks] = useState<SocialLinks>({});
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [focusedLinkField, setFocusedLinkField] = useState<string | null>(null);

  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { showSuccess } = useToast();
  const language = useStore((s) => s.language) as Language;
  const { business, businessId } = useBusiness();
  const { showSaveConfirmation } = useSaveConfirmation();

  // Generate the booking URL - use clean branded URL
  const bookingUrl = useMemo(() => {
    if (!businessId || !business?.name) return '';
    // For display and QR code, use clean URL without language params
    return getDisplayBookingUrl(business.name, businessId);
  }, [businessId, business?.name]);

  // Generate shareable URL with language if specified
  const shareableUrl = useMemo(() => {
    if (!businessId || !business?.name) return '';
    return getShareableBookingUrl(business.name, businessId, selectedLinkLanguage ?? undefined);
  }, [businessId, business?.name, selectedLinkLanguage]);

  // Get enabled locales for language link builder
  const enabledLocales = useMemo(() => {
    return AVAILABLE_BOOKING_LOCALES.filter((l) => settings.enabled_locales.includes(l.code));
  }, [settings.enabled_locales]);

  // Load social links when visible
  useEffect(() => {
    if (visible && businessId) {
      getBookingPageSettings(businessId).then(({ data }) => {
        if (data?.social_links) {
          setSocialLinks(data.social_links);
          setSavedSocialLinks(data.social_links);
        }
      }).catch(() => {});
    }
  }, [visible, businessId]);

  const hasSocialChanges = JSON.stringify(socialLinks) !== JSON.stringify(savedSocialLinks);

  const handleSaveSocialLinks = useCallback(async () => {
    if (!businessId) return;
    setIsSavingLinks(true);
    try {
      const { data: current } = await getBookingPageSettings(businessId);
      const { error } = await upsertBookingPageSettings(businessId, {
        enabled_locales: current?.enabled_locales ?? ['en'],
        default_locale: current?.default_locale ?? 'en',
        smart_language_detection: current?.smart_language_detection ?? true,
        social_links: socialLinks,
      });
      if (!error) {
        setSavedSocialLinks(socialLinks);
        if (onSaveSuccess) {
          // Embedded mode: parent handles confirmation overlay + auto-close
          onSaveSuccess();
        } else {
          // Standalone mode: use global confirmation and close after animation
          showSaveConfirmation('Saved');
          setTimeout(() => {
            onClose();
          }, 1350);
        }
      }
    } catch { /* silent */ } finally {
      setIsSavingLinks(false);
    }
  }, [businessId, socialLinks, showSaveConfirmation, onClose, onSaveSuccess]);

  // Preview mode is no longer relevant since we use businessId-based URLs that always work
  // The booking URL will work as long as the business exists
  const inPreviewMode = false;

  // Open booking URL in embedded WebView modal (same as Preview Booking)
  // This ensures IDENTICAL visual experience between QR "Open Link" and Branding "Preview"
  const handleOpenBookingUrl = useCallback(() => {
    if (!bookingUrl) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPreviewModal(true);
  }, [bookingUrl]);

  // Open in external browser (for users who explicitly want that)
  const handleOpenInExternalBrowser = useCallback(async () => {
    if (!bookingUrl) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (Platform.OS === 'web') {
        window.open(bookingUrl, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(bookingUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[BookingLinkQR] Failed to open URL:', errorMsg);
      try {
        await Linking.openURL(bookingUrl);
      } catch (linkErr) {
        Alert.alert(t('error', language), t('couldNotOpenBookingPage', language));
      }
    }
  }, [bookingUrl, language]);

  // Copy link to clipboard - use shareable URL to include language preference
  const handleCopyLink = useCallback(async () => {
    try {
      // When a language is selected, copy the URL with lang param (for sharing)
      // Otherwise copy the clean URL
      const urlToCopy = selectedLinkLanguage ? shareableUrl : bookingUrl;
      await Clipboard.setStringAsync(urlToCopy);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess(t('linkCopied', language));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[BookingLinkQR] Copy failed:', errorMsg);
      Alert.alert(t('error', language), t('couldNotCopyLink', language));
    }
  }, [bookingUrl, shareableUrl, selectedLinkLanguage, language, showSuccess]);

  // Share link using native share sheet - generates PDF with booking link
  const handleShareLink = useCallback(async () => {
    if (!business || !qrRef.current) {
      Alert.alert(t('error', language));
      return;
    }

    setIsGenerating(true);
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(t('error', language), t('sharingNotAvailable', language));
        setIsGenerating(false);
        return;
      }

      // Use shareable URL (includes language param if selected)
      const urlToShare = selectedLinkLanguage ? shareableUrl : bookingUrl;

      // Get QR code as base64
      qrRef.current.toDataURL(async (dataUrl: string) => {
        try {
          // Generate PDF with booking link and QR code
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  padding: 40px;
                  background: #ffffff;
                }
                .container {
                  background: white;
                  text-align: center;
                  max-width: 480px;
                  width: 100%;
                }
                .business-name {
                  font-size: 28px;
                  font-weight: 700;
                  color: #1a1a1a;
                  margin-bottom: 8px;
                }
                .subtitle {
                  font-size: 16px;
                  color: #666;
                  margin-bottom: 32px;
                }
                .qr-container {
                  background: white;
                  padding: 20px;
                  border-radius: 16px;
                  border: 2px solid #f0f0f0;
                  display: inline-block;
                  margin-bottom: 24px;
                }
                .qr-image {
                  width: 180px;
                  height: 180px;
                }
                .scan-text {
                  font-size: 14px;
                  color: #888;
                  margin-bottom: 12px;
                }
                .url {
                  font-size: 13px;
                  color: ${primaryColor};
                  word-break: break-all;
                  padding: 12px 16px;
                  background: #f8f9fa;
                  border-radius: 8px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1 class="business-name">${business.name || 'Book Now'}</h1>
                <p class="subtitle">${t('yourBookingLink', language)}</p>
                <div class="qr-container">
                  <img class="qr-image" src="data:image/png;base64,${dataUrl}" alt="QR Code" />
                </div>
                <p class="scan-text">Scan QR code or visit:</p>
                <p class="url">${urlToShare}</p>
              </div>
            </body>
            </html>
          `;

          const { uri } = await Print.printToFileAsync({ html });
          const businessSlug = (business.name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const filename = `${businessSlug}-booking-link.pdf`;
          const newUri = `${FileSystem.cacheDirectory}${filename}`;

          await FileSystem.moveAsync({ from: uri, to: newUri });

          await Sharing.shareAsync(newUri, {
            mimeType: 'application/pdf',
            dialogTitle: t('shareLink', language),
          });

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (err) {
          console.error('[BookingLinkQR] PDF share failed:', err);
          Alert.alert(t('error', language));
        } finally {
          setIsGenerating(false);
        }
      });
    } catch (err) {
      console.error('[BookingLinkQR] Share failed:', err);
      Alert.alert(t('error', language));
      setIsGenerating(false);
    }
  }, [business, bookingUrl, shareableUrl, selectedLinkLanguage, language, primaryColor]);

  // Download QR code as PNG
  const handleDownloadQR = useCallback(async () => {
    if (!qrRef.current) return;

    setIsGenerating(true);
    try {
      // Get base64 data from QR code
      qrRef.current.toDataURL(async (dataUrl: string) => {
        try {
          const filename = `booking-qr-${Date.now()}.png`;
          const fileUri = `${FileSystem.cacheDirectory}${filename}`;

          // Write the base64 data to a file
          await FileSystem.writeAsStringAsync(fileUri, dataUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Share the file
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'image/png',
              dialogTitle: t('downloadQr', language),
            });
          }

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess(t('qrDownloaded', language));
        } catch (err) {
          console.error('[BookingLinkQR] QR download failed:', err);
          Alert.alert(t('error', language));
        } finally {
          setIsGenerating(false);
        }
      });
    } catch (err) {
      console.error('[BookingLinkQR] QR generation failed:', err);
      Alert.alert(t('error', language));
      setIsGenerating(false);
    }
  }, [language, showSuccess]);

  // Download flyer as PDF
  const handleDownloadFlyer = useCallback(async () => {
    if (!qrRef.current || !business) return;

    setIsGenerating(true);
    try {
      // Get QR code as base64
      qrRef.current.toDataURL(async (dataUrl: string) => {
        try {
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  padding: 40px;
                  background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%);
                }
                .container {
                  background: white;
                  border-radius: 24px;
                  padding: 48px;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.12);
                  text-align: center;
                  max-width: 480px;
                }
                .business-name {
                  font-size: 32px;
                  font-weight: 700;
                  color: #1a1a1a;
                  margin-bottom: 12px;
                }
                .subtitle {
                  font-size: 18px;
                  color: #666;
                  margin-bottom: 32px;
                }
                .qr-container {
                  background: white;
                  padding: 24px;
                  border-radius: 16px;
                  border: 2px solid #f0f0f0;
                  display: inline-block;
                  margin-bottom: 24px;
                }
                .qr-image {
                  width: 200px;
                  height: 200px;
                }
                .scan-text {
                  font-size: 16px;
                  color: #888;
                  margin-bottom: 16px;
                }
                .url {
                  font-size: 14px;
                  color: ${primaryColor};
                  word-break: break-all;
                  padding: 12px 16px;
                  background: #f8f9fa;
                  border-radius: 8px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1 class="business-name">${business.name || 'Book Now'}</h1>
                <p class="subtitle">Scan to book an appointment</p>
                <div class="qr-container">
                  <img class="qr-image" src="data:image/png;base64,${dataUrl}" alt="QR Code" />
                </div>
                <p class="scan-text">Scan the QR code or visit:</p>
                <p class="url">${bookingUrl}</p>
              </div>
            </body>
            </html>
          `;

          const { uri } = await Print.printToFileAsync({ html });
          const filename = `booking-flyer-${Date.now()}.pdf`;
          const newUri = `${FileSystem.cacheDirectory}${filename}`;

          await FileSystem.moveAsync({ from: uri, to: newUri });

          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(newUri, {
              mimeType: 'application/pdf',
              dialogTitle: t('downloadFlyer', language),
            });
          }

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess(t('flyerDownloaded', language));
        } catch (err) {
          console.error('[BookingLinkQR] Flyer generation failed:', err);
          Alert.alert(t('error', language));
        } finally {
          setIsGenerating(false);
        }
      });
    } catch (err) {
      console.error('[BookingLinkQR] Flyer PDF failed:', err);
      Alert.alert(t('error', language));
      setIsGenerating(false);
    }
  }, [business, bookingUrl, language, primaryColor, showSuccess]);

  // Email booking link to self with QR attachment
  const handleEmailToMe = useCallback(async () => {
    if (!business?.email) {
      Alert.alert(
        t('error', language),
        t('addEmailInSettings', language)
      );
      return;
    }

    // Use the same URL everywhere for consistency
    const urlToEmail = bookingUrl;

    setIsGenerating(true);
    try {
      // Build the email content using localized strings
      const subject = `${t('bookingLinkEmailSubject', language)} - ${business.name || 'Business'}`;
      const htmlBody = `
<h2>${t('bookingLinkEmailHeading', language)}</h2>
<p>${t('bookingLinkEmailIntro', language)}</p>
<p><a href="${urlToEmail}">${urlToEmail}</a></p>

<h3>${t('bookingLinkEmailHowToUse', language)}</h3>
<ul>
  <li>${t('bookingLinkEmailTip1', language)}</li>
  <li>${t('bookingLinkEmailTip2', language)}</li>
  <li>${t('bookingLinkEmailTip3', language)}</li>
</ul>

<p>${t('bookingLinkEmailFooter', language)}</p>
      `.trim();

      // Try to generate QR code image for attachment
      let qrAttachmentUri: string | null = null;
      if (qrRef.current) {
        try {
          const dataUrl = await new Promise<string>((resolve) => {
            qrRef.current.toDataURL((data: string) => resolve(data));
          });

          const qrFilename = `booking-qr-${Date.now()}.png`;
          const qrFileUri = `${FileSystem.cacheDirectory}${qrFilename}`;
          await FileSystem.writeAsStringAsync(qrFileUri, dataUrl, {
            encoding: FileSystem.EncodingType.Base64,
          });
          qrAttachmentUri = qrFileUri;
        } catch (qrErr) {
          console.warn('[BookingLinkQR] Could not generate QR attachment:', qrErr);
        }
      }

      // Check if MailComposer is available
      const isMailAvailable = await MailComposer.isAvailableAsync();

      if (isMailAvailable) {
        // Use MailComposer for rich email with attachment
        const result = await MailComposer.composeAsync({
          recipients: [business.email],
          subject,
          body: htmlBody,
          isHtml: true,
          attachments: qrAttachmentUri ? [qrAttachmentUri] : undefined,
        });

        if (result.status === MailComposer.MailComposerStatus.SENT) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess(t('emailSentSuccess', language));
        } else if (result.status === MailComposer.MailComposerStatus.CANCELLED) {
          // User cancelled, don't show error
          console.log('[BookingLinkQR] Email cancelled by user');
        } else {
          // Saved as draft or unknown status
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess(t('emailSentSuccess', language));
        }
      } else {
        // Fallback to mailto link (without attachment)
        const plainBody = `${t('bookingLinkEmailIntro', language)}\n\n${urlToEmail}\n\n${t('bookingLinkEmailFooter', language)}`;
        const mailtoUrl = `mailto:${business.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

        try {
          const canOpen = await Linking.canOpenURL(mailtoUrl);
          if (!canOpen) {
            // No mail app configured - copy to clipboard instead
            await Clipboard.setStringAsync(`${subject}\n\n${plainBody}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              t('success', language),
              t('noMailAppCopied', language)
            );
            return;
          }

          await Linking.openURL(mailtoUrl);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showSuccess(t('emailSentSuccess', language));
        } catch (mailtoErr) {
          // Final fallback: copy to clipboard
          const errorMsg = mailtoErr instanceof Error ? mailtoErr.message : 'Unknown error';
          console.error('[BookingLinkQR] Mailto failed:', errorMsg);

          await Clipboard.setStringAsync(`${subject}\n\n${plainBody}`);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            t('success', language),
            t('emailContentCopied', language)
          );
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[BookingLinkQR] Email failed:', errorMsg, err);

      // Show a more specific error message based on the error type
      let errorKey: 'emailFailed' | 'emailFailedNetwork' | 'emailFailedPermission' = 'emailFailed';
      if (errorMsg.includes('network') || errorMsg.includes('Network')) {
        errorKey = 'emailFailedNetwork';
      } else if (errorMsg.includes('permission') || errorMsg.includes('Permission')) {
        errorKey = 'emailFailedPermission';
      }

      Alert.alert(
        t('error', language),
        t(errorKey, language) + (errorMsg !== 'Unknown error' ? `\n\n${errorMsg}` : '')
      );
    } finally {
      setIsGenerating(false);
    }
  }, [business, bookingUrl, language, showSuccess]);

  // Handle language selection for link builder
  const handleSelectLanguage = useCallback((langCode: Language | null) => {
    setSelectedLinkLanguage(langCode);
    setShowLanguagePicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  if (!visible && !embedded) return null;

  const bodyContent = (
    <>
      {/* Description */}
      <View style={{ padding: 16 }}>
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 20,
          }}
        >
          {t('bookingLinkAndQrDescription', language)}
        </Text>
      </View>

      {/* Preview Mode Banner */}
      {inPreviewMode && (
        <Animated.View
          entering={FadeIn}
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <AlertCircle size={18} color="#F59E0B" style={{ marginRight: 10 }} />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              color: isDark ? '#FCD34D' : '#92400E',
              lineHeight: 18,
            }}
          >
            {t('previewModeNotice', language)}
          </Text>
        </Animated.View>
      )}

      {/* QR Code Section */}
      <Animated.View
        entering={FadeInDown.delay(100)}
        style={{
          marginHorizontal: 16,
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
        }}
      >
        {/* QR Code */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <QRCode
            value={bookingUrl || 'https://vibecode.com'}
            size={180}
            backgroundColor="#FFFFFF"
            color="#000000"
            getRef={(ref) => (qrRef.current = ref)}
          />
        </View>

        {/* Booking Link - Tappable to open in browser */}
        <View style={{ width: '100%', marginBottom: 20 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            {t('yourBookingLink', language)}
          </Text>
          <Pressable
            onPress={handleOpenBookingUrl}
            style={({ pressed }) => ({
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: 8,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <LinkIcon size={16} color={primaryColor} style={{ marginRight: 8 }} />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                color: primaryColor,
                textDecorationLine: 'underline',
              }}
              numberOfLines={1}
            >
              {bookingUrl}
            </Text>
          </Pressable>
        </View>

        {/* Action Buttons - Grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            width: '100%',
          }}
        >
          {/* Copy Link */}
          <Pressable
            onPress={handleCopyLink}
            style={{
              flex: 1,
              minWidth: '45%',
              backgroundColor: primaryColor,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Copy size={18} color="#FFFFFF" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#FFFFFF',
                marginLeft: 8,
              }}
            >
              {t('copyLink', language)}
            </Text>
          </Pressable>

          {/* Share */}
          <Pressable
            onPress={handleShareLink}
            style={{
              flex: 1,
              minWidth: '45%',
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={18} color={colors.text} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text,
                marginLeft: 8,
              }}
            >
              {t('shareLink', language)}
            </Text>
          </Pressable>

          {/* Download QR */}
          <Pressable
            onPress={handleDownloadQR}
            disabled={isGenerating}
            style={{
              flex: 1,
              minWidth: '45%',
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            <Download size={18} color={colors.text} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text,
                marginLeft: 8,
              }}
            >
              {t('downloadQr', language)}
            </Text>
          </Pressable>

          {/* Download Flyer */}
          <Pressable
            onPress={handleDownloadFlyer}
            disabled={isGenerating}
            style={{
              flex: 1,
              minWidth: '45%',
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            <FileText size={18} color={colors.text} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text,
                marginLeft: 8,
              }}
            >
              {t('downloadFlyer', language)}
            </Text>
          </Pressable>

          {/* Email to Me */}
          <Pressable
            onPress={handleEmailToMe}
            disabled={isGenerating}
            style={{
              width: '100%',
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            <Mail size={18} color={colors.text} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text,
                marginLeft: 8,
              }}
            >
              {t('emailToMe', language)}
            </Text>
          </Pressable>
        </View>

        {isGenerating && (
          <View style={{ marginTop: 16 }}>
            <ActivityIndicator size="small" color={primaryColor} />
          </View>
        )}
      </Animated.View>

      {/* Business Links Section */}
      <Animated.View entering={FadeInDown.delay(300)} style={{ marginTop: 24, marginBottom: 8 }}>
        {/* Section header */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{
            fontSize: 13,
            fontWeight: '600',
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {t('businessLinksTitle', language)}
          </Text>
        </View>

        <View style={{
          backgroundColor: colors.card,
          marginHorizontal: 16,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 4,
        }}>
          <Text style={{
            fontSize: 13,
            color: colors.textTertiary,
            lineHeight: 18,
            marginBottom: 14,
          }}>
            {t('businessLinksDescription', language)}
          </Text>

          {(
            [
              { key: 'website' as keyof SocialLinks, label: t('businessLinkWebsite', language), placeholder: 'yourbusiness.com', icon: <Globe size={17} color={primaryColor} /> },
              { key: 'instagram' as keyof SocialLinks, label: t('businessLinkInstagram', language), placeholder: 'instagram.com/yourbusiness', icon: <Instagram size={17} color={primaryColor} /> },
              { key: 'facebook' as keyof SocialLinks, label: t('businessLinkFacebook', language), placeholder: 'facebook.com/yourbusiness', icon: <Facebook size={17} color={primaryColor} /> },
              { key: 'tiktok' as keyof SocialLinks, label: t('businessLinkTikTok', language), placeholder: 'tiktok.com/@yourbusiness', icon: <Music2 size={17} color={primaryColor} /> },
              { key: 'youtube' as keyof SocialLinks, label: t('businessLinkYouTube', language), placeholder: 'youtube.com/@yourbusiness', icon: <Youtube size={17} color={primaryColor} /> },
              { key: 'whatsapp' as keyof SocialLinks, label: t('businessLinkWhatsApp', language), placeholder: '+1 (555) 000-0000', icon: <MessageCircle size={17} color={primaryColor} /> },
            ] as const
          ).map((field, idx, arr) => (
            <View
              key={field.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 11,
                borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              {/* Icon */}
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: `${primaryColor}14`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                {field.icon}
              </View>

              {/* Label + Input stacked */}
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  marginBottom: 3,
                }}>
                  {field.label}
                </Text>
                <View style={{
                  borderWidth: 1.5,
                  borderColor: focusedLinkField === field.key ? primaryColor : 'transparent',
                  borderRadius: 8,
                  paddingHorizontal: focusedLinkField === field.key ? 8 : 0,
                  paddingVertical: focusedLinkField === field.key ? 4 : 0,
                  backgroundColor: focusedLinkField === field.key
                    ? (isDark ? `${primaryColor}18` : `${primaryColor}0f`)
                    : 'transparent',
                }}>
                  <TextInput
                    value={socialLinks[field.key] ?? ''}
                    onChangeText={(v) => setSocialLinks((prev) => ({ ...prev, [field.key]: v }))}
                    onFocus={() => setFocusedLinkField(field.key)}
                    onBlur={() => setFocusedLinkField(null)}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    caretHidden={false}
                    style={{
                      fontSize: 14,
                      color: colors.text,
                      padding: 0,
                      // @ts-ignore — caretColor is web/RN specific
                      caretColor: primaryColor,
                      minHeight: 22,
                    }}
                  />
                </View>
              </View>
            </View>
          ))}

          {/* Save button — only visible when there are unsaved changes */}
          {hasSocialChanges && (
            <Pressable
              onPress={handleSaveSocialLinks}
              disabled={isSavingLinks}
              style={{
                backgroundColor: buttonColor,
                borderRadius: 10,
                paddingVertical: 13,
                alignItems: 'center',
                marginTop: 14,
                marginBottom: 10,
                opacity: isSavingLinks ? 0.6 : 1,
              }}
            >
              {isSavingLinks
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('saveLinks', language)}</Text>
              }
            </Pressable>
          )}

          {/* Bottom padding when no save button */}
          {!hasSocialChanges && <View style={{ height: 12 }} />}
        </View>
      </Animated.View>
    </>
  );

  const languagePicker = (
    <>
      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowLanguagePicker(false)}
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
                {t('languageLinkBuilder', language)}
              </Text>

              <ScrollView style={{ maxHeight: 400 }}>
                {/* Default option (no lang param) */}
                <Pressable
                  onPress={() => handleSelectLanguage(null)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: selectedLinkLanguage === null ? `${primaryColor}10` : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: selectedLinkLanguage === null ? '600' : '400',
                        color: selectedLinkLanguage === null ? primaryColor : colors.text,
                      }}
                    >
                      {t('defaultLinkNoLang', language)}
                    </Text>
                  </View>
                  {selectedLinkLanguage === null && <Check size={20} color={primaryColor} />}
                </Pressable>

                {/* Enabled languages */}
                {enabledLocales.map((locale, index) => {
                  const isSelected = selectedLinkLanguage === locale.code;
                  const isLast = index === enabledLocales.length - 1;

                  return (
                    <Pressable
                      key={locale.code}
                      onPress={() => handleSelectLanguage(locale.code)}
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
                      </View>
                      {isSelected && <Check size={20} color={primaryColor} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Booking Preview Modal - SAME component used by Branding Preview */}
      <BookingPreviewModal
        visible={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        bookingUrl={bookingUrl}
        businessName={business?.name || ''}
        businessLogoUrl={undefined}
        primaryColor={primaryColor}
        enabledLocales={settings.enabled_locales}
      />
    </>
  );

  // Embedded mode
  if (embedded) {
    return (
      <>
        <View style={{ paddingBottom: 8 }}>
          {bodyContent}
        </View>
        {languagePicker}
      </>
    );
  }

  // Standalone modal mode
  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <QrCode size={20} color={primaryColor} />
            </View>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
              {t('bookingLinkAndQr', language)}
            </Text>
            <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={true} bounces={true} alwaysBounceVertical={true}>
            {bodyContent}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {languagePicker}
    </>
  );
}
