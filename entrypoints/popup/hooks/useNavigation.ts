/**
 * Hook for navigating between views in the popup.
 *
 * Implements a simple history stack for navigation between screens.
 */

import { useState, useCallback, useMemo } from 'react';

/** Identifiers of available screens */
export type ViewId = 
  | 'loading'
  | 'welcome'
  | 'seedDisplay'
  | 'restore'
  | 'dashboard'
  | 'settings';

/** Return type of the useNavigation hook */
interface UseNavigationReturn {
  /** Current active screen */
  currentView: ViewId;
  /** Navigate to a screen (pushes onto history) */
  navigate: (view: ViewId) => void;
  /** Go back (pops history) */
  goBack: () => void;
  /** Full navigation history */
  history: ViewId[];
}

/**
 * Hook for navigating between popup screens.
 *
 * @param initialView - Initial screen (defaults to 'loading')
 * @returns Object with currentView, navigate, goBack, and history
 *
 * @example
 * const { currentView, navigate, goBack } = useNavigation('welcome');
 *
 * navigate('dashboard'); // Go to dashboard
 * goBack(); // Return to welcome
 */
export function useNavigation(initialView: ViewId = 'loading'): UseNavigationReturn {
  const [history, setHistory] = useState<ViewId[]>([initialView]);

  const currentView = useMemo(() => history[history.length - 1], [history]);

  const navigate = useCallback((view: ViewId) => {
    setHistory(prev => [...prev, view]);
  }, []);

  const goBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  return {
    currentView,
    navigate,
    goBack,
    history,
  };
}
