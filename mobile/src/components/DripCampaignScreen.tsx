import React, { useState, useEffect } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Mail,
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { LocalSuccessToast } from '@/components/LocalSuccessToast';
import { t } from '@/lib/i18n';
import { Language, DripCampaign, DripEmail } from '@/lib/types';
import { useHydrateDripCampaigns } from '@/hooks/useDripCampaigns';
import { useBusiness } from '@/hooks/useBusiness';
import { useClients } from '@/hooks/useClients';
import { CampaignListView } from './drip/CampaignListView';
import { AssignWizard } from './drip/AssignWizard';
import { AssignManageView } from './drip/AssignManageView';
import { CampaignEditorView } from './drip/CampaignEditorView';
import {
  Frequency,
  SendFrequency,
  AutomationTrigger,
  SmartDripTemplate,
} from './drip/constants';

interface DripCampaignScreenProps {
  visible: boolean;
  onClose: () => void;
  prefill?: {
    name?: string;
    frequency?: Frequency;
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  };
}

type TemplatePrefill = {
  name: string;
  frequency: Frequency;
  emails: DripEmail[];
};

export function DripCampaignScreen({ visible, onClose, prefill }: DripCampaignScreenProps) {
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'templates'>('list');
  const [activeTab, setActiveTab] = useTabPersistence<'campaigns' | 'templates'>('drip_campaign', 'templates');
  const [editingCampaign, setEditingCampaign] = useState<DripCampaign | undefined>();
  const [templatePrefill, setTemplatePrefill] = useState<TemplatePrefill | undefined>();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showAssignWizard, setShowAssignWizard] = useState(false);
  // wizardSkipClientStep = true when clients were pre-selected from the list
  const [wizardSkipClientStep, setWizardSkipClientStep] = useState(false);
  const [assignWizardStep, setAssignWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardSelectedCampaign, setWizardSelectedCampaign] = useState<DripCampaign | null>(null);
  const [wizardSelectedClientIds, setWizardSelectedClientIds] = useState<string[]>([]);
  const [wizardClientSearch, setWizardClientSearch] = useState('');
  const [wizardCampaignSearch, setWizardCampaignSearch] = useState('');
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const dripCampaigns = useStore((s) => s.dripCampaigns);
  const { data: rawClientsForWizard = [] } = useClients();
  const user = useStore((s) => s.user);
  const assignClientToDrip = useStore((s) => s.assignClientToDrip);
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();

  // Hydrate campaigns from Supabase on mount (graceful fallback to Zustand-only)
  useHydrateDripCampaigns();

  // When opened with a prefill, jump straight to create view
  React.useEffect(() => {
    if (visible && prefill) {
      setView('create');
      setEditingCampaign(undefined);
      setTemplatePrefill(undefined);
    } else if (!visible) {
      // Reset when closed
      setView('list');
      setActiveTab('templates');
      setEditingCampaign(undefined);
      setTemplatePrefill(undefined);
    }
  }, [visible, prefill]);

  const handleCreateNew = () => {
    setEditingCampaign(undefined);
    setTemplatePrefill(undefined);
    setView('create');
  };

  const handleEditCampaign = (campaign: DripCampaign) => {
    setEditingCampaign(campaign);
    setView('edit');
  };

  const handleSave = () => {
    setView('list');
    setEditingCampaign(undefined);
    setTemplatePrefill(undefined);
  };

  const handleCancel = () => {
    setView('list');
    setEditingCampaign(undefined);
    setTemplatePrefill(undefined);
  };

  const handleClose = () => {
    setView('list');
    setActiveTab('campaigns');
    setEditingCampaign(undefined);
    setTemplatePrefill(undefined);
    onClose();
  };

  const handleShowSuccess = () => {
    setSuccessMessage(t('successSaved', language));
    setShowSuccessToast(true);
  };

  // Handle using a template - pre-fills the create form instead of auto-creating
  const handleUseTemplate = (
    template: SmartDripTemplate,
    frequency: SendFrequency,
    trigger: AutomationTrigger,
    customDays?: number
  ) => {
    const dripFrequency: Frequency = frequency === 'once' ? 'weekly' : frequency as Frequency;
    setEditingCampaign(undefined);
    setTemplatePrefill({
      name: t(template.nameKey, language),
      frequency: dripFrequency,
      emails: template.emails.map((email, index) => ({
        id: `prefill-${index}`,
        subject: t(email.subjectKey, language),
        body: t(email.bodyKey, language),
        delayDays: email.delayDays,
        attachments: [],
      })),
    });
    setView('create');
  };

  const getTitle = () => {
    switch (view) {
      case 'create':
        return t('newCampaign', language);
      case 'edit':
        return t('editCampaignTitle', language);
      default:
        return t('dripCampaigns', language);
    }
  };

  // Show tabs only when in list/templates view
  const showTabs = view === 'list';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: showTabs ? 'transparent' : colors.border }}
        >
          <View className="flex-row items-center">
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : '#F0FDFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Mail size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{getTitle()}</Text>
          </View>
          <Pressable
            onPress={handleClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Tabs - Only show when in list view */}
        {showTabs && (
          <View style={{ backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 14,
                padding: 4,
              }}
            >
              {/* LEFT TAB: Assign & Manage */}
              <Pressable
                onPress={() => setActiveTab('templates')}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  paddingHorizontal: 4,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: activeTab === 'templates' ? (isDark ? colors.card : '#fff') : 'transparent',
                  shadowColor: activeTab === 'templates' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: activeTab === 'templates' ? 0.08 : 0,
                  shadowRadius: activeTab === 'templates' ? 4 : 0,
                  elevation: activeTab === 'templates' ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '500', color: activeTab === 'templates' ? primaryColor : colors.textSecondary, textAlign: 'center', lineHeight: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {t('dripTabAssignLine1', language)}
                </Text>
                {t('dripTabAssignLine2', language) ? (
                  <Text style={{ fontSize: 11, fontWeight: '500', color: activeTab === 'templates' ? primaryColor : colors.textSecondary, textAlign: 'center', lineHeight: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {t('dripTabAssignLine2', language)}
                  </Text>
                ) : null}
              </Pressable>
              {/* RIGHT TAB: Campaigns & Templates */}
              <Pressable
                onPress={() => setActiveTab('campaigns')}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  paddingHorizontal: 4,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: activeTab === 'campaigns' ? (isDark ? colors.card : '#fff') : 'transparent',
                  shadowColor: activeTab === 'campaigns' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: activeTab === 'campaigns' ? 0.08 : 0,
                  shadowRadius: activeTab === 'campaigns' ? 4 : 0,
                  elevation: activeTab === 'campaigns' ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '500', color: activeTab === 'campaigns' ? primaryColor : colors.textSecondary, textAlign: 'center', lineHeight: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {t('dripTabCampaignsLine1', language)}
                </Text>
                {t('dripTabCampaignsLine2', language) ? (
                  <Text style={{ fontSize: 11, fontWeight: '500', color: activeTab === 'campaigns' ? primaryColor : colors.textSecondary, textAlign: 'center', lineHeight: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                    {t('dripTabCampaignsLine2', language)}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          </View>
        )}

        {/* Content */}
        {view === 'list' ? (
          activeTab === 'campaigns' ? (
            <CampaignListView onCreateNew={handleCreateNew} onEditCampaign={handleEditCampaign} onUseTemplate={handleUseTemplate} />
          ) : (
            <AssignManageView onOpenAssignWizard={(preSelectedIds) => {
              if (preSelectedIds && preSelectedIds.length > 0) {
                setWizardSelectedClientIds(preSelectedIds);
                setWizardSkipClientStep(true);
                setAssignWizardStep(1);
              } else {
                setWizardSelectedClientIds([]);
                setWizardSkipClientStep(false);
                setAssignWizardStep(1);
              }
              setWizardSelectedCampaign(null);
              setWizardClientSearch('');
              setWizardCampaignSearch('');
              setShowAssignWizard(true);
            }} />
          )
        ) : (
          <CampaignEditorView
            campaign={editingCampaign}
            onSave={handleSave}
            onCancel={handleCancel}
            onShowSuccess={handleShowSuccess}
            prefill={editingCampaign ? undefined : (templatePrefill || prefill)}
          />
        )}

        {/* Local Success Toast */}
        <LocalSuccessToast
          visible={showSuccessToast}
          message={successMessage || t('successSaved', language)}
          onHide={() => setShowSuccessToast(false)}
        />

        {/* Assign New Campaign Wizard */}
        <AssignWizard
          visible={showAssignWizard}
          step={assignWizardStep}
          skipClientStep={wizardSkipClientStep}
          selectedCampaign={wizardSelectedCampaign}
          selectedClientIds={wizardSelectedClientIds}
          clientSearch={wizardClientSearch}
          campaignSearch={wizardCampaignSearch}
          onClose={() => {
            setShowAssignWizard(false);
            setWizardSkipClientStep(false);
            setWizardSelectedCampaign(null);
            setWizardSelectedClientIds([]);
            setWizardClientSearch('');
            setWizardCampaignSearch('');
          }}
          onStepChange={(s) => setAssignWizardStep(s)}
          onSelectedCampaignChange={(c) => setWizardSelectedCampaign(c)}
          onSelectedClientIdsChange={(ids) => setWizardSelectedClientIds(ids)}
          onClientSearchChange={(q) => setWizardClientSearch(q)}
          onCampaignSearchChange={(q) => setWizardCampaignSearch(q)}
          onNavigateToCreate={() => setView('create')}
          onAssignSuccess={(msg) => {
            setSuccessMessage(msg);
            setShowSuccessToast(true);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
