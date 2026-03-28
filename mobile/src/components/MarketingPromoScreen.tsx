import React, { useState, useMemo, useEffect } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X, Plus, Tag, Percent, Gift, Check, Trash2, Edit3, ChevronRight,
  Sparkles, Zap, Users, Package,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { LocalSuccessToast } from '@/components/LocalSuccessToast';
import { t, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language, MarketingPromotion } from '@/lib/types';
import { format, Locale } from 'date-fns';
import { WheelDatePicker } from '@/components/WheelDatePicker';
import { getCurrencySymbol } from '@/lib/currency';
import { useEnsurePromotion, useUpdatePromotion, useSyncPromotions, useHydratePromotionsFromSupabase, promotionKeys } from '@/hooks/usePromotions';
import { deletePromotion, createPromotion } from '@/services/promotionsService';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/ToastContext';
import { useBusiness } from '@/hooks/useBusiness';
import { useAllMemberships } from '@/hooks/useMembership';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useServices } from '@/hooks/useServices';
import { useAnalyticsAppointments } from '@/hooks/useAppointments';
import { PROMO_TEMPLATES, PromoTemplate, getTemplateIcon } from '@/components/promo/promoTemplatesData';
import { PromoTemplatesView } from '@/components/promo/PromoTemplatesView';
import { AssignWizard } from '@/components/promo/AssignWizard';
import { AssignManageView } from '@/components/promo/AssignManageView';
import { SharePromotionModal } from '@/components/SharePromotionModal';

// ============================================
// Types
// ============================================

interface MarketingPromoScreenProps {
  visible: boolean;
  onClose: () => void;
  prefill?: {
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string;
    contextLabel?: string;
  };
}


// ============================================
// Main Screen Export
// ============================================

