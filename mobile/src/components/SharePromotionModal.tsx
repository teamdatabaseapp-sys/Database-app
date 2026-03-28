/**
 * SharePromotionModal — Premium enterprise Social Media Share flow
 *
 * Step 1: Promo Picker  — Active / Templates tabs with search
 * Step 2: Share Editor  — Format selector, caption composer, Live Preview card,
 *                         "Social Media Post Preview" (outlined) + "Publish" (solid)
 * Step 3: Preview       — Branded share card (in-place, X to dismiss)
 *
 * Layout rules enforced throughout:
 *   [ICON left]  [TITLE + desc right]  [ACTION/chevron far right]
 *   Nothing ever below the icon.
 *
 * i18n: all user-visible strings use the 18-language system.
 * Performance: modal renders instantly, settings loaded async with skeletons,
 *              module-level cache for instant re-open.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  View, Text, Pressable, Modal, TextInput, ScrollView,
  ActivityIndicator, Platform, Alert, Image, TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X, Share2, Eye, Tag, ChevronLeft, ChevronRight,
  Sparkles, ExternalLink, QrCode, Globe, Check, Search,
  Zap, Gift, Percent, Star, Users, Repeat, Package,
  Megaphone, AlertCircle, RefreshCw, Camera,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import { MarketingPromotion } from '@/lib/types';
import {
  getBookingPageSettings, type SocialLinks,
} from '@/services/bookingPageSettingsService';
import { getBusinessBranding } from '@/services/businessBrandingService';
import { getDisplayBookingUrl } from '@/lib/bookingUrl';
import type { TranslationKey } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/i18n/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ShareFormat = 'booking' | 'qr' | 'website';

interface SettingsState {
  bookingUrl: string;
  websiteUrl: string;
  logoUrl: string;
  loaded: boolean;
  error: string | null;
}

interface TemplateLike {
  id: string;
  name: string;
  description: string;
  isTemplate: true;
  badgeKey: string;
  discountLabel: string;
  iconKey: 'percent' | 'gift' | 'star' | 'zap' | 'users' | 'repeat' | 'package' | 'megaphone' | 'tag';
}

type PromoItem = MarketingPromotion | TemplateLike;

export interface SharePromotionModalProps {
  visible: boolean;
  onClose: () => void;
  preSelectedPromotion?: MarketingPromotion | null;
}

// ─────────────────────────────────────────────
// Module-level settings cache
// ─────────────────────────────────────────────

const settingsCache = new Map<string, SettingsState>();

// ─────────────────────────────────────────────
// Caption builder
// ─────────────────────────────────────────────

function buildCaption(
  promoName: string,
  promoDescription: string | undefined,
  businessName: string,
  link: string,
  format: ShareFormat | null,
): string {
  const parts: string[] = [];
  parts.push(`🔥 ${promoName}`);
  if (promoDescription?.trim()) {
    parts.push('');
    parts.push(promoDescription.trim());
  }
  parts.push('');
  parts.push(`Available now at ${businessName}.`);
  if (format === 'qr') {
    parts.push('');
    parts.push('Scan the QR code to learn more.');
  } else if (link) {
    parts.push('');
    parts.push(`Learn more: ${link}`);
  }
  return parts.join('\n');
}

function isTemplate(item: PromoItem): item is TemplateLike {
  return (item as TemplateLike).isTemplate === true;
}

// ─────────────────────────────────────────────
// Template definitions
// ─────────────────────────────────────────────

const TPL_DEFS: {
  id: string; nameKey: TranslationKey; descKey: TranslationKey;
  discountLabel: string; iconKey: TemplateLike['iconKey'];
}[] = [
  { id: 'tpl_loyalty',    nameKey: 'promoTplLoyaltyName',      descKey: 'promoTplLoyaltyDesc',      discountLabel: 'Buy 5 get 1 free', iconKey: 'gift'    },
  { id: 'tpl_welcome',    nameKey: 'promoTplWelcomeName',       descKey: 'promoTplWelcomeDesc',       discountLabel: '15% off',          iconKey: 'star'    },
  { id: 'tpl_seasonal',   nameKey: 'promoTplSeasonalName',      descKey: 'promoTplSeasonalDesc',      discountLabel: '20% off',          iconKey: 'zap'     },
  { id: 'tpl_flash_sale', nameKey: 'promoTplFlashSaleName',     descKey: 'promoTplFlashSaleDesc',     discountLabel: 'Flash deal',       iconKey: 'zap'     },
  { id: 'tpl_referral',   nameKey: 'promoTplReferralPromoName', descKey: 'promoTplReferralPromoDesc', discountLabel: '$10 off',          iconKey: 'users'   },
  { id: 'tpl_bundle',     nameKey: 'promoTplBundleName',        descKey: 'promoTplBundleDesc',        discountLabel: 'Bundle deal',      iconKey: 'package' },
];

function getPromoIcon(iconKey: TemplateLike['iconKey'], color: string, size = 18) {
  switch (iconKey) {
    case 'percent':   return <Percent size={size} color={color} />;
    case 'gift':      return <Gift size={size} color={color} />;
    case 'star':      return <Star size={size} color={color} />;
    case 'zap':       return <Zap size={size} color={color} />;
    case 'users':     return <Users size={size} color={color} />;
    case 'repeat':    return <Repeat size={size} color={color} />;
    case 'package':   return <Package size={size} color={color} />;
    case 'megaphone': return <Megaphone size={size} color={color} />;
    default:          return <Tag size={size} color={color} />;
  }
}

function getDiscountIcon(discountType: MarketingPromotion['discountType'], color: string, size = 18) {
  switch (discountType) {
    case 'percentage': return <Percent size={size} color={color} />;
    case 'fixed':      return <Tag size={size} color={color} />;
    case 'flash_sale': return <Zap size={size} color={color} />;
    case 'bundle':     return <Package size={size} color={color} />;
    case 'referral':   return <Users size={size} color={color} />;
    default:           return <Gift size={size} color={color} />;
  }
}

// ─────────────────────────────────────────────
// SkeletonBlock
// ─────────────────────────────────────────────

function SkeletonBlock({ height, borderRadius, style }: { height: number; borderRadius?: number; style?: object }) {
  const { colors } = useTheme();
  return (
    <View style={[{
      height, borderRadius: borderRadius ?? 12,
      backgroundColor: colors.backgroundTertiary, opacity: 0.55,
    }, style]} />
  );
}

// ─────────────────────────────────────────────
// PromoRow — [ICON] [TITLE + desc] [CHEVRON far right]
// No Animated.View wrapper — rock-solid horizontal layout.
// ─────────────────────────────────────────────

function PromoRow({
  icon, title, subtitle, onPress, primaryColor, colors, isDark,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  primaryColor: string;
  colors: any;
  isDark: boolean;
  delay?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 14,
        marginBottom: 8,
        backgroundColor: isDark ? colors.card : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? colors.border : '#E8ECF0',
        opacity: pressed ? 0.72 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0 : 0.06,
        shadowRadius: 4,
        elevation: isDark ? 0 : 2,
      })}
    >
      {/* Inner View owns the row layout — never on Pressable style function */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: 14,
      }}>
        {/* LEFT: icon — fixed 44×44, never compressed */}
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          flexGrow: 0,
        }}>
          {icon}
        </View>

        {/* CENTER: title + description to the RIGHT of icon */}
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Text
            style={{ color: colors.text, fontWeight: '600', fontSize: 14, lineHeight: 20 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle?.trim() ? (
            <Text
              style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* FAR RIGHT: chevron — fixed width, never pushed below */}
        <View style={{ marginLeft: 10, flexShrink: 0, flexGrow: 0 }}>
          <ChevronRight size={16} color={colors.textTertiary} />
        </View>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────
// FormatCard — [ICON] [TITLE + desc] [RADIO far right]
// Radio circle is ALWAYS on the far right, vertically centered.
// ─────────────────────────────────────────────

function FormatCard({
  format, label, description, sublabel, isSelected, onPress, primaryColor, colors, isDark,
}: {
  format: ShareFormat;
  label: string;
  description: string;
  sublabel: string;
  isSelected: boolean;
  onPress: () => void;
  primaryColor: string;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? primaryColor : (isDark ? colors.border : '#E8ECF0'),
        backgroundColor: isSelected
          ? (isDark ? `${primaryColor}14` : `${primaryColor}08`)
          : (isDark ? colors.card : '#FFFFFF'),
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {/* Inner View owns the row layout — layout must NOT be on Pressable style function */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 13,
      }}>
        {/* LEFT: icon block — fixed 42×42, never compressed */}
        <View style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          backgroundColor: isSelected
            ? (isDark ? `${primaryColor}25` : `${primaryColor}15`)
            : (isDark ? colors.backgroundTertiary : '#F0F4F8'),
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          flexGrow: 0,
        }}>
          {format === 'booking' && <ExternalLink size={18} color={isSelected ? primaryColor : colors.textSecondary} />}
          {format === 'qr'      && <QrCode       size={18} color={isSelected ? primaryColor : colors.textSecondary} />}
          {format === 'website' && <Globe        size={18} color={isSelected ? primaryColor : colors.textSecondary} />}
        </View>

        {/* CENTER: title + description to the RIGHT of icon */}
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Text style={{ color: isSelected ? primaryColor : colors.text, fontWeight: '600', fontSize: 14, lineHeight: 20 }}>
            {label}
          </Text>
          {description ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 2 }}>
              {description}
            </Text>
          ) : null}
          {sublabel ? (
            <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
              {sublabel}
            </Text>
          ) : null}
        </View>

        {/* FAR RIGHT: radio/checkmark — fixed 22×22, always vertically centered */}
        <View style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          marginLeft: 12,
          flexShrink: 0,
          flexGrow: 0,
          backgroundColor: isSelected ? primaryColor : 'transparent',
          borderWidth: isSelected ? 0 : 1.5,
          borderColor: isDark ? colors.border : '#BCC4CE',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
        </View>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────
