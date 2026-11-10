"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactElement } from "react"
import { CheckCircle2, ChevronRight, Users2 } from "@/components/icons"
import { DockBrand } from "./dock-brand"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { navigationGroupLabels, type ProductNavItem } from "@/lib/product-navigation"
import type { RailSection } from "@/lib/navigation"

type Group = NonNullable<ProductNavItem["navGroup"]>
type RenderItem = (item: ProductNavItem, surface: "rail" | "flyout") => ReactElement

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
        {sections.filter(section => section.items.length).map(section => {
          const rendered = new Set<Group>()
          return <section key={section.id} className="oc-dock-section" data-tour={section.tour}>
            {section.label && <p className="oc-dock-section-heading" aria-hidden="true">{section.label}</p>}
            <nav aria-label={section.label ?? section.name}>{section.items.map(item => {
              if (!item.navGroup) return <RailTip key={item.id} label={item.label} enabled={!labelled}>{renderItem(item, "rail")}</RailTip>
              if (rendered.has(item.navGroup)) return null
              const group = item.navGroup; rendered.add(group)
              return <RailGroup key={group} group={group} items={section.items.filter(child => child.navGroup === group)} active={active} tooltip={!labelled} renderItem={renderItem} />
            })}</nav>
          </section>
        })}
      </div></div>
    </div>
  </aside>
}

/** Applicants and Decisions open a menu of their destinations on click or with the arrow keys. */
function RailGroup({ group, items, active, tooltip, renderItem }: { group: Group; items: ProductNavItem[]; active: string | null; tooltip: boolean; renderItem: RenderItem }) {
  const [open, setOpen] = useState(false)
  const keyboardOpen = useRef(false), trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null)
  const selected = items.some(item => item.id === active), Icon = group === "applicants" ? Users2 : CheckCircle2
  const label = navigationGroupLabels[group], id = useId()
  useEffect(() => { setOpen(false) }, [active])
  function focusDestination(last = false) {
    const links = content.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")
    if (links?.length) links[last ? links.length - 1 : 0].focus()
  }
  useEffect(() => {
    if (open && keyboardOpen.current && content.current) { focusDestination(); keyboardOpen.current = false }
  }, [open])
  function contentKeys(event: KeyboardEvent<HTMLDivElement>) {
    const links = Array.from(content.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? [])
    const index = links.indexOf(document.activeElement as HTMLElement)
    if (event.key === "Tab" && index !== -1) {
      // Consistent with Safari's restricted Tab-to-links preference; focus can leave at either end.
      event.preventDefault()
      const next = links[index + (event.shiftKey ? -1 : 1)]
      if (next) next.focus()
      else {
        setOpen(false)
        if (event.shiftKey) trigger.current?.focus()
        else {
          const targets = Array.from(trigger.current?.closest(".oc-dock-navigation-content")?.querySelectorAll<HTMLElement>("a[href],button") ?? [])
          targets[targets.indexOf(trigger.current!) + 1]?.focus()
        }
      }
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault()
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length
      links[next]?.focus()
    } else if (event.key === "ArrowLeft") { event.preventDefault(); setOpen(false); trigger.current?.focus() }
  }
  const button = <button ref={trigger} type="button" className="oc-dock-group-trigger" data-dock-group={group} data-navigation-toggle data-active={selected || undefined} aria-controls={id} aria-label={label}
    onClick={event => { keyboardOpen.current = event.detail === 0 && !open }}
    onKeyDown={event => { if (["ArrowRight", "ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); keyboardOpen.current = true; if (open) focusDestination(event.key === "ArrowUp"); else setOpen(true) } }}>
    <span className="oc-dock-icon"><Icon weight={selected ? "fill" : "regular"} size={22} aria-hidden="true" /></span><span className="oc-dock-item-label">{label}</span><ChevronRight className="oc-dock-chevron" size={16} aria-hidden="true" />
  </button>
  // The tooltip stays closed while the menu is open, so the two never overlap.
  return <Popover open={open} onOpenChange={setOpen}>
    <RailTip label={label} enabled={tooltip && !open}><PopoverTrigger asChild>{button}</PopoverTrigger></RailTip>
    <PopoverContent ref={content} id={id} className="oc-dock-flyout" side="right" align="start" sideOffset={20} collisionPadding={12} aria-label={`${label} navigation`}
      onOpenAutoFocus={event => { event.preventDefault(); if (keyboardOpen.current) focusDestination(); keyboardOpen.current = false }}
      onCloseAutoFocus={event => event.preventDefault()}
      onEscapeKeyDown={event => { event.preventDefault(); setOpen(false); trigger.current?.focus() }} onKeyDown={contentKeys}>
      <p className="oc-dock-flyout-heading">{label}</p><nav aria-label={`${label} destinations`}>{items.map(item => renderItem(item, "flyout"))}</nav>
    </PopoverContent>
  </Popover>
}
