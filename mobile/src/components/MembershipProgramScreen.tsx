import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Plus,
  Crown,
  Settings,
  Settings2,
  ChevronRight,
  ChevronDown,
  Check,
  Trash2,
  Percent,
  Gift,
  CreditCard,
  Sparkles,
  Bell,
  Clock,
  Calendar,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Mail,
  Zap,
  Users,
  TrendingUp,
  AlertCircle,
  BarChart3,
  XCircle,
  Hash,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import {
  Language,
  MembershipPlan,
  MembershipBenefit,
  MembershipSettings,
  MembershipRenewalCycle,
} from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import {
  useMembershipSettings,
  useUpdateMembershipSettings,
  useMembershipPlans,
  useCreateMembershipPlan,
  useUpdateMembershipPlan,
  useDeleteMembershipPlan,
  useMembershipAnalytics,
  useAllMemberships,
} from '@/hooks/useMembership';
import { useServices } from '@/hooks/useServices';
import { formatCurrency } from '@/lib/currency';
import { useClients } from '@/hooks/useClients';
import { useAllClientLoyalty } from '@/hooks/useLoyalty';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useStores } from '@/hooks/useStores';
import { ToggleSwitch } from './membership/ToggleSwitch';
import { BenefitItem, EditingBenefit, BenefitType } from './membership/BenefitItem';
import { PlanCard } from './membership/PlanCard';
import { PlanModal } from './membership/PlanModal';
import { MembershipAssignView } from './membership/MembershipAssignView';
import { SetupHint } from '@/components/SetupHint';
import { HighlightWrapper } from '@/components/HighlightWrapper';

// ============================================
// Main Membership Program Screen
// ============================================


interface MembershipProgramScreenProps {
  visible: boolean;
  onClose: () => void;
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
  onOpenMarketing?: (prefill?: {
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string;
    contextLabel?: string;
  }) => void;
  setupHint?: string;
}

