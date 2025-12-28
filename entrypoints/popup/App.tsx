/**
 * Main Popup app component.
 *
 * Responsible for:
 * - Routing between views (Welcome, SeedDisplay, Restore, Dashboard, Settings)
 * - Managing the initialization lifecycle
 * - Coordinating user actions
 *
 * @remarks
 * Uses:
 * - useExtensionState — extension state management
 * - useNavigation — navigation between screens
 */

import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { useExtensionState, useNavigation } from './hooks';
import { Spinner } from './components';
import { Welcome, SeedDisplay, Restore, Dashboard, Settings } from './views';
import { createLogger } from '@/utils/logger';

const log = createLogger('App');

/**
 * Root component for the extension popup UI.
 *
 * @returns React component with the current view based on state
 */
export function App() {
  const {
    state,
    isLoading,
    error,
    initialize,
    confirmSeedBackup,
    reset,
    refresh,
  } = useExtensionState();

  const { currentView, navigate } = useNavigation('loading');
  const [tempSeedPhrase, setTempSeedPhrase] = useState<string | null>(null);
  const initialNavigationDone = useRef(false);

  // Determine the initial view based on state (only on first load)
  useEffect(() => {
    // Skip if initial navigation has already run or we're still loading
    if (initialNavigationDone.current || isLoading) return;

    // Mark initial navigation as done
    initialNavigationDone.current = true;

    if (!state) {
      navigate('welcome');
      return;
    }

    if (state.initialized) {
      navigate('dashboard');
    } else if (state.seedPhrase) {
      // Seed phrase was generated but not confirmed
      setTempSeedPhrase(state.seedPhrase);
      navigate('seedDisplay');
    } else {
      navigate('welcome');
    }
  }, [state, isLoading, navigate]);

  // === Handlers ===

  const handleCreateIdentity = useCallback(async () => {
    log.debug('Creating identity');
    navigate('loading');
    
    const result = await initialize();
    
    if (result.success && result.seedPhrase) {
      setTempSeedPhrase(result.seedPhrase);
      navigate('seedDisplay');
    } else {
      navigate('welcome');
    }
  }, [initialize, navigate]);

  const handleConfirmSeed = useCallback(async () => {
    log.debug('Confirming seed backup');
    navigate('loading');
    
    const success = await confirmSeedBackup();
    
    if (success) {
      setTempSeedPhrase(null);
      navigate('dashboard');
    } else {
      navigate('seedDisplay');
    }
  }, [confirmSeedBackup, navigate]);

  const handleRestore = useCallback(async (seedPhrase: string): Promise<boolean> => {
    log.debug('Restoring from seed');
    
    const result = await initialize(seedPhrase);
    
    if (result.success) {
      await refresh();
      navigate('dashboard');
      return true;
    }
    
    return false;
  }, [initialize, refresh, navigate]);

  const handleReset = useCallback(async (): Promise<boolean> => {
    log.debug('Resetting extension');
    
    const success = await reset();
    
    if (success) {
      setTempSeedPhrase(null);
      navigate('welcome');
    }
    
    return success;
  }, [reset, navigate]);

  // === Render ===

  // Loading state
  if (currentView === 'loading' || (isLoading && !state)) {
    return <Spinner />;
  }

  // Welcome screen
  if (currentView === 'welcome') {
    return (
      <Welcome
        onCreateIdentity={handleCreateIdentity}
        onRestore={() => navigate('restore')}
        isLoading={isLoading}
      />
    );
  }

  // Seed display screen
  if (currentView === 'seedDisplay' && tempSeedPhrase) {
    return (
      <SeedDisplay
        seedPhrase={tempSeedPhrase}
        onConfirm={handleConfirmSeed}
        isLoading={isLoading}
      />
    );
  }

  // Restore screen
  if (currentView === 'restore') {
    return (
      <Restore
        onBack={() => navigate('welcome')}
        onRestore={handleRestore}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Dashboard screen
  if (currentView === 'dashboard' && state) {
    return (
      <Dashboard
        onSettings={() => navigate('settings')}
        createdAt={state.createdAt}
        seedPhraseAvailable={state.seedPhraseAvailable}
      />
    );
  }

  // Settings screen
  if (currentView === 'settings' && state) {
    return (
      <Settings
        onBack={() => navigate('dashboard')}
        onReset={handleReset}
        isLoading={isLoading}
      />
    );
  }

  // Fallback
  return <Spinner />;
}
