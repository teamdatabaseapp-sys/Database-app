import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { getTrialStatus, TrialStatus } from '@/lib/trial-service';
import { useHasStaffAccess } from '@/hooks/useStaffInvites';

/**
 * Hook that derives the current user's trial eligibility and access status.
 * Single source of truth for trial/subscription state across the app.
 */
export function useTrialEligibility(): {
  trialStatus: TrialStatus;
  isAuthenticated: boolean;
  shouldShowTrialPaywall: boolean;
  shouldShowCountdownBanner: boolean;
} {
  const user = useStore((s) => s.user);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const { data: hasStaffAccess = false } = useHasStaffAccess(user?.id);

  const trialStatus = useMemo(
    () => getTrialStatus(user, hasStaffAccess),
    [user, hasStaffAccess]
  );

  const shouldShowTrialPaywall = isAuthenticated && !trialStatus.canAccessApp;
  const shouldShowCountdownBanner = isAuthenticated && trialStatus.showCountdownBanner;

  return {
    trialStatus,
    isAuthenticated,
    shouldShowTrialPaywall,
    shouldShowCountdownBanner,
  };
}
