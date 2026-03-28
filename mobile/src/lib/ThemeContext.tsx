import React, { createContext, useContext, useEffect } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { useStore } from './store';

// Theme colors
export const lightTheme = {
  // Backgrounds
  background: '#F8FAFC',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#F1F5F9',
  card: '#FFFFFF',
  modal: '#FFFFFF',

  // Text
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Status
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Inputs
  inputBackground: '#FFFFFF',
  inputBorder: '#E2E8F0',
  inputText: '#1E293B',
  inputPlaceholder: '#94A3B8',

  // Specific elements
  tabBarBackground: '#FFFFFF',
  headerBackground: '#FFFFFF',
};

export const darkTheme = {
  // Backgrounds - Using specified dark mode colors
  background: '#0F1115',        // Deep dark / near-black as specified
  backgroundSecondary: '#1A1D23', // Dark gray for cards/surfaces
  backgroundTertiary: '#252932', // Slightly lighter for tertiary elements
  card: '#1A1D23',              // Dark gray for cards
  modal: '#1A1D23',             // Dark gray for modals

  // Text - Using specified colors
  text: '#EDEDED',              // Soft white as specified
  textSecondary: '#9CA3AF',     // Muted gray as specified
  textTertiary: '#6B7280',      // Even more muted for tertiary
  textInverse: '#0F1115',       // Dark text for light backgrounds

  // Borders
  border: '#2D3139',            // Subtle dark border
  borderLight: '#1A1D23',       // Very subtle border

  // Status - Same brand colors, optimized for dark backgrounds
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Inputs
  inputBackground: '#252932',
  inputBorder: '#3D4351',
  inputText: '#EDEDED',
  inputPlaceholder: '#6B7280',

  // Specific elements
  tabBarBackground: '#1A1D23',
  headerBackground: '#1A1D23',
};

export type Theme = typeof lightTheme;

// ─── Shared Typography Scale ───────────────────────────────────────────────
// Single source of truth for font sizes across the entire app.
// All screens must reference these tokens instead of hardcoding sizes.
export const typography = {
  pageTitle:      18,   // Modal / page header bar titles
  sectionTitle:   16,   // Section group headers (e.g. "Reward Tiers", "Membership Plans", "Active Promotions")
  cardTitle:      15,   // Individual item titles (reward name, plan name, promo name, client name)
  label:          14,   // Form labels, list item primary text, standard body
  body:           14,   // Body text, descriptions in lists
  secondary:      13,   // Helper text, subtitles, secondary descriptions
  caption:        12,   // Uppercase section dividers, small labels, badge text
  micro:          11,   // Status badges, tags, very small indicators
  input:          15,   // TextInput fields
  button:         15,   // Primary action button labels
  buttonSmall:    13,   // Secondary / small button labels
  statLarge:      24,   // Large analytics/stat numbers
  statMedium:     20,   // Medium analytics numbers
} as const;
// ──────────────────────────────────────────────────────────────────────────

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colors: Theme;
  primaryColor: string;
  buttonColor: string;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  colors: lightTheme,
  primaryColor: '#0D9488',
  buttonColor: '#0D9488',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const darkMode = useStore((s) => s.themeSettings.darkMode);
  const primaryColor = useStore((s) => s.themeSettings.primaryColor);
  const buttonColor = useStore((s) => s.themeSettings.buttonColor);
  const deviceColorScheme = useDeviceColorScheme();

  // Use user preference, or fall back to device preference
  const isDark = darkMode;
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors: theme, primaryColor, buttonColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper hook for conditional dark/light styles
export function useThemeStyles<T>(lightStyle: T, darkStyle: T): T {
  const { isDark } = useTheme();
  return isDark ? darkStyle : lightStyle;
}
