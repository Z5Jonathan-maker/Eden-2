import * as React from "react"

import { cn } from "../../lib/utils"

const Input = React.forwardRef(({ className, type, tactical = false, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-700/50 bg-[#0a0a0a] px-3 py-2 text-base text-zinc-200 shadow-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-400 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-zinc-600",
        tactical && "bg-zinc-900/80 border-zinc-600/50 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/70 focus:ring-orange-500/20 focus:shadow-[0_0_20px_rgba(234,88,12,0.15)]",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
