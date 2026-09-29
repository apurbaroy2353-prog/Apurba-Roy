import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingOverlayProps {
  /** Primary status text to display (e.g. 'Loading gallery...', 'Saving...') */
  statusText?: string;
  /** Optional secondary descriptive message */
  subtext?: string;
  /** Presentation variant: 'fullscreen' page, 'overlay' backdrop modal, or 'floating' pill */
  variant?: 'fullscreen' | 'overlay' | 'floating' | 'inline';
  /** Spinner size */
  spinnerSize?: 'sm' | 'md' | 'lg';
  /** Custom icon override */
  icon?: React.ReactNode;
  /** Background backdrop intensity */
  backdrop?: 'solid' | 'blur' | 'subtle';
  /** Additional CSS classes */
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  statusText = 'Loading gallery...',
  subtext,
  variant = 'fullscreen',
  spinnerSize = 'md',
  icon,
  backdrop = 'blur',
  className = '',
}) => {
  const spinnerDimensions = {
    sm: 'w-4 h-4',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  }[spinnerSize];

  const defaultSpinner = icon || (
    <Loader2 className={`${spinnerDimensions} animate-spin text-amber-400`} />
  );

  // Floating indicator (e.g. subtle top pill for auto-saving)
  if (variant === 'floating') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ${className}`}
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-stone-900/90 border border-amber-500/30 text-stone-200 shadow-2xl backdrop-blur-md">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span className="text-xs font-semibold tracking-wide text-stone-100">{statusText}</span>
          {subtext && <span className="text-[11px] text-stone-400 border-l border-stone-700 pl-2">{subtext}</span>}
        </div>
      </div>
    );
  }

  // Inline container
  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col items-center justify-center p-6 text-stone-300 ${className}`}
      >
        <div className="mb-3">{defaultSpinner}</div>
        <p className="text-sm font-medium text-stone-200">{statusText}</p>
        {subtext && <p className="text-xs text-stone-400 mt-1 text-center">{subtext}</p>}
      </div>
    );
  }

  // Modal-style overlay backdrop (e.g. while submitting or batch-clearing)
  if (variant === 'overlay') {
    const backdropBg =
      backdrop === 'solid'
        ? 'bg-stone-950/90'
        : backdrop === 'subtle'
        ? 'bg-stone-950/50 backdrop-blur-xs'
        : 'bg-stone-950/70 backdrop-blur-sm';

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={statusText}
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${backdropBg} transition-opacity duration-200 ${className}`}
      >
        <div className="relative flex flex-col items-center justify-center bg-stone-900/95 border border-stone-800 shadow-2xl rounded-2xl p-6 sm:p-8 max-w-sm w-full mx-auto text-center transform transition-transform animate-in fade-in zoom-in-95 duration-200">
          <div className="relative mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-md animate-pulse" />
            <div className="relative w-12 h-12 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-center shadow-inner">
              {defaultSpinner}
            </div>
          </div>

          <h3 className="text-base font-semibold text-stone-100 tracking-wide">{statusText}</h3>
          {subtext && <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{subtext}</p>}
        </div>
      </div>
    );
  }

  // Fullscreen page loader (e.g. initial gallery fetch)
  const fullBackdrop =
    backdrop === 'solid'
      ? 'bg-stone-950'
      : backdrop === 'subtle'
      ? 'bg-stone-950/90'
      : 'bg-stone-950/95 backdrop-blur-md';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`min-h-screen fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-stone-200 ${fullBackdrop} ${className}`}
    >
      <div className="relative flex flex-col items-center justify-center text-center max-w-md mx-auto">
        {/* Brand / Decorative badge with spinner */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="absolute -inset-2 rounded-2xl bg-amber-500/15 blur-lg animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shadow-2xl">
            {icon || <Loader2 className="w-8 h-8 animate-spin text-amber-400" />}
          </div>
        </div>

        {/* Primary status text */}
        <h2 className="text-lg font-serif font-medium text-stone-100 tracking-wide mb-1">
          {statusText}
        </h2>

        {/* Secondary helper text */}
        {subtext ? (
          <p className="text-xs text-stone-400 tracking-wider font-mono">{subtext}</p>
        ) : (
          <p className="text-xs text-stone-500 font-mono tracking-widest uppercase">
            RC Photography
          </p>
        )}
      </div>
    </div>
  );
};
