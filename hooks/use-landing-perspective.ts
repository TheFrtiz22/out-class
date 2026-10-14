"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { equivalentJourneyStage, perspectiveFromHash, perspectiveHash, type JourneyStage, type LandingPerspective } from "@/components/landing/journey-content"

export function useLandingPerspective() {
  const [perspective, setPerspective] = useState<LandingPerspective>("student")
  const position = useRef<{ stage?: JourneyStage; selector?: string; fraction: number; line: number } | null>(null)

  useLayoutEffect(() => {
    const saved = position.current
    if (!saved) return
    position.current = null
    const target = document.querySelector<HTMLElement>(saved.stage
      ? `#product-journey [data-stage="${equivalentJourneyStage(saved.stage, perspective)}"]`
      : saved.selector ?? "")
    if (!target) return
    const bounds = target.getBoundingClientRect()
    window.scrollTo({ top: window.scrollY + bounds.top + bounds.height * saved.fraction - saved.line, behavior: "instant" })
  }, [perspective])

  useEffect(() => {
    const sync = () => {
      const requested = new URLSearchParams(window.location.search).get("audience")
      const next = perspectiveFromHash(window.location.hash) ?? (requested === "student" || requested === "leader" ? requested : null)
      if (next) {
        // A leader deep link initially receives student SSR markup. Resolve the
        // anchor again against the hydrated audience, before the next paint.
        if (/^#journey-\d+$/.test(window.location.hash)) position.current = { selector: window.location.hash, fraction: 0, line: 112 }
        setPerspective(next)
      }
    }
    sync()
    window.addEventListener("hashchange", sync)
    window.addEventListener("popstate", sync)
    return () => {
      window.removeEventListener("hashchange", sync)
      window.removeEventListener("popstate", sync)
    }
  }, [])

  const switchPerspective = useCallback((next: LandingPerspective) => {
    if (next === perspective) return
    const line = Math.min(window.innerHeight * .35, 260)
    const chapter = Array.from(document.querySelectorAll<HTMLElement>("#product-journey [data-stage]")).find(element => {
      const bounds = element.getBoundingClientRect()
      return bounds.top <= line && bounds.bottom > line
    })
    const afterJourney = [".oc-how-introduction", ".oc-journey-controls-slot", ".oc-journey-index", ".oc-journey-thread", ".oc-final-invitation", ".oc-public-footer", ".oc-photo-credit"].find(selector => {
      const bounds = document.querySelector(selector)?.getBoundingClientRect()
      return bounds && bounds.top <= line && bounds.bottom > line
    })
    const anchor = chapter ?? (afterJourney ? document.querySelector<HTMLElement>(afterJourney) : null)
    if (anchor) {
      const bounds = anchor.getBoundingClientRect()
      position.current = { stage: chapter?.dataset.stage as JourneyStage | undefined, selector: afterJourney, fraction: (line - bounds.top) / bounds.height, line }
    }
    setPerspective(next)
    // Legacy perspective anchors remain valid. Chapter links also encode audience.
    const params = new URLSearchParams(window.location.search)
    params.set("audience", next)
    // Next's native history integration updates search params without a server
    // navigation or a later hash-scroll overriding the restored reading position.
    window.history.replaceState(null, "", `?${params}${perspectiveHash(next)}`)
  }, [perspective])

  return { perspective, switchPerspective }
}
