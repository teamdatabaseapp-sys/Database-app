/**
 * Membership Program Hooks
 * React Query hooks for membership data management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import {
  MembershipPlan,
  MembershipBenefit,
  ClientMembership,
  MembershipPayment,
  MembershipCreditTransaction,
  MembershipBenefitUsage,
  MembershipSettings,
  MembershipStatus,
  MembershipPaymentMethod,
} from '@/lib/types';
import {
  getMembershipSettings,
  updateMembershipSettings,
  getMembershipPlans,
  getMembershipPlan,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
  getAllMemberships,
  getClientMembership,
  getClientMembershipHistory,
  enrollClientInMembership,
  markPaymentReceived,
  cancelMembership,
  pauseMembership,
  resumeMembership,
  updateMembershipStatus,
  getMembershipCreditTransactions,
  redeemMembershipCredits,
  getBenefitUsageHistory,
  redeemFreeService,
  getMembershipAnalytics,
  getMembershipPayments,
  getAllMembershipPayments,
  calculateMembershipBenefits,
  fireMembershipActivationEmail,
} from '@/services/membershipService';

// ============================================
// Query Keys
// ============================================

export const membershipKeys = {
  all: ['memberships'] as const,
  settings: (businessId: string) => [...membershipKeys.all, 'settings', businessId] as const,
  plans: (businessId: string) => [...membershipKeys.all, 'plans', businessId] as const,
  plan: (planId: string) => [...membershipKeys.all, 'plan', planId] as const,
  list: (businessId: string) => [...membershipKeys.all, 'list', businessId] as const,
  client: (clientId: string) => [...membershipKeys.all, 'client', clientId] as const,
  clientHistory: (clientId: string) => [...membershipKeys.all, 'clientHistory', clientId] as const,
  credits: (membershipId: string) => [...membershipKeys.all, 'credits', membershipId] as const,
  benefitUsage: (membershipId: string) => [...membershipKeys.all, 'benefitUsage', membershipId] as const,
  payments: (membershipId: string) => [...membershipKeys.all, 'payments', membershipId] as const,
  allPayments: (businessId: string) => [...membershipKeys.all, 'allPayments', businessId] as const,
  analytics: (businessId: string) => [...membershipKeys.all, 'analytics', businessId] as const,
  benefits: (clientId: string) => [...membershipKeys.all, 'benefits', clientId] as const,
};

// ============================================
// Settings Hooks
// ============================================

/**
 * Get membership settings for the current business
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useMembershipSettings() {
  const { ownerId } = useBusiness();

  return useQuery({
    queryKey: membershipKeys.settings(ownerId || ''),
    queryFn: () => getMembershipSettings(ownerId!),
    enabled: !!ownerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Update membership settings
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useUpdateMembershipSettings() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: (settings: Partial<MembershipSettings>) =>
      updateMembershipSettings(ownerId!, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.settings(ownerId || '') });
    },
  });
}

// ============================================
// Plan Hooks
// ============================================

/**
 * Get all membership plans for the current business
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useMembershipPlans() {
  const { ownerId } = useBusiness();

  return useQuery({
    queryKey: membershipKeys.plans(ownerId || ''),
    queryFn: () => getMembershipPlans(ownerId!),
    enabled: !!ownerId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get a specific membership plan
 */
export function useMembershipPlan(planId: string | undefined) {
  return useQuery({
    queryKey: membershipKeys.plan(planId || ''),
    queryFn: () => getMembershipPlan(planId!),
    enabled: !!planId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new membership plan
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useCreateMembershipPlan() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: (plan: Omit<MembershipPlan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
      createMembershipPlan(ownerId!, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.plans(ownerId || '') });
    },
  });
}

