import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { X, UserPlus } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useStore } from '@/lib/store';
import { formatPhoneNumber, validatePhoneNumber } from '@/lib/phone-utils';
import { useCreateClient } from '@/hooks/useClients';

export interface AddClientFormProps {
  visible: boolean;
  onSaved: (clientId: string) => void;
  onClose: () => void;
}

export function AddClientForm({ visible, onSaved, onClose }: AddClientFormProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const createClientMutation = useCreateClient();

  const [ncName, setNcName] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [ncNotes, setNcNotes] = useState('');
  const [ncErrors, setNcErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    setNcName('');
    setNcEmail('');
    setNcPhone('');
    setNcNotes('');
    setNcErrors({});
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSave = useCallback(async () => {
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
        onSaved(newClient.id);
      }
      resetForm();
    } catch (err: unknown) {
      const code = (err as any)?.code as string | undefined;
      const existingId = (err as any)?.existingClientId as string | undefined;
      if (code === 'CLIENT_EMAIL_DUPLICATE') {
        // Auto-reuse the existing client — do not block staff
        if (existingId) {
          console.log('[AddClientForm] Email duplicate — reusing existing client:', existingId);
          onSaved(existingId);
          resetForm();
        } else {
          setNcErrors({ email: t('duplicateEmail', language) });
        }
      } else if (code === 'CLIENT_PHONE_DUPLICATE') {
        // Auto-reuse the existing client for phone duplicate too
        if (existingId) {
          console.log('[AddClientForm] Phone duplicate — reusing existing client:', existingId);
          onSaved(existingId);
          resetForm();
        } else {
          setNcErrors({ phone: t('duplicatePhone', language) });
        }
      } else {
        setNcErrors({ general: t('failedToSaveClient', language) });
      }
    }
  }, [ncName, ncEmail, ncPhone, ncNotes, language, createClientMutation, resetForm, onSaved]);

  if (!visible) return null;

  return (
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
          onPress={handleClose}
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
            selectionColor={`${primaryColor}40`}
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
            onPress={handleSave}
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
  );
}
