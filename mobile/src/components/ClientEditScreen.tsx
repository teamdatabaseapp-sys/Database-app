import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, UserPlus } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { formatPhoneNumber, formatPhoneDisplay, validatePhoneNumber } from '@/lib/phone-utils';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useClient, useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { useBusiness } from '@/hooks/useBusiness';
import { HighlightWrapper } from '@/components/HighlightWrapper';
import { SetupHint } from '@/components/SetupHint';

interface ClientEditScreenProps {
  clientId?: string; // undefined means new client
  visible: boolean; // Add visible prop for modal control
  onBack: () => void;
  onSave: () => void;
  onSaveWithId?: (newClientId: string) => void; // optional: called with new client id after creation
  setupHint?: string;
}

export function ClientEditScreen({ clientId, visible, onBack, onSave, onSaveWithId, setupHint }: ClientEditScreenProps) {
  const language = useStore((s) => s.language) as Language;
  const { colors, isDark, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();

  // Highlight state for setupHint
  const [highlightActive, setHighlightActive] = useState(false);
  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] ClientEditScreen hint:', setupHint);
    const timer = setTimeout(() => {
      if (!mounted) return;
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
  }, [setupHint, visible]);

  // Business context
  const { businessId, isInitialized: businessInitialized } = useBusiness();

  // Fetch existing client if editing
  const { data: existingClient, isLoading: isLoadingClient } = useClient(clientId);

  // Mutations
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!clientId;
  const isLoading = createClientMutation.isPending || updateClientMutation.isPending;

  // Initialize form when existing client is loaded
  useEffect(() => {
    if (existingClient) {
      setName(existingClient.name || '');
      setEmail(existingClient.email || '');
      setPhone(existingClient.phone ? formatPhoneDisplay(existingClient.phone) : '');
      setNotes(existingClient.notes || '');
    }
  }, [existingClient]);

  // Reset form when modal closes or clientId changes
  useEffect(() => {
    if (!visible) {
      // Reset form when modal closes
      if (!clientId) {
        setName('');
        setEmail('');
        setPhone('');
        setNotes('');
        setErrors({});
      }
    }
  }, [visible, clientId]);

  const resetAndClose = useCallback(() => {
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setErrors({});
    onBack();
  }, [onBack]);

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(formatPhoneNumber(text));
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('required', language);
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('invalidEmail', language);
    }
    if (phone.trim() && !validatePhoneNumber(phone)) {
      newErrors.phone = t('invalidPhone', language);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    if (!businessId) {
      console.log('[ClientEditScreen] No business_id, cannot save');
      setErrors({ general: t('failedToSaveClient', language) });
      return;
    }

    try {
      if (isEditing && clientId) {
        console.log('[ClientEditScreen] Updating client:', clientId);
        await updateClientMutation.mutateAsync({
          clientId,
          updates: {
            name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            notes: notes.trim() || null,
          },
        });
        console.log('[ClientEditScreen] Client updated successfully');
      } else {
        console.log('[ClientEditScreen] Creating new client');
        const newClient = await createClientMutation.mutateAsync({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
        });
        console.log('[ClientEditScreen] Client created successfully');
        if (newClient?.id && onSaveWithId) {
          onSaveWithId(newClient.id);
        }
      }

      showSaveConfirmation();
      onSave();
    } catch (error: unknown) {
      const code = (error as any)?.code as string | undefined;
      if (code === 'CLIENT_EMAIL_DUPLICATE') {
        console.log('[ClientEditScreen] Duplicate email — reusing existing client');
        const existingId = (error as any).existingClientId as string | undefined;
        if (existingId && onSaveWithId) {
          // Redirect immediately to the existing client's profile
          showSuccess(t('duplicateEmail', language));
          onSaveWithId(existingId);
        } else {
          setErrors({ email: t('duplicateEmail', language) });
        }
      } else if (code === 'CLIENT_PHONE_DUPLICATE') {
        console.log('[ClientEditScreen] Duplicate phone — reusing existing client');
        const existingId = (error as any).existingClientId as string | undefined;
        if (existingId && onSaveWithId) {
          showSuccess(t('duplicatePhone', language));
          onSaveWithId(existingId);
        } else {
          setErrors({ phone: t('duplicatePhone', language) });
        }
      } else {
        console.log('[ClientEditScreen] Unexpected error saving client:', error);
        setErrors({ general: t('failedToSaveClient', language) });
      }
    }
  };

  // Show loading while fetching existing client
  if (isEditing && isLoadingClient) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetAndClose}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
              {t('loading', language)}...
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Show error if no business context
  if (!businessInitialized || !businessId) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetAndClose}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
              No Business Found
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              Please sign out and sign in again to set up your business.
            </Text>
            <Pressable
              onPress={resetAndClose}
              style={{ backgroundColor: primaryColor, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

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
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <UserPlus size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                {isEditing ? t('editClient', language) : t('addClient', language)}
              </Text>
            </View>
            <Pressable
              onPress={resetAndClose}
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

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* General Error */}
            {errors.general && (
              <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: 16 }}>
                <Text style={{ color: '#EF4444', textAlign: 'center' }}>{errors.general}</Text>
              </Animated.View>
            )}

            {/* Setup hint — shown when opened from Business Setup hub */}
            <SetupHint hintKey={setupHint} topMargin={-4} />

            {/* Form Fields */}
            <HighlightWrapper active={highlightActive && setupHint === 'firstClient'} borderRadius={16}>
            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text
                style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 16 }}
              >
                {t('clientInformation', language)}
              </Text>

              <Input
                label={t('name', language)}
                placeholder={t('namePlaceholder', language)}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                error={errors.name}
              />

              <Input
                label={`${t('email', language)} (${t('optional', language) || 'optional'})`}
                placeholder={t('emailPlaceholder', language)}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />

              <Input
                label={`${t('phone', language)} (${t('optional', language) || 'optional'})`}
                placeholder={t('phonePlaceholder', language)}
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                error={errors.phone}
              />

              <Input
                label={`${t('notes', language)} (${t('optional', language) || 'optional'})`}
                placeholder={t('notesPlaceholder', language)}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                className="h-24 py-3"
                containerClassName="mb-0"
              />
            </Animated.View>
            </HighlightWrapper>

            {/* Save Button */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mt-6">
              <Button title={t('save', language)} onPress={handleSave} loading={isLoading} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
