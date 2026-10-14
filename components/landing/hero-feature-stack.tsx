"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { heroFeatures, leaderHeroFeatures } from "./hero-features"
import type { LandingPerspective } from "./journey-content"
import "./hero-feature-stack.css"

const count = heroFeatures.length
const duration = 480
const interval = 5400
const easing = "cubic-bezier(.22, 1, .36, 1)"
const depthOf = (index: number, active: number) => (index - active + count) % count
// Only three layers are visible. The others sit invisibly at the back.
const pose = (depth: number) => {
  const layer = Math.min(depth, 2)
  return {
    transform: `translate3d(0, ${-layer * 17}px, ${-layer * 32}px) scale(${1 - layer * .018})`,
    opacity: depth === 0 ? 1 : depth === 1 ? .38 : depth === 2 ? .16 : 0,
  }
}

/** Restrained index-card carousel. Each transition finishes before autoplay is rescheduled. */
export function HeroFeatureStack({ perspective = "student" }: { perspective?: LandingPerspective }) {
  const features = perspective === "leader" ? leaderHeroFeatures : heroFeatures
  const root = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const current = useRef(0)
  const navigate = useRef<(direction: 1 | -1) => void>(() => {})
  const updatePause = useRef<(paused: boolean) => void>(() => {})
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    const element = root.current
    if (!element) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    let reduced = media.matches
    let visible = !("IntersectionObserver" in window)
    let hovered = element.matches(":hover")
    let focused = element.contains(document.activeElement)
    let userPaused = false
    let disposed = false
    let moving = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let animations: Animation[] = []

    const clearTimer = () => { clearTimeout(timer); timer = undefined }
    const blocked = () => !visible || document.hidden || hovered || focused || userPaused
    // Hover, focus and Pause prevent the NEXT move; they never freeze an in-flight card.
    const schedule = () => {
      clearTimer()
      if (!disposed && !moving && !reduced && !blocked()) timer = setTimeout(() => move(1, false), interval)
    }
    const settle = (next: number, announce: boolean) => {
      cards.current.forEach((card, index) => {
        if (!card) return
        const depth = depthOf(index, next)
        Object.assign(card.style, pose(depth))
        const ink = card.firstElementChild as HTMLElement | null
        if (ink) ink.style.opacity = depth === 0 ? "1" : "0"
      })
      current.current = next
      setActive(next)
      if (announce) setAnnouncement(`${features[next].label}. ${features[next].statement}`)
    }
    function move(direction: 1 | -1, requested: boolean) {
      if (disposed || moving) return
      clearTimer()
      const from = current.current
      const next = (from + direction + count) % count
      if (reduced || !Element.prototype.animate) {
        settle(next, requested)
        schedule()
        return
      }
      moving = true
      animations = cards.current.flatMap((card, index) => {
        if (!card) return []
        const before = depthOf(index, from)
        const after = depthOf(index, next)
        if (before > 2 && after > 2) return []
        const outgoing = before === 0
        const incoming = after === 0
        // A single restrained movement: the front card settles out while the
        // next card rises from behind. No long dives, spins, or z-index swaps.
        const frames: Keyframe[] = outgoing
          ? [pose(0), { transform: "translate3d(0, 22px, -48px) scale(.975)", opacity: 0 }]
          : incoming && before > 2
            ? [{ ...pose(1), opacity: 0 }, pose(0)]
            : [pose(before), pose(after)]
        const shell = card.animate(frames, { duration, easing, fill: "both" })
        const ink = card.firstElementChild as HTMLElement | null
        if (!ink) return [shell]
        const inkFrames: Keyframe[] = outgoing
          ? [{ opacity: 1 }, { opacity: 0, offset: .5 }, { opacity: 0 }]
          : incoming
            ? [{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }]
            : [{ opacity: 0 }, { opacity: 0 }]
        return [shell, ink.animate(inkFrames, { duration, easing, fill: "both" })]
      })
      void Promise.all(animations.map(animation => animation.finished)).then(() => {
        if (disposed) return
        settle(next, requested)
        animations.forEach(animation => animation.cancel())
        animations = []
        moving = false
        schedule()
      }).catch(() => { /* Unmount cancels pending animations. */ })
    }
    navigate.current = direction => move(direction, true)
    updatePause.current = value => { userPaused = value; schedule() }
    const enter = () => { hovered = true; schedule() }
    const leave = () => { hovered = false; schedule() }
    const focus = () => { focused = true; schedule() }
    const blur = (event: FocusEvent) => {
      if (!element.contains(event.relatedTarget as Node | null)) { focused = false; schedule() }
    }
    const motionChange = () => {
      reduced = media.matches
      if (reduced && moving) {
        animations.forEach(animation => animation.finish())
      } else schedule()
    }
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule() }, { threshold: .15 })
      : null
    observer?.observe(element)
    element.addEventListener("pointerenter", enter)
    element.addEventListener("pointerleave", leave)
    element.addEventListener("focusin", focus)
    element.addEventListener("focusout", blur)
    document.addEventListener("visibilitychange", schedule)
    media.addEventListener("change", motionChange)
    schedule()
    return () => {
      disposed = true
      clearTimer()
      animations.forEach(animation => animation.cancel())
      observer?.disconnect()
      element.removeEventListener("pointerenter", enter)
      element.removeEventListener("pointerleave", leave)
      element.removeEventListener("focusin", focus)
      element.removeEventListener("focusout", blur)
      document.removeEventListener("visibilitychange", schedule)
      media.removeEventListener("change", motionChange)
      navigate.current = () => {}
      updatePause.current = () => {}
    }
  }, [features])

  return (
    <div ref={root} className="oc-feature-stack" role="region" aria-roledescription="carousel" aria-label="OutClass features">
      <div className="oc-feature-stage">
        {features.map((feature, index) => {
          const depth = depthOf(index, active)
          return (
            <div key={feature.number} ref={node => { cards.current[index] = node }}
              className="oc-feature-card" style={pose(depth)} aria-hidden={depth !== 0}
              role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}`}>
              <div className="oc-feature-ink" style={{ opacity: depth === 0 ? 1 : 0 }}>
                <p className="oc-feature-category"><span>{feature.number}</span>{feature.label}</p>
                <p className="oc-feature-statement">{feature.statement}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="oc-feature-controls">
        <span className="oc-feature-position" aria-hidden="true">{features[active].number}<span> / 06</span></span>
        <button type="button" aria-label="Previous feature" onClick={() => navigate.current(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
        <button type="button" className="oc-feature-autoplay" aria-label={paused ? "Play feature carousel" : "Pause feature carousel"} onClick={() => {
          updatePause.current(!paused)
          setPaused(!paused)
        }}>{paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}</button>
        <button type="button" aria-label="Next feature" onClick={() => navigate.current(1)}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
  )
}
