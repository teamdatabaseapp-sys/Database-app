import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Mail,
  Rocket,
  Shield,
  Smartphone,
  Database,
  Wrench,
  Palette,
  HelpCircle,
  CalendarCheck,
  Users,
  Briefcase,
  Settings2,
  UserCog,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useTheme } from '@/lib/ThemeContext';
import { COMPANY_INFO } from '@/lib/legal-content';

interface HelpCenterScreenProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
  embedded?: boolean;
}

interface FAQItem {
  id: string;
  titleKey: string;
  contentKey: string;
  keywords: string[];
}

interface FAQCategory {
  id: string;
  nameKey: string;
  icon: React.ReactNode;
  items: FAQItem[];
}

// Animated expandable FAQ item
const ExpandableFAQItem = ({
  item,
  language,
  colors,
  isExpanded,
  onToggle,
}: {
  item: FAQItem;
  language: Language;
  colors: any;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withSpring(isExpanded ? 180 : 0, {
      damping: 15,
      stiffness: 120,
    });
  }, [isExpanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isExpanded ? colors.primary : colors.border,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 15,
              fontWeight: '600',
              lineHeight: 20,
            }}
          >
            {t(item.titleKey as any, language)}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={20} color={colors.textSecondary} />
        </Animated.View>
      </View>

      {isExpanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              lineHeight: 22,
              paddingTop: 12,
            }}
          >
            {t(item.contentKey as any, language)}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
};

