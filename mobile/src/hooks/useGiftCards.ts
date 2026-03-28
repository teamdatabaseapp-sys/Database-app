import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import { useStores } from '@/hooks/useStores';
import {
  fetchGiftCards,
  fetchGiftCardById,
  fetchGiftCardByCode,
  fetchClientGiftCards,
  issueGiftCard,
  updateGiftCard,
  deleteGiftCard,
  redeemGiftCardValue,
  redeemGiftCardService,
  fetchGiftCardTransactions,
  fetchClientGiftCardTransactions,
  fetchClientGiftCardTransactionsByCards,
  fetchGiftCardRedemptionByAppointment,
} from '@/services/giftCardService';
import type { GiftCard, GiftCardType, GiftCardService, GiftCardStatus } from '@/lib/types';
import { notifyTransactionalEmail } from '@/services/transactionalEmailService';
import { getSupabase } from '@/lib/supabaseClient';

// Query keys
const GIFT_CARDS_KEY = 'gift_cards';
const GIFT_CARD_KEY = 'gift_card';
const GIFT_CARD_TRANSACTIONS_KEY = 'gift_card_transactions';
const CLIENT_GIFT_CARDS_KEY = 'client_gift_cards';

/**
 * Hook to fetch all gift cards for the current business
 */
export function useGiftCards() {
  const { businessId, ownerId } = useBusiness();
  // gift_cards.user_id = auth.uid() (owner), not the business table ID
  const userId = ownerId;

  return useQuery({
    queryKey: [GIFT_CARDS_KEY, userId],
    queryFn: () => fetchGiftCards(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single gift card by ID
 */
export function useGiftCard(giftCardId: string | undefined) {
  return useQuery({
    queryKey: [GIFT_CARD_KEY, giftCardId],
    queryFn: () => fetchGiftCardById(giftCardId!),
    enabled: !!giftCardId,
  });
}

/**
 * Hook to fetch gift cards for a specific client
 */
export function useClientGiftCards(clientId: string | undefined) {
  const { businessId, ownerId } = useBusiness();
  const userId = ownerId;

  return useQuery({
    queryKey: [CLIENT_GIFT_CARDS_KEY, clientId, userId],
    queryFn: () => fetchClientGiftCards(clientId!, userId!),
    enabled: !!clientId && !!userId,
    staleTime: 30 * 1000, // 30s — catches usedQuantity changes without hammering on every render
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch gift card transactions
 */
export function useGiftCardTransactions(giftCardId: string | undefined) {
  return useQuery({
    queryKey: [GIFT_CARD_TRANSACTIONS_KEY, giftCardId],
    queryFn: () => fetchGiftCardTransactions(giftCardId!),
    enabled: !!giftCardId,
  });
}

/**
 * Hook to fetch client's gift card transactions (via client_id on transaction)
 */
export function useClientGiftCardTransactions(clientId: string | undefined) {
  const { businessId, ownerId } = useBusiness();
  const userId = ownerId;

  return useQuery({
    queryKey: [GIFT_CARD_TRANSACTIONS_KEY, 'client', clientId, userId],
    queryFn: () => fetchClientGiftCardTransactions(clientId!, userId!),
    enabled: !!clientId && !!userId,
  });
}

/**
 * Hook to fetch all transactions for a client's gift cards (by gift_card_id).
 * More reliable than querying by client_id alone — captures purchase events too.
 */
export function useClientGiftCardTransactionsByCards(clientId: string | undefined) {
  const { ownerId } = useBusiness();
  const userId = ownerId;

  return useQuery({
    queryKey: [GIFT_CARD_TRANSACTIONS_KEY, 'client_cards', clientId, userId],
    queryFn: () => fetchClientGiftCardTransactionsByCards(clientId!, userId!),
    enabled: !!clientId && !!userId,
    staleTime: 30 * 1000, // 30s — catches new redemptions quickly without over-fetching
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch the redemption transaction for a specific appointment.
 * Queries by appointment_id alone so it works even without gift_card_id.
 * Used by View Appointment to derive the real deducted amount.
 */
export function useGiftCardRedemptionByAppointment(
  giftCardId: string | undefined | null,
  appointmentId: string | undefined | null
) {
  return useQuery({
    queryKey: [GIFT_CARD_TRANSACTIONS_KEY, 'redemption', giftCardId, appointmentId],
    queryFn: () => fetchGiftCardRedemptionByAppointment(giftCardId, appointmentId!),
    enabled: !!appointmentId,
    staleTime: 2 * 60 * 1000, // 2 min — redemption records are immutable once created
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to look up a gift card by code
 */
export function useLookupGiftCard() {
  const { ownerId } = useBusiness();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!ownerId) throw new Error('Business not found');
      return fetchGiftCardByCode(code, ownerId);
    },
  });
}

/**
 * Hook to create a new gift card via backend endpoint (bypasses RLS safely)
 */
export function useCreateGiftCard() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: GiftCardType;
      originalValue?: number;
      currency?: string;
      services?: GiftCardService[];
      recipientName?: string;
      recipientEmail?: string;
      recipientPhone?: string;
      personalMessage?: string;
      clientId?: string;
      expiresAt?: Date;
      designColor?: string;
      storeId?: string;
    }) => {
      if (!businessId) throw new Error('Business not found');
      // Get current session token for backend auth
      const { data: sessionData } = await getSupabase().auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      return issueGiftCard(businessId, token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GIFT_CARDS_KEY] });
    },
  });
}

/**
 * Hook to update a gift card
 */
export function useUpdateGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        status: GiftCardStatus;
        currentBalance: number;
        services: GiftCardService[];
        clientId: string | null;
        recipientName: string;
        recipientEmail: string;
        recipientPhone: string;
        personalMessage: string;
        firstUsedAt: Date;
        fullyUsedAt: Date;
      }>;
    }) => {
      return updateGiftCard(id, updates);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [GIFT_CARDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [GIFT_CARD_KEY, data.id] });
      if (data.clientId) {
        queryClient.invalidateQueries({ queryKey: [CLIENT_GIFT_CARDS_KEY, data.clientId] });
      }
    },
  });
}

