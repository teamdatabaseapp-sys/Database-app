/**
 * ServicesProductsScreen
 *
 * Unified screen with 2 tabs: Services | Products
 * Manages service offerings and products for business setup.
 * Matches the exact same layout/design as Stores & Staff screen.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Check,
  Sparkles,
  Package,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { RowActionButtons } from '@/components/stores/RowActionButtons';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { getCurrencyForCountry } from '@/lib/country-legal-compliance';
import { getCurrencySymbol } from '@/lib/currency';
import { CountryCode } from '@/lib/types';
import { SetupHint } from '@/components/SetupHint';
import { HighlightWrapper } from '@/components/HighlightWrapper';

// Supabase hooks
import { useServices, useCreateService, useUpdateService, useDeleteService, type SupabaseService } from '@/hooks/useServices';
import { useBusiness } from '@/hooks/useBusiness';

// Service color constants
import { DEFAULT_SERVICE_COLOR, SERVICE_COLORS } from '@/lib/serviceColors';

// ============================================
// Constants
// ============================================

type TabType = 'services' | 'products';

// ============================================
// Main Component
// ============================================

interface ServicesProductsScreenProps {
  visible: boolean;
  onClose: () => void;
  setupHint?: string;
}

export function ServicesProductsScreen({ visible, onClose, setupHint }: ServicesProductsScreenProps) {
  const [activeTab, setActiveTab] = useTabPersistence<TabType>('services_products', 'services');

  const scrollRef = useRef<ScrollView>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightY, setHighlightY] = useState(0);

  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] ServicesProductsScreen hint:', setupHint);
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(0, highlightY - 80), animated: true });
        }
      } catch (e) {
        console.warn('[SetupHint] scroll failed safely', e);
      }
      setHighlightActive(true);
      fadeTimer = setTimeout(() => {
        if (mounted) setHighlightActive(false);
      }, 2500);
    }, 450);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (fadeTimer !== null) clearTimeout(fadeTimer);
    };
  }, [setupHint, highlightY, visible]);

  // Service form state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<SupabaseService | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [selectedServiceColor, setSelectedServiceColor] = useState(''); // empty = use default teal
  const [serviceDuration, setServiceDuration] = useState('60'); // minutes
  const [servicePrice, setServicePrice] = useState(''); // in dollars (will convert to cents)
  const [serviceType, setServiceType] = useState<'service' | 'product'>('service');

  const { colors, isDark, primaryColor } = useTheme();
  const { showSaveConfirmation } = useSaveConfirmation();
  const { showSuccess } = useToast();
  const language = useStore((s) => s.language) as Language;

  // Supabase hooks
  const { businessId, business } = useBusiness();

  // Get currency from business country
  const businessCountry = (business?.business_country as CountryCode) || 'US';
  const currencyCode = getCurrencyForCountry(businessCountry);
  const currencySymbol = getCurrencySymbol(currencyCode);

  const { data: allServices = [], isLoading: servicesLoading, refetch: refetchServices } = useServices();
  const createServiceMutation = useCreateService();
  const updateServiceMutation = useUpdateService();
  const deleteServiceMutation = useDeleteService();

  // Split services into services and products
  const services = useMemo(() => {
    return allServices.filter((s) => {
      const svcType = (s as unknown as { service_type?: string }).service_type;
      return svcType !== 'product';
    });
  }, [allServices]);

  const products = useMemo(() => {
    return allServices.filter((s) => {
      const svcType = (s as unknown as { service_type?: string }).service_type;
      return svcType === 'product';
    });
  }, [allServices]);

  // ============================================
  // Service Handlers
  // ============================================

  const resetServiceForm = () => {
    setServiceName('');
    setServiceDescription('');
    setSelectedServiceColor(''); // Empty = use default teal
    setServiceDuration('60');
    setServicePrice('');
    setServiceType('service');
    setEditingService(null);
  };

  const openAddServiceModal = () => {
    resetServiceForm();
    // Set service type based on active tab
    setServiceType(activeTab === 'products' ? 'product' : 'service');
    setShowServiceModal(true);
  };

  const openEditServiceModal = (service: SupabaseService) => {
    setEditingService(service);
    setServiceName(service.name);
    setServiceDescription(service.description || '');
    // Only set custom color if it's different from default teal
    const customColor = service.color && service.color !== DEFAULT_SERVICE_COLOR ? service.color : '';
    setSelectedServiceColor(customColor);
    setServiceDuration(String(service.duration_minutes || 60));
    setServicePrice(service.price_cents ? String(service.price_cents / 100) : '');
    const svcType = (service as unknown as { service_type?: string }).service_type;
    setServiceType((svcType === 'product' ? 'product' : 'service'));
    setShowServiceModal(true);
  };

  const handleSaveService = async () => {
    const trimmedName = serviceName.trim();
    if (!trimmedName) {
      Alert.alert(t('error', language), t('serviceNameRequired', language));
      return;
    }

    const isDuplicate = allServices.some(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase() && (!editingService || s.id !== editingService.id)
    );
    if (isDuplicate) {
      Alert.alert(t('error', language), t('serviceNameExists', language));
      return;
    }

    // Parse and validate duration (only required for service type)
    const durationMinutes = parseInt(serviceDuration, 10) || 60;
    if (serviceType === 'service' && (durationMinutes < 5 || durationMinutes > 480)) {
      Alert.alert(t('error', language), 'Duration must be between 5 and 480 minutes');
      return;
    }

    // Parse price (convert dollars to cents)
    const priceDollars = parseFloat(servicePrice) || 0;
    const priceCents = Math.round(priceDollars * 100);

    // For products, duration is optional (default to 0)
    const finalDuration = serviceType === 'product' ? 0 : durationMinutes;

    // Check if business context is ready
    if (!businessId) {
      console.log('[ServicesProductsScreen] Cannot save service - no businessId');
      Alert.alert(t('error', language), t('failedToSaveService', language));
      return;
    }

    try {
      // Always use primary theme color for services
      const trimmedDescription = serviceDescription.trim() || null;
      if (editingService) {
        await updateServiceMutation.mutateAsync({
          serviceId: editingService.id,
          updates: {
            name: trimmedName,
            description: trimmedDescription,
            color: primaryColor, // Always use primary theme color
            duration_minutes: finalDuration,
            price_cents: priceCents,
            currency_code: currencyCode,
            service_type: serviceType,
          },
        });
      } else {
        console.log('[ServicesProductsScreen] Creating service with businessId:', businessId, 'currency:', currencyCode, 'type:', serviceType);
        await createServiceMutation.mutateAsync({
          name: trimmedName,
          description: trimmedDescription,
          color: primaryColor, // Always use primary theme color
          duration_minutes: finalDuration,
          price_cents: priceCents,
          currency_code: currencyCode,
          service_type: serviceType,
        });
      }
      setShowServiceModal(false);
      resetServiceForm();
      // Explicitly refetch to ensure list updates immediately
      await refetchServices();
      // Show centered success overlay with checkmark, sound, and haptic
      showSaveConfirmation();
    } catch (err) {
      console.log('[ServicesProductsScreen] Error saving service:', err);
      Alert.alert(t('error', language), t('failedToSaveService', language));
    }
  };

  const handleDeleteService = (service: SupabaseService) => {
    Alert.alert(t('delete', language), t('deleteStaffConfirm', language).replace('{name}', service.name), [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('delete', language),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteServiceMutation.mutateAsync(service.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showSuccess(t('serviceDeleted', language));
          } catch (err) {
            Alert.alert(t('error', language), t('failedToDeleteService', language));
          }
        },
      },
    ]);
  };

  // ============================================
  // Render
  // ============================================

  if (!visible) return null;

  const isLoading = servicesLoading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
        {/* Header - same as Stores & Staff */}
        <Animated.View
          entering={FadeIn.duration(300)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Sparkles size={18} color={primaryColor} />
            </View>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
              {t('servicesAndProducts', language)}
            </Text>
          </View>
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={24} color={colors.text} />
          </Pressable>
        </Animated.View>

        {/* Segmented Switch — matches Stores & Staff / Staff Calendar */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              borderRadius: 12,
              padding: 4,
            }}
          >
            {(['services', 'products'] as TabType[]).map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === 'services'
                ? `${t('servicesTitle', language) || 'Services'} (${services.length})`
                : `${t('product', language) || 'Product'}s (${products.length})`;

              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    backgroundColor: isActive ? colors.card : 'transparent',
                    shadowColor: isActive ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isActive ? 0.08 : 0,
                    shadowRadius: 2,
                    elevation: isActive ? 2 : 0,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: isActive ? '600' : '500',
                      fontSize: 14,
                      color: isActive ? colors.text : colors.textSecondary,
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <SetupHint hintKey={setupHint} />
          {isLoading && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          )}

          {/* ============================================ */}
          {/* SERVICES TAB */}
          {/* ============================================ */}
          {!isLoading && activeTab === 'services' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Add Button - same style as Stores & Staff */}
              <HighlightWrapper
                active={highlightActive}
                borderRadius={12}
                onLayout={(e) => setHighlightY(e.nativeEvent.layout.y)}
              >
              <Pressable
                onPress={openAddServiceModal}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: `${primaryColor}10`,
                  marginBottom: 16,
                }}
              >
                <Plus size={20} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>{t('addService', language)}</Text>
              </Pressable>
              </HighlightWrapper>

              {services.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Sparkles size={48} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginTop: 12 }}>{t('noServicesYet', language)}</Text>
                </View>
              ) : (
                services.map((service, index) => (
                  <Animated.View
                    key={service.id}
                    entering={FadeInDown.delay(index * 50).duration(300)}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      marginBottom: 10,
                      paddingVertical: 16,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: `${primaryColor}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Sparkles size={20} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 3 }}>
                        {t('service', language)}
                      </Text>
                      {(service.duration_minutes || service.price_cents) ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                            {service.duration_minutes ? `${service.duration_minutes} ${t('minutesUnit', language)}` : ''}
                          </Text>
                          {service.price_cents ? (
                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                              {currencySymbol}{(service.price_cents / 100).toFixed(2)}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                    <RowActionButtons
                      onEdit={() => openEditServiceModal(service)}
                      onDelete={() => handleDeleteService(service)}
                    />
                  </Animated.View>
                ))
              )}
            </Animated.View>
          )}

          {/* ============================================ */}
          {/* PRODUCTS TAB */}
          {/* ============================================ */}
          {!isLoading && activeTab === 'products' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Add Button - same style as Stores & Staff */}
              <Pressable
                onPress={openAddServiceModal}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: `${primaryColor}10`,
                  marginBottom: 16,
                }}
              >
                <Plus size={20} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '600', marginLeft: 8 }}>{t('addProduct', language)}</Text>
              </Pressable>

              {products.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Package size={48} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginTop: 12 }}>{t('noProductsYet', language)}</Text>
                </View>
              ) : (
                products.map((product, index) => (
                  <Animated.View
                    key={product.id}
                    entering={FadeInDown.delay(index * 50).duration(300)}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      marginBottom: 10,
                      paddingVertical: 16,
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: `${primaryColor}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Package size={20} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{product.name}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 3 }}>
                        {t('product', language)}
                      </Text>
                      {product.price_cents ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 }}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                            {currencySymbol}{(product.price_cents / 100).toFixed(2)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <RowActionButtons
                      onEdit={() => openEditServiceModal(product)}
                      onDelete={() => handleDeleteService(product)}
                    />
                  </Animated.View>
                ))
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* ============================================ */}
        {/* ADD/EDIT SERVICE MODAL */}
        {/* ============================================ */}
        <Modal visible={showServiceModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowServiceModal(false)}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: `${primaryColor}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 10,
                    }}
                  >
                    {serviceType === 'product' ? (
                      <Package size={18} color={primaryColor} />
                    ) : (
                      <Sparkles size={18} color={primaryColor} />
                    )}
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                    {editingService
                      ? (serviceType === 'product' ? t('editProduct', language) : t('editService', language))
                      : (serviceType === 'product' ? t('addProduct', language) : t('addService', language))}
                  </Text>
                </View>
                <Pressable onPress={() => { setShowServiceModal(false); resetServiceForm(); }} style={{ padding: 4 }}>
                  <X size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
            </SafeAreaView>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              {/* Name */}
              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 }}>
                {serviceType === 'product' ? t('productName', language) : t('serviceName', language)}
              </Text>
              <TextInput
                value={serviceName}
                onChangeText={setServiceName}
                placeholder={serviceType === 'product' ? t('productNamePlaceholder', language) : t('serviceNamePlaceholder', language)}
                placeholderTextColor={colors.textTertiary}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: colors.text,
                  marginBottom: 24,
                }}
                autoFocus
              />

              {/* Description (Optional) - Only for services */}
              {serviceType === 'service' && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 }}>
                    {t('description', language)} ({t('optional', language)})
                  </Text>
                  <TextInput
                    value={serviceDescription}
                    onChangeText={setServiceDescription}
                    placeholder="Describe this service..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 16,
                      color: colors.text,
                      minHeight: 80,
                    }}
                  />
                </View>
              )}

              {/* Duration - Only show for services */}
              {serviceType === 'service' && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 }}>
                    {t('durationLabel', language)} ({t('minutesUnit', language)}) *
                  </Text>
                  <TextInput
                    value={serviceDuration}
                    onChangeText={setServiceDuration}
                    placeholder="60"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 16,
                      color: colors.text,
                    }}
                  />
                </View>
              )}

              {/* Price */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 }}>
                  {t('priceLabel', language)} ({currencySymbol} {currencyCode})
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginRight: 8,
                    minWidth: 24,
                  }}>
                    {currencySymbol}
                  </Text>
                  <TextInput
                    value={servicePrice}
                    onChangeText={setServicePrice}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 16,
                      color: colors.text,
                    }}
                  />
                </View>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
                  {language === 'es' ? 'Dejar vacío para gratis' :
                   language === 'fr' ? 'Laisser vide pour gratuit' :
                   language === 'pt' ? 'Deixar vazio para grátis' :
                   language === 'de' ? 'Leer lassen für kostenlos' :
                   'Leave empty for free'}
                </Text>
              </View>
            </ScrollView>
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
              <View style={{ padding: 16 }}>
                <Pressable
                  onPress={handleSaveService}
                  disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                  style={{
                    backgroundColor: primaryColor,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    opacity: createServiceMutation.isPending || updateServiceMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {createServiceMutation.isPending || updateServiceMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                      {editingService ? t('saveChanges', language) : (serviceType === 'product' ? t('createProduct', language) : t('createService', language))}
                    </Text>
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
