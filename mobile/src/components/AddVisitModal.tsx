import React, { useState, useMemo, useCallback, useEffect } from 'react';

// React Native global for development mode
declare const __DEV__: boolean;
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Calendar,
  FileText,
  Tag,
  ChevronDown,
  Check,
  Gift,
  Search,
  Mail,
  Phone,
  Store as StoreIcon,
  Users,
  Briefcase,
} from 'lucide-react-native';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { WheelDatePicker } from '@/components/WheelDatePicker';
import { getCurrencySymbol } from '@/lib/currency';
import { getClientInitials, sortClientsAlphabetically } from './ClientSearchItem';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { getServiceIconColor } from '@/lib/serviceColors';
import { useServices } from '@/hooks/useServices';
import { useClients } from '@/hooks/useClients';
import { useStores } from '@/hooks/useStores';
import { useStaffMembers } from '@/hooks/useStaff';
import { useCreateAppointment } from '@/hooks/useAppointments';
import { useSyncAppointmentServices } from '@/hooks/useServices';
import { useEnsurePromotion, useHydratePromotionsFromSupabase } from '@/hooks/usePromotions';
import { useClientGiftCards, useRedeemGiftCardValue, useRedeemGiftCardService } from '@/hooks/useGiftCards';
import { isGiftCardUsable } from '@/services/giftCardService';
import { CreditCard, DollarSign } from 'lucide-react-native';
import { notifyAppointmentEmail } from '@/services/appointmentsService';
import { notifyTransactionalEmail } from '@/services/transactionalEmailService';

// Helper to get staff initials
const getStaffInitials = (name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName) return '?';
  const parts = trimmedName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return firstInitial + lastInitial;
};

interface AddVisitModalProps {
  visible: boolean;
  onClose: () => void;
  preSelectedClientId?: string;
}

