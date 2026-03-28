import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Sparkles,
  Send,
  Brain,
  TrendingUp,
  Users,
  Zap,
  Gift,
  ChevronRight,
  AlertTriangle,
  Star,
  Calendar,
  Tag,
  Layers,
  CreditCard,
  Heart,
  Award,
  BarChart2,
  UserCheck,
  UserPlus,
  DollarSign,
  Clock,
  BookOpen,
} from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AIAdvisorContext {
  // Analytics
  revenue?: number;
  totalAppointments?: number;
  totalClients?: number;
  newClients?: number;
  promotionsRedeemed?: number;
  inactiveClientsCount?: number;
  atRiskDays?: number;
  bestClientCount?: number;
  topClientName?: string;
  topClientRevenue?: number;
  topClientVisits?: number;
  slowestDayName?: string;
  busiestDayNames?: string[];
  mostUsedServiceName?: string;
  bestPromoName?: string;
  recoveredClientsCount?: number;
  recoveredRevenue?: number;
  flashBookingsCount?: number;
  vipRedemptionsCount?: number;
  timeFilter?: string;
  currency?: string;
}

export interface AIBusinessContext {
  storeNames?: string[];
  serviceNames?: string[];
  activePromotionNames?: string[];
  promotionTypes?: string[];
  loyaltyEnabled?: boolean;
  membershipEnabled?: boolean;
  giftCardsEnabled?: boolean;
  campaignsEnabled?: boolean;
}

export interface CampaignAutopilotPrefill {
  name: string;
  emailSubject: string;
  emailBody: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  contextLabel: string;
}

interface AIAdvisorModalProps {
  visible: boolean;
  onClose: () => void;
  businessName?: string;
  analyticsContext?: AIAdvisorContext;
  businessContext?: AIBusinessContext;
  onCTAPress?: (label: string, route: string, campaignPrefill?: CampaignAutopilotPrefill) => void;
}

interface AdvisorResponse {
  insight: string;
  whyItMatters: string;
  suggestedAction: string;
  ctaSuggestions: string[];
  quickActions?: Array<{ label: string; route: string }>;
}

