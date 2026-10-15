"use client"

import type { MouseEvent } from "react"
import { ArrowUp } from "@/components/icons"
import type { LandingPerspective } from "./journey-content"

const scrollBehavior = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" as const : "smooth" as const
const isPlainClick = (event: MouseEvent<HTMLAnchorElement>) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
const audiences = [
  { perspective: "student", href: "/?audience=student#students", label: "For Students" },
  { perspective: "leader", href: "/?audience=leader#club-leaders", label: "For Club Leaders" },
] as const

export function FooterAudienceLinks({ onPerspectiveChange }: { onPerspectiveChange?: (perspective: LandingPerspective) => void }) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>, perspective: LandingPerspective) => {
    if (!onPerspectiveChange || !isPlainClick(event)) return
    event.preventDefault()
    onPerspectiveChange(perspective)
    // Let the existing audience hook restore its position before navigating to the overview.
    requestAnimationFrame(() => {
      const target = document.getElementById("about")
      target?.scrollIntoView({ behavior: scrollBehavior(), block: "start" })
      if (target && !target.hasAttribute("tabindex")) target.tabIndex = -1
      target?.focus({ preventScroll: true })
    })
  }
  return <>{audiences.map(audience => <a key={audience.perspective} href={audience.href} onClick={event => navigate(event, audience.perspective)}>{audience.label}</a>)}</>
}

export function FooterBackToTop() {
  return <a className="oc-footer-top-link" href="#top" onClick={event => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    const target = document.getElementById("top")
    if (target) {
      target.scrollIntoView({ behavior: scrollBehavior(), block: "start" })
      target.querySelector<HTMLAnchorElement>(".oc-public-logo")?.focus({ preventScroll: true })
      // Preserve audience and campaign parameters without triggering another navigation.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#top`)
    }
  }}>Back to Top <ArrowUp size={15} aria-hidden="true" /></a>
}
