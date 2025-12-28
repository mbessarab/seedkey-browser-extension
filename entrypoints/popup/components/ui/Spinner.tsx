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
    <div className="flex-1 flex flex-col justify-center items-center text-center">
      <div className="w-10 h-10 border-[3px] border-slate-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-slate-500">{text}</p>
    </div>
  );
}
