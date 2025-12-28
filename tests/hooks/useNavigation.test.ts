/**
 * Tests for the useNavigation hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useNavigation, type ViewId } from '@/entrypoints/popup/hooks/useNavigation';

describe('useNavigation', () => {
  // ============================================================================
  // Initial State
  // ============================================================================

  describe('initial state', () => {
    it('should start with loading by default', () => {
      const { result } = renderHook(() => useNavigation());
      
      expect(result.current.currentView).toBe('loading');
    });

    it('should accept an initial view', () => {
      const { result } = renderHook(() => useNavigation('welcome'));
      
      expect(result.current.currentView).toBe('welcome');
    });

    it('history should contain the initial view', () => {
      const { result } = renderHook(() => useNavigation('dashboard'));
      
      expect(result.current.history).toEqual(['dashboard']);
    });
  });

  // ============================================================================
  // Navigate
  // ============================================================================

  describe('navigate', () => {
    it('should navigate to a new view', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
      });

      expect(result.current.currentView).toBe('seedDisplay');
    });

    it('should push the view into history', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
      });

      expect(result.current.history).toEqual(['welcome', 'seedDisplay']);
    });

    it('should support a navigation chain', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
        result.current.navigate('dashboard');
        result.current.navigate('settings');
      });

      expect(result.current.currentView).toBe('settings');
      expect(result.current.history).toEqual(['welcome', 'seedDisplay', 'dashboard', 'settings']);
    });

    it('should allow navigating to the same view', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('welcome');
      });

      expect(result.current.history).toEqual(['welcome', 'welcome']);
    });
  });

  // ============================================================================
  // Go Back
  // ============================================================================

  describe('goBack', () => {
    it('should go back to the previous view', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
        result.current.goBack();
      });

      expect(result.current.currentView).toBe('welcome');
    });

    it('should remove the last view from history', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
        result.current.navigate('dashboard');
        result.current.goBack();
      });

      expect(result.current.history).toEqual(['welcome', 'seedDisplay']);
    });

    it('should not go beyond the initial view', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.goBack();
        result.current.goBack();
        result.current.goBack();
      });

      expect(result.current.currentView).toBe('welcome');
      expect(result.current.history).toEqual(['welcome']);
    });

    it('should support multiple goBack calls', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
        result.current.navigate('dashboard');
        result.current.navigate('settings');
        result.current.goBack();
        result.current.goBack();
      });

      expect(result.current.currentView).toBe('seedDisplay');
      expect(result.current.history).toEqual(['welcome', 'seedDisplay']);
    });
  });

  // ============================================================================
  // All Views
  // ============================================================================

  describe('all views', () => {
    const allViews: ViewId[] = ['loading', 'welcome', 'seedDisplay', 'restore', 'dashboard', 'settings'];

    it('should support all view types', () => {
      const { result } = renderHook(() => useNavigation('loading'));

      allViews.forEach((view) => {
        act(() => {
          result.current.navigate(view);
        });
        expect(result.current.currentView).toBe(view);
      });
    });

    it('should switch correctly between all views', () => {
      const { result } = renderHook(() => useNavigation('loading'));

      act(() => {
        result.current.navigate('welcome');
        result.current.navigate('restore');
        result.current.goBack();
        result.current.navigate('seedDisplay');
        result.current.navigate('dashboard');
        result.current.navigate('settings');
        result.current.goBack();
      });

      expect(result.current.currentView).toBe('dashboard');
    });
  });

  // ============================================================================
  // History Management
  // ============================================================================

  describe('history management', () => {
    it('history should correctly track all transitions', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
        result.current.navigate('dashboard');
        result.current.goBack();
        result.current.navigate('settings');
      });

      // welcome → seedDisplay → dashboard → (back) → settings
      // History: welcome → seedDisplay → settings
      expect(result.current.history).toEqual(['welcome', 'seedDisplay', 'settings']);
    });

    it('currentView should always be the last item in history', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      const checkCurrentIsLast = () => {
        const lastInHistory = result.current.history[result.current.history.length - 1];
        expect(result.current.currentView).toBe(lastInHistory);
      };

      checkCurrentIsLast();

      act(() => {
        result.current.navigate('seedDisplay');
      });
      checkCurrentIsLast();

      act(() => {
        result.current.navigate('dashboard');
      });
      checkCurrentIsLast();

      act(() => {
        result.current.goBack();
      });
      checkCurrentIsLast();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('navigate and goBack should be stable (memoized)', () => {
      const { result, rerender } = renderHook(() => useNavigation('welcome'));

      const navigate1 = result.current.navigate;
      const goBack1 = result.current.goBack;

      rerender();

      const navigate2 = result.current.navigate;
      const goBack2 = result.current.goBack;

      expect(navigate1).toBe(navigate2);
      expect(goBack1).toBe(goBack2);
    });

    it('should work with fast consecutive navigations', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.navigate('dashboard');
          result.current.navigate('settings');
          result.current.goBack();
        }
      });

      // After 100 cycles we should be on dashboard (last goBack returned from settings to dashboard)
      expect(result.current.currentView).toBe('dashboard');
    });
  });

  // ============================================================================
  // Typical User Flows
  // ============================================================================

  describe('typical user flows', () => {
    it('new user: welcome → seedDisplay → dashboard', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('seedDisplay');
      });
      expect(result.current.currentView).toBe('seedDisplay');

      act(() => {
        result.current.navigate('dashboard');
      });
      expect(result.current.currentView).toBe('dashboard');
    });

    it('recovery: welcome → restore → dashboard', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('restore');
      });
      expect(result.current.currentView).toBe('restore');

      act(() => {
        result.current.navigate('dashboard');
      });
      expect(result.current.currentView).toBe('dashboard');
    });

    it('settings: dashboard → settings → goBack', () => {
      const { result } = renderHook(() => useNavigation('dashboard'));

      act(() => {
        result.current.navigate('settings');
      });
      expect(result.current.currentView).toBe('settings');

      act(() => {
        result.current.goBack();
      });
      expect(result.current.currentView).toBe('dashboard');
    });

    it('cancel on restore screen: welcome → restore → goBack', () => {
      const { result } = renderHook(() => useNavigation('welcome'));

      act(() => {
        result.current.navigate('restore');
        result.current.goBack();
      });

      expect(result.current.currentView).toBe('welcome');
    });
  });
});
