import React, { useState, useMemo, useCallback } from 'react';
import { View } from 'react-native';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { AuthScreen } from '@/components/AuthScreen';
import { DashboardScreen } from '@/components/DashboardScreen';
import { ClientsSection } from '@/components/ClientsSection';
import { ClientDetailScreen } from '@/components/ClientDetailScreen';
import { ClientEditScreen } from '@/components/ClientEditScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SettingsScreen } from '@/components/SettingsScreen';
import { MonthlyStatsScreen } from '@/components/MonthlyStatsScreen';
import { DripCampaignScreen } from '@/components/DripCampaignScreen';
import { MarketingPromoScreen } from '@/components/MarketingPromoScreen';
import { AIAdvisorModal, type AIAdvisorContext, type AIBusinessContext, type CampaignAutopilotPrefill } from '@/components/AIAdvisorModal';
import { SubscriptionPaywall } from '@/components/SubscriptionPaywall';
import { FreeTrialPaywall } from '@/components/FreeTrialPaywall';
import { TrialCountdownBanner } from '@/components/TrialCountdownBanner';
import { useTrialEligibility } from '@/hooks/useTrialEligibility';
import { useServices } from '@/hooks/useServices';
import { useStores } from '@/hooks/useStores';
import { useLoyaltySettings } from '@/hooks/useLoyalty';
import { useMembershipSettings } from '@/hooks/useMembership';
import { useGiftCards } from '@/hooks/useGiftCards';
import { useStore as useStoreData } from '@/lib/store';
import { LayoutDashboard, Users, Settings, BarChart3 } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/ThemeContext';
import { useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import { clientKeys } from '@/hooks/useClients';
import { membershipKeys } from '@/hooks/useMembership';
import { promotionCounterKeys } from '@/hooks/usePromotionCounters';
import { getClient } from '@/services/clientsService';
import { getClientMembership } from '@/services/membershipService';
import { getPromotionCountersForClient } from '@/services/promotionCountersService';

type Screen =
  | { name: 'dashboard' }
  | { name: 'clients' }
  | { name: 'analytics' }
  | { name: 'clientDetail'; id: string }
  | { name: 'clientEdit'; id?: string }
  | { name: 'settings' };

type Tab = 'dashboard' | 'clients' | 'analytics' | 'settings';

type SmartDripPrefill = {
  name?: string;
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  emailSubject?: string;
  emailBody?: string;
  contextLabel?: string;
};

type MarketingPrefill = {
  discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
  name?: string;
  contextLabel?: string;
};

export default function TabOneScreen() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const user = useStore((s) => s.user);
  const language = useStore((s) => s.language) as Language;
  const hasSeenTrialOnboarding = useStore((s) => s.hasSeenTrialOnboarding);
  const isInPasswordRecovery = useStore((s) => s.isInPasswordRecovery);
  const [currentScreen, setCurrentScreen] = useState<Screen>({ name: 'dashboard' });
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [showFeaturePaywall, setShowFeaturePaywall] = useState(false);
  const [featureBlockedAction, setFeatureBlockedAction] = useState<'createClient' | 'addVisit' | 'exportData' | 'createCampaign' | 'sendEmail' | undefined>();
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | undefined>(undefined);
  const [showSmartDripFromAnalytics, setShowSmartDripFromAnalytics] = useState(false);
  const [smartDripPrefill, setSmartDripPrefill] = useState<SmartDripPrefill | undefined>(undefined);
  const [showMarketingFromAnalytics, setShowMarketingFromAnalytics] = useState(false);
  const [marketingPrefill, setMarketingPrefill] = useState<MarketingPrefill | undefined>(undefined);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false);
  const [aiAdvisorAnalyticsContext, setAiAdvisorAnalyticsContext] = useState<AIAdvisorContext | undefined>(undefined);
  const { isDark, colors, primaryColor } = useTheme();
  const queryClient = useQueryClient();
  const { businessId } = useBusiness();

  // Prefetch all client detail data before navigation so the screen opens instantly
  const prefetchClientDetail = useCallback((clientId: string) => {
    const STALE = 60_000;
    queryClient.prefetchQuery({
      queryKey: clientKeys.detail(clientId),
      queryFn: async () => {
        const result = await getClient(clientId);
        return result.data ?? null;
      },
      staleTime: STALE,
    });
    queryClient.prefetchQuery({
      queryKey: membershipKeys.client(clientId),
      queryFn: () => getClientMembership(clientId),
      staleTime: STALE,
    });
    if (businessId) {
      queryClient.prefetchQuery({
        queryKey: promotionCounterKeys.forClient(businessId, clientId),
        queryFn: async () => {
          const result = await getPromotionCountersForClient(businessId, clientId);
          return result.data ?? [];
        },
        staleTime: STALE,
      });
    }
  }, [queryClient, businessId]);

  // Business context for AI advisor
  const { data: supabaseServices = [] } = useServices();
  const { data: supabaseStores = [] } = useStores();
  const { data: loyaltySettings } = useLoyaltySettings();
  const { data: membershipSettings } = useMembershipSettings();
  const { data: giftCards = [] } = useGiftCards();
  const marketingPromotions = useStoreData((s) => s.marketingPromotions);
  const dripCampaigns = useStoreData((s) => s.dripCampaigns);

  const aiBusinessContext = useMemo((): AIBusinessContext => ({
    storeNames: supabaseStores.map((s) => s.name).filter(Boolean),
    serviceNames: supabaseServices.map((s) => s.name).filter(Boolean),
    activePromotionNames: marketingPromotions.filter((p) => p.isActive).map((p) => p.name),
    promotionTypes: [...new Set(marketingPromotions.map((p) => p.discountType))],
    loyaltyEnabled: loyaltySettings?.is_enabled ?? false,
    membershipEnabled: membershipSettings?.isEnabled ?? false,
    giftCardsEnabled: giftCards.length > 0,
    campaignsEnabled: dripCampaigns.length > 0,
  }), [supabaseStores, supabaseServices, marketingPromotions, dripCampaigns, loyaltySettings, membershipSettings, giftCards]);

  // Centralized trial entitlement — trial_end_at is the source of truth
  const { trialStatus } = useTrialEligibility();

  // Determine if we should show the main paywall (trial expired, no subscription)
  const shouldShowMainPaywall = isAuthenticated && !trialStatus.canAccessApp;

  const handleAuthSuccess = () => {
    setCurrentScreen({ name: 'dashboard' });
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentScreen({ name: 'dashboard' });
    setActiveTab('dashboard');
  };

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const navigateToTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      setCurrentScreen({ name: 'dashboard' });
    } else if (tab === 'clients') {
      setCurrentScreen({ name: 'clients' });
    } else if (tab === 'analytics') {
      setCurrentScreen({ name: 'analytics' });
    } else {
      setCurrentScreen({ name: 'settings' });
    }
  };

  // Feature-triggered paywall handler
  const handleFeatureBlocked = (action: 'createClient' | 'addVisit' | 'exportData' | 'createCampaign' | 'sendEmail') => {
    setFeatureBlockedAction(action);
    setShowFeaturePaywall(true);
  };

  const handleUpgradePress = () => {
    setFeatureBlockedAction(undefined);
    setShowFeaturePaywall(true);
  };

  const handlePaywallClose = () => {
    setShowFeaturePaywall(false);
    setFeatureBlockedAction(undefined);
  };

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return (
      <ErrorBoundary flowName="Auth">
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      </ErrorBoundary>
    );
  }

  // Render current screen
  const renderScreen = () => {
    switch (currentScreen.name) {
      case 'dashboard':
        return (
          <DashboardScreen
            onNavigateToClients={() => navigateToTab('clients')}
            onNavigateToClient={(id) => { prefetchClientDetail(id); navigateTo({ name: 'clientDetail', id }); }}
            onAddClient={() => {}}
            canAccessApp={trialStatus.canAccessApp}
            onFeatureBlocked={() => handleFeatureBlocked('createClient')}
          />
        );
      case 'clients':
        return (
          <ClientsSection
            onAddClient={() => {
              if (!trialStatus.canAccessApp) {
                handleFeatureBlocked('createClient');
              } else {
                navigateTo({ name: 'clientEdit' });
              }
            }}
            onSelectClient={(id: string) => { prefetchClientDetail(id); navigateTo({ name: 'clientDetail', id }); }}
          />
        );
      case 'clientDetail':
        return (
          <ClientDetailScreen
            key={currentScreen.id}
            clientId={currentScreen.id}
            onBack={() => navigateTo({ name: 'clients' })}
            onEdit={() => {
              if (!trialStatus.canAccessApp) {
                handleFeatureBlocked('createClient');
              } else {
                navigateTo({ name: 'clientEdit', id: currentScreen.id });
              }
            }}
          />
        );
      case 'clientEdit':
        return (
          <ClientEditScreen
            clientId={currentScreen.id}
            visible={true}
            onBack={() => {
              if (currentScreen.id) {
                navigateTo({ name: 'clientDetail', id: currentScreen.id });
              } else {
                navigateTo({ name: 'dashboard' });
              }
            }}
            onSave={() => {
              if (currentScreen.id) {
                navigateTo({ name: 'clientDetail', id: currentScreen.id });
              } else {
                navigateTo({ name: 'clients' });
              }
            }}
          />
        );
      case 'settings':
        return <SettingsScreen onLogout={handleLogout} />;
      case 'analytics':
        return (
          <MonthlyStatsScreen
            visible={true}
            onClose={() => navigateToTab('dashboard')}
            onNavigateToClient={(id) => { prefetchClientDetail(id); navigateTo({ name: 'clientDetail', id }); }}
            onOpenSmartDrip={(prefill?: SmartDripPrefill) => {
              setSmartDripPrefill(prefill);
              setShowSmartDripFromAnalytics(true);
            }}
            onOpenMarketing={(prefill?: MarketingPrefill) => {
              setMarketingPrefill(prefill);
              setShowMarketingFromAnalytics(true);
            }}
            onOpenAIAdvisor={(context) => {
              setAiAdvisorAnalyticsContext(context);
              setShowAIAdvisor(true);
            }}
            asTab
          />
        );
      default:
        return (
          <DashboardScreen
            onNavigateToClients={() => navigateToTab('clients')}
            onNavigateToClient={(id) => { prefetchClientDetail(id); navigateTo({ name: 'clientDetail', id }); }}
            onAddClient={() => {}}
            canAccessApp={trialStatus.canAccessApp}
            onFeatureBlocked={() => handleFeatureBlocked('createClient')}
          />
        );
    }
  };

  // Check if we should show the tab bar
  const showTabBar = ['dashboard', 'clients', 'analytics', 'settings'].includes(currentScreen.name);

  return (
    <ErrorBoundary flowName="Dashboard">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Trial Countdown Banner */}
      {trialStatus.showCountdownBanner && showTabBar && (
        <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
          <TrialCountdownBanner
            trialStatus={trialStatus}
            onUpgradePress={handleUpgradePress}
          />
        </SafeAreaView>
      )}

      {renderScreen()}

      {/* Custom Tab Bar */}
      {showTabBar && (
        <SafeAreaView
          edges={['bottom']}
          style={{ backgroundColor: colors.tabBarBackground, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <View className="flex-row">
            <TabButton
              icon={<LayoutDashboard size={22} color={activeTab === 'dashboard' ? primaryColor : colors.textTertiary} />}
              label={t('dashboard', language)}
              isActive={activeTab === 'dashboard'}
              onPress={() => navigateToTab('dashboard')}
              isDark={isDark}
              activeColor={primaryColor}
            />
            <TabButton
              icon={<Users size={22} color={activeTab === 'clients' ? primaryColor : colors.textTertiary} />}
              label={t('clients', language)}
              isActive={activeTab === 'clients'}
              onPress={() => navigateToTab('clients')}
              isDark={isDark}
              activeColor={primaryColor}
            />
            <TabButton
              icon={<BarChart3 size={22} color={activeTab === 'analytics' ? primaryColor : colors.textTertiary} />}
              label={t('analytics', language)}
              isActive={activeTab === 'analytics'}
              onPress={() => navigateToTab('analytics')}
              isDark={isDark}
              activeColor={primaryColor}
            />
            <TabButton
              icon={<Settings size={22} color={activeTab === 'settings' ? primaryColor : colors.textTertiary} />}
              label={t('settings', language)}
              isActive={activeTab === 'settings'}
              onPress={() => navigateToTab('settings')}
              isDark={isDark}
              activeColor={primaryColor}
            />
          </View>
        </SafeAreaView>
      )}

      {/* Free Trial Onboarding - shown once to new users after sign-up */}
      <FreeTrialPaywall
        visible={isAuthenticated && !hasSeenTrialOnboarding && !isInPasswordRecovery}
      />

      {/* Main Paywall - shown when trial expired and no subscription */}
      <SubscriptionPaywall
        visible={shouldShowMainPaywall && hasSeenTrialOnboarding && !isInPasswordRecovery}
        allowDismiss={false}
      />

      {/* Feature-triggered Paywall */}
      <SubscriptionPaywall
        visible={showFeaturePaywall}
        onClose={handlePaywallClose}
        featureBlockedAction={featureBlockedAction}
        allowDismiss={true}
      />

      {/* Smart Drip Campaign Modal - triggered from Analytics */}
      <DripCampaignScreen
        visible={showSmartDripFromAnalytics}
        onClose={() => {
          setShowSmartDripFromAnalytics(false);
          setSmartDripPrefill(undefined);
        }}
        prefill={smartDripPrefill}
      />

      {/* Marketing Promo Modal - triggered from Analytics Growth Opportunities */}
      <MarketingPromoScreen
        visible={showMarketingFromAnalytics}
        onClose={() => {
          setShowMarketingFromAnalytics(false);
          setMarketingPrefill(undefined);
        }}
        prefill={marketingPrefill}
      />

      {/* AI Business Advisor Modal */}
      <AIAdvisorModal
        visible={showAIAdvisor}
        onClose={() => setShowAIAdvisor(false)}
        businessName={user?.businessName || undefined}
        analyticsContext={aiAdvisorAnalyticsContext}
        businessContext={aiBusinessContext}
        onCTAPress={(label, route, campaignPrefill?: CampaignAutopilotPrefill) => {
          setShowAIAdvisor(false);
          if (route === 'campaign') {
            setSmartDripPrefill(
              campaignPrefill
                ? {
                    name: campaignPrefill.name,
                    frequency: campaignPrefill.frequency,
                    emailSubject: campaignPrefill.emailSubject,
                    emailBody: campaignPrefill.emailBody,
                    contextLabel: campaignPrefill.contextLabel,
                  }
                : { contextLabel: label },
            );
            setShowSmartDripFromAnalytics(true);
          } else {
            // 'promo', 'giftcard', 'loyalty', 'membership' all open the promo/marketing builder
            setMarketingPrefill({ contextLabel: label });
            setShowMarketingFromAnalytics(true);
          }
        }}
      />
      </View>
    </ErrorBoundary>
  );
}

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
  activeColor: string;
}

function TabButton({ icon, label, isActive, onPress, isDark, activeColor }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center"
      style={{ paddingTop: 22, paddingBottom: 8 }}
    >
      {icon}
      <Text
        style={{
          fontSize: 11,
          marginTop: 4,
          fontWeight: '500',
          color: isActive ? activeColor : (isDark ? '#9CA3AF' : '#64748B'),
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}
