import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"

type PanelTag = "div" | "section" | "article" | "aside"
/**
 * The one content container: card surface, content padding, edge and radius from tokens
 * (`.oc-content-panel`). `tone="subtle"` is a muted fill without the card edge.
 * Use plain sections first; a Panel is for meaningful grouping.
 */
export function Panel({ as: Tag = "div", tone = "card", className, ...props }: ComponentPropsWithoutRef<"section"> & { as?: PanelTag; tone?: "card" | "subtle" }) {
  return <Tag data-slot="panel" data-tone={tone} className={cn("oc-content-panel", className)} {...props} />
}
