import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TAB_STORAGE_PREFIX = 'tab_state_';

export function useTabPersistence<T extends string>(
  screenKey: string,
  defaultTab: T
): [T, (tab: T) => void] {
  const [activeTab, setActiveTabState] = useState<T>(defaultTab);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(TAB_STORAGE_PREFIX + screenKey).then((saved) => {
      if (mounted && saved) {
        setActiveTabState(saved as T);
      }
    });
    return () => {
      mounted = false;
    };
  }, [screenKey]);

  const setActiveTab = useCallback(
    (tab: T) => {
      setActiveTabState(tab);
      AsyncStorage.setItem(TAB_STORAGE_PREFIX + screenKey, tab);
    },
    [screenKey]
  );

  return [activeTab, setActiveTab];
}
