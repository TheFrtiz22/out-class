import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** Use plain sections and Divider first; Surface is for meaningful grouping. */
export function Surface({ className, tone = "plain", density = "compact", ...props }: ComponentProps<"div"> & { tone?: "plain" | "subtle" | "outlined" | "elevated" | "brand"; density?: "compact" | "roomy" }) {
  return <div data-slot="surface" data-tone={tone} data-density={density} className={cn("text-foreground", {
    plain: "bg-transparent",
    subtle: "rounded-lg bg-muted p-content",
    elevated: "rounded-xl bg-card p-content shadow-[var(--oc-shadow-surface)]",
    brand: "rounded-xl bg-primary p-content text-primary-foreground",
    outlined: "rounded-lg border border-border bg-card p-content",
  }[tone], className)} {...props} />
}
