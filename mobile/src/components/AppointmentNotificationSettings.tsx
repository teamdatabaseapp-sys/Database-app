import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Clock,
  Check,
  CalendarCheck,
  CalendarX,
  RefreshCw,
  AlertCircle,
  Gift,
  Star,
  CreditCard,
  MessageCircle,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language, AppointmentNotificationSettings as NotificationSettings } from '@/lib/types';
import { useStore } from '@/lib/store';
import { LocalSuccessToast } from './LocalSuccessToast';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** When true, renders flat content without a Modal wrapper — for embedding in a tab */
  embedded?: boolean;
  /** Optional content to render at the top of the scroll view (embedded mode only) */
  headerContent?: React.ReactNode;
  /** Optional additional save handler called alongside the notification settings save */
  onSave?: () => void | Promise<void>;
  /** When true, show loading indicator on Save button (from parent save operation) */
  isSavingExternal?: boolean;
  /** When true, the compliance fields in headerContent have unsaved changes */
  externalHasChanges?: boolean;
}

const REMINDER_TIMING_OPTIONS = [
  { value: '24h' as const },
  { value: '2h' as const },
  { value: 'custom' as const },
];

export function AppointmentNotificationSettings({ visible, onClose, embedded, headerContent, onSave, isSavingExternal, externalHasChanges }: Props) {
  const { colors, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const getSettings = useStore((s) => s.getAppointmentNotificationSettings);
  const updateSettings = useStore((s) => s.updateAppointmentNotificationSettings);

  const [localSettings, setLocalSettings] = useState<NotificationSettings>(() => getSettings());
  const [customHours, setCustomHours] = useState<string>('12');
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    if (visible || embedded) {
      const settings = getSettings();
      setLocalSettings(settings);
      if (settings.customReminderHours) {
        setCustomHours(settings.customReminderHours.toString());
      }
    }
  }, [visible, embedded, getSettings]);

  const hasUnsavedChanges = useMemo(() => {
    const current = getSettings();
    const notifChanged = JSON.stringify(current) !== JSON.stringify(localSettings);
    const result = notifChanged || (externalHasChanges ?? false);
    console.log('[Notifications] hasUnsavedChanges:', result, '| notifChanged:', notifChanged, '| externalHasChanges:', externalHasChanges);
    return result;
  }, [localSettings, getSettings, externalHasChanges]);

  const handleSave = async () => {
    console.log('[Notifications] Save button pressed');
    const settingsToSave: NotificationSettings = {
      ...localSettings,
      customReminderHours:
        localSettings.reminderTiming === 'custom' ? parseInt(customHours) || 12 : undefined,
    };
    updateSettings(settingsToSave);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (onSave) await onSave();
    setShowSavedToast(true);
    if (!embedded) {
      setTimeout(() => onClose(), 500);
    }
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setReminderTiming = (timing: '24h' | '2h' | 'custom') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalSettings((prev) => ({ ...prev, reminderTiming: timing }));
  };

  // Circular checkmark row — same control as Appointments toggle in Settings
  const SettingRow = ({
    icon: Icon,
    title,
    description,
    settingKey,
    isLast = false,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
    settingKey: keyof NotificationSettings;
    isLast?: boolean;
  }) => {
    const value = !!localSettings[settingKey];
    return (
      <Pressable
        onPress={() => toggleSetting(settingKey)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 16,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.border,
        }}
      >
        {/* Icon — always primaryColor */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: `${primaryColor}15`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Icon size={20} color={primaryColor} />
        </View>
        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>{title}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{description}</Text>
        </View>
        {/* Circular checkmark */}
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            borderColor: value ? primaryColor : colors.border,
            backgroundColor: value ? primaryColor : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value && <Check size={15} color="#fff" strokeWidth={3} />}
        </View>
      </Pressable>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <View style={{ paddingTop: 20, paddingBottom: 8 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );

  const scrollBody = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {headerContent}
      {headerContent && (
        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 8 }} />
      )}
      {/* Info Banner */}
      <View
        style={{
          backgroundColor: `${primaryColor}10`,
          padding: 14,
          borderRadius: 12,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <AlertCircle size={18} color={primaryColor} style={{ marginTop: 2 }} />
        <Text style={{ fontSize: 13, color: colors.text, marginLeft: 10, flex: 1, lineHeight: 18 }}>
          Automatically send branded emails and notifications to clients for appointments, gift cards, loyalty points, memberships, and all online communications.
        </Text>
      </View>

      {/* ── Gift Cards ── */}
      <SectionLabel label="Gift Cards" />
      <Animated.View
        entering={FadeInDown.delay(60).duration(300)}
        style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16 }}
      >
        <SettingRow
          icon={Gift}
          title="Gift Card Emails"
          description="Send when a gift card is issued to a client"
          settingKey="enableGiftCardEmail"
          isLast
        />
      </Animated.View>

      {/* ── Loyalty ── */}
      <SectionLabel label="Loyalty" />
      <Animated.View
        entering={FadeInDown.delay(120).duration(300)}
        style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16 }}
      >
        <SettingRow
          icon={Star}
          title="Loyalty Points Emails"
          description="Send when clients earn or redeem loyalty points"
          settingKey="enableLoyaltyEmail"
          isLast
        />
      </Animated.View>

      {/* ── Memberships ── */}
      <SectionLabel label="Memberships" />
      <Animated.View
        entering={FadeInDown.delay(180).duration(300)}
        style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16 }}
      >
        <SettingRow
          icon={CreditCard}
          title="Membership Emails"
          description="Send when a membership is activated or renewed"
          settingKey="enableMembershipEmail"
          isLast
        />
      </Animated.View>

      {/* ── General ── */}
      <SectionLabel label="General" />
      <Animated.View
        entering={FadeInDown.delay(240).duration(300)}
        style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16 }}
      >
        <SettingRow
          icon={MessageCircle}
          title="General Client Communications"
          description="Send other automated messages to clients"
          settingKey="enableGeneralCommsEmail"
          isLast
        />
      </Animated.View>

      {/* ── Appointments ── */}
      <SectionLabel label="Appointments" />
      <Animated.View
        entering={FadeInDown.delay(300).duration(300)}
        style={{ backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 16 }}
      >
        <SettingRow
          icon={CalendarCheck}
          title={t('confirmationEmail', language) || 'Appointment Confirmation'}
          description={t('confirmationEmailDesc', language) || 'Send when appointment is booked'}
          settingKey="enableConfirmationEmail"
        />
        <SettingRow
          icon={RefreshCw}
          title={t('updateEmail', language) || 'Appointment Update'}
          description={t('updateEmailDesc', language) || 'Send when appointment is changed'}
          settingKey="enableUpdateEmail"
        />
        <SettingRow
          icon={CalendarX}
          title={t('cancellationEmail', language) || 'Appointment Cancellation'}
          description={t('cancellationEmailDesc', language) || 'Send when appointment is cancelled'}
          settingKey="enableCancellationEmail"
        />
        <SettingRow
          icon={Clock}
          title={t('reminderEmail', language) || 'Appointment Reminder'}
          description={t('reminderEmailDesc', language) || 'Send before appointment starts'}
          settingKey="enableReminderEmail"
          isLast
        />
      </Animated.View>

      {/* Reminder Timing */}
      {localSettings.enableReminderEmail && (
        <Animated.View entering={FadeIn.duration(200)}>
          <SectionLabel label={t('reminderTiming', language) || 'Reminder Timing'} />
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginBottom: 20,
            }}
          >
            {REMINDER_TIMING_OPTIONS.map((option, index) => {
              const isSelected = localSettings.reminderTiming === option.value;
              const isLast = index === REMINDER_TIMING_OPTIONS.length - 1;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setReminderTiming(option.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.border,
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
                    {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      color: isSelected ? colors.text : colors.textSecondary,
                      fontWeight: isSelected ? '500' : '400',
                    }}
                  >
                    {option.value === '24h' && (t('twentyFourHoursBefore', language) || '24 hours before')}
                    {option.value === '2h' && (t('twoHoursBefore', language) || '2 hours before')}
                    {option.value === 'custom' && (t('customTiming', language) || 'Custom')}
                  </Text>
                </Pressable>
              );
            })}
            {localSettings.reminderTiming === 'custom' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}
              >
                <TextInput
                  value={customHours}
                  onChangeText={(text) => setCustomHours(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={3}
                  style={{
                    backgroundColor: colors.backgroundTertiary,
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    color: colors.text,
                    fontSize: 16,
                    width: 70,
                    textAlign: 'center',
                  }}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 10 }}>
                  {t('hoursBefore', language) || 'hours before'}
                </Text>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      )}

      {/* Compliance Note */}
      <View
        style={{
          backgroundColor: colors.backgroundTertiary,
          padding: 14,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
          {t('notificationComplianceNote', language) ||
            'All emails include an unsubscribe link and comply with CAN-SPAM regulations. Clients who have opted out will not receive notifications.'}
        </Text>
      </View>
    </ScrollView>
  );

  // Save button — shared between embedded and standalone usage
  const isSaving = isSavingExternal ?? false;
  const saveButton = (
    <View
      style={{
        padding: 20,
        paddingBottom: 30,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <Pressable
        onPress={handleSave}
        disabled={isSaving || !hasUnsavedChanges}
        style={{
          backgroundColor: hasUnsavedChanges && !isSaving ? primaryColor : colors.backgroundTertiary,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Check size={20} color={hasUnsavedChanges ? '#fff' : colors.textSecondary} />
        )}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: hasUnsavedChanges && !isSaving ? '#fff' : colors.textSecondary,
            marginLeft: 8,
          }}
        >
          {isSaving ? (t('saving', language) || 'Saving...') : (t('saveChanges', language) || 'Save Changes')}
        </Text>
      </Pressable>
    </View>
  );

  // Embedded mode: flat content, no Modal
  if (embedded) {
    return (
      <>
        {scrollBody}
        {saveButton}
        <LocalSuccessToast
          visible={showSavedToast}
          message={t('settingsSaved', language) || 'Settings saved'}
          onHide={() => setShowSavedToast(false)}
        />
      </>
    );
  }

  // This component is now always used embedded inside BusinessBrandingSettings.
  // Returning null for the standalone Modal path keeps backwards-compat without dead code.
  return null;
}