interface ConversationItem {
  id: string;
  type: 'question' | 'answer' | 'error';
  text: string;
  response?: AdvisorResponse;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Card
// ─────────────────────────────────────────────────────────────────────────────

function QuickActionButton({
  action,
  onCTAPress,
  analyticsContext,
  businessContext,
  businessName,
  language,
}: {
  action: { label: string; route: string };
  onCTAPress?: (label: string, route: string, prefill?: CampaignAutopilotPrefill) => void;
  analyticsContext?: AIAdvisorContext;
  businessContext?: AIBusinessContext;
  businessName?: string;
  language: Language;
}) {
  const { colors, isDark, primaryColor } = useTheme();
  const [preparing, setPreparing] = useState(false);

  const handlePress = async () => {
    if (!onCTAPress) return;

    if (action.route === 'campaign') {
      setPreparing(true);
      try {
        const backendUrl =
          process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
          process.env.EXPO_PUBLIC_BACKEND_URL ||
          'http://localhost:3000';
        const res = await fetch(`${backendUrl}/api/ai-content/prepare-campaign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionLabel: action.label,
            language: language || 'en',
            variationSeed: Math.floor(Math.random() * 10000),
            businessName: businessName || undefined,
            analyticsContext: analyticsContext || undefined,
            businessContext: businessContext
              ? {
                  storeNames: businessContext.storeNames,
                  serviceNames: businessContext.serviceNames,
                  activePromotionNames: businessContext.activePromotionNames,
                  loyaltyEnabled: businessContext.loyaltyEnabled,
                  membershipEnabled: businessContext.membershipEnabled,
                  giftCardsEnabled: businessContext.giftCardsEnabled,
                }
              : undefined,
          }),
        });
        const data = await res.json() as {
          success: boolean;
          result?: CampaignAutopilotPrefill;
        };
        if (data.success && data.result) {
          onCTAPress(action.label, action.route, data.result);
        } else {
          // Fall back to opening builder without prefill on error
          onCTAPress(action.label, action.route);
        }
      } catch {
        onCTAPress(action.label, action.route);
      } finally {
        setPreparing(false);
      }
    } else {
      onCTAPress(action.label, action.route);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={preparing}
      style={({ pressed }) => ({
        opacity: pressed || preparing ? 0.75 : 1,
        borderRadius: 12,
        overflow: 'hidden',
      })}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? `${primaryColor}18` : `${primaryColor}10`,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderWidth: 1,
        borderColor: `${primaryColor}25`,
      }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: primaryColor }}>
            {action.label}
          </Text>
        </View>
        <View style={{ width: 20, alignItems: 'center', justifyContent: 'center' }}>
          {preparing
            ? <ActivityIndicator size="small" color={primaryColor} />
            : <ChevronRight size={15} color={primaryColor} />
          }
        </View>
      </View>
    </Pressable>
  );
}

function ResponseCard({
  response,
  onCTAPress,
  index,
  language,
  analyticsContext,
  businessContext,
  businessName,
}: {
  response: AdvisorResponse;
  onCTAPress?: (label: string, route: string, prefill?: CampaignAutopilotPrefill) => void;
  index: number;
  language: Language;
  analyticsContext?: AIAdvisorContext;
  businessContext?: AIBusinessContext;
  businessName?: string;
}) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <Animated.View

      style={{
        backgroundColor: isDark ? colors.card : '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? `${primaryColor}25` : `${primaryColor}15`,
        shadowColor: primaryColor,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        marginBottom: 12,
      }}
    >
      {/* Avatar + insight prose */}
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{
            width: 30, height: 30, borderRadius: 10,
            backgroundColor: `${primaryColor}18`,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10,
            flexShrink: 0,
            marginTop: 1,
          }}>
            <Brain size={15} color={primaryColor} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text, lineHeight: 23, flex: 1 }}>
            {response.insight}
          </Text>
        </View>

        {/* Suggested action */}
        {!!response.suggestedAction && (
          <View style={{
            backgroundColor: isDark ? `${primaryColor}12` : `${primaryColor}08`,
            borderRadius: 12,
            padding: 12,
            borderLeftWidth: 3,
            borderLeftColor: primaryColor,
          }}>
            <Text style={{ fontSize: 13, color: isDark ? colors.text : '#334155', lineHeight: 20 }}>
              {response.suggestedAction}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      {(response.quickActions?.length ?? 0) > 0 && (
        <View style={{
          paddingHorizontal: 16,
          paddingBottom: 14,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: isDark ? `${primaryColor}15` : `${primaryColor}10`,
          paddingTop: 12,
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: colors.textSecondary,
            letterSpacing: 0.7,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {t('aiAdvisorQuickActions', language)}
          </Text>
          {response.quickActions!.map((action, i) => (
            <QuickActionButton
              key={i}
              action={action}
              onCTAPress={onCTAPress}
              analyticsContext={analyticsContext}
              businessContext={businessContext}
              businessName={businessName}
              language={language}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics-driven question selector
// ─────────────────────────────────────────────────────────────────────────────

type QuestionEntry = {
  icon: React.ComponentType<{ size: number; color: string }>;
  labelKey: keyof import('@/lib/i18n/types').TranslationStrings;
  /** Higher = more relevant. Return 0 to suppress this question entirely. */
  score: (a: AIAdvisorContext, b: AIBusinessContext) => number;
};

const QUESTION_DEFINITIONS: QuestionEntry[] = [
  // ── Clients ──────────────────────────────────────────────────────────────
  {
    icon: AlertTriangle,
    labelKey: 'aiAdvisorClientsAtRisk',
    score: (a) => (a.inactiveClientsCount ?? 0) > 0 ? 10 + Math.min((a.inactiveClientsCount ?? 0) / 5, 20) : 0,
  },
  {
    icon: Heart,
    labelKey: 'aiAdvisorClientRetention',
    score: (a) => (a.inactiveClientsCount ?? 0) > 0 ? 9 : 4,
  },
  {
    icon: Users,
    labelKey: 'aiAdvisorWhyClientsLeaving',
    score: (a) => (a.inactiveClientsCount ?? 0) > 3 ? 8 : 3,
  },
  {
    icon: UserPlus,
    labelKey: 'aiAdvisorNewClients',
    score: (a) => (a.newClients ?? 0) > 0 ? 6 + Math.min((a.newClients ?? 0) / 3, 10) : 5,
  },
  {
    icon: Star,
    labelKey: 'aiAdvisorTopClients',
    score: (a) => (a.bestClientCount ?? 0) > 0 ? 7 : 3,
  },
  // ── Revenue ───────────────────────────────────────────────────────────────
  {
    icon: TrendingUp,
    labelKey: 'aiAdvisorGrowRevenue',
    score: (a) => (a.revenue ?? 0) > 0 ? 8 : 6,
  },
  {
    icon: BarChart2,
    labelKey: 'aiAdvisorRevenueHurting',
    score: (a) => (a.revenue ?? 0) > 0 ? 5 : 4,
  },
  {
    icon: DollarSign,
    labelKey: 'aiAdvisorRevenueGrowth',
    score: (a) => (a.revenue ?? 0) > 0 ? 7 : 5,
  },
  {
    icon: TrendingUp,
    labelKey: 'aiAdvisorRevenuePerVisit',
    score: (a) => (a.totalAppointments ?? 0) > 0 ? 6 : 3,
  },
  {
    icon: TrendingUp,
    labelKey: 'aiAdvisorPeakRevenue',
    score: (a) => (a.busiestDayNames?.length ?? 0) > 0 ? 7 : 4,
  },
  // ── Appointments ─────────────────────────────────────────────────────────
  {
    icon: Zap,
    labelKey: 'aiAdvisorFillSlowDays',
    score: (a) => a.slowestDayName ? 9 : 5,
  },
  {
    icon: Calendar,
    labelKey: 'aiAdvisorFillEmptySlots',
    score: (a) => (a.totalAppointments ?? 0) > 0 ? 6 : 4,
  },
  {
    icon: Clock,
    labelKey: 'aiAdvisorUnderperformingDays',
    score: (a) => a.slowestDayName ? 8 : 4,
  },
  {
    icon: Calendar,
    labelKey: 'aiAdvisorBusiestDays',
    score: (a) => (a.busiestDayNames?.length ?? 0) > 0 ? 7 : 3,
  },
  {
    icon: BookOpen,
    labelKey: 'aiAdvisorBookingTips',
    score: (a) => (a.totalAppointments ?? 0) > 0 ? 5 : 6,
  },
  // ── Promotions ────────────────────────────────────────────────────────────
  {
    icon: Tag,
    labelKey: 'aiAdvisorBestPromoStrategy',
    score: (a, b) => b.activePromotionNames?.length ? 9 : 4,
  },
  {
    icon: BarChart2,
    labelKey: 'aiAdvisorPromoResults',
    score: (a) => (a.promotionsRedeemed ?? 0) > 0 ? 10 : 0,
  },
  {
    icon: Gift,
    labelKey: 'aiAdvisorNextPromotion',
    score: (a, b) => b.activePromotionNames?.length ? 7 : 5,
  },
  {
    icon: Gift,
    labelKey: 'aiAdvisorBestPromotion',
    score: (a) => (a.bestPromoName ? 8 : 4),
  },
  {
    icon: Zap,
    labelKey: 'aiAdvisorFlashOffer',
    score: (a) => a.slowestDayName ? 7 : 4,
  },
  // ── Services ──────────────────────────────────────────────────────────────
  {
    icon: Layers,
    labelKey: 'aiAdvisorTopService',
    score: (a, b) => a.mostUsedServiceName || (b.serviceNames?.length ?? 0) > 0 ? 9 : 3,
  },
  {
    icon: Star,
    labelKey: 'aiAdvisorPromoteTopService',
    score: (a, b) => a.mostUsedServiceName || (b.serviceNames?.length ?? 0) > 0 ? 8 : 3,
  },
  {
    icon: DollarSign,
    labelKey: 'aiAdvisorServiceRevenue',
    score: (a, b) => (b.serviceNames?.length ?? 0) > 1 ? 7 : 4,
  },
  {
    icon: Layers,
    labelKey: 'aiAdvisorServiceMix',
    score: (a, b) => (b.serviceNames?.length ?? 0) > 2 ? 6 : 3,
  },
  // ── Loyalty ───────────────────────────────────────────────────────────────
  {
    icon: Award,
    labelKey: 'aiAdvisorLoyaltyGrowth',
    score: (a, b) => b.loyaltyEnabled ? 8 : 0,
  },
  {
    icon: Heart,
    labelKey: 'aiAdvisorLoyaltyRedemption',
    score: (a, b) => b.loyaltyEnabled ? 7 : 0,
  },
  // ── Membership ────────────────────────────────────────────────────────────
  {
    icon: UserCheck,
    labelKey: 'aiAdvisorMembershipGrowth',
    score: (a, b) => b.membershipEnabled ? 8 : 0,
  },
  {
    icon: Award,
    labelKey: 'aiAdvisorMemberBenefits',
    score: (a, b) => b.membershipEnabled ? 7 : 0,
  },
  // ── Gift Cards ────────────────────────────────────────────────────────────
  {
    icon: CreditCard,
    labelKey: 'aiAdvisorGiftCardRevenue',
    score: (a, b) => b.giftCardsEnabled ? 8 : 0,
  },
  {
    icon: CreditCard,
    labelKey: 'aiAdvisorGiftCardStrategy',
    score: (a, b) => b.giftCardsEnabled ? 7 : 0,
  },
  // ── Retention ─────────────────────────────────────────────────────────────
  {
    icon: Star,
    labelKey: 'aiAdvisorRetainBestClients',
    score: (a) => (a.bestClientCount ?? 0) > 0 ? 7 : 4,
  },
  {
    icon: UserCheck,
    labelKey: 'aiAdvisorRepeatVisits',
    score: (a) => (a.totalClients ?? 0) > 0 ? 6 : 4,
  },
];

/** Seeded pseudo-random (mulberry32) for stable-but-varied tie-breaking */
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

function pickSuggestedQuestions(
  analyticsContext: AIAdvisorContext | undefined,
  businessContext: AIBusinessContext | undefined,
  count = 5,
): QuestionEntry[] {
  const a: AIAdvisorContext = analyticsContext ?? {};
  const b: AIBusinessContext = businessContext ?? {};

  // Score every question
  const scored = QUESTION_DEFINITIONS.map((q) => ({ q, s: q.score(a, b) }));

  // Filter out suppressed (score === 0) and sort descending
  const eligible = scored.filter((x) => x.s > 0).sort((x, y) => y.s - x.s);

  // Take the top band: all entries whose score >= the Nth highest score
  // Then shuffle within that band using a daily seed so rotation happens naturally
  const dailySeed = Math.floor(Date.now() / 86_400_000); // changes once per day
  const rand = seededRandom(dailySeed);

  // Stable shuffle of the entire eligible list weighted by score
  const shuffled = eligible
    .map((x) => ({ q: x.q, sortKey: x.s * 1000 + rand() }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((x) => x.q);

  // Pick top N; if not enough eligible, fill from full pool at random
  const result = shuffled.slice(0, count);
  if (result.length < count) {
    const rand2 = seededRandom(dailySeed + 1);
    const remaining = QUESTION_DEFINITIONS
      .filter((q) => !result.includes(q))
      .sort(() => rand2() - 0.5);
    result.push(...remaining.slice(0, count - result.length));
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export function AIAdvisorModal({
  visible,
  onClose,
  businessName,
  analyticsContext,
  businessContext,
  onCTAPress,
}: AIAdvisorModalProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const inputWrapperRef = useRef<View>(null);

  // Analytics-driven suggested questions — recalculated when context changes
  const suggestedQuestions = useMemo(
    () => pickSuggestedQuestions(analyticsContext, businessContext),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      analyticsContext?.revenue,
      analyticsContext?.inactiveClientsCount,
      analyticsContext?.newClients,
      analyticsContext?.promotionsRedeemed,
      analyticsContext?.bestPromoName,
      analyticsContext?.mostUsedServiceName,
      analyticsContext?.slowestDayName,
      analyticsContext?.busiestDayNames?.join(','),
      analyticsContext?.bestClientCount,
      analyticsContext?.totalAppointments,
      analyticsContext?.totalClients,
      businessContext?.loyaltyEnabled,
      businessContext?.membershipEnabled,
      businessContext?.giftCardsEnabled,
      businessContext?.serviceNames?.length,
      businessContext?.activePromotionNames?.length,
    ],
  );

  // Reset conversation when modal closes
  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setConversation([]);
        setInput('');
        setIsLoading(false);
      }, 300);
    }
  }, [visible]);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (conversation.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation]);

  const askAdvisor = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const questionItem: ConversationItem = {
      id: Date.now().toString(),
      type: 'question',
      text: question.trim(),
      timestamp: new Date(),
    };

    setConversation((prev) => [...prev, questionItem]);
    setInput('');
    setIsLoading(true);

    try {
      const backendUrl =
        process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        'http://localhost:3000';
      const res = await fetch(`${backendUrl}/api/ai-content/advise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          language: language || 'en',
          variationSeed: Math.floor(Math.random() * 10000),
          businessName: businessName || undefined,
          analyticsContext: analyticsContext || undefined,
          businessContext: businessContext || undefined,
        }),
      });

      const data = await res.json() as { success: boolean; result?: AdvisorResponse; error?: string };

      if (data.success && data.result) {
        const answerItem: ConversationItem = {
          id: (Date.now() + 1).toString(),
          type: 'answer',
          text: data.result.insight,
          response: data.result,
          timestamp: new Date(),
        };
        setConversation((prev) => [...prev, answerItem]);
      } else {
        const errorItem: ConversationItem = {
          id: (Date.now() + 1).toString(),
          type: 'error',
          text: data.error || t('aiAdvisorErrorRetry', language),
          timestamp: new Date(),
        };
        setConversation((prev) => [...prev, errorItem]);
      }
    } catch {
      const errorItem: ConversationItem = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        text: t('aiAdvisorErrorConnection', language),
        timestamp: new Date(),
      };
      setConversation((prev) => [...prev, errorItem]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    askAdvisor(input);
  };

