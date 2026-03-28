/**
 * Language Initialization Hook
 *
 * Use this hook at the app root to ensure the selected language
 * is loaded before rendering the UI.
 *
 * Performance benefits:
 * - Loads language once on app start
 * - Prevents flash of English text
 * - Caches language for instant switching later
 */

import { useEffect, useState } from 'react';
import { useStore } from './store';
import { loadLanguage, isLanguageLoaded } from './i18n/translation-manager';
import { Language } from './types';


/**
 * Hook to initialize language on app startup
 * Returns true when language is ready to use.
 *
 * All translations are statically imported, so they are ALWAYS synchronously
 * available. This hook never blocks rendering — it just warms the cache in the
 * background and triggers a re-render when the active language changes so that
 * text components pick up the new translations immediately.
 */
export function useLanguageInitialization(): boolean {
  const language = useStore((s) => s.language) as Language;
  // Track a version number to force re-renders when translations update
  const [, setVersion] = useState(0);

  useEffect(() => {
    let mounted = true;

    // Warm the translation cache for this language (instant — static imports).
    // Never blocks: we do NOT set any "not ready" flag.
    loadLanguage(language)
      .then(() => {
        if (mounted) setVersion((v) => v + 1);
      })
      .catch(() => {
        if (mounted) setVersion((v) => v + 1);
      });

    return () => { mounted = false; };
  }, [language]);

  // Always ready — translations are statically bundled and instantly available.
  return true;
}

/**
 * Hook that triggers re-render when language changes
 * Use this in components that need to update when language switches
 */
export function useLanguage(): Language {
  return useStore((s) => s.language) as Language;
}

/**
 * Hook to get translations loading state
 * Useful for showing loading indicators during language switch
 */
export function useLanguageLoading(): boolean {
  const language = useStore((s) => s.language) as Language;
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLanguageLoaded(language)) {
      setIsLoading(true);
      loadLanguage(language).finally(() => {
        setIsLoading(false);
      });
    }
  }, [language]);

  return isLoading;
}
