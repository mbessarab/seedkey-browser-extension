/**
 * Settings screen
 * 
 * Contains a section for a full extension reset.
 * Requires double confirmation before resetting.
 */

import { useCallback } from 'preact/hooks';
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
        <h3 className="text-sm font-semibold text-text mb-3">📬 {t('contactInfo')}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Email:</span>
            <a 
              href={`mailto:${CONTACT.email}`}
              className="text-primary hover:text-primary-hover hover:underline transition-colors"
            >
              {CONTACT.email}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Telegram:</span>
            <a 
              href={`https://t.me/${CONTACT.telegram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover hover:underline transition-colors"
            >
              {CONTACT.telegram}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">GitHub:</span>
            <a 
              href={CONTACT.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover hover:underline transition-colors"
            >
              {CONTACT.github.replace('https://github.com/', '')}
            </a>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="mb-5 text-xs text-text-muted">
        {t('version')}: {EXTENSION_VERSION}
      </div>

      <div className="mt-auto pt-5">
        {/*<h3 className="text-sm font-semibold text-danger mb-3 text-center"> {t('dangerZone')}</h3>*/}
        <Button
          variant="danger"
          onClick={handleReset}
          disabled={isLoading}
          isLoading={isLoading}
        >
            <p>⚠️ {t('resetExtension')}</p>
        </Button>
        <p className="text-text-muted text-xs mt-2">
          {t('resetHint')}
        </p>
      </div>
    </div>
  );
}
