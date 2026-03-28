/**
 * Email Templates Settings Component
 *
 * Allows business owners to:
 * - View and customize email templates (confirmation, cancellation, rescheduled, reminder)
 * - Toggle templates on/off
 * - Edit subject and body with placeholders
 * - Preview templates with sample data
 * - Reset to defaults
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  X,
  Mail,
  Check,
  ChevronRight,
  RotateCcw,
  Edit3,
  Bell,
  CalendarCheck,
  CalendarX,
  Star,
  Gift,
  Tag,
  Award,
  CreditCard,
  Repeat,
} from 'lucide-react-native';

import { useLanguage } from '@/lib/useLanguage';
import { useBusiness } from '@/hooks/useBusiness';
import { t } from '@/lib/i18n';
import {
  type EmailTemplateType,
  type EmailTemplate,
  getEmailTemplates,
  upsertEmailTemplate,
  resetTemplateToDefaults,
  DEFAULT_TEMPLATES,
  TEMPLATE_PLACEHOLDERS,
  previewTemplate,
} from '@/services/emailTemplatesService';
import {
  getNotificationSettings,
  updateNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/services/notificationSettingsService';

// ============================================
// Types
// ============================================

interface EmailTemplatesSettingsProps {
  visible: boolean;
  onClose: () => void;
}

interface TemplateConfig {
  type: EmailTemplateType;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
  color: string;
}

// ============================================
// Constants
// ============================================

const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    type: 'confirmation',
    titleKey: 'emailConfirmation',
    descriptionKey: 'emailConfirmationDesc',
    icon: <CalendarCheck size={20} color="#22C55E" />,
    color: '#22C55E',
  },
  {
    type: 'cancellation',
    titleKey: 'emailCancellation',
    descriptionKey: 'emailCancellationDesc',
    icon: <CalendarX size={20} color="#EF4444" />,
    color: '#EF4444',
  },
  {
    type: 'rescheduled',
    titleKey: 'emailRescheduled',
    descriptionKey: 'emailRescheduledDesc',
    icon: <Edit3 size={20} color="#F59E0B" />,
    color: '#F59E0B',
  },
  {
    type: 'reminder',
    titleKey: 'emailReminder',
    descriptionKey: 'emailReminderDesc',
    icon: <Bell size={20} color="#3B82F6" />,
    color: '#3B82F6',
  },
];

// ============================================
// Main Component
// ============================================

export default function EmailTemplatesSettings({
  visible,
  onClose,
}: EmailTemplatesSettingsProps) {
  const language = useLanguage();
  const { business, businessId } = useBusiness();
  const businessName = business?.name ?? '';

  // State
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Map<EmailTemplateType, EmailTemplate>>(new Map());
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateType | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Edit form state
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editReminderHours, setEditReminderHours] = useState(24);
  const [saving, setSaving] = useState(false);

  // Notification settings state (transactional email toggles)
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [notifLoading, setNotifLoading] = useState(false);

  // ============================================
  // Load templates
  // ============================================

  const loadTemplates = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    const { data, error } = await getEmailTemplates(businessId, 'en');

    if (error) {
      console.log('[EmailTemplatesSettings] Load error:', error);
    }

    // Create map from array
    const templateMap = new Map<EmailTemplateType, EmailTemplate>();
    if (data) {
      for (const template of data) {
        templateMap.set(template.template_type as EmailTemplateType, template);
      }
    }
    setTemplates(templateMap);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (visible && businessId) {
      loadTemplates();
      // Load notification settings in parallel
      setNotifLoading(true);
      getNotificationSettings(businessId)
        .then((settings) => setNotifSettings(settings))
        .catch(() => setNotifSettings(DEFAULT_NOTIFICATION_SETTINGS))
        .finally(() => setNotifLoading(false));
    }
  }, [visible, businessId, loadTemplates]);

  const handleToggleNotification = useCallback(
    async (key: keyof NotificationSettings, value: boolean) => {
      if (!businessId) return;
      // Optimistic update
      setNotifSettings((prev) => ({ ...prev, [key]: value }));
      try {
        await updateNotificationSettings(businessId, { [key]: value });
      } catch {
        // Revert on failure
        setNotifSettings((prev) => ({ ...prev, [key]: !value }));
      }
    },
    [businessId]
  );

  // ============================================
  // Edit handlers
  // ============================================

  const handleEditTemplate = useCallback(
    (type: EmailTemplateType) => {
      const template = templates.get(type);
      const defaults = DEFAULT_TEMPLATES[type];

      setEditSubject(template?.custom_subject || defaults.subject);
      setEditBody(template?.custom_body || defaults.body);
      setEditEnabled(template?.is_enabled ?? true);
      setEditReminderHours(template?.reminder_hours ?? 24);
      setEditingTemplate(type);
      setPreviewMode(false);
    },
    [templates]
  );

  const handleSaveTemplate = useCallback(async () => {
    if (!businessId || !editingTemplate) return;

    setSaving(true);

    const defaults = DEFAULT_TEMPLATES[editingTemplate];
    const isSubjectCustom = editSubject !== defaults.subject;
    const isBodyCustom = editBody !== defaults.body;

    const { error } = await upsertEmailTemplate(businessId, editingTemplate, 'en', {
      is_enabled: editEnabled,
      custom_subject: isSubjectCustom ? editSubject : null,
      custom_body: isBodyCustom ? editBody : null,
      reminder_hours: editReminderHours,
    });

    setSaving(false);

    if (error) {
      Alert.alert(t('error', language), t('tryAgain', language));
      return;
    }

    // Reload templates
    await loadTemplates();
    setEditingTemplate(null);
  }, [businessId, editingTemplate, editSubject, editBody, editEnabled, editReminderHours, language, loadTemplates]);

  const handleResetTemplate = useCallback(async () => {
    if (!businessId || !editingTemplate) return;

    Alert.alert(t('resetTemplateToDefault', language), t('logoutConfirmation', language), [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('confirm', language),
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          await resetTemplateToDefaults(businessId, editingTemplate, 'en');
          await loadTemplates();

          // Reset form to defaults
          const defaults = DEFAULT_TEMPLATES[editingTemplate];
          setEditSubject(defaults.subject);
          setEditBody(defaults.body);
          setSaving(false);
        },
      },
    ]);
  }, [businessId, editingTemplate, language, loadTemplates]);

  const handleToggleEnabled = useCallback(
    async (type: EmailTemplateType, enabled: boolean) => {
      if (!businessId) return;

      const { error } = await upsertEmailTemplate(businessId, type, 'en', {
        is_enabled: enabled,
      });

      if (error) {
        Alert.alert(t('error', language), t('tryAgain', language));
        return;
      }

      await loadTemplates();
    },
    [businessId, language, loadTemplates]
  );

  // ============================================
  // Render template list item
  // ============================================

  const renderTemplateItem = useCallback(
    (config: TemplateConfig, index: number) => {
      const template = templates.get(config.type);
      const isEnabled = template?.is_enabled ?? true;
      const isCustomized = !!(template?.custom_subject || template?.custom_body);

      return (
        <Animated.View
          key={config.type}
          entering={FadeInDown.delay(index * 50)}
          className="bg-white dark:bg-gray-800 rounded-xl mb-3 overflow-hidden"
        >
          <View className="flex-row items-center p-4">
            {/* Icon */}
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${config.color}15` }}
            >
              {config.icon}
            </View>

            {/* Content */}
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {t(config.titleKey as keyof typeof t, language)}
                </Text>
                {isCustomized && (
                  <View className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                    <Text className="text-xs text-blue-600 dark:text-blue-400">
                      {t('custom', language)}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {t(config.descriptionKey as keyof typeof t, language)}
              </Text>
            </View>

            {/* Toggle */}
            <Switch
              value={isEnabled}
              onValueChange={(value) => handleToggleEnabled(config.type, value)}
              trackColor={{ false: '#D1D5DB', true: `${config.color}50` }}
              thumbColor={isEnabled ? config.color : '#9CA3AF'}
            />
          </View>

          {/* Edit Button */}
          <Pressable
            onPress={() => handleEditTemplate(config.type)}
            className="flex-row items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700"
          >
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              {t('edit', language)}
            </Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </Pressable>
        </Animated.View>
      );
    },
    [templates, language, handleToggleEnabled, handleEditTemplate]
  );

  // ============================================
  // Render edit modal
  // ============================================

  const renderEditModal = () => {
    if (!editingTemplate) return null;

    const config = TEMPLATE_CONFIGS.find((c) => c.type === editingTemplate);
    if (!config) return null;

    const previewSubject = previewTemplate(editSubject, businessName || 'Your Business');
    const previewBody = previewTemplate(editBody, businessName || 'Your Business');

    return (
      <Modal visible={!!editingTemplate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900" edges={['top']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <Pressable onPress={() => setEditingTemplate(null)} className="p-2">
              <X size={24} color="#6B7280" />
            </Pressable>
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              {t(config.titleKey as keyof typeof t, language)}
            </Text>
            <Pressable
              onPress={handleSaveTemplate}
              disabled={saving}
              className="p-2"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#0F8F83" />
              ) : (
                <Check size={24} color="#0F8F83" />
              )}
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            {/* Toggle Preview/Edit */}
            <View className="flex-row bg-gray-200 dark:bg-gray-700 rounded-lg p-1 mb-4">
              <Pressable
                onPress={() => setPreviewMode(false)}
                className={`flex-1 py-2 rounded-md ${!previewMode ? 'bg-white dark:bg-gray-600' : ''}`}
              >
                <Text
                  className={`text-center font-medium ${
                    !previewMode ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t('edit', language)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPreviewMode(true)}
                className={`flex-1 py-2 rounded-md ${previewMode ? 'bg-white dark:bg-gray-600' : ''}`}
              >
                <Text
                  className={`text-center font-medium ${
                    previewMode ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t('preview', language)}
                </Text>
              </Pressable>
            </View>

            {previewMode ? (
              /* Preview Mode */
              <Animated.View entering={FadeIn} className="bg-white dark:bg-gray-800 rounded-xl p-4">
                <View className="flex-row items-center mb-3">
                  <Mail size={18} color="#6B7280" />
                  <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    {t('preview', language)}
                  </Text>
                </View>

                <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                  {previewSubject}
                </Text>

                <View className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <Text className="text-gray-700 dark:text-gray-300 leading-6">
                    {previewBody}
                  </Text>
                </View>
              </Animated.View>
            ) : (
              /* Edit Mode */
              <Animated.View entering={FadeIn}>
                {/* Enabled Toggle */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-medium text-gray-900 dark:text-white">
                      {t('emailEnabled', language)}
                    </Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      {t('activate', language)}
                    </Text>
                  </View>
                  <Switch
                    value={editEnabled}
                    onValueChange={setEditEnabled}
                    trackColor={{ false: '#D1D5DB', true: '#0F8F8350' }}
                    thumbColor={editEnabled ? '#0F8F83' : '#9CA3AF'}
                  />
                </View>

                {/* Subject */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('subject', language)}
                  </Text>
                  <TextInput
                    value={editSubject}
                    onChangeText={setEditSubject}
                    placeholder={t('subject', language)}
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white"
                  />
                </View>

                {/* Body */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('message', language)}
                  </Text>
                  <TextInput
                    value={editBody}
                    onChangeText={setEditBody}
                    placeholder={t('message', language)}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={10}
                    textAlignVertical="top"
                    className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white min-h-[200px]"
                  />
                </View>

                {/* Reminder Hours (only for reminder template) */}
                {editingTemplate === 'reminder' && (
                  <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('reminderHours', language)}
                    </Text>
                    <View className="flex-row items-center">
                      <TextInput
                        value={String(editReminderHours)}
                        onChangeText={(v) => setEditReminderHours(parseInt(v, 10) || 24)}
                        keyboardType="numeric"
                        className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white w-20"
                      />
                      <Text className="text-gray-500 dark:text-gray-400 ml-3">
                        {t('reminderHoursDescription', language)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Placeholders */}
                <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('placeholdersAvailable', language)}
                  </Text>
                  <View className="flex-row flex-wrap">
                    {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
                      <Pressable
                        key={placeholder.key}
                        onPress={() => {
                          setEditBody((prev) => prev + placeholder.key);
                        }}
                        className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5 mr-2 mb-2"
                      >
                        <Text className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                          {placeholder.key}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Reset Button */}
                <Pressable
                  onPress={handleResetTemplate}
                  className="flex-row items-center justify-center py-3"
                >
                  <RotateCcw size={18} color="#EF4444" />
                  <Text className="text-red-500 font-medium ml-2">{t('resetToDefault', language)}</Text>
                </Pressable>
              </Animated.View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // ============================================
  // Main render
  // ============================================

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-gray-100 dark:bg-gray-900" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <Pressable onPress={onClose} className="p-2">
            <X size={24} color="#6B7280" />
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('bookingEmails', language)}
          </Text>
          <View className="w-10" />
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0F8F83" />
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            {/* Description */}
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4 px-1">
              {t('bookingEmailsDescription', language)}
            </Text>

            {/* Template List */}
            {TEMPLATE_CONFIGS.map((config, index) => renderTemplateItem(config, index))}

            {/* ── Transactional Notification Emails ─────────────────── */}
            <View className="mt-4 mb-2">
              <Text className="text-base font-bold text-gray-900 dark:text-white px-1 mb-1">
                Notification Emails
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 px-1 mb-3">
                Automatic emails sent when loyalty points, gift cards, or promotions are used.
              </Text>
            </View>

            {notifLoading ? (
              <ActivityIndicator size="small" color="#0F8F83" style={{ marginVertical: 16 }} />
            ) : (
              <>
                {([
                  { key: 'loyalty_points_earned' as const, label: 'Loyalty Points Earned', desc: 'When points are awarded after a visit', icon: <Star size={18} color="#F59E0B" />, color: '#F59E0B' },
                  { key: 'loyalty_points_redeemed' as const, label: 'Loyalty Reward Redeemed', desc: 'When a client redeems a loyalty reward', icon: <Award size={18} color="#8B5CF6" />, color: '#8B5CF6' },
                  { key: 'gift_card_issued' as const, label: 'Gift Card Issued', desc: 'When a gift card is created for a client', icon: <Gift size={18} color="#EC4899" />, color: '#EC4899' },
                  { key: 'gift_card_redeemed' as const, label: 'Gift Card Redeemed', desc: 'When a gift card is used at checkout', icon: <CreditCard size={18} color="#10B981" />, color: '#10B981' },
                  { key: 'promotion_applied' as const, label: 'Promotion Applied', desc: 'When a promotion discount is applied to a booking', icon: <Tag size={18} color="#3B82F6" />, color: '#3B82F6' },
                  { key: 'promotion_counter_reward' as const, label: 'Counter Reward Reached', desc: 'When a client hits a counter promotion milestone', icon: <Repeat size={18} color="#06B6D4" />, color: '#06B6D4' },
                ] as const).map((item, index) => (
                  <Animated.View
                    key={item.key}
                    entering={FadeInDown.delay(index * 40)}
                    className="bg-white dark:bg-gray-800 rounded-xl mb-3 overflow-hidden"
                  >
                    <View className="flex-row items-center p-4">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: `${item.color}15` }}
                      >
                        {item.icon}
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-900 dark:text-white">
                          {item.label}
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.desc}
                        </Text>
                      </View>
                      <Switch
                        value={notifSettings[item.key]}
                        onValueChange={(val) => handleToggleNotification(item.key, val)}
                        trackColor={{ false: '#D1D5DB', true: `${item.color}50` }}
                        thumbColor={notifSettings[item.key] ? item.color : '#9CA3AF'}
                      />
                    </View>
                  </Animated.View>
                ))}
              </>
            )}
          </ScrollView>
        )}

        {/* Edit Modal */}
        {renderEditModal()}
      </SafeAreaView>
    </Modal>
  );
}
