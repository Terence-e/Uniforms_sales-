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

const HEIGHT: Record<Size, string> = { sm: 'h-8', md: 'h-10', lg: 'h-14' };
const TEXT: Record<Size, string> = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };

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
      className={cn('w-auto object-contain', HEIGHT[size], className)}
      style={{ filter: 'contrast(1.06) saturate(1.08)' }}
    />
  );
}