// Preview Screen — sheet-style, X to close, no "Back" label
// ─────────────────────────────────────────────

function PreviewScreen({
  promoName, promoDescription, caption, link, format, bookingUrl,
  businessName, logoUrl, primaryColor, settingsLoaded, language, onClose,
}: {
  promoName: string;
  promoDescription?: string;
  caption: string;
  link: string;
  format: ShareFormat | null;
  bookingUrl: string;
  businessName: string;
  logoUrl: string;
  primaryColor: string;
  settingsLoaded: boolean;
  language: Language;
  onClose: () => void;
}) {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View entering={SlideInRight.duration(240)} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header: [Eye icon + "Preview" text]  [X close] */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        {/* LEFT: icon + label horizontal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: `${primaryColor}14`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Eye size={16} color={primaryColor} />
          </View>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
            {t('sharePreview', language)}
          </Text>
        </View>

        {/* RIGHT: X close button */}
        <Pressable
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={{
            color: colors.textSecondary, fontSize: 11, fontWeight: '700',
            letterSpacing: 1, textTransform: 'uppercase',
            textAlign: 'center', marginBottom: 18,
          }}>
            {t('shareCardPreview', language)}
          </Text>
        </Animated.View>

        {/* Share card */}
        <Animated.View entering={FadeInDown.delay(40).duration(260)}>
          <View style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 20,
            elevation: 8,
          }}>
            {/* Business header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: isDark ? colors.backgroundSecondary : '#fff',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              {/* Logo always on colored background — white logos stay visible */}
              <View style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: primaryColor,
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {!settingsLoaded ? (
                  <View style={{ width: 42, height: 42, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                ) : logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={{ width: 42, height: 42 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>
                    {businessName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                {!settingsLoaded ? (
                  <>
                    <SkeletonBlock height={13} borderRadius={6} style={{ width: '55%', marginBottom: 5 }} />
                    <SkeletonBlock height={10} borderRadius={5} style={{ width: '40%' }} />
                  </>
                ) : (
                  <>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, lineHeight: 19 }} numberOfLines={1}>
                      {businessName}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>
                      {t('shareSpecialPromotion', language)}
                    </Text>
                  </>
                )}
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
            </View>

            {/* Promo banner */}
            <View style={{ backgroundColor: primaryColor, paddingHorizontal: 20, paddingVertical: 22 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
                backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'flex-start',
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
              }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' }} />
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' }}>
                  {t('shareSpecialOffer', language)}
                </Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 21, fontWeight: '800', lineHeight: 27, letterSpacing: -0.3 }}>
                {promoName}
              </Text>
              {promoDescription?.trim() ? (
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, lineHeight: 20 }}>
                  {promoDescription}
                </Text>
              ) : null}
            </View>

            {/* Caption */}
            <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 }}>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
                {caption}
              </Text>
            </View>

            {/* QR code */}
            {format === 'qr' && bookingUrl ? (
              <View style={{ alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 }}>
                <View style={{
                  padding: 14, backgroundColor: '#fff', borderRadius: 16,
                  borderWidth: 1, borderColor: '#E2E8F0',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
                }}>
                  <QRCode value={bookingUrl} size={120} />
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 10, fontWeight: '500' }}>
                  {t('shareScanToBook', language)}
                </Text>
              </View>
            ) : null}

            {/* Link chip */}
            {(format === 'booking' || format === 'website') && link ? (
              <View style={{
                marginHorizontal: 18, marginBottom: 16, marginTop: 8,
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: isDark ? `${primaryColor}14` : `${primaryColor}0A`,
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                borderWidth: 1, borderColor: isDark ? `${primaryColor}22` : `${primaryColor}15`,
              }}>
                {format === 'booking'
                  ? <ExternalLink size={13} color={primaryColor} />
                  : <Globe size={13} color={primaryColor} />}
                <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {link}
                </Text>
              </View>
            ) : null}

            {/* Footer */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 16, paddingVertical: 12,
              borderTopWidth: 1, borderTopColor: colors.border,
              backgroundColor: isDark ? colors.backgroundSecondary : '#FAFAFA',
            }}>
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                {t('shareTapToLearnMore', language)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: primaryColor, opacity: 0.7 }} />
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: primaryColor, opacity: 0.4 }} />
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: primaryColor, opacity: 0.2 }} />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Tip */}
        <Animated.View entering={FadeInDown.delay(120).duration(260)}>
          <View style={{
            marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: isDark ? `${primaryColor}0C` : `${primaryColor}07`,
            borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: isDark ? `${primaryColor}18` : `${primaryColor}12`,
          }}>
            <Eye size={14} color={primaryColor} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, flex: 1 }}>
              {t('sharePreviewTip', language)}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// PlatformPickerModal — slide-up sheet for choosing platform
