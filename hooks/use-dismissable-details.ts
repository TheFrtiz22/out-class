"use client"

import { useCallback } from "react"

/**
 * Menu behaviour for a native `<details>` popover (e.g. Filters): Escape closes it and returns
 * focus to its summary, and a pointer press outside closes it. Pass the result as the element's `ref`.
 */
export function useDismissableDetails() {
  return useCallback((details: HTMLDetailsElement | null) => {
    if (!details) return
    const outside = (event: PointerEvent) => {
      if (details.open && event.target instanceof Node && !details.contains(event.target)) details.open = false
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !details.open) return
      // Close only this menu, not an enclosing dialog or drawer.
      event.preventDefault()
      event.stopPropagation()
      details.open = false
      details.querySelector<HTMLElement>(":scope > summary")?.focus()
    }
    document.addEventListener("pointerdown", outside)
    details.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      details.removeEventListener("keydown", escape)
    }
  }, [])
}