export const HelpCenterScreen = ({
  visible,
  onClose,
  language,
  embedded = false,
}: HelpCenterScreenProps) => {
  const { colors, primaryColor, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['getting-started'])
  );

  // Define FAQ categories with their items
  const faqCategories: FAQCategory[] = useMemo(
    () => [
      {
        id: 'getting-started',
        nameKey: 'gettingStarted',
        icon: <Rocket size={20} color={primaryColor} />,
        items: [
          {
            id: 'signup',
            titleKey: 'helpSignUpTitle',
            contentKey: 'helpSignUpContent',
            keywords: ['signup', 'register', 'create', 'account', 'new'],
          },
          {
            id: 'login',
            titleKey: 'helpLoginTitle',
            contentKey: 'helpLoginContent',
            keywords: ['login', 'signin', 'sign in', 'access', 'enter'],
          },
          {
            id: 'navigation',
            titleKey: 'helpNavigationTitle',
            contentKey: 'helpNavigationContent',
            keywords: ['navigate', 'tabs', 'menu', 'dashboard', 'sections'],
          },
        ],
      },
      {
        id: 'online-booking',
        nameKey: 'faqOnlineBooking',
        icon: <CalendarCheck size={20} color={primaryColor} />,
        items: [
          {
            id: 'online-booking-how',
            titleKey: 'helpOnlineBookingTitle',
            contentKey: 'helpOnlineBookingContent',
            keywords: ['online', 'booking', 'reservation', 'schedule', 'public', 'page'],
          },
          {
            id: 'booking-availability',
            titleKey: 'helpBookingAvailabilityTitle',
            contentKey: 'helpBookingAvailabilityContent',
            keywords: ['availability', 'slots', 'available', 'time', 'calculate'],
          },
          {
            id: 'double-booking',
            titleKey: 'helpDoubleBookingPreventionTitle',
            contentKey: 'helpDoubleBookingPreventionContent',
            keywords: ['double', 'booking', 'prevent', 'conflict', 'overlap'],
          },
          {
            id: 'qr-codes',
            titleKey: 'helpQrCodesTitle',
            contentKey: 'helpQrCodesContent',
            keywords: ['qr', 'code', 'scan', 'link', 'share'],
          },
          {
            id: 'public-links',
            titleKey: 'helpPublicBookingLinksTitle',
            contentKey: 'helpPublicBookingLinksContent',
            keywords: ['link', 'url', 'public', 'share', 'booking'],
          },
        ],
      },
      {
        id: 'staff-management',
        nameKey: 'faqStaffManagement',
        icon: <Users size={20} color={primaryColor} />,
        items: [
          {
            id: 'add-staff',
            titleKey: 'helpAddStaffTitle',
            contentKey: 'helpAddStaffContent',
            keywords: ['add', 'staff', 'employee', 'team', 'member'],
          },
          {
            id: 'assign-staff-stores',
            titleKey: 'helpAssignStaffToStoresTitle',
            contentKey: 'helpAssignStaffToStoresContent',
            keywords: ['assign', 'staff', 'store', 'location', 'branch'],
          },
          {
            id: 'assign-services-staff',
            titleKey: 'helpAssignServicesToStaffTitle',
            contentKey: 'helpAssignServicesToStaffContent',
            keywords: ['assign', 'service', 'staff', 'skill', 'qualified'],
          },
          {
            id: 'no-staff-service',
            titleKey: 'helpNoStaffForServiceTitle',
            contentKey: 'helpNoStaffForServiceContent',
            keywords: ['no', 'staff', 'service', 'available', 'match'],
          },
        ],
      },
      {
        id: 'services-products',
        nameKey: 'faqServicesProducts',
        icon: <Briefcase size={20} color={primaryColor} />,
        items: [
          {
            id: 'services-how',
            titleKey: 'helpServicesWorkTitle',
            contentKey: 'helpServicesWorkContent',
            keywords: ['service', 'duration', 'price', 'create', 'add'],
          },
          {
            id: 'products-how',
            titleKey: 'helpProductsWorkTitle',
            contentKey: 'helpProductsWorkContent',
            keywords: ['product', 'inventory', 'sell', 'item', 'add'],
          },
        ],
      },
      {
        id: 'business-configuration',
        nameKey: 'faqBusinessConfiguration',
        icon: <Settings2 size={20} color={primaryColor} />,
        items: [
          {
            id: 'business-hours',
            titleKey: 'helpBusinessHoursTitle',
            contentKey: 'helpBusinessHoursContent',
            keywords: ['business', 'hours', 'opening', 'closing', 'schedule'],
          },
          {
            id: 'special-hours',
            titleKey: 'helpSpecialHoursTitle',
            contentKey: 'helpSpecialHoursContent',
            keywords: ['special', 'hours', 'holiday', 'override', 'exception'],
          },
          {
            id: 'blackout-days',
            titleKey: 'helpBlackoutDaysTitle',
            contentKey: 'helpBlackoutDaysContent',
            keywords: ['blackout', 'closed', 'vacation', 'block', 'unavailable'],
          },
          {
            id: 'branding-logos',
            titleKey: 'helpBrandingLogosTitle',
            contentKey: 'helpBrandingLogosContent',
            keywords: ['logo', 'brand', 'image', 'upload', 'customize'],
          },
          {
            id: 'branding-colors',
            titleKey: 'helpBrandingColorsTitle',
            contentKey: 'helpBrandingColorsContent',
            keywords: ['color', 'brand', 'theme', 'customize', 'primary'],
          },
          {
            id: 'configuration-errors',
            titleKey: 'helpConfigurationErrorsTitle',
            contentKey: 'helpConfigurationErrorsContent',
            keywords: ['error', 'wrong', 'incorrect', 'configuration', 'problem'],
          },
        ],
      },
      {
        id: 'account-security',
        nameKey: 'accountSecurity',
        icon: <Shield size={20} color={primaryColor} />,
        items: [
          {
            id: 'faceid',
            titleKey: 'helpFaceIdTitle',
            contentKey: 'helpFaceIdContent',
            keywords: ['face id', 'faceid', 'biometric', 'touch id', 'fingerprint', 'security'],
          },
          {
            id: 'password',
            titleKey: 'helpChangePasswordTitle',
            contentKey: 'helpChangePasswordContent',
            keywords: ['password', 'change', 'reset', 'security', 'credentials'],
          },
          {
            id: 'logout',
            titleKey: 'helpLogoutTitle',
            contentKey: 'helpLogoutContent',
            keywords: ['logout', 'sign out', 'signout', 'exit'],
          },
        ],
      },
      {
        id: 'roles-permissions',
        nameKey: 'faqRolesPermissions',
        icon: <UserCog size={20} color={primaryColor} />,
        items: [
          {
            id: 'what-are-roles',
            titleKey: 'helpWhatAreRolesTitle',
            contentKey: 'helpWhatAreRolesContent',
            keywords: ['roles', 'owner', 'manager', 'staff', 'permissions', 'access'],
          },
          {
            id: 'owner-role',
            titleKey: 'helpOwnerRoleTitle',
            contentKey: 'helpOwnerRoleContent',
            keywords: ['owner', 'admin', 'billing', 'full access', 'control'],
          },
          {
            id: 'manager-staff-roles',
            titleKey: 'helpManagerStaffRolesTitle',
            contentKey: 'helpManagerStaffRolesContent',
            keywords: ['manager', 'staff', 'permissions', 'configurable', 'access'],
          },
          {
            id: 'permissions-control',
            titleKey: 'helpPermissionsControlTitle',
            contentKey: 'helpPermissionsControlContent',
            keywords: ['permissions', 'control', 'owner', 'configure', 'access'],
          },
          {
            id: 'preview-mode',
            titleKey: 'helpPreviewModeTitle',
            contentKey: 'helpPreviewModeContent',
            keywords: ['preview', 'mode', 'shadow', 'enforced', 'testing'],
          },
          {
            id: 'staff-invitation',
            titleKey: 'helpStaffInvitationTitle',
            contentKey: 'helpStaffInvitationContent',
            keywords: ['invite', 'invitation', 'email', 'team', 'access'],
          },
          {
            id: 'invited-no-subscription',
            titleKey: 'helpInvitedNoSubscriptionTitle',
            contentKey: 'helpInvitedNoSubscriptionContent',
            keywords: ['subscription', 'payment', 'invited', 'free', 'team'],
          },
          {
            id: 'access-management',
            titleKey: 'helpAccessManagementTitle',
            contentKey: 'helpAccessManagementContent',
            keywords: ['access', 'modify', 'revoke', 'remove', 'manage'],
          },
          {
            id: 'security-disclaimer',
            titleKey: 'helpSecurityDisclaimerTitle',
            contentKey: 'helpSecurityDisclaimerContent',
            keywords: ['security', 'safeguards', 'protection', 'disclaimer'],
          },
        ],
      },
      {
        id: 'app-features',
        nameKey: 'appFeatures',
        icon: <Smartphone size={20} color={primaryColor} />,
        items: [
          {
            id: 'appointments',
            titleKey: 'helpAppointmentsTitle',
            contentKey: 'helpAppointmentsContent',
            keywords: ['appointment', 'book', 'schedule', 'calendar', 'booking'],
          },
          {
            id: 'clients',
            titleKey: 'helpClientsTitle',
            contentKey: 'helpClientsContent',
            keywords: ['client', 'add', 'manage', 'customer', 'contact'],
          },
          {
            id: 'promotions',
            titleKey: 'helpPromotionsTitle',
            contentKey: 'helpPromotionsContent',
            keywords: ['promotion', 'discount', 'offer', 'marketing', 'loyalty'],
          },
          {
            id: 'analytics',
            titleKey: 'helpAnalyticsTitle',
            contentKey: 'helpAnalyticsContent',
            keywords: ['analytics', 'stats', 'statistics', 'insights', 'revenue'],
          },
          {
            id: 'export',
            titleKey: 'helpExportDataTitle',
            contentKey: 'helpExportDataContent',
            keywords: ['export', 'data', 'download', 'csv', 'backup'],
          },
          {
            id: 'drip',
            titleKey: 'helpDripCampaignsTitle',
            contentKey: 'helpDripCampaignsContent',
            keywords: ['drip', 'campaign', 'email', 'automation', 'sequence'],
          },
          {
            id: 'bulk-email',
            titleKey: 'helpBulkEmailTitle',
            contentKey: 'helpBulkEmailContent',
            keywords: ['bulk', 'email', 'send', 'mass', 'campaign'],
          },
        ],
      },
      {
        id: 'customization',
        nameKey: 'themeCustomization',
        icon: <Palette size={20} color={primaryColor} />,
        items: [
          {
            id: 'theme',
            titleKey: 'helpThemeColorsTitle',
            contentKey: 'helpThemeColorsContent',
            keywords: ['theme', 'color', 'customize', 'appearance', 'style'],
          },
          {
            id: 'darkmode',
            titleKey: 'helpDarkModeTitle',
            contentKey: 'helpDarkModeContent',
            keywords: ['dark', 'mode', 'light', 'theme', 'night'],
          },
          {
            id: 'language',
            titleKey: 'helpLanguageTitle',
            contentKey: 'helpLanguageContent',
            keywords: ['language', 'translate', 'localization', 'spanish', 'french'],
          },
          {
            id: 'sounds',
            titleKey: 'helpSoundsVibrationsTitle',
            contentKey: 'helpSoundsVibrationsContent',
            keywords: ['sound', 'vibration', 'haptic', 'feedback', 'audio'],
          },
        ],
      },
      {
        id: 'data-privacy',
        nameKey: 'dataPrivacy',
        icon: <Database size={20} color={primaryColor} />,
        items: [
          {
            id: 'privacy',
            titleKey: 'helpPrivacyPolicyTitle',
            contentKey: 'helpPrivacyPolicyContent',
            keywords: ['privacy', 'policy', 'data', 'personal', 'information'],
          },
          {
            id: 'terms',
            titleKey: 'helpTermsTitle',
            contentKey: 'helpTermsContent',
            keywords: ['terms', 'conditions', 'agreement', 'rules', 'legal'],
          },
          {
            id: 'cookies',
            titleKey: 'helpCookiesTitle',
            contentKey: 'helpCookiesContent',
            keywords: ['cookie', 'cookies', 'tracking', 'storage'],
          },
          {
            id: 'storage',
            titleKey: 'helpDataStorageTitle',
            contentKey: 'helpDataStorageContent',
            keywords: ['storage', 'data', 'where', 'stored', 'server'],
          },
        ],
      },
      {
        id: 'troubleshooting',
        nameKey: 'troubleshooting',
        icon: <Wrench size={20} color={primaryColor} />,
        items: [
          {
            id: 'not-working',
            titleKey: 'helpAppNotWorkingTitle',
            contentKey: 'helpAppNotWorkingContent',
            keywords: ['not working', 'issue', 'problem', 'bug', 'crash', 'fix'],
          },
          {
            id: 'sync',
            titleKey: 'helpDataSyncTitle',
            contentKey: 'helpDataSyncContent',
            keywords: ['sync', 'synchronize', 'data', 'refresh', 'update'],
          },
          {
            id: 'contact',
            titleKey: 'helpContactSupportTitle',
            contentKey: 'helpContactSupportContent',
            keywords: ['contact', 'support', 'help', 'email', 'assistance'],
          },
        ],
      },
    ],
    [primaryColor]
  );

  // Filter and sort categories alphabetically based on search query and current language
  const filteredCategories = useMemo(() => {
    // Sort categories alphabetically by their translated names
    const sortAlphabetically = (categories: FAQCategory[]) => {
      return [...categories].sort((a, b) => {
        const nameA = t(a.nameKey as any, language).toLowerCase();
        const nameB = t(b.nameKey as any, language).toLowerCase();
        return nameA.localeCompare(nameB, language);
      });
    };

    if (!searchQuery.trim()) {
      return sortAlphabetically(faqCategories);
    }

    const query = searchQuery.toLowerCase().trim();

    const filtered = faqCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const title = t(item.titleKey as any, language).toLowerCase();
          const content = t(item.contentKey as any, language).toLowerCase();
          const keywordsMatch = item.keywords.some((kw) =>
            kw.toLowerCase().includes(query)
          );
          return (
            title.includes(query) || content.includes(query) || keywordsMatch
          );
        }),
      }))
      .filter((category) => category.items.length > 0);

    return sortAlphabetically(filtered);
  }, [searchQuery, faqCategories, language]);

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleCategory = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`mailto:${COMPANY_INFO.email}`);
  };

  const totalResults = filteredCategories.reduce(
    (acc, cat) => acc + cat.items.length,
    0
  );

  // Shared content (description + search + FAQ list)
  const helpContent = (
    <>
      {/* Description */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
          {t('helpCenterDescription', language)}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 12,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Search size={18} color={colors.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('searchHelpPlaceholder', language)}
            placeholderTextColor={colors.textTertiary}
            cursorColor={primaryColor}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 10,
              color: colors.text,
              fontSize: 15,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
          {/* Search Results Summary */}
          {searchQuery.trim() && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={{
                paddingHorizontal: 16,
                paddingBottom: 8,
              }}
            >
              {totalResults > 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {t('searchResultsCount', language).replace('{count}', String(totalResults))}
                </Text>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    padding: 24,
                    alignItems: 'center',
                  }}
                >
                  <Search
                    size={40}
                    color={colors.textTertiary}
                    style={{ marginBottom: 12 }}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '600',
                      marginBottom: 4,
                    }}
                  >
                    {t('noResultsFoundHelp', language)}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      textAlign: 'center',
                    }}
                  >
                    {t('tryDifferentKeywords', language)}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* FAQ Categories */}
          <View style={{ paddingHorizontal: 16 }}>
            {filteredCategories.map((category, categoryIndex) => (
              <Animated.View
                key={category.id}
                entering={FadeInDown.delay(categoryIndex * 50).duration(300)}
                style={{ marginBottom: 16 }}
              >
                {/* Category Header */}
                <Pressable
                  onPress={() => toggleCategory(category.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: `${primaryColor}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    {category.icon}
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '700',
                    }}
                  >
                    {t(category.nameKey as any, language)}
                  </Text>
                  <View
                    style={{
                      backgroundColor: `${primaryColor}20`,
                      borderRadius: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      marginRight: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: primaryColor,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {category.items.length}
                    </Text>
                  </View>
                  <ChevronRight
                    size={18}
                    color={colors.textTertiary}
                    style={{
                      transform: [
                        {
                          rotate: expandedCategories.has(category.id)
                            ? '90deg'
                            : '0deg',
                        },
                      ],
                    }}
                  />
                </Pressable>

                {/* Category Items */}
                {expandedCategories.has(category.id) && (
                  <View style={{ marginTop: 4 }}>
                    {category.items.map((item, itemIndex) => (
                      <Animated.View
                        key={item.id}
                        entering={FadeInDown.delay(itemIndex * 30).duration(200)}
                      >
                        <ExpandableFAQItem
                          item={item}
                          language={language}
                          colors={colors}
                          isExpanded={expandedItems.has(item.id)}
                          onToggle={() => toggleItem(item.id)}
                        />
                      </Animated.View>
                    ))}
                  </View>
                )}
              </Animated.View>
            ))}
          </View>

          {/* Contact Support Section */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: `${primaryColor}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                  }}
                >
                  <Mail size={22} color={primaryColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 17,
                      fontWeight: '700',
                    }}
                  >
                    {t('contactSupport', language)}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {t('contactSupportDescription', language)}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleContactSupport}
                style={{
                  backgroundColor: primaryColor,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                <Mail size={18} color="#FFFFFF" />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontWeight: '600',
                    marginLeft: 8,
                  }}
                >
                  {t('sendUsEmail', language)}
                </Text>
              </Pressable>

              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 12,
                }}
              >
                {COMPANY_INFO.email}
              </Text>
            </View>
          </View>
        </ScrollView>
      </>
  );

  // Embedded: render content directly (no Modal/header — host provides those)
  if (embedded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {helpContent}
      </View>
    );
  }

  // Standalone: wrap in Modal with header
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={['top']}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <HelpCircle size={22} color={primaryColor} />
            <Text
              style={{
                color: colors.text,
                fontWeight: 'bold',
                fontSize: 18,
                marginLeft: 8,
                flex: 1,
              }}
            >
              {t('helpCenter', language)}
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
            <X size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        {helpContent}
      </SafeAreaView>
    </Modal>
  );
};
