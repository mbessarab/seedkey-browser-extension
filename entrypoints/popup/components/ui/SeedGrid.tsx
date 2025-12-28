/**
 * Component for displaying a seed phrase as a word grid
 * 
 * Displays each word with an index number for easier backup.
 */

import { useState, useCallback } from 'preact/hooks';
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
    <div className="animate-fade-in">
      <div 
        className="grid grid-cols-3 gap-2.5 mb-3 cursor-pointer"
        onClick={handleCopy}
        title={t('clickToCopy')}
      >
        {words.map((word, index) => (
          <div
            key={index}
            className="bg-background-card border border-border rounded-lg p-2.5 text-sm text-center font-mono text-text hover:bg-background-elevated hover:border-primary/50 hover:shadow-glow-sm transition-all duration-200"
          >
            <span className="text-primary/60 text-[10px] font-sans font-medium block mb-1">{index + 1}</span>
            {word}
          </div>
        ))}
      </div>
      
      {/* Copy hint */}
      <p className="text-xs text-text-muted text-center mb-3">
        {copied ? (
          <span className="text-success font-medium">✓ {t('seedCopied')}</span>
        ) : (
          t('clickToCopy')
        )}
      </p>
    </div>
  );
}
