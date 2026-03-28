import React, { useState, useMemo, useEffect } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Megaphone,
  Percent,
  Package,
  Zap,
  Users,
  Star,
  ChevronRight,
  Check,
  Trash2,
  Edit3,
  Calendar,
  Sparkles,
  Shield,
  Copy,
  Share2,
  TrendingUp,
  Lightbulb,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { LocalSuccessToast } from '@/components/LocalSuccessToast';
import { t, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { format, Locale } from 'date-fns';
import { WheelDatePicker } from '@/components/WheelDatePicker';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type OfferType = 'discount' | 'bundle' | 'flash_sale' | 'referral';

interface AdOffer {
  id: string;
  name: string;
  details: string;
  type: OfferType;
  discountValue: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt: Date;
}

interface AdBenefitTemplate {
  id: string;
  nameKey: 'adBenefitTplFlashTitle' | 'adBenefitTplBundleTitle' | 'adBenefitTplReferralTitle' | 'adBenefitTplSeasonalTitle' | 'adBenefitTplWelcomeTitle';
  descKey: 'adBenefitTplFlashDesc' | 'adBenefitTplBundleDesc' | 'adBenefitTplReferralDesc' | 'adBenefitTplSeasonalDesc' | 'adBenefitTplWelcomeDesc';
  badgeKey: 'adBenefitTemplateBadgeFlash' | 'adBenefitTemplateBadgeBundle' | 'adBenefitTemplateBadgeReferral' | 'adBenefitTemplateBadgeSeasonal' | 'adBenefitTemplateBadgeWelcome';
  type: OfferType;
  color: string;
  icon: 'zap' | 'package' | 'users' | 'star' | 'sparkles';
  defaultDiscount: string;
}

const AD_TEMPLATES: AdBenefitTemplate[] = [
  {
    id: 'tpl_flash',
    nameKey: 'adBenefitTplFlashTitle',
    descKey: 'adBenefitTplFlashDesc',
    badgeKey: 'adBenefitTemplateBadgeFlash',
    type: 'flash_sale',
    color: '#EF4444',
    icon: 'zap',
    defaultDiscount: '20%',
  },
  {
    id: 'tpl_bundle',
    nameKey: 'adBenefitTplBundleTitle',
    descKey: 'adBenefitTplBundleDesc',
    badgeKey: 'adBenefitTemplateBadgeBundle',
    type: 'bundle',
    color: '#8B5CF6',
    icon: 'package',
    defaultDiscount: '15%',
  },
  {
    id: 'tpl_referral',
    nameKey: 'adBenefitTplReferralTitle',
    descKey: 'adBenefitTplReferralDesc',
    badgeKey: 'adBenefitTemplateBadgeReferral',
    type: 'referral',
    color: '#10B981',
    icon: 'users',
    defaultDiscount: '$10',
  },
  {
    id: 'tpl_seasonal',
    nameKey: 'adBenefitTplSeasonalTitle',
    descKey: 'adBenefitTplSeasonalDesc',
    badgeKey: 'adBenefitTemplateBadgeSeasonal',
    type: 'discount',
    color: '#F59E0B',
    icon: 'star',
    defaultDiscount: '25%',
  },
  {
    id: 'tpl_welcome',
    nameKey: 'adBenefitTplWelcomeTitle',
    descKey: 'adBenefitTplWelcomeDesc',
    badgeKey: 'adBenefitTemplateBadgeWelcome',
    type: 'discount',
    color: '#0EA5E9',
    icon: 'sparkles',
    defaultDiscount: '10%',
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getOfferIcon(type: OfferType, color: string, size = 22) {
  switch (type) {
    case 'discount': return <Percent size={size} color={color} />;
    case 'bundle':   return <Package size={size} color={color} />;
    case 'flash_sale': return <Zap size={size} color={color} />;
    case 'referral': return <Users size={size} color={color} />;
    default:         return <Megaphone size={size} color={color} />;
  }
}

function getTemplateIconNode(icon: AdBenefitTemplate['icon'], color: string, size = 22) {
  switch (icon) {
    case 'zap':      return <Zap size={size} color={color} />;
    case 'package':  return <Package size={size} color={color} />;
    case 'users':    return <Users size={size} color={color} />;
    case 'star':     return <Star size={size} color={color} />;
    case 'sparkles': return <Sparkles size={size} color={color} />;
    default:         return <Megaphone size={size} color={color} />;
  }
}

function getOfferTypeColor(type: OfferType, primary: string): string {
  switch (type) {
    case 'discount':   return primary;
    case 'bundle':     return '#8B5CF6';
    case 'flash_sale': return '#EF4444';
    case 'referral':   return '#10B981';
    default:           return primary;
  }
}

// ─────────────────────────────────────────────
// Templates View
// ─────────────────────────────────────────────

function AdBenefitTemplatesView({
  language,
  onUseTemplate,
}: {
  language: Language;
  onUseTemplate: (tpl: AdBenefitTemplate) => void;
}) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Info Banner */}
      <Animated.View entering={FadeInDown.delay(0).duration(300)}>
        <View
          style={{
            backgroundColor: isDark ? `${primaryColor}20` : '#F0FDF9',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: isDark ? `${primaryColor}30` : '#D1FAE5',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Sparkles size={18} color={primaryColor} />
            <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
              {t('adBenefitInfoTitle', language)}
            </Text>
          </View>
          <Text style={{ color: isDark ? colors.textSecondary : '#047857', fontSize: 13, lineHeight: 19 }}>
            {t('adBenefitInfoBody', language)}
          </Text>
        </View>
      </Animated.View>

      {/* Evolution Note */}
      <Animated.View entering={FadeInDown.delay(50).duration(300)}>
        <View
          style={{
            backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
            borderRadius: 12,
            padding: 14,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            <Text style={{ fontWeight: '600', color: colors.text }}>AdBenefit. </Text>
            {t('adBenefitEvolutionNote', language)}
          </Text>
        </View>
      </Animated.View>

      {/* Section Header */}
      <Animated.View entering={FadeInDown.delay(80).duration(300)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Shield size={16} color={primaryColor} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
            {t('adBenefitTemplatesSection', language)}
          </Text>
          <View
            style={{
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 10,
              marginLeft: 8,
            }}
          >
            <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>
              {AD_TEMPLATES.length} {t('adBenefitTemplatesCount', language)}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Template Cards */}
      {AD_TEMPLATES.map((tpl, index) => (
        <Animated.View
          key={tpl.id}
          entering={FadeInDown.delay(100 + index * 50).duration(300)}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onUseTemplate(tpl);
            }}
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: `${tpl.color}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getTemplateIconNode(tpl.icon, tpl.color)}
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                    {t(tpl.nameKey, language)}
                  </Text>
                  <View
                    style={{
                      backgroundColor: isDark ? `${tpl.color}25` : `${tpl.color}15`,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: tpl.color, fontSize: 10, fontWeight: '700' }}>
                      {t(tpl.badgeKey, language)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 }}
                  numberOfLines={2}
                >
                  {t(tpl.descKey, language)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Copy size={12} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                    {t('adBenefitTemplateUse', language)}
                  </Text>
                  <View style={{ width: 1, height: 12, backgroundColor: colors.border, marginHorizontal: 8 }} />
                  <Text style={{ color: tpl.color, fontSize: 12, fontWeight: '600' }}>
                    {tpl.defaultDiscount}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </View>
          </Pressable>
        </Animated.View>
      ))}

      {/* Editability Note */}
      <Animated.View entering={FadeInDown.delay(400).duration(300)}>
        <View
          style={{
            backgroundColor: isDark ? `${primaryColor}10` : `${primaryColor}08`,
            borderRadius: 12,
            padding: 14,
            marginTop: 8,
            borderWidth: 1,
            borderColor: isDark ? `${primaryColor}20` : `${primaryColor}15`,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Edit3 size={13} color={primaryColor} />
            <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 12, marginLeft: 6 }}>
              {t('adBenefitEditabilityTitle', language)}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
            {t('adBenefitEditabilityBody', language)}
          </Text>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// Offer Card
// ─────────────────────────────────────────────

function OfferCard({
  offer,
  index,
  language,
  dateLocale,
  onPress,
}: {
  offer: AdOffer;
  index: number;
  language: Language;
  dateLocale: Locale | undefined;
  onPress: () => void;
}) {
  const { colors, isDark, primaryColor } = useTheme();
  const color = getOfferTypeColor(offer.type, primaryColor);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      layout={Layout.springify()}
    >
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: colors.card,
          borderRadius: 14,
          padding: 16,
          marginBottom: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: color,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: `${color}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {getOfferIcon(offer.type, color)}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={1}>
                {offer.name}
              </Text>
              {offer.isActive && (
                <View
                  style={{
                    backgroundColor: '#10B98115',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    marginLeft: 6,
                  }}
                >
                  <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>
                    {t('adBenefitActive', language)}
                  </Text>
                </View>
              )}
            </View>
            {offer.discountValue ? (
              <Text style={{ color, fontWeight: '600', fontSize: 13, marginTop: 2 }}>
                {offer.discountValue}
              </Text>
            ) : null}
            {offer.details ? (
              <Text
                style={{ color: colors.textTertiary, fontSize: 12, marginTop: 3 }}
                numberOfLines={1}
              >
                {offer.details}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={20} color={colors.textTertiary} />
        </View>

        {/* Date row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Calendar size={13} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 6 }}>
            {format(new Date(offer.startDate), 'PP', { locale: dateLocale })}
            {offer.endDate
              ? ` — ${format(new Date(offer.endDate), 'PP', { locale: dateLocale })}`
              : ''}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

interface AdBenefitScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function AdBenefitScreen({ visible, onClose }: AdBenefitScreenProps) {
  const language = useStore((s) => s.language) as Language;
  const { colors, isDark, primaryColor, buttonColor } = useTheme();

  // Tabs
  const [activeTab, setActiveTab] = useTabPersistence<'offers' | 'templates'>('ad_benefit', 'offers');

  // Local offers state (no backend needed — client-side only for now)
  const [offers, setOffers] = useState<AdOffer[]>([]);

  // Form modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<AdOffer | null>(null);

  // Form fields
  const [offerName, setOfferName] = useState('');
  const [offerDetails, setOfferDetails] = useState('');
  const [offerType, setOfferType] = useState<OfferType>('discount');
  const [discountValue, setDiscountValue] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Toast
  const [showToast, setShowToast] = useState(false);

  // Date locale
  const [dateLocale, setDateLocale] = useState<Locale | undefined>(undefined);
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  const activeOffers   = useMemo(() => offers.filter((o) => o.isActive), [offers]);
  const inactiveOffers = useMemo(() => offers.filter((o) => !o.isActive), [offers]);

  // ─── Form helpers ───────────────────────────
  const resetForm = () => {
    setOfferName('');
    setOfferDetails('');
    setOfferType('discount');
    setDiscountValue('');
    setStartDate(new Date());
    setEndDate(null);
    setHasEndDate(false);
    setEditingOffer(null);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const openCreate = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEdit = (offer: AdOffer) => {
    setEditingOffer(offer);
    setOfferName(offer.name);
    setOfferDetails(offer.details);
    setOfferType(offer.type);
    setDiscountValue(offer.discountValue);
    setStartDate(new Date(offer.startDate));
    setEndDate(offer.endDate ? new Date(offer.endDate) : null);
    setHasEndDate(!!offer.endDate);
    setShowFormModal(true);
  };

  const useTemplate = (tpl: AdBenefitTemplate) => {
    resetForm();
    setOfferName(t(tpl.nameKey, language));
    setOfferDetails(t(tpl.descKey, language));
    setOfferType(tpl.type);
    setDiscountValue(tpl.defaultDiscount);
    setActiveTab('offers');
    setShowFormModal(true);
  };

  const handleSave = () => {
    if (!offerName.trim()) {
      Alert.alert('', t('adBenefitOfferName', language));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (editingOffer) {
      setOffers((prev) =>
        prev.map((o) =>
          o.id === editingOffer.id
            ? {
                ...o,
                name: offerName.trim(),
                details: offerDetails.trim(),
                type: offerType,
                discountValue: discountValue.trim(),
                startDate,
                endDate: hasEndDate ? endDate || undefined : undefined,
              }
            : o
        )
      );
    } else {
      const newOffer: AdOffer = {
        id: generateId(),
        name: offerName.trim(),
        details: offerDetails.trim(),
        type: offerType,
        discountValue: discountValue.trim(),
        startDate,
        endDate: hasEndDate ? endDate || undefined : undefined,
        isActive: true,
        createdAt: new Date(),
      };
      setOffers((prev) => [newOffer, ...prev]);
    }

    setShowFormModal(false);
    resetForm();
    setTimeout(() => setShowToast(true), 150);
  };

  const toggleActive = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOffers((prev) =>
      prev.map((o) => (o.id === id ? { ...o, isActive: !o.isActive } : o))
    );
  };

  const deleteOffer = (id: string) => {
    Alert.alert(
      t('adBenefitDelete', language),
      t('adBenefitDeleteConfirm', language),
      [
        { text: t('adBenefitCancel', language), style: 'cancel' },
        {
          text: t('adBenefitDelete', language),
          style: 'destructive',
          onPress: () => {
            setOffers((prev) => prev.filter((o) => o.id !== id));
            setShowFormModal(false);
            resetForm();
          },
        },
      ]
    );
  };

  const handleShare = async (offer: AdOffer) => {
    try {
      await Share.share({
        message: `${offer.name}${offer.discountValue ? ` — ${offer.discountValue}` : ''}${offer.details ? `\n${offer.details}` : ''}`,
      });
    } catch {
      // ignore
    }
  };

  // ─── Offer type selector option ─────────────
  const OFFER_TYPES: { value: OfferType; labelKey: 'adBenefitTypeDiscount' | 'adBenefitTypeBundle' | 'adBenefitTypeFlashSale' | 'adBenefitTypeReferral'; icon: React.ReactNode }[] = [
    { value: 'discount',   labelKey: 'adBenefitTypeDiscount',  icon: <Percent size={20} color={offerType === 'discount'   ? primaryColor : colors.textSecondary} /> },
    { value: 'bundle',     labelKey: 'adBenefitTypeBundle',    icon: <Package size={20} color={offerType === 'bundle'     ? '#8B5CF6'    : colors.textSecondary} /> },
    { value: 'flash_sale', labelKey: 'adBenefitTypeFlashSale', icon: <Zap     size={20} color={offerType === 'flash_sale' ? '#EF4444'    : colors.textSecondary} /> },
    { value: 'referral',   labelKey: 'adBenefitTypeReferral',  icon: <Users   size={20} color={offerType === 'referral'   ? '#10B981'    : colors.textSecondary} /> },
  ];

  // ─────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>

        {/* ── Header ── */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 0,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Megaphone size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
              {t('adBenefit', language)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* ── Segmented Tabs ── */}
        <View
          style={{
            backgroundColor: colors.card,
            paddingHorizontal: 20,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 12,
              padding: 4,
            }}
          >
            {/* Offers Tab */}
            <Pressable
              onPress={() => setActiveTab('offers')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: activeTab === 'offers' ? (isDark ? colors.card : '#fff') : 'transparent',
                shadowColor: activeTab === 'offers' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === 'offers' ? 0.1 : 0,
                shadowRadius: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Megaphone size={16} color={activeTab === 'offers' ? primaryColor : colors.textTertiary} />
                <Text
                  style={{
                    marginLeft: 6,
                    fontWeight: '600',
                    fontSize: 14,
                    color: activeTab === 'offers' ? primaryColor : colors.textTertiary,
                  }}
                >
                  {t('adBenefitOffers', language)}
                </Text>
              </View>
            </Pressable>

            {/* Templates Tab */}
            <Pressable
              onPress={() => setActiveTab('templates')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: activeTab === 'templates' ? (isDark ? colors.card : '#fff') : 'transparent',
                shadowColor: activeTab === 'templates' ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === 'templates' ? 0.1 : 0,
                shadowRadius: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Sparkles size={16} color={activeTab === 'templates' ? primaryColor : colors.textTertiary} />
                <Text
                  style={{
                    marginLeft: 6,
                    fontWeight: '600',
                    fontSize: 14,
                    color: activeTab === 'templates' ? primaryColor : colors.textTertiary,
                  }}
                >
                  {t('adBenefitTemplates', language)}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Content ── */}
        {activeTab === 'templates' ? (
          <AdBenefitTemplatesView language={language} onUseTemplate={useTemplate} />
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Create Button */}
            <Pressable
              onPress={openCreate}
              style={{
                backgroundColor: buttonColor,
                borderRadius: 14,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Plus size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8, fontSize: 15 }}>
                {t('adBenefitCreateOffer', language)}
              </Text>
            </Pressable>

            {/* Pro Tip banner */}
            {offers.length === 0 && (
              <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                <View
                  style={{
                    backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}08`,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 24,
                    borderWidth: 1,
                    borderColor: isDark ? `${primaryColor}25` : `${primaryColor}15`,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <Lightbulb size={18} color={primaryColor} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 13, marginBottom: 3 }}>
                      {t('adBenefitTipTitle', language)}
                    </Text>
                    <Text style={{ color: isDark ? colors.textSecondary : colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
                      {t('adBenefitTipBody', language)}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Active Offers */}
            {activeOffers.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                  {t('adBenefitActiveOffers', language)}
                </Text>
                {activeOffers.map((offer, idx) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    index={idx}
                    language={language}
                    dateLocale={dateLocale}
                    onPress={() => openEdit(offer)}
                  />
                ))}
              </View>
            )}

            {/* Inactive Offers */}
            {inactiveOffers.length > 0 && (
              <View style={{ marginTop: activeOffers.length > 0 ? 8 : 0 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14, marginBottom: 12 }}>
                  {t('adBenefitInactiveOffers', language)}
                </Text>
                {inactiveOffers.map((offer, idx) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    index={idx}
                    language={language}
                    dateLocale={dateLocale}
                    onPress={() => openEdit(offer)}
                  />
                ))}
              </View>
            )}

            {/* Empty State */}
            {offers.length === 0 && (
              <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Megaphone size={38} color={primaryColor} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
                    {t('adBenefitNoOffers', language)}
                  </Text>
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: 13,
                      textAlign: 'center',
                      marginTop: 8,
                      paddingHorizontal: 32,
                      lineHeight: 19,
                    }}
                  >
                    {t('adBenefitNoOffersDescription', language)}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Boosted Reach Tip (shown when offers exist) */}
            {offers.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View
                  style={{
                    backgroundColor: isDark ? `${primaryColor}10` : `${primaryColor}08`,
                    borderRadius: 12,
                    padding: 14,
                    marginTop: 8,
                    borderWidth: 1,
                    borderColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <TrendingUp size={16} color={primaryColor} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 12, marginBottom: 2 }}>
                      {t('adBenefitBoostedReach', language)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
                      {t('adBenefitBoostedReachDescription', language)}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        )}

        <LocalSuccessToast
          visible={showToast}
          message={t('adBenefitSaved', language)}
          onHide={() => setShowToast(false)}
        />
      </SafeAreaView>

      {/* ── Create / Edit Modal ── */}
      <Modal
        visible={showFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowFormModal(false); resetForm(); }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Modal Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              backgroundColor: colors.card,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => { setShowFormModal(false); resetForm(); }}
              style={{ paddingVertical: 4 }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 15 }}>
                {t('adBenefitCancel', language)}
              </Text>
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: colors.text }}>
              {editingOffer ? t('adBenefitEditOffer', language) : t('adBenefitNewOffer', language)}
            </Text>
            <Pressable onPress={handleSave} style={{ paddingVertical: 4 }}>
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 15 }}>
                {t('adBenefitSave', language)}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Offer Name */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 13 }}>
                {t('adBenefitOfferName', language)}
              </Text>
              <TextInput
                value={offerName}
                onChangeText={setOfferName}
                placeholder={t('adBenefitOfferNamePlaceholder', language)}
                placeholderTextColor={colors.inputPlaceholder}
                style={{
                  backgroundColor: colors.inputBackground,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: colors.inputText,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  fontSize: 15,
                }}
                cursorColor={primaryColor}
                selectionColor={`${primaryColor}40`}
              />
            </View>

            {/* Details */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 13 }}>
                {t('adBenefitOfferDetails', language)}
              </Text>
              <TextInput
                value={offerDetails}
                onChangeText={setOfferDetails}
                placeholder={t('adBenefitOfferDetailsPlaceholder', language)}
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: colors.inputBackground,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: colors.inputText,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  minHeight: 90,
                  textAlignVertical: 'top',
                  fontSize: 15,
                }}
                cursorColor={primaryColor}
                selectionColor={`${primaryColor}40`}
              />
            </View>

            {/* Offer Type */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 10, fontSize: 13 }}>
                {t('adBenefitOfferType', language)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {OFFER_TYPES.map(({ value, labelKey, icon }) => {
                  const activeColor = value === 'bundle' ? '#8B5CF6'
                    : value === 'flash_sale' ? '#EF4444'
                    : value === 'referral' ? '#10B981'
                    : primaryColor;
                  const isSelected = offerType === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setOfferType(value)}
                      style={{
                        width: '47%',
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        alignItems: 'center',
                        backgroundColor: isSelected
                          ? (isDark ? `${activeColor}30` : `${activeColor}12`)
                          : colors.inputBackground,
                        borderColor: isSelected ? activeColor : colors.inputBorder,
                      }}
                    >
                      {icon}
                      <Text
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          fontWeight: '600',
                          color: isSelected ? activeColor : colors.textSecondary,
                          textAlign: 'center',
                        }}
                      >
                        {t(labelKey, language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Discount Value */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 13 }}>
                {t('adBenefitDiscountValue', language)}
              </Text>
              <TextInput
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={t('adBenefitDiscountValuePlaceholder', language)}
                placeholderTextColor={colors.inputPlaceholder}
                style={{
                  backgroundColor: colors.inputBackground,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: colors.inputText,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  fontSize: 15,
                }}
                cursorColor={primaryColor}
                selectionColor={`${primaryColor}40`}
              />
            </View>

            {/* Start Date */}
            <View style={{ marginBottom: 14 }}>
              <WheelDatePicker
                label={t('adBenefitStartDate', language)}
                value={startDate}
                onChange={setStartDate}
                isOpen={showStartPicker}
                onToggle={() => setShowStartPicker(!showStartPicker)}
              />
            </View>

            {/* End Date */}
            <View style={{ marginBottom: 20 }}>
              <Pressable
                onPress={() => setHasEndDate(!hasEndDate)}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    marginRight: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: hasEndDate ? primaryColor : 'transparent',
                    borderColor: hasEndDate ? primaryColor : colors.border,
                  }}
                >
                  {hasEndDate && <Check size={13} color="#fff" />}
                </View>
                <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 14 }}>
                  {t('adBenefitSetEndDate', language)}
                </Text>
              </Pressable>
              {hasEndDate && (
                <WheelDatePicker
                  label=""
                  value={endDate || new Date()}
                  onChange={setEndDate}
                  isOpen={showEndPicker}
                  onToggle={() => setShowEndPicker(!showEndPicker)}
                  minimumDate={startDate}
                />
              )}
            </View>

            {/* Edit-mode actions */}
            {editingOffer && (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 20,
                  marginTop: 4,
                }}
              >
                {/* Share */}
                <Pressable
                  onPress={() => handleShare(editingOffer)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Share2 size={20} color={primaryColor} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                      {t('adBenefitShareOffer', language)}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                      {t('adBenefitShareOfferDescription', language)}
                    </Text>
                  </View>
                </Pressable>

                {/* Toggle Active */}
                <Pressable
                  onPress={() => {
                    toggleActive(editingOffer.id);
                    setShowFormModal(false);
                    resetForm();
                  }}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {editingOffer.isActive ? (
                    <>
                      <X size={20} color="#F97316" />
                      <Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 12 }}>
                        {t('adBenefitDeactivate', language)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Check size={20} color="#22C55E" />
                      <Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 12 }}>
                        {t('adBenefitActivate', language)}
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Delete */}
                <Pressable
                  onPress={() => deleteOffer(editingOffer.id)}
                  style={{
                    backgroundColor: isDark ? '#7F1D1D20' : '#FEF2F2',
                    borderRadius: 12,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={20} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontWeight: '500', marginLeft: 12 }}>
                    {t('adBenefitDelete', language)}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}
