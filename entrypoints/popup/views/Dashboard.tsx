/**
 * Main screen after initialization.
 *
 * Shows active identity status and provides access to settings.
 * Displays a notice that the seed phrase is available for 5 minutes after creation.
 */

import { useState, useEffect, useCallback } from 'react';
import { Header, Button } from '../components';
import { useI18n } from '../hooks';
import { sendMessage } from '@/utils/messaging';
import { SEED_PHRASE_DISPLAY_TIMEOUT } from '@/utils/config';

/** Props for the Dashboard component */
interface DashboardProps {
  onSettings: () => void;
  createdAt?: number;
  seedPhraseAvailable?: boolean;
}

/**
 * Main screen showing an active identity.
 */
export function Dashboard({ onSettings, createdAt, seedPhraseAvailable }: DashboardProps) {
  const { t } = useI18n();
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Compute time remaining
  useEffect(() => {
    if (!createdAt || !seedPhraseAvailable) {
      setTimeRemaining(0);
      return;
    }

    const updateTimeRemaining = () => {
      const elapsed = Date.now() - createdAt;
      const remaining = Math.max(0, SEED_PHRASE_DISPLAY_TIMEOUT - elapsed);
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [createdAt, seedPhraseAvailable]);

  // Format time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleShowSeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await sendMessage('getSeedPhrase', undefined);
      if (result.success) {
        setSeedPhrase(result.seedPhrase);
        setShowSeedModal(true);
      }
    } catch (error) {
      console.error('Failed to get seed phrase:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeSeedModal = useCallback(() => {
    setShowSeedModal(false);
    setSeedPhrase(null);
  }, []);

  const handleCopySeed = useCallback(async () => {
    if (seedPhrase) {
      try {
        await navigator.clipboard.writeText(seedPhrase);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }, [seedPhrase]);

  const canShowSeed = seedPhraseAvailable && timeRemaining > 0;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        smallLogo
        title="SeedKey Auth"
        rightElement={
          <Button variant="icon" onClick={onSettings}>
            ⚙️
          </Button>
        }
      />

      <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div className="text-3xl">✅</div>
        <div className="flex flex-col">
          <strong className="text-base">{t('identityActive')}</strong>
        </div>
      </div>

      {/* Seed phrase availability notice */}
      {canShowSeed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <p className="text-amber-800 text-sm mb-3">
            ⏱️ {t('seedPhraseAvailable')}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-600">
              {t('timeRemaining')}: <strong>{formatTime(timeRemaining)}</strong>
            </span>
            <Button
              variant="secondary"
              onClick={handleShowSeed}
              disabled={isLoading}
              isLoading={isLoading}
            >
              {t('showSeedPhrase')}
            </Button>
          </div>
        </div>
      )}

      {/* Seed phrase modal */}
      {showSeedModal && seedPhrase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-4">{t('seedPhraseTitle')}</h3>
            
            <div className="bg-amber-50 text-amber-800 py-2 px-3 rounded-lg mb-4 text-xs">
              {t('seedWarning')}
            </div>

            <div 
              className="grid grid-cols-3 gap-2 mb-4 cursor-pointer"
              onClick={handleCopySeed}
              title={t('clickToCopy')}
            >
              {seedPhrase.split(' ').map((word, index) => (
                <div
                  key={index}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-center font-mono hover:bg-slate-100 transition-colors"
                >
                  <span className="text-slate-400 text-[10px] block">{index + 1}</span>
                  {word}
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 text-center mb-4">
              {t('clickToCopy')}
            </p>

            <Button variant="primary" onClick={closeSeedModal} className="w-full">
              {t('continue')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
