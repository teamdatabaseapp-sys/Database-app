import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TrialCTASectionProps {
  language: Language;
  isProcessing: boolean;
  isRestoring: boolean;
  trialError?: string | null;
  onStartTrial: () => void;
  onRestoreAccess: () => void;
}

export function TrialCTASection({
  language,
  isProcessing,
  isRestoring,
  trialError,
  onStartTrial,
  onRestoreAccess,
}: TrialCTASectionProps) {
  const { colors, buttonColor } = useTheme();
  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePress = () => {
    buttonScale.value = withSequence(withSpring(0.96), withSpring(1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartTrial();
  };

  // Slightly faded variant of buttonColor for the gradient end
  const gradStart = buttonColor;
  const gradEnd = buttonColor + 'CC';

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
      {/* Primary CTA */}
      <AnimatedPressable
        style={buttonAnimatedStyle}
        onPress={handlePress}
        disabled={isProcessing || isRestoring}
      >
        <LinearGradient
          colors={[gradStart, gradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 17,
            borderRadius: 14,
            alignItems: 'center',
            opacity: (isProcessing || isRestoring) ? 0.65 : 1,
          }}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={{
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 0.2,
            }}>
              {t('trialCtaStartTrial', language)}
            </Text>
          )}
        </LinearGradient>
      </AnimatedPressable>

      {/* Network/server error — prompts user to retry */}
      {trialError ? (
        <Text style={{
          color: '#E53935',
          fontSize: 13,
          textAlign: 'center',
          marginTop: 10,
          lineHeight: 18,
        }}>
          {trialError}
        </Text>
      ) : null}

      {/* No charge note */}
      <Text style={{
        color: colors.textTertiary,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 17,
      }}>
        {t('trialCtaNoChargeToday', language)}
      </Text>

      {/* Restore link */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRestoreAccess();
        }}
        disabled={isProcessing || isRestoring}
        style={{ paddingVertical: 14, alignItems: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.textTertiary} />
          ) : (
            <>
              <RotateCcw size={13} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 6 }}>
                {t('trialAlreadySubscribed', language)} {t('trialRestoreAccess', language)}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}
