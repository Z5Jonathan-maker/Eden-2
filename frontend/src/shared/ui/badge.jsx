import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80 hover:shadow",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80",
        outline: "text-foreground border-border",
        success:
          "border-transparent bg-green-100 text-green-700 hover:bg-green-200",
        warning:
          "border-transparent bg-amber-100 text-amber-700 hover:bg-amber-200",
        info:
          "border-transparent bg-blue-100 text-blue-700 hover:bg-blue-200",
        // Tactical/Gaming Rarity Variants
        common:
          "bg-zinc-600/30 text-zinc-300 border-zinc-500/30",
        uncommon:
          "bg-green-600/20 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]",
        rare:
          "bg-blue-600/20 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]",
        epic:
          "bg-purple-600/20 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
        legendary:
          "bg-yellow-600/20 text-yellow-400 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.3)]",
        mythic:
          "bg-red-600/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
