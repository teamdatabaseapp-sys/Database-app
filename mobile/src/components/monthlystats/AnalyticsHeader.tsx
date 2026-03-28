import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  ArrowLeft,
  BarChart3,
  X,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

// ============================================
// AnalyticsHeader — title/close/AI button row
// ============================================

export interface AnalyticsHeaderProps {
  drillDownType: string | null;
  asTab: boolean;
  language: Language;
  onBack: () => void;
  onClose: () => void;
  /** undefined when onOpenAIAdvisor is not available */
  onAIPress: (() => void) | undefined;
}

export function AnalyticsHeader({
  drillDownType,
  asTab,
  language,
  onBack,
  onClose,
  onAIPress,
}: AnalyticsHeaderProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      {drillDownType ? (
        <Pressable
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontWeight: '500', marginLeft: 8 }}>{t('back', language)}</Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <BarChart3 size={22} color={primaryColor} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('analytics', language)}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {!drillDownType && (
          <Pressable
            onPress={() => {
              if (!onAIPress) return;
              onAIPress();
            }}
            className="flex-row items-center"
            style={({ pressed }) => ({
              backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 7,
              gap: 5,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Sparkles size={14} color={primaryColor} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: primaryColor }}>{t('askAI', language)}</Text>
          </Pressable>
        )}
        {!asTab && (
          <Pressable
            onPress={onClose}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        )}
        {asTab && !drillDownType && <View style={{ width: 0 }} />}
        {asTab && drillDownType && <View style={{ width: 36 }} />}
      </View>
    </Animated.View>
  );
}
