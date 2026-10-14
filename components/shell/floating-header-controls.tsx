"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ProductNavItem } from "@/lib/product-navigation"

/** Routing owns selection; the decorative indicator never owns another mode. */
export function FloatingModeNavigation({ modes, mode, children, "aria-label": label = "Product modes" }: {
  modes: ProductNavItem[]
  mode: string
  children: ReactNode
  "aria-label"?: string
}) {
  const index = modes.findIndex(item => item.id === mode)
  return <nav aria-label={label} className="oc-floating-modes" data-has-active={index >= 0} style={{ "--mode-count": modes.length, "--mode-index": Math.max(0, index) } as CSSProperties}>
    <span className="oc-floating-mode-indicator" aria-hidden="true" />
    {children}
  </nav>
}

/** One responsive trigger opens the existing global search dialog. */
export function FloatingSearchTrigger({ open, onOpen }: { open: boolean; onOpen: (trigger: HTMLButtonElement) => void }) {
  const [mac, setMac] = useState(true)
  useEffect(() => { setMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform)) }, [])
  return <Button type="button" variant="ghost" className="oc-global-search oc-floating-search" aria-label="Search OutClass" aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Meta+K Control+K" onClick={event => onOpen(event.currentTarget)}>
    <Search size={20} aria-hidden="true" />
    <span className="oc-floating-search-label">Search OutClass</span>
    <kbd aria-hidden="true">{mac ? "⌘ K" : "Ctrl K"}</kbd>
  </Button>
}
