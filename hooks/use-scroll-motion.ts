"use client"

import { useEffect, type RefObject } from "react"

/** Progressive enhancement: final, readable HTML is always the baseline. */
export function useScrollMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || !window.IntersectionObserver || !Element.prototype.animate) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compact = window.matchMedia("(max-width: 767px)")
    const seen = new WeakSet<Element>()
    const active = new Set<Animation>()
    let observer: IntersectionObserver | undefined
    const cancel = () => { active.forEach(animation => animation.cancel()); active.clear() }
    function reveal(element: HTMLElement) {
      if (seen.has(element)) return
      seen.add(element)
      const style = getComputedStyle(root!)
      const duration = parseFloat(style.getPropertyValue("--oc-duration-entrance")) || 650
      const easing = style.getPropertyValue("--oc-ease-out").trim() || "ease-out"
      // Don't move an active control, focus-containing form, or its ancestor.
      if (element.contains(document.activeElement)) return
      const kind = element.dataset.motion
      const phases: Record<string, number> = { context: 0, text: 45, body: 85, visual: 130, stat: 85 }
      const phase = phases[kind ?? "body"] ?? 85
      const stagger = Math.min(Number(element.dataset.motionIndex) || 0, 4) * 35
      const travel = compact.matches ? 4 : kind === "visual" ? 10 : kind === "text" ? 7 : 4
      const frames = kind === "visual"
        ? [{ opacity: .85, transform: `translateY(${travel}px) scale(.992)` }, { opacity: 1, transform: "none" }]
        : [{ opacity: .88, transform: `translateY(${travel}px)` }, { opacity: 1, transform: "none" }]
      const animation = element.animate(frames, { duration: kind === "context" ? duration * .7 : duration, delay: compact.matches ? phase / 2 + stagger / 2 : phase + stagger, easing, fill: "none" })
      active.add(animation)
      animation.finished.then(() => active.delete(animation), () => active.delete(animation))
    }
    function connect() {
      observer?.disconnect()
      cancel()
      if (preference.matches) return
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          reveal(entry.target as HTMLElement)
          observer?.unobserve(entry.target)
        }
      }, { threshold: 0, rootMargin: "0px 0px -8% 0px" })
      root!.querySelectorAll<HTMLElement>("[data-motion-section] [data-motion]").forEach(element => { if (!seen.has(element)) observer!.observe(element) })
    }
    // Keyboard and anchor navigation take precedence over choreography.
    function focus(event: FocusEvent) {
      if (!(event.target instanceof Element)) return
      const section = event.target.closest("[data-motion-section]")
      if (section) {
        section.querySelectorAll("[data-motion]").forEach(element => { seen.add(element); observer?.unobserve(element) })
        cancel()
      }
    }
    connect()
    preference.addEventListener("change", connect)
    root.addEventListener("focusin", focus)
    return () => { observer?.disconnect(); cancel(); preference.removeEventListener("change", connect); root.removeEventListener("focusin", focus) }
  }, [rootRef])
}
