import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** Use plain sections and Divider first; Surface is for meaningful grouping. */
export function Surface({ className, tone = "plain", ...props }: ComponentProps<"div"> & { tone?: "plain" | "subtle" | "outlined" }) {
  return <div data-slot="surface" className={cn("text-foreground", {
    plain: "bg-transparent",
    subtle: "rounded-lg bg-muted p-content",
    outlined: "rounded-lg border border-border bg-card p-content",
  }[tone], className)} {...props} />
}
