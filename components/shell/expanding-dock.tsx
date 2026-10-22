"use client"

import { useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from "react"
import { CheckCircle2, ChevronRight, Users2 } from "@/components/icons"
import { OutClassLogo } from "@/components/outclass-logo"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { navigationGroupLabels, type ProductNavItem } from "@/lib/product-navigation"

type Group = NonNullable<ProductNavItem["navGroup"]>
type RenderItem = (item: ProductNavItem, surface: "rail" | "flyout") => ReactNode
type Section = { label: string; items: ProductNavItem[] }
const EXIT_DELAY = 200

/** Desktop presentation only. Routes, permission filtering, and leave guards stay in ProductShell. */
export function ExpandingDock({ sections, active, contextKey, renderItem, onHome, onDismiss }: {
  sections: Section[]; active: string; contextKey: string
  renderItem: RenderItem; onHome: () => void; onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dismiss = useRef(onDismiss)
  useEffect(() => { dismiss.current = onDismiss }, [onDismiss])
  const [openGroup, setOpenGroup] = useState<Group | null>(null)
  const owner = useId()
  const rail = useRef<HTMLElement>(null), canvas = useRef<HTMLDivElement>(null), highlight = useRef<HTMLDivElement>(null)
  const hoveredItem = useRef<HTMLElement | null>(null)
  const dockFocused = useRef(false)
  const railHovered = useRef(false), flyoutHovered = useRef(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const intentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const focusInside = () => rail.current?.contains(document.activeElement) || Array.from(document.querySelectorAll<HTMLElement>("[data-dock-flyout]")).some(node => node.dataset.dockFlyout === owner && node.contains(document.activeElement))
  function cancelExit() { clearTimeout(exitTimer.current) }
  function cancelIntent() { clearTimeout(intentTimer.current) }
  function hoverGroup(group: Group | null) {
    cancelIntent()
    // Let diagonal travel cross another row on its way to the current flyout.
    // Staying on the new row commits that intent; entering the flyout cancels it.
    if (openGroup && openGroup !== group) intentTimer.current = setTimeout(() => setOpenGroup(group), EXIT_DELAY)
    else setOpenGroup(group)
  }
  function clearHighlight() {
    hoveredItem.current = null
    highlight.current?.style.setProperty("opacity", "0")
    canvas.current?.querySelectorAll<HTMLElement>("[data-magnify]").forEach(item => item.removeAttribute("data-magnify"))
  }
  function scheduleExit() {
    cancelExit()
    exitTimer.current = setTimeout(() => {
      if (railHovered.current || flyoutHovered.current || focusInside()) return
      dockFocused.current = false; setOpenGroup(null); setExpanded(false); clearHighlight()
    }, EXIT_DELAY)
  }
  function positionHighlight(item: HTMLElement) {
    if (!canvas.current || !highlight.current) return
    const bounds = item.getBoundingClientRect(), origin = canvas.current.getBoundingClientRect()
    highlight.current.style.setProperty("--dock-hover-y", `${bounds.top - origin.top}px`)
    highlight.current.style.setProperty("height", `${bounds.height}px`)
    highlight.current.style.setProperty("opacity", "1")
  }
  function emphasize(item: HTMLElement) {
    if (hoveredItem.current === item) return
    hoveredItem.current = item
    positionHighlight(item)
    const targets = Array.from(canvas.current?.querySelectorAll<HTMLElement>("[data-dock-item]") ?? [])
    const index = targets.indexOf(item)
    targets.forEach((target, position) => {
      if (position === index) target.dataset.magnify = "current"
      else if (Math.abs(position - index) === 1) target.dataset.magnify = "neighbor"
      else target.removeAttribute("data-magnify")
    })
  }
  // Only discrete item/focus events measure geometry. Width changes do not change row heights;
  // the indicator lives inside the scrolling canvas, so scrolling needs no React updates.
  useEffect(() => {
    const content = canvas.current
    if (!content) return
    const observer = new ResizeObserver(() => { if (hoveredItem.current?.isConnected) positionHighlight(hoveredItem.current) })
    observer.observe(content)
    return () => { observer.disconnect(); clearTimeout(exitTimer.current); clearTimeout(intentTimer.current) }
  }, [])
  useEffect(() => {
    cancelIntent(); setOpenGroup(null); flyoutHovered.current = false
    // A route change may move focus to content. Collapse only after that focus settles.
    scheduleExit()
    return () => { cancelExit(); cancelIntent() }
    // Interaction refs intentionally contain the current hover/focus state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey])
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const reset = () => {
      if (media.matches) return
      const focused = document.activeElement
      if (dockFocused.current || rail.current?.contains(focused) || Array.from(document.querySelectorAll<HTMLElement>("[data-dock-flyout]")).some(node => node.dataset.dockFlyout === owner && node.contains(focused))) dismiss.current()
      cancelExit(); cancelIntent(); setOpenGroup(null); setExpanded(false)
      dockFocused.current = false; railHovered.current = false; flyoutHovered.current = false; clearHighlight()
    }
    media.addEventListener("change", reset)
    return () => media.removeEventListener("change", reset)
  }, [owner])
  function enterFlyout() {
    flyoutHovered.current = true; cancelExit(); cancelIntent(); setExpanded(true)
    const parent = canvas.current?.querySelector<HTMLElement>(`[data-dock-group="${openGroup}"]`)
    if (parent) emphasize(parent)
  }
  function leaveFlyout() { flyoutHovered.current = false; scheduleExit() }
  return <aside ref={rail} className="oc-expanding-dock hidden lg:block" aria-label="Workspace dock" data-dock-expanded={expanded}
    onPointerEnter={event => { if (event.pointerType === "mouse" || event.pointerType === "pen") { railHovered.current = true; cancelExit(); setExpanded(true) } }}
    onPointerLeave={() => { railHovered.current = false; cancelIntent(); scheduleExit() }}
    onFocusCapture={() => { dockFocused.current = true; cancelIntent(); cancelExit(); setExpanded(true) }} onBlurCapture={event => {
      const next = event.relatedTarget as Node | null
      if (next && !rail.current?.contains(next) && !Array.from(document.querySelectorAll<HTMLElement>("[data-dock-flyout]")).some(node => node.dataset.dockFlyout === owner && node.contains(next))) dockFocused.current = false
      scheduleExit()
    }}
    onKeyDownCapture={event => { if (event.key === "Escape" && !openGroup) { event.preventDefault(); event.stopPropagation(); cancelIntent(); cancelExit(); dockFocused.current = false; setExpanded(false); clearHighlight(); onDismiss() } }}>
    <div className="oc-context-sidebar oc-dock-rail">
      <button type="button" className="oc-dock-brand" aria-label="OutClass home" onClick={onHome}><span className="oc-dock-brand-mark"><OutClassLogo variant="mark" /></span><span className="oc-dock-brand-name" aria-hidden="true">Out<span>Class</span></span></button>
      <div className="oc-dock-navigation">
        <div ref={canvas} className="oc-dock-navigation-content"
          onPointerOver={event => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen") return
            const item = (event.target as HTMLElement).closest<HTMLElement>("[data-dock-item]")
            if (!item) return
            cancelExit(); setExpanded(true); emphasize(item)
            const group = item.dataset.dockGroup as Group | undefined
            hoverGroup(group ?? null)
          }}
          onFocusCapture={event => { const item = event.target.closest<HTMLElement>("[data-dock-item]"); if (item) emphasize(item) }}>
          <div ref={highlight} className="oc-dock-hover-highlight" aria-hidden="true" />
          {sections.filter(section => section.items.length).map(section => {
            const rendered = new Set<Group>()
            return <section key={section.label} className="oc-dock-section"><h2 className="oc-dock-section-heading">{section.label}</h2><nav aria-label={section.label}>{section.items.map(item => {
              if (!item.navGroup) return renderItem(item, "rail")
              if (rendered.has(item.navGroup)) return null
              const group = item.navGroup; rendered.add(group)
              return <DockGroup key={group} owner={owner} group={group} items={section.items.filter(child => child.navGroup === group)} active={active} open={openGroup === group} renderItem={renderItem}
                onOpenChange={open => { cancelIntent(); cancelExit(); setOpenGroup(open ? group : null); if (open) setExpanded(true); else { flyoutHovered.current = false; scheduleExit() } }}
                onExit={onDismiss} onPointerEnter={enterFlyout} onPointerLeave={leaveFlyout} onFocus={() => { cancelExit(); setExpanded(true) }} onBlur={scheduleExit} />
            })}</nav></section>
          })}
        </div>
      </div>
    </div>
  </aside>
}

function DockGroup({ owner, group, items, active, open, renderItem, onOpenChange, onPointerEnter, onPointerLeave, onFocus, onBlur, onExit }: {
  owner: string; group: Group; items: ProductNavItem[]; active: string; open: boolean; renderItem: RenderItem
  onExit: () => void; onOpenChange: (open: boolean) => void; onPointerEnter: () => void; onPointerLeave: () => void; onFocus: () => void; onBlur: () => void
}) {
  const keyboardOpen = useRef(false), trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null)
  const selected = items.some(item => item.id === active), Icon = group === "applicants" ? Users2 : CheckCircle2
  const label = navigationGroupLabels[group], id = useId()
  function focusDestination(last = false) {
    const links = content.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")
    if (links?.length) links[last ? links.length - 1 : 0].focus()
  }
  useEffect(() => {
    // Presence can retain a closing Radix surface during an interrupted animation.
    // Keyboard reopening must focus a destination even when FocusScope never remounts.
    if (open && keyboardOpen.current && content.current) { focusDestination(); keyboardOpen.current = false }
  }, [open])
  function contentKeys(event: KeyboardEvent<HTMLDivElement>) {
    const links = Array.from(content.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? [])
    const index = links.indexOf(document.activeElement as HTMLElement)
    if (event.key === "Tab" && index !== -1) {
      // Keep navigation consistent with Safari's restricted Tab-to-links preference,
      // while letting focus leave the flyout at either end (never a focus trap).
      event.preventDefault()
      const next = index + (event.shiftKey ? -1 : 1)
      if (links[next]) links[next].focus()
      else {
        keyboardOpen.current = false; onOpenChange(false)
        if (event.shiftKey) trigger.current?.focus()
        else {
          const targets = Array.from(trigger.current?.closest(".oc-dock-navigation-content")?.querySelectorAll<HTMLElement>("[data-dock-item]") ?? [])
          const following = targets[targets.indexOf(trigger.current!) + 1]
          if (following) following.focus(); else onExit()
        }
      }
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault()
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length
      links[next]?.focus()
    } else if (event.key === "ArrowLeft") { event.preventDefault(); event.stopPropagation(); keyboardOpen.current = false; onOpenChange(false); trigger.current?.focus() }
  }
  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild><button ref={trigger} type="button" className="oc-dock-group-trigger" data-dock-item data-dock-group={group} data-navigation-toggle data-active={selected || undefined} aria-controls={id}
      onClick={event => { keyboardOpen.current = event.detail === 0 && !open }}
      onKeyDown={event => { if (["ArrowRight", "ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); keyboardOpen.current = true; if (open) focusDestination(event.key === "ArrowUp"); else onOpenChange(true) } }}>
      <span className="oc-dock-icon"><Icon weight={selected ? "fill" : "regular"} size={22} aria-hidden="true" /></span><span className="oc-dock-item-label">{label}</span><ChevronRight className="oc-dock-chevron" size={16} aria-hidden="true" />
    </button></PopoverTrigger>
    <PopoverContent ref={content} id={id} data-dock-flyout={owner} className="oc-dock-flyout" side="right" align="start" sideOffset={20} collisionPadding={12} aria-label={`${label} navigation`}
      onOpenAutoFocus={event => { event.preventDefault(); if (keyboardOpen.current) focusDestination(); keyboardOpen.current = false }}
      onCloseAutoFocus={event => event.preventDefault()}
      onEscapeKeyDown={event => { event.preventDefault(); event.stopPropagation(); keyboardOpen.current = false; onOpenChange(false); trigger.current?.focus() }}
      onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocusCapture={onFocus} onBlurCapture={onBlur} onKeyDown={contentKeys}>
      <p className="oc-dock-flyout-heading">{label}</p><nav aria-label={`${label} destinations`}>{items.map(item => renderItem(item, "flyout"))}</nav>
    </PopoverContent>
  </Popover>
}
