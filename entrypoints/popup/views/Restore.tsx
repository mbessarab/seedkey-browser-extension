/**
 * Seed phrase recovery screen
 *
 */

import { useState, useCallback } from 'react';
import { Header, Button } from '../components';
import { useI18n } from '../hooks';

/** Props for the Restore component */
interface RestoreProps {
  onBack: () => void;
  onRestore: (seedPhrase: string) => Promise<boolean>;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Recovery screen with a textarea for entering the seed phrase.
 */
export function Restore({ onBack, onRestore, isLoading, error }: RestoreProps) {
  const { t } = useI18n();
  const [seedPhrase, setSeedPhrase] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const words = seedPhrase.trim().split(/\s+/).filter(Boolean);
  const isValidLength = words.length === 12 || words.length === 24;

  const handleRestore = useCallback(async () => {
    setLocalError(null);
    const normalized = seedPhrase.trim().toLowerCase();
    const success = await onRestore(normalized);
    
    if (!success) {
      setLocalError(t('invalidSeedPhrase'));
    }
  }, [seedPhrase, onRestore, t]);

  const displayError = error || localError;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={t('restoreTitle')}
        showBack
        onBack={onBack}
      />
      
      <p className="text-slate-500 mb-6 text-center">{t('restoreDescription')}</p>
      
      <textarea
        className="w-full py-3 px-4 border border-slate-200 rounded-lg text-[15px] font-mono resize-none mb-3 focus:outline-none focus:border-indigo-500 focus:ring-[3px] focus:ring-indigo-100"
        placeholder={t('seedInputPlaceholder')}
        rows={4}
        value={seedPhrase}
        onChange={(e) => {
          setSeedPhrase(e.target.value);
          setLocalError(null);
        }}
      />
      
      {displayError && (
        <div className="bg-red-50 text-red-500 py-3 px-4 rounded-lg mb-3 text-sm">{displayError}</div>
      )}
      
      <Button
        variant="primary"
        onClick={handleRestore}
        disabled={!isValidLength || isLoading}
        isLoading={isLoading}
      >
        {t('restoreButton')}
      </Button>
    </div>
  );
}
