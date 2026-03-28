import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { COMPANY_INFO, CURRENT_TERMS_VERSION } from '@/lib/legal-content';

interface SubscriptionLegalConfirmationProps {
  /** Custom class name for the container */
  className?: string;
  /** Called when user taps on Terms of Service link */
  onTermsPress?: () => void;
  /** Called when user taps on Privacy Policy link */
  onPrivacyPress?: () => void;
  /** Called when user taps on Arbitration Agreement link */
  onArbitrationPress?: () => void;
}

/**
 * Legal confirmation text to display during subscription checkout
 * Required for App Store and Play Store compliance
 *
 * Usage:
 * Place this component above or below the subscription purchase button
 */
export function SubscriptionLegalConfirmation({
  className = '',
  onTermsPress,
  onPrivacyPress,
  onArbitrationPress,
}: SubscriptionLegalConfirmationProps) {
  return (
    <View className={`bg-slate-50 rounded-xl p-4 ${className}`}>
      <Text className="text-slate-600 text-xs leading-5 text-center">
        By subscribing, you confirm that you agree to the{' '}
        <Text
          className="text-teal-600 font-medium"
          onPress={onTermsPress}
        >
          Terms of Service
        </Text>
        ,{' '}
        <Text
          className="text-teal-600 font-medium"
          onPress={onPrivacyPress}
        >
          Privacy Policy
        </Text>
        , and{' '}
        <Text
          className="text-teal-600 font-medium"
          onPress={onArbitrationPress}
        >
          Arbitration Agreement
        </Text>
        .
      </Text>

      <View className="mt-2 pt-2 border-t border-slate-200">
        <Text className="text-slate-400 text-[10px] text-center leading-4">
          DataBase is a tool to help you manage your business. Your results will depend on how you use it and your individual circumstances.
        </Text>
      </View>
    </View>
  );
}

/**
 * Compact version for inline display
 */
export function SubscriptionLegalConfirmationCompact({
  onTermsPress,
}: {
  onTermsPress?: () => void;
}) {
  return (
    <Text className="text-slate-500 text-xs text-center leading-5">
      By subscribing, you agree to our{' '}
      <Text className="text-teal-600 font-medium" onPress={onTermsPress}>
        Terms & Conditions
      </Text>
    </Text>
  );
}

/**
 * Full legal footer for subscription screens
 * Includes all required disclosures for App Store compliance
 */
export function SubscriptionLegalFooter({
  onTermsPress,
  onPrivacyPress,
}: {
  onTermsPress?: () => void;
  onPrivacyPress?: () => void;
}) {
  return (
    <View className="px-5 py-4">
      {/* Main Disclaimer */}
      <View className="bg-amber-50 rounded-xl p-4 mb-3">
        <Text className="text-amber-700 text-xs font-semibold mb-1">
          PLEASE NOTE
        </Text>
        <Text className="text-amber-600 text-xs leading-5">
          DataBase is a business management tool designed to help you work more efficiently. Your results will depend on how you use the app, your business practices, and market conditions. We're here to help you succeed, but we can't guarantee specific outcomes.
        </Text>
      </View>

      {/* Legal Links */}
      <View className="flex-row justify-center space-x-4">
        <Pressable onPress={onTermsPress}>
          <Text className="text-slate-500 text-xs underline">Terms of Service</Text>
        </Pressable>
        <Text className="text-slate-300">•</Text>
        <Pressable onPress={onPrivacyPress}>
          <Text className="text-slate-500 text-xs underline">Privacy Policy</Text>
        </Pressable>
      </View>

      {/* Version Info */}
      <Text className="text-slate-400 text-[10px] text-center mt-2">
        Terms Version {CURRENT_TERMS_VERSION}
      </Text>
    </View>
  );
}
