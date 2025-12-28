/**
 * Hook for managing extension state.
 *
 * Provides:
 * - Current state (initialized, settings)
 * - Methods for initialize, confirm, and reset
 * - Loading and error state
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { sendMessage } from '@/utils/messaging';
import type { ExtensionState, SeedKeyError } from '@/utils/types';
import { createLogger } from '@/utils/logger';

const log = createLogger('useExtensionState');


interface UseExtensionStateReturn {

  state: ExtensionState | null;

  isLoading: boolean;

  error: string | null;

  refresh: () => Promise<void>;
  /** Initialize the extension (create or restore identity) */
  initialize: (seedPhrase?: string) => Promise<{ success: boolean; seedPhrase?: string; error?: SeedKeyError }>;
  /** Confirm seed phrase backup */
  confirmSeedBackup: () => Promise<boolean>;
  /** Full extension reset */
  reset: () => Promise<boolean>;
}

const DEFAULT_SETTINGS = {
  autoPrompt: true,
  theme: 'system' as const,
};

/**
 * Hook for managing extension state.
 *
 * @returns UseExtensionStateReturn with state, methods, and loading/error flags
 *
 * @example
 * const { state, initialize, reset, isLoading, error } = useExtensionState();
 *
 * // Create a new identity
 * const result = await initialize();
 * if (result.success) {
 *   console.log('Seed:', result.seedPhrase);
 * }
 *
 * // Restore
 * await initialize('word1 word2 ... word12');
 */
export function useExtensionState(): UseExtensionStateReturn {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    log.debug('Refreshing state');
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage('getState', undefined);
      log.debug('State received', {
        initialized: result.initialized,
      });
      setState(result);
    } catch (err) {
      log.error('Failed to get state', err);
      setError('Failed to load state');
      setState({
        initialized: false,
        settings: DEFAULT_SETTINGS,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initialize = useCallback(async (seedPhrase?: string) => {
    log.debug('Initializing', { isRestore: !!seedPhrase });
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage('initialize', { seedPhrase });
      
      if (result.success) {
        log.debug('Initialize successful', { seedPhraseLength: result.seedPhrase?.split(' ').length });
        // After restore, refresh state
        if (seedPhrase) {
          await refresh();
        }
        return { success: true as const, seedPhrase: result.seedPhrase };
      } else {
        log.error('Initialize failed', result.error);
        setError(result.error?.message || 'Initialization error');
        return { success: false, error: result.error };
      }
    } catch (err) {
      log.error('Initialize error', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return { success: false, error: { code: 'INTERNAL_ERROR', message: errorMessage } };
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const confirmSeedBackup = useCallback(async () => {
    log.debug('Confirming seed backup');
    setIsLoading(true);

    try {
      await sendMessage('confirmSeedBackup', undefined);
      log.debug('Seed backup confirmed');
      await refresh();
      return true;
    } catch (err) {
      log.error('Confirm error', err);
      setError('Error during confirmation');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const reset = useCallback(async () => {
    log.debug('Resetting extension');
    setIsLoading(true);

    try {
      await sendMessage('reset', undefined);
      log.debug('Reset complete');
      await refresh();
      return true;
    } catch (err) {
      log.error('Reset error', err);
      setError('Error during reset');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  // Load state on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    state,
    isLoading,
    error,
    refresh,
    initialize,
    confirmSeedBackup,
    reset,
  };
}
