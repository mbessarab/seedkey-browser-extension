/**
 * Component for displaying a seed phrase as a word grid
 * 
 * Displays each word with an index number for easier backup.
 */

import { useState, useCallback } from 'react';
import { useI18n } from '../../hooks';

/** Props for the SeedGrid component */
interface SeedGridProps {
  seedPhrase: string;
}

/**
 * Seed phrase word grid with numbering.
 * Click copies the whole phrase to the clipboard.
 */
export function SeedGrid({ seedPhrase }: SeedGridProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const words = seedPhrase.split(' ');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(seedPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy seed phrase:', err);
    }
  }, [seedPhrase]);

  return (
    <div>
      <div 
        className="grid grid-cols-3 gap-2 mb-2 cursor-pointer"
        onClick={handleCopy}
        title={t('clickToCopy')}
      >
        {words.map((word, index) => (
          <div
            key={index}
            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-center font-mono hover:bg-slate-100 hover:border-indigo-300 transition-colors"
          >
            <span className="text-slate-500 text-xs block mb-0.5">{index + 1}</span>
            {word}
          </div>
        ))}
      </div>
      
      {/* Copy hint */}
      <p className="text-xs text-slate-400 text-center mb-3">
        {copied ? (
          <span className="text-green-600 font-medium">✓ {t('seedCopied')}</span>
        ) : (
          t('clickToCopy')
        )}
      </p>
    </div>
  );
}
