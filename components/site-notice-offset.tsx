"use client"

import { useEffect } from "react"

/**
 * The notice strip sits in normal flow at the top of the page. The landing header and the
 * desktop product rail are position: fixed, so they read `--oc-site-notice-offset` (the part of
 * the strip still on screen) to start below it instead of covering it. Written straight to a CSS
 * variable from a passive, frame-throttled listener: no React state, nothing re-renders.
 * Mounted only while a notice exists.
 */
export function SiteNoticeOffset() {
  useEffect(() => {
    const strip = document.querySelector<HTMLElement>("[data-site-notices]")
    const root = document.documentElement
    if (!strip) return
    let frame = 0
    const update = () => {
      frame = 0
      root.style.setProperty("--oc-site-notice-offset", `${Math.max(0, strip.offsetHeight - window.scrollY)}px`)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    const resize = new ResizeObserver(schedule)
    resize.observe(strip)
    window.addEventListener("scroll", schedule, { passive: true })
    return () => {
      resize.disconnect()
      window.removeEventListener("scroll", schedule)
      if (frame) window.cancelAnimationFrame(frame)
      root.style.removeProperty("--oc-site-notice-offset")
    }
  }, [])
  return null
}
