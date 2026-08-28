import { cn } from '@/lib/utils';

/**
 * The school's dove + wordmark, rebuilt as vector art so it stays crisp at any
 * size (the original raster was low-resolution and blurry). Green is the school's
 * identity colour; it reads cleanly on both light and dark surfaces.
 */

type Size = 'sm' | 'md' | 'lg';

const ICON: Record<Size, string> = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-12 w-12' };
const TITLE: Record<Size, string> = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' };
const SUB: Record<Size, string> = { sm: 'text-[9px]', md: 'text-[10px]', lg: 'text-xs' };

export function DoveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dove-g" x1="6" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3aa17e" />
          <stop offset="1" stopColor="#1f6d54" />
        </linearGradient>
      </defs>
      {/* Dove in flight: raised wing, body, sweeping tail. */}
      <path
        d="M41 9C31 9 23 12 17 18C15.5 15 12.5 13.2 8.5 12.6C11.4 15 12.6 18.2 12 22C15.2 19.4 18.8 18.4 22.8 19C19.8 21.6 17.8 25.2 16.8 30C20 26 24 23.4 28.6 22.4C26 25.6 24.6 29.4 24.6 33.8C28.4 27.8 33.2 22.6 41 9Z"
        fill="url(#dove-g)"
      />
      {/* Olive sprig */}
      <path
        d="M14 34c3.6.2 6.6 1.6 9 4.2"
        stroke="#1f6d54"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="14.5" cy="33.4" r="1.3" fill="#7bbf5d" />
      <circle cx="18" cy="35.6" r="1.3" fill="#7bbf5d" />
    </svg>
  );
}

export function SchoolLogo({
  size = 'md',
  showText = true,
  className
}: {
  size?: Size;
  showText?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <DoveMark className={ICON[size]} />
      {showText && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-semibold tracking-tight text-[#1f6d54]', TITLE[size])}>
            Fondation
          </span>
          <span
            className={cn(
              'mt-0.5 font-medium uppercase tracking-[0.14em] text-[#2c7a57]/80',
              SUB[size]
            )}
          >
            Révélation Ste Thérèse
          </span>
        </span>
      )}
    </span>
  );
}
