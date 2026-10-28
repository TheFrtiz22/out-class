import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** Use plain sections and Divider first; Surface is for meaningful grouping. */
export function Surface({ className, tone = "plain", density = "compact", ...props }: ComponentProps<"div"> & { tone?: "plain" | "subtle" | "outlined" | "elevated" | "brand"; density?: "compact" | "roomy" }) {
  return <div data-slot="surface" data-tone={tone} data-density={density} className={cn("text-foreground", {
    plain: "bg-transparent",
    subtle: "rounded-[var(--oc-content-radius)] bg-muted ",
    elevated: "rounded-[var(--oc-content-radius)] bg-card  border border-[var(--oc-content-edge)] shadow-[var(--oc-content-shadow)]",
    brand: "rounded-[var(--oc-content-radius)] bg-primary  text-primary-foreground",
    outlined: "rounded-[var(--oc-content-radius)] border border-border bg-card ",
  }[tone], tone !== "plain" && (density === "roomy" ? "p-section" : "p-content"), className)} {...props} />
}
