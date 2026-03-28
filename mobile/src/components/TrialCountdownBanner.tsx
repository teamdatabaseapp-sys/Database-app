import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Clock, ChevronRight, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TrialStatus, formatTrialTimeRemaining } from '@/lib/trial-service';

interface TrialCountdownBannerProps {
  trialStatus: TrialStatus;
  onUpgradePress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TrialCountdownBanner({
  trialStatus,
  onUpgradePress,
}: TrialCountdownBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Don't show if not supposed to or dismissed
  if (!trialStatus.showCountdownBanner || isDismissed) {
    return null;
  }

  const timeRemaining = formatTrialTimeRemaining(trialStatus.hoursRemaining);
  const isUrgent = trialStatus.hoursRemaining <= 24;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.98, {}, () => {
      scale.value = withSpring(1);
    });
    onUpgradePress();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDismissed(true);
  };

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(15)}
      exiting={FadeOutUp.springify()}
      className="mx-4 mb-3"
    >
      <AnimatedPressable style={animatedStyle} onPress={handlePress}>
        <LinearGradient
          colors={isUrgent ? ['#FEF2F2', '#FEE2E2'] : ['#FFFBEB', '#FEF3C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: isUrgent ? '#FECACA' : '#FDE68A',
          }}
        >
          <View className="flex-row items-center">
            {/* Clock icon */}
            <View
              className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                isUrgent ? 'bg-red-100' : 'bg-amber-100'
              }`}
            >
              <Clock size={20} color={isUrgent ? '#DC2626' : '#D97706'} />
            </View>

            {/* Text content */}
            <View className="flex-1">
              <Text
                className={`font-semibold ${
                  isUrgent ? 'text-red-800' : 'text-amber-800'
                }`}
              >
                {isUrgent ? 'Trial ending soon!' : 'Free trial ending'}
              </Text>
              <Text
                className={`text-sm mt-0.5 ${
                  isUrgent ? 'text-red-600' : 'text-amber-600'
                }`}
              >
                {timeRemaining} remaining • Upgrade to continue
              </Text>
            </View>

            {/* Arrow */}
            <View className="flex-row items-center">
              <ChevronRight
                size={20}
                color={isUrgent ? '#DC2626' : '#D97706'}
              />
            </View>

            {/* Dismiss button */}
            <Pressable
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="ml-2 p-1"
            >
              <X size={16} color={isUrgent ? '#F87171' : '#FCD34D'} />
            </Pressable>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}
