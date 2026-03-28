import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Mail,
  Lock,
  Zap,
  ChevronRight,
  Shield,
  Edit3,
  Copy,
  FileText,
  Info,
  Check,
  Sparkles,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import {
  SmartDripTemplate,
  SendFrequency,
  AutomationTrigger,
  OFFICIAL_TEMPLATES,
  AUTOMATION_TRIGGERS,
  SEND_FREQUENCY_OPTIONS,
  getTemplateIcon,
} from './constants';

export function TemplatesView({
  onUseTemplate,
}: {
  onUseTemplate: (template: SmartDripTemplate, frequency: SendFrequency, trigger: AutomationTrigger, customDays?: number) => void;
}) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const user = useStore((s) => s.user);
  const allDripCampaigns = useStore((s) => s.dripCampaigns);

  // User's custom templates (campaigns marked as templates)
  const customTemplates = useMemo(() => {
    if (!user?.id) return allDripCampaigns;
    const filtered = allDripCampaigns.filter((c) => c.userId === user.id);
    return filtered.length > 0 ? filtered : allDripCampaigns;
  }, [allDripCampaigns, user?.id]);

  const [selectedTemplate, setSelectedTemplate] = useState<SmartDripTemplate | null>(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<SendFrequency>('monthly');
  const [selectedTrigger, setSelectedTrigger] = useState<AutomationTrigger>('new_client');
  const [customDays, setCustomDays] = useState('7');
  const [showPreview, setShowPreview] = useState(false);

  // Replace placeholders with actual business data
  const replacePlaceholders = (text: string) => {
    return text
      .replace(/\{\{business_name\}\}/g, user?.businessName || 'Your Business')
      .replace(/\{\{business_address\}\}/g, user?.businessAddress || '[Your Address]')
      .replace(/\{\{business_phone\}\}/g, user?.businessPhoneNumber || '[Your Phone]')
      .replace(/\{\{client_first_name\}\}/g, '[Client Name]');
  };

  const handleTemplatePress = (template: SmartDripTemplate) => {
    setSelectedTemplate(template);
    setSelectedTrigger(template.defaultTrigger);
    setSelectedFrequency(template.defaultFrequency || 'monthly');
    if (template.defaultCustomDays) {
      setCustomDays(String(template.defaultCustomDays));
    }
    setShowActivateModal(true);
  };

  const handleActivate = () => {
    if (!selectedTemplate) return;

    const days = selectedFrequency === 'custom' ? parseInt(customDays) || 7 : undefined;
    onUseTemplate(selectedTemplate, selectedFrequency, selectedTrigger, days);

    setShowActivateModal(false);
    setSelectedTemplate(null);
  };

  const renderTemplateCard = (template: SmartDripTemplate, index: number) => (
    <Animated.View
      key={template.id}
      entering={FadeInDown.delay(100 + index * 50).duration(300)}
    >
      <Pressable
        onPress={() => handleTemplatePress(template)}
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {getTemplateIcon(template.icon, primaryColor)}
          </View>
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, flex: 1 }} numberOfLines={1}>
                {t(template.nameKey, language)}
              </Text>
              {template.isLocked && (
                <View
                  style={{
                    backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexShrink: 0,
                    marginLeft: 6,
                  }}
                >
                  <Lock size={10} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontSize: 10, fontWeight: '600', marginLeft: 4 }}>
                    {t('dripOfficialBadge', language)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
              {t(template.descKey, language)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 4 }}>
              <Mail size={12} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                {template.emails.length} email{template.emails.length !== 1 ? 's' : ''}
              </Text>
              <View style={{ width: 1, height: 12, backgroundColor: colors.border, marginHorizontal: 4 }} />
              <Zap size={12} color={primaryColor} />
              <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>
                {t(AUTOMATION_TRIGGERS.find(tr => tr.value === template.defaultTrigger)?.labelKey ?? 'dripTriggerCustom', language)}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.textTertiary} style={{ flexShrink: 0, marginLeft: 4 }} />
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Smart Drip Info Banner */}
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <View
            style={{
              backgroundColor: isDark ? `${primaryColor}20` : '#F0FDF9',
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: isDark ? `${primaryColor}30` : '#D1FAE5',
            }}
          >
            <View className="flex-row items-center mb-2">
              <Sparkles size={18} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                {t('dripTemplatesTitle', language)}
              </Text>
            </View>
            <Text style={{ color: isDark ? colors.textSecondary : '#047857', fontSize: 13, lineHeight: 18 }}>
              {t('dripTemplatesSubtitle', language)}
            </Text>
          </View>
        </Animated.View>

        {/* Official Templates Section */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <View className="flex-row items-center mb-4">
            <Shield size={16} color={primaryColor} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
              {t('dripOfficialTemplates', language)}
            </Text>
            <View
              style={{
                backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>
                {OFFICIAL_TEMPLATES.length} {t('dripTemplatesAvailable', language)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {OFFICIAL_TEMPLATES.map((template, index) => renderTemplateCard(template, index))}

        {/* Custom Templates Section */}
        {customTemplates.length > 0 && (
          <>
            <Animated.View entering={FadeInDown.delay(350).duration(300)}>
              <View className="flex-row items-center mb-4 mt-6">
                <Edit3 size={16} color={colors.textSecondary} />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                  {t('dripCustomCampaignsTitle', language)}
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
                {t('dripCustomCampaignsHint', language)}
              </Text>
            </Animated.View>

            {customTemplates.map((campaign, index) => (
              <Animated.View
                key={campaign.id}
                entering={FadeInDown.delay(400 + index * 50).duration(300)}
              >
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: 0.8,
                  }}
                >
                  <View className="flex-row items-center">
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: `${campaign.color}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Mail size={18} color={campaign.color} />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{campaign.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {campaign.emails.length} emails • {t(campaign.frequency, language)}
                      </Text>
                    </View>
                    <Copy size={18} color={colors.textTertiary} />
                  </View>
                </View>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Template Activation Modal */}
      <Modal
        visible={showActivateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowActivateModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          {/* Header */}
          <View
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
            <Pressable onPress={() => setShowActivateModal(false)}>
              <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>{t('cancel', language)}</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 17 }}>
              {t('dripActivateTemplateTitle', language)}
            </Text>
            <Pressable onPress={handleActivate}>
              <Text style={{ color: primaryColor, fontWeight: '600' }}>{t('dripActivateButton', language)}</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {selectedTemplate && (
              <>
                {/* Template Preview */}
                <View
                  style={{
                    backgroundColor: `${selectedTemplate.color}10`,
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 24,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: `${selectedTemplate.color}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    {getTemplateIcon(selectedTemplate.icon, selectedTemplate.color, 28)}
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, textAlign: 'center' }}>
                    {t(selectedTemplate.nameKey, language)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                    {t(selectedTemplate.descKey, language)}
                  </Text>
                  {selectedTemplate.isLocked && (
                    <View className="flex-row items-center mt-3">
                      <Lock size={12} color={colors.textTertiary} />
                      <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 4 }}>
                        {t('dripOfficialContentNote', language)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Send Frequency Selection */}
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
                  {t('dripSendFrequencyLabel', language)}
                </Text>
                <View style={{ marginBottom: 20 }}>
                  {SEND_FREQUENCY_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setSelectedFrequency(option.value)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: selectedFrequency === option.value
                          ? (isDark ? `${primaryColor}30` : `${primaryColor}10`)
                          : colors.card,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: selectedFrequency === option.value ? primaryColor : colors.border,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: selectedFrequency === option.value ? primaryColor : colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selectedFrequency === option.value && (
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: primaryColor,
                            }}
                          />
                        )}
                      </View>
                      <Text style={{ color: colors.text, marginLeft: 12, fontWeight: '500' }}>
                        {t(option.labelKey, language)}
                      </Text>
                    </Pressable>
                  ))}

                  {selectedFrequency === 'custom' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Text style={{ color: colors.textSecondary }}>{t('dripEvery', language)}</Text>
                      <TextInput
                        value={customDays}
                        onChangeText={setCustomDays}
                        keyboardType="number-pad"
                        style={{
                          backgroundColor: colors.inputBackground,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          width: 60,
                          marginHorizontal: 8,
                          color: colors.text,
                          textAlign: 'center',
                          borderWidth: 1,
                          borderColor: colors.inputBorder,
                        }}
                      />
                      <Text style={{ color: colors.textSecondary }}>{t('dripDays', language)}</Text>
                    </View>
                  )}
                </View>

                {/* Automation Trigger Selection */}
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
                  {t('dripAutomationTriggerLabel', language)}
                </Text>
                <View style={{ marginBottom: 20 }}>
                  {AUTOMATION_TRIGGERS.map((trigger) => {
                    const TriggerIcon = trigger.icon;
                    return (
                      <Pressable
                        key={trigger.value}
                        onPress={() => setSelectedTrigger(trigger.value)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: selectedTrigger === trigger.value
                            ? (isDark ? `${primaryColor}30` : `${primaryColor}10`)
                            : colors.card,
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: selectedTrigger === trigger.value ? primaryColor : colors.border,
                        }}
                      >
                        <TriggerIcon size={20} color={selectedTrigger === trigger.value ? primaryColor : colors.textSecondary} />
                        <View className="flex-1 ml-3">
                          <Text style={{ color: colors.text, fontWeight: '500' }}>{t(trigger.labelKey, language)}</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t(trigger.descKey, language)}</Text>
                        </View>
                        {selectedTrigger === trigger.value && (
                          <Check size={20} color={primaryColor} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Email Preview Toggle */}
                <Pressable
                  onPress={() => setShowPreview(!showPreview)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center">
                    <FileText size={18} color={colors.textSecondary} />
                    <Text style={{ color: colors.text, fontWeight: '500', marginLeft: 10 }}>
                      {t('dripPreviewEmails', language).replace('{count}', String(selectedTemplate.emails.length))}
                    </Text>
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    style={{ transform: [{ rotate: showPreview ? '90deg' : '0deg' }] }}
                  />
                </Pressable>

                {/* Email Previews */}
                {showPreview && (
                  <View style={{ marginBottom: 20 }}>
                    {selectedTemplate.emails.map((email, idx) => (
                      <Animated.View
                        key={idx}
                        entering={FadeInDown.delay(idx * 50).duration(200)}
                        style={{
                          backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 10,
                          borderLeftWidth: 3,
                          borderLeftColor: selectedTemplate.color,
                        }}
                      >
                        <View className="flex-row items-center mb-2">
                          <View
                            style={{
                              backgroundColor: selectedTemplate.color,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                              {t('dripEmailNumber', language).replace('{number}', String(idx + 1))}
                            </Text>
                          </View>
                          {email.delayDays > 0 && (
                            <Text style={{ color: colors.textTertiary, fontSize: 11, marginLeft: 8 }}>
                              {t('dripSentDaysAfterPrevious', language).replace('{days}', String(email.delayDays))}
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8 }}>
                          {replacePlaceholders(t(email.subjectKey, language))}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }} numberOfLines={6}>
                          {replacePlaceholders(t(email.bodyKey, language))}
                        </Text>
                      </Animated.View>
                    ))}
                  </View>
                )}

                {/* Info Note */}
                <View
                  style={{
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <Info size={16} color={colors.textTertiary} style={{ marginTop: 2 }} />
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 8, flex: 1 }}>
                    Your business name, phone, and address will be automatically inserted into the emails when sent.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
