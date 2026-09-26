"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"

const ProgressContext = createContext(1)
export const useProductProgress = () => useContext(ProgressContext)

/** One finite demonstration, measured in visible time. Static HTML is the complete example. */
export function ProductMotion({ children, duration = 14000 }: { children: ReactNode; duration?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const elapsedRef = useRef(0)
  const [progress, setProgress] = useState(1)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)")
    if (!window.IntersectionObserver) return
    let visible = false
    let elapsed = elapsedRef.current
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => { clearInterval(timer); timer = undefined }
    const sync = () => {
      stop()
      setReduced(preference.matches)
      if (preference.matches) { setProgress(1); return }
      if (!visible || document.hidden || paused || elapsed >= duration) return
      timer = setInterval(() => {
        elapsed = Math.min(duration, elapsed + 160)
        elapsedRef.current = elapsed
        setProgress(elapsed / duration)
        if (elapsed === duration) stop()
      }, 160)
    }
    setProgress(preference.matches ? 1 : elapsed / duration)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() }, { threshold: .35 })
    if (ref.current) observer.observe(ref.current)
    preference.addEventListener("change", sync)
    document.addEventListener("visibilitychange", sync)
    sync()
    return () => { stop(); observer.disconnect(); preference.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync) }
  }, [duration, paused])
  return <div ref={ref} className="oc-product-motion">
    <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    {!reduced && <button type="button" className="oc-demo-control" disabled={progress === 1} onClick={() => setPaused(value => !value)}>{progress === 1 ? "Example complete" : paused ? "Resume example" : "Pause example"}</button>}
  </div>
}

export function Fill({ at, children }: { at: number; children: ReactNode }) {
  const progress = useProductProgress()
  return <span className="oc-demo-fill" style={{ opacity: progress >= at ? 1 : .15, transform: progress >= at ? "none" : "translateY(3px)" }}>{children}</span>
}
