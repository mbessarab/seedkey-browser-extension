/**
 * Header component.
 *
 * A universal header for all popup screens.
 * Supports a back button, logo, and extra elements on the right.
 */

import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

/** Props for the Header component */
interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: ReactNode;
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
      {logo && <div className="text-5xl mb-2">🔐</div>}
      {smallLogo && <div className="text-2xl">🔐</div>}
      {logo ? (
        <h1 className="text-xl font-semibold flex-1">{title}</h1>
      ) : (
        <h2 className="text-lg font-semibold flex-1">{title}</h2>
      )}
      {rightElement}
    </div>
  );
}
