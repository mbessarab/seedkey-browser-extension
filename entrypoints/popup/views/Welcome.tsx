/**
 * Welcome screen
 * 
 * Shown on the first extension launch.
 * Offers to create a new identity or restore an existing one.
 */

import { Header, Button } from '../components';
import { useI18n } from '../hooks';

/** Props for the Welcome component */
interface WelcomeProps {
  onCreateIdentity: () => void;
  onRestore: () => void;
  isLoading?: boolean;
}

/**
 * Welcome screen with a choice between creating or restoring an identity.
 */
export function Welcome({ onCreateIdentity, onRestore, isLoading }: WelcomeProps) {
  const { t } = useI18n();

  return (
    <div className="flex-1 flex flex-col text-center justify-center">
      <Header logo title="SeedKey Auth" />
      
      <p className="text-slate-500 mb-6 text-center">
        {t('welcomeDescription')}
      </p>
      
      <div className="flex flex-col gap-3 mt-auto">
        <Button
          variant="primary"
          onClick={onCreateIdentity}
          disabled={isLoading}
          isLoading={isLoading}
        >
          {t('createIdentity')}
        </Button>
        <Button
          variant="secondary"
          onClick={onRestore}
          disabled={isLoading}
        >
          {t('restore')}
        </Button>
      </div>
    </div>
  );
}