/**
 * Update a membership plan
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useUpdateMembershipPlan() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({ planId, updates }: { planId: string; updates: Partial<MembershipPlan> }) =>
      updateMembershipPlan(planId, updates),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.plans(ownerId || '') });
      queryClient.invalidateQueries({ queryKey: membershipKeys.plan(planId) });
    },
  });
}

/**
 * Delete a membership plan
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useDeleteMembershipPlan() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: (planId: string) => deleteMembershipPlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.plans(ownerId || '') });
    },
  });
}

// ============================================
// Membership Hooks
// ============================================

/**
 * Get all memberships for the current business
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useAllMemberships() {
  const { ownerId } = useBusiness();

  return useQuery({
    queryKey: membershipKeys.list(ownerId || ''),
    queryFn: () => getAllMemberships(ownerId!),
    enabled: !!ownerId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get active membership for a specific client
 */
export function useClientMembership(clientId: string | undefined) {
  return useQuery({
    queryKey: membershipKeys.client(clientId || ''),
    queryFn: () => getClientMembership(clientId!),
    enabled: !!clientId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Get membership history for a client
 */
export function useClientMembershipHistory(clientId: string | undefined) {
  return useQuery({
    queryKey: membershipKeys.clientHistory(clientId || ''),
    queryFn: () => getClientMembershipHistory(clientId!),
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Enroll a client in a membership
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useEnrollClientInMembership() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({
      clientId,
      planId,
      enrollment,
    }: {
      clientId: string;
      planId: string;
      enrollment: {
        startDate: Date;
        nextRenewalDate: Date;
        paymentMethod: MembershipPaymentMethod;
        paymentNotes?: string;
        notes?: string;
        initialCreditBalance?: number;
      };
    }) => enrollClientInMembership(ownerId!, clientId, planId, enrollment),
    onSuccess: (newMembership, { clientId, planId, enrollment }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.clientHistory(clientId) });
      // Fire activation email (fire-and-forget)
      if (ownerId) {
        getMembershipPlan(planId).then((plan) => {
          fireMembershipActivationEmail(
            ownerId,
            clientId,
            plan?.name ?? 'Membership',
            enrollment.nextRenewalDate
          );
        }).catch(() => {/* silent */});
      }
    },
  });
}

/**
 * Mark payment received for a membership
 * Note: Uses ownerId (auth.uid) for query invalidation consistency
 */
export function useMarkPaymentReceived() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({
      membershipId,
      payment,
    }: {
      membershipId: string;
      clientId: string;
      payment: {
        amount: number;
        currency: string;
        paymentMethod: MembershipPaymentMethod;
        paymentDate: Date;
        periodStart: Date;
        periodEnd: Date;
        notes?: string;
        receivedBy?: string;
      };
    }) => markPaymentReceived(membershipId, payment),
    onSuccess: (_, { membershipId, clientId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.list(ownerId || '') });
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.payments(membershipId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.allPayments(ownerId || '') });
      queryClient.invalidateQueries({ queryKey: membershipKeys.credits(membershipId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.analytics(ownerId || '') });
    },
  });
}

/**
 * Cancel a membership
 * Note: Uses ownerId (auth.uid) for query invalidation consistency
 */
export function useCancelMembership() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({ membershipId, reason }: { membershipId: string; clientId: string; reason?: string }) =>
      cancelMembership(membershipId, reason),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.list(ownerId || '') });
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.clientHistory(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.analytics(ownerId || '') });
    },
  });
}

/**
 * Pause a membership
 * Note: Uses ownerId (auth.uid) for query invalidation consistency
 */
export function usePauseMembership() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({
      membershipId,
      pauseEndDate,
    }: {
      membershipId: string;
      clientId: string;
      pauseEndDate?: Date;
    }) => pauseMembership(membershipId, pauseEndDate),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.list(ownerId || '') });
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.analytics(ownerId || '') });
    },
  });
}

/**
 * Resume a paused membership
 * Note: Uses ownerId (auth.uid) for query invalidation consistency
 */
export function useResumeMembership() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({ membershipId }: { membershipId: string; clientId: string }) =>
      resumeMembership(membershipId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.list(ownerId || '') });
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.analytics(ownerId || '') });
    },
  });
}

/**
 * Update membership status
 * Note: Uses ownerId (auth.uid) for query invalidation consistency
 */
