/**
 * Supports variants: primary, secondary, danger, link, icon, back.
 * Automatically shows "Loading..." text when isLoading is true.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Button style variants */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link' | 'icon' | 'back';

/** Props for the Button component */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'w-full inline-flex items-center justify-center px-5 py-3 rounded-lg text-[15px] font-medium cursor-pointer border-none transition-all duration-200 bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'w-full inline-flex items-center justify-center px-5 py-3 rounded-lg text-[15px] font-medium cursor-pointer transition-all duration-200 bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'w-full inline-flex items-center justify-center px-5 py-3 rounded-lg text-[15px] font-medium cursor-pointer border-none transition-all duration-200 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed',
  link: 'w-full inline-flex items-center justify-center p-2 rounded-lg text-[15px] font-medium cursor-pointer border-none transition-all duration-200 bg-transparent text-indigo-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed',
  icon: 'bg-transparent border-none text-xl cursor-pointer p-1 rounded-lg hover:bg-slate-50',
  back: 'bg-transparent border-none text-xl cursor-pointer py-1 px-2 rounded-lg mr-1 hover:bg-slate-50',
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