// ─────────────────────────────────────────────

function PlatformPickerModal({
  visible, onClose, onSelectPlatform, primaryColor, colors, isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectPlatform: (platform: 'facebook' | 'instagram' | 'other') => void;
  primaryColor: string;
  colors: any;
  isDark: boolean;
}) {
  const platforms: {
    key: 'facebook' | 'instagram' | 'other';
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'facebook',
      label: 'Facebook',
      sublabel: 'Share to your Facebook page or profile',
      icon: (
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: '#1877F2',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, lineHeight: 22, textAlign: 'center' }}>f</Text>
        </View>
      ),
    },
    {
      key: 'instagram',
      label: 'Instagram',
      sublabel: 'Share to your Instagram feed or story',
      icon: <Camera size={20} color="#E1306C" />,
    },
    {
      key: 'other',
      label: 'Other Platforms',
      sublabel: 'WhatsApp, SMS, email and more',
      icon: <Share2 size={20} color={primaryColor} />,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>
            Share to...
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Platform options */}
        <View style={{ padding: 16 }}>
          {platforms.map((platform, index) => (
            <Pressable
              key={platform.key}
              onPress={() => onSelectPlatform(platform.key)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 16,
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderRadius: 14,
                marginBottom: index < platforms.length - 1 ? 10 : 0,
                borderWidth: 1,
                borderColor: isDark ? colors.border : '#E8ECF0',
                opacity: pressed ? 0.72 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0 : 0.05,
                shadowRadius: 4,
                elevation: isDark ? 0 : 2,
              })}
            >
              {/* Icon container — fixed width */}
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F0F4F8',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                flexGrow: 0,
              }}>
                {platform.icon}
              </View>

              {/* Text block */}
              <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, lineHeight: 21 }}>
                  {platform.label}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 }} numberOfLines={1}>
                  {platform.sublabel}
                </Text>
              </View>

              {/* Chevron */}
              <View style={{ marginLeft: 10, flexShrink: 0, flexGrow: 0 }}>
                <ChevronRight size={16} color={colors.textTertiary} />
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={{
          color: colors.textTertiary, fontSize: 12, textAlign: 'center',
          paddingHorizontal: 32, lineHeight: 18, marginTop: 8,
        }}>
          Your device's share sheet will open so you can choose the exact destination.
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function SharePromotionModal({ visible, onClose, preSelectedPromotion }: SharePromotionModalProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const { business, businessId } = useBusiness();
  const calendarEnabled = useStore((s) => s.featureToggles.calendarEnabled);
  const allPromos = useStore((s) => s.marketingPromotions);
  const userId = useStore((s) => s.user?.id);

  const businessName = business?.name ?? 'your business';

  // Navigation
  const [step, setStep] = useState<'pick' | 'share'>('pick');
  const [selectedItem, setSelectedItem] = useState<PromoItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  // Picker
  const [pickerTab, setPickerTab] = useState<'active' | 'templates'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Settings (async, cached)
  const [settings, setSettings] = useState<SettingsState>({
    bookingUrl: '', websiteUrl: '', logoUrl: '', loaded: false, error: null,
  });

  // Editor
  const [selectedFormat, setSelectedFormat] = useState<ShareFormat | null>(null);
  const [caption, setCaption] = useState('');
  const [websiteInput, setWebsiteInput] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const qrRef = useRef<any>(null);

  // Derived: promotions
  const myPromos = useMemo(() => {
    if (!userId) return allPromos;
    const f = allPromos.filter((p) => p.userId === userId);
    return f.length > 0 ? f : allPromos;
  }, [allPromos, userId]);

  const activePromos = useMemo(() => myPromos.filter((p) => p.isActive), [myPromos]);

  const filteredActivePromos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activePromos;
    return activePromos.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
    );
  }, [activePromos, searchQuery]);

  const templateItems = useMemo((): TemplateLike[] =>
    TPL_DEFS.map((tpl) => ({
      id: tpl.id,
      name: t(tpl.nameKey, language),
      description: t(tpl.descKey, language),
      isTemplate: true as const,
      badgeKey: '',
      discountLabel: tpl.discountLabel,
      iconKey: tpl.iconKey,
    })),
  [language]);

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templateItems;
    return templateItems.filter(
      (tpl) => tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q),
    );
  }, [templateItems, searchQuery]);

  // Derived: available formats
  const availableFormats = useMemo(() => {
    const list: { format: ShareFormat; label: string; description: string; sublabel: string }[] = [];
    const bUrl = settings.bookingUrl;
    const wUrl = settings.websiteUrl || websiteInput.trim();
    if (bUrl) {
      list.push({ format: 'booking', label: t('shareBookingLink', language), description: t('shareBookingLinkDesc', language), sublabel: bUrl });
      list.push({ format: 'qr',      label: t('shareQrCode', language),      description: t('shareQrCodeDesc', language),      sublabel: t('shareBookingPageQr', language) });
    }
    if (wUrl) {
      list.push({ format: 'website', label: t('shareWebsiteLink', language), description: t('shareWebsiteLinkDesc', language), sublabel: wUrl });
    }
    return list;
  }, [settings.bookingUrl, settings.websiteUrl, websiteInput, language]);

  const activeLink = useMemo(() => {
    if (selectedFormat === 'booking') return settings.bookingUrl;
    if (selectedFormat === 'website') return settings.websiteUrl || websiteInput.trim();
    return '';
  }, [selectedFormat, settings, websiteInput]);

  const canShare = selectedFormat !== null;

  // Load settings on open (not on item tap — prevents freeze)
  useEffect(() => {
    if (!visible) return;

    if (preSelectedPromotion) {
      setSelectedItem(preSelectedPromotion);
      setStep('share');
    } else {
      setStep('pick');
      setSelectedItem(null);
    }
    setShowPreview(false);
    setSearchQuery('');

    const cacheKey = businessId ?? '__none__';
    const cached = settingsCache.get(cacheKey);
    if (cached) {
      setSettings(cached);
      return;
    }

    let mounted = true;
    setSettings({ bookingUrl: '', websiteUrl: '', logoUrl: '', loaded: false, error: null });

    const load = async () => {
      let bUrl = '';
      let wUrl = '';
      let logoUrl = '';
      let err: string | null = null;
      try {
        const [, wData, brandData] = await Promise.allSettled([
          calendarEnabled && businessId
            ? Promise.resolve(bUrl = getDisplayBookingUrl(businessName, businessId))
            : Promise.resolve(),
          businessId ? getBookingPageSettings(businessId) : Promise.resolve({ data: null }),
          businessId ? getBusinessBranding(businessId) : Promise.resolve({ data: null }),
        ]);
        if (wData.status === 'fulfilled' && wData.value && 'data' in wData.value) {
          wUrl =
            (wData.value.data?.social_links as SocialLinks | undefined)?.website?.trim() ||
            (wData.value.data?.social_links as SocialLinks | undefined)?.custom?.trim() ||
            '';
        }
        if (brandData.status === 'fulfilled' && brandData.value && 'data' in brandData.value) {
          logoUrl = (brandData.value.data as any)?.logo_url ?? '';
        }
      } catch {
        err = 'Could not load settings.';
      }
      if (!mounted) return;
      const result: SettingsState = { bookingUrl: bUrl, websiteUrl: wUrl, logoUrl, loaded: true, error: err };
      settingsCache.set(cacheKey, result);
      setSettings(result);
    };
    load();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, businessId, calendarEnabled, businessName, preSelectedPromotion]);

  // Auto-init format + caption on step 2
  useEffect(() => {
    if (step !== 'share' || !selectedItem || !settings.loaded) return;
    if (selectedFormat !== null) return;
    const fmt = availableFormats[0]?.format ?? null;
    setSelectedFormat(fmt);
    const lnk = fmt === 'booking' ? settings.bookingUrl
              : fmt === 'website' ? (settings.websiteUrl || websiteInput.trim())
              : '';
    setCaption(buildCaption(selectedItem.name, selectedItem.description, businessName, lnk, fmt));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, settings.loaded, selectedItem]);

  // Handlers
  const handleSelectItem = useCallback((item: PromoItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
    setSelectedFormat(null);
    setShowPreview(false);
    setStep('share');
  }, []);

  const handleSelectFormat = useCallback((fmt: ShareFormat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFormat(fmt);
    const lnk = fmt === 'booking' ? settings.bookingUrl
              : fmt === 'website' ? (settings.websiteUrl || websiteInput.trim())
              : '';
    if (selectedItem) {
      setCaption(buildCaption(selectedItem.name, selectedItem.description, businessName, lnk, fmt));
    }
  }, [settings, websiteInput, selectedItem, businessName]);

  const handleResetCaption = useCallback(() => {
    if (!selectedItem) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCaption(buildCaption(selectedItem.name, selectedItem.description, businessName, activeLink, selectedFormat));
  }, [selectedItem, businessName, activeLink, selectedFormat]);

  const handleShare = useCallback(async () => {
    if (!selectedFormat) return;
    setIsSharing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const canShareNative = await Sharing.isAvailableAsync();

      if (selectedFormat === 'qr') {
        if (!qrRef.current) {
          Alert.alert('Not ready', 'QR is still rendering. Please wait a moment.');
          setIsSharing(false);
          return;
        }
        qrRef.current.toDataURL(async (dataURL: string) => {
          try {
            const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
            const path = `${FileSystem.cacheDirectory}promo_qr_${Date.now()}.png`;
            await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
            if (canShareNative) {
              await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: selectedItem?.name ?? '', UTI: 'public.png' });
            } else {
              Alert.alert('Sharing unavailable', 'Your device does not support sharing.');
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (!msg.toLowerCase().includes('cancel')) Alert.alert('Share failed', 'Could not share the QR image.');
          } finally {
            setIsSharing(false);
          }
        });
        return;
      }

      const shareText = caption + (activeLink ? `\n\n${activeLink}` : '');
      if (!canShareNative) {
        await Clipboard.setStringAsync(shareText);
        setIsSharing(false);
        return;
      }
      const path = `${FileSystem.cacheDirectory}promo_share_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(path, shareText, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: selectedItem?.name ?? '', UTI: 'public.plain-text' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.toLowerCase().includes('cancel')) Alert.alert('Share failed', 'Try again.');
    } finally {
      setIsSharing(false);
    }
  }, [selectedFormat, caption, activeLink, selectedItem]);

  const handlePublish = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPlatformPicker(true);
  }, []);

  const handlePlatformSelected = useCallback((_platform: 'facebook' | 'instagram' | 'other') => {
    setShowPlatformPicker(false);
    // Delegate to native OS share sheet regardless of platform choice
    handleShare();
  }, [handleShare]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>

          {/* ══ PREVIEW SCREEN ══ */}
          {showPreview && selectedItem ? (
            <PreviewScreen
              promoName={selectedItem.name}
              promoDescription={selectedItem.description}
              caption={caption}
              link={activeLink}
              format={selectedFormat}
              bookingUrl={settings.bookingUrl}
              businessName={businessName}
              logoUrl={settings.logoUrl}
              primaryColor={primaryColor}
              settingsLoaded={settings.loaded}
              language={language}
              onClose={() => setShowPreview(false)}
            />
          ) : (
            <>
              {/* ══ HEADER ══ */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                paddingVertical: 14,
                backgroundColor: colors.card,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                {/* LEFT: back arrow — always visible, same style on both steps */}
                <Pressable
                  onPress={step === 'share' && !preSelectedPromotion
                    ? () => { setStep('pick'); setShowPreview(false); }
                    : onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ChevronLeft size={22} color={primaryColor} />
                </Pressable>

                {/* CENTER LEFT: share icon + title */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                  <View style={{
                    width: 34, height: 34, borderRadius: 10,
                    backgroundColor: `${primaryColor}14`,
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Share2 size={17} color={primaryColor} />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                    {step === 'pick'
                      ? t('shareAPromotion', language)
                      : t('shareThisPromotion', language)}
                  </Text>
                </View>

                {/* RIGHT: close button (X) */}
                <Pressable
                  onPress={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center', justifyContent: 'center',
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* ══ STEP 1: PICKER ══ */}
              {step === 'pick' && (
                <View style={{ flex: 1 }}>
                  {/* Segmented tabs */}
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                    <View style={{
                      flexDirection: 'row', padding: 3, borderRadius: 13,
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    }}>
                      {(['active', 'templates'] as const).map((tab) => {
                        const sel = pickerTab === tab;
                        return (
                          <Pressable
                            key={tab}
                            onPress={() => { setPickerTab(tab); setSearchQuery(''); }}
                            style={{
                              flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                              backgroundColor: sel ? (isDark ? colors.card : '#fff') : 'transparent',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: sel ? 1 : 0 },
                              shadowOpacity: sel ? 0.07 : 0,
                              shadowRadius: sel ? 3 : 0,
                            }}
                          >
                            <Text style={{
                              fontWeight: '600', fontSize: 13,
                              color: sel ? primaryColor : colors.textTertiary,
                            }}>
                              {tab === 'active'
                                ? `Active (${activePromos.length})`
                                : 'Templates'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Search bar */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 9,
                      marginTop: 10, paddingHorizontal: 12, paddingVertical: 10,
                      backgroundColor: colors.inputBackground,
                      borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder,
                    }}>
                      <Search size={15} color={colors.textTertiary} />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={pickerTab === 'active'
                          ? t('shareSearchPromotions', language)
                          : t('shareSearchTemplates', language)}
                        style={{ flex: 1, color: colors.inputText, fontSize: 14, padding: 0 } as TextStyle}
                        placeholderTextColor={colors.inputPlaceholder}
                        cursorColor={primaryColor}
                        selectionColor={`${primaryColor}40`}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                      />
                    </View>
                  </View>

                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Active tab */}
                    {pickerTab === 'active' && (
                      filteredActivePromos.length === 0 ? (
                        <Animated.View entering={FadeIn.duration(200)}>
                          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                            <View style={{
                              width: 60, height: 60, borderRadius: 30,
                              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Tag size={26} color={colors.textTertiary} />
                            </View>
                            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>
                              {activePromos.length === 0
                                ? t('shareNoActivePromos', language)
                                : t('shareNoResults', language)}
                            </Text>
                            {activePromos.length === 0 && (
                              <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 }}>
                                {t('shareNoActivePromosHint', language)}
                              </Text>
                            )}
                          </View>
                        </Animated.View>
                      ) : (
                        filteredActivePromos.map((promo, i) => (
                          <PromoRow
                            key={promo.id}
                            icon={getDiscountIcon(promo.discountType, primaryColor)}
                            title={promo.name}
                            subtitle={promo.description?.trim() || undefined}
                            onPress={() => handleSelectItem(promo)}
                            primaryColor={primaryColor}
                            colors={colors}
                            isDark={isDark}
                            delay={i * 25}
                          />
                        ))
                      )
                    )}

                    {/* Templates tab — NO badge chips, clean cards only */}
                    {pickerTab === 'templates' && (
                      filteredTemplates.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '500' }}>
                            {t('shareNoResults', language)}
                          </Text>
                        </View>
                      ) : (
                        filteredTemplates.map((tpl, i) => (
                          <PromoRow
                            key={tpl.id}
                            icon={getPromoIcon(tpl.iconKey, primaryColor)}
                            title={tpl.name}
                            subtitle={tpl.description}
                            onPress={() => handleSelectItem(tpl)}
                            primaryColor={primaryColor}
                            colors={colors}
                            isDark={isDark}
                            delay={i * 25}
                          />
                        ))
                      )
                    )}
                  </ScrollView>
                </View>
              )}

              {/* ══ STEP 2: SHARE EDITOR ══ */}
              {step === 'share' && (
                <>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 200 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Selected promo info */}
                    {selectedItem && (
                      <Animated.View entering={FadeInDown.delay(0).duration(220)}>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isDark ? colors.card : '#FFFFFF',
                          borderRadius: 14, padding: 14, marginBottom: 20,
                          borderWidth: 1, borderColor: isDark ? colors.border : '#E8ECF0',
                          shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 4, elevation: isDark ? 0 : 1,
                        }}>
                          <View style={{
                            width: 44, height: 44, borderRadius: 12,
                            backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            {isTemplate(selectedItem)
                              ? getPromoIcon(selectedItem.iconKey, primaryColor, 20)
                              : getDiscountIcon((selectedItem as MarketingPromotion).discountType, primaryColor, 20)}
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                              {selectedItem.name}
                            </Text>
                            {selectedItem.description?.trim() ? (
                              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 }} numberOfLines={2}>
                                {selectedItem.description}
                              </Text>
                            ) : null}
                          </View>
                          {isTemplate(selectedItem) && (
                            <View style={{
                              backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
                              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, marginLeft: 10, flexShrink: 0,
                            }}>
                              <Text style={{ color: primaryColor, fontSize: 10, fontWeight: '700' }}>Template</Text>
                            </View>
                          )}
                        </View>
                      </Animated.View>
                    )}

                    {/* ── SHARE FORMAT SECTION ── */}
                    <Animated.View entering={FadeInDown.delay(40).duration(220)}>
                      <View style={{ marginBottom: 12 }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                          {t('shareFormat', language)}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                          {t('shareFormatHelper', language)}
                        </Text>
                      </View>

                      {/* Skeleton while loading */}
                      {!settings.loaded && (
                        <View style={{ gap: 8, marginBottom: 16 }}>
                          <SkeletonBlock height={70} borderRadius={14} />
                          <SkeletonBlock height={70} borderRadius={14} />
                        </View>
                      )}

                      {/* Error */}
                      {settings.loaded && settings.error && (
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          padding: 14, borderRadius: 12, marginBottom: 14,
                          backgroundColor: isDark ? '#7F1D1D18' : '#FEF2F2',
                          borderWidth: 1, borderColor: isDark ? '#7F1D1D35' : '#FECACA',
                        }}>
                          <AlertCircle size={15} color="#EF4444" />
                          <Text style={{ color: '#EF4444', fontSize: 13, flex: 1 }}>{settings.error}</Text>
                          <Pressable
                            onPress={() => {
                              settingsCache.delete(businessId ?? '__none__');
                              setSettings({ bookingUrl: '', websiteUrl: '', logoUrl: '', loaded: false, error: null });
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <RefreshCw size={14} color="#EF4444" />
                          </Pressable>
                        </View>
                      )}

                      {/* Format cards */}
                      {settings.loaded && availableFormats.length > 0 && (
                        <View style={{ marginBottom: 8 }}>
                          {availableFormats.map(({ format, label, description, sublabel }) => (
                            <FormatCard
                              key={format}
                              format={format}
                              label={label}
                              description={description}
                              sublabel={sublabel}
                              isSelected={selectedFormat === format}
                              onPress={() => handleSelectFormat(format)}
                              primaryColor={primaryColor}
                              colors={colors}
                              isDark={isDark}
                            />
                          ))}
                        </View>
                      )}

                      {/* No links found */}
                      {settings.loaded && availableFormats.length === 0 && (
                        <View style={{ marginBottom: 14 }}>
                          <View style={{
                            backgroundColor: isDark ? '#78350F14' : '#FFFBEB',
                            borderRadius: 12, padding: 14, marginBottom: 14,
                            borderWidth: 1, borderColor: isDark ? '#92400E30' : '#FDE68A',
                            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                          }}>
                            <Globe size={14} color="#D97706" style={{ marginTop: 1 }} />
                            <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontSize: 13, flex: 1, lineHeight: 19 }}>
                              No links found. Enable Booking in Settings, or enter your website below.
                            </Text>
                          </View>
                          <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 12, marginBottom: 8 }}>
                            Your website link
                          </Text>
                          <TextInput
                            value={websiteInput}
                            onChangeText={setWebsiteInput}
                            placeholder="https://yourbusiness.com"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            style={{
                              backgroundColor: colors.inputBackground, borderRadius: 12,
                              paddingHorizontal: 14, paddingVertical: 13,
                              color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder,
                              fontSize: 14,
                            }}
                            placeholderTextColor={colors.inputPlaceholder}
                            cursorColor={primaryColor}
                            selectionColor={`${primaryColor}40`}
                          />
                        </View>
                      )}
                    </Animated.View>

                    {/* ── QR PREVIEW ── */}
                    {selectedFormat === 'qr' && settings.bookingUrl ? (
                      <Animated.View entering={FadeInDown.delay(60).duration(220)}>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                          <View style={{
                            padding: 18, backgroundColor: '#fff', borderRadius: 20,
                            borderWidth: 1, borderColor: isDark ? colors.border : '#E2E8F0',
                            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.08, shadowRadius: 12,
                          }}>
                            <QRCode
                              value={settings.bookingUrl}
                              size={148}
                              getRef={(ref) => { qrRef.current = ref; }}
                            />
                          </View>
                          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginTop: 12 }}>
                            {t('shareBookingPageQr', language)}
                          </Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 3, maxWidth: 260, textAlign: 'center' }} numberOfLines={1}>
                            {settings.bookingUrl}
                          </Text>
                        </View>
                      </Animated.View>
                    ) : null}

                    {/* ── CAPTION SECTION ── */}
                    {(canShare || websiteInput.trim()) && (
                      <Animated.View entering={FadeInDown.delay(80).duration(220)}>
                        <View style={{ marginBottom: 10 }}>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            marginBottom: 4,
                          }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                              <Sparkles size={14} color={primaryColor} />
                              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                                {t('shareCaption', language)}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
                            {t('shareCaptionHelper', language)}
                          </Text>
                        </View>

                        <View style={{
                          backgroundColor: isDark ? colors.inputBackground : '#FFFFFF',
                          borderRadius: 14, borderWidth: 1,
                          borderColor: isDark ? colors.inputBorder : '#E0E7EF',
                          overflow: 'hidden',
                          shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 4,
                          marginBottom: 20,
                        }}>
                          <TextInput
                            value={caption}
                            onChangeText={setCaption}
                            multiline
                            placeholder="Write or edit your message before sharing."
                            style={{
                              color: colors.inputText, fontSize: 14, lineHeight: 22,
                              paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
                              minHeight: 160, textAlignVertical: 'top',
                            } as TextStyle}
                            placeholderTextColor={colors.inputPlaceholder}
                            cursorColor={primaryColor}
                            selectionColor={`${primaryColor}40`}
                          />
                          <View style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 14, paddingVertical: 8,
                            borderTopWidth: 1, borderTopColor: isDark ? colors.border : '#EEF2F7',
                            backgroundColor: isDark ? colors.backgroundSecondary : '#F8FAFC',
                          }}>
                            <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                              {caption.length} characters
                            </Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 11 }}>Tap to edit</Text>
                          </View>
                        </View>
                      </Animated.View>
                    )}

                    {/* ── LIVE PREVIEW SECTION ── */}
                    {(canShare || websiteInput.trim()) && selectedItem && (
                      <Animated.View entering={FadeInDown.delay(100).duration(220)}>
                        {/* Section label */}
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10,
                        }}>
                          <Eye size={14} color={primaryColor} />
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
                            Live Preview
                          </Text>
                        </View>

                        {/* Mini share card */}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowPreview(true);
                          }}
                          style={({ pressed }) => ({
                            backgroundColor: isDark ? colors.card : '#FFFFFF',
                            borderRadius: 16,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : '#E8ECF0',
                            opacity: pressed ? 0.85 : 1,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: isDark ? 0 : 0.07,
                            shadowRadius: 8,
                            elevation: isDark ? 0 : 3,
                            marginBottom: 16,
                          })}
                        >
                          {/* Colored header strip */}
                          <View style={{
                            backgroundColor: primaryColor,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                          }}>
                            <View style={{
                              width: 32, height: 32, borderRadius: 16,
                              backgroundColor: 'rgba(255,255,255,0.2)',
                              alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {isTemplate(selectedItem)
                                ? getPromoIcon(selectedItem.iconKey, '#fff', 15)
                                : getDiscountIcon((selectedItem as MarketingPromotion).discountType, '#fff', 15)}
                            </View>
                            <Text style={{
                              color: '#fff', fontWeight: '700', fontSize: 14, flex: 1,
                            }} numberOfLines={1}>
                              {selectedItem.name}
                            </Text>
                          </View>

                          {/* Link preview row */}
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 14,
                            paddingVertical: 11,
                            gap: 8,
                          }}>
                            {selectedFormat === 'qr' ? (
                              <QrCode size={14} color={primaryColor} />
                            ) : selectedFormat === 'website' ? (
                              <Globe size={14} color={primaryColor} />
                            ) : (
                              <ExternalLink size={14} color={primaryColor} />
                            )}
                            <Text style={{
                              color: activeLink ? primaryColor : colors.textTertiary,
                              fontSize: 12, fontWeight: '500', flex: 1,
                            }} numberOfLines={1}>
                              {activeLink || (selectedFormat === 'qr' ? 'QR Code' : 'No link selected')}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Eye size={12} color={colors.textTertiary} />
                              <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500' }}>
                                Tap to expand
                              </Text>
                            </View>
                          </View>
                        </Pressable>

                        {/* Preview Social Media Post button — same style as Branding Live Preview */}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowPreview(true);
                          }}
                          style={({ pressed }) => ({
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            paddingVertical: 12,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                            borderRadius: 10,
                            opacity: pressed ? 0.7 : 1,
                            marginBottom: 24,
                          })}
                        >
                          <Eye size={18} color={primaryColor} />
                          <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: primaryColor }}>
                            Preview Social Media Post
                          </Text>
                          <ExternalLink size={14} color={primaryColor} style={{ marginLeft: 6 }} />
                        </Pressable>
                      </Animated.View>
                    )}

                    {/* ── ACTION BUTTONS ── */}
                    <View style={{ gap: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 18 }}>
                      {/* Publish (solid CTA) */}
                      <Pressable
                        onPress={handlePublish}
                        disabled={isSharing || !canShare}
                        style={({ pressed }) => ({
                          paddingVertical: 15,
                          borderRadius: 13,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 9,
                          backgroundColor: isSharing || !canShare
                            ? (isDark ? colors.backgroundTertiary : '#E2E8F0')
                            : buttonColor,
                          opacity: pressed ? 0.88 : 1,
                          shadowColor: buttonColor,
                          shadowOffset: { width: 0, height: canShare && !isSharing ? 4 : 0 },
                          shadowOpacity: canShare && !isSharing ? 0.22 : 0,
                          shadowRadius: 10,
                        })}
                      >
                        {isSharing ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Share2 size={17} color={canShare ? '#fff' : colors.textTertiary} />
                            <Text style={{
                              color: canShare ? '#fff' : colors.textTertiary,
                              fontWeight: '700',
                              fontSize: 15,
                              letterSpacing: 0.1,
                            }}>
                              Publish
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </ScrollView>
                </>
              )}
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* ══ PLATFORM PICKER MODAL ══ */}
      <PlatformPickerModal
        visible={showPlatformPicker}
        onClose={() => setShowPlatformPicker(false)}
        onSelectPlatform={handlePlatformSelected}
        primaryColor={primaryColor}
        colors={colors}
        isDark={isDark}
      />
    </>
  );
}
