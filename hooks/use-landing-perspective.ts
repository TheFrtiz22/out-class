"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { equivalentJourneyStage, perspectiveFromHash, perspectiveHash, type JourneyStage, type LandingPerspective } from "@/components/landing/journey-content"
import { audienceFromPreference, audienceFromQuery, DEFAULT_LANDING_AUDIENCE, LANDING_AUDIENCE_PREFERENCE, setLandingAudienceGate } from "@/lib/landing-audience"

export function useLandingPerspective(initial: LandingPerspective = DEFAULT_LANDING_AUDIENCE) {
  const [perspective, setPerspective] = useState<LandingPerspective>(initial)
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

  useLayoutEffect(() => {
    let saved: LandingPerspective | null = null
    try { saved = audienceFromPreference(window.localStorage.getItem(LANDING_AUDIENCE_PREFERENCE)) } catch { /* Public preference storage may be blocked. */ }
    const explicit = perspectiveFromHash(window.location.hash) ?? audienceFromQuery(new URLSearchParams(window.location.search).get("audience"))
    const next = explicit ?? saved ?? initial
    setLandingAudienceGate(next)
    if (/^#journey-\d+$/.test(window.location.hash)) position.current = { selector: window.location.hash, fraction: 0, line: 112 }
    setPerspective(next)
  }, [initial])

  useEffect(() => {
    const sync = () => {
      const requested = new URLSearchParams(window.location.search).get("audience")
      const next = perspectiveFromHash(window.location.hash) ?? (requested === "student" || requested === "leader" ? requested : null)
      if (next) {
        setLandingAudienceGate(next)
        // Resolve a numbered anchor against the requested audience before paint.
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
    const value = next === "student" ? "students" : "club-leaders"
    try { window.localStorage.setItem(LANDING_AUDIENCE_PREFERENCE, value) } catch { /* Keep the current selection without storage. */ }
    // Mirror the public preference so returning visitors receive matching SSR HTML.
    try { document.cookie = `${LANDING_AUDIENCE_PREFERENCE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}` } catch { /* A blocked cookie does not prevent an explicit choice. */ }
    setLandingAudienceGate(next)
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
