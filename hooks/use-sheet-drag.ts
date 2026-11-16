"use client"
import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import { createVelocityTracker, liveTranslate, project, rubberband, springCurve } from "@/lib/spring"

/**
 * Drag-to-dismiss for a bottom sheet (.claude/skills/apple-design §2–6, §9). The grabber tracks the pointer 1:1 from
 * wherever the sheet is on screen (so it can be caught mid-open or mid-snap), resists past the top with a rubber band,
 * and on release projects the flick: past half its height it closes, otherwise it springs home. Either way the spring
 * starts at the finger's release velocity, and a thrown snap-back gets a small bounce. Reduced motion keeps the 1:1
 * drag but settles without animating. `dismiss` must close the sheet through its normal path (focus return included).
 */
export function useSheetDrag(dismiss: () => void) {
  const sheet = useRef<HTMLElement | null>(null)
  const drag = useRef<{ pointer: number; grab: number; y: number } | null>(null)
  const tracker = useRef(createVelocityTracker())
  const running = useRef<Animation[]>([])
  const overlay = () => sheet.current?.parentElement?.querySelector<HTMLElement>('[data-slot="sheet-overlay"]') ?? null
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const place = (y: number) => {
    const el = sheet.current; if (!el) return
    el.style.transform = `translateY(${y}px)`
    const scrim = overlay(); if (scrim) scrim.style.opacity = String(Math.min(1, Math.max(0, 1 - y / el.offsetHeight)))
  }
  const stop = () => { running.current.forEach(a => a.cancel()); running.current = [] }
  const settle = (from: number, velocity: number, allowClose = true) => {
    const el = sheet.current; if (!el) return
    const height = el.offsetHeight
    const close = allowClose && from > 0 && from + project(velocity) > height / 2
    const to = close ? height + 24 : 0
    const finish = () => {
      stop()
      if (close) { el.style.animation = "none"; dismiss(); return } // The sheet is already off screen: no exit animation.
      el.style.transform = ""; const scrim = overlay(); if (scrim) scrim.style.opacity = ""
    }
    if (reduced() || typeof el.animate !== "function") { place(to); finish(); return }
    const { easing, duration } = springCurve({ from, to, velocity, response: 0.3, damping: !close && Math.abs(velocity) > 300 ? 0.8 : 1 })
    if (!duration) { finish(); return }
    place(to)
    const timing = { duration, easing, fill: "forwards" as const }
    const move = el.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], timing)
    const scrim = overlay()
    const fade = scrim?.animate([{ opacity: String(Math.max(0, 1 - from / height)) }, { opacity: close ? "0" : "1" }], timing)
    running.current = fade ? [move, fade] : [move]
    move.onfinish = () => { if (running.current[0] === move) finish() }
  }
  const handle = {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      const el = sheet.current
      if (!el || (event.pointerType === "mouse" && event.button !== 0)) return
      // Interrupt: start from what is on screen now (an opening slide, a snap-back or a dismissal in flight).
      const y = liveTranslate(el).y
      stop(); el.getAnimations().forEach(a => a.cancel()); overlay()?.getAnimations().forEach(a => a.cancel())
      place(y)
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { pointer: event.pointerId, grab: event.clientY - y, y }
      tracker.current.reset(); tracker.current.add(y, event.timeStamp)
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const d = drag.current, el = sheet.current
      if (!d || !el || event.pointerId !== d.pointer) return
      const raw = event.clientY - d.grab
      d.y = raw < 0 ? rubberband(raw, el.offsetHeight) : raw
      place(d.y); tracker.current.add(d.y, event.timeStamp)
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const d = drag.current; if (!d || event.pointerId !== d.pointer) return
      drag.current = null; settle(d.y, tracker.current.velocity(event.timeStamp))
    },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
      const d = drag.current; if (!d || event.pointerId !== d.pointer) return
      drag.current = null; settle(d.y, 0, false)
    },
  }
  return { sheet, handle }
}
