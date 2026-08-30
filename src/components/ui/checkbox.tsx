'use client';

import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * suppressHydrationWarning: form-filler browser extensions stamp an
 * `fdprocessedid` attribute onto every interactive element after the server
 * HTML arrives but before React hydrates, which React reports as a mismatch on
 * every input and button on the page. The attribute comes from the visitor's
 * browser, so no server change can prevent it.
 *
 * This suppresses ATTRIBUTE mismatch reporting on this element only -- not its
 * children, not text content, and not any other element. The cost is real
 * though narrow: a genuine attribute difference here would also go unreported,
 * so if this element ever renders differently on server and client, you will
 * not be told. Do not spread this flag onto containers or layout elements.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      suppressHydrationWarning
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
