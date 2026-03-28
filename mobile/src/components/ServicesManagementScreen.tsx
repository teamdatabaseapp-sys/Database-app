import React, { useState } from 'react';
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
  Edit3,
  Trash2,
  Sparkles,
  Check,
  Briefcase,
  Clock,
  DollarSign,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';
import { formatCurrency } from '@/lib/currency';
import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type SupabaseService,
} from '@/hooks/useServices';

// Duration presets in minutes
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

interface ServicesManagementScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function ServicesManagementScreen({ visible, onClose }: ServicesManagementScreenProps) {
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<SupabaseService | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [selectedColor, setSelectedColor] = useState(''); // Empty = use default teal
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState('1');
  const [customMinutes, setCustomMinutes] = useState('00');
  const [priceCents, setPriceCents] = useState(0);
  const [priceInput, setPriceInput] = useState('');

  const { colors, isDark, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);

  // Supabase hooks
  const { data: services = [], isLoading, error } = useServices();
  const createServiceMutation = useCreateService();
  const updateServiceMutation = useUpdateService();
  const deleteServiceMutation = useDeleteService();

  const resetForm = () => {
    setServiceName('');
    setSelectedColor(''); // Empty = use default teal
    setDurationMinutes(60);
    setShowCustomDuration(false);
    setCustomHours('1');
    setCustomMinutes('00');
    setPriceCents(0);
    setPriceInput('');
    setEditingService(null);
  };

  const openAddServiceModal = () => {
    resetForm();
    setShowAddServiceModal(true);
  };

  const openEditServiceModal = (service: SupabaseService) => {
    setEditingService(service);
    setServiceName(service.name);
    const duration = service.duration_minutes || 60;
    setDurationMinutes(duration);
    // Check if it's a custom duration
    if (!DURATION_PRESETS.includes(duration)) {
      setShowCustomDuration(true);
      setCustomHours(Math.floor(duration / 60).toString());
      setCustomMinutes((duration % 60).toString().padStart(2, '0'));
    } else {
      setShowCustomDuration(false);
    }
    const price = service.price_cents || 0;
    setPriceCents(price);
    setPriceInput(price > 0 ? (price / 100).toFixed(2) : '');
    setShowAddServiceModal(true);
  };

  const handleDurationSelect = (minutes: number) => {
    setDurationMinutes(minutes);
    setShowCustomDuration(false);
  };

  const handleCustomDurationChange = () => {
    const hours = parseInt(customHours) || 0;
    const mins = parseInt(customMinutes) || 0;
    const totalMinutes = hours * 60 + mins;
    if (totalMinutes >= 5 && totalMinutes <= 480) {
      setDurationMinutes(totalMinutes);
    }
  };

  const handlePriceChange = (text: string) => {
    // Allow only numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setPriceInput(cleaned);
    const value = parseFloat(cleaned) || 0;
    setPriceCents(Math.round(value * 100));
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    } else if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return hours === 1 ? '1 hr' : `${hours} hrs`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const handleSaveService = async () => {
    const trimmedName = serviceName.trim();
    if (!trimmedName) {
      Alert.alert(
        t('error', language) || 'Error',
        t('serviceNameRequired', language) || 'Please enter a service name'
      );
      return;
    }

    // Check for duplicate names (case-insensitive)
    const isDuplicate = services.some(
      (s) =>
        s.name.toLowerCase() === trimmedName.toLowerCase() &&
        (!editingService || s.id !== editingService.id)
    );

    if (isDuplicate) {
      Alert.alert(
        t('error', language) || 'Error',
        t('serviceNameExists', language) || 'A service with this name already exists'
      );
      return;
    }

    try {
      // Always use the app's primary theme color for services
      if (editingService) {
        // Update existing service
        await updateServiceMutation.mutateAsync({
          serviceId: editingService.id,
          updates: {
            name: trimmedName,
            color: primaryColor, // Always use primary theme color
            duration_minutes: durationMinutes,
            price_cents: priceCents,
          },
        });
        showSaveConfirmation();
      } else {
        // Create new service
        await createServiceMutation.mutateAsync({
          name: trimmedName,
          color: primaryColor, // Always use primary theme color
          duration_minutes: durationMinutes,
          price_cents: priceCents,
        });
        showSaveConfirmation();
      }

      setShowAddServiceModal(false);
      resetForm();
    } catch (err) {
      console.log('[ServicesManagementScreen] Error saving service:', err);
      Alert.alert(
        t('error', language) || 'Error',
        err instanceof Error ? err.message : t('failedToSaveService', language) || 'Failed to save service'
      );
    }
  };

