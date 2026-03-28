import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Gift,
  Scissors,
  DollarSign,
  Search,
  Lock,
  Check,
  User,
  UserPlus,
  AlertCircle,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language, GiftCardType, GiftCardService } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { useCreateGiftCard } from '@/hooks/useGiftCards';
import { useClients, useCreateClient } from '@/hooks/useClients';
import { useServices } from '@/hooks/useServices';
import { useStores } from '@/hooks/useStores';
import { useBusiness } from '@/hooks/useBusiness';
import { formatCurrency } from '@/lib/currency';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/phone-utils';
import { ClientSearchItem, getClientInitials, sortClientsAlphabetically } from '../ClientSearchItem';
import { LocalSuccessToast } from '../LocalSuccessToast';
import { getGiftCardRuleForCountry, getGiftCardComplianceRegion } from '@/lib/giftCardCompliance';
import { GiftCardPreview } from './GiftCardPreview';
import { ColorPickerGrid } from './ColorPickerGrid';

// ============================================
// Create Gift Card Modal
// ============================================

export interface CreateGiftCardModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateGiftCardModal({ visible, onClose, onSuccess }: CreateGiftCardModalProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { data: services = [] } = useServices();
  const createGiftCard = useCreateGiftCard();
  const { data: supabaseClients = [] } = useClients();
  const { business } = useBusiness();
  const businessCountry = business?.business_country ?? null;
  const complianceRule = getGiftCardRuleForCountry(businessCountry);
  const complianceRegion = getGiftCardComplianceRegion(businessCountry);
  const createClientMutation = useCreateClient();
  const { data: stores = [] } = useStores();
  const activeStores = stores.filter(s => !s.is_archived);

  const [type, setType] = useState<GiftCardType>('value');
  const [value, setValue] = useState('');
  const [selectedServices, setSelectedServices] = useState<GiftCardService[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  // Holds name/email of a freshly-created inline client before useClients() refreshes
  const [pendingClientName, setPendingClientName] = useState<string | null>(null);
  const [pendingClientEmail, setPendingClientEmail] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [personalMessage, setPersonalMessage] = useState('');
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationMonths, setExpirationMonths] = useState('12');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedGiftCardColor, setSelectedGiftCardColor] = useState<string | null>(null);

  // Inline new client form state
  const [ncName, setNcName] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [ncNotes, setNcNotes] = useState('');
  const [ncErrors, setNcErrors] = useState<Record<string, string>>({});

  const presetAmounts = [25, 50, 100, 150, 200];

  // Derive client list for search
  const clients = useMemo(() => sortClientsAlphabetically(
    supabaseClients.map(sc => ({
      id: sc.id,
      userId: sc.business_id,
      name: sc.name,
      email: sc.email || '',
      phone: sc.phone || '',
      notes: sc.notes || '',
      visits: [],
      promotionCount: 0,
      tags: [],
      isArchived: false,
      createdAt: new Date(sc.created_at),
      updatedAt: new Date(sc.created_at),
    }))
  ), [supabaseClients]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const q = clientSearchQuery.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.includes(q) ?? false)
    );
  }, [clients, clientSearchQuery]);

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const expiresAt = useMemo(() => {
    // Canada: no expiry ever
    if (complianceRule.noExpiryOnly) return undefined;
    if (!hasExpiration) return undefined;
    const months = parseInt(expirationMonths) || 12;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date;
  }, [hasExpiration, expirationMonths, complianceRule]);

  const resetNewClientForm = useCallback(() => {
    setNcName('');
    setNcEmail('');
    setNcPhone('');
    setNcNotes('');
    setNcErrors({});
  }, []);

  const handleNewClientSave = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (!ncName.trim()) errs.name = t('required', language);
    if (ncEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ncEmail)) errs.email = t('invalidEmail', language);
    if (ncPhone.trim() && !validatePhoneNumber(ncPhone)) errs.phone = t('invalidPhone', language);
    setNcErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const newClient = await createClientMutation.mutateAsync({
        name: ncName.trim(),
        email: ncEmail.trim() || null,
        phone: ncPhone.trim() || null,
        notes: ncNotes.trim() || null,
      });
      if (newClient?.id) {
        setSelectedClientId(newClient.id);
        // Cache name/email so handleSubmit can send the email even before
        // useClients() re-fetches and populates selectedClient
        setPendingClientName(ncName.trim() || null);
        setPendingClientEmail(ncEmail.trim() || null);
      }
      resetNewClientForm();
      setShowNewClientModal(false);
    } catch (err: unknown) {
      const code = (err as any)?.code as string | undefined;
      if (code === 'CLIENT_EMAIL_DUPLICATE') {
        setNcErrors({ email: t('duplicateEmail', language) });
      } else if (code === 'CLIENT_PHONE_DUPLICATE') {
        setNcErrors({ phone: t('duplicatePhone', language) });
      } else {
        setNcErrors({ general: t('failedToSaveClient', language) });
      }
    }
  }, [ncName, ncEmail, ncPhone, ncNotes, language, createClientMutation, resetNewClientForm]);

  const handleServiceToggle = (serviceId: string, serviceName: string) => {
    const existing = selectedServices.find(s => s.serviceId === serviceId);
    if (existing) {
      setSelectedServices(selectedServices.filter(s => s.serviceId !== serviceId));
    } else {
      setSelectedServices([...selectedServices, { serviceId, serviceName, quantity: 1, usedQuantity: 0 }]);
    }
  };

  const handleServiceQuantityChange = (serviceId: string, quantity: number) => {
    setSelectedServices(selectedServices.map(s =>
      s.serviceId === serviceId ? { ...s, quantity: Math.max(1, quantity) } : s
    ));
  };

  const isFormValid = selectedClientId !== null &&
    selectedStoreId !== null &&
    (type === 'value' ? !!value && parseFloat(value) > 0 : selectedServices.length > 0);

  const handleSubmit = async () => {
    if (isSubmitting || !isFormValid) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Prefer live selectedClient lookup; fall back to pending values for
      // newly-created inline clients whose data hasn't re-fetched yet
      const resolvedName  = selectedClient?.name  || pendingClientName  || undefined;
      const resolvedEmail = (selectedClient?.email || pendingClientEmail) || undefined;

      await createGiftCard.mutateAsync({
        type,
        originalValue: type === 'value' ? parseFloat(value) : undefined,
        currency: type === 'value' ? currency : undefined,
        services: type === 'service' ? selectedServices : undefined,
        clientId: selectedClientId || undefined,
        recipientName: resolvedName,
        recipientEmail: resolvedEmail,
        personalMessage: personalMessage || undefined,
        expiresAt,
        designColor: selectedGiftCardColor || undefined,
        storeId: selectedStoreId || undefined,
      });

      // Email is sent server-side by the backend endpoint

      // Show success toast once, then close after it fades
      setShowSuccessToast(true);
      // Auto-close the modal after the toast duration
      setTimeout(() => {
        setShowSuccessToast(false);
        onClose();
        onSuccess();
        // Reset form
        setType('value');
        setValue('');
        setSelectedServices([]);
        setSelectedClientId(null);
        setSelectedStoreId(null);
        setPendingClientName(null);
        setPendingClientEmail(null);
        setClientSearchQuery('');
        setPersonalMessage('');
        setHasExpiration(false);
        setSelectedGiftCardColor(null);
      }, 1400);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Failed to create gift card:', msg);
      setSubmitError(msg || t('error', language));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View className="flex-row items-center">
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Gift size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('createGiftCard', language)}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Gift Card Type Selector */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
              {t('giftCardType', language)}
            </Text>
            <View className="flex-row mb-6" style={{ gap: 12 }}>
              <Pressable
                onPress={() => setType('value')}
                style={{
                  flex: 1,
                  backgroundColor: type === 'value' ? `${primaryColor}15` : colors.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: type === 'value' ? primaryColor : colors.border,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: type === 'value' ? `${primaryColor}20` : (isDark ? colors.backgroundTertiary : '#F1F5F9'), alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <DollarSign size={22} color={type === 'value' ? primaryColor : colors.textSecondary} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{t('valueBased', language)}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>{t('valueBasedDescription', language)}</Text>
              </Pressable>
              <Pressable
                onPress={() => setType('service')}
                style={{
                  flex: 1,
                  backgroundColor: type === 'service' ? `${primaryColor}15` : colors.card,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: type === 'service' ? primaryColor : colors.border,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: type === 'service' ? `${primaryColor}20` : (isDark ? colors.backgroundTertiary : '#F1F5F9'), alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Scissors size={22} color={type === 'service' ? primaryColor : colors.textSecondary} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{t('serviceBased', language)}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>{t('serviceBasedDescription', language)}</Text>
              </Pressable>
            </View>

            {/* Value Input or Service Selection */}
            {type === 'value' ? (
              <View className="mb-6">
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
                  {t('giftCardValue', language)}
                </Text>
                {/* Preset Amounts */}
                <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                  {presetAmounts.map((amount) => (
                    <Pressable
                      key={amount}
                      onPress={() => setValue(String(amount))}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: value === String(amount) ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                      }}
                    >
                      <Text style={{ color: value === String(amount) ? '#fff' : colors.text, fontWeight: '600' }}>
                        {formatCurrency(amount, currency)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {/* Custom Amount Input */}
                <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 18, marginRight: 4 }}>$</Text>
                  <TextInput
                    style={{ flex: 1, paddingVertical: 14, fontSize: 18, color: colors.text }}
                    value={value}
                    onChangeText={setValue}
                    placeholder={t('customAmount', language)}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            ) : (
              <View className="mb-6">
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
                  {t('selectGiftCardServices', language)}
                </Text>
                <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
                  {services.map((service, index) => {
                    const isSelected = selectedServices.some(s => s.serviceId === service.id);
                    const selectedService = selectedServices.find(s => s.serviceId === service.id);
                    return (
                      <Pressable
                        key={service.id}
                        onPress={() => handleServiceToggle(service.id, service.name)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          borderBottomWidth: index < services.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                          backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: isSelected ? primaryColor : colors.border,
                            backgroundColor: isSelected ? primaryColor : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          {isSelected && <Check size={14} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '500' }}>{service.name}</Text>
                          {service.duration_minutes > 0 && (
                            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{service.duration_minutes} min</Text>
                          )}
                        </View>
                        {isSelected && (
                          <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Pressable
                              onPress={() => handleServiceQuantityChange(service.id, (selectedService?.quantity || 1) - 1)}
                              style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>−</Text>
                            </Pressable>
                            <Text style={{ color: colors.text, fontWeight: '600', minWidth: 24, textAlign: 'center' }}>
                              {selectedService?.quantity || 1}
                            </Text>
                            <Pressable
                              onPress={() => handleServiceQuantityChange(service.id, (selectedService?.quantity || 1) + 1)}
                              style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>+</Text>
                            </Pressable>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                  {services.length === 0 && (
                    <View className="py-8 items-center">
                      <Text style={{ color: colors.textTertiary }}>{t('noServicesYet', language)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Store — REQUIRED */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 4 }}>
                {t('selectStoreForGiftCard', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 12 }}>
                {t('required', language)}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
                {activeStores.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{t('noStores', language)}</Text>
                  </View>
                ) : (
                  activeStores.map((store, index) => {
                    const isSelected = selectedStoreId === store.id;
                    return (
                      <Pressable
                        key={store.id}
                        onPress={() => setSelectedStoreId(store.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 16,
                          borderBottomWidth: index < activeStores.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                          backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            borderWidth: 2,
                            borderColor: isSelected ? primaryColor : colors.border,
                            backgroundColor: isSelected ? primaryColor : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          {isSelected && <Check size={12} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{store.name}</Text>
                          {store.address ? (
                            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{store.address}</Text>
                          ) : null}
                        </View>
                        {store.is_primary ? (
                          <View style={{ backgroundColor: `${primaryColor}18`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>{t('primaryStore', language)}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>

            {/* Client — REQUIRED */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 4 }}>
              {t('clientLabel', language)}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 12 }}>
              {t('required', language)}
            </Text>

            {selectedClient ? (
              // Selected client row
              <Pressable
                onPress={() => setSelectedClientId(null)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1.5,
                  borderColor: primaryColor,
                  marginBottom: 20,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {getClientInitials(selectedClient.name)}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{selectedClient.name}</Text>
                  {selectedClient.email ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>{selectedClient.email}</Text>
                  ) : selectedClient.phone ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>{selectedClient.phone}</Text>
                  ) : null}
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={13} color="#fff" />
                </View>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => setShowClientSearch(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                  }}
                >
                  <Search size={18} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginLeft: 10, flex: 1 }}>
                    {t('searchForClient', language)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowNewClientModal(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 20,
                  }}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center' }}>
                    <User size={13} color="#fff" />
                  </View>
                  <Text style={{ color: primaryColor, marginLeft: 10, flex: 1, fontWeight: '600' }}>
                    {t('newClient', language)}
                  </Text>
                </Pressable>
              </>
            )}

            {/* Personal Message */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
              {t('personalMessage', language)} ({t('optional', language)})
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
              <TextInput
                style={{ padding: 16, fontSize: 16, color: colors.text, minHeight: 80 }}
                value={personalMessage}
                onChangeText={setPersonalMessage}
                placeholder={t('personalMessagePlaceholder', language)}
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Expiration — compliance-enforced */}
            {complianceRule.noExpiryOnly ? (
              // Canada: no expiry allowed — show locked notice
              <View style={{ marginBottom: 20 }}>
                <View className="flex-row items-center justify-between mb-3">
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                    {t('giftCardExpiration', language)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Lock size={14} color={colors.textTertiary} />
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                      {t('giftCardNoExpiryLabel', language)}
                    </Text>
                  </View>
                </View>
                <View style={{
                  backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#BFDBFE',
                  flexDirection: 'row',
                  gap: 10,
                  marginBottom: 8,
                }}>
                  <AlertCircle size={16} color="#3B82F6" style={{ marginTop: 1, flexShrink: 0 }} />
                  <Text style={{ color: isDark ? '#93C5FD' : '#1D4ED8', fontSize: 12, lineHeight: 18, flex: 1 }}>
                    {t('giftCardLegalNoticeCA', language)}
                  </Text>
                </View>
              </View>
            ) : (
              // All other regions: show toggle + compliant options
              <View style={{ marginBottom: 20 }}>
                <View className="flex-row items-center justify-between mb-4">
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                    {t('giftCardExpiration', language)}
                  </Text>
                  <Pressable
                    onPress={() => setHasExpiration(!hasExpiration)}
                    style={{
                      width: 50,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: hasExpiration ? primaryColor : (isDark ? colors.backgroundTertiary : '#E2E8F0'),
                      justifyContent: 'center',
                      paddingHorizontal: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: '#fff',
                        alignSelf: hasExpiration ? 'flex-end' : 'flex-start',
                      }}
                    />
                  </Pressable>
                </View>

                {hasExpiration && (
                  <View style={{ marginBottom: 8 }}>
                    {/* Compliance-aware option buttons */}
                    <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
                      {complianceRegion === 'us' ? (
                        // USA: no expiry or 5 years only
                        <>
                          <Pressable
                            onPress={() => { setHasExpiration(false); }}
                            style={{
                              flex: 1,
                              paddingVertical: 14,
                              borderRadius: 12,
                              backgroundColor: !hasExpiration ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: !hasExpiration ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
                              {t('giftCardNoExpiryLabel', language)}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => { setHasExpiration(true); setExpirationMonths('60'); }}
                            style={{
                              flex: 1,
                              paddingVertical: 14,
                              borderRadius: 12,
                              backgroundColor: hasExpiration && expirationMonths === '60' ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: hasExpiration && expirationMonths === '60' ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
                              {t('giftCardFiveYearLabel', language)}
                            </Text>
                          </Pressable>
                        </>
                      ) : complianceRegion === 'australia' ? (
                        // Australia: 3, 4, 5 years
                        (complianceRule.allowedMonths ?? [36, 48, 60]).map((months) => (
                          <Pressable
                            key={months}
                            onPress={() => setExpirationMonths(String(months))}
                            style={{
                              flex: 1,
                              paddingVertical: 12,
                              borderRadius: 10,
                              backgroundColor: expirationMonths === String(months) ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: expirationMonths === String(months) ? '#fff' : colors.text, fontWeight: '600' }}>
                              {months / 12}
                            </Text>
                            <Text style={{ color: expirationMonths === String(months) ? 'rgba(255,255,255,0.8)' : colors.textTertiary, fontSize: 11 }}>
                              {t('monthsLabel', language)}
                            </Text>
                          </Pressable>
                        ))
                      ) : complianceRegion === 'eu' || complianceRegion === 'uk' ? (
                        // EU/UK: 2, 3, 5 years
                        (complianceRule.allowedMonths ?? [24, 36, 60]).map((months) => (
                          <Pressable
                            key={months}
                            onPress={() => setExpirationMonths(String(months))}
                            style={{
                              flex: 1,
                              paddingVertical: 12,
                              borderRadius: 10,
                              backgroundColor: expirationMonths === String(months) ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: expirationMonths === String(months) ? '#fff' : colors.text, fontWeight: '600' }}>
                              {months / 12}
                            </Text>
                            <Text style={{ color: expirationMonths === String(months) ? 'rgba(255,255,255,0.8)' : colors.textTertiary, fontSize: 11 }}>
                              {t('monthsLabel', language)}
                            </Text>
                          </Pressable>
                        ))
                      ) : (
                        // Generic: original 3/6/12/24 months
                        [3, 6, 12, 24].map((months) => (
                          <Pressable
                            key={months}
                            onPress={() => setExpirationMonths(String(months))}
                            style={{
                              flex: 1,
                              paddingVertical: 12,
                              borderRadius: 10,
                              backgroundColor: expirationMonths === String(months) ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: expirationMonths === String(months) ? '#fff' : colors.text, fontWeight: '600' }}>
                              {months}
                            </Text>
                            <Text style={{ color: expirationMonths === String(months) ? 'rgba(255,255,255,0.8)' : colors.textTertiary, fontSize: 11 }}>
                              {t('monthsLabel', language)}
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </View>

                    {/* Legal notice banner — shown for regulated regions */}
                    {(complianceRegion === 'us' || complianceRegion === 'eu' || complianceRegion === 'uk' || complianceRegion === 'australia') && (
                      <View style={{
                        backgroundColor: isDark ? 'rgba(59,130,246,0.10)' : '#EFF6FF',
                        borderRadius: 12,
                        padding: 13,
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(59,130,246,0.22)' : '#BFDBFE',
                        flexDirection: 'row',
                        gap: 9,
                        marginTop: 4,
                      }}>
                        <Lock size={14} color="#3B82F6" style={{ marginTop: 1, flexShrink: 0 }} />
                        <Text style={{ color: isDark ? '#93C5FD' : '#1D4ED8', fontSize: 11.5, lineHeight: 17, flex: 1 }}>
                          {complianceRegion === 'us'
                            ? t('giftCardLegalNoticeUS', language)
                            : complianceRegion === 'eu'
                            ? t('giftCardLegalNoticeEU', language)
                            : complianceRegion === 'uk'
                            ? t('giftCardLegalNoticeUK', language)
                            : t('giftCardLegalNoticeAU', language)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Preview */}
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
              {t('giftCardPreview', language)}
            </Text>
            <GiftCardPreview
              type={type}
              value={type === 'value' ? parseFloat(value) || 0 : undefined}
              services={type === 'service' ? selectedServices : undefined}
              recipientName={selectedClient?.name}
              personalMessage={personalMessage}
              expiresAt={expiresAt}
              overrideColor={selectedGiftCardColor || undefined}
            />

            {/* Card Color Picker – fixed 3×7 grid */}
            <ColorPickerGrid
              selectedColor={selectedGiftCardColor ?? primaryColor}
              primaryColor={primaryColor}
              onSelect={setSelectedGiftCardColor}
              colors={colors}
              label={t('cardColor', language)}
            />

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Submit Button */}
          <View style={{ padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
            {submitError && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <AlertCircle size={16} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '500', flex: 1 }}>{submitError}</Text>
              </View>
            )}
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting || !isFormValid || showSuccessToast}
              style={{
                backgroundColor: !isFormValid || showSuccessToast ? colors.border : buttonColor,
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: 'center',
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                  {t('issueGiftCard', language)}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* Success toast — inside modal so it overlays correctly */}
        <LocalSuccessToast
          visible={showSuccessToast}
          message={t('giftCardCreated', language)}
          onHide={() => setShowSuccessToast(false)}
          duration={1200}
        />

        {/* Client Search Modal */}
        <Modal
          visible={showClientSearch}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowClientSearch(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
            <Animated.View
              entering={FadeIn.duration(300)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: colors.card,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                }}
              >
                <Search size={18} color={colors.textTertiary} />
                <TextInput
                  value={clientSearchQuery}
                  onChangeText={setClientSearchQuery}
                  placeholder={t('searchClients', language)}
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                  cursorColor={primaryColor}
                  style={{
                    flex: 1,
                    padding: 12,
                    color: colors.text,
                    fontSize: 16,
                  }}
                />
              </View>
              <Pressable
                onPress={() => { setShowClientSearch(false); setClientSearchQuery(''); }}
                style={{ marginLeft: 12, paddingVertical: 8, paddingHorizontal: 4 }}
              >
                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 16 }}>{t('cancel', language)}</Text>
              </Pressable>
            </Animated.View>

            <FlatList
              data={filteredClients}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <ClientSearchItem
                  client={item}
                  index={index}
                  onPress={() => {
                    setSelectedClientId(item.id);
                    setShowClientSearch(false);
                    setClientSearchQuery('');
                  }}
                />
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t('noClientsFound', language)}</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>

        {/* Inline Add Client overlay — avoids nested modal on iOS pageSheet */}
        {showNewClientModal && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background, zIndex: 999 }}>
            {/* Header */}
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <UserPlus size={22} color={primaryColor} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('addClient', language)}</Text>
              </View>
              <Pressable
                onPress={() => { resetNewClientForm(); setShowNewClientModal(false); }}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </Animated.View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* General error */}
              {ncErrors.general && (
                <Text style={{ color: '#EF4444', textAlign: 'center', marginBottom: 12 }}>{ncErrors.general}</Text>
              )}

              <Animated.View
                entering={FadeInDown.delay(80).duration(300)}
                style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16 }}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 16 }}>{t('clientInformation', language)}</Text>

                {/* Name */}
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 6 }}>{t('name', language)}</Text>
                <TextInput
                  value={ncName}
                  onChangeText={setNcName}
                  placeholder={t('namePlaceholder', language)}
                  autoCapitalize="words"
                  style={{ backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.inputText, borderWidth: 1, borderColor: ncErrors.name ? '#EF4444' : colors.inputBorder, marginBottom: ncErrors.name ? 4 : 16 }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                />
                {ncErrors.name && <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{ncErrors.name}</Text>}

                {/* Email */}
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 6 }}>{t('email', language)} ({t('optional', language)})</Text>
                <TextInput
                  value={ncEmail}
                  onChangeText={setNcEmail}
                  placeholder={t('emailPlaceholder', language)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.inputText, borderWidth: 1, borderColor: ncErrors.email ? '#EF4444' : colors.inputBorder, marginBottom: ncErrors.email ? 4 : 16 }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                />
                {ncErrors.email && <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{ncErrors.email}</Text>}

                {/* Phone */}
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 6 }}>{t('phone', language)} ({t('optional', language)})</Text>
                <TextInput
                  value={ncPhone}
                  onChangeText={(v) => setNcPhone(formatPhoneNumber(v))}
                  placeholder={t('phonePlaceholder', language)}
                  keyboardType="phone-pad"
                  style={{ backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.inputText, borderWidth: 1, borderColor: ncErrors.phone ? '#EF4444' : colors.inputBorder, marginBottom: ncErrors.phone ? 4 : 16 }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                />
                {ncErrors.phone && <Text style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{ncErrors.phone}</Text>}

                {/* Notes */}
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 6 }}>{t('notes', language)} ({t('optional', language)})</Text>
                <TextInput
                  value={ncNotes}
                  onChangeText={setNcNotes}
                  placeholder={t('notesPlaceholder', language)}
                  multiline
                  numberOfLines={3}
                  style={{ backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.inputText, borderWidth: 1, borderColor: colors.inputBorder, minHeight: 88, textAlignVertical: 'top' }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                />
              </Animated.View>

              {/* Save */}
              <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                <Pressable
                  onPress={handleNewClientSave}
                  style={{ backgroundColor: primaryColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: createClientMutation.isPending ? 0.7 : 1 }}
                >
                  {createClientMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('save', language)}</Text>
                  }
                </Pressable>
              </Animated.View>
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
