import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nManager } from 'react-native';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { ToastProvider } from '@/lib/ToastContext';
import { SaveConfirmationProvider } from '@/lib/SaveConfirmationContext';
import { useLanguageInitialization } from '@/lib/useLanguage';
import { preloadSounds } from '@/lib/SoundManager';
import { SupabaseAuthProvider } from '@/hooks/useSupabaseAuth';
import { PromotionSync } from '@/components/PromotionSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isDark } = useTheme();
  useLanguageInitialization();

  // Hide splash screen on first render — language is always ready (static imports)
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Force LTR layout globally - RTL is disabled
  useEffect(() => {
    if (I18nManager.isRTL) {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }
  }, []);

  // Preload sounds on app start for faster playback
  useEffect(() => {
    preloadSounds().catch((err) => {
      console.log('[SoundManager] Preload error:', err);
    });
  }, []);

  return (
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="unsubscribe"
          options={{
            title: 'Unsubscribe',
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="book/[slug]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="business-setup"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="auth/callback"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack>
    </NavigationThemeProvider>
  );
}



export default function RootLayout() {
  return (
    <ErrorBoundary flowName="App">
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SupabaseAuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <SaveConfirmationProvider>
                  <PromotionSync />
                  <ErrorBoundary flowName="Navigation">
                    <RootLayoutNav />
                  </ErrorBoundary>
                </SaveConfirmationProvider>
              </ToastProvider>
            </ThemeProvider>
          </SupabaseAuthProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
