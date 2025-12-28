/**
 * Loading spinner component
 *
 * Renders an animated spinner with optional text.
 */

/** Props for the Spinner component */
interface SpinnerProps {
  text?: string;
}

/**
 * Loading spinner with text.
 */
export function Spinner({ text = 'Loading...' }: SpinnerProps) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center text-center animate-fade-in">
      <div className="relative mb-6">
        <img 
          src="/icon/icon-300x300.png" 
          alt="SeedKey Logo" 
          className="w-20 h-20 drop-shadow-[0_0_30px_rgba(34,211,187,0.5)] animate-pulse"
        />
        <div className="absolute inset-0 w-20 h-20 border-[3px] border-transparent border-t-primary rounded-full animate-spin" />
      </div>
      <p className="text-text-muted text-sm tracking-wide">{text}</p>
    </div>
  );
}
