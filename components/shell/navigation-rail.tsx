"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactElement } from "react"
import { DockBrand } from "./dock-brand"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ProductNavItem } from "@/lib/product-navigation"
import type { RailSection } from "@/lib/navigation"

type RenderItem = (item: ProductNavItem, surface: "rail") => ReactElement

/** Labels are permanent from this width; below it the rail shows icons with tooltips. */
export const RAIL_LABEL_QUERY = "(min-width: 1280px)"
function subscribe(callback: () => void) {
  const media = window.matchMedia(RAIL_LABEL_QUERY)
  media.addEventListener("change", callback)
  return () => media.removeEventListener("change", callback)
}
function useLabelledRail() {
  // The server renders labels; CSS hides them below 1280px before hydration, so nothing shifts.
  return useSyncExternalStore(subscribe, () => window.matchMedia(RAIL_LABEL_QUERY).matches, () => true)
}

/**
 * Shows an item's name beside an icon-only rail. The tree is the same at every width,
 * so crossing 1280px never remounts (or unfocuses) a rail item; it only stops opening.
 */
function RailTip({ label, enabled, children }: { label: string; enabled: boolean; children: ReactElement }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  // A modal (the applicant review) disables pointer events on the page, so the trigger never hears the
  // pointer leave. Close on any pointer movement or focus away from the trigger instead.
  useEffect(() => {
    if (!open) return
    const away = (event: Event) => { if (!trigger.current?.contains(event.target as Node | null)) setOpen(false) }
    document.addEventListener("pointermove", away, true)
    document.addEventListener("pointerdown", away, true)
    document.addEventListener("focusin", away, true)
    return () => { document.removeEventListener("pointermove", away, true); document.removeEventListener("pointerdown", away, true); document.removeEventListener("focusin", away, true) }
  }, [open])
  // Rail labels sit below dialog overlays (z-index), so one can never cover a dialog.
  return <Tooltip open={enabled && open} onOpenChange={setOpen}><TooltipTrigger ref={trigger} asChild>{children}</TooltipTrigger><TooltipContent side="right" sideOffset={14} className="oc-rail-tooltip z-[calc(var(--oc-z-overlay)_-_1)]">{label}</TooltipContent></Tooltip>
}

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * One active marker for the whole rail, placed on the current item's measured box, so it slides
 * between items when the URL changes (the rail never remounts in the persistent shell). Until it is
 * measured, and with no active item, each item's own ::before marker shows instead.
 */
function useRailMarker(container: React.RefObject<HTMLDivElement | null>, active: string | null, sections: RailSection[]) {
  const key = sections.map(section => section.items.map(item => item.id).join()).join("|")
  useBrowserLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const place = () => {
      const item = el.querySelector<HTMLElement>(':scope nav :is([aria-current="page"],[data-active="true"])')
      if (!item || !item.offsetHeight) { el.removeAttribute("data-marker"); return }
      const box = el.getBoundingClientRect(), rect = item.getBoundingClientRect()
      el.style.setProperty("--rail-marker-y", `${rect.top - box.top + 16}px`)
      el.style.setProperty("--rail-marker-height", `${rect.height - 32}px`)
      el.style.setProperty("--rail-marker-x", `${rect.left - box.left}px`)
      el.setAttribute("data-marker", "true")
    }
    place()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(place)
    observer.observe(el)
    return () => observer.disconnect()
  }, [container, active, key])
}

/** Desktop rail. Routes, permission filtering and leave guards stay in ProductShell and lib/navigation. */
export function NavigationRail({ sections, active, renderItem, onHome }: {
  sections: RailSection[]; active: string | null; renderItem: RenderItem; onHome: () => void
}) {
  const labelled = useLabelledRail()
  const content = useRef<HTMLDivElement>(null)
  useRailMarker(content, active, sections)
  return <aside className="oc-expanding-dock hidden lg:block" aria-label="Workspace navigation" data-rail-labels={labelled}>
    <div className="oc-context-sidebar oc-dock-rail">
      <RailTip label="OutClass home" enabled={!labelled}><button type="button" className="oc-dock-brand" aria-label="OutClass home" onClick={onHome}><DockBrand /></button></RailTip>
      <div className="oc-dock-navigation"><div className="oc-dock-navigation-content" ref={content}>
        <span className="oc-dock-marker" aria-hidden="true" />
        {/* Every rail item is a page link: no flyouts. A pinned section (Settings) sits at the bottom of the rail. */}
        {sections.filter(section => section.items.length).map(section => <section key={section.id} className="oc-dock-section" data-tour={section.tour} data-pinned={section.pinned || undefined}>
          {section.label && <p className="oc-dock-section-heading" aria-hidden="true">{section.label}</p>}
          <nav aria-label={section.label ?? section.name}>{section.items.map(item => <RailTip key={item.id} label={item.label} enabled={!labelled}>{renderItem(item, "rail")}</RailTip>)}</nav>
        </section>)}
      </div></div>
    </div>
  </aside>
}