/**
 * Hook to delete a gift card
 */
export function useDeleteGiftCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return deleteGiftCard(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GIFT_CARDS_KEY] });
    },
  });
}

/**
 * Hook to redeem value from a gift card
 */
export function useRedeemGiftCardValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      giftCardId,
      amount,
      context,
    }: {
      giftCardId: string;
      amount: number;
      context: {
        clientId?: string;
        appointmentId?: string;
        visitId?: string;
        notes?: string;
        appointmentDate?: string;
        serviceName?: string;
      };
    }) => {
      return redeemGiftCardValue(giftCardId, amount, context);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [GIFT_CARDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [GIFT_CARD_KEY, data.giftCard.id] });
      queryClient.invalidateQueries({ queryKey: [GIFT_CARD_TRANSACTIONS_KEY, data.giftCard.id] });
      if (data.giftCard.clientId) {
        queryClient.invalidateQueries({ queryKey: [CLIENT_GIFT_CARDS_KEY, data.giftCard.clientId] });
        // Fire-and-forget: gift_card_redeemed email with exact deducted amount and new balance
        notifyTransactionalEmail({
          business_id: data.giftCard.userId,
          client_id: data.giftCard.clientId,
          event_type: 'gift_card_redeemed',
          gift_card_code: data.giftCard.code,
          gift_card_type: data.giftCard.type,
          gift_card_value: data.transaction.amount,   // exact deducted amount from transaction record
          gift_card_balance: data.giftCard.currentBalance, // fresh post-debit balance
          currency_code: data.giftCard.currency,
          appointment_date: variables.context.appointmentDate,
          appointment_time: variables.context.serviceName,
        });
      }
    },
  });
}

/**
 * Hook to redeem a service from a gift card
 */
export function useRedeemGiftCardService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      giftCardId,
      serviceId,
      quantity,
      context,
    }: {
      giftCardId: string;
      serviceId: string;
      quantity?: number;
      context: {
        clientId?: string;
        appointmentId?: string;
        visitId?: string;
        notes?: string;
      };
    }) => {
      return redeemGiftCardService(giftCardId, serviceId, quantity || 1, context);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [GIFT_CARDS_KEY] });
      queryClient.invalidateQueries({ queryKey: [GIFT_CARD_KEY, data.giftCard.id] });
      queryClient.invalidateQueries({ queryKey: [GIFT_CARD_TRANSACTIONS_KEY, data.giftCard.id] });
      if (data.giftCard.clientId) {
        queryClient.invalidateQueries({ queryKey: [CLIENT_GIFT_CARDS_KEY, data.giftCard.clientId] });
        // Fire-and-forget: gift_card_redeemed email (service type)
        const serviceName = data.giftCard.services
          ?.find((s) => s.serviceId === data.transaction.serviceId)
          ?.serviceName;
        notifyTransactionalEmail({
          business_id: data.giftCard.userId,
          client_id: data.giftCard.clientId,
          event_type: 'gift_card_redeemed',
          gift_card_code: data.giftCard.code,
          gift_card_type: data.giftCard.type,
          gift_card_service_name: serviceName,
          currency_code: data.giftCard.currency,
        });
      }
    },
  });
}

/**
 * Hook to get active gift cards count for dashboard
 */
export function useActiveGiftCardsCount() {
  const { data: giftCards } = useGiftCards();

  const activeCount = giftCards?.filter((gc) => gc.status === 'active').length || 0;
  const totalValue = giftCards
    ?.filter((gc) => gc.status === 'active' && gc.type === 'value')
    .reduce((sum, gc) => sum + (gc.currentBalance || 0), 0) || 0;

  return { activeCount, totalValue };
}
