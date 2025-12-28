/**
 * Seed phrase recovery screen
 *
 */

import { useState, useCallback } from 'preact/hooks';
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
        smallLogo
        title={t('restoreTitle')}
        showBack
        onBack={onBack}
      />
      
      <p className="text-text-muted mb-6 text-center text-sm">{t('restoreDescription')}</p>
      
      <textarea
        className="w-full py-3.5 px-4 bg-background-card border border-border rounded-lg text-[15px] font-mono text-text resize-none mb-3 placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        placeholder={t('seedInputPlaceholder')}
        rows={4}
        value={seedPhrase}
        onChange={(e) => {
          setSeedPhrase(e.target.value);
          setLocalError(null);
        }}
      />
      
      {displayError && (
        <div className="bg-danger-bg text-danger py-3 px-4 rounded-lg mb-3 text-sm border border-danger/30">{displayError}</div>
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
