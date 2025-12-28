/**
 * Hook for internationalization (i18n).
 *
 * Uses the built-in browser.i18n API for translations.
 * Automatically detects the browser language and loads the corresponding strings.
 *
 * @example
 * const { t } = useI18n();
 * return <p>{t('welcomeDescription')}</p>;
 */

import { useCallback } from 'preact/hooks';

/**
 * Get a translation via the browser.i18n API.
 *
 * @param key - Message key from messages.json
 * @param substitutions - Optional substitutions for placeholders
 * @returns Translated string, or the key if the translation is not found
 */
function getMessage(key: string, substitutions?: string | string[]): string {
  try {
    // browser.i18n is available in the extension context
    const message = browser.i18n.getMessage(key, substitutions);
    return message || key;
  } catch {
    // Fallback for environments without the browser API (e.g., tests)
    return key;
  }
}

/**
 * Hook for using translations in components.
 *
 * @returns Object with the t function for fetching translations
 */
export function useI18n() {
  /**
   * Translation function.
   *
   * @param key - Message key
   * @param substitutions - Optional substitutions
   * @returns Translated string
   */
  const t = useCallback((key: string, substitutions?: string | string[]): string => {
    return getMessage(key, substitutions);
  }, []);

  return { t };
}

/**
 * Helper function for use outside React components.
 *
 * @param key - Message key
 * @param substitutions - Optional substitutions
 * @returns Translated string
 */
export function t(key: string, substitutions?: string | string[]): string {
  return getMessage(key, substitutions);
}

