/**
 * BookingPreviewModal - Premium Embedded Booking Page Preview
 *
 * A clean modal that displays the EXACT same booking page as the public URL.
 * Features:
 * - Shows the booking page EXACTLY as it appears when opened via QR/link
 * - The web page has its own header controls (X, Share, Language)
 * - Reliable close handling - fully unmounts when closed
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/i18n/types';
import { useStore } from '@/lib/store';

interface BookingPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  bookingUrl: string;
  businessName: string;
  businessLogoUrl?: string | null;
  primaryColor?: string;
  enabledLocales?: string[];
}

export function BookingPreviewModal({
  visible,
  onClose,
  bookingUrl,
  businessName,
  businessLogoUrl,
  primaryColor = '#0F8F83',
  enabledLocales,
}: BookingPreviewModalProps) {
  const { colors } = useTheme();
  const appLanguage = useStore((s) => s.language) as Language;

  const [isLoading, setIsLoading] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);

  const webViewRef = useRef<WebView>(null);

  // Reset state when modal visibility changes
  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setWebViewKey(prev => prev + 1);
    }
  }, [visible]);

  // Build URL with current app language - show exact same page as public
  const getUrlWithLocale = useCallback((locale: string) => {
    const separator = bookingUrl.includes('?') ? '&' : '?';
    // Only add preview=1 for cache purposes
    // This ensures the preview looks EXACTLY like the public page
    return `${bookingUrl}${separator}lang=${locale}&preview=1`;
  }, [bookingUrl]);

  const currentUrl = getUrlWithLocale(appLanguage || 'en');

  // Handle close from web page's X button via message
  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'close') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }, [onClose]);

  // Handle back button on Android
  const handleRequestClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // Don't render anything when not visible - ensures full unmount
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: primaryColor }]}>
        {/* WebView shows the EXACT same page as public URL */}
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onMessage={handleWebViewMessage}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
            setIsLoading(false);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={true}
          allowsBackForwardNavigationGestures={false}
        />

        {/* Loading overlay */}
        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: primaryColor }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>
              {t('loading', appLanguage)}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
});