export function MarketingPromoScreen({ visible, onClose, prefill }: MarketingPromoScreenProps) {
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const userId = useStore((s) => s.user?.id);
  const businessName = useStore((s) => s.user?.businessName);
  const addMarketingPromotion = useStore((s) => s.addMarketingPromotion);
  const updateMarketingPromotion = useStore((s) => s.updateMarketingPromotion);
  const deleteMarketingPromotion = useStore((s) => s.deleteMarketingPromotion);
  const toggleMarketingPromotionActive = useStore((s) => s.toggleMarketingPromotionActive);
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const { showSuccess } = useToast();

  // Two new tabs: 'assign' | 'promos'
  const [activeTab, setActiveTab] = useTabPersistence<'assign' | 'promos'>('marketing_promo', 'assign');
  const [showAssignWizard, setShowAssignWizard] = useState(false);
  const [wizardPreSelectedIds, setWizardPreSelectedIds] = useState<string[] | undefined>(undefined);

  const ensurePromotionMutation = useEnsurePromotion();
  const updatePromotionMutation = useUpdatePromotion();
  const syncPromotionsMutation = useSyncPromotions();
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();

  useHydratePromotionsFromSupabase();

  // Analytics data for AI generation
  const aiAnalyticsEndDate = useMemo(() => new Date(), []);
  const aiAnalyticsStartDate = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d; }, []);
  const { data: aiAppointments = [] } = useAnalyticsAppointments(aiAnalyticsStartDate, aiAnalyticsEndDate);
  const { data: aiServices = [] } = useServices();
  const { data: aiMemberships = [] } = useAllMemberships();
  const { data: aiLoyalty = [] } = useAllClientLoyalty();
  const { data: aiGiftCards = [] } = useGiftCards();

  const currencySymbol = getCurrencySymbol(currency);

  const [dateLocale, setDateLocale] = useState<Locale | undefined>(undefined);
  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setDateLocale(cached);
    getDateFnsLocale(language).then(setDateLocale);
  }, [language]);

  const marketingPromotions = useMemo(() => {
    if (!userId) return [];
    const userPromos = allMarketingPromotions.filter((p) => p.userId === userId);
    // Client-side dedup safety net: deduplicate by id, keep first occurrence.
    // Defense-in-depth — guarantees the UI never renders the same id twice.
    const seen = new Set<string>();
    return userPromos.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [allMarketingPromotions, userId]);

  // NOTE: No auto-seed. Promotions are loaded exclusively from Supabase via useHydratePromotionsFromSupabase.
  // Auto-seeding caused duplicate "Pay 4 Get 5" entries because the store is not persisted —
  // every app restart would re-seed a new row into Supabase while hydration pulled all old ones back.

  useEffect(() => {
    if (visible && marketingPromotions.length > 0 && businessId) {
      syncPromotionsMutation.mutate(marketingPromotions);
    }
  }, [visible, businessId]);

  // When opened from Growth Opportunities with a prefill, auto-open the create modal
  useEffect(() => {
    if (visible && prefill) {
      resetForm();
      if (prefill.name) setName(prefill.name);
      if (prefill.discountType) setDiscountType(prefill.discountType);
      setShowCreateModal(true);
    } else if (!visible) {
      setShowCreateModal(false);
    }
  }, [visible, prefill]);

  // Create/Edit modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<MarketingPromotion | null>(null);
  const [showShareList, setShowShareList] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [freeServiceAfter, setFreeServiceAfter] = useState('');
  const [otherDiscountDescription, setOtherDiscountDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const generateWithAI = async () => {
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const backendUrl =
        process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        'http://localhost:3000';

      // Compute real analytics context from already-loaded data
      const serviceCountMap: Record<string, number> = {};
      for (const appt of aiAppointments) {
        const svc = (appt as { serviceName?: string }).serviceName;
        if (svc) serviceCountMap[svc] = (serviceCountMap[svc] ?? 0) + 1;
      }
      const topServiceNames = Object.entries(serviceCountMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([svcName]) => svcName);

      const analyticsContext = {
        ...(topServiceNames[0] ? { mostUsedServiceName: topServiceNames[0] } : {}),
        ...(topServiceNames.length > 0 ? { topServiceNames } : {}),
      };

      const businessContext = {
        serviceNames: aiServices.map((s: { name: string }) => s.name).filter(Boolean),
        loyaltyEnabled: aiLoyalty.length > 0,
        membershipEnabled: aiMemberships.length > 0,
        giftCardsEnabled: aiGiftCards.length > 0,
      };

      const res = await fetch(`${backendUrl}/api/ai-content/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'promo',
          language: language || 'en',
          variationSeed: Math.floor(Math.random() * 10000),
          businessName: businessName || undefined,
          discountType,
          contextLabel: prefill?.contextLabel || undefined,
          analyticsContext,
          businessContext,
        }),
      });
      const data = await res.json() as { success: boolean; result?: { name?: string; description?: string; caption?: string }; error?: string };
      if (!data.success || !data.result) {
        setAiError(data.error || 'Generation failed');
        return;
      }
      if (data.result.name) setName(data.result.name);
      if (data.result.description) setDescription(data.result.description);
    } catch {
      setAiError('Could not reach AI service');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (discountType !== 'free_service' && discountType !== 'other' && discountType !== 'bundle' && discountType !== 'flash_sale' && discountType !== 'referral' && !discountValue) return false;
    if (discountType === 'free_service' && !freeServiceAfter) return false;
    if ((discountType === 'other' || discountType === 'bundle' || discountType === 'flash_sale' || discountType === 'referral') && !otherDiscountDescription.trim()) return false;
    return true;
  }, [name, discountType, discountValue, freeServiceAfter, otherDiscountDescription]);

  const resetForm = () => {
    setName(''); setDescription(''); setDiscountType('percentage');
    setDiscountValue(''); setFreeServiceAfter(''); setOtherDiscountDescription('');
    setStartDate(new Date()); setEndDate(null); setHasEndDate(false); setEditingPromo(null);
  };

  const openCreateModal = () => { resetForm(); setShowCreateModal(true); };

  const openEditModal = (promo: MarketingPromotion) => {
    resetForm();
    setEditingPromo(promo);
    setName(promo.name);
    setDescription(promo.description ?? '');
    setDiscountType(promo.discountType);
    setDiscountValue(promo.discountValue > 0 ? promo.discountValue.toString() : '');
    setFreeServiceAfter(promo.freeServiceAfter ? promo.freeServiceAfter.toString() : '');
    setOtherDiscountDescription(promo.otherDiscountDescription ?? '');
    setStartDate(promo.startDate ? new Date(promo.startDate) : new Date());
    if (promo.endDate) { setHasEndDate(true); setEndDate(new Date(promo.endDate)); }
    setShowCreateModal(true);
  };

  const handleUseTemplate = (template: PromoTemplate) => {
    resetForm();
    setName(t(template.nameKey, language));
    setDescription(t(template.descKey, language));
    setDiscountType(template.discountType);
    setDiscountValue(template.discountValue > 0 ? template.discountValue.toString() : '');
    setFreeServiceAfter(template.freeServiceAfter ? template.freeServiceAfter.toString() : '');
    setOtherDiscountDescription(template.otherDescKey ? t(template.otherDescKey, language) : '');
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', t('promoErrorName', language)); return; }
    if (discountType !== 'free_service' && discountType !== 'other' && discountType !== 'bundle' && discountType !== 'flash_sale' && discountType !== 'referral' && !discountValue) { Alert.alert('Error', t('promoErrorDiscount', language)); return; }
    if (discountType === 'free_service' && !freeServiceAfter) { Alert.alert('Error', t('promoErrorServices', language)); return; }
    if ((discountType === 'other' || discountType === 'bundle' || discountType === 'flash_sale' || discountType === 'referral') && !otherDiscountDescription.trim()) { Alert.alert('Error', t('promoErrorDescription', language)); return; }

    setIsSaving(true);
    const promoData = {
      name: name.trim(), description: description.trim(), discountType,
      discountValue: discountType === 'free_service' ? 100 : (discountType === 'other' || discountType === 'bundle' || discountType === 'flash_sale' || discountType === 'referral') ? 0 : parseFloat(discountValue) || 0,
      freeServiceAfter: discountType === 'free_service' ? parseInt(freeServiceAfter) || 0 : undefined,
      otherDiscountDescription: (discountType === 'other' || discountType === 'bundle' || discountType === 'flash_sale' || discountType === 'referral') ? otherDiscountDescription.trim() : undefined,
      startDate, endDate: hasEndDate ? endDate || undefined : undefined,
      isActive: editingPromo?.isActive ?? true, color: primaryColor,
    };

    try {
      if (editingPromo) {
        // EDIT: always use UPDATE — never insert for existing promotions
        const updatedPromo: MarketingPromotion = { ...editingPromo, ...promoData };
        await updatePromotionMutation.mutateAsync(updatedPromo);
        updateMarketingPromotion(editingPromo.id, promoData);
      } else {
        // CREATE: use insert path only for brand new promotions
        addMarketingPromotion(promoData);
        const allPromos = useStore.getState().marketingPromotions;
        const newPromo = allPromos.find((p) => p.name === promoData.name && p.userId === userId);
        if (!newPromo) throw new Error('Promotion was not saved to local store');
        if (!businessId) throw new Error('No business ID available');
        const result = await createPromotion(businessId, newPromo);
        if (result.error) {
          const code = (result.error as { code?: string }).code;
          if (code === '23505') throw new Error('A promotion with this title already exists.');
          throw new Error(result.error.message || 'Failed to create promotion');
        }
      }
      // Re-fetch authoritative list from Supabase (replaces store — no append)
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: promotionKeys.list(businessId) });
      }
      setShowCreateModal(false);
      resetForm();
      if (prefill) {
        onClose();
      } else {
        setTimeout(() => setShowSuccessToast(true), 100);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err) || 'Unknown error';
      Alert.alert(t('promoSaveFailed', language), msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (promo: MarketingPromotion) => {
    Alert.alert(
      t('deletePromotion', language),
      `${t('deleteConfirmMessage', language)} "${promo.name}"?`,
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            // 1. Remove from local Zustand store immediately (optimistic)
            deleteMarketingPromotion(promo.id);
            // 2. Delete from Supabase so it doesn't come back on next hydration
            await deletePromotion(promo.id);
            // 3. Invalidate the promotions query so hydration re-fetches the clean list
            if (businessId) {
              queryClient.invalidateQueries({ queryKey: promotionKeys.list(businessId) });
            }
          },
        },
      ]
    );
  };

  const isDirectCreate = !!visible && !!prefill;

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
    if (isDirectCreate) onClose();
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {!isDirectCreate && (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 0, borderBottomColor: colors.border }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Tag size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('marketingPromo', language)}</Text>
          </View>
          <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Tabs */}
        <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 14, padding: 4 }}>
            <Pressable
              onPress={() => setActiveTab('assign')}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'assign' ? (isDark ? colors.card : '#fff') : 'transparent', shadowColor: activeTab === 'assign' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: activeTab === 'assign' ? 0.08 : 0, shadowRadius: activeTab === 'assign' ? 4 : 0, elevation: activeTab === 'assign' ? 2 : 0 }}
            >
              <Text style={{ fontWeight: '500', fontSize: 11, color: activeTab === 'assign' ? primaryColor : colors.textSecondary, lineHeight: 15, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('promoTabAssignLine1', language)}</Text>
              {t('promoTabAssignLine2', language) ? <Text style={{ fontWeight: '500', fontSize: 11, color: activeTab === 'assign' ? primaryColor : colors.textSecondary, lineHeight: 15, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('promoTabAssignLine2', language)}</Text> : null}
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('promos')}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: activeTab === 'promos' ? (isDark ? colors.card : '#fff') : 'transparent', shadowColor: activeTab === 'promos' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: activeTab === 'promos' ? 0.08 : 0, shadowRadius: activeTab === 'promos' ? 4 : 0, elevation: activeTab === 'promos' ? 2 : 0 }}
            >
              <Text style={{ fontWeight: '500', fontSize: 11, color: activeTab === 'promos' ? primaryColor : colors.textSecondary, lineHeight: 15, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('promoTabPromosLine1', language)}</Text>
              {t('promoTabPromosLine2', language) ? <Text style={{ fontWeight: '500', fontSize: 11, color: activeTab === 'promos' ? primaryColor : colors.textSecondary, lineHeight: 15, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('promoTabPromosLine2', language)}</Text> : null}
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {activeTab === 'assign' ? (
          <AssignManageView
            onOpenAssignWizard={(preSelectedIds) => {
              setWizardPreSelectedIds(preSelectedIds);
              setShowAssignWizard(true);
            }}
          />
        ) : (
          <PromoTemplatesView onUseTemplate={handleUseTemplate} onCreateNew={openCreateModal} onEditPromo={openEditModal} onShareList={() => setShowShareList(true)} />
        )}

        <LocalSuccessToast visible={showSuccessToast} message={t('successSaved', language)} onHide={() => setShowSuccessToast(false)} />
      </SafeAreaView>
      )}

      {/* Assign Wizard */}
      {!isDirectCreate && (
      <AssignWizard
        visible={showAssignWizard}
        onClose={() => setShowAssignWizard(false)}
        onSuccess={() => { setShowSuccessToast(true); }}
        preSelectedClientIds={wizardPreSelectedIds}
      />
      )}

      {/* Share Promotion Modal — list-level (picker starts at Step 1) */}
      {!isDirectCreate && (
      <SharePromotionModal
        visible={showShareList}
        onClose={() => setShowShareList(false)}
      />
      )}

      {/* Create/Edit Modal — inside outer Modal to allow stacking on iOS */}
      <Modal visible={showCreateModal || isDirectCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseCreateModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Tag size={18} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{editingPromo ? t('editPromotion', language) : t('newPromotion', language)}</Text>
            </View>
            <Pressable onPress={handleCloseCreateModal} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            {/* Analytics Suggestion Banner */}
            {prefill?.contextLabel && !editingPromo && (
              <Animated.View entering={FadeInDown.delay(0).duration(300)} style={{ marginBottom: 16 }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? `${primaryColor}18` : `${primaryColor}0E`,
                  borderWidth: 1,
                  borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`,
                  borderRadius: 12,
                  padding: 12,
                }}>
                  <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: isDark ? `${primaryColor}35` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Zap size={14} color={primaryColor} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text, lineHeight: 18 }}>
                    {prefill.contextLabel}
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Name */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>{t('promotionName', language)}</Text>
                {/* Generate with AI button */}
                <Pressable
                  onPress={generateWithAI}
                  disabled={isGeneratingAI}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                    backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
                    borderWidth: 1,
                    borderColor: isDark ? `${primaryColor}50` : `${primaryColor}30`,
                    opacity: isGeneratingAI ? 0.6 : 1,
                  }}
                >
                  <Sparkles size={13} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 12, marginLeft: 5 }}>
                    {isGeneratingAI ? 'Generating...' : 'Generate with AI'}
                  </Text>
                </Pressable>
              </View>
              {aiError && (
                <View style={{ backgroundColor: isDark ? '#EF444420' : '#FEF2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{aiError}</Text>
                </View>
              )}
              <TextInput value={name} onChangeText={setName} placeholder={t('promotionNamePlaceholder', language)} style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder }} placeholderTextColor={colors.inputPlaceholder} cursorColor={primaryColor} selectionColor={`${primaryColor}40`} />
            </View>

            {/* Description */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('description', language)}</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder={t('descriptionPlaceholder', language)} multiline numberOfLines={3} style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder, minHeight: 80, textAlignVertical: 'top' }} placeholderTextColor={colors.inputPlaceholder} cursorColor={primaryColor} selectionColor={`${primaryColor}40`} />
            </View>

            {/* Discount Type */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('discountType', language)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
                {([
                  { value: 'percentage', label: t('percentage', language), icon: <Percent size={20} color={discountType === 'percentage' ? primaryColor : colors.textSecondary} /> },
                  { value: 'fixed', label: t('fixed', language), icon: <Text style={{ fontSize: 20, fontWeight: 'bold', color: discountType === 'fixed' ? primaryColor : colors.textSecondary }}>{currencySymbol}</Text> },
                  { value: 'free_service', label: t('counter', language), icon: <Gift size={20} color={discountType === 'free_service' ? primaryColor : colors.textSecondary} /> },
                  { value: 'flash_sale', label: t('adBenefitTypeFlashSale', language), icon: <Zap size={20} color={discountType === 'flash_sale' ? primaryColor : colors.textSecondary} /> },
                  { value: 'bundle', label: t('adBenefitTypeBundle', language), icon: <Package size={20} color={discountType === 'bundle' ? primaryColor : colors.textSecondary} /> },
                  { value: 'referral', label: t('adBenefitTypeReferral', language), icon: <Users size={20} color={discountType === 'referral' ? primaryColor : colors.textSecondary} /> },
                ] as { value: typeof discountType; label: string; icon: React.ReactNode }[]).map(({ value, label, icon }) => (
                  <Pressable key={value} onPress={() => setDiscountType(value)} style={{ width: '48%', marginHorizontal: '1%', marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', backgroundColor: discountType === value ? (isDark ? `${primaryColor}30` : `${primaryColor}15`) : colors.inputBackground, borderColor: discountType === value ? primaryColor : colors.inputBorder }}>
                    {icon}
                    <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '500', color: discountType === value ? primaryColor : colors.textSecondary, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setDiscountType('other')} style={{ width: '98%', marginHorizontal: '1%', marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: discountType === 'other' ? (isDark ? `${primaryColor}30` : `${primaryColor}15`) : colors.inputBackground, borderColor: discountType === 'other' ? primaryColor : colors.inputBorder }}>
                  <Edit3 size={20} color={discountType === 'other' ? primaryColor : colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '500', color: discountType === 'other' ? primaryColor : colors.textSecondary }}>{t('other', language)}</Text>
                </Pressable>
              </View>
            </View>

            {/* Discount Value / Counter / Description */}
            {(discountType === 'other' || discountType === 'bundle' || discountType === 'flash_sale' || discountType === 'referral') ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('discountDescription', language)}</Text>
                <TextInput value={otherDiscountDescription} onChangeText={setOtherDiscountDescription} placeholder={t('discountDescriptionPlaceholder', language)} style={{ backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder }} placeholderTextColor={colors.inputPlaceholder} cursorColor={primaryColor} selectionColor={`${primaryColor}40`} />
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>{t('discountDescriptionHint', language)}</Text>
              </View>
            ) : discountType === 'free_service' ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{t('freeServiceAfter', language)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput value={freeServiceAfter} onChangeText={setFreeServiceAfter} placeholder="5" keyboardType="number-pad" style={{ flex: 1, backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder }} placeholderTextColor={colors.inputPlaceholder} cursorColor={primaryColor} selectionColor={`${primaryColor}40`} />
                  <Text style={{ color: colors.textSecondary, marginLeft: 12 }}>{t('servicesLabel', language)}</Text>
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>{t('freeServiceHint', language)}</Text>
              </View>
            ) : (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '500', marginBottom: 8 }}>{discountType === 'percentage' ? t('discountPercentageLabel', language) : t('discountAmountLabel', language)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {discountType === 'fixed' && <Text style={{ color: colors.textSecondary, marginRight: 8, fontSize: 18 }}>{currencySymbol}</Text>}
                  <TextInput value={discountValue} onChangeText={setDiscountValue} placeholder={discountType === 'percentage' ? '10' : '5'} keyboardType="decimal-pad" style={{ flex: 1, backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder }} placeholderTextColor={colors.inputPlaceholder} cursorColor={primaryColor} selectionColor={`${primaryColor}40`} />
                  {discountType === 'percentage' && <Text style={{ color: colors.textSecondary, marginLeft: 12, fontSize: 18 }}>%</Text>}
                </View>
              </View>
            )}

            {/* Start Date */}
            <View style={{ marginBottom: 16 }}>
              <WheelDatePicker label={t('startDate', language)} value={startDate} onChange={setStartDate} isOpen={showStartPicker} onToggle={() => setShowStartPicker(!showStartPicker)} />
            </View>

            {/* End Date */}
            <View style={{ marginBottom: 16 }}>
              <Pressable onPress={() => setHasEndDate(!hasEndDate)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: hasEndDate ? primaryColor : 'transparent', borderColor: hasEndDate ? primaryColor : colors.border }}>
                  {hasEndDate && <Check size={14} color="#fff" />}
                </View>
                <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>{t('setEndDate', language)}</Text>
              </Pressable>
              {hasEndDate && (
                <WheelDatePicker label="" value={endDate || new Date()} onChange={setEndDate} isOpen={showEndPicker} onToggle={() => setShowEndPicker(!showEndPicker)} minimumDate={startDate} />
              )}
            </View>

            {/* Toggle Active / Delete (edit mode) */}
            {editingPromo && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginTop: 16 }}>
                <Pressable onPress={() => { toggleMarketingPromotionActive(editingPromo.id); setShowCreateModal(false); resetForm(); }} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                  {editingPromo.isActive ? <><X size={20} color="#F97316" /><Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 12 }}>{t('deactivatePromotion', language)}</Text></> : <><Check size={20} color="#22C55E" /><Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 12 }}>{t('activatePromotion', language)}</Text></>}
                </Pressable>
                <Pressable onPress={() => { handleDelete(editingPromo); setShowCreateModal(false); resetForm(); }} style={{ backgroundColor: isDark ? '#7F1D1D30' : '#FEF2F2', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <Trash2 size={20} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontWeight: '500', marginLeft: 12 }}>{t('deletePromotion', language)}</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Save Button */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable onPress={handleSave} disabled={!canSave || isSaving} style={{ paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: (canSave && !isSaving) ? buttonColor : (isDark ? colors.backgroundTertiary : '#E2E8F0') }}>
              <Text style={{ fontWeight: '600', fontSize: 16, color: (canSave && !isSaving) ? '#fff' : colors.textTertiary }}>
                {isSaving ? t('saving', language) : t('save', language)}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </Modal>
    </>
  );
}

