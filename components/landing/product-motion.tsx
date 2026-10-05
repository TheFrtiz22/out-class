"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"

const ProgressContext = createContext(1)
const PlaybackContext = createContext({ complete: true, reduced: true, paused: false, toggle: () => {} })
export const useProductProgress = () => useContext(ProgressContext)

/** Normalize a named beat of a scene to 0–1. */
export const phase = (progress: number, start: number, end: number) =>
  Math.max(0, Math.min(1, (progress - start) / (end - start)))

/** Reserve the final layout while revealing its content. Never measure or collapse rows. */
export function revealAt(progress: number, at: number) {
  return { "data-demo-reveal": true, "data-revealed": progress >= at }
}

/** One finite demonstration, measured only in visible time. HTML is the complete example. */
export function ProductMotion({ children, duration = 4000, resetKey = "default" }: {
  children: ReactNode
  duration?: number
  resetKey?: string | number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const syncRef = useRef(() => {})
  const pausedRef = useRef(false)
  const [snapshot, setSnapshot] = useState({ key: resetKey, progress: 1 })
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(true)
  // A perspective switch must never show the previous scene's completed progress.
  const progress = snapshot.key === resetKey ? snapshot.progress : reduced ? 1 : 0

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compact = window.matchMedia("(max-width: 540px)")
    if (!window.IntersectionObserver) return
    let visible = false
    let elapsed = 0
    let finished = false
    let frame: number | undefined
    let previous: number | undefined
    let published = 0
    pausedRef.current = false
    setPaused(false)
    const publish = (value: number) => setSnapshot({ key: resetKey, progress: value })
    const sceneDuration = () => duration * (compact.matches ? .8 : 1)
    const stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
      previous = undefined
    }
    const tick = (now: number) => {
      if (previous !== undefined) elapsed = Math.min(sceneDuration(), elapsed + now - previous)
      previous = now
      const complete = elapsed >= sceneDuration()
      // One clock, at most 25 React updates/sec. CSS handles the small reveal transitions.
      if (now - published >= 40 || complete) {
        publish(elapsed / sceneDuration())
        published = now
      }
      if (complete) { finished = true; stop() }
      else frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      stop()
      setReduced(preference.matches)
      if (preference.matches) {
        elapsed = sceneDuration()
        finished = true
        publish(1)
        return
      }
      if (finished || elapsed >= sceneDuration()) { finished = true; publish(1); return }
      if (visible && !document.hidden && !pausedRef.current) frame = requestAnimationFrame(tick)
    }
    publish(preference.matches ? 1 : 0)
    syncRef.current = sync
    const observer = new IntersectionObserver(([entry]) => {
      // Short landscape screens may never fit 45% of a window. In that case,
      // fill 70% of the unobscured viewport. These bounds come from the observer.
      const minimumRatio = entry.rootBounds && entry.boundingClientRect.height > 0
        ? Math.min(.45, entry.rootBounds.height * .7 / entry.boundingClientRect.height)
        : .45
      visible = entry.isIntersecting && entry.intersectionRatio >= minimumRatio
      sync()
    }, { threshold: [0, .05, .1, .15, .2, .25, .3, .35, .4, .45], rootMargin: "-190px 0px -24px 0px" })
    if (ref.current) observer.observe(ref.current)
    preference.addEventListener("change", sync)
    compact.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    sync()
    return () => {
      stop()
      observer.disconnect()
      syncRef.current = () => {}
      preference.removeEventListener("change", sync)
      compact.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
    }
  }, [duration, resetKey])

  const toggle = () => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    syncRef.current()
  }
  return <div ref={ref} className="oc-product-motion" data-demo-complete={progress === 1} data-demo-paused={paused}>
    <PlaybackContext.Provider value={{ complete: progress === 1, reduced, paused, toggle }}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </PlaybackContext.Provider>
  </div>
}

/** Fits the existing toolbar's Preview label; no extra controls below the windows. */
export function ProductMotionControl() {
  const { complete, reduced, paused, toggle } = useContext(PlaybackContext)
  return <button type="button" className="oc-preview-playback" disabled={complete || reduced}
    aria-label={complete || reduced ? "Preview complete" : paused ? "Resume example" : "Pause example"}
    onClick={toggle}>{complete || reduced ? "Preview" : paused ? "Resume" : "Pause"}</button>
}

export function Fill({ at, children }: { at: number; children: ReactNode }) {
  return <span className="oc-demo-fill" {...revealAt(useProductProgress(), at)}>{children}</span>
}

export function AnimatedCheck({ at, size = 17 }: { at: number; size?: number }) {
  const progress = useProductProgress()
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    className="oc-animated-check" {...revealAt(progress, at)}>
    <path d="m20 6-11 11-5-5" pathLength="1" style={{ strokeDashoffset: 1 - phase(progress, at, at + .05) }} />
  </svg>
}

/** Whole phrases appear quickly; hidden phrases retain natural wrapping and full SR text. */
export function ProgressiveText({ phrases, start, end }: { phrases: readonly string[]; start: number; end: number }) {
  const progress = useProductProgress()
  return <><span className="sr-only">{phrases.join(" ")}</span><span aria-hidden="true">{phrases.map((phrase, index) =>
    <span key={phrase} className="oc-demo-phrase" style={{ opacity: progress >= start + (end - start) * index / phrases.length ? 1 : 0 }}>{phrase}{index < phrases.length - 1 ? " " : ""}</span>,
  )}</span></>
}
