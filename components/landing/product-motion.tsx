"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"

const ProgressContext = createContext(1)
const PlaybackContext = createContext({ complete: true, reduced: true, paused: false, toggle: () => {}, replay: () => {}, seek: (_progress: number) => {} })
export const useProductProgress = () => useContext(ProgressContext)
export const useProductPlayback = () => useContext(PlaybackContext)

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
  const replayRef = useRef(() => {})
  const seekRef = useRef((_progress: number) => {})
  const pausedRef = useRef(false)
  const [snapshot, setSnapshot] = useState({ key: resetKey, progress: 1 })
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(true)
  // A perspective switch must never show the previous scene's completed progress.
  const progress = snapshot.key === resetKey ? snapshot.progress : reduced ? 1 : 0

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!window.IntersectionObserver) return
    let visible = false
    let elapsed = 0
    let finished = false
    let manual = false
    let frame: number | undefined
    let previous: number | undefined
    let published = -1
    pausedRef.current = false
    setPaused(false)
    const publish = (value: number) => setSnapshot({ key: resetKey, progress: value })
    const stop = () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
      previous = undefined
    }
    const tick = (now: number) => {
      if (previous !== undefined) elapsed = Math.min(duration, elapsed + now - previous)
      previous = now
      const complete = elapsed >= duration
      // Twenty meaningful beats per example; CSS owns the movement between them.
      const beat = Math.round(elapsed / duration * 20) / 20
      if (beat !== published || complete) {
        publish(complete ? 1 : Math.min(.95, beat))
        published = beat
      }
      if (complete) { finished = true; stop() }
      else frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      stop()
      setReduced(preference.matches)
      if (preference.matches) {
        if (manual) return
        elapsed = duration
        finished = true
        publish(1)
        return
      }
      if (finished || elapsed >= duration) { finished = true; publish(1); return }
      if (visible && !document.hidden && !pausedRef.current) frame = requestAnimationFrame(tick)
    }
    publish(preference.matches ? 1 : 0)
    syncRef.current = sync
    replayRef.current = () => {
      stop()
      elapsed = 0
      finished = false
      manual = false
      published = -1
      pausedRef.current = false
      setPaused(false)
      publish(0)
      sync()
    }
    seekRef.current = value => {
      stop()
      manual = true
      elapsed = Math.max(0, Math.min(1, value)) * duration
      finished = elapsed >= duration
      pausedRef.current = true
      setPaused(true)
      publish(elapsed / duration)
    }
    const observer = new IntersectionObserver(([entry]) => {
      // Start when a meaningful part of the preview is visible, even in landscape.
      const minimumRatio = entry.rootBounds && entry.boundingClientRect.height > 0
        ? Math.min(.25, entry.rootBounds.height * .55 / entry.boundingClientRect.height)
        : .25
      visible = entry.isIntersecting && entry.intersectionRatio >= minimumRatio
      sync()
    }, { threshold: [0, .05, .1, .15, .2, .25], rootMargin: "-100px 0px -24px 0px" })
    if (ref.current) observer.observe(ref.current)
    preference.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    sync()
    return () => {
      stop()
      observer.disconnect()
      syncRef.current = () => {}
      replayRef.current = () => {}
      seekRef.current = () => {}
      preference.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
    }
  }, [duration, resetKey])

  const toggle = () => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    syncRef.current()
  }
  const replay = () => replayRef.current()
  return <div ref={ref} className="oc-product-motion" data-demo-complete={progress === 1} data-demo-paused={paused} onFocusCapture={event => {
    // A keyboard user owns the example while inspecting or editing a field.
    if (progress < 1 && !pausedRef.current && !(event.target as HTMLElement).closest(".oc-preview-playback")) toggle()
  }}>
    <PlaybackContext.Provider value={{ complete: progress === 1, reduced, paused, toggle, replay, seek: value => seekRef.current(value) }}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </PlaybackContext.Provider>
  </div>
}

/** One unobtrusive control: pause during the story or replay it afterward. */
export function ProductMotionControl() {
  const { complete, reduced, paused, toggle, replay } = useContext(PlaybackContext)
  return <button type="button" className="oc-preview-playback" disabled={reduced}
    aria-label={reduced ? "Static preview" : complete ? "Replay example" : paused ? "Resume example" : "Pause example"}
    onClick={complete ? replay : toggle}>{reduced ? "Preview" : complete ? "Replay" : paused ? "Resume" : "Pause"}</button>
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

/** A completed response arrives in one calm fade, not a typewriter or word-by-word flash. */
export function ProgressiveText({ phrases, start, end }: { phrases: readonly string[]; start: number; end: number }) {
  const progress = useProductProgress()
  return <><span className="sr-only">{phrases.join(" ")}</span>
    <span aria-hidden="true" className="oc-demo-response" data-revealed={progress >= start + (end - start) * .75}>
      {phrases.join(" ")}
    </span>
  </>
}
