"use client"

import { useEffect, useRef, useState } from "react"
import "@/components/clubs/employer-carousel.css"

/**
 * "Where members go" as a 3D pill carousel: up to three rails that drift in alternating directions,
 * slow on hover, and can be dragged or swiped with momentum. Firm names render as text wordmarks
 * (no employer logos). Screen readers and reduced-motion users get the plain list instead.
 */
const BASE_SPEED = 28 // px per second
const HOVER_FACTOR = 0.15
const MAX_ROWS = 3
const MIN_PER_ROW = 3

export function EmployerCarousel({ names }: { names: string[] }) {
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setAnimate(!media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  // Three rails once there are enough names to fill them; fewer names use fewer rails.
  const rowCount = Math.max(1, Math.min(MAX_ROWS, Math.floor(names.length / MIN_PER_ROW)))
  const rows = Array.from({ length: rowCount }, (_, r) => names.filter((_, i) => i % rowCount === r))
  return <div className="oc-employer-carousel">
    <ul className={animate ? "sr-only" : "oc-employer-static"}>{names.map(name => <li key={name}><span className="oc-employer-pill">{name}</span></li>)}</ul>
    {animate && <div className="oc-employer-stage" aria-hidden="true">
      {rows.map((row, i) => <Rail key={i} names={row} direction={i % 2 === 0 ? -1 : 1} />)}
    </div>}
  </div>
}

function Rail({ names, direction }: { names: string[]; direction: 1 | -1 }) {
  const rail = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [copies, setCopies] = useState(2)

  // Enough copies that one set's width plus the viewport is always covered while wrapping.
  useEffect(() => {
    const el = rail.current, t = track.current
    if (!el || !t) return
    const measure = () => {
      const set = t.scrollWidth / copies
      if (set > 0) setCopies(Math.max(2, Math.ceil(el.clientWidth / set) + 1))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [copies, names])

  useEffect(() => {
    const el = rail.current, t = track.current
    if (!el || !t) return
    let offset = 0, speedFactor = 1, targetFactor = 1, last = 0, frame = 0, visible = false
    let dragging = false, dragX = 0, moveAt = 0, velocity = 0, momentum = 0
    const setWidth = () => t.scrollWidth / copies

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      speedFactor += (targetFactor - speedFactor) * Math.min(1, dt * 6)
      if (!dragging) {
        offset += direction * BASE_SPEED * speedFactor * dt + momentum * dt
        momentum *= Math.pow(0.04, dt) // momentum decays to the base drift within about a second
        if (Math.abs(momentum) < 1) momentum = 0
      }
      const width = setWidth()
      if (width > 0) offset = ((offset % width) + width) % width - width
      t.style.transform = `translate3d(${offset}px,0,0)`
      frame = visible ? requestAnimationFrame(tick) : 0
    }
    const start = () => { if (!frame) { last = 0; frame = requestAnimationFrame(tick) } }

    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start() })
    seen.observe(el)

    const enter = () => { targetFactor = HOVER_FACTOR }
    const leave = () => { targetFactor = 1 }
    const down = (e: PointerEvent) => {
      dragging = true; dragX = e.clientX; moveAt = e.timeStamp; velocity = 0; momentum = 0
      el.setPointerCapture(e.pointerId)
      el.dataset.dragging = "true"
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - dragX
      dragX = e.clientX
      offset += dx
      const elapsed = Math.max(e.timeStamp - moveAt, 8)
      moveAt = e.timeStamp
      velocity = velocity * 0.6 + (dx / elapsed) * 1000 * 0.4
      start()
    }
    const up = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      momentum = Math.max(-2400, Math.min(2400, velocity))
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      delete el.dataset.dragging
    }
    el.addEventListener("pointerenter", enter)
    el.addEventListener("pointerleave", leave)
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
    return () => {
      cancelAnimationFrame(frame)
      seen.disconnect()
      el.removeEventListener("pointerenter", enter)
      el.removeEventListener("pointerleave", leave)
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
    }
  }, [copies, direction])

  return <div ref={rail} className="oc-employer-rail">
    <div ref={track} className="oc-employer-track">
      {Array.from({ length: copies }, (_, c) => names.map(name => <span key={`${c}-${name}`} className="oc-employer-pill">{name}</span>))}
    </div>
  </div>
}
