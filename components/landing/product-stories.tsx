"use client"

import type { LandingPerspective } from "./journey-content"
import { JourneyTabs } from "./journey-tabs"
import "./journey.css"
import "./journey-tabs.css"
import "./journey-atmosphere.css"
import "./public-foundations.css"
import type { useJourneyNavigation } from "@/hooks/use-journey-navigation"

/** "How OutClass works" (docs/public-site/redesign/Main.mockup.html): a heading and one tabbed walkthrough. */
export function ProductJourney({ perspective, navigation }: {
  perspective: LandingPerspective
  navigation: ReturnType<typeof useJourneyNavigation>
}) {
  return (
    <section ref={navigation.showcaseRef} id="about" className="oc-product-stories" aria-labelledby="how-title">
      <span id="students" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Student product overview" />
      <span id="club-leaders" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <span id="clubs" className="oc-perspective-anchor" tabIndex={-1} role="group" aria-label="Club leader product overview" />
      <div className="oc-how-introduction">
        <p className="oc-journey-kicker">How OutClass works</p>
        <h2 id="how-title">{perspective === "student" ? "From discovering a club to joining it." : "From first applicant to your next class."}</h2>
      </div>
      {/* No in-section switch: the hero sets the audience. The sentinel still hands the header its compact switch. */}
      <div className="oc-journey-controls-slot" data-merged={navigation.merged}>
        <span ref={navigation.controlsRef} className="oc-journey-handoff-sentinel" aria-hidden="true" />
      </div>
      <p className="sr-only" role="status">Showing the {perspective === "student" ? "student" : "club leader"} walkthrough.</p>
      <JourneyTabs perspective={perspective} />
      <span ref={navigation.endRef} className="oc-journey-end-sentinel" aria-hidden="true" />
    </section>
  )
}
