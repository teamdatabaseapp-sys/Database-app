import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X, Tag, Percent, Gift, Check, ChevronLeft,
  Calendar, Zap, Users, Package, Search,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language, MarketingPromotion } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { useClients } from '@/hooks/useClients';
import { useBusiness } from '@/hooks/useBusiness';
import { usePromotionAssignmentActions } from '@/hooks/usePromotionAssignments';
import { PROMO_TEMPLATES, getTemplateIcon } from '@/components/promo/promoTemplatesData';

// ============================================
// AssignWizard (3-step modal)
// Extracted from MarketingPromoScreen.tsx.
// All mutation and store assignment logic is self-contained here.
// ============================================

interface AssignWizardProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedClientIds?: string[];
}

export function AssignWizard({
  visible,
  onClose,
  onSuccess,
  preSelectedClientIds,
}: AssignWizardProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const user = useStore((s) => s.user);
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const assignClientToPromotion = useStore((s) => s.assignClientToPromotion);
  const currency = useStore((s) => s.currency);

  const { data: rawClients = [] } = useClients();

  const marketingPromotions = useMemo(() => {
    if (!user?.id) return [];
    const filtered = allMarketingPromotions.filter((p) => p.userId === user.id);
    return filtered.length > 0 ? filtered : allMarketingPromotions;
  }, [allMarketingPromotions, user?.id]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [promoSearch, setPromoSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(preSelectedClientIds ?? []);
  const [isAssigning, setIsAssigning] = useState(false);

  const clients = useMemo(() => {
    return rawClients
      .filter((c) => !(c as any).is_archived)
      .map((c) => ({ id: c.id, name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '' }));
  }, [rawClients]);

  const filteredPromos = useMemo(() => {
    const q = promoSearch.trim().toLowerCase();
    if (!q) return marketingPromotions;
    return marketingPromotions.filter((p) => p.name.toLowerCase().includes(q));
  }, [marketingPromotions, promoSearch]);

  const filteredTemplates = useMemo(() => {
    const q = promoSearch.trim().toLowerCase();
    if (!q) return PROMO_TEMPLATES;
    return PROMO_TEMPLATES.filter((t2) => t2.id.includes(q));
  }, [promoSearch]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const selectedPromo = useMemo(() =>
    marketingPromotions.find((p) => p.id === selectedPromoId) ?? null,
    [marketingPromotions, selectedPromoId]
  );

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setStep(preSelectedClientIds && preSelectedClientIds.length > 0 ? 1 : 1);
      setSelectedPromoId(null);
      setPromoSearch('');
      setClientSearch('');
      setSelectedClientIds(preSelectedClientIds ?? []);
    }
  }, [visible]);

  const handleSelectAll = () => {
    if (selectedClientIds.length === filteredClients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(filteredClients.map((c) => c.id));
    }
  };

  const { assign: assignToDb } = usePromotionAssignmentActions();
  const { businessId } = useBusiness();

  const handleConfirmAssign = async () => {
    if (!selectedPromoId || selectedClientIds.length === 0) return;
    setIsAssigning(true);
    try {
      // Persist each assignment to the DB (optimistic + server sync)
      await Promise.all(selectedClientIds.map((clientId) => assignToDb(clientId, selectedPromoId)));
      // Keep Zustand in sync for local reads
      for (const clientId of selectedClientIds) {
        assignClientToPromotion(clientId, selectedPromoId);
      }
      onSuccess();
      onClose();
    } catch {
      // Errors are already logged inside assignToDb
    } finally {
      setIsAssigning(false);
    }
  };

  const getPromoDescription = (promo: MarketingPromotion) => {
    if (promo.discountType === 'percentage') return `${promo.discountValue}${t('percentageOff', language)}`;
    if (promo.discountType === 'fixed') return `${formatCurrency(promo.discountValue, currency)} ${t('amountOff', language)}`;
    if (promo.discountType === 'free_service') return t('freeAfterServices', language).replace('{count}', String(promo.freeServiceAfter));
    return promo.otherDiscountDescription ?? '';
  };

  const stepTitle = step === 1 ? t('selectPromoStep', language) : step === 2 ? t('selectClients', language) : t('confirmAssignment', language);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {step > 1 && (
              <Pressable
                onPress={() => {
                  // When coming back from Step 3 with pre-selected clients, skip Step 2 and go back to Step 1
                  if (step === 3 && preSelectedClientIds && preSelectedClientIds.length > 0) {
                    setStep(1);
                  } else {
                    setStep((s) => (s - 1) as 1 | 2 | 3);
                  }
                }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
              >
                <ChevronLeft size={22} color={colors.textSecondary} />
              </Pressable>
            )}
            {step === 1 && (
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Tag size={16} color={primaryColor} />
              </View>
            )}
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{stepTitle}</Text>
          </View>
          <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Step 1: Select Promotion */}
        {step === 1 && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 16 }}>
              <Search size={15} color={colors.textTertiary} style={{ marginRight: 8 }} />
              <TextInput value={promoSearch} onChangeText={setPromoSearch} placeholder={t('searchClients', language)} placeholderTextColor={colors.inputPlaceholder} style={{ flex: 1, fontSize: 14, color: colors.inputText }} cursorColor={primaryColor} />
            </View>

            <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{t('yourPromotions', language)}</Text>
            {filteredPromos.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{t('noPromotionsToAssign', language)}</Text>
              </View>
            )}
            {filteredPromos.map((promo) => (
              <Pressable
                key={promo.id}
                onPress={() => setSelectedPromoId(promo.id === selectedPromoId ? null : promo.id)}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selectedPromoId === promo.id ? `${primaryColor}12` : colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: selectedPromoId === promo.id ? primaryColor : colors.border }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                  {promo.discountType === 'percentage' ? <Percent size={18} color={primaryColor} /> : promo.discountType === 'fixed' ? <Tag size={18} color={primaryColor} /> : promo.discountType === 'free_service' ? <Gift size={18} color={primaryColor} /> : promo.discountType === 'flash_sale' ? <Zap size={18} color={primaryColor} /> : promo.discountType === 'bundle' ? <Package size={18} color={primaryColor} /> : <Users size={18} color={primaryColor} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{promo.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{getPromoDescription(promo)}</Text>
                </View>
                {selectedPromoId === promo.id && <Check size={20} color={primaryColor} />}
              </Pressable>
            ))}

            {PROMO_TEMPLATES.length > 0 && (
              <>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 }}>{t('officialPromoTemplates', language)}</Text>
                {PROMO_TEMPLATES.map((tpl) => (
                  <Pressable
                    key={tpl.id}
                    onPress={() => setSelectedPromoId(tpl.id === selectedPromoId ? null : tpl.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selectedPromoId === tpl.id ? `${primaryColor}12` : colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: selectedPromoId === tpl.id ? primaryColor : colors.border }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                      {getTemplateIcon(tpl.icon, primaryColor, 18)}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{t(tpl.nameKey, language)}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t(tpl.badgeKey, language)}</Text>
                    </View>
                    {selectedPromoId === tpl.id && <Check size={20} color={primaryColor} />}
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        )}

        {/* Step 2: Select Clients */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBackground, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 12, paddingVertical: 11 }}>
                <Search size={15} color={colors.textTertiary} style={{ marginRight: 8 }} />
                <TextInput value={clientSearch} onChangeText={setClientSearch} placeholder={t('searchClientsPlaceholder', language)} placeholderTextColor={colors.inputPlaceholder} style={{ flex: 1, fontSize: 14, color: colors.inputText }} cursorColor={primaryColor} />
              </View>
              <Pressable onPress={handleSelectAll} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: `${primaryColor}12`, borderWidth: 1, borderColor: `${primaryColor}25` }}>
                <Check size={14} color={primaryColor} style={{ marginRight: 6 }} />
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 13 }}>
                  {selectedClientIds.length === filteredClients.length ? t('deselectAll', language) : t('selectAll', language)} ({filteredClients.length})
                </Text>
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
              {filteredClients.map((client, ci) => {
                const isSelected = selectedClientIds.includes(client.id);
                return (
                  <Pressable
                    key={client.id}
                    onPress={() => setSelectedClientIds((prev) => isSelected ? prev.filter((id) => id !== client.id) : [...prev, client.id])}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: ci < filteredClients.length - 1 ? 1 : 0, borderBottomColor: colors.border, backgroundColor: isSelected ? `${primaryColor}08` : 'transparent' }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? primaryColor : colors.border, backgroundColor: isSelected ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      {isSelected && <Check size={12} color="#fff" />}
                    </View>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 12 }}>
                        {(client.name.trim().split(' ').map((p) => p[0]).slice(0, 2).join('') || '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
                      {client.email ? <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>{client.email}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
            {/* Selected promo details */}
            {selectedPromo && (
              <Animated.View entering={FadeInDown.delay(0).duration(300)}>
                <View style={{ backgroundColor: `${primaryColor}10`, borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center' }}>
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    {selectedPromo.discountType === 'percentage' ? <Percent size={26} color={primaryColor} /> : selectedPromo.discountType === 'fixed' ? <Tag size={26} color={primaryColor} /> : selectedPromo.discountType === 'free_service' ? <Gift size={26} color={primaryColor} /> : <Zap size={26} color={primaryColor} />}
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, textAlign: 'center' }}>{selectedPromo.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 6 }}>{getPromoDescription(selectedPromo)}</Text>
                </View>

                {/* Expiry date only — TYPE section removed */}
                {selectedPromo.endDate && (
                  <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Calendar size={14} color={primaryColor} style={{ marginRight: 8 }} />
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('promoExpiresOn', language)}</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{format(new Date(selectedPromo.endDate), 'PP')}</Text>
                  </View>
                )}
              </Animated.View>
            )}

            {/* Selected clients summary */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Users size={14} color={primaryColor} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                    {t('promoClientCount', language).replace('{count}', String(selectedClientIds.length))}
                  </Text>
                </View>
                {clients.filter((c) => selectedClientIds.includes(c.id)).slice(0, 5).map((client) => (
                  <View key={client.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 10 }}>
                        {(client.name.trim().split(' ').map((p) => p[0]).slice(0, 2).join('') || '?').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={1}>{client.name}</Text>
                  </View>
                ))}
                {selectedClientIds.length > 5 && (
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>{t('promoMoreClients', language).replace('{count}', String(selectedClientIds.length - 5))}</Text>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        )}

        {/* Bottom nav — safe-area aware */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ padding: 16 }}>
          {step < 3 ? (
            <Pressable
              onPress={() => {
                // When clients are pre-selected from Unassigned, skip Step 2 and jump to Step 3
                if (step === 1 && preSelectedClientIds && preSelectedClientIds.length > 0) {
                  setStep(3);
                } else {
                  setStep((s) => (s + 1) as 1 | 2 | 3);
                }
              }}
              disabled={step === 1 ? !selectedPromoId : selectedClientIds.length === 0}
              style={{ paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: (step === 1 ? !!selectedPromoId : selectedClientIds.length > 0) ? buttonColor : (isDark ? colors.backgroundTertiary : '#E2E8F0') }}
            >
              <Text style={{ fontWeight: '600', fontSize: 15, color: (step === 1 ? !!selectedPromoId : selectedClientIds.length > 0) ? '#fff' : colors.textTertiary }}>{t('next', language)}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleConfirmAssign}
              disabled={isAssigning || !selectedPromoId || selectedClientIds.length === 0}
              style={{ paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: (!isAssigning && !!selectedPromoId && selectedClientIds.length > 0) ? buttonColor : (isDark ? colors.backgroundTertiary : '#E2E8F0') }}
            >
              {isAssigning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontWeight: '600', fontSize: 15, color: (!isAssigning && !!selectedPromoId && selectedClientIds.length > 0) ? '#fff' : colors.textTertiary }}>{t('promoAssignConfirm', language)}</Text>
              )}
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaView>
    </Modal>
  );
}
