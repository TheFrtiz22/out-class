"use client"
import { useLayoutEffect, useState } from "react"

/** The page header renders an empty slot with this id when a view may put its own actions beside the title. */
export const PAGE_HEADER_ACTIONS_ID = "workspace-page-actions"

/**
 * The page header's action slot, for a view to portal its buttons into: `undefined` before the first
 * layout pass, `null` when this page has no slot (render the actions inline instead). Re-resolved after
 * every commit, so a remounted header never leaves the portal on a detached node; setState bails out
 * while the element is unchanged.
 */
export function usePageHeaderActions() {
  const [slot, setSlot] = useState<HTMLElement | null | undefined>(undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally every commit
  useLayoutEffect(() => { setSlot(document.getElementById(PAGE_HEADER_ACTIONS_ID)) })
  return slot
}
