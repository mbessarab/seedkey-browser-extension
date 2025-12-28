/**
 * Seed phrase display screen after creating an Identity.
 *
 * Shows the 12-word seed phrase and requires confirmation
 * that the user has saved it before continuing.
 */

import { useState } from 'preact/hooks';
import { Header, Button, SeedGrid } from '../components';
import { useI18n } from '../hooks';

/** Props for the SeedDisplay component */
interface SeedDisplayProps {
  seedPhrase: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

/**
 * Screen with the seed phrase and a confirmation checkbox.
 */
export function SeedDisplay({ seedPhrase, onConfirm, isLoading }: SeedDisplayProps) {
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="flex-1 flex flex-col">
      <Header title={t('seedPhraseTitle')} />
      
      <div className="bg-warning-bg text-warning-text py-3 px-4 rounded-lg mb-5 text-sm border border-warning/30">
        {t('seedWarning')}
      </div>
      
      <SeedGrid seedPhrase={seedPhrase} />
      
      <div className="mb-5">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-text">
          <input
            type="checkbox"
            className="w-[18px] h-[18px] accent-primary rounded"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {t('seedConfirmCheckbox')}
        </label>
      </div>
      
      <Button
        variant="primary"
        onClick={onConfirm}
        disabled={!confirmed || isLoading}
        isLoading={isLoading}
      >
        {t('continue')}
      </Button>
    </div>
  );
}
