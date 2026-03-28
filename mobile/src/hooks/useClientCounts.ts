/**
 * useClientCounts Hook
 *
 * Provides instant Total Clients and New This Month counts for the Dashboard KPI cards.
 *
 * Strategy:
 *  1. On first render — synchronously read last-known counts from AsyncStorage (zero latency).
 *  2. As soon as businessId is available — fire a lightweight parallel count query.
 *  3. When the query resolves — update state + persist to AsyncStorage for next launch.
 *  4. If the full useClients list is already cached by React Query — derive counts from it
 *     instantly without any extra network call.
 *
 * This means:
 *  - Cold start: shows cached counts from previous session immediately, refreshes in background.
 *  - Warm navigation: shows counts from React Query in-memory cache (instant).
 *  - First ever launch: shows nothing until the fast count query completes (~100-300ms).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import { getClientCounts, type ClientCounts } from '@/services/clientsService';
import { clientKeys } from '@/hooks/useClients';
import type { SupabaseClient } from '@/services/clientsService';
import { isThisMonth } from 'date-fns';

const CACHE_KEY_PREFIX = 'client_counts_v1_';
const STALE_MS = 60 * 1000; // Re-fetch if cached value is older than 60s

export interface ClientCountsState {
  total: number;
  newThisMonth: number;
  /** True only on absolute first launch before any data is available */
  isLoading: boolean;
}

function cacheKey(businessId: string) {
  return `${CACHE_KEY_PREFIX}${businessId}`;
}

async function readCached(businessId: string): Promise<ClientCounts | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(businessId));
    if (!raw) return null;
    return JSON.parse(raw) as ClientCounts;
  } catch {
    return null;
  }
}

async function writeCached(businessId: string, counts: ClientCounts): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(businessId), JSON.stringify(counts));
  } catch {
    // Non-critical — best effort
  }
}

export function useClientCounts(): ClientCountsState {
  const { businessId, isInitialized } = useBusiness();
  const queryClient = useQueryClient();

  // Start with null so we can distinguish "no data yet" from "0 clients"
  const [counts, setCounts] = useState<ClientCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedForRef = useRef<string | null>(null);

  // Step 1: Try to derive counts from already-cached React Query client list (instant)
  const deriveFromQueryCache = useCallback(
    (bid: string): ClientCounts | null => {
      const cached = queryClient.getQueryData<SupabaseClient[]>(clientKeys.list(bid));
      if (!cached || cached.length === 0) return null;
      return {
        total: cached.length,
        newThisMonth: cached.filter((c) => isThisMonth(new Date(c.created_at))).length,
        fetchedAt: Date.now(),
      };
    },
    [queryClient]
  );

  // Step 2: Load from AsyncStorage (runs once per businessId change)
  useEffect(() => {
    if (!businessId) return;

    let cancelled = false;

    async function load() {
      if (!businessId) return;

      // Fast path: check React Query in-memory cache first (truly instant)
      const inMemory = deriveFromQueryCache(businessId);
      if (inMemory && !cancelled) {
        setCounts(inMemory);
        setIsLoading(false);
      }

      // Then check AsyncStorage (slightly slower but still fast)
      const persisted = await readCached(businessId);
      if (persisted && !cancelled) {
        // Only apply if we don't already have fresher in-memory data
        setCounts((prev) => {
          if (!prev || persisted.fetchedAt > prev.fetchedAt) return persisted;
          return prev;
        });
        setIsLoading(false);
      }

      // Determine if we need a network fetch
      const currentCounts = inMemory ?? persisted;
      const isStale =
        !currentCounts || Date.now() - currentCounts.fetchedAt > STALE_MS;

      if (isStale && !cancelled) {
        fetchedForRef.current = businessId;
        const result = await getClientCounts(businessId);
        if (!cancelled && result.data) {
          setCounts(result.data);
          setIsLoading(false);
          writeCached(businessId, result.data);
        }
      } else if (currentCounts) {
        // We have fresh enough data — no network needed
        setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [businessId, isInitialized, deriveFromQueryCache]);

  // Step 3: Subscribe to React Query cache updates for the client list.
  // When useClients completes its full fetch, update our counts from it.
  useEffect(() => {
    if (!businessId) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        JSON.stringify(event.query.queryKey) ===
          JSON.stringify(clientKeys.list(businessId))
      ) {
        const fresh = deriveFromQueryCache(businessId);
        if (fresh) {
          setCounts(fresh);
          setIsLoading(false);
          writeCached(businessId, fresh);
        }
      }
    });

    return unsubscribe;
  }, [businessId, queryClient, deriveFromQueryCache]);

  return {
    total: counts?.total ?? 0,
    newThisMonth: counts?.newThisMonth ?? 0,
    isLoading: isLoading && !counts,
  };
}
