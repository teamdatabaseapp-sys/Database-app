import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Briefcase, TrendingUp, Sparkles, Globe } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { TranslationKey } from '@/lib/i18n';

interface EnterpriseSection {
  icon: React.ReactNode;
  titleKey: TranslationKey;
  bulletKeys: TranslationKey[];
}

function getSections(primaryColor: string): EnterpriseSection[] {
  return [
    {
      icon: <Briefcase size={15} color={primaryColor} strokeWidth={2.5} />,
      titleKey: 'paywallSectionBizPlatform',
      bulletKeys: [
        'paywallFeatureCRM',
        'paywallFeatureBooking',
        'paywallFeatureStaff',
        'paywallFeatureServices',
      ],
    },
    {
      icon: <TrendingUp size={15} color={primaryColor} strokeWidth={2.5} />,
      titleKey: 'paywallSectionMarketing',
      bulletKeys: [
        'paywallFeatureEmailCampaigns',
        'paywallFeatureDrip',
        'paywallFeaturePromotions',
        'paywallFeatureSocial',
        'paywallFeatureGiftLoyalty',
      ],
    },
    {
      icon: <Sparkles size={15} color={primaryColor} strokeWidth={2.5} />,
      titleKey: 'paywallSectionAI',
      bulletKeys: [
        'paywallFeatureAIPromo',
        'paywallFeatureAICampaigns',
        'paywallFeatureAIInsights',
        'paywallFeatureRevenue',
      ],
    },
    {
      icon: <Globe size={15} color={primaryColor} strokeWidth={2.5} />,
      titleKey: 'paywallSectionGlobal',
      bulletKeys: [
        'paywallFeature18Lang',
      ],
    },
  ];
}

interface TrialBenefitsCardProps {
  language: Language;
}

export function TrialBenefitsCard({ language }: TrialBenefitsCardProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const sections = getSections(primaryColor);

  return (
    <Animated.View
      entering={FadeInDown.delay(320).springify().damping(14)}
      style={{
        marginHorizontal: 20,
        marginTop: 12,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.04,
        shadowRadius: 8,
      }}
    >
      {/* Card label */}
      <Text style={{
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 16,
        opacity: 0.45,
      }}>
        {t('paywallEverythingIncluded', language)}
      </Text>

      {sections.map((section, si) => (
        <View
          key={si}
          style={{ marginBottom: si < sections.length - 1 ? 18 : 0 }}
        >
          {/* Category heading */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              backgroundColor: primaryColor + '18',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}>
              {section.icon}
            </View>
            <Text style={{
              color: primaryColor,
              fontSize: 13,
              fontWeight: '800',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              flex: 1,
            }}>
              {t(section.titleKey, language)}
            </Text>
          </View>

          {/* Bullets */}
          {section.bulletKeys.map((bulletKey, bi) => (
            <View key={bi} style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginBottom: bi < section.bulletKeys.length - 1 ? 6 : 0,
              paddingLeft: 4,
            }}>
              <Text style={{
                color: primaryColor,
                fontSize: 15,
                lineHeight: 22,
                marginRight: 7,
                fontWeight: '600',
              }}>
                ·
              </Text>
              <Text style={{
                color: colors.textSecondary,
                fontSize: 15,
                flex: 1,
                lineHeight: 22,
              }}>
                {t(bulletKey, language)}
              </Text>
            </View>
          ))}

          {/* Section divider */}
          {si < sections.length - 1 && (
            <View style={{
              height: 1,
              backgroundColor: colors.border,
              marginTop: 14,
              opacity: 0.6,
            }} />
          )}
        </View>
      ))}
    </Animated.View>
  );
}
