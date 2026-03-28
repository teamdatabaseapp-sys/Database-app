import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QrCode, X, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { SetupHint } from '@/components/SetupHint';
import { HighlightWrapper } from '@/components/HighlightWrapper';
import { BookingLinkQR } from './BookingLinkQR';
import { BookingLanguageSettings } from './BookingLanguageSettings';
import { DEFAULT_BOOKING_PAGE_SETTINGS } from '@/services/bookingPageSettingsService';
import { feedbackSuccess } from '@/lib/SoundManager';

type TabKey = 'qr' | 'language';

interface BookingCombinedSettingsProps {
  visible: boolean;
  onClose: () => void;
  appointmentsEnabled: boolean;
  setupHint?: string;
  /** When provided, switches to this tab every time the modal becomes visible */
  initialTab?: TabKey;
}

export function BookingCombinedSettings({
  visible,
  onClose,
  appointmentsEnabled,
  setupHint,
  initialTab,
}: BookingCombinedSettingsProps) {
  const [activeTab, setActiveTab] = useTabPersistence<TabKey>('booking_settings', 'qr');

  // Switch to the requested tab whenever the modal opens
  useEffect(() => {
    if (visible && initialTab) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  // When the modal closes, cancel any pending auto-close or hide timers so they
  // do not fire against whatever modal happens to be open next.
  useEffect(() => {
    if (!visible) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setSavedVisible(false);
    }
  }, [visible]);
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  // Local "Saved" confirmation overlay (needed because global SaveConfirmationContext
  // renders outside the Modal's native layer and is invisible inside it)
  const [savedVisible, setSavedVisible] = useState(false);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const [highlightY, setHighlightY] = useState(0);

  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] BookingCombinedSettings hint:', setupHint);
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ y: Math.max(0, highlightY - 80), animated: true });
        }
      } catch (e) {
        console.warn('[SetupHint] scroll failed safely', e);
      }
      setHighlightActive(true);
      fadeTimer = setTimeout(() => {
        if (mounted) setHighlightActive(false);
      }, 2500);
    }, 450);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (fadeTimer !== null) clearTimeout(fadeTimer);
    };
  }, [setupHint, highlightY, visible]);

  const getDarkerShade = (hex: string): string => {
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const factor = 0.4;
      return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
    } catch {
      return '#1a1a1a';
    }
  };

  const hideOverlay = useCallback(() => {
    setSavedVisible(false);
  }, []);

  const showLocalSaved = useCallback(() => {
    // Clear any pending timers
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    feedbackSuccess();
    setSavedVisible(true);
    opacity.value = 0;
    scale.value = 0.8;
    requestAnimationFrame(() => {
      opacity.value = withSpring(1, { damping: 15, stiffness: 300 });
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });

    // Fade out after 1000ms
    hideTimeoutRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) runOnJS(hideOverlay)();
      });
      scale.value = withTiming(0.9, { duration: 250 });
    }, 1000);

    // Auto-close the modal after confirmation finishes
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
    }, 1350);
  }, [opacity, scale, hideOverlay, onClose]);

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleTabPress = (tab: TabKey) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <QrCode size={20} color={primaryColor} />
          </View>
          <Text
            style={{ flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, flexWrap: 'wrap' }}
          >
            {t('settingsQrLinkTitle', language)}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Segmented Tab Control */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 4,
            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            borderRadius: 12,
            padding: 4,
          }}
        >
          {([
            { key: 'qr' as TabKey, label: t('bookingLinkAndQr', language) },
            { key: 'language' as TabKey, label: t('bookingPageLanguage', language) },
          ] as const).map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(tab.key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 40,
                backgroundColor: activeTab === tab.key ? colors.card : 'transparent',
                shadowColor: activeTab === tab.key ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: activeTab === tab.key ? 0.08 : 0,
                shadowRadius: 2,
                elevation: activeTab === tab.key ? 2 : 0,
              }}
            >
              <Text
                style={{
                  fontWeight: activeTab === tab.key ? '600' : '500',
                  fontSize: 13,
                  lineHeight: 17,
                  color: activeTab === tab.key ? colors.text : colors.textSecondary,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab: Booking Link & QR */}
        <SetupHint hintKey={setupHint} />
        {activeTab === 'qr' && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <HighlightWrapper active={highlightActive} borderRadius={12} onLayout={(e) => setHighlightY(e.nativeEvent.layout.y)}>
              <BookingLinkQR
                visible={visible}
                onClose={onClose}
                settings={DEFAULT_BOOKING_PAGE_SETTINGS}
                embedded
                onSaveSuccess={showLocalSaved}
              />
              </HighlightWrapper>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* Tab: Page Language */}
        {activeTab === 'language' && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <BookingLanguageSettings
              visible={visible}
              onClose={onClose}
              appointmentsEnabled={appointmentsEnabled}
              embedded
            />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Local "Saved" confirmation overlay — rendered inside this Modal's native layer */}
      {savedVisible && (
        <View style={styles.savedOverlay} pointerEvents="none">
          <Animated.View
            style={[
              animatedOverlayStyle,
              {
                backgroundColor: getDarkerShade(primaryColor),
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 10,
              },
            ]}
          >
            <View
              style={{
                backgroundColor: primaryColor,
                borderRadius: 20,
                padding: 6,
                marginRight: 12,
              }}
            >
              <CheckCircle size={22} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.savedText}>Saved</Text>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  savedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  savedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