export function AddVisitModal({ visible, onClose, preSelectedClientId }: AddVisitModalProps) {
  // Use Supabase hooks for data (single source of truth)
  const { data: supabaseClients = [], isLoading: clientsLoading } = useClients();
  const { data: supabaseStores = [], isLoading: storesLoading } = useStores();
  const { data: supabaseStaff = [], isLoading: staffLoading } = useStaffMembers();

  // Marketing promotions still from Zustand (not yet migrated)
  const allMarketingPromotions = useStore((s) => s.marketingPromotions);
  const userId = useStore((s) => s.user?.id);
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { showSuccess } = useToast();

  // Use Supabase mutation to save visit as an appointment
  const createAppointmentMutation = useCreateAppointment();
  const syncServicesMutation = useSyncAppointmentServices();
  const ensurePromotionMutation = useEnsurePromotion();

  // Hydrate Zustand from Supabase so DB-seeded promos appear in dropdown
  useHydratePromotionsFromSupabase();

  // Use Supabase services instead of local store
  // Filter out products - only show appointment-based services
  const { data: servicesData, isLoading: servicesLoading } = useServices();
  const services = useMemo(() => {
    return (servicesData ?? []).filter(s => {
      const serviceType = (s as unknown as { service_type?: string }).service_type;
      return serviceType !== 'product'; // Show 'service' type and services without type (legacy)
    });
  }, [servicesData]);

  const currencySymbol = getCurrencySymbol(currency);

  // Convert Supabase clients to the format expected by the UI
  const clients = useMemo(() => {
    return supabaseClients.map((c) => ({
      id: c.id,
      userId: userId || '',
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      isArchived: false, // Supabase clients are already filtered to non-deleted
    }));
  }, [supabaseClients, userId]);

  // Convert Supabase stores to the format expected by the UI
  const stores = useMemo(() => {
    return supabaseStores.map((s) => ({
      id: s.id,
      userId: userId || '',
      name: s.name,
    }));
  }, [supabaseStores, userId]);

  // Convert Supabase staff to the format expected by the UI
  const staffMembers = useMemo(() => {
    return supabaseStaff.map((s) => ({
      id: s.id,
      userId: userId || '',
      name: s.full_name,
      storeId: s.store_ids?.[0] || undefined,
      storeIds: s.store_ids || [],
      serviceIds: s.service_ids || [],
    }));
  }, [supabaseStaff, userId]);

  // Filter promotions by current user
  const marketingPromotions = useMemo(() => {
    if (!userId) return [];
    return allMarketingPromotions.filter((p) => p.userId === userId);
  }, [allMarketingPromotions, userId]);

  const [selectedClientId, setSelectedClientId] = useState<string>(preSelectedClientId || '');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [promotionUsed, setPromotionUsed] = useState('');
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string | null>(null);
  const [showGiftCardPicker, setShowGiftCardPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);

  // Gift cards for the selected client (loaded after selectedClientId state is declared)
  const { data: clientGiftCards } = useClientGiftCards(selectedClientId || undefined);
  const activeClientGiftCards = useMemo(
    () => (clientGiftCards ?? []).filter(gc => gc.status === 'active'),
    [clientGiftCards]
  );
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showPromotionPicker, setShowPromotionPicker] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get staff members for the selected store (or all if no store selected)
  const availableStaffMembers = useMemo(() => {
    if (!selectedStoreId) {
      return staffMembers;
    }
    return staffMembers.filter((staff) => {
      // Check storeIds array first, then fallback to storeId
      if (staff.storeIds && staff.storeIds.length > 0) {
        return staff.storeIds.includes(selectedStoreId);
      }
      return staff.storeId === selectedStoreId;
    });
  }, [staffMembers, selectedStoreId]);

  // Reset staff selection when store changes and staff is not in the new store
  useEffect(() => {
    if (selectedStaffId && selectedStoreId) {
      const staffInStore = availableStaffMembers.find((s) => s.id === selectedStaffId);
      if (!staffInStore) {
        setSelectedStaffId('');
      }
    }
  }, [selectedStoreId, selectedStaffId, availableStaffMembers]);

  // When staff is selected, remove any selected services that staff cannot perform
  useEffect(() => {
    if (!selectedStaffMember || selectedStaffMember.serviceIds.length === 0) return;
    setSelectedServices((prev) => prev.filter((svcId) => selectedStaffMember.serviceIds.includes(svcId)));
  }, [selectedStaffId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When staff changes and is now incompatible with services, clear staff
  useEffect(() => {
    if (!selectedStaffId || selectedServices.length === 0) return;
    const staff = staffMembers.find((s) => s.id === selectedStaffId);
    if (!staff || staff.serviceIds.length === 0) return; // no restrictions
    const canDoAll = selectedServices.every((svcId) => staff.serviceIds.includes(svcId));
    if (!canDoAll) setSelectedStaffId('');
  }, [selectedServices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset visitDate when modal opens
  useEffect(() => {
    if (visible) {
      setVisitDate(new Date());
    }
  }, [visible]);

  // Clear gift card selection when client changes
  useEffect(() => {
    setSelectedGiftCardId(null);
    setShowGiftCardPicker(false);
  }, [selectedClientId]);

  const activeClients = useMemo(() => {
    const filtered = clients.filter((c) => !c.isArchived);
    // Always sort alphabetically by first name
    return sortClientsAlphabetically(filtered);
  }, [clients]);

  // Filtered clients based on search query
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) {
      return activeClients;
    }
    const query = clientSearchQuery.toLowerCase();
    return activeClients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone.includes(query)
    );
  }, [activeClients, clientSearchQuery]);

  // Active promotions for dropdown (from Zustand — synced to Supabase on save)
  const activePromotions = useMemo(() => {
    return marketingPromotions.filter((p) => p.isActive);
  }, [marketingPromotions]);

  // ── Pricing computation (same engine as BookAppointmentModal) ──────────
  // Computed from services.price_cents + selected promotion.
  // Uses promotionUsed (name string) to look up the promo object.
  const computedPricing = useMemo(() => {
    const subtotalCents = selectedServices.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      const pc = (svc as unknown as { price_cents?: number })?.price_cents ?? 0;
      return sum + pc;
    }, 0);

    const promo = promotionUsed
      ? marketingPromotions.find((p) => p.name === promotionUsed)
      : null;

    let discountCents = 0;
    if (promo && subtotalCents > 0) {
      if (promo.discountType === 'percentage') {
        discountCents = Math.round(subtotalCents * (promo.discountValue / 100));
      } else if (promo.discountType === 'fixed') {
        // discountValue is in dollars — convert to cents, never exceed subtotal
        discountCents = Math.min(Math.round(promo.discountValue * 100), subtotalCents);
      } else if (promo.discountType === 'free_service') {
        discountCents = subtotalCents; // full discount
      }
    }

    const totalCents = Math.max(0, subtotalCents - discountCents);
    return { subtotalCents, discountCents, totalCents, promo };
  }, [selectedServices, services, promotionUsed, marketingPromotions]);

  // Selected staff object (for service filtering)
  const selectedStaffMember = useMemo(
    () => staffMembers.find((s) => s.id === selectedStaffId) ?? null,
    [staffMembers, selectedStaffId]
  );

  // Services filtered by selected staff's allowed service IDs.
  // If no staff selected, or staff has no service assignments, show all services.
  const availableServices = useMemo(() => {
    if (!selectedStaffMember || selectedStaffMember.serviceIds.length === 0) {
      return services;
    }
    return services.filter((svc) => selectedStaffMember.serviceIds.includes(svc.id));
  }, [services, selectedStaffMember]);

  // Staff filtered by selected services: only show staff who can do ALL selected services.
  // Applied on top of store filter. If no services selected, show all store-filtered staff.
  const availableStaffForServices = useMemo(() => {
    if (selectedServices.length === 0) return availableStaffMembers;
    return availableStaffMembers.filter((staff) => {
      if (staff.serviceIds.length === 0) return true; // no restrictions = can do all
      return selectedServices.every((svcId) => staff.serviceIds.includes(svcId));
    });
  }, [availableStaffMembers, selectedServices]);

  const selectedClient = activeClients.find((c) => c.id === selectedClientId);

  // Toggle service selection and auto-populate price
  const toggleService = (tagId: string) => {
    setSelectedServices((prev) => {
      const newSelection = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];

      // Auto-calculate subtotal from services (discount applied below via useEffect)
      const totalPriceCents = newSelection.reduce((sum, id) => {
        const service = services.find(s => s.id === id);
        return sum + (service?.price_cents || 0);
      }, 0);

      // Update amount (convert cents to dollars) — promo discount applied via useEffect
      if (totalPriceCents > 0) {
        setAmount((totalPriceCents / 100).toFixed(2));
      } else {
        setAmount('');
      }

      return newSelection;
    });
  };

  // Keep amount in sync with computedPricing whenever promo or services change
  // (toggleService handles service changes; this handles promo-only changes)
  useEffect(() => {
    if (computedPricing.subtotalCents > 0) {
      setAmount((computedPricing.totalCents / 100).toFixed(2));
    }
  }, [computedPricing.totalCents, computedPricing.subtotalCents]);

  const handleSave = async () => {
    if (!selectedClientId || selectedServices.length === 0 || isSaving) return;

    setIsSaving(true);

    // Get selected store - use first store if none selected and stores exist
    const storeIdToUse = selectedStoreId || (stores.length > 0 ? stores[0].id : null);

    if (!storeIdToUse) {
      setIsSaving(false);
      Alert.alert('Error', 'A store is required. Please create a store first.');
      return;
    }

    // Validate client exists in our list
    const clientExists = clients.some(c => c.id === selectedClientId);
    if (!clientExists) {
      setIsSaving(false);
      Alert.alert('Error', 'Selected client not found. Please select a valid client.');
      return;
    }

    // Validate store exists in our list
    const storeExists = stores.some(s => s.id === storeIdToUse);
    if (!storeExists) {
      setIsSaving(false);
      Alert.alert('Error', 'Selected store not found. Please select a valid store.');
      return;
    }

    // Create appointment in Supabase (visits are stored as appointments)
    // Set appointment time based on visit date - default to 9:00 AM, 1 hour duration
    // For past dates, this is fine - we're logging a historical visit
    const startAt = new Date(visitDate);
    startAt.setHours(9, 0, 0, 0);
    const endAt = new Date(startAt);
    endAt.setHours(10, 0, 0, 0);

    try {
      console.log('[AddVisitModal] Saving visit to Supabase appointments...');
      console.log('[AddVisitModal] Visit date:', visitDate.toISOString());
      console.log('[AddVisitModal] Client ID:', selectedClientId);
      console.log('[AddVisitModal] Store ID:', storeIdToUse);

      // Find promotion ID if promotion was selected
      // Only use promo_id if it's a valid UUID format
      const selectedPromo = promotionUsed ? marketingPromotions.find(p => p.name === promotionUsed) : null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let promoIdToSave: string | null = null;

      // If a promotion is selected, try to ensure it exists in Supabase.
      // This is non-blocking: if sync fails, we proceed without promo_id rather
      // than aborting the entire visit save.
      if (selectedPromo && uuidRegex.test(selectedPromo.id)) {
        console.log('[AddVisitModal] Ensuring promotion exists in Supabase:', selectedPromo.id);
        try {
          await ensurePromotionMutation.mutateAsync(selectedPromo);
          console.log('[AddVisitModal] Promotion synced to Supabase successfully');
          promoIdToSave = selectedPromo.id;
        } catch (promoErr) {
          const promoErrMsg = promoErr instanceof Error ? promoErr.message : String(promoErr);
          console.warn('[AddVisitModal] Promotion sync failed (non-blocking) — saving visit without promo_id:', promoErrMsg);
          // promoIdToSave stays null; the appointment will be saved without the promo link
        }
      }

      // Debug: Log all IDs being used
      if (__DEV__) {
        console.log('[AddVisitModal] === SAVE DEBUG ===');
        console.log('[AddVisitModal] clientId:', selectedClientId);
        console.log('[AddVisitModal] storeId:', storeIdToUse);
        console.log('[AddVisitModal] staffId:', selectedStaffId || 'null');
        console.log('[AddVisitModal] visitDate:', visitDate.toISOString());
        console.log('[AddVisitModal] services:', selectedServices);
        console.log('[AddVisitModal] promotionUsed (name):', promotionUsed);
        console.log('[AddVisitModal] promoIdToSave:', promoIdToSave);
        console.log('[AddVisitModal] ========================');
      }

      const createdAppointment = await createAppointmentMutation.mutateAsync({
        client_id: selectedClientId,
        store_id: storeIdToUse,
        staff_id: selectedStaffId || null,
        appointment_date: visitDate,
        start_at: startAt,
        end_at: endAt,
        duration_minutes: 60,
        title: 'Visit',
        notes: notes || undefined,
        amount: amount ? parseFloat(amount) : 0,
        currency: currency,
        promo_id: promoIdToSave,
        gift_card_id: selectedGiftCardId ?? undefined,
        // service_id: first selected service — satisfies DB NOT NULL check constraint
        service_id: selectedServices.length > 0 ? selectedServices[0] : null,
        // service_tags: all selected service IDs (backup/analytics)
        service_tags: selectedServices.length > 0 ? selectedServices : undefined,
        // Pricing breakdown (cents) — persisted for history and email
        subtotal_cents: computedPricing.subtotalCents > 0 ? computedPricing.subtotalCents : null,
        discount_cents: computedPricing.discountCents ?? 0,
        total_cents: computedPricing.subtotalCents > 0 ? computedPricing.totalCents : null,
        // Mark as Log Visit so DB overlap constraint is bypassed for historical records
        is_log_visit: true,
      });

      // Sync services to appointment_services junction table
      // Only sync if we have valid service IDs
      if (createdAppointment?.id && selectedServices.length > 0) {
        console.log('[AddVisitModal] Syncing services to appointment_services:', createdAppointment.id, selectedServices);
        try {
          await syncServicesMutation.mutateAsync({
            appointmentId: createdAppointment.id,
            serviceIds: selectedServices,
          });
        } catch (syncError) {
          // Service sync failure shouldn't block the visit from being saved
          console.log('[AddVisitModal] Service sync failed (non-blocking):', syncError);
        }
      }

      // NOTE: We no longer save to Zustand - Supabase is the single source of truth
      // The visit will appear in Visit History via useClientAppointments hook

      console.log('[AddVisitModal] Visit saved successfully to Supabase');

      // Fire-and-forget: send appointment confirmation email + promo email if applicable
      if (createdAppointment?.id) {
        notifyAppointmentEmail(createdAppointment.id, 'created', language);
        if (computedPricing.promo && userId && selectedClientId) {
          notifyTransactionalEmail({
            business_id: userId,
            client_id: selectedClientId,
            event_type: 'promotion_applied',
            promo_title: computedPricing.promo.name,
            promo_discount_type: computedPricing.promo.discountType,
            promo_discount_value: computedPricing.promo.discountValue,
          });
        }
      }

      showSuccess(t('successSaved', language));
      setIsSaving(false);
      resetAndClose();
    } catch (error) {
      // Log the full error object for debugging
      console.log('[AddVisitModal] Error saving visit:', JSON.stringify(error));
      if (error instanceof Error) {
        console.log('[AddVisitModal] Error message:', error.message);
      }
      setIsSaving(false);
      // Build a user-facing message from the real error
      let errorMessage = 'Couldn\'t save visit. Please try again.';
      if (error instanceof Error) {
        const msg = error.message;
        const msgLower = msg.toLowerCase();
        if (msgLower.includes('foreign key') || msgLower.includes('violates foreign')) {
          errorMessage = `Couldn't save visit. Reference error: one of the selected options (client, store, or staff) may no longer exist.`;
        } else if (msgLower.includes('rls') || msgLower.includes('policy') || msgLower.includes('permission')) {
          errorMessage = `Couldn't save visit. Permission denied — please check that you are logged in.`;
        } else if (msgLower.includes('not null') || msgLower.includes('null value')) {
          errorMessage = `Couldn't save visit. Missing required field: ${msg}`;
        } else if (msg.length > 0 && msg.length < 200) {
          // Show the real reason if it's short enough to be user-readable
          errorMessage = `Couldn't save visit. ${msg}`;
        }
      }
      Alert.alert('Error', errorMessage);
    }
  };

  const resetAndClose = () => {
    setSelectedClientId(preSelectedClientId || '');
    setSelectedStoreId('');
    setSelectedStaffId('');
    setSelectedServices([]);
    setNotes('');
    setAmount('');
    setPromotionUsed('');
    setSelectedGiftCardId(null);
    setShowGiftCardPicker(false);
    setShowClientPicker(false);
    setShowStorePicker(false);
    setShowStaffPicker(false);
    setClientSearchQuery('');
    setShowPromotionPicker(false);
    onClose();
  };

  // Amount (auto-filled from services or manually entered) must be > 0
  const parsedAmount = parseFloat(amount);
  const amountIsValid = !isNaN(parsedAmount) && parsedAmount > 0;
  const canSave = !!selectedClientId && selectedServices.length > 0 && !!visitDate && amountIsValid;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View className="flex-row items-center">
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Calendar size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('logVisit', language)}</Text>
            </View>
            <Pressable
              onPress={resetAndClose}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Client Selector with Search */}
            <Animated.View entering={SlideInUp.delay(50).duration(300)}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                {t('clients', language)} *
              </Text>

              {/* Search Input */}
              <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Search size={18} color={colors.textTertiary} />
                <TextInput
                  value={clientSearchQuery}
                  onChangeText={(text) => {
                    setClientSearchQuery(text);
                    if (!showClientPicker) setShowClientPicker(true);
                  }}
                  onFocus={() => setShowClientPicker(true)}
                  placeholder={t('searchClientsPlaceholder', language)}
                  style={{ flex: 1, marginLeft: 12, fontSize: 16, color: colors.inputText }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                  selectionColor={`${primaryColor}40`}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {clientSearchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setClientSearchQuery('')}
                    className="p-1"
                  >
                    <X size={16} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Selected Client Display */}
              {selectedClient && !showClientPicker && (
                <Pressable
                  onPress={() => setShowClientPicker(true)}
                  style={{ backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA', borderWidth: 1, borderColor: isDark ? primaryColor : '#99F6E4', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View className="flex-row items-center flex-1">
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}50` : '#CCFBF1', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 16 }}>
                        {getClientInitials(selectedClient.name)}
                      </Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text style={{ color: colors.text, fontWeight: '500' }}>{selectedClient.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{selectedClient.email}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Check size={18} color={primaryColor} />
                    <Pressable
                      onPress={() => {
                        setSelectedClientId('');
                        setClientSearchQuery('');
                      }}
                      className="ml-2 p-1"
                    >
                      <X size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </Pressable>
              )}

              {/* Client Dropdown */}
              {showClientPicker && (
                <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, maxHeight: 280, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {clientsLoading ? (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={primaryColor} />
                        <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>Loading clients...</Text>
                      </View>
                    ) : filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <Pressable
                          key={client.id}
                          onPress={() => {
                            setSelectedClientId(client.id);
                            setShowClientPicker(false);
                            setClientSearchQuery('');
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 16 }}>
                              {getClientInitials(client.name)}
                            </Text>
                          </View>
                          <View className="flex-1 ml-3">
                            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{client.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <Mail size={12} color={colors.textTertiary} />
                              <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 6 }} numberOfLines={1}>{client.email}</Text>
                            </View>
                            {client.phone && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                                <Phone size={12} color={colors.textTertiary} />
                                <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 6 }}>{formatPhoneDisplay(client.phone)}</Text>
                              </View>
                            )}
                          </View>
                          {selectedClientId === client.id && <Check size={18} color={primaryColor} />}
                        </Pressable>
                      ))
                    ) : (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <Search size={24} color={colors.textTertiary} />
                        <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>{t('noClientsFound', language)}</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                          {clientSearchQuery ? t('tryDifferentSearch', language) : t('noClientsAvailable', language)}
                        </Text>
                      </View>
                    )}
                  </ScrollView>

                  {/* Close button for dropdown */}
                  {filteredClients.length > 0 && (
                    <Pressable
                      onPress={() => setShowClientPicker(false)}
                      style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', alignItems: 'center' }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>{t('close', language)}</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Animated.View>

            {/* Select Store - Only show if stores exist */}
            {stores.length > 0 && (
              <Animated.View entering={SlideInUp.delay(75).duration(300)} className="mt-5">
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                  {t('selectStore', language)} ({t('optional', language).toLowerCase()})
                </Text>
                <Pressable
                  onPress={() => setShowStorePicker(!showStorePicker)}
                  style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <StoreIcon size={20} color={colors.textSecondary} />
                    <Text
                      style={{ marginLeft: 12, fontSize: 16, color: selectedStoreId ? colors.inputText : colors.inputPlaceholder, flex: 1 }}
                      numberOfLines={1}
                    >
                      {selectedStoreId ? stores.find((s) => s.id === selectedStoreId)?.name : t('selectStore', language)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {selectedStoreId && (
                      <Pressable
                        onPress={() => {
                          setSelectedStoreId('');
                          setSelectedStaffId('');
                        }}
                        style={{ marginRight: 8, padding: 4 }}
                      >
                        <X size={18} color={colors.textTertiary} />
                      </Pressable>
                    )}
                    <ChevronDown size={20} color={colors.textTertiary} />
                  </View>
                </Pressable>

                {/* Store Dropdown */}
                {showStorePicker && (
                  <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, marginTop: 8, maxHeight: 240, overflow: 'hidden' }}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {/* No Store Option */}
                      <Pressable
                        onPress={() => {
                          setSelectedStoreId('');
                          setSelectedStaffId('');
                          setShowStorePicker(false);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                      >
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={16} color={colors.textTertiary} />
                        </View>
                        <Text style={{ marginLeft: 12, color: colors.textTertiary, flex: 1, fontStyle: 'italic' }}>{t('noStoreSelected', language) || 'No store selected'}</Text>
                        {!selectedStoreId && <Check size={18} color={primaryColor} />}
                      </Pressable>

                      {stores.map((store) => (
                        <Pressable
                          key={store.id}
                          onPress={() => {
                            setSelectedStoreId(store.id);
                            setShowStorePicker(false);
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <View
                            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${primaryColor}20` }}
                          >
                            <StoreIcon size={18} color={primaryColor} />
                          </View>
                          <Text style={{ marginLeft: 12, color: colors.text, fontWeight: '500', flex: 1 }}>{getLocalizedStoreName(store.name, language)}</Text>
                          {selectedStoreId === store.id && <Check size={18} color={primaryColor} />}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </Animated.View>
            )}

            {/* Staff Member (Optional) - Always show this section */}
            <Animated.View entering={SlideInUp.delay(85).duration(300)} className="mt-5">
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                {t('staffMember', language)} ({t('optional', language).toLowerCase()})
              </Text>
              {staffLoading ? (
                <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={primaryColor} />
                  <Text style={{ marginLeft: 12, fontSize: 16, color: colors.inputPlaceholder }}>{t('loading', language)}</Text>
                </View>
              ) : staffMembers.length === 0 ? (
                <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <Users size={20} color={colors.textTertiary} />
                  <Text style={{ marginLeft: 12, fontSize: 16, color: colors.textTertiary }}>{t('noStaffMembers', language) || 'No staff members'}</Text>
                </View>
              ) : (
                <>
                  <Pressable
                    onPress={() => setShowStaffPicker(!showStaffPicker)}
                    style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Users size={20} color={selectedStaffId ? primaryColor : colors.textSecondary} />
                      <Text
                        style={{ marginLeft: 12, fontSize: 16, color: selectedStaffId ? colors.inputText : colors.inputPlaceholder, flex: 1 }}
                        numberOfLines={1}
                      >
                        {selectedStaffId ? staffMembers.find((s) => s.id === selectedStaffId)?.name : t('selectStaffMember', language) || 'Select staff member'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {selectedStaffId && (
                        <Pressable
                          onPress={() => setSelectedStaffId('')}
                          style={{ marginRight: 8, padding: 4 }}
                        >
                          <X size={18} color={colors.textTertiary} />
                        </Pressable>
                      )}
                      <ChevronDown size={20} color={colors.textTertiary} />
                    </View>
                  </Pressable>

                  {/* Staff Dropdown */}
                  {showStaffPicker && (
                    <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, marginTop: 8, maxHeight: 240, overflow: 'hidden' }}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {/* No Staff Option */}
                        <Pressable
                          onPress={() => {
                            setSelectedStaffId('');
                            setShowStaffPicker(false);
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={16} color={colors.textTertiary} />
                          </View>
                          <Text style={{ marginLeft: 12, color: colors.textTertiary, flex: 1, fontStyle: 'italic' }}>{t('noStaffSelected', language) || 'No staff selected'}</Text>
                          {!selectedStaffId && <Check size={18} color={primaryColor} />}
                        </Pressable>

                        {availableStaffForServices.length > 0 ? (
                          availableStaffForServices.map((staff) => (
                            <Pressable
                              key={staff.id}
                              onPress={() => {
                                setSelectedStaffId(staff.id);
                                setShowStaffPicker(false);
                              }}
                              style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                            >
                              <View
                                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${primaryColor}20` }}
                              >
                                <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 14 }}>
                                  {getStaffInitials(staff.name)}
                                </Text>
                              </View>
                              <Text style={{ marginLeft: 12, color: colors.text, fontWeight: '500', flex: 1 }}>{staff.name}</Text>
                              {selectedStaffId === staff.id && <Check size={18} color={primaryColor} />}
                            </Pressable>
                          ))
                        ) : (
                          <View style={{ padding: 24, alignItems: 'center' }}>
                            <Users size={24} color={colors.textTertiary} />
                            <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>{t('noStaffInStore', language) || 'No staff members in this store'}</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </Animated.View>

            {/* Services */}
            <Animated.View entering={SlideInUp.delay(100).duration(300)} className="mt-5">
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                {t('servicesRequired', language)}
              </Text>
              {servicesLoading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={primaryColor} />
                </View>
              ) : availableServices.length > 0 ? (
                <View className="flex-row flex-wrap">
                  {availableServices.map((service) => {
                    const isSelected = selectedServices.includes(service.id);
                    return (
                      <Pressable
                        key={service.id}
                        onPress={() => toggleService(service.id)}
                        className="mr-2 mb-2 px-4 py-2 rounded-full flex-row items-center"
                        style={{
                          backgroundColor: isSelected ? primaryColor : `${primaryColor}15`,
                          borderWidth: 1,
                          borderColor: primaryColor,
                        }}
                      >
                        <Briefcase size={14} color={isSelected ? '#fff' : primaryColor} />
                        <Text
                          className="ml-1.5 font-medium text-sm"
                          style={{ color: isSelected ? '#fff' : primaryColor }}
                        >
                          {service.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={{ padding: 16, backgroundColor: colors.inputBackground, borderRadius: 12, alignItems: 'center' }}>
                  <Briefcase size={24} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>
                    {t('noServicesYet', language)}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* Amount */}
            <Animated.View entering={SlideInUp.delay(150).duration(300)} className="mt-5">
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>{t('visitAmount', language)} *</Text>
                {selectedServices.length > 0 && amountIsValid && (
                  <Text style={{ color: primaryColor, fontSize: 12, marginLeft: 8, fontWeight: '500' }}>auto-filled</Text>
                )}
              </View>
              <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, color: colors.textSecondary, fontWeight: '500' }}>{currencySymbol}</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  style={{ flex: 1, marginLeft: 12, fontSize: 16, color: colors.inputText }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                  selectionColor={`${primaryColor}40`}
                />
              </View>
            </Animated.View>

            {/* Promotion Used - Dropdown */}
            <Animated.View entering={SlideInUp.delay(200).duration(300)} className="mt-5">
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>{t('promotionUsed', language)}</Text>
              <Pressable
                onPress={() => setShowPromotionPicker(!showPromotionPicker)}
                style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View className="flex-row items-center flex-1">
                  <Gift size={20} color={colors.textSecondary} />
                  <Text
                    style={{ marginLeft: 12, fontSize: 16, color: promotionUsed ? colors.inputText : colors.inputPlaceholder, flex: 1 }}
                    numberOfLines={1}
                  >
                    {promotionUsed || t('selectPromoOptional', language)}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  {promotionUsed && (
                    <Pressable
                      onPress={() => setPromotionUsed('')}
                      className="mr-2 p-1"
                    >
                      <X size={18} color={colors.textTertiary} />
                    </Pressable>
                  )}
                  <ChevronDown size={20} color={colors.textTertiary} />
                </View>
              </Pressable>

              {/* Promotion Dropdown */}
              {showPromotionPicker && (
                <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, marginTop: 8, maxHeight: 192, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {/* No Promotion Option */}
                    <Pressable
                      onPress={() => {
                        setPromotionUsed('');
                        setShowPromotionPicker(false);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} color={colors.textTertiary} />
                      </View>
                      <Text style={{ marginLeft: 12, color: colors.textTertiary, flex: 1, fontStyle: 'italic' }}>{t('noPromotion', language)}</Text>
                      {!promotionUsed && <Check size={18} color={primaryColor} />}
                    </Pressable>

                    {activePromotions.length > 0 ? (
                      activePromotions.map((promo) => (
                        <Pressable
                          key={promo.id}
                          onPress={() => {
                            setPromotionUsed(promo.name);
                            setShowPromotionPicker(false);
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                          <View
                            style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${promo.color || primaryColor}20` }}
                          >
                            <Gift size={16} color={promo.color || primaryColor} />
                          </View>
                          <View className="flex-1 ml-3">
                            <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>{promo.name}</Text>
                            {promo.description && (
                              <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>
                                {promo.description}
                              </Text>
                            )}
                          </View>
                          {promotionUsed === promo.name && <Check size={18} color={primaryColor} />}
                        </Pressable>
                      ))
                    ) : (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <Gift size={24} color={colors.textTertiary} />
                        <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>{t('noPromotionsAvailable', language)}</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                          {t('createPromotionsHint', language)}
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </Animated.View>

            {/* Gift Card (Optional) */}
            <Animated.View entering={SlideInUp.delay(225).duration(300)} className="mt-5">
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                {t('giftCardOptional', language)}
              </Text>
              <Pressable
                onPress={() => {
                  if (!selectedClientId) return;
                  setShowGiftCardPicker(!showGiftCardPicker);
                }}
                style={{
                  backgroundColor: colors.inputBackground,
                  borderWidth: 1,
                  borderColor: selectedGiftCardId ? primaryColor : colors.inputBorder,
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: selectedClientId ? 1 : 0.5,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <CreditCard size={20} color={selectedGiftCardId ? primaryColor : colors.textSecondary} />
                  <Text
                    style={{ marginLeft: 12, fontSize: 16, color: selectedGiftCardId ? colors.inputText : colors.inputPlaceholder, flex: 1 }}
                    numberOfLines={1}
                  >
                    {!selectedClientId
                      ? t('selectClientFirst', language)
                      : selectedGiftCardId
                        ? (() => {
                            const gc = activeClientGiftCards.find(g => g.id === selectedGiftCardId);
                            if (!gc) return selectedGiftCardId;
                            if (gc.type === 'service') {
                              const totalLeft = (gc.services ?? []).reduce((sum, s) => sum + Math.max(0, s.quantity - s.usedQuantity), 0);
                              return `${gc.code} · ${totalLeft} ${t('usesLeft', language)}`;
                            }
                            return `${gc.code} · ${currencySymbol}${(gc.currentBalance ?? 0).toFixed(2)}`;
                          })()
                        : t('noGiftCardOption', language)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {selectedGiftCardId && (
                    <Pressable
                      onPress={() => setSelectedGiftCardId(null)}
                      style={{ marginRight: 8, padding: 4 }}
                    >
                      <X size={18} color={colors.textTertiary} />
                    </Pressable>
                  )}
                  <ChevronDown size={20} color={colors.textTertiary} />
                </View>
              </Pressable>

              {/* Gift Card Dropdown */}
              {showGiftCardPicker && selectedClientId && (
                <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, marginTop: 8, maxHeight: 240, overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {/* No Gift Card Option */}
                    <Pressable
                      onPress={() => {
                        setSelectedGiftCardId(null);
                        setShowGiftCardPicker(false);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} color={colors.textTertiary} />
                      </View>
                      <Text style={{ marginLeft: 12, color: colors.textTertiary, flex: 1, fontStyle: 'italic' }}>{t('noGiftCardOption', language)}</Text>
                      {!selectedGiftCardId && <Check size={18} color={primaryColor} />}
                    </Pressable>

                    {activeClientGiftCards.length > 0 ? (
                      [...activeClientGiftCards]
                        .sort((a, b) => {
                          const scoreA = a.type === 'service'
                            ? ((a.services ?? []).some(s => s.quantity - s.usedQuantity > 0) ? 2 : 0)
                            : ((a.currentBalance ?? 0) > 0 ? 1 : 0);
                          const scoreB = b.type === 'service'
                            ? ((b.services ?? []).some(s => s.quantity - s.usedQuantity > 0) ? 2 : 0)
                            : ((b.currentBalance ?? 0) > 0 ? 1 : 0);
                          return scoreB - scoreA;
                        })
                        .map((gc) => {
                          const isSelected = selectedGiftCardId === gc.id;
                          const isService = gc.type === 'service';
                          return (
                            <Pressable
                              key={gc.id}
                              onPress={() => {
                                setSelectedGiftCardId(gc.id);
                                setShowGiftCardPicker(false);
                              }}
                              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                                  <CreditCard size={16} color={primaryColor} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{gc.code}</Text>
                                  {isService ? (
                                    <>
                                      <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                                        {t('servicesRemaining', language)}
                                      </Text>
                                      {(gc.services ?? []).map((svc, idx) => {
                                        const left = Math.max(0, svc.quantity - svc.usedQuantity);
                                        return (
                                          <Text key={idx} style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                                            {svc.serviceName} ({left}/{svc.quantity} {t('usesLeft', language)})
                                          </Text>
                                        );
                                      })}
                                    </>
                                  ) : (
                                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                                      {currencySymbol}{(gc.currentBalance ?? 0).toFixed(2)}
                                    </Text>
                                  )}
                                </View>
                                {isSelected && <Check size={18} color={primaryColor} />}
                              </View>
                            </Pressable>
                          );
                        })
                    ) : (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <CreditCard size={24} color={colors.textTertiary} />
                        <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>{t('noGiftCardsAvailable', language)}</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </Animated.View>

            {/* Notes */}
            <Animated.View entering={SlideInUp.delay(250).duration(300)} className="mt-5">
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>{t('notes', language)}</Text>
              <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16 }}>
                <View className="flex-row">
                  <FileText size={20} color={colors.textSecondary} />
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder={t('addNotesPlaceholder', language)}
                    multiline
                    numberOfLines={3}
                    style={{ flex: 1, marginLeft: 12, fontSize: 16, color: colors.inputText, textAlignVertical: 'top', minHeight: 80 }}
                    placeholderTextColor={colors.inputPlaceholder}
                    cursorColor={primaryColor}
                    selectionColor={`${primaryColor}40`}
                  />
                </View>
              </View>
            </Animated.View>

            {/* Date Picker */}
            <Animated.View entering={SlideInUp.delay(300).duration(300)} className="mt-5">
              <WheelDatePicker
                label={t('visitDate', language)}
                value={visitDate}
                onChange={setVisitDate}
                isOpen={showDatePicker}
                onToggle={() => setShowDatePicker(!showDatePicker)}
              />
            </Animated.View>
          </ScrollView>

          {/* Save Button */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handleSave}
              disabled={!canSave || isSaving}
              style={{ paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: (canSave && !isSaving) ? buttonColor : (isDark ? colors.backgroundTertiary : '#E2E8F0') }}
            >
              <Text style={{ fontWeight: '600', fontSize: 16, color: (canSave && !isSaving) ? '#fff' : colors.textTertiary }}>
                {isSaving ? t('saving', language) : t('save', language)}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
