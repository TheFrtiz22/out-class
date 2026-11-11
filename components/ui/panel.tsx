import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"

type PanelTag = "div" | "section" | "article" | "aside"
/**
 * The one content container: card surface, content padding, edge and radius from tokens
 * (`.oc-content-panel`). `tone="subtle"` is a muted fill without the card edge.
 * Use plain sections first; a Panel is for meaningful grouping.
 * The card tone is glass without blur by default: `.oc-content-panel` reads the content tokens, which
 * resolve to --oc-surface-glass. `variant` opts into raised or navy glass ("glass-raised" and
 * "glass-navy" may blur); `variant="solid"` is opaque, for dense data. The subtle tone keeps its muted fill.
 */
export function Panel({ as: Tag = "div", tone = "card", variant, className, ...props }: ComponentPropsWithoutRef<"section"> & { as?: PanelTag; tone?: "card" | "subtle"; variant?: "default" | "solid" | "glass" | "glass-raised" | "glass-navy" }) {
  return <Tag data-slot="panel" data-tone={tone} data-variant={variant && variant !== "default" ? variant : undefined} className={cn("oc-content-panel", className)} {...props} />
}