export function useUpdateMembershipStatus() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({
      membershipId,
      status,
    }: {
      membershipId: string;
      clientId: string;
      status: MembershipStatus;
    }) => updateMembershipStatus(membershipId, status),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.list(ownerId || '') });
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.analytics(ownerId || '') });
    },
  });
}

// ============================================
// Credit Hooks
// ============================================

/**
 * Get credit transactions for a membership
 */
export function useMembershipCredits(membershipId: string | undefined) {
  return useQuery({
    queryKey: membershipKeys.credits(membershipId || ''),
    queryFn: () => getMembershipCreditTransactions(membershipId!),
    enabled: !!membershipId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Use membership credits
 * Note: Uses ownerId (auth.uid) for query invalidation consistency
 */
export function useUseMembershipCredits() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({
      membershipId,
      amount,
      context,
    }: {
      membershipId: string;
      clientId: string;
      amount: number;
      context: {
        reason: string;
        appointmentId?: string;
        visitId?: string;
        serviceId?: string;
        serviceName?: string;
      };
    }) => redeemMembershipCredits(membershipId, amount, context),
    onSuccess: (_, { membershipId, clientId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.credits(membershipId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.benefits(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.analytics(ownerId || '') });
    },
  });
}

// ============================================
// Benefit Usage Hooks
// ============================================

/**
 * Get benefit usage history for a membership
 */
export function useBenefitUsageHistory(membershipId: string | undefined) {
  return useQuery({
    queryKey: membershipKeys.benefitUsage(membershipId || ''),
    queryFn: () => getBenefitUsageHistory(membershipId!),
    enabled: !!membershipId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Use a free service benefit
 * Note: Uses ownerId (auth.uid) for query invalidation consistency
 */
export function useUseFreeService() {
  const queryClient = useQueryClient();
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: ({
      membershipId,
      serviceId,
      serviceName,
      context,
    }: {
      membershipId: string;
      clientId: string;
      serviceId: string;
      serviceName: string;
      context?: { appointmentId?: string; visitId?: string };
    }) => redeemFreeService(membershipId, serviceId, serviceName, context),
    onSuccess: (_, { membershipId, clientId }) => {
      queryClient.invalidateQueries({ queryKey: membershipKeys.client(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.benefitUsage(membershipId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.benefits(clientId) });
      queryClient.invalidateQueries({ queryKey: membershipKeys.analytics(ownerId || '') });
    },
  });
}

// ============================================
// Analytics Hooks
// ============================================

/**
 * Get membership analytics for the current business
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useMembershipAnalytics() {
  const { ownerId } = useBusiness();

  return useQuery({
    queryKey: membershipKeys.analytics(ownerId || ''),
    queryFn: () => getMembershipAnalytics(ownerId!),
    enabled: !!ownerId,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Payment Hooks
// ============================================

/**
 * Get payment history for a membership
 */
export function useMembershipPayments(membershipId: string | undefined) {
  return useQuery({
    queryKey: membershipKeys.payments(membershipId || ''),
    queryFn: () => getMembershipPayments(membershipId!),
    enabled: !!membershipId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get all payments for the current business
 * Note: Uses ownerId (auth.uid) because RLS policy checks auth.uid() = user_id
 */
export function useAllMembershipPayments() {
  const { ownerId } = useBusiness();

  return useQuery({
    queryKey: membershipKeys.allPayments(ownerId || ''),
    queryFn: () => getAllMembershipPayments(ownerId!),
    enabled: !!ownerId,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================
// Benefits Calculation Hook
// ============================================

/**
 * Calculate applicable membership benefits for checkout
 */
export function useCalculateMembershipBenefits(
  clientId: string | undefined,
  services: { id: string; name: string; price: number }[],
  totalAmount: number
) {
  return useQuery({
    queryKey: [...membershipKeys.benefits(clientId || ''), services, totalAmount],
    queryFn: () => calculateMembershipBenefits(clientId!, services, totalAmount),
    enabled: !!clientId && services.length > 0,
    staleTime: 30 * 1000, // 30 seconds - needs to be fresh for checkout
  });
}
