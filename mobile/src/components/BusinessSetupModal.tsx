import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  X,
  CalendarPlus,
  Users,
  Zap,
  SkipForward,
  Check,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { feedbackToggle } from '@/lib/SoundManager';

type BusinessType = 'appointments' | 'walkIns' | 'both' | 'skip';

interface BusinessSetupModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BusinessSetupModal({ visible, onClose }: BusinessSetupModalProps) {
  const { colors, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const setCalendarEnabled = useStore((s) => s.setCalendarEnabled);
  const setBusinessTypeSelection = useStore((s) => s.setBusinessTypeSelection);
  const businessTypeSelection = useStore((s) => s.businessTypeSelection);
  const isDark = useStore((s) => s.themeSettings.darkMode);

  const [selected, setSelected] = useState<BusinessType | null>(
    businessTypeSelection as BusinessType | null
  );

  const options: Array<{
    type: BusinessType;
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    labelKey: 'businessTypeAppointments' | 'businessTypeWalkIns' | 'businessTypeBoth' | 'businessTypeSkip';
    descKey: 'businessTypeAppointmentsDesc' | 'businessTypeWalkInsDesc' | 'businessTypeBothDesc' | 'businessTypeSkipDesc';
    enablesCalendar: boolean | null;
  }> = [
    {
      type: 'appointments',
      icon: CalendarPlus,
      labelKey: 'businessTypeAppointments',
      descKey: 'businessTypeAppointmentsDesc',
      enablesCalendar: true,
    },
    {
      type: 'walkIns',
      icon: Users,
      labelKey: 'businessTypeWalkIns',
      descKey: 'businessTypeWalkInsDesc',
      enablesCalendar: false,
    },
    {
      type: 'both',
      icon: Zap,
      labelKey: 'businessTypeBoth',
      descKey: 'businessTypeBothDesc',
      enablesCalendar: true,
    },
    {
      type: 'skip',
      icon: SkipForward,
      labelKey: 'businessTypeSkip',
      descKey: 'businessTypeSkipDesc',
      enablesCalendar: null,
    },
  ];

  const handleSelect = (type: BusinessType) => {
    setSelected(type);
    feedbackToggle();
    const option = options.find((o) => o.type === type);
    if (option && option.enablesCalendar !== null) {
      setCalendarEnabled(option.enablesCalendar);
    }
    setBusinessTypeSelection(type);
    // Brief delay to show selection feedback then close + navigate to hub
    setTimeout(() => {
      onClose();
      if (type !== 'skip') {
        router.push('/business-setup');
      }
    }, 320);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={['top', 'bottom']}
      >
        {/* ── Header ── */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>
              {t('businessSetup', language)}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              {t('businessSetupSubtitle', language)}
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
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Progress bar ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginBottom: 28 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: primaryColor }} />
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
              1 / 3
            </Text>
          </Animated.View>

          {/* ── Question ── */}
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 28, letterSpacing: -0.5 }}>
              {t('howDoYouRunYourBusiness', language)}
            </Text>
          </Animated.View>

          {/* ── Options ── */}
          {options.map((option, index) => {
            const Icon = option.icon;
            const isSelected = selected === option.type;
            const isSkip = option.type === 'skip';

            return (
              <Animated.View
                key={option.type}
                entering={FadeInDown.delay(160 + index * 60).duration(400)}
                style={{ marginBottom: isSkip ? 0 : 12 }}
              >
                {isSkip ? (
                  /* Skip — subtle text button */
                  <Pressable
                    onPress={() => handleSelect(option.type)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 18,
                      opacity: pressed ? 0.6 : 1,
                      gap: 6,
                    })}
                  >
                    <SkipForward size={15} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>
                      {t('businessTypeSkip', language)}
                    </Text>
                  </Pressable>
                ) : (
                  /* Regular option card */
                  <Pressable
                    onPress={() => handleSelect(option.type)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.88 : 1,
                    })}
                  >
                    <View
                      style={{
                        borderRadius: 18,
                        overflow: 'hidden',
                        borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                        borderColor: isSelected ? primaryColor : colors.border,
                        ...Platform.select({
                          ios: {
                            shadowColor: isSelected ? primaryColor : '#000',
                            shadowOffset: { width: 0, height: isSelected ? 4 : 2 },
                            shadowOpacity: isSelected ? 0.2 : 0.06,
                            shadowRadius: isSelected ? 12 : 6,
                          },
                          android: { elevation: isSelected ? 6 : 2 },
                        }),
                      }}
                    >
                      {isSelected ? (
                        <LinearGradient
                          colors={[`${primaryColor}18`, `${primaryColor}08`]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}
                        >
                          <CardContent
                            Icon={Icon}
                            labelKey={option.labelKey}
                            descKey={option.descKey}
                            language={language}
                            primaryColor={primaryColor}
                            textColor={colors.text}
                            secondaryColor={colors.textSecondary}
                            isSelected={isSelected}
                          />
                        </LinearGradient>
                      ) : (
                        <View
                          style={{
                            padding: 18,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 16,
                            backgroundColor: colors.card,
                          }}
                        >
                          <CardContent
                            Icon={Icon}
                            labelKey={option.labelKey}
                            descKey={option.descKey}
                            language={language}
                            primaryColor={primaryColor}
                            textColor={colors.text}
                            secondaryColor={colors.textSecondary}
                            isSelected={isSelected}
                          />
                        </View>
                      )}
                    </View>
                  </Pressable>
                )}
              </Animated.View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Card content helper ───────────────────────────────────────────────────────

interface CardContentProps {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  labelKey: 'businessTypeAppointments' | 'businessTypeWalkIns' | 'businessTypeBoth' | 'businessTypeSkip';
  descKey: 'businessTypeAppointmentsDesc' | 'businessTypeWalkInsDesc' | 'businessTypeBothDesc' | 'businessTypeSkipDesc';
  language: Language;
  primaryColor: string;
  textColor: string;
  secondaryColor: string;
  isSelected: boolean;
}

function CardContent({ Icon, labelKey, descKey, language, primaryColor, textColor, secondaryColor, isSelected }: CardContentProps) {
  return (
    <>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: isSelected ? `${primaryColor}22` : `${primaryColor}12`,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={primaryColor} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: textColor, letterSpacing: -0.2 }}>
          {t(labelKey, language)}
        </Text>
        <Text style={{ fontSize: 13, color: secondaryColor, marginTop: 3, lineHeight: 18 }}>
          {t(descKey, language)}
        </Text>
      </View>
      {isSelected && (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: primaryColor,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Check size={14} color="#fff" strokeWidth={2.5} />
        </View>
      )}
    </>
  );
}
