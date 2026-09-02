'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The school's own logo lockup (dove + wordmark). Drop the file at
 * `public/logo.png` (or .svg). Falls back to the school name if it is missing.
 *
 * The supplied file has a baked-in WHITE background, which looks wrong as a hard
 * rectangle -- especially in dark mode. Two theme-aware tricks fix that without
 * editing the image:
 *
 *   - Light themes: `mix-blend-multiply` blends the white backdrop into the
 *     (light) surface behind it, so the box disappears and only the artwork
 *     shows -- on the white cards and the pale login page alike.
 *   - Dark themes: multiply would swallow the logo, so instead it sits on a soft
 *     rounded white chip with padding. The white background then reads as a
 *     deliberate badge rather than a stray rectangle, and the colours stay true.
 */

type Size = 'sm' | 'md' | 'lg';

// Larger than before for presence, still capped by max-w-full so the wide
// wordmark never overflows. Crispness is bounded by the source file -- a bigger
// PNG or an SVG at public/logo.png removes any softness at these sizes.
const HEIGHT: Record<Size, string> = {
  sm: 'h-12 sm:h-14',
  md: 'h-16 sm:h-20',
  lg: 'h-24 sm:h-28'
};
const TEXT: Record<Size, string> = {
  sm: 'text-lg sm:text-xl',
  md: 'text-xl sm:text-2xl',
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
    <span
      className={cn(
        'inline-flex max-w-full items-center justify-center',
        // Dark mode: give the white-backed logo a clean rounded chip so it reads
        // as intentional; light mode leaves it bare and lets multiply blend it.
        'dark:rounded-xl dark:bg-white/95 dark:p-2 dark:shadow-sm dark:ring-1 dark:ring-black/5',
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local asset, no optimization needed */}
      <img
        src="/logo.png"
        alt="Fondation Révélation Sainte Thérèse"
        onError={() => setFailed(true)}
        className={cn(
          'w-auto max-w-full object-contain mix-blend-multiply dark:mix-blend-normal',
          HEIGHT[size]
        )}
        style={{ filter: 'contrast(1.08) saturate(1.12)' }}
      />
    </span>
  );
}
