'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Renders the school's own logo image (the full dove + wordmark lockup the school
 * provided). Drop the file at `public/logo.png` (or .svg). A light contrast/
 * saturation nudge sharpens the low-resolution original without altering it.
 *
 * If the file is missing it falls back to the school name so nothing looks broken.
 */

type Size = 'sm' | 'md' | 'lg';

// Sized generously and bumped up a step on wider screens so the lockup reads
// clearly in headers, the sidebar and on printed A5 sheets alike. `w-auto` +
// `max-w-full` keep the wide wordmark fitting whatever it is dropped into
// without ever overflowing its container.
const HEIGHT: Record<Size, string> = {
  sm: 'h-10 sm:h-12',
  md: 'h-14 sm:h-16',
  lg: 'h-20 sm:h-24'
};
const TEXT: Record<Size, string> = {
  sm: 'text-base sm:text-lg',
  md: 'text-lg sm:text-xl',
  lg: 'text-2xl sm:text-3xl'
};

export function SchoolLogo({
  size = 'md',
  className
}: {
  size?: Size;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={cn('font-semibold tracking-tight text-[#1f6d54]', TEXT[size], className)}>
        Fondation Révélation Ste Thérèse
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local asset, no optimization needed
    <img
      src="/logo.png"
      alt="Fondation Révélation Sainte Thérèse"
      onError={() => setFailed(true)}
      className={cn('w-auto max-w-full object-contain', HEIGHT[size], className)}
      style={{ filter: 'contrast(1.1) saturate(1.12)' }}
    />
  );
}
