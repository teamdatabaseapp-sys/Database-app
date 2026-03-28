import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import {
  X,
  Plus,
  Mail,
  MapPin,
  Shield,
  Globe,
  Sparkles,
  Lock,
  Zap,
  ChevronRight,
  Check,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { LocalSuccessToast } from '@/components/LocalSuccessToast';
import { t } from '@/lib/i18n';
import { Language, DripCampaign } from '@/lib/types';
import { syncDeleteCampaignFromSupabase } from '@/hooks/useDripCampaigns';
import { useBusiness } from '@/hooks/useBusiness';
import {
  generateDripEmailFooter,
  getDripCampaignConsentAcknowledgment,
  getEuGdprRoleDisclosure,
  getEuLawfulBasisAcknowledgment,
} from '@/lib/legal-content';
import { getComplianceLawReference } from '@/lib/country-legal-compliance';
import Constants from 'expo-constants';
import {
  SmartDripTemplate,
  OFFICIAL_TEMPLATES,
  AUTOMATION_TRIGGERS,
  SendFrequency,
  AutomationTrigger,
  getTemplateIcon,
} from './constants';

interface CampaignListViewProps {
  onCreateNew: () => void;
  onEditCampaign: (campaign: DripCampaign) => void;
  onUseTemplate: (template: SmartDripTemplate, frequency: SendFrequency, trigger: AutomationTrigger, customDays?: number) => void;
}

export function CampaignListView({
  onCreateNew,
  onEditCampaign,
  onUseTemplate,
}: CampaignListViewProps) {
  const allDripCampaigns = useStore((s) => s.dripCampaigns);
  const allClients = useStore((s) => s.clients);
  const user = useStore((s) => s.user);
  const toggleDripCampaignActive = useStore((s) => s.toggleDripCampaignActive);
  const deleteDripCampaign = useStore((s) => s.deleteDripCampaign);
  const canActivateDripCampaign = useStore((s) => s.canActivateDripCampaign);
  const recordDripCampaignAcceptance = useStore((s) => s.recordDripCampaignAcceptance);
  const getDripCampaignAcceptanceStatus = useStore((s) => s.getDripCampaignAcceptanceStatus);
  const logDripCampaignActivation = useStore((s) => s.logDripCampaignActivation);
  const recordEULawfulBasisAcceptance = useStore((s) => s.recordEULawfulBasisAcceptance);
  const getEULawfulBasisAcceptanceStatus = useStore((s) => s.getEULawfulBasisAcceptanceStatus);
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { businessId } = useBusiness();

  // Filter data by current user
  // Fall back to showing ALL campaigns in the store if none match the current userId
  // (handles cases where userId changed or sandbox storage was partially reset)
  const dripCampaigns = useMemo(() => {
    if (!user?.id) return allDripCampaigns;
    const filtered = allDripCampaigns.filter((c) => c.userId === user.id);
    return filtered.length > 0 ? filtered : allDripCampaigns;
  }, [allDripCampaigns, user?.id]);

  const clients = useMemo(() => {
    if (!user?.id) return [];
    return allClients.filter((c) => c.userId === user.id);
  }, [allClients, user?.id]);
  const logEUCampaignActivation = useStore((s) => s.logEUCampaignActivation);
  const language = useStore((s) => s.language) as Language;

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [euConsentChecked, setEuConsentChecked] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState<string | null>(null);
  const [pendingCampaignIsEuEnabled, setPendingCampaignIsEuEnabled] = useState(false);
  const [showActivationToast, setShowActivationToast] = useState(false);

  const getAssignedClientsCount = (campaignId: string) => {
    return clients.filter((c) => c.dripCampaignId === campaignId && !c.isArchived).length;
  };

  const handleDelete = (campaign: DripCampaign) => {
    Alert.alert(
      t('delete', language),
      t('deleteCampaignConfirm', language).replace('{name}', campaign.name),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: () => {
            deleteDripCampaign(campaign.id);
            if (businessId) syncDeleteCampaignFromSupabase(campaign.id, businessId).catch(() => {});
          },
        },
      ]
    );
  };

  const handleActivatePress = (campaign: DripCampaign) => {
    // If already active, allow deactivation without consent
    if (campaign.isActive) {
      toggleDripCampaignActive(campaign.id);
      logDripCampaignActivation(campaign.id, 'deactivated');
      // Also log EU deactivation if EU-enabled
      if (campaign.isEuEnabled) {
        logEUCampaignActivation(campaign.id, 'eu_deactivated');
      }
      return;
    }

    // Check if business address is set
    const { canActivate, reason } = canActivateDripCampaign();
    if (!canActivate) {
      logDripCampaignActivation(campaign.id, 'blocked_no_address');
      Alert.alert(t('canSpamAddressRequired', language), reason || t('addBusinessAddressHint', language));
      return;
    }

    // Always show consent modal for activation (every time)
    setPendingCampaignId(campaign.id);
    setPendingCampaignIsEuEnabled(campaign.isEuEnabled ?? false);
    setConsentChecked(false);
    setEuConsentChecked(false);
    setShowConsentModal(true);
  };

  const handleConsentAccept = () => {
    if (!pendingCampaignId || !consentChecked) return;
    // For EU-enabled campaigns, also require EU consent
    if (pendingCampaignIsEuEnabled && !euConsentChecked) return;

    const acceptanceId = recordDripCampaignAcceptance(
      pendingCampaignId,
      Constants.expoConfig?.version || '1.0.0'
    );
    toggleDripCampaignActive(pendingCampaignId);
    logDripCampaignActivation(pendingCampaignId, 'activated', acceptanceId);

    // Record EU acceptance if EU-enabled
    if (pendingCampaignIsEuEnabled) {
      const euAcceptanceId = recordEULawfulBasisAcceptance(
        pendingCampaignId,
        Constants.expoConfig?.version || '1.0.0'
      );
      logEUCampaignActivation(pendingCampaignId, 'eu_activated', euAcceptanceId);
    }

    setShowConsentModal(false);
    setPendingCampaignId(null);
    setPendingCampaignIsEuEnabled(false);
    setConsentChecked(false);
    setEuConsentChecked(false);

    // Show activation success toast with sound
    setShowActivationToast(true);
  };

  // Render a template card inline (without modal activation — pass to TemplatesView via onUseTemplate)
  const renderInlineTemplateCard = (template: SmartDripTemplate, index: number) => (
    <Animated.View
      key={template.id}
      entering={FadeInDown.delay(200 + index * 40).duration(300)}
    >
      <Pressable
        onPress={() => {
          // Open TemplatesView activation modal by calling onUseTemplate directly after selection
          // We reuse TemplatesView's internal modal by mounting a local TemplatesView — but since
          // we can't do that inline, we call onUseTemplate with template defaults immediately:
          onUseTemplate(template, template.defaultFrequency ?? 'monthly', template.defaultTrigger, template.defaultCustomDays);
        }}
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {getTemplateIcon(template.icon, primaryColor, 20)}
        </View>
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, flex: 1 }} numberOfLines={1}>
              {t(template.nameKey, language)}
            </Text>
            {template.isLocked && (
              <View style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                <Lock size={9} color={primaryColor} />
                <Text style={{ color: primaryColor, fontSize: 9, fontWeight: '700', marginLeft: 3 }}>{t('dripOfficialBadge', language)}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Mail size={11} color={colors.textTertiary} />
            <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{template.emails.length} email{template.emails.length !== 1 ? 's' : ''}</Text>
            <View style={{ width: 1, height: 10, backgroundColor: colors.border }} />
            <Zap size={11} color={primaryColor} />
            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
              {t(AUTOMATION_TRIGGERS.find(tr => tr.value === template.defaultTrigger)?.labelKey ?? 'dripTriggerCustom', language)}
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} style={{ flexShrink: 0, marginLeft: 4 }} />
      </Pressable>
    </Animated.View>
  );

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Business Address Warning */}
        {!user?.businessAddress && (
          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <View style={{ backgroundColor: isDark ? '#78350F30' : '#FFFBEB', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#78350F' : '#FDE68A' }}>
              <View className="flex-row items-center">
                <MapPin size={18} color="#F59E0B" />
                <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontWeight: '600', marginLeft: 8, flex: 1 }}>{t('canSpamAddressRequired', language)}</Text>
              </View>
              <Text style={{ color: isDark ? '#FBBF24' : '#B45309', fontSize: 14, marginTop: 8 }}>
                {t('addBusinessAddressHint', language)}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Create New Button */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Pressable
            onPress={onCreateNew}
            className="rounded-xl p-4 flex-row items-center justify-center mb-5"
            style={{ backgroundColor: buttonColor }}
          >
            <Plus size={20} color="#fff" />
            <Text className="text-white font-semibold text-base ml-2">{t('createCampaignButton', language)}</Text>
          </Pressable>
        </Animated.View>

        {/* Active Campaigns */}
        {dripCampaigns.length > 0 && (
          <>
            <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  YOUR CAMPAIGNS
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              {dripCampaigns.map((campaign, index) => {
                const assignedCount = getAssignedClientsCount(campaign.id);
                return (
                  <Animated.View key={campaign.id} entering={FadeInDown.delay(130 + index * 30).duration(300)}>
                    <Pressable
                      onPress={() => onEditCampaign(campaign)}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: campaign.isActive ? `${campaign.color || primaryColor}35` : colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      {/* Color dot / icon */}
                      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: `${campaign.color || primaryColor}18`, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                        <Mail size={18} color={campaign.color || primaryColor} />
                      </View>
                      {/* Name + metadata */}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                          {campaign.name}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                          {campaign.emails.length} email{campaign.emails.length !== 1 ? 's' : ''} · {assignedCount} client{assignedCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {/* Status pill */}
                      <View style={{ backgroundColor: campaign.isActive ? '#10B98118' : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.055)'), paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, marginRight: 8 }}>
                        <Text style={{ color: campaign.isActive ? '#10B981' : colors.textTertiary, fontSize: 11, fontWeight: '600' }}>
                          {campaign.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.textTertiary} />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </>
        )}

        {/* Separator: Smart Drip Templates */}
        <Animated.View entering={FadeInDown.delay(140).duration(300)} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              SMART DRIP TEMPLATES
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
        </Animated.View>

        {/* Smart Drip Info Banner */}
        <Animated.View entering={FadeInDown.delay(160).duration(300)}>
          <View
            style={{
              backgroundColor: isDark ? `${primaryColor}20` : '#F0FDF9',
              borderRadius: 16,
              padding: 14,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: isDark ? `${primaryColor}30` : '#D1FAE5',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Sparkles size={16} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 8 }}>
                {t('dripTemplatesTitle', language)}
              </Text>
            </View>
            <Text style={{ color: isDark ? colors.textSecondary : '#047857', fontSize: 12, lineHeight: 17 }}>
              {t('dripTemplatesSubtitle', language)}
            </Text>
          </View>
        </Animated.View>

        {/* Official Templates */}
        <Animated.View entering={FadeInDown.delay(180).duration(300)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Shield size={14} color={primaryColor} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginLeft: 6 }}>
              {t('dripOfficialTemplates', language)}
            </Text>
            <View style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginLeft: 8 }}>
              <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>
                {OFFICIAL_TEMPLATES.length} {t('dripTemplatesAvailable', language)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {OFFICIAL_TEMPLATES.filter(t2 => t2.category === 'official').map((template, index) =>
          renderInlineTemplateCard(template, index)
        )}

      </ScrollView>

      {/* Consent Acknowledgment Modal */}
      <Modal visible={showConsentModal} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center"
          onPress={() => setShowConsentModal(false)}
        >
          <Pressable
            style={{ backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 24, width: 320, overflow: 'hidden' }}
            onPress={() => {}}
          >
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View className="flex-row items-center mb-2">
                <Shield size={22} color={primaryColor} />
                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginLeft: 8 }}>{t('activateCampaign', language)}</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {t('beforeActivatingConfirm', language)}
              </Text>
            </View>

            <ScrollView className="max-h-96">
              <View style={{ padding: 20 }}>
                {/* US CAN-SPAM Consent Checkbox */}
                <Pressable
                  onPress={() => setConsentChecked(!consentChecked)}
                  className="flex-row items-start mb-4"
                >
                  <View
                    className="w-6 h-6 rounded border-2 mr-3 items-center justify-center mt-0.5"
                    style={{
                      backgroundColor: consentChecked ? primaryColor : 'transparent',
                      borderColor: consentChecked ? primaryColor : colors.border,
                    }}
                  >
                    {consentChecked && <Check size={14} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>
                    {getDripCampaignConsentAcknowledgment(language)}
                  </Text>
                </Pressable>

                {/* EU GDPR Consent - Only shown for EU-enabled campaigns */}
                {pendingCampaignIsEuEnabled && (
                  <>
                    {/* EU GDPR Role Disclosure (non-editable) */}
                    <View style={{ backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#1E40AF' : '#BFDBFE' }}>
                      <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF', fontSize: 12, fontWeight: '500', marginBottom: 4 }}>{t('euDataProtection', language)}</Text>
                      <Text style={{ color: isDark ? '#60A5FA' : '#1D4ED8', fontSize: 12 }}>
                        {getEuGdprRoleDisclosure(language)}
                      </Text>
                    </View>

                    {/* EU Lawful Basis Checkbox */}
                    <Pressable
                      onPress={() => setEuConsentChecked(!euConsentChecked)}
                      className="flex-row items-start mb-4"
                    >
                      <View
                        className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center mt-0.5 ${
                          euConsentChecked ? 'bg-blue-600 border-blue-600' : ''
                        }`}
                        style={!euConsentChecked ? { borderColor: colors.border } : undefined}
                      >
                        {euConsentChecked && <Check size={14} color="#fff" />}
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>
                        {getEuLawfulBasisAcknowledgment(language)}
                      </Text>
                    </Pressable>
                  </>
                )}

                <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {(() => {
                      const lawReference = getComplianceLawReference(user?.businessCountry, user?.businessState);
                      const baseText = pendingCampaignIsEuEnabled ? t('termsAcceptanceNoteEu', language) : t('termsAcceptanceNote', language);
                      // Replace CAN-SPAM Act with the dynamic law reference
                      return baseText.replace(/CAN-SPAM Act|CAN-SPAM|Ley CAN-SPAM|loi CAN-SPAM|Lei CAN-SPAM|CAN-SPAM-Gesetzes|CAN-SPAM-Gesetz|CAN-SPAM法|CAN-SPAM법|CAN-SPAM法案|Lwa CAN-SPAM|legge CAN-SPAM|CAN-SPAM wet|CAN-SPAM-lagen|CAN-SPAM-loven|CAN-SPAM-lain|CAN-SPAM lögum|закону CAN-SPAM|CAN-SPAM Yasası/gi, lawReference);
                    })()}
                  </Text>
                </View>

                <View className="flex-row">
                  <Pressable
                    onPress={() => setShowConsentModal(false)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', marginRight: 8 }}
                  >
                    <Text style={{ fontWeight: '600', color: colors.textSecondary }}>{t('cancel', language)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConsentAccept}
                    className="flex-1 py-3 rounded-xl items-center ml-2"
                    style={{
                      backgroundColor: consentChecked && (!pendingCampaignIsEuEnabled || euConsentChecked)
                        ? buttonColor
                        : isDark ? colors.backgroundTertiary : '#CBD5E1',
                    }}
                    disabled={!consentChecked || (pendingCampaignIsEuEnabled && !euConsentChecked)}
                  >
                    <Text
                      style={{
                        fontWeight: '600',
                        color: consentChecked && (!pendingCampaignIsEuEnabled || euConsentChecked)
                          ? '#fff'
                          : colors.textTertiary,
                      }}
                    >
                      {t('activate', language)}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Activation Success Toast */}
      <LocalSuccessToast
        visible={showActivationToast}
        message={t('campaignActivated', language)}
        onHide={() => setShowActivationToast(false)}
      />
    </>
  );
}
