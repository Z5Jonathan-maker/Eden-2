import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-4 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400 [&>svg]:text-red-500",
        success:
          "border-green-500/30 bg-green-500/10 text-green-400 [&>svg]:text-green-500",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-400 [&>svg]:text-amber-500",
        info:
          "border-blue-500/30 bg-blue-500/10 text-blue-400 [&>svg]:text-blue-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props} />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    {...props} />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed opacity-90", className)}
    {...props} />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
