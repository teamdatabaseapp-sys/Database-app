import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  Image as RNImage,
} from 'react-native';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  Tag,
  Paperclip,
  FileText,
  Image,
  File,
  AlertTriangle,
  Shield,
  Globe,
  Sparkles,
  Zap,
  UserPlus,
  AlertCircle,
  ChevronRight,
  Timer,
  Filter,
  Moon,
  Hand,
  CalendarDays,
  CalendarClock,
  Cake,
  CreditCard,
  Hourglass,
  Bold,
  Italic,
  Link2,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
  Star,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t, TranslationKey } from '@/lib/i18n';
import { Language, DripCampaign, DripEmail, DripEmailAttachment, DripEmailImage } from '@/lib/types';
import { syncCampaignToSupabase } from '@/hooks/useDripCampaigns';
import { persistClientDripAssignment } from '@/services/dripCampaignsService';
import { useBusiness } from '@/hooks/useBusiness';
import {
  generateDripEmailFooter,
  getDripCampaignPlatformDisclosure,
} from '@/lib/legal-content';
import { getEmailFooterPreview, getComplianceHelperMessage, getComplianceLawReference, formatPhoneForEmailFooter } from '@/lib/country-legal-compliance';
import { useAnalyticsAppointments } from '@/hooks/useAppointments';
import { useAllMemberships } from '@/hooks/useMembership';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useServices } from '@/hooks/useServices';
import { useStores } from '@/hooks/useStores';
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor';
import { SectionHeader } from './SectionHeader';
import {
  MAX_FILE_SIZE_MB,
  MAX_TOTAL_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_SIZE_BYTES,
  MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  Frequency,
  FREQUENCY_OPTIONS,
  SmartTripsTargeting,
  SmartTripsTrigger,
  TriggerType,
} from './constants';

