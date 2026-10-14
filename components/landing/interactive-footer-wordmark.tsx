"use client"

import { useEffect, useRef } from "react"

type Letter = { element: HTMLElement; cx: number; cy: number; x: number; y: number; vx: number; vy: number; tx: number; ty: number }

/** A small, on-demand spring field. Pointer motion never causes a React render. */
export function InteractiveFooterWordmark() {
  const fieldRef = useRef<HTMLDivElement>(null)
  const lettersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const field = fieldRef.current, word = lettersRef.current
    if (!field || !word || !window.IntersectionObserver || !window.ResizeObserver) return
    const footer = field.closest("footer")!
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const letters: Letter[] = Array.from(word.querySelectorAll<HTMLElement>(".oc-footer-letter"), element => ({ element, cx: 0, cy: 0, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }))
    let frame = 0, lastTime = 0, visible = false, connected = false, disposed = false
    let radius = 160, displacement = 18

    const reset = () => {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      for (const letter of letters) {
        letter.x = letter.y = letter.vx = letter.vy = letter.tx = letter.ty = 0
        letter.element.style.transform = ""
      }
      delete field.dataset.active
    }
    const measure = () => {
      reset()
      // Layout offsets exclude transforms, so the resting geometry never drifts.
      for (const letter of letters) {
        letter.cx = letter.element.offsetLeft + letter.element.offsetWidth / 2
        letter.cy = letter.element.offsetTop + letter.element.offsetHeight / 2
      }
      const size = parseFloat(getComputedStyle(word).fontSize)
      radius = Math.min(220, Math.max(95, size * 1.15))
      displacement = Math.min(22, size * .11)
    }
    const tick = (time: number) => {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60
      lastTime = time
      let moving = false
      for (const letter of letters) {
        // Near-critical damping gives a soft return without repeated oscillation.
        letter.vx += ((letter.tx - letter.x) * 180 - letter.vx * 26) * dt
        letter.vy += ((letter.ty - letter.y) * 180 - letter.vy * 26) * dt
        letter.x += letter.vx * dt
        letter.y += letter.vy * dt
        const settled = Math.abs(letter.tx - letter.x) + Math.abs(letter.ty - letter.y) < .025 && Math.abs(letter.vx) + Math.abs(letter.vy) < .04
        if (settled) { letter.x = letter.tx; letter.y = letter.ty; letter.vx = letter.vy = 0 }
        else moving = true
        letter.element.style.transform = letter.x || letter.y ? `translate3d(${letter.x.toFixed(3)}px, ${letter.y.toFixed(3)}px, 0)` : ""
      }
      if (moving) frame = requestAnimationFrame(tick)
      else { frame = 0; lastTime = 0; delete field.dataset.active }
    }
    const animate = () => {
      if (frame) return
      field.dataset.active = "true"
      frame = requestAnimationFrame(tick)
    }
    const leave = () => {
      if (!letters.some(letter => letter.x || letter.y || letter.tx || letter.ty)) return
      for (const letter of letters) letter.tx = letter.ty = 0
      animate()
    }
    const move = (event: PointerEvent) => {
      // Touch, pen and selection gestures keep the static, selectable composition.
      if (event.pointerType !== "mouse" || event.buttons) { leave(); return }
      // One origin read accommodates scrolling and audience changes; letter geometry is cached.
      const bounds = word.getBoundingClientRect()
      const px = event.clientX - bounds.left, py = event.clientY - bounds.top
      for (const letter of letters) {
        const dx = letter.cx - px, dy = letter.cy - py
        const distance = Math.hypot(dx, dy)
        const force = Math.max(0, 1 - distance / radius) ** 2
        const divisor = Math.max(28, distance)
        letter.tx = dx / divisor * displacement * .45 * force
        letter.ty = dy / divisor * displacement * force
      }
      if (letters.some(letter => letter.tx || letter.ty || letter.x || letter.y)) animate()
    }
    const connect = () => {
      const enabled = visible && finePointer.matches && !reduced.matches && !document.hidden
      if (enabled === connected) return
      connected = enabled
      if (enabled) {
        measure()
        footer.addEventListener("pointermove", move, { passive: true })
        footer.addEventListener("pointerleave", leave)
        footer.addEventListener("pointerdown", leave)
      } else {
        footer.removeEventListener("pointermove", move)
        footer.removeEventListener("pointerleave", leave)
        footer.removeEventListener("pointerdown", leave)
        reset()
      }
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; connect() })
    const resize = new ResizeObserver(measure)
    observer.observe(field)
    resize.observe(word)
    document.fonts.ready.then(() => { if (!disposed) measure() })
    reduced.addEventListener("change", connect)
    finePointer.addEventListener("change", connect)
    document.addEventListener("visibilitychange", connect)
    return () => {
      disposed = true
      observer.disconnect()
      resize.disconnect()
      reduced.removeEventListener("change", connect)
      finePointer.removeEventListener("change", connect)
      document.removeEventListener("visibilitychange", connect)
      footer.removeEventListener("pointermove", move)
      footer.removeEventListener("pointerleave", leave)
      footer.removeEventListener("pointerdown", leave)
      reset()
    }
  }, [])

  return <div ref={fieldRef} className="oc-footer-field">
    <span className="sr-only">OutClass</span>
    <div ref={lettersRef} className="oc-footer-letters" aria-hidden="true">
      {Array.from("OUTCLASS", (letter, index) => <span className="oc-footer-letter" key={index}>{letter}</span>)}
    </div>
  </div>
}
