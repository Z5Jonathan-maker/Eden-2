import * as React from "react"

import { cn } from "../../lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-lg border border-zinc-700/50 bg-[#0a0a0a] px-3 py-2 text-base text-zinc-200 shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/30 focus-visible:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
