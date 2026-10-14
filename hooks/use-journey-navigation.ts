"use client"

import { useEffect, useRef, useState } from "react"

const HYSTERESIS = 24

/** Different entry/exit edges keep a slow scroll from toggling at one pixel. */
export function journeyNavigationMerged(current: boolean, start: number, end: number, edge: number, endEdge = edge) {
  return current ? start <= edge + HYSTERESIS && end > endEdge : start <= edge && end > endEdge + HYSTERESIS
}

/** Observe boundary half-planes so even a jump across the whole viewport is detected. */
export function useJourneyNavigation() {
  const headerRef = useRef<HTMLElement>(null)
  const controlsRef = useRef<HTMLSpanElement>(null)
  const endRef = useRef<HTMLSpanElement>(null)
  const showcaseRef = useRef<HTMLElement>(null)
  const [merged, setMerged] = useState(false)

  useEffect(() => {
    const header = headerRef.current
    const controls = controlsRef.current
    const end = endRef.current
    const showcase = showcaseRef.current
    if (!header || !controls || !end || !showcase || typeof IntersectionObserver === "undefined" || typeof ResizeObserver === "undefined") return
    let current = false
    let observers: IntersectionObserver[] = []
    let frame = 0
    let edge = 0
    let endEdge = 0
    const visible = (element: HTMLElement | null) => element && element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== "hidden"
    const update = () => {
      const start = controls.getBoundingClientRect().top
      const finish = end.getBoundingClientRect().top
      const next = journeyNavigationMerged(current, start, finish, edge, endEdge)
      if (next === current) return
      const focused = document.activeElement as HTMLElement | null
      const fromOriginal = focused?.closest(".oc-journey-controls")
      const fromCompact = focused?.closest(".oc-public-journey")
      const option = focused?.dataset.perspectiveOption
      current = next
      setMerged(next)
      cancelAnimationFrame(frame)
      if ((next && fromOriginal) || (!next && fromCompact)) {
        frame = requestAnimationFrame(() => {
          const selector = `button[data-perspective-option="${option === "leader" ? "leader" : "student"}"]`
          const compact = header.querySelector<HTMLElement>(`.oc-public-journey-desktop ${selector}`)
          const original = controls.parentElement?.querySelector<HTMLElement>(selector) ?? null
          const target = next
            ? visible(compact) ? compact : header.querySelector<HTMLElement>(".oc-public-menu-toggle")
            : start > edge && visible(original) ? original : header.querySelector<HTMLElement>(".oc-public-logo")
          target?.focus({ preventScroll: true })
        })
      }
    }
    const observe = () => {
      observers.forEach(observer => observer.disconnect())
      edge = (header.querySelector(".oc-public-nav-surface") ?? header).getBoundingClientRect().bottom + 12
      // Yield as the invitation becomes the main reading context. The page footer
      // may be too short to ever scroll the section's end all the way to the header.
      endEdge = edge + Math.min(window.innerHeight / 2, 320)
      const below = document.documentElement.scrollHeight + window.innerHeight
      const boundaries: [Element, number][] = [[controls, edge], [controls, edge + HYSTERESIS], [end, endEdge], [end, endEdge + HYSTERESIS]]
      observers = boundaries.map(([target, top]) => {
        const observer = new IntersectionObserver(update, { rootMargin: `-${Math.round(top)}px 0px ${below}px 0px`, threshold: 0 })
        observer.observe(target)
        return observer
      })
      // A compact control that becomes hidden on resize yields to the menu button.
      const focused = document.activeElement as HTMLElement | null
      if (focused?.closest(".oc-public-journey-desktop") && !visible(focused)) header.querySelector<HTMLButtonElement>(".oc-public-menu-toggle")?.focus({ preventScroll: true })
      update()
    }
    observe()
    const resize = new ResizeObserver(observe)
    resize.observe(header)
    resize.observe(showcase)
    resize.observe(document.documentElement)
    return () => { observers.forEach(observer => observer.disconnect()); resize.disconnect(); cancelAnimationFrame(frame) }
  }, [])

  return { headerRef, controlsRef, endRef, showcaseRef, merged }
}
