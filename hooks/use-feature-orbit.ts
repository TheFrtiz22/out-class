"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { orbitOffset, orbitPose } from "@/lib/feature-orbit"

export function useFeatureOrbit(count: number) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ active: number; settled: number | null; enhanced: boolean }>({ active: 0, settled: null, enhanced: false })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-orbit-card]"))
    const anchors = Array.from(root.querySelectorAll<HTMLElement>("[data-orbit-anchor]"))
    const links = Array.from(root.querySelectorAll<HTMLElement>(".oc-orbit-index a"))
    const titles = cards.map(card => card.querySelector<HTMLElement>(".oc-orbit-title")!)
    const descriptions = cards.map(card => card.querySelector<HTMLElement>(".oc-orbit-description")!)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const roomy = window.matchMedia("(min-width: 900px) and (min-height: 760px), (min-width: 768px) and (max-width: 899px) and (min-height: 900px), (min-width: 380px) and (max-width: 767px) and (min-height: 840px)")
    let frame = 0, step = 1, width = 1, enhanced = false, last = ""
    const publish = (active: number, settled: number | null) => {
      const key = `${active}:${settled}:${enhanced}`
      if (last === key) return
      last = key
      root.dataset.activeChapter = String(active)
      setState({ active, settled, enhanced })
    }
    const render = () => {
      frame = 0
      const bounds = root.getBoundingClientRect()
      const top = parseFloat(getComputedStyle(root).getPropertyValue("--oc-orbit-top")) || 100
      const position = Math.max(enhanced ? -.6 : 0, Math.min(count - 1, (top - bounds.top) / step))
      const reading = enhanced ? 0 : anchors.findIndex(anchor => anchor.getBoundingClientRect().bottom > top + 40)
      const active = enhanced ? Math.max(0, Math.round(position)) : reading < 0 ? count - 1 : reading
      let settled: number | null = enhanced ? null : active
      cards.forEach((card, index) => {
        const offset = orbitOffset(position, index)
        const pose = orbitPose(offset, width)
        const visible = !enhanced || Math.abs(index - position) < .79
        const readable = !enhanced || offset === 0
        if (enhanced && readable) settled = index
        card.style.visibility = visible ? "visible" : "hidden"
        card.style.opacity = enhanced ? String(pose.opacity) : "1"
        card.style.transform = enhanced ? `translate3d(${pose.x.toFixed(2)}px,${pose.y.toFixed(2)}px,0) rotate(${pose.rotation.toFixed(3)}deg) scale(${pose.scale})` : "none"
        // Only the upright panel participates in keyboard navigation and playback.
        if (card.inert === readable) card.inert = !readable
        card.setAttribute("aria-hidden", String(!readable))
        const title = titles[index]
        const description = descriptions[index]
        title.style.transform = enhanced ? `translateY(${offset * -12}px)` : "none"
        description.style.transform = enhanced ? `translateY(${offset * -22}px)` : "none"
        description.style.opacity = enhanced ? String(Math.max(0, 1 - Math.abs(offset) * 1.7)) : "1"
      })
      links.forEach((link, index) => { if (index === active) link.setAttribute("aria-current", "step"); else link.removeAttribute("aria-current") })
      publish(active, settled)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render) }
    const measure = () => {
      enhanced = roomy.matches && !reduced.matches
      step = Math.max(480, window.innerHeight * .8)
      width = Math.min(1040, root.clientWidth - (window.innerWidth < 768 ? 40 : 96))
      root.style.setProperty("--oc-orbit-step", `${step}px`)
      root.style.setProperty("--oc-orbit-run", `${(count - 1 + .35) * step}px`)
      root.dataset.orbitEnhanced = String(enhanced)
      anchors.forEach((anchor, index) => {
        anchor.style.top = `${enhanced ? index * step : cards[index].offsetTop + cards[index].parentElement!.offsetTop}px`
        anchor.style.height = `${enhanced ? step : cards[index].offsetHeight}px`
      })
      render()
    }
    measure()
    // Restore numbered links after hydration establishes the pinned geometry.
    const initialLink = requestAnimationFrame(() => {
      if (!/^#journey-\d+$/.test(window.location.hash)) return
      const anchor = anchors.find(anchor => `#${anchor.id}` === window.location.hash)
      anchor?.scrollIntoView({ block: "start", behavior: "instant" })
      render()
    })
    const resize = new ResizeObserver(measure)
    resize.observe(root)
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", measure)
    reduced.addEventListener("change", measure)
    roomy.addEventListener("change", measure)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(initialLink)
      resize.disconnect()
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", measure)
      reduced.removeEventListener("change", measure)
      roomy.removeEventListener("change", measure)
    }
  }, [count])

  return { rootRef, ...state }
}
