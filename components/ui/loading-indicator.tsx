import type { ComponentProps } from "react"
import { LoaderCircle } from "@/components/icons"
import { cn } from "@/lib/utils"

/** Decorative activity only. The containing region or button owns its announcement. */
export function LoadingIndicator({ className, size = "md", ...props }: Omit<ComponentProps<"span">, "children"> & { size?: "sm" | "md" | "lg" }) {
  return <span {...props} data-slot="loading-indicator" data-size={size} aria-hidden="true" className={cn("oc-loading-indicator", className)}>
    <LoaderCircle className="size-full" size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />
  </span>
}