export function MembershipProgramScreen({ visible, onClose, onOpenSmartDrip, onOpenMarketing, setupHint }: MembershipProgramScreenProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const currency = useStore((s) => s.currency);

  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useMembershipSettings();
  const { data: plans = [], isLoading: plansLoading, refetch: refetchPlans } = useMembershipPlans();
  const { data: analytics, isLoading: analyticsLoading } = useMembershipAnalytics();
  const { data: allMemberships = [] } = useAllMemberships();
  const updateSettings = useUpdateMembershipSettings();

  const [activeTab, setActiveTab] = useTabPersistence<'assign' | 'plans' | 'analytics'>('membership_program', 'assign');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);

  // Local settings state
  const [isEnabled, setIsEnabled] = useState(settings?.isEnabled ?? false);
  const [notifyBeforeRenewalDays, setNotifyBeforeRenewalDays] = useState(String(settings?.notifyBeforeRenewalDays ?? 7));
  const [notifyPastDueDays, setNotifyPastDueDays] = useState(String(settings?.notifyPastDueDays ?? 3));
  const [gracePeriodDays, setGracePeriodDays] = useState(String(settings?.gracePeriodDays ?? 7));

  // Sync local state with fetched settings
  React.useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setNotifyBeforeRenewalDays(String(settings.notifyBeforeRenewalDays));
      setNotifyPastDueDays(String(settings.notifyPastDueDays));
      setGracePeriodDays(String(settings.gracePeriodDays));
    }
  }, [settings]);

  // Highlight / auto-scroll for setupHint
  const scrollRef = useRef<ScrollView>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightY, setHighlightY] = useState(0);

  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] MembershipProgramScreen hint:', setupHint);
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

  const handleToggleEnabled = async () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
    try {
      await updateSettings.mutateAsync({ isEnabled: newValue });
    } catch (error) {
      setIsEnabled(!newValue); // Revert on error
      console.error('Failed to update settings:', error);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await updateSettings.mutateAsync({
        notifyBeforeRenewalDays: parseInt(notifyBeforeRenewalDays) || 7,
        notifyPastDueDays: parseInt(notifyPastDueDays) || 3,
        gracePeriodDays: parseInt(gracePeriodDays) || 7,
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const activePlans = plans.filter((p) => p.isActive);
  const inactivePlans = plans.filter((p) => !p.isActive);

  // Analytics detail view states
  const [showActiveMembersDetail, setShowActiveMembersDetail] = useState(false);
  const [showPastDueDetail, setShowPastDueDetail] = useState(false);
  const [showRevenueDetail, setShowRevenueDetail] = useState(false);
  const [showBenefitUsageDetail, setShowBenefitUsageDetail] = useState(false);

  // Client name lookup for detail views
  const { data: rawClientsData = [] } = useClients();
  const memberClientIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of rawClientsData) {
      if ((c as any).name) map.set(c.id, (c as any).name as string);
    }
    return map;
  }, [rawClientsData]);

  // Active members enriched list
  const activeMembersList = useMemo(() => {
    return allMemberships
      .filter((m) => m.status === 'active')
      .map((m) => {
        const plan = plans.find((p) => p.id === m.planId);
        const name = memberClientIdToName.get(m.clientId) ?? `#${m.clientId.slice(0, 8)}`;
        return { id: m.id, name, planName: plan?.name ?? '—', nextRenewalDate: m.nextRenewalDate };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMemberships, plans, memberClientIdToName]);

  // Past due members enriched list
  const pastDueList = useMemo(() => {
    return allMemberships
      .filter((m) => m.status === 'past_due')
      .map((m) => {
        const plan = plans.find((p) => p.id === m.planId);
        const name = memberClientIdToName.get(m.clientId) ?? `#${m.clientId.slice(0, 8)}`;
        return { id: m.id, name, planName: plan?.name ?? '—', nextRenewalDate: m.nextRenewalDate };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMemberships, plans, memberClientIdToName]);

  // Revenue detail list — one row per active member with their plan price
  const revenueDetailList = useMemo(() => {
    return allMemberships
      .filter((m) => m.status === 'active')
      .map((m) => {
        const plan = plans.find((p) => p.id === m.planId);
        const name = memberClientIdToName.get(m.clientId) ?? `#${m.clientId.slice(0, 8)}`;
        return {
          id: m.id,
          name,
          planName: plan?.name ?? '—',
          monthlyAmount: plan ? (plan.renewalCycle === 'yearly' ? (plan.displayPrice / 12) : plan.displayPrice) : 0,
          yearlyAmount: plan ? (plan.renewalCycle === 'yearly' ? plan.displayPrice : plan.displayPrice * 12) : 0,
        };
      })
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  }, [allMemberships, plans, memberClientIdToName]);

  // Benefit usage detail list — one row per active/past_due member with credits + services used
  const benefitUsageList = useMemo(() => {
    return allMemberships
      .filter((m) => m.status === 'active' || m.status === 'past_due')
      .map((m) => {
        const plan = plans.find((p) => p.id === m.planId);
        const name = memberClientIdToName.get(m.clientId) ?? `#${m.clientId.slice(0, 8)}`;
        const totalFreeServicesUsed = m.freeServicesUsed.reduce((sum, s) => sum + s.usedCount, 0);
        return { id: m.id, name, planName: plan?.name ?? '—', creditBalance: m.creditBalance, freeServicesUsed: totalFreeServicesUsed };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMemberships, plans, memberClientIdToName]);

  // ─── Detail render helpers ─────────────────────────────────────────────────

  const renderActiveMembersDetail = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      {/* Back button */}
      <Pressable
        onPress={() => setShowActiveMembersDetail(false)}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
      >
        <ChevronRight size={18} color={primaryColor} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15, marginLeft: 4 }}>
          {t('membershipActiveMembers', language)}
        </Text>
      </Pressable>

      {/* AI SmartDrip card */}
      {onOpenSmartDrip && activeMembersList.length > 0 && (
        <Pressable
          onPress={() => onOpenSmartDrip({ name: t('smartTripMemberSignupName', language), frequency: 'monthly', contextLabel: t('smartRecommendationMemberSignup', language) })}
          style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiSmartDripCampaign', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>
              {t('smartRecommendationMemberSignup', language)}
            </Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}

      {/* AI Marketing Promotion card */}
      {onOpenMarketing && activeMembersList.length > 0 && (
        <Pressable
          onPress={() => onOpenMarketing({ discountType: 'percentage', name: t('membershipPromoName', language), contextLabel: t('membershipPromoContext', language) })}
          style={{ backgroundColor: isDark ? '#8B5CF620' : '#8B5CF612', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: isDark ? '#8B5CF640' : '#8B5CF625', flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? '#8B5CF630' : '#8B5CF620', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={24} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color="#8B5CF6" />
              <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiMarketingPromotion', language)}</Text>
            </View>
            <Text style={{ color: isDark ? '#8B5CF6DD' : '#8B5CF6CC', fontSize: 13, lineHeight: 18 }}>
              {t('membershipPromoContext', language)}
            </Text>
          </View>
          <ChevronRight size={20} color="#8B5CF6" />
        </Pressable>
      )}

      {/* Members list */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
        {activeMembersList.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{t('membershipNoActiveMembers', language)}</Text>
          </View>
        ) : activeMembersList.map((member, index) => {
          const initials = member.name.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
          return (
            <View
              key={member.id}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 15 }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{member.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{member.planName}</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {member.nextRenewalDate ? new Date(member.nextRenewalDate).toLocaleDateString() : '—'}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderPastDueDetail = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      {/* Back button */}
      <Pressable
        onPress={() => setShowPastDueDetail(false)}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
      >
        <ChevronRight size={18} color={primaryColor} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15, marginLeft: 4 }}>
          {t('membershipPastDue', language)}
        </Text>
      </Pressable>

      {/* AI SmartDrip renewal card */}
      {onOpenSmartDrip && pastDueList.length > 0 && (
        <Pressable
          onPress={() => onOpenSmartDrip({ name: t('smartTripMemberRenewalName', language), frequency: 'weekly', contextLabel: t('smartRecommendationMembershipRenewal', language) })}
          style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiSmartDripCampaign', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>
              {t('smartRecommendationMembershipRenewal', language)}
            </Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}

      {/* Past-due list */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
        {pastDueList.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{t('membershipNoPastDueMembers', language)}</Text>
          </View>
        ) : pastDueList.map((member, index) => {
          const initials = member.name.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
          return (
            <View
              key={member.id}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 15 }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{member.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{member.planName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AlertCircle size={14} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontSize: 11, marginTop: 2 }}>
                  {member.nextRenewalDate ? new Date(member.nextRenewalDate).toLocaleDateString() : '—'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderRevenueDetail = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      {/* Back button */}
      <Pressable
        onPress={() => setShowRevenueDetail(false)}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
      >
        <ChevronRight size={18} color={primaryColor} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15, marginLeft: 4 }}>
          {t('membershipEstimatedRevenue', language)}
        </Text>
      </Pressable>

      {/* Revenue totals summary */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipCycleMonthly', language)}</Text>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
            {formatCurrency(analytics?.estimatedMonthlyRevenue || 0, currency)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipCycleYearly', language)}</Text>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
            {formatCurrency(analytics?.estimatedYearlyRevenue || 0, currency)}
          </Text>
        </View>
      </View>

      {/* Per-member breakdown */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
        {revenueDetailList.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{t('membershipNoActiveMembers', language)}</Text>
          </View>
        ) : revenueDetailList.map((member, index) => {
          const initials = member.name.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
          return (
            <View
              key={member.id}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 15 }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{member.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{member.planName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{formatCurrency(member.monthlyAmount, currency)}/mo</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{formatCurrency(member.yearlyAmount, currency)}/yr</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderBenefitUsageDetail = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      {/* Back button */}
      <Pressable
        onPress={() => setShowBenefitUsageDetail(false)}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
      >
        <ChevronRight size={18} color={primaryColor} style={{ transform: [{ rotate: '180deg' }] }} />
        <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 15, marginLeft: 4 }}>
          {t('membershipBenefitUsage', language)}
        </Text>
      </Pressable>

      {/* Totals summary */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipCreditsUsed', language)}</Text>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
            {formatCurrency(analytics?.totalCreditsUsed || 0, currency)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipFreeServicesRedeemed', language)}</Text>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
            {analytics?.totalFreeServicesRedeemed || 0}
          </Text>
        </View>
      </View>

      {/* Per-member benefit usage */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' }}>
        {benefitUsageList.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{t('membershipNoActiveMembers', language)}</Text>
          </View>
        ) : benefitUsageList.map((member, index) => {
          const initials = member.name.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
          return (
            <View
              key={member.id}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 15 }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{member.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{member.planName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {member.creditBalance > 0 && (
                  <Text style={{ color: '#8B5CF6', fontWeight: '600', fontSize: 13 }}>
                    {formatCurrency(member.creditBalance, currency)} {t('membershipCreditsUsed', language)}
                  </Text>
                )}
                {member.freeServicesUsed > 0 && (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {member.freeServicesUsed} {t('membershipFreeServicesRedeemed', language)}
                  </Text>
                )}
                {member.creditBalance === 0 && member.freeServicesUsed === 0 && (
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>—</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
                flexShrink: 0,
              }}
            >
              <Crown size={22} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, flexShrink: 1, minWidth: 0 }}>
              {t('membershipProgram', language)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
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

        {/* Tab Navigation — Loyalty-style pill bar */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              borderRadius: 14,
              padding: 4,
            }}
          >
            {([
              { key: 'assign' as const, line1: t('membershipTabAssignLine1', language), line2: t('membershipTabAssignLine2', language) },
              { key: 'plans' as const, line1: t('membershipTabPlansLine1', language), line2: t('membershipTabPlansLine2', language) },
              { key: 'analytics' as const, line1: t('membershipTabAnalyticsLine1', language), line2: t('membershipTabAnalyticsLine2', language) },
            ]).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive ? (isDark ? colors.card : '#fff') : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '500', color: isActive ? primaryColor : colors.textSecondary, lineHeight: 15, textAlign: 'center' }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {tab.line1}
                  </Text>
                  {tab.line2 ? (
                    <Text style={{ fontSize: 11, fontWeight: '500', color: isActive ? primaryColor : colors.textSecondary, lineHeight: 15, textAlign: 'center' }}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {tab.line2}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Assign & Manage Tab */}
        <SetupHint hintKey={setupHint} />
        {activeTab === 'assign' && <MembershipAssignView />}

        {/* Plans Tab — Section 1: Settings, Section 2: Plans */}
        {activeTab === 'plans' && (
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* SECTION 1 — Settings */}
            <Animated.View entering={FadeInDown.delay(0).duration(300)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Settings2 size={14} color={primaryColor} style={{ marginRight: 8 }} />
                <Text style={{ color: colors.textTertiary, fontWeight: '700', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  {t('membershipGlobalSettings', language)}
                </Text>
              </View>

              <View style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', marginBottom: 0 }}>
                {/* Enable/Disable Toggle */}
                <HighlightWrapper
                  active={highlightActive}
                  borderRadius={12}
                  onLayout={(e) => setHighlightY(e.nativeEvent.layout.y)}
                >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isEnabled ? '#10B98120' : (isDark ? colors.backgroundTertiary : '#F1F5F9'), alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
                      {isEnabled ? <ToggleRight size={18} color="#10B981" /> : <ToggleLeft size={18} color={colors.textTertiary} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{t('membershipEnableProgram', language)}</Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{isEnabled ? t('membershipProgramEnabled', language) : t('membershipProgramDisabled', language)}</Text>
                    </View>
                  </View>
                  <ToggleSwitch value={isEnabled} onValueChange={handleToggleEnabled} />
                </View>
                </HighlightWrapper>

                {/* Renewal Reminder */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Bell size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{t('membershipNotifyBeforeRenewal', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('membershipNotifyBeforeRenewalDescription', language)}</Text>
                  </View>
                  <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput style={{ fontSize: 16, color: colors.text, minWidth: 30, textAlign: 'center' }} value={notifyBeforeRenewalDays} onChangeText={setNotifyBeforeRenewalDays} onBlur={handleUpdateSettings} keyboardType="number-pad" />
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>{t('days', language)}</Text>
                  </View>
                </View>

                {/* Past Due Notice */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Clock size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{t('membershipNotifyPastDue', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('membershipNotifyPastDueDescription', language)}</Text>
                  </View>
                  <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput style={{ fontSize: 16, color: colors.text, minWidth: 30, textAlign: 'center' }} value={notifyPastDueDays} onChangeText={setNotifyPastDueDays} onBlur={handleUpdateSettings} keyboardType="number-pad" />
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>{t('days', language)}</Text>
                  </View>
                </View>

                {/* Grace Period */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Calendar size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{t('membershipGracePeriod', language)}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('membershipGracePeriodDescription', language)}</Text>
                  </View>
                  <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput style={{ fontSize: 16, color: colors.text, minWidth: 30, textAlign: 'center' }} value={gracePeriodDays} onChangeText={setGracePeriodDays} onBlur={handleUpdateSettings} keyboardType="number-pad" />
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>{t('days', language)}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Soft divider between sections */}
            <View style={{ marginTop: 28, marginBottom: 24, height: 1, backgroundColor: isDark ? `${colors.border}80` : `${colors.border}60` }} />

            {/* SECTION 2 — Membership Plans */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              {/* Header row: title left, create button right */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Crown size={20} color={primaryColor} />
                  </View>
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t('membershipPlans', language)}</Text>
                    {plans.length > 0 && (
                      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>{activePlans.length} {t('statusActive', language).toLowerCase()}</Text>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={() => { setEditingPlan(null); setShowPlanModal(true); }}
                  style={{ flexShrink: 0, marginLeft: 12, backgroundColor: primaryColor, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }}
                >
                  <Plus size={15} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 5 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('membershipNewPlan', language)}</Text>
                </Pressable>
              </View>

              {plans.length > 0 ? (
                <>
                  {activePlans.map((plan, index) => (
                    <Animated.View key={plan.id} entering={FadeInDown.delay(150 + 50 * index).duration(300)}>
                      <PlanCard plan={plan} onPress={() => { setEditingPlan(plan); setShowPlanModal(true); }} />
                    </Animated.View>
                  ))}
                  {inactivePlans.length > 0 && (
                    <>
                      <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 16, marginBottom: 8 }}>{t('membershipInactivePlans', language)}</Text>
                      {inactivePlans.map((plan, index) => (
                        <Animated.View key={plan.id} entering={FadeInDown.delay(200 + 50 * index).duration(300)}>
                          <PlanCard plan={plan} onPress={() => { setEditingPlan(plan); setShowPlanModal(true); }} />
                        </Animated.View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: isDark ? `${primaryColor}15` : `${primaryColor}10`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Crown size={28} color={primaryColor} />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 6 }}>{t('membershipNoPlans', language)}</Text>
                  <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 32, fontSize: 13 }}>{t('membershipNoPlansDescription', language)}</Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        )}
        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <>
            {showActiveMembersDetail && renderActiveMembersDetail()}
            {showPastDueDetail && renderPastDueDetail()}
            {showRevenueDetail && renderRevenueDetail()}
            {showBenefitUsageDetail && renderBenefitUsageDetail()}
            {!showActiveMembersDetail && !showPastDueDetail && !showRevenueDetail && !showBenefitUsageDetail && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              {analyticsLoading ? (
                <View className="items-center py-12">
                  <ActivityIndicator size="large" color={primaryColor} />
                </View>
              ) : (
                <>
                  {/* Summary Stats */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <Pressable
                      onPress={() => setShowActiveMembersDetail(true)}
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Users size={20} color={primaryColor} />
                        </View>
                        <ChevronRight size={16} color={colors.textTertiary} style={{ opacity: 0.5 }} />
                      </View>
                      <Text style={{ color: colors.text, fontSize: 28, fontWeight: 'bold' }}>
                        {analytics?.activeMembers || 0}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                        {t('membershipActiveMembers', language)}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setShowPastDueDetail(true)}
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <AlertCircle size={20} color={primaryColor} />
                        </View>
                        <ChevronRight size={16} color={colors.textTertiary} style={{ opacity: 0.5 }} />
                      </View>
                      <Text style={{ color: colors.text, fontSize: 28, fontWeight: 'bold' }}>
                        {analytics?.pastDueMembers || 0}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                        {t('membershipPastDue', language)}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Secondary Stats Row */}
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 16,
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <XCircle size={20} color={primaryColor} />
                      </View>
                      <Text style={{ color: colors.text, fontSize: 28, fontWeight: 'bold' }}>
                        {analytics?.cancelledMembers || 0}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                        {t('membershipCancelledMembers', language)}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 16,
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <Hash size={20} color={primaryColor} />
                      </View>
                      <Text style={{ color: colors.text, fontSize: 28, fontWeight: 'bold' }}>
                        {analytics?.totalMembers || 0}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                        {t('membershipTotalMembers', language)}
                      </Text>
                    </View>
                  </View>

                  {/* Revenue Estimates */}
                  <Pressable
                    onPress={() => setShowRevenueDetail(true)}
                    style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <TrendingUp size={18} color={primaryColor} />
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                          {t('membershipEstimatedRevenue', language)}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.textTertiary} style={{ opacity: 0.5 }} />
                    </View>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 8 }}>
                      {t('membershipRevenueNote', language)}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipCycleMonthly', language)}</Text>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                        {formatCurrency(analytics?.estimatedMonthlyRevenue || 0, currency)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipCycleYearly', language)}</Text>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                        {formatCurrency(analytics?.estimatedYearlyRevenue || 0, currency)}
                      </Text>
                    </View>
                    {onOpenSmartDrip && analytics && analytics.totalMembers > 0 && (
                      <Pressable
                        onPress={() => onOpenSmartDrip((analytics.pastDueMembers || 0) > 0 ? { name: t('smartTripMemberRenewalName', language), frequency: 'weekly', contextLabel: t('smartRecommendationMembershipRenewal', language) } : { name: t('smartTripMemberSignupName', language), frequency: 'monthly', contextLabel: t('smartRecommendationMemberSignup', language) })}
                        style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
                      >
                        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                          <Mail size={24} color={primaryColor} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Zap size={14} color={primaryColor} />
                            <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('smartRecommendation', language)}</Text>
                          </View>
                          <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>
                            {(analytics.pastDueMembers || 0) > 0 ? t('smartRecommendationMembershipRenewal', language) : t('smartRecommendationMemberSignup', language)}
                          </Text>
                        </View>
                        <ChevronRight size={20} color={primaryColor} />
                      </Pressable>
                    )}
                  </Pressable>

                  {/* Benefit Usage */}
                  <Pressable
                    onPress={() => setShowBenefitUsageDetail(true)}
                    style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <Gift size={18} color={primaryColor} />
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                          {t('membershipBenefitUsage', language)}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.textTertiary} style={{ opacity: 0.5 }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipCreditsUsed', language)}</Text>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                        {formatCurrency(analytics?.totalCreditsUsed || 0, currency)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('membershipFreeServicesRedeemed', language)}</Text>
                      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                        {analytics?.totalFreeServicesRedeemed || 0}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Top Plans */}
                  {analytics?.topPlans && analytics.topPlans.length > 0 && (
                    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16 }}>
                      <View className="flex-row items-center mb-4">
                        <Crown size={18} color={primaryColor} />
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                          {t('membershipTopPlans', language)}
                        </Text>
                      </View>
                      {analytics.topPlans.map((planStat, index) => (
                        <View
                          key={planStat.planId}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingVertical: 8,
                            borderTopWidth: index > 0 ? 1 : 0,
                            borderTopColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 14 }}>{planStat.planName}</Text>
                          <View
                            style={{
                              backgroundColor: `${primaryColor}15`,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 13 }}>
                              {planStat.memberCount} {t('membershipMembers', language)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}


                  {/* Empty state for analytics */}
                  {analytics?.totalMembers === 0 && (
                    <View className="items-center py-8">
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 16,
                          backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <BarChart3 size={28} color={colors.textTertiary} />
                      </View>
                      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                        {t('membershipNoAnalyticsDataDescription', language)}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          </ScrollView>
            )}
          </>
        )}


        {/* Create/Edit Plan Modal */}
        <PlanModal
          visible={showPlanModal}
          onClose={() => {
            setShowPlanModal(false);
            setEditingPlan(null);
          }}
          onSuccess={() => {
            refetchPlans();
          }}
          editingPlan={editingPlan}
        />
      </SafeAreaView>
    </Modal>
  );
}