  const isEmpty = conversation.length === 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center', justifyContent: 'center',
              marginRight: 12,
            }}>
              <Sparkles size={20} color={primaryColor} />
            </View>
            <View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('aiBusinessAdvisor', language)}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{t('aiAdvisorPoweredBy', language)}</Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

          {/* Single always-mounted ScrollView — prevents TextInput from unmounting on state changes */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'ios' ? 28 : 20 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={true}
            showsVerticalScrollIndicator={false}
          >
            {/* ── EMPTY STATE: hero + suggested questions ── */}
            {isEmpty && (
              <Animated.View>
                {/* Hero */}
                <View style={{ alignItems: 'center', paddingVertical: 24, paddingBottom: 28 }}>
                  <View style={{
                    width: 72, height: 72, borderRadius: 22,
                    backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
                    alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                    shadowColor: primaryColor,
                    shadowOpacity: 0.2,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                  }}>
                    <Sparkles size={34} color={primaryColor} />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                    {t('aiAdvisorAskAnything', language)}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}>
                    {t('aiAdvisorDescription', language)}
                  </Text>
                </View>

                {/* Suggested questions */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
                  {t('aiAdvisorSuggestedQuestions', language)}
                </Text>
                <View style={{ gap: 10 }}>
                  {suggestedQuestions.map((sq, i) => (
                    <Animated.View key={sq.labelKey}>
                      <Pressable
                        onPress={() => askAdvisor(t(sq.labelKey, language))}
                        className="flex-row items-center justify-between"
                        style={({ pressed }) => ({
                          backgroundColor: isDark ? colors.card : '#FFFFFF',
                          borderRadius: 16,
                          padding: 14,
                          borderWidth: 1,
                          borderColor: isDark ? colors.border : '#E8EDF5',
                          opacity: pressed ? 0.75 : 1,
                          shadowColor: '#000',
                          shadowOpacity: isDark ? 0 : 0.04,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 1,
                        })}
                      >
                        <View className="flex-row items-center" style={{ flex: 1, marginRight: 8 }}>
                          <View style={{
                            width: 36, height: 36, borderRadius: 10,
                            backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                            alignItems: 'center', justifyContent: 'center',
                            marginRight: 12,
                            flexShrink: 0,
                          }}>
                            <sq.icon size={18} color={primaryColor} />
                          </View>
                          <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.text }}>{t(sq.labelKey, language)}</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textSecondary} />
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* ── CONVERSATION STATE: messages ── */}
            {!isEmpty && (
              <>
                {conversation.map((item, i) => {
                  if (item.type === 'question') {
                    return (
                      <Animated.View
                        key={item.id}

                        style={{ alignItems: 'flex-end', marginBottom: 16, marginTop: i === 0 ? 0 : 4 }}
                      >
                        <View style={{
                          maxWidth: '82%',
                          backgroundColor: primaryColor,
                          borderRadius: 18,
                          borderBottomRightRadius: 4,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        }}>
                          <Text style={{ fontSize: 14, color: '#FFFFFF', lineHeight: 20, fontWeight: '500' }}>
                            {item.text}
                          </Text>
                        </View>
                      </Animated.View>
                    );
                  }

                  if (item.type === 'error') {
                    return (
                      <Animated.View
                        key={item.id}

                        style={{
                          alignItems: 'flex-start',
                          marginBottom: 16,
                          backgroundColor: isDark ? '#7F1D1D' : '#FEF2F2',
                          borderRadius: 16,
                          padding: 14,
                          borderWidth: 1,
                          borderColor: isDark ? '#991B1B' : '#FECACA',
                        }}
                      >
                        <Text style={{ fontSize: 13, color: isDark ? '#FCA5A5' : '#DC2626', lineHeight: 19 }}>
                          {item.text}
                        </Text>
                      </Animated.View>
                    );
                  }

                  if (item.response) {
                    return (
                      <View key={item.id} style={{ marginBottom: 4 }}>
                        <ResponseCard
                          response={item.response}
                          onCTAPress={onCTAPress}
                          index={i}
                          language={language}
                          analyticsContext={analyticsContext}
                          businessContext={businessContext}
                          businessName={businessName}
                        />
                      </View>
                    );
                  }

                  return null;
                })}

                {/* Loading state */}
                {isLoading && (
                  <Animated.View

                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDark ? colors.card : '#FFFFFF',
                      borderRadius: 18,
                      borderTopLeftRadius: 4,
                      padding: 16,
                      alignSelf: 'flex-start',
                      maxWidth: '70%',
                      borderWidth: 1,
                      borderColor: isDark ? colors.border : '#E8EDF5',
                      marginBottom: 16,
                      gap: 10,
                    }}
                  >
                    <ActivityIndicator size="small" color={primaryColor} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' }}>
                      {t('aiAdvisorAnalyzing', language)}
                    </Text>
                  </Animated.View>
                )}
              </>
            )}

            {/* Input bar — always rendered, never remounted */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: isEmpty ? 20 : 16,
              gap: 10,
            }}>
              <View
                ref={inputWrapperRef}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
                  borderRadius: 22,
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#CBD5E1',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  minHeight: 48,
                  justifyContent: 'center',
                }}>
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={setInput}
                  placeholder={t('aiAdvisorPlaceholder', language)}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'}
                  style={{
                    fontSize: 15,
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    maxHeight: 100,
                    lineHeight: 20,
                    paddingVertical: 0,
                  }}
                  cursorColor={primaryColor}
                  selectionColor={primaryColor + '40'}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                  editable={!isLoading}
                  onFocus={() => {
                    inputWrapperRef.current?.setNativeProps({ style: { borderColor: primaryColor } });
                  }}
                  onBlur={() => {
                    inputWrapperRef.current?.setNativeProps({ style: { borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#CBD5E1' } });
                  }}
                />
              </View>
              <TouchableOpacity
                onPress={handleSend}
                activeOpacity={0.7}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: primaryColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Send size={20} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
