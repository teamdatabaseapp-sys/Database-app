import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@database_rating_prompt';
const MIN_INTERACTIONS_REQUIRED = 5;
const MIN_DAYS_ACTIVE = 2;

interface RatingPromptState {
  hasRated: boolean;
  hasDeclinedPermanently: boolean;
  interactionCount: number;
  firstActiveDate: string | null;
  lastShownDate: string | null;
}

const DEFAULT_STATE: RatingPromptState = {
  hasRated: false,
  hasDeclinedPermanently: false,
  interactionCount: 0,
  firstActiveDate: null,
  lastShownDate: null,
};

/**
 * Hook for managing the in-app rating prompt lifecycle.
 * Tracks user interactions and determines if/when to show the prompt.
 * Persists state to AsyncStorage so decisions survive app restarts.
 */
export function useRatingPrompt() {
  const [state, setState] = useState<RatingPromptState>(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as RatingPromptState;
          setState(parsed);
        } catch {
          // ignore parse errors, use default
        }
      }
      setIsLoaded(true);
    });
  }, []);

  const persistState = useCallback(async (next: RatingPromptState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // Determine eligibility after state loads
  useEffect(() => {
    if (!isLoaded) return;
    if (state.hasRated || state.hasDeclinedPermanently) {
      setShouldShow(false);
      return;
    }

    const now = new Date();
    const firstActive = state.firstActiveDate ? new Date(state.firstActiveDate) : null;
    const lastShown = state.lastShownDate ? new Date(state.lastShownDate) : null;

    // Don't re-show within 7 days
    if (lastShown) {
      const daysSinceShown = (now.getTime() - lastShown.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceShown < 7) {
        setShouldShow(false);
        return;
      }
    }

    // Check day threshold
    if (firstActive) {
      const daysActive = (now.getTime() - firstActive.getTime()) / (1000 * 60 * 60 * 24);
      if (daysActive >= MIN_DAYS_ACTIVE && state.interactionCount >= MIN_INTERACTIONS_REQUIRED) {
        setShouldShow(true);
        return;
      }
    }

    setShouldShow(false);
  }, [isLoaded, state]);

  /**
   * Record a positive interaction (appointment booked, client visit logged, etc.)
   * Sets firstActiveDate on first call.
   */
  const recordInteraction = useCallback(async () => {
    const now = new Date().toISOString();
    const next: RatingPromptState = {
      ...state,
      interactionCount: state.interactionCount + 1,
      firstActiveDate: state.firstActiveDate ?? now,
    };
    await persistState(next);
  }, [state, persistState]);

  /**
   * Mark that the user has rated the app — never show again.
   */
  const markRated = useCallback(async () => {
    await persistState({ ...state, hasRated: true });
    setShouldShow(false);
  }, [state, persistState]);

  /**
   * User dismissed "not now" — record shown date, can show again in 7 days.
   */
  const dismissTemporarily = useCallback(async () => {
    const next: RatingPromptState = {
      ...state,
      lastShownDate: new Date().toISOString(),
    };
    await persistState(next);
    setShouldShow(false);
  }, [state, persistState]);

  /**
   * User chose "don't ask again" — never show again.
   */
  const dismissPermanently = useCallback(async () => {
    await persistState({ ...state, hasDeclinedPermanently: true });
    setShouldShow(false);
  }, [state, persistState]);

  return {
    shouldShow,
    recordInteraction,
    markRated,
    dismissTemporarily,
    dismissPermanently,
  };
}
