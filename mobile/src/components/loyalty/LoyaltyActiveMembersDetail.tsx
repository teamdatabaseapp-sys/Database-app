import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight, Mail, Zap, Gift } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface ActiveMember {
  client_id: string;
  name: string;
  total_points: number;
}

interface LoyaltyActiveMembersDetailProps {
  activeMembersList: ActiveMember[];
  language: Language;
  onBack: () => void;
  onOpenSmartDrip?: () => void;
  onOpenMarketing?: () => void;
}

export function LoyaltyActiveMembersDetail({
  activeMembersList,
  language,
  onBack,
  onOpenSmartDrip,
  onOpenMarketing,
}: LoyaltyActiveMembersDetailProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Pressable
          onPress={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <ChevronRight size={18} color={primaryColor} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>
          {t('loyaltyActiveMembers', language)} ({activeMembersList.length})
        </Text>
      </View>

      {/* AI SmartDrip Card */}
      {onOpenSmartDrip && (
        <Pressable
          onPress={onOpenSmartDrip}
          style={{
            backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
            borderRadius: 16,
            padding: 16,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiSmartDripCampaign', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('smartRecommendationLoyaltyBoost', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}

      {/* AI Marketing Promotion Card */}
      {onOpenMarketing && (
        <Pressable
          onPress={onOpenMarketing}
          style={{
            backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiMarketingPromotion', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('smartRecommendationLoyaltyPoints', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}

      {/* Member List */}
      {activeMembersList.map((member) => {
        const nameParts = member.name.trim().split(/\s+/);
        const initials = nameParts.length >= 2
          ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
          : member.name.charAt(0).toUpperCase();
        return (
          <View
            key={member.client_id}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: primaryColor, fontWeight: 'bold', fontSize: 15 }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '500', fontSize: 15 }}>{member.name}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 2 }}>
                {member.total_points.toLocaleString()} {t('loyaltyPoints', language).toLowerCase()}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </View>
        );
      })}

      {activeMembersList.length === 0 && (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>
          {t('loyaltyNoAnalyticsData', language)}
        </Text>
      )}
    </View>
  );
}