export function CampaignEditorView({
  campaign,
  onSave,
  onCancel,
  onShowSuccess,
  prefill,
}: {
  campaign?: DripCampaign;
  onSave: () => void;
  onCancel: () => void;
  onShowSuccess: () => void;
  prefill?: {
    name?: string;
    frequency?: Frequency;
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
    emails?: DripEmail[];
  };
}) {
  const addDripCampaign = useStore((s) => s.addDripCampaign);
  const updateDripCampaign = useStore((s) => s.updateDripCampaign);
  const allClients = useStore((s) => s.clients);
  const user = useStore((s) => s.user);
  const assignClientToDrip = useStore((s) => s.assignClientToDrip);
  const language = useStore((s) => s.language) as Language;
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const { businessId } = useBusiness();

  // Filter data by current user
  const clients = useMemo(() => {
    if (!user?.id) return [];
    return allClients.filter((c) => c.userId === user.id);
  }, [allClients, user?.id]);

  const [name, setName] = useState(campaign?.name || prefill?.name || '');
  const [color] = useState(campaign?.color || primaryColor);
  const [frequency, setFrequency] = useState<Frequency>(campaign?.frequency || prefill?.frequency || 'weekly');
  const [customDays, setCustomDays] = useState(campaign?.customDays?.toString() || '');
  const [isEuEnabled, setIsEuEnabled] = useState(campaign?.isEuEnabled ?? false);
  const [emails, setEmails] = useState<DripEmail[]>(
    campaign?.emails || prefill?.emails || [{
      id: '1',
      subject: prefill?.emailSubject || '',
      body: prefill?.emailBody || '',
      delayDays: 0,
      attachments: [],
    }]
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showClientAssignment, setShowClientAssignment] = useState(false);

  // Advanced Targeting state
  const [targeting, setTargeting] = useState<SmartTripsTargeting>({
    filterType: 'all',
    filterLogic: 'AND',
    consentRequired: true,
    topClientsSortBy: 'revenue',
    visitFrequency: 'frequent',
    membershipStatus: 'active',
    loyaltySubFilter: 'enrolled',
    giftCardSubFilter: 'any',
    selectedServiceId: null,
    selectedStoreId: null,
  });
  const [showTargeting, setShowTargeting] = useState(false);

  // Trigger Conditions state
  const [trigger, setTrigger] = useState<SmartTripsTrigger>(
    campaign?.triggerConfig != null
      ? (campaign.triggerConfig as SmartTripsTrigger)
      : {
          triggerType: (campaign?.triggerType as TriggerType) ?? 'manual',
          delayDays: 0,
          quietHoursEnabled: false,
          quietHoursFrom: '22:00',
          quietHoursTo: '08:00',
        }
  );
  const [showTrigger, setShowTrigger] = useState(false);
  const [customDelayDays, setCustomDelayDays] = useState('');

  // Email builder state
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [showConditionalBranch, setShowConditionalBranch] = useState(false);

  // Performance panel state
  const [showPerformance, setShowPerformance] = useState(false);
  const [performanceTab, setPerformanceTab] = useState<'overview' | 'timeline' | 'stores'>('overview');

  // Per-email rich text formatting state (keyed by email id)
  const [emailFmtState, setEmailFmtState] = useState<Record<string, Set<string>>>({});
  const [emailTextAlign, setEmailTextAlign] = useState<Record<string, 'left' | 'center' | 'right'>>({});
  const [emailShowLinkModal, setEmailShowLinkModal] = useState<Record<string, boolean>>({});
  const [emailLinkUrl, setEmailLinkUrl] = useState<Record<string, string>>({});
  const [emailLinkText, setEmailLinkText] = useState<Record<string, string>>({});
  const [emailImageErrors, setEmailImageErrors] = useState<Record<string, string | null>>({});
  const richEditorRefs = useRef<Record<string, RichTextEditorRef | null>>({});

  // AI content generation
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Bumping this key forces the RichTextEditor to remount with fresh initialHtml after AI generation
  const [editorResetKey, setEditorResetKey] = useState(0);

  const generateWithAI = async () => {
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const backendUrl =
        process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        'http://localhost:3000';

      // Compute real analytics context from already-loaded data
      const serviceCountMap: Record<string, number> = {};
      for (const appt of allAppointments) {
        const svc = (appt as { serviceName?: string }).serviceName;
        if (svc) serviceCountMap[svc] = (serviceCountMap[svc] ?? 0) + 1;
      }
      const topServiceNames = Object.entries(serviceCountMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);
      const mostUsedServiceName = topServiceNames[0];

      const now = Date.now();
      const atRiskDays = 30;
      const inactiveClientsCount = clients.filter((c) => {
        if (c.isArchived) return false;
        const last = (c as { lastVisit?: string | null }).lastVisit;
        if (!last) return true;
        return (now - new Date(last).getTime()) / 86400000 > atRiskDays;
      }).length;

      const analyticsContext = {
        ...(mostUsedServiceName ? { mostUsedServiceName } : {}),
        ...(topServiceNames.length > 0 ? { topServiceNames } : {}),
        ...(inactiveClientsCount > 0 ? { inactiveClientsCount, atRiskDays } : {}),
        totalClients: clients.filter((c) => !c.isArchived).length || undefined,
      };

      const businessContext = {
        serviceNames: supabaseServices.map((s: { name: string }) => s.name).filter(Boolean),
        loyaltyEnabled: allClientLoyalty.length > 0,
        membershipEnabled: allMemberships.length > 0,
        giftCardsEnabled: allGiftCards.length > 0,
      };

      const res = await fetch(`${backendUrl}/api/ai-content/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'campaign',
          language: language || 'en',
          variationSeed: Math.floor(Math.random() * 10000),
          businessName: user?.businessName || undefined,
          campaignGoal: name || prefill?.contextLabel || undefined,
          clientSegment: prefill?.contextLabel || undefined,
          contextLabel: prefill?.contextLabel || undefined,
          frequency: frequency || undefined,
          analyticsContext,
          businessContext,
        }),
      });
      const data = await res.json() as { success: boolean; result?: { subject?: string; body?: string }; error?: string };
      if (!data.success || !data.result) {
        setAiError(data.error || 'Generation failed');
        return;
      }
      const { subject, body: bodyText } = data.result;
      if (emails.length > 0) {
        const firstId = emails[0].id;
        if (subject) updateEmail(firstId, { subject });
        if (bodyText) updateEmail(firstId, { body: bodyText });
        // Force RichTextEditor remount so initialHtml picks up the new body
        setEditorResetKey((k) => k + 1);
      }
    } catch {
      setAiError('Could not reach AI service');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Data hooks for targeting
  const analyticsEndDate = useMemo(() => new Date(), []);
  const analyticsStartDate = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d; }, []);
  const { data: allAppointments = [] } = useAnalyticsAppointments(analyticsStartDate, analyticsEndDate);
  const { data: allMemberships = [] } = useAllMemberships();
  const { data: allClientLoyalty = [] } = useAllClientLoyalty();
  const { data: allGiftCards = [] } = useGiftCards();
  const { data: supabaseServices = [] } = useServices();
  const { data: supabaseStores = [] } = useStores();

  const assignedClientIds = useMemo(() => {
    if (!campaign) return [];
    return clients.filter((c) => c.dripCampaignId === campaign.id).map((c) => c.id);
  }, [campaign, clients]);

  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(assignedClientIds);

  const activeClients = useMemo(() => {
    return clients.filter((c) => !c.isArchived);
  }, [clients]);

  // Estimated reach based on targeting filters
  const estimatedReach = useMemo(() => {
    if (targeting.filterType === 'all') return activeClients.length;
    if (targeting.filterType === 'newThisMonth') {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return activeClients.filter(c => new Date(c.createdAt) >= start).length;
    }
    if (targeting.filterType === 'atRisk') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      return activeClients.filter(c => {
        const lastVisit = c.visits?.length ? c.visits[c.visits.length - 1]?.date : null;
        return !lastVisit || new Date(lastVisit) < cutoff;
      }).length;
    }
    if (targeting.filterType === 'topClients') {
      return Math.min(20, Math.ceil(activeClients.length * 0.2));
    }
    if (targeting.filterType === 'membership') {
      return allMemberships.filter(m => m.status === targeting.membershipStatus).length;
    }
    if (targeting.filterType === 'loyalty') {
      return allClientLoyalty.filter(lc => lc.is_enrolled).length;
    }
    if (targeting.filterType === 'giftCard') {
      return allGiftCards.filter(gc => gc.status === 'active').length;
    }
    return activeClients.length;
  }, [targeting, activeClients, allMemberships, allClientLoyalty, allGiftCards]);

  // Intelligence suggestions based on targeting and campaign type
  const intelligenceSuggestions = useMemo(() => {
    const suggestions: { subjectLine: string; timing: string; length: string; openRate: string } = {
      subjectLine: '',
      timing: '',
      length: '',
      openRate: '',
    };
    if (targeting.filterType === 'atRisk') {
      suggestions.subjectLine = 'We miss you, {name}!';
      suggestions.timing = '3–5 days between emails';
      suggestions.length = '3-Step Sequence';
      suggestions.openRate = '24–32%';
    } else if (targeting.filterType === 'newThisMonth') {
      suggestions.subjectLine = 'Welcome to {business_name}, {name}!';
      suggestions.timing = '7 days between emails';
      suggestions.length = '5-Step Sequence';
      suggestions.openRate = '38–46%';
    } else if (targeting.filterType === 'topClients') {
      suggestions.subjectLine = 'A special offer just for you, {name}';
      suggestions.timing = '14 days between emails';
      suggestions.length = '3-Step Sequence';
      suggestions.openRate = '42–55%';
    } else if (targeting.filterType === 'membership') {
      suggestions.subjectLine = 'Your membership update, {name}';
      suggestions.timing = '7 days between emails';
      suggestions.length = '3-Step Sequence';
      suggestions.openRate = '30–40%';
    } else {
      suggestions.subjectLine = 'A message for you, {name}';
      suggestions.timing = '7 days between emails';
      suggestions.length = '3-Step Sequence';
      suggestions.openRate = '20–28%';
    }
    return suggestions;
  }, [targeting]);

  const addEmail = () => {
    const newEmail: DripEmail = {
      id: Date.now().toString(),
      subject: '',
      body: '',
      delayDays: frequency === 'custom' ? parseInt(customDays) || 7 : FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.days || 7,
      attachments: [],
    };
    setEmails([...emails, newEmail]);
  };

  const updateEmail = (id: string, updates: Partial<DripEmail>) => {
    setEmails(emails.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeEmail = (id: string) => {
    if (emails.length > 1) {
      setEmails(emails.filter((e) => e.id !== id));
    }
  };

  const duplicateEmail = (id: string) => {
    const email = emails.find((e) => e.id === id);
    if (!email) return;
    const copy: DripEmail = {
      ...email,
      id: Date.now().toString(),
      attachments: [...(email.attachments || [])],
    };
    const idx = emails.findIndex((e) => e.id === id);
    const next = [...emails];
    next.splice(idx + 1, 0, copy);
    setEmails(next);
  };

  const pickAttachment = async (emailId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const email = emails.find((e) => e.id === emailId);
        if (!email) return;

        // Calculate current total size for this email
        const currentTotalSize = (email.attachments || []).reduce((sum, a) => sum + a.size, 0);

        // Filter and validate each file
        const validAttachments: DripEmailAttachment[] = [];
        const oversizedFiles: string[] = [];
        let newTotalSize = currentTotalSize;

        for (const asset of result.assets) {
          const fileSize = asset.size || 0;

          // Check individual file size limit
          if (fileSize > MAX_FILE_SIZE_BYTES) {
            oversizedFiles.push(`${asset.name} (${formatFileSize(fileSize)})`);
            continue;
          }

          // Check if adding this file would exceed total limit
          if (newTotalSize + fileSize > MAX_TOTAL_SIZE_BYTES) {
            Alert.alert(
              t('fileSizeLimitExceeded', language),
              t('totalAttachmentSizeLimit', language).replace('{size}', `${MAX_TOTAL_SIZE_MB}MB`)
            );
            break;
          }

          validAttachments.push({
            name: asset.name,
            size: fileSize,
            type: asset.mimeType || 'application/octet-stream',
            uri: asset.uri,
          });
          newTotalSize += fileSize;
        }

        // Show alert for oversized files
        if (oversizedFiles.length > 0) {
          Alert.alert(
            t('fileTooLarge', language),
            t('maxFileSizeLimit', language).replace('{size}', `${MAX_FILE_SIZE_MB}MB`) + '\n\n' + oversizedFiles.join('\n')
          );
        }

        // Add valid attachments
        if (validAttachments.length > 0) {
          updateEmail(emailId, {
            attachments: [...(email.attachments || []), ...validAttachments],
          });
        }
      }
    } catch (error) {
      console.log('Document picker error:', error);
    }
  };

  const removeAttachment = (emailId: string, attachmentIndex: number) => {
    const email = emails.find((e) => e.id === emailId);
    if (email?.attachments) {
      updateEmail(emailId, {
        attachments: email.attachments.filter((_, i) => i !== attachmentIndex),
      });
    }
  };

  const pickEmailImage = async (emailId: string) => {
    const email = emails.find((e) => e.id === emailId);
    const currentImages = email?.images || [];
    if (currentImages.length >= MAX_IMAGES) {
      setEmailImageErrors((prev) => ({ ...prev, [emailId]: `Max ${MAX_IMAGES} images per email` }));
      return;
    }
    setEmailImageErrors((prev) => ({ ...prev, [emailId]: null }));
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: MAX_IMAGE_DIMENSION } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      const response = await fetch(manipResult.uri);
      const blob = await response.blob();
      const sizeBytes = blob.size;
      if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
        setEmailImageErrors((prev) => ({ ...prev, [emailId]: 'Image too large after compression (max 500KB)' }));
        return;
      }
      const newImage: DripEmailImage = {
        uri: manipResult.uri,
        name: `email_image_${Date.now()}.jpg`,
        size: sizeBytes,
      };
      updateEmail(emailId, { images: [...currentImages, newImage] });
    } catch (error) {
      console.log('Image picker error:', error);
      setEmailImageErrors((prev) => ({ ...prev, [emailId]: 'Failed to process image' }));
    }
  };

  const removeEmailImage = (emailId: string, imageIndex: number) => {
    const email = emails.find((e) => e.id === emailId);
    if (email?.images) {
      updateEmail(emailId, { images: email.images.filter((_, i) => i !== imageIndex) });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image size={14} color="#8B5CF6" />;
    if (type.includes('pdf')) return <FileText size={14} color="#EF4444" />;
    return <File size={14} color="#64748B" />;
  };

  const toggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  const handleSave = async () => {
    // Flush HTML from each rich text editor into emails state before validating
    const flushedEmails = await Promise.all(
      emails.map(async (e) => {
        const editorRef = richEditorRefs.current[e.id];
        if (editorRef) {
          try {
            const html = await editorRef.getHtml();
            return { ...e, body: html };
          } catch {
            return e;
          }
        }
        return e;
      })
    );

    if (!name.trim() || flushedEmails.some((e) => !e.subject.trim() || !e.body.trim())) {
      Alert.alert(t('missingInformation', language), t('fillCampaignFields', language));
      return;
    }

    const campaignData = {
      name: name.trim(),
      color,
      emails: flushedEmails,
      frequency,
      customDays: frequency === 'custom' ? parseInt(customDays) || 7 : undefined,
      isActive: campaign?.isActive ?? false,
      isEuEnabled,
      triggerType: trigger.triggerType,
      triggerConfig: trigger,
    };

    if (campaign) {
      updateDripCampaign(campaign.id, campaignData);
      // Sync updated campaign to Supabase (non-blocking)
      if (businessId) {
        const updated = { ...campaign, ...campaignData };
        syncCampaignToSupabase(updated, businessId).catch(() => {});
      }
      // Update client assignments
      const currentAssigned = clients.filter((c) => c.dripCampaignId === campaign.id).map((c) => c.id);
      // Remove unselected
      currentAssigned.forEach((clientId) => {
        if (!selectedClientIds.includes(clientId)) {
          assignClientToDrip(clientId, undefined);
          // Persist unassignment to Supabase
          if (businessId) persistClientDripAssignment(clientId, null, businessId).catch(() => {});
        }
      });
      // Add newly selected
      selectedClientIds.forEach((clientId) => {
        if (!currentAssigned.includes(clientId)) {
          assignClientToDrip(clientId, campaign.id);
          // Persist assignment to Supabase so the drip scheduler can find this client
          if (businessId) persistClientDripAssignment(clientId, campaign.id, businessId).catch(() => {});
        }
      });
    } else {
      addDripCampaign(campaignData);
      // Sync new campaign to Supabase — need the generated ID, so get it from the store after add
      if (businessId) {
        setTimeout(() => {
          const newCampaign = useStore.getState().dripCampaigns.find(
            (c) => c.name === campaignData.name && c.userId === user?.id
          );
          if (newCampaign) {
            syncCampaignToSupabase(newCampaign, businessId).catch(() => {});
          }
        }, 50);
      }
    }

    onShowSuccess();
    // Small delay to let the toast appear before view changes
    setTimeout(() => {
      onSave();
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {/* Context Label (when opened from Smart Recommendation) */}
        {prefill?.contextLabel && (
          <Animated.View entering={FadeInDown.delay(0).duration(300)} style={{ marginBottom: 16 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? `${primaryColor}18` : `${primaryColor}0E`,
              borderWidth: 1,
              borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`,
              borderRadius: 12,
              padding: 12,
            }}>
              <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: isDark ? `${primaryColor}35` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Zap size={14} color={primaryColor} />
              </View>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text, lineHeight: 18 }}>
                {prefill.contextLabel}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Campaign Name */}
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>{t('campaignName', language)} *</Text>
          <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('welcomeSeriesPlaceholder', language)}
              style={{ fontSize: 16, color: colors.inputText }}
              placeholderTextColor={colors.inputPlaceholder}
              cursorColor={primaryColor}
              selectionColor={`${primaryColor}40`}
            />
          </View>
        </Animated.View>

        {/* ── Smart Conditions (Trigger) ─────────────────────── */}
        <Animated.View entering={FadeInDown.delay(90).duration(300)} className="mt-4">
          <SectionHeader
            icon={<Timer size={15} color={primaryColor} />}
            title={t('triggerType', language)}
            subtitle={t('sendFrequency', language)}
            expanded={showTrigger}
            onToggle={() => setShowTrigger(v => !v)}
            badge={trigger.triggerType !== 'manual' ? t(({
              manual: 'triggerManual',
              onClientAdded: 'triggerOnClientAdded',
              afterAppointment: 'triggerAfterAppointment',
              daysAfterLastVisit: 'triggerDaysAfterLastVisit',
              birthday: 'triggerBirthday',
              membershipExpiring: 'triggerMembershipExpiring',
              loyaltyThreshold: 'triggerLoyaltyThreshold',
              noVisitXDays: 'triggerNoVisitXDays',
            } as const)[trigger.triggerType], language) : undefined}
          />
          {showTrigger && (
            <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: `${primaryColor}30`, borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 16 }}>
              {/* Trigger type grid */}
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('triggerType', language)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {([
                  { key: 'manual', Icon: Hand, labelKey: 'triggerManual' },
                  { key: 'onClientAdded', Icon: UserPlus, labelKey: 'triggerOnClientAdded' },
                  { key: 'afterAppointment', Icon: CalendarDays, labelKey: 'triggerAfterAppointment' },
                  { key: 'daysAfterLastVisit', Icon: CalendarClock, labelKey: 'triggerDaysAfterLastVisit' },
                  { key: 'birthday', Icon: Cake, labelKey: 'triggerBirthday' },
                  { key: 'membershipExpiring', Icon: CreditCard, labelKey: 'triggerMembershipExpiring' },
                  { key: 'loyaltyThreshold', Icon: Star, labelKey: 'triggerLoyaltyThreshold' },
                  { key: 'noVisitXDays', Icon: Hourglass, labelKey: 'triggerNoVisitXDays' },
                ] as { key: TriggerType; Icon: React.ComponentType<{ size: number; color: string }>; labelKey: TranslationKey }[]).map(({ key, Icon, labelKey }) => {
                  const isActive = trigger.triggerType === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setTrigger(prev => ({ ...prev, triggerType: key }))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: isActive ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                        borderWidth: 1,
                        borderColor: isActive ? primaryColor : colors.border,
                      }}
                    >
                      <Icon size={14} color={isActive ? '#fff' : primaryColor} />
                      <Text style={{ fontSize: 12, fontWeight: '500', color: isActive ? '#fff' : colors.textSecondary, marginLeft: 6 }}>
                        {t(labelKey, language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Send Frequency */}
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('sendFrequency', language)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {([
                  { days: 0, labelKey: 'sendImmediately' },
                  { days: 1, labelKey: 'day1' },
                  { days: 3, labelKey: 'days3' },
                  { days: 7, labelKey: 'days7' },
                  { days: 14, labelKey: 'days14' },
                  { days: 30, labelKey: 'days30' },
                ] as { days: number; labelKey: TranslationKey }[]).map(({ days, labelKey }) => (
                  <Pressable
                    key={days}
                    onPress={() => { setTrigger(prev => ({ ...prev, delayDays: days })); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: trigger.delayDays === days ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: trigger.delayDays === days ? primaryColor : colors.border }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: trigger.delayDays === days ? '#fff' : colors.textSecondary }}>{t(labelKey, language)}</Text>
                  </Pressable>
                ))}
                {/* Custom option */}
                <Pressable
                  onPress={() => setTrigger(prev => ({ ...prev, delayDays: -1 }))}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: trigger.delayDays === -1 ? primaryColor : (isDark ? colors.backgroundTertiary : '#F1F5F9'), borderWidth: 1, borderColor: trigger.delayDays === -1 ? primaryColor : colors.border }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: trigger.delayDays === -1 ? '#fff' : colors.textSecondary }}>{t('custom', language)}</Text>
                </Pressable>
              </View>
              {trigger.delayDays === -1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, gap: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('every', language)}</Text>
                  <TextInput
                    value={customDelayDays}
                    onChangeText={setCustomDelayDays}
                    placeholder="7"
                    keyboardType="number-pad"
                    style={{ backgroundColor: isDark ? colors.background : '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, color: colors.inputText, width: 64, textAlign: 'center', borderWidth: 1, borderColor: colors.border }}
                    placeholderTextColor={colors.inputPlaceholder}
                    cursorColor={primaryColor}
                    selectionColor={`${primaryColor}40`}
                  />
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('days', language)}</Text>
                </View>
              )}

              {/* Quiet hours */}
              <View style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Moon size={14} color={colors.textSecondary} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>{t('quietHours', language)}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>{t('quietHoursDesc', language)}</Text>
                    </View>
                  </View>
                  <Switch
                    value={trigger.quietHoursEnabled}
                    onValueChange={(v) => setTrigger(prev => ({ ...prev, quietHoursEnabled: v }))}
                    trackColor={{ false: colors.border, true: `${primaryColor}80` }}
                    thumbColor={trigger.quietHoursEnabled ? primaryColor : colors.textTertiary}
                  />
                </View>
                {trigger.quietHoursEnabled && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginBottom: 4 }}>{t('quietHoursFrom', language)}</Text>
                      <TextInput
                        value={trigger.quietHoursFrom}
                        onChangeText={(v) => setTrigger(prev => ({ ...prev, quietHoursFrom: v }))}
                        placeholder="22:00"
                        style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 8, padding: 10, color: colors.inputText, textAlign: 'center', borderWidth: 1, borderColor: colors.border }}
                        placeholderTextColor={colors.inputPlaceholder}
                      />
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>→</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginBottom: 4 }}>{t('quietHoursTo', language)}</Text>
                      <TextInput
                        value={trigger.quietHoursTo}
                        onChangeText={(v) => setTrigger(prev => ({ ...prev, quietHoursTo: v }))}
                        placeholder="08:00"
                        style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 8, padding: 10, color: colors.inputText, textAlign: 'center', borderWidth: 1, borderColor: colors.border }}
                        placeholderTextColor={colors.inputPlaceholder}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </Animated.View>

        {/* Emails */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)} className="mt-5">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14, flexShrink: 1 }}>{t('emailSequence', language)} *</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {/* Generate with AI button */}
              <Pressable
                onPress={generateWithAI}
                disabled={isGeneratingAI}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 20,
                  backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
                  borderWidth: 1,
                  borderColor: isDark ? `${primaryColor}50` : `${primaryColor}30`,
                  opacity: isGeneratingAI ? 0.6 : 1,
                }}
              >
                {isGeneratingAI ? (
                  <>
                    <Sparkles size={13} color={primaryColor} />
                    <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 12, marginLeft: 5 }}>{t('generatingWithAI', language)}</Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} color={primaryColor} />
                    <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 12, marginLeft: 5 }}>{t('generateWithAI', language)}</Text>
                  </>
                )}
              </Pressable>
              <Pressable onPress={addEmail} className="flex-row items-center">
                <Plus size={16} color={primaryColor} />
                <Text style={{ color: primaryColor, fontWeight: '500', fontSize: 14, marginLeft: 4 }}>{t('addEmail', language)}</Text>
              </Pressable>
            </View>
          </View>

          {/* AI error message */}
          {aiError && (
            <View style={{ backgroundColor: isDark ? '#EF444420' : '#FEF2F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
              <AlertCircle size={14} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 12, marginLeft: 6, flex: 1 }}>{aiError}</Text>
            </View>
          )}

          {emails.map((email, index) => (
            <View
              key={email.id}
              style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 16, marginBottom: 12 }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <Text className="text-white text-xs font-bold">{index + 1}</Text>
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 8 }}>
                    {index === 0
                      ? t('sentImmediately', language)
                      : t('sentAfterDays', language).replace('{days}', String(email.delayDays))}
                  </Text>
                </View>
                {emails.length > 1 && (
                  <Pressable onPress={() => removeEmail(email.id)}>
                    <Trash2 size={18} color="#EF4444" />
                  </Pressable>
                )}
              </View>
              <TextInput
                value={email.subject}
                onChangeText={(text) => updateEmail(email.id, { subject: text })}
                placeholder={t('emailSubjectPlaceholder', language)}
                style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 8, padding: 12, color: colors.inputText, marginBottom: 8 }}
                placeholderTextColor={colors.inputPlaceholder}
                cursorColor={primaryColor}
                selectionColor={`${primaryColor}40`}
              />

              {/* Rich Text Formatting Toolbar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                {[
                  { icon: <Bold size={16} color={(emailFmtState[email.id]?.has('bold')) ? primaryColor : colors.textSecondary} />, onPress: () => richEditorRefs.current[email.id]?.sendCommand('bold'), active: emailFmtState[email.id]?.has('bold') ?? false },
                  { icon: <Italic size={16} color={(emailFmtState[email.id]?.has('italic')) ? primaryColor : colors.textSecondary} />, onPress: () => richEditorRefs.current[email.id]?.sendCommand('italic'), active: emailFmtState[email.id]?.has('italic') ?? false },
                  { icon: <Link2 size={16} color={(emailShowLinkModal[email.id]) ? primaryColor : colors.textSecondary} />, onPress: () => setEmailShowLinkModal((prev) => ({ ...prev, [email.id]: true })), active: emailShowLinkModal[email.id] ?? false },
                  { icon: <List size={16} color={(emailFmtState[email.id]?.has('bullets')) ? primaryColor : colors.textSecondary} />, onPress: () => richEditorRefs.current[email.id]?.sendCommand('insertUnorderedList'), active: emailFmtState[email.id]?.has('bullets') ?? false },
                  { icon: <AlignLeft size={16} color={(emailTextAlign[email.id] ?? 'left') === 'left' ? primaryColor : colors.textSecondary} />, onPress: () => { setEmailTextAlign((p) => ({ ...p, [email.id]: 'left' })); richEditorRefs.current[email.id]?.sendCommand('justifyLeft'); }, active: (emailTextAlign[email.id] ?? 'left') === 'left' },
                  { icon: <AlignCenter size={16} color={emailTextAlign[email.id] === 'center' ? primaryColor : colors.textSecondary} />, onPress: () => { setEmailTextAlign((p) => ({ ...p, [email.id]: 'center' })); richEditorRefs.current[email.id]?.sendCommand('justifyCenter'); }, active: emailTextAlign[email.id] === 'center' },
                  { icon: <AlignRight size={16} color={emailTextAlign[email.id] === 'right' ? primaryColor : colors.textSecondary} />, onPress: () => { setEmailTextAlign((p) => ({ ...p, [email.id]: 'right' })); richEditorRefs.current[email.id]?.sendCommand('justifyRight'); }, active: emailTextAlign[email.id] === 'right' },
                ].map((btn, idx) => (
                  <Pressable
                    key={idx}
                    onPress={btn.onPress}
                    style={{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2, backgroundColor: btn.active ? `${primaryColor}20` : 'transparent' }}
                  >
                    {btn.icon}
                  </Pressable>
                ))}
              </View>

              {/* Link Modal */}
              {emailShowLinkModal[email.id] && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24 }}>
                  <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                      <Link2 size={18} color={primaryColor} style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Insert Link</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>URL *</Text>
                    <TextInput
                      value={emailLinkUrl[email.id] ?? ''}
                      onChangeText={(v) => setEmailLinkUrl((p) => ({ ...p, [email.id]: v }))}
                      placeholder="https://example.com"
                      placeholderTextColor={colors.textTertiary}
                      style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, marginBottom: 12 }}
                      autoCapitalize="none"
                      keyboardType="url"
                      autoFocus
                    />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Display Text (optional)</Text>
                    <TextInput
                      value={emailLinkText[email.id] ?? ''}
                      onChangeText={(v) => setEmailLinkText((p) => ({ ...p, [email.id]: v }))}
                      placeholder="Click here"
                      placeholderTextColor={colors.textTertiary}
                      style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, marginBottom: 20 }}
                      returnKeyType="done"
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Pressable
                        onPress={() => { setEmailShowLinkModal((p) => ({ ...p, [email.id]: false })); setEmailLinkUrl((p) => ({ ...p, [email.id]: '' })); setEmailLinkText((p) => ({ ...p, [email.id]: '' })); }}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                      >
                        <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          const url = (emailLinkUrl[email.id] ?? '').trim();
                          if (!url) return;
                          const fullUrl = url.startsWith('http') ? url : `https://${url}`;
                          const displayText = (emailLinkText[email.id] ?? '').trim() || fullUrl;
                          richEditorRefs.current[email.id]?.sendCommand('insertLink', JSON.stringify({ url: fullUrl, text: displayText }));
                          setEmailShowLinkModal((p) => ({ ...p, [email.id]: false }));
                          setEmailLinkUrl((p) => ({ ...p, [email.id]: '' }));
                          setEmailLinkText((p) => ({ ...p, [email.id]: '' }));
                        }}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: primaryColor, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Insert</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}

              {/* Rich Text Editor */}
              <RichTextEditor
                key={`${editorResetKey}-${email.id}`}
                ref={(ref) => { richEditorRefs.current[email.id] = ref; }}
                initialHtml={email.body}
                placeholder={t('emailBodyPlaceholder', language)}
                minHeight={100}
                maxHeight={240}
                primaryColor={primaryColor}
                textColor={colors.inputText}
                backgroundColor={isDark ? colors.backgroundTertiary : '#F8FAFC'}
                placeholderColor={colors.inputPlaceholder}
                onContentChange={(hasContent) => {
                  if (!hasContent) updateEmail(email.id, { body: '' });
                }}
                onFmtStateChange={(state) => {
                  setEmailFmtState((prev) => {
                    const s = new Set(prev[email.id] ?? []);
                    state.bold ? s.add('bold') : s.delete('bold');
                    state.italic ? s.add('italic') : s.delete('italic');
                    state.insertUnorderedList ? s.add('bullets') : s.delete('bullets');
                    return { ...prev, [email.id]: s };
                  });
                }}
              />

              {/* Attachments Section */}
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '600' }}>{t('attachments', language)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Add Image Button */}
                    <Pressable
                      onPress={() => pickEmailImage(email.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: (email.images?.length ?? 0) >= MAX_IMAGES ? (isDark ? colors.backgroundTertiary : '#F1F5F9') : (isDark ? colors.backgroundTertiary : '#F0FDFA'),
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 8,
                        borderWidth: 1,
                        borderColor: (email.images?.length ?? 0) >= MAX_IMAGES ? colors.border : (isDark ? `${primaryColor}40` : `${primaryColor}30`),
                        opacity: (email.images?.length ?? 0) >= MAX_IMAGES ? 0.5 : 1,
                      }}
                    >
                      <ImageIcon size={13} color={(email.images?.length ?? 0) >= MAX_IMAGES ? colors.textTertiary : primaryColor} />
                      <Text style={{ color: (email.images?.length ?? 0) >= MAX_IMAGES ? colors.textTertiary : primaryColor, fontWeight: '500', fontSize: 12, marginLeft: 4 }}>
                        Add Image
                      </Text>
                    </Pressable>
                    {/* Add File Button */}
                    <Pressable
                      onPress={() => pickAttachment(email.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Paperclip size={13} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 12, marginLeft: 4 }}>{t('addFile', language)}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Image error */}
                {emailImageErrors[email.id] && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FECACA' }}>
                    <AlertTriangle size={13} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{emailImageErrors[email.id]}</Text>
                  </View>
                )}

                {/* Image thumbnails */}
                {email.images && email.images.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {email.images.map((img, imgIdx) => (
                      <View key={imgIdx} style={{ position: 'relative' }}>
                        <RNImage source={{ uri: img.uri }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: colors.border }} resizeMode="cover" />
                        <Pressable
                          onPress={() => removeEmailImage(email.id, imgIdx)}
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={11} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* File attachments list */}
                {email.attachments && email.attachments.length > 0 ? (
                  <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
                    {email.attachments.map((attachment, attIndex) => (
                      <View
                        key={attIndex}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: attIndex < email.attachments!.length - 1 ? 1 : 0, borderBottomColor: colors.border }}
                      >
                        <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                          {getFileIcon(attachment.type)}
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>{attachment.name}</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{formatFileSize(attachment.size)}</Text>
                        </View>
                        <Pressable onPress={() => removeAttachment(email.id, attIndex)} style={{ padding: 4 }}>
                          <X size={14} color="#EF4444" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Helper text */}
                <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4 }}>
                  {t('attachmentHelperText', language).replace('{size}', `${MAX_FILE_SIZE_MB}MB`)}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Client Assignment (only for editing) */}
        {campaign && (
          <Animated.View entering={FadeInDown.delay(200).duration(300)} className="mt-5">
            <Pressable
              onPress={() => setShowClientAssignment(!showClientAssignment)}
              className="flex-row items-center justify-between mb-2"
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
                {t('assignedClients', language)} ({selectedClientIds.length})
              </Text>
              <ChevronRight
                size={18}
                color={colors.textSecondary}
                style={{ transform: [{ rotate: showClientAssignment ? '90deg' : '0deg' }] }}
              />
            </Pressable>

            {showClientAssignment && (
              <View style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, maxHeight: 256, overflow: 'hidden' }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {activeClients.map((client) => (
                    <Pressable
                      key={client.id}
                      onPress={() => toggleClient(client.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          marginRight: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selectedClientIds.includes(client.id) ? primaryColor : 'transparent',
                          borderColor: selectedClientIds.includes(client.id) ? primaryColor : colors.border,
                        }}
                      >
                        {selectedClientIds.includes(client.id) && (
                          <Check size={14} color="#fff" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text style={{ color: colors.textSecondary }}>{client.name}</Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{client.email}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </Animated.View>
        )}

        {/* Mandatory Email Footer Preview (Country/State Based) */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)} className="mt-5">
          <View className="flex-row items-center mb-2">
            <Shield size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14, marginLeft: 8 }}>{t('mandatoryEmailFooter', language)}</Text>
          </View>
          <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 12 }}>
              {getComplianceHelperMessage(user?.businessCountry, language, user?.businessState)}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
              {(() => {
                const footerPreview = getEmailFooterPreview(
                  user?.businessName || t('yourBusinessName', language),
                  user?.businessAddress || t('businessAddressNotSet', language),
                  user?.businessCountry,
                  user?.businessState,
                  user?.emailFooterLanguage || 'en',
                  user?.businessPhoneNumber
                );
                return (
                  <>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 8 }}>---</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>
                      {footerPreview.businessName}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                      {footerPreview.businessAddress}
                    </Text>
                    {footerPreview.businessPhoneNumber && (
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                        {formatPhoneForEmailFooter(footerPreview.businessPhoneNumber)}
                      </Text>
                    )}
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }}>
                      {footerPreview.receivingText}
                    </Text>
                    <Text style={{ color: primaryColor, fontSize: 12, marginTop: 4, textDecorationLine: 'underline' }}>
                      {footerPreview.unsubscribeText}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                      {footerPreview.linkActiveText}
                    </Text>
                    {footerPreview.legalNotice && (
                      <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                        {footerPreview.legalNotice}
                      </Text>
                    )}
                  </>
                );
              })()}
            </View>
            {!user?.businessAddress && (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                <AlertTriangle size={14} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontSize: 12, marginLeft: 8, flex: 1 }}>
                  {t('addBusinessAddressHint', language)}
                </Text>
              </View>
            )}
            {!user?.businessCountry && user?.businessAddress && (
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                <Globe size={14} color="#3B82F6" />
                <Text style={{ color: '#3B82F6', fontSize: 12, marginLeft: 8, flex: 1 }}>
                  {t('countryLegalHelper', language)}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row' }}>
        <Pressable
          onPress={onCancel}
          style={{ flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', marginRight: 8 }}
        >
          <Text style={{ fontWeight: '600', fontSize: 16, color: colors.textSecondary }}>{t('cancel', language)}</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={{ flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: buttonColor, marginLeft: 8 }}
        >
          <Text style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>
            {campaign ? t('saveChanges', language) : t('createCampaignButton', language)}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
