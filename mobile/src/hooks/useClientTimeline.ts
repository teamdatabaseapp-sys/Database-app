/**
 * useClientTimeline
 *
 * Lazy React Query hook for the unified client event timeline.
 *
 * Design goals:
 *  - Does NOT run on ClientDetailScreen mount — only when the user opens the
 *    timeline modal (enabled: false until isOpen is true).
 *  - Supports manual load-more pagination without wiping the existing list.
 *  - Degrades gracefully if the RPC migration is not yet applied.
 *  - staleTime: 60s
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClientTimeline, TimelineEvent } from '@/services/clientTimelineService';

const PAGE_SIZE = 30;

export const clientTimelineKeys = {
  forClient: (clientId: string, offset: number) =>
    ['client_timeline', clientId, offset] as const,
};

export function useClientTimeline(
  clientId: string | undefined,
  isOpen: boolean,
) {
  const [offset, setOffset] = useState(0);
  // Accumulated events from pages 0..offset-PAGE_SIZE
  const accumulatedRef = useRef<TimelineEvent[]>([]);
  const [accumulated, setAccumulated] = useState<TimelineEvent[]>([]);

  // Reset when clientId changes or modal closes
  useEffect(() => {
    if (!isOpen) {
      accumulatedRef.current = [];
      setAccumulated([]);
      setOffset(0);
    }
  }, [isOpen]);

  useEffect(() => {
    accumulatedRef.current = [];
    setAccumulated([]);
    setOffset(0);
  }, [clientId]);

  const query = useQuery({
    queryKey: clientTimelineKeys.forClient(clientId ?? '', offset),
    queryFn: () => getClientTimeline(clientId!, PAGE_SIZE, offset),
    enabled: isOpen && !!clientId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const loadMore = useCallback(() => {
    if (!query.data?.has_more || query.isFetching) return;
    // Save current page into accumulated before advancing offset
    accumulatedRef.current = [...accumulatedRef.current, ...(query.data?.events ?? [])];
    setAccumulated([...accumulatedRef.current]);
    setOffset(prev => prev + PAGE_SIZE);
  }, [query.data, query.isFetching]);

  const displayEvents: TimelineEvent[] = [
    ...accumulated,
    ...(query.data?.events ?? []),
  ];

  return {
    events: displayEvents,
    isLoading: query.isLoading,
    isFetchingMore: query.isFetching && offset > 0,
    hasMore: query.data?.has_more ?? false,
    isError: query.isError,
    migrationPending: query.data?.migration_pending ?? false,
    loadMore,
  };
}
