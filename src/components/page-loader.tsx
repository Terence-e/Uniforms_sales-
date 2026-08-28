import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * Full-area in-app loader shown by route `loading.tsx` files and while data is
 * fetched — so the app itself signals progress instead of leaving a blank frame.
 */
export function PageLoader({
  label,
  className
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[60dvh] w-full flex-col items-center justify-center gap-4',
        className
      )}
    >
      <Spinner className="size-10 border-[3px]" />
      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
    </div>
  );
}
