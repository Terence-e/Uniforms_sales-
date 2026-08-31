import * as React from "react"

import { cn } from "@/lib/utils"

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
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      suppressHydrationWarning
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
