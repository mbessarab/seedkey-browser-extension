/**
 * Header component.
 *
 * A universal header for all popup screens.
 * Supports a back button, logo, and extra elements on the right.
 */

import type { ComponentChildren } from 'preact';
import { Button } from '../ui/Button';

/** Props for the Header component */
interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: ComponentChildren;
  logo?: boolean;
  smallLogo?: boolean;
}

/**
 * Header with an optional back button, logo, and right-side element.
 */
export function Header({
  title,
  showBack,
  onBack,
  rightElement,
  logo,
  smallLogo,
}: HeaderProps) {
  return (
    <div className={`flex items-center gap-3 mb-5 ${logo ? 'flex-col mb-4' : ''}`}>
      {showBack && (
        <Button variant="back" onClick={onBack}>
          ←
        </Button>
      )}
      {logo && (
        <img 
          src="/icon/icon-300x300.png" 
          alt="SeedKey Logo" 
          className="w-25 h-25 drop-shadow-[0_0_25px_rgba(34,211,187,0.4)] animate-fade-in"
        />
      )}
      {smallLogo && (
        <img 
          src="/icon/icon-300x300.png" 
          alt="SeedKey Logo" 
          className="w-9 h-9 drop-shadow-[0_0_10px_rgba(34,211,187,0.3)]"
        />
      )}
      {logo ? (
        <h1 className="text-2xl font-bold flex-1 bg-gradient-to-r from-primary to-text-accent bg-clip-text">{title}</h1>
      ) : (
        <h2 className="text-lg font-semibold flex-1 text-text">{title}</h2>
      )}
      {rightElement}
    </div>
  );
}
