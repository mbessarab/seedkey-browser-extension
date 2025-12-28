/**
 * Settings screen
 * 
 * Contains a section for a full extension reset.
 * Requires double confirmation before resetting.
 */

import { useCallback } from 'react';
import { Header, Button } from '../components';
import { useI18n } from '../hooks';
import { CONTACT, EXTENSION_VERSION } from '@/utils/config';

/** Props for the Settings component */
interface SettingsProps {
  onBack: () => void;
  onReset: () => Promise<boolean>;
  isLoading?: boolean;
}

/**
 * Settings screen with a reset button.
 */
export function Settings({ onBack, onReset, isLoading }: SettingsProps) {
  const { t } = useI18n();

  const handleReset = useCallback(async () => {
    const confirmed = confirm(t('resetConfirm1'));

    if (!confirmed) return;

    const doubleConfirmed = confirm(t('resetConfirm2'));

    if (!doubleConfirmed) return;

    await onReset();
  }, [onReset, t]);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={t('settingsTitle')}
        showBack
        onBack={onBack}
      />

      {/* Contact information */}
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">📬 {t('contactInfo')}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Email:</span>
            <a 
              href={`mailto:${CONTACT.email}`}
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {CONTACT.email}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Telegram:</span>
            <a 
              href={`https://t.me/${CONTACT.telegram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {CONTACT.telegram}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">GitHub:</span>
            <a 
              href={CONTACT.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {CONTACT.github.replace('https://github.com/', '')}
            </a>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="mb-5 text-xs text-slate-400">
        {t('version')}: {EXTENSION_VERSION}
      </div>

      <div className="mt-auto pt-5 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-red-500 mb-3">⚠️ {t('dangerZone')}</h3>
        <Button
          variant="danger"
          onClick={handleReset}
          disabled={isLoading}
          isLoading={isLoading}
        >
          {t('resetExtension')}
        </Button>
        <p className="text-slate-500 text-xs mt-2">
          {t('resetHint')}
        </p>
      </div>
    </div>
  );
}
