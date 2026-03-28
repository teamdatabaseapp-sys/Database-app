/**
 * BusinessSetupHubScreen
 *
 * Enterprise-grade business setup hub. Shows grouped setup steps with
 * real completion state fetched from Supabase via React Query.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ChevronRight,
  Building2,
  Briefcase,
  MapPin,
  Scissors,
  Link2,
  Palette,
  Star,
  UserPlus,
  Shield,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useSetupCompletion, SetupGroup, SetupStep } from '@/hooks/useSetupCompletion';

// ============================================
// Props
// ============================================

interface BusinessSetupHubScreenProps {
  onBack: () => void;
  onNavigateToStep: (stepId: string) => void;
}

// ============================================
// Group icon map
// ============================================

const GROUP_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  identity: Building2,
  model: Briefcase,
  locationsHours: MapPin,
  services: Scissors,
  operations: Shield,
  booking: Link2,
  brand: Palette,
  programs: Star,
  firstClient: UserPlus,
};

// ============================================
// Skeleton loader
// ============================================

function SkeletonRow({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View
      style={{
        height: 72,
        borderRadius: 12,
        backgroundColor: colors.border,
        marginBottom: 10,
        opacity: 0.5,
      }}
    />
  );
}

function SkeletonSection({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ height: 20, width: 140, backgroundColor: colors.border, borderRadius: 6, marginBottom: 16, opacity: 0.5 }} />
      <SkeletonRow colors={colors} />
      <SkeletonRow colors={colors} />
      <SkeletonRow colors={colors} />
    </View>
  );
}

// ============================================
// Step row
// ============================================

interface StepRowProps {
  step: SetupStep;
  language: Language;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  primaryColor: string;
  index: number;
}

function StepRow({ step, language, onPress, colors, primaryColor, index }: StepRowProps) {
  if (!step.isApplicable) return null;

  const isComplete = step.isComplete;
  const accentColor = isComplete ? primaryColor : colors.border;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(320)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingRight: 14,
            paddingLeft: 0,
            backgroundColor: colors.card,
            borderRadius: 12,
            marginBottom: 8,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            overflow: 'hidden',
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
              },
              android: { elevation: 1 },
            }),
          }}
        >
          {/* Left accent bar */}
          <View
            style={{
              width: 3,
              alignSelf: 'stretch',
              backgroundColor: accentColor,
              borderRadius: 2,
              marginRight: 14,
              marginLeft: 0,
            }}
          />

          {/* Completion indicator */}
          <View style={{ marginRight: 12, flexShrink: 0 }}>
            {isComplete ? (
              <CheckCircle2 size={22} color={primaryColor} strokeWidth={2} />
            ) : (
              <Circle size={22} color={colors.border} strokeWidth={1.5} />
            )}
          </View>

          {/* Text block */}
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isComplete ? colors.textSecondary : colors.text,
                  textDecorationLine: isComplete ? 'line-through' : 'none',
                  letterSpacing: -0.1,
                }}
              >
                {t(step.titleKey, language)}
              </Text>
              {step.isOptional && (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500' }}>
                    {t('setupOptionalBadge', language)}
                  </Text>
                </View>
              )}
            </View>
            {!isComplete && (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                  lineHeight: 16,
                }}
              >
                {t(step.descKey, language)}
              </Text>
            )}
          </View>

          {/* Action chip */}
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: isComplete ? `${primaryColor}15` : primaryColor,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: isComplete ? primaryColor : '#FFFFFF',
              }}
            >
              {isComplete ? t('setupActionReview', language) : t('setupActionConfigure', language)}
            </Text>
            <ChevronRight
              size={12}
              color={isComplete ? primaryColor : '#FFFFFF'}
              strokeWidth={2.5}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// Group card
// ============================================

interface GroupCardProps {
  group: SetupGroup;
  language: Language;
  onNavigate: (stepId: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  primaryColor: string;
  groupIndex: number;
}

function GroupCard({ group, language, onNavigate, colors, primaryColor, groupIndex }: GroupCardProps) {
  const Icon = GROUP_ICONS[group.id] ?? Building2;

  const applicableSteps = group.steps.filter((s) => s.isApplicable);
  const requiredSteps = applicableSteps.filter((s) => !s.isOptional);
  const completedRequired = requiredSteps.filter((s) => s.isComplete).length;
  const allRequiredDone = requiredSteps.length === 0 || completedRequired === requiredSteps.length;

  if (applicableSteps.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(groupIndex * 60).duration(400)}
      style={{ marginBottom: 28 }}
    >
      {/* Group header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 14,
          gap: 10,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: allRequiredDone ? `${primaryColor}18` : `${primaryColor}18`,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon
            size={18}
            color={allRequiredDone ? primaryColor : primaryColor}
            strokeWidth={1.8}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: colors.text,
              letterSpacing: -0.3,
            }}
          >
            {t(group.titleKey, language)}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
            {t(group.descKey, language)}
          </Text>
        </View>

        {/* Required steps count badge */}
        {requiredSteps.length > 0 && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: allRequiredDone ? `${primaryColor}18` : `${primaryColor}15`,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: primaryColor,
              }}
            >
              {completedRequired}/{requiredSteps.length}
            </Text>
          </View>
        )}
      </View>

      {/* Steps */}
      {applicableSteps.map((step, idx) => (
        <StepRow
          key={step.id}
          step={step}
          language={language}
          onPress={() => onNavigate(step.id)}
          colors={colors}
          primaryColor={primaryColor}
          index={idx}
        />
      ))}
    </Animated.View>
  );
}

