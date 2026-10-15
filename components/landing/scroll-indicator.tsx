"use client"

import { useEffect, useRef, useState } from "react"
import { Triangle } from "@/components/icons"
import { cn } from "@/lib/utils"
import "./scroll-indicator.css"

/** Independently authored motion inspired by the reference's public preview. */
export function ScrollIndicator({ targetId = "about", label = "Scroll to learn how OutClass works", className }: {
  targetId?: string
  label?: string
  className?: string
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [available, setAvailable] = useState(true)
  const [pageVisible, setPageVisible] = useState(true)

  useEffect(() => {
    const button = buttonRef.current
    const region = button?.closest<HTMLElement>("[data-scroll-indicator-region]") ?? button?.parentElement
    if (!button || !region) return
    const content = region.querySelector<HTMLElement>("[data-scroll-indicator-content]")
    const navigation = document.querySelector(".oc-public-nav-surface")
    let observer: IntersectionObserver | undefined
    let meaningfullyVisible = true
    const measure = () => {
      const hero = region.getBoundingClientRect()
      const control = button.getBoundingClientRect()
      const basis = Math.min(hero.height, window.innerHeight)
      const visibleHeight = Math.max(0, Math.min(hero.bottom, window.innerHeight) - Math.max(hero.top, 0))
      // Hysteresis also works when the mobile hero is taller than the viewport.
      meaningfullyVisible = visibleHeight / Math.max(1, basis) >= (meaningfullyVisible ? .45 : .6)
      const fits = !content || control.top - content.getBoundingClientRect().bottom >= 16
      const safeTop = navigation ? navigation.getBoundingClientRect().bottom + 8 : 0
      const inViewport = control.width > 0 && control.top >= safeTop && control.bottom <= window.innerHeight
      setAvailable(meaningfullyVisible && fits && inViewport)
    }
    const connect = () => {
      observer?.disconnect()
      measure()
      if (typeof IntersectionObserver === "undefined") return
      const height = Math.max(1, region.getBoundingClientRect().height)
      const portion = Math.min(height, window.innerHeight) / height
      observer = new IntersectionObserver(measure, { threshold: [0, .45 * portion, .6 * portion, 1] })
      observer.observe(region)
      observer.observe(button)
    }
    const visibility = () => setPageVisible(!document.hidden)
    connect()
    visibility()
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(connect)
    resize?.observe(region)
    if (content) resize?.observe(content)
    // Browser chrome changes viewport height without necessarily resizing the hero.
    window.addEventListener("resize", connect, { passive: true })
    document.addEventListener("visibilitychange", visibility)
    return () => { observer?.disconnect(); resize?.disconnect(); window.removeEventListener("resize", connect); document.removeEventListener("visibilitychange", visibility) }
  }, [])

  const explore = () => {
    const target = document.getElementById(targetId)
    if (!target) return
    const header = document.querySelector(".oc-public-nav-surface")
    const clearance = Math.max(parseFloat(getComputedStyle(target).scrollMarginTop) || 0, (header?.getBoundingClientRect().bottom ?? 0) + 24)
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - clearance)
    const next = new URL(window.location.href)
    next.hash = targetId
    if (next.href !== window.location.href) {
      const oldURL = window.location.href
      // Keep Next's history state and the site's native fragment/focus contract.
      window.history.pushState(window.history.state, "", next.href)
      window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: next.href }))
    }
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
    target.focus({ preventScroll: true })
    window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
  }

  return (
    <button ref={buttonRef} type="button" className={cn("oc-scroll-indicator", className)} aria-label={label} aria-controls={targetId} aria-hidden={!available} disabled={!available} tabIndex={available ? 0 : -1} data-available={available} data-running={available && pageVisible} onClick={explore}>
      <span className="oc-scroll-indicator-motion" aria-hidden="true"><Triangle className="oc-scroll-indicator-arrow" size={26} weight="fill" /></span>
    </button>
  )
}
