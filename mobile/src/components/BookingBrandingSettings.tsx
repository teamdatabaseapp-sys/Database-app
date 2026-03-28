/**
 * Booking Branding Settings Component
 *
 * PREMIUM feature for business branding on public booking pages.
 * Features:
 * - Logo upload with circular preview
 * - Primary and secondary color pickers
 * - Live preview component
 * - Preview button to open booking page
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Camera,
  Trash2,
  Check,
  Eye,
  ExternalLink,
  Image as ImageIcon,
  Palette,
  RotateCcw,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
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
import { getDisplayBookingUrl } from '@/lib/bookingUrl';
import { BookingPreviewModal } from './BookingPreviewModal';

interface BookingBrandingSettingsProps {
  visible: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export function BookingBrandingSettings({ visible, onClose, embedded }: BookingBrandingSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [branding, setBranding] = useState<BusinessBranding | null>(null);
  const [showPrimaryColorPicker, setShowPrimaryColorPicker] = useState(false);
  const [showSecondaryColorPicker, setShowSecondaryColorPicker] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const { colors, isDark, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const language = useStore((s) => s.language) as Language;
  const { business, businessId } = useBusiness();
  const queryClient = useQueryClient();

  // Load branding when modal opens
  useEffect(() => {
    if ((visible || embedded) && businessId) {
      loadBranding();
    }
  }, [visible, embedded, businessId]);

  const loadBranding = async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const { data, error } = await getBusinessBranding(businessId);
      if (error) {
        console.error('[BookingBrandingSettings] Error loading branding:', error);
      } else if (data) {
        setBranding(data);
      }
    } catch (err) {
      console.error('[BookingBrandingSettings] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uri = asset.uri.toLowerCase();
      const isValidType = uri.endsWith('.png') || uri.endsWith('.jpg') || uri.endsWith('.jpeg');
      const mimeType = asset.mimeType?.toLowerCase() || '';
      const isValidMime = mimeType.includes('png') || mimeType.includes('jpeg') || mimeType.includes('jpg');
      if (!isValidType && !isValidMime) {
        Alert.alert(t('error', language), t('invalidImageType', language));
        return;
      }
      if (asset.fileSize && asset.fileSize > 1024 * 1024) {
        Alert.alert(t('error', language), t('imageTooLarge', language));
        return;
      }
      setIsUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { data, error } = await uploadBusinessLogo(businessId, asset.uri);
      if (error) {
        console.error('[BookingBrandingSettings] Upload error:', error.message);
        Alert.alert(t('error', language), error.message);
        return;
      }
      if (data) {
        setBranding(data);
        queryClient.invalidateQueries({ queryKey: ['business'] });
        queryClient.invalidateQueries({ queryKey: ['businesses'] });
        showSuccess(t('logoUploaded', language));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error('[BookingBrandingSettings] Unexpected upload error:', err);
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
                console.error('[BookingBrandingSettings] Remove error:', error.message);
                Alert.alert(t('error', language), error.message);
                return;
              }
              if (data) {
                setBranding(data);
                showSuccess(t('logoRemoved', language));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (err) {
              console.error('[BookingBrandingSettings] Unexpected remove error:', err);
              Alert.alert(t('error', language), t('tryAgain', language));
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  }, [businessId, language, showSuccess]);

  const handleSelectPrimaryColor = useCallback(
    async (colorHex: string | null) => {
      if (!businessId || !colorHex) return;
      setShowPrimaryColorPicker(false);
      setIsSaving(true);
      try {
        const { data, error } = await updateBusinessBranding(businessId, { brand_primary_color: colorHex });
        if (error) {
          console.error('[BookingBrandingSettings] Color update error:', error.message);
          Alert.alert(t('error', language), error.message);
          return;
        }
        if (data) {
          setBranding(data);
          showSuccess(t('colorUpdated', language));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (err) {
        console.error('[BookingBrandingSettings] Unexpected color error:', err);
        Alert.alert(t('error', language), t('tryAgain', language));
      } finally {
        setIsSaving(false);
      }
    },
    [businessId, language, showSuccess]
  );

  const handleSelectSecondaryColor = useCallback(
    async (colorHex: string | null) => {
      if (!businessId) return;
      setShowSecondaryColorPicker(false);
      setIsSaving(true);
      try {
        const { data, error } = await updateBusinessBranding(businessId, { brand_secondary_color: colorHex });
        if (error) {
          console.error('[BookingBrandingSettings] Color update error:', error.message);
          Alert.alert(t('error', language), error.message);
          return;
        }
        if (data) {
          setBranding(data);
          showSuccess(t('colorUpdated', language));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (err) {
        console.error('[BookingBrandingSettings] Unexpected color error:', err);
        Alert.alert(t('error', language), t('tryAgain', language));
      } finally {
        setIsSaving(false);
      }
    },
    [businessId, language, showSuccess]
  );

  const handlePreviewBookingPage = useCallback(() => {
    if (!business?.name || !businessId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPreviewModal(true);
  }, [business?.name, businessId]);

  const bookingUrl = business?.name && businessId
    ? getDisplayBookingUrl(business.name, businessId)
    : '';

  const displayPrimaryColor = branding?.brand_primary_color || DEFAULT_PRIMARY_COLOR;
  const displaySecondaryColor = branding?.brand_secondary_color || null;

  // The inner body content (shared between embedded and modal modes)
  const bodyContent = (
    <>
      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <>
          {/* Description */}
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
              {t('bookingBrandingDescription', language)}
            </Text>
          </View>

          {/* Logo Upload Section */}
          <Animated.View entering={FadeInDown.delay(100)}>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('businessLogo', language)}
              </Text>
            </View>
            <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, padding: 20, alignItems: 'center' }}>
              <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden', borderWidth: 2, borderColor: colors.border }}>
                {isUploading ? (
                  <ActivityIndicator size="large" color={primaryColor} />
                ) : branding?.logo_url ? (
                  <Image source={{ uri: branding.logo_url }} style={{ width: 96, height: 96, borderRadius: 48 }} resizeMode="cover" />
                ) : (
                  <ImageIcon size={40} color={colors.textTertiary} />
                )}
              </View>
              <Text style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginBottom: 16, lineHeight: 18 }}>
                {t('logoHelperText', language)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={handleUploadLogo} disabled={isUploading} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: primaryColor, borderRadius: 10, opacity: isUploading ? 0.6 : 1 }}>
                  <Camera size={18} color="#FFFFFF" />
                  <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                    {branding?.logo_url ? t('replaceLogo', language) : t('uploadLogo', language)}
                  </Text>
                </Pressable>
                {branding?.logo_url && (
                  <Pressable onPress={handleRemoveLogo} disabled={isUploading} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)', borderRadius: 10, opacity: isUploading ? 0.6 : 1 }}>
                    <Trash2 size={18} color="#EF4444" />
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Brand Colors Section */}
          <Animated.View entering={FadeInDown.delay(200)} style={{ marginTop: 24 }}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('themeColors', language)}
              </Text>
            </View>
            <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' }}>
              <Pressable onPress={() => setShowPrimaryColorPicker(true)} disabled={isSaving} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: isSaving ? 0.6 : 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: displayPrimaryColor, marginRight: 14, borderWidth: 3, borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{t('primaryColor', language)}</Text>
                  <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('brandPrimaryColorDescription', language)}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setShowSecondaryColorPicker(true)} disabled={isSaving} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, opacity: isSaving ? 0.6 : 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: displaySecondaryColor || 'transparent', marginRight: 14, borderWidth: displaySecondaryColor ? 3 : 2, borderColor: displaySecondaryColor ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : colors.border, borderStyle: displaySecondaryColor ? 'solid' : 'dashed', alignItems: 'center', justifyContent: 'center' }}>
                  {!displaySecondaryColor && <X size={18} color={colors.textTertiary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{t('secondaryColorOptional', language)}</Text>
                  <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{displaySecondaryColor ? t('secondaryColorDescription', language) : t('noColor', language)}</Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>

          {/* Live Preview Section */}
          <Animated.View entering={FadeInDown.delay(400)} style={{ marginTop: 24 }}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('livePreview', language)}
              </Text>
            </View>
            <View style={{ backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 12, padding: 20 }}>
              <View style={{ backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' }}>
                  {branding?.logo_url ? (
                    <Image source={{ uri: branding.logo_url }} style={{ width: 56, height: 56, borderRadius: 28 }} resizeMode="cover" />
                  ) : (
                    <ImageIcon size={24} color={colors.textTertiary} />
                  )}
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }} numberOfLines={1}>
                  {business?.name || 'Your Business'}
                </Text>
                <View style={{ backgroundColor: displayPrimaryColor, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>{t('bookNow', language)}</Text>
                </View>
              </View>
              <Pressable onPress={handlePreviewBookingPage} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 10 }}>
                <Eye size={18} color={primaryColor} />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: primaryColor }}>{t('previewBookingPage', language)}</Text>
                <ExternalLink size={14} color={primaryColor} style={{ marginLeft: 6 }} />
              </Pressable>
            </View>
          </Animated.View>

          {isSaving && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 24 }}>
              <ActivityIndicator size="small" color={primaryColor} />
              <Text style={{ marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>{t('saving', language)}</Text>
            </View>
          )}
        </>
      )}
    </>
  );

  // Color picker bottom sheets (inline — avoids nested Modal issues on iOS)
  const colorPickers = (showPrimaryColorPicker || showSecondaryColorPicker) ? (
    <>
      {/* Primary Color Picker */}
      {showPrimaryColorPicker && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 }}
          onPress={() => setShowPrimaryColorPicker(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: 480, flexDirection: 'column' }}>
              {/* Handle */}
              <View style={{ alignSelf: 'center', width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 12, marginBottom: 8 }} />
              {/* Title */}
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {t('primaryColor', language)}
              </Text>
              {/* Scrollable color grid — flex:1 fills remaining height */}
              <ScrollView
                contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              >
                {BRAND_COLOR_PALETTE.map((colorOption) => {
                  const isSelected = displayPrimaryColor === colorOption.hex;
                  return (
                    <Pressable
                      key={colorOption.hex}
                      onPress={() => handleSelectPrimaryColor(colorOption.hex)}
                      style={{
                        width: 48, height: 48, borderRadius: 24,
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
              {/* Reset to Default — always visible below the grid */}
              <Pressable
                onPress={() => handleSelectPrimaryColor(DEFAULT_PRIMARY_COLOR)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 4, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <RotateCcw size={15} color={colors.textSecondary} />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>Reset to Default</Text>
              </Pressable>
              {/* Safe-area spacer */}
              <View style={{ height: 28 }} />
            </View>
          </Pressable>
        </Pressable>
      )}

      {/* Secondary Color Picker */}
      {showSecondaryColorPicker && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 }}
          onPress={() => setShowSecondaryColorPicker(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: 480, flexDirection: 'column' }}>
              {/* Handle */}
              <View style={{ alignSelf: 'center', width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 12, marginBottom: 8 }} />
              {/* Title */}
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {t('secondaryColor', language)}
              </Text>
              {/* Scrollable color grid — flex:1 fills remaining height */}
              <ScrollView
                contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              >
                {/* None option */}
                <Pressable
                  onPress={() => handleSelectSecondaryColor(null)}
                  style={{
                    width: 48, height: 48, borderRadius: 24,
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
                        width: 48, height: 48, borderRadius: 24,
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
              {/* Reset to Default — always visible below the grid */}
              <Pressable
                onPress={() => handleSelectSecondaryColor(null)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 4, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <RotateCcw size={15} color={colors.textSecondary} />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '500', color: colors.textSecondary }}>Reset to Default</Text>
              </Pressable>
              {/* Safe-area spacer */}
              <View style={{ height: 28 }} />
            </View>
          </Pressable>
        </Pressable>
      )}
    </>
  ) : null;

  // Preview Modal
  const previewModal = (
    <BookingPreviewModal
      visible={showPreviewModal}
      onClose={() => setShowPreviewModal(false)}
      bookingUrl={bookingUrl}
      businessName={business?.name || ''}
      businessLogoUrl={branding?.logo_url}
      primaryColor={branding?.brand_primary_color || DEFAULT_PRIMARY_COLOR}
    />
  );

  // ── Embedded mode: render flat content (no Modal wrapper, no SafeAreaView) ──
  if (embedded) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingBottom: 8 }}>
          {bodyContent}
        </View>
        {colorPickers}
        {previewModal}
      </View>
    );
  }

  // ── Standalone modal mode ──
  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Palette size={20} color={primaryColor} />
            </View>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
              {t('bookingBranding', language)}
            </Text>
            <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {bodyContent}
            </ScrollView>
            {colorPickers}
          </View>
        </SafeAreaView>
      </Modal>
      {previewModal}
    </>
  );
}