// ============================================
// Section divider chip
// ============================================

function SectionChip({
  label,
  variant,
  primaryColor,
  colors,
}: {
  label: string;
  variant: 'foundation' | 'enhancement';
  primaryColor: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const isFounded = variant === 'foundation';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        gap: 10,
      }}
    >
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 20,
          backgroundColor: isFounded ? primaryColor : 'transparent',
          borderWidth: isFounded ? 0 : 1.5,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: isFounded ? '#FFFFFF' : colors.textSecondary,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

// ============================================
// Main screen
// ============================================

export function BusinessSetupHubScreen({
  onBack,
  onNavigateToStep,
}: BusinessSetupHubScreenProps) {
  const { colors, primaryColor, isDark } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const { groups, totalApplicable, totalComplete, allFoundationComplete, isLoading } =
    useSetupCompletion();

  const progressPercent = totalApplicable > 0 ? totalComplete / totalApplicable : 0;

  const foundationGroups = groups.filter((g) => g.groupType === 'foundation');
  const enhancementGroups = groups.filter((g) => g.groupType === 'enhancement');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(250)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: colors.card,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            gap: 12,
          }}
        >
          {/* Building2 icon badge */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Building2 size={20} color={primaryColor} strokeWidth={1.8} />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: colors.text,
              letterSpacing: -0.3,
              flex: 1,
            }}
          >
            {t('businessSetup', language)}
          </Text>

          {/* X close button — right side */}
          <Pressable
            onPress={onBack}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.backgroundTertiary ?? colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
              flexShrink: 0,
            })}
          >
            <X size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {/* Subtitle + progress stacked */}
      <View
        style={{
          backgroundColor: colors.headerBackground ?? colors.card,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            flexShrink: 1,
          }}
        >
          {t('setupHubSubtitle', language)}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: primaryColor,
            marginTop: 2,
          }}
        >
          {t('setupProgressOf', language)
            .replace('{done}', String(totalComplete))
            .replace('{total}', String(totalApplicable))}
        </Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 3,
          backgroundColor: colors.border,
          width: '100%',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            width: `${Math.round(progressPercent * 100)}%`,
            backgroundColor: primaryColor,
            borderRadius: 2,
          }}
        />
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: allFoundationComplete ? 100 : 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <>
            <SkeletonSection colors={colors} />
            <SkeletonSection colors={colors} />
            <SkeletonSection colors={colors} />
          </>
        ) : (
          <>
            {/* Foundation section */}
            <SectionChip
              label={t('setupFoundationLabel', language)}
              variant="foundation"
              primaryColor={primaryColor}
              colors={colors}
            />

            {foundationGroups.map((group, idx) => (
              <GroupCard
                key={group.id}
                group={group}
                language={language}
                onNavigate={onNavigateToStep}
                colors={colors}
                primaryColor={primaryColor}
                groupIndex={idx}
              />
            ))}

            {/* Enhancements section */}
            <SectionChip
              label={t('setupEnhancementsLabel', language)}
              variant="enhancement"
              primaryColor={primaryColor}
              colors={colors}
            />

            {enhancementGroups.map((group, idx) => (
              <GroupCard
                key={group.id}
                group={group}
                language={language}
                onNavigate={onNavigateToStep}
                colors={colors}
                primaryColor={primaryColor}
                groupIndex={idx + foundationGroups.length}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Floating done button when foundation complete */}
      {allFoundationComplete && !isLoading && (
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingBottom: 36,
            paddingTop: 12,
            backgroundColor: colors.background,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={onBack}
            style={({ pressed }) => ({
              backgroundColor: primaryColor,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
              flexDirection: 'row',
              gap: 8,
              ...Platform.select({
                ios: {
                  shadowColor: primaryColor,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                },
                android: { elevation: 6 },
              }),
            })}
          >
            <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={2} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#FFFFFF',
                letterSpacing: -0.2,
              }}
            >
              {t('setupHubDoneButton', language)}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
