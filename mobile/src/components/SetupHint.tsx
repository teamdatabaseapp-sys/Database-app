/**
 * SetupHint
 *
 * Lightweight contextual guidance banner shown inside target screens when
 * navigated to from the Business Setup hub.
 *
 * - Non-blocking
 * - Dismissible (local useState, NOT persisted)
 * - Theme-aware (primaryColor + dark/light)
 * - Stripe-inspired minimal design
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Info, X } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { TranslationKey } from '@/lib/i18n/types';

// ─── Hint copy map (English fallback for keys without a translation key) ──────

const HINT_COPY: Record<string, string> = {
  businessDetails:     'Confirm your business name and add your address and phone number. Clients see these details on your booking page.',
  businessProfile:     'Provide your business name, address, phone number, and country to complete your business identity.',
  locationHours:       'Configure your primary location and set your business hours to start accepting appointments.',
  servicesTeam:        'Add the services you offer, build your team, and assign services to each staff member.',
  onlineBooking:       'Activate your booking link and customise your client-facing booking page branding.',
  brandPresence:       'Upload your logo, set your brand colours, and add your website and social links.',
  revenuePrograms:     'Set up loyalty rewards, membership plans, and gift cards to grow recurring revenue.',
  businessName:        'Enter your business name exactly as you want clients to see it.',
  address:             'Add your business address for accurate client-facing profiles and booking.',
  phone:               'Provide a contact number clients can use to reach you.',
  country:             'Select your country to enable compliant regional settings.',
  primaryStore:        'Configure your primary location — address, name, and opening hours.',
  hours:               'Define the days and hours your business is open for client bookings.',
  additionalLocations: 'Add further locations to expand your service coverage.',
  stores:              'Configure your store locations, business hours, and staff assignments.',
  services:            'Add the services and products you offer — include name, duration where applicable, and pricing.',
  staff:               'Add your team members and configure their working availability.',
  serviceAssign:       'Link services to staff members to enable accurate client booking.',
  bookingLink:         'Activate your booking page so clients can self-schedule online.',
  bookingBranding:     'Customise your booking page appearance to reflect your brand.',
  booking:             'Set up your booking link and brand your client-facing booking experience.',
  logo:                'Upload your business logo for use on all client-facing materials.',
  brandColors:         'Choose your brand colour — it will apply consistently across the platform.',
  branding:            'Upload your logo and set your brand colour for a consistent identity.',
  loyalty:             'Set up a loyalty programme to retain and reward your returning clients.',
  membership:          'Create membership plans to build recurring client relationships.',
  giftCards:           'Enable gift cards as a revenue stream and client acquisition tool.',
};

// ─── Map of hint keys that have a typed translation key ───────────────────────

const HINT_TRANSLATION_KEYS: Partial<Record<string, TranslationKey>> = {
  firstClient:      'setupHintFirstClient',
  businessLinks:    'setupHintBusinessLinks',
  staffCalendar:    'setupHintStaffCalendar',
  teamAccess:       'setupHintTeamAccess',
  bookingLanguage:  'setupHintBookingLanguage',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface SetupHintProps {
  /** Setup step key — maps to hint copy */
  hintKey?: string;
  /** Optional override text (bypasses key lookup) */
  text?: string;
  /** Additional vertical margin above the banner */
  topMargin?: number;
}

export function SetupHint({ hintKey, text, topMargin = 0 }: SetupHintProps) {
  const [dismissed, setDismissed] = useState(false);
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  // Prefer a typed translation key; fall back to English-only HINT_COPY map
  const translationKey = hintKey ? HINT_TRANSLATION_KEYS[hintKey] : undefined;
  const translated = translationKey ? t(translationKey, language) : undefined;
  const message = text ?? translated ?? (hintKey ? HINT_COPY[hintKey] : undefined);
  if (!message || dismissed) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(280).springify()}
      exiting={FadeOutUp.duration(200)}
      style={{
        marginHorizontal: 16,
        marginTop: topMargin + 12,
        marginBottom: 4,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: isDark ? `${primaryColor}1A` : `${primaryColor}0F`,
        borderWidth: 1,
        borderColor: isDark ? `${primaryColor}35` : `${primaryColor}25`,
      }}
    >
      <Info
        size={15}
        color={primaryColor}
        strokeWidth={2}
        style={{ marginTop: 1, flexShrink: 0 }}
      />
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 19,
          color: isDark ? `${primaryColor}EE` : primaryColor,
          fontWeight: '500',
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={() => setDismissed(true)}
        hitSlop={10}
        style={{ flexShrink: 0, marginTop: 1, opacity: 0.65 }}
      >
        <X size={13} color={primaryColor} strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}
