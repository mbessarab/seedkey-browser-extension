/**
 * Tests for the useExtensionState hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import { useExtensionState } from '@/entrypoints/popup/hooks/useExtensionState';
import type { ExtensionState, SeedKeyError } from '@/utils/types';

// Mock messaging module
vi.mock('@/utils/messaging', () => ({
  sendMessage: vi.fn(),
}));

// Mock logger to avoid noisy output
vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { sendMessage } from '@/utils/messaging';

const mockSendMessage = vi.mocked(sendMessage);

// ============================================================================
// Test Data
// ============================================================================

const defaultState: ExtensionState = {
  initialized: false,
  settings: {
    autoPrompt: true,
    theme: 'system',
  },
};

const initializedState: ExtensionState = {
  initialized: true,
  settings: {
    autoPrompt: false,
    theme: 'dark',
  },
};

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Initial Loading
// ============================================================================

describe('initial loading', () => {
  it('should start with isLoading: true', async () => {
    mockSendMessage.mockResolvedValueOnce(defaultState);
    
    const { result } = renderHook(() => useExtensionState());

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should load state on mount', async () => {
    mockSendMessage.mockResolvedValueOnce(defaultState);
    
    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockSendMessage).toHaveBeenCalledWith('getState', undefined);
    expect(result.current.state).toEqual(defaultState);
  });

  it('should set state after loading', async () => {
    mockSendMessage.mockResolvedValueOnce(initializedState);
    
    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.state).toEqual(initializedState);
    });

    expect(result.current.state?.initialized).toBe(true);
  });

  it('should handle loading errors', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Network error'));
    
    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load state');
    // Should set the default state
    expect(result.current.state?.initialized).toBe(false);
  });
});

// ============================================================================
// Refresh
// ============================================================================

describe('refresh', () => {
  it('should reload state', async () => {
    mockSendMessage
      .mockResolvedValueOnce(defaultState) // initial load
      .mockResolvedValueOnce(initializedState); // refresh

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state?.initialized).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('should clear error on refresh', async () => {
    mockSendMessage
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValueOnce(defaultState);

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
  });
});

// ============================================================================
// Initialize
// ============================================================================

describe('initialize', () => {
  beforeEach(() => {
    mockSendMessage.mockResolvedValueOnce(defaultState); // initial load
  });

  it('should create a new identity', async () => {
    mockSendMessage.mockResolvedValueOnce({
      success: true,
      seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    });

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let initResult: Awaited<ReturnType<typeof result.current.initialize>>;
    await act(async () => {
      initResult = await result.current.initialize();
    });

    expect(initResult!.success).toBe(true);
    expect(initResult!.seedPhrase).toBeDefined();
    expect(mockSendMessage).toHaveBeenCalledWith('initialize', { seedPhrase: undefined });
  });

  it('should restore from a seed phrase', async () => {
    const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    
    mockSendMessage
      .mockResolvedValueOnce({ success: true, seedPhrase })
      .mockResolvedValueOnce(initializedState); // refresh after restore

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.initialize(seedPhrase);
    });

    expect(mockSendMessage).toHaveBeenCalledWith('initialize', { seedPhrase });
    // After recovery, refresh should be triggered
    expect(mockSendMessage).toHaveBeenCalledWith('getState', undefined);
  });

  it('should handle initialization errors', async () => {
    const error: SeedKeyError = {
      code: 'INVALID_SEED',
      message: 'Invalid seed phrase',
    };

    mockSendMessage.mockResolvedValueOnce({
      success: false,
      error,
    });

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let initResult: Awaited<ReturnType<typeof result.current.initialize>>;
    await act(async () => {
      initResult = await result.current.initialize('invalid seed');
    });

    expect(initResult!.success).toBe(false);
    expect(initResult!.error).toEqual(error);
    expect(result.current.error).toBe('Invalid seed phrase');
  });

  it('should handle thrown exceptions during initialization', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Connection failed'));

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let initResult: Awaited<ReturnType<typeof result.current.initialize>>;
    await act(async () => {
      initResult = await result.current.initialize();
    });

    expect(initResult!.success).toBe(false);
    expect(result.current.error).toBe('Connection failed');
  });
});

// ============================================================================
// Confirm Seed Backup
// ============================================================================

describe('confirmSeedBackup', () => {
  beforeEach(() => {
    mockSendMessage.mockResolvedValueOnce(defaultState);
  });

  it('should confirm seed phrase backup', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(initializedState); // refresh

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let confirmResult: boolean;
    await act(async () => {
      confirmResult = await result.current.confirmSeedBackup();
    });

    expect(confirmResult!).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith('confirmSeedBackup', undefined);
    // After confirmation, refresh should be triggered
    expect(mockSendMessage).toHaveBeenCalledWith('getState', undefined);
  });

  it('should return false on error', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Error'));

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let confirmResult: boolean;
    await act(async () => {
      confirmResult = await result.current.confirmSeedBackup();
    });

    expect(confirmResult!).toBe(false);
    expect(result.current.error).toBe('Error during confirmation');
  });
});

// ============================================================================
// Reset
// ============================================================================

describe('reset', () => {
  beforeEach(() => {
    mockSendMessage.mockResolvedValueOnce(initializedState);
  });

  it('should reset the extension', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(defaultState); // refresh

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(true);
    });

    let resetResult: boolean;
    await act(async () => {
      resetResult = await result.current.reset();
    });

    expect(resetResult!).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith('reset', undefined);
  });

  it('should return false on error', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Error'));

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let resetResult: boolean;
    await act(async () => {
      resetResult = await result.current.reset();
    });

    expect(resetResult!).toBe(false);
    expect(result.current.error).toBe('Error during reset');
  });

  it('should update state after reset', async () => {
    mockSendMessage
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce(defaultState);

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(true);
    });

    await act(async () => {
      await result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(false);
    });
  });
});

// ============================================================================
// Return Value Stability
// ============================================================================

describe('return value stability', () => {
  it('functions should be memoized', async () => {
    mockSendMessage.mockResolvedValue(defaultState);

    const { result, rerender } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const refresh1 = result.current.refresh;
    const initialize1 = result.current.initialize;
    const confirmSeedBackup1 = result.current.confirmSeedBackup;
    const reset1 = result.current.reset;

    rerender();

    // Functions should preserve identity between renders
    expect(result.current.refresh).toBe(refresh1);
    expect(result.current.initialize).toBe(initialize1);
    expect(result.current.confirmSeedBackup).toBe(confirmSeedBackup1);
    expect(result.current.reset).toBe(reset1);
  });
});

// ============================================================================
// Typical User Flows
// ============================================================================

describe('typical user flows', () => {
  it('new user: initialize → confirmSeedBackup', async () => {
    const seedPhrase = 'test seed phrase';
    
    mockSendMessage
      .mockResolvedValueOnce(defaultState) // initial
      .mockResolvedValueOnce({ success: true, seedPhrase }) // initialize
      .mockResolvedValueOnce({ success: true }) // confirmSeedBackup
      .mockResolvedValueOnce(initializedState); // refresh

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Initialize
    await act(async () => {
      const initResult = await result.current.initialize();
      expect(initResult.success).toBe(true);
    });

    // Confirm backup
    await act(async () => {
      const confirmResult = await result.current.confirmSeedBackup();
      expect(confirmResult).toBe(true);
    });

    // After confirmation, state should be updated
    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(true);
    });
  });

  it('recovery: initialize with seedPhrase', async () => {
    const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    mockSendMessage
      .mockResolvedValueOnce(defaultState) // initial
      .mockResolvedValueOnce({ success: true, seedPhrase }) // initialize with seed
      .mockResolvedValueOnce(initializedState); // refresh

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const initResult = await result.current.initialize(seedPhrase);
      expect(initResult.success).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(true);
    });
  });

  it('full reset: reset → initialize', async () => {
    mockSendMessage
      .mockResolvedValueOnce(initializedState) // initial (already initialized)
      .mockResolvedValueOnce({ success: true }) // reset
      .mockResolvedValueOnce(defaultState) // refresh after reset
      .mockResolvedValueOnce({ success: true, seedPhrase: 'new seed' }) // new initialize
      .mockResolvedValueOnce({ success: true }) // confirmSeedBackup
      .mockResolvedValueOnce(initializedState); // final refresh

    const { result } = renderHook(() => useExtensionState());

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(true);
    });

    // Reset
    await act(async () => {
      await result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(false);
    });

    // New initialize
    await act(async () => {
      await result.current.initialize();
    });

    await act(async () => {
      await result.current.confirmSeedBackup();
    });

    await waitFor(() => {
      expect(result.current.state?.initialized).toBe(true);
    });
  });
});
