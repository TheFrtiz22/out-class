"use client"

import { useEffect, useState } from "react"
import { Search } from "@/components/icons"
import { Button } from "@/components/ui/button"

/** One responsive trigger opens the existing global search dialog. */
export function FloatingSearchTrigger({ open, onOpen }: { open: boolean; onOpen: (trigger: HTMLButtonElement) => void }) {
  const [mac, setMac] = useState(true)
  useEffect(() => { setMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform)) }, [])
  return <Button type="button" variant="ghost" className="oc-global-search oc-floating-search" aria-label={`Search OutClass ${mac ? "⌘ K" : "Ctrl K"}`} aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Meta+K Control+K" onClick={event => onOpen(event.currentTarget)}>
    <Search size={20} aria-hidden="true" />
    <span className="oc-floating-search-label">Search OutClass</span>{" "}
    <kbd aria-hidden="true">{mac ? "⌘ K" : "Ctrl K"}</kbd>
  </Button>
}