  const handleDeleteService = (service: SupabaseService) => {
    Alert.alert(
      t('delete', language) || 'Delete Service',
      `Are you sure you want to delete "${service.name}"? This will hide it from future selections but preserve historical data.`,
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteServiceMutation.mutateAsync(service.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showSuccess(t('serviceDeleted', language) || 'Service deleted.');
            } catch (err) {
              console.log('[ServicesManagementScreen] Error deleting service:', err);
              Alert.alert(
                t('error', language) || 'Error',
                err instanceof Error ? err.message : t('failedToDeleteService', language) || 'Failed to delete service'
              );
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
          {/* Header - Icon left, title left-aligned, actions right */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Briefcase size={20} color={primaryColor} />
            </View>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text }}>
              {t('servicesTitle', language)}
            </Text>
            <Pressable
              onPress={openAddServiceModal}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <Plus size={24} color={primaryColor} />
            </Pressable>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Banner */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            style={{
              backgroundColor: `${primaryColor}10`,
              padding: 16,
              borderRadius: 12,
              marginBottom: 24,
              borderLeftWidth: 4,
              borderLeftColor: primaryColor,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
              {t('servicesInfoBanner', language)}
            </Text>
          </Animated.View>

          {/* Loading State */}
          {isLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={{ color: colors.textTertiary, marginTop: 12 }}>
                {t('loading', language)}
              </Text>
            </View>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: '#EF4444', fontSize: 14, textAlign: 'center' }}>
                {error instanceof Error ? error.message : 'Failed to load services'}
              </Text>
            </View>
          )}

          {/* Services List */}
          {!isLoading && !error && services.length === 0 ? (
            <Animated.View
              entering={FadeIn.delay(200).duration(300)}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 60,
              }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: `${primaryColor}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Sparkles size={36} color={primaryColor} />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                {t('noServicesYet', language)}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textTertiary,
                  textAlign: 'center',
                  paddingHorizontal: 32,
                  marginBottom: 24,
                }}
              >
                {t('noServicesDescription', language)}
              </Text>
              <Pressable
                onPress={openAddServiceModal}
                style={{
                  backgroundColor: primaryColor,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Plus size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                  {t('createFirstService', language)}
                </Text>
              </Pressable>
            </Animated.View>
          ) : !isLoading && !error && (
            <View style={{ gap: 8 }}>
              {services.map((service, index) => (
                <Animated.View
                  key={service.id}
                  entering={FadeInDown.delay(100 + index * 50).duration(300)}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 16,
                    }}
                  >
                    {/* Color indicator - uses primary theme color */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: `${primaryColor}20`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Sparkles size={20} color={primaryColor} />
                    </View>

                    {/* Service info */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: colors.text,
                        }}
                      >
                        {service.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Clock size={12} color={colors.textTertiary} />
                          <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 4 }}>
                            {formatDuration(service.duration_minutes || 60)}
                          </Text>
                        </View>
                        <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600' }}>
                          {service.price_cents > 0
                            ? formatCurrency(service.price_cents / 100, currency)
                            : t('freeLabel', language) || 'Free'}
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => openEditServiceModal(service)}
                        hitSlop={8}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: `${primaryColor}15`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Edit3 size={16} color={primaryColor} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteService(service)}
                        hitSlop={8}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: '#EF444415',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              ))}

              {/* Add Service Button */}
              <Animated.View
                entering={FadeInDown.delay(100 + services.length * 50).duration(300)}
              >
                <Pressable
                  onPress={openAddServiceModal}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderStyle: 'dashed',
                    marginTop: 8,
                  }}
                >
                  <Plus size={20} color={primaryColor} />
                  <Text
                    style={{
                      color: primaryColor,
                      fontWeight: '600',
                      fontSize: 15,
                      marginLeft: 8,
                    }}
                  >
                    {t('addService', language)}
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          )}
        </ScrollView>

        {/* Add/Edit Service Modal */}
        <Modal
          visible={showAddServiceModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddServiceModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
              {/* Modal Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <Pressable
                  onPress={() => {
                    setShowAddServiceModal(false);
                    resetForm();
                  }}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={24} color={colors.text} />
                </Pressable>
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                  {editingService ? t('editService', language) : t('addService', language)}
                </Text>
                <Pressable
                  onPress={handleSaveService}
                  hitSlop={8}
                  disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                  style={{
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: createServiceMutation.isPending || updateServiceMutation.isPending ? 0.5 : 1,
                  }}
                >
                  {createServiceMutation.isPending || updateServiceMutation.isPending ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <Check size={24} color={primaryColor} />
                  )}
                </Pressable>
              </View>
            </SafeAreaView>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Service Name Input */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  {t('serviceName', language)} *
                </Text>
                <TextInput
                  value={serviceName}
                  onChangeText={setServiceName}
                  placeholder={t('serviceNamePlaceholder', language) || 'Enter service name'}
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
                  }}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              {/* Duration Selection */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: 12,
                  }}
                >
                  <Clock size={14} color={colors.textSecondary} /> {t('durationLabel', language) || 'Duration'}
                </Text>

                {/* Duration Presets */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {DURATION_PRESETS.map((mins) => {
                    const isSelected = !showCustomDuration && durationMinutes === mins;
                    return (
                      <Pressable
                        key={mins}
                        onPress={() => handleDurationSelect(mins)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 8,
                          backgroundColor: isSelected ? primaryColor : colors.card,
                          borderWidth: 1,
                          borderColor: isSelected ? primaryColor : colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#FFFFFF' : colors.text,
                            fontWeight: isSelected ? '600' : '400',
                            fontSize: 14,
                          }}
                        >
                          {formatDuration(mins)}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {/* Custom Duration Button */}
                  <Pressable
                    onPress={() => setShowCustomDuration(true)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: showCustomDuration ? primaryColor : colors.card,
                      borderWidth: 1,
                      borderColor: showCustomDuration ? primaryColor : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: showCustomDuration ? '#FFFFFF' : colors.text,
                        fontWeight: showCustomDuration ? '600' : '400',
                        fontSize: 14,
                      }}
                    >
                      {t('custom', language) || 'Custom'}
                    </Text>
                  </Pressable>
                </View>

                {/* Custom Duration Input */}
                {showCustomDuration && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.card,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                      gap: 8,
                    }}
                  >
                    <TextInput
                      value={customHours}
                      onChangeText={(text) => {
                        const num = text.replace(/[^0-9]/g, '');
                        if (parseInt(num) <= 8 || num === '') {
                          setCustomHours(num);
                        }
                      }}
                      onBlur={handleCustomDurationChange}
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={{
                        width: 50,
                        textAlign: 'center',
                        fontSize: 24,
                        fontWeight: '600',
                        color: colors.text,
                        backgroundColor: isDark ? colors.backgroundTertiary : '#F3F4F6',
                        borderRadius: 8,
                        paddingVertical: 8,
                      }}
                    />
                    <Text style={{ fontSize: 16, color: colors.textSecondary }}>h</Text>
                    <Text style={{ fontSize: 24, fontWeight: '300', color: colors.textTertiary }}>:</Text>
                    <TextInput
                      value={customMinutes}
                      onChangeText={(text) => {
                        const num = text.replace(/[^0-9]/g, '');
                        if (parseInt(num) <= 59 || num === '') {
                          setCustomMinutes(num.slice(0, 2));
                        }
                      }}
                      onBlur={() => {
                        setCustomMinutes(customMinutes.padStart(2, '0'));
                        handleCustomDurationChange();
                      }}
                      placeholder="00"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{
                        width: 60,
                        textAlign: 'center',
                        fontSize: 24,
                        fontWeight: '600',
                        color: colors.text,
                        backgroundColor: isDark ? colors.backgroundTertiary : '#F3F4F6',
                        borderRadius: 8,
                        paddingVertical: 8,
                      }}
                    />
                    <Text style={{ fontSize: 16, color: colors.textSecondary }}>min</Text>
                  </View>
                )}
              </View>

              {/* Price Input */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  <DollarSign size={14} color={colors.textSecondary} /> {t('priceLabel', language) || 'Price'}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 18, marginRight: 4 }}>$</Text>
                  <TextInput
                    value={priceInput}
                    onChangeText={handlePriceChange}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      fontSize: 16,
                      color: colors.text,
                    }}
                  />
                  {priceCents === 0 && (
                    <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                      ({t('freeLabel', language) || 'Free'})
                    </Text>
                  )}
                </View>
              </View>

            </ScrollView>

            {/* Save Button */}
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
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                      {editingService ? t('saveChanges', language) : t('createService', language)}
                    </Text>
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}
