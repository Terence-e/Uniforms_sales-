import { cn } from '@/lib/utils';

/** In-app loading spinner (orange by default). Size via className, e.g. `size-6`. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary',
        className
      )}
    />
  );
}
