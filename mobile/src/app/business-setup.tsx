/**
 * BusinessSetupRoute
 *
 * Expo Router Stack screen (modal presentation). Renders the Business Setup
 * hub and, when a step is tapped, opens the REAL existing modal screen directly
 * on top — no routing through /(tabs)/, no global params, no intermediate screens.
 *
 * Navigation is DIRECT:
 *   Tap step → matching modal opens immediately over this screen
 *   Close modal → user returns to this hub
 *
 * Contextual hints are LOCAL: each modal receives `setupHint` and renders
 * its own <SetupHint /> component internally.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Modal } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '@/lib/store';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BusinessSetupHubScreen } from '@/components/BusinessSetupHubScreen';
import { ServicesProductsScreen } from '@/components/ServicesProductsScreen';
import { StoresStaffCalendarHub } from '@/components/StoresStaffCalendarHub';
import { BookingCombinedSettings } from '@/components/BookingCombinedSettings';
import { BusinessBrandingSettings } from '@/components/BusinessBrandingSettings';
import { LoyaltyProgramScreen } from '@/components/LoyaltyProgramScreen';
import { MembershipProgramScreen } from '@/components/MembershipProgramScreen';
import { GiftCardScreen } from '@/components/GiftCardScreen';
import { ClientEditScreen } from '@/components/ClientEditScreen';
import { TeamAccessPermissionsScreen } from '@/components/TeamAccessPermissionsScreen';

// Maps each setup step ID to the modal section it should open.
// All targets are existing, registered components — no new routes.
const STEP_TO_SECTION: Record<string, string> = {
  // Identity
  businessDetails:     'branding',
  country:             'branding',
  // Locations & Hours
  primaryStore:        'stores',
  hours:               'stores',
  additionalLocations: 'stores',
  // Services & Team
  services:            'services',
  staff:               'services',
  serviceAssign:       'services',
  staffCalendar:       'staffCalendar',
  // Booking
  bookingLink:         'booking',
  bookingBranding:     'booking',
  bookingLanguage:     'bookingLanguage',
  // Brand
  logo:                'branding',
  brandColors:         'branding',
  businessLinks:       'qrLinks',
  // Programs
  loyalty:             'loyalty',
  membership:          'membership',
  giftCards:           'giftCards',
  // First Client
  firstClient:         'addClient',
  // Team Access
  teamAccess:          'teamAccess',
  // ── Legacy step IDs (kept for any stale references) ──────────────────────
  businessProfile:     'branding',
  locationHours:       'stores',
  servicesTeam:        'services',
  onlineBooking:       'booking',
  brandPresence:       'branding',
  revenuePrograms:     'loyalty',
  businessName:        'branding',
  address:             'branding',
  phone:               'branding',
};

type OpenSection =
  | 'services'
  | 'stores'
  | 'staffCalendar'
  | 'booking'
  | 'bookingLanguage'
  | 'branding'
  | 'loyalty'
  | 'membership'
  | 'giftCards'
  | 'addClient'
  | 'qrLinks'
  | 'teamAccess'
  | null;

export default function BusinessSetupRoute() {
  const calendarEnabled = useStore((s) => s.featureToggles.calendarEnabled);

  // Local state — which modal is currently open and what hint to show.
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  const [hintKey, setHintKey] = useState<string | undefined>(undefined);

  // ── Transition guard ────────────────────────────────────────────────────
  const transitionLockRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const close = useCallback(() => {
    console.log('[BusinessSetup] close() — acquiring transition lock');
    setOpenSection(null);
    setHintKey(undefined);
    transitionLockRef.current = true;
    if (transitionTimerRef.current !== null) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      transitionLockRef.current = false;
      transitionTimerRef.current = null;
      console.log('[BusinessSetup] transition lock released');
    }, 500);
  }, []);

  const handleStepPress = useCallback((stepId: string) => {
    console.log('[BusinessSetup] handleStepPress:', stepId, '| locked:', transitionLockRef.current);

    if (transitionLockRef.current) {
      console.log('[BusinessSetup] handleStepPress blocked — transition in progress');
      return;
    }

    const section = STEP_TO_SECTION[stepId];

    if (stepId === 'businessType') {
      console.log('[BusinessSetup] navigating back (businessType)');
      router.back();
      return;
    }

    if (!section) {
      console.log('[BusinessSetup] navigating back — unknown stepId:', stepId);
      router.back();
      return;
    }

    console.log('[BusinessSetup] opening section:', section, 'for step:', stepId);
    setHintKey(stepId);
    setOpenSection(section as OpenSection);
  }, []);

  return (
    <ErrorBoundary flowName="Business Setup">
      <>
        <BusinessSetupHubScreen
          onBack={() => router.back()}
          onNavigateToStep={handleStepPress}
        />

        {/* ── Direct modal targets ────────────────────────────────────────── */}

        {/* Services & Products */}
        <ServicesProductsScreen
          visible={openSection === 'services'}
          onClose={close}
          setupHint={openSection === 'services' ? hintKey : undefined}
        />

        {/* Stores, Staff & Calendar */}
        <StoresStaffCalendarHub
          visible={openSection === 'stores' || openSection === 'staffCalendar'}
          onClose={close}
          setupHint={
            openSection === 'stores' || openSection === 'staffCalendar' ? hintKey : undefined
          }
        />

        {/* Booking Link & Branding / Business Links / Booking Language */}
        <BookingCombinedSettings
          visible={openSection === 'booking' || openSection === 'qrLinks' || openSection === 'bookingLanguage'}
          onClose={close}
          appointmentsEnabled={calendarEnabled}
          setupHint={
            openSection === 'booking' || openSection === 'qrLinks' || openSection === 'bookingLanguage'
              ? hintKey
              : undefined
          }
          initialTab={
            openSection === 'qrLinks'
              ? 'qr'
              : openSection === 'bookingLanguage'
              ? 'language'
              : undefined
          }
        />

        {/* Business Branding */}
        <BusinessBrandingSettings
          visible={openSection === 'branding'}
          onClose={close}
          setupHint={openSection === 'branding' ? hintKey : undefined}
        />

        {/* Loyalty */}
        <LoyaltyProgramScreen
          visible={openSection === 'loyalty'}
          onClose={close}
          setupHint={openSection === 'loyalty' ? hintKey : undefined}
        />

        {/* Membership */}
        <MembershipProgramScreen
          visible={openSection === 'membership'}
          onClose={close}
          setupHint={openSection === 'membership' ? hintKey : undefined}
        />

        {/* Gift Cards */}
        <GiftCardScreen
          visible={openSection === 'giftCards'}
          onClose={close}
          setupHint={openSection === 'giftCards' ? hintKey : undefined}
        />

        {/* Add First Client */}
        <ClientEditScreen
          visible={openSection === 'addClient'}
          onBack={close}
          onSave={close}
          onSaveWithId={() => close()}
          setupHint={openSection === 'addClient' ? hintKey : undefined}
        />

        {/* Team Access & Permissions */}
        <Modal
          visible={openSection === 'teamAccess'}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={close}
        >
          <TeamAccessPermissionsScreen
            onClose={close}
            setupHint={openSection === 'teamAccess' ? hintKey : undefined}
          />
        </Modal>
      </>
    </ErrorBoundary>
  );
}
