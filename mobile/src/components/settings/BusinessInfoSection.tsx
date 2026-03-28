import React from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import {
  CalendarDays,
  QrCode,
  Paintbrush,
  Shield,
  Sparkles,
  Check,
  Settings2,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { SettingsLinkItem } from './SettingsLinkItem';
import { useSetupCompletion } from '@/hooks/useSetupCompletion';

// ============================================
// BusinessSetupEntryCard — self-contained card that calls useSetupCompletion
// ============================================

function BusinessSetupEntryCard({ language }: { language: Language }) {
  const { colors, primaryColor } = useTheme();
  const { totalComplete, totalApplicable, allFoundationComplete } = useSetupCompletion();

  const progressPercent = totalApplicable > 0 ? totalComplete / totalApplicable : 0;

  return (
    <Pressable
      onPress={() => router.push('/business-setup')}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          marginHorizontal: 16,
          marginTop: 16,
          borderRadius: 16,
          backgroundColor: colors.card,
          padding: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: allFoundationComplete ? `${primaryColor}40` : colors.border,
          ...Platform.select({
            ios: {
              shadowColor: allFoundationComplete ? primaryColor : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: allFoundationComplete ? 0.12 : 0.05,
              shadowRadius: 8,
            },
            android: { elevation: 2 },
          }),
        }}
      >
        {/* Top row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: `${primaryColor}18`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
              flexShrink: 0,
            }}
          >
            {allFoundationComplete ? (
              <CheckCircle2 size={18} color={primaryColor} strokeWidth={2} />
            ) : (
              <Settings2 size={18} color={primaryColor} strokeWidth={1.8} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: colors.text,
                letterSpacing: -0.2,
              }}
            >
              {t('businessSetup', language)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
              {allFoundationComplete
                ? t('setupProgressComplete', language)
                : t('setupProgressPending', language)}
            </Text>
          </View>

          {/* Count chip + chevron */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: `${primaryColor}15`,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: primaryColor,
                }}
              >
                {totalComplete}/{totalApplicable}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </View>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.round(progressPercent * 100)}%`,
              backgroundColor: primaryColor,
              borderRadius: 2,
            }}
          />
        </View>

        {/* Status chip */}
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: allFoundationComplete ? `${primaryColor}18` : colors.backgroundTertiary ?? colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: allFoundationComplete ? primaryColor : colors.textSecondary,
              }}
            >
              {allFoundationComplete
                ? t('setupStateOperational', language)
                : t('setupStateInProgress', language)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ============================================
// BusinessInfoSection — Settings List card
// Business Setup, Appointments toggle, QR, Branding, Stores/Staff, Team Access, Services
// ============================================

export interface BusinessInfoSectionProps {
  language: Language;
  calendarEnabled: boolean;
  onCalendarToggle: () => void;
  onQrLinkPress: () => void;
  onBrandingPress: () => void;
  onStoresStaffPress: () => void;
  onTeamAccessPress: () => void;
  onServicesProductsPress: () => void;
  businessTypeSelection: 'appointments' | 'walkIns' | 'both' | 'skip' | null;
  onBusinessSetupPress: () => void;
}

export function BusinessInfoSection({
  language,
  calendarEnabled,
  onCalendarToggle,
  onQrLinkPress,
  onBrandingPress,
  onStoresStaffPress,
  onTeamAccessPress,
  onServicesProductsPress,
}: BusinessInfoSectionProps) {
  const { colors, primaryColor } = useTheme();

  return (
    <>
      {/* Premium Business Setup entry card */}
      <Animated.View entering={FadeInDown.delay(280).duration(400)}>
        <BusinessSetupEntryCard language={language} />
      </Animated.View>

      {/* Settings List */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={{
          backgroundColor: colors.card,
          marginHorizontal: 16,
          marginTop: 12,
          borderRadius: 16,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        {/* Appointments / Calendar Toggle */}
        <SettingsLinkItem
          icon={<CalendarDays size={20} color={primaryColor} />}
          label={t('appointments', language)}
          subtitle={calendarEnabled ? t('schedulingFeaturesEnabled', language) : t('appointmentsOffDescription', language)}
          onPress={onCalendarToggle}
          iconWrapper
          rowFlexDirect={false}
          backgroundColor={colors.card}
          trailing={<View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: calendarEnabled ? primaryColor : 'transparent', borderWidth: 2, borderColor: calendarEnabled ? primaryColor : colors.border, alignItems: 'center', justifyContent: 'center' }}>{calendarEnabled && <Check size={14} color="#FFFFFF" />}</View>}
        />

        {/* QR & Link */}
        {calendarEnabled && (
          <SettingsLinkItem
            icon={<QrCode size={20} color={primaryColor} />}
            label={t('settingsQrLinkTitle', language)}
            subtitle={t('settingsQrLinkSubtitle', language)}
            onPress={onQrLinkPress}
            iconWrapper
            backgroundColor={colors.card}
          />
        )}

        {/* Business Branding + Notifications */}
        <SettingsLinkItem
          icon={<Paintbrush size={20} color={primaryColor} />}
          label={t('settingsBrandingTitle', language)}
          subtitle={t('settingsBrandingSubtitle', language)}
          onPress={onBrandingPress}
          iconWrapper
          backgroundColor={colors.card}
        />

        {/* Stores, Staff & Calendar */}
        <SettingsLinkItem
          icon={<CalendarDays size={20} color={primaryColor} />}
          label={t('storesStaffCalendar', language)}
          subtitle={t('storesStaffCalendarDescription', language)}
          onPress={onStoresStaffPress}
          iconWrapper
          backgroundColor={colors.card}
        />

        {/* Team Access & Permissions */}
        <SettingsLinkItem
          icon={<Shield size={20} color={primaryColor} />}
          label={t('teamAccessPermissions', language)}
          subtitle={t('teamAccessPermissionsDescription', language)}
          onPress={onTeamAccessPress}
          iconWrapper
          backgroundColor={colors.card}
        />

        {/* Services & Products */}
        <SettingsLinkItem
          icon={<Sparkles size={20} color={primaryColor} />}
          label={t('servicesAndProducts', language)}
          subtitle={t('servicesAndProductsDescription', language)}
          onPress={onServicesProductsPress}
          iconWrapper
          backgroundColor={colors.card}
        />

      </Animated.View>
    </>
  );
}
