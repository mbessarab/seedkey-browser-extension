/**
 * Supports variants: primary, secondary, danger, link, icon, back.
 * Automatically shows "Loading..." text when isLoading is true.
 */

import type { JSX, ComponentChildren } from 'preact';

/** Button style variants */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'icon' | 'back';

/** Props for the Button component */
interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'loading'> {
  variant?: ButtonVariant;
  children: ComponentChildren;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'w-full inline-flex items-center justify-center px-5 py-3.5 rounded-lg text-[15px] font-semibold cursor-pointer border-none transition-all duration-200 bg-primary text-background hover:bg-primary-hover hover:shadow-glow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
  secondary: 'w-full inline-flex items-center justify-center px-5 py-3.5 rounded-lg text-[15px] font-medium cursor-pointer transition-all duration-200 bg-background-elevated text-text border border-border hover:bg-secondary hover:border-primary/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'w-full inline-flex items-center justify-center px-5 py-3.5 rounded-lg text-[15px] font-medium cursor-pointer border-none transition-all duration-200 bg-danger text-white hover:bg-danger-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  link: 'w-full inline-flex items-center justify-center p-2 rounded-lg text-[15px] font-medium cursor-pointer border-none transition-all duration-200 bg-transparent text-primary hover:text-primary-hover hover:underline disabled:opacity-50 disabled:cursor-not-allowed',
  icon: 'bg-transparent border-none text-xl cursor-pointer p-2 rounded-lg text-text-muted hover:bg-background-elevated hover:text-primary transition-colors',
  back: 'bg-transparent border-none text-xl cursor-pointer py-1.5 px-2.5 rounded-lg mr-1 text-text-muted hover:bg-background-elevated hover:text-primary transition-colors',
};

/**
 * Generic button with variants and a loading state.
 */
export function Button({
  variant = 'primary',
  children,
  isLoading,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}
