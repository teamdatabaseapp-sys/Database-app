/**
 * CAN-SPAM Compliant Unsubscribe Screen
 *
 * This screen provides ONE-CLICK unsubscribe functionality.
 * NO login, NO password, NO additional fields required.
 *
 * Compliance:
 * - Immediate opt-out processing
 * - Clear confirmation message
 * - Option to re-subscribe with EXPLICIT action
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MailX, CheckCircle, XCircle, MailPlus, ArrowLeft } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { emailService, parseUnsubscribeToken } from '@/lib/email-service';
import { useTheme } from '@/lib/ThemeContext';

type UnsubscribeStatus = 'loading' | 'success' | 'error' | 'already_unsubscribed' | 'resubscribed';

export default function UnsubscribeScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [status, setStatus] = useState<UnsubscribeStatus>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { primaryColor } = useTheme();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. No token provided.');
      return;
    }

    // Process the unsubscribe immediately (one-click, no confirmation needed)
    const result = emailService.processUnsubscribe(token);

    if (result.success) {
      setStatus('success');
      setMessage(result.message);
      if (result.email) {
        setEmail(result.email);
        // Parse token to get businessId for potential re-subscribe
        const parsed = parseUnsubscribeToken(token);
        if (parsed) {
          setBusinessId(parsed.businessId);
        }
      }
    } else {
      setStatus('error');
      setMessage(result.message);
    }
  }, [token]);

  const handleResubscribe = async () => {
    if (!email || !businessId) return;

    setIsProcessing(true);

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = emailService.processResubscribe(email, businessId);

    if (result.success) {
      setStatus('resubscribed');
      setMessage(result.message);
    } else {
      setMessage(result.message);
    }

    setIsProcessing(false);
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 justify-center items-center px-6">
        {status === 'loading' && (
          <Animated.View entering={FadeIn.duration(300)} className="items-center">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="text-slate-600 mt-4 text-base">Processing your request...</Text>
          </Animated.View>
        )}

        {status === 'success' && (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center max-w-sm">
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <CheckCircle size={48} color={primaryColor} />
            </View>

            <Text className="text-2xl font-bold text-slate-800 text-center mb-3">
              Unsubscribed
            </Text>

            <Text className="text-slate-600 text-center text-base mb-2">
              {message}
            </Text>

            {email && (
              <Text className="text-slate-400 text-sm text-center mb-8">
                Email: {email}
              </Text>
            )}

            {/* Re-subscribe option - requires EXPLICIT action */}
            <View className="bg-white border border-slate-200 rounded-2xl p-5 w-full mb-6">
              <View className="flex-row items-center mb-3">
                <MailPlus size={20} color="#64748B" />
                <Text className="text-slate-700 font-semibold ml-2">Changed your mind?</Text>
              </View>
              <Text className="text-slate-500 text-sm mb-4">
                If you unsubscribed by accident, you can re-subscribe to receive emails again.
              </Text>
              <Pressable
                onPress={handleResubscribe}
                disabled={isProcessing}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: isProcessing ? '#E2E8F0' : primaryColor,
                }}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#94A3B8" />
                ) : (
                  <Text className="text-white font-semibold">Re-subscribe</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={handleGoBack}
              className="flex-row items-center py-3 px-5 active:opacity-60"
            >
              <ArrowLeft size={18} color="#64748B" />
              <Text className="text-slate-500 font-medium ml-2">Return to App</Text>
            </Pressable>
          </Animated.View>
        )}

        {status === 'resubscribed' && (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center max-w-sm">
            <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-6">
              <MailPlus size={48} color="#22C55E" />
            </View>

            <Text className="text-2xl font-bold text-slate-800 text-center mb-3">
              Re-subscribed
            </Text>

            <Text className="text-slate-600 text-center text-base mb-2">
              {message}
            </Text>

            {email && (
              <Text className="text-slate-400 text-sm text-center mb-8">
                Email: {email}
              </Text>
            )}

            <Pressable
              onPress={handleGoBack}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 20,
                backgroundColor: primaryColor,
                borderRadius: 12,
              }}
            >
              <ArrowLeft size={18} color="#fff" />
              <Text className="text-white font-semibold ml-2">Return to App</Text>
            </Pressable>
          </Animated.View>
        )}

        {status === 'error' && (
          <Animated.View entering={FadeInDown.duration(400)} className="items-center max-w-sm">
            <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-6">
              <XCircle size={48} color="#EF4444" />
            </View>

            <Text className="text-2xl font-bold text-slate-800 text-center mb-3">
              Unable to Process
            </Text>

            <Text className="text-slate-600 text-center text-base mb-8">
              {message}
            </Text>

            <Pressable
              onPress={handleGoBack}
              className="flex-row items-center py-3 px-5 bg-slate-200 rounded-xl active:bg-slate-300"
            >
              <ArrowLeft size={18} color="#64748B" />
              <Text className="text-slate-600 font-semibold ml-2">Return to App</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      {/* Compliance footer */}
      <View className="px-6 pb-4">
        <Text className="text-slate-400 text-xs text-center">
          This unsubscribe mechanism complies with the CAN-SPAM Act and Florida electronic communications regulations.
        </Text>
      </View>
    </SafeAreaView>
  );
}
