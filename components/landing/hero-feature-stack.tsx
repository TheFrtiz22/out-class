"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { heroFeatures } from "./hero-features"
import "./hero-feature-stack.css"

const count = heroFeatures.length
const duration = 1100
const interval = 3500
const easing = "cubic-bezier(.22, .8, .25, 1)"
const depthOf = (index: number, active: number) => (index - active + count) % count
const pose = (depth: number) => ({
  transform: `translate3d(0, ${-depth * 25}px, ${-depth * 65}px)`,
  opacity: depth === 0 ? 1 : Math.max(.12, .55 - depth * .085),
})

/** Real Z depth sorts the cards continuously; there are no z-index swaps. */
export function HeroFeatureStack() {
  const root = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const current = useRef(0)
  const navigate = useRef<(direction: 1 | -1) => void>(() => {})
  const updatePause = useRef<(paused: boolean) => void>(() => {})
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    const host = root.current
    if (!host) return
    const element = host
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    let reduced = media.matches
    let visible = false
    let hovered = element.matches(":hover")
    let focused = element.contains(document.activeElement)
    let userPaused = false
    let disposed = false
    let moving = false
    let manual = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let animations: Animation[] = []

    const clearTimer = () => { clearTimeout(timer); timer = undefined }
    const blocked = () => !visible || document.hidden || (!manual && (hovered || focused || userPaused))
    const schedule = (delay = interval) => {
      clearTimer()
      if (!disposed && !moving && !reduced && !blocked()) timer = setTimeout(() => move(1, false), delay)
    }
    const sync = () => {
      clearTimer()
      if (moving) {
        animations.forEach(animation => {
          if (animation.playState !== "finished") blocked() ? animation.pause() : animation.play()
        })
      } else schedule()
    }
    const settle = (next: number, announce: boolean) => {
      cards.current.forEach((card, index) => {
        if (!card) return
        const depth = depthOf(index, next)
        Object.assign(card.style, pose(depth))
        const content = card.firstElementChild as HTMLElement
        content.style.opacity = depth === 0 ? "1" : "0"
      })
      current.current = next
      setActive(next)
      if (announce) setAnnouncement(`${heroFeatures[next].label}. ${heroFeatures[next].statement}`)
    }
    function move(direction: 1 | -1, requested: boolean) {
      if (disposed || moving) return
      clearTimer()
      manual = requested
      const from = current.current
      const next = (from + direction + count) % count
      if (reduced || !element.animate) {
        settle(next, requested)
        manual = false
        schedule()
        return
      }
      moving = true
      animations = cards.current.flatMap((card, index) => {
        if (!card) return []
        const before = depthOf(index, from)
        const after = depthOf(index, next)
        const recycling = direction === 1 ? before === 0 : after === 0
        // Move below the stack before returning at its back. Reversing uses
        // the same continuous path, so manual navigation feels equally physical.
        const route: Keyframe[] = [
          { ...pose(0), offset: 0, easing: "cubic-bezier(.4, 0, .6, 1)" },
          { transform: "translate3d(0, var(--oc-feature-drop, 38%), 20px)", opacity: .3, offset: .42, easing: "ease-in-out" },
          { transform: "translate3d(0, 24%, -325px)", opacity: .12, offset: .64, easing },
          { ...pose(count - 1), offset: 1 },
        ]
        const frames = recycling
          ? direction === 1 ? route : route.slice().reverse().map(frame => ({ ...frame, offset: 1 - (frame.offset as number) }))
          : [pose(before), pose(after)]
        const shell = card.animate(frames, { duration, easing: recycling ? "linear" : easing, fill: "both" })
        const content = card.firstElementChild as HTMLElement
        // Exchange the typography early in the glide, without ghosted lines
        // competing on transparent surfaces as their edges pass one another.
        const inkFrames = before === 0
          ? [{ opacity: 1, offset: 0 }, { opacity: 0, offset: .2 }, { opacity: 0, offset: 1 }]
          : after === 0
            ? [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .2 }, { opacity: 1, offset: .75 }, { opacity: 1, offset: 1 }]
            : [{ opacity: 0 }, { opacity: 0 }]
        const ink = content.animate(inkFrames, { duration, easing, fill: "both" })
        return [shell, ink]
      })
      sync()
      void Promise.all(animations.map(animation => animation.finished)).then(() => {
        if (disposed) return
        // Write the identical resting pose before removing the animation fill.
        settle(next, requested)
        animations.forEach(animation => animation.cancel())
        animations = []
        moving = false
        manual = false
        schedule(interval - duration)
      }).catch(() => { /* Unmount cancels the pending animation promises. */ })
    }
    navigate.current = direction => move(direction, true)
    updatePause.current = value => { userPaused = value; sync() }
    const enter = () => { hovered = true; sync() }
    const leave = () => { hovered = false; sync() }
    const focus = () => { focused = true; sync() }
    const blur = (event: FocusEvent) => {
      if (!element.contains(event.relatedTarget as Node | null)) { focused = false; sync() }
    }
    const motionChange = () => {
      reduced = media.matches
      if (reduced) {
        clearTimer()
        if (moving) animations.forEach(animation => animation.finish())
        return
      }
      sync()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    }, { threshold: .15 })
    observer.observe(element)
    element.addEventListener("pointerenter", enter)
    element.addEventListener("pointerleave", leave)
    element.addEventListener("focusin", focus)
    element.addEventListener("focusout", blur)
    document.addEventListener("visibilitychange", sync)
    media.addEventListener("change", motionChange)
    return () => {
      disposed = true
      clearTimer()
      animations.forEach(animation => animation.cancel())
      observer.disconnect()
      element.removeEventListener("pointerenter", enter)
      element.removeEventListener("pointerleave", leave)
      element.removeEventListener("focusin", focus)
      element.removeEventListener("focusout", blur)
      document.removeEventListener("visibilitychange", sync)
      media.removeEventListener("change", motionChange)
      navigate.current = () => {}
      updatePause.current = () => {}
    }
  }, [])

  return (
    <div ref={root} className="oc-feature-stack" role="region" aria-roledescription="carousel" aria-label="OutClass features">
      <div className="oc-feature-stage">
        {heroFeatures.map((feature, index) => {
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
        <span className="oc-feature-position" aria-hidden="true">{heroFeatures[active].number}<span> / 06</span></span>
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
